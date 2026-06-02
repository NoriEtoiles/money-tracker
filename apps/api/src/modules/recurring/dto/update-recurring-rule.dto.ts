import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { recurringFrequencies, RecurringFrequency } from "./recurring-frequency";
import { RecurringTemplateDto } from "./recurring-template.dto";

export class UpdateRecurringRuleDto {
  @IsDateString()
  @IsOptional()
  endAt?: string | null;

  @IsIn(recurringFrequencies)
  @IsOptional()
  frequency?: RecurringFrequency;

  @IsInt()
  @IsOptional()
  @Min(1)
  intervalCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @MinLength(1)
  name?: string;

  @IsDateString()
  @IsOptional()
  startAt?: string;

  @IsOptional()
  @Type(() => RecurringTemplateDto)
  @ValidateNested()
  template?: RecurringTemplateDto;
}
