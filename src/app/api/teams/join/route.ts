import { NextRequest } from "next/server";
import pool, { withTransaction } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { z } from "zod";
import { validateWithSchema, validationErrorResponse } from "@/lib/validations";

// Schema for joining a team
const joinTeamSchema = z.object({
  invite_code: z
    .string()
    .min(1, "Invite code is required")
    .max(20, "Invalid invite code")
    .trim(),
  game_uid: z
    .string()
    .min(1, "Game UID is required")
    .max(50, "Game UID must be less than 50 characters"),
  game_name: z
    .string()
    .min(1, "Game name is required")
    .max(50, "Game name must be less than 50 characters"),
});

/**
 * POST /api/teams/join
 * Join a team using invite code
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    
    // Validate input with Zod
    const validation = validateWithSchema(joinTeamSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const { invite_code, game_uid, game_name } = validation.data;

    const result = await withTransaction(async (client) => {
      // Find team by invite code
      const teamResult = await client.query(
        "SELECT * FROM teams WHERE team_code = $1 AND is_active = TRUE",
        [invite_code]
      );

      if (teamResult.rows.length === 0) {
        throw new Error("Invalid invite code or team not found");
      }

      const team = teamResult.rows[0];

      // Check if team is full
      if (team.total_members >= team.max_members) {
        throw new Error("Team is full (max 6 members)");
      }

      // Check if user is already a member
      const existingMember = await client.query(
        "SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL",
        [team.id, user.id]
      );

      if (existingMember.rows.length > 0) {
        throw new Error("You are already a member of this team");
      }

      // Add user to team
      await client.query(
        `INSERT INTO team_members (team_id, user_id, role, game_uid, game_name)
         VALUES ($1, $2, 'member', $3, $4)`,
        [team.id, user.id, game_uid, game_name]
      );

      // Update team member count
      await client.query(
        "UPDATE teams SET total_members = total_members + 1 WHERE id = $1",
        [team.id]
      );

      return team;
    });

    return successResponse(
      {
        team: {
          id: result.id,
          team_name: result.team_name,
          team_code: result.team_code,
        },
      },
      "Successfully joined the team"
    );
  } catch (error) {
    console.error("Join team error:", error);
    if (error instanceof Error) {
      return errorResponse(error.message);
    }
    return serverErrorResponse(error);
  }
}
