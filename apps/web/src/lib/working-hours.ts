import type { UpdateWorkingHoursRequest, WorkingHoursResponse } from "@conecta-agenda/types";

import { apiFetch } from "./api";

export function getWorkingHours(token: string) {
  return apiFetch<WorkingHoursResponse>("/working-hours", { token });
}

export function updateWorkingHours(token: string, payload: UpdateWorkingHoursRequest) {
  return apiFetch<WorkingHoursResponse>("/working-hours", {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}
