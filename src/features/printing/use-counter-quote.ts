"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { FinanceCurrency } from "@/features/finance/finance-rules";
import { COUNTER_PATHS, lineProblems, parseCounterQuote, quoteBody, type CounterLine, type CounterQuote } from "@/features/printing/counter-order-rules";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch, unwrap } from "@/lib/api/browser-client";

/** The live price of the lines from the shop's price list (debounced). Used by the counter form and the pricing simulator. */
export function useCounterQuote(lines: readonly CounterLine[], currency: FinanceCurrency) {
  const allValid = lines.length > 0 && lines.every((line) => Object.keys(lineProblems(line)).length === 0);
  const liveKey = allValid ? JSON.stringify(quoteBody(lines, currency)) : "";
  const settledKey = useDebouncedValue(liveKey, 350);
  const query = useQuery({
    queryKey: ["counter-quote", settledKey],
    enabled: settledKey !== "",
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<CounterQuote | null> => parseCounterQuote(await unwrap(apiFetch(COUNTER_PATHS.quote, { method: "POST", body: JSON.parse(settledKey) }))),
  });
  return {
    allValid,
    quote: allValid ? query.data ?? null : null,
    calculating: allValid && (settledKey !== liveKey || query.isFetching),
    isError: allValid && query.isError,
  };
}
