import type {
  AppointmentResponse,
  AppointmentsResponse,
  AppointmentStatus,
  AvailableTimesResponse,
  CreateAppointmentRequest,
  RescheduleAppointmentRequest,
} from "@conecta-agenda/types";

import { apiFetch } from "./api";

type GetAppointmentsParams = {
  date?: string;
  from?: string;
  to?: string;
  status?: AppointmentStatus;
};

type GetAppointmentAvailableTimesParams = {
  serviceId: string;
  date: string;
  ignoreAppointmentId?: string;
};

function buildQuery(params?: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getAppointments(token: string, params?: GetAppointmentsParams) {
  return apiFetch<AppointmentsResponse>(`/appointments${buildQuery(params)}`, {
    token,
  });
}

export function getAppointment(token: string, id: string) {
  return apiFetch<AppointmentResponse>(`/appointments/${id}`, {
    token,
  });
}

export function getAppointmentAvailableTimes(
  token: string,
  params: GetAppointmentAvailableTimesParams,
) {
  return apiFetch<AvailableTimesResponse>(`/appointments/available-times${buildQuery(params)}`, {
    token,
  });
}

export function createAppointment(token: string, payload: CreateAppointmentRequest) {
  return apiFetch<AppointmentResponse>("/appointments", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function updateAppointmentStatus(token: string, id: string, status: AppointmentStatus) {
  return apiFetch<AppointmentResponse>(`/appointments/${id}/status`, {
    method: "PUT",
    token,
    body: JSON.stringify({ status }),
  });
}

export function rescheduleAppointment(
  token: string,
  id: string,
  payload: RescheduleAppointmentRequest,
) {
  return apiFetch<AppointmentResponse>(`/appointments/${id}/reschedule`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export function cancelAppointment(token: string, id: string) {
  return apiFetch<AppointmentResponse>(`/appointments/${id}`, {
    method: "DELETE",
    token,
  });
}
