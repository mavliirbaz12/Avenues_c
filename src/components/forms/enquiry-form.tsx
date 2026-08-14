"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitEnquiry } from "@/app/actions/marketing";
import { Sparkle } from "@/components/brand/sparkle";
import { cn } from "@/lib/utils";
import { SUBJECT_LABELS, FORM_IDLE } from "@/lib/form-state";

/**
 * One form, two densities. `compact` drops the phone field and shrinks the
 * message box so it fits a footer column; the full version is used on /contact.
 */
export function EnquiryForm({
  compact = false,
  source,
  className,
  defaultSubject,
  defaultMessage,
}: {
  compact?: boolean;
  source: string;
  className?: string;
  defaultSubject?: keyof typeof SUBJECT_LABELS;
  defaultMessage?: string;
}) {
  const [state, action] = useActionState(submitEnquiry, FORM_IDLE);
  const uid = compact ? "cf" : "ef";

  if (state.ok) {
    return (
      <div
        className={cn("flex items-start gap-3 border border-gold/25 bg-gold/[0.04] p-5", className)}
        role="status"
      >
        <Sparkle className="mt-1 h-3 w-3 shrink-0 text-gold" />
        <div>
          <p className="font-display text-lg font-light text-bone">Message received</p>
          <p className="mt-1 font-sans text-sm leading-relaxed text-stone">
            We reply within 24 hours — usually sooner. Check your inbox for the acknowledgement.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className={cn("space-y-4", className)} noValidate>
      <input type="hidden" name="source" value={source} />

      <div className={cn(!compact && "grid gap-4 sm:grid-cols-2")}>
        <Field
          id={`${uid}-name`}
          name="name"
          label="Name"
          autoComplete="name"
          required
          error={state.fieldErrors?.name}
        />
        <Field
          id={`${uid}-email`}
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          error={state.fieldErrors?.email}
        />
      </div>

      {!compact && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={`${uid}-phone`}
            name="phone"
            type="tel"
            label="Phone (optional)"
            autoComplete="tel"
            inputMode="numeric"
            placeholder="10-digit mobile"
            error={state.fieldErrors?.phone}
          />
          <div>
            <label htmlFor={`${uid}-subject`} className="field-label">
              Subject
            </label>
            <select
              id={`${uid}-subject`}
              name="subject"
              defaultValue={defaultSubject ?? "PRODUCT_ENQUIRY"}
              className="field"
            >
              {Object.entries(SUBJECT_LABELS).map(([value, label]) => (
                <option key={value} value={value} className="bg-surface-raised">
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {compact && <input type="hidden" name="subject" value={defaultSubject ?? "OTHER"} />}

      <div>
        <label htmlFor={`${uid}-message`} className="field-label">
          Message
        </label>
        <textarea
          id={`${uid}-message`}
          name="message"
          required
          rows={compact ? 3 : 6}
          defaultValue={defaultMessage}
          placeholder={compact ? "How can we help?" : "Tell us what you need."}
          aria-invalid={state.fieldErrors?.message ? true : undefined}
          className={cn("field resize-y", state.fieldErrors?.message && "field-error")}
        />
        {state.fieldErrors?.message && (
          <span className="field-msg-error">{state.fieldErrors.message}</span>
        )}
      </div>

      {state.message && !state.ok && (
        <p className="font-sans text-xs text-danger" role="alert">
          {state.message}
        </p>
      )}

      <Submit compact={compact} />
    </form>
  );
}

function Field({
  id,
  name,
  label,
  error,
  type = "text",
  ...rest
}: {
  id: string;
  name: string;
  label: string;
  error?: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        aria-invalid={error ? true : undefined}
        className={cn("field", error && "field-error")}
        {...rest}
      />
      {error && <span className="field-msg-error">{error}</span>}
    </div>
  );
}

function Submit({ compact }: { compact: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn("btn btn-outline w-full", compact ? "btn-sm" : "btn-md sm:w-auto")}
    >
      {pending ? "Sending" : "Send message"}
    </button>
  );
}
