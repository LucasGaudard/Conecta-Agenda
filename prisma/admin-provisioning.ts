import { UserRole } from "@prisma/client";

type AdminEnvironment = Partial<
  Record<"SUPER_ADMIN_NAME" | "SUPER_ADMIN_EMAIL" | "SUPER_ADMIN_PASSWORD", string>
>;
type AdminData = {
  name: string;
  email: string;
  passwordHash: string;
  role: typeof UserRole.SUPER_ADMIN;
};
type AdminStore = {
  findExisting(email: string): Promise<boolean>;
  create(data: AdminData): Promise<void>;
};

export function validateAdminEnvironment(source: AdminEnvironment) {
  const name = source.SUPER_ADMIN_NAME?.trim();
  const email = source.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = source.SUPER_ADMIN_PASSWORD;
  if (!name || !email || !password)
    throw new Error("Defina as três variáveis SUPER_ADMIN antes de provisionar.");
  if (
    name.length > 200 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254
  ) {
    throw new Error("Nome ou e-mail de administrador inválido.");
  }
  if (
    password.length < 12 ||
    Buffer.byteLength(password, "utf8") > 72 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^a-zA-Z0-9\s]/.test(password)
  ) {
    throw new Error(
      "Senha deve ter ao menos 12 caracteres, maiúscula, minúscula, número e símbolo, e até 72 bytes UTF-8.",
    );
  }
  return { name, email, password };
}

export async function provisionAdmin(
  source: AdminEnvironment,
  store: AdminStore,
  hash: (password: string) => Promise<string>,
) {
  const { name, email, password } = validateAdminEnvironment(source);
  if (await store.findExisting(email))
    throw new Error(
      "E-mail já cadastrado. Nenhuma conta foi alterada; revisão manual necessária.",
    );
  const passwordHash = await hash(password);
  // Create only: a concurrent duplicate must fail, never update an existing user.
  await store.create({ name, email, passwordHash, role: UserRole.SUPER_ADMIN });
}
