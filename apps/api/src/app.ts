import cors from "@fastify/cors";
import Fastify from "fastify";

import { env } from "./env";
import { appointmentsRoutes } from "./routes/appointments";
import { authRoutes } from "./routes/auth";
import { blockedTimesRoutes } from "./routes/blocked-times";
import { businessRoutes } from "./routes/business";
import { customersRoutes } from "./routes/customers";
import { dashboardRoutes } from "./routes/dashboard";
import { financeRoutes } from "./routes/finance";
import { healthRoutes } from "./routes/health";
import { onboardingRoutes } from "./routes/onboarding";
import { publicRoutes } from "./routes/public";
import { servicesRoutes } from "./routes/services";
import { workingHoursRoutes } from "./routes/working-hours";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
  });

  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(dashboardRoutes);
  app.register(financeRoutes);
  app.register(businessRoutes);
  app.register(onboardingRoutes);
  app.register(servicesRoutes);
  app.register(workingHoursRoutes);
  app.register(blockedTimesRoutes);
  app.register(customersRoutes);
  app.register(appointmentsRoutes);
  app.register(publicRoutes);

  return app;
}
