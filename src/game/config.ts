/**
 * Every tuning number in the game lives in this file.
 *
 * Units: board cells and seconds in the simulation, virtual pixels on screen.
 * The renderer is the only thing that turns a cell into pixels (`layout()` in
 * render/layout.ts), so the game plays identically whatever size a cell is
 * drawn at.
 *
 * Exception, as in the siblings: the piece table (`PIECES` in pieces.ts) is a
 * data table rather than loose numbers.
 */

// --- Screen -----------------------------------------------------------------

/**
 * The virtual frame. PORTRAIT, unlike the four siblings: a falling-block game
 * is a tall well, and a phone held upright is a tall screen.
 *
 * So the axes swap roles. WIDTH is fixed, because the board's width is the
 * thing that must fit, and HEIGHT adapts to the phone's aspect ratio between
 * the clamps: a 19.5:9 phone gets a taller frame and bigger cells instead of
 * two fat black bars above and below.
 */
export const VIRTUAL_W = 270;
export const MIN_VIRTUAL_H = 480;
/** About 20:9. Taller than this and the board stops growing; bars take the rest. */
export const MAX_VIRTUAL_H = 600;

/** The live frame size. Mutated by Viewport on resize. */
export const SCREEN = { w: VIRTUAL_W, h: MIN_VIRTUAL_H, rotated: false };

/** Retina beyond 2x costs fill rate and buys nothing at this art scale. */
export const MAX_DPR = 2;

// --- Loop -------------------------------------------------------------------

export const FIXED_DT = 1 / 120;
export const MAX_FRAME_TIME = 0.25;

// --- The board --------------------------------------------------------------

/**
 * 8 wide, 16 tall: smaller than the standard 10 x 20 on purpose.
 *
 * On a phone a 10-wide board gives cells of about 22 px, and a five-year-old
 * aiming a piece at a one-cell gap needs a target she can see without leaning
 * in. 8 wide makes every cell 25% bigger. 16 tall keeps the classic 1:2 well.
 */
export const COLS = 8;
export const ROWS = 16;
/**
 * Rows above the visible top where pieces spawn and can rotate. Nothing there
 * is ever drawn; a locked block that ends up there is a top-out.
 */
export const HIDDEN_ROWS = 2;
export const TOTAL_ROWS = ROWS + HIDDEN_ROWS;

// --- Falling ----------------------------------------------------------------

/**
 * Seconds per row at level 1. Slow on purpose: the speed in the classic game's
 * level 1 is already brisk for an adult, and the point here is that she gets to
 * think about where it goes.
 */
export const FALL_START = 1.1;
/** Each level multiplies the interval by this. */
export const FALL_DECAY = 0.88;
/** And it never gets faster than this, however long she plays. */
export const FALL_MIN = 0.32;
/** Lines per level. */
export const LINES_PER_LEVEL = 8;
export const MAX_LEVEL = 12;

/**
 * Once a piece touches down she still has this long to slide or turn it.
 *
 * Generous, and every successful move restarts it (up to `LOCK_RESETS` times),
 * because the moment a piece lands is exactly when a small child notices it is
 * one column off.
 */
export const LOCK_DELAY = 0.75;
export const LOCK_RESETS = 14;

/** A pause between a piece locking and the next one appearing. */
export const SPAWN_DELAY = 0.12;

// --- Clearing ---------------------------------------------------------------

/** How long full rows flash before they go. Long enough to SEE that it worked. */
export const FLASH_TIME = 0.38;
/** Points for clearing 1, 2, 3 or 4 rows at once, times the level. */
export const LINE_POINTS = [0, 100, 300, 500, 800] as const;

// --- BOOM mode ----------------------------------------------------------------

/**
 * Chance that a new piece carries one TNT block, and a guarantee on top: never
 * more than `TNT_PITY` pieces in a row without one. Ellie's favourite thing in
 * any game is the TNT, so a long dry spell is a bug, not bad luck.
 */
export const TNT_CHANCE = 0.32;
export const TNT_PITY = 4;

/**
 * The blast. Every cell whose squared distance from the crate is at most this
 * is cleared: 5 gives a fat 5 x 5 diamond-ish blob of 21 cells, big enough that
 * one crate visibly rips a hole in the stack.
 */
export const BLAST_R2 = 5;
/** Crates caught in a blast go off this much later, so a chain goes BOOM-BOOM-BOOM. */
export const CHAIN_DELAY = 0.16;
/** Several crates in the same cleared rows go off this far apart. */
export const ROW_TNT_STAGGER = 0.12;
/** After the last blast, a beat to watch the smoke before everything falls. */
export const BOOM_HOLD = 0.42;
/** Seconds per row while loose blocks fall into the holes. */
export const SETTLE_STEP = 0.045;
/** Points per block a blast destroys. */
export const BLAST_POINTS = 15;

// --- Topping out --------------------------------------------------------------

/**
 * There is no game over. When the stack reaches the top the raccoon gets his
 * victory dance, then the whole board goes off in one giant explosion and she
 * carries on with an empty board and her score intact. Losing turns into the
 * biggest bang in the game.
 */
export const TOPOUT_DANCE = 1.4;
/** Blasts that sweep the board, spread over this long. */
export const TOPOUT_BLASTS = 9;
export const TOPOUT_SWEEP = 1.1;
/** After the big one, a moment of empty board before the next piece. */
export const TOPOUT_REST = 0.9;
/** Levels she drops back after a top-out, so the next round starts calmer. */
export const TOPOUT_LEVEL_DROP = 2;

// --- Touch --------------------------------------------------------------------

/**
 * Gestures, in virtual px and seconds. A drag moves the piece one column per
 * `DRAG_STEP` cells of finger travel (so the piece tracks the finger), a slow
 * drag down soft-drops, a fast flick down hard-drops, and a tap rotates.
 */
export const DRAG_STEP = 0.85;
/** Movement under this is still a tap. */
export const TAP_SLOP = 12;
export const TAP_TIME = 0.32;
/**
 * A hard drop needs a real, fast, downward flick: at least this far, this
 * quickly, and mostly vertical. Accidental hard drops are the most annoying
 * thing a falling-block game can do to a child, so the bar is high.
 */
export const FLICK_MIN_DY = 56;
export const FLICK_MAX_TIME = 0.26;
export const FLICK_RATIO = 1.6;
/** A downward drag must pass this much before it starts soft-dropping. */
export const SOFT_DEADZONE = 18;

// --- Characters ---------------------------------------------------------------

/** The raccoon teases once the stack is this many rows high. */
export const TEASE_HEIGHT = 11;
/** And not more often than this, so it stays a joke. */
export const TEASE_GAP = 9;
/** Seconds of idle chatter spacing for either character. */
export const CHATTER_GAP = 4.5;
