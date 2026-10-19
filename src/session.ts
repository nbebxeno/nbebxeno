import { GameEngine, GameError, type GameMode, type GameRules, type NightResolution, type Player, type PrivatePlayerView, type RoleDefinition, ROLE_DATABASE, type VoteSnapshot } from "./engine.ts";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export interface LobbySnapshot { groupId: string; hostId: string; players: Player[]; started: boolean; }
export interface StartedGame { engine: GameEngine; players: Player[]; privateViews: PrivatePlayerView[]; }
export interface VoteResult { eliminatedPlayerId: string | null; phase: string; winner: string | null; }
export interface CompletedPlayer { id: string; role: string; faction: string; alive: boolean; lynched: boolean; }
export interface ResumableGame { groupId: string; phase: string; deadline?: number; nextPhase?: "night" | "voting"; }

interface GroupSession {
  groupId: string;
  hostId: string;
  players: Map<string, Player>;
  aliases: Map<string, string>;
  engine?: GameEngine;
  recorded?: boolean;
  enabledRoles?: string[];
  phaseDeadline?: number;
  phaseNext?: "night" | "voting";
  mode?: GameMode;
}

interface PersistedGroupSession {
  groupId: string;
  hostId: string;
  players: Player[];
  aliases: Array<[string, string]>;
  engineState?: ReturnType<GameEngine["stateSnapshot"]>;
  recorded?: boolean;
  enabledRoles?: string[];
  phaseDeadline?: number;
  phaseNext?: "night" | "voting";
  mode?: GameMode;
}

export class GameSessions {
  private readonly sessions = new Map<string, GroupSession>();
  private readonly rules: GameRules;
  private readonly filePath: string | null;

  constructor(rules: GameRules, filePath?: string) {
    this.rules = rules;
    this.filePath = filePath ?? null;
    this.load();
  }

  createLobby(groupId: string, host: Player): LobbySnapshot {
    const existing = this.sessions.get(groupId);
    if (existing?.engine?.publicView().status === "ended") this.sessions.delete(groupId);
    if (this.sessions.get(groupId)?.engine) throw new GameError("The current game has already started.");
    const session = this.sessions.get(groupId) ?? { groupId, hostId: host.id, players: new Map(), aliases: new Map() };
    session.players.set(host.id, host);
    this.sessions.set(groupId, session);
    this.persist();
    return this.snapshot(groupId);
  }

  joinLobby(groupId: string, player: Player): LobbySnapshot {
    const session = this.requireLobby(groupId);
    if (session.engine) throw new GameError("The current game has already started.");
    if (session.players.has(player.id) || session.aliases.has(player.id)) throw new GameError("You're already in the lobby.");
    session.players.set(player.id, player);
    this.persist();
    return this.snapshot(groupId);
  }

  leaveLobby(groupId: string, playerIdentity: string): void {
    const session = this.requireLobby(groupId);
    if (session.engine) throw new GameError("Players cannot leave after the game starts.");
    const playerId = this.resolvePlayerId(groupId, playerIdentity);
    session.players.delete(playerId);
    this.persist();
  }

  kick(groupId: string, requesterId: string, targetIdentity: string): void {
    const session = this.requireLobby(groupId);
    if (session.hostId !== requesterId) throw new GameError("Only the lobby host can remove players.");
    const targetId = this.resolvePlayerId(groupId, targetIdentity);
    if (session.engine) throw new GameError("Kicking players during an active game is not yet defined.");
    session.players.delete(targetId);
    this.persist();
  }

  registerAlias(groupId: string, playerId: string, alias: string): void {
    const session = this.requireLobby(groupId);
    if (!session.players.has(playerId)) throw new GameError("Unknown player.");
    session.aliases.set(alias, playerId);
    this.persist();
  }

  resolvePlayerId(groupId: string, identity: string): string {
    const session = this.requireLobby(groupId);
    if (session.players.has(identity)) return identity;
    const aliased = session.aliases.get(identity);
    if (aliased) return aliased;
    const normalized = identity.split("@")[0].replace(/\D/g, "");
    const match = [...session.players.keys()].find((id) => id.split("@")[0].replace(/\D/g, "") === normalized);
    if (match) return match;
    throw new GameError("Unknown player. Send !xeno join in the game group first.");
  }

  groupForIdentity(identity: string): string {
    for (const [groupId, session] of this.sessions) {
      if (session.players.has(identity) || session.aliases.has(identity)) return groupId;
      const normalized = identity.split("@")[0].replace(/\D/g, "");
      if ([...session.players.keys()].some((id) => id.split("@")[0].replace(/\D/g, "") === normalized)) return groupId;
    }
    throw new GameError("Unknown player. Send !xeno join in the game group first.");
  }

  snapshot(groupId: string): LobbySnapshot {
    const session = this.requireLobby(groupId);
    return { groupId, hostId: session.hostId, players: [...session.players.values()], started: Boolean(session.engine) };
  }

  startGame(groupId: string, requesterId: string): StartedGame {
    const session = this.requireLobby(groupId);
    if (session.hostId !== requesterId) throw new GameError("Only the lobby host can start the game.");
    if (session.engine) throw new GameError("The current game has already started.");
    const players = [...session.players.values()];
    if (players.length < 4) throw new GameError("At least 4 players must join before the game can start.");
    session.engine = GameEngine.create(players, this.rules, Math.random, session.mode ?? "classic");
    this.persist();
    return { engine: session.engine, players, privateViews: players.map((player) => session.engine!.privateView(player.id)) };
  }

  beginVoting(groupId: string): void { this.requireStartedGame(groupId).beginVoting(); this.persist(); }
  beginNight(groupId: string): void { this.requireStartedGame(groupId).beginNight(); this.persist(); }

  allVotesSubmitted(groupId: string): boolean {
    const engine = this.requireStartedGame(groupId);
    const view = engine.publicView();
    return view.phase === "voting" && view.players.filter((player) => player.alive).every((player) => engine.voteSnapshot().submitted[player.id]);
  }

  allNightActionsSubmitted(groupId: string): boolean {
    const engine = this.requireStartedGame(groupId);
    return engine.requiredNightActors().every((playerId) => engine.stateSnapshot().nightActions[playerId]);
  }

  phaseDeadline(groupId: string): number | undefined { return this.requireLobby(groupId).phaseDeadline; }
  setMode(groupId: string, requesterId: string, mode: GameMode): void {
    const session = this.requireLobby(groupId);
    if (session.engine) throw new GameError("Game mode cannot change after the game starts.");
    if (session.hostId !== requesterId) throw new GameError("Only the lobby host can choose the game mode.");
    session.mode = mode;
    this.persist();
  }
  mode(groupId: string): GameMode | undefined { return this.requireLobby(groupId).mode; }
  resumableGames(): ResumableGame[] {
    return [...this.sessions.values()]
      .filter((session) => session.engine && session.engine.publicView().status === "active")
      .map((session) => ({ groupId: session.groupId, phase: session.engine!.publicView().phase, deadline: session.phaseDeadline, nextPhase: session.phaseNext }));
  }
  setPhaseDeadline(groupId: string, deadline: number | undefined, nextPhase?: "night" | "voting"): void {
    this.requireLobby(groupId).phaseDeadline = deadline;
    this.requireLobby(groupId).phaseNext = nextPhase;
    this.persist();
  }

  submitVote(groupId: string, voterIdentity: string, targetNumber: number): void {
    const engine = this.requireStartedGame(groupId);
    const voterId = this.resolvePlayerId(groupId, voterIdentity);
    const target = engine.numberedAlivePlayers().find((entry) => entry.number === targetNumber)?.player;
    if (!target) throw new GameError("Vote target must be a living player number from !xeno players.");
    engine.submitVote(voterId, target.id);
    this.persist();
  }

  numberedAlivePlayers(groupId: string) {
    return this.requireStartedGame(groupId).numberedAlivePlayers();
  }

  resolveVote(groupId: string, force = false): VoteResult {
    const engine = this.requireStartedGame(groupId);
    const eliminatedPlayerId = engine.resolveVote(force);
    const view = engine.publicView();
    this.persist();
    return { eliminatedPlayerId, phase: view.phase, winner: view.winner };
  }

  gameSnapshot(groupId: string) { return this.requireStartedGame(groupId).publicView(); }
  voteSnapshot(groupId: string): VoteSnapshot { return this.requireStartedGame(groupId).voteSnapshot(); }
  unvote(groupId: string, playerIdentity: string): void { this.requireStartedGame(groupId).unvote(this.resolvePlayerId(groupId, playerIdentity)); this.persist(); }
  roleSummaries(groupId: string): RoleDefinition[] {
    const engine = this.requireStartedGame(groupId);
    const roles = new Set(engine.publicView().players.map((player) => engine.privateView(player.id).role));
    return [...roles].map((role) => ROLE_DATABASE[role]);
  }
  endGame(groupId: string): void { this.requireStartedGame(groupId).forceEnd(); this.persist(); }
  graveyard(groupId: string) { return this.requireStartedGame(groupId).publicView().deaths; }
  settings(groupId: string): string[] { return this.requireLobby(groupId).enabledRoles ?? ["werewolf", "villager", "seer", "doctor", "hunter"]; }
  setSettings(groupId: string, roles: string[]): void { this.requireLobby(groupId).enabledRoles = roles; }
  completedRecord(groupId: string): { winner: string; players: CompletedPlayer[] } | null {
    const session = this.requireLobby(groupId);
    const view = session.engine?.publicView();
    if (!session.engine || !view?.winner || session.recorded) return null;
    session.recorded = true;
    this.persist();
    return {
      winner: view.winner,
      players: view.players.map((player) => {
        const privateView = session.engine!.privateView(player.id);
        return { id: player.id, role: privateView.role, faction: privateView.faction, alive: player.alive, lynched: view.deaths.some((death) => death.playerId === player.id && death.cause === "vote") };
      })
    };
  }
  privateView(groupId: string, playerId: string): PrivatePlayerView { return this.requireStartedGame(groupId).privateView(playerId); }
  nightActors(groupId: string): string[] { return this.requireStartedGame(groupId).requiredNightActors(); }

  submitNightAction(groupId: string, actorIdentity: string, targetNumber: number): void {
    const engine = this.requireStartedGame(groupId);
    const actorId = this.resolvePlayerId(groupId, actorIdentity);
    const target = engine.numberedAlivePlayers().find((entry) => entry.number === targetNumber)?.player;
    if (!target) throw new GameError("Night target must be a living player number from !xeno players.");
    const role = engine.privateView(actorId).role;
    const actionType = role === "werewolf" ? "werewolf-target" : role === "seer" ? "seer-investigate" : role === "doctor" ? "doctor-protect" : null;
    if (!actionType) throw new GameError("Your role has no defined night action.");
    engine.submitNightAction(actorId, { type: actionType, targetId: target.id });
    this.persist();
  }

  resolveNight(groupId: string, force = false): NightResolution {
    const result = this.requireStartedGame(groupId).resolveNight(force);
    this.persist();
    return result;
  }

  private requireLobby(groupId: string): GroupSession {
    const session = this.sessions.get(groupId);
    if (!session) throw new GameError("No lobby exists for this group.");
    return session;
  }

  private requireStartedGame(groupId: string): GameEngine {
    const session = this.requireLobby(groupId);
    if (!session.engine) throw new GameError("The game has not started yet.");
    return session.engine;
  }

  private load(): void {
    if (!this.filePath) return;
    if (!existsSync(this.filePath)) return;
    try {
      const stored = JSON.parse(readFileSync(this.filePath, "utf8")) as PersistedGroupSession[];
      for (const entry of stored) {
        if (this.filePath === "./.data/lordxeno-games.json" && !entry.groupId.endsWith("@g.us")) continue;
        this.sessions.set(entry.groupId, {
          groupId: entry.groupId,
          hostId: entry.hostId,
          players: new Map(entry.players.map((player) => [player.id, player])),
          aliases: new Map(entry.aliases),
          engine: entry.engineState ? GameEngine.restore(entry.engineState, this.rules) : undefined,
          recorded: entry.recorded,
          enabledRoles: entry.enabledRoles,
          phaseDeadline: entry.phaseDeadline
          , phaseNext: entry.phaseNext
          , mode: entry.mode
        });
      }
      this.persist();
    } catch (error) {
      console.error("Could not load saved game sessions:", error);
    }
  }

  private persist(): void {
    if (!this.filePath) return;
    mkdirSync(this.filePath.slice(0, this.filePath.lastIndexOf("/")), { recursive: true });
    const stored: PersistedGroupSession[] = [...this.sessions.values()].map((session) => ({
      groupId: session.groupId,
      hostId: session.hostId,
      players: [...session.players.values()],
      aliases: [...session.aliases.entries()],
      engineState: session.engine?.stateSnapshot(),
      recorded: session.recorded,
      enabledRoles: session.enabledRoles,
      phaseDeadline: session.phaseDeadline
      , phaseNext: session.phaseNext
      , mode: session.mode
    }));
    writeFileSync(this.filePath, JSON.stringify(stored, null, 2));
  }
}
