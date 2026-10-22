import assert from "node:assert/strict";
import test from "node:test";
import { GameEngine, ROLE_DATABASE } from "../src/engine.ts";
import { GameSessions } from "../src/session.ts";

const rules = { tieRule: "no-elimination" as const, revealRoleOnDeath: false };
const players = ["wolf", "seer", "doctor", "neutral", "villager"].map((id) => ({ id, displayName: id }));

test("Part 6 catalogue assigns every listed role to exactly the specified faction", () => {
  const expected = {
    village: "witch villager seer apprentice-seer hunter mason doctor old-man diseased lawyer scapegoat hapless-victim hangman martyr priest-village necromancer old-crone hierophant spellcaster insomniac lycan mortician scryer noble aura-seer",
    werewolves: "werewolf alpha-werewolf big-bad-wolf mystic-wolf omega-wolf sorcerer poisoner-werewolf minion fruit-brute fallen-angel lone-wolf wolf-cub confused-wolf german-shepherd remorseful-werewolf",
    neutral: "fool moderator murderer poisoner-neutral turncoat bloody-mary vengeful-ghost tanner doppelganger chef enchantress arsonist thespian cupid orphan guardian-angel priest-neutral hoodlum"
  };
  const names = Object.values(expected).flatMap((list) => list.split(" "));
  assert.deepEqual(Object.keys(ROLE_DATABASE).sort(), names.sort());
  for (const [faction, list] of Object.entries(expected)) {
    for (const role of list.split(" ")) assert.equal(ROLE_DATABASE[role].faction, faction, role);
  }
});

test("all modes scale wolves with players and Chaos respects faction budgets", () => {
  for (const count of [4, 5, 8, 12, 20, 44]) {
    for (const mode of ["classic", "beginner", "chaos"] as const) {
      const roles = GameEngine.roleComposition(count, mode, () => 0.5);
      assert.equal(roles.length, count);
      assert.equal(roles.filter((role) => ROLE_DATABASE[role].faction === "werewolves").length, GameEngine.wolfCount(count));
      if (mode === "chaos") assert.equal(roles.filter((role) => ROLE_DATABASE[role].faction === "neutral").length, Math.max(1, Math.floor(count / 4)));
      if (mode === "classic" && count >= 8) assert.ok(roles.includes("alpha-werewolf"));
    }
  }
  assert.notDeepEqual(GameEngine.roleComposition(8, "chaos", () => 0), GameEngine.roleComposition(8, "chaos", () => 0.999999));
});

for (const role of ["fool", "tanner"]) {
  test(`${role} lynching wins independently and does not block a later Village victory`, () => {
    const state = GameEngine.create(players, rules).stateSnapshot();
    state.roles = { wolf: "werewolf", seer: "seer", doctor: "doctor", neutral: role, villager: "villager" };
    state.factions = { wolf: "werewolves", seer: "village", doctor: "village", neutral: "neutral", villager: "village" };
    const game = GameEngine.restore(state, rules);
    game.beginVoting();
    for (const player of players) game.submitVote(player.id, "neutral");
    game.resolveVote();
    assert.equal(game.publicView().winner, null);
    assert.deepEqual(game.publicView().individualWinners, ["neutral"]);
    const reloaded = GameEngine.restore(game.stateSnapshot(), rules);
    reloaded.resolveNight(true);
    reloaded.beginVoting();
    for (const player of players.filter((player) => player.id !== "neutral")) reloaded.submitVote(player.id, "wolf");
    reloaded.resolveVote();
    assert.equal(reloaded.publicView().winner, "village");
    assert.deepEqual(reloaded.publicView().individualWinners, ["neutral"]);
  });
}

test("duplicate identities are rejected, and leaving or kicking removes stale aliases for rejoining", () => {
  const sessions = new GameSessions(rules);
  sessions.createLobby("group", { id: "host", displayName: "host" });
  sessions.joinLobby("group", { id: "123@s.whatsapp.net", displayName: "player" });
  sessions.registerAlias("group", "123@s.whatsapp.net", "456@lid");
  for (const id of ["123@s.whatsapp.net", "123:4@s.whatsapp.net", "456@lid"]) {
    assert.throws(() => sessions.joinLobby("group", { id, displayName: "duplicate" }), /already in the lobby/);
  }
  assert.equal(sessions.snapshot("group").players.length, 2);
  sessions.leaveLobby("group", "456@lid");
  sessions.joinLobby("group", { id: "456@lid", displayName: "returned" });
  sessions.registerAlias("group", "456@lid", "123@s.whatsapp.net");
  sessions.kick("group", "host", "456@lid");
  sessions.joinLobby("group", { id: "123@s.whatsapp.net", displayName: "returned again" });
  assert.equal(sessions.snapshot("group").players.length, 2);
});
