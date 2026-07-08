// New Era Shinobi — WhatsApp bridge (Baileys da Itsuki)
// Roda em VPS/Railway/Fly. Não é hospedado na web da Lovable.
import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@itsukichann/baileys";
import { Boom } from "@hapi/boom";
import { createClient } from "@supabase/supabase-js";
import { rm } from "node:fs/promises";
import pino from "pino";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltando SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nas envs.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const logger = pino({ level: "info" });
const AUTH_DIR = process.env.BOT_AUTH_DIR || "auth_state";
const QR_REQUEST_PREFIX = "__REQUEST_QR__";
let currentSock = null;
let drainInterval = null;
let starting = false;
let lastHandledQrRequest = "";

async function updateSession(fields) {
  await supabase.from("bot_sessions").upsert({ id: "default", updated_at: new Date().toISOString(), ...fields });
}

function jidFromPhone(phone) {
  const digits = String(phone).replace(/[^\d]/g, "");
  return `${digits}@s.whatsapp.net`;
}

async function startBot() {
  if (starting) return;
  starting = true;
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: true,
    browser: ["New Era Shinobi", "Chrome", "1.0"],
  });
  currentSock = sock;
  starting = false;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (u) => {
    if (currentSock !== sock) return;
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      logger.info("QR gerado — abra o admin para escanear");
      await updateSession({ status: "qr", qr, phone: null });
    }
    if (connection === "connecting") await updateSession({ status: "connecting" });
    if (connection === "open") {
      const me = sock.user?.id?.split(":")[0]?.split("@")[0] ?? null;
      logger.info({ me }, "Conectado ao WhatsApp");
      await updateSession({ status: "connected", qr: null, phone: me });
    }
    if (connection === "close") {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      await updateSession({ status: "disconnected", qr: null });
      logger.warn({ code, loggedOut }, "Conexão caiu");
      if (!loggedOut && currentSock === sock) setTimeout(startBot, 3000);
    }
  });

  // Poll a fila a cada 3s
  async function drain() {
    const { data: pending, error } = await supabase
      .from("outbound_messages")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);
    if (error) return logger.error(error);
    for (const m of pending ?? []) {
      try {
        await sock.sendMessage(jidFromPhone(m.to_phone), { text: m.body });
        await supabase.from("outbound_messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", m.id);
        logger.info({ id: m.id, to: m.to_phone }, "Enviado");
      } catch (err) {
        await supabase.from("outbound_messages").update({ status: "failed", error: String(err) }).eq("id", m.id);
        logger.error({ id: m.id, err: String(err) }, "Falha ao enviar");
      }
    }
  }

  if (drainInterval) clearInterval(drainInterval);
  drainInterval = setInterval(() => { if (currentSock === sock && sock.user) drain().catch(logger.error); }, 3000);

  // Placeholder para lidar com mensagens recebidas (implementar RPG in-chat depois)
  sock.ev.on("messages.upsert", async ({ messages }) => {
    if (currentSock !== sock) return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const text = msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? "";
      logger.info({ from: msg.key.remoteJid, text }, "mensagem recebida");
      // TODO: comandos do RPG (!ajuda, !ficha, !treinar ...)
    }
  });
}

async function restartForFreshQr() {
  const oldSock = currentSock;
  currentSock = null;
  if (drainInterval) clearInterval(drainInterval);
  drainInterval = null;

  try {
    if (oldSock?.logout) await oldSock.logout();
  } catch (err) {
    logger.warn({ err: String(err) }, "logout ignorado ao gerar novo QR");
  }

  try {
    if (oldSock?.end) oldSock.end(undefined);
  } catch (err) {
    logger.warn({ err: String(err) }, "end ignorado ao gerar novo QR");
  }

  await rm(AUTH_DIR, { recursive: true, force: true });
  await updateSession({ status: "connecting", qr: null, phone: null });
  setTimeout(() => startBot().catch((err) => logger.error(err)), 1000);
}

function watchQrRequests() {
  setInterval(async () => {
    try {
      const { data, error } = await supabase
        .from("bot_sessions")
        .select("qr")
        .eq("id", "default")
        .maybeSingle();
      if (error) throw error;
      const requestId = typeof data?.qr === "string" && data.qr.startsWith(QR_REQUEST_PREFIX) ? data.qr : "";
      if (!requestId || requestId === lastHandledQrRequest) return;
      lastHandledQrRequest = requestId;
      logger.info("Pedido de QR recebido pelo painel admin");
      await restartForFreshQr();
    } catch (err) {
      logger.error({ err: String(err) }, "Falha ao verificar pedido de QR");
    }
  }, 2500);
}

startBot().catch((e) => {
  logger.error(e);
  process.exit(1);
});
watchQrRequests();