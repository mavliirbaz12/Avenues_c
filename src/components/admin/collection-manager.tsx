"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { saveCollection, deleteCollection, ADMIN_FORM_IDLE } from "@/app/actions/admin/marketing";
import { AdminChip } from "./ui";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

export type CollectionRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  productIds: string[];
};

export type ProductOption = { id: string; name: string };

export function CollectionManager({
  collections,
  products,
}: {
  collections: CollectionRow[];
  products: ProductOption[];
}) {
  const [editing, setEditing] = useState<CollectionRow | "new" | null>(null);

  return (
    <div>
      {editing === null && (
        <button type="button" onClick={() => setEditing("new")} className="btn btn-primary btn-sm">
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
          New collection
        </button>
      )}

      {editing !== null && (
        <CollectionForm
          collection={editing === "new" ? undefined : editing}
          products={products}
          onDone={() => setEditing(null)}
        />
      )}

      <ul className="mt-6 divide-y divide-line border border-line">
        {collections.map((c) => (
          <CollectionLine key={c.id} collection={c} onEdit={() => setEditing(c)} disabled={editing !== null} />
        ))}
        {collections.length === 0 && editing === null && (
          <li className="px-6 py-12 text-center font-sans text-sm text-stone-dark">
            No collections yet. Create &ldquo;Women&rdquo; or &ldquo;Gifting&rdquo;
            here and it can be merchandised without touching code.
          </li>
        )}
      </ul>
    </div>
  );
}

function CollectionLine({
  collection,
  onEdit,
  disabled,
}: {
  collection: CollectionRow;
  onEdit: () => void;
  disabled: boolean;
}) {
  const [busy, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const toast = useUI((s) => s.toast);

  function remove() {
    startTransition(async () => {
      await deleteCollection(collection.id);
      toast({ title: `${collection.title} deleted.` });
      setConfirming(false);
    });
  }

  return (
    <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", busy && "opacity-50")}>
      <span className="font-sans text-sm text-bone">{collection.title}</span>
      <span className="font-sans text-xs text-stone-dark">/{collection.slug}</span>
      <span className="font-sans text-xs text-stone-dark">
        {collection.productIds.length} product{collection.productIds.length === 1 ? "" : "s"}
      </span>
      {collection.isActive ? <AdminChip tone="ok">Live</AdminChip> : <AdminChip tone="quiet">Hidden</AdminChip>}

      <span className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 font-sans text-[0.6875rem] uppercase tracking-wide2 text-stone transition-colors hover:text-gold-light disabled:opacity-40"
        >
          <Pencil className="h-3 w-3" strokeWidth={1.6} />
          Edit
        </button>
        {confirming ? (
          <span className="flex items-center gap-2">
            <button type="button" onClick={remove} className="font-sans text-[0.6875rem] uppercase tracking-wide2 text-danger">Confirm</button>
            <button type="button" onClick={() => setConfirming(false)} className="font-sans text-[0.6875rem] uppercase tracking-wide2 text-stone-dark">No</button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 font-sans text-[0.6875rem] uppercase tracking-wide2 text-stone transition-colors hover:text-danger disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" strokeWidth={1.6} />
            Delete
          </button>
        )}
      </span>
    </li>
  );
}

function CollectionForm({
  collection,
  products,
  onDone,
}: {
  collection?: CollectionRow;
  products: ProductOption[];
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveCollection, ADMIN_FORM_IDLE);
  const toast = useUI((s) => s.toast);
  const e = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) {
      toast({ title: state.message });
      onDone();
    }
  }, [state.ok, state.message, toast, onDone]);

  return (
    <form action={action} className="mt-4 border border-gold/30 p-5">
      {collection && <input type="hidden" name="id" value={collection.id} />}
      <p className="font-sans text-xs uppercase tracking-wide2 text-gold">
        {collection ? `Edit ${collection.title}` : "New collection"}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Small id="cl-title" name="title" label="Title" required defaultValue={collection?.title} error={e.title} />
        <Small id="cl-slug" name="slug" label="Slug" defaultValue={collection?.slug} error={e.slug} placeholder="Derived from title if blank" />
        <Small id="cl-subtitle" name="subtitle" label="Subtitle (optional)" defaultValue={collection?.subtitle ?? ""} error={e.subtitle} />
        <Small id="cl-sort" name="sortOrder" label="Sort order" type="number" min={0} defaultValue={collection?.sortOrder ?? 0} error={e.sortOrder} />
      </div>

      <div className="mt-4">
        <label htmlFor="cl-desc" className="field-label">Description (optional)</label>
        <textarea id="cl-desc" name="description" rows={2} defaultValue={collection?.description ?? ""} className="field resize-y" />
      </div>

      <fieldset className="mt-4">
        <legend className="field-label">Products in this collection</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {products.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2.5 border border-line px-3 py-2 transition-colors hover:border-line-strong has-[:checked]:border-gold/50">
              <input
                type="checkbox"
                name="productIds"
                value={p.id}
                defaultChecked={collection?.productIds.includes(p.id)}
                className="h-4 w-4 accent-[#C9A24B]"
              />
              <span className="font-sans text-xs text-stone">{p.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" name="isActive" value="true" defaultChecked={collection?.isActive ?? true} className="h-4 w-4 accent-[#C9A24B]" />
        <span className="font-sans text-xs text-stone">Live on the storefront</span>
      </label>

      {state.message && !state.ok && <p className="mt-3 font-sans text-xs text-danger" role="alert">{state.message}</p>}

      <div className="mt-5 flex gap-3">
        <SaveButton isNew={!collection} />
        <button type="button" onClick={onDone} className="btn btn-ghost btn-sm">Cancel</button>
      </div>
    </form>
  );
}

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
      {pending ? "Saving" : isNew ? "Create collection" : "Save"}
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
