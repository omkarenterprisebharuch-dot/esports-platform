import { NextRequest } from "next/server";
import webpush from "web-push";
import { query, queryOne } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getUserFromRequest } from "@/lib/auth";
import { z } from "zod";
import { validateWithSchema, validationErrorResponse, uuidSchema } from "@/lib/validations";

// Schema for sending notification
const sendNotificationSchema = z.object({
  tournamentId: uuidSchema.optional(),
  userIds: z.array(uuidSchema).optional(),
  title: z.string().min(1, "Title is required").max(100, "Title must be less than 100 characters"),
  body: z.string().min(1, "Body is required").max(500, "Body must be less than 500 characters"),
  url: z.string().url("Invalid URL").optional(),
  type: z.enum(["general", "room_credentials", "tournament_update", "reminder"]).optional().default("general"),
});

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:noreply@esportsplatform.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

interface PushSubscriptionDB {
  id: string;
  user_id: number;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  url?: string;
  tournamentId?: string;
  type?: string;
  requireInteraction?: boolean;
  actions?: { action: string; title: string }[];
}

/**
 * POST /api/notifications/send
 * Send push notification to specific users or all users in a tournament
 * Admin/Host only
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    // Only hosts can send notifications
    if (!user.is_host) {
      return errorResponse("Only hosts can send notifications", 403);
    }

    const body = await request.json();
    
    // Validate input with Zod
    const validation = validateWithSchema(sendNotificationSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const {
      tournamentId,
      userIds,
      title,
      body: notificationBody,
      url,
      type,
    } = validation.data;

    // Build notification payload
    const payload: NotificationPayload = {
      title,
      body: notificationBody,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      url: url || (tournamentId ? `/tournament/${tournamentId}` : "/dashboard"),
      tournamentId,
      type,
      requireInteraction: type === "room_credentials", // Important notifications stay visible
      actions: [
        { action: "view", title: "View" },
        { action: "dismiss", title: "Dismiss" },
      ],
    };

    // Get subscriptions based on target
    let subscriptions: PushSubscriptionDB[];

    if (tournamentId) {
      // Send to all registered users in a tournament
      subscriptions = await query<PushSubscriptionDB>(
        `SELECT ps.id, ps.user_id, ps.endpoint, ps.p256dh_key, ps.auth_key
         FROM push_subscriptions ps
         INNER JOIN tournament_registrations tr ON tr.user_id = ps.user_id
         WHERE tr.tournament_id = $1 
           AND tr.status != 'cancelled'
           AND ps.is_active = TRUE`,
        [tournamentId]
      );
    } else if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      // Send to specific users
      subscriptions = await query<PushSubscriptionDB>(
        `SELECT id, user_id, endpoint, p256dh_key, auth_key
         FROM push_subscriptions
         WHERE user_id = ANY($1) AND is_active = TRUE`,
        [userIds]
      );
    } else {
      return errorResponse("Either tournamentId or userIds is required", 400);
    }

    if (subscriptions.length === 0) {
      return successResponse({
        message: "No active subscriptions found",
        sent: 0,
        failed: 0,
      });
    }

    // Send notifications
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh_key,
                auth: sub.auth_key,
              },
            },
            JSON.stringify(payload)
          );

          // Update last_used_at
          await query(
            `UPDATE push_subscriptions SET last_used_at = NOW() WHERE id = $1`,
            [sub.id]
          );

          return { success: true, userId: sub.user_id };
        } catch (error: unknown) {
          // Handle expired/invalid subscriptions
          const webPushError = error as { statusCode?: number };
          if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
            // Subscription expired, mark as inactive
            await query(
              `UPDATE push_subscriptions SET is_active = FALSE WHERE id = $1`,
              [sub.id]
            );
          }
          return { success: false, userId: sub.user_id, error };
        }
      })
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failed = results.length - sent;

    console.log(`[Push] Sent: ${sent}, Failed: ${failed}`);

    return successResponse({
      message: `Notifications sent`,
      sent,
      failed,
      total: subscriptions.length,
    });
  } catch (error) {
    console.error("Error sending notifications:", error);
    return errorResponse("Failed to send notifications", 500);
  }
}
