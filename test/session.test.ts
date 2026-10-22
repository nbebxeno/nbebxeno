import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameSessions } from "../src/session.ts";

const rules = { tieRule: "no-elimination" as const, revealRoleOnDeath: false };
const player = (id: string) => ({ id, displayName: id });

test("supports a group lobby and starts only when the host starts it", () => {
  const sessions = new GameSessions(rules);
  sessions.createLobby("group-1", player("host"));
  sessions.joinLobby("group-1", player("two"));
  sessions.joinLobby("group-1", player("three"));
  assert.throws(() => sessions.startGame("group-1", "host"), /At least 4 players/);
  sessions.joinLobby("group-1", player("four"));
  const started = sessions.startGame("group-1", "host");
  assert.equal(started.privateViews.length, 4);
  assert.equal(started.engine.publicView().phase, "discussion");
});

test("isolates simultaneous group sessions", () => {
  const sessions = new GameSessions(rules);
  sessions.createLobby("group-1", player("host"));
  sessions.createLobby("group-2", player("other"));
  assert.equal(sessions.snapshot("group-1").players[0].id, "host");
  assert.equal(sessions.snapshot("group-2").players[0].id, "other");
});

test("prevents starting without the minimum roster", () => {
  const sessions = new GameSessions(rules);
  sessions.createLobby("group-1", player("host"));
  sessions.joinLobby("group-1", player("two"));
  assert.throws(() => sessions.startGame("group-1", "host"), /At least 4 players/);
});

test("resolves a DM alias to the same player identity", () => {
  const sessions = new GameSessions(rules);
  sessions.createLobby("group-1", player("group-host"));
  sessions.registerAlias("group-1", "group-host", "dm-host");
  for (const id of ["two", "three", "four"]) sessions.joinLobby("group-1", player(id));
  sessions.startGame("group-1", "group-host");
  sessions.beginVoting("group-1");
  sessions.submitVote("group-1", "dm-host", 2);
  assert.throws(() => sessions.submitVote("group-1", "dm-host", 3), /already voted/);
});

test("allows a new lobby after the previous game ends", () => {
  const sessions = new GameSessions(rules);
  const players = ["host", "two", "three", "four"].map(player);
  sessions.createLobby("group-1", players[0]);
  players.slice(1).forEach((currentPlayer) => sessions.joinLobby("group-1", currentPlayer));
  const started = sessions.startGame("group-1", "host");
  const werewolf = started.players.find((currentPlayer) => started.engine.privateView(currentPlayer.id).role === "werewolf")!;
  sessions.beginVoting("group-1");
  players.forEach((currentPlayer) => sessions.submitVote("group-1", currentPlayer.id, players.findIndex((candidate) => candidate.id === werewolf.id) + 1));
  assert.equal(sessions.resolveVote("group-1").winner, "village");
  const lobby = sessions.createLobby("group-1", player("new-host"));
  assert.equal(lobby.started, false);
  assert.deepEqual(lobby.players.map((currentPlayer) => currentPlayer.id), ["new-host"]);
});

test("reloads active group state after a process restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "lordxeno-session-"));
  const filePath = join(directory, "games.json");
  try {
    const first = new GameSessions(rules, filePath);
    const gamePlayers = ["host", "two", "three", "four"].map(player);
    first.createLobby("group-1", gamePlayers[0]);
    gamePlayers.slice(1).forEach((currentPlayer) => first.joinLobby("group-1", currentPlayer));
    first.startGame("group-1", "host");
    first.setPhaseDeadline("group-1", Date.now() + 30_000);

    const restored = new GameSessions(rules, filePath);
    assert.equal(restored.gameSnapshot("group-1").phase, "discussion");
    assert.equal(restored.phaseDeadline("group-1")! > Date.now(), true);
    assert.deepEqual(restored.snapshot("group-1").players.map((currentPlayer) => currentPlayer.id), gamePlayers.map((currentPlayer) => currentPlayer.id));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("host can select a lobby mode before starting", () => {
  const sessions = new GameSessions(rules);
  sessions.createLobby("group-mode", player("host"));
  sessions.setMode("group-mode", "host", "beginner");
  for (const id of ["two", "three", "four"]) sessions.joinLobby("group-mode", player(id));
  const started = sessions.startGame("group-mode", "host");
  assert.equal(started.players.some((currentPlayer) => started.engine.privateView(currentPlayer.id).role === "doctor"), false);
});

test("does not add a duplicate lobby join", () => {
  const sessions = new GameSessions(rules);
  sessions.createLobby("group-duplicate", player("host"));
  assert.throws(() => sessions.joinLobby("group-duplicate", player("host")), /already in the lobby/);
  assert.equal(sessions.snapshot("group-duplicate").players.length, 1);
});

test("supports leaving before start and retracting a vote during voting", () => {
  const sessions = new GameSessions(rules);
  sessions.createLobby("group-1", player("host"));
  sessions.joinLobby("group-1", player("two"));
  sessions.joinLobby("group-1", player("three"));
  sessions.joinLobby("group-1", player("four"));
  sessions.leaveLobby("group-1", "four");
  assert.equal(sessions.snapshot("group-1").players.length, 3);
  sessions.joinLobby("group-1", player("four"));
  sessions.startGame("group-1", "host");
  sessions.beginVoting("group-1");
  sessions.submitVote("group-1", "host", 2);
  sessions.unvote("group-1", "host");
  assert.deepEqual(sessions.voteSnapshot("group-1").submitted, {});
});
