import assert from "node:assert/strict";
import test from "node:test";
import { GameSessions } from "../src/session.ts";

const rules = { tieRule: "no-elimination" as const, revealRoleOnDeath: false };
const players = ["host", "two", "three", "four"].map((id) => ({ id, displayName: id }));

test("resolves protection before attack and returns Seer results privately", () => {
  const sessions = new GameSessions(rules);
  sessions.createLobby("group", players[0]);
  players.slice(1).forEach((player) => sessions.joinLobby("group", player));
  const started = sessions.startGame("group", "host");
  sessions.beginVoting("group");
  sessions.submitVote("group", "host", 2);
  sessions.submitVote("group", "two", 1);
  sessions.submitVote("group", "three", 4);
  sessions.submitVote("group", "four", 3);
  assert.equal(sessions.resolveVote("group").eliminatedPlayerId, null);

  const roles = Object.fromEntries(started.players.map((player) => [player.id, started.engine.privateView(player.id).role]));
  const werewolf = Object.keys(roles).find((id) => roles[id] === "werewolf")!;
  const doctor = Object.keys(roles).find((id) => roles[id] === "doctor")!;
  const seer = Object.keys(roles).find((id) => roles[id] === "seer")!;
  const targetNumber = started.engine.publicView().players.findIndex((player) => player.id === doctor) + 1;
  sessions.submitNightAction("group", werewolf, targetNumber);
  sessions.submitNightAction("group", doctor, targetNumber);
  sessions.submitNightAction("group", seer, targetNumber);
  const result = sessions.resolveNight("group");

  assert.deepEqual(result.deaths, []);
  assert.equal(result.protectedTargetId, doctor);
  assert.equal(result.investigations[0].seerId, seer);
  assert.equal(result.investigations[0].faction, "village");
  assert.equal(sessions.gameSnapshot("group").phase, "discussion");
});

test("accepts a complete set of night actions without waiting for timeout", () => {
  const sessions = new GameSessions(rules);
  sessions.createLobby("group", players[0]);
  players.slice(1).forEach((player) => sessions.joinLobby("group", player));
  const started = sessions.startGame("group", "host");
  sessions.beginNight("group");
  const roles = Object.fromEntries(started.players.map((player) => [player.id, started.engine.privateView(player.id).role]));
  const targetNumber = started.players.findIndex((player) => roles[player.id] !== "werewolf") + 1;
  for (const [playerId, role] of Object.entries(roles)) {
    if (role === "werewolf" || role === "seer" || role === "doctor") sessions.submitNightAction("group", playerId, targetNumber);
  }
  assert.equal(sessions.allNightActionsSubmitted("group"), true);
});
