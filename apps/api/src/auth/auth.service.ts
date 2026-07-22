import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export interface LoginResult {
  accessToken: string;
}

/** Work factor for password hashing. */
export const PASSWORD_HASH_ROUNDS = 12;

export function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, PASSWORD_HASH_ROUNDS);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Verifies credentials and issues a short-lived access token.
   *
   * The same generic error is returned for unknown email, wrong password, and
   * deactivated accounts so the endpoint cannot be used to enumerate users.
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });

    const passwordMatches =
      user === null ? false : await compare(input.password, user.passwordHash);

    if (user === null || !passwordMatches || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const accessToken = await this.jwtService.signAsync({ sub: user.id });
    return { accessToken };
  }
}
