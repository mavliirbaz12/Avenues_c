"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Two-step delete: the button arms, and a second, differently-labelled control
 * commits.
 *
 * Every destructive control in the admin goes through here. It existed twice
 * already — hand-rolled in the variant editor and again in the collection
 * manager — while image delete and review delete had no confirmation at all
 * and fired on a single click. One component means "can be added" and "can be
 * removed, on purpose" stay in step as the panel grows.
 *
 * Deliberately not a modal. The rows this sits in are dense and the admin is
 * often deleting several things in a row; a dialog that steals focus and has
 * to be dismissed each time is the reason people stop reading confirmations.
 * The armed state changes the label and the colour in place, so the second
 * click is a different target from the first — which is the property that
 * actually prevents the accident.
 *
 * Arming times out. A Delete left armed on a row the admin has scrolled past
 * is a trap for whoever clicks near it next, so it disarms itself after ten
 * seconds of no answer.
 */
export function ConfirmDelete({
  onConfirm,
  disabled,
  label = "Delete",
  /** Shown while armed — say what is about to go, not just "Are you sure?". */
  question,
  /** Icon-only trigger, for tight spots like the image tiles. */
  iconOnly = false,
  className,
}: {
  onConfirm: () => void;
  disabled?: boolean;
  label?: string;
  question?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), 10_000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [armed]);

  // Disarm if the row goes busy or read-only underneath us.
  useEffect(() => {
    if (disabled) setArmed(false);
  }, [disabled]);

  if (armed) {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        {question && (
          <span className="font-sans text-[0.6875rem] text-stone-dark">{question}</span>
        )}
        <button
          type="button"
          onClick={() => {
            setArmed(false);
            onConfirm();
          }}
          disabled={disabled}
          className="font-sans text-[0.6875rem] uppercase tracking-wide2 text-danger disabled:opacity-40"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="font-sans text-[0.6875rem] uppercase tracking-wide2 text-stone-dark"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      disabled={disabled}
      aria-label={iconOnly ? label : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 text-stone transition-colors hover:text-danger disabled:opacity-40",
        iconOnly ? "p-1 text-stone-dark" : "font-sans text-[0.6875rem] uppercase tracking-wide2",
        className,
      )}
    >
      <Trash2 className={iconOnly ? "h-3.5 w-3.5" : "h-3 w-3"} strokeWidth={1.6} />
      {!iconOnly && label}
    </button>
  );
}
