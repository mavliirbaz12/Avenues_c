"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthField, AuthDivider, GoogleButton } from "./auth-shell";
import { PasswordField } from "./password-field";

export function LoginForm({
  googleEnabled,
  next,
  initialError,
}: {
  googleEnabled: boolean;
  next: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState(initialError ?? "");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const data = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
      redirect: false,
    });

    if (res?.error) {
      // Never distinguish "no such account" from "wrong password".
      setError("That email and password don't match.");
      setBusy(false);
      return;
    }

    // Full navigation so the server layout re-reads the session and the
    // guest cart merge in SessionSync fires.
    router.push(next);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {googleEnabled && (
        <>
          <GoogleButton next={next} />
          <AuthDivider />
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <AuthField
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          placeholder="your@email.com"
        />

        <PasswordField
          id="password"
          name="password"
          label="Password"
          autoComplete="current-password"
          required
          labelAccessory={
            <Link
              href="/forgot-password"
              className="font-sans text-[0.6875rem] uppercase tracking-label text-stone transition-colors hover:text-gold-light"
            >
              Forgot?
            </Link>
          }
        />

        {error && (
          <p className="font-sans text-xs text-danger" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">
          {busy ? "Signing in" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
