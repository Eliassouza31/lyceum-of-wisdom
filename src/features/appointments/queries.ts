import "server-only";

import { notFound } from "next/navigation";

import { requireBusinessContext } from "@/features/business/queries";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { startOfLocalDay, addDays, todayIn } from "@/lib/time";
import type { Database } from "@/types/database.types";

export const APPOINTMENTS_PAGE_SIZE = 25;
// The client picker lists every active client; enough for a small business.
const CLIENT_OPTIONS_LIMIT = 1000;

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

type ClientRef = { id: string; first_name: string; last_name: string };

export type AppointmentSummary = Pick<
  AppointmentRow,
  "id" | "title" | "starts_at" | "ends_at" | "status" | "location"
> & { client: ClientRef };

export type AppointmentDetail = AppointmentSummary &
  Pick<AppointmentRow, "client_id" | "notes" | "created_at">;

export type ClientOption = ClientRef;

const SUMMARY_COLUMNS =
  "id, title, starts_at, ends_at, status, location, client:clients!inner (id, first_name, last_name)";

function loadFailed(event: string, message: string): never {
  logger.error(event, { message });
  throw new Error("Could not load your appointments. Please try again.");
}

/** Appointments starting inside [start, end), oldest first. */
export async function listAppointmentsBetween(
  start: Date,
  end: Date,
): Promise<AppointmentSummary[]> {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(SUMMARY_COLUMNS)
    .eq("business_id", business.id)
    .is("deleted_at", null)
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString())
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1000);

  if (error) loadFailed("appointments.range_failed", error.message);
  return data;
}

/** One page of upcoming (soonest first) or past (latest first) appointments. */
export async function listAppointments({
  scope,
  page,
}: {
  scope: "upcoming" | "past";
  page: number;
}): Promise<{ appointments: AppointmentSummary[]; total: number }> {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const from = (page - 1) * APPOINTMENTS_PAGE_SIZE;
  const now = new Date().toISOString();

  let query = supabase
    .from("appointments")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .eq("business_id", business.id)
    .is("deleted_at", null);
  query =
    scope === "upcoming"
      ? query.gte("ends_at", now).order("starts_at", { ascending: true })
      : query.lt("ends_at", now).order("starts_at", { ascending: false });

  const { data, count, error } = await query
    .order("id", { ascending: true })
    .range(from, from + APPOINTMENTS_PAGE_SIZE - 1);

  if (error) loadFailed("appointments.list_failed", error.message);
  return { appointments: data, total: count ?? 0 };
}

/** A single appointment of the current business, or a 404. */
export async function getAppointment(id: string): Promise<AppointmentDetail> {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(`${SUMMARY_COLUMNS}, client_id, notes, created_at`)
    .eq("business_id", business.id)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) loadFailed("appointments.get_failed", error.message);
  if (!data) notFound();
  return data;
}

/** A client's most recent and upcoming appointments, latest first. */
export async function listClientAppointments(
  clientId: string,
): Promise<AppointmentSummary[]> {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(SUMMARY_COLUMNS)
    .eq("business_id", business.id)
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("starts_at", { ascending: false })
    .limit(20);

  if (error) loadFailed("appointments.client_list_failed", error.message);
  return data;
}

/** Active clients for the "Client" picker, alphabetical. */
export async function listClientOptions(): Promise<ClientOption[]> {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("business_id", business.id)
    .is("deleted_at", null)
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true })
    .limit(CLIENT_OPTIONS_LIMIT);

  if (error) loadFailed("appointments.client_options_failed", error.message);
  return data;
}

/** Counts and the next few appointments, for the dashboard. */
export async function getAppointmentOverview(): Promise<{
  today: number;
  upcoming: number;
  total: number;
  next: AppointmentSummary[];
}> {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const today = todayIn(business.timezone, now);
  const todayStart = startOfLocalDay(today, business.timezone).toISOString();
  const todayEnd = startOfLocalDay(
    addDays(today, 1),
    business.timezone,
  ).toISOString();

  const count = () =>
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .is("deleted_at", null);

  const [todayResult, upcomingResult, totalResult, nextResult] =
    await Promise.all([
      count()
        .eq("status", "scheduled")
        .gte("starts_at", todayStart)
        .lt("starts_at", todayEnd),
      count().eq("status", "scheduled").gte("starts_at", now.toISOString()),
      count(),
      supabase
        .from("appointments")
        .select(SUMMARY_COLUMNS)
        .eq("business_id", business.id)
        .is("deleted_at", null)
        .eq("status", "scheduled")
        .gte("starts_at", now.toISOString())
        .order("starts_at", { ascending: true })
        .limit(5),
    ]);

  const error =
    todayResult.error ??
    upcomingResult.error ??
    totalResult.error ??
    nextResult.error;
  if (error) loadFailed("appointments.overview_failed", error.message);
  return {
    today: todayResult.count ?? 0,
    upcoming: upcomingResult.count ?? 0,
    total: totalResult.count ?? 0,
    next: nextResult.data ?? [],
  };
}
