import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";

const saltRounds = 12;

@Injectable()
export class PasswordService {
  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, saltRounds);
  }

  hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, saltRounds);
  }

  verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  verifyToken(token: string, tokenHash: string): Promise<boolean> {
    return bcrypt.compare(token, tokenHash);
  }
}
