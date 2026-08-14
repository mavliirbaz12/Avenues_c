"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Gender } from "@prisma/client";
import { saveProduct } from "@/app/actions/admin/products";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import { FORM_IDLE } from "@/lib/form-state";

export type ProductFormValues = {
  id?: string;
  name?: string;
  slug?: string;
  tagline?: string;
  highlight?: string;
  description?: string;
  concentration?: string;
  gender?: Gender;
  notesTop?: string[];
  notesHeart?: string[];
  notesBase?: string[];
  occasions?: string[];
  whyChoose?: string[];
  howToUse?: string;
  caution?: string;
  longevity?: string;
  sensoryNarrative?: string;
  bestFor?: string;
  countryOfOrigin?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
};

export function ProductForm({ values }: { values?: ProductFormValues }) {
  const [state, action] = useActionState(saveProduct, FORM_IDLE);
  const router = useRouter();
  const toast = useUI((s) => s.toast);

  useEffect(() => {
    if (!state.ok) return;
    toast({ title: state.message });
    if (state.redirectTo) router.push(state.redirectTo);
  }, [state, toast, router]);

  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-8">
      {values?.id && <input type="hidden" name="id" value={values.id} />}

      <Panel title="Identity">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="pf-name" name="name" label="Name" required defaultValue={values?.name} error={e.name} hint='Written in full, e.g. "Avenues Night Drip".' />
          <Field id="pf-slug" name="slug" label="Slug" defaultValue={values?.slug} error={e.slug} hint="URL path. Leave blank to derive from the name." />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="pf-tagline" name="tagline" label="Tagline" required defaultValue={values?.tagline} error={e.tagline} hint='Three beats: "Sweet. Bold. Addictive."' />
          <Field id="pf-highlight" name="highlight" label="Highlight line" required defaultValue={values?.highlight} error={e.highlight} hint="The one-sentence promise, shown as a full-width quote." />
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label htmlFor="pf-gender" className="field-label">For</label>
            <select id="pf-gender" name="gender" defaultValue={values?.gender ?? "UNISEX"} className="field">
              <option value="MEN" className="bg-surface-raised">Men</option>
              <option value="WOMEN" className="bg-surface-raised">Women</option>
              <option value="UNISEX" className="bg-surface-raised">Unisex</option>
            </select>
          </div>
          <Field id="pf-conc" name="concentration" label="Concentration" defaultValue={values?.concentration ?? "Eau De Parfum"} error={e.concentration} />
          <Field id="pf-longevity" name="longevity" label="Longevity" defaultValue={values?.longevity ?? "8-10 hours"} error={e.longevity} />
        </div>
      </Panel>

      <Panel title="The copy">
        <Area id="pf-desc" name="description" label="Description" rows={5} required defaultValue={values?.description} error={e.description} hint="A paragraph in the brand voice. What it opens with, what it settles into, when to wear it." />
        <Area id="pf-sensory" name="sensoryNarrative" label="Sensory narrative" rows={4} defaultValue={values?.sensoryNarrative} error={e.sensoryNarrative} hint="Two or three sentences on how it opens, turns and settles. Shown above the note pyramid — this is what makes the page read like a perfume house rather than a spec sheet." />
        <Field id="pf-bestfor" name="bestFor" label="Best for" defaultValue={values?.bestFor} error={e.bestFor} placeholder="Cooler weather and after dark." hint="One line of season and occasion guidance, shown beside the occasion chips." />
        <Area id="pf-why" name="whyChoose" label="Why choose it" rows={5} defaultValue={values?.whyChoose?.join("\n")} error={e.whyChoose} hint="One reason per line. Shown as the bulleted list on the product page." />
        <div className="grid gap-5 sm:grid-cols-2">
          <Area id="pf-how" name="howToUse" label="How to use" rows={4} defaultValue={values?.howToUse} error={e.howToUse} />
          <Area id="pf-caution" name="caution" label="Caution" rows={4} defaultValue={values?.caution} error={e.caution} />
        </div>
      </Panel>

      <Panel title="Fragrance notes" hint="Comma-separated. These build the pyramid on the product page.">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="pf-top" name="notesTop" label="Top notes" defaultValue={values?.notesTop?.join(", ")} error={e.notesTop} placeholder="Bergamot, Lavender" />
          <Field id="pf-heart" name="notesHeart" label="Heart notes" defaultValue={values?.notesHeart?.join(", ")} error={e.notesHeart} placeholder="Rose, Oud" />
          <Field id="pf-base" name="notesBase" label="Base notes" defaultValue={values?.notesBase?.join(", ")} error={e.notesBase} placeholder="Amber, Musk" />
        </div>
        <Field id="pf-occasions" name="occasions" label="Occasions" defaultValue={values?.occasions?.join(", ")} error={e.occasions} placeholder="Daily Wear, Office, Parties" hint="Comma-separated chips shown under the pyramid." />
      </Panel>

      <Panel title="Visibility & SEO">
        <div className="flex flex-wrap gap-6">
          <Toggle name="isActive" label="Live on storefront" defaultChecked={values?.isActive ?? false} />
          <Toggle name="isFeatured" label="Featured on landing page" defaultChecked={values?.isFeatured ?? false} />
          <div className="w-28">
            <label htmlFor="pf-sort" className="field-label">Sort order</label>
            <input id="pf-sort" name="sortOrder" type="number" min={0} defaultValue={values?.sortOrder ?? 0} className="field" />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="pf-mtitle" name="metaTitle" label="Meta title" defaultValue={values?.metaTitle ?? ""} error={e.metaTitle} hint="Leave blank for the default." />
          <Field id="pf-mdesc" name="metaDescription" label="Meta description" defaultValue={values?.metaDescription ?? ""} error={e.metaDescription} />
        </div>
        <Field id="pf-origin" name="countryOfOrigin" label="Country of origin" defaultValue={values?.countryOfOrigin ?? "India"} error={e.countryOfOrigin} hint="Legal Metrology disclosure on the product page." />
      </Panel>

      {state.message && !state.ok && (
        <p className="font-sans text-sm text-danger" role="alert">{state.message}</p>
      )}

      <Submit isNew={!values?.id} />
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

function Area({ id, name, label, error, hint, rows = 4, ...rest }: { id: string; name: string; label: string; error?: string; hint?: string; rows?: number } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <textarea id={id} name={name} rows={rows} aria-invalid={error ? true : undefined} className={cn("field resize-y", error && "field-error")} {...rest} />
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-msg-error">{error}</span>}
    </div>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-pill border border-line-strong bg-surface-sunken transition-colors duration-300
                   after:absolute after:left-0.5 after:top-1/2 after:h-3.5 after:w-3.5 after:-translate-y-1/2 after:rounded-pill after:bg-stone after:transition-all after:duration-300
                   peer-checked:border-gold peer-checked:bg-gold/20 peer-checked:after:left-[calc(100%-1.125rem)] peer-checked:after:bg-gold
                   peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-light"
      />
      <span className="font-sans text-sm text-stone">{label}</span>
    </label>
  );
}

function Submit({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-md">
      {pending ? "Saving" : isNew ? "Create product" : "Save changes"}
    </button>
  );
}
