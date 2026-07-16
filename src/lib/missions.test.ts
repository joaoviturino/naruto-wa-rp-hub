import { describe, it, expect } from "vitest";
import {
  snapshotMissionBaseline,
  computeDerivedProgress,
  isAccepted,
  isComplete,
} from "./missions.functions";

// Missão simples: coletar 3x item "kunai"
const collectMission = {
  id: "m1",
  objectives: [{ id: "o1", type: "collect_item", target_id: "kunai", count: 3 }],
};

const rankMission = {
  id: "m2",
  objectives: [{ id: "o1", type: "reach_rank", target_ref: "C", count: 1 }],
};

const levelMission = {
  id: "m3",
  objectives: [{ id: "o1", type: "reach_level", target_ref: 5, count: 1 }],
};

describe("isAccepted", () => {
  it("retorna false para progresso vazio", () => {
    expect(isAccepted({})).toBe(false);
    expect(isAccepted(null)).toBe(false);
  });
  it("retorna true somente quando __accepted === true", () => {
    expect(isAccepted({ __accepted: true })).toBe(true);
    expect(isAccepted({ __accepted: "sim" })).toBe(false);
  });
});

describe("snapshotMissionBaseline (baseline no aceite)", () => {
  it("captura a quantidade atual do item para coleta", () => {
    const inv = [{ item_id: "kunai", qty: 5 }];
    const base = snapshotMissionBaseline(collectMission, {}, inv, 1);
    expect(base.o1).toBe(5);
  });
  it("captura o rank atual", () => {
    const base = snapshotMissionBaseline(rankMission, { rank: "D" }, [], 1);
    expect(typeof base.o1).toBe("number");
  });
  it("captura o level atual", () => {
    const base = snapshotMissionBaseline(levelMission, {}, [], 4);
    expect(base.o1).toBe(4);
  });
});

describe("computeDerivedProgress (regressão do bug 'completo antes do aceite')", () => {
  it("NÃO conta itens já possuídos antes do aceite", () => {
    const inv = [{ item_id: "kunai", qty: 10 }];
    const baseline = snapshotMissionBaseline(collectMission, {}, inv, 1);
    const persisted = { __baseline: baseline } as any;
    const derived = computeDerivedProgress(collectMission, {}, inv, 1, persisted);
    expect(derived.o1).toBe(0);
    expect(isComplete(collectMission, derived)).toBe(false);
  });

  it("conta apenas o delta ganho após o aceite", () => {
    const invAntes = [{ item_id: "kunai", qty: 2 }];
    const baseline = snapshotMissionBaseline(collectMission, {}, invAntes, 1);
    const invDepois = [{ item_id: "kunai", qty: 4 }]; // ganhou 2
    const derived = computeDerivedProgress(
      collectMission,
      {},
      invDepois,
      1,
      { __baseline: baseline } as any,
    );
    expect(derived.o1).toBe(2);
    expect(isComplete(collectMission, derived)).toBe(false);
  });

  it("completa quando o delta atinge a quantidade requerida", () => {
    const invAntes: any[] = [];
    const baseline = snapshotMissionBaseline(collectMission, {}, invAntes, 1);
    const invDepois = [{ item_id: "kunai", qty: 3 }];
    const derived = computeDerivedProgress(
      collectMission,
      {},
      invDepois,
      1,
      { __baseline: baseline } as any,
    );
    expect(derived.o1).toBe(3);
    expect(isComplete(collectMission, derived)).toBe(true);
  });

  it("não completa reach_rank se o player já estava no rank ao aceitar", () => {
    const char = { rank: "C" };
    const baseline = snapshotMissionBaseline(rankMission, char, [], 1);
    const derived = computeDerivedProgress(rankMission, char, [], 1, { __baseline: baseline } as any);
    expect(isComplete(rankMission, derived)).toBe(false);
  });

  it("completa reach_rank ao promover após o aceite", () => {
    const baseline = snapshotMissionBaseline(rankMission, { rank: "D" }, [], 1);
    const derived = computeDerivedProgress(rankMission, { rank: "C" }, [], 1, { __baseline: baseline } as any);
    expect(isComplete(rankMission, derived)).toBe(true);
  });

  it("não completa reach_level se já estava no nível", () => {
    const baseline = snapshotMissionBaseline(levelMission, {}, [], 5);
    const derived = computeDerivedProgress(levelMission, {}, [], 5, { __baseline: baseline } as any);
    expect(isComplete(levelMission, derived)).toBe(false);
  });
});

describe("Fluxo aceitar → coletar → reivindicar (guarda anti-reivindicação)", () => {
  /**
   * Simula a trava do claimMission: a reivindicação só é permitida quando
   * __accepted === true E todos os objetivos derivados estão completos.
   */
  function canClaim(mission: any, char: any, inventory: any[], level: number, persisted: any) {
    if (!isAccepted(persisted)) return false;
    const derived = computeDerivedProgress(mission, char, inventory, level, persisted);
    return isComplete(mission, derived);
  }

  it("bloqueia reivindicação quando a missão nunca foi aceita, mesmo com itens no inventário", () => {
    const inv = [{ item_id: "kunai", qty: 10 }];
    expect(canClaim(collectMission, {}, inv, 1, {})).toBe(false);
    expect(canClaim(collectMission, {}, inv, 1, null)).toBe(false);
  });

  it("bloqueia reivindicação logo após o aceite (progresso zerado pelo baseline)", () => {
    const inv = [{ item_id: "kunai", qty: 10 }];
    const baseline = snapshotMissionBaseline(collectMission, {}, inv, 1);
    const persisted = { __accepted: true, __baseline: baseline } as any;
    expect(canClaim(collectMission, {}, inv, 1, persisted)).toBe(false);
  });

  it("permite reivindicação após aceite + coleta suficiente pós-aceite", () => {
    const invAntes: any[] = [];
    const baseline = snapshotMissionBaseline(collectMission, {}, invAntes, 1);
    const persisted = { __accepted: true, __baseline: baseline } as any;
    const invDepois = [{ item_id: "kunai", qty: 3 }];
    expect(canClaim(collectMission, {}, invDepois, 1, persisted)).toBe(true);
  });

  it("mantém baseline idempotente: aceitar duas vezes não zera progresso já ganho", () => {
    const invAntes: any[] = [];
    const baselineInicial = snapshotMissionBaseline(collectMission, {}, invAntes, 1);
    // jogador já ganhou 2 kunais
    const invMeio = [{ item_id: "kunai", qty: 2 }];
    // "aceitar de novo" NÃO deve sobrescrever o baseline original — testa que se
    // o baseline for preservado, o progresso continua contando corretamente.
    const persisted = { __accepted: true, __baseline: baselineInicial } as any;
    const derived = computeDerivedProgress(collectMission, {}, invMeio, 1, persisted);
    expect(derived.o1).toBe(2);
  });
});