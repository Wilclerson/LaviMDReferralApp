import { type CreatePartnerInput, createPartnerSchema } from "@lavimd/shared";
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, RequirePermissions } from "../common/decorators";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser, RequestWithUser } from "../common/types/authenticated-user";
import { clientIp } from "../common/utils/client-ip";
import { PartnersService } from "./partners.service";

const adminActionSchema = z.object({
  /** Every sensitive administrator action must explain itself for the audit trail. */
  reason: z.string().min(1).max(1000),
});
type AdminActionBody = z.infer<typeof adminActionSchema>;

@ApiTags("partners")
@Controller({ path: "partners", version: "1" })
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post()
  @RequirePermissions("partner.approve")
  @ApiOperation({ summary: "Create a partner record" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreatePartner" } })
  create(
    @Body(new ZodValidationPipe(createPartnerSchema)) body: CreatePartnerInput,
  ): ReturnType<PartnersService["create"]> {
    return this.partnersService.create(body);
  }

  @Get()
  @RequirePermissions("partner.view_any")
  @ApiOperation({ summary: "List partners" })
  list(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): ReturnType<PartnersService["list"]> {
    return this.partnersService.list({
      page: page === undefined ? undefined : Number(page),
      pageSize: pageSize === undefined ? undefined : Number(pageSize),
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Read a partner (partners may only read their own record)" })
  findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): ReturnType<PartnersService["findByIdForActor"]> {
    return this.partnersService.findByIdForActor(id, user);
  }

  @Post(":id/approve")
  @RequirePermissions("partner.approve")
  @ApiOperation({ summary: "Approve a partner (audited)" })
  approve(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminActionSchema)) body: AdminActionBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithUser,
  ): ReturnType<PartnersService["approve"]> {
    return this.partnersService.approve(id, {
      actor: user,
      ip: clientIp(request),
      reason: body.reason,
    });
  }

  @Post(":id/suspend")
  @RequirePermissions("partner.suspend")
  @ApiOperation({ summary: "Suspend a partner (audited)" })
  suspend(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminActionSchema)) body: AdminActionBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithUser,
  ): ReturnType<PartnersService["suspend"]> {
    return this.partnersService.suspend(id, {
      actor: user,
      ip: clientIp(request),
      reason: body.reason,
    });
  }
}
