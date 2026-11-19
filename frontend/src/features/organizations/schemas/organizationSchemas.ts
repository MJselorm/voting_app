import { z } from "zod";

const urlRegex = /^https?:\/\/.+/i;

export const organizationRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(255, "Name must not exceed 255 characters"),
  organization_type: z.enum([
    "UNIVERSITY",
    "DEPARTMENT",
    "COMPANY",
    "ASSOCIATION",
    "CLUB",
    "OTHER",
  ], { required_error: "Select an organisation type" }),
  description: z
    .string()
    .trim()
    .max(5000, "Description cannot exceed 5000 characters")
    .optional()
    .or(z.literal("")),
  contact_email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
  contact_phone: z
    .string()
    .trim()
    .max(40, "Phone number cannot exceed 40 characters")
    .optional()
    .or(z.literal("")),
  website: z
    .string()
    .trim()
    .regex(urlRegex, "Enter a valid URL starting with http:// or https://")
    .optional()
    .or(z.literal("")),
  logo_url: z
    .string()
    .trim()
    .regex(urlRegex, "Enter a valid image URL starting with http:// or https://")
    .optional()
    .or(z.literal("")),
  country: z
    .string()
    .trim()
    .min(2, "Country must be at least 2 characters")
    .max(100, "Country must not exceed 100 characters"),
  supporting_information: z
    .string()
    .trim()
    .max(4000, "Supporting information cannot exceed 4000 characters")
    .optional()
    .or(z.literal("")),
});

export type OrganizationRequestFormValues = z.infer<typeof organizationRequestSchema>;

export const organizationDirectCreateSchema = organizationRequestSchema
  .omit({ supporting_information: true })
  .extend({
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must only contain lowercase letters, numbers, and hyphens")
      .optional()
      .or(z.literal("")),
    management_mode: z.enum(["RETAIN_PLATFORM_MANAGEMENT", "ASSIGN_OWNER"]),
    manager_user_id: z.string().uuid("Enter a valid UUID for owner").optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.management_mode === "ASSIGN_OWNER") {
        return Boolean(data.manager_user_id && data.manager_user_id.trim().length > 0);
      }
      return true;
    },
    {
      message: "Owner user UUID is required when assigning management",
      path: ["manager_user_id"],
    },
  );

export type OrganizationDirectCreateFormValues = z.infer<typeof organizationDirectCreateSchema>;

export const rejectRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(2, "A rejection reason is required (at least 2 characters)")
    .max(2000, "Rejection reason cannot exceed 2000 characters"),
});

export type RejectRequestFormValues = z.infer<typeof rejectRequestSchema>;
