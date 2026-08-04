const LOCAL_API_URL = "http://localhost:3333";
const LOCAL_APP_URL = "http://localhost:3000";

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function assertHttpUrl(value: string, envName: string) {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Invalid protocol.");
    }
  } catch {
    throw new Error(`Configuracao invalida: ${envName} deve ser uma URL http(s) absoluta.`);
  }
}

export function getApiBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (apiUrl) {
    assertHttpUrl(apiUrl, "NEXT_PUBLIC_API_URL");

    const normalizedApiUrl = normalizeUrl(apiUrl);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

    if (
      process.env.NODE_ENV === "production" &&
      appUrl &&
      normalizedApiUrl === normalizeUrl(appUrl)
    ) {
      throw new Error(
        "Configuracao invalida: NEXT_PUBLIC_API_URL deve apontar para a API, nao para o frontend.",
      );
    }

    return normalizedApiUrl;
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_API_URL;
  }

  throw new Error(
    "Configuracao ausente: defina NEXT_PUBLIC_API_URL com a URL da API publicada.",
  );
}

export function getPublicAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (appUrl) {
    assertHttpUrl(appUrl, "NEXT_PUBLIC_APP_URL");
    return normalizeUrl(appUrl);
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_APP_URL;
  }

  return "";
}
