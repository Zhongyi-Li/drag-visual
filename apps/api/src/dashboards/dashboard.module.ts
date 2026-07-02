import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";
import { DashboardController } from "./dashboard.controller.js";
import { DASHBOARD_REPOSITORY } from "./dashboard.repository.js";
import { DashboardService } from "./dashboard.service.js";
import { PrismaDashboardRepository } from "./prisma-dashboard.repository.js";

@Module({
  controllers: [DashboardController],
  providers: [
    PrismaService,
    PrismaDashboardRepository,
    DashboardService,
    {
      provide: DASHBOARD_REPOSITORY,
      useExisting: PrismaDashboardRepository,
    },
  ],
})
export class DashboardModule {}
