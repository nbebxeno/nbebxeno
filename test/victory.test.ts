import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameEngine } from "../src/engine.ts";
import { GameSessions } from "../src/session.ts";
import { victoryCard } from "../src/presentation.ts";

const member = (id: string, role: string) => ({ id, displayName: id, role });
test("Werewolf announcement lists every winning faction member, including deceased wolves, with personal winners separately", () => {
  const dir = mkdtempSync(join(tmpdir(), "lordxeno-victory-"));
  try {
    const players = ["Alpha", "Wolf", "Fool", "Villager"].map((id) => ({ id, displayName: id }));
    const rules = { tieRule: "no-elimination" as const, revealRoleOnDeath: true };
    const state = GameEngine.create(players, rules).stateSnapshot();
    state.roles = { Alpha: "alpha-werewolf", Wolf: "werewolf", Fool: "fool", Villager: "villager" };
    state.factions = { Alpha: "werewolves", Wolf: "werewolves", Fool: "neutral", Villager: "village" };
    state.alive = ["Alpha", "Villager"]; state.status = "ended"; state.phase = "ended"; state.winner = "werewolves"; state.individualWinners = ["Fool"];
    const file = join(dir, "games.json");
    writeFileSync(file, JSON.stringify([{ groupId: "group", hostId: "Alpha", players, aliases: [], engineState: state }]));
    const sessions = new GameSessions(rules, file);
    const card = victoryCard(sessions.victorySummary("group"));
    assert.match(card, /WEREWOLVES WIN!/);
    assert.match(card, /1\. Alpha — Alpha Werewolf\n2\. Wolf — Werewolf/);
    assert.match(card, /Personal winners\*\n1\. Fool — Fool/);
    assert.doesNotMatch(card, /Villager —/);
    sessions.completedRecord("group");
    assert.equal(victoryCard(sessions.victorySummary("group")), card);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("Village, exclusive Neutral, and draw announcements use correct lists and do not treat all Neutrals as winners", () => {
  assert.match(victoryCard({ winner: "village", team: [member("Ada", "seer")], personal: [] }), /VILLAGE WINS![\s\S]*Ada — Seer/);
  const neutral = victoryCard({ winner: "neutral", team: [member("Bayo", "arsonist")], personal: [member("Chidi", "fool")] });
  assert.match(neutral, /NEUTRAL VICTORY![\s\S]*Winning team\*\n1\. Bayo — Arsonist[\s\S]*Personal winners\*\n1\. Chidi — Fool/);
  assert.match(victoryCard({ winner: "neutral", team: [], personal: [] }), /No winners this game/);
});
