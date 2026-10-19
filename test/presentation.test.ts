import assert from "node:assert/strict";
import test from "node:test";
import { GameEngine, ROLE_DATABASE } from "../src/engine.ts";
import { ROLE_PROPOSALS } from "../src/role-proposals.ts";
import { lobbyCard, roleCard, roleLabel, rosterCard } from "../src/presentation.ts";

const rules = { tieRule: "no-elimination" as const, revealRoleOnDeath: false };
const players = ["Ada", "Bayo", "Chidi", "Dami"].map((displayName) => ({ id: displayName.toLowerCase(), displayName }));

test("every catalogue role has implemented status and descriptive copy", () => {
  assert.equal(Object.keys(ROLE_PROPOSALS).length, 55);
  for (const [id, role] of Object.entries(ROLE_DATABASE)) {
    assert.ok(role.description.length > 30, id);
    assert.doesNotMatch(role.description, /UNDEFINED|REQUIRES DESIGN|Catalogued role/, id);
    assert.equal(role.designStatus, "defined", id);
    if (ROLE_PROPOSALS[id]) assert.ok(role.activeAbility, id);
  }
  assert.notEqual(roleLabel("poisoner-werewolf"), roleLabel("poisoner-neutral"));
  assert.notEqual(roleLabel("priest-village"), roleLabel("priest-neutral"));
});

test("role cards explain active powers without revealing other players' roles", () => {
  const game = GameEngine.create(players, rules, () => 0.5);
  const state = game.stateSnapshot();
  state.roles = { ada: "witch", bayo: "werewolf", chidi: "seer", dami: "doctor" };
  state.factions = { ada: "village", bayo: "werewolves", chidi: "village", dami: "village" };
  const witchGame = GameEngine.restore(state, rules);
  const card = roleCard(witchGame.privateView("ada"));
  assert.match(card, /\*Witch\*/);
  assert.match(card, /Team: Village/);
  assert.match(card, /!act poison/);
  assert.match(card, /!actions/);
  assert.match(card, /!vote <number>/);
  assert.doesNotMatch(card, /!night|Bayo|Chidi|Dami|UNDEFINED/);
  assert.throws(() => {
    witchGame.beginNight();
    witchGame.submitNightAction("ada", { type: "doctor-protect", targetId: "bayo" });
  }, /not available/);
});

test("lobby instructions track mode and readiness while public rosters keep roles private", () => {
  const snapshot = { groupId: "group", hostId: "ada", players, started: false };
  assert.match(lobbyCard(snapshot), /Host: choose a mode first/);
  const ready = lobbyCard(snapshot, "classic");
  assert.match(ready, /Mode: Classic/);
  assert.match(ready, /Ready\. The host can start/);
  assert.doesNotMatch(ready, /choose a mode first/);
  const game = GameEngine.create(players, rules);
  const state = game.stateSnapshot();
  state.alive = ["ada", "chidi", "dami"];
  const roster = rosterCard(GameEngine.restore(state, rules).publicView());
  assert.match(roster, /1\. Ada\n2\. Chidi\n3\. Dami/);
  assert.match(roster, /Eliminated · 1/);
  assert.doesNotMatch(roster, /Werewolf|Seer|Doctor|Villager/);
});
