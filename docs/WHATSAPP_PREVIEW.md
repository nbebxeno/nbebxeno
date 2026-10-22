# WhatsApp message previews

Compact cards use WhatsApp bold labels and plain numbered targets. Use `!details` for full role rules and `!help <group>` for command explanations.

## Lobby

```text
🌒 *LORDXENO · LOBBY*

Mode: Classic · Players: 3/4 min
Host: Ada

1. Ada · host
2. Bayo
3. Chidi

Waiting for 1 more player.

!join · Join   !leave · Leave   !start · Host starts
```

## Compact private role

```text
🌑 *Alpha Werewolf* · PRIVATE
Team: Werewolf

The pack's elder, feared for turning the Village's own people against it.

*Objective*
Win with the Werewolf faction when living Werewolves reach parity with all other living players.

*Known pack*
• Bayo — Werewolf

!act attack <number> · Night
!act convert <number> · Night

!actions · Current choices   !skip · Pass on powers
!vote <number> · Vote in DM   !unvote · Undo
!details · Full role rules · Keep your card private.
```

## Status

```text
📜 *LORDXENO · STATUS*

Day 1 · Discussion
Time left: 120s

Discussion open · keep your role secret.

*Alive · 8*
1. Ada
2. Bayo
3. Chidi
4. Dami
5. Eni
6. Fola
7. Gabe
8. Hana
```

## Voting DM

```text
⚖️ *YOUR VOTE*
60s · reply in this chat

1. Ada
2. Bayo
3. Chidi
4. Dami
5. Eni
6. Fola
7. Gabe
8. Hana

!vote <number> · Choose   !unvote · Undo
Missing votes pass at timeout.
```

## Night choices

```text
🌘 *Night · YOUR ACTIONS*

!act attack <number>
Vote for the shared pack target. Tied pack votes mean no attack.
!act convert <number>
Convert a Village player instead of this night's pack attack (once).

*Living targets*
1. Ada
2. Bayo
3. Chidi
4. Dami
5. Eni
6. Fola
7. Gabe
8. Hana

!skip · Pass on remaining powers; your vote is separate.
```

## Winner list

```text
🐺 *WEREWOLVES WIN!*

*Winning team*
1. Ada — Alpha Werewolf
2. Bayo — Werewolf
```

## Story cards

```text
✦ *LORDXENO / MORNING*
────────────────
Day 2 · Briar Hollow

Morning comes. Everyone reaches the town square alive.
The baker claims his garlic buns deserve the credit.
```

Scenes vary by game and actual events. Death cards retain role reveals. Players can DM `!lastwords Tell My Cat I Tried` within 15 seconds; the group receives their original message once. Finished games offer `!replay` and a short aftermath.

`!lb` now renders a midnight-and-gold PNG table with player names, wins, win rate, and games; text remains available automatically if rendering or delivery fails.

## Help handbook

```text
✦ *LORDXENO · HELP*
_The village handbook_
────────────────

*YOUR NEXT MOVE*
!help setup · Start a game
!help game · Players & status
!help powers · Your role actions
!help voting · Cast your vote
!help meta · Stats & replays
!help admin · GM controls

*THE BASICS*
Group → lobby & discussion
DM → votes & secret powers

_Pick a guide above. Short commands work._
```

### Voting guide

```text
✦ *LORDXENO · HELP*
_The village handbook_
────────────────

*VOTING*
_Vote in DM. Results appear in the group._

*!vote <number> (DM)*
  Cast a private lynch vote.

*!unvote (DM)*
  Retract your private vote.

*!votes*
  Show the current vote tally.

*!resolve*
  Resolve the completed vote.

!help · Back to the handbook
```

## Pack whisper (DM only, at night)

```text
✦ *LORDXENO / PACK WHISPER*
────────────────
*Amara*

> Let's Pick Number 4 Tonight 😈

!pack <message> · Reply to your pack
```

Only living teammates with mutual pack recognition receive the message. The public group and replay receive nothing.
