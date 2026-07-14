import { prisma } from "../lib/prisma";

export function generateSlug(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "agenda";
}

export async function generateUniqueBusinessSlug(name: string) {
  const baseSlug = generateSlug(name);
  let slug = baseSlug;
  let suffix = 1;

  while (await prisma.business.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  return slug;
}
