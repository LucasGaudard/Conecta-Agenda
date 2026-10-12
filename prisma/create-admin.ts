import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../apps/api/src/load-env";
import { provisionAdmin, validateAdminEnvironment } from "./admin-provisioning";

async function main() {
  loadLocalEnv();
  validateAdminEnvironment(process.env);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL obrigatória.");
  const prisma = new PrismaClient({ log: [] });
  try {
    await provisionAdmin(
      process.env,
      {
        findExisting: async (email) =>
          Boolean(
            await prisma.user.findFirst({
              where: { email: { equals: email, mode: "insensitive" } },
              select: { id: true },
            }),
          ),
        create: async (data) => {
          await prisma.user.create({ data });
        },
      },
      (password) => bcrypt.hash(password, 12),
    );
    console.log("Administrador criado. Nenhum negócio foi criado.");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  // Never serialize Prisma errors or configuration/credentials.
  console.error(
    "Provisionamento recusado ou indisponível. Verifique variáveis, banco e possível e-mail existente; nenhuma conta existente é atualizada.",
  );
  process.exitCode = 1;
});
