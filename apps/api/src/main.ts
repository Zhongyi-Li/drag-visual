import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module.js";
import {
  dashboardErrorEnvelopeHook,
  safeJsonFastifyOptions,
} from "./fastify-options.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ ...safeJsonFastifyOptions, logger: true }),
  );
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onSend", dashboardErrorEnvelopeHook as never);
  const openApiConfig = new DocumentBuilder().setTitle("Drag Visual API").setVersion("1.0").build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);

  SwaggerModule.setup("openapi", app, openApiDocument);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
