import multipart from "@fastify/multipart";
import { Dataset, DatasetQueryResult } from "@drag-visual/contracts";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";

import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { safeJsonFastifyOptions } from "../fastify-options.js";
import { DatasetUploadController } from "./dataset-upload.controller.js";
import {
  DatasetUploadService,
  MAX_UPLOADED_DATASET_FILE_SIZE,
} from "./dataset-upload.service.js";
import {
  UploadedDatasetRepository,
  type CreateUploadedDatasetInput,
} from "./uploaded-dataset.repository.js";

const schema = Dataset.parse({
  id: "local-test",
  name: "销售导入",
  fields: [
    { key: "businessDate", label: "业务日期", type: "date", nullable: false },
    { key: "revenue", label: "收入", type: "number", nullable: false },
  ],
  parameters: [],
  schemaVersion: "file-test",
});

const result = DatasetQueryResult.parse({
  columns: schema.fields,
  rows: [{ businessDate: "2026-07-21", revenue: 120_000 }],
  total: 1,
  sampledAt: "2026-07-21T00:00:00.000Z",
});

const multipartPayload = (values: {
  file?: Buffer;
  filename?: string;
  schema?: string;
  result?: string;
}) => {
  const boundary = "----dragVisualUploadBoundary";
  const fields = [
    ["schema", values.schema ?? JSON.stringify(schema)],
    ["result", values.result ?? JSON.stringify(result)],
  ].map(([name, value]) => Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
  ));
  const file = values.file === undefined ? [] : [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${values.filename ?? "销售.csv"}"\r\nContent-Type: text/csv\r\n\r\n`),
    values.file,
    Buffer.from("\r\n"),
  ];
  return {
    boundary,
    payload: Buffer.concat([...fields, ...file, Buffer.from(`--${boundary}--\r\n`)]),
  };
};

describe("DatasetUploadController", () => {
  let app: NestFastifyApplication | undefined;
  let created: CreateUploadedDatasetInput | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    created = undefined;
  });

  const bootstrap = async () => {
    const repository = {
      create: async (input: CreateUploadedDatasetInput) => {
        created = input;
        return { dataset: input.schema, result: input.result };
      },
    };
    const module = await Test.createTestingModule({
      controllers: [DatasetUploadController],
      providers: [
        DatasetUploadService,
        { provide: UploadedDatasetRepository, useValue: repository },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { authUser?: unknown } } }) => {
          context.switchToHttp().getRequest().authUser = {
            id: "owner-a",
            username: "owner",
            displayName: null,
            avatarUrl: null,
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(safeJsonFastifyOptions),
    );
    await app.getHttpAdapter().getInstance().register(multipart as never, {
      limits: { fileSize: MAX_UPLOADED_DATASET_FILE_SIZE, files: 1, fields: 2, parts: 3 },
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  };

  it("stores an uploaded dataset under the authenticated user", async () => {
    await bootstrap();
    const body = multipartPayload({ file: Buffer.from("业务日期,收入\n2026-07-21,120000") });

    const response = await app!.inject({
      method: "POST",
      url: "/datasets/uploads",
      headers: { "content-type": `multipart/form-data; boundary=${body.boundary}` },
      payload: body.payload,
    });

    expect(response.statusCode).toBe(201);
    expect(created).toMatchObject({
      ownerId: "owner-a",
      name: "销售导入",
      originalName: "销售.csv",
      contentType: "text/csv",
    });
    expect(created?.id).toMatch(/^uploaded-/);
    expect(created?.fileContent.toString()).toContain("2026-07-21,120000");
    expect(response.json().dataset.id).toBe(created?.id);
  });

  it("rejects an unsupported uploaded file", async () => {
    await bootstrap();
    const body = multipartPayload({ file: Buffer.from("not a spreadsheet"), filename: "销售.txt" });

    const response = await app!.inject({
      method: "POST",
      url: "/datasets/uploads",
      headers: { "content-type": `multipart/form-data; boundary=${body.boundary}` },
      payload: body.payload,
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toEqual({
      code: "DATASET_FILE_TYPE_UNSUPPORTED",
      message: "当前仅支持上传 CSV 或 XLSX 文件",
    });
    expect(created).toBeUndefined();
  });

  it("rejects files over 5MB", async () => {
    await bootstrap();
    const body = multipartPayload({ file: Buffer.alloc(MAX_UPLOADED_DATASET_FILE_SIZE + 1) });

    const response = await app!.inject({
      method: "POST",
      url: "/datasets/uploads",
      headers: { "content-type": `multipart/form-data; boundary=${body.boundary}` },
      payload: body.payload,
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      code: "DATASET_FILE_TOO_LARGE",
      message: "文件不能超过 5MB",
    });
    expect(created).toBeUndefined();
  });

  it("rejects metadata that does not match the parsed dataset", async () => {
    await bootstrap();
    const body = multipartPayload({
      file: Buffer.from("业务日期,收入\n2026-07-21,120000"),
      result: JSON.stringify({ ...result, columns: [] }),
    });

    const response = await app!.inject({
      method: "POST",
      url: "/datasets/uploads",
      headers: { "content-type": `multipart/form-data; boundary=${body.boundary}` },
      payload: body.payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "DATASET_UPLOAD_INVALID",
      message: "上传数据集参数无效",
    });
    expect(created).toBeUndefined();
  });
});
