import { createTransactionSchema } from "@lavimd/shared";
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, RequirePermissions } from "../common/decorators";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser, RequestWithUser } from "../common/types/authenticated-user";
import { clientIp } from "../common/utils/client-ip";
import { TransactionsService } from "./transactions.service";

const importSchema = createTransactionSchema.extend({
  reason: z.string().min(1).max(1000),
  /** Optional delivery id used to make replays idempotent. */
  externalEventId: z.string().min(1).max(200).optional(),
});
type ImportBody = z.infer<typeof importSchema>;

const overrideAttributionSchema = z.object({
  referralId: z.string().uuid(),
  reason: z.string().min(1).max(1000),
});
type OverrideAttributionBody = z.infer<typeof overrideAttributionSchema>;

@ApiTags("transactions")
@Controller({ path: "transactions", version: "1" })
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post("import")
  @RequirePermissions("transaction.review")
  @ApiOperation({ summary: "Manually import a transaction (audited); raises a pending commission" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateTransaction" } })
  importManual(
    @Body(new ZodValidationPipe(importSchema)) body: ImportBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithUser,
  ): ReturnType<TransactionsService["importManual"]> {
    const { reason, externalEventId, ...transaction } = body;
    return this.transactionsService.importManual(
      transaction,
      { actor: user, ip: clientIp(request), reason },
      externalEventId,
    );
  }

  @Post(":id/attribution")
  @RequirePermissions("referral.manage")
  @ApiOperation({ summary: "Manually override a transaction's attribution (audited)" })
  overrideAttribution(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(overrideAttributionSchema)) body: OverrideAttributionBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithUser,
  ): ReturnType<TransactionsService["overrideAttribution"]> {
    return this.transactionsService.overrideAttribution(id, body.referralId, {
      actor: user,
      ip: clientIp(request),
      reason: body.reason,
    });
  }

  @Get()
  @ApiOperation({ summary: "List transactions (partners see only their own)" })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): ReturnType<TransactionsService["listForActor"]> {
    return this.transactionsService.listForActor(user, {
      page: page === undefined ? undefined : Number(page),
      pageSize: pageSize === undefined ? undefined : Number(pageSize),
    });
  }
}
