import { IsOptional, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  defaultCurrency?: string;

  @IsOptional()
  @IsString()
  @Length(2, 20)
  locale?: string;

  @IsOptional()
  @IsString()
  @Length(3, 80)
  timezone?: string;
}
