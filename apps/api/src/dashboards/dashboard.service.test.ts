import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { InMemoryDashboardRepository } from "./dashboard.repository.js";
import {
  DashboardNotFoundError,
  DashboardService,
  RevisionConflictError,
} from "./dashboard.service.js";

const dashboard = (overrides: Partial<Dashboard> = {}): Dashboard => ({
  schemaVersion: 1,
  id: "645615f9-cddb-468e-a11d-91b477a4e2ac",
  name: "销售看板",
  theme: {
    primaryColor: "#1677ff",
    backgroundColor: "#f5f7fa",
  },
  layout: [],
  components: [],
  datasets: [],
  revision: 1,
  updatedAt: "2020-01-01T00:00:00.000Z",
  ...overrides,
});

describe("DashboardService", () => {
  it("creates and stores a valid empty dashboard", async () => {
    const repository = new InMemoryDashboardRepository();
    const service = new DashboardService(repository);

    const created = await service.create("  销售看板  ");

    expect(DashboardSchema.parse(created)).toEqual(created);
    expect(created).toMatchObject({
      schemaVersion: 1,
      name: "销售看板",
      theme: {
        primaryColor: "#1677ff",
        backgroundColor: "#f5f7fa",
      },
      layout: [],
      components: [],
      datasets: [],
      revision: 1,
    });
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(Number.isNaN(Date.parse(created.updatedAt))).toBe(false);
    await expect(repository.find(created.id)).resolves.toEqual(created);
  });

  it("uses the default name when the supplied name is blank", async () => {
    const service = new DashboardService(new InMemoryDashboardRepository());

    const created = await service.create("   ");

    expect(created.name).toBe("未命名看板");
  });

  it("rejects names longer than 100 characters", async () => {
    const service = new DashboardService(new InMemoryDashboardRepository());

    await expect(service.create("看".repeat(101))).rejects.toBeInstanceOf(ZodError);
  });

  it("gets an existing dashboard", async () => {
    const repository = new InMemoryDashboardRepository();
    await repository.create(dashboard());
    const service = new DashboardService(repository);

    await expect(service.get(dashboard().id)).resolves.toEqual(dashboard());
  });

  it("throws DashboardNotFoundError for a missing dashboard", async () => {
    const service = new DashboardService(new InMemoryDashboardRepository());

    await expect(service.get("missing")).rejects.toBeInstanceOf(
      DashboardNotFoundError,
    );
  });

  it("saves the current revision with exactly one revision increment", async () => {
    const repository = new InMemoryDashboardRepository();
    await repository.create(dashboard());
    const service = new DashboardService(repository);

    const saved = await service.save(dashboard({ name: "新名称" }));

    expect(saved.revision).toBe(2);
    expect(saved.name).toBe("新名称");
    expect(Date.parse(saved.updatedAt)).toBeGreaterThan(
      Date.parse(dashboard().updatedAt),
    );
    await expect(repository.find(saved.id)).resolves.toEqual(saved);
  });

  it("rejects a stale revision without overwriting the stored dashboard", async () => {
    const repository = new InMemoryDashboardRepository();
    const current = dashboard({ revision: 2, name: "服务端版本" });
    await repository.create(current);
    const service = new DashboardService(repository);

    await expect(
      service.save(dashboard({ revision: 1, name: "过期版本" })),
    ).rejects.toBeInstanceOf(RevisionConflictError);
    await expect(repository.find(current.id)).resolves.toEqual(current);
  });
});

describe("InMemoryDashboardRepository", () => {
  it("clones values at its storage boundary", async () => {
    const repository = new InMemoryDashboardRepository();
    const input = dashboard();

    const created = await repository.create(input);
    input.name = "修改输入";
    created.name = "修改返回值";
    const firstRead = await repository.find(input.id);
    expect(firstRead?.name).toBe("销售看板");

    if (firstRead) firstRead.name = "修改读取值";
    await expect(repository.find(input.id)).resolves.toMatchObject({
      name: "销售看板",
    });
  });
});
