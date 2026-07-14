import type {
  CreateCustomerRequest,
  CustomerResponse,
  CustomersResponse,
  UpdateCustomerRequest,
} from "@conecta-agenda/types";

import { apiFetch } from "./api";

type GetCustomersParams = {
  search?: string;
};

function buildCustomersQuery(params?: GetCustomersParams) {
  const searchParams = new URLSearchParams();

  if (params?.search) {
    searchParams.set("search", params.search);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getCustomers(token: string, params?: GetCustomersParams) {
  return apiFetch<CustomersResponse>(`/customers${buildCustomersQuery(params)}`, {
    token,
  });
}

export function getCustomer(token: string, id: string) {
  return apiFetch<CustomerResponse>(`/customers/${id}`, {
    token,
  });
}

export function createCustomer(token: string, payload: CreateCustomerRequest) {
  return apiFetch<CustomerResponse>("/customers", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function updateCustomer(token: string, id: string, payload: UpdateCustomerRequest) {
  return apiFetch<CustomerResponse>(`/customers/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}
