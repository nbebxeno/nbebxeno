# Role descriptions and ability proposals

**Status: proposed for review. Powers in this document are not enabled by this change.**

All 58 faction mappings remain as specified in Part 6. The 55 roles below previously had undefined design status. Their narrative descriptions now appear in the bot; their proposed abilities and objectives remain a design draft. The existing Werewolf, Seer, and Doctor mechanics are unchanged. Fool/Tanner lynching wins were implemented in Part 6; their entries clarify that existing behavior.

## Shared rules proposed for implementation

- Secret selections use DM; public narration never reveals a role or faction unless an approved rule explicitly requires it.
- Resolve role blocks and submitted protections before attacks, then damage, death-triggered effects, eligible revivals, conversions, information results, personal outcomes, and faction outcomes. Hunter reactions and forced deaths settle before the final victory check. Exact ordering and conflicting effects need scenario tests before enabling advanced roles.
- Use one shared Werewolf attack. Pack votes tie by no attack, and missing submissions are skipped. Separate helper roles from attacking wolves; being Werewolf-aligned does not automatically grant an attack. Part 2 must finalize attack-capable role eligibility and balance.
- Personal co-wins can coexist with a faction victory. Exclusive Neutral victories and living independent killers require new victory evaluation; the present engine does not implement those proposed rules.
- A role change or revival does not restore consumed one-use abilities. Do not silently apply general Neutral victory rules to a role with its own objective.
- Keep WhatsApp permissions simple: group chat open for discussion, locked for voting and night. No player promotion or demotion. Individual silence is a social rule, because WhatsApp cannot enforce per-player send restrictions.
- These are proposed mechanics for this game, not claims about a universal Werewolf ruleset. Confirm abilities, edge cases, and Part 2 balance before implementing them.

## Village

### Villager

An ordinary resident with no supernatural gift. Your influence comes from sharp questions, careful listening, and your vote.

**Proposed ability:** No night power. Participate in discussion and cast one vote each day. Proposal: keep Villager simple rather than adding an unapproved utility power.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `villager`

### Hunter

A watchful marksman who refuses to meet death without one final stand.

**Proposed ability:** When killed by voting or an attack, choose one living player to shoot within 30 seconds. Resolve the shot before faction victory checks; if no target is submitted, skip it. The shot cannot be blocked by ordinary night protection.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `hunter`

### Witch

A keeper of dangerous remedies, with one chance to save a life and one to take it.

**Proposed ability:** Once per game each: poison one living player at night, or revive one player killed in the immediately preceding night. Use at most one potion per night. A revived player returns with their original role and faction; never revive a voting death.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `witch`

### Apprentice Seer

A student of hidden signs who senses connections rather than seeing an entire destiny.

**Proposed ability:** Each night choose two different living players and learn whether their actual factions match. This compares faction only, not personal win conditions, and does not inherit Lycan's misleading Seer result.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `apprentice-seer`

### Mason

A member of a secret fellowship whose strongest resource is shared trust.

**Proposed ability:** At game start, privately learn the other Masons. No night action. Assign Masons in pairs when the mode's role pool and player count permit.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `mason`

### Old Man

A stubborn elder whose endurance can outlast the Village's darkest night.

**Proposed ability:** Survive the first lethal Werewolf attack against you; the next can kill normally. Protection prevents an attack from consuming this endurance. Endurance does not block poison, voting, or a Hunter shot.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `old-man`

### Diseased

A doomed resident whose illness may wound the pack that claims them.

**Proposed ability:** If a Werewolf faction attack kills you, the pack loses its attack on the following night. Voting, conversion, poison, and non-pack kills do not trigger this effect.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `diseased`

### Lawyer

A determined advocate who can buy an accused resident one more day.

**Proposed ability:** Once per game, select a client privately before voting closes. If that client would be eliminated by that vote, cancel the elimination. Do not transfer their votes to another target; the day ends without a voting death.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `lawyer`

### Scapegoat

The resident the Village blames when it cannot agree on anyone else.

**Proposed ability:** When a vote has a tie for the highest nonzero tally, you are eliminated instead of applying the usual no-elimination tie rule. No ability triggers when nobody votes. At most one Scapegoat per game.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `scapegoat`

### Hapless Victim

An unlucky neighbor whose fate is tangled with the people closest to them.

**Proposed ability:** Once per game, if the next living player after you in the original seat order would die to the pack attack, take that death instead. Calculate the neighbor when night begins. No chains between multiple Hapless Victims; protection checks the final victim.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `hapless-victim`

### Hangman

A grim official who believes every verdict deserves one last hearing.

**Proposed ability:** Once per game, when voting would produce an elimination, postpone that verdict for an extra 30-second discussion followed by a fresh vote. The replacement vote is final and cannot trigger another Hangman delay.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `hangman`

### Martyr

A selfless resident willing to stand in the condemned player's place.

**Proposed ability:** Once per game, designate another living player before voting closes. If that player would be eliminated, you die instead. The spared player's lynching win does not trigger because they were not eliminated.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `martyr`

### Priest (Village)

A Village cleric who offers sanctuary against the creatures of the night.

**Proposed ability:** Each night protect one other living player from Werewolf faction attacks. You cannot protect the same player on consecutive nights. Does not block poison, conversion, voting, or Hunter shots.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `priest-village`

### Necromancer

A guardian of forbidden rites who can call one fallen voice back to the Village.

**Proposed ability:** Once per game, revive a player who died in an earlier night, restoring their original role and faction. Exclude voting deaths and players with completed personal lynching wins. Revived one-use abilities remain spent.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `necromancer`

### The Old Crone

An unsettling elder whose quiet curse can steal a resident's voice.

**Proposed ability:** Each night choose another player to silence for the next discussion. This is a narrated social rule: WhatsApp cannot selectively block one non-admin player's messages. The target may still submit private votes and night actions. Never change player admin privileges.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `old-crone`

### Hierophant

A keeper of sacred knowledge who measures how deeply the pack has infiltrated the Village.

**Proposed ability:** At each dawn, privately learn the count of living Werewolf-aligned players after deaths and conversions. Count faction membership, including Werewolf helpers, rather than role names.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `hierophant`

### Spellcaster

A Village mystic who can loosen a hostile voice's grip on the day's verdict.

**Proposed ability:** Once per game, choose another living player at night. Their vote is not counted in the next voting phase; privately tell them and exclude them from required-voter counts. Their other abilities remain available.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `spellcaster`

### Insomniac

A sleepless resident who notices the footsteps everyone else misses.

**Proposed ability:** Each night, learn the number of living seats to the closest Werewolf-aligned player in either direction of the original circular seat order. Report distance, not identity; conversions change later results.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `insomniac`

### Lycan

A loyal resident carrying the scent of a monster they have never been.

**Proposed ability:** A Seer investigation reports you as Werewolf-aligned even though your real faction and victory remain Village. Actual-faction comparisons and the Hierophant count still treat you as Village.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `lycan`

### Mortician

A careful examiner who listens to the evidence the dead leave behind.

**Proposed ability:** At dawn, privately receive each new death's cause, such as pack attack, poison, or Hunter shot. Do not reveal the victim's role, faction, or attacker.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `mortician`

### Scryer

A seeker of the true Seer, tracing a single hidden light through the Village.

**Proposed ability:** Each night choose a living player and learn only whether they are the Seer. On finding the Seer, both privately learn each other's identity and your search ability ends. You remain Village-aligned.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `scryer`

### Noble

A respected figure whose death can bring the Village's public judgment to a halt.

**Proposed ability:** If killed, skip the next voting phase once. Continue discussion and then proceed to night. Evaluate your death's immediate win conditions before scheduling the skipped vote.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `noble`

### Aura Seer

A reader of hidden potential who sees gifts rather than allegiances.

**Proposed ability:** Each night choose a living player and learn whether their role has any special active, passive, or death-triggered ability. Spent abilities still count; a plain Villager does not. Never reveal faction.

**Win condition:** Win with the Village when the Werewolf faction is eliminated.

Internal ID: `aura-seer`

## Werewolf

### Alpha Werewolf

The pack's elder, feared for turning the Village's own people against it.

**Proposed ability:** Once per game, replace the pack attack with an attempted conversion of a Village player. Doctor protection blocks conversion. The target keeps their role label but becomes Werewolf-aligned and learns the pack; do not convert Neutral roles.

**Win condition:** Win with the Werewolf faction when living Werewolves reach parity with all other living players.

Internal ID: `alpha-werewolf`

### Big Bad Wolf

A brutal pack hunter whose appetite grows when the Village starts to fall.

**Proposed ability:** Once per game, the pack may submit a second, different attack target. Both targets receive normal attack-protection checks. This consumes the extra attack even if it is blocked.

**Win condition:** Win with the Werewolf faction when living Werewolves reach parity with all other living players.

Internal ID: `big-bad-wolf`

### Mystic Wolf

A pack diviner who searches for dangerous talents hidden among the residents.

**Proposed ability:** Each night privately inspect one non-pack player to learn whether they have a special ability, without learning the role. Also participate in the pack's shared target vote.

**Win condition:** Win with the Werewolf faction when living Werewolves reach parity with all other living players.

Internal ID: `mystic-wolf`

### Omega Wolf

A cornered pack member whose last act can make the Village hesitate.

**Proposed ability:** When eliminated by voting, cancel the next night's pack attack and make the following pack attack ignore ordinary Doctor or Priest protection once. Does not bypass an Old Man's remaining endurance.

**Win condition:** Win with the Werewolf faction when living Werewolves reach parity with all other living players.

Internal ID: `omega-wolf`

### Sorcerer

A mortal occultist serving the pack by hunting down the Village's diviner.

**Proposed ability:** Each night investigate one player to learn whether they are the Seer. You do not perform a pack attack yourself. Initially know no pack identities; the pack knows you are its helper.

**Win condition:** Win with the Werewolf faction when living Werewolves reach parity with all other living players.

Internal ID: `sorcerer`

### Poisoner (Werewolf)

A pack accomplice who trades claws for a slow and hidden poison.

**Proposed ability:** Once per game poison another living non-pack player. Resolve the poison at dawn; ordinary Doctor and Priest attack protection do not block it. Do not give this helper its own pack attack.

**Win condition:** Win with the Werewolf faction when living Werewolves reach parity with all other living players.

Internal ID: `poisoner-werewolf`

### Minion

A devoted accomplice who serves the pack while hiding behind a harmless face.

**Proposed ability:** Learn attacking Werewolf identities at game start. They do not learn yours. No night attack or other active power; influence discussion and voting for the pack.

**Win condition:** Win with the Werewolf faction when living Werewolves reach parity with all other living players.

Internal ID: `minion`

### Fruit Brute

An unusual wolf who becomes fiercest when the rest of the pack has vanished.

**Proposed ability:** Participate in the normal shared pack attack. If you are the last attacking Werewolf alive, you may instead abstain for one night to gain protection from the next non-voting kill against you. Hold at most one such shield.

**Win condition:** Win with the Werewolf faction when living Werewolves reach parity with all other living players.

Internal ID: `fruit-brute`

### Fallen Angel

A corrupted protector who turns a stolen blessing toward the pack's survival.

**Proposed ability:** Once per game shield another Werewolf-aligned player from one non-voting kill that night. Does not prevent a voting elimination or grant an independent attack.

**Win condition:** Win with the Werewolf faction when living Werewolves reach parity with all other living players.

Internal ID: `fallen-angel`

### Lone Wolf

A solitary hunter who serves the pack's cause while keeping its own counsel.

**Proposed ability:** Remain Werewolf-aligned but start without knowing the other pack identities; they also do not learn yours. Submit a target into the same shared pack-attack vote rather than creating a second attack.

**Win condition:** Win with the Werewolf faction when living Werewolves reach parity with all other living players.

Internal ID: `lone-wolf`

### Wolf Cub

The youngest of the pack, whose death can drive the others into a frenzy.

**Proposed ability:** If killed, surviving attacking Werewolves may choose two different pack-attack targets the next night. This does not stack with Big Bad Wolf's extra attack; cap the pack at two targets per night.

**Win condition:** Win with the Werewolf faction when living Werewolves reach parity with all other living players.

Internal ID: `wolf-cub`

### Confused Wolf

A disoriented pack hunter who must find its allies without revealing itself.

**Proposed ability:** Start without pack identities. Each night choose one player to learn whether they are Werewolf-aligned; this is separate from participating in the shared pack-target vote. Any discovered ally is privately revealed to you only.

**Win condition:** Win with the Werewolf faction when living Werewolves reach parity with all other living players.

Internal ID: `confused-wolf`

### German Shepherd

A trusted-looking guardian whose true loyalty lies with the pack.

**Proposed ability:** Once per game choose another Werewolf-aligned player at night. If a Seer investigates that target that night, the result is Village instead. You have no separate attack.

**Win condition:** Win with the Werewolf faction when living Werewolves reach parity with all other living players.

Internal ID: `german-shepherd`

### Remorseful Werewolf

A pack hunter burdened by the lives lost to its own choices.

**Proposed ability:** Once per game privately veto the shared pack attack before night closes. The night ends without that attack, but your faction remains Werewolf. The veto does not stop independent kills or poison.

**Win condition:** Win with the Werewolf faction when living Werewolves reach parity with all other living players.

Internal ID: `remorseful-werewolf`

## Neutral

### Fool

A cunning outsider who wants the Village to mistake an act for a threat.

**Proposed ability:** No night action. Convince the Village to eliminate you by its daytime vote. Night deaths, Hunter shots, and other kills do not count.

**Win condition:** Achieve a personal win when eliminated by daytime voting. The faction game continues, and other players can still win.

Internal ID: `fool`

### Moderator

An impartial observer trying to stay alive long enough to see the Village's story through.

**Proposed ability:** No control over bot commands or other players. Once per game privately ask whether the current phase has any missing eligible submissions; receive only a count, never names or targets.

**Win condition:** Be alive when a faction wins. This is a personal co-win and does not prevent that faction's victory.

Internal ID: `moderator`

### Murderer

An independent killer using the pack's chaos as cover for a private hunt.

**Proposed ability:** Each night choose one other living player for an independent attack. Doctor protection blocks it; Werewolf-only Priest protection does not.

**Win condition:** Become the only living player. While alive, block ordinary faction parity/elimination victories so the independent threat can be resolved.

Internal ID: `murderer`

### Poisoner (Neutral)

A solitary poisoner with no allegiance beyond their own survival.

**Proposed ability:** Each night poison one other living player; that player dies at the following dawn unless the Poisoner dies before the poison resolves. Ordinary attack protection does not block poison. At most one pending poisoned target.

**Win condition:** Become the only living player. Like other independent killers, prevent ordinary faction victories while alive.

Internal ID: `poisoner-neutral`

### Turncoat

An opportunist waiting to decide which banner offers the best chance of survival.

**Proposed ability:** Once per game at night, choose Village or Werewolf as your personal victory allegiance. Keep the actual Neutral faction for investigations and counts; do not gain pack knowledge or an attack.

**Win condition:** Survive until the chosen faction wins. If no allegiance was chosen before the game ends, do not award a personal win.

Internal ID: `turncoat`

### Bloody Mary

A haunted outsider who waits for an accuser to speak their name one time too many.

**Proposed ability:** Once per game, after receiving at least one vote in a completed day, mark one of those voters privately. If they vote for you again on a later day, eliminate them after that day's verdict. The mark expires if you die first.

**Win condition:** Have your marked accuser die to your curse, and survive that resolution. Record a personal win and let the faction game continue.

Internal ID: `bloody-mary`

### Vengeful Ghost

A restless spirit whose grudge survives the moment of death.

**Proposed ability:** After death, secretly mark one living player once. If an attributable player caused your death, restrict the choice to that player's faction; if the cause has no attributable killer, allow any target. You do not regain ordinary votes or night attacks.

**Win condition:** Your marked target must die before the game ends. Record a personal win independently of the faction result.

Internal ID: `vengeful-ghost`

### Tanner

A weary outsider determined to make the Village deliver their final sentence.

**Proposed ability:** No night action. Like the Fool, seek elimination by a daytime vote; keep Tanner as a distinct role for narration and statistics.

**Win condition:** Achieve a personal win when eliminated by daytime voting. Continue the faction game afterward.

Internal ID: `tanner`

### Doppelgänger

A patient imitator waiting for another player's fate to become their own.

**Proposed ability:** On the first night select another player. When they die, copy their role and actual faction, retaining your own life status. One-use powers already spent by the copied player remain spent; never copy a completed personal victory.

**Win condition:** After transformation, use the copied role's future win conditions. If the target survives until game end, win personally only if you also survive.

Internal ID: `doppelganger`

### Chef

A traveling cook trying to bring people together before the Village tears itself apart.

**Proposed ability:** Each night privately serve one other living player. A player can be served only once; serving grants no protection, information, or faction change.

**Win condition:** Serve three different players and survive the third serving. Record a personal win without ending the faction game.

Internal ID: `chef`

### Enchantress

A charming outsider weaving a private circle of influence across the Village.

**Proposed ability:** Each night enchant one other living player. Enchantment persists, is privately disclosed to its target, and does not change faction, voting, or other abilities.

**Win condition:** Be alive with every other living player enchanted. This is an exclusive personal victory that ends the game.

Internal ID: `enchantress`

### Arsonist

A patient firestarter preparing a single night the Village will never forget.

**Proposed ability:** Each night either douse one other living player or ignite all previously doused living players. Ignition consumes all dousing marks and ignores ordinary attack protection. A Doctor cannot remove a dousing mark.

**Win condition:** Become the only living player. Prevent ordinary faction victories while alive as an independent killing threat.

Internal ID: `arsonist`

### Thespian

A performer collecting convincing disguises while trying to survive the final curtain.

**Proposed ability:** At game start receive three distinct role labels from the game catalogue. Each night rehearse one unrehearsed label. Rehearsal grants no real ability, faction change, or permission to impersonate bot messages.

**Win condition:** Rehearse all three labels and survive until a faction wins. Award a personal co-win.

Internal ID: `thespian`

### Cupid

A meddling matchmaker whose chosen bond can defy every faction in the Village.

**Proposed ability:** On the first night link two other players. They learn each other's identity; if one dies, the other dies from heartbreak after any direct protection resolves. The bond does not change their factions.

**Win condition:** Both linked players must be alive when any faction wins. Award Cupid a personal co-win, even if Cupid has died.

Internal ID: `cupid`

### Orphan

A lonely outsider choosing someone to trust in a Village full of uncertain loyalties.

**Proposed ability:** On the first night choose one other living player as your guardian. Learn no secret role or faction. If the guardian dies, your only active power ends; do not automatically convert to another faction.

**Win condition:** Survive until game end. Earn a personal co-win if you are alive when any faction wins, whether or not your guardian survived.

Internal ID: `orphan`

### Guardian Angel

An independent protector whose entire purpose rests on one person's survival.

**Proposed ability:** Receive a random other player as your ward at game start. Twice per game, privately shield the ward at night from one non-voting lethal effect. Protection ends at dawn and does not block conversion or a voting death.

**Win condition:** Your ward must be alive when the game ends. Your own survival is not required; this is a personal co-win.

Internal ID: `guardian-angel`

### Priest (Neutral)

A wandering cleric seeking a small congregation rather than victory for either side.

**Proposed ability:** Each night bless one other living player you have not blessed before. A blessing is a private mark only: it grants no protection, conversion, or faction information.

**Win condition:** Bless three different players and survive the third blessing. Record a personal win without ending the faction game.

Internal ID: `priest-neutral`

### Hoodlum

A determined troublemaker carrying a private list of people they want out of the way.

**Proposed ability:** On the first night choose two different other players as marked rivals. You gain no direct killing power and cannot change the chosen rivals afterward.

**Win condition:** Outlive both marked rivals. Record a personal win as soon as both are dead and you are alive; let the faction game continue.

Internal ID: `hoodlum`
