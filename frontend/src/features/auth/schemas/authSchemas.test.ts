import { describe, expect, it } from "vitest";

import { loginSchema, registrationSchema } from "./authSchemas";

describe("auth form schemas", () => {
  it("normalizes whitespace in valid registration names and email addresses", () => {
    expect(registrationSchema.parse({
      fullName: "  Test Person ",
      email: " person@example.com ",
      password: "a-secure-password",
      passwordConfirmation: "a-secure-password",
    })).toMatchObject({
      fullName: "Test Person",
      email: "person@example.com",
    });
  });

  it("rejects malformed logins and mismatched registration passwords", () => {
    expect(loginSchema.safeParse({ email: "invalid", password: "" }).success).toBe(false);
    const result = registrationSchema.safeParse({
      fullName: "Test Person",
      email: "person@example.com",
      password: "password123",
      passwordConfirmation: "different",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["passwordConfirmation"]);
    }
  });
});
