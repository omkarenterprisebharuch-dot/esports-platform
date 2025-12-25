import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

/**
 * GET /api/teams/[teamId]
 * Get team details with members
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { teamId } = await params;
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    // Get team details
    const teamResult = await pool.query(
      `SELECT 
        t.*,
        u.username as captain_name
      FROM teams t
      JOIN users u ON t.captain_id = u.id
      WHERE t.id = $1 AND t.is_active = TRUE`,
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      return notFoundResponse("Team not found");
    }

    const team = teamResult.rows[0];

    // Get team members
    const membersResult = await pool.query(
      `SELECT 
        tm.id,
        tm.user_id,
        tm.role,
        tm.game_uid,
        tm.game_name,
        tm.joined_at,
        u.username,
        u.profile_picture_url as avatar_url
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1 AND tm.left_at IS NULL
      ORDER BY tm.role = 'captain' DESC, tm.joined_at ASC`,
      [teamId]
    );

    return successResponse({
      team: {
        ...team,
        members: membersResult.rows,
        is_captain: team.captain_id === user.id,
      },
    });
  } catch (error) {
    console.error("Get team error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * DELETE /api/teams/[teamId]
 * Delete team (captain only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { teamId } = await params;
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    // Check if user is captain
    const teamResult = await pool.query(
      "SELECT captain_id FROM teams WHERE id = $1 AND is_active = TRUE",
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      return notFoundResponse("Team not found");
    }

    if (teamResult.rows[0].captain_id !== user.id) {
      return errorResponse("Only the team captain can delete the team", 403);
    }

    // Soft delete team
    await pool.query(
      "UPDATE teams SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
      [teamId]
    );

    return successResponse(null, "Team deleted successfully");
  } catch (error) {
    console.error("Delete team error:", error);
    return serverErrorResponse(error);
  }
}
