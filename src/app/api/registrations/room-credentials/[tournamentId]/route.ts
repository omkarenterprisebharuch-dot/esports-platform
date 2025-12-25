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
  params: Promise<{ tournamentId: string }>;
}

/**
 * GET /api/registrations/room-credentials/[tournamentId]
 * Get room credentials for a tournament (only for registered users after tournament starts)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { tournamentId } = await params;
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    // Check if user is registered for this tournament
    const registrationResult = await pool.query(
      `SELECT tr.id 
       FROM tournament_registrations tr
       WHERE tr.tournament_id = $1 
         AND (tr.user_id = $2 OR tr.selected_players::text LIKE '%' || $2::text || '%')
         AND tr.status != 'cancelled'`,
      [tournamentId, user.id]
    );

    if (registrationResult.rows.length === 0) {
      return errorResponse(
        "You are not registered for this tournament",
        403
      );
    }

    // Get tournament with room credentials
    const tournamentResult = await pool.query(
      `SELECT 
        id,
        tournament_name,
        room_id,
        room_password,
        room_credentials_updated_at,
        tournament_start_date,
        registration_end_date
      FROM tournaments 
      WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return notFoundResponse("Tournament not found");
    }

    const tournament = tournamentResult.rows[0];

    // Check if registration has ended (room credentials visible after reg ends)
    const now = new Date();
    const regEndDate = new Date(tournament.registration_end_date);

    if (now < regEndDate) {
      return errorResponse(
        "Room credentials will be available after registration closes",
        403
      );
    }

    // Check if room credentials are set
    if (!tournament.room_id && !tournament.room_password) {
      return successResponse({
        tournament_id: tournament.id,
        tournament_name: tournament.tournament_name,
        room_id: null,
        room_password: null,
        message: "Room credentials not yet updated by host",
      });
    }

    return successResponse({
      tournament_id: tournament.id,
      tournament_name: tournament.tournament_name,
      room_id: tournament.room_id,
      room_password: tournament.room_password,
      updated_at: tournament.room_credentials_updated_at,
    });
  } catch (error) {
    console.error("Get room credentials error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * PUT /api/registrations/room-credentials/[tournamentId]
 * Update room credentials for a tournament (only for host/admin)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { tournamentId } = await params;
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { room_id, room_password } = body;

    if (!room_id || !room_password) {
      return errorResponse("Room ID and Password are required");
    }

    // Get tournament and verify ownership
    const tournamentResult = await pool.query(
      `SELECT id, host_id, tournament_start_date FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return notFoundResponse("Tournament not found");
    }

    const tournament = tournamentResult.rows[0];

    // Check if user is the host
    if (tournament.host_id !== user.id) {
      return errorResponse("Only the tournament host can update room credentials", 403);
    }

    // Check if tournament start time has arrived
    const now = new Date();
    const startDate = new Date(tournament.tournament_start_date);

    if (now < startDate) {
      return errorResponse("Room credentials can only be shared after tournament start time");
    }

    // Update room credentials
    await pool.query(
      `UPDATE tournaments 
       SET room_id = $1, room_password = $2, room_credentials_updated_at = NOW()
       WHERE id = $3`,
      [room_id, room_password, tournamentId]
    );

    return successResponse(
      { tournament_id: tournamentId },
      "Room credentials updated successfully"
    );
  } catch (error) {
    console.error("Update room credentials error:", error);
    return serverErrorResponse(error);
  }
}
