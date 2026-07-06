import { Module } from "@nestjs/common";

import { DatasetController } from "./dataset.controller.js";
import { DATASET_REPOSITORY } from "./dataset.repository.js";
import { DatasetService } from "./dataset.service.js";
import { FixtureDatasetRepository } from "./fixture-dataset.repository.js";

@Module({
  controllers: [DatasetController],
  providers: [
    FixtureDatasetRepository,
    DatasetService,
    {
      provide: DATASET_REPOSITORY,
      useExisting: FixtureDatasetRepository,
    },
  ],
})
export class DatasetModule {}
