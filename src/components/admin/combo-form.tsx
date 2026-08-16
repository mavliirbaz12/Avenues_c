"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import { saveCombo } from "@/app/actions/admin/combos";
import { FORM_IDLE } from "@/lib/form-state";
import { cn } from "@/lib/utils";

export type PickerProduct = { id: string; name: string };

export type ComboFormValues = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  highlight: string;
  description: string;
  savingsNote: string;
  howToUse: string;
  caution: string;
  sku: string;
  mrp: string;
  price: string;
  stock: number;
  weightGrams: number;
  isActive: boolean;
  isFeatured: boolean;
  couponEligible: boolean;
  sortOrder: number;
  metaTitle: string;
  metaDescription: string;
  items: { productId: string; sizeLabel: string }[];
};

/**
 * The gift-set builder.
 *
 * The contents editor is a repeater over an array in React state, submitted as
 * parallel `item.productId[]` / `item.sizeLabel[]` fields. There is NO fixed
 * number of rows anywhere: "Add item" appends, each row removes itself, and
 * the arrows reorder. A set of two and a set of ten go through exactly the
 * same code, and changing the composition later is the same operation as
 * building it.
 *
 * The only floor is one row, enforced server-side too — a set of nothing is
 * not a set.
 */
export function ComboForm({
  products,
  values,
}: {
  /** Fragrances available to put in a box. Sets are excluded server-side. */
  products: PickerProduct[];
  values?: ComboFormValues;
}) {
  const [state, action] = useActionState(saveCombo, FORM_IDLE);
  const router = useRouter();
  const uid = useId().replace(/:/g, "");

  const [items, setItems] = useState<{ productId: string; sizeLabel: string }[]>(
    values?.items?.length ? values.items : [{ productId: "", sizeLabel: "10ml" }],
  );

  useEffect(() => {
    if (state.ok && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);

  const e = state.fieldErrors ?? {};
  const filled = items.filter((i) => i.productId && i.sizeLabel.trim());

  function update(i: number, patch: Partial<{ productId: string; sizeLabel: string }>) {
    setItems((rows) => rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  }

  function move(i: number, delta: number) {
    setItems((rows) => {
      const next = [...rows];
      const j = i + delta;
      if (j < 0 || j >= next.length) return rows;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  return (
    <form action={action} className="space-y-10">
      {values?.id && <input type="hidden" name="id" value={values.id} />}

      <Panel title="The set">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={`${uid}-name`} name="name" label="Name" defaultValue={values?.name} error={e.name} required />
          <Field
            id={`${uid}-slug`}
            name="slug"
            label="Slug"
            defaultValue={values?.slug}
            error={e.slug}
            hint="Leave blank to derive it from the name. Lives at /set/<slug>."
          />
        </div>
        <Field id={`${uid}-tagline`} name="tagline" label="Tagline" defaultValue={values?.tagline} error={e.tagline} required />
        <Field id={`${uid}-highlight`} name="highlight" label="Highlight line" defaultValue={values?.highlight} error={e.highlight} required />
        <Field
          id={`${uid}-savings`}
          name="savingsNote"
          label="Savings text (optional)"
          defaultValue={values?.savingsNote}
          error={e.savingsNote}
          hint='e.g. "Worth ₹4,796 if bought as full bottles". Shown only when set.'
        />
        <Area id={`${uid}-desc`} name="description" label="Description" defaultValue={values?.description} error={e.description} rows={5} required />
      </Panel>

      {/* ------------------------------------------------------------------ */}
      <Panel
        title="What's in the box"
        aside={
          <span
            className="font-sans text-xs text-stone"
            data-testid="combo-item-count"
            aria-live="polite"
          >
            {filled.length === 0
              ? "Nothing added yet"
              : `This set contains ${filled.length} fragrance${filled.length === 1 ? "" : "s"}`}
          </span>
        }
      >
        <ul className="space-y-3" data-testid="combo-items">
          {items.map((row, i) => (
            <li
              key={i}
              className="grid grid-cols-[1fr_7rem_auto] items-end gap-3 border border-line p-3"
              data-testid="combo-item-row"
            >
              <div>
                <label htmlFor={`${uid}-item-${i}`} className="field-label">
                  Fragrance {i + 1}
                </label>
                <select
                  id={`${uid}-item-${i}`}
                  name="item.productId"
                  value={row.productId}
                  onChange={(ev) => update(i, { productId: ev.target.value })}
                  className="field select-field"
                >
                  <option value="" className="bg-surface-raised">
                    Choose a fragrance…
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id} className="bg-surface-raised">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={`${uid}-size-${i}`} className="field-label">
                  Size
                </label>
                <input
                  id={`${uid}-size-${i}`}
                  name="item.sizeLabel"
                  value={row.sizeLabel}
                  onChange={(ev) => update(i, { sizeLabel: ev.target.value })}
                  placeholder="10ml"
                  className="field"
                />
              </div>

              <div className="flex items-center gap-1 pb-1">
                <IconBtn label={`Move item ${i + 1} up`} onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.6} />
                </IconBtn>
                <IconBtn
                  label={`Move item ${i + 1} down`}
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                >
                  <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.6} />
                </IconBtn>
                <IconBtn
                  label={`Remove item ${i + 1}`}
                  onClick={() => setItems((r) => r.filter((_, n) => n !== i))}
                  disabled={items.length === 1}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.6} />
                </IconBtn>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setItems((r) => [...r, { productId: "", sizeLabel: "10ml" }])}
          className="btn btn-outline btn-sm mt-4"
          data-testid="combo-add-item"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
          Add item
        </button>

        <p className="mt-4 font-sans text-xs leading-relaxed text-stone-dark">
          The size here is a label describing the box — a 10ml bottle does not
          need to exist as its own sellable variant. Everything else about each
          fragrance (notes, narrative, images) is read live from its own record,
          so editing a fragrance updates every set containing it.
        </p>
      </Panel>

      {/* ------------------------------------------------------------------ */}
      <Panel title="Price & stock">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={`${uid}-sku`} name="sku" label="SKU" defaultValue={values?.sku} error={e.sku} placeholder="AVN-SET-DISCOVERY" required />
          <Field id={`${uid}-stock`} name="stock" label="Stock (boxes)" type="number" defaultValue={String(values?.stock ?? 0)} error={e.stock} hint="The packaged set's own stock — unrelated to the bottles inside." required />
          <Field id={`${uid}-mrp`} name="mrp" label="MRP (₹)" defaultValue={values?.mrp} error={e.mrp} placeholder="1499" required />
          <Field id={`${uid}-price`} name="price" label="Offer price (₹)" defaultValue={values?.price} error={e.price} placeholder="1199" required />
          <Field id={`${uid}-weight`} name="weightGrams" label="Shipped weight (g)" type="number" defaultValue={String(values?.weightGrams ?? 400)} error={e.weightGrams} />
          <Field id={`${uid}-sort`} name="sortOrder" label="Sort order" type="number" defaultValue={String(values?.sortOrder ?? 0)} />
        </div>
      </Panel>

      <Panel title="Storefront">
        <div className="space-y-4">
          <Check name="isActive" label="Live on the storefront" defaultChecked={values?.isActive ?? false} />
          <Check
            name="isFeatured"
            label="Feature on the homepage"
            defaultChecked={values?.isFeatured ?? false}
            hint="Only one set headlines the landing page; featuring this one un-features the others."
          />
          <Check
            name="couponEligible"
            label="Allow coupon codes on this set"
            defaultChecked={values?.couponEligible ?? false}
            hint="Off by default. Sets are already priced below the sum of their parts, so codes normally do not stack on top."
          />
        </div>
      </Panel>

      <Panel title="Copy & SEO">
        <Area id={`${uid}-how`} name="howToUse" label="How to use" defaultValue={values?.howToUse} rows={3} />
        <Area id={`${uid}-caution`} name="caution" label="Caution" defaultValue={values?.caution} rows={3} />
        <Field id={`${uid}-mtitle`} name="metaTitle" label="Meta title" defaultValue={values?.metaTitle} />
        <Field id={`${uid}-mdesc`} name="metaDescription" label="Meta description" defaultValue={values?.metaDescription} />
      </Panel>

      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={cn("font-sans text-sm", state.ok ? "text-gold-light" : "text-danger")}
        >
          {state.message}
        </p>
      )}

      <Submit isEdit={Boolean(values?.id)} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */

function Submit({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-md">
      {pending ? "Saving" : isEdit ? "Save changes" : "Create set"}
    </button>
  );
}

function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-light text-bone">{title}</h2>
        {aside}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  ...rest
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input id={id} aria-invalid={error ? true : undefined} className={error ? "field field-error" : "field"} {...rest} />
      {error ? (
        <span className="field-msg-error">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  );
}

function Area({
  id,
  label,
  error,
  ...rest
}: {
  id: string;
  label: string;
  error?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <textarea id={id} aria-invalid={error ? true : undefined} className={cn("field resize-y", error && "field-error")} {...rest} />
      {error && <span className="field-msg-error">{error}</span>}
    </div>
  );
}

function Check({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 accent-[#C9A24B]"
      />
      <span>
        <span className="font-sans text-sm text-bone">{label}</span>
        {hint && <span className="mt-1 block font-sans text-xs text-stone-dark">{hint}</span>}
      </span>
    </label>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center border border-line text-stone transition-colors hover:border-gold/40 hover:text-gold-light disabled:opacity-30"
    >
      {children}
    </button>
  );
}
