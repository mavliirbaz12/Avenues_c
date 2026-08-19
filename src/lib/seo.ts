/**
 * Helpers for the bits of markup that sit outside React's escaping.
 */

/**
 * Serialises structured data for an inline `<script type="application/ld+json">`.
 *
 * `JSON.stringify` escapes `"` and `\` but has no rule for `<`, and inside a
 * `<script>` element the HTML tokenizer is in *script data state* — it is not
 * JavaScript-aware. On seeing `</s` it starts matching an end tag and does not
 * care that the sequence sits inside a JSON string literal. So a product name
 * or description containing `</script>` closes the element early and everything
 * after it is parsed as fresh HTML: stored XSS on a public page, written from
 * an admin text field. `type="application/ld+json"` is no defence, because the
 * break happens at the tokenizer, before the content type is ever consulted.
 *
 * `<` is valid JSON and parses back to `<`, so escaping it costs nothing:
 * Google and every other structured-data consumer sees the identical document.
 *
 * Use this at every JSON-LD site rather than `JSON.stringify` directly — the
 * point of a named helper is that the next person adding a `<script>` block
 * cannot quietly reintroduce the hole.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * Reduces a `?next=` value to a safe same-origin path.
 *
 * Prefix-matching does not work here, which is how the previous version
 * (`!raw.startsWith("/") || raw.startsWith("//")`) let `/\/evil.com` through:
 * the URL parser treats a backslash as a path separator for special schemes, so
 * the browser resolves that to `https://evil.com/`. Tabs and newlines slip past
 * the same way.
 *
 * Parsing against a placeholder origin settles it — anything that resolves off
 * that origin is rejected. Returning the *re-serialised* path rather than the
 * caller's raw string is the load-bearing part: it guarantees that whatever
 * reaches `redirect()` or `router.push()` is already normalised, and cannot
 * carry an encoding the check did not see.
 */
export function safeNext(raw: string | undefined, fallback = "/account"): string {
  if (!raw) return fallback;
  try {
    const base = "https://placeholder.invalid";
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
