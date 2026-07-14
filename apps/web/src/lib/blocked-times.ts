import type {
  BlockedTimeResponse,
  BlockedTimesResponse,
  CreateBlockedTimeRequest,
} from "@conecta-agenda/types";

import { apiFetch } from "./api";

type GetBlockedTimesParams = {
  from?: string;
  to?: string;
};

function buildBlockedTimesQuery(params?: GetBlockedTimesParams) {
  const searchParams = new URLSearchParams();

  if (params?.from) {
    searchParams.set("from", params.from);
  }

  if (params?.to) {
    searchParams.set("to", params.to);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getBlockedTimes(token: string, params?: GetBlockedTimesParams) {
  return apiFetch<BlockedTimesResponse>(`/blocked-times${buildBlockedTimesQuery(params)}`, {
    token,
  });
}

export function createBlockedTime(token: string, payload: CreateBlockedTimeRequest) {
  return apiFetch<BlockedTimeResponse>("/blocked-times", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function deleteBlockedTime(token: string, id: string) {
  return apiFetch<{ message: string }>(`/blocked-times/${id}`, {
    method: "DELETE",
    token,
  });
}
