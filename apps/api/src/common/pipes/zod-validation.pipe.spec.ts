import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe";

const schema = z.object({ name: z.string().min(2), age: z.number().int().default(0) });

describe("ZodValidationPipe", () => {
  it("returns the parsed value with defaults applied", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ name: "Ada" })).toEqual({ name: "Ada", age: 0 });
  });

  it("throws a BadRequest with field-level issues", () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ name: "A" });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        message: string;
        issues: { path: string }[];
      };
      expect(response.message).toBe("Validation failed");
      expect(response.issues[0]?.path).toBe("name");
    }
  });
});
