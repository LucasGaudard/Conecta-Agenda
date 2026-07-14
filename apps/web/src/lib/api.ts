const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

type ApiFetchOptions = RequestInit & {
  token?: string | null;
};

type ApiErrorResponse = {
  message?: string;
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
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<TResponse>(
  path: string,
  { token, headers, ...options }: ApiFetchOptions = {},
) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const contentType = response.headers.get("content-type");
  const data = contentType?.includes("application/json")
    ? ((await response.json()) as TResponse | ApiErrorResponse)
    : null;

  if (!response.ok) {
    throw new ApiError(getErrorMessage(data), response.status);
  }

  return data as TResponse;
}
