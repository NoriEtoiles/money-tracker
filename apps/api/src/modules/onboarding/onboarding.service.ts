import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CategoriesService, CategoryResponse } from "../categories/categories.service";

export type OnboardingDefaultDataResponse = {
  categories: CategoryResponse[];
  status: "ready";
};

@Injectable()
export class OnboardingService {
  constructor(
    private readonly auditService: AuditService,
    private readonly categoriesService: CategoriesService,
    private readonly prisma: PrismaService
  ) {}

  async seedDefaultData(userId: string): Promise<OnboardingDefaultDataResponse> {
    const categories = await this.categoriesService.seedDefaultCategories(userId);
    const seededAt = new Date().toISOString();

    await this.prisma.user.update({
      data: {
        onboardingState: {
          defaultCategoriesSeededAt: seededAt
        } satisfies Prisma.InputJsonObject
      },
      where: {
        id: userId
      }
    });
    await this.auditService.record({
      eventType: "onboarding_default_data_seeded",
      metadata: {
        categoryCount: categories.length
      },
      userId
    });

    return {
      categories,
      status: "ready"
    };
  }
}
