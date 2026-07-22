import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators";
import type { AuthenticatedUser } from "../common/types/authenticated-user";
import { LedgerService } from "./ledger.service";

@ApiTags("ledger")
@Controller({ path: "ledger", version: "1" })
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  @ApiOperation({ summary: "List ledger entries (partners see only their own)" })
  @ApiQuery({ name: "partnerId", required: false })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("partnerId") partnerId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): ReturnType<LedgerService["listForActor"]> {
    return this.ledgerService.listForActor(user, partnerId, {
      page: page === undefined ? undefined : Number(page),
      pageSize: pageSize === undefined ? undefined : Number(pageSize),
    });
  }
}
