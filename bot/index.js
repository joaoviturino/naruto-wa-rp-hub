// New Era Shinobi — WhatsApp bridge (Baileys da Itsuki)
// Agora roda via ponte /api/public/bot-bridge, sem expor a service role key.
import {
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { useSupabaseAuthState } from "./supabaseAuthState.js";
import { bridge } from "./bridge-client.js";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const waLogger = pino({ level: "silent" }); // silencia o ruído do Baileys
const QR_REQUEST_PREFIX = "__REQUEST_QR__";
let currentSock = null;
let drainInterval = null;
let keepAliveInterval = null;
let starting = false;
let lastHandledQrRequest = "";
let reconnectAttempts = 0;
let currentAuth = null; // { state, saveCreds, clearAll }

async function updateSession(fields) {
  await bridge.heartbeat({
    status: "disconnected",
    ...fields,
    last_seen_at: new Date().toISOString(),
  });
}

async function heartbeat() {
  try {
    await bridge.heartbeat({ status: "connecting" });
  } catch (err) {
    logger.warn({ err: String(err) }, "heartbeat falhou");
  }
}

// Heartbeat a cada 10s — o painel usa isso para saber se o bot está vivo.
setInterval(heartbeat, 10_000);
heartbeat();

function jidFromPhone(phone) {
  const digits = String(phone).replace(/[^\d]/g, "");
  return `${digits}@s.whatsapp.net`;
}

async function startBot() {
  if (starting) return;
  starting = true;
  try {
    const auth = await useSupabaseAuthState(null, logger);
    currentAuth = auth;
    const { state, saveCreds } = auth;
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
          // Sessão inválida — limpa auth no banco para gerar novo QR
          try { await auth.clearAll(); } catch {}
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
    try {
      const pending = await bridge.getOutboundMessages();
      for (const m of pending ?? []) {
        try {
          await sock.sendMessage(jidFromPhone(m.to_phone), { text: m.body });
          await bridge.updateMessageStatus(m.id, "sent", null);
          logger.info({ id: m.id, to: m.to_phone }, "Enviado");
        } catch (err) {
          await bridge.updateMessageStatus(m.id, "failed", String(err));
          logger.error({ id: m.id, err: String(err) }, "Falha ao enviar");
        }
      }
    } catch (err) {
      logger.error({ err: String(err) }, "Falha ao drenar fila");
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
  const oldAuth = currentAuth;
  currentSock = null;
  if (drainInterval) clearInterval(drainInterval);
  drainInterval = null;
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  keepAliveInterval = null;

  // Não chama logout() — é lento (chamada de rede) e frequentemente falha.
  // Basta encerrar o socket local e limpar o auth no banco.
  try { oldSock?.ev?.removeAllListeners?.(); } catch {}
  try { oldSock?.ws?.close?.(); } catch {}
  try { oldSock?.end?.(undefined); } catch {}

  try { await oldAuth?.clearAll?.(); } catch {}
  await updateSession({ status: "connecting", qr: null, phone: null });
  reconnectAttempts = 0;
  // Reinicia imediatamente — QR aparece em ~2s
  startBot().catch((err) => logger.error(err));
}

function watchQrRequests() {
  setInterval(async () => {
    try {
      const requestId = await bridge.getQrRequest();
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
