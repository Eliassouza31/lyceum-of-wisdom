"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState, type FormState } from "@/lib/forms";

type FormAction = (
  previous: FormState,
  formData: FormData,
) => Promise<FormState>;

function FormError({ state }: { state: FormState }) {
  return state.status === "error" && state.message ? (
    <Alert tone="error">{state.message}</Alert>
  ) : null;
}

export function RuleForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, initialFormState);
  const values = state.values;
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError state={state} />
      <div
        key={JSON.stringify(values ?? {})}
        className="grid gap-4 sm:grid-cols-[8rem_10rem_auto] sm:items-end"
      >
        <TextField
          id="amount"
          label="Send"
          type="number"
          inputMode="numeric"
          min={1}
          required
          defaultValue={values?.amount ?? "2"}
          errors={state.fieldErrors?.amount}
        />
        <SelectField
          id="unit"
          label="Unit"
          defaultValue={values?.unit ?? "hours"}
          errors={state.fieldErrors?.unit}
        >
          <option value="minutes">minutes before</option>
          <option value="hours">hours before</option>
          <option value="days">days before</option>
        </SelectField>
        <SubmitButton pendingLabel="Adding…" className="w-full sm:w-auto">
          Add reminder
        </SubmitButton>
      </div>
    </form>
  );
}

export function TemplateForm({
  action,
  defaults,
  disabled,
}: {
  action: FormAction;
  defaults: { subject: string; body: string };
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const values = state.values;
  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormError state={state} />
      <fieldset
        key={JSON.stringify(values ?? {})}
        disabled={disabled}
        className="space-y-5"
      >
        <TextField
          id="subject"
          label="Subject"
          maxLength={150}
          required
          defaultValue={values?.subject ?? defaults.subject}
          errors={state.fieldErrors?.subject}
        />
        <TextAreaField
          id="body"
          label="Message"
          rows={10}
          maxLength={2000}
          required
          defaultValue={values?.body ?? defaults.body}
          errors={state.fieldErrors?.body}
          hint="Keep it about the appointment only: no promotions. Your mailing address and an unsubscribe link are added at the bottom automatically."
        />
      </fieldset>
      {disabled ? null : (
        <SubmitButton pendingLabel="Saving…" className="w-full sm:w-auto">
          Save message
        </SubmitButton>
      )}
    </form>
  );
}

export function SenderForm({
  action,
  defaults,
  disabled,
}: {
  action: FormAction;
  defaults: { contactEmail: string; postalAddress: string };
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const values = state.values;
  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormError state={state} />
      <fieldset
        key={JSON.stringify(values ?? {})}
        disabled={disabled}
        className="space-y-5"
      >
        <TextField
          id="contactEmail"
          label="Reply-to email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={values?.contactEmail ?? defaults.contactEmail}
          errors={state.fieldErrors?.contactEmail}
          hint="When a client replies to a reminder, the reply goes here."
        />
        <TextAreaField
          id="postalAddress"
          label="Business mailing address"
          rows={3}
          maxLength={300}
          required
          defaultValue={values?.postalAddress ?? defaults.postalAddress}
          errors={state.fieldErrors?.postalAddress}
          hint="Required by US law (CAN-SPAM) in every email. A P.O. box works too."
        />
      </fieldset>
      {disabled ? null : (
        <SubmitButton pendingLabel="Saving…" className="w-full sm:w-auto">
          Save details
        </SubmitButton>
      )}
    </form>
  );
}
