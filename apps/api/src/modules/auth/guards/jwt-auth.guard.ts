import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthenticatedRequest } from "../../../common/auth/authenticated-request";
import { PrismaService } from "../../../prisma/prisma.service";
import { TokenService } from "../token.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers?.authorization);

    if (token === undefined) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const payload = await this.tokenService.verifyAccessToken(token);
    const session = await this.prisma.session.findFirst({
      include: {
        user: true
      },
      where: {
        expiresAt: {
          gt: new Date()
        },
        id: payload.sessionId,
        revokedAt: null,
        userId: payload.userId,
        user: {
          deletedAt: null,
          status: "active"
        }
      }
    });

    if (session === null) {
      throw new UnauthorizedException("Invalid session");
    }

    request.user = {
      email: session.user.email,
      sessionId: session.id,
      userId: session.userId
    };

    return true;
  }

  private extractBearerToken(authorization: string | string[] | undefined): string | undefined {
    const header = Array.isArray(authorization) ? authorization[0] : authorization;

    if (header === undefined || !header.startsWith("Bearer ")) {
      return undefined;
    }

    return header.slice("Bearer ".length).trim();
  }
}
