"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Password input with a show/hide toggle.
 *
 * The toggle is a real button inside the field, not an overlaid icon: it is
 * focusable, announces its state through aria-pressed, and its accessible name
 * changes with that state. Typing a 12-character password blind on a phone is
 * the single most common cause of a failed sign-in.
 *
 * Right padding keeps text clear of the button.
 */
export function PasswordField({
  id,
  name,
  label,
  error,
  hint,
  labelAccessory,
  className,
  ...rest
}: {
  id?: string;
  name: string;
  label: string;
  error?: string;
  hint?: string;
  /** e.g. the "Forgot?" link, rendered on the label row. */
  labelAccessory?: React.ReactNode;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "id">) {
  const reactId = useId();
  const fieldId = id ?? `pw-${reactId.replace(/:/g, "")}`;
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="field-label mb-0">
          {label}
        </label>
        {labelAccessory}
      </div>

      <div className="relative">
        <input
          id={fieldId}
          name={name}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-err` : hint ? `${fieldId}-hint` : undefined}
          className={cn("field pr-12", error && "field-error")}
          {...rest}
        />

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          // Never submits the form it sits inside.
          tabIndex={0}
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center
                     text-stone-dark transition-colors duration-300 hover:text-gold-light"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <Eye className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
      </div>

      {hint && !error && (
        <span id={`${fieldId}-hint`} className="field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${fieldId}-err`} className="field-msg-error">
          {error}
        </span>
      )}
    </div>
  );
}
