import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DatasetController } from "./dataset.controller.js";
import { DatasetCatalogRepository } from "./dataset-catalog.repository.js";
import { DATASET_REPOSITORY } from "./dataset.repository.js";
import { RetailOrderDatasetRepository } from "./retail-order-dataset.repository.js";
import { DatasetService } from "./dataset.service.js";

@Module({
  imports: [AuthModule],
  controllers: [DatasetController],
  providers: [
    RetailOrderDatasetRepository,
    DatasetCatalogRepository,
    DatasetService,
    {
      provide: DATASET_REPOSITORY,
      useExisting: DatasetCatalogRepository,
    },
  ],
})
export class DatasetModule {}
