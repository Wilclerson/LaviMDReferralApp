import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../common/decorators";
import { AuditService } from "./audit.service";

@ApiTags("audit")
@Controller({ path: "audit", version: "1" })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** Reading the audit log is Super Admin only. It is never writable over HTTP. */
  @Get()
  @RequirePermissions("system.audit_log.view")
  @ApiOperation({ summary: "List audit entries (Super Admin only)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  list(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): ReturnType<AuditService["list"]> {
    return this.auditService.list({
      page: page === undefined ? undefined : Number(page),
      pageSize: pageSize === undefined ? undefined : Number(pageSize),
    });
  }
}
