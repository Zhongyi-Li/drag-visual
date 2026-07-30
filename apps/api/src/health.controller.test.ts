import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";

import { AppModule } from "./app.module.js";
import { DatasetService } from "./datasets/dataset.service.js";

describe("HealthController", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("reports that the API is healthy", async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("resolves all dataset repositories from the application module", async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const datasets = module.get(DatasetService);

    await expect(datasets.list()).resolves.toEqual([
      {
        id: "retail-delivery-orders",
        name: "零售发货单（业务表）",
        schemaVersion: "retail-delivery-orders-v2",
      },
    ]);

    await module.close();
  });
});
