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

export class CreateRecurringRuleDto {
  @IsDateString()
  @IsOptional()
  endAt?: string;

  @IsIn(recurringFrequencies)
  frequency!: RecurringFrequency;

  @IsInt()
  @IsOptional()
  @Min(1)
  intervalCount?: number;

  @IsString()
  @MaxLength(120)
  @MinLength(1)
  name!: string;

  @IsDateString()
  startAt!: string;

  @Type(() => RecurringTemplateDto)
  @ValidateNested()
  template!: RecurringTemplateDto;
}
