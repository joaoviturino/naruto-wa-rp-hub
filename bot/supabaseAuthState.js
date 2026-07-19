// Persiste o auth state do Baileys na ponte /api/public/bot-bridge.
// Sobrevive a redeploy/reboot do PC — não precisa mais da pasta auth_state/.
import { initAuthCreds, BufferJSON, proto } from "@whiskeysockets/baileys";
import { bridge } from "./bridge-client.js";

const SESSION_ID = process.env.BOT_SESSION_ID || "default";

function encode(value) {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer));
}
function decode(value) {
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver);
}

export async function useSupabaseAuthState(_supabase, logger) {
  async function readKey(key) {
    try {
      const value = await bridge.authRead(key, SESSION_ID);
      if (value === null || value === undefined) return null;
      return decode(value);
    } catch (err) {
      logger?.warn({ err: String(err), key }, "auth read falhou");
      return null;
    }
  }

  async function writeKey(key, value) {
    try {
      if (value === null || value === undefined) {
        await bridge.authWrite(key, null, SESSION_ID);
      } else {
        await bridge.authWrite(key, encode(value), SESSION_ID);
      }
    } catch (err) {
      logger?.warn({ err: String(err), key }, "auth write falhou");
    }
  }

  const creds = (await readKey("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const out = {};
          await Promise.all(ids.map(async (id) => {
            let val = await readKey(`${type}-${id}`);
            if (type === "app-state-sync-key" && val) val = proto.Message.AppStateSyncKeyData.fromObject(val);
            if (val) out[id] = val;
          }));
          return out;
        },
        set: async (data) => {
          const tasks = [];
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              tasks.push(writeKey(`${category}-${id}`, data[category][id]));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => { await writeKey("creds", creds); },
    clearAll: async () => {
      try { await bridge.authClear(SESSION_ID); }
      catch (err) { logger?.warn({ err: String(err) }, "auth clear falhou"); }
    },
  };
}
