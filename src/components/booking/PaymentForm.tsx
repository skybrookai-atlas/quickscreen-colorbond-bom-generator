import React, { useState, useMemo } from "react";
import { useStripePayment } from "../../hooks/useStripePayment";
import { Loader2 } from "lucide-react";

interface PaymentFormProps {
  isSupplyOnly: boolean;
  depositAmount: number;
  selectedDate: string | null;
  onSuccess: () => void;
}

export function PaymentForm({ isSupplyOnly, depositAmount, selectedDate, onSuccess }: PaymentFormProps) {
  const { processPayment, loading, error, clearError } = useStripePayment();

  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [nameOnCard, setNameOnCard] = useState("");

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      return parts.join(" ");
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return `${v.substring(0, 2)}/${v.substring(2, 4)}`;
    }
    return v;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    setCardNumber(formatCardNumber(e.target.value));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    setExpiry(formatExpiry(e.target.value));
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    setCvc(e.target.value.replace(/[^0-9]/g, "").substring(0, 4));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    setNameOnCard(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const success = await processPayment({
      cardNumber,
      expiry,
      cvc,
      nameOnCard,
      amount: depositAmount,
    });

    if (success) {
      onSuccess();
    }
  };

  // Format booking date for CTA
  const bookingDateLabel = useMemo(() => {
    if (!selectedDate) return "";
    const date = new Date(selectedDate);
    return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  }, [selectedDate]);

  const refundTerms = isSupplyOnly
    ? "Refundable until 24h before pickup"
    : "Refundable until 48h before install";

  const ctaLabel = isSupplyOnly
    ? `Pay $${Math.round(depositAmount)} deposit · Book pickup ${bookingDateLabel}`
    : `Pay $${Math.round(depositAmount)} deposit · Book ${bookingDateLabel}`;

  return (
    <form onSubmit={handleSubmit} className="pay-card-form bg-brand-card border border-brand-border rounded-xl p-4 shadow-sm select-none">
      <div className="flex items-center justify-between mb-4 border-b border-brand-border/60 pb-2.5">
        <div className="text-[11.5px] font-bold text-brand-text uppercase tracking-wider">
          Card details
        </div>
        <div className="pay-card-form__brand-row flex gap-1.5 items-center">
          <div className="pay-card-form__brand w-8 h-5 rounded bg-blue-900 text-white font-bold text-[9px] flex items-center justify-center tracking-wider">
            VISA
          </div>
          <div className="pay-card-form__brand w-8 h-5 rounded bg-red-600 text-white font-bold text-[9px] flex items-center justify-center tracking-wider">
            MC
          </div>
          <div className="pay-card-form__brand w-8 h-5 rounded bg-blue-500 text-white font-bold text-[9px] flex items-center justify-center tracking-wider">
            AMEX
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-xs font-bold text-brand-danger bg-brand-danger-soft p-2.5 rounded border border-brand-danger/20" data-testid="payment-error">
          {error}
        </div>
      )}

      <div className="form-row mb-4">
        <label className="form-row__label block text-xs font-semibold text-brand-text mb-1.5">
          Card number
        </label>
        <input
          type="text"
          value={cardNumber}
          onChange={handleCardNumberChange}
          placeholder="4242 4242 4242 4242"
          maxLength={19}
          className="form-row__input w-full bg-brand-card border border-brand-border rounded-lg p-2.5 text-[13.5px] focus:outline-none focus:border-brand-primary font-mono"
          data-testid="card-number-input"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="form-row">
          <label className="form-row__label block text-xs font-semibold text-brand-text mb-1.5">
            Expiry
          </label>
          <input
            type="text"
            value={expiry}
            onChange={handleExpiryChange}
            placeholder="MM / YY"
            maxLength={5}
            className="form-row__input w-full bg-brand-card border border-brand-border rounded-lg p-2.5 text-[13.5px] focus:outline-none focus:border-brand-primary font-mono"
            data-testid="expiry-input"
            required
          />
        </div>
        <div className="form-row">
          <label className="form-row__label block text-xs font-semibold text-brand-text mb-1.5">
            CVC
          </label>
          <input
            type="password"
            value={cvc}
            onChange={handleCvcChange}
            placeholder="123"
            maxLength={4}
            className="form-row__input w-full bg-brand-card border border-brand-border rounded-lg p-2.5 text-[13.5px] focus:outline-none focus:border-brand-primary font-mono"
            data-testid="cvc-input"
            required
          />
        </div>
      </div>

      <div className="form-row mb-5">
        <label className="form-row__label block text-xs font-semibold text-brand-text mb-1.5">
          Name on card
        </label>
        <input
          type="text"
          value={nameOnCard}
          onChange={handleNameChange}
          placeholder="e.g. Liam Smith"
          className="form-row__input w-full bg-brand-card border border-brand-border rounded-lg p-2.5 text-[13.5px] focus:outline-none focus:border-brand-primary"
          data-testid="name-on-card-input"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="cta-btn cta-btn--full cta-btn--lock w-full bg-brand-primary text-white font-bold text-sm py-3 px-6 rounded hover:bg-brand-primary-hover transition flex items-center justify-center gap-2"
        data-testid="pay-submit-btn"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Processing...
          </>
        ) : (
          ctaLabel
        )}
      </button>

      <div className="trust-strip flex justify-center gap-x-4 gap-y-1 text-[11px] text-brand-muted mt-4 flex-wrap">
        <span>🔒 Secure payment via Stripe</span>
        <span>·</span>
        <span>{refundTerms}</span>
        <span>·</span>
        <span>H4 timber · council-compliant</span>
      </div>
    </form>
  );
}

