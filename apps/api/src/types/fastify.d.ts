import "fastify";
import type { UserRole } from "@prisma/client";

declare module "fastify" {
  interface FastifyRequest {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      businessId: string;
    };
  }
}
