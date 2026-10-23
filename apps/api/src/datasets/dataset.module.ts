import { DatabaseDriver } from "./database-driver.js";
import { DatabaseDatasetRepository } from "./database-dataset.repository.js";
import { DatabaseDatasetController } from "./database-dataset.controller.js";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { DatasetController } from "./dataset.controller.js";
import { DatasetUploadController } from "./dataset-upload.controller.js";
import { DatasetUploadService } from "./dataset-upload.service.js";
import { DatasetCatalogRepository } from "./dataset-catalog.repository.js";
import { DATASET_REPOSITORY } from "./dataset.repository.js";
import {
  OrderProfitReportDatasetRepository,
  RetailOrderDatasetRepository,
  SgStorageDatasetRepository,
  StorageTurnoverDatasetRepository,
} from "./retail-order-dataset.repository.js";
import { DatasetService } from "./dataset.service.js";
import { UploadedDatasetRepository } from "./uploaded-dataset.repository.js";

@Module({
  imports: [AuthModule],
  controllers: [DatasetController, DatasetUploadController, DatabaseDatasetController],
  providers: [
    PrismaService,
    DatabaseDriver,
    DatabaseDatasetRepository,
    RetailOrderDatasetRepository,
    StorageTurnoverDatasetRepository,
    OrderProfitReportDatasetRepository,
    SgStorageDatasetRepository,
    UploadedDatasetRepository,
    DatasetCatalogRepository,
    DatasetService,
    DatasetUploadService,
    {
      provide: DATASET_REPOSITORY,
      useExisting: DatasetCatalogRepository,
    },
  ],
})
export class DatasetModule {}
