import Link from "next/link";
import { ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/ui";
import { ReviewModerationCard } from "@/components/admin/review-moderation";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "", label: "Awaiting", status: ReviewStatus.PENDING },
  { value: "approved", label: "Approved", status: ReviewStatus.APPROVED },
  { value: "hidden", label: "Hidden", status: ReviewStatus.HIDDEN },
] as const;

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tabValue = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) ?? "";
  const tab = TABS.find((t) => t.value === tabValue) ?? TABS[0];

  const reviews = await prisma.review.findMany({
    where: { status: tab.status },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { name: true, email: true } },
      product: { select: { name: true, slug: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader title="Reviews">
        <p className="mt-2 font-sans text-xs text-stone">
          Nothing shows on the storefront until approved; aggregates recompute
          on every decision.
        </p>
      </AdminPageHeader>

      <div className="mt-6 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value ? `/admin/reviews?tab=${t.value}` : "/admin/reviews"}
            className={cn(
              "border px-3 py-1.5 font-sans text-[0.6875rem] uppercase tracking-wide2 transition-colors",
              t.value === tab.value
                ? "border-gold/60 bg-gold/10 text-gold-light"
                : "border-line text-stone hover:border-line-strong hover:text-bone",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <p className="mt-6 border border-line px-6 py-12 text-center font-sans text-sm text-stone-dark">
          Nothing {tab.label.toLowerCase()} right now.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {reviews.map((r) => (
            <ReviewModerationCard
              key={r.id}
              review={{
                id: r.id,
                rating: r.rating,
                title: r.title,
                body: r.body,
                status: r.status,
                isVerifiedBuyer: r.isVerifiedBuyer,
                createdAt: r.createdAt,
                userName: r.user.name,
                userEmail: r.user.email ?? "phone-only account",
                productName: r.product.name,
                productSlug: r.product.slug,
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
