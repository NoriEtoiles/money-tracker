import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  AccountDeleteResponse,
  AccountListResponse,
  AccountResponse,
  AccountsService
} from "./accounts.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";

@Controller("accounts")
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<AccountListResponse> {
    return this.accountsService.listAccounts(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountDto
  ): Promise<AccountResponse> {
    return this.accountsService.createAccount(user.userId, dto);
  }

  @Patch(":accountId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("accountId") accountId: string,
    @Body() dto: UpdateAccountDto
  ): Promise<AccountResponse> {
    return this.accountsService.updateAccount(user.userId, accountId, dto);
  }

  @Delete(":accountId")
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("accountId") accountId: string
  ): Promise<AccountDeleteResponse> {
    return this.accountsService.archiveAccount(user.userId, accountId);
  }
}
