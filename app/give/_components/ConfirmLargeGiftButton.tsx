"use client";

/**
 * Submit button that asks the donor to confirm an unusually large amount before it
 * posts — a typo guard (e.g. $5000 entered for $50). Client-side only: it preserves all
 * form state (no redirect). The authoritative bounds ($0.50 min, $100k max) are enforced
 * server-side at the Zod boundary; this is purely a UX confirmation above the threshold.
 */
export function ConfirmLargeGiftButton({
  thresholdDollars,
  className,
  children,
}: {
  thresholdDollars: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        const form = e.currentTarget.form;
        const field = form?.elements.namedItem("amountDollars");
        const amount = field instanceof HTMLInputElement ? Number(field.value) : Number.NaN;
        if (Number.isFinite(amount) && amount >= thresholdDollars) {
          const ok = window.confirm(
            `You're about to donate $${amount.toLocaleString("en-US")}. Is that the amount you meant?`,
          );
          if (!ok) e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
