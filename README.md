# lordxeno

A WhatsApp supernatural social-deduction game with private role cards, isolated group sessions, timed discussion/voting/night phases, a 58-role catalogue, and saved game recovery.

## Run

Use a recent Node.js release with TypeScript type stripping (Node 22.18+ or 24+).

```bash
npm ci
npm run typecheck
npm test
npm run start:whatsapp
```

Scan the QR from **WhatsApp → Linked devices → Link a device**. The QR image is also written to `.auth/lordxeno/whatsapp-qr.png`. Keep QR codes and `.auth` private. The linked account's ordinary gameplay messages are ignored; its control commands `!gm`, `!games`, `!kick`, and `!endgame` are accepted. Test normal gameplay from another player account or a group.

The bot must be a group admin to open/lock group chat. Player admin privileges are never changed. Baileys is an unofficial WhatsApp integration; game-state tests and a simulated connection do not establish live delivery on every device.

## Start a game

```text
!lobby
!mode classic
!join
!players
!start
```

The lobby creator is host and is already joined. The host chooses `beginner`, `classic`, or `chaos`, then starts once at least four unique players are present. `!startgame` also works. Short commands are case-insensitive; old `!xeno ...` commands remain supported. Ordinary unprefixed chat is ignored.

## Modes and pack size

Werewolf faction seats scale as `max(1, floor(players / 4))`: 4–7 players have one, 8–11 have two, 12–15 have three, and so on. Supported lobby size is 4–100. This is the implementation's explicit balance policy, pending the original Part 2 specification and playtesting.

- **Beginner:** regular Werewolves, a Seer, and Villagers.
- **Classic:** an Alpha replaces one regular wolf when there are multiple wolves; add Seer, Doctor, Hunter (five players or more), and Villagers.
- **Chaos:** starts with an Alpha, draws the other Werewolf faction seats from all wolf roles, limits Neutral seats to one per four players (minimum one), and fills the remaining seats from the Village catalogue. Roles are sampled without replacement in each faction pool; exhausted pools use regular Werewolf, Fool, or Villager fillers. When possible, a drawn Mason receives a second Mason companion. Every catalogue role can appear across Chaos games.

One pack attack is shared by all attack-capable wolves. Their target votes are tallied together; a top tie means no shared kill. Helpers do not gain an attack solely from faction membership. Alpha conversion replaces the entire shared attack for that night, can target Village players only, and is blocked by Doctor protection. A converted player keeps their original role and gains pack-attack participation.

Private role cards show known pack members by name and role. Minion knows the attacking wolves without being revealed to them. Sorcerer, Lone Wolf, and Confused Wolf retain their documented knowledge restrictions; Confused Wolf can discover teammates through its power. Newly converted players can use `!myrole` privately to see their team.

## Phases and role actions

- Discussion: **120 seconds**, group chat open. The first discussion leads to night; later discussions lead to voting.
- Voting: **60 seconds**, group locked. Each eligible living player submits `!vote <number>` by DM; `!unvote` retracts it.
- Night: **60 seconds**, group locked. Each player receives a private prompt for available powers, or a rest message for passive roles.
- Death reaction: **30 seconds**, group locked. A dead Hunter can shoot; a Vengeful Ghost can mark a revenge target before the game continues. Unanswered reactions expire safely.
- Hangman's one-time retrial: **30 seconds** of extra discussion followed by a fresh vote.

Use these privately:

```text
!actions                    Your available powers and numbered targets
!act attack 3               Shared pack target vote
!act convert 3              Alpha's one-time conversion
!act protect 2              Doctor protection
!act see 4                  Seer investigation
!act compare 2 4            Apprentice Seer faction comparison
!act poison 3               Witch or Poisoner power
!act revive 1               A dead-target number from the separate dead list
!act defend 2               Lawyer power during voting
!act allegiance village     Turncoat victory choice
!act ignite                 Arsonist ignition, no target
!act shoot 3                Dead Hunter's final shot
!skip                       Pass on remaining abilities in this phase
```

The prompt is authoritative: only powers available to your role, phase, remaining uses, and eligible targets are accepted. Multi-target selections must use distinct numbers. One-use powers remain spent after restart or revival. Witch chooses one potion per night; Arsonist chooses douse or ignite. First-night selections expire if skipped.

`!night <number>` remains a shortcut for pack attack, Seer investigation, Doctor protection, or a simple single-target role power. Use `!act` when a role has multiple powers or multiple targets.

A phase closes early only after everyone has submitted the required choices or used `!skip`. Skipping powers does **not** cast or skip a voting ballot. A player with a voting power must use it or explicitly skip it before all-vote early closure. Missing choices are skipped at timeout. Passive effects such as Old Man endurance, Mason knowledge, Hierophant counts, Mortician results, and death-triggered abilities apply automatically.

The Old Crone's silence is an announced social rule: WhatsApp cannot selectively stop one player's group messages while permitting everyone else's. Private powers and voting still work for a silenced player.

## Deaths, information, and victory

Deaths reveal the deceased's role in announcements, `!graveyard`, `!players`, and `!status`. Living-player roles and private investigations are never added to public rosters. `!status` includes a numbered living roster and the eliminated list, as well as phase and time remaining.

Wolf attacks use consensus. Night resolution sets up protections and marks, applies pack attack or conversion, independent attacks, ignition, poison, eligible revivals, day effects and private information, then pauses for death reactions before final victory checks. Conflicting same-priority actions use original seat order, so network arrival order does not choose the outcome.

Fool/Tanner lynching wins, Chef/Priest progress, Hoodlum revenge, Ghost revenge, and other personal outcomes are tracked separately from faction victory. Independent killers keep ordinary faction victory from ending an unresolved killing threat. Enchantress and last-surviving independent killers have exclusive Neutral victories; this does not award every Neutral a win. Moderator, Orphan, Turncoat, Thespian, Cupid, and Guardian Angel have explicit personal co-win rules. See [the role rules](docs/ROLE_PROPOSALS.md) for every role's ability and objective.

Revival restores original role/faction and does not restore spent powers. Witch can revive an eligible death from the immediately preceding night; Necromancer can revive an eligible earlier night death. Voting deaths and completed personal lynching wins cannot be revived.

## Other commands

```text
!help          All command groups
!ping          Connection check
!leave         Leave the lobby
!myrole        Private role/team reminder (group or DM)
!roles         Descriptions of roles in this game, without player assignments
!votes         Current tally
!resolve       Resolve a fully submitted vote
!night-resolve Resolve a fully submitted night
!stats         Personal statistics
!leaderboard   Recorded wins
!chronicle     Village history
!kick <n>      Remove a lobby player (group admin or permanent GM)
!endgame       Emergency stop (group admin or permanent GM)
!gm            Check your control privileges
!games         List games and codes privately (permanent GM)
!settings      Mode and default-role information
```

## Winner announcements and permanent Game Masters

At natural game end, the bot posts **Werewolves win!**, **Village wins!**, or a Neutral result followed by the winning team's names and roles. A faction's deceased members still share its win. Personal winners are listed separately. An exclusive Neutral victory never awards every Neutral a win, and a draw lists no team winner. Group chat is reopened after the result.

Group-admin checks use WhatsApp's verified participant ID, alternate phone/LID identity, participant phone field, owner identity, and admin flags. Phone-number digits are never equated with unrelated LID digits.

Configure a permanent GM locally on the device running the bot:

```bash
npm run gm -- add YOUR_NUMBER_WITH_COUNTRY_CODE
npm run gm -- list
```

Use the full international number, without a leading local zero. The setting is stored in `.data/lordxeno-access.json`, which Git ignores; do not add personal numbers to the public source. Changes take effect without restarting the bot and survive future restarts/updates. To remove access, use `npm run gm -- remove YOUR_NUMBER_WITH_COUNTRY_CODE`.

A permanent GM can use `!kick` and `!endgame` without being a group admin or lobby host. `!endgame` can also cancel a lobby before it starts. It stops phase timers and asks WhatsApp to reopen group chat. If the bot lacks permission to reopen chat, it says so rather than claiming success.

Non-admins cannot send into a locked WhatsApp group, even if they are bot GMs. Use these **in DM** instead:

```text
!gm                   Check permanent GM access
!games                List active games/lobbies and stable codes
!endgame GAME_CODE    Stop the selected game or lobby
!endgame              Stop your active game, or the only running game if you are GM
```

The linked bot account itself also has control access. It can send its own control messages while ordinary self-generated gameplay messages remain ignored. GM access never changes a person's WhatsApp admin privileges.

## Persistence and updating Termux

`.auth/`, `.data/`, and `node_modules/` are ignored by Git. Active sessions save roles, factions, aliases, ballots, role targets, spent powers, marks, personal wins, pending death reactions, and phase deadlines. Restart restores state and re-arms timers without restoring consumed powers. Existing deadline durations are retained; new discussions use two minutes. Do not run two bot processes against the same saved-game directory.

Stop the bot with Ctrl+C and update from `~/lordxeno`:

```bash
git pull --ff-only origin codex/part6-voting-and-lobby
npm run start:whatsapp
```

Pairing and game saves remain in place. Start a fresh game to receive the new mode composition; an existing game's assigned roles are preserved.
