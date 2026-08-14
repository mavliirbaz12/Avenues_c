"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfile, changePassword } from "@/app/actions/account";
import { cn } from "@/lib/utils";
import { FORM_IDLE } from "@/lib/form-state";

export function ProfileForm({
  defaults,
}: {
  defaults: { name: string; email: string; phone: string };
}) {
  const [state, action] = useActionState(updateProfile, FORM_IDLE);

  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="p-name"
          name="name"
          label="Name"
          autoComplete="name"
          required
          defaultValue={defaults.name}
          error={state.fieldErrors?.name}
        />
        <Field
          id="p-phone"
          name="phone"
          label="Phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="10-digit mobile"
          defaultValue={defaults.phone}
          error={state.fieldErrors?.phone}
        />
      </div>

      <div>
        <label htmlFor="p-email" className="field-label">
          Email
        </label>
        <input
          id="p-email"
          value={defaults.email}
          readOnly
          disabled
          className="field cursor-not-allowed opacity-60"
        />
        <span className="field-hint">
          Your email is your sign-in. Write to us if you need it changed.
        </span>
      </div>

      <Result state={state} />
      <Submit idle="Save changes" busy="Saving" />
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, FORM_IDLE);

  return (
    <form action={action} className="space-y-5" noValidate key={state.ok ? "done" : "editing"}>
      <Field
        id="c-current"
        name="current"
        label="Current password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.current}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="c-next"
          name="next"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters, with a number."
          error={state.fieldErrors?.next}
        />
        <Field
          id="c-confirm"
          name="confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          error={state.fieldErrors?.confirm}
        />
      </div>

      <Result state={state} />
      <Submit idle="Change password" busy="Changing" />
    </form>
  );
}

function Result({ state }: { state: { ok: boolean; message: string } }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={cn("font-sans text-sm", state.ok ? "text-gold-light" : "text-danger")}
    >
      {state.message}
    </p>
  );
}

function Submit({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-outline btn-md">
      {pending ? busy : idle}
    </button>
  );
}

function Field({
  id,
  name,
  label,
  error,
  hint,
  ...rest
}: {
  id: string;
  name: string;
  label: string;
  error?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        className={cn("field", error && "field-error")}
        {...rest}
      />
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-msg-error">{error}</span>}
    </div>
  );
}
