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
  { name: "help", group: "meta", usage: "!xeno help", description: "Show available commands.", matches: exact("!xeno help") },
  { name: "ping", group: "meta", usage: "!xeno ping", description: "Check the transport connection.", matches: exact("!xeno ping") },
  { name: "lobby", group: "setup", usage: "!xeno lobby", description: "Create a game lobby.", matches: exact("!xeno lobby") },
  { name: "mode", group: "setup", usage: "!xeno mode <classic|beginner|chaos>", description: "Choose the lobby game mode as host.", matches: (command) => command.startsWith("!xeno mode ") },
  { name: "join", group: "setup", usage: "!xeno join", description: "Join the current lobby.", matches: exact("!xeno join") },
  { name: "leave", group: "setup", usage: "!xeno leave", description: "Leave before the game starts.", matches: exact("!xeno leave") },
  { name: "start", group: "setup", usage: "!xeno startgame / !xeno start", description: "Start role assignment as the lobby host.", matches: exact("!xeno start", "!xeno startgame") },
  { name: "players", group: "game", usage: "!xeno players", description: "Show the lobby or living roster.", matches: exact("!xeno players") },
  { name: "status", group: "game", usage: "!xeno status", description: "Show phase, timer, and alive count.", matches: exact("!xeno status") },
  { name: "roles", group: "game", usage: "!xeno roles", description: "Show one-line role summaries in play.", matches: exact("!xeno roles") },
  { name: "myrole", group: "game", usage: "!xeno myrole", description: "Send your role reminder privately.", matches: exact("!xeno myrole") },
  { name: "graveyard", group: "game", usage: "!xeno graveyard", description: "Show public deaths.", matches: exact("!xeno graveyard") },
  { name: "night", group: "game", usage: "!xeno night <number>", description: "Submit a private night action.", matches: prefix("!xeno night ") },
  { name: "night-resolve", group: "game", usage: "!xeno night-resolve", description: "Resolve night early.", matches: exact("!xeno night-resolve") },
  { name: "vote", group: "voting", usage: "!xeno vote <number> (DM)", description: "Cast a private lynch vote.", matches: prefix("!xeno vote ") },
  { name: "unvote", group: "voting", usage: "!xeno unvote (DM)", description: "Retract your private vote.", matches: exact("!xeno unvote") },
  { name: "votes", group: "voting", usage: "!xeno votes", description: "Show the current vote tally.", matches: exact("!xeno votes") },
  { name: "resolve", group: "voting", usage: "!xeno resolve", description: "Resolve the completed vote.", matches: exact("!xeno resolve") },
  { name: "stats", group: "meta", usage: "!xeno stats", description: "Show persistent player stats.", matches: exact("!xeno stats") },
  { name: "chronicle", group: "meta", usage: "!xeno chronicle", description: "Show the Xenoverse history.", matches: exact("!xeno chronicle") },
  { name: "leaderboard", group: "meta", usage: "!xeno leaderboard", description: "Show top players.", matches: exact("!xeno leaderboard") },
  { name: "kick", group: "admin", usage: "!xeno kick <number>", description: "Remove a lobby player as an admin.", matches: prefix("!xeno kick ") },
  { name: "endgame", group: "admin", usage: "!xeno endgame", description: "Force-end a stuck game as an admin.", matches: exact("!xeno endgame") },
  { name: "settings", group: "admin", usage: "!xeno settings", description: "Show enabled role settings.", matches: exact("!xeno settings") }
];

const names = new Set<string>();
for (const command of COMMAND_REGISTRY) {
  if (names.has(command.name)) throw new Error(`Duplicate command registration: ${command.name}`);
  names.add(command.name);
}

export function resolveCommand(command: string): CommandDefinition | undefined {
  return COMMAND_REGISTRY.find((definition) => definition.matches(command));
}

export function helpText(): string {
  const groups: Array<[CommandGroup, string]> = [["setup", "SETUP"], ["game", "GAME"], ["voting", "VOTING"], ["meta", "META / STATS"], ["admin", "ADMIN"]];
  return groups.map(([group, title]) => [
    `*${title}*`,
    ...COMMAND_REGISTRY.filter((command) => command.group === group).map((command) => `${command.usage} - ${command.description}`)
  ].join("\n")).join("\n\n");
}