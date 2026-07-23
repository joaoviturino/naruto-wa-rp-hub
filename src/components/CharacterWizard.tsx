import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { rollClan, createCharacter } from "@/lib/character.functions";
import { VILLAGES, ELEMENTS, RARITY_LABEL, RARITY_COLOR, type Village, type Element } from "@/lib/game";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import spriteMaleAsset from "@/assets/shinobi-male.png.asset.json";
import spriteAltAsset from "@/assets/shinobi-female.png.asset.json";

type Clan = { id: string; name: string; village: Village; rarity: "common"|"uncommon"|"rare"|"epic"|"legendary"; element_bonus: Element | null; description: string | null; weight: number };
type Gender = "masculino" | "feminino";

const MAX_REROLLS = 2;

const DDI_OPTIONS: { code: string; label: string; flag: string }[] = [
  { code: "+55", label: "Brasil", flag: "🇧🇷" },
  { code: "+351", label: "Portugal", flag: "🇵🇹" },
  { code: "+1", label: "EUA / Canadá", flag: "🇺🇸" },
  { code: "+34", label: "Espanha", flag: "🇪🇸" },
  { code: "+44", label: "Reino Unido", flag: "🇬🇧" },
  { code: "+49", label: "Alemanha", flag: "🇩🇪" },
  { code: "+33", label: "França", flag: "🇫🇷" },
  { code: "+39", label: "Itália", flag: "🇮🇹" },
  { code: "+81", label: "Japão", flag: "🇯🇵" },
  { code: "+52", label: "México", flag: "🇲🇽" },
  { code: "+54", label: "Argentina", flag: "🇦🇷" },
  { code: "+56", label: "Chile", flag: "🇨🇱" },
];

const SPRITE_OPTIONS = [
  { id: "male", label: "Shinobi da Capa", url: (spriteMaleAsset as { url: string }).url },
  { id: "female", label: "Kunoichi Errante", url: (spriteAltAsset as { url: string }).url },
];

export function CharacterWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState("");
  const [ddi, setDdi] = useState("+55");
  const [ddd, setDdd] = useState("");
  const [phoneNum, setPhoneNum] = useState("");
  const [village, setVillage] = useState<Village | null>(null);
  const [clan, setClan] = useState<Clan | null>(null);
  const [rerolls, setRerolls] = useState(0);
  const [element, setElement] = useState<Element | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [spriteUrl, setSpriteUrl] = useState<string | null>(null);
  const [age, setAge] = useState<string>("");
  const [appearance, setAppearance] = useState("");
  const [personality, setPersonality] = useState("");
  const [history, setHistory] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);

  const rollFn = useServerFn(rollClan);
  const createFn = useServerFn(createCharacter);

  const fullPhone = `${ddi}${ddd}${phoneNum}`.replace(/\s+/g, "");
  const phoneOk = /^\+?[1-9]\d{7,14}$/.test(fullPhone);

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
    if (!village || !clan || !element || !gender) return;
    setBusy(true);
    try {
      await createFn({
        data: {
          nickname,
          phone_e164: fullPhone,
          village,
          clan_id: clan.id,
          element_primary: element,
          gender,
          sprite_url: spriteUrl ?? undefined,
          age: age ? Number(age) : undefined,
          appearance, personality, history, bio,
          clan_rerolls_used: rerolls,
        },
      });
      toast.success("Ficha selada! Bem-vindo à vila.");
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-black">Criação do Shinobi</h1>
        <span className="text-sm text-gold">Passo {step} / 6</span>
      </div>

      {step === 1 && (
        <div className="scroll-panel rounded-lg p-6 space-y-4">
          <h2 className="font-display text-xl">Identidade</h2>
          <div>
            <Label htmlFor="nick">Nickname</Label>
            <Input id="nick" value={nickname} maxLength={40} onChange={(e) => setNickname(e.target.value)} placeholder="Ex: Kaen no Ryu" />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <div className="grid grid-cols-[140px_90px_1fr] gap-2 mt-1">
              <Select value={ddi} onValueChange={setDdi}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DDI_OPTIONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.code} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                value={ddd}
                onChange={(e) => setDdd(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="DDD"
              />
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                value={phoneNum}
                onChange={(e) => setPhoneNum(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="987654321"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Número completo: <span className="text-gold">{fullPhone || "—"}</span>
            </p>
          </div>
          <Button disabled={nickname.length < 2 || !phoneOk} onClick={() => setStep(2)}>Continuar</Button>
        </div>
      )}

      {step === 2 && (
        <div className="scroll-panel rounded-lg p-6">
          <h2 className="font-display text-xl mb-2">Escolha sua vila</h2>
          <div className="mb-4 flex items-start gap-2 rounded border border-destructive/60 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
            <div>
              <b className="text-destructive">Escolha irreversível.</b> Sua vila não poderá ser alterada depois.
              A opção <b>Nômade</b> não pertence a nenhuma vila nem clã — quem escolher ficará sem clã, sem técnicas de clã e sem hierarquia.
            </div>
          </div>
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
            <Button
              disabled={!village}
              onClick={() => {
                if (!village) return;
                if (!confirm(`Confirmar ${village.toUpperCase()} como sua vila? Esta escolha é DEFINITIVA.`)) return;
                setStep(3);
                doRoll(village);
              }}
            >
              Confirmar vila e sortear clã
            </Button>
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
            <Button variant="outline" disabled={busy || rerolls >= MAX_REROLLS} onClick={reroll}>
              Rerolar ({MAX_REROLLS - rerolls} restantes)
            </Button>
            <Button disabled={!clan || busy} onClick={() => setStep(4)}>Aceitar clã</Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Vila já selada — não é possível retornar para escolher outra.</p>
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
        <div className="scroll-panel rounded-lg p-6 space-y-6">
          <div>
            <h2 className="font-display text-xl mb-3">Gênero</h2>
            <div className="grid grid-cols-2 gap-3">
              {(["masculino","feminino"] as Gender[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`p-4 rounded border transition text-center capitalize ${gender === g ? "border-gold bg-secondary" : "border-border hover:border-gold/60"}`}
                >
                  <div className="font-display text-3xl text-gold">{g === "masculino" ? "♂" : "♀"}</div>
                  <div className="mt-1 text-sm">{g}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-display text-xl mb-1">Aparência inicial</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Escolha um dos 2 modelos disponíveis. Ele ficará provisoriamente no seu inventário para uso em batalhas até que você faça upload da sua própria arte.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {SPRITE_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSpriteUrl(s.url)}
                  className={`p-3 rounded border transition ${spriteUrl === s.url ? "border-gold bg-secondary" : "border-border hover:border-gold/60"}`}
                >
                  <div className="h-56 flex items-center justify-center bg-background/40 rounded overflow-hidden">
                    <img src={s.url} alt={s.label} className="h-full object-contain" />
                  </div>
                  <div className="mt-2 text-sm">{s.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(4)}>Voltar</Button>
            <Button disabled={!gender || !spriteUrl} onClick={() => setStep(6)}>Continuar</Button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="scroll-panel rounded-lg p-6 space-y-4">
          <h2 className="font-display text-xl">Ficha do personagem</h2>
          <p className="text-sm text-muted-foreground">Preencha estilo Akatsuki RPG. Habilidades, itens e conhecimentos entrarão pelo databook depois.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Idade</Label>
              <Input type="number" inputMode="numeric" min={8} max={120} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Ex: 17" />
            </div>
            <div>
              <Label>Frase / bio curta</Label>
              <Input value={bio} maxLength={140} onChange={(e) => setBio(e.target.value)} placeholder="Ex: A chama que arde nunca se apaga." />
            </div>
          </div>
          <div>
            <Label>Aparência</Label>
            <Textarea
              rows={3}
              value={appearance}
              onChange={(e) => setAppearance(e.target.value)}
              placeholder="Altura, cor de cabelo e olhos, marcas, vestimenta. Ex: 1,72m, cabelo negro espetado, olhos castanhos, cicatriz vertical no queixo, colete jounin desgastado."
            />
          </div>
          <div>
            <Label>Personalidade</Label>
            <Textarea
              rows={3}
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Traços marcantes, virtudes e defeitos, como age em combate e fora dele. Ex: leal, sarcástico, evita conflitos desnecessários mas nunca recua diante de injustiça."
            />
          </div>
          <div>
            <Label>História</Label>
            <Textarea
              rows={5}
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              placeholder="Passado: origem, família, eventos marcantes, motivação atual. Ex: filho de mercadores, perdeu os pais numa emboscada aos 9 anos e foi acolhido pela vila; treina para descobrir os responsáveis."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setStep(5)}>Voltar</Button>
            <Button disabled={busy} onClick={submit}>{busy ? "Selando..." : "Selar ficha"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}