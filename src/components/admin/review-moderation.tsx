"use client";

import { useTransition } from "react";
import { ReviewStatus } from "@prisma/client";
import { BadgeCheck, Check, EyeOff, Trash2 } from "lucide-react";
import { moderateReview, deleteReview } from "@/app/actions/admin/operations";
import { Stars } from "@/components/product/stars";
import { AdminChip } from "./ui";
import { formatDate } from "@/lib/format";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

export type ReviewCard = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  isVerifiedBuyer: boolean;
  createdAt: Date;
  userName: string | null;
  userEmail: string;
  productName: string;
  productSlug: string;
};

export function ReviewModerationCard({ review }: { review: ReviewCard }) {
  const [busy, startTransition] = useTransition();
  const toast = useUI((s) => s.toast);

  function act(fn: () => Promise<void>, message: string) {
    startTransition(async () => {
      try {
        await fn();
        toast({ title: message });
      } catch {
        toast({ title: "That didn't save — try again.", tone: "danger" });
      }
    });
  }

  return (
    <li className={cn("border border-line p-5", busy && "opacity-50")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Stars rating={review.rating} showCount={false} />
        <span className="font-sans text-sm text-bone">{review.userName ?? review.userEmail}</span>
        {review.isVerifiedBuyer && (
          <span className="inline-flex items-center gap-1.5 font-sans text-[0.625rem] uppercase tracking-label text-gold">
            <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.6} />
            Verified buyer
          </span>
        )}
        <AdminChip tone={review.status === "APPROVED" ? "ok" : review.status === "HIDDEN" ? "quiet" : "warn"}>
          {review.status}
        </AdminChip>
        <span className="ml-auto font-sans text-xs text-stone-dark">
          {review.productName} · {formatDate(review.createdAt)}
        </span>
      </div>

      {review.title && <p className="mt-3 font-display text-lg font-light text-bone">{review.title}</p>}
      <p className="mt-1.5 whitespace-pre-line font-sans text-sm leading-relaxed text-stone">{review.body}</p>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        {review.status !== ReviewStatus.APPROVED && (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => moderateReview(review.id, "APPROVED"), "Review approved — it's live.")}
            className="btn btn-primary btn-sm"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={1.8} />
            Approve
          </button>
        )}
        {review.status !== ReviewStatus.HIDDEN && (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => moderateReview(review.id, "HIDDEN"), "Review hidden.")}
            className="btn btn-ghost btn-sm"
          >
            <EyeOff className="h-3.5 w-3.5" strokeWidth={1.6} />
            Hide
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => deleteReview(review.id), "Review deleted.")}
          className="btn btn-danger btn-sm"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
          Delete
        </button>
      </div>
    </li>
  );
}
