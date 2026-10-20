import "server-only";

import { notFound } from "next/navigation";

import { requireBusinessContext } from "@/features/business/queries";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

import { searchPattern } from "./search";

export const CLIENTS_PAGE_SIZE = 25;

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

export type ClientSummary = Pick<
  ClientRow,
  "id" | "first_name" | "last_name" | "email" | "phone_e164"
> & { email_reminders_consent: boolean };

export type ClientDetail = Pick<
  ClientRow,
  | "id"
  | "first_name"
  | "last_name"
  | "email"
  | "phone_e164"
  | "email_reminders_consent"
  | "notes"
  | "created_at"
>;

export type ConsentEvent = Pick<
  Database["public"]["Tables"]["consent_events"]["Row"],
  "id" | "channel" | "action" | "source" | "created_at"
>;

function loadFailed(event: string, message: string): never {
  logger.error(event, { message });
  throw new Error("Could not load your clients. Please try again.");
}

/** One page of the business's active clients, optionally filtered by a search term. */
export async function listClients({
  search,
  page,
}: {
  search: string;
  page: number;
}): Promise<{ clients: ClientSummary[]; total: number }> {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const from = (page - 1) * CLIENTS_PAGE_SIZE;

  let query = supabase
    .from("clients")
    .select(
      "id, first_name, last_name, email, phone_e164, email_reminders_consent",
      { count: "exact" },
    )
    .eq("business_id", business.id)
    .is("deleted_at", null);

  const pattern = searchPattern(search);
  if (pattern) {
    query = query.or(
      ["first_name", "last_name", "email", "phone_e164"]
        .map((column) => `${column}.ilike.${pattern}`)
        .join(","),
    );
  }

  const { data, count, error } = await query
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, from + CLIENTS_PAGE_SIZE - 1);

  if (error) loadFailed("clients.list_failed", error.message);
  return { clients: data, total: count ?? 0 };
}

/** A single active client of the current business, or a 404. */
export async function getClient(id: string): Promise<ClientDetail> {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, first_name, last_name, email, phone_e164, email_reminders_consent, notes, created_at",
    )
    .eq("business_id", business.id)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) loadFailed("clients.get_failed", error.message);
  if (!data) notFound();
  return data;
}

export async function getConsentHistory(
  clientId: string,
): Promise<ConsentEvent[]> {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("consent_events")
    .select("id, channel, action, source, created_at")
    .eq("business_id", business.id)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) loadFailed("clients.consent_history_failed", error.message);
  return data;
}

/** Counts shown on the dashboard. */
export async function getClientStats(): Promise<{
  total: number;
  emailConsent: number;
}> {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const active = () =>
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .is("deleted_at", null);

  const [all, consenting] = await Promise.all([
    active(),
    active().eq("email_reminders_consent", true),
  ]);
  const error = all.error ?? consenting.error;
  if (error) loadFailed("clients.stats_failed", error.message);
  return { total: all.count ?? 0, emailConsent: consenting.count ?? 0 };
}
