// Cliente da ponte /api/public/bot-bridge.
// O bot pode rodar no PC do host sem precisar da SUPABASE_SERVICE_ROLE_KEY.
// Ele se autentica via HMAC-SHA256 usando BOT_WEBHOOK_SECRET.
import { createHmac } from "crypto";

const BOT_BRIDGE_URL = process.env.BOT_BRIDGE_URL?.replace(/\/$/, "");
const BOT_WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET;

if (!BOT_BRIDGE_URL || !BOT_WEBHOOK_SECRET) {
  console.error("Faltando BOT_BRIDGE_URL ou BOT_WEBHOOK_SECRET nas envs.");
  process.exit(1);
}

function sign(body) {
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", BOT_WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return { timestamp, signature };
}

async function call(action, data = {}) {
  const body = JSON.stringify({ action, data });
  const { timestamp, signature } = sign(body);
  const res = await fetch(`${BOT_BRIDGE_URL}/api/public/bot-bridge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bot-signature": signature,
      "x-bot-timestamp": timestamp,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Bridge ${action} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export const bridge = {
  async getOutboundMessages() {
    const { messages } = await call("outbound-messages");
    return messages ?? [];
  },
  async getQrRequest() {
    const { requestId } = await call("qr-request");
    return requestId;
  },
  async getSession() {
    const { session } = await call("session");
    return session;
  },
  async heartbeat(fields) {
    return call("heartbeat", fields);
  },
  async updateMessageStatus(id, status, error = null) {
    return call("message-status", { id, status, error });
  },
  async authRead(key, sessionId) {
    const { value } = await call("auth-read", { key, sessionId });
    return value;
  },
  async authWrite(key, value, sessionId) {
    return call("auth-write", { key, value, sessionId });
  },
  async authClear(sessionId) {
    return call("auth-clear", { sessionId });
  },
};
