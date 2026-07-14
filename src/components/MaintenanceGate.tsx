import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Wrench } from "lucide-react";

type ServerConfig = {
  maintenance_enabled: boolean;
  maintenance_title: string;
  maintenance_message: string;
  maintenance_image_url: string | null;
  maintenance_eta: string | null;
};

export function MaintenanceGate({ isAdmin, children }: { isAdmin: boolean; children: ReactNode }) {
  const [cfg, setCfg] = useState<ServerConfig | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await supabase
        .from("server_config")
        .select("maintenance_enabled,maintenance_title,maintenance_message,maintenance_image_url,maintenance_eta")
        .eq("id", "main")
        .maybeSingle();
      if (alive) { setCfg(data as ServerConfig | null); setLoaded(true); }
    }
    load();
    const ch = supabase
      .channel("server_config_gate")
      .on("postgres_changes", { event: "*", schema: "public", table: "server_config" }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  if (!loaded) return null;
  if (!cfg?.maintenance_enabled || isAdmin) return <>{children}</>;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex items-center justify-center p-3 sm:p-6">
      <div className="scroll-panel rounded-lg w-full max-w-[min(92vw,640px)] p-4 sm:p-6 md:p-8 text-center space-y-4 max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
        <div className="inline-flex items-center gap-2 rounded-full bg-gold/10 text-gold px-3 py-1 text-xs uppercase tracking-widest">
          <Wrench size={14} /> Manutenção
        </div>
        {cfg.maintenance_image_url && (
          <img
            src={cfg.maintenance_image_url}
            alt="Manutenção"
            className="rounded-md mx-auto block h-auto w-auto max-w-full max-h-[min(50dvh,420px)] object-contain"
          />
        )}
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-black text-gold break-words">{cfg.maintenance_title}</h1>
        <p className="whitespace-pre-wrap break-words text-muted-foreground text-sm sm:text-base">{cfg.maintenance_message}</p>
        {cfg.maintenance_eta && (
          <div className="text-xs text-muted-foreground">
            Previsão de retorno: <span className="text-foreground font-semibold">{new Date(cfg.maintenance_eta).toLocaleString()}</span>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}>
          <LogOut size={14} /> Sair
        </Button>
      </div>
    </div>
  );
}