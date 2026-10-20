/** Role descriptions and rules adopted from the reviewed design draft.
 * Executable actions and phase validation live in abilities.ts and engine.ts. */
export interface RoleRules {
  description: string;
  ability: string;
  winCondition: string;
}

const villageWin = "Win with the Village when the Werewolf faction is eliminated.";
const wolfWin = "Win with the Werewolf faction when living Werewolves reach parity with all other living players.";

export const ROLE_RULES: Record<string, RoleRules> = {
  "alpha-werewolf": {
    description: "The pack's elder, feared for turning the Village's own people against it.",
    ability: "Once per game, replace the pack attack with an attempted conversion of a Village player. Doctor protection blocks conversion. The target keeps their role label but becomes Werewolf-aligned and learns the pack; do not convert Neutral roles.",
    winCondition: wolfWin
  },
  villager: {
    description: "An ordinary resident with no supernatural gift. Your influence comes from sharp questions, careful listening, and your vote.",
    ability: "No night power. Participate in discussion and cast one vote each day.",
    winCondition: villageWin
  },
  hunter: {
    description: "A watchful marksman who refuses to meet death without one final stand.",
    ability: "When killed by voting or an attack, choose one living player to shoot within 30 seconds. Resolve the shot before faction victory checks; if no target is submitted, skip it. The shot cannot be blocked by ordinary night protection.",
    winCondition: villageWin
  },
  witch: {
    description: "A keeper of dangerous remedies, with one chance to save a life and one to take it.",
    ability: "Once per game each: poison one living player at night, or revive one player killed in the immediately preceding night. Use at most one potion per night. A revived player returns with their original role and faction; never revive a voting death.",
    winCondition: villageWin
  },
  "apprentice-seer": {
    description: "A student of hidden signs who senses connections rather than seeing an entire destiny.",
    ability: "Each night choose two different living players and learn whether their actual factions match. This compares faction only, not personal win conditions, and does not inherit Lycan's misleading Seer result.",
    winCondition: villageWin
  },
  mason: {
    description: "A member of a secret fellowship whose strongest resource is shared trust.",
    ability: "At game start, privately learn the other Masons. No night action. Assign Masons in pairs when the mode's role pool and player count permit.",
    winCondition: villageWin
  },
  "old-man": {
    description: "A stubborn elder whose endurance can outlast the Village's darkest night.",
    ability: "Survive the first lethal Werewolf attack against you; the next can kill normally. Protection prevents an attack from consuming this endurance. Endurance does not block poison, voting, or a Hunter shot.",
    winCondition: villageWin
  },
  diseased: {
    description: "A doomed resident whose illness may wound the pack that claims them.",
    ability: "If a Werewolf faction attack kills you, the pack loses its attack on the following night. Voting, conversion, poison, and non-pack kills do not trigger this effect.",
    winCondition: villageWin
  },
  lawyer: {
    description: "A determined advocate who can buy an accused resident one more day.",
    ability: "Once per game, select a client privately before voting closes. If that client would be eliminated by that vote, cancel the elimination. Do not transfer their votes to another target; the day ends without a voting death.",
    winCondition: villageWin
  },
  scapegoat: {
    description: "The resident the Village blames when it cannot agree on anyone else.",
    ability: "When a vote has a tie for the highest nonzero tally, you are eliminated instead of applying the usual no-elimination tie rule. No ability triggers when nobody votes. At most one Scapegoat per game.",
    winCondition: villageWin
  },
  "hapless-victim": {
    description: "An unlucky neighbor whose fate is tangled with the people closest to them.",
    ability: "Once per game, if the next living player after you in the original seat order would die to the pack attack, take that death instead. Calculate the neighbor when night begins. No chains between multiple Hapless Victims; protection checks the final victim.",
    winCondition: villageWin
  },
  hangman: {
    description: "A grim official who believes every verdict deserves one last hearing.",
    ability: "Once per game, when voting would produce an elimination, postpone that verdict for an extra 30-second discussion followed by a fresh vote. The replacement vote is final and cannot trigger another Hangman delay.",
    winCondition: villageWin
  },
  martyr: {
    description: "A selfless resident willing to stand in the condemned player's place.",
    ability: "Once per game, designate another living player before voting closes. If that player would be eliminated, you die instead. The spared player's lynching win does not trigger because they were not eliminated.",
    winCondition: villageWin
  },
  "priest-village": {
    description: "A Village cleric who offers sanctuary against the creatures of the night.",
    ability: "Each night protect one other living player from Werewolf faction attacks. You cannot protect the same player on consecutive nights. Does not block poison, conversion, voting, or Hunter shots.",
    winCondition: villageWin
  },
  necromancer: {
    description: "A guardian of forbidden rites who can call one fallen voice back to the Village.",
    ability: "Once per game, revive a player who died in an earlier night, restoring their original role and faction. Exclude voting deaths and players with completed personal lynching wins. Revived one-use abilities remain spent.",
    winCondition: villageWin
  },
  "old-crone": {
    description: "An unsettling elder whose quiet curse can steal a resident's voice.",
    ability: "Each night choose another player to silence for the next discussion. This is a narrated social rule: WhatsApp cannot selectively block one non-admin player's messages. The target may still submit private votes and night actions. Never change player admin privileges.",
    winCondition: villageWin
  },
  hierophant: {
    description: "A keeper of sacred knowledge who measures how deeply the pack has infiltrated the Village.",
    ability: "At each dawn, privately learn the count of living Werewolf-aligned players after deaths and conversions. Count faction membership, including Werewolf helpers, rather than role names.",
    winCondition: villageWin
  },
  spellcaster: {
    description: "A Village mystic who can loosen a hostile voice's grip on the day's verdict.",
    ability: "Once per game, choose another living player at night. Their vote is not counted in the next voting phase; privately tell them and exclude them from required-voter counts. Their other abilities remain available.",
    winCondition: villageWin
  },
  insomniac: {
    description: "A sleepless resident who notices the footsteps everyone else misses.",
    ability: "Each night, learn the number of living seats to the closest Werewolf-aligned player in either direction of the original circular seat order. Report distance, not identity; conversions change later results.",
    winCondition: villageWin
  },
  lycan: {
    description: "A loyal resident carrying the scent of a monster they have never been.",
    ability: "A Seer investigation reports you as Werewolf-aligned even though your real faction and victory remain Village. Actual-faction comparisons and the Hierophant count still treat you as Village.",
    winCondition: villageWin
  },
  mortician: {
    description: "A careful examiner who listens to the evidence the dead leave behind.",
    ability: "At dawn, privately receive each new death's cause, such as pack attack, poison, or Hunter shot. Do not reveal the victim's role, faction, or attacker.",
    winCondition: villageWin
  },
  scryer: {
    description: "A seeker of the true Seer, tracing a single hidden light through the Village.",
    ability: "Each night choose a living player and learn only whether they are the Seer. On finding the Seer, both privately learn each other's identity and your search ability ends. You remain Village-aligned.",
    winCondition: villageWin
  },
  noble: {
    description: "A respected figure whose death can bring the Village's public judgment to a halt.",
    ability: "If killed, skip the next voting phase once. Continue discussion and then proceed to night. Evaluate your death's immediate win conditions before scheduling the skipped vote.",
    winCondition: villageWin
  },
  "aura-seer": {
    description: "A reader of hidden potential who sees gifts rather than allegiances.",
    ability: "Each night choose a living player and learn whether their role has any special active, passive, or death-triggered ability. Spent abilities still count; a plain Villager does not. Never reveal faction.",
    winCondition: villageWin
  },
  "big-bad-wolf": {
    description: "A brutal pack hunter whose appetite grows when the Village starts to fall.",
    ability: "Once per game, the pack may submit a second, different attack target. Both targets receive normal attack-protection checks. This consumes the extra attack even if it is blocked.",
    winCondition: wolfWin
  },
  "mystic-wolf": {
    description: "A pack diviner who searches for dangerous talents hidden among the residents.",
    ability: "Each night privately inspect one non-pack player to learn whether they have a special ability, without learning the role. Also participate in the pack's shared target vote.",
    winCondition: wolfWin
  },
  "omega-wolf": {
    description: "A cornered pack member whose last act can make the Village hesitate.",
    ability: "When eliminated by voting, cancel the next night's pack attack and make the following pack attack ignore ordinary Doctor or Priest protection once. Does not bypass an Old Man's remaining endurance.",
    winCondition: wolfWin
  },
  sorcerer: {
    description: "A mortal occultist serving the pack by hunting down the Village's diviner.",
    ability: "Each night investigate one player to learn whether they are the Seer. You do not perform a pack attack yourself. Initially know no pack identities; the pack knows you are its helper.",
    winCondition: wolfWin
  },
  "poisoner-werewolf": {
    description: "A pack accomplice who trades claws for a slow and hidden poison.",
    ability: "Once per game poison another living non-pack player. Resolve the poison at dawn; ordinary Doctor and Priest attack protection do not block it. Do not give this helper its own pack attack.",
    winCondition: wolfWin
  },
  minion: {
    description: "A devoted accomplice who serves the pack while hiding behind a harmless face.",
    ability: "Learn attacking Werewolf identities at game start. They do not learn yours. No night attack or other active power; influence discussion and voting for the pack.",
    winCondition: wolfWin
  },
  "fruit-brute": {
    description: "An unusual wolf who becomes fiercest when the rest of the pack has vanished.",
    ability: "Participate in the normal shared pack attack. If you are the last attacking Werewolf alive, you may instead abstain for one night to gain protection from the next non-voting kill against you. Hold at most one such shield.",
    winCondition: wolfWin
  },
  "fallen-angel": {
    description: "A corrupted protector who turns a stolen blessing toward the pack's survival.",
    ability: "Once per game shield another Werewolf-aligned player from one non-voting kill that night. Does not prevent a voting elimination or grant an independent attack.",
    winCondition: wolfWin
  },
  "lone-wolf": {
    description: "A solitary hunter who serves the pack's cause while keeping its own counsel.",
    ability: "Remain Werewolf-aligned but start without knowing the other pack identities; they also do not learn yours. Submit a target into the same shared pack-attack vote rather than creating a second attack.",
    winCondition: wolfWin
  },
  "wolf-cub": {
    description: "The youngest of the pack, whose death can drive the others into a frenzy.",
    ability: "If killed, surviving attacking Werewolves may choose two different pack-attack targets the next night. This does not stack with Big Bad Wolf's extra attack; cap the pack at two targets per night.",
    winCondition: wolfWin
  },
  "confused-wolf": {
    description: "A disoriented pack hunter who must find its allies without revealing itself.",
    ability: "Start without pack identities. Each night choose one player to learn whether they are Werewolf-aligned; this is separate from participating in the shared pack-target vote. Any discovered ally is privately revealed to you only.",
    winCondition: wolfWin
  },
  "german-shepherd": {
    description: "A trusted-looking guardian whose true loyalty lies with the pack.",
    ability: "Once per game choose another Werewolf-aligned player at night. If a Seer investigates that target that night, the result is Village instead. You have no separate attack.",
    winCondition: wolfWin
  },
  "remorseful-werewolf": {
    description: "A pack hunter burdened by the lives lost to its own choices.",
    ability: "Once per game privately veto the shared pack attack before night closes. The night ends without that attack, but your faction remains Werewolf. The veto does not stop independent kills or poison.",
    winCondition: wolfWin
  },
  fool: {
    description: "A cunning outsider who wants the Village to mistake an act for a threat.",
    ability: "No night action. Convince the Village to eliminate you by its daytime vote. Night deaths, Hunter shots, and other kills do not count.",
    winCondition: "Achieve a personal win when eliminated by daytime voting. The faction game continues, and other players can still win."
  },
  moderator: {
    description: "An impartial observer trying to stay alive long enough to see the Village's story through.",
    ability: "No control over bot commands or other players. Once per game privately ask whether the current phase has any missing eligible submissions; receive only a count, never names or targets.",
    winCondition: "Be alive when a faction wins. This is a personal co-win and does not prevent that faction's victory."
  },
  murderer: {
    description: "An independent killer using the pack's chaos as cover for a private hunt.",
    ability: "Each night choose one other living player for an independent attack. Doctor protection blocks it; Werewolf-only Priest protection does not.",
    winCondition: "Become the only living player. While alive, block ordinary faction parity/elimination victories so the independent threat can be resolved."
  },
  "poisoner-neutral": {
    description: "A solitary poisoner with no allegiance beyond their own survival.",
    ability: "Each night poison one other living player; that player dies at the following dawn unless the Poisoner dies before the poison resolves. Ordinary attack protection does not block poison. At most one pending poisoned target.",
    winCondition: "Become the only living player. Like other independent killers, prevent ordinary faction victories while alive."
  },
  turncoat: {
    description: "An opportunist waiting to decide which banner offers the best chance of survival.",
    ability: "Once per game at night, choose Village or Werewolf as your personal victory allegiance. Keep the actual Neutral faction for investigations and counts; do not gain pack knowledge or an attack.",
    winCondition: "Survive until the chosen faction wins. If no allegiance was chosen before the game ends, do not award a personal win."
  },
  "bloody-mary": {
    description: "A haunted outsider who waits for an accuser to speak their name one time too many.",
    ability: "Once per game, after receiving at least one vote in a completed day, mark one of those voters privately. If they vote for you again on a later day, eliminate them after that day's verdict. The mark expires if you die first.",
    winCondition: "Have your marked accuser die to your curse, and survive that resolution. Record a personal win and let the faction game continue."
  },
  "vengeful-ghost": {
    description: "A restless spirit whose grudge survives the moment of death.",
    ability: "After death, secretly mark one living player once. If an attributable player caused your death, restrict the choice to that player's faction; if the cause has no attributable killer, allow any target. You do not regain ordinary votes or night attacks.",
    winCondition: "Your marked target must die before the game ends. Record a personal win independently of the faction result."
  },
  tanner: {
    description: "A weary outsider determined to make the Village deliver their final sentence.",
    ability: "No night action. Like the Fool, seek elimination by a daytime vote; keep Tanner as a distinct role for narration and statistics.",
    winCondition: "Achieve a personal win when eliminated by daytime voting. Continue the faction game afterward."
  },
  doppelganger: {
    description: "A patient imitator waiting for another player's fate to become their own.",
    ability: "On the first night select another player. When they die, copy their role and actual faction, retaining your own life status. One-use powers already spent by the copied player remain spent; never copy a completed personal victory.",
    winCondition: "After transformation, use the copied role's future win conditions. If the target survives until game end, win personally only if you also survive."
  },
  chef: {
    description: "A traveling cook trying to bring people together before the Village tears itself apart.",
    ability: "Each night privately serve one other living player. A player can be served only once; serving grants no protection, information, or faction change.",
    winCondition: "Serve three different players and survive the third serving. Record a personal win without ending the faction game."
  },
  enchantress: {
    description: "A charming outsider weaving a private circle of influence across the Village.",
    ability: "Each night enchant one other living player. Enchantment persists, is privately disclosed to its target, and does not change faction, voting, or other abilities.",
    winCondition: "Be alive with every other living player enchanted. This is an exclusive personal victory that ends the game."
  },
  arsonist: {
    description: "A patient firestarter preparing a single night the Village will never forget.",
    ability: "Each night either douse one other living player or ignite all previously doused living players. Ignition consumes all dousing marks and ignores ordinary attack protection. A Doctor cannot remove a dousing mark.",
    winCondition: "Become the only living player. Prevent ordinary faction victories while alive as an independent killing threat."
  },
  thespian: {
    description: "A performer collecting convincing disguises while trying to survive the final curtain.",
    ability: "At game start receive three distinct role labels from the game catalogue. Each night rehearse one unrehearsed label. Rehearsal grants no real ability, faction change, or permission to impersonate bot messages.",
    winCondition: "Rehearse all three labels and survive until a faction wins. Award a personal co-win."
  },
  cupid: {
    description: "A meddling matchmaker whose chosen bond can defy every faction in the Village.",
    ability: "On the first night link two other players. They learn each other's identity; if one dies, the other dies from heartbreak after any direct protection resolves. The bond does not change their factions.",
    winCondition: "Both linked players must be alive when any faction wins. Award Cupid a personal co-win, even if Cupid has died."
  },
  orphan: {
    description: "A lonely outsider choosing someone to trust in a Village full of uncertain loyalties.",
    ability: "On the first night choose one other living player as your guardian. Learn no secret role or faction. If the guardian dies, your only active power ends; do not automatically convert to another faction.",
    winCondition: "Survive until game end. Earn a personal co-win if you are alive when any faction wins, whether or not your guardian survived."
  },
  "guardian-angel": {
    description: "An independent protector whose entire purpose rests on one person's survival.",
    ability: "Receive a random other player as your ward at game start. Twice per game, privately shield the ward at night from one non-voting lethal effect. Protection ends at dawn and does not block conversion or a voting death.",
    winCondition: "Your ward must be alive when the game ends. Your own survival is not required; this is a personal co-win."
  },
  "priest-neutral": {
    description: "A wandering cleric seeking a small congregation rather than victory for either side.",
    ability: "Each night bless one other living player you have not blessed before. A blessing is a private mark only: it grants no protection, conversion, or faction information.",
    winCondition: "Bless three different players and survive the third blessing. Record a personal win without ending the faction game."
  },
  hoodlum: {
    description: "A determined troublemaker carrying a private list of people they want out of the way.",
    ability: "On the first night choose two different other players as marked rivals. You gain no direct killing power and cannot change the chosen rivals afterward.",
    winCondition: "Outlive both marked rivals. Record a personal win as soon as both are dead and you are alive; let the faction game continue."
  }
};
