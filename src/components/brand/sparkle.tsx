import { cn } from "@/lib/utils";

/**
 * The four-pointed star that sits beneath the wordmark in the logo lockup.
 * Reused as a small punctuation mark between micro-labels and inside the
 * GoldArc divider.
 */
export function Sparkle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("h-2.5 w-2.5", className)}
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Control points kept close to the centre so the arms stay broad — a
          thinner star reads as a plus sign at micro-label sizes. */}
      <path d="M50 3 C55 38 62 45 97 50 C62 55 55 62 50 97 C45 62 38 55 3 50 C38 45 45 38 50 3 Z" />
    </svg>
  );
}
