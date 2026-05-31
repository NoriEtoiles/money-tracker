import { IsOptional, IsString, Matches } from "class-validator";

export class NetWorthQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
}
