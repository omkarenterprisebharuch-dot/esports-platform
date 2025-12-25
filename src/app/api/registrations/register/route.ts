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
import { validateWithSchema, validationErrorResponse, uuidSchema } from "@/lib/validations";

// Schema for tournament registration
const registerTournamentSchema = z.object({
  tournament_id: uuidSchema,
  team_id: uuidSchema.optional(),
  selected_players: z.array(uuidSchema).optional(),
  backup_players: z.array(uuidSchema).optional(),
});

/**
 * POST /api/registrations/register
 * Register for a tournament
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    
    // Validate input with Zod
    const validation = validateWithSchema(registerTournamentSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const { tournament_id, team_id, selected_players, backup_players } = validation.data;

    const result = await withTransaction(async (client) => {
      // Get tournament details
      const tournamentResult = await client.query(
        `SELECT * FROM tournaments WHERE id = $1`,
        [tournament_id]
      );

      if (tournamentResult.rows.length === 0) {
        throw new Error("Tournament not found");
      }

      const tournament = tournamentResult.rows[0];

      // Check tournament status
      if (
        tournament.status !== "registration_open" &&
        tournament.status !== "upcoming"
      ) {
        throw new Error("Registration is not open for this tournament");
      }

      // Check if slots are available
      if (tournament.current_teams >= tournament.max_teams) {
        throw new Error("Tournament is full");
      }

      // Get user profile
      const userResult = await client.query(
        `SELECT id, username, in_game_ids FROM users WHERE id = $1`,
        [user.id]
      );
      const dbUser = userResult.rows[0];

      // Validate game UID
      const gameType = tournament.game_type;
      const userGameId = dbUser.in_game_ids?.[gameType];

      if (!userGameId) {
        throw new Error(
          `Please add your ${gameType.toUpperCase()} game ID in your profile before registering`
        );
      }

      const tournamentType = tournament.tournament_type;

      if (tournamentType === "solo") {
        // SOLO REGISTRATION
        const existingReg = await client.query(
          `SELECT id FROM tournament_registrations 
           WHERE tournament_id = $1 AND user_id = $2 AND status != 'cancelled'`,
          [tournament_id, user.id]
        );

        if (existingReg.rows.length > 0) {
          throw new Error("You are already registered for this tournament");
        }

        // Get next slot number
        const slotResult = await client.query(
          `SELECT COALESCE(MAX(slot_number), 0) + 1 as next_slot 
           FROM tournament_registrations WHERE tournament_id = $1`,
          [tournament_id]
        );
        const slotNumber = slotResult.rows[0].next_slot;

        // Create solo registration
        const regResult = await client.query(
          `INSERT INTO tournament_registrations 
           (tournament_id, user_id, registration_type, slot_number, status)
           VALUES ($1, $2, 'solo', $3, 'registered')
           RETURNING *`,
          [tournament_id, user.id, slotNumber]
        );

        // Update tournament team count
        await client.query(
          `UPDATE tournaments SET current_teams = current_teams + 1 WHERE id = $1`,
          [tournament_id]
        );

        return {
          registration: regResult.rows[0],
          slot_number: slotNumber,
        };
      } else {
        // DUO/SQUAD REGISTRATION
        if (!team_id) {
          throw new Error(
            `Team ID is required for ${tournamentType} tournaments`
          );
        }

        // Check if user is team member
        const memberCheck = await client.query(
          `SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL`,
          [team_id, user.id]
        );

        if (memberCheck.rows.length === 0) {
          throw new Error("You are not a member of this team");
        }

        // Check if team already registered
        const existingTeamReg = await client.query(
          `SELECT id FROM tournament_registrations 
           WHERE tournament_id = $1 AND team_id = $2 AND status != 'cancelled'`,
          [tournament_id, team_id]
        );

        if (existingTeamReg.rows.length > 0) {
          throw new Error("This team is already registered for this tournament");
        }

        // Get next slot number
        const slotResult = await client.query(
          `SELECT COALESCE(MAX(slot_number), 0) + 1 as next_slot 
           FROM tournament_registrations WHERE tournament_id = $1`,
          [tournament_id]
        );
        const slotNumber = slotResult.rows[0].next_slot;

        // Create team registration
        const regResult = await client.query(
          `INSERT INTO tournament_registrations 
           (tournament_id, team_id, user_id, registration_type, slot_number, selected_players, backup_players, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'registered')
           RETURNING *`,
          [
            tournament_id,
            team_id,
            user.id,
            tournamentType,
            slotNumber,
            JSON.stringify(selected_players || [user.id]),
            JSON.stringify(backup_players || []),
          ]
        );

        // Update tournament team count
        await client.query(
          `UPDATE tournaments SET current_teams = current_teams + 1 WHERE id = $1`,
          [tournament_id]
        );

        return {
          registration: regResult.rows[0],
          slot_number: slotNumber,
        };
      }
    });

    return successResponse(
      result,
      "Successfully registered for the tournament",
      201
    );
  } catch (error) {
    console.error("Registration error:", error);
    if (error instanceof Error) {
      return errorResponse(error.message);
    }
    return serverErrorResponse(error);
  }
}
