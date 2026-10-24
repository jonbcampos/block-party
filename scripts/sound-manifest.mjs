/**
 * What to ask Gemini to SAY and PLAY: voice lines (text-to-speech) and music
 * (Lyria). The physical sounds (knocks, booms, toots) stay synthesised in
 * src/core/audio.ts, as in the siblings.
 *
 * Inherited from ../slingshot, where each was learned by listening:
 *  - Direction must not be spoken: only the TRANSCRIPT section of
 *    `voicePrompt` is read aloud.
 *  - "Cartoonish" means short and high. The raccoon gets a playback `rate`
 *    on top (faster = shorter AND higher), written into the sound index.
 *  - Ellie plays at natural speed, so she and the raccoon sound clearly
 *    different.
 *
 * Ellie's lines are TTS for now. When her real recordings arrive (see
 * ../ELLIE-VOICE-SCRIPT-2.md), set `recorded: true` on ELLIE so a regenerate
 * never overwrites them, and drop extra takes in as `id.2.m4a`, `id.3.m4a`.
 */

const RACCOON = {
  voice: 'Puck',
  rate: 1.35,
  profile:
    "a tiny squeaky cartoon critter from a children's TV cartoon: a mischievous little raccoon with a " +
    'high, nasal, chipmunk-like voice, silly and over the top, never mean',
};

const ELLIE = {
  voice: 'Zephyr',
  rate: 1,
  profile:
    "a little cartoon girl from a children's TV cartoon, about five years old: high, bright, squeaky " +
    'and bouncy, innocent and goofy, like an animated kid sidekick. NOT grown-up, NOT breathy, NOT ' +
    'soft or sultry: a loud happy little kid',
};

function line(id, who, style, text) {
  return { id, kind: 'voice', who, style, text };
}

export const SOUNDS = [
  // --- The raccoon ---------------------------------------------------------------
  line('r.nyah', RACCOON, 'sing-song teasing, quick', 'Nyah nyah!'),
  line('r.toohigh', RACCOON, 'gleeful teasing, sing-song', 'Too high! Too high!'),
  line('r.hehe', RACCOON, 'a short burst of giggles', 'Hee hee hee!'),
  line('r.uhoh', RACCOON, 'suddenly nervous, two quick syllables', 'Uh-oh!'),
  line('r.mytnt', RACCOON, 'indignant, squeaky', 'Hey! My TNT!'),
  line('r.whoa', RACCOON, 'blown through the air, wobbly', 'Whoaaa!'),
  line('r.nofair', RACCOON, 'whiny, dramatic', 'No fair!'),
  line('r.wewin', RACCOON, 'triumphant, sing-song', 'We win! We win!'),
  line('r.excuse', RACCOON, 'not sorry at all, right after a burp', "'Scuse me!"),
  line('r.oops', RACCOON, 'pretend-embarrassed, right after tooting', 'Oopsie!'),

  // --- Ellie (TTS for now; her real recordings replace these) ---------------------
  line('e.yay', ELLIE, 'delighted, cheering', 'Yay!'),
  line('e.wow', ELLIE, 'wide-eyed amazement, stretched out', 'Woooow!'),
  line('e.super', ELLIE, 'thrilled, proud of herself', 'Super!'),
  line('e.takethat', ELLIE, 'bold, playful', 'Take that!'),
  line('e.kaboom', ELLIE, 'thrilled, shouting', 'KABOOM!'),
  line('e.boomboom', ELLIE, 'excited, bouncing, quick', 'Boom boom boom!'),
  line('e.ooh', ELLIE, 'excited, a little mischievous', 'Ooh, TNT!'),
  line('e.faster', ELLIE, 'excited, ready for a challenge', 'Faster!'),
  line('e.again', ELLIE, 'eager, jumping up', 'Again!'),
  line('e.letsgo', ELLIE, 'eager, determined', "Let's go!"),
  line('e.nyah', ELLIE, 'teasing right back, playful', 'Nyah nyah!'),
  line('e.hmph', ELLIE, 'pretend-grumpy, playful', 'Hmph!'),
  line('e.ew', ELLIE, 'grossed out but laughing', 'Ew, stinky!'),
  line('e.ohno', ELLIE, 'disappointed but cheerful', 'Oh no!'),

  // --- Music (Lyria) -----------------------------------------------------------------
  {
    id: 'music.title',
    kind: 'music',
    prompt:
      "A bright, bouncy title theme for a children's cartoon puzzle game about stacking colourful toy " +
      'blocks in a cosy playroom at night: plinky toy piano, glockenspiel, pizzicato strings, a ' +
      'cheeky clarinet hinting at sneaky raccoons, 108 bpm. Steady the whole way through: no long ' +
      'intro, no ending, no fade-out. Instrumental, no vocals.',
  },
  {
    id: 'music.play',
    kind: 'music',
    prompt:
      "Cheerful, steady, toe-tapping background music for a children's falling-block puzzle game: " +
      'marimba and toy piano melody, soft plucky bass, light shaker and brushed drums, playful and ' +
      'focused, 118 bpm. Gentle enough to play under sound effects. A steady groove the whole way ' +
      'through: no intro, no build-up, no ending and no fade-out, so it can loop. Instrumental, no vocals.',
  },
  {
    id: 'music.boom',
    kind: 'music',
    prompt:
      "Exciting, mischievous, bouncy background music for a children's cartoon game full of TNT " +
      'explosions: punchy cartoon brass stabs, plucky bass, bongos and a snappy snare, a sneaky ' +
      'raccoon-heist feel, 126 bpm. Fun, never scary. Gentle enough to play under explosions. A ' +
      'steady groove the whole way through: no intro, no ending and no fade-out, so it can loop. ' +
      'Instrumental, no vocals.',
  },
];

/** The TTS prompt. Only the TRANSCRIPT section is spoken. */
export function voicePrompt(s) {
  return [
    `# AUDIO PROFILE: ${s.who.profile}`,
    "## DIRECTOR'S NOTES",
    `Style: ${s.style}. Cartoon voice acting, short, punchy and high-pitched.`,
    '#### TRANSCRIPT',
    s.text,
  ].join('\n');
}
