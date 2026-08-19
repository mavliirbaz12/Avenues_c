"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useSession } from "@/store/session";
import { requestLoginOtp, type OtpRequestState } from "@/app/actions/otp";
import { AuthField } from "./auth-shell";
import { integrationsNote } from "./phone-otp-note";
import { cn } from "@/lib/utils";

/**
 * Phone-OTP sign-in: number → code, with a resend countdown.
 *
 * The second step verifies through the "phone-otp" Auth.js credentials
 * provider, so session handling is identical to email login. New numbers get
 * an account created on first successful code — no separate signup.
 */
export function PhoneOtpForm({ next, smsLive }: { next: string; smsLive: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<OtpRequestState>({ ok: false, message: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  // Tick the resend countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown > 0]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    const form = new FormData();
    form.set("phone", phone);
    const res = await requestLoginOtp({ ok: false, message: "" }, form);
    setMessage(res);
    setBusy(false);

    if (res.ok) {
      setStep("code");
      setCooldown(res.retryAfter ?? 30);
      setTimeout(() => codeRef.current?.focus(), 60);
    } else if (res.retryAfter) {
      setCooldown(res.retryAfter);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    const res = await signIn("phone-otp", { phone, code, redirect: false });
    if (res?.error) {
      setError("That code doesn't match, or it has expired. Check it, or resend.");
      setBusy(false);
      return;
    }

    // See login-form: the nav's auth state lives in a client store and this is
    // a client navigation, so it must be told the session changed.
    await useSession.getState().refresh();
    router.push(next);
    router.refresh();
  }

  if (step === "phone") {
    return (
      <form onSubmit={sendCode} className="space-y-5" noValidate>
        <AuthField
          id="otp-phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          label="Mobile number"
          autoComplete="tel"
          required
          placeholder="10-digit mobile"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          hint={
            smsLive
              ? "We'll text a 6-digit code. No password needed."
              : integrationsNote
          }
        />

        {message.message && !message.ok && (
          <p className="font-sans text-xs text-danger" role="alert">
            {message.message}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">
          {busy ? "Sending code" : "Send code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-5" noValidate>
      <p className="font-sans text-sm leading-relaxed text-stone" role="status">
        {message.message}
      </p>

      <div>
        <label htmlFor="otp-code" className="field-label">
          6-digit code
        </label>
        <input
          ref={codeRef}
          id="otp-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className={cn(
            "field text-center font-display text-3xl tracking-[0.5em]",
            error && "field-error",
          )}
        />
      </div>

      {error && (
        <p className="font-sans text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="btn btn-primary btn-lg w-full"
      >
        {busy ? "Verifying" : "Verify & sign in"}
      </button>

      <div className="flex items-center justify-between font-sans text-xs text-stone">
        <button
          type="button"
          onClick={() => {
            setStep("phone");
            setCode("");
            setError("");
          }}
          className="uppercase tracking-label transition-colors hover:text-gold-light"
        >
          Change number
        </button>
        <button
          type="button"
          disabled={cooldown > 0 || busy}
          onClick={() => sendCode()}
          className="uppercase tracking-label transition-colors hover:text-gold-light disabled:opacity-40"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
