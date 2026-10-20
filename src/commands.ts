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
  { name: "replay", group: "meta", usage: "!replay [page]", description: "Read the finished game's sealed timeline.", matches: (command) => command === "!xeno replay" || command.startsWith("!xeno replay ") },
  { name: "lastwords", group: "game", usage: "!lastwords <message> (DM)", description: "Your one final message, within 15 seconds of death.", matches: (command) => command === "!xeno lastwords" || command.startsWith("!xeno lastwords ") },
  { name: "details", group: "game", usage: "!details (DM)", description: "Read your complete role rules privately.", matches: exact("!xeno details") },
  { name: "games", group: "admin", usage: "!games (GM, DM)", description: "List games and codes for private GM control.", matches: exact("!xeno games") },
  { name: "gm", group: "admin", usage: "!gm", description: "Check your permanent Game Master or admin access.", matches: exact("!xeno gm") },
  { name: "actions", group: "game", usage: "!actions (DM)", description: "Show your current powers and numbered targets.", matches: exact("!xeno actions") },
  { name: "act", group: "game", usage: "!act <ability> [targets/options] (DM)", description: "Use a power in its permitted phase.", matches: prefix("!xeno act ") },
  { name: "skip", group: "game", usage: "!skip (DM)", description: "Pass on remaining powers this phase; voting is separate.", matches: exact("!xeno skip") },
  { name: "help", group: "meta", usage: "!help", description: "Show available commands.", matches: (command) => command === "!xeno help" || command.startsWith("!xeno help ") },
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
  { name: "leaderboard", group: "meta", usage: "!leaderboard", description: "Show top players.", matches: exact("!xeno leaderboard", "!xeno lb") },
  { name: "kick", group: "admin", usage: "!kick <number>", description: "Remove a lobby player as a group admin or permanent GM.", matches: prefix("!xeno kick ") },
  { name: "endgame", group: "admin", usage: "!endgame [game-code]", description: "End a game or lobby as a group admin or permanent GM.", matches: (command) => command === "!xeno endgame" || command.startsWith("!xeno endgame ") },
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

export function helpText(section = ""): string {
  const groups: Array<[CommandGroup, string]> = [["setup", "SETUP"], ["game", "GAME"], ["voting", "VOTING"], ["meta", "META / STATS"], ["admin", "ADMIN"]];
  const selected = section === "all" ? groups : section ? groups.filter(([group]) => group === section) : groups;
  if (!selected.length) return "Use !help setup, !help game, !help voting, !help meta, !help admin, or !help all.";
  return ["🌑 *LORDXENO · HELP*", "Group: setup & discussion · DM: votes & powers", "",
    ...selected.map(([group, title]) => [`*${title}*`, COMMAND_REGISTRY.filter((command) => command.group === group).map((command) => section ? `${command.usage} — ${command.description}` : command.usage).join(section ? "\n" : " · ")].join("\n")),
    "", section ? "!help · All groups" : "!help <group> · More detail"
  ].join("\n");
}
