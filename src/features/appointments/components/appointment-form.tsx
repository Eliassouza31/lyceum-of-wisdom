"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState, type FormState } from "@/lib/forms";

import { formatDuration } from "../format";
import type { ClientOption } from "../queries";
import { DURATION_OPTIONS } from "../schemas";

type AppointmentFormAction = (
  previous: FormState,
  formData: FormData,
) => Promise<FormState>;

export type AppointmentFormDefaults = {
  clientId?: string;
  title?: string;
  date?: string;
  startTime?: string;
  duration?: string;
  location?: string;
  notes?: string;
};

/** Create and edit form. `defaults` holds the saved or suggested values. */
export function AppointmentForm({
  action,
  clients,
  defaults,
  timezoneLabel,
  submitLabel,
}: {
  action: AppointmentFormAction;
  clients: ClientOption[];
  defaults: AppointmentFormDefaults;
  timezoneLabel: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  // After a failed submit, show what was typed instead of the saved values.
  const values = state.values;
  const initial = (field: keyof AppointmentFormDefaults) =>
    values ? (values[field] ?? "") : (defaults[field] ?? "");

  const savedDuration = Number(defaults.duration);
  const durations: number[] = [...DURATION_OPTIONS];
  if (savedDuration > 0 && !durations.includes(savedDuration)) {
    durations.push(savedDuration);
    durations.sort((a, b) => a - b);
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}
      {/* Remount fields after each submit so their defaults reflect the latest values. */}
      <div key={JSON.stringify(values ?? {})} className="space-y-5">
        <SelectField
          id="clientId"
          label="Client"
          required
          defaultValue={initial("clientId")}
          errors={state.fieldErrors?.clientId}
        >
          <option value="" disabled>
            Choose a client
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {`${client.first_name} ${client.last_name}`.trim()}
            </option>
          ))}
        </SelectField>
        <TextField
          id="title"
          label="Service"
          autoComplete="off"
          placeholder="e.g. Haircut"
          required
          maxLength={120}
          defaultValue={initial("title")}
          errors={state.fieldErrors?.title}
        />
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField
            id="date"
            label="Date"
            type="date"
            required
            defaultValue={initial("date")}
            errors={state.fieldErrors?.date}
          />
          <TextField
            id="startTime"
            label="Start time"
            type="time"
            step={300}
            required
            defaultValue={initial("startTime")}
            errors={state.fieldErrors?.startTime}
          />
          <SelectField
            id="duration"
            label="Length"
            required
            defaultValue={initial("duration") || "60"}
            errors={state.fieldErrors?.duration}
          >
            {durations.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(minutes)}
              </option>
            ))}
          </SelectField>
        </div>
        <p className="-mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Times are in {timezoneLabel}.
        </p>
        <TextField
          id="location"
          label="Location"
          autoComplete="off"
          placeholder="Optional"
          maxLength={200}
          defaultValue={initial("location")}
          errors={state.fieldErrors?.location}
        />
        <TextAreaField
          id="notes"
          label="Notes"
          maxLength={1000}
          hint="Do not store medical or other sensitive health information here."
          defaultValue={initial("notes")}
          errors={state.fieldErrors?.notes}
        />
      </div>
      <SubmitButton pendingLabel="Saving…" className="w-full sm:w-auto">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
