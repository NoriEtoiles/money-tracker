import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
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
  constructor(private readonly prisma: PrismaService) {}

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
    const user = await this.prisma.user.update({
      data: {
        defaultCurrency: dto.defaultCurrency,
        displayName: dto.displayName?.trim(),
        locale: dto.locale,
        timezone: dto.timezone
      },
      where: {
        id: userId
      }
    });

    return {
      defaultCurrency: user.defaultCurrency,
      displayName: user.displayName,
      email: user.email,
      id: user.id,
      locale: user.locale,
      timezone: user.timezone
    };
  }
}
