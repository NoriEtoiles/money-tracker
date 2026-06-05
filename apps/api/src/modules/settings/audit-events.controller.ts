import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { AuditEventListResponse, AuditService } from "../audit/audit.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ListAuditEventsDto } from "./dto/list-audit-events.dto";

@Controller("audit-events")
@UseGuards(JwtAuthGuard)
export class AuditEventsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAuditEventsDto
  ): Promise<AuditEventListResponse> {
    return this.auditService.listForUser(user.userId, query);
  }
}
