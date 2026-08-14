"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { signUp } from "@/app/actions/auth";
import { AuthField, AuthDivider, GoogleButton } from "./auth-shell";
import { FORM_IDLE } from "@/lib/form-state";

export function SignupForm({
  googleEnabled,
  next,
}: {
  googleEnabled: boolean;
  next: string;
}) {
  const [state, action] = useActionState(signUp, FORM_IDLE);
  const router = useRouter();

  // Creating the account and signing in are two steps; do the second one for
  // them rather than dropping a new customer on a login form.
  useEffect(() => {
    if (!state.ok) return;
    const form = document.getElementById("signup-form") as HTMLFormElement | null;
    const email = (form?.elements.namedItem("email") as HTMLInputElement | null)?.value;
    const password = (form?.elements.namedItem("password") as HTMLInputElement | null)?.value;
    if (!email || !password) {
      router.push("/login");
      return;
    }
    void signIn("credentials", { email, password, redirect: false }).then(() => {
      router.push(next);
      router.refresh();
    });
  }, [state.ok, router, next]);

  return (
    <div className="space-y-6">
      {googleEnabled && (
        <>
          <GoogleButton next={next} />
          <AuthDivider />
        </>
      )}

      <form id="signup-form" action={action} className="space-y-5" noValidate>
        <AuthField
          id="name"
          name="name"
          label="Name"
          autoComplete="name"
          required
          error={state.fieldErrors?.name}
        />
        <AuthField
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          placeholder="your@email.com"
          error={state.fieldErrors?.email}
        />
        <AuthField
          id="phone"
          name="phone"
          type="tel"
          label="Phone (optional)"
          autoComplete="tel"
          inputMode="numeric"
          placeholder="10-digit mobile"
          hint="Used only for delivery updates."
          error={state.fieldErrors?.phone}
        />
        <AuthField
          id="password"
          name="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          required
          hint="At least 8 characters, with a number."
          error={state.fieldErrors?.password}
        />

        {state.message && !state.ok && (
          <p className="font-sans text-xs text-danger" role="alert">
            {state.message}
          </p>
        )}

        <Submit ok={state.ok} />

        <p className="font-sans text-xs leading-relaxed text-stone-dark">
          By creating an account you agree to our{" "}
          <a href="/policies/terms" className="text-gold underline underline-offset-4">
            terms
          </a>{" "}
          and{" "}
          <a href="/policies/privacy" className="text-gold underline underline-offset-4">
            privacy policy
          </a>
          .
        </p>
      </form>
    </div>
  );
}

function Submit({ ok }: { ok: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || ok} className="btn btn-primary btn-lg w-full">
      {ok ? "Signing you in" : pending ? "Creating account" : "Create account"}
    </button>
  );
}
