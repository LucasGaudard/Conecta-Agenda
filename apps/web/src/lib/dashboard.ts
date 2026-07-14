import type { DashboardResponse } from "@conecta-agenda/types";

import { apiFetch } from "./api";

export function getDashboard(token: string) {
  return apiFetch<DashboardResponse>("/dashboard", {
    token,
  });
}
