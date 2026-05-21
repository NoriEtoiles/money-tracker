import { IsNumber, IsOptional, IsString, IsUUID, Matches, Max, Min } from "class-validator";
import { decimalAmountPattern } from "../../../common/validation/money";

export class CreateBudgetDto {
  @IsString()
  @Matches(decimalAmountPattern)
  amount!: string;

  @IsUUID()
  categoryId!: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStart!: string;

  @IsNumber({
    maxDecimalPlaces: 2
  })
  @IsOptional()
  @Min(1)
  @Max(100)
  thresholdPercentage?: number;
}
