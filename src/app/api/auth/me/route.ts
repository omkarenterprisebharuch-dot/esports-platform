import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * GET /api/auth/me
 * Get current user info
 */
export async function GET(request: NextRequest) {
  try {
    const tokenUser = getUserFromRequest(request);

    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const result = await pool.query(
      "SELECT id, username, email, full_name, phone_number, is_host, is_verified, profile_picture_url, in_game_ids, wallet_balance FROM users WHERE id = $1",
      [tokenUser.id]
    );

    if (result.rows.length === 0) {
      return unauthorizedResponse("User not found");
    }

    const user = result.rows[0];
    return successResponse({
      ...user,
      avatar_url: user.profile_picture_url, // alias for frontend compatibility
      is_admin: user.username === "admin", // simulate is_admin based on username
    });
  } catch (error) {
    console.error("Get me error:", error);
    return serverErrorResponse(error);
  }
}
