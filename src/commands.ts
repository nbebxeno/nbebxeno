export type CommandGroup = "setup" | "game" | "voting" | "meta" | "admin";

export interface CommandDefinition {
  name: string;
  group: CommandGroup;
  usage: string;
  description: string;
  matches: (command: string) => boolean;
}

const exact = (...commands: string[]) => (command: string) => commands.includes(command);
const prefix = (value: string) => (command: string) => command.startsWith(value);

export const COMMAND_REGISTRY: readonly CommandDefinition[] = [
  { name: "help", group: "meta", usage: "!help", description: "Show available commands.", matches: exact("!xeno help") },
  { name: "ping", group: "meta", usage: "!ping", description: "Check the transport connection.", matches: exact("!xeno ping") },
  { name: "lobby", group: "setup", usage: "!lobby", description: "Create a game lobby.", matches: exact("!xeno lobby") },
  { name: "mode", group: "setup", usage: "!mode <classic|beginner|chaos>", description: "Choose the lobby game mode as host.", matches: (command) => command.startsWith("!xeno mode ") },
  { name: "join", group: "setup", usage: "!join", description: "Join the current lobby.", matches: exact("!xeno join") },
  { name: "leave", group: "setup", usage: "!leave", description: "Leave before the game starts.", matches: exact("!xeno leave") },
  { name: "start", group: "setup", usage: "!startgame / !start", description: "Start role assignment as the lobby host.", matches: exact("!xeno start", "!xeno startgame") },
  { name: "players", group: "game", usage: "!players", description: "Show the lobby or living roster.", matches: exact("!xeno players") },
  { name: "status", group: "game", usage: "!status", description: "Show phase, timer, and the player list.", matches: exact("!xeno status") },
  { name: "roles", group: "game", usage: "!roles", description: "Show one-line role summaries in play.", matches: exact("!xeno roles") },
  { name: "myrole", group: "game", usage: "!myrole", description: "Send your role reminder privately.", matches: exact("!xeno myrole") },
  { name: "graveyard", group: "game", usage: "!graveyard", description: "Show public deaths.", matches: exact("!xeno graveyard") },
  { name: "night", group: "game", usage: "!night <number>", description: "Submit a private night action.", matches: prefix("!xeno night ") },
  { name: "night-resolve", group: "game", usage: "!night-resolve", description: "Resolve night early.", matches: exact("!xeno night-resolve") },
  { name: "vote", group: "voting", usage: "!vote <number> (DM)", description: "Cast a private lynch vote.", matches: prefix("!xeno vote ") },
  { name: "unvote", group: "voting", usage: "!unvote (DM)", description: "Retract your private vote.", matches: exact("!xeno unvote") },
  { name: "votes", group: "voting", usage: "!votes", description: "Show the current vote tally.", matches: exact("!xeno votes") },
  { name: "resolve", group: "voting", usage: "!resolve", description: "Resolve the completed vote.", matches: exact("!xeno resolve") },
  { name: "stats", group: "meta", usage: "!stats", description: "Show persistent player stats.", matches: exact("!xeno stats") },
  { name: "chronicle", group: "meta", usage: "!chronicle", description: "Show the Xenoverse history.", matches: exact("!xeno chronicle") },
  { name: "leaderboard", group: "meta", usage: "!leaderboard", description: "Show top players.", matches: exact("!xeno leaderboard") },
  { name: "kick", group: "admin", usage: "!kick <number>", description: "Remove a lobby player as an admin.", matches: prefix("!xeno kick ") },
  { name: "endgame", group: "admin", usage: "!endgame", description: "Force-end a stuck game as an admin.", matches: exact("!xeno endgame") },
  { name: "settings", group: "admin", usage: "!settings", description: "Show enabled role settings.", matches: exact("!xeno settings") }
];

const names = new Set<string>();
for (const command of COMMAND_REGISTRY) {
  if (names.has(command.name)) throw new Error(`Duplicate command registration: ${command.name}`);
  names.add(command.name);
}

/** Canonical internal form keeps existing command handlers backward compatible. */
export function normalizeCommand(input: string): string {
  const text = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text.startsWith("!")) return "";
  if (text === "!xeno") return "!xeno help";
  return text.startsWith("!xeno ") ? text : `!xeno ${text.slice(1)}`;
}

export function resolveCommand(command: string): CommandDefinition | undefined {
  const normalized = normalizeCommand(command);
  return COMMAND_REGISTRY.find((definition) => definition.matches(normalized));
}

export function helpText(): string {
  const groups: Array<[CommandGroup, string]> = [["setup", "SETUP"], ["game", "GAME"], ["voting", "VOTING"], ["meta", "META / STATS"], ["admin", "ADMIN"]];
  return "🌑 *LORDXENO · COMMANDS*\n\nGroup chat: lobby, discussion, and game info.\nPrivate chat: votes and night actions.\nShort commands: !join · !status · !vote 2\nThe old !xeno commands still work.\n\n" + groups.map(([group, title]) => [
    `*${title}*`,
    ...COMMAND_REGISTRY.filter((command) => command.group === group).map((command) => `${command.usage} - ${command.description}`)
  ].join("\n")).join("\n\n");
}
