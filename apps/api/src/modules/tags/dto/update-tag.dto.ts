import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateTagDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  colorToken?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;
}
