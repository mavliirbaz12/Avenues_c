"use client";

import { useState } from "react";
import { LoginForm } from "./login-form";
import { PhoneOtpForm } from "./phone-otp-form";
import { cn } from "@/lib/utils";

/**
 * The two ways in: email+password and phone OTP. A tab bar rather than two
 * stacked forms — most Indian D2C customers reach for the phone number first,
 * but the seeded admin and email accounts still need the password door.
 */
export function LoginMethods({
  googleEnabled,
  smsLive,
  next,
  initialError,
}: {
  googleEnabled: boolean;
  smsLive: boolean;
  next: string;
  initialError?: string;
}) {
  const [method, setMethod] = useState<"phone" | "email">(initialError ? "email" : "phone");

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
        <LoginForm googleEnabled={googleEnabled} next={next} initialError={initialError} />
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
