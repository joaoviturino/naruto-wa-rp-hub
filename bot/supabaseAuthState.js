// Persiste o auth state do Baileys no Supabase (tabela public.bot_auth_state).
// Sobrevive a redeploy/reboot do VPS — não precisa mais da pasta auth_state/.
import { initAuthCreds, BufferJSON, proto } from "@whiskeysockets/baileys";

const SESSION_ID = process.env.BOT_SESSION_ID || "default";

function encode(value) {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer));
}
function decode(value) {
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver);
}

export async function useSupabaseAuthState(supabase, logger) {
  async function readKey(key) {
    const { data, error } = await supabase
      .from("bot_auth_state")
      .select("value")
      .eq("session_id", SESSION_ID)
      .eq("key", key)
      .maybeSingle();
    if (error) { logger?.warn({ err: String(error), key }, "auth read falhou"); return null; }
    return data ? decode(data.value) : null;
  }

  async function writeKey(key, value) {
    if (value === null || value === undefined) {
      const { error } = await supabase.from("bot_auth_state")
        .delete().eq("session_id", SESSION_ID).eq("key", key);
      if (error) logger?.warn({ err: String(error), key }, "auth delete falhou");
      return;
    }
    const { error } = await supabase.from("bot_auth_state").upsert({
      session_id: SESSION_ID, key, value: encode(value), updated_at: new Date().toISOString(),
    });
    if (error) logger?.warn({ err: String(error), key }, "auth write falhou");
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
      const { error } = await supabase.from("bot_auth_state").delete().eq("session_id", SESSION_ID);
      if (error) logger?.warn({ err: String(error) }, "auth clear falhou");
    },
  };
}