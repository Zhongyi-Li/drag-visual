import type { Dashboard } from "@drag-visual/contracts";
import { describe, expect, it, vi } from "vitest";

import { PrismaPublishingRepository } from "./prisma-publishing.repository.js";

const dashboard = (overrides: Partial<Dashboard> = {}): Dashboard => ({
  schemaVersion: 1,
  id: "645615f9-cddb-468e-a11d-91b477a4e2ac",
  name: "销售看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [],
  components: [],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-04T08:00:00.000Z",
  ...overrides,
});

const createRepository = () => {
  const transactionRecord = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const dashboardRecord = {
    findUnique: vi.fn(),
  };
  const prisma = {
    dashboardRecord,
    $transaction: vi.fn(async (callback: (transaction: { dashboardRecord: typeof transactionRecord }) => Promise<void>) =>
      callback({ dashboardRecord: transactionRecord }),
    ),
  };
  return {
    dashboardRecord,
    transactionRecord,
    prisma,
    repository: new PrismaPublishingRepository(prisma as never),
  };
};

describe("PrismaPublishingRepository", () => {
  it("loads draft and published JSON separately", async () => {
    const { repository, dashboardRecord } = createRepository();
    dashboardRecord.findUnique
      .mockResolvedValueOnce({ draftSchema: dashboard() })
      .mockResolvedValueOnce({ publishedSchema: dashboard({ name: "发布快照" }) });

    await expect(repository.getDraft(dashboard().id)).resolves.toEqual(dashboard());
    await expect(repository.getPublished(dashboard().id)).resolves.toMatchObject({ name: "发布快照" });
    expect(dashboardRecord.findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: dashboard().id },
      select: { draftSchema: true },
    });
    expect(dashboardRecord.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: dashboard().id },
      select: { publishedSchema: true },
    });
  });

  it("replaces the published snapshot inside a transaction", async () => {
    const { repository, transactionRecord, prisma } = createRepository();
    transactionRecord.findUnique.mockResolvedValue({ id: dashboard().id });

    await repository.replacePublished(dashboard().id, dashboard({ name: "待发布" }));

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(transactionRecord.findUnique).toHaveBeenCalledWith({
      where: { id: dashboard().id },
      select: { id: true },
    });
    expect(transactionRecord.update).toHaveBeenCalledWith({
      where: { id: dashboard().id },
      data: { publishedSchema: dashboard({ name: "待发布" }) },
    });
  });

  it("publishes the currently stored draft inside one transaction", async () => {
    const { repository, transactionRecord, prisma } = createRepository();
    transactionRecord.findUnique.mockResolvedValue({ draftSchema: dashboard({ name: "事务内草稿" }) });

    await expect(repository.publishDraft(dashboard().id, (draft) => draft as Dashboard)).resolves.toMatchObject({ name: "事务内草稿" });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(transactionRecord.findUnique).toHaveBeenCalledWith({
      where: { id: dashboard().id },
      select: { draftSchema: true },
    });
    expect(transactionRecord.update).toHaveBeenCalledWith({
      where: { id: dashboard().id },
      data: { publishedSchema: dashboard({ name: "事务内草稿" }) },
    });
  });

  it("does not update when no draft exists during atomic publish", async () => {
    const { repository, transactionRecord } = createRepository();
    transactionRecord.findUnique.mockResolvedValue(null);

    await expect(repository.publishDraft(dashboard().id, (draft) => draft as Dashboard)).resolves.toBeNull();
    expect(transactionRecord.update).not.toHaveBeenCalled();
  });

  it("does not update when the dashboard disappears during publish", async () => {
    const { repository, transactionRecord } = createRepository();
    transactionRecord.findUnique.mockResolvedValue(null);

    await expect(repository.replacePublished(dashboard().id, dashboard())).rejects.toThrow("DASHBOARD_NOT_FOUND");
    expect(transactionRecord.update).not.toHaveBeenCalled();
  });
});
