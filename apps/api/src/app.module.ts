import { Module } from "@nestjs/common";

import { HealthController } from "./health.controller.js";
import { DashboardModule } from "./dashboards/dashboard.module.js";

@Module({
  imports: [DashboardModule],
  controllers: [HealthController],
})
export class AppModule {}
