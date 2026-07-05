import { Module } from "@nestjs/common";

import { HealthController } from "./health.controller.js";
import { DashboardModule } from "./dashboards/dashboard.module.js";
import { PublishingModule } from "./publishing/publishing.module.js";

@Module({
  imports: [DashboardModule, PublishingModule],
  controllers: [HealthController],
})
export class AppModule {}
