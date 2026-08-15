"use client";

import { INDIAN_STATES, ADDRESS_TYPE_LABELS } from "@/lib/constants/india";
import { cn } from "@/lib/utils";

export type AddressValues = {
  id?: string;
  type?: string;
  fullName?: string;
  phone?: string;
  altPhone?: string | null;
  line1?: string;
  line2?: string | null;
  landmark?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
  isDefault?: boolean;
};

/**
 * The Indian address field set, in the order people actually write one.
 *
 * Shared verbatim between the account address book and checkout so the two
 * can't drift — a field added here appears in both, and validation on the
 * server (addressSchema) is the same for both paths.
 */
export function AddressFields({
  values,
  errors,
  showDefaultToggle = true,
  showSaveToggle = false,
  idPrefix = "addr",
}: {
  values?: AddressValues;
  errors?: Record<string, string>;
  showDefaultToggle?: boolean;
  /** Checkout only: offer to file this address in the address book. */
  showSaveToggle?: boolean;
  idPrefix?: string;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="space-y-5">
      {values?.id && <input type="hidden" name="id" value={values.id} />}

      <fieldset>
        <legend className="field-label">Address type</legend>
        <div className="flex flex-wrap gap-2.5">
          {Object.entries(ADDRESS_TYPE_LABELS).map(([value, label]) => (
            <label
              key={value}
              className="group relative cursor-pointer border border-line px-5 py-2.5 font-sans text-sm
                         text-stone transition-colors duration-400 ease-smoke
                         hover:border-line-strong has-[:checked]:border-gold/60
                         has-[:checked]:bg-gold/10 has-[:checked]:text-gold-light"
            >
              <input
                type="radio"
                name="type"
                value={value}
                defaultChecked={(values?.type ?? "HOME") === value}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={id("fullName")}
          name="fullName"
          label="Full name"
          autoComplete="name"
          required
          defaultValue={values?.fullName}
          error={errors?.fullName}
        />
        <Field
          id={id("phone")}
          name="phone"
          label="Phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          required
          placeholder="10-digit mobile"
          defaultValue={values?.phone}
          error={errors?.phone}
        />
      </div>

      <Field
        id={id("line1")}
        name="line1"
        label="Flat, house no., building"
        autoComplete="address-line1"
        required
        defaultValue={values?.line1}
        error={errors?.line1}
      />

      <Field
        id={id("line2")}
        name="line2"
        label="Area, street, sector (optional)"
        autoComplete="address-line2"
        defaultValue={values?.line2 ?? ""}
        error={errors?.line2}
      />

      <Field
        id={id("landmark")}
        name="landmark"
        label="Landmark (optional)"
        placeholder="Near..."
        defaultValue={values?.landmark ?? ""}
        error={errors?.landmark}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          id={id("pincode")}
          name="pincode"
          label="Pincode"
          inputMode="numeric"
          maxLength={6}
          autoComplete="postal-code"
          required
          defaultValue={values?.pincode}
          error={errors?.pincode}
        />
        <Field
          id={id("city")}
          name="city"
          label="City"
          autoComplete="address-level2"
          required
          defaultValue={values?.city}
          error={errors?.city}
        />
        <div>
          <label htmlFor={id("state")} className="field-label">
            State
          </label>
          <select
            id={id("state")}
            name="state"
            required
            defaultValue={values?.state ?? ""}
            aria-invalid={errors?.state ? true : undefined}
            className={cn("field select-field", errors?.state && "field-error")}
          >
            <option value="" disabled className="bg-surface-raised">
              Choose
            </option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s} className="bg-surface-raised">
                {s}
              </option>
            ))}
          </select>
          {errors?.state && <span className="field-msg-error">{errors.state}</span>}
        </div>
      </div>

      <Field
        id={id("altPhone")}
        name="altPhone"
        label="Alternate phone (optional)"
        type="tel"
        inputMode="numeric"
        defaultValue={values?.altPhone ?? ""}
        error={errors?.altPhone}
        hint="A second number the courier can try."
      />

      {showDefaultToggle && (
        <Checkbox
          id={id("isDefault")}
          name="isDefault"
          defaultChecked={values?.isDefault}
          label="Make this my default delivery address"
        />
      )}

      {showSaveToggle && (
        <Checkbox
          id={id("saveToBook")}
          name="saveToBook"
          defaultChecked
          label="Save this address to my address book"
        />
      )}
    </div>
  );
}

function Field({
  id,
  name,
  label,
  error,
  hint,
  ...rest
}: {
  id: string;
  name: string;
  label: string;
  error?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        className={cn("field", error && "field-error")}
        {...rest}
      />
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-msg-error">{error}</span>}
    </div>
  );
}

function Checkbox({
  id,
  name,
  label,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-[1.1rem] w-[1.1rem] shrink-0 border border-line-strong transition-colors
                   duration-300 peer-checked:border-gold peer-checked:bg-gold
                   peer-focus-visible:outline peer-focus-visible:outline-2
                   peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-light"
      >
        <svg
          viewBox="0 0 16 16"
          className="absolute inset-0 h-full w-full scale-0 text-ink transition-transform duration-300 peer-checked:scale-100"
          fill="none"
        >
          <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="font-sans text-sm text-stone">{label}</span>
    </label>
  );
}
