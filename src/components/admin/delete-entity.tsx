"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteCombo } from "@/app/actions/admin/combos";
import { deleteProduct } from "@/app/actions/admin/products";
import { ConfirmDelete } from "./confirm-delete";
import { useUI } from "@/store/ui";
import type { SimpleActionState } from "@/lib/form-state";
import { cn } from "@/lib/utils";

/**
 * The delete controls for the two things that live on server-rendered pages —
 * a gift set in the list, and a product on its own edit screen.
 *
 * Both actions can REFUSE: a set that has been ordered, or a fragrance that
 * has been sold or is inside a live set, comes back with a message explaining
 * what to do instead. That message is the whole point, so it is surfaced as a
 * danger toast rather than being dropped on the floor — an admin who clicks
 * Delete and sees nothing happen will click it again.
 */
function useDelete(run: (id: string) => Promise<SimpleActionState>, after?: () => void) {
  const [busy, startTransition] = useTransition();
  const toast = useUI((s) => s.toast);
  const router = useRouter();

  const remove = (id: string) =>
    startTransition(async () => {
      const res = await run(id);
      toast({ title: res.message, tone: res.ok ? "default" : "danger" });
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });

  return { busy, remove };
}

export function DeleteComboButton({ comboId, name }: { comboId: string; name: string }) {
  const { busy, remove } = useDelete(deleteCombo);

  return (
    <ConfirmDelete
      disabled={busy}
      question={`Delete ${name}?`}
      onConfirm={() => remove(comboId)}
    />
  );
}

/**
 * Product delete, on the product's own page rather than in the list.
 *
 * Deliberately at the bottom, under its own heading, and not next to "View
 * live" in the header. Deleting a fragrance is the most expensive mistake
 * available in this panel, and the list page — where the eye is scanning rows
 * and the cursor is already moving — is the worst place to put it. Retiring is
 * the reversible action and stays where it always was, in the form above.
 */
export function DeleteProductPanel({
  productId,
  name,
  isCombo = false,
  className,
}: {
  productId: string;
  name: string;
  /** Gift sets share this edit screen but are deleted from their own list. */
  isCombo?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { busy, remove } = useDelete(deleteProduct, () => router.push("/admin/products"));

  /*
    /admin/products lists gift sets alongside fragrances, so this panel renders
    on their edit screen too — and deleteProduct refuses every one of them. A
    button that is guaranteed to fail is worse than no button, so sets get the
    pointer to where the delete actually lives instead.
  */
  if (isCombo) {
    return (
      <section className={cn("border border-line p-5 sm:p-6", className)}>
        <h2 className="font-sans text-sm uppercase tracking-wide2 text-bone">Delete this set</h2>
        <p className="mt-1 max-w-prose font-sans text-xs leading-relaxed text-stone-dark">
          Gift sets are deleted from the{" "}
          <Link href="/admin/combos" className="text-gold-light underline underline-offset-2">
            gift sets list
          </Link>
          , where the row shows what {name} contains and what it has sold.
        </p>
      </section>
    );
  }

  return (
    <section className={cn("border border-danger/30 p-5 sm:p-6", className)}>
      <h2 className="font-sans text-sm uppercase tracking-wide2 text-bone">Delete this product</h2>
      <p className="mt-1 max-w-prose font-sans text-xs leading-relaxed text-stone-dark">
        Permanent, and takes its sizes, images and reviews with it. Refused if{" "}
        {name} has ever been ordered or sits inside a gift set — retire it with
        the &ldquo;Live on the storefront&rdquo; switch above instead, which
        hides it from shoppers and keeps every past order intact.
      </p>
      <div className="mt-4">
        <ConfirmDelete
          disabled={busy}
          label="Delete product"
          question={`Permanently delete ${name}?`}
          onConfirm={() => remove(productId)}
        />
      </div>
    </section>
  );
}
