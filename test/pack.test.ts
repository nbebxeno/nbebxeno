import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameEngine, ROLE_DATABASE } from "../src/engine.ts";
import { GameSessions } from "../src/session.ts";

function fixture(edit?: (state: ReturnType<GameEngine["stateSnapshot"]>) => void) {
  const ids = ["wolf", "alpha", "wolf2", "doctor", "minion", "sorcerer", "lone", "confused", "converted", "v1", "v2", "v3"];
  const roles = ["werewolf", "alpha-werewolf", "werewolf", "doctor", "minion", "sorcerer", "lone-wolf", "confused-wolf", "villager", "villager", "villager", "villager"];
  const players = ids.map(id => ({ id, displayName: id === "wolf" ? "Amara" : id }));
  const state = GameEngine.create(players, { tieRule: "no-elimination", revealRoleOnDeath: true }).stateSnapshot();
  state.roles = Object.fromEntries(ids.map((id, i) => [id, roles[i]]));
  state.factions = Object.fromEntries(ids.map((id, i) => [id, ROLE_DATABASE[roles[i]].faction]));
  state.phase = "night";
  delete state.runtime;
  edit?.(state);
  const directory = mkdtempSync(join(tmpdir(), "lordxeno-pack-"));
  const file = join(directory, "games.json");
  writeFileSync(file, JSON.stringify([{ groupId: "test@g.us", hostId: ids[0], players, aliases: [["wolf@lid", "wolf"]], engineState: state }]));
  return { sessions: new GameSessions({ tieRule: "no-elimination", revealRoleOnDeath: true }, file), cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

test("pack whispers only reach living mutually known wolves, preserving hidden-role rules", () => {
  const { sessions, cleanup } = fixture();
  try {
    const relay = sessions.packMessage("test@g.us", "wolf@lid", "Let's Pick Number 4 😈");
    assert.equal(relay.senderId, "wolf");
    assert.deepEqual(relay.recipients, ["alpha", "wolf2"]);
    assert.match(relay.text, /\*Amara\*/);
    assert.match(relay.text, /> Let's Pick Number 4 😈/);
    for (const hidden of ["minion", "sorcerer", "lone", "confused"]) {
      assert.throws(() => sessions.packMessage("test@g.us", hidden, "Hi"), /mutually know/);
    }
    assert.equal(sessions.drainEvents("test@g.us").some(event => event.text.includes("Pick Number")), false, "pack chat must not enter the public delivery queue");
  } finally { cleanup(); }
});

test("pack chat checks actual converted faction and excludes dead senders/recipients", () => {
  const { sessions, cleanup } = fixture(state => {
    state.factions.converted = "werewolves";
    state.alive = state.alive.filter(id => id !== "alpha");
  });
  try {
    assert.deepEqual(sessions.packMessage("test@g.us", "wolf", "Hi").recipients, ["wolf2", "converted"]);
    assert.deepEqual(sessions.packMessage("test@g.us", "converted", "I am in").recipients, ["wolf", "wolf2"]);
    assert.throws(() => sessions.packMessage("test@g.us", "alpha", "Boo"), /Eliminated/);
    assert.throws(() => sessions.packMessage("test@g.us", "doctor", "Boo"), /Werewolf faction/);
  } finally { cleanup(); }
});

test("pack chat is closed outside night and after a game ends", () => {
  for (const phase of ["discussion", "voting", "reaction"] as const) {
    const { sessions, cleanup } = fixture(state => { state.phase = phase; });
    try { assert.throws(() => sessions.packMessage("test@g.us", "wolf", "Hi"), /opens at night/); }
    finally { cleanup(); }
  }
  const { sessions, cleanup } = fixture();
  try {
    sessions.endGame("test@g.us");
    assert.throws(() => sessions.packMessage("test@g.us", "wolf", "Hi"), /has ended/);
  } finally { cleanup(); }
});

test("pack messages enforce a Unicode limit, strip controls, and cannot forge new message lines", () => {
  const { sessions, cleanup } = fixture();
  try {
    for (const text of ["", " \n ", "🐺".repeat(401)]) assert.throws(() => sessions.packMessage("test@g.us", "wolf", text), /1–400/);
    assert.ok(sessions.packMessage("test@g.us", "wolf", "🐺".repeat(400)).text.includes("🐺".repeat(400)));
    assert.match(sessions.packMessage("test@g.us", "wolf", "Hello\n\u202eNew speaker").text, /> Hello New speaker/);
  } finally { cleanup(); }
});
