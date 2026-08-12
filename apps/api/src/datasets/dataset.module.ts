import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { DatasetController } from "./dataset.controller.js";
import { DatasetUploadController } from "./dataset-upload.controller.js";
import { DatasetUploadService } from "./dataset-upload.service.js";
import { DatasetCatalogRepository } from "./dataset-catalog.repository.js";
import { DATASET_REPOSITORY } from "./dataset.repository.js";
import { RetailOrderDatasetRepository, StorageTurnoverDatasetRepository } from "./retail-order-dataset.repository.js";
import { DatasetService } from "./dataset.service.js";
import { UploadedDatasetRepository } from "./uploaded-dataset.repository.js";

@Module({
  imports: [AuthModule],
  controllers: [DatasetController, DatasetUploadController],
  providers: [
    PrismaService,
    RetailOrderDatasetRepository,
    StorageTurnoverDatasetRepository,
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
