import { type RegisterCustomerInput, registerCustomerSchema } from "@lavimd/shared";
import { Injectable, Logger } from "@nestjs/common";
import { hashPassword } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";

export interface RegistrationContext {
  ip: string | null;
  userAgent: string | null;
}

export interface RegistrationResult {
  /** True when a new account was created; false when the email was already taken. */
  created: boolean;
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registers a customer. This is a public, unauthenticated action.
   *
   * Abuse prevention: the caller always receives the same generic response, so
   * the endpoint cannot be used to discover which emails are registered. The
   * boolean returned here is for internal logging only and is never surfaced.
   *
   * Consent is captured as append-only {@link ConsentRecord} rows alongside the
   * account, in a single transaction — an account can never exist without the
   * consent that authorised it.
   */
  async register(
    input: RegisterCustomerInput,
    context: RegistrationContext,
  ): Promise<RegistrationResult> {
    // The schema already trims and lower-cases the address.
    const data = registerCustomerSchema.parse(input);
    const email = data.email;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing !== null) {
      this.logger.warn(`Registration attempted for an existing email (${maskEmail(email)})`);
      return { created: false };
    }

    const passwordHash = await hashPassword(data.password);

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, role: "customer" },
      });

      await tx.consentRecord.createMany({
        data: [
          {
            userId: user.id,
            type: "terms",
            granted: true,
            version: data.consent.version,
            ip: context.ip,
            userAgent: context.userAgent,
          },
          {
            userId: user.id,
            type: "privacy",
            granted: true,
            version: data.consent.version,
            ip: context.ip,
            userAgent: context.userAgent,
          },
          {
            userId: user.id,
            type: "marketing",
            granted: data.consent.marketing,
            version: data.consent.version,
            ip: context.ip,
            userAgent: context.userAgent,
          },
        ],
      });
    });

    return { created: true };
  }
}

/** Masks an email for logs so registration attempts never leak addresses. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (local === undefined || domain === undefined) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}
