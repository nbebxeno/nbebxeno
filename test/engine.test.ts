import assert from "node:assert/strict";
import test from "node:test";
import { GameEngine, GameError, ROLE_DATABASE } from "../src/engine.ts";

const players = ["ada", "bayo", "chidi", "dami", "eni"].map((id) => ({ id, displayName: id }));
const rules = { tieRule: "no-elimination" as const, revealRoleOnDeath: false };

test("assigns a shuffled five-player composition and keeps roles private", () => {
  const engine = GameEngine.create(players, rules, () => 0.25);
  const publicView = engine.publicView();
  assert.equal(publicView.players.length, 5);
  assert.equal("roles" in publicView, false);
  assert.equal(engine.privateView("ada").roleDefinition.name, engine.privateView("ada").role);
  assert.ok(Object.keys(ROLE_DATABASE).length >= 6);
});

test("rejects duplicate votes and resolves a majority vote", () => {
  const engine = GameEngine.create(players, rules, () => 0.25);
  engine.beginVoting();
  engine.submitVote("ada", "bayo");
  assert.throws(() => engine.submitVote("ada", "chidi"), GameError);
  engine.submitVote("bayo", "chidi");
  engine.submitVote("chidi", "bayo");
  engine.submitVote("dami", "bayo");
  engine.submitVote("eni", "bayo");
  assert.equal(engine.resolveVote(), "bayo");
  assert.equal(engine.publicView().deaths[0].cause, "vote");
  assert.equal(engine.publicView().phase, "night");
});

test("small Classic games retain the core pool", () => {
  const engine = GameEngine.create(players, rules, () => 0.99);
  assert.equal(players.some((player) => engine.privateView(player.id).role === "alpha-werewolf"), false);
});

test("requires every living player to vote", () => {
  const engine = GameEngine.create(players, rules);
  engine.beginVoting();
  engine.submitVote("ada", "bayo");
  assert.throws(() => engine.resolveVote(), /Every living player must vote/);
});

test("autoskips a timed vote with no submissions and keeps alive numbering compact", () => {
  const engine = GameEngine.create(players, rules, () => 0.25);
  engine.beginVoting();
  assert.equal(engine.resolveVote(true), null);
  assert.equal(engine.publicView().phase, "night");

  const restored = GameEngine.restore(engine.stateSnapshot(), rules);
  assert.deepEqual(restored.numberedAlivePlayers().map((entry) => entry.number), [1, 2, 3, 4, 5]);
});

test("supports beginner and chaos role presets", () => {
  assert.deepEqual(GameEngine.roleComposition(4, "beginner"), ["werewolf", "seer", "villager", "villager"]);
  const chaosRoles = GameEngine.roleComposition(5, "chaos", () => 0.5);
  assert.equal(chaosRoles[0], "alpha-werewolf");
  assert.equal(chaosRoles.length, 5);
  assert.ok(chaosRoles.every((role) => Object.hasOwn(ROLE_DATABASE, role)));
});

test("ends a one-Werewolf versus one-Villager game before it can freeze", () => {
  const engine = GameEngine.create(players, rules, () => 0.25);
  const state = engine.stateSnapshot();
  const wolfId = "ada";
  const villagerId = "bayo";
  state.alive = [wolfId, villagerId];
  state.roles = { [wolfId]: "werewolf", [villagerId]: "villager" };
  state.factions = { [wolfId]: "werewolves", [villagerId]: "village" };
  state.phase = "discussion";
  state.winner = null;
  const restored = GameEngine.restore(state, rules);
  restored.beginVoting();
  assert.equal(restored.publicView().status, "ended");
  assert.equal(restored.publicView().winner, "werewolves");
});
