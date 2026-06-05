import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

export type CurrentUserResponse = {
  defaultCurrency: string;
  displayName: string;
  email: string;
  id: string;
  locale: string;
  timezone: string;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async getCurrentUser(userId: string): Promise<CurrentUserResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        id: userId,
        status: "active"
      }
    });

    if (user === null) {
      throw new NotFoundException("User not found");
    }

    return {
      defaultCurrency: user.defaultCurrency,
      displayName: user.displayName,
      email: user.email,
      id: user.id,
      locale: user.locale,
      timezone: user.timezone
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<CurrentUserResponse> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        id: userId,
        status: "active"
      }
    });

    if (existingUser === null) {
      throw new NotFoundException("User not found");
    }

    const nextDisplayName = dto.displayName === undefined
      ? undefined
      : this.normalizeDisplayName(dto.displayName);
    const changedFields = [
      nextDisplayName !== undefined && nextDisplayName !== existingUser.displayName ? "displayName" : null,
      dto.defaultCurrency !== undefined && dto.defaultCurrency !== existingUser.defaultCurrency ? "defaultCurrency" : null,
      dto.locale !== undefined && dto.locale !== existingUser.locale ? "locale" : null,
      dto.timezone !== undefined && dto.timezone !== existingUser.timezone ? "timezone" : null
    ].filter((field): field is string => field !== null);

    const user = await this.prisma.user.update({
      data: {
        defaultCurrency: dto.defaultCurrency,
        displayName: nextDisplayName,
        locale: dto.locale,
        timezone: dto.timezone
      },
      where: {
        id: userId
      }
    });

    if (changedFields.length > 0) {
      await this.auditService.record({
        entityId: user.id,
        entityType: "user",
        eventType: "profile_update",
        metadata: {
          changedFields
        },
        userId
      });
    }

    return {
      defaultCurrency: user.defaultCurrency,
      displayName: user.displayName,
      email: user.email,
      id: user.id,
      locale: user.locale,
      timezone: user.timezone
    };
  }

  private normalizeDisplayName(displayName: string): string {
    const trimmed = displayName.trim();

    if (trimmed.length === 0) {
      throw new BadRequestException("Display name is required");
    }

    return trimmed;
  }
}
