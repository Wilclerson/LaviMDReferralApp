import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, RequirePermissions } from "../common/decorators";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser, RequestWithUser } from "../common/types/authenticated-user";
import { clientIp } from "../common/utils/client-ip";
import { CommissionsService } from "./commissions.service";

const decisionSchema = z.object({
  reason: z.string().min(1).max(1000),
});
type DecisionBody = z.infer<typeof decisionSchema>;

@ApiTags("commissions")
@Controller({ path: "commissions", version: "1" })
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Get()
  @ApiOperation({ summary: "List commissions (partners see only their own)" })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): ReturnType<CommissionsService["listForActor"]> {
    return this.commissionsService.listForActor(user, {
      page: page === undefined ? undefined : Number(page),
      pageSize: pageSize === undefined ? undefined : Number(pageSize),
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Read a commission (partners see only their own)" })
  findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): ReturnType<CommissionsService["findByIdForActor"]> {
    return this.commissionsService.findByIdForActor(id, user);
  }

  @Post(":id/approve")
  @RequirePermissions("commission.approve")
  @ApiOperation({ summary: "Approve a commission — the gate that makes it payable (audited)" })
  approve(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decisionSchema)) body: DecisionBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithUser,
  ): ReturnType<CommissionsService["approve"]> {
    return this.commissionsService.approve(id, {
      actor: user,
      ip: clientIp(request),
      reason: body.reason,
    });
  }

  @Post(":id/reject")
  @RequirePermissions("commission.approve")
  @ApiOperation({ summary: "Reject a commission (audited)" })
  reject(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decisionSchema)) body: DecisionBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithUser,
  ): ReturnType<CommissionsService["reject"]> {
    return this.commissionsService.reject(id, {
      actor: user,
      ip: clientIp(request),
      reason: body.reason,
    });
  }

  @Post(":id/reverse")
  @RequirePermissions("commission.approve")
  @ApiOperation({ summary: "Reverse (claw back) a commission (audited)" })
  reverse(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decisionSchema)) body: DecisionBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithUser,
  ): ReturnType<CommissionsService["reverse"]> {
    return this.commissionsService.reverse(id, {
      actor: user,
      ip: clientIp(request),
      reason: body.reason,
    });
  }
}
