import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ListTransfersDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsInt()
  @IsOptional()
  @Max(100)
  @Min(1)
  @Type(() => Number)
  limit?: number;
}
