import { ROLE_ABILITIES, PACK_ATTACKERS, INDEPENDENT_KILLERS, PACK_ATTACK, EXTRA_ATTACK, HUNTER_SHOT, GHOST_MARK, type AbilityDefinition } from "./abilities.ts";
import { ROLE_PROPOSALS } from "./role-proposals.ts";

export type PlayerId = string;
export type Faction = "village" | "werewolves" | "neutral";
export type RoleName = string;
export type GameMode = "classic" | "beginner" | "chaos";
export type Phase = "lobby" | "discussion" | "voting" | "night" | "reaction" | "ended";

export interface Player {
  id: PlayerId;
  displayName: string;
}

export interface RoleDefinition {
  name: RoleName;
  faction: Faction;
  winCondition: string;
  description: string;
  activeAbility: string | null;
  designStatus: "defined" | "undefined";
}

export interface GameRules {
  tieRule: "no-elimination";
  revealRoleOnDeath: boolean;
}

export interface GameState {
  status: "lobby" | "active" | "ended";
  dayNumber: number;
  nightNumber: number;
  phase: Phase;
  players: Record<PlayerId, Player>;
  alive: PlayerId[];
  roles: Partial<Record<PlayerId, RoleName>>;
  factions: Partial<Record<PlayerId, Faction>>;
  votes: Record<PlayerId, PlayerId>;
  nightActions: Record<PlayerId, NightAction>;
  runtime?: RoleRuntime;
  deaths: DeathRecord[];
  winner: Faction | null;
  individualWinners: PlayerId[];
}

export interface DeathRecord {
  role?: RoleName;
  playerId: PlayerId;
  dayNumber: number;
  cause: "vote" | "night-attack" | "poison" | "shot" | "heartbreak" | "curse" | "fire" | "undefined";
  revived?: boolean;
}

export type NightAction =
  | { type: "werewolf-target"; targetId: PlayerId }
  | { type: "seer-investigate"; targetId: PlayerId }
  | { type: "doctor-protect"; targetId: PlayerId };

export interface NightResolution {
  deaths: PlayerId[];
  investigations: Array<{ seerId: PlayerId; targetId: PlayerId; faction: Faction }>;
  protectedTargetId: PlayerId | null;
  phase: Phase;
  winner: Faction | null;
  individualWinners: PlayerId[];
}

export interface PrivatePlayerView {
  player: Player;
  role: RoleName;
  faction: Faction;
  roleDefinition: RoleDefinition;
  knownWerewolves: PlayerId[];
  knownTeam?: Array<Player & { role: RoleName }>;
  abilities?: AbilityDefinition[];
  personalNotes?: string[];
}

export interface PublicGameView {
  status: GameState["status"];
  dayNumber: number;
  nightNumber: number;
  phase: Phase;
  players: Array<Player & { alive: boolean }>;
  deaths: DeathRecord[];
  winner: Faction | null;
  individualWinners: PlayerId[];
}

export interface NumberedAlivePlayer {
  number: number;
  player: Player;
}

export interface VoteSnapshot {
  submitted: Record<PlayerId, PlayerId>;
  counts: Record<PlayerId, number>;
}

export const ROLE_DATABASE: Record<RoleName, RoleDefinition> = {
  werewolf: {
    name: "werewolf",
    faction: "werewolves",
    winCondition: "Reach parity with the living non-Werewolves.",
    description: "Knows fellow Werewolves and participates in their nightly attack.",
    activeAbility: "Choose a target for the Werewolf faction.",
    designStatus: "defined"
  },
  "alpha-werewolf": {
    name: "alpha-werewolf",
    faction: "werewolves",
    winCondition: "Reach parity with the living non-Werewolves.",
    description: "A rare Werewolf with an additional ability.",
    activeAbility: null,
    designStatus: "undefined"
  },
  villager: {
    name: "villager",
    faction: "village",
    winCondition: "Help eliminate the Werewolf faction.",
    description: "A Village member who relies on discussion, deduction, and voting.",
    activeAbility: null,
    designStatus: "undefined"
  },
  seer: {
    name: "seer",
    faction: "village",
    winCondition: "Help eliminate the Werewolf faction.",
    description: "Investigates one player each night and receives an alignment result.",
    activeAbility: "Investigate one living player.",
    designStatus: "defined"
  },
  doctor: {
    name: "doctor",
    faction: "village",
    winCondition: "Help eliminate the Werewolf faction.",
    description: "Protects one player each night, including themselves.",
    activeAbility: "Protect one living player from applicable attacks.",
    designStatus: "defined"
  },
  hunter: {
    name: "hunter",
    faction: "village",
    winCondition: "Help eliminate the Werewolf faction.",
    description: "Has a death-triggered final weapon opportunity.",
    activeAbility: null,
    designStatus: "undefined"
  }
};

const CATALOGUE_ROLES: Array<[string, Faction, string]> = [
  ["witch", "village", "Help the Village; one kill potion and one revive potion per game."],
  ["apprentice-seer", "village", "Help the Village by learning whether two players share a team."],
  ["fool", "neutral", "Be lynched during the day."],
  ["mason", "village", "Help the Village; know the other Mason(s)."],
  ["old-man", "village", "Help the Village while surviving the defined healing limit."],
  ["diseased", "village", "Help the Village and retaliate if attacked."],
  ["lawyer", "village", "Help the Village by protecting a player from the day's lynch."],
  ["scapegoat", "village", "Help the Village; be selected by an exact tie."],
  ["hapless-victim", "village", "Help the Village while absorbing a neighboring death."],
  ["hangman", "village", "Help the Village and trigger the defined second discussion."],
  ["martyr", "village", "Help the Village by sacrificing for a lynched player."],
  ["priest-village", "village", "Help the Village by shielding against Werewolf attacks."],
  ["necromancer", "village", "Help the Village by using one defined revival."],
  ["old-crone", "village", "Help the Village by silencing one player each night."],
  ["hierophant", "village", "Help the Village while learning how many Werewolves remain."],
  ["spellcaster", "village", "Help the Village by muting or removing a vote."],
  ["insomniac", "village", "Help the Village by learning the nearest Werewolf when walking."],
  ["lycan", "village", "Help the Village while appearing Werewolf-aligned to the Seer."],
  ["mortician", "village", "Help the Village by learning death methods."],
  ["scryer", "village", "Help the Village until finding the Seer."],
  ["noble", "village", "Help the Village; skip the next day if killed."],
  ["aura-seer", "village", "Help the Village by learning whether a player has an ability."],
  ["big-bad-wolf", "werewolves", "Reach parity with the living non-Werewolves."],
  ["mystic-wolf", "werewolves", "Reach parity with the living non-Werewolves."],
  ["omega-wolf", "werewolves", "Reach parity with the living non-Werewolves."],
  ["sorcerer", "werewolves", "Reach parity with the living non-Werewolves."],
  ["poisoner-werewolf", "werewolves", "Reach parity with the living non-Werewolves."],
  ["minion", "werewolves", "Reach parity with the living non-Werewolves."],
  ["fruit-brute", "werewolves", "Reach parity with the living non-Werewolves."],
  ["fallen-angel", "werewolves", "Reach parity with the living non-Werewolves."],
  ["lone-wolf", "werewolves", "Reach parity with the living non-Werewolves."],
  ["wolf-cub", "werewolves", "Reach parity with the living non-Werewolves."],
  ["confused-wolf", "werewolves", "Reach parity with the living non-Werewolves."],
  ["german-shepherd", "werewolves", "Reach parity with the living non-Werewolves."],
  ["remorseful-werewolf", "werewolves", "Reach parity with the living non-Werewolves."],
  ["moderator", "neutral", "Complete the Moderator's defined individual objective."],
  ["murderer", "neutral", "Complete the Murderer's defined individual objective."],
  ["poisoner-neutral", "neutral", "Complete the Neutral Poisoner's defined individual objective."],
  ["turncoat", "neutral", "Complete the Turncoat's defined individual objective."],
  ["bloody-mary", "neutral", "Complete Bloody Mary's defined individual objective."],
  ["vengeful-ghost", "neutral", "Complete the Vengeful Ghost's defined individual objective."],
  ["tanner", "neutral", "Be lynched during the day."],
  ["doppelganger", "neutral", "Complete the Doppelganger's defined individual objective."],
  ["chef", "neutral", "Complete the Chef's defined individual objective."],
  ["enchantress", "neutral", "Complete the Enchantress's defined individual objective."],
  ["arsonist", "neutral", "Complete the Arsonist's defined individual objective."],
  ["thespian", "neutral", "Complete the Thespian's defined individual objective."],
  ["cupid", "neutral", "Complete Cupid's defined individual objective."],
  ["orphan", "neutral", "Complete the Orphan's defined individual objective."],
  ["guardian-angel", "neutral", "Complete the Guardian Angel's defined individual objective."],
  ["priest-neutral", "neutral", "Complete the Neutral Priest's defined individual objective."],
  ["hoodlum", "neutral", "Complete the Hoodlum's defined individual objective."]
];

for (const [name, faction, winCondition] of CATALOGUE_ROLES) {
  ROLE_DATABASE[name] = {
    name,
    faction,
    winCondition,
    description: "Catalogued role; mechanics are UNDEFINED — REQUIRES DESIGN.",
    activeAbility: null,
    designStatus: "undefined"
  };
}

// Every catalogue entry now has executable active or passive behavior.
for (const [role, proposal] of Object.entries(ROLE_PROPOSALS)) {
  Object.assign(ROLE_DATABASE[role], { description: proposal.description, activeAbility: proposal.ability, winCondition: proposal.winCondition, designStatus: "defined" });
}

export interface RoleAction { ability: string; targets: string[]; option?: string; }
export interface GameEvent { recipient?: string; text: string; }
export interface RoleMemory {
  uses: Record<string, number>;
  targets: Record<string, string[]>;
  lastProtection?: string;
  shield?: boolean;
  enduring?: boolean;
  foundSeer?: boolean;
  copied?: boolean;
  killerFaction?: Faction;
  known?: string[];
  labels?: string[];
  rehearsed?: string[];
  allegiance?: Faction;
}
export interface RoleRuntime {
  memory: Record<string, RoleMemory>;
  actions: Record<string, Record<string, RoleAction>>;
  skipped: string[];
  blockedVotes: string[];
  silenced: string[];
  reactions: string[];
  resume: "night" | "discussion";
  packBlockedNight: number;
  extraAttackNight: number;
  pierceNight: number;
  skipVoting: boolean;
  retrial: boolean;
  discussionSeconds?: number;
  accusation: Record<string, string[]>;
  events: GameEvent[];
}

export class GameError extends Error {}

export class GameEngine {
  private state: GameState;
  private rules: GameRules;

  private constructor(players: Player[], roles: RoleName[], rules: GameRules) {
    if (players.length < 4) throw new GameError("A game requires at least 4 players.");
    if (new Set(players.map((player) => player.id)).size !== players.length) throw new GameError("Player IDs must be unique.");
    if (roles.length !== players.length || roles.some((role) => !ROLE_DATABASE[role])) throw new GameError("Invalid role composition.");
    this.rules = rules;
    this.state = {
      status: "active", dayNumber: 1, nightNumber: 0, phase: "discussion",
      players: Object.fromEntries(players.map((player) => [player.id, player])), alive: players.map((player) => player.id),
      roles: {}, factions: {}, votes: {}, nightActions: {}, deaths: [], winner: null, individualWinners: []
    };
    players.forEach((player, i) => { this.state.roles[player.id] = roles[i]; this.state.factions[player.id] = ROLE_DATABASE[roles[i]].faction; });
    this.runtime();
  }

  static create(players: Player[], rules: GameRules, random = Math.random, mode: GameMode = "classic"): GameEngine {
    const roles = GameEngine.roleComposition(players.length, mode, random);
    GameEngine.shuffle(roles, random);
    const game = new GameEngine(players, roles, rules);
    game.initializeRoles(random);
    return game;
  }

  static restore(state: GameState, rules: GameRules): GameEngine {
    const game = Object.create(GameEngine.prototype) as GameEngine;
    game.rules = rules;
    game.state = structuredClone(state);
    game.state.individualWinners ??= [];
    const legacy = !game.state.runtime;
    game.runtime();
    if (legacy) {
      game.initializeRoles(() => 0.5);
      for (const [id, action] of Object.entries(game.state.nightActions)) {
        const ability = { "werewolf-target": "attack", "seer-investigate": "see", "doctor-protect": "protect" }[action.type];
        (game.runtime().actions[id] ??= {})[ability] = { ability, targets: [action.targetId] };
      }
    }
    return game;
  }

  static wolfCount(playerCount: number): number { return Math.max(1, Math.floor(playerCount / 4)); }

  static roleComposition(playerCount: number, mode: GameMode = "classic", random = Math.random): RoleName[] {
    if (!Number.isInteger(playerCount) || playerCount < 4 || playerCount > 100) throw new GameError("A game requires 4 to 100 players.");
    const count = GameEngine.wolfCount(playerCount);
    const roles: string[] = [];
    const draw = (pool: string[]) => pool.splice(Math.floor(random() * pool.length), 1)[0];
    if (mode === "chaos") {
      // Keep an attacking wolf even if the remaining faction seats draw helpers.
      roles.push("alpha-werewolf");
      const wolfPool = Object.keys(ROLE_DATABASE).filter((role) => ROLE_DATABASE[role].faction === "werewolves" && role !== "alpha-werewolf");
      while (roles.length < count) roles.push(wolfPool.length ? draw(wolfPool) : "werewolf");
      const nonWolves = Object.keys(ROLE_DATABASE).filter((role) => ROLE_DATABASE[role].faction !== "werewolves");
      const villagePool = nonWolves.filter((role) => ROLE_DATABASE[role].faction === "village");
      const neutralPool = nonWolves.filter((role) => ROLE_DATABASE[role].faction === "neutral");
      // Cap Neutral seats at one per four players. Always leave Village as the largest starting faction
      // at setup, rather than drawing a lobby full of unrelated Neutral goals.
      const neutrals = Math.max(1, Math.floor(playerCount / 4));
      for (let i = 0; i < neutrals; i++) roles.push(neutralPool.length ? draw(neutralPool) : "fool");
      while (roles.length < playerCount) roles.push(villagePool.length ? draw(villagePool) : "villager");
    } else {
      for (let i = 0; i < count; i++) roles.push(mode === "classic" && count > 1 && i === 0 ? "alpha-werewolf" : "werewolf");
      roles.push("seer");
      if (mode === "classic") roles.push("doctor");
      if (mode === "classic" && playerCount >= 5) roles.push("hunter");
      while (roles.length < playerCount) roles.push("villager");
    }
    if (mode === "chaos" && playerCount >= 6 && roles.filter((role) => role === "mason").length === 1) {
      const replacement = roles.findIndex((role) => role !== "mason" && ROLE_DATABASE[role].faction === "village");
      if (replacement >= 0) roles[replacement] = "mason";
    }
    return roles;
  }

  stateSnapshot(): GameState { return structuredClone(this.state); }

  private runtime(): RoleRuntime {
    return this.state.runtime ??= {
      memory: {}, actions: {}, skipped: [], blockedVotes: [], silenced: [], reactions: [], resume: "discussion",
      packBlockedNight: 0, extraAttackNight: 0, pierceNight: 0, skipVoting: false, retrial: false, accusation: {}, events: []
    };
  }
  private memory(id: string): RoleMemory { return this.runtime().memory[id] ??= { uses: {}, targets: {} }; }
  private role(id: string): string { return this.state.roles[id]!; }
  private faction(id: string): Faction { return this.state.factions[id]!; }
  private living(id: string): boolean { return this.state.alive.includes(id); }
  private name(id: string): string { return this.state.players[id]?.displayName ?? id; }
  private isAttacker(id: string): boolean {
    return this.faction(id) === "werewolves" && (PACK_ATTACKERS.has(this.role(id)) || ROLE_DATABASE[this.role(id)].faction !== "werewolves");
  }
  private event(text: string, recipient?: string): void { this.runtime().events.push({ text, ...(recipient ? { recipient } : {}) }); }
  drainEvents(): GameEvent[] { return this.runtime().events.splice(0); }

  private initializeRoles(random: () => number): void {
    for (const id of Object.keys(this.state.players)) {
      const memory = this.memory(id);
      const role = this.role(id);
      if (role === "guardian-angel" && !memory.targets.ward) {
        const others = this.state.alive.filter((other) => other !== id);
        memory.targets.ward = [others[Math.floor(random() * others.length)]];
      }
      if (role === "thespian" && !memory.labels) {
        const pool = Object.keys(ROLE_DATABASE);
        GameEngine.shuffle(pool, random);
        memory.labels = pool.slice(0, 3);
      }
    }
  }

  publicView(): PublicGameView {
    return {
      status: this.state.status, dayNumber: this.state.dayNumber, nightNumber: this.state.nightNumber, phase: this.state.phase,
      players: Object.values(this.state.players).map((player) => ({ ...player, alive: this.living(player.id) })),
      deaths: this.state.deaths.filter((death) => !death.revived).map(({ role, ...death }) => this.rules.revealRoleOnDeath ? { ...death, role: role ?? this.state.roles[death.playerId] } : death),
      winner: this.state.winner, individualWinners: [...this.state.individualWinners]
    };
  }
  numberedAlivePlayers(): NumberedAlivePlayer[] { return this.state.alive.map((id, i) => ({ number: i + 1, player: this.state.players[id] })); }
  numberedDeadPlayers(): NumberedAlivePlayer[] { return Object.values(this.state.players).filter((player) => !this.living(player.id)).map((player, i) => ({ number: i + 1, player })); }

  private knownPack(id: string): string[] {
    if (this.faction(id) !== "werewolves") return [];
    const role = this.role(id);
    if (role === "sorcerer") return [];
    if (role === "lone-wolf" || role === "confused-wolf") return (this.memory(id).known ?? []).filter((other) => this.living(other) && this.faction(other) === "werewolves");
    return this.state.alive.filter((other) => other !== id && this.faction(other) === "werewolves" && (role === "minion" ? this.isAttacker(other) : !["minion", "lone-wolf", "confused-wolf"].includes(this.role(other))));
  }
  privateView(id: string): PrivatePlayerView {
    this.requirePlayer(id);
    const known = this.knownPack(id);
    const memory = this.memory(id);
    const personalNotes: string[] = [];
    if (this.role(id) === "mason") personalNotes.push(`Fellow Masons: ${this.state.alive.filter((other) => other !== id && this.role(other) === "mason").map((other) => this.name(other)).join(", ") || "none"}.`);
    if (memory.targets.ward) personalNotes.push(`Your ward: ${this.name(memory.targets.ward[0])}.`);
    if (memory.labels) personalNotes.push(`Your rehearsal options: ${memory.labels.map((label, i) => `${i + 1}. ${label}`).join("; ")}.`);
    if (memory.targets.link) personalNotes.push(`Your lovers: ${memory.targets.link.map((other) => this.name(other)).join(" and ")}.`);
    if (memory.allegiance) personalNotes.push(`Personal allegiance: ${memory.allegiance}. Your investigated faction remains Neutral.`);
    return {
      player: this.state.players[id], role: this.role(id), faction: this.faction(id), roleDefinition: ROLE_DATABASE[this.role(id)],
      knownWerewolves: known, knownTeam: known.map((other) => ({ ...this.state.players[other], role: this.role(other) })),
      abilities: this.roleInstructions(id), personalNotes
    };
  }

  roleInstructions(id: string): AbilityDefinition[] {
    const role = this.role(id);
    const list = [...(ROLE_ABILITIES[role] ?? [])];
    if (this.isAttacker(id)) list.unshift(PACK_ATTACK);
    if (role === "hunter") list.push(HUNTER_SHOT);
    if (role === "vengeful-ghost") list.push(GHOST_MARK);
    return list;
  }
  availableActions(id: string): AbilityDefinition[] {
    if (this.state.status !== "active") return [];
    const phase = this.state.phase;
    const memory = this.memory(id);
    let list = this.roleInstructions(id).filter((ability) => ability.phase === phase);
    if (phase === "reaction") return this.runtime().reactions.includes(id) ? list : [];
    if (!this.living(id) || this.runtime().skipped.includes(id)) return [];
    if (phase === "night" && this.isAttacker(id) && this.runtime().extraAttackNight === this.state.nightNumber) list.push(EXTRA_ATTACK);
    return list.filter((ability) => {
      if (ability.limit && (memory.uses[ability.id] ?? 0) >= ability.limit) return false;
      if (ability.firstNight && this.state.nightNumber !== 1) return false;
      if (ability.id === "rehearse" && memory.rehearsed?.length === 3) return false;
      if (ability.id === "seek" && this.role(id) === "scryer" && memory.foundSeer) return false;
      if (ability.id === "curse" && !(this.runtime().accusation[id] ?? []).some((voter) => this.living(voter))) return false;
      if (ability.id === "fortify" && this.state.alive.filter((other) => this.isAttacker(other)).length !== 1) return false;
      if (ability.id === "ward" && !this.living(memory.targets.ward?.[0] ?? "")) return false;
      if (ability.id === "revive" && !this.revivable(id).length) return false;
      if (ability.id === "retrial" && this.runtime().retrial) return false;
      return true;
    });
  }
  actionComplete(id: string): boolean {
    if (this.runtime().skipped.includes(id)) return true;
    const submitted = this.runtime().actions[id] ?? {};
    const available = this.availableActions(id);
    // Mutually exclusive choices count as one completed role decision.
    if (submitted.convert) return true;
    if (this.role(id) === "witch" && (submitted.poison || submitted.revive)) return true;
    if (this.role(id) === "arsonist" && (submitted.douse || submitted.ignite)) return true;
    return available.every((ability) => !!submitted[ability.id]);
  }
  requiredNightActors(): string[] { return Object.keys(this.state.players).filter((id) => this.availableActions(id).length > 0); }
  allNightActionsSubmitted(): boolean { return this.state.phase === "night" && this.requiredNightActors().every((id) => this.actionComplete(id)); }
  eligibleVoters(): string[] { return this.state.alive.filter((id) => !this.runtime().blockedVotes.includes(id)); }
  allVotesSubmitted(): boolean {
    return this.state.phase === "voting" && this.eligibleVoters().every((id) => !!this.state.votes[id]) && this.state.alive.every((id) => this.actionComplete(id));
  }
  skipAction(id: string): void {
    this.requirePlayer(id);
    if (!["night", "voting", "reaction"].includes(this.state.phase)) throw new GameError("There is no action to skip in this phase.");
    if (this.state.phase === "reaction") { this.resolveReaction(id, undefined); return; }
    this.requireAlive(id);
    if (!this.runtime().skipped.includes(id)) this.runtime().skipped.push(id);
  }
  discussionMilliseconds(): number { return (this.runtime().discussionSeconds ?? 120) * 1000; }

  beginVoting(): void {
    this.requirePhase("discussion");
    this.checkWinner();
    if (this.state.status === "ended") return;
    this.state.votes = {};
    this.resetSubmissions();
    this.runtime().discussionSeconds = undefined;
    if (this.runtime().skipVoting) {
      this.runtime().skipVoting = false;
      this.event("The Noble's death has cancelled today's vote. Night falls.");
      this.startNight();
    } else this.state.phase = "voting";
  }
  beginNight(): void {
    this.requirePhase("discussion");
    this.checkWinner();
    if (this.state.status !== "ended") this.startNight();
  }
  private resetSubmissions(): void { this.runtime().actions = {}; this.runtime().skipped = []; this.state.nightActions = {}; }
  private startNight(): void {
    this.state.phase = "night";
    this.state.nightNumber++;
    this.resetSubmissions();
    this.runtime().retrial = false;
  }
  submitVote(id: string, target: string): void {
    this.requirePhase("voting"); this.requireAlive(id); this.requireAlive(target);
    if (!this.eligibleVoters().includes(id)) throw new GameError("Your vote is blocked for this phase.");
    if (this.state.votes[id]) throw new GameError("This player has already voted.");
    this.state.votes[id] = target;
  }
  unvote(id: string): void { this.requirePhase("voting"); this.requireAlive(id); delete this.state.votes[id]; }
  voteSnapshot(): VoteSnapshot {
    const counts: Record<string, number> = {};
    for (const [voter, target] of Object.entries(this.state.votes)) if (this.eligibleVoters().includes(voter)) counts[target] = (counts[target] ?? 0) + 1;
    return { submitted: { ...this.state.votes }, counts };
  }

  submitAction(id: string, action: RoleAction): void {
    this.requirePlayer(id);
    const definition = this.availableActions(id).find((ability) => ability.id === action.ability);
    if (!definition) throw new GameError("That ability is unavailable to you in this phase, already spent, or skipped. Use !actions for your current choices.");
    if (this.runtime().actions[id]?.[action.ability]) throw new GameError("This ability has already been submitted this phase.");
    if (definition.targetKind === "option") {
      if (action.targets.length || !action.option) throw new GameError("Choose one of the options shown in your private prompt.");
      if (action.ability === "allegiance" && !["village", "werewolves"].includes(action.option)) throw new GameError("Choose village or werewolves.");
      if (action.ability === "rehearse" && !["1", "2", "3"].includes(action.option)) throw new GameError("Choose rehearsal option 1, 2, or 3.");
    } else {
      if (action.option || action.targets.length !== definition.targets || new Set(action.targets).size !== action.targets.length) throw new GameError(`Choose ${definition.targets} different player target(s).`);
      for (const target of action.targets) {
        this.requirePlayer(target);
        if (definition.noSelf && target === id) throw new GameError("You cannot target yourself with this ability.");
        if (definition.targetKind === "dead" ? this.living(target) : !this.living(target)) throw new GameError(`Choose a ${definition.targetKind === "dead" ? "dead" : "living"} player.`);
      }
    }
    const role = this.role(id), target = action.targets[0], memory = this.memory(id), current = this.runtime().actions[id] ?? {};
    if (["attack", "extra", "maul", "convert"].includes(action.ability) && this.faction(target) === "werewolves") throw new GameError("The pack cannot attack or convert its own faction.");
    if (action.ability === "convert" && this.faction(target) !== "village") throw new GameError("Alpha conversion only works on Village players.");
    if (["shield", "disguise"].includes(action.ability) && this.faction(target) !== "werewolves") throw new GameError("Choose a Werewolf faction ally.");
    if ((role === "mystic-wolf" || role === "poisoner-werewolf") && target && this.faction(target) === "werewolves") throw new GameError("Choose a non-pack player.");
    if (action.ability === "sanctuary" && memory.lastProtection === target) throw new GameError("You cannot protect the same player on consecutive nights.");
    if (["serve", "bless", "enchant", "douse"].includes(action.ability) && (memory.targets[action.ability] ?? []).includes(target)) throw new GameError("Choose a player you have not already marked with this ability.");
    if (action.ability === "curse" && !(this.runtime().accusation[id] ?? []).includes(target)) throw new GameError("Choose someone who voted for you on a previous day.");
    if (action.ability === "revive" && !this.revivable(id).includes(target)) throw new GameError("That player is not eligible for your revival.");
    if (role === "witch" && (current.poison || current.revive)) throw new GameError("Use only one Witch potion per night.");
    if (role === "arsonist" && (current.douse || current.ignite)) throw new GameError("Douse or ignite, not both in the same night.");
    if (action.ability === "rehearse" && (memory.rehearsed ?? []).includes(memory.labels![Number(action.option) - 1])) throw new GameError("That label has already been rehearsed.");
    if (action.ability === "haunt" && memory.killerFaction && this.faction(target) !== memory.killerFaction) throw new GameError("Choose a target from your killer's faction.");
    if (this.state.phase === "reaction") { this.resolveReaction(id, action); return; }
    (this.runtime().actions[id] ??= {})[action.ability] = structuredClone(action);
    if (action.ability === "audit") { this.spend(id, "audit"); this.event(`Missing night submissions: ${this.requiredNightActors().filter((actor) => !this.actionComplete(actor)).length}.`, id); }
  }

  submitNightAction(id: string, action: NightAction): void {
    this.requireAlive(id); this.requirePhase("night");
    const ability = { "werewolf-target": "attack", "seer-investigate": "see", "doctor-protect": "protect" }[action.type];
    if (!this.availableActions(id).some((entry) => entry.id === ability)) throw new GameError(`This action is not available to the ${this.role(id)} role.`);
    this.submitAction(id, { ability, targets: [action.targetId] });
    this.state.nightActions[id] = structuredClone(action);
  }

  resolveVote(force = false): string | null {
    this.requirePhase("voting");
    if (!force && !this.allVotesSubmitted()) throw new GameError("Every living player must vote and use or skip their voting ability before resolution.");
    const runtime = this.runtime();
    const votes = this.voteSnapshot();
    const highest = Math.max(0, ...Object.values(votes.counts));
    let leaders = Object.keys(votes.counts).filter((id) => votes.counts[id] === highest);
    for (const [voter, target] of Object.entries(votes.submitted)) {
      if (!this.eligibleVoters().includes(voter)) continue;
      const accusers = runtime.accusation[target] ??= [];
      if (!accusers.includes(voter)) accusers.push(voter);
    }
    if (leaders.length > 1) {
      const scapegoat = this.state.alive.find((id) => this.role(id) === "scapegoat");
      leaders = scapegoat ? [scapegoat] : [];
    }
    let eliminated: string | null = leaders.length === 1 ? leaders[0] : null;
    const actions = this.entries();
    const retrial = actions.find(([, action]) => action.ability === "retrial");
    if (eliminated && retrial && !runtime.retrial) {
      this.spend(retrial[0], "retrial"); runtime.retrial = true;
      runtime.discussionSeconds = 30;
      this.resetSubmissions(); this.state.votes = {}; this.state.phase = "discussion";
      this.event("The Hangman calls a final hearing: 30 seconds of discussion, then a fresh vote.");
      return null;
    }
    if (eliminated) {
      const lawyer = actions.find(([, action]) => action.ability === "defend" && action.targets[0] === eliminated);
      const martyr = actions.find(([, action]) => action.ability === "sacrifice" && action.targets[0] === eliminated);
      if (lawyer) { this.spend(lawyer[0], "defend"); this.event(`${this.name(eliminated)} was saved by a defence. No voting death today.`); eliminated = null; }
      else if (martyr) { this.spend(martyr[0], "sacrifice"); eliminated = martyr[0]; }
      if (eliminated) {
        this.kill(eliminated, "vote");
        if (["fool", "tanner"].includes(this.role(eliminated))) this.personalWin(eliminated);
      }
    }
    for (const id of [...this.state.alive]) {
      if (!this.living(id) || this.role(id) !== "bloody-mary") continue;
      const cursed = this.memory(id).targets.curse?.[0];
      if (cursed && votes.submitted[cursed] === id && this.living(cursed)) {
        this.kill(cursed, "curse", id); this.personalWin(id);
      }
    }
    runtime.blockedVotes = []; this.resetSubmissions(); this.state.votes = {};
    this.settle("night");
    return eliminated;
  }

  private entries(): Array<[string, RoleAction]> {
    return Object.keys(this.state.players).flatMap((id) => Object.values(this.runtime().actions[id] ?? {}).sort((a, b) => a.ability.localeCompare(b.ability)).map((action): [string, RoleAction] => [id, action]));
  }
  private spend(id: string, ability: string): void { const uses = this.memory(id).uses; uses[ability] = (uses[ability] ?? 0) + 1; }
  private personalWin(id: string): void {
    if (this.state.individualWinners.includes(id)) return;
    this.state.individualWinners.push(id);
    this.event(`${this.name(id)} achieved a personal win. The remaining players can still win.`);
  }
  private revivable(id: string): string[] {
    return Object.keys(this.state.players).filter((target) => {
      if (this.living(target) || this.state.individualWinners.includes(target)) return false;
      const death = [...this.state.deaths].reverse().find((entry) => entry.playerId === target && !entry.revived);
      if (!death || !["night-attack", "poison", "fire"].includes(death.cause)) return false;
      // At night N, the immediately preceding completed night ended on day N.
      return this.role(id) !== "witch" || death.dayNumber === this.state.dayNumber - 1;
    });
  }
  private packTarget(entries: Array<[string, RoleAction]>, ability: string): string | undefined {
    const counts = new Map<string, number>();
    for (const [, action] of entries.filter(([id, action]) => this.isAttacker(id) && action.ability === ability)) counts.set(action.targets[0], (counts.get(action.targets[0]) ?? 0) + 1);
    const highest = Math.max(0, ...counts.values());
    const leaders = [...counts].filter(([, count]) => count === highest).map(([id]) => id);
    return leaders.length === 1 ? leaders[0] : undefined;
  }

  resolveNight(force = false): NightResolution {
    this.requirePhase("night");
    if (!force && !this.allNightActionsSubmitted()) throw new GameError("All available night actions must be submitted or skipped before resolution.");
    const rt = this.runtime(), entries = this.entries(), beforeDeaths = this.state.deaths.length;
    const investigations: NightResolution["investigations"] = [];
    const protection = new Set<string>(), sanctuary = new Set<string>(), shields = new Map<string, number>(), disguises = new Set<string>();
    const addShield = (id: string) => shields.set(id, (shields.get(id) ?? 0) + 1);
    const actionsBy = (ability: string) => entries.filter(([, action]) => action.ability === ability);
    for (const [id, action] of entries) {
      const target = action.targets[0];
      if (action.ability === "protect") protection.add(target);
      if (action.ability === "sanctuary") { sanctuary.add(target); this.memory(id).lastProtection = target; }
      if (action.ability === "shield") { addShield(target); this.spend(id, "shield"); }
      if (action.ability === "ward") { addShield(this.memory(id).targets.ward[0]); this.spend(id, "ward"); }
      if (action.ability === "disguise") { disguises.add(target); this.spend(id, "disguise"); }
      if (["copy", "adopt", "mark", "link", "curse"].includes(action.ability)) {
        this.memory(id).targets[action.ability] = [...action.targets]; this.spend(id, action.ability);
        if (action.ability === "link") for (const lover of action.targets) this.event(`Your linked partner is ${this.name(action.targets.find((other) => other !== lover)!)}. If either of you dies, the other dies of heartbreak.`, lover);
      }
      if (action.ability === "allegiance") { this.memory(id).allegiance = action.option as Faction; this.spend(id, "allegiance"); }
      if (["serve", "bless", "enchant", "douse"].includes(action.ability)) {
        (this.memory(id).targets[action.ability] ??= []).push(target);
        if (action.ability === "enchant") this.event("You have been enchanted. Your faction and abilities have not changed.", target);
      }
      if (action.ability === "rehearse") { (this.memory(id).rehearsed ??= []).push(this.memory(id).labels![Number(action.option) - 1]); }
    }
    // Nonconsecutive Priest protection also resets across nights where no target was chosen.
    for (const id of this.state.alive.filter((id) => this.role(id) === "priest-village")) if (!actionsBy("sanctuary").some(([actor]) => actor === id)) this.memory(id).lastProtection = undefined;
    const hit = (target: string, cause: DeathRecord["cause"], killer: string, pack = false, pierce = false): void => {
      if (!this.living(target)) return;
      if (cause === "night-attack" && ((!pierce && protection.has(target)) || (pack && !pierce && sanctuary.has(target)))) {
        for (const [protector, action] of entries) if (action.targets[0] === target && (action.ability === "protect" || (pack && action.ability === "sanctuary"))) this.event(`Your protection prevented an attack on ${this.name(target)}.`, protector);
        return;
      }
      const shield = shields.get(target) ?? 0;
      if (shield) { shields.set(target, shield - 1); return; }
      if (this.memory(target).shield) { this.memory(target).shield = false; return; }
      if (pack && this.role(target) === "old-man" && !this.memory(target).enduring) { this.memory(target).enduring = true; return; }
      this.kill(target, cause, killer);
    };
    const packBlocked = rt.packBlockedNight === this.state.nightNumber || actionsBy("veto").length > 0;
    for (const [id] of actionsBy("veto")) this.spend(id, "veto");
    let primary = this.packTarget(entries, "attack");
    for (const [id] of actionsBy("fortify")) { this.memory(id).shield = true; primary = undefined; }
    const conversion = actionsBy("convert")[0];
    if (!packBlocked && conversion) {
      const [id, action] = conversion, target = action.targets[0];
      this.spend(id, "convert");
      if (this.living(target) && !protection.has(target) && this.faction(target) === "village") {
        this.state.factions[target] = "werewolves";
        this.event("The Alpha has converted you. You now win with the Werewolf faction and can submit a pack attack alongside your original ability. Use !myrole to see your pack.", target);
        for (const ally of this.state.alive.filter((other) => other === target || this.knownPack(other).includes(target))) this.event(`Pack update: ${this.name(target)} has joined your faction. Use !myrole privately for the current pack.`, ally);
      } else if (protection.has(target)) {
        for (const [protector, action] of entries) if (action.ability === "protect" && action.targets[0] === target) this.event(`Your protection blocked a harmful effect on ${this.name(target)}.`, protector);
        this.event("Your conversion was blocked. Its one-time charge is spent.", id);
      }
    } else if (!packBlocked) {
      const killer = entries.find(([id, action]) => this.isAttacker(id) && action.ability === "attack")?.[0];
      const extra = this.packTarget(entries, "extra") ?? actionsBy("maul")[0]?.[1].targets[0];
      for (const [id] of actionsBy("maul")) this.spend(id, "maul");
      for (const target of [...new Set([primary, extra].filter((id): id is string => !!id))].slice(0, 2)) {
        let victim = target;
        const seats = Object.keys(this.state.players).filter((id) => this.living(id));
        const substitute = seats.find((id) => this.role(id) === "hapless-victim" && !this.memory(id).uses.substitute && seats[(seats.indexOf(id) + 1) % seats.length] === target);
        if (substitute && !protection.has(target) && !sanctuary.has(target)) { victim = substitute; this.spend(substitute, "substitute"); }
        hit(victim, "night-attack", killer ?? this.state.alive.find((id) => this.isAttacker(id))!, true, rt.pierceNight > 0 && this.state.nightNumber >= rt.pierceNight);
      }
      if ((primary || extra) && rt.pierceNight > 0 && this.state.nightNumber >= rt.pierceNight) rt.pierceNight = 0;
    }
    for (const [id, action] of actionsBy("kill")) hit(action.targets[0], "night-attack", id);
    for (const [id] of actionsBy("ignite")) {
      for (const target of this.memory(id).targets.douse ?? []) hit(target, "fire", id);
      this.memory(id).targets.douse = [];
    }
    for (const [id, action] of actionsBy("poison")) {
      if (this.role(id) === "poisoner-neutral" && !this.living(id)) continue;
      hit(action.targets[0], "poison", id); this.spend(id, "poison");
    }
    for (const [id, action] of actionsBy("revive")) {
      const target = action.targets[0];
      if (this.living(id) && !this.living(target)) {
        this.state.alive.push(target);
        this.state.alive.sort((a, b) => Object.keys(this.state.players).indexOf(a) - Object.keys(this.state.players).indexOf(b));
        for (const death of this.state.deaths.filter((death) => death.playerId === target)) death.revived = true;
        this.spend(id, "revive"); this.event(`${this.name(target)} has returned to life.`);
        this.event("You have been revived. Your role and faction remain the same; used powers remain spent.", target);
      }
    }
    rt.blockedVotes = []; rt.silenced = [];
    for (const [id, action] of entries) {
      const target = action.targets[0];
      if (action.ability === "disenfranchise") { rt.blockedVotes.push(target); this.spend(id, "disenfranchise"); this.event("Your next vote is blocked. You may still use other abilities.", target); }
      if (action.ability === "silence") { rt.silenced.push(target); this.event(`${this.name(target)} must remain silent during the next discussion (honour rule). Private actions remain available.`); }
      if (action.ability === "see") {
        const faction = disguises.has(target) ? "village" : this.role(target) === "lycan" ? "werewolves" : this.faction(target);
        investigations.push({ seerId: id, targetId: target, faction });
        this.event(`${this.name(target)} appears ${faction}-aligned.`, id);
      }
      if (action.ability === "compare") this.event(`${action.targets.map((other) => this.name(other)).join(" and ")} ${this.faction(action.targets[0]) === this.faction(action.targets[1]) ? "share" : "do not share"} the same actual faction.`, id);
      if (action.ability === "seek") {
        const found = this.role(target) === "seer";
        this.event(`${this.name(target)} ${found ? "is" : "is not"} the Seer.`, id);
        if (found && this.role(id) === "scryer") { this.memory(id).foundSeer = true; this.event(`${this.name(id)} is the Village Scryer and has found you.`, target); }
      }
      if (action.ability === "aura") this.event(`${this.name(target)} ${this.role(target) === "villager" && !this.isAttacker(target) ? "has no special power" : "has a special power"}.`, id);
      if (action.ability === "sniff") {
        this.event(`${this.name(target)} ${this.faction(target) === "werewolves" ? "belongs" : "does not belong"} to the Werewolf faction.`, id);
        if (this.faction(target) === "werewolves") (this.memory(id).known ??= []).push(target);
      }
      if (action.ability === "walk") {
        const seats = Object.keys(this.state.players).filter((other) => this.living(other));
        const pos = seats.indexOf(id);
        if (pos < 0) { this.event("Your walk ended with your death.", id); continue; }
        const distances = seats.filter((other) => this.faction(other) === "werewolves").map((other) => { const distance = Math.abs(seats.indexOf(other) - pos); return Math.min(distance, seats.length - distance); });
        this.event(distances.length ? `Nearest Werewolf faction member: ${Math.min(...distances)} living seat(s) away.` : "No Werewolf faction members remain.", id);
      }
    }
    const newDeaths = this.state.deaths.slice(beforeDeaths).filter((death) => !death.revived);
    for (const id of this.state.alive) {
      if (this.role(id) === "hierophant") this.event(`Living Werewolf faction members: ${this.state.alive.filter((other) => this.faction(other) === "werewolves").length}.`, id);
      if (this.role(id) === "mortician") this.event(newDeaths.length ? newDeaths.map((death) => `${this.name(death.playerId)}: ${death.cause}`).join("\n") : "No new deaths tonight.", id);
    }
    this.resetSubmissions();
    this.state.dayNumber++;
    rt.discussionSeconds = undefined;
    this.settle("discussion");
    return { deaths: newDeaths.map((death) => death.playerId), investigations, protectedTargetId: [...protection][0] ?? null, phase: this.state.phase, winner: this.state.winner, individualWinners: [...this.state.individualWinners] };
  }

  private kill(id: string, cause: DeathRecord["cause"], killer?: string): void {
    if (!this.living(id)) return;
    this.state.alive = this.state.alive.filter((other) => other !== id);
    this.state.deaths.push({ playerId: id, role: this.role(id), dayNumber: this.state.dayNumber, cause });
    const role = this.role(id), memory = this.memory(id), rt = this.runtime();
    if (["shot", "heartbreak", "curse"].includes(cause)) this.event(`${this.name(id)} died${this.rules.revealRoleOnDeath ? ` — ${role.replace(/-/g, " ")}` : ""} (${cause}).`);
    if (killer) memory.killerFaction = this.faction(killer);
    if ((role === "hunter" && !memory.uses.shoot) || (role === "vengeful-ghost" && !memory.uses.haunt)) rt.reactions.push(id);
    if (role === "diseased" && cause === "night-attack" && killer && this.isAttacker(killer)) rt.packBlockedNight = this.state.nightNumber + 1;
    if (role === "wolf-cub") rt.extraAttackNight = this.state.nightNumber + 1;
    if (role === "omega-wolf" && cause === "vote") { rt.packBlockedNight = this.state.nightNumber + 1; rt.pierceNight = this.state.nightNumber + 2; }
    if (role === "noble") rt.skipVoting = true;
    for (const other of Object.keys(this.state.players)) {
      const otherMemory = this.memory(other);
      if (this.role(other) === "doppelganger" && this.living(other) && !otherMemory.copied && otherMemory.targets.copy?.[0] === id) {
        const priorUses = otherMemory.uses;
        this.state.roles[other] = role; this.state.factions[other] = this.faction(id);
        rt.memory[other] = { ...structuredClone(memory), uses: { ...priorUses, ...memory.uses }, copied: true };
        this.event(`Your target died. You are now ${role} (${this.faction(other)}). Use !myrole for your new instructions.`, other);
      }
      const lovers = otherMemory.targets.link;
      if (lovers?.includes(id)) for (const lover of lovers) if (lover !== id) this.kill(lover, "heartbreak", killer);
    }
  }

  resolveReaction(id: string, action?: RoleAction): void {
    this.requirePhase("reaction");
    if (!this.runtime().reactions.includes(id)) throw new GameError("You have no pending death reaction.");
    if (action) {
      this.spend(id, action.ability);
      if (action.ability === "shoot") { this.kill(action.targets[0], "shot", id); this.event(`${this.name(id)} fired a final shot at ${this.name(action.targets[0])}.`); }
      if (action.ability === "haunt") { this.memory(id).targets.haunt = [...action.targets]; this.event(`Your revenge target is ${this.name(action.targets[0])}.`, id); }
    } else { this.spend(id, this.role(id) === "hunter" ? "shoot" : "haunt"); this.event(`${this.name(id)}'s final action was skipped.`); }
    this.runtime().reactions = this.runtime().reactions.filter((other) => other !== id);
    this.settle(this.runtime().resume);
  }
  expireReactions(): void { for (const id of [...this.runtime().reactions]) if (this.runtime().reactions.includes(id)) this.resolveReaction(id); }
  reactionActors(): string[] { return [...this.runtime().reactions]; }
  private settle(next: "night" | "discussion"): void {
    this.runtime().resume = next;
    if (this.runtime().reactions.length && this.state.alive.length) { this.state.phase = "reaction"; return; }
    this.checkWinner();
    if (this.state.status === "ended") return;
    if (next === "night") this.startNight();
    else this.state.phase = "discussion";
  }

  private checkWinner(): void {
    if (this.runtime().reactions.length && this.state.alive.length) return;
    for (const id of Object.keys(this.state.players)) {
      const role = this.role(id), memory = this.memory(id);
      if (this.living(id) && ((role === "chef" && (memory.targets.serve?.length ?? 0) >= 3) || (role === "priest-neutral" && (memory.targets.bless?.length ?? 0) >= 3))) this.personalWin(id);
      if (role === "hoodlum" && this.living(id) && memory.targets.mark?.length === 2 && memory.targets.mark.every((target) => !this.living(target))) this.personalWin(id);
      if (role === "vengeful-ghost" && memory.targets.haunt?.length && !this.living(memory.targets.haunt[0])) this.personalWin(id);
    }
    const enchantress = this.state.alive.find((id) => this.role(id) === "enchantress" && this.state.alive.every((other) => other === id || (this.memory(id).targets.enchant ?? []).includes(other)));
    const killer = this.state.alive.length === 1 ? this.state.alive.find((id) => INDEPENDENT_KILLERS.has(this.role(id))) : undefined;
    if (enchantress || killer) { this.personalWin((enchantress || killer)!); this.state.winner = "neutral"; }
    else if (!this.state.alive.length) this.state.winner = "neutral";
    else if (!this.state.alive.some((id) => INDEPENDENT_KILLERS.has(this.role(id)))) {
      const wolves = this.state.alive.filter((id) => this.faction(id) === "werewolves").length;
      if (!wolves) this.state.winner = this.state.alive.some((id) => this.faction(id) === "village") ? "village" : "neutral";
      else if (wolves >= this.state.alive.length / 2) this.state.winner = "werewolves";
    }
    if (!this.state.winner) return;
    for (const id of Object.keys(this.state.players)) {
      const role = this.role(id), m = this.memory(id);
      if (this.faction(id) !== "neutral") continue;
      if (this.living(id) && ["moderator", "orphan"].includes(role)) this.personalWin(id);
      if (role === "turncoat" && this.living(id) && m.allegiance === this.state.winner) this.personalWin(id);
      if (role === "thespian" && this.living(id) && m.rehearsed?.length === 3) this.personalWin(id);
      if (role === "guardian-angel" && m.targets.ward?.length && this.living(m.targets.ward[0])) this.personalWin(id);
      if (role === "cupid" && m.targets.link?.length === 2 && m.targets.link.every((target) => this.living(target))) this.personalWin(id);
      if (role === "doppelganger" && this.living(id) && !m.copied && m.targets.copy?.some((target) => this.living(target))) this.personalWin(id);
    }
    this.state.status = "ended"; this.state.phase = "ended";
  }
  forceEnd(): void { this.state.status = "ended"; this.state.phase = "ended"; this.runtime().reactions = []; }
  private requirePlayer(id: string): void { if (!this.state.players[id]) throw new GameError("Unknown player."); }
  private requireAlive(id: string): void { this.requirePlayer(id); if (!this.living(id)) throw new GameError("Dead players cannot perform this action."); }
  private requirePhase(phase: Phase): void { if (this.state.phase !== phase) throw new GameError(`This action is unavailable during ${this.state.phase}.`); }
  private static shuffle<T>(items: T[], random: () => number): void {
    for (let i = items.length - 1; i > 0; i--) { const other = Math.floor(random() * (i + 1)); [items[i], items[other]] = [items[other], items[i]]; }
  }
}
