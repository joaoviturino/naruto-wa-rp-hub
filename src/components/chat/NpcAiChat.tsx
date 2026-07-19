import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendNpcPrivateMessage, listNpcPrivateHistory, clearNpcPrivateHistory } from "@/lib/npc-ai.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Trash2, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

type AiNpc = { id: string; name: string; image_url: string | null; ai_mode: "public" | "private" | "both" };
type PrivMsg = { id?: string; role: "user" | "assistant"; content: string; created_at?: string };

export function NpcAiChat({ locationId }: { locationId: string }) {
  const [npcs, setNpcs] = useState<AiNpc[]>([]);
  const [open, setOpen] = useState<AiNpc | null>(null);
  const [history, setHistory] = useState<PrivMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const sendFn = useServerFn(sendNpcPrivateMessage);
  const listFn = useServerFn(listNpcPrivateHistory);
  const clearFn = useServerFn(clearNpcPrivateHistory);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("location_npcs")
        .select("npc:npcs(id,name,image_url,ai_enabled,ai_mode)")
        .eq("location_id", locationId);
      const list = ((data as any[]) ?? [])
        .map((r) => r.npc)
        .filter((n) => n && n.ai_enabled && (n.ai_mode === "private" || n.ai_mode === "both"))
        .map((n) => ({ id: n.id, name: n.name, image_url: n.image_url, ai_mode: n.ai_mode }));
      setNpcs(list);
    })();
  }, [locationId]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const r = (await listFn({ data: { npcId: open.id } } as any)) as PrivMsg[];
      setHistory(r ?? []);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    })();
  }, [open?.id]);

  async function send() {
    if (!open || !input.trim() || busy) return;
    const content = input.trim();
    setInput("");
    setBusy(true);
    setHistory((h) => [...h, { role: "user", content }]);
    try {
      const r = (await sendFn({ data: { npcId: open.id, content } } as any)) as any;
      setHistory((h) => [...h.filter((m) => m !== h[h.length - 1] || m.content !== content || m.role !== "user"), r.user, r.assistant]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar");
      setHistory((h) => h.slice(0, -1));
      setInput(content);
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  if (npcs.length === 0) return null;

  return (
    <>
      <div className="border border-emerald-500/30 bg-emerald-950/20 rounded-lg p-2 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 px-1">Falar em particular</div>
        <div className="flex flex-wrap gap-2">
          {npcs.map((n) => (
            <button key={n.id}
              onClick={() => setOpen(n)}
              className="flex items-center gap-2 px-2 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-xs">
              <div className="w-6 h-6 rounded-full bg-secondary overflow-hidden shrink-0">
                {n.image_url && <img src={n.image_url} className="w-full h-full object-cover" alt="" />}
              </div>
              <span className="truncate max-w-[110px]">{n.name}</span>
              <MessageCircle size={12} className="text-emerald-300" />
            </button>
          ))}
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={(o) => { if (!o) setOpen(null); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {open && (
            <>
              <DialogHeader className="p-3 border-b border-border flex flex-row items-center gap-3 space-y-0">
                <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden ring-2 ring-emerald-500/50 shrink-0">
                  {open.image_url && <img src={open.image_url} className="w-full h-full object-cover" alt="" />}
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base font-display truncate">{open.name}</DialogTitle>
                  <div className="text-[10px] text-muted-foreground">Conversa particular</div>
                </div>
                <Button variant="ghost" size="icon" title="Limpar histórico"
                  onClick={async () => { await clearFn({ data: { npcId: open.id } } as any); setHistory([]); }}>
                  <Trash2 size={14} />
                </Button>
              </DialogHeader>

              <div className="h-[420px] overflow-y-auto p-3 space-y-2 bg-background/50">
                {history.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-10">
                    Diga algo para começar a conversa.
                  </div>
                )}
                {history.map((m, i) => (
                  <div key={m.id ?? i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg p-2 text-sm whitespace-pre-wrap ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-emerald-950/40 border border-emerald-500/30"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex justify-start">
                    <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-2 text-xs text-emerald-300 flex items-center gap-2">
                      <Loader2 size={12} className="animate-spin" /> pensando…
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <div className="p-2 border-t border-border flex gap-2 bg-card">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="❕️ ação   ou   - fala"
                  disabled={busy}
                />
                <Button onClick={send} disabled={busy || !input.trim()}>
                  <Send size={14} />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}