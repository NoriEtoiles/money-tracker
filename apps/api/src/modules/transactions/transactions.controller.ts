import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { ListTransactionsDto } from "./dto/list-transactions.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";
import {
  TransactionDeleteResponse,
  TransactionListResponse,
  TransactionResponse,
  TransactionsService
} from "./transactions.service";

@Controller("transactions")
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTransactionsDto
  ): Promise<TransactionListResponse> {
    return this.transactionsService.listTransactions(user.userId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto
  ): Promise<TransactionResponse> {
    return this.transactionsService.createTransaction(user.userId, dto);
  }

  @Patch(":transactionId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("transactionId") transactionId: string,
    @Body() dto: UpdateTransactionDto
  ): Promise<TransactionResponse> {
    return this.transactionsService.updateTransaction(user.userId, transactionId, dto);
  }

  @Delete(":transactionId")
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("transactionId") transactionId: string
  ): Promise<TransactionDeleteResponse> {
    return this.transactionsService.deleteTransaction(user.userId, transactionId);
  }
}
