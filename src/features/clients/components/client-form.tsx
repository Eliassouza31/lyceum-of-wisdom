"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { CheckboxField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState, type FormState } from "@/lib/forms";
import { formatPhone } from "@/lib/phone";

import type { ClientDetail } from "../queries";

type ClientFormAction = (
  previous: FormState,
  formData: FormData,
) => Promise<FormState>;

/** Create and edit form. `client` is the saved record when editing. */
export function ClientForm({
  action,
  client,
  submitLabel,
}: {
  action: ClientFormAction;
  client?: ClientDetail;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  // After a failed submit, show what was typed instead of the saved values.
  const values = state.values;
  const initial = (field: string, saved: string | null | undefined) =>
    values ? (values[field] ?? "") : (saved ?? "");
  const consentChecked = values
    ? values.emailConsent === "on"
    : (client?.email_reminders_consent ?? false);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}
      {/* Remount fields after each submit so their defaults reflect the latest values. */}
      <div key={JSON.stringify(values ?? {})} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="firstName"
            label="First name"
            autoComplete="off"
            required
            defaultValue={initial("firstName", client?.first_name)}
            errors={state.fieldErrors?.firstName}
          />
          <TextField
            id="lastName"
            label="Last name"
            autoComplete="off"
            defaultValue={initial("lastName", client?.last_name)}
            errors={state.fieldErrors?.lastName}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="off"
            defaultValue={initial("email", client?.email)}
            errors={state.fieldErrors?.email}
          />
          <TextField
            id="phone"
            label="Mobile phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="(555) 123-4567"
            defaultValue={initial(
              "phone",
              client?.phone_e164 ? formatPhone(client.phone_e164) : null,
            )}
            errors={state.fieldErrors?.phone}
          />
        </div>
        <CheckboxField
          id="emailConsent"
          label="This client agreed to receive appointment reminders by email"
          hint="Only check this if the client said yes. Each change is saved in the client's consent history."
          defaultChecked={consentChecked}
          errors={state.fieldErrors?.emailConsent}
        />
        <TextAreaField
          id="notes"
          label="Notes"
          maxLength={1000}
          hint="Do not store medical or other sensitive health information here."
          defaultValue={initial("notes", client?.notes)}
          errors={state.fieldErrors?.notes}
        />
      </div>
      <SubmitButton pendingLabel="Saving…" className="w-full sm:w-auto">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
