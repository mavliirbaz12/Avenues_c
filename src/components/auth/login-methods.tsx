"use client";

import { useState } from "react";
import { LoginForm } from "./login-form";
import { PhoneOtpForm } from "./phone-otp-form";
import { cn } from "@/lib/utils";

/**
 * The ways in.
 *
 * Phone OTP is offered ONLY when SMS is actually configured (`smsLive`, i.e.
 * MSG91 credentials are present). Without them the app falls back to printing
 * the code to the server console, which is fine in development and useless in
 * production — a customer would be asked for a code that never arrives.
 *
 * So on a deploy without SMS this renders as a single email + password form,
 * with no tab bar to explain. The day DLT registration clears and the MSG91
 * keys are set, the tabs return on their own: no code change, no redeploy of
 * logic, just environment.
 */
export function LoginMethods({
  smsLive,
  next,
  initialError,
}: {
  smsLive: boolean;
  next: string;
  initialError?: string;
}) {
  // Default to email whenever OTP is unavailable, and whenever we arrived
  // here from a failed password attempt.
  const [method, setMethod] = useState<"phone" | "email">(
    !smsLive || initialError ? "email" : "phone",
  );

  if (!smsLive) {
    // One door, no tab bar. A disabled tab would be worse than none: it raises
    // a question the page cannot answer.
    return <LoginForm next={next} initialError={initialError} />;
  }

  return (
    <div>
      <div role="tablist" aria-label="Sign-in method" className="mb-7 grid grid-cols-2 border border-line">
        <Tab active={method === "phone"} onClick={() => setMethod("phone")}>
          Phone OTP
        </Tab>
        <Tab active={method === "email"} onClick={() => setMethod("email")}>
          Email
        </Tab>
      </div>

      {method === "phone" ? (
        <PhoneOtpForm next={next} smsLive={smsLive} />
      ) : (
        <LoginForm next={next} initialError={initialError} />
      )}
    </div>
  );
}

function Tab({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "py-3 font-sans text-micro uppercase transition-colors duration-400 ease-smoke",
        active ? "bg-gold/10 text-gold-light" : "text-stone hover:text-bone",
      )}
    >
      {children}
    </button>
  );
}
