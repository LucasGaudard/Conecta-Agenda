import { z } from "zod";

function normalizeOptionalText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  return value;
}

export const optionalNullableTextSchema = z.preprocess(
  normalizeOptionalText,
  z.string().nullable(),
);

export const optionalTrimmedTextSchema = z.preprocess((value) => {
  const normalizedValue = normalizeOptionalText(value);
  return normalizedValue === null ? undefined : normalizedValue;
}, z.string().optional());
