import type {
  AdminBusinessesResponse,
  AdminBusinessAccessResponse,
  AdminBusinessDetailsResponse,
  AdminOverviewResponse,
  CreateAdminBusinessRequest,
  UpdateBusinessAccessRequest,
} from "@conecta-agenda/types";

import { apiFetch } from "./api";

type GetAdminBusinessesParams = {
  search?: string;
  accessStatus?: string;
  subscriptionStatus?: string;
  page?: number;
  pageSize?: number;
};

function buildQuery(params?: GetAdminBusinessesParams) {
  const searchParams = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getAdminOverview(token: string) {
  return apiFetch<AdminOverviewResponse>("/admin/overview", { token });
}

export function getAdminBusinesses(token: string, params?: GetAdminBusinessesParams) {
  return apiFetch<AdminBusinessesResponse>(`/admin/businesses${buildQuery(params)}`, {
    token,
  });
}

export function getAdminBusiness(token: string, id: string) {
  return apiFetch<AdminBusinessDetailsResponse>(`/admin/businesses/${id}`, {
    token,
  });
}

export function updateAdminBusinessAccess(
  token: string,
  id: string,
  payload: UpdateBusinessAccessRequest,
) {
  return apiFetch<AdminBusinessAccessResponse>(`/admin/businesses/${id}/access`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export function createAdminBusiness(token: string, payload: CreateAdminBusinessRequest) {
  return apiFetch<AdminBusinessDetailsResponse & { message: string }>("/admin/businesses", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}
