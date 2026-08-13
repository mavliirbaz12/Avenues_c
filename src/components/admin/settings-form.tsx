"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveSettings } from "@/app/actions/admin/settings";
import { ADMIN_FORM_IDLE } from "@/app/actions/admin/marketing";
import type { StoreSettings } from "@/lib/settings";
import { paiseToRupeeInput } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const [state, action] = useActionState(saveSettings, ADMIN_FORM_IDLE);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-8">
      <Panel title="Shipping & payment" hint="These drive checkout maths directly.">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="st-flat" name="shippingFlat" label="Flat delivery rate (₹)" required inputMode="decimal" defaultValue={paiseToRupeeInput(settings.shippingFlatPaise)} error={e.shippingFlat} />
          <Field id="st-free" name="freeShippingThreshold" label="Free delivery above (₹)" required inputMode="decimal" defaultValue={paiseToRupeeInput(settings.freeShippingThresholdPaise)} error={e.freeShippingThreshold} />
          <Field id="st-codfee" name="codFee" label="COD handling fee (₹)" inputMode="decimal" defaultValue={paiseToRupeeInput(settings.codFeePaise)} error={e.codFee} />
          <Field id="st-codmax" name="codMaxOrder" label="COD cap (₹, optional)" inputMode="decimal" defaultValue={settings.codMaxOrderPaise ? paiseToRupeeInput(settings.codMaxOrderPaise) : ""} error={e.codMaxOrder} hint="Refuse COD above this order value. Blank = no cap." />
        </div>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" name="codEnabled" value="true" defaultChecked={settings.codEnabled} className="h-4 w-4 accent-[#C9A24B]" />
          <span className="font-sans text-sm text-stone">Offer cash on delivery</span>
        </label>
      </Panel>

      <Panel title="Delhivery">
        <Field id="st-pickup" name="delhiveryPickupName" label="Pickup location name" defaultValue={settings.delhiveryPickupName ?? ""} error={e.delhiveryPickupName} hint="Exactly as registered in Delhivery One — shipment creation fails on a mismatch." />
      </Panel>

      <Panel title="Support channels" hint="Rendered in the footer, the WhatsApp button and order-help links.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="st-wa" name="whatsappNumber" label="WhatsApp number" inputMode="numeric" placeholder="919876543210" defaultValue={settings.whatsappNumber ?? ""} error={e.whatsappNumber} hint="Digits only, with country code. Blank hides every WhatsApp button." />
          <Field id="st-semail" name="supportEmail" label="Support email" required type="email" defaultValue={settings.supportEmail} error={e.supportEmail} />
          <Field id="st-sphone" name="supportPhone" label="Support phone (optional)" defaultValue={settings.supportPhone ?? ""} error={e.supportPhone} />
        </div>
      </Panel>

      <Panel title="Statutory — Legal Metrology & GST" hint="Shown on product pages and invoices. Complete this before going live.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="st-mname" name="manufacturerName" label="Marketed by" required defaultValue={settings.manufacturerName} error={e.manufacturerName} />
          <Field id="st-gstin" name="gstin" label="GSTIN (optional)" defaultValue={settings.gstin ?? ""} error={e.gstin} />
        </div>
        <div>
          <label htmlFor="st-maddr" className="field-label">Registered address</label>
          <textarea id="st-maddr" name="manufacturerAddress" rows={2} defaultValue={settings.manufacturerAddress} className="field resize-y" />
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="st-cemail" name="customerCareEmail" label="Customer care email" required type="email" defaultValue={settings.customerCareEmail} error={e.customerCareEmail} />
          <Field id="st-cphone" name="customerCarePhone" label="Customer care phone" defaultValue={settings.customerCarePhone ?? ""} error={e.customerCarePhone} />
          <Field id="st-prefix" name="invoicePrefix" label="Invoice prefix" required defaultValue={settings.invoicePrefix} error={e.invoicePrefix} hint="Changing this mid-series is unusual — talk to your accountant first." />
        </div>
      </Panel>

      <Panel title="Social">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="st-ig" name="instagramUrl" label="Instagram URL" type="url" placeholder="https://instagram.com/avenuesperfumes" defaultValue={settings.instagramUrl ?? ""} error={e.instagramUrl} />
          <Field id="st-fb" name="facebookUrl" label="Facebook URL" type="url" defaultValue={settings.facebookUrl ?? ""} error={e.facebookUrl} />
        </div>
      </Panel>

      {state.message && (
        <p className={cn("font-sans text-sm", state.ok ? "text-gold-light" : "text-danger")} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      )}

      <Submit />
    </form>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border border-line p-5 sm:p-6">
      <h2 className="font-sans text-sm uppercase tracking-wide2 text-bone">{title}</h2>
      {hint && <p className="mt-1 font-sans text-xs text-stone-dark">{hint}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Field({ id, name, label, error, hint, ...rest }: { id: string; name: string; label: string; error?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} name={name} aria-invalid={error ? true : undefined} className={cn("field", error && "field-error")} {...rest} />
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-msg-error">{error}</span>}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-md">
      {pending ? "Saving" : "Save settings"}
    </button>
  );
}
