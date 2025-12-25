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
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tournaments/[id]
 * Get tournament by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const result = await pool.query(
      `SELECT 
        t.*,
        u.username as host_name,
        CASE
          WHEN t.tournament_end_date <= NOW() THEN 'completed'
          WHEN t.tournament_start_date <= NOW() THEN 'ongoing'
          WHEN t.registration_end_date <= NOW() THEN 'upcoming'
          WHEN t.registration_start_date <= NOW() THEN 'registration_open'
          ELSE 'upcoming'
        END as computed_status,
        CASE
          WHEN t.registration_start_date > NOW() THEN 
            EXTRACT(EPOCH FROM (t.registration_start_date - NOW()))
          WHEN t.registration_end_date > NOW() THEN 
            EXTRACT(EPOCH FROM (t.registration_end_date - NOW()))
          WHEN t.tournament_start_date > NOW() THEN 
            EXTRACT(EPOCH FROM (t.tournament_start_date - NOW()))
          WHEN t.tournament_end_date > NOW() THEN 
            EXTRACT(EPOCH FROM (t.tournament_end_date - NOW()))
          ELSE 0
        END as seconds_to_next_status
      FROM tournaments t
      JOIN users u ON t.host_id = u.id
      WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return notFoundResponse("Tournament not found");
    }

    const tournament = {
      ...result.rows[0],
      status: result.rows[0].computed_status,
    };

    return successResponse({ tournament });
  } catch (error) {
    console.error("Get tournament error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * PUT /api/tournaments/[id]
 * Update tournament (Host/Admin only)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    // Check if user owns this tournament or is admin
    const tournamentResult = await pool.query(
      "SELECT * FROM tournaments WHERE id = $1",
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return notFoundResponse("Tournament not found");
    }

    const tournament = tournamentResult.rows[0];

    // Check permissions (host can edit their own, or user named "admin")
    const userResult = await pool.query(
      "SELECT is_host, username FROM users WHERE id = $1",
      [user.id]
    );
    const dbUser = userResult.rows[0];

    if (
      tournament.host_id !== user.id &&
      dbUser?.username !== "admin"
    ) {
      return errorResponse("Not authorized to update this tournament", 403);
    }

    // Check if tournament has already started (no edits allowed after start)
    const tournamentStartDate = new Date(tournament.tournament_start_date);
    if (new Date() >= tournamentStartDate) {
      return errorResponse("Cannot edit tournament after it has started", 400);
    }

    // Check if tournament has registrations (limit editable fields)
    const registrationsResult = await pool.query(
      "SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = $1 AND status != 'cancelled'",
      [id]
    );
    const hasRegistrations = parseInt(registrationsResult.rows[0].count) > 0;

    const body = await request.json();

    // Build update query based on what fields are allowed
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Note: prize_pool and entry_fee are NEVER allowed to be changed after creation
    const allowedFields = hasRegistrations
      ? [
          "description",
          "match_rules",
          "map_name",
          "tournament_banner_url",
          "room_id",
          "room_password",
        ]
      : [
          "tournament_name",
          "description",
          "game_type",
          "tournament_type",
          "max_teams",
          "match_rules",
          "map_name",
          "registration_start_date",
          "registration_end_date",
          "tournament_start_date",
          "tournament_end_date",
          "tournament_banner_url",
          "room_id",
          "room_password",
        ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;

        // Track room credentials update
        if (field === "room_id" || field === "room_password") {
          updates.push(`room_credentials_updated_at = NOW()`);
        }
      }
    }

    if (updates.length === 0) {
      return errorResponse("No valid fields to update");
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const updateResult = await pool.query(
      `UPDATE tournaments SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return successResponse(
      { tournament: updateResult.rows[0] },
      "Tournament updated successfully"
    );
  } catch (error) {
    console.error("Update tournament error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * DELETE /api/tournaments/[id]
 * Delete tournament (Admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    // Check if user is admin (by username)
    const userResult = await pool.query(
      "SELECT is_host, username FROM users WHERE id = $1",
      [user.id]
    );
    const dbUser = userResult.rows[0];

    if (dbUser?.username !== "admin") {
      return errorResponse("Only admins can delete tournaments", 403);
    }

    // Check if tournament exists
    const tournamentResult = await pool.query(
      "SELECT id FROM tournaments WHERE id = $1",
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return notFoundResponse("Tournament not found");
    }

    // Delete tournament (cascades to registrations, matches, etc.)
    await pool.query("DELETE FROM tournaments WHERE id = $1", [id]);

    return successResponse(null, "Tournament deleted successfully");
  } catch (error) {
    console.error("Delete tournament error:", error);
    return serverErrorResponse(error);
  }
}
