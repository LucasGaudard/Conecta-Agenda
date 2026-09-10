import { env } from "../env";
import { hashPassword } from "../utils/password";
import {
  UnconfiguredEmailProvider,
  type EmailProvider,
} from "../notifications/email-provider";
import { passwordResetRepository, type PasswordResetRepository } from "./repository";
import { generateResetToken, hashResetToken } from "./token";

export class PasswordResetService {
  constructor(
    private readonly repository: PasswordResetRepository = passwordResetRepository,
    private readonly email: EmailProvider = new UnconfiguredEmailProvider(),
  ) {}

  async request(email: string) {
    const { token, tokenHash } = generateResetToken();
    const user = await this.repository.findUser(email);
    if (!user) return;
    const now = new Date();
    await this.repository.issue({
      userId: user.id,
      tokenHash,
      now,
      expiresAt: new Date(now.getTime() + env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60000),
    });
    // Use trusted server configuration, never Host or a caller-supplied redirect URL.
    const resetUrl = new URL("/reset-password", env.FRONTEND_URL);
    resetUrl.searchParams.set("token", token);
    await this.email.sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetUrl: resetUrl.href,
    });
  }

  async reset(token: string, password: string) {
    const passwordHash = await hashPassword(password);
    return this.repository.consume({ tokenHash: hashResetToken(token), passwordHash });
  }
}
