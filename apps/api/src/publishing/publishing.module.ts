import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";
import { PrismaPublishingRepository } from "./prisma-publishing.repository.js";
import { PublishingController } from "./publishing.controller.js";
import { PUBLISHING_REPOSITORY } from "./publishing.repository.js";
import { PublishingService } from "./publishing.service.js";

@Module({
  controllers: [PublishingController],
  providers: [
    PrismaService,
    PrismaPublishingRepository,
    PublishingService,
    {
      provide: PUBLISHING_REPOSITORY,
      useExisting: PrismaPublishingRepository,
    },
  ],
})
export class PublishingModule {}
