import type {
  BusinessProfileResponse,
  UpdateBusinessProfileRequest,
} from "@conecta-agenda/types";

import { apiFetch } from "./api";

export function getBusinessProfile(token: string) {
  return apiFetch<BusinessProfileResponse>("/business/me", {
    token,
  });
}

export function updateBusinessProfile(
  token: string,
  payload: UpdateBusinessProfileRequest,
) {
  return apiFetch<BusinessProfileResponse>("/business/me", {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}
