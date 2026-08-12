import Link from "next/link";
import { Monogram } from "@/components/brand/monogram";
import { GoldArc } from "@/components/brand/gold-arc";

/**
 * The shared plate behind every auth page: a narrow centred column on a warm
 * pool of light. No card, no box — the engraved-plate structure the rest of
 * the site uses, so signing in doesn't feel like leaving the shop.
 */
export function AuthShell({
  eyebrow,
  title,
  intro,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden py-16 sm:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(44rem 30rem at 50% 0%, rgba(201,162,75,0.09), transparent 65%)",
        }}
      />

      <div className="shell relative z-[2] mx-auto w-full max-w-md">
        <div className="text-center">
          <Link href="/" aria-label="Avenues — home" className="inline-flex">
            <Monogram className="h-12 w-12" />
          </Link>
          <p className="micro-label-gold mt-7">{eyebrow}</p>
          <h1 className="mt-4 font-display text-d3 font-light text-bone">{title}</h1>
          {intro && (
            <p className="mx-auto mt-4 max-w-sm font-sans text-[0.9375rem] leading-relaxed text-stone">
              {intro}
            </p>
          )}
          <GoldArc className="mt-8" />
        </div>

        <div className="mt-10">{children}</div>

        {footer && (
          <div className="mt-9 text-center font-sans text-sm text-stone">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function AuthField({
  id,
  label,
  error,
  hint,
  ...rest
}: {
  id: string;
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
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={error ? "field field-error" : "field"}
        {...rest}
      />
      {hint && !error && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-err`} className="field-msg-error">
          {error}
        </span>
      )}
    </div>
  );
}

/** Renders only when Google OAuth is actually configured. */
export function GoogleButton({ next }: { next: string }) {
  return (
    <form action="/api/auth/signin/google" method="post" className="contents">
      <input type="hidden" name="callbackUrl" value={next} />
      <button type="submit" className="btn btn-ghost btn-md w-full">
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.5 0-.7-.1-1.4-.2-2z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3v2.6A10 10 0 0 0 12 22"
          />
          <path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9z" />
          <path
            fill="#4285F4"
            d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9C16.9 3 14.7 2 12 2A10 10 0 0 0 3 7.5l3.4 2.6C7.2 7.8 9.4 6.1 12 6.1"
          />
        </svg>
        Continue with Google
      </button>
    </form>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-4">
      <span className="h-px flex-1 bg-line" />
      <span className="font-sans text-[0.625rem] uppercase tracking-label text-stone-dark">or</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
