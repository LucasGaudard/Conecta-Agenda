import { buildApp } from "./app";
import { env } from "./env";

const app = buildApp();

async function start() {
  try {
    await app.listen({
      port: env.API_PORT,
      host: env.HOST,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
