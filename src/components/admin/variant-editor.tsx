"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Pencil } from "lucide-react";
import { saveVariant, deleteVariant } from "@/app/actions/admin/products";
import { ConfirmDelete } from "./confirm-delete";
import { formatPaise, paiseToRupeeInput } from "@/lib/format";
import { AdminChip } from "./ui";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import { FORM_IDLE } from "@/lib/form-state";

export type VariantRow = {
  id: string;
  size: string;
  sku: string;
  mrpPaise: number;
  pricePaise: number;
  stock: number;
  weightGrams: number;
  isActive: boolean;
};

const LOW_STOCK_AT = 10;

/**
 * Variant management: sizes, prices, SKUs and stock. Adding a second size
 * here is all it takes for the storefront's size selector to appear.
 */
export function VariantEditor({ productId, variants }: { productId: string; variants: VariantRow[] }) {
  const [editing, setEditing] = useState<VariantRow | "new" | null>(null);

  return (
    <section className="border border-line p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-sans text-sm uppercase tracking-wide2 text-bone">Sizes & stock</h2>
          <p className="mt-1 font-sans text-xs text-stone-dark">
            Prices in rupees, inclusive of all taxes. Below {LOW_STOCK_AT} units shows a
            low-stock flag; at zero the storefront offers &ldquo;notify me&rdquo;.
          </p>
        </div>
        {editing === null && (
          <button type="button" onClick={() => setEditing("new")} className="btn btn-outline btn-sm shrink-0">
            <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
            Add size
          </button>
        )}
      </div>

      {variants.length > 0 && (
        <ul className="mt-5 divide-y divide-line border border-line">
          {variants.map((v) => (
            <VariantLine key={v.id} variant={v} onEdit={() => setEditing(v)} editingDisabled={editing !== null} />
          ))}
        </ul>
      )}

      {editing !== null && (
        <VariantForm
          productId={productId}
          variant={editing === "new" ? undefined : editing}
          onDone={() => setEditing(null)}
        />
      )}

      {variants.length === 0 && editing === null && (
        <p className="mt-5 border border-warning/40 bg-warning/[0.06] px-4 py-3 font-sans text-xs text-warning">
          No sizes yet — the product can&rsquo;t be bought until it has at least one
          active size with stock.
        </p>
      )}
    </section>
  );
}

function VariantLine({
  variant,
  onEdit,
  editingDisabled,
}: {
  variant: VariantRow;
  onEdit: () => void;
  editingDisabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useUI((s) => s.toast);

  function remove() {
    startTransition(async () => {
      const res = await deleteVariant(variant.id);
      toast({ title: res.message, tone: res.ok ? "default" : "danger" });
    });
  }

  return (
    <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", pending && "opacity-50")}>
      <span className="w-16 font-sans text-sm text-bone">{variant.size}</span>
      <span className="font-sans text-xs text-stone-dark">{variant.sku}</span>
      <span className="font-sans text-xs tabular-nums text-bone">
        {formatPaise(variant.pricePaise)}
        {variant.mrpPaise > variant.pricePaise && (
          <span className="ml-1.5 text-stone-dark line-through">{formatPaise(variant.mrpPaise)}</span>
        )}
      </span>
      <span
        className={cn(
          "font-sans text-xs tabular-nums",
          variant.stock === 0 ? "text-danger" : variant.stock < LOW_STOCK_AT ? "text-warning" : "text-stone",
        )}
      >
        {variant.stock} in stock
      </span>
      {!variant.isActive && <AdminChip tone="quiet">Off</AdminChip>}
      {variant.stock < LOW_STOCK_AT && variant.stock > 0 && <AdminChip tone="warn">Low</AdminChip>}

      <span className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={onEdit}
          disabled={editingDisabled}
          className="inline-flex items-center gap-1.5 font-sans text-[0.6875rem] uppercase tracking-wide2 text-stone transition-colors hover:text-gold-light disabled:opacity-40"
        >
          <Pencil className="h-3 w-3" strokeWidth={1.6} />
          Edit
        </button>
        <ConfirmDelete
          disabled={editingDisabled}
          question={`Delete ${variant.size}?`}
          onConfirm={remove}
        />
      </span>
    </li>
  );
}

function VariantForm({
  productId,
  variant,
  onDone,
}: {
  productId: string;
  variant?: VariantRow;
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveVariant, FORM_IDLE);
  const toast = useUI((s) => s.toast);
  const e = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) {
      toast({ title: state.message });
      onDone();
    }
  }, [state.ok, state.message, toast, onDone]);

  return (
    <form action={action} className="mt-5 border border-gold/30 p-4 sm:p-5">
      <input type="hidden" name="productId" value={productId} />
      {variant && <input type="hidden" name="id" value={variant.id} />}

      <p className="font-sans text-xs uppercase tracking-wide2 text-gold">
        {variant ? `Edit ${variant.size}` : "New size"}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Small id="vf-size" name="size" label="Size" required defaultValue={variant?.size} placeholder="50ml" error={e.size} />
        <Small id="vf-sku" name="sku" label="SKU" required defaultValue={variant?.sku} placeholder="AVN-XXX-50" error={e.sku} />
        <Small id="vf-weight" name="weightGrams" label="Shipped weight (g)" type="number" min={50} defaultValue={variant?.weightGrams ?? 250} error={e.weightGrams} />
        <Small id="vf-mrp" name="mrp" label="MRP (₹)" required inputMode="decimal" defaultValue={variant ? paiseToRupeeInput(variant.mrpPaise) : ""} placeholder="1199" error={e.mrp} />
        <Small id="vf-price" name="price" label="Offer price (₹)" required inputMode="decimal" defaultValue={variant ? paiseToRupeeInput(variant.pricePaise) : ""} placeholder="999" error={e.price} />
        <Small id="vf-stock" name="stock" label="Stock" type="number" min={0} required defaultValue={variant?.stock ?? 0} error={e.stock} />
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" name="isActive" value="true" defaultChecked={variant?.isActive ?? true} className="h-4 w-4 accent-[#C9A24B]" />
        <span className="font-sans text-xs text-stone">Available to buy</span>
      </label>

      {state.message && !state.ok && (
        <p className="mt-3 font-sans text-xs text-danger" role="alert">{state.message}</p>
      )}

      <div className="mt-5 flex gap-3">
        <SaveVariantButton isNew={!variant} />
        <button type="button" onClick={onDone} className="btn btn-ghost btn-sm">Cancel</button>
      </div>
    </form>
  );
}

function SaveVariantButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
      {pending ? "Saving" : isNew ? "Add size" : "Save"}
    </button>
  );
}

function Small({ id, name, label, error, ...rest }: { id: string; name: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} name={name} aria-invalid={error ? true : undefined} className={cn("field", error && "field-error")} {...rest} />
      {error && <span className="field-msg-error">{error}</span>}
    </div>
  );
}
