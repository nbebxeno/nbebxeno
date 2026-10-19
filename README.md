# lordxeno

Transport-agnostic engine for **lordxeno**, a Xenoverse supernatural social-deduction game designed for WhatsApp.

The first implementation keeps critical game state in code so a future WhatsApp adapter can handle messages and DMs without becoming the rules engine. The current slice supports isolated group games, randomized core-role assignment, public/private state projections, day-to-vote progression, vote resolution, and validated night-action submission.

The transport now supports independent simultaneous games by WhatsApp group. Each group owns its lobby, engine, aliases, phase timers, votes, and night actions. A completed game can be replaced in the same group without affecting other groups.

## Development

```bash
npm install
npm test
npm run typecheck
npm run start:whatsapp
```

The engine is in [src/engine.ts](src/engine.ts), with behavior checks in [test/engine.test.ts](test/engine.test.ts).

## WhatsApp smoke test

The prototype transport is in [src/whatsapp.ts](src/whatsapp.ts). Run `npm run start:whatsapp`, scan the displayed QR code in WhatsApp under **Linked devices**, then send `!ping` to the linked account from a test group or DM. The session is stored locally under `.auth/` and is ignored by Git.

This currently verifies connectivity and the initial lobby flow. The Baileys transport is a prototype integration pending a production WhatsApp provider decision.

## First game test

Add the paired account to a test group, then use these commands in the group:

```text
!lobby
!mode classic
!join
!players
!startgame
```

The person who creates the lobby is the host. The host must choose `classic`, `beginner`, or `chaos` before other players join. At least four unique players must join, and only the host can start; WhatsApp admin status is not required. Starting sends the public summoning message to the group and each role card privately to its player.

## Day voting test

After the discussion timer ends, voting opens automatically. The group remains locked and each living player receives a private voting prompt with the current alive roster number:

```text
!vote 2
```

Send that command to lordxeno by DM, not in the group. Use `!unvote` by DM to retract a vote. Group-chat votes and retractions are rejected; the bot never promotes or demotes players to enable voting.

When every living player has voted, any player may send:

```text
!resolve
```

The first and later discussion phases last 120 seconds (2 minutes). Voting and night phases last 60 seconds. Voting closes immediately when all eligible players vote; night closes immediately when all required actions arrive. Missing votes and night actions are autoskipped at timeout. Voting is not available during the first discussion. The current configured tie policy is no elimination. Manual `!resolve` requires every living vote; only the phase timeout skips missing votes, so an early manual request cannot cancel the voting timer.

## Night action test

After voting resolves, Werewolves, the Seer, and the Doctor receive private prompts. They reply to lordxeno by DM:

```text
!night 2
```

The number refers to the current living-player roster shown in the group and in the DM. Eliminated players are listed separately and do not consume a target number. Night lasts 60 seconds; it resolves automatically even if a player does not submit an action. You can also resolve early by sending this in the group:

```text
!night-resolve
```

The Seer receives their result privately. Dawn and voting announcements reveal the role of each deceased player. Living players’ roles remain private. The graveyard, player roster, and status also show roles for eliminated players.

## Commands and roles

Command definitions live in [src/commands.ts](src/commands.ts). The WhatsApp transport resolves incoming messages through that registry, and `!help` is generated from the same entries, grouped by setup, game, voting, meta, and admin. Duplicate command names fail during module initialization.

The role database in [src/engine.ts](src/engine.ts) includes the full requested catalogue, with separate IDs for `poisoner-werewolf`, `poisoner-neutral`, `priest-village`, and `priest-neutral`. Fool is explicitly Neutral. Classic and Beginner use their controlled core pools; Chaos randomly draws from its eligible catalogue pool without replacement from all 43 non-Werewolf catalogue roles, while preserving the existing single attacking Werewolf baseline. Classic and Beginner retain their existing compositions pending Part 2’s eligibility and balance rules. Chaos can assign unfinished catalogue roles; their missing abilities are not implemented by this selection change. Catalogue entries whose mechanics are not yet specified remain marked `UNDEFINED - REQUIRES DESIGN`.

## Reliability and recovery

The WhatsApp process uses a file-backed session store at `.data/lordxeno-games.json`. Active games are keyed by WhatsApp group ID and save players, aliases, roles, alive/dead state, votes, submitted night actions, and phase deadlines after meaningful changes. On reconnect or process restart, active group timers are re-armed from their saved deadlines.

Required night actions and votes never block a timed phase forever: an expired night resolves with missing actions skipped. Votes and night actions send confirmations, and repeated identical commands from one sender are throttled briefly to protect the game state.

## Automatic phase loop

The first and later discussion phases last 120 seconds (2 minutes). Voting and night phases last 60 seconds. Missing votes and night actions are autoskipped. Every transition re-arms the next timer and private role prompts.

The bot must be a group admin for phase locking. During discussion it opens the group for everyone; during night and voting it switches the group to admin-only messaging. Player admin roles are never changed. If WhatsApp refuses the setting change, the game continues and the failure is logged instead of crashing the process.

## Command reference

Commands are case-insensitive. Use short commands such as `!join`, `!status`, and `!vote 2`. The older `!xeno join`, `!xeno status`, and other `!xeno` commands remain supported. Send `!myrole` in the group to receive a role reminder by DM; ordinary unprefixed chat is ignored.

```text
!help          List commands
!join          Join the lobby
!mode <preset> Host chooses classic, beginner, or chaos
!leave         Leave before the game starts
!startgame     Host-only game start
!players       Show lobby or living roster
!status        Show phase, timer, and full player list
!roles         Show one-line summaries of roles in play
!myrole        DM your role and ability reminder
!graveyard     Show public deaths
!vote <number> Cast a vote during voting
!unvote        Retract your vote
!votes         Show the current tally
!stats         Show persistent personal stats
!chronicle     Show Village Chronicle entries
!leaderboard   Show persistent top players
!kick <number> Admin-only lobby removal
!endgame       Admin-only emergency stop
!settings      Show group role settings
```

Stats and Chronicle data is stored in `.data/lordxeno-stats.json` and is ignored by Git. Role settings are currently read-only until the role-composition system supports per-group role pools.

## Current scope
## Current role set

The role database records all six confirmed core roles. The default role composition uses the defined mechanics only:

- 4 players: Werewolf, Seer, Doctor, Villager
- 5 players: the four above plus Hunter
- 6+ players: the five-player set plus Villagers

Alpha Werewolf is recorded as a rare role, but is not assigned by the default composition because its additional ability is not designed yet. The Villager utility ability and Hunter death-trigger behavior are likewise marked undefined and are not silently implemented.

## Information boundaries
These mechanics still require design before they can be made canonical:


Phase transitions log the group, timestamp, phase, and trigger (`timer`, `all-votes-submitted`, `all-actions-submitted`, or manual) to the process output for diagnosing future cycle failures.
- WhatsApp provider/library, command syntax, lobby, timers, and persistence
- Alpha Werewolf ability, Villager utility, and complete Hunter resolution
- Night-action priority and resolution, including Werewolf coordination
- Death-reveal policy, conversion, curses, additional factions, and advanced roles
- AFK/disconnect handling, admin controls, narration generation, and recovery

The engine uses `no-elimination` for voting ties. The WhatsApp bot enables role reveals on death; other integrations can disable them using `revealRoleOnDeath: false`. Living roles remain private in either mode.


## Part 6 implementation notes

- Repeated joins never add another roster entry. The bot sends one “already in the lobby” warning per player/group until that player successfully rejoins or the process restarts. Leaving and kicking clear identity aliases so returning players can join again.
- All 58 catalogue roles have explicit faction mappings, including separate Poisoner and Priest IDs. Fool and Tanner record individual lynching wins independently of the eventual faction result. These outcomes survive game saves and count toward personal wins when the faction game completes; other Neutral objectives remain unspecified.
- Chaos samples the entire non-Werewolf catalogue uniformly without replacement, refilling only after exhaustion. This spreads selections beyond the previous eight-role subset and varies even four-player games. Werewolf variants remain outside the selection pool because their abilities and attack coordination are unfinished.
- Part 2 is still needed to finalize each mode’s eligible pool, rare-role weights, and player-count balance. The existing one-Werewolf composition is provisional, especially for larger groups. Classic and Beginner composition changes and undefined individual objectives require those missing rules.
- The simulated WhatsApp test checks group locking, private voting prompts, DM votes/retractions, duplicate join replies, and early resolution. It does not establish live WhatsApp connectivity.

## WhatsApp message design and role proposals

The bot uses shared WhatsApp message templates in `src/presentation.ts` for role cards, lobbies, rosters, role summaries, and status. Cards use readable role/faction names and explain where to send commands. Lobbies show the selected mode and the next step instead of always asking the host to pick a mode.

See [message previews](docs/WHATSAPP_PREVIEW.md) and [the 55 role proposals](docs/ROLE_PROPOSALS.md). Every unfinished role now has distinct narrative copy. Proposed abilities and objectives are stored separately in `src/role-proposals.ts` for review; they do not enable special powers or change win logic. Unfinished cards say that their special power is not active yet. Existing Werewolf, Seer, Doctor, and Fool/Tanner behavior remains as described above.

## Updating the bot in Termux

Stop the running bot with Ctrl+C, then run these commands from `~/lordxeno`:

```bash
git pull --ff-only origin codex/part6-voting-and-lobby
npm run start:whatsapp
```

Your local `.auth` pairing and `.data` game saves are ignored by Git and are retained. Existing saved phase deadlines keep their remaining time; newly scheduled discussions use two minutes.
