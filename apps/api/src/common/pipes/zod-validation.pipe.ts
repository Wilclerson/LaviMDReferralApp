import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * Validates untrusted input at the HTTP boundary using a shared Zod schema.
 * Returns the parsed (and defaulted/coerced) value, so handlers only ever see
 * validated data. Error responses expose field-level issues but never internals.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
