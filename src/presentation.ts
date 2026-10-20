import type { AbilityDefinition } from "./abilities.ts";
import type { NumberedAlivePlayer, Phase, Faction, GameMode, PrivatePlayerView, PublicGameView, RoleDefinition } from "./engine.ts";
import type { LobbySnapshot } from "./session.ts";

export const RULE_LINE = "────────────────";
export function phaseBanner(title: string, meta: string, story: string): string {
  return [`✦ *LORDXENO / ${title}*`, RULE_LINE, meta, "", story].join("\n");
}

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

export function abilityCommand(ability: AbilityDefinition): string {
  const options = ability.id === "allegiance" ? "<village|werewolves>" : "<1|2|3>";
  const targets = Array.from({ length: ability.targets }, (_, i) => `<${ability.targetKind === "dead" ? "dead " : ""}number${ability.targets > 1 ? ` ${i + 1}` : ""}>`).join(" ");
  const args = ability.targetKind === "option" ? options : targets;
  return `!act ${ability.id}${args ? ` ${args}` : ""}`;
}

export function roleCard(view: PrivatePlayerView, detailed = false): string {
  const abilities = view.abilities ?? [];
  return [
    `🌑 *${roleLabel(view.role)}* · PRIVATE`, `Team: ${factionLabel(view.faction)}`, RULE_LINE, "",
    view.roleDefinition.description, "", "*Objective*", view.roleDefinition.winCondition, "",
    ...(view.faction === "werewolves" ? ["*Known pack*", ...(view.knownTeam?.length ? view.knownTeam.map((ally) => `• ${ally.displayName} — ${roleLabel(ally.role)}`) : ["No other teammates known."]), ""] : []),
    ...(view.personalNotes?.length ? [...view.personalNotes, ""] : []),
    ...(detailed ? ["*Full ability rules*", view.roleDefinition.activeAbility ?? "No active power. Discuss and vote.", ""] : []),
    ...abilities.map((ability) => `${abilityCommand(ability)} · ${roleLabel(ability.phase)}${detailed ? `\n${ability.help}` : ""}`),
    ...(!abilities.length ? ["Passive role · effects apply automatically."] : []), "",
    "!actions · Current choices   !skip · Pass on powers",
    "!vote <number> · Vote in DM   !unvote · Undo",
    detailed ? "Keep this card private." : "!details · Full role rules · Keep your card private."
  ].join("\n");
}

export function actionCard(input: { phase: Phase; actions: AbilityDefinition[]; alive: NumberedAlivePlayer[]; dead: NumberedAlivePlayer[]; notes: string[] }): string {
  const { phase, actions, alive, dead, notes } = input;
  const list = (roster: NumberedAlivePlayer[]) => roster.map(({ number, player }) => `${number}. ${player.displayName}`);
  return [
    `🌘 *${roleLabel(phase)} · YOUR ACTIONS*`, "",
    ...actions.flatMap((ability) => [`${abilityCommand(ability)}\n${ability.help}`]),
    ...(!actions.length ? ["No active choices in this phase."] : []),
    ...(actions.some((ability) => ability.targets > 0 && ability.targetKind !== "dead" && ability.targetKind !== "option") ? ["", "*Living targets*", ...list(alive)] : []),
    ...(actions.some((ability) => ability.targetKind === "dead") ? ["", "*Dead targets · separate numbering*", ...list(dead)] : []),
    ...(notes.length ? ["", ...notes] : []), "", "!skip · Pass on remaining powers; your vote is separate."
  ].join("\n");
}

export function lobbyCard(snapshot: LobbySnapshot, mode?: GameMode): string {
  const host = snapshot.players.find((player) => player.id === snapshot.hostId)?.displayName ?? "Host";
  const needed = Math.max(0, 4 - snapshot.players.length);
  return [
    "✦ *LORDXENO / THE GATHERING*", RULE_LINE, "",
    `Mode: ${mode ? roleLabel(mode) : "Not chosen"} · Players: ${snapshot.players.length}/4 min`, `Host: ${host}`, "",
    ...snapshot.players.map((player, index) => `${index + 1}. ${player.displayName}${player.id === snapshot.hostId ? " · host" : ""}`), "",
    ...(mode ? [needed ? `Waiting for ${needed} more ${needed === 1 ? "player" : "players"}.` : "Ready. The host can start the game.", "", "!join · Join   !leave · Leave   !start · Host starts"]
      : ["*Host: choose a mode first*", "!mode beginner | classic | chaos"])
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
  return ["✦ *LORDXENO / VILLAGERS*", RULE_LINE, "", ...rosterLines(view)].join("\n");
}

export function deceasedLabel(view: PublicGameView, playerId: string): string {
  const name = view.players.find((player) => player.id === playerId)?.displayName ?? playerId;
  const role = view.deaths.find((death) => death.playerId === playerId)?.role;
  return role ? `${name} — ${roleLabel(role)}` : name;
}

export function statusCard(view: PublicGameView, seconds: number | null): string {
  return ["✦ *LORDXENO / VILLAGE WATCH*", RULE_LINE, "", `Day ${view.dayNumber} · ${roleLabel(view.phase)}`,
    ...(seconds === null ? [] : [`Time left: ${seconds}s`]), "",
    view.phase === "voting" ? "DM your vote · !vote <number>" : view.phase === "night" ? "Night powers in DM · !actions" : view.phase === "discussion" ? "Discussion open · keep your role secret." : view.phase === "reaction" ? "Final action pending · check your DM." : "Game finished · !lobby to play again.",
    "", ...rosterLines(view)].join("\n");
}

export function rolesCard(roles: RoleDefinition[]): string {
  return ["✦ *LORDXENO / THE CAST*", RULE_LINE, ...roles.map((role) => `*${roleLabel(role.name)}* · ${factionLabel(role.faction)}\n${role.description}`)].join("\n\n");
}

export function victoryCard(summary: { winner: Faction | null; team: Array<{ id: string; displayName: string; role: string }>; personal: Array<{ id: string; displayName: string; role: string }> }): string {
  const heading = summary.winner === "werewolves" ? "🐺 *WEREWOLVES WIN!*"
    : summary.winner === "village" ? "☀️ *VILLAGE WINS!*"
    : summary.team.length ? "🌘 *NEUTRAL VICTORY!*" : "🏁 *GAME OVER*";
  const list = (players: typeof summary.team) => players.map((player, i) => `${i + 1}. ${player.displayName} — ${roleLabel(player.role)}`);
  return [heading, RULE_LINE, "",
    ...(summary.team.length ? ["*Winning team*", ...list(summary.team)] : []),
    ...(summary.personal.length ? ["", "*Personal winners*", ...list(summary.personal)] : []),
    ...(!summary.team.length && !summary.personal.length ? ["No winners this game."] : [])
  ].join("\n");
}

export function votingCard(view: PublicGameView): string {
  return ["⚖️ *YOUR VOTE*", "60s · reply in this chat", "",
    ...view.players.filter((player) => player.alive).map((player, i) => `${i + 1}. ${player.displayName}`), "",
    "!vote <number> · Choose   !unvote · Undo", "Missing votes pass at timeout."
  ].join("\n");
}
