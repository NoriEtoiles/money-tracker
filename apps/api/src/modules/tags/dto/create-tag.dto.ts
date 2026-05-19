import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateTagDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  colorToken?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}
