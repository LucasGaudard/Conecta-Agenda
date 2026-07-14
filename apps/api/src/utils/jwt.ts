import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "../env";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export type AuthTokenPayload = {
  userId: string;
  businessId: string;
};

type JwtPayload = AuthTokenPayload & {
  exp: number;
  iat: number;
};

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function signContent(content: string) {
  return base64UrlEncode(createHmac("sha256", env.JWT_SECRET).update(content).digest());
}

export function signAuthToken(payload: AuthTokenPayload) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    }),
  );
  const content = `${header}.${body}`;

  return `${content}.${signContent(content)}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const [header, body, signature] = token.split(".");

  if (!header || !body || !signature) {
    throw new Error("Invalid token.");
  }

  const expectedSignature = signContent(`${header}.${body}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    throw new Error("Invalid token signature.");
  }

  const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload;

  if (
    !payload.userId ||
    !payload.businessId ||
    payload.exp < Math.floor(Date.now() / 1000)
  ) {
    throw new Error("Invalid token payload.");
  }

  return {
    userId: payload.userId,
    businessId: payload.businessId,
  };
}
