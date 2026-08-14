"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { requestPasswordReset, resetPassword } from "@/app/actions/auth";
import { AuthField } from "./auth-shell";
import { Sparkle } from "@/components/brand/sparkle";
import { FORM_IDLE } from "@/lib/form-state";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, FORM_IDLE);

  if (state.ok) {
    return (
      <div className="border border-gold/25 bg-gold/[0.04] p-6 text-center" role="status">
        <Sparkle className="mx-auto h-3 w-3 text-gold" />
        <p className="mt-4 font-sans text-[0.9375rem] leading-relaxed text-bone">
          {state.message}
        </p>
        <p className="mt-3 font-sans text-xs leading-relaxed text-stone">
          Check spam if it hasn&rsquo;t arrived in a few minutes.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <AuthField
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        placeholder="your@email.com"
      />
      {state.message && !state.ok && (
        <p className="font-sans text-xs text-danger" role="alert">
          {state.message}
        </p>
      )}
      <Submit idle="Send reset link" busy="Sending" />
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, FORM_IDLE);

  if (state.ok) {
    return (
      <div className="border border-gold/25 bg-gold/[0.04] p-6 text-center" role="status">
        <Sparkle className="mx-auto h-3 w-3 text-gold" />
        <p className="mt-4 font-sans text-[0.9375rem] leading-relaxed text-bone">
          {state.message}
        </p>
        <Link href="/login" className="btn btn-outline btn-md mt-6">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <AuthField
        id="password"
        name="password"
        type="password"
        label="New password"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with a number."
        error={state.fieldErrors?.password}
      />
      <AuthField
        id="confirm"
        name="confirm"
        type="password"
        label="Confirm password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirm}
      />
      {state.message && !state.ok && (
        <p className="font-sans text-xs text-danger" role="alert">
          {state.message}
        </p>
      )}
      <Submit idle="Update password" busy="Updating" />
    </form>
  );
}

function Submit({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
      {pending ? busy : idle}
    </button>
  );
}
