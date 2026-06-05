import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RequestAccountDeletionDto } from "./dto/request-account-deletion.dto";
import {
  AccountDeletionRequestStatusResponse,
  SettingsService
} from "./settings.service";

@Controller("me/deletion-request")
@UseGuards(JwtAuthGuard)
export class DeletionRequestsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<AccountDeletionRequestStatusResponse> {
    return this.settingsService.getDeletionRequest(user.userId);
  }

  @Post()
  request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestAccountDeletionDto
  ): Promise<AccountDeletionRequestStatusResponse> {
    return this.settingsService.requestAccountDeletion(user.userId, dto);
  }
}
