import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from "class-validator";

export class CreateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  colorToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  iconToken?: string;

  @IsIn(["income", "expense"])
  kind!: "income" | "expense";

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;
}
