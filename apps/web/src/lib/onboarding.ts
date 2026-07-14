import type {
  BusinessProfileResponse,
  CompleteOnboardingRequest,
  OnboardingStatusResponse,
} from "@conecta-agenda/types";

import { apiFetch } from "./api";

export function getOnboardingStatus(token: string) {
  return apiFetch<OnboardingStatusResponse>("/onboarding/status", {
    token,
  });
}

export function completeOnboarding(token: string, payload: CompleteOnboardingRequest) {
  return apiFetch<BusinessProfileResponse>("/onboarding/complete", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}
