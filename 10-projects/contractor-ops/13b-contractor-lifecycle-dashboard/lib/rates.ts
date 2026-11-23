/**
 * Payment display helpers. The request form now asks for Payment Currency
 * ("KRW - South Korean Won") and Payment Cadence ("Monthly", Fixed only) as
 * separate questions; older rows have both baked into the free-text rate.
 */

/** "KRW - South Korean Won" -> "KRW"; anything else passes through trimmed. */
export function currencyCode(currency: string | undefined | null): string {
  const c = (currency || "").trim();
  const m = c.match(/^([A-Z]{3})\b/);
  return m ? m[1] : c;
}

/**
 * Rate with currency and cadence appended when the form gave them separately:
 * ("5000", "KRW - South Korean Won", "Monthly") -> "5000 KRW, Monthly".
 * Old free-text rates ("4000 JPY/hr") pass through unchanged.
 */
export function rateWithCurrency(
  rate: string | undefined | null,
  currency?: string | null,
  cadence?: string | null,
): string {
  let out = (rate || "").trim();
  if (!out) return "";
  const code = currencyCode(currency);
  if (code && !out.toUpperCase().includes(code)) out = `${out} ${code}`;
  const cad = (cadence || "").trim();
  if (cad) out = `${out}, ${cad}`;
  return out;
}
