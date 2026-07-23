import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CharacterWizard } from "@/components/CharacterWizard";
import { CharacterSheet } from "@/components/CharacterSheet";
import { TutorialOverlay } from "@/components/TutorialOverlay";

export const Route = createFileRoute("/_authenticated/character")({
  component: CharacterPage,
});

function CharacterPage() {
  const { user } = Route.useRouteContext();
  const [loading, setLoading] = useState(true);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [tutorialDone, setTutorialDone] = useState(true);

  async function refresh() {
    setLoading(true);
    const { data } = await supabase
      .from("characters")
      .select("id,tutorial_completed")
      .eq("user_id", user.id)
      .maybeSingle();
    setCharacterId(data?.id ?? null);
    setTutorialDone(data?.tutorial_completed ?? true);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [user.id]);

  if (loading) return <div className="p-10 text-center text-muted-foreground">Consultando os pergaminhos…</div>;
  if (!characterId) return <CharacterWizard onDone={refresh} />;
  return (
    <>
      <CharacterSheet characterId={characterId} />
      {!tutorialDone && (
        <TutorialOverlay characterId={characterId} onDone={() => setTutorialDone(true)} />
      )}
    </>
  );
}