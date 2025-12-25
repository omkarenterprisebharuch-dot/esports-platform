/**
 * Zod Validation Schemas
 * 
 * Centralized validation schemas for all API routes.
 * This ensures consistent validation across the application.
 */

import { z } from "zod";

// ============ Common Schemas ============

export const emailSchema = z
  .string()
  .email("Invalid email address")
  .min(1, "Email is required")
  .max(255, "Email must be less than 255 characters")
  .transform((v) => v.toLowerCase().trim());

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters");

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(50, "Username must be less than 50 characters")
  .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens")
  .transform((v) => v.trim());

export const otpSchema = z
  .string()
  .length(6, "OTP must be exactly 6 digits")
  .regex(/^\d{6}$/, "OTP must contain only numbers");

export const uuidSchema = z
  .string()
  .uuid("Invalid ID format");

export const gameIdSchema = z
  .string()
  .min(3, "Game ID must be at least 3 characters")
  .max(50, "Game ID must be less than 50 characters")
  .transform((v) => v.trim());

// ============ Auth Schemas ============

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, "Confirm password is required"),
  gameId: gameIdSchema.optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const sendOtpSchema = z.object({
  email: emailSchema,
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema,
  confirmPassword: z.string().min(1, "Confirm password is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// ============ Profile Schemas ============

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  gameId: gameIdSchema.optional(),
  avatar: z.string().url("Invalid avatar URL").optional().or(z.literal("")),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
}).refine((data) => {
  // At least one field must be provided
  return data.username || data.gameId !== undefined || data.avatar !== undefined || data.bio !== undefined;
}, {
  message: "At least one field must be provided for update",
});

// ============ Team Schemas ============

export const createTeamSchema = z.object({
  name: z
    .string()
    .min(3, "Team name must be at least 3 characters")
    .max(50, "Team name must be less than 50 characters")
    .trim(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  maxMembers: z
    .number()
    .int("Max members must be a whole number")
    .min(2, "Team must allow at least 2 members")
    .max(10, "Team cannot have more than 10 members")
    .default(5),
});

export const updateTeamSchema = z.object({
  name: z
    .string()
    .min(3, "Team name must be at least 3 characters")
    .max(50, "Team name must be less than 50 characters")
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
});

export const joinTeamSchema = z.object({
  code: z
    .string()
    .min(1, "Team code is required")
    .max(20, "Invalid team code")
    .trim()
    .toUpperCase(),
});

export const kickMemberSchema = z.object({
  memberId: uuidSchema,
});

// ============ Tournament Schemas ============

export const createTournamentSchema = z.object({
  name: z
    .string()
    .min(3, "Tournament name must be at least 3 characters")
    .max(100, "Tournament name must be less than 100 characters")
    .trim(),
  description: z
    .string()
    .max(2000, "Description must be less than 2000 characters")
    .optional(),
  startDate: z
    .string()
    .datetime("Invalid start date format"),
  endDate: z
    .string()
    .datetime("Invalid end date format")
    .optional(),
  maxParticipants: z
    .number()
    .int("Max participants must be a whole number")
    .min(2, "Must allow at least 2 participants")
    .max(1000, "Cannot exceed 1000 participants"),
  game: z
    .string()
    .min(1, "Game is required")
    .max(100, "Game name must be less than 100 characters"),
  prizePool: z
    .number()
    .min(0, "Prize pool cannot be negative")
    .optional(),
  entryFee: z
    .number()
    .min(0, "Entry fee cannot be negative")
    .optional(),
  rules: z
    .string()
    .max(5000, "Rules must be less than 5000 characters")
    .optional(),
  type: z
    .enum(["solo", "team", "duo"])
    .optional()
    .default("solo"),
  roomId: z.string().optional(),
  roomPassword: z.string().optional(),
});

// Add refinement for date validation
export const createTournamentSchemaWithValidation = createTournamentSchema.refine((data) => {
  if (data.endDate) {
    return new Date(data.endDate) > new Date(data.startDate);
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["endDate"],
});

export const updateTournamentSchema = createTournamentSchema.partial().extend({
  status: z.enum(["draft", "open", "in_progress", "completed", "cancelled"]).optional(),
});

export const updateRoomCredentialsSchema = z.object({
  roomId: z.string().min(1, "Room ID is required").max(100),
  roomPassword: z.string().min(1, "Room password is required").max(100),
});

// ============ Registration Schemas ============

export const registerTournamentSchema = z.object({
  tournamentId: uuidSchema,
  teamId: uuidSchema.optional(),
});

// ============ Push Notification Schemas ============

export const pushSubscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url("Invalid endpoint URL"),
    keys: z.object({
      p256dh: z.string().min(1, "p256dh key is required"),
      auth: z.string().min(1, "auth key is required"),
    }),
    expirationTime: z.number().nullable().optional(),
  }),
});

export const sendNotificationSchema = z.object({
  userId: uuidSchema.optional(),
  title: z.string().min(1, "Title is required").max(100),
  body: z.string().min(1, "Body is required").max(500),
  url: z.string().url("Invalid URL").optional(),
  tournamentId: uuidSchema.optional(),
});

// ============ Chat Schemas ============

export const chatMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(1000, "Message must be less than 1000 characters")
    .trim(),
  tournamentId: uuidSchema,
});

// ============ Validation Helper ============

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: z.ZodIssue[] };

/**
 * Validate data against a Zod schema
 * Returns a result object for easy error handling
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Get the first error message for a user-friendly response
  const firstError = result.error.issues[0];
  const errorMessage = firstError
    ? `${firstError.path.join(".")}: ${firstError.message}`.replace(/^:\s*/, "")
    : "Validation failed";

  return {
    success: false,
    error: errorMessage,
    details: result.error.issues,
  };
}

/**
 * Create an error response from a validation result
 */
export function validationErrorResponse(error: string, details?: z.ZodIssue[]) {
  return new Response(
    JSON.stringify({
      success: false,
      message: error,
      errors: details?.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }
  );
}

// ============ Type Exports ============

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type JoinTeamInput = z.infer<typeof joinTeamSchema>;
export type KickMemberInput = z.infer<typeof kickMemberSchema>;
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;
export type UpdateRoomCredentialsInput = z.infer<typeof updateRoomCredentialsSchema>;
export type RegisterTournamentInput = z.infer<typeof registerTournamentSchema>;
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
