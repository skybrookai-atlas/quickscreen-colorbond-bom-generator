import { useState } from "react";

export interface StripePaymentInput {
  cardNumber: string;
  expiry: string;
  cvc: string;
  nameOnCard: string;
  amount: number;
}

export function useStripePayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processPayment = async (input: StripePaymentInput): Promise<boolean> => {
    // Basic validation
    if (!input.cardNumber || input.cardNumber.replace(/\s/g, "").length < 16) {
      setError("Please enter a valid 16-digit card number.");
      return false;
    }
    if (!input.expiry || !/^\d{2}\/\d{2}$/.test(input.expiry)) {
      setError("Please enter a valid expiry date (MM/YY).");
      return false;
    }
    if (!input.cvc || input.cvc.length < 3) {
      setError("Please enter a valid CVC code.");
      return false;
    }
    if (!input.nameOnCard.trim()) {
      setError("Please enter the name on the card.");
      return false;
    }

    setLoading(true);
    setError(null);

    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        setLoading(false);
        // Simple test logic: card ending in 4242 succeeds
        const cleanCard = input.cardNumber.replace(/\s/g, "");
        if (cleanCard.endsWith("4242") || cleanCard === "4242424242424242" || cleanCard.startsWith("4")) {
          resolve(true);
        } else {
          setError("Your card was declined. Use a Stripe test card (e.g. 4242 4242...).");
          resolve(false);
        }
      }, 1500);
    });
  };

  return {
    processPayment,
    loading,
    error,
    clearError: () => setError(null),
  };
}
