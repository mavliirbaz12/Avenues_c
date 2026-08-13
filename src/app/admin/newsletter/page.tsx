import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { AdminPageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminNewsletterPage() {
  const [subscribers, total] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.newsletterSubscriber.count(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        title="Newsletter"
        actions={
          <a href="/api/admin/newsletter.csv" download className="btn btn-outline btn-sm">
            <Download className="h-3.5 w-3.5" strokeWidth={1.6} />
            Export CSV
          </a>
        }
      >
        <p className="mt-2 font-sans text-xs text-stone">
          {total} subscriber{total === 1 ? "" : "s"} from the landing page and
          footer capture. The CSV drops straight into any email tool.
        </p>
      </AdminPageHeader>

      {subscribers.length === 0 ? (
        <p className="mt-8 border border-line px-6 py-12 text-center font-sans text-sm text-stone-dark">
          No subscribers yet — the capture forms feed this list automatically.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-line border border-line">
          {subscribers.map((s) => (
            <li key={s.id} className="flex items-baseline gap-4 px-4 py-2.5 font-sans text-xs">
              <span className="min-w-0 flex-1 text-bone">{s.email}</span>
              <span className="text-stone-dark">{s.source ?? "—"}</span>
              <span className="shrink-0 tabular-nums text-stone-dark">{formatDateTime(s.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}

      {total > subscribers.length && (
        <p className="mt-3 font-sans text-xs text-stone-dark">
          Showing the latest {subscribers.length}. The CSV export contains all {total}.
        </p>
      )}
    </div>
  );
}
