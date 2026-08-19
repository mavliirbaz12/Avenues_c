import Link from "next/link";
import { EnquiryStatus, EnquirySubject, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/ui";
import { EnquiryCard } from "@/components/admin/enquiry-card";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { value: "", label: "New", where: { status: EnquiryStatus.NEW } },
  { value: "replied", label: "Replied", where: { status: EnquiryStatus.REPLIED } },
  { value: "closed", label: "Closed", where: { status: EnquiryStatus.CLOSED } },
  { value: "all", label: "All", where: {} },
] satisfies { value: string; label: string; where: Prisma.EnquiryWhereInput }[];

const SUBJECTS: { value: EnquirySubject | ""; label: string }[] = [
  { value: "", label: "All subjects" },
  { value: "ORDER_ISSUE", label: "Order issue" },
  { value: "PRODUCT_ENQUIRY", label: "Product enquiry" },
  { value: "BULK_CORPORATE", label: "Bulk & corporate" },
  { value: "OTHER", label: "Other" },
];

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const one = (k: string) => ((Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "").trim();

  const tab = STATUS_TABS.find((t) => t.value === one("tab")) ?? STATUS_TABS[0]!;
  const subject = SUBJECTS.find((s) => s.value === one("subject"))?.value ?? "";

  const enquiries = await prisma.enquiry.findMany({
    where: { ...tab.where, ...(subject ? { subject } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const href = (patch: { tab?: string; subject?: string }) => {
    const params = new URLSearchParams();
    const t = patch.tab ?? tab.value;
    const s = patch.subject ?? subject;
    if (t) params.set("tab", t);
    if (s) params.set("subject", s);
    const str = params.toString();
    return str ? `/admin/enquiries?${str}` : "/admin/enquiries";
  };

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader title="Enquiries">
        <p className="mt-2 font-sans text-xs text-stone">
          Every contact-form message lands here so nothing gets lost.
          Customers were told to expect a reply within 24 hours.
        </p>
      </AdminPageHeader>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.value}
            href={href({ tab: t.value })}
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

        <div className="ml-auto flex gap-2">
          {SUBJECTS.map((s) => (
            <Link
              key={s.value || "all"}
              href={href({ subject: s.value })}
              className={cn(
                "border px-2.5 py-1.5 font-sans text-[0.625rem] uppercase tracking-wide2 transition-colors",
                s.value === subject
                  ? "border-gold/60 text-gold-light"
                  : "border-line text-stone-dark hover:text-bone",
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {enquiries.length === 0 ? (
        <p className="mt-6 border border-line px-6 py-12 text-center font-sans text-sm text-stone-dark">
          Inbox zero. Nothing {tab.label === "All" ? "at all" : tab.label.toLowerCase()} here.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {enquiries.map((e) => (
            <EnquiryCard key={e.id} enquiry={e} />
          ))}
        </ul>
      )}
    </div>
  );
}
