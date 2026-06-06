import { useQuote } from './useQuote';

export function useQuoteForBooking(quoteId: string | undefined) {
  const queryResult = useQuote(quoteId);
  return {
    quote: queryResult.data?.quote,
    payload: queryResult.data?.payload,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
  };
}
