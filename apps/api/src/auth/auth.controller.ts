import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, Public } from "../common/decorators";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user";
import { AuthService, type LoginInput, type LoginResult, loginSchema } from "./auth.service";

interface MeResponse {
  id: string;
  email: string;
  role: string;
  partnerId: string | null;
  permissions: string[];
}

@ApiTags("auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Exchange credentials for an access token" })
  @ApiBody({ schema: { $ref: "#/components/schemas/Login" } })
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<LoginResult> {
    return this.authService.login(body);
  }

  @Get("me")
  @ApiOperation({ summary: "Return the authenticated principal and its effective permissions" })
  me(@CurrentUser() user: AuthenticatedUser): MeResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      partnerId: user.partnerId,
      permissions: [...user.permissions].sort(),
    };
  }
}
