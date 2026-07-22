import { type CreateReferralInput, createReferralSchema } from "@lavimd/shared";
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermissions } from "../common/decorators";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user";
import { ReferralsService } from "./referrals.service";

@ApiTags("referrals")
@Controller({ path: "referrals", version: "1" })
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Post()
  @RequirePermissions("referral.link.generate")
  @ApiOperation({ summary: "Record a referral attribution touch" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateReferral" } })
  create(
    @Body(new ZodValidationPipe(createReferralSchema)) body: CreateReferralInput,
  ): ReturnType<ReferralsService["create"]> {
    return this.referralsService.create(body);
  }

  @Get()
  @ApiOperation({ summary: "List referrals (partners see only their own)" })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): ReturnType<ReferralsService["listForActor"]> {
    return this.referralsService.listForActor(user, {
      page: page === undefined ? undefined : Number(page),
      pageSize: pageSize === undefined ? undefined : Number(pageSize),
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Read a referral (partners see only their own)" })
  findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): ReturnType<ReferralsService["findByIdForActor"]> {
    return this.referralsService.findByIdForActor(id, user);
  }
}
