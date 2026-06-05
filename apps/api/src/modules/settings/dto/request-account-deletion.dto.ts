import { IsString, MaxLength, MinLength } from "class-validator";

export class RequestAccountDeletionDto {
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  currentPassword!: string;

  @IsString()
  @MaxLength(64)
  confirmationPhrase!: string;
}
