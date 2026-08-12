import { cn } from "@/lib/utils";

/**
 * Rating display. Half-stars are done with a clipped overlay rather than a
 * separate glyph, so 4.3 reads as 4.3 instead of rounding to 4.
 */
export function Stars({
  rating,
  count,
  size = "sm",
  className,
  showCount = true,
}: {
  rating: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
  showCount?: boolean;
}) {
  const dims = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="relative inline-flex"
        role="img"
        aria-label={`Rated ${rating.toFixed(1)} out of 5`}
      >
        <span className="inline-flex gap-0.5 text-stone-dark">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={dims} />
          ))}
        </span>
        <span
          className="absolute inset-0 inline-flex gap-0.5 overflow-hidden text-gold"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={cn(dims, "shrink-0")} filled />
          ))}
        </span>
      </span>
      {showCount && typeof count === "number" && (
        <span className="font-sans text-xs text-stone">
          {count > 0 ? `${rating.toFixed(1)} (${count})` : "No reviews yet"}
        </span>
      )}
    </span>
  );
}

function Star({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45 6.19 20.5 7.3 14.03 2.6 9.45l6.5-.95z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.2}
        strokeLinejoin="round"
      />
    </svg>
  );
}
