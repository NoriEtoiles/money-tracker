import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { ListTransfersDto } from "./dto/list-transfers.dto";
import { UpdateTransferDto } from "./dto/update-transfer.dto";
import {
  TransferDeleteResponse,
  TransferListResponse,
  TransferResponse,
  TransfersService
} from "./transfers.service";

@Controller("transfers")
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTransfersDto
  ): Promise<TransferListResponse> {
    return this.transfersService.listTransfers(user.userId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransferDto
  ): Promise<TransferResponse> {
    return this.transfersService.createTransfer(user.userId, dto);
  }

  @Patch(":transferGroupId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("transferGroupId") transferGroupId: string,
    @Body() dto: UpdateTransferDto
  ): Promise<TransferResponse> {
    return this.transfersService.updateTransfer(user.userId, transferGroupId, dto);
  }

  @Delete(":transferGroupId")
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("transferGroupId") transferGroupId: string
  ): Promise<TransferDeleteResponse> {
    return this.transfersService.deleteTransfer(user.userId, transferGroupId);
  }
}
