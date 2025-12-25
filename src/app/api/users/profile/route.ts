import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { z } from "zod";
import { validateWithSchema, validationErrorResponse } from "@/lib/validations";

// Schema for updating profile
const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens")
    .optional(),
  full_name: z
    .string()
    .max(100, "Full name must be less than 100 characters")
    .optional(),
  phone_number: z
    .string()
    .max(20, "Phone number must be less than 20 characters")
    .regex(/^[\d\s\-+()]*$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
  in_game_ids: z.record(z.string().max(50)).optional(),
  avatar_url: z
    .string()
    .url("Invalid avatar URL")
    .optional()
    .or(z.literal("")),
}).refine((data) => {
  return Object.values(data).some(v => v !== undefined);
}, {
  message: "At least one field must be provided for update",
});

/**
 * GET /api/users/profile
 * Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const result = await pool.query(
      `SELECT 
        id, 
        username, 
        email, 
        full_name,
        phone_number,
        in_game_ids,
        is_host, 
        is_verified,
        profile_picture_url, 
        wallet_balance,
        created_at
      FROM users WHERE id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return unauthorizedResponse("User not found");
    }

    const userData = result.rows[0];
    return successResponse({ 
      user: {
        ...userData,
        avatar_url: userData.profile_picture_url,
      }
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    
    // Validate input with Zod
    const validation = validateWithSchema(updateProfileSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const { username, phone_number, in_game_ids, avatar_url, full_name } = validation.data;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (username !== undefined) {
      // Check if username is taken
      const existing = await pool.query(
        "SELECT id FROM users WHERE username = $1 AND id != $2",
        [username, user.id]
      );
      if (existing.rows.length > 0) {
        return errorResponse("Username is already taken");
      }
      updates.push(`username = $${paramIndex}`);
      values.push(username);
      paramIndex++;
    }

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramIndex}`);
      values.push(full_name);
      paramIndex++;
    }

    if (phone_number !== undefined) {
      updates.push(`phone_number = $${paramIndex}`);
      values.push(phone_number);
      paramIndex++;
    }

    if (in_game_ids !== undefined) {
      updates.push(`in_game_ids = $${paramIndex}`);
      values.push(JSON.stringify(in_game_ids));
      paramIndex++;
    }

    if (avatar_url !== undefined) {
      updates.push(`profile_picture_url = $${paramIndex}`);
      values.push(avatar_url);
      paramIndex++;
    }

    if (updates.length === 0) {
      // This shouldn't happen due to Zod validation, but keep as safety
      return errorResponse("No fields to update");
    }

    updates.push(`updated_at = NOW()`);
    values.push(user.id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex} 
       RETURNING id, username, email, full_name, phone_number, in_game_ids, is_host, profile_picture_url as avatar_url`,
      values
    );

    return successResponse(
      { user: result.rows[0] },
      "Profile updated successfully"
    );
  } catch (error) {
    console.error("Update profile error:", error);
    return serverErrorResponse(error);
  }
}
