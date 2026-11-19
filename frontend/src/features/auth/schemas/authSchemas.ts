import { z } from "zod";

const email = z.string().trim().email("Enter a valid email address.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registrationSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter a name between 2 and 120 characters.")
      .max(120, "Enter a name between 2 and 120 characters."),
    email,
    password: z.string().min(8, "Use at least 8 characters."),
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: "Passwords do not match.",
    path: ["passwordConfirmation"],
  });
export type RegistrationFormValues = z.infer<typeof registrationSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter a name between 2 and 120 characters.")
    .max(120, "Enter a name between 2 and 120 characters."),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;
