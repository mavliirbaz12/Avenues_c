"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Pencil, Trash2, Check } from "lucide-react";
import { AddressFields, type AddressValues } from "./address-fields";
import { saveAddress, deleteAddress, setDefaultAddress } from "@/app/actions/account";
import { ADDRESS_TYPE_LABELS } from "@/lib/constants/india";
import { useUI } from "@/store/ui";
import { Sparkle } from "@/components/brand/sparkle";
import { cn } from "@/lib/utils";
import { FORM_IDLE } from "@/lib/form-state";

export type SavedAddress = AddressValues & {
  id: string;
  type: keyof typeof ADDRESS_TYPE_LABELS;
  fullName: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

export function AddressBook({ addresses }: { addresses: SavedAddress[] }) {
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [adding, setAdding] = useState(false);

  const open = adding || editing !== null;

  if (open) {
    return (
      <AddressEditor
        address={editing ?? undefined}
        onDone={() => {
          setAdding(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div>
      {addresses.length === 0 ? (
        <div className="border border-line px-6 py-14 text-center">
          <Sparkle className="mx-auto h-3.5 w-3.5 text-gold/50" />
          <p className="mt-5 font-display text-2xl font-light text-bone">No addresses yet</p>
          <p className="mx-auto mt-3 max-w-sm font-sans text-sm leading-relaxed text-stone">
            Save one now and checkout becomes two taps.
          </p>
          <button type="button" onClick={() => setAdding(true)} className="btn btn-outline btn-md mt-7">
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Add an address
          </button>
        </div>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {addresses.map((a) => (
              <AddressCard key={a.id} address={a} onEdit={() => setEditing(a)} />
            ))}
          </ul>
          <button type="button" onClick={() => setAdding(true)} className="btn btn-outline btn-md mt-6">
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Add another address
          </button>
        </>
      )}
    </div>
  );
}

function AddressCard({ address, onEdit }: { address: SavedAddress; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const toast = useUI((s) => s.toast);

  function remove() {
    startTransition(async () => {
      const res = await deleteAddress(address.id);
      toast({ title: res.message, tone: res.ok ? "default" : "danger" });
      setConfirming(false);
    });
  }

  function makeDefault() {
    startTransition(async () => {
      const res = await setDefaultAddress(address.id);
      toast({ title: res.message, tone: res.ok ? "default" : "danger" });
    });
  }

  return (
    <li
      className={cn(
        "relative flex flex-col border p-5 transition-colors duration-400",
        address.isDefault ? "border-gold/45" : "border-line",
        pending && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="micro-label">{ADDRESS_TYPE_LABELS[address.type]}</span>
        {address.isDefault && <span className="micro-label-gold">Default</span>}
      </div>

      <p className="mt-3 font-sans text-[0.9375rem] text-bone">{address.fullName}</p>
      <address className="mt-1.5 not-italic font-sans text-sm leading-relaxed text-stone">
        {address.line1}
        {address.line2 && <>, {address.line2}</>}
        {address.landmark && (
          <>
            <br />
            Near {address.landmark}
          </>
        )}
        <br />
        {address.city}, {address.state} {address.pincode}
        <br />
        {address.phone}
        {address.altPhone && <> &middot; {address.altPhone}</>}
      </address>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-2 font-sans text-micro uppercase text-stone transition-colors hover:text-gold-light"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
          Edit
        </button>

        {!address.isDefault && (
          <>
            <button
              type="button"
              onClick={makeDefault}
              disabled={pending}
              className="inline-flex items-center gap-2 font-sans text-micro uppercase text-stone transition-colors hover:text-gold-light"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
              Set default
            </button>

            {confirming ? (
              <span className="inline-flex items-center gap-3">
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="font-sans text-micro uppercase text-danger"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="font-sans text-micro uppercase text-stone-dark"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-2 font-sans text-micro uppercase text-stone transition-colors hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                Remove
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function AddressEditor({
  address,
  onDone,
}: {
  address?: SavedAddress;
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveAddress, FORM_IDLE);
  const toast = useUI((s) => s.toast);

  useEffect(() => {
    if (state.ok) {
      toast({ title: state.message });
      onDone();
    }
  }, [state.ok, state.message, toast, onDone]);

  return (
    <form action={action} className="border border-line p-6 sm:p-8">
      <h2 className="font-display text-d5 font-light text-bone">
        {address ? "Edit address" : "New address"}
      </h2>

      <div className="mt-7">
        <AddressFields values={address} errors={state.fieldErrors} idPrefix="book" />
      </div>

      {state.message && !state.ok && (
        <p className="mt-5 font-sans text-sm text-danger" role="alert">
          {state.message}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <SaveButton />
        <button type="button" onClick={onDone} className="btn btn-ghost btn-md">
          Cancel
        </button>
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-md">
      {pending ? "Saving" : "Save address"}
    </button>
  );
}
