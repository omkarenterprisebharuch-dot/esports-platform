import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * GET /api/tournaments
 * Get all tournaments with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const gameType = searchParams.get("game_type");
    const filter = searchParams.get("filter");
    const hosted = searchParams.get("hosted");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Get user for hosted filter
    let userId: number | null = null;
    if (hosted === "true") {
      const user = getUserFromRequest(request);
      if (!user) {
        return unauthorizedResponse();
      }
      userId = user.id;
    }

    let query = `
      SELECT 
        t.*,
        u.username as host_name,
        -- Dynamic status calculation
        CASE
          WHEN t.tournament_end_date <= NOW() THEN 'completed'
          WHEN t.tournament_start_date <= NOW() THEN 'ongoing'
          WHEN t.registration_end_date <= NOW() THEN 'upcoming'
          WHEN t.registration_start_date <= NOW() THEN 'registration_open'
          ELSE 'upcoming'
        END as computed_status,
        -- Time until next status change
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
        END as seconds_to_next_status,
        -- Next status change type
        CASE
          WHEN t.registration_start_date > NOW() THEN 'registration_start'
          WHEN t.registration_end_date > NOW() THEN 'registration_end'
          WHEN t.tournament_start_date > NOW() THEN 'tournament_start'
          WHEN t.tournament_end_date > NOW() THEN 'tournament_end'
          ELSE 'completed'
        END as next_status_change
      FROM tournaments t
      JOIN users u ON t.host_id = u.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    // Filter by host
    if (hosted === "true" && userId) {
      query += ` AND t.host_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    // Filter by computed status
    if (filter === "upcoming") {
      query += ` AND t.registration_start_date > NOW()`;
    } else if (filter === "live") {
      query += ` AND t.registration_start_date <= NOW() AND t.registration_end_date > NOW()`;
    } else if (filter === "active") {
      query += ` AND t.registration_end_date > NOW()`;
    } else if (filter === "ongoing") {
      query += ` AND t.tournament_start_date <= NOW() AND t.tournament_end_date > NOW()`;
    }

    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (gameType) {
      query += ` AND t.game_type = $${paramIndex}`;
      params.push(gameType);
      paramIndex++;
    }

    query += ` ORDER BY t.registration_start_date ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Replace status with computed_status
    const tournaments = result.rows.map((t) => ({
      ...t,
      status: t.computed_status,
    }));

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM tournaments WHERE 1=1`;

    if (filter === "upcoming") {
      countQuery += ` AND registration_start_date > NOW()`;
    } else if (filter === "live") {
      countQuery += ` AND registration_start_date <= NOW() AND registration_end_date > NOW()`;
    } else if (filter === "active") {
      countQuery += ` AND registration_end_date > NOW()`;
    }

    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].count);

    return successResponse(
      {
        tournaments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      undefined,
      200,
      // Cache for 30 seconds, allow stale for 60 seconds while revalidating
      { maxAge: 30, staleWhileRevalidate: 60, isPrivate: false }
    );
  } catch (error) {
    console.error("Get tournaments error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/tournaments
 * Create a new tournament (Host/Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    // Check if user is host or admin (by username)
    const userResult = await pool.query(
      "SELECT is_host, username FROM users WHERE id = $1",
      [user.id]
    );
    const dbUser = userResult.rows[0];

    if (!dbUser?.is_host && dbUser?.username !== "admin") {
      return errorResponse("Only hosts can create tournaments", 403);
    }

    const body = await request.json();
    const {
      tournament_name,
      description,
      prize_pool,
      tournament_start_date,
      tournament_end_date,
      game_type,
      tournament_type,
      max_teams,
      entry_fee,
      match_rules,
      map_name,
      registration_start_date,
      registration_end_date,
      total_matches,
      tournament_banner_url,
    } = body;

    // Validate required fields
    if (
      !tournament_name ||
      !description ||
      prize_pool === undefined ||
      !tournament_start_date ||
      !tournament_end_date
    ) {
      return errorResponse(
        "Tournament name, description, prize pool, start date, and end date are required"
      );
    }

    const result = await pool.query(
      `INSERT INTO tournaments (
        host_id,
        tournament_name,
        game_type,
        tournament_type,
        description,
        tournament_banner_url,
        max_teams,
        entry_fee,
        prize_pool,
        match_rules,
        map_name,
        total_matches,
        status,
        registration_start_date,
        registration_end_date,
        tournament_start_date,
        tournament_end_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        user.id,
        tournament_name,
        game_type || "freefire",
        tournament_type || "squad",
        description,
        tournament_banner_url || null,
        max_teams || 100,
        entry_fee || 0,
        prize_pool,
        match_rules || "",
        map_name || "",
        total_matches || 1,
        "upcoming",
        registration_start_date || new Date(),
        registration_end_date || tournament_start_date,
        tournament_start_date,
        tournament_end_date,
      ]
    );

    return successResponse(
      { tournament: result.rows[0] },
      "Tournament created successfully",
      201
    );
  } catch (error) {
    console.error("Create tournament error:", error);
    return serverErrorResponse(error);
  }
}
