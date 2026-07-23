import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TutorialOverlay } from "@/components/TutorialOverlay";

export function TutorialWatcher({ userId }: { userId: string }) {
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("characters")
        .select("id,tutorial_completed")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      setCharacterId(data?.id ?? null);
      setPending(!!data && !data.tutorial_completed);
    }
    load();
    const t = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, [userId]);

  if (!characterId || !pending) return null;
  return <TutorialOverlay characterId={characterId} onDone={() => setPending(false)} />;
}