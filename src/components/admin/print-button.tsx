"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-xs uppercase tracking-wider text-neutral-700 transition-colors hover:border-neutral-900"
    >
      <Printer className="h-3.5 w-3.5" strokeWidth={1.6} />
      Print / save PDF
    </button>
  );
}
