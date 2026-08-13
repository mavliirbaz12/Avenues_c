import { formatDate } from "@/lib/format";

/**
 * Legal page scaffold. The date shown is a fixed "effective from", not
 * render time — a policy that claims to update itself daily inspires the
 * opposite of confidence.
 */
export function PolicyPage({
  eyebrow,
  title,
  effectiveFrom,
  children,
}: {
  eyebrow: string;
  title: string;
  effectiveFrom: string; // ISO date
  children: React.ReactNode;
}) {
  return (
    <article>
      <header>
        <p className="micro-label-gold">{eyebrow}</p>
        <h1 className="mt-4 font-display text-d3 font-light text-bone">{title}</h1>
        <p className="mt-3 font-sans text-xs text-stone-dark">
          Effective from {formatDate(effectiveFrom)}
        </p>
      </header>
      <div className="prose-avenues mt-10">{children}</div>
    </article>
  );
}
