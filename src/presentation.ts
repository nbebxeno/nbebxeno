import type { Faction, GameMode, PrivatePlayerView, PublicGameView, RoleDefinition } from "./engine.ts";
import type { LobbySnapshot } from "./session.ts";

export function roleLabel(role: string): string {
  const special: Record<string, string> = {
    "poisoner-werewolf": "Poisoner (Werewolf)", "poisoner-neutral": "Poisoner (Neutral)",
    "priest-village": "Priest (Village)", "priest-neutral": "Priest (Neutral)",
    "old-crone": "The Old Crone", "doppelganger": "Doppelgänger"
  };
  return special[role] ?? role.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

export function factionLabel(faction: Faction): string {
  return { village: "Village", werewolves: "Werewolf", neutral: "Neutral" }[faction];
}

export function roleCard(view: PrivatePlayerView): string {
  const abilities = view.abilities ?? [];
  return [
    "🌑 *LORDXENO · SECRET ROLE*", "",
    `*${roleLabel(view.role)}*`, `Team: ${factionLabel(view.faction)}`, "",
    view.roleDefinition.description, "", "*Your objective*", view.roleDefinition.winCondition, "",
    ...(view.faction === "werewolves" ? ["*Your known Werewolf team*", ...(view.knownTeam?.length ? view.knownTeam.map((ally) => `• ${ally.displayName} — ${roleLabel(ally.role)}`) : ["No other pack members are known to you."]), ""] : []),
    ...(view.personalNotes?.length ? [...view.personalNotes, ""] : []),
    "*Your abilities*", view.roleDefinition.activeAbility ?? "No active power. Discuss, deduce, and vote.", "",
    ...abilities.map((ability) => `${roleLabel(ability.phase)}: !act ${ability.id}${ability.targetKind === "option" ? " <option>" : " <number>".repeat(ability.targets)} — ${ability.help}`), "",
    "Use !actions for your current choices and numbered targets.", "Use !skip to pass on remaining powers this phase.", "",
    "*During voting*", "Reply here: !vote <number>", "Undo your vote: !unvote", "",
    "Keep your role and team messages private. Return to the group for discussion."
  ].join("\n");
}

export function lobbyCard(snapshot: LobbySnapshot, mode?: GameMode): string {
  const host = snapshot.players.find((player) => player.id === snapshot.hostId)?.displayName ?? "Host";
  const needed = Math.max(0, 4 - snapshot.players.length);
  return [
    "🌒 *LORDXENO · LOBBY*", "",
    `Host: ${host}`, `Mode: ${mode ? roleLabel(mode) : "Waiting for host"}`,
    `Players: ${snapshot.players.length} · minimum 4`, "",
    ...snapshot.players.map((player, index) => `${index + 1}. ${player.displayName}${player.id === snapshot.hostId ? " · host" : ""}`), "",
    ...(mode ? [needed ? `Waiting for ${needed} more ${needed === 1 ? "player" : "players"}.` : "Ready. The host can start the game.", "", "Join: !join", "Leave: !leave", "Host starts: !startgame"]
      : ["*Host: choose a mode first*", "!mode beginner", "!mode classic", "!mode chaos"])
  ].join("\n");
}

function rosterLines(view: PublicGameView): string[] {
  const living = view.players.filter((player) => player.alive);
  const eliminated = view.players.filter((player) => !player.alive);
  return [
    `*Alive · ${living.length}*`,
    ...living.map((player, index) => `${index + 1}. ${player.displayName}`),
    ...(!living.length ? ["No living players."] : []),
    ...(eliminated.length ? ["", `*Eliminated · ${eliminated.length}*`, ...eliminated.map((player) => `• ${deceasedLabel(view, player.id)}`)] : [])
  ];
}

export function rosterCard(view: PublicGameView): string {
  return ["🌒 *LORDXENO · PLAYERS*", "", ...rosterLines(view)].join("\n");
}

export function deceasedLabel(view: PublicGameView, playerId: string): string {
  const name = view.players.find((player) => player.id === playerId)?.displayName ?? playerId;
  const role = view.deaths.find((death) => death.playerId === playerId)?.role;
  return role ? `${name} — ${roleLabel(role)}` : name;
}

export function statusCard(view: PublicGameView, seconds: number | null): string {
  return ["📜 *LORDXENO · STATUS*", "", `Day ${view.dayNumber} · ${roleLabel(view.phase)}`,
    `Alive: ${view.players.filter((player) => player.alive).length}/${view.players.length}`,
    ...(seconds === null ? [] : [`Time left: ${seconds}s`]), "",
    view.phase === "voting" ? "Vote privately: !vote <number>" : view.phase === "night" ? "Check your private messages for your night action." : view.phase === "discussion" ? "Discuss in the group. Keep your role secret." : "This game has ended. Start a new lobby with !lobby.",
    "", ...rosterLines(view)].join("\n");
}

export function rolesCard(roles: RoleDefinition[]): string {
  return ["🎭 *LORDXENO · ROLES IN PLAY*", ...roles.map((role) => `*${roleLabel(role.name)}* · ${factionLabel(role.faction)}\n${role.description}`)].join("\n\n");
}

export function victoryCard(summary: { winner: Faction | null; team: Array<{ id: string; displayName: string; role: string }>; personal: Array<{ id: string; displayName: string; role: string }> }): string {
  const heading = summary.winner === "werewolves" ? "🐺 *WEREWOLVES WIN!*"
    : summary.winner === "village" ? "☀️ *VILLAGE WINS!*"
    : summary.team.length ? "🌘 *NEUTRAL VICTORY!*" : "🏁 *GAME OVER*";
  const list = (players: typeof summary.team) => players.map((player, i) => `${i + 1}. ${player.displayName} — ${roleLabel(player.role)}`);
  return [heading, "",
    ...(summary.team.length ? ["*Winning team*", ...list(summary.team)] : []),
    ...(summary.personal.length ? ["", "*Personal winners*", ...list(summary.personal)] : []),
    ...(!summary.team.length && !summary.personal.length ? ["No winners this game."] : [])
  ].join("\n");
}
