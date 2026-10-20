# Ideas for lordxeno

Replay/history and last words are now implemented. Village events and cosmetic achievements remain proposals.

## 1. End-game replay — implemented

Tell the story in a short sequence: night attacks, successful saves, Alpha conversions, close votes, and the final turning point. Reveal private choices only after the game ends. Add rule-based honours such as Best Save and Decisive Vote rather than guessing an MVP.

This is the best first addition: it gives every game a memorable ending and helps players understand what the bot resolved. A separate persisted history now supports !replay without consuming the delivery queue. Automatic honours remain a future addition.

## 2. Optional village events

Give the village a named setting and occasional publicly announced events, such as a festival with extra discussion time or a foggy night with different public narration. Start with narrative and timing events before considering voting or investigation modifiers.

Use a small versioned deck with seeded draws, announce each effect before players choose actions, and record it in the replay. Never silently change faction counts or win conditions. Keep Classic unaffected unless the host opts in.

## 3. Last words — implemented

Let an eliminated player submit one short final message by DM within 15 seconds, then relay it once to the group. This adds drama without letting dead players continue voting or acting. Existing Hunter/Ghost reactions should retain their own timers and priorities; last words must not override their mechanics.

## 4. Seasonal titles and achievements

Award cosmetic titles for verified feats: several successful Doctor saves, surviving an Alpha conversion, or a Fool winning without a night action. Give groups optional season leaderboards alongside lifetime stats.

Keep titles cosmetic. Do not give experienced players extra votes or stronger roles. Use actual persisted game events so achievements are awarded once and survive restarts correctly.

## Suggested order

Build replay/history first, then cosmetic achievements using that same event history. Add opt-in village events after the base role interactions have had more live testing. Last words is a smaller standalone feature if the group wants immediate drama.
