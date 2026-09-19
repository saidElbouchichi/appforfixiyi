import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ZodValidationPipe } from "./zod-validation.pipe.js";

const schema = z.object({ name: z.string().min(1), age: z.number().int().nonnegative() });

describe("ZodValidationPipe", () => {
  it("returns the parsed value when it matches the schema", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ name: "Ahmed", age: 30 })).toEqual({ name: "Ahmed", age: 30 });
  });

  it("throws a BadRequestException with per-field issues when validation fails", () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ name: "", age: -1 });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        message: string;
        issues: { path: string; message: string }[];
      };
      expect(response.message).toBe("Validation failed");
      expect(response.issues.map((i) => i.path)).toEqual(expect.arrayContaining(["name", "age"]));
    }
  });
});
