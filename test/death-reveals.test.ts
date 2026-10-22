import assert from "node:assert/strict";
import test from "node:test";
import { GameEngine } from "../src/engine.ts";
import { deceasedLabel, statusCard } from "../src/presentation.ts";

const players = ["wolf", "seer", "doctor", "villager", "extra"].map((id) => ({ id, displayName: id }));
function create(revealRoleOnDeath: boolean) {
  const rules = { tieRule: "no-elimination" as const, revealRoleOnDeath };
  const state = GameEngine.create(players, rules).stateSnapshot();
  state.roles = { wolf: "werewolf", seer: "seer", doctor: "doctor", villager: "villager", extra: "villager" };
  state.factions = { wolf: "werewolves", seer: "village", doctor: "village", villager: "village", extra: "village" };
  return { rules, engine: GameEngine.restore(state, rules) };
}

for (const reveal of [true, false]) {
  test(`vote deaths respect revealRoleOnDeath=${reveal} and preserve living-player secrecy`, () => {
    const { engine, rules } = create(reveal);
    engine.beginVoting();
    for (const player of players) engine.submitVote(player.id, "doctor");
    engine.resolveVote();
    const view = engine.publicView();
    assert.equal(view.deaths[0].role, reveal ? "doctor" : undefined);
    assert.equal("roles" in view, false);
    const text = statusCard(view, 120);
    assert.equal(text.includes("doctor — Doctor"), reveal);
    assert.doesNotMatch(text, /wolf — Werewolf|seer — Seer/);
    const restored = GameEngine.restore(engine.stateSnapshot(), rules);
    assert.equal(restored.publicView().deaths[0].role, reveal ? "doctor" : undefined);
  });
}

test("night deaths reveal the deceased role and old saves without death-role fields still work", () => {
  const { engine, rules } = create(true);
  engine.beginNight();
  engine.submitNightAction("wolf", { type: "werewolf-target", targetId: "seer" });
  engine.resolveNight(true);
  assert.equal(deceasedLabel(engine.publicView(), "seer"), "seer — Seer");
  const state = engine.stateSnapshot();
  delete state.deaths[0].role;
  const restored = GameEngine.restore(state, rules);
  assert.equal(restored.publicView().deaths[0].role, "seer");
});
