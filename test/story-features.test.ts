import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameEngine } from "../src/engine.ts";
import { GameSessions } from "../src/session.ts";
import { replayCard, replayHighlights } from "../src/replay.ts";
import { dawnStory, nightStory } from "../src/narration.ts";
import { StatsStore } from "../src/stats.ts";
import { leaderboardPng, leaderboardSvg, leaderboardName } from "../src/leaderboard-image.ts";

const rules = { tieRule: "no-elimination" as const, revealRoleOnDeath: true };
const players = ["wolf", "seer", "doctor", "villager", "hunter"].map((id) => ({ id, displayName: id.toUpperCase() }));
function game() {
  const state = GameEngine.create(players, rules).stateSnapshot();
  state.roles = { wolf: "werewolf", seer: "seer", doctor: "doctor", villager: "villager", hunter: "hunter" };
  state.factions = { wolf: "werewolves", seer: "village", doctor: "village", villager: "village", hunter: "village" };
  return GameEngine.restore(state, rules);
}

test("replays retain private choices after delivery, stay sealed during play, and survive restore", () => {
  const current = game(); current.beginNight();
  current.submitAction("wolf", { ability: "attack", targets: ["villager"] });
  current.submitAction("doctor", { ability: "protect", targets: ["villager"] });
  current.resolveNight(true); current.drainEvents();
  assert.throws(() => current.replay(), /sealed/);
  current.forceEnd();
  const replay = GameEngine.restore(current.stateSnapshot(), rules).replay();
  assert.ok(replay.entries.some((entry) => entry.kind === "action" && entry.text.includes("used attack on VILLAGER")));
  assert.ok(replay.entries.some((entry) => entry.text.includes("protection prevented")));
  assert.match(replayHighlights(replay), /protection prevented/);
  assert.match(replayCard(replay), /used attack/);
});

test("last words are single-use, preserve case, expire at 15 seconds, and do not consume a Hunter action", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000 });
  try {
    const current = game(); current.beginNight(); current.submitAction("wolf", { ability: "attack", targets: ["hunter"] }); current.resolveNight(true);
    assert.equal(current.publicView().phase, "reaction");
    current.submitLastWords("hunter", "I TOLD you about the baker!");
    assert.ok(current.drainEvents().some((event) => !event.recipient && event.text.includes("I TOLD you")));
    assert.throws(() => current.submitLastWords("hunter", "Encore"), /once/);
    assert.ok(current.availableActions("hunter").some((action) => action.id === "shoot"));
    assert.throws(() => current.submitLastWords("doctor", "Still alive"), /once/);
    const expired = game(); expired.beginNight(); expired.submitAction("wolf", { ability: "attack", targets: ["villager"] }); expired.resolveNight(true);
    t.mock.timers.tick(15_001);
    assert.throws(() => GameEngine.restore(expired.stateSnapshot(), rules).submitLastWords("villager", "Too late"), /15 seconds/);
  } finally { t.mock.timers.reset(); }
});

test("last words remain available in the old game's 15-second window after a new lobby opens", () => {
  const directory = mkdtempSync(join(tmpdir(), "lordxeno-lastwords-"));
  try {
    const file = join(directory, "games.json"); const sessions = new GameSessions(rules, file);
    sessions.createLobby("group", players[0]); for (const player of players.slice(1)) sessions.joinLobby("group", player);
    const started = sessions.startGame("group", "wolf");
    const wolf = started.players.find((player) => started.engine.privateView(player.id).faction === "werewolves")!.id;
    sessions.beginVoting("group");
    for (const player of started.players) sessions.submitVote("group", player.id, started.players.findIndex((candidate) => candidate.id === wolf) + 1);
    sessions.resolveVote("group");
    sessions.createLobby("group", { id: "new-host", displayName: "New Host" });
    const restored = new GameSessions(rules, file);
    assert.equal(restored.lastWordsGroup(wolf), "group");
    const messages = restored.lastWords("group", wolf, "I was framed by breakfast.");
    assert.ok(messages.some((event) => event.text.includes("framed by breakfast")));
    assert.ok(restored.replay("group").entries.some((entry) => entry.kind === "lastwords"));
    assert.equal(restored.snapshot("group").hostId, "new-host");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("replay pagination stays within WhatsApp-sized messages and rejects invalid pages", () => {
  const current = game(); current.forceEnd(); const replay = current.replay();
  replay.entries = Array.from({ length: 120 }, () => ({ day: 1, night: 1, phase: "night" as const, kind: "event" as const, text: "A very suspicious villager. ".repeat(30) }));
  assert.ok(replayCard(replay, 1).length < 4000);
  assert.match(replayCard(replay, 1), /!replay 2/);
  assert.match(replayCard(replay, -1), /Choose a replay page/);
});

test("story lines only attribute pack deaths to werewolves and vary without affecting game randomness", () => {
  const base = { playerId: "Ada", displayName: "Ada", dayNumber: 1, cause: "night-attack" as const };
  assert.match(dawnStory(2, [{ ...base, attackKind: "pack" }]), /werewolv|werewolf/i);
  assert.doesNotMatch(dawnStory(2, [{ ...base, attackKind: "independent" }]), /werewolv|werewolf/i);
  assert.match(dawnStory(2, []), /Nobody died|nobody died|alive|Every candle/);
  assert.equal(nightStory(1, "saved-game"), nightStory(1, "saved-game"));
  assert.ok(new Set(Array.from({ length: 15 }, (_, i) => nightStory(1, `game-${i}`))).size > 1);
});

test("leaderboard keeps names across restart and does not turn phone IDs into public display names", () => {
  const directory = mkdtempSync(join(tmpdir(), "lordxeno-names-"));
  try {
    const file = join(directory, "stats.json"); const store = new StatsStore(file);
    store.rememberName("15550000001@s.whatsapp.net", "Ada & Co");
    assert.equal(store.leaderboard().length, 0);
    store.record("15550000001@s.whatsapp.net", "seer", true, false, true);
    const top = new StatsStore(file).leaderboard();
    assert.equal(top[0].displayName, "Ada & Co");
    assert.match(leaderboardSvg(top), /Ada &amp; Co/);
    assert.doesNotMatch(leaderboardSvg(top), /15550000001/);
    assert.equal(leaderboardName({ ...top[0], displayName: undefined }, 1), "Villager 1");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("leaderboard renderer creates an actual PNG and escapes player-controlled SVG text", async () => {
  const row = { id: "ada", displayName: '<Ada & "Co">', wins: 4, games: 5, survived: 3, lynched: 0, roles: {} };
  const svg = leaderboardSvg([row]);
  assert.ok(svg.includes("&lt;Ada &amp; &quot;Co&quot;&gt;"));
  assert.equal(svg.includes('<Ada & "Co">'), false);
  const png = await leaderboardPng([row]);
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 1000);
  assert.ok(png.length > 1000);
});
