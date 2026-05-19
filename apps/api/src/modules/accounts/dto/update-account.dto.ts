import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class UpdateAccountDto {
  @IsBoolean()
  @IsOptional()
  includeInNetWorth?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  institutionName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;
}
