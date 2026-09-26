import { env } from "./config/env.js";
import app from "./app.js";
import { prisma } from "./prisma/client.js";
import { logger } from "./config/logger.js";
import { startWebhookRetryWorker } from "./workers/webhookRetryWorker.js";

const PORT = env.PORT;

async function main() {
  await prisma.$connect();
  logger.info("Database connected");

  // Start background webhook retry worker
  const stopRetryWorker = startWebhookRetryWorker();

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, env: env.NODE_ENV }, "Server running");
    logger.info(`Swagger UI: http://localhost:${PORT}/api-docs`);
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, "Shutting down gracefully...");
    stopRetryWorker();
    server.close(async () => {
      await prisma.$disconnect();
      logger.info("Database disconnected");
      process.exit(0);
    });
    setTimeout(() => { logger.error("Forced shutdown after timeout"); process.exit(1); }, 10_000);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT",  () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
