"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { CouponType } from "@prisma/client";
import { Plus, Pencil } from "lucide-react";
import { saveCoupon, toggleCoupon } from "@/app/actions/admin/marketing";
import { formatPaise, paiseToRupeeInput, formatDate } from "@/lib/format";
import { AdminChip } from "./ui";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import { FORM_IDLE } from "@/lib/form-state";

export type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  valuePaise: number | null;
  valuePercent: number | null;
  minOrderPaise: number;
  maxDiscountPaise: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};

export function CouponManager({ coupons }: { coupons: CouponRow[] }) {
  const [editing, setEditing] = useState<CouponRow | "new" | null>(null);

  return (
    <div>
      {editing === null && (
        <button type="button" onClick={() => setEditing("new")} className="btn btn-primary btn-sm">
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
          New coupon
        </button>
      )}

      {editing !== null && (
        <CouponForm coupon={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />
      )}

      {coupons.length === 0 && editing === null ? (
        <p className="mt-6 border border-line px-6 py-12 text-center font-sans text-sm text-stone-dark">
          No coupons yet. The storefront&rsquo;s coupon field already works — it
          will simply reject every code until one exists here.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line border border-line">
          {coupons.map((c) => (
            <CouponLine key={c.id} coupon={c} onEdit={() => setEditing(c)} disabled={editing !== null} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CouponLine({ coupon, onEdit, disabled }: { coupon: CouponRow; onEdit: () => void; disabled: boolean }) {
  const [busy, startTransition] = useTransition();
  const toast = useUI((s) => s.toast);

  const now = new Date();
  const expired = coupon.endsAt !== null && coupon.endsAt < now;
  const exhausted = coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit;

  function toggle() {
    startTransition(async () => {
      await toggleCoupon(coupon.id, !coupon.isActive);
      toast({ title: coupon.isActive ? `${coupon.code} disabled.` : `${coupon.code} enabled.` });
    });
  }

  return (
    <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", busy && "opacity-50")}>
      <span className="w-32 font-sans text-sm tracking-wide2 text-bone">{coupon.code}</span>
      <span className="font-sans text-xs text-stone">
        {coupon.type === CouponType.FLAT
          ? `${formatPaise(coupon.valuePaise ?? 0)} off`
          : `${coupon.valuePercent}% off${coupon.maxDiscountPaise ? ` (max ${formatPaise(coupon.maxDiscountPaise)})` : ""}`}
        {coupon.minOrderPaise > 0 && <span className="text-stone-dark"> · over {formatPaise(coupon.minOrderPaise)}</span>}
      </span>
      <span className="font-sans text-xs tabular-nums text-stone-dark">
        {coupon.usedCount}
        {coupon.usageLimit !== null && `/${coupon.usageLimit}`} used
      </span>
      {coupon.endsAt && (
        <span className="font-sans text-xs text-stone-dark">
          {expired ? "expired" : "until"} {formatDate(coupon.endsAt)}
        </span>
      )}

      {exhausted ? (
        <AdminChip tone="quiet">Exhausted</AdminChip>
      ) : expired ? (
        <AdminChip tone="quiet">Expired</AdminChip>
      ) : coupon.isActive ? (
        <AdminChip tone="ok">Live</AdminChip>
      ) : (
        <AdminChip tone="quiet">Off</AdminChip>
      )}

      <span className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={disabled || busy}
          className="font-sans text-[0.6875rem] uppercase tracking-wide2 text-stone transition-colors hover:text-gold-light disabled:opacity-40"
        >
          {coupon.isActive ? "Disable" : "Enable"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 font-sans text-[0.6875rem] uppercase tracking-wide2 text-stone transition-colors hover:text-gold-light disabled:opacity-40"
        >
          <Pencil className="h-3 w-3" strokeWidth={1.6} />
          Edit
        </button>
      </span>
    </li>
  );
}

function CouponForm({ coupon, onDone }: { coupon?: CouponRow; onDone: () => void }) {
  const [state, action] = useActionState(saveCoupon, FORM_IDLE);
  const [type, setType] = useState<CouponType>(coupon?.type ?? CouponType.PERCENTAGE);
  const toast = useUI((s) => s.toast);
  const e = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) {
      toast({ title: state.message });
      onDone();
    }
  }, [state.ok, state.message, toast, onDone]);

  const toLocalInput = (d: Date | null | undefined) =>
    d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

  return (
    <form action={action} className="mt-4 border border-gold/30 p-5">
      {coupon && <input type="hidden" name="id" value={coupon.id} />}
      <p className="font-sans text-xs uppercase tracking-wide2 text-gold">
        {coupon ? `Edit ${coupon.code}` : "New coupon"}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Small id="cp-code" name="code" label="Code" required defaultValue={coupon?.code} placeholder="WELCOME10" error={e.code} />
        <div>
          <label htmlFor="cp-type" className="field-label">Type</label>
          <select id="cp-type" name="type" value={type} onChange={(ev) => setType(ev.target.value as CouponType)} className="field">
            <option value="PERCENTAGE" className="bg-surface-raised">Percentage off</option>
            <option value="FLAT" className="bg-surface-raised">Flat ₹ off</option>
          </select>
        </div>
        <Small
          id="cp-value"
          name="value"
          label={type === CouponType.FLAT ? "Amount off (₹)" : "Percent off (1–100)"}
          required
          inputMode="decimal"
          defaultValue={
            coupon
              ? coupon.type === CouponType.FLAT
                ? paiseToRupeeInput(coupon.valuePaise ?? 0)
                : String(coupon.valuePercent ?? "")
              : ""
          }
          error={e.value}
        />
        <Small id="cp-min" name="minOrder" label="Min order (₹, optional)" inputMode="decimal" defaultValue={coupon?.minOrderPaise ? paiseToRupeeInput(coupon.minOrderPaise) : ""} error={e.minOrder} />
        {type === CouponType.PERCENTAGE && (
          <Small id="cp-max" name="maxDiscount" label="Max discount (₹, optional)" inputMode="decimal" defaultValue={coupon?.maxDiscountPaise ? paiseToRupeeInput(coupon.maxDiscountPaise) : ""} error={e.maxDiscount} />
        )}
        <Small id="cp-limit" name="usageLimit" label="Total uses (optional)" type="number" min={1} defaultValue={coupon?.usageLimit ?? ""} error={e.usageLimit} />
        <Small id="cp-per" name="perUserLimit" label="Uses per customer (optional)" type="number" min={1} defaultValue={coupon?.perUserLimit ?? ""} error={e.perUserLimit} />
        <Small id="cp-starts" name="startsAt" label="Starts (optional)" type="datetime-local" defaultValue={toLocalInput(coupon?.startsAt)} error={e.startsAt} />
        <Small id="cp-ends" name="endsAt" label="Ends (optional)" type="datetime-local" defaultValue={toLocalInput(coupon?.endsAt)} error={e.endsAt} />
      </div>

      <Small id="cp-desc" name="description" label="Internal description (optional)" defaultValue={coupon?.description ?? ""} error={e.description} className="mt-4" />

      <label className="mt-4 flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" name="isActive" value="true" defaultChecked={coupon?.isActive ?? false} className="h-4 w-4 accent-[#C9A24B]" />
        <span className="font-sans text-xs text-stone">Live — customers can use it</span>
      </label>

      {state.message && !state.ok && <p className="mt-3 font-sans text-xs text-danger" role="alert">{state.message}</p>}

      <div className="mt-5 flex gap-3">
        <SaveButton isNew={!coupon} />
        <button type="button" onClick={onDone} className="btn btn-ghost btn-sm">Cancel</button>
      </div>
    </form>
  );
}

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
      {pending ? "Saving" : isNew ? "Create coupon" : "Save"}
    </button>
  );
}

function Small({ id, name, label, error, className, ...rest }: { id: string; name: string; label: string; error?: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} name={name} aria-invalid={error ? true : undefined} className={cn("field", error && "field-error")} {...rest} />
      {error && <span className="field-msg-error">{error}</span>}
    </div>
  );
}
