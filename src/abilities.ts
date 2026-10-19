/** The same registry drives validation, private prompts, and action completion. */
export interface AbilityDefinition {
  id: string;
  phase: "night" | "voting" | "reaction";
  targets: number;
  targetKind?: "alive" | "dead" | "option";
  noSelf?: boolean;
  limit?: number;
  firstNight?: boolean;
  help: string;
}
const night = (id: string, help: string, extra: Partial<AbilityDefinition> = {}): AbilityDefinition => ({ id, phase: "night", targets: 1, help, ...extra });
const vote = (id: string, help: string, extra: Partial<AbilityDefinition> = {}): AbilityDefinition => ({ id, phase: "voting", targets: 1, help, ...extra });
export const PACK_ATTACKERS = new Set(["werewolf", "alpha-werewolf", "big-bad-wolf", "mystic-wolf", "omega-wolf", "fruit-brute", "lone-wolf", "wolf-cub", "confused-wolf", "remorseful-werewolf"]);
export const INDEPENDENT_KILLERS = new Set(["murderer", "poisoner-neutral", "arsonist"]);
export const ROLE_ABILITIES: Record<string, AbilityDefinition[]> = {
  werewolf: [], villager: [], hunter: [], mason: [], "old-man": [], diseased: [], scapegoat: [], "hapless-victim": [], hierophant: [], lycan: [], mortician: [], noble: [], minion: [], "omega-wolf": [], "wolf-cub": [], fool: [], tanner: [], "vengeful-ghost": [],
  "alpha-werewolf": [night("convert", "Convert a Village player instead of this night's pack attack (once).", { noSelf: true, limit: 1 })],
  seer: [night("see", "Learn a player's apparent faction.")],
  doctor: [night("protect", "Protect a player, including yourself, from attacks.")],
  witch: [night("poison", "Use your one poison potion.", { noSelf: true, limit: 1 }), night("revive", "Use your one revival potion on a player killed last night.", { targetKind: "dead", limit: 1 })],
  "apprentice-seer": [night("compare", "Compare two different players' true factions.", { targets: 2 })],
  lawyer: [vote("defend", "Choose a client to save from today's vote (once).", { limit: 1 })],
  hangman: [vote("retrial", "Add a 30-second discussion and a fresh vote if there is a verdict (once).", { targets: 0, limit: 1 })],
  martyr: [vote("sacrifice", "Take another player's voting death (once).", { noSelf: true, limit: 1 })],
  "priest-village": [night("sanctuary", "Protect another player from pack attacks; no consecutive repeats.", { noSelf: true })],
  necromancer: [night("revive", "Revive a player from an earlier night (once).", { targetKind: "dead", limit: 1 })],
  "old-crone": [night("silence", "Ask a player to remain silent during the next discussion (social rule).", { noSelf: true })],
  spellcaster: [night("disenfranchise", "Remove another player's next vote (once).", { noSelf: true, limit: 1 })],
  insomniac: [night("walk", "Learn the seat distance to the nearest Werewolf faction member.", { targets: 0 })],
  scryer: [night("seek", "Find out whether a player is the Seer.", { noSelf: true })],
  "aura-seer": [night("aura", "Learn whether a player has a special power.")],
  "big-bad-wolf": [night("maul", "Choose a second pack-attack target (once).", { noSelf: true, limit: 1 })],
  "mystic-wolf": [night("aura", "Learn whether a non-pack player has a special power.", { noSelf: true })],
  sorcerer: [night("seek", "Find out whether a player is the Seer.", { noSelf: true })],
  "poisoner-werewolf": [night("poison", "Poison a non-pack player (once).", { noSelf: true, limit: 1 })],
  "fruit-brute": [night("fortify", "As the last attacking wolf, cancel your attack to gain one kill shield.", { targets: 0 })],
  "fallen-angel": [night("shield", "Shield another Werewolf faction member from one kill (once).", { noSelf: true, limit: 1 })],
  "lone-wolf": [],
  "confused-wolf": [night("sniff", "Learn whether another player belongs to the Werewolf faction.", { noSelf: true })],
  "german-shepherd": [night("disguise", "Make a pack ally appear Village to Seer investigations tonight (once).", { noSelf: true, limit: 1 })],
  "remorseful-werewolf": [night("veto", "Cancel tonight's shared pack attack (once).", { targets: 0, limit: 1 })],
  moderator: [night("audit", "Learn only the number of missing night submissions (once).", { targets: 0, limit: 1 })],
  murderer: [night("kill", "Attack another player independently of the pack.", { noSelf: true })],
  "poisoner-neutral": [night("poison", "Poison another player; it fails if you die before poison resolves.", { noSelf: true })],
  turncoat: [night("allegiance", "Choose village or werewolves as your personal victory allegiance (once).", { targets: 1, targetKind: "option", limit: 1 })],
  "bloody-mary": [night("curse", "Mark a living player who previously voted for you (once).", { noSelf: true, limit: 1 })],
  doppelganger: [night("copy", "Choose whose role to inherit when they die.", { noSelf: true, firstNight: true, limit: 1 })],
  chef: [night("serve", "Serve a new player; survive three different servings to win personally.", { noSelf: true })],
  enchantress: [night("enchant", "Enchant another player; enchant all other living players to win.", { noSelf: true })],
  arsonist: [night("douse", "Douse another player for later ignition.", { noSelf: true }), night("ignite", "Ignite all your doused players instead of dousing tonight.", { targets: 0 })],
  thespian: [night("rehearse", "Rehearse one of your three private role labels using option 1, 2, or 3.", { targetKind: "option" })],
  cupid: [night("link", "Link two different other players as lovers.", { targets: 2, noSelf: true, firstNight: true, limit: 1 })],
  orphan: [night("adopt", "Choose another player as your guardian.", { noSelf: true, firstNight: true, limit: 1 })],
  "guardian-angel": [night("ward", "Shield your assigned ward from one non-voting kill tonight (twice).", { targets: 0, limit: 2 })],
  "priest-neutral": [night("bless", "Bless a new player; survive three different blessings to win personally.", { noSelf: true })],
  hoodlum: [night("mark", "Choose two different other players to outlive.", { targets: 2, noSelf: true, firstNight: true, limit: 1 })]
};
export const PACK_ATTACK = night("attack", "Vote for the shared pack target. Tied pack votes mean no attack.", { noSelf: true });
export const EXTRA_ATTACK = night("extra", "Vote for the Wolf Cub's second pack target.", { noSelf: true });
export const HUNTER_SHOT: AbilityDefinition = { id: "shoot", phase: "reaction", targets: 1, noSelf: true, limit: 1, help: "Choose a living player for your final shot. You have 30 seconds." };
export const GHOST_MARK: AbilityDefinition = { id: "haunt", phase: "reaction", targets: 1, noSelf: true, limit: 1, help: "Mark a living target for your revenge objective. You have 30 seconds." };
