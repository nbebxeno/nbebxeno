import assert from "node:assert/strict";
import test from "node:test";
import { GameError } from "../src/engine.ts";
import { GameSessions } from "../src/session.ts";

const rules = { tieRule: "no-elimination" as const, revealRoleOnDeath: false };
const players = ["host", "two", "three", "four"].map((id) => ({ id, displayName: id }));

test("opens voting, accepts player-number votes, and resolves publicly safe state", () => {
  const sessions = new GameSessions(rules);
  sessions.createLobby("group", players[0]);
  players.slice(1).forEach((player) => sessions.joinLobby("group", player));
  sessions.startGame("group", "host");
  sessions.beginVoting("group");
  sessions.submitVote("group", "host", 2);
  sessions.submitVote("group", "two", 2);
  sessions.submitVote("group", "three", 2);
  sessions.submitVote("group", "four", 3);
  const result = sessions.resolveVote("group");
  assert.equal(result.eliminatedPlayerId, "two");
  assert.ok(result.phase === "night" || result.phase === "ended");
  assert.equal("roles" in sessions.gameSnapshot("group"), false);
});

test("rejects invalid vote targets", () => {
  const sessions = new GameSessions(rules);
  sessions.createLobby("group", players[0]);
  players.slice(1).forEach((player) => sessions.joinLobby("group", player));
  sessions.startGame("group", "host");
  sessions.beginVoting("group");
  assert.throws(() => sessions.submitVote("group", "host", 99), GameError);
});