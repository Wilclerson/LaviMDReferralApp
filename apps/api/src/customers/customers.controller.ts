import { type RegisterCustomerInput, registerCustomerSchema } from "@lavimd/shared";
import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Public } from "../common/decorators";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { clientIp } from "../common/utils/client-ip";
import { CustomersService } from "./customers.service";

interface RegistrationResponse {
  status: string;
}

/** Identical response whether or not the email already exists. */
const GENERIC_RESPONSE: RegistrationResponse = {
  status: "If the details are valid, the account has been created.",
};

@ApiTags("customers")
@Controller({ path: "customers", version: "1" })
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * Public customer registration (MVP). Deliberately unauthenticated — there is
   * no session at sign-up, so this is not modeled as a permission. Protected by
   * strict per-IP rate limiting, schema validation, mandatory consent capture,
   * and a constant response that prevents account enumeration.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Register a customer (public, rate-limited)" })
  @ApiBody({ schema: { $ref: "#/components/schemas/RegisterCustomer" } })
  @ApiResponse({ status: 202, description: "Accepted — response is identical for taken emails" })
  @ApiResponse({ status: 429, description: "Too many registration attempts" })
  async register(
    @Body(new ZodValidationPipe(registerCustomerSchema)) body: RegisterCustomerInput,
    @Req() request: Request,
  ): Promise<RegistrationResponse> {
    const userAgent = request.headers["user-agent"];
    await this.customersService.register(body, {
      ip: clientIp(request),
      userAgent: typeof userAgent === "string" ? userAgent.slice(0, 512) : null,
    });
    return GENERIC_RESPONSE;
  }
}
