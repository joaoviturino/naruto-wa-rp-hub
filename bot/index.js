// New Era Shinobi — WhatsApp bridge (Baileys da Itsuki)
// Roda em VPS/Railway/Fly. Não é hospedado na web da Lovable.
import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
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

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const waLogger = pino({ level: "silent" }); // silencia o ruído do Baileys
const AUTH_DIR = process.env.BOT_AUTH_DIR || "auth_state";
const QR_REQUEST_PREFIX = "__REQUEST_QR__";
let currentSock = null;
let drainInterval = null;
let keepAliveInterval = null;
let starting = false;
let lastHandledQrRequest = "";
let reconnectAttempts = 0;

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
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, waLogger),
      },
      logger: waLogger,
      browser: ["New Era Shinobi", "Chrome", "120.0"],
      // Conexão estável 24/7
      keepAliveIntervalMs: 25_000,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: undefined, // não expira queries — evita queda "Timed Out"
      qrTimeout: 60_000,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      emitOwnEvents: false,
      generateHighQualityLinkPreview: false,
    });
    currentSock = sock;

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
        reconnectAttempts = 0;
        const me = sock.user?.id?.split(":")[0]?.split("@")[0] ?? null;
        logger.info({ me }, "Conectado ao WhatsApp");
        await updateSession({ status: "connected", qr: null, phone: me });
      }
      if (connection === "close") {
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        await updateSession({ status: "disconnected", qr: null });
        logger.warn({ code, loggedOut }, "Conexão caiu");
        if (loggedOut) {
          // Sessão inválida — limpa auth para gerar novo QR na próxima
          try { await rm(AUTH_DIR, { recursive: true, force: true }); } catch {}
          if (currentSock === sock) setTimeout(() => startBot().catch(logger.error), 1500);
        } else if (currentSock === sock) {
          // Backoff exponencial limitado (max 30s) — reconecta sozinho
          reconnectAttempts++;
          const delay = Math.min(30_000, 1000 * Math.pow(1.6, reconnectAttempts));
          logger.info({ delay }, "Reagendando reconexão");
          setTimeout(() => startBot().catch(logger.error), delay);
        }
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

    // Keep-alive extra: envia presença a cada 4 min para o WA não derrubar por inatividade
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    keepAliveInterval = setInterval(async () => {
      if (currentSock === sock && sock.user) {
        try { await sock.sendPresenceUpdate("available"); }
        catch (err) { logger.warn({ err: String(err) }, "keep-alive falhou"); }
      }
    }, 4 * 60 * 1000);

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
  } finally {
    starting = false;
  }
}

async function restartForFreshQr() {
  const oldSock = currentSock;
  currentSock = null;
  if (drainInterval) clearInterval(drainInterval);
  drainInterval = null;
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  keepAliveInterval = null;

  // Não chama logout() — é lento (chamada de rede) e frequentemente falha.
  // Basta encerrar o socket local e apagar o auth_state.
  try { oldSock?.ev?.removeAllListeners?.(); } catch {}
  try { oldSock?.ws?.close?.(); } catch {}
  try { oldSock?.end?.(undefined); } catch {}

  await rm(AUTH_DIR, { recursive: true, force: true });
  await updateSession({ status: "connecting", qr: null, phone: null });
  reconnectAttempts = 0;
  // Reinicia imediatamente — QR aparece em ~2s
  startBot().catch((err) => logger.error(err));
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