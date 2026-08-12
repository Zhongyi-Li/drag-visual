import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";

import { AppModule } from "./app.module.js";
import {
  RetailOrderDatasetRepository,
  StorageTurnoverDatasetRepository,
} from "./datasets/retail-order-dataset.repository.js";
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

  it("initializes every dataset provider in the complete application module", async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const datasets = module.get(DatasetService);
    const retailOrders = module.get(RetailOrderDatasetRepository);
    const storageTurnover = module.get(StorageTurnoverDatasetRepository);

    expect(datasets).toBeInstanceOf(DatasetService);
    expect(retailOrders).toBeInstanceOf(RetailOrderDatasetRepository);
    expect(storageTurnover).toBeInstanceOf(StorageTurnoverDatasetRepository);

    await module.close();
  });
});
