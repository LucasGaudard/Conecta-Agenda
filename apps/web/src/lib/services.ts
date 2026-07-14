import type {
  CreateServiceRequest,
  ServiceResponse,
  ServicesResponse,
  ServicesStatusFilter,
  UpdateServiceRequest,
} from "@conecta-agenda/types";

import { apiFetch } from "./api";

type GetServicesParams = {
  status?: ServicesStatusFilter;
  search?: string;
};

function buildServicesQuery(params?: GetServicesParams) {
  const searchParams = new URLSearchParams();

  if (params?.status) {
    searchParams.set("status", params.status);
  }

  if (params?.search) {
    searchParams.set("search", params.search);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getServices(token: string, params?: GetServicesParams) {
  return apiFetch<ServicesResponse>(`/services${buildServicesQuery(params)}`, {
    token,
  });
}

export function createService(token: string, payload: CreateServiceRequest) {
  return apiFetch<ServiceResponse>("/services", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function updateService(token: string, id: string, payload: UpdateServiceRequest) {
  return apiFetch<ServiceResponse>(`/services/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export function updateServiceStatus(token: string, id: string, isActive: boolean) {
  return apiFetch<ServiceResponse>(`/services/${id}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ isActive }),
  });
}

export function deleteService(token: string, id: string) {
  return apiFetch<{ message: string }>(`/services/${id}`, {
    method: "DELETE",
    token,
  });
}
