import { Module } from "@nestjs/common";

import { HealthController } from "./health.controller.js";
import { DashboardModule } from "./dashboards/dashboard.module.js";
import { DatasetModule } from "./datasets/dataset.module.js";
import { PublishingModule } from "./publishing/publishing.module.js";

@Module({
  imports: [DashboardModule, PublishingModule, DatasetModule],
  controllers: [HealthController],
})
export class AppModule {}
