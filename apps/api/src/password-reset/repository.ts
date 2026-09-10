import { prisma } from "../lib/prisma";

export interface PasswordResetRepository {
  findUser(email: string): Promise<{ id: string; name: string; email: string } | null>;
  issue(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
  }): Promise<void>;
  consume(input: { tokenHash: string; passwordHash: string }): Promise<boolean>;
}

export const passwordResetRepository: PasswordResetRepository = {
  findUser(email) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });
  },
  async issue({ userId, tokenHash, expiresAt, now }) {
    await prisma.$transaction(async (tx) => {
      // Shared lock ordering for issuance and consumption serializes resets per user.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      });
      await tx.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
    });
  },
  async consume({ tokenHash, passwordHash }) {
    return prisma.$transaction(async (tx) => {
      const candidate = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { userId: true },
      });
      if (!candidate) return false;
      const users = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "User" WHERE "id" = ${candidate.userId} FOR UPDATE`;
      if (!users.length) return false;
      // Recheck after acquiring the lock, including expiry at consumption time.
      const now = new Date();
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          tokenHash,
          userId: candidate.userId,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) return false;
      await tx.user.update({ where: { id: candidate.userId }, data: { passwordHash } });
      await tx.passwordResetToken.updateMany({
        where: { userId: candidate.userId, usedAt: null },
        data: { usedAt: now },
      });
      return true;
    });
  },
};
