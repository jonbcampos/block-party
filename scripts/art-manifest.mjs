/**
 * What art to generate, and the prompt for each piece.
 *
 * This file is the art direction; `generate-art.mjs` is plumbing.
 *
 * Most of the cast is NOT generated here. Ellie, the raccoon, the TNT crate and
 * the explosion flipbook are the slingshot game's own painted sheets, copied
 * across (`reused: true` below), because they are the same characters and a
 * second generation would be a slightly different girl and a slightly
 * different raccoon. The prompts that made them live in
 * ../slingshot/scripts/art-manifest.mjs; the entries here only carry the grid
 * shape the loader needs, and generate-art.mjs never redraws them.
 *
 * What IS generated is the world: the playroom behind the board, in two moods,
 * and the title picture. The blocks themselves are drawn by code
 * (src/render/blocks.ts): at 25 px a painted texture is mush and a bold flat
 * colour reads.
 *
 * Rules inherited from the siblings: one shared style paragraph; full-bleed
 * pictures are `background: 'none'`; nothing block-shaped in a background
 * that could be mistaken for part of the board.
 */

const DRAW_STYLE = [
  "children's picture book illustration, soft rounded shapes,",
  'thick clean dark outlines, flat bright colours with simple soft shading, cheerful and cosy,',
  'palette of deep plum, lavender, warm honey wood, sunny yellow and berry pink,',
  'no text, no letters, no watermark',
].join(' ');

/** A portrait room the board sits in front of: busy at the edges, calm in the middle. */
const ROOM =
  "A TALL PORTRAIT GAME BACKGROUND for a phone game: a child's cosy playroom seen straight on. " +
  'The whole MIDDLE of the picture, from top to bottom, is a calm, plain, softly lit wall with ' +
  'almost nothing on it, because the game board covers it. All the detail is pushed to the left ' +
  'and right edges and the very top and bottom: a corner of a toy shelf, a teddy bear sitting on ' +
  'a shelf, a few stuffed animals, a soft rug at the bottom, a hanging paper star. No people, no ' +
  'animals except toys, no text. No square blocks, crates or grids anywhere.';

export const PIECES = [
  // --- Reused from ../slingshot (never regenerated here) ----------------------
  {
    id: 'bandit.motion',
    reused: true,
    aspect: '4:3',
    sheet: { cols: 4, rows: 3, align: 'floor', mirrorRows: [0, 1], rowIds: ['tease', 'mood', 'run'] },
  },
  {
    id: 'ellie.motion',
    reused: true,
    aspect: '16:9',
    sheet: { cols: 4, rows: 2, align: 'floor', rowIds: ['poses', 'poses'] },
  },
  {
    id: 'tnt.motion',
    reused: true,
    aspect: '1:1',
    sheet: { cols: 2, rows: 2, align: 'center', rowIds: ['damage', 'damage'] },
  },
  {
    id: 'boom.motion',
    reused: true,
    aspect: '16:9',
    background: 'black',
    sheet: { cols: 4, rows: 2, align: 'center', rowIds: ['fx', 'fx'] },
  },

  // --- The world --------------------------------------------------------------
  {
    // Classic mode: an evening playroom, lamp-lit, calm.
    id: 'room',
    aspect: '9:16',
    size: '2K',
    background: 'none',
    subject:
      `${ROOM} Evening: a warm table lamp glow on one side, a window at the top edge showing a deep ` +
      'plum night sky with a crescent moon and a few twinkling stars. Calm and dreamy.',
  },
  {
    // BOOM mode: the same room, but the raccoons have been in. Mischief.
    id: 'room.boom',
    aspect: '9:16',
    size: '2K',
    background: 'none',
    subject:
      `${ROOM} The same playroom, but cheeky raccoon bandits have clearly been here: a few toys ` +
      'tipped over at the edges, a striped raccoon tail just disappearing behind the shelf at one ' +
      'side, scattered paper confetti, and through the window at the top edge a sky full of ' +
      'colourful fireworks bursting in orange, pink and gold. Exciting and fun, not scary.',
  },
  {
    // No characters: Ellie and the raccoon are drawn over it from their own
    // sheets, so they're the same Ellie and raccoon as in the game.
    id: 'title',
    aspect: '9:16',
    size: '2K',
    background: 'none',
    subject:
      "The cover picture of a children's phone game, TALL PORTRAIT: a cosy playroom floor at " +
      'night with a wobbly tower of colourful rounded toy blocks in red, yellow, blue, purple, green ' +
      'and orange in the lower middle, a few blocks tumbling, and a small red TNT crate with a short ' +
      'fuse sitting beside the tower. The TOP THIRD is open plain plum-coloured wall with a few ' +
      'paper stars, left EMPTY for a title. The MIDDLE band either side of the tower is empty floor ' +
      'and wall, left clear for two characters drawn on top later. No people, no animals, no text.',
  },
];

/** The full prompt for a generated piece. */
export function promptFor(piece) {
  return [piece.subject, `Style: ${DRAW_STYLE}.`].join('\n\n');
}
