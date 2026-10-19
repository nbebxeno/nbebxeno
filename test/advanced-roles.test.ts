import assert from "node:assert/strict";
import test from "node:test";
import { GameEngine, ROLE_DATABASE, type GameState, type RoleAction } from "../src/engine.ts";
import { roleCard } from "../src/presentation.ts";

const rules = { tieRule: "no-elimination" as const, revealRoleOnDeath: true };
function setup(roles: Record<string, string>) {
  const full = { wolf: "werewolf", ...roles };
  const minimum = Math.max(9, Object.values(full).filter((role) => ROLE_DATABASE[role].faction === "werewolves").length * 2 + 3);
  for (let i = 0; Object.keys(full).length < minimum; i++) (full as Record<string, string>)[`v${i}`] = "villager";
  const players = Object.keys(full).map((id) => ({ id, displayName: id.toUpperCase() }));
  const state = GameEngine.create(players, rules).stateSnapshot();
  state.roles = full; state.factions = Object.fromEntries(Object.entries(full).map(([id, role]) => [id, ROLE_DATABASE[role].faction]));
  delete state.runtime;
  return GameEngine.restore(state, rules);
}
const act = (game: GameEngine, id: string, ability: string, ...targets: string[]) => game.submitAction(id, { ability, targets });
const alive = (game: GameEngine, id: string) => game.publicView().players.find((player) => player.id === id)!.alive;
function nextNight(game: GameEngine) { if (game.publicView().phase === "reaction") game.expireReactions(); game.beginNight(); }
function voteOut(game: GameEngine, target: string) {
  game.beginVoting();
  for (const player of game.publicView().players.filter((player) => player.alive)) game.submitVote(player.id, target);
  return game.resolveVote(true);
}
const privateText = (game: GameEngine, id: string) => game.drainEvents().filter((event) => event.recipient === id).map((event) => event.text).join("\n");

test("pack cards privately name teammates and shared pack votes resolve by consensus, not arrival order", () => {
  const game = setup({ ally: "werewolf", one: "villager", two: "villager" });
  assert.match(roleCard(game.privateView("wolf")), /ALLY — Werewolf/);
  assert.equal("knownTeam" in game.publicView(), false);
  game.beginNight(); act(game, "wolf", "attack", "one"); act(game, "ally", "attack", "two");
  assert.deepEqual(game.resolveNight(true).deaths, []);
  nextNight(game); act(game, "wolf", "attack", "one"); act(game, "ally", "attack", "one");
  assert.deepEqual(game.resolveNight(true).deaths, ["one"]);
});

test("Alpha converts once, replaces the entire pack attack, and gives a converted Seer both actions", () => {
  const game = setup({ alpha: "alpha-werewolf", seer: "seer", victim: "villager" });
  game.beginNight(); act(game, "alpha", "convert", "seer"); act(game, "wolf", "attack", "victim");
  assert.deepEqual(game.resolveNight(true).deaths, []);
  assert.equal(game.privateView("seer").faction, "werewolves");
  assert.match(roleCard(game.privateView("wolf")), /SEER — Seer/);
  assert.match(privateText(game, "seer"), /converted you/);
  nextNight(game);
  assert.deepEqual(game.availableActions("seer").map((ability) => ability.id), ["attack", "see"]);
  assert.throws(() => act(game, "alpha", "convert", "victim"), /unavailable/);
});

test("Doctor blocks Alpha conversion and the once-per-game charge is still consumed", () => {
  const game = setup({ alpha: "alpha-werewolf", doctor: "doctor", target: "villager" });
  game.beginNight(); act(game, "alpha", "convert", "target"); act(game, "doctor", "protect", "target"); game.resolveNight(true);
  assert.equal(game.privateView("target").faction, "village");
  assert.match(privateText(game, "doctor"), /protection blocked a harmful effect/);
  nextNight(game); assert.throws(() => act(game, "alpha", "convert", "target"), /unavailable/);
});

test("two Doctors protect both pack targets; Priest protects pack attacks but not Murderer attacks", () => {
  const game = setup({ big: "big-bad-wolf", d1: "doctor", d2: "doctor", one: "villager", two: "villager" });
  game.beginNight(); act(game, "wolf", "attack", "one"); act(game, "big", "attack", "one"); act(game, "big", "maul", "two"); act(game, "d1", "protect", "one"); act(game, "d2", "protect", "two");
  assert.deepEqual(game.resolveNight(true).deaths, []);
  const second = setup({ priest: "priest-village", killer: "murderer", target: "villager" });
  second.beginNight(); act(second, "priest", "sanctuary", "target"); act(second, "killer", "kill", "target"); second.resolveNight(true);
  assert.equal(alive(second, "target"), false);
});

test("Priest cannot protect self or the same player in consecutive nights", () => {
  const game = setup({ priest: "priest-village", target: "villager" }); game.beginNight();
  assert.throws(() => act(game, "priest", "sanctuary", "priest"), /yourself/);
  act(game, "priest", "sanctuary", "target"); game.resolveNight(true); nextNight(game);
  assert.throws(() => act(game, "priest", "sanctuary", "target"), /consecutive/);
});

test("Witch poison ignores attack protection, allows one potion per night, and cannot be reused", () => {
  const game = setup({ witch: "witch", doctor: "doctor", target: "villager" }); game.beginNight();
  act(game, "witch", "poison", "target"); act(game, "doctor", "protect", "target");
  assert.throws(() => act(game, "witch", "poison", "doctor"), /already/);
  game.resolveNight(true); assert.equal(alive(game, "target"), false);
  nextNight(game); assert.throws(() => act(game, "witch", "poison", "doctor"), /unavailable/);
});

for (const role of ["witch", "necromancer"]) test(`${role} revives a prior night death without resetting powers and cannot revive a vote death`, () => {
  const game = setup({ healer: role, target: "villager", other: "villager" });
  game.beginNight(); act(game, "wolf", "attack", "target"); game.resolveNight(true);
  nextNight(game); act(game, "healer", "revive", "target"); game.resolveNight(true);
  assert.equal(alive(game, "target"), true);
  assert.equal(game.publicView().deaths.some((death) => death.playerId === "target"), false);
  voteOut(game, "other");
  assert.throws(() => act(game, "healer", "revive", "other"), /unavailable|eligible/);
});

test("Seer sees Lycan's false faction while Apprentice compares true factions; results stay private", () => {
  const game = setup({ seer: "seer", apprentice: "apprentice-seer", lycan: "lycan", villager: "villager" });
  game.beginNight(); act(game, "seer", "see", "lycan"); act(game, "apprentice", "compare", "lycan", "villager");
  const result = game.resolveNight(true); assert.equal(result.investigations[0].faction, "werewolves");
  const events = game.drainEvents();
  assert.ok(events.some((event) => event.recipient === "apprentice" && event.text.includes("share the same actual faction")));
  assert.equal(events.some((event) => !event.recipient && /faction|aligned/.test(event.text)), false);
});

test("Scryer finds Seer once; Aura Seer reports ability presence without faction", () => {
  const game = setup({ scryer: "scryer", seer: "seer", aura: "aura-seer" });
  game.beginNight(); act(game, "scryer", "seek", "seer"); act(game, "aura", "aura", "wolf"); game.resolveNight(true);
  assert.match(privateText(game, "scryer"), /is the Seer/);
  nextNight(game); assert.equal(game.availableActions("scryer").length, 0);
});

test("Hierophant counts the faction and Mortician receives private causes at dawn", () => {
  const game = setup({ helper: "minion", hierophant: "hierophant", mortician: "mortician", target: "villager" });
  game.beginNight(); act(game, "wolf", "attack", "target"); game.resolveNight(true);
  const events = game.drainEvents();
  assert.ok(events.some((event) => event.recipient === "hierophant" && event.text.endsWith("2.")));
  assert.ok(events.some((event) => event.recipient === "mortician" && event.text.includes("TARGET: night-attack")));
});

test("Old Man absorbs exactly one unprotected pack kill; Diseased blocks the following pack night", () => {
  const game = setup({ elder: "old-man" }); game.beginNight(); act(game, "wolf", "attack", "elder"); game.resolveNight(true);
  assert.equal(alive(game, "elder"), true); nextNight(game); act(game, "wolf", "attack", "elder"); game.resolveNight(true); assert.equal(alive(game, "elder"), false);
  const diseased = setup({ ill: "diseased", target: "villager" }); diseased.beginNight(); act(diseased, "wolf", "attack", "ill"); diseased.resolveNight(true);
  nextNight(diseased); act(diseased, "wolf", "attack", "target"); assert.deepEqual(diseased.resolveNight(true).deaths, []);
});

test("Hapless Victim substitutes once for their next living neighbor", () => {
  const game = setup({ unlucky: "hapless-victim", target: "villager" }); game.beginNight(); act(game, "wolf", "attack", "target"); game.resolveNight(true);
  assert.equal(alive(game, "unlucky"), false); assert.equal(alive(game, "target"), true);
});

for (const [role, ability] of [["lawyer", "defend"], ["martyr", "sacrifice"]]) test(`${role} applies during voting before the verdict`, () => {
  const game = setup({ special: role, client: "villager" }); game.beginVoting(); act(game, "special", ability, "client");
  for (const player of game.publicView().players) game.submitVote(player.id, "client");
  game.resolveVote(true); assert.equal(alive(game, "client"), true);
  assert.equal(alive(game, "special"), role !== "martyr");
});

test("Scapegoat dies on a nonempty tied vote and Hangman schedules exactly one retrial", () => {
  const game = setup({ scapegoat: "scapegoat", a: "villager", b: "villager" }); game.beginVoting(); game.submitVote("a", "b"); game.submitVote("b", "a");
  assert.equal(game.resolveVote(true), "scapegoat");
  const hangman = setup({ hangman: "hangman", target: "villager" }); hangman.beginVoting(); act(hangman, "hangman", "retrial"); hangman.submitVote("wolf", "target"); hangman.resolveVote(true);
  assert.equal(hangman.publicView().phase, "discussion"); assert.equal(hangman.discussionMilliseconds(), 30_000);
  hangman.beginVoting(); assert.throws(() => act(hangman, "hangman", "retrial"), /unavailable/); hangman.submitVote("wolf", "target"); hangman.resolveVote(true);
  assert.equal(alive(hangman, "target"), false);
});

test("Spellcaster removes the next vote from eligibility; Old Crone announces a social silence", () => {
  const game = setup({ caster: "spellcaster", crone: "old-crone", target: "villager" }); game.beginNight(); act(game, "caster", "disenfranchise", "target"); act(game, "crone", "silence", "target"); game.resolveNight(true);
  assert.ok(game.drainEvents().some((event) => !event.recipient && event.text.includes("TARGET must remain silent")));
  game.beginVoting(); assert.throws(() => game.submitVote("target", "wolf"), /blocked/);
  for (const id of game.eligibleVoters()) game.submitVote(id, "wolf");
  assert.equal(game.allVotesSubmitted(), true);
});

test("Hunter reaction pauses faction victory, accepts the dead Hunter's shot, and expires safely", () => {
  const game = setup({ hunter: "hunter" }); voteOut(game, "hunter");
  assert.equal(game.publicView().phase, "reaction"); assert.equal(game.publicView().winner, null);
  act(game, "hunter", "shoot", "wolf"); assert.equal(game.publicView().winner, "village");
  const timeout = setup({ hunter: "hunter" }); voteOut(timeout, "hunter"); timeout.expireReactions(); assert.equal(timeout.publicView().phase, "night");
});

test("Vengeful Ghost can mark only a killer-faction target and wins if it later dies", () => {
  const game = setup({ ghost: "vengeful-ghost", otherWolf: "werewolf" }); game.beginNight(); act(game, "wolf", "attack", "ghost"); game.resolveNight(true);
  assert.equal(game.publicView().phase, "reaction"); assert.throws(() => act(game, "ghost", "haunt", "v0"), /killer's faction/);
  act(game, "ghost", "haunt", "wolf"); voteOut(game, "wolf"); assert.ok(game.publicView().individualWinners.includes("ghost"));
});

test("Noble cancels the next voting phase; Cupid's bond causes heartbreak even after Cupid dies", () => {
  const noble = setup({ noble: "noble" }); noble.beginNight(); act(noble, "wolf", "attack", "noble"); noble.resolveNight(true); noble.beginVoting(); assert.equal(noble.publicView().phase, "night");
  const cupid = setup({ cupid: "cupid", one: "villager", two: "villager" }); cupid.beginNight(); act(cupid, "cupid", "link", "one", "two"); cupid.resolveNight(true);
  voteOut(cupid, "cupid"); cupid.resolveNight(true); voteOut(cupid, "one"); assert.equal(alive(cupid, "two"), false);
});

test("Minion knowledge is one-way; hidden wolves do not leak, and Confused Wolf discovers a teammate", () => {
  const game = setup({ minion: "minion", sorcerer: "sorcerer", lone: "lone-wolf", confused: "confused-wolf" });
  assert.ok(game.privateView("minion").knownWerewolves.includes("wolf"));
  assert.equal(game.privateView("wolf").knownWerewolves.includes("minion"), false);
  assert.equal(game.privateView("lone").knownWerewolves.length, 0);
  assert.equal(game.privateView("sorcerer").knownWerewolves.length, 0);
  game.beginNight(); act(game, "confused", "sniff", "wolf"); game.resolveNight(true);
  assert.ok(game.privateView("confused").knownWerewolves.includes("wolf"));
});

test("German Shepherd masks a pack ally from Seer and Fallen Angel blocks one independent kill", () => {
  const game = setup({ shepherd: "german-shepherd", seer: "seer", angel: "fallen-angel", murderer: "murderer" }); game.beginNight();
  act(game, "shepherd", "disguise", "wolf"); act(game, "seer", "see", "wolf"); act(game, "angel", "shield", "wolf"); act(game, "murderer", "kill", "wolf");
  const result = game.resolveNight(true); assert.equal(result.investigations[0].faction, "village"); assert.equal(alive(game, "wolf"), true);
});

test("Remorseful Werewolf vetoes the shared attack; Fruit Brute trades its attack for a shield", () => {
  const game = setup({ remorse: "remorseful-werewolf", target: "villager" }); game.beginNight(); act(game, "wolf", "attack", "target"); act(game, "remorse", "veto"); game.resolveNight(true); assert.equal(alive(game, "target"), true);
  const fruit = setup({ wolf: "fruit-brute", murderer: "murderer", target: "villager" }); fruit.beginNight(); act(fruit, "wolf", "attack", "target"); act(fruit, "wolf", "fortify"); act(fruit, "murderer", "kill", "wolf"); fruit.resolveNight(true);
  assert.equal(alive(fruit, "target"), true); assert.equal(alive(fruit, "wolf"), true);
});

test("Wolf Cub enables two shared targets and Omega blocks one night before piercing protection", () => {
  const cub = setup({ cub: "wolf-cub", one: "villager", two: "villager" }); voteOut(cub, "cub");
  assert.ok(cub.availableActions("wolf").some((ability) => ability.id === "extra"));
  act(cub, "wolf", "attack", "one"); act(cub, "wolf", "extra", "two"); assert.deepEqual(cub.resolveNight(true).deaths.sort(), ["one", "two"]);
  const omega = setup({ omega: "omega-wolf", doctor: "doctor", target: "villager" }); voteOut(omega, "omega"); act(omega, "wolf", "attack", "target"); assert.deepEqual(omega.resolveNight(true).deaths, []);
  nextNight(omega); act(omega, "wolf", "attack", "target"); act(omega, "doctor", "protect", "target"); omega.resolveNight(true); assert.equal(alive(omega, "target"), false);
});

test("Neutral Poisoner's poison fails if the pack kills them first; Werewolf Poisoner has one charge", () => {
  const game = setup({ poisoner: "poisoner-neutral", target: "villager" }); game.beginNight(); act(game, "wolf", "attack", "poisoner"); act(game, "poisoner", "poison", "target"); game.resolveNight(true); assert.equal(alive(game, "target"), true);
  const helper = setup({ poisoner: "poisoner-werewolf", target: "villager" }); helper.beginNight(); act(helper, "poisoner", "poison", "target"); helper.resolveNight(true); nextNight(helper); assert.throws(() => act(helper, "poisoner", "poison", "v0"), /unavailable/);
});

for (const [role, ability] of [["chef", "serve"], ["priest-neutral", "bless"]]) test(`${role} wins personally after three distinct surviving selections`, () => {
  const game = setup({ special: role });
  for (const target of ["v0", "v1", "v2"]) { nextNight(game); act(game, "special", ability, target); game.resolveNight(true); }
  assert.ok(game.publicView().individualWinners.includes("special")); assert.equal(game.publicView().winner, null);
});

test("Hoodlum outlives both marks; Bloody Mary kills a marked repeat voter", () => {
  const hoodlum = setup({ hoodlum: "hoodlum", one: "villager", two: "villager" }); hoodlum.beginNight(); act(hoodlum, "hoodlum", "mark", "one", "two"); hoodlum.resolveNight(true);
  voteOut(hoodlum, "one"); act(hoodlum, "wolf", "attack", "two"); hoodlum.resolveNight(true); assert.ok(hoodlum.publicView().individualWinners.includes("hoodlum"));
  const mary = setup({ mary: "bloody-mary", accuser: "villager" }); mary.beginVoting(); mary.submitVote("accuser", "mary"); mary.submitVote("wolf", "v0"); mary.resolveVote(true); act(mary, "mary", "curse", "accuser"); mary.resolveNight(true);
  mary.beginVoting(); mary.submitVote("accuser", "mary"); mary.submitVote("wolf", "v0"); mary.resolveVote(true); assert.equal(alive(mary, "accuser"), false); assert.ok(mary.publicView().individualWinners.includes("mary"));
});

test("Arsonist and Enchantress have their own exclusive wins; killers prevent a premature Village win", () => {
  const arson = setup({ arson: "arsonist", doctor: "doctor", target: "villager" }); arson.beginNight(); act(arson, "arson", "douse", "target"); arson.resolveNight(true); nextNight(arson); act(arson, "arson", "ignite"); act(arson, "doctor", "protect", "target"); arson.resolveNight(true); assert.equal(alive(arson, "target"), false);
  const killer = setup({ murderer: "murderer" }); voteOut(killer, "wolf"); assert.equal(killer.publicView().winner, null);
  const state = killer.stateSnapshot(); state.alive = ["murderer", "v0"]; state.phase = "night";
  const end = GameEngine.restore(state, rules); act(end, "murderer", "kill", "v0"); end.resolveNight(true); assert.equal(end.publicView().winner, "neutral"); assert.ok(end.publicView().individualWinners.includes("murderer"));
  const enchanted = setup({ enchantress: "enchantress" }); const s = enchanted.stateSnapshot(); s.alive = ["wolf", "enchantress", "v0"]; s.runtime!.memory.enchantress.targets.enchant = ["wolf"];
  const win = GameEngine.restore(s, rules); win.beginNight(); act(win, "enchantress", "enchant", "v0"); win.resolveNight(true); assert.equal(win.publicView().winner, "neutral"); assert.deepEqual(win.publicView().individualWinners, ["enchantress"]);
});

test("Doppelganger inherits role and spent charges, and cannot replay the copied role's consumed power", () => {
  const game = setup({ copy: "doppelganger", witch: "witch", target: "villager" }); game.beginNight(); act(game, "copy", "copy", "witch"); act(game, "witch", "poison", "target"); game.resolveNight(true);
  voteOut(game, "witch"); assert.equal(game.privateView("copy").role, "witch"); assert.throws(() => act(game, "copy", "poison", "v0"), /unavailable/);
});

test("Moderator, Orphan, Turncoat, Thespian, Cupid, and Guardian Angel earn specific co-wins", () => {
  const game = setup({ mod: "moderator", orphan: "orphan", turn: "turncoat", actor: "thespian", cupid: "cupid", angel: "guardian-angel" });
  game.beginNight(); act(game, "mod", "audit"); act(game, "orphan", "adopt", "v0");
  game.submitAction("turn", { ability: "allegiance", targets: [], option: "village" }); act(game, "cupid", "link", "mod", "orphan");
  game.submitAction("actor", { ability: "rehearse", targets: [], option: "1" }); game.resolveNight(true);
  nextNight(game); assert.throws(() => act(game, "mod", "audit"), /unavailable/); game.submitAction("actor", { ability: "rehearse", targets: [], option: "2" }); game.resolveNight(true);
  nextNight(game); game.submitAction("actor", { ability: "rehearse", targets: [], option: "3" }); game.resolveNight(true);
  // Keep the assigned ward alive for this co-win scenario.
  const state = game.stateSnapshot(); state.runtime!.memory.angel.targets.ward = ["orphan"];
  const end = GameEngine.restore(state, rules); voteOut(end, "wolf");
  for (const id of ["mod", "orphan", "turn", "actor", "cupid", "angel"]) assert.ok(end.publicView().individualWinners.includes(id), id);
});

test("Guardian Angel ward protection has exactly two uses and does not protect the ward from voting", () => {
  const game = setup({ angel: "guardian-angel", target: "villager" }); const s = game.stateSnapshot(); s.runtime!.memory.angel.targets.ward = ["target"];
  const ward = GameEngine.restore(s, rules);
  for (let i = 0; i < 2; i++) { nextNight(ward); act(ward, "angel", "ward"); act(ward, "wolf", "attack", "target"); ward.resolveNight(true); assert.equal(alive(ward, "target"), true); }
  nextNight(ward); assert.throws(() => act(ward, "angel", "ward"), /unavailable/);
  ward.resolveNight(true); voteOut(ward, "target"); assert.equal(alive(ward, "target"), false);
});

test("Insomniac uses living circular seats, and Mason learns only fellow Masons", () => {
  const game = setup({ walker: "insomniac", mason: "mason", ally: "mason" });
  assert.match(roleCard(game.privateView("mason")), /Fellow Masons: ALLY/);
  game.beginNight(); act(game, "walker", "walk"); game.resolveNight(true); assert.match(privateText(game, "walker"), /1 living seat/);
});

test("actions reject the wrong phase, repeated targets, dead actors, and late first-night choices; skip completes optional choices", () => {
  const game = setup({ alpha: "alpha-werewolf", apprentice: "apprentice-seer", cupid: "cupid" });
  assert.throws(() => act(game, "alpha", "convert", "v0"), /unavailable/);
  game.beginNight(); assert.throws(() => act(game, "apprentice", "compare", "v0", "v0"), /different/);
  act(game, "alpha", "attack", "v0"); assert.equal(game.actionComplete("alpha"), false); game.skipAction("alpha"); assert.equal(game.actionComplete("alpha"), true);
  game.resolveNight(true); nextNight(game); assert.throws(() => act(game, "cupid", "link", "v1", "v2"), /unavailable/);
});

test("saved actions, uses, conversion, and pending reactions survive restore without repeating results", () => {
  const game = setup({ alpha: "alpha-werewolf", hunter: "hunter" }); game.beginNight(); act(game, "alpha", "convert", "v0");
  const restored = GameEngine.restore(game.stateSnapshot(), rules); restored.resolveNight(true); assert.equal(restored.privateView("v0").faction, "werewolves");
  voteOut(restored, "hunter"); const reaction = GameEngine.restore(restored.stateSnapshot(), rules);
  assert.equal(reaction.publicView().phase, "reaction"); act(reaction, "hunter", "shoot", "alpha"); assert.equal(alive(reaction, "alpha"), false);
});

test("Chaos can actually surface every catalogue role while preserving faction budgets", () => {
  let seed = 731;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const seen = new Set<string>();
  for (let round = 0; round < 500; round++) {
    const roles = GameEngine.roleComposition(16, "chaos", random);
    roles.forEach((role) => seen.add(role));
    assert.equal(roles.filter((role) => ROLE_DATABASE[role].faction === "werewolves").length, 4);
    assert.equal(roles.filter((role) => ROLE_DATABASE[role].faction === "neutral").length, 4);
  }
  assert.deepEqual([...seen].sort(), Object.keys(ROLE_DATABASE).sort());
});

test("active slots, optional skips, and voting powers all participate in early-close decisions", () => {
  const game = setup({ alpha: "alpha-werewolf", lawyer: "lawyer", doctor: "doctor" }); game.beginNight();
  for (const id of game.requiredNightActors()) game.skipAction(id);
  assert.equal(game.allNightActionsSubmitted(), true); game.resolveNight();
  game.beginVoting(); for (const id of game.eligibleVoters()) game.submitVote(id, "wolf");
  assert.equal(game.allVotesSubmitted(), false, "the Lawyer must get a chance to defend or skip");
  game.skipAction("lawyer"); assert.equal(game.allVotesSubmitted(), true); game.resolveVote();
});

test("independent kills can end in a draw and never award every Neutral a win", () => {
  const game = setup({ murderer: "murderer", other: "murderer" });
  const state = game.stateSnapshot(); state.alive = ["murderer", "other"]; state.phase = "night"; state.nightNumber = 1;
  const end = GameEngine.restore(state, rules); act(end, "murderer", "kill", "other"); act(end, "other", "kill", "murderer"); end.resolveNight(true);
  assert.equal(end.publicView().status, "ended"); assert.deepEqual(end.publicView().individualWinners, []);
});

test("a skipped legacy night keeps already submitted core actions after save migration", () => {
  const game = setup({ doctor: "doctor", target: "villager" }); game.beginNight();
  const state = game.stateSnapshot(); delete state.runtime;
  state.nightActions = { wolf: { type: "werewolf-target", targetId: "target" }, doctor: { type: "doctor-protect", targetId: "target" } };
  const migrated = GameEngine.restore(state, rules); assert.deepEqual(migrated.resolveNight(true).deaths, []);
});
