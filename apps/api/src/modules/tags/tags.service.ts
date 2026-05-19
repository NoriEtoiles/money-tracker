import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateTagDto } from "./dto/create-tag.dto";
import { UpdateTagDto } from "./dto/update-tag.dto";

export type TagResponse = {
  colorToken: string | null;
  id: string;
  name: string;
};

export type TagListResponse = {
  items: TagResponse[];
};

@Injectable()
export class TagsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listTags(userId: string): Promise<TagListResponse> {
    const tags = await this.prisma.tag.findMany({
      orderBy: {
        name: "asc"
      },
      where: {
        userId
      }
    });

    return {
      items: tags.map((tag) => this.toResponse(tag))
    };
  }

  async createTag(userId: string, dto: CreateTagDto): Promise<TagResponse> {
    const tag = await this.prisma.tag.create({
      data: {
        colorToken: dto.colorToken?.trim(),
        name: dto.name.trim(),
        userId
      }
    });

    await this.auditService.record({
      entityId: tag.id,
      entityType: "tag",
      eventType: "tag_create",
      userId
    });

    return this.toResponse(tag);
  }

  async updateTag(userId: string, tagId: string, dto: UpdateTagDto): Promise<TagResponse> {
    await this.assertTag(userId, tagId);

    const tag = await this.prisma.tag.update({
      data: {
        colorToken: dto.colorToken?.trim(),
        name: dto.name?.trim()
      },
      where: {
        id: tagId
      }
    });

    await this.auditService.record({
      entityId: tag.id,
      entityType: "tag",
      eventType: "tag_update",
      userId
    });

    return this.toResponse(tag);
  }

  async deleteTag(userId: string, tagId: string): Promise<{ success: true }> {
    await this.assertTag(userId, tagId);
    const tag = await this.prisma.tag.delete({
      where: {
        id: tagId
      }
    });

    await this.auditService.record({
      entityId: tag.id,
      entityType: "tag",
      eventType: "tag_delete",
      userId
    });

    return { success: true };
  }

  private async assertTag(userId: string, tagId: string): Promise<void> {
    const tag = await this.prisma.tag.findFirst({
      select: {
        id: true
      },
      where: {
        id: tagId,
        userId
      }
    });

    if (tag === null) {
      throw new NotFoundException("Tag not found");
    }
  }

  private toResponse(tag: { colorToken: string | null; id: string; name: string }): TagResponse {
    return {
      colorToken: tag.colorToken,
      id: tag.id,
      name: tag.name
    };
  }
}
