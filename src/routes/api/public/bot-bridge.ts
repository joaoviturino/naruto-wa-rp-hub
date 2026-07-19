import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const BOT_WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET;
const QR_REQUEST_PREFIX = "__REQUEST_QR__";

function rejectUnauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function verifySignature(body: string, signature: string | null, timestamp: string | null): boolean {
  if (!BOT_WEBHOOK_SECRET || !signature || !timestamp) return false;
  const ts = Number(timestamp);
  if (Number.isNaN(ts)) return false;
  const age = Date.now() - ts;
  if (age < 0 || age > 5 * 60 * 1000) return false; // 5 minutos de tolerância
  const expected = createHmac("sha256", BOT_WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/bot-bridge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("x-bot-signature");
        const timestamp = request.headers.get("x-bot-timestamp");
        const body = await request.text();

        if (!verifySignature(body, signature, timestamp)) {
          return rejectUnauthorized();
        }

        let payload: { action?: string; data?: unknown };
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { action, data } = payload;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();

        switch (action) {
          case "outbound-messages": {
            const { data: rows, error } = await supabaseAdmin
              .from("outbound_messages")
              .select("*")
              .eq("status", "pending")
              .order("created_at", { ascending: true })
              .limit(10);
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            return Response.json({ messages: rows ?? [] });
          }

          case "qr-request": {
            const { data: row, error } = await supabaseAdmin
              .from("bot_sessions")
              .select("qr")
              .eq("id", "default")
              .maybeSingle();
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            const requestId = typeof row?.qr === "string" && row.qr.startsWith(QR_REQUEST_PREFIX) ? row.qr : "";
            return Response.json({ requestId });
          }

          case "session": {
            const { data: row, error } = await supabaseAdmin
              .from("bot_sessions")
              .select("*")
              .eq("id", "default")
              .maybeSingle();
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            return Response.json({ session: row });
          }

          case "heartbeat": {
            const fields = data as Record<string, unknown>;
            const { error } = await supabaseAdmin.from("bot_sessions").upsert({
              id: "default",
              status: String(fields?.status ?? "connecting"),
              qr: fields?.qr === null ? null : fields?.qr ? String(fields.qr) : undefined,
              phone: fields?.phone === null ? null : fields?.phone ? String(fields.phone) : undefined,
              updated_at: now,
              last_seen_at: now,
            });
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            return Response.json({ ok: true });
          }

          case "message-status": {
            const { id, status, error: errText } = data as { id: string; status: string; error?: string | null };
            if (!id || !status) return new Response("Missing id/status", { status: 400 });
            const update: Record<string, unknown> = { status, sent_at: status === "sent" ? now : undefined };
            if (errText) update.error = errText;
            const { error } = await supabaseAdmin.from("outbound_messages").update(update).eq("id", id);
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            return Response.json({ ok: true });
          }

          case "auth-read": {
            const { key, sessionId } = data as { key: string; sessionId?: string };
            if (!key) return new Response("Missing key", { status: 400 });
            const { data: row, error } = await supabaseAdmin
              .from("bot_auth_state")
              .select("value")
              .eq("session_id", sessionId ?? "default")
              .eq("key", key)
              .maybeSingle();
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            return Response.json({ value: row?.value ?? null });
          }

          case "auth-write": {
            const { key, value, sessionId } = data as { key: string; value: unknown; sessionId?: string };
            if (!key) return new Response("Missing key", { status: 400 });
            if (value === null || value === undefined) {
              const { error } = await supabaseAdmin
                .from("bot_auth_state")
                .delete()
                .eq("session_id", sessionId ?? "default")
                .eq("key", key);
              if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            } else {
              const { error } = await supabaseAdmin.from("bot_auth_state").upsert({
                session_id: sessionId ?? "default",
                key,
                value,
                updated_at: now,
              });
              if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            }
            return Response.json({ ok: true });
          }

          case "auth-clear": {
            const { sessionId } = data as { sessionId?: string };
            const { error } = await supabaseAdmin
              .from("bot_auth_state")
              .delete()
              .eq("session_id", sessionId ?? "default");
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            return Response.json({ ok: true });
          }

          default:
            return new Response("Unknown action", { status: 400 });
        }
      },
    },
  },
});
