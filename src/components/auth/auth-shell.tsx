import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
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
            <BrandMark className="h-12 w-12" />
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

