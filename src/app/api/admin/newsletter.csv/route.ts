import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Full subscriber export, RFC-4180 CSV, admin only. */
export async function GET() {
  const session = await auth().catch(() => null);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const subscribers = await prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: "asc" },
  });

  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

  const rows = [
    "email,source,subscribed_at",
    ...subscribers.map((s) =>
      [escape(s.email), escape(s.source ?? ""), s.createdAt.toISOString()].join(","),
    ),
  ];

  return new NextResponse(rows.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="avenues-newsletter-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
