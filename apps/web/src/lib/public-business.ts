import type {
  AvailableTimesResponse,
  CreatePublicAppointmentRequest,
  PublicAppointmentResponse,
  PublicBusinessResponse,
  PublicServicesResponse,
} from "@conecta-agenda/types";

import { apiFetch } from "./api";

export function getPublicBusiness(slug: string) {
  return apiFetch<PublicBusinessResponse>(`/public/${slug}`);
}

export function getPublicServices(slug: string) {
  return apiFetch<PublicServicesResponse>(`/public/${slug}/services`);
}

export function getAvailableTimes(slug: string, serviceId: string, date: string) {
  const searchParams = new URLSearchParams({ serviceId, date });
  return apiFetch<AvailableTimesResponse>(
    `/public/${slug}/available-times?${searchParams.toString()}`,
  );
}

export function createPublicAppointment(slug: string, payload: CreatePublicAppointmentRequest) {
  return apiFetch<PublicAppointmentResponse>(`/public/${slug}/appointments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
