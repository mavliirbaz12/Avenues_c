/**
 * Shared form-state types and constants.
 *
 * These MUST live outside any "use server" module. Every export of a
 * "use server" file is compiled into a server-reference proxy for the client
 * bundle, so a plain constant imported from one arrives in a client component
 * as an empty proxy rather than its value.
 *
 * Found the hard way: the contact form's subject <select> rendered with zero
 * options because SUBJECT_LABELS was being imported from an action file and
 * Object.entries() on the proxy returned nothing.
 */

/** Result of a form action that can report per-field errors. */
export type FormState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  /** Set by create-style actions so the client can navigate to the editor. */
  redirectTo?: string;
};

export const FORM_IDLE: FormState = { ok: false, message: "" };

/** Result of an action that only ever reports one message. */
export type SimpleActionState = { ok: boolean; message: string };

export const ACTION_IDLE: SimpleActionState = { ok: false, message: "" };

export const SUBJECT_LABELS = {
  ORDER_ISSUE: "Order issue",
  PRODUCT_ENQUIRY: "Product enquiry",
  BULK_CORPORATE: "Bulk & corporate order",
  OTHER: "Other",
} as const;

export type SubjectKey = keyof typeof SUBJECT_LABELS;
