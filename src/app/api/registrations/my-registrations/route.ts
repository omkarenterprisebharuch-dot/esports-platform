import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * GET /api/registrations/my-registrations
 * Get user's tournament registrations
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const result = await pool.query(
      `SELECT DISTINCT ON (t.id)
        tr.id as registration_id,
        tr.slot_number,
        tr.registration_type,
        tr.status as registration_status,
        tr.registered_at,
        tr.selected_players,
        tr.backup_players,
        t.id as tournament_id,
        t.tournament_name,
        t.game_type,
        t.tournament_type,
        t.description,
        t.tournament_banner_url,
        t.prize_pool,
        t.entry_fee,
        t.tournament_start_date,
        t.tournament_end_date,
        t.registration_start_date,
        t.registration_end_date,
        t.room_id,
        t.room_password,
        t.room_credentials_updated_at,
        CASE
          WHEN t.tournament_end_date <= NOW() THEN 'completed'
          WHEN t.tournament_start_date <= NOW() THEN 'ongoing'
          WHEN t.registration_end_date <= NOW() THEN 'upcoming'
          WHEN t.registration_start_date <= NOW() THEN 'registration_open'
          ELSE 'upcoming'
        END as computed_status,
        u.username as host_name,
        team.team_name
      FROM tournament_registrations tr
      JOIN tournaments t ON tr.tournament_id = t.id
      JOIN users u ON t.host_id = u.id
      LEFT JOIN teams team ON tr.team_id = team.id
      LEFT JOIN team_members tm ON tr.team_id = tm.team_id AND tm.left_at IS NULL
      WHERE tr.user_id = $1 
        OR (tr.selected_players::text LIKE '%' || $1::text || '%')
        OR tm.user_id = $1
      ORDER BY t.id, t.tournament_start_date DESC`,
      [user.id]
    );

    // Map to include computed status
    const registrations = result.rows.map((r) => ({
      ...r,
      status: r.computed_status,
    }));

    return successResponse({ registrations });
  } catch (error) {
    console.error("Get my registrations error:", error);
    return serverErrorResponse(error);
  }
}
