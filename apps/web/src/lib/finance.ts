import type { FinanceSummaryResponse } from "@conecta-agenda/types";

import { apiFetch } from "./api";

export function getFinanceSummary(token: string, month?: string) {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return apiFetch<FinanceSummaryResponse>(`/finance/summary${query}`, { token });
}
