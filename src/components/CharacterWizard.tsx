import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { rollClan, createCharacter } from "@/lib/character.functions";
import { VILLAGES, ELEMENTS, RARITY_LABEL, RARITY_COLOR, type Village, type Element } from "@/lib/game";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Clan = { id: string; name: string; village: Village; rarity: "common"|"uncommon"|"rare"|"epic"|"legendary"; element_bonus: Element | null; description: string | null; weight: number };

const MAX_REROLLS = 2;

export function CharacterWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState<Village | null>(null);
  const [clan, setClan] = useState<Clan | null>(null);
  const [rerolls, setRerolls] = useState(0);
  const [element, setElement] = useState<Element | null>(null);
  const [age, setAge] = useState<string>("");
  const [appearance, setAppearance] = useState("");
  const [personality, setPersonality] = useState("");
  const [history, setHistory] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);

  const rollFn = useServerFn(rollClan);
  const createFn = useServerFn(createCharacter);

  async function doRoll(v: Village) {
    setBusy(true);
    try {
      const c = (await rollFn({ data: { village: v } })) as Clan;
      setClan(c);
      if (c.element_bonus && !element) setElement(c.element_bonus);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function reroll() {
    if (!village || rerolls >= MAX_REROLLS) return;
    setRerolls(rerolls + 1);
    await doRoll(village);
  }

  async function submit() {
    if (!village || !clan || !element) return;
    setBusy(true);
    try {
      await createFn({
        data: {
          nickname, phone_e164: phone, village, clan_id: clan.id, element_primary: element,
          age: age ? Number(age) : undefined,
          appearance, personality, history, bio,
          clan_rerolls_used: rerolls,
        },
      });
      toast.success("Ficha selada! Verifique seu WhatsApp.");
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-black">Criação do Shinobi</h1>
        <span className="text-sm text-gold">Passo {step} / 5</span>
      </div>

      {step === 1 && (
        <div className="scroll-panel rounded-lg p-6 space-y-4">
          <h2 className="font-display text-xl">Identidade</h2>
          <div>
            <Label htmlFor="nick">Nickname</Label>
            <Input id="nick" value={nickname} maxLength={40} onChange={(e) => setNickname(e.target.value)} placeholder="Ex: Kaen no Ryu" />
          </div>
          <div>
            <Label htmlFor="phone">WhatsApp (com DDI e DDD)</Label>
            <Input id="phone" inputMode="numeric" pattern="[0-9+]*" value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
              placeholder="+5511987654321" />
            <p className="mt-1 text-xs text-muted-foreground">Você receberá uma mensagem de boas-vindas neste número.</p>
          </div>
          <Button disabled={nickname.length < 2 || phone.length < 8} onClick={() => setStep(2)}>Continuar</Button>
        </div>
      )}

      {step === 2 && (
        <div className="scroll-panel rounded-lg p-6">
          <h2 className="font-display text-xl mb-4">Escolha sua vila</h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {VILLAGES.map((v) => (
              <button key={v.id}
                onClick={() => setVillage(v.id)}
                className={`text-left p-4 rounded border transition ${village === v.id ? "border-gold bg-secondary" : "border-border hover:border-gold/60"}`}>
                <div className="font-display text-2xl text-gold">{v.kanji}</div>
                <div className="font-semibold">{v.name}</div>
                <div className="text-xs text-muted-foreground">{v.blurb}</div>
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
            <Button disabled={!village} onClick={() => { setStep(3); if (village) doRoll(village); }}>Sortear clã</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="scroll-panel rounded-lg p-6 text-center">
          <h2 className="font-display text-xl">Sorteio do clã</h2>
          <p className="text-sm text-muted-foreground">Rerolls usados: {rerolls} / {MAX_REROLLS}</p>
          {busy && <p className="mt-6 text-gold">Rolando o pergaminho…</p>}
          {!busy && clan && (
            <div className={`mt-6 rounded-lg border-2 p-8 ${clan.rarity === "legendary" ? "clan-glow-legendary" : clan.rarity === "epic" ? "clan-glow-epic" : clan.rarity === "rare" ? "clan-glow-rare" : "border-border"}`}>
              <div className={`text-sm uppercase tracking-widest ${RARITY_COLOR[clan.rarity]}`}>{RARITY_LABEL[clan.rarity]}</div>
              <div className="mt-2 font-display text-4xl font-black">{clan.name}</div>
              {clan.element_bonus && (
                <div className="mt-3 text-sm text-gold">Afinidade natural: {clan.element_bonus.toUpperCase()}</div>
              )}
              {clan.description && <p className="mt-4 text-sm text-muted-foreground">{clan.description}</p>}
            </div>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
            <Button variant="outline" disabled={busy || rerolls >= MAX_REROLLS} onClick={reroll}>
              Rerolar ({MAX_REROLLS - rerolls} restantes)
            </Button>
            <Button disabled={!clan || busy} onClick={() => setStep(4)}>Aceitar clã</Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="scroll-panel rounded-lg p-6">
          <h2 className="font-display text-xl mb-4">Afinidade elemental</h2>
          {clan?.element_bonus && (
            <p className="text-sm text-gold mb-4">Seu clã sugere <b>{clan.element_bonus.toUpperCase()}</b>, mas você pode escolher outro elemento base.</p>
          )}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
            {ELEMENTS.map((e) => (
              <button key={e.id} onClick={() => setElement(e.id)}
                className={`p-4 rounded border transition text-center ${element === e.id ? "border-gold bg-secondary" : "border-border hover:border-gold/60"}`}>
                <div className="font-display text-4xl" style={{ color: e.color }}>{e.kanji}</div>
                <div className="mt-2 text-xs">{e.name}</div>
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)}>Voltar</Button>
            <Button disabled={!element} onClick={() => setStep(5)}>Continuar</Button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="scroll-panel rounded-lg p-6 space-y-4">
          <h2 className="font-display text-xl">Ficha do personagem</h2>
          <p className="text-sm text-muted-foreground">Preencha estilo Akatsuki RPG. Habilidades, itens e conhecimentos entrarão pelo databook depois.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Idade</Label>
              <Input type="number" min={8} max={120} value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div>
              <Label>Frase / bio curta</Label>
              <Input value={bio} maxLength={140} onChange={(e) => setBio(e.target.value)} placeholder="Ex: A chama que arde nunca se apaga." />
            </div>
          </div>
          <div>
            <Label>Aparência</Label>
            <Textarea rows={3} value={appearance} onChange={(e) => setAppearance(e.target.value)} />
          </div>
          <div>
            <Label>Personalidade</Label>
            <Textarea rows={3} value={personality} onChange={(e) => setPersonality(e.target.value)} />
          </div>
          <div>
            <Label>História</Label>
            <Textarea rows={5} value={history} onChange={(e) => setHistory(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setStep(4)}>Voltar</Button>
            <Button disabled={busy} onClick={submit}>{busy ? "Selando..." : "Selar ficha"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}