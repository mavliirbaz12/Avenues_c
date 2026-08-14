"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";
import { subscribeNewsletter } from "@/app/actions/marketing";
import { cn } from "@/lib/utils";
import { FORM_IDLE } from "@/lib/form-state";

export function NewsletterForm({
  source = "footer",
  className,
}: {
  source?: string;
  className?: string;
}) {
  const [state, action] = useActionState(subscribeNewsletter, FORM_IDLE);

  if (state.ok) {
    return (
      <p className={cn("font-sans text-sm leading-relaxed text-gold-light", className)} role="status">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className={cn("w-full", className)} noValidate>
      <input type="hidden" name="source" value={source} />
      <div className="flex items-stretch border-b border-line-strong transition-colors focus-within:border-gold/70">
        <label htmlFor={`nl-${source}`} className="sr-only">
          Email address
        </label>
        <input
          id={`nl-${source}`}
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="your@email.com"
          aria-invalid={state.fieldErrors?.email ? true : undefined}
          aria-describedby={state.fieldErrors?.email ? `nl-${source}-err` : undefined}
          className="w-full bg-transparent py-3 pr-3 font-sans text-[0.9375rem] text-bone
                     placeholder:text-stone-dark focus:outline-none"
        />
        <SubmitArrow />
      </div>
      {state.fieldErrors?.email && (
        <p id={`nl-${source}-err`} className="mt-2 font-sans text-xs text-danger">
          {state.fieldErrors.email}
        </p>
      )}
      {state.message && !state.ok && (
        <p className="mt-2 font-sans text-xs text-danger">{state.message}</p>
      )}
    </form>
  );
}

function SubmitArrow() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Subscribe"
      className="shrink-0 px-2 text-gold transition-colors duration-300 ease-smoke
                 hover:text-gold-light disabled:opacity-40"
    >
      <ArrowRight
        className={cn("h-[1.15rem] w-[1.15rem] transition-transform duration-400 ease-smoke", pending && "translate-x-1 opacity-60")}
        strokeWidth={1.4}
      />
    </button>
  );
}
