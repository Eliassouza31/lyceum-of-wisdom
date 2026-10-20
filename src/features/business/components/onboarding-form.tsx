"use client";

import { useActionState, useEffect, useRef } from "react";

import { Alert } from "@/components/ui/alert";
import { SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/forms";

import { createBusinessAction } from "../actions";
import { DEFAULT_TIMEZONE, US_TIMEZONES, isUsTimezone } from "../timezones";

export function OnboardingForm() {
  const [state, formAction] = useActionState(
    createBusinessAction,
    initialFormState,
  );
  const timezoneRef = useRef<HTMLSelectElement>(null);
  const submittedTimezone = state.values?.timezone;

  // Preselect the browser's time zone when it is one we support. Done after
  // mount so the server-rendered HTML matches the first client render.
  useEffect(() => {
    if (submittedTimezone || !timezoneRef.current) return;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isUsTimezone(detected)) timezoneRef.current.value = detected;
  }, [submittedTimezone]);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}
      <TextField
        id="name"
        label="Business name"
        autoComplete="organization"
        placeholder="e.g. Downtown Barbershop"
        required
        defaultValue={state.values?.name}
        errors={state.fieldErrors?.name}
      />
      <SelectField
        id="timezone"
        label="Time zone"
        ref={timezoneRef}
        key={submittedTimezone ?? "initial"}
        defaultValue={submittedTimezone ?? DEFAULT_TIMEZONE}
        hint="Appointments and reminders use this time zone. Daylight saving time is handled automatically."
        errors={state.fieldErrors?.timezone}
      >
        {US_TIMEZONES.map((zone) => (
          <option key={zone.value} value={zone.value}>
            {zone.label}
          </option>
        ))}
      </SelectField>
      <SubmitButton pendingLabel="Setting up…" className="w-full">
        Continue
      </SubmitButton>
    </form>
  );
}
