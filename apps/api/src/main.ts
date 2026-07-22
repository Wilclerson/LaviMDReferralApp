import "reflect-metadata";
import { Logger, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { loadEnv } from "./config/env";
import { buildComponentSchemas } from "./openapi/schemas";

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.setGlobalPrefix("api", { exclude: ["health/live", "health/ready"] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle("LaviMD Partner Network API")
    .setDescription(
      "Affiliate referral platform: partners, referrals, transactions, commissions, and the immutable audit trail.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const components = document.components ?? {};
  document.components = {
    ...components,
    schemas: {
      ...(components.schemas ?? {}),
      // Generated from the shared Zod contracts; shapes are plain JSON Schema.
      ...(buildComponentSchemas() as NonNullable<typeof components.schemas>),
    },
  };
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(env.PORT);
  new Logger("Bootstrap").log(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
}

void bootstrap();
