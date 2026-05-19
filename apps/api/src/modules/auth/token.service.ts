import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";

export type AccessTokenPayload = {
  email: string;
  sessionId: string;
  userId: string;
};

type JwtPayload = {
  email: string;
  sid: string;
  sub: string;
};

@Injectable()
export class TokenService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService
  ) {}

  signAccessToken(payload: AccessTokenPayload): Promise<string> {
    const expiresIn = this.configService.getOrThrow<string>("JWT_ACCESS_EXPIRES_IN") as JwtSignOptions["expiresIn"];

    return this.jwtService.signAsync(
      {
        email: payload.email,
        sid: payload.sessionId,
        sub: payload.userId
      },
      {
        expiresIn,
        secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET")
      }
    );
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET")
      });

      return {
        email: payload.email,
        sessionId: payload.sid,
        userId: payload.sub
      };
    } catch {
      throw new UnauthorizedException("Invalid bearer token");
    }
  }
}
