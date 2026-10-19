export type PlayerId = string;
export type Faction = "village" | "werewolves" | "neutral";
export type RoleName = string;
export type GameMode = "classic" | "beginner" | "chaos";
export type Phase = "lobby" | "discussion" | "voting" | "night" | "ended";

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
  deaths: DeathRecord[];
  winner: Faction | null;
  individualWinners: PlayerId[];
}

export interface DeathRecord {
  playerId: PlayerId;
  dayNumber: number;
  cause: "vote" | "night-attack" | "undefined";
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

export class GameError extends Error {}

export class GameEngine {
  private state: GameState;
  private rules: GameRules;

  private constructor(players: Player[], roles: RoleName[], rules: GameRules) {
    if (players.length < 4) throw new GameError("A game requires at least 4 players.");
    if (new Set(players.map((player) => player.id)).size !== players.length) {
      throw new GameError("Player IDs must be unique.");
    }
    if (roles.length !== players.length) throw new GameError("Role count must match player count.");
    this.rules = rules;
    this.state = {
      status: "lobby",
      dayNumber: 0,
      nightNumber: 0,
      phase: "lobby",
      players: Object.fromEntries(players.map((player) => [player.id, player])),
      alive: players.map((player) => player.id),
      roles: {},
      factions: {},
      votes: {},
      nightActions: {},
      deaths: [],
      winner: null,
      individualWinners: []
    };
    this.assignRoles(roles);
  }

  static create(players: Player[], rules: GameRules, random = Math.random, mode: GameMode = "classic"): GameEngine {
    const roles = GameEngine.roleComposition(players.length, mode, random);
    GameEngine.shuffle(roles, random);
    const engine = new GameEngine(players, roles, rules);
    engine.state.status = "active";
    engine.state.dayNumber = 1;
    engine.state.phase = "discussion";
    return engine;
  }

  static restore(state: GameState, rules: GameRules): GameEngine {
    const engine = Object.create(GameEngine.prototype) as GameEngine;
    engine.rules = rules;
    engine.state = JSON.parse(JSON.stringify(state)) as GameState;
    engine.state.individualWinners ??= [];
    return engine;
  }

  stateSnapshot(): GameState {
    return JSON.parse(JSON.stringify(this.state)) as GameState;
  }

  static roleComposition(playerCount: number, mode: GameMode = "classic", random = Math.random): RoleName[] {
    if (playerCount < 4) throw new GameError("A game requires at least 4 players.");
    const roles: RoleName[] = mode === "chaos" ? ["werewolf"] : mode === "beginner"
      ? ["werewolf", "seer", "villager", "villager"]
      : ["werewolf", "seer", "doctor", "villager"];
    if (mode === "chaos") {
      // Preserve the existing single-Werewolf balance until Part 2 is supplied.
      // Sampling without replacement gives every other catalogue role a turn
      // before repeats, including roles with mechanics still awaiting design.
      const pool = Object.keys(ROLE_DATABASE).filter((role) =>
        ROLE_DATABASE[role].faction !== "werewolves" && !roles.includes(role));
      const eligible = [...pool];
      while (roles.length < playerCount) {
        if (!pool.length) pool.push(...eligible);
        const index = Math.floor(random() * pool.length);
        roles.push(pool.splice(index, 1)[0]);
      }
    } else {
      if (mode === "classic" && playerCount >= 5) roles.push("hunter");
      while (roles.length < playerCount) roles.push("villager");
    }
    return roles;
  }

  publicView(): PublicGameView {
    return {
      status: this.state.status,
      dayNumber: this.state.dayNumber,
      nightNumber: this.state.nightNumber,
      phase: this.state.phase,
      players: Object.values(this.state.players).map((player) => ({ ...player, alive: this.state.alive.includes(player.id) })),
      deaths: this.state.deaths.map((death) => ({ ...death })),
      individualWinners: [...this.state.individualWinners],
      winner: this.state.winner
    };
  }

  numberedAlivePlayers(): NumberedAlivePlayer[] {
    return this.state.alive.map((playerId, index) => ({ number: index + 1, player: this.state.players[playerId] }));
  }

  privateView(playerId: PlayerId): PrivatePlayerView {
    this.requirePlayer(playerId);
    const role = this.state.roles[playerId];
    const faction = this.state.factions[playerId];
    if (!role || !faction) throw new GameError("Role assignment is incomplete.");
    return {
      player: this.state.players[playerId],
      role,
      faction,
      roleDefinition: ROLE_DATABASE[role],
      knownWerewolves: faction === "werewolves" ? this.state.alive.filter((id) => this.state.factions[id] === "werewolves") : []
    };
  }

  beginVoting(): void {
    this.requirePhase("discussion");
    this.checkWinner();
    if (this.state.status === "ended") return;
    this.state.votes = {};
    this.state.phase = "voting";
  }

  beginNight(): void {
    this.requirePhase("discussion");
    this.checkWinner();
    if (this.state.status === "ended") return;
    this.state.phase = "night";
    this.state.nightNumber += 1;
  }

  submitVote(voterId: PlayerId, targetId: PlayerId): void {
    this.requireAlive(voterId);
    this.requirePhase("voting");
    this.requireAlive(targetId);
    if (this.state.votes[voterId]) throw new GameError("This player has already voted.");
    this.state.votes[voterId] = targetId;
  }

  unvote(voterId: PlayerId): void {
    this.requireAlive(voterId);
    this.requirePhase("voting");
    delete this.state.votes[voterId];
  }

  voteSnapshot(): VoteSnapshot {
    const counts: Record<PlayerId, number> = {};
    for (const targetId of Object.values(this.state.votes)) counts[targetId] = (counts[targetId] ?? 0) + 1;
    return { submitted: { ...this.state.votes }, counts };
  }

  resolveVote(force = false): PlayerId | null {
    this.requirePhase("voting");
    this.checkWinner();
    if (this.state.status === "ended") return null;
    const livingVoters = this.state.alive.filter((id) => this.state.votes[id]);
    if (!force && livingVoters.length !== this.state.alive.length) throw new GameError("Every living player must vote before resolution.");
    const counts = new Map<PlayerId, number>();
    for (const targetId of Object.values(this.state.votes)) counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
    const highest = Math.max(...counts.values());
    const leaders = [...counts.entries()].filter(([, count]) => count === highest).map(([id]) => id);
    if (leaders.length === 0) {
      this.state.phase = "night";
      this.state.nightNumber += 1;
      return null;
    }
    if (leaders.length > 1) {
      this.state.phase = "night";
      this.state.nightNumber += 1;
      return null;
    }
    this.kill(leaders[0], "vote");
    if (["fool", "tanner"].includes(this.state.roles[leaders[0]]!)) {
      this.state.individualWinners.push(leaders[0]);
    }
    this.checkWinner();
    if (!this.state.winner) {
      this.state.phase = "night";
      this.state.nightNumber += 1;
    }
    return leaders[0];
  }

  submitNightAction(actorId: PlayerId, action: NightAction): void {
    this.requireAlive(actorId);
    this.requirePhase("night");
    const role = this.state.roles[actorId];
    const allowed: Record<RoleName, NightAction["type"] | null> = {
      werewolf: "werewolf-target", "alpha-werewolf": null, villager: null,
      seer: "seer-investigate", doctor: "doctor-protect", hunter: null
    };
    if (allowed[role!] !== action.type) {
      throw new GameError(`This action is not available to the ${role ?? "unknown"} role.`);
    }
    this.requireAlive(action.targetId);
    if (this.state.nightActions[actorId]) throw new GameError("This player has already submitted a night action.");
    this.state.nightActions[actorId] = action;
  }

  requiredNightActors(): PlayerId[] {
    return this.state.alive.filter((playerId) => {
      const role = this.state.roles[playerId];
      return role === "werewolf" || role === "seer" || role === "doctor";
    });
  }

  resolveNight(force = false): NightResolution {
    this.requirePhase("night");
    this.checkWinner();
    if (this.state.status === "ended") return { deaths: [], investigations: [], protectedTargetId: null, phase: "ended", winner: this.state.winner, individualWinners: [...this.state.individualWinners] };
    const requiredActors = this.requiredNightActors();
    if (!force && requiredActors.some((actorId) => !this.state.nightActions[actorId])) {
      throw new GameError("All available night actions must be submitted before resolution.");
    }
    const actions = Object.values(this.state.nightActions);
    const protection = actions.find((action) => action.type === "doctor-protect");
    const attack = actions.find((action) => action.type === "werewolf-target");
    const investigations = actions
      .filter((action): action is Extract<NightAction, { type: "seer-investigate" }> => action.type === "seer-investigate")
      .map((action) => ({ seerId: Object.keys(this.state.nightActions).find((id) => this.state.nightActions[id] === action)!, targetId: action.targetId, faction: this.state.factions[action.targetId]! }));
    const deaths: PlayerId[] = [];
    if (attack && attack.targetId !== protection?.targetId) {
      this.kill(attack.targetId, "night-attack");
      deaths.push(attack.targetId);
    }
    this.state.nightActions = {};
    this.checkWinner();
    if (!this.state.winner) {
      this.state.dayNumber += 1;
      this.state.phase = "discussion";
    }
    return { deaths, investigations, protectedTargetId: protection?.targetId ?? null, phase: this.state.phase, winner: this.state.winner, individualWinners: [...this.state.individualWinners] };
  }

  forceEnd(): void {
    this.state.status = "ended";
    this.state.phase = "ended";
  }

  private assignRoles(roles: RoleName[]): void {
    Object.keys(this.state.players).forEach((playerId, index) => {
      const role = roles[index];
      this.state.roles[playerId] = role;
      this.state.factions[playerId] = ROLE_DATABASE[role].faction;
    });
  }

  private kill(playerId: PlayerId, cause: DeathRecord["cause"]): void {
    this.state.alive = this.state.alive.filter((id) => id !== playerId);
    this.state.deaths.push({ playerId, dayNumber: this.state.dayNumber, cause });
  }

  private checkWinner(): void {
    const livingFactions = new Set(this.state.alive.map((id) => this.state.factions[id]));
    if (!livingFactions.has("werewolves")) this.state.winner = "village";
    else if (livingFactions.has("werewolves") && this.state.alive.filter((id) => this.state.factions[id] === "werewolves").length >= this.state.alive.length / 2) this.state.winner = "werewolves";
    if (this.state.winner) {
      this.state.status = "ended";
      this.state.phase = "ended";
    }
  }

  private requirePlayer(playerId: PlayerId): void {
    if (!this.state.players[playerId]) throw new GameError("Unknown player.");
  }

  private requireAlive(playerId: PlayerId): void {
    this.requirePlayer(playerId);
    if (!this.state.alive.includes(playerId)) throw new GameError("Dead players cannot perform this action.");
  }

  private requirePhase(phase: Phase): void {
    if (this.state.phase !== phase) throw new GameError(`This action is unavailable during ${this.state.phase}.`);
  }

  private static shuffle<T>(items: T[], random: () => number): void {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
  }
}
