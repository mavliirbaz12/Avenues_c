"use client";

import { useTransition } from "react";
import { EnquiryStatus, EnquirySubject } from "@prisma/client";
import { Mail, Phone, Check, RotateCcw } from "lucide-react";
import { setEnquiryStatus } from "@/app/actions/admin/operations";
import { AdminChip } from "./ui";
import { formatDateTime } from "@/lib/format";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

const SUBJECT_LABEL: Record<EnquirySubject, string> = {
  ORDER_ISSUE: "Order issue",
  PRODUCT_ENQUIRY: "Product enquiry",
  BULK_CORPORATE: "Bulk & corporate",
  OTHER: "Other",
};

export type EnquiryRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: EnquirySubject;
  message: string;
  status: EnquiryStatus;
  source: string | null;
  createdAt: Date;
};

export function EnquiryCard({ enquiry }: { enquiry: EnquiryRow }) {
  const [busy, startTransition] = useTransition();
  const toast = useUI((s) => s.toast);

  function move(status: EnquiryStatus, message: string) {
    startTransition(async () => {
      try {
        await setEnquiryStatus(enquiry.id, status);
        toast({ title: message });
      } catch {
        toast({ title: "That didn't save — try again.", tone: "danger" });
      }
    });
  }

  return (
    <li className={cn("border border-line p-5", busy && "opacity-50")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-sans text-sm text-bone">{enquiry.name}</span>
        <AdminChip tone="quiet">{SUBJECT_LABEL[enquiry.subject]}</AdminChip>
        <AdminChip tone={enquiry.status === "NEW" ? "warn" : enquiry.status === "REPLIED" ? "gold" : "quiet"}>
          {enquiry.status}
        </AdminChip>
        <span className="ml-auto font-sans text-xs text-stone-dark">{formatDateTime(enquiry.createdAt)}</span>
      </div>

      <p className="mt-3 whitespace-pre-line border-l-2 border-line pl-4 font-sans text-sm leading-relaxed text-stone">
        {enquiry.message}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4">
        <a
          href={`mailto:${enquiry.email}?subject=${encodeURIComponent(`Re: your message to Avenues`)}`}
          className="inline-flex items-center gap-2 font-sans text-[0.6875rem] uppercase tracking-wide2 text-gold transition-colors hover:text-gold-light"
          onClick={() => move(EnquiryStatus.REPLIED, "Marked replied — reply opening in your mail app.")}
        >
          <Mail className="h-3.5 w-3.5" strokeWidth={1.6} />
          Reply ({enquiry.email})
        </a>
        {enquiry.phone && (
          <a
            href={`tel:${enquiry.phone}`}
            className="inline-flex items-center gap-2 font-sans text-[0.6875rem] uppercase tracking-wide2 text-stone transition-colors hover:text-gold-light"
          >
            <Phone className="h-3.5 w-3.5" strokeWidth={1.6} />
            {enquiry.phone}
          </a>
        )}

        <span className="ml-auto flex gap-2">
          {enquiry.status !== EnquiryStatus.CLOSED ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => move(EnquiryStatus.CLOSED, "Closed.")}
              className="inline-flex items-center gap-1.5 font-sans text-[0.6875rem] uppercase tracking-wide2 text-stone transition-colors hover:text-bone"
            >
              <Check className="h-3 w-3" strokeWidth={1.8} />
              Close
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => move(EnquiryStatus.NEW, "Reopened.")}
              className="inline-flex items-center gap-1.5 font-sans text-[0.6875rem] uppercase tracking-wide2 text-stone transition-colors hover:text-bone"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={1.8} />
              Reopen
            </button>
          )}
        </span>
      </div>
    </li>
  );
}
