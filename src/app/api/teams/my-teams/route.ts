import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * GET /api/teams/my-teams
 * Get current user's teams
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const result = await pool.query(
      `SELECT 
        t.id,
        t.team_name,
        t.team_code,
        t.total_members,
        t.max_members,
        t.created_at,
        tm.role,
        tm.game_uid,
        tm.game_name,
        u.username as captain_name,
        CASE WHEN t.captain_id = $1 THEN true ELSE false END as is_captain,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND left_at IS NULL) as member_count
      FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      JOIN users u ON t.captain_id = u.id
      WHERE tm.user_id = $1 AND tm.left_at IS NULL AND t.is_active = TRUE
      ORDER BY t.created_at DESC`,
      [user.id]
    );

    return successResponse({ teams: result.rows });
  } catch (error) {
    console.error("Get my teams error:", error);
    return serverErrorResponse(error);
  }
}
