import { IsOptional, IsString, Matches } from "class-validator";

export class ListBudgetsDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStart!: string;
}
