import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { defaultCategories } from "./default-categories";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

export type CategoryResponse = {
  archivedAt: string | null;
  colorToken: string | null;
  iconToken: string | null;
  id: string;
  kind: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

export type CategoryListResponse = {
  items: CategoryResponse[];
};

@Injectable()
export class CategoriesService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async seedDefaultCategories(userId: string): Promise<CategoryResponse[]> {
    const existingCategories = await this.prisma.category.findMany({
      select: {
        kind: true,
        name: true
      },
      where: {
        deletedAt: null,
        parentId: null,
        userId
      }
    });
    const existingKeys = new Set(
      existingCategories.map((category) => this.toDefinitionKey(category))
    );
    const missingCategories = defaultCategories.filter(
      (category) => !existingKeys.has(this.toDefinitionKey(category))
    );

    if (missingCategories.length > 0) {
      await this.prisma.category.createMany({
        data: missingCategories.map((category) => ({
          colorToken: category.colorToken,
          iconToken: category.iconToken,
          kind: category.kind,
          name: category.name,
          sortOrder: category.sortOrder,
          userId
        }))
      });
    }

    return this.listCategories(userId);
  }

  async listCategoryResponse(userId: string): Promise<CategoryListResponse> {
    return {
      items: await this.listCategories(userId)
    };
  }

  async listCategories(userId: string): Promise<CategoryResponse[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: [
        {
          kind: "asc"
        },
        {
          sortOrder: "asc"
        },
        {
          name: "asc"
        }
      ],
      where: {
        archivedAt: null,
        deletedAt: null,
        userId
      }
    });

    return categories.map((category) => ({
      archivedAt: category.archivedAt?.toISOString() ?? null,
      colorToken: category.colorToken,
      iconToken: category.iconToken,
      id: category.id,
      kind: category.kind,
      name: category.name,
      parentId: category.parentId,
      sortOrder: category.sortOrder
    }));
  }

  async createCategory(userId: string, dto: CreateCategoryDto): Promise<CategoryResponse> {
    if (dto.parentId !== undefined) {
      await this.assertActiveCategory(userId, dto.parentId);
    }

    const category = await this.prisma.category.create({
      data: {
        colorToken: dto.colorToken?.trim(),
        iconToken: dto.iconToken?.trim(),
        kind: dto.kind,
        name: dto.name.trim(),
        parentId: dto.parentId,
        sortOrder: dto.sortOrder ?? 0,
        userId
      }
    });

    await this.auditService.record({
      entityId: category.id,
      entityType: "category",
      eventType: "category_create",
      userId
    });

    return this.toResponse(category);
  }

  async updateCategory(
    userId: string,
    categoryId: string,
    dto: UpdateCategoryDto
  ): Promise<CategoryResponse> {
    await this.assertActiveCategory(userId, categoryId);

    if (dto.parentId !== undefined) {
      await this.assertActiveCategory(userId, dto.parentId);
    }

    const category = await this.prisma.category.update({
      data: {
        colorToken: dto.colorToken?.trim(),
        iconToken: dto.iconToken?.trim(),
        name: dto.name?.trim(),
        parentId: dto.parentId,
        sortOrder: dto.sortOrder
      },
      where: {
        id: categoryId
      }
    });

    await this.auditService.record({
      entityId: category.id,
      entityType: "category",
      eventType: "category_update",
      userId
    });

    return this.toResponse(category);
  }

  async archiveCategory(
    userId: string,
    categoryId: string
  ): Promise<{ mode: "archived"; success: true }> {
    await this.assertActiveCategory(userId, categoryId);

    const category = await this.prisma.category.update({
      data: {
        archivedAt: new Date()
      },
      where: {
        id: categoryId
      }
    });

    await this.auditService.record({
      entityId: category.id,
      entityType: "category",
      eventType: "category_archive",
      userId
    });

    return {
      mode: "archived",
      success: true
    };
  }

  private async assertActiveCategory(userId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      select: {
        id: true
      },
      where: {
        archivedAt: null,
        deletedAt: null,
        id: categoryId,
        userId
      }
    });

    if (category === null) {
      throw new NotFoundException("Category not found");
    }
  }

  private toResponse(category: {
    archivedAt: Date | null;
    colorToken: string | null;
    iconToken: string | null;
    id: string;
    kind: string;
    name: string;
    parentId: string | null;
    sortOrder: number;
  }): CategoryResponse {
    return {
      archivedAt: category.archivedAt?.toISOString() ?? null,
      colorToken: category.colorToken,
      iconToken: category.iconToken,
      id: category.id,
      kind: category.kind,
      name: category.name,
      parentId: category.parentId,
      sortOrder: category.sortOrder
    };
  }

  private toDefinitionKey(category: { kind: string; name: string }): string {
    return `${category.kind}:${category.name.toLowerCase()}`;
  }
}
