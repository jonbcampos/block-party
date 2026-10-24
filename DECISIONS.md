# Decisions

What we decided, why, and what would make us revisit it. **Append to this; don't rewrite
history.** This is the sister log to the ones in `../slingshot`, `../flappy-unicorn`, `../runner`
and `../tower-defense`.

---

## 1. Portrait, and no rotation

The four siblings are landscape games that rotate themselves when the phone is upright. A
falling-block game is a tall well, so this one is portrait: width fixed at 270 virtual px, height
adapting 480-600 to the phone. A landscape screen (a desktop, a sideways phone) is letterboxed,
not rotated, because rotating would mean holding the phone sideways to play a game about things
falling down.

**Revisit if:** it's played mostly on a tablet in landscape.

## 2. 8 × 16, not 10 × 20

On a phone a 10-wide board gives cells of about 22 px. Aiming a piece at a one-cell gap is the
whole game, so 8 wide makes every cell 25% bigger (29 px on a 19.5:9 phone). 16 tall keeps the
classic 1:2 well. A smaller board fills faster, and the slow start (1.1 s a row) and gentle
speed-up make up for that.

## 3. Relative drag, tap to turn, flick to drop

The piece follows the finger's sideways travel from wherever it went down, a column per 0.85
cells, so her finger never has to be on (and never hides) the piece. A tap turns. A slow drag down
soft-drops. Only a fast, long, mostly vertical flick hard-drops, because an accidental hard drop is
the most frustrating thing this kind of game can do to a child.

A gesture belongs to one piece: once it locks, the rest of the gesture is ignored until the finger
lifts. Without that, a soft-drag lands one piece and keeps sinking the next, and one flick drops
two.

## 4. No game over

Topping out plays the raccoon's victory dance, then a sweep of big blasts clears the whole board.
Play continues with the score kept and the level dropped by two. A five-year-old doesn't need a
"you lost" screen; she needs the next go, and this way the worst moment in the game is also the
biggest explosion.

**Revisit if:** she wants rounds she can "win", e.g. a lines target per level.

## 5. BOOM mode: crates, chains, then everything falls

A crate in a cleared row arms and goes off (radius² 5, a 21-cell blob). Crates caught in a blast go
off 0.16 s later. After the last blast there's a beat to watch the smoke, then every loose block
falls straight down, one row per 45 ms, bottom-up so floating chunks move together. The board is
then checked for full rows again, and that loop is where combos come from.

Plain row clears in BOOM mode still use the classic shift-down. The fall-into-holes gravity happens
only after an explosion, so it reads as the blast's doing and doesn't quietly rearrange the board
on every clear.

Pieces keep the identity of their TNT mino through rotation: minos are rotated mathematically
within the piece's box rather than read from per-rotation tables.

## 6. Reuse the slingshot's painted cast

Ellie, the raccoon, the crate and the explosion flipbook are copied from `../slingshot/public/sprites`
rather than regenerated. They're the same characters, and a second generation would be a slightly
different girl and a slightly different raccoon. The manifest marks them `reused: true` so
`generate-art.mjs` never redraws them, but still publishes their grid shapes in `index.json`.

The new art is the world: two playroom backgrounds and a title picture, painted portrait (9:16) with
the middle left calm for the board.

## 7. Blocks are drawn by code

At 23-31 px a painted texture is mush. Each block is a bold colour, a darker rim, a shine, and an
embossed shape (ring, star, moon, flower, heart, diamond, dot), so pieces can be told apart by more
than colour. Each look is drawn once per cell size into a small canvas and stamped from then on.

## 8. Ellie's voice is TTS for now

Ellie's lines in this game are Gemini TTS (Zephyr, natural speed). Her real recordings come later
from the new script in `../ELLIE-VOICE-SCRIPT-2.md`. When they land, set `recorded: true` on the
ELLIE profile in `scripts/sound-manifest.mjs` so a regenerate never overwrites them.

## 9. Drawing at most 60 times a second (2026-10-24)

"Every time she plays on my phone my phone definitely gets hot... this is the same for all games."
The simulation still steps 120 times a second, but `core/loop.ts` now draws a picture at most
60 times a second, whatever the screen's refresh rate: a 120Hz phone was drawing twice as often as
the game needed. Measured on a laptop, a frame of this game costs well under a millisecond to
draw, so the rate was the waste, not the drawing. The same loop file is shared by every game in
the set; a dev-only `__loop.render(alpha)` lets the console time one frame directly.
