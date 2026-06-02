import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, RecurringRule } from "@prisma/client";
import { DateTime } from "luxon";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { TransactionType } from "../transactions/dto/transaction-type";
import { CreateRecurringRuleDto } from "./dto/create-recurring-rule.dto";
import { ListRecurringRulesDto } from "./dto/list-recurring-rules.dto";
import { RecurringFrequency } from "./dto/recurring-frequency";
import { RecurringTemplateDto } from "./dto/recurring-template.dto";
import { UpdateRecurringRuleDto } from "./dto/update-recurring-rule.dto";

export type RecurringTemplate = {
  accountId: string;
  amount: string;
  categoryId?: string;
  currency: string;
  merchant?: string;
  type: TransactionType;
};

export type RecurringRuleStatus = "active" | "completed" | "paused";

export type RecurringRuleResponse = {
  endAt: string | null;
  frequency: RecurringFrequency;
  id: string;
  intervalCount: number;
  lastGenerationErrorCode: string | null;
  lastRunAt: string | null;
  name: string;
  nextRunAt: string | null;
  pausedAt: string | null;
  startAt: string;
  status: RecurringRuleStatus;
  template: RecurringTemplate;
  timezone: string;
};

export type RecurringRuleListResponse = {
  items: RecurringRuleResponse[];
  nextCursor: string | null;
};

export type RecurringRuleDeleteResponse = {
  mode: "archived";
  success: true;
};

export type GenerationSummary = {
  autoPausedCount: number;
  duplicateCount: number;
  generatedCount: number;
  processedCount: number;
};

export type GenerationResult = "auto_paused" | "duplicate" | "generated" | "skipped";

export type ScheduleRule = {
  dayOfMonth: number | null;
  endAt: Date | null;
  frequency: RecurringFrequency;
  intervalCount: number;
  startAt: Date;
  timezone: string;
};

type ActiveAccount = {
  currency: string;
  id: string;
};

type DependencyResult =
  | {
      account: ActiveAccount;
      errorCode?: never;
    }
  | {
      account?: never;
      errorCode: GenerationErrorCode;
    };

type GenerationErrorCode =
  | "ACCOUNT_UNAVAILABLE"
  | "CATEGORY_UNAVAILABLE"
  | "TEMPLATE_INVALID";

const maxCatchUpPerTick = 100;

@Injectable()
export class RecurringRulesService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listRules(
    userId: string,
    dto: ListRecurringRulesDto
  ): Promise<RecurringRuleListResponse> {
    const limit = dto.limit ?? 30;
    const rules = await this.prisma.recurringRule.findMany({
      cursor: dto.cursor !== undefined ? { id: dto.cursor } : undefined,
      orderBy: [
        {
          createdAt: "desc"
        },
        {
          id: "desc"
        }
      ],
      skip: dto.cursor !== undefined ? 1 : 0,
      take: limit + 1,
      where: {
        archivedAt: null,
        userId
      }
    });
    const hasNextPage = rules.length > limit;
    const items = rules.slice(0, limit);

    return {
      items: items.map((rule) => this.toResponse(rule)),
      nextCursor: hasNextPage ? items[items.length - 1]?.id ?? null : null
    };
  }

  async createRule(
    userId: string,
    dto: CreateRecurringRuleDto,
    now = new Date()
  ): Promise<RecurringRuleResponse> {
    const timezone = await this.getUserTimezone(userId);
    const schedule = this.buildSchedule({
      endAt: dto.endAt,
      frequency: dto.frequency,
      intervalCount: dto.intervalCount ?? 1,
      startAt: dto.startAt,
      timezone
    });
    const template = this.normalizeTemplate(dto.template);
    const nextRunAt = this.getNextUpcomingOccurrence(schedule, now);
    const rule = await this.prisma.$transaction(async (tx) => {
      await this.assertTemplateDependencies(tx, userId, template);

      return tx.recurringRule.create({
        data: {
          dayOfMonth: schedule.dayOfMonth,
          endAt: schedule.endAt,
          frequency: schedule.frequency,
          intervalCount: schedule.intervalCount,
          name: dto.name.trim(),
          nextRunAt,
          startAt: schedule.startAt,
          templatePayload: template,
          timezone,
          userId
        }
      });
    });

    await this.auditService.record({
      entityId: rule.id,
      entityType: "recurring_rule",
      eventType: "recurring_rule_create",
      userId
    });

    return this.toResponse(rule);
  }

  async updateRule(
    userId: string,
    ruleId: string,
    dto: UpdateRecurringRuleDto,
    now = new Date()
  ): Promise<RecurringRuleResponse> {
    const rule = await this.prisma.$transaction(async (tx) => {
      const existingRule = await this.assertActiveRule(tx, userId, ruleId);
      const existingTemplate = this.parseTemplatePayload(existingRule.templatePayload);
      const template = dto.template === undefined
        ? existingTemplate
        : this.normalizeTemplate(dto.template);
      const schedule = this.buildSchedule({
        endAt: Object.prototype.hasOwnProperty.call(dto, "endAt")
          ? dto.endAt ?? null
          : existingRule.endAt,
        frequency: dto.frequency ?? existingRule.frequency as RecurringFrequency,
        intervalCount: dto.intervalCount ?? existingRule.intervalCount,
        startAt: dto.startAt ?? existingRule.startAt,
        timezone: existingRule.timezone
      });
      const scheduleChanged = this.hasScheduleUpdate(dto);

      await this.assertTemplateDependencies(tx, userId, template);

      return tx.recurringRule.update({
        data: {
          dayOfMonth: schedule.dayOfMonth,
          endAt: schedule.endAt,
          frequency: schedule.frequency,
          intervalCount: schedule.intervalCount,
          name: dto.name?.trim(),
          nextRunAt: scheduleChanged
            ? this.getNextUpcomingOccurrence(schedule, now)
            : undefined,
          startAt: schedule.startAt,
          templatePayload: dto.template === undefined ? undefined : template
        },
        where: {
          id: existingRule.id
        }
      });
    });

    await this.auditService.record({
      entityId: rule.id,
      entityType: "recurring_rule",
      eventType: "recurring_rule_update",
      userId
    });

    return this.toResponse(rule);
  }

  async pauseRule(userId: string, ruleId: string, now = new Date()): Promise<RecurringRuleResponse> {
    const existingRule = await this.assertActiveRule(this.prisma, userId, ruleId);
    const rule = existingRule.pausedAt === null
      ? await this.prisma.recurringRule.update({
          data: {
            pausedAt: now
          },
          where: {
            id: existingRule.id
          }
        })
      : existingRule;

    if (existingRule.pausedAt === null) {
      await this.auditService.record({
        entityId: rule.id,
        entityType: "recurring_rule",
        eventType: "recurring_rule_pause",
        userId
      });
    }

    return this.toResponse(rule);
  }

  async resumeRule(
    userId: string,
    ruleId: string,
    now = new Date()
  ): Promise<RecurringRuleResponse> {
    const rule = await this.prisma.$transaction(async (tx) => {
      const existingRule = await this.assertActiveRule(tx, userId, ruleId);
      const template = this.parseTemplatePayload(existingRule.templatePayload);

      await this.assertTemplateDependencies(tx, userId, template);

      return tx.recurringRule.update({
        data: {
          lastFailedAt: null,
          lastGenerationErrorCode: null,
          nextRunAt: this.getNextUpcomingOccurrence(this.toScheduleRule(existingRule), now),
          pausedAt: null
        },
        where: {
          id: existingRule.id
        }
      });
    });

    await this.auditService.record({
      entityId: rule.id,
      entityType: "recurring_rule",
      eventType: "recurring_rule_resume",
      userId
    });

    return this.toResponse(rule);
  }

  async archiveRule(
    userId: string,
    ruleId: string,
    now = new Date()
  ): Promise<RecurringRuleDeleteResponse> {
    const rule = await this.prisma.$transaction(async (tx) => {
      const existingRule = await this.assertActiveRule(tx, userId, ruleId);

      return tx.recurringRule.update({
        data: {
          archivedAt: now
        },
        where: {
          id: existingRule.id
        }
      });
    });

    await this.auditService.record({
      entityId: rule.id,
      entityType: "recurring_rule",
      eventType: "recurring_rule_archive",
      userId
    });

    return {
      mode: "archived",
      success: true
    };
  }

  async generateDueTransactions(
    now = new Date(),
    requestedLimit = maxCatchUpPerTick
  ): Promise<GenerationSummary> {
    const limit = Math.max(1, Math.min(requestedLimit, maxCatchUpPerTick));
    const summary = {
      autoPausedCount: 0,
      duplicateCount: 0,
      generatedCount: 0,
      processedCount: 0
    };

    while (summary.processedCount < limit) {
      const rule = await this.prisma.recurringRule.findFirst({
        orderBy: [
          {
            nextRunAt: "asc"
          },
          {
            id: "asc"
          }
        ],
        select: {
          id: true,
          userId: true
        },
        where: {
          archivedAt: null,
          nextRunAt: {
            lte: now
          },
          pausedAt: null
        }
      });

      if (rule === null) {
        break;
      }

      const result = await this.generateDueOccurrence(rule.userId, rule.id, now);

      summary.processedCount += 1;

      if (result === "generated") {
        summary.generatedCount += 1;
      }

      if (result === "duplicate") {
        summary.duplicateCount += 1;
      }

      if (result === "auto_paused") {
        summary.autoPausedCount += 1;
      }

      if (result === "skipped") {
        break;
      }
    }

    return summary;
  }

  async generateDueOccurrence(
    userId: string,
    ruleId: string,
    now = new Date()
  ): Promise<GenerationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rule = await tx.recurringRule.findFirst({
          where: {
            archivedAt: null,
            id: ruleId,
            nextRunAt: {
              lte: now
            },
            pausedAt: null,
            userId
          }
        });

        if (rule === null || rule.nextRunAt === null) {
          return "skipped";
        }

        const template = this.tryParseTemplatePayload(rule.templatePayload);

        if (template === null) {
          return this.autoPauseRule(tx, rule, "TEMPLATE_INVALID", now);
        }

        const dependency = await this.getTemplateDependencies(tx, userId, template);

        if (dependency.errorCode !== undefined) {
          return this.autoPauseRule(tx, rule, dependency.errorCode, now);
        }

        const occurrenceAt = rule.nextRunAt;
        const nextRunAt = this.getFollowingOccurrence(this.toScheduleRule(rule), occurrenceAt);
        const existingTransaction = await tx.transaction.findFirst({
          select: {
            id: true
          },
          where: {
            recurringOccurrenceAt: occurrenceAt,
            recurringRuleId: rule.id,
            userId
          }
        });

        if (existingTransaction !== null) {
          await tx.recurringRule.update({
            data: {
              lastRunAt: occurrenceAt,
              nextRunAt
            },
            where: {
              id: rule.id
            }
          });

          return "duplicate";
        }

        const amount = new Prisma.Decimal(template.amount);
        const transaction = await tx.transaction.create({
          data: {
            accountId: dependency.account.id,
            amount,
            categoryId: template.categoryId,
            currency: template.currency,
            merchant: template.merchant,
            recurringOccurrenceAt: occurrenceAt,
            recurringRuleId: rule.id,
            source: "recurring",
            transactionAt: occurrenceAt,
            type: template.type,
            userId
          }
        });

        await tx.account.update({
          data: {
            currentBalance: {
              increment: template.type === "income" ? amount : amount.negated()
            }
          },
          where: {
            id: dependency.account.id
          }
        });
        await tx.recurringRule.update({
          data: {
            lastFailedAt: null,
            lastGenerationErrorCode: null,
            lastRunAt: occurrenceAt,
            nextRunAt
          },
          where: {
            id: rule.id
          }
        });
        await tx.auditEvent.create({
          data: {
            entityId: rule.id,
            entityType: "recurring_rule",
            eventType: "recurring_transaction_generate",
            metadata: {
              recurringOccurrenceAt: occurrenceAt.toISOString(),
              transactionId: transaction.id
            },
            userId
          }
        });

        return "generated";
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return "duplicate";
      }

      throw error;
    }
  }

  getNextUpcomingOccurrence(rule: ScheduleRule, reference: Date): Date | null {
    let occurrence = this.toLocalDateTime(rule.startAt, rule.timezone);
    const referenceMillis = reference.getTime();
    let attempts = 0;

    while (occurrence.toUTC().toMillis() < referenceMillis) {
      occurrence = this.addScheduleInterval(rule, occurrence);
      attempts += 1;

      if (attempts > 100000) {
        throw new BadRequestException("Recurring schedule range is too large");
      }
    }

    return this.withinEndAt(rule, occurrence);
  }

  getFollowingOccurrence(rule: ScheduleRule, occurrenceAt: Date): Date | null {
    const occurrence = this.toLocalDateTime(occurrenceAt, rule.timezone);

    return this.withinEndAt(rule, this.addScheduleInterval(rule, occurrence));
  }

  private async assertActiveRule(
    client: PrismaService | Prisma.TransactionClient,
    userId: string,
    ruleId: string
  ): Promise<RecurringRule> {
    const rule = await client.recurringRule.findFirst({
      where: {
        archivedAt: null,
        id: ruleId,
        userId
      }
    });

    if (rule === null) {
      throw new NotFoundException("Recurring rule not found");
    }

    return rule;
  }

  private async getUserTimezone(userId: string): Promise<string> {
    const user = await this.prisma.user.findFirst({
      select: {
        timezone: true
      },
      where: {
        deletedAt: null,
        id: userId,
        status: "active"
      }
    });

    if (user === null) {
      throw new NotFoundException("User not found");
    }

    this.assertValidTimezone(user.timezone);

    return user.timezone;
  }

  private buildSchedule(input: {
    endAt: Date | string | null | undefined;
    frequency: RecurringFrequency;
    intervalCount: number;
    startAt: Date | string;
    timezone: string;
  }): ScheduleRule {
    this.assertValidTimezone(input.timezone);
    const startAt = this.toDate(input.startAt, "startAt");
    const endAt = input.endAt === null || input.endAt === undefined
      ? null
      : this.toDate(input.endAt, "endAt");

    if (input.intervalCount < 1) {
      throw new BadRequestException("intervalCount must be greater than or equal to 1");
    }

    if (endAt !== null && endAt.getTime() < startAt.getTime()) {
      throw new BadRequestException("endAt must be after or equal to startAt");
    }

    return {
      dayOfMonth: input.frequency === "monthly"
        ? this.toLocalDateTime(startAt, input.timezone).day
        : null,
      endAt,
      frequency: input.frequency,
      intervalCount: input.intervalCount,
      startAt,
      timezone: input.timezone
    };
  }

  private hasScheduleUpdate(dto: UpdateRecurringRuleDto): boolean {
    return dto.frequency !== undefined ||
      dto.intervalCount !== undefined ||
      dto.startAt !== undefined ||
      Object.prototype.hasOwnProperty.call(dto, "endAt");
  }

  private normalizeTemplate(dto: RecurringTemplateDto): RecurringTemplate {
    const amount = this.parsePositiveAmount(dto.amount);
    const merchant = dto.merchant?.trim();

    return {
      accountId: dto.accountId,
      amount: amount.toFixed(4),
      categoryId: dto.categoryId,
      currency: dto.currency,
      merchant: merchant !== undefined && merchant.length > 0 ? merchant : undefined,
      type: dto.type
    };
  }

  private parseTemplatePayload(payload: Prisma.JsonValue): RecurringTemplate {
    const template = this.tryParseTemplatePayload(payload);

    if (template === null) {
      throw new BadRequestException("Recurring rule template is invalid");
    }

    return template;
  }

  private tryParseTemplatePayload(payload: Prisma.JsonValue): RecurringTemplate | null {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      return null;
    }

    const accountId = payload.accountId;
    const amount = payload.amount;
    const categoryId = payload.categoryId;
    const currency = payload.currency;
    const merchant = payload.merchant;
    const type = payload.type;

    if (
      typeof accountId !== "string" ||
      typeof amount !== "string" ||
      (categoryId !== undefined && typeof categoryId !== "string") ||
      typeof currency !== "string" ||
      !/^[A-Z]{3}$/.test(currency) ||
      (merchant !== undefined && typeof merchant !== "string") ||
      (type !== "income" && type !== "expense")
    ) {
      return null;
    }

    try {
      return {
        accountId,
        amount: this.parsePositiveAmount(amount).toFixed(4),
        categoryId,
        currency,
        merchant,
        type
      };
    } catch {
      return null;
    }
  }

  private async assertTemplateDependencies(
    client: PrismaService | Prisma.TransactionClient,
    userId: string,
    template: RecurringTemplate
  ): Promise<ActiveAccount> {
    const result = await this.getTemplateDependencies(client, userId, template);

    if (result.errorCode === "ACCOUNT_UNAVAILABLE") {
      throw new NotFoundException("Account not found");
    }

    if (result.errorCode === "CATEGORY_UNAVAILABLE") {
      throw new NotFoundException("Category not found");
    }

    if (result.errorCode === "TEMPLATE_INVALID") {
      throw new BadRequestException("Recurring rule template is invalid");
    }

    if (result.account === undefined) {
      throw new BadRequestException("Recurring rule template is invalid");
    }

    return result.account;
  }

  private async getTemplateDependencies(
    client: PrismaService | Prisma.TransactionClient,
    userId: string,
    template: RecurringTemplate
  ): Promise<DependencyResult> {
    const account = await client.account.findFirst({
      select: {
        currency: true,
        id: true
      },
      where: {
        archivedAt: null,
        deletedAt: null,
        id: template.accountId,
        userId
      }
    });

    if (account === null) {
      return {
        errorCode: "ACCOUNT_UNAVAILABLE"
      };
    }

    if (account.currency !== template.currency) {
      return {
        errorCode: "TEMPLATE_INVALID"
      };
    }

    if (template.categoryId !== undefined) {
      const category = await client.category.findFirst({
        select: {
          id: true
        },
        where: {
          archivedAt: null,
          deletedAt: null,
          id: template.categoryId,
          kind: template.type,
          userId
        }
      });

      if (category === null) {
        return {
          errorCode: "CATEGORY_UNAVAILABLE"
        };
      }
    }

    return {
      account
    };
  }

  private async autoPauseRule(
    tx: Prisma.TransactionClient,
    rule: RecurringRule,
    errorCode: GenerationErrorCode,
    now: Date
  ): Promise<"auto_paused"> {
    await tx.recurringRule.update({
      data: {
        lastFailedAt: now,
        lastGenerationErrorCode: errorCode,
        pausedAt: now
      },
      where: {
        id: rule.id
      }
    });
    await tx.auditEvent.create({
      data: {
        entityId: rule.id,
        entityType: "recurring_rule",
        eventType: "recurring_rule_auto_pause",
        metadata: {
          errorCode
        },
        userId: rule.userId
      }
    });

    return "auto_paused";
  }

  private addScheduleInterval(rule: ScheduleRule, occurrence: DateTime): DateTime {
    if (rule.frequency === "daily") {
      return occurrence.plus({
        days: rule.intervalCount
      });
    }

    if (rule.frequency === "weekly") {
      return occurrence.plus({
        weeks: rule.intervalCount
      });
    }

    const anchor = this.toLocalDateTime(rule.startAt, rule.timezone);
    const nextMonth = occurrence.startOf("month").plus({
      months: rule.intervalCount
    });

    return nextMonth.set({
      day: Math.min(rule.dayOfMonth ?? anchor.day, nextMonth.daysInMonth ?? 31),
      hour: anchor.hour,
      millisecond: anchor.millisecond,
      minute: anchor.minute,
      second: anchor.second
    });
  }

  private toScheduleRule(rule: RecurringRule): ScheduleRule {
    return {
      dayOfMonth: rule.dayOfMonth,
      endAt: rule.endAt,
      frequency: rule.frequency as RecurringFrequency,
      intervalCount: rule.intervalCount,
      startAt: rule.startAt,
      timezone: rule.timezone
    };
  }

  private withinEndAt(rule: ScheduleRule, occurrence: DateTime): Date | null {
    const date = occurrence.toUTC().toJSDate();

    return rule.endAt === null || date.getTime() <= rule.endAt.getTime()
      ? date
      : null;
  }

  private toLocalDateTime(date: Date, timezone: string): DateTime {
    return DateTime.fromJSDate(date, {
      zone: "utc"
    }).setZone(timezone);
  }

  private toDate(value: Date | string, fieldName: string): Date {
    if (value instanceof Date) {
      return value;
    }

    const parsed = DateTime.fromISO(value, {
      setZone: true
    });

    if (!parsed.isValid) {
      throw new BadRequestException(`${fieldName} must be a valid ISO date`);
    }

    return parsed.toUTC().toJSDate();
  }

  private assertValidTimezone(timezone: string): void {
    if (!DateTime.now().setZone(timezone).isValid) {
      throw new BadRequestException("User timezone is invalid");
    }
  }

  private parsePositiveAmount(value: string): Prisma.Decimal {
    let amount: Prisma.Decimal;

    try {
      amount = new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException("Amount must be a valid decimal");
    }

    if (amount.lte(0)) {
      throw new BadRequestException("Amount must be greater than 0");
    }

    return amount;
  }

  private toResponse(rule: RecurringRule): RecurringRuleResponse {
    return {
      endAt: rule.endAt?.toISOString() ?? null,
      frequency: rule.frequency as RecurringFrequency,
      id: rule.id,
      intervalCount: rule.intervalCount,
      lastGenerationErrorCode: rule.lastGenerationErrorCode,
      lastRunAt: rule.lastRunAt?.toISOString() ?? null,
      name: rule.name,
      nextRunAt: rule.nextRunAt?.toISOString() ?? null,
      pausedAt: rule.pausedAt?.toISOString() ?? null,
      startAt: rule.startAt.toISOString(),
      status: rule.pausedAt !== null
        ? "paused"
        : rule.nextRunAt === null
          ? "completed"
          : "active",
      template: this.parseTemplatePayload(rule.templatePayload),
      timezone: rule.timezone
    };
  }
}
