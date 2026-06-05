import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { PasswordService } from "../auth/password.service";
import { RequestAccountDeletionDto } from "./dto/request-account-deletion.dto";

const deletionConfirmationPhrase = "DELETE MY ACCOUNT";

export type AccountDeletionRequestResponse = {
  requestedAt: string;
  status: string;
};

export type AccountDeletionRequestStatusResponse = {
  request: AccountDeletionRequestResponse | null;
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService
  ) {}

  async getDeletionRequest(userId: string): Promise<AccountDeletionRequestStatusResponse> {
    const request = await this.findPendingDeletionRequest(userId);

    return {
      request: request === null ? null : this.toDeletionRequestResponse(request)
    };
  }

  async requestAccountDeletion(
    userId: string,
    dto: RequestAccountDeletionDto
  ): Promise<AccountDeletionRequestStatusResponse> {
    if (dto.confirmationPhrase !== deletionConfirmationPhrase) {
      throw new BadRequestException("Confirmation phrase is invalid");
    }

    await this.assertPasswordMatches(userId, dto.currentPassword);

    const existingRequest = await this.findPendingDeletionRequest(userId);

    if (existingRequest !== null) {
      return {
        request: this.toDeletionRequestResponse(existingRequest)
      };
    }

    try {
      const request = await this.prisma.accountDeletionRequest.create({
        data: {
          status: "pending",
          userId
        }
      });

      await this.auditService.record({
        entityId: request.id,
        entityType: "account_deletion_request",
        eventType: "delete_account_request",
        metadata: {
          status: request.status
        },
        userId
      });

      return {
        request: this.toDeletionRequestResponse(request)
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const request = await this.findPendingDeletionRequest(userId);

        return {
          request: request === null ? null : this.toDeletionRequestResponse(request)
        };
      }

      throw error;
    }
  }

  private async assertPasswordMatches(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      select: {
        passwordHash: true
      },
      where: {
        deletedAt: null,
        id: userId,
        status: "active"
      }
    });
    const passwordMatches = user?.passwordHash
      ? await this.passwordService.verifyPassword(password, user.passwordHash)
      : false;

    if (user === null || !passwordMatches) {
      throw new UnauthorizedException("Current password is invalid");
    }
  }

  private findPendingDeletionRequest(userId: string): Promise<{
    requestedAt: Date;
    status: string;
  } | null> {
    return this.prisma.accountDeletionRequest.findFirst({
      orderBy: [
        {
          requestedAt: "desc"
        },
        {
          id: "desc"
        }
      ],
      select: {
        requestedAt: true,
        status: true
      },
      where: {
        status: "pending",
        userId
      }
    });
  }

  private toDeletionRequestResponse(request: {
    requestedAt: Date;
    status: string;
  }): AccountDeletionRequestResponse {
    return {
      requestedAt: request.requestedAt.toISOString(),
      status: request.status
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
