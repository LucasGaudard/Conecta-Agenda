import { getApiBaseUrl } from "./config";

type ApiFetchOptions = RequestInit & {
  token?: string | null;
};

type ApiErrorResponse = {
  message?: string;
  code?: string;
};

function getErrorMessage(data: unknown) {
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message;
  }

  return "Nao foi possivel concluir a solicitacao.";
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<TResponse>(
  path: string,
  { token, headers, ...options }: ApiFetchOptions = {},
) {
  const apiUrl = getApiBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name !== "TypeError") {
      throw error;
    }

    throw new Error(
      "Nao foi possivel conectar a API. Verifique sua conexao ou tente novamente.",
    );
  }

  const contentType = response.headers.get("content-type");
  const data = contentType?.includes("application/json")
    ? ((await response.json()) as TResponse | ApiErrorResponse)
    : null;

  if (!response.ok) {
    const code =
      data && typeof data === "object" && "code" in data && typeof data.code === "string"
        ? data.code
        : undefined;
    if (
      token &&
      (response.status === 402 || response.status === 403) &&
      code === "BUSINESS_ACCESS_BLOCKED" &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/billing-required"
    ) {
      window.location.replace("/billing-required");
    }
    throw new ApiError(getErrorMessage(data), response.status, code);
  }

  return data as TResponse;
}
