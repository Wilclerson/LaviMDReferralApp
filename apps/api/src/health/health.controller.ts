import { Controller, Get, ServiceUnavailableException, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("health")
// Probes stay on a stable, unversioned path so orchestrators never chase an
// API version bump.
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. Does not touch dependencies. */
  @Public()
  @Get("live")
  @ApiOperation({ summary: "Liveness probe" })
  live(): { status: string } {
    return { status: "ok" };
  }

  /** Readiness: dependencies are reachable. */
  @Public()
  @Get("ready")
  @ApiOperation({ summary: "Readiness probe" })
  async ready(): Promise<{ status: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException("Database not reachable");
    }
    return { status: "ok" };
  }
}
