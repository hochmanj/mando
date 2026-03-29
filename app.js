// Guitar string open note MIDI values (low to high)
const GUITAR_TUNING = {
  E: 40, // E2
  A: 45, // A2
  D: 50, // D3
  G: 55, // G3
  B: 59, // B3
  e: 64, // E4
};

// Standard tuning as array [E2, A2, D3, G3, B3, E4] (low to high)
const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];
const MIDI_NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
function midiToNoteName(midi) { return MIDI_NOTE_NAMES[midi % 12]; }

// Note name → MIDI semitone (within octave)
const NOTE_SEMITONES = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

// Named tunings (low to high, 6 strings)
const NAMED_TUNINGS = {
  "standard":     [40, 45, 50, 55, 59, 64], // E A D G B E
  "drop d":       [38, 45, 50, 55, 59, 64], // D A D G B E
  "open g":       [38, 43, 50, 55, 59, 62], // D G D G B D
  "open d":       [38, 45, 50, 54, 57, 62], // D A D F# A D
  "open e":       [40, 47, 52, 56, 59, 64], // E B E G# B E
  "open a":       [40, 45, 52, 57, 61, 64], // E A E A C# E
  "open c":       [36, 43, 48, 55, 60, 64], // C G C G C E
  "dadgad":       [38, 45, 50, 55, 57, 62], // D A D G A D
  "half step down":[39, 44, 49, 54, 58, 63], // Eb Ab Db Gb Bb Eb
  "full step down":[38, 43, 48, 53, 57, 62], // D G C F A D
  "drop c":       [36, 43, 48, 55, 59, 64], // C G C F A D — actually drop C is C G C F A D
  "drop c#":      [37, 44, 49, 54, 58, 63], // C# G# C# F# A# D#
  "drop b":       [35, 42, 47, 54, 58, 63], // B F# B E G# C#
};

// Detect tuning from tab text, returns array of 6 MIDI values (low to high) or null
function detectTuning(text) {
  // Match "Tuning: <name>" or "Tuning = <name>"
  const namedMatch = text.match(/tuning[\s:=]+([a-z][a-z\s#]+)/im);
  if (namedMatch) {
    const name = namedMatch[1].trim().toLowerCase();
    if (NAMED_TUNINGS[name]) return NAMED_TUNINGS[name];
  }

  // Match "Tuning: D A D G B E" or "Tuning: Eb Ab Db Gb Bb Eb" (6 note names)
  const noteListMatch = text.match(/tuning[\s:=]+([A-Ga-g][b#]?(?:\d)?(?:\s+[A-Ga-g][b#]?(?:\d)?){5})\s/im);
  if (noteListMatch) {
    const noteNames = noteListMatch[1].trim().split(/\s+/);
    if (noteNames.length === 6) {
      return noteNamesToMidi(noteNames);
    }
  }

  // Match "Drop D" anywhere in the text (common shorthand)
  if (/\bdrop\s*d\b/i.test(text)) return NAMED_TUNINGS["drop d"];
  if (/\bdrop\s*c#?\b/i.test(text)) {
    return /\bdrop\s*c#/i.test(text) ? NAMED_TUNINGS["drop c#"] : NAMED_TUNINGS["drop c"];
  }
  if (/\bdrop\s*b\b/i.test(text)) return NAMED_TUNINGS["drop b"];
  if (/\bopen\s*g\b/i.test(text)) return NAMED_TUNINGS["open g"];
  if (/\bopen\s*d\b/i.test(text)) return NAMED_TUNINGS["open d"];
  if (/\bopen\s*e\b/i.test(text)) return NAMED_TUNINGS["open e"];
  if (/\bopen\s*a\b/i.test(text)) return NAMED_TUNINGS["open a"];
  if (/\bopen\s*c\b/i.test(text)) return NAMED_TUNINGS["open c"];
  if (/\bdadgad\b/i.test(text)) return NAMED_TUNINGS["dadgad"];
  if (/\bhalf\s*step\s*down\b/i.test(text)) return NAMED_TUNINGS["half step down"];
  if (/\bfull\s*step\s*down\b/i.test(text)) return NAMED_TUNINGS["full step down"];
  if (/\bEb\s*tuning\b/i.test(text)) return NAMED_TUNINGS["half step down"];

  return null;
}

// Convert 6 note names to MIDI values (low to high), guessing octaves
function noteNamesToMidi(names) {
  const midi = [];
  for (let i = 0; i < names.length; i++) {
    const match = names[i].match(/^([A-Ga-g][b#]?)(\d)?$/);
    if (!match) return null;
    const noteName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    const semitone = NOTE_SEMITONES[noteName];
    if (semitone === undefined) return null;

    if (match[2]) {
      // Explicit octave
      midi.push(semitone + (parseInt(match[2], 10) + 1) * 12);
    } else {
      // Guess octave based on position: strings go low to high
      // Use standard tuning octaves as reference
      const refMidi = STANDARD_TUNING[i];
      // Find the closest octave to the standard tuning for this string position
      let best = semitone + 2 * 12; // Start at octave 2
      for (let oct = 1; oct <= 5; oct++) {
        const candidate = semitone + oct * 12;
        if (Math.abs(candidate - refMidi) < Math.abs(best - refMidi)) {
          best = candidate;
        }
      }
      midi.push(best);
    }
  }
  return midi;
}

// Mandolin string open note MIDI values (low to high)
const MANDOLIN_TUNING = [
  { name: "G", midi: 55 }, // G3
  { name: "D", midi: 62 }, // D4
  { name: "A", midi: 69 }, // A4
  { name: "E", midi: 76 }, // E5
];

const MAX_MANDOLIN_FRET = 15;
const MAX_FRET_SPAN = 6;
const ARTIC_CHARS = new Set(["h", "p", "/", "\\", "~", "s", "b"]);

// ── Mandolin Chord Dictionary ─────────────────────────────────────────
// Fret arrays are [G, D, A, E] (low to high)
const MANDOLIN_CHORDS = {
  // Major
  G:   [0, 0, 2, 3],
  C:   [0, 2, 3, 0],
  D:   [2, 0, 0, 2],
  A:   [2, 2, 0, 2],
  E:   [4, 2, 0, 0],
  F:   [5, 3, 0, 1],
  B:   [4, 4, 2, 0],
  Bb:  [3, 3, 1, 3],
  Eb:  [3, 1, 1, 3],
  Ab:  [1, 1, 3, 4],
  Db:  [1, 3, 4, 1],
  "F#":[2, 4, 4, 2],
  Gb:  [2, 4, 4, 2],

  // Minor
  Em:  [0, 2, 0, 0],
  Am:  [2, 2, 0, 1],
  Dm:  [2, 0, 0, 1],
  Bm:  [4, 4, 2, 0],
  Gm:  [0, 0, 1, 3],
  Cm:  [0, 1, 3, 0],
  Fm:  [5, 3, 0, 0],
  Abm: [1, 1, 2, 4],
  Ebm: [3, 1, 1, 2],
  Bbm: [3, 3, 1, 2],
  "F#m":[2, 4, 4, 1],
  "C#m":[1, 2, 4, 0],
  Dbm: [1, 1, 2, 4],

  // 7th
  G7:  [0, 0, 2, 1],
  C7:  [0, 2, 1, 0],
  D7:  [2, 0, 0, 1],
  A7:  [2, 2, 0, 0],
  E7:  [4, 2, 0, 2],
  B7:  [4, 2, 1, 0],
  F7:  [5, 3, 4, 1],
  Bb7: [3, 3, 1, 1],
  Eb7: [3, 1, 1, 1],
  Ab7: [1, 1, 3, 2],
  Db7: [1, 3, 2, 1],

  // maj7
  Gmaj7: [0, 0, 2, 2],
  Cmaj7: [0, 2, 0, 0],
  Dmaj7: [2, 0, 0, 4],
  Amaj7: [2, 2, 4, 1],
  Fmaj7: [5, 3, 0, 0],
  Emaj7: [4, 2, 0, 4],
  Bbmaj7:[3, 0, 0, 1],
  Ebmaj7:[3, 1, 5, 3],
  Abmaj7:[1, 1, 3, 3],

  // m7
  Em7:  [0, 2, 0, 2],
  Am7:  [2, 2, 0, 0],
  Dm7:  [2, 0, 0, 0],
  Bm7:  [4, 2, 2, 0],
  Gm7:  [0, 0, 1, 1],
  Cm7:  [0, 1, 1, 3],
  Fm7:  [1, 1, 3, 1],
  Bbm7: [3, 1, 1, 1],
  Ebm7: [3, 1, 1, 0],

  // 6th
  G6:  [0, 0, 2, 0],
  C6:  [5, 2, 0, 0],
  D6:  [2, 0, 2, 2],
  A6:  [2, 2, 4, 2],
  E6:  [4, 2, 0, 4],
  F6:  [5, 3, 0, 3],
  B6:  [4, 1, 2, 4],
  Bb6: [3, 3, 1, 0],
  Ab6: [1, 1, 3, 1],

  // m6
  Gm6: [0, 0, 1, 0],
  Am6: [2, 2, 0, 4],
  Dm6: [2, 0, 0, 4],
  Fm6: [1, 0, 3, 1],
  Em6: [0, 2, 0, 4],

  // sus2
  Gsus2: [0, 0, 2, 0],
  Csus2: [0, 0, 3, 0],
  Dsus2: [2, 0, 0, 0],
  Asus2: [2, 2, 0, 0],
  Esus2: [4, 2, 0, 2],
  Fsus2: [5, 3, 0, 3],
  Bbsus2:[3, 3, 1, 0],
  Ebsus2:[3, 1, 1, 0],
  Absus2:[1, 1, 3, 1],
  Dbsus2:[1, 1, 4, 4],
  Db2:   [1, 1, 4, 4],
  D2:    [2, 0, 0, 0],

  // sus4
  Gsus4: [0, 0, 0, 3],
  Csus4: [0, 3, 3, 1],
  Dsus4: [2, 0, 0, 3],
  Asus4: [2, 2, 0, 3],
  Esus4: [4, 2, 0, 5],
  Bbsus4:[3, 3, 4, 3],
  Ebsus4:[1, 1, 1, 4],

  // dim
  Bdim:  [4, 2, 0, 1],
  Cdim:  [2, 1, 0, 1],
  Ddim:  [2, 0, 3, 1],
  Edim:  [0, 2, 0, 1],
  Fdim:  [1, 0, 3, 1],
  Gdim:  [0, 4, 1, 0],
  Abdim: [1, 1, 0, 1],

  // dim7
  Bdim7: [4, 2, 0, 1],
  Cdim7: [2, 1, 3, 2],
  Ddim7: [2, 0, 3, 4],
  Edim7: [0, 2, 0, 1],
  Fdim7: [1, 0, 3, 4],
  Gdim7: [0, 4, 3, 0],
  Abdim7:[1, 1, 0, 1],

  // aug
  Caug:  [0, 3, 3, 0],
  Gaug:  [0, 1, 2, 3],
  Daug:  [2, 0, 3, 2],
  Eaug:  [4, 2, 3, 0],
  Faug:  [5, 3, 3, 1],
  Aaug:  [2, 2, 3, 2],
  Baug:  [4, 4, 3, 0],
  Bbaug: [3, 3, 2, 3],
};

// Enharmonic equivalents for chord lookup fallback
const ENHARMONIC = {
  "A#": "Bb", "Bb": "A#",
  "C#": "Db", "Db": "C#",
  "D#": "Eb", "Eb": "D#",
  "F#": "Gb", "Gb": "F#",
  "G#": "Ab", "Ab": "G#",
};

function lookupMandolinChord(name) {
  if (MANDOLIN_CHORDS[name]) return MANDOLIN_CHORDS[name];

  // Try enharmonic: extract root (1-2 chars) and quality
  const match = name.match(/^([A-G][b#]?)(.*)/);
  if (match) {
    const [, root, quality] = match;
    const altRoot = ENHARMONIC[root];
    if (altRoot && MANDOLIN_CHORDS[altRoot + quality]) {
      return MANDOLIN_CHORDS[altRoot + quality];
    }
  }

  // Slash chords: use the base chord (bass note irrelevant on mandolin)
  const slashMatch = name.match(/^(.+)\/[A-G][b#]?$/);
  if (slashMatch) {
    return lookupMandolinChord(slashMatch[1]);
  }

  return null;
}

// ── ASCII Chord Diagram Renderer ──────────────────────────────────────
function renderChordDiagram(chordName, frets) {
  // frets: [G, D, A, E] — 4 values, 0 = open, null/undefined = muted
  const fretted = frets.filter((f) => f !== null && f !== undefined && f > 0);
  const maxFret = fretted.length > 0 ? Math.max(...fretted) : 0;
  const minFret = fretted.length > 0 ? Math.min(...fretted) : 1;

  let startFret, showNut;
  if (maxFret <= 4) {
    startFret = 1;
    showNut = true;
  } else if (minFret <= 1) {
    startFret = 1;
    showNut = true;
  } else {
    startFret = minFret;
    showNut = false;
  }

  const numFrets = Math.max(3, maxFret - startFret + 1);
  const lines = [];

  // Chord name centered over diagram (7 chars wide)
  const pad = Math.max(0, Math.floor((7 - chordName.length) / 2));
  lines.push(" ".repeat(pad) + chordName);

  // Open / muted indicators above nut
  let openLine = "";
  for (let s = 0; s < 4; s++) {
    if (frets[s] === 0) openLine += "o";
    else if (frets[s] === null || frets[s] === undefined) openLine += "x";
    else openLine += " ";
    if (s < 3) openLine += " ";
  }
  lines.push(openLine);

  // Nut or top bar (4 spurs for 4 strings)
  lines.push(showNut ? "\u2554\u2550\u2566\u2550\u2566\u2550\u2557" : "\u250C\u2500\u252C\u2500\u252C\u2500\u2510");
  // ╔═╦═╦═╗ or ┌─┬─┬─┐

  // Cell rows with fret separators between them
  for (let f = 0; f < numFrets; f++) {
    const fretNum = startFret + f;

    // Cell row: ● replaces │ on pressed strings
    let cell = "";
    for (let s = 0; s < 4; s++) {
      cell += (frets[s] === fretNum) ? "\u25CF" : "\u2502"; // ● or │
      if (s < 3) cell += " ";
    }

    // Position marker for chords up the neck
    if (!showNut && f === 0) {
      cell += " " + startFret + "fr";
    }

    lines.push(cell);

    // Fret separator between cells (not after last)
    if (f < numFrets - 1) {
      lines.push("\u251C\u2500\u253C\u2500\u253C\u2500\u2524"); // ├─┼─┼─┤
    }
  }

  // Bottom bar
  lines.push(showNut ? "\u255A\u2550\u2569\u2550\u2569\u2550\u255D" : "\u2514\u2500\u2534\u2500\u2534\u2500\u2518");
  // ╚═╩═╩═╝ or └─┴─┴─┘

  return lines.join("\n");
}

// ── Line Classifiers ──────────────────────────────────────────────────
function isTabLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Format 1: optional leading pipe + label + optional markers ({, |, :, ., *, space) + pipe + tab content
  // e.g., E|---, e-|---, E{|---, E||---, G||.---, E |---, |E|---
  if (/^\|?[A-Ga-g][#b]?[\s\-{}.:|*]*\|.*[-0-9xXhHpP\/\\~()^<>:]/.test(trimmed)) return true;
  // Format 2: label + dashes or frets (no pipe)
  // e.g., E-------, B-5----3---, E3\5-6-6\8---
  if (/^[A-Ga-g][#b]?[-0-9][-0-9xXhHpPsS\/\\~()^<>|:*]/.test(trimmed) && trimmed.length >= 8) return true;
  // Format 3: no label, pipe(s) + tab content (NOT annotations with spaces)
  // e.g., |---0---, ||---17---, ||*---5---
  if (/^\|[|:*]*[-0-9xXhHpP\/\\~()^<>]/.test(trimmed)) return true;
  // Format 4: no label, no pipe — line of dashes/frets/articulations only
  // e.g., ---5h7---10---|, -----------------|
  // Must be mostly dashes (>50%) and contain only tab characters
  if (/^[-0-9|xXhHpPsS\/\\~()^<>:*]+$/.test(trimmed)) {
    const dashes = (trimmed.match(/-/g) || []).length;
    if (dashes / trimmed.length > 0.4 && trimmed.length >= 8) return true;
  }
  return false;
}

const CHORD_PATTERN =
  /^[A-G][b#]?(m|min|maj|dim|aug|sus[24]?|add|M|[Mm]aj)?(\d+)?([b#]\d+)*(\/[A-G][b#]?)?\??$/;

// Patterns to skip in chord lines: time signatures (3/4, 4/4) and measure numbers (#1, #5)
const CHORD_SKIP_PATTERN = /^(\d+\/\d+|#\d+)$/;

function isChordLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return false;
  // Filter out time signatures and measure numbers, then check if rest are chords
  const chordTokens = tokens.filter((t) => !CHORD_SKIP_PATTERN.test(t));
  if (chordTokens.length === 0) return false;
  return chordTokens.every((t) => CHORD_PATTERN.test(t));
}

function parseChordPositions(line) {
  const chords = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    // Skip time signatures (3/4, 4/4) and measure numbers (#1, #5)
    if (CHORD_SKIP_PATTERN.test(m[0])) continue;
    chords.push({ name: m[0], position: m.index });
  }
  return chords;
}

// ── Capo Detection ────────────────────────────────────────────────────
function detectCapo(text) {
  // Match patterns like: Capo 3, Capo: 5, capo on 2nd fret, Capo 1st fret, capo=4
  const match = text.match(/capo[\s:=]*(?:on\s+)?(\d+)(?:st|nd|rd|th)?(?:\s+fret)?/i);
  return match ? parseInt(match[1], 10) : 0;
}

// ── Guitar Tab Parser → IR ────────────────────────────────────────────
function parseGuitarTab(text) {
  const lines = text.split("\n");
  const blocks = [];
  const warnings = [];
  let tabBuffer = [];
  let pendingChords = null;
  const capo = detectCapo(text);
  const tuning = detectTuning(text);

  function flushPendingChords() {
    if (pendingChords) {
      blocks.push({ type: "chordlyric", chords: pendingChords, lyrics: "" });
      pendingChords = null;
    }
  }

  function flushTabBuffer() {
    if (tabBuffer.length === 0) {
      flushPendingChords();
      return;
    }
    if (tabBuffer.length !== 6) {
      warnings.push(
        `Found a tab section with ${tabBuffer.length} lines instead of 6. Skipping.`
      );
      flushPendingChords();
      tabBuffer = [];
      return;
    }
    const parsed = parseSection(tabBuffer);
    if (parsed.error) {
      warnings.push(parsed.error);
      flushPendingChords();
    } else {
      blocks.push({
        type: "tab",
        events: parsed.events,
        chords: pendingChords || null,
        inputFirstLine: tabBuffer[0],
      });
      pendingChords = null;
    }
    tabBuffer = [];
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isTabLine(line)) {
      tabBuffer.push(line);
      i++;
      continue;
    }

    // Not a tab line — flush any accumulated tab
    flushTabBuffer();

    // Blank line → text pass-through
    if (!trimmed) {
      blocks.push({ type: "text", content: "" });
      i++;
      continue;
    }

    // Check for chord+lyrics pair
    if (isChordLine(line)) {
      const chords = parseChordPositions(line);
      const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
      // Chord line immediately before tab → link them
      if (nextLine !== undefined && isTabLine(nextLine)) {
        pendingChords = chords;
        i++;
        continue;
      }
      // If next line is NOT a chord line and NOT a tab line, treat it as lyrics
      if (
        nextLine !== undefined &&
        !isTabLine(nextLine) &&
        !isChordLine(nextLine)
      ) {
        blocks.push({ type: "chordlyric", chords, lyrics: nextLine });
        i += 2;
      } else {
        blocks.push({ type: "chordlyric", chords, lyrics: "" });
        i++;
      }
      continue;
    }

    // Plain text (section headers, etc.)
    blocks.push({ type: "text", content: line });
    i++;
  }

  flushTabBuffer();

  if (capo > 0) {
    warnings.push(`Capo ${capo} detected — mandolin tab transposed up ${capo} semitone${capo > 1 ? "s" : ""} to match actual pitch.`);
  }
  if (tuning) {
    const noteNames = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
    const tuningStr = tuning.map((m) => noteNames[m % 12]).join(" ");
    warnings.push(`Non-standard tuning detected: ${tuningStr} — conversion adjusted.`);
  }

  return { blocks, warnings, capo, tuning };
}

// Identify guitar string from label
function identifyGuitarString(label) {
  const cleaned = label.trim().toLowerCase();
  if (cleaned === "e" || cleaned === "e1") return null;
  if (cleaned === "b") return "B";
  if (cleaned === "g") return "G";
  if (cleaned === "d") return "D";
  if (cleaned === "a") return "A";
  return null;
}

// Parse a 6-line section into events (notes + bars)
function parseSection(lines) {
  const stringOrder = ["e", "B", "G", "D", "A", "E"];

  const stringData = lines.map((line) => {
    const trimmed = line.trim();
    // Format 1: optional leading pipe + label + optional markers ({, |, :, ., *, space, -) + pipe + content
    // e.g., E|---, E{|---, E||---, G||.---, E |---, |E|---
    let match = trimmed.match(/^\|?([A-Ga-g][#b]?)[\s\-{}.:|*]*\|(.*)/);
    if (match) return { label: match[1], content: match[2] };
    // Format 2: label + dashes or frets (no pipe)
    match = trimmed.match(/^([A-Ga-g][#b]?)([-0-9][-0-9xXhHpPsS\/\\~()^<>|:*].*)/);
    if (match) return { label: match[1], content: match[2] };
    // Format 3: no label, strip first pipe, keep rest as content
    match = trimmed.match(/^\|(.*)/);
    if (match) return { label: "", content: match[1] };
    // Format 4: no label, no pipe — entire line is tab content
    if (/^[-0-9|xXhHpPsS\/\\~()^<>:*]+$/.test(trimmed)) {
      return { label: "", content: trimmed };
    }
    return { label: "", content: "" };
  });

  const strings = stringData.map((sd, idx) => ({
    name: stringOrder[idx],
    content: sd.content,
  }));

  const maxLen = Math.max(...strings.map((s) => s.content.length));
  const events = [];

  let i = 0;
  while (i < maxLen) {
    // Check if all strings have | at this position → bar event
    const allBar = strings.every(
      (s) => i < s.content.length && s.content[i] === "|"
    );
    if (allBar) {
      events.push({ type: "bar" });
      i++;
      continue;
    }

    const column = {};
    const suffixes = {};
    let hasNote = false;
    let maxAdvance = 1;

    for (const s of strings) {
      const ch = s.content[i];
      if (ch >= "0" && ch <= "9") {
        let numStr = ch;
        let j = i + 1;
        while (
          j < s.content.length &&
          s.content[j] >= "0" &&
          s.content[j] <= "9"
        ) {
          numStr += s.content[j];
          j++;
        }
        column[s.name] = parseInt(numStr, 10);
        // Peek for articulation suffix after the fret number
        const nextCh = s.content[i + numStr.length];
        if (nextCh && ARTIC_CHARS.has(nextCh)) {
          suffixes[s.name] = nextCh;
        }
        hasNote = true;
        maxAdvance = Math.max(maxAdvance, numStr.length);
      } else if (ch === "x" || ch === "X") {
        column[s.name] = "x";
      } else {
        column[s.name] = null;
      }
    }

    if (hasNote) {
      events.push({ type: "notes", column, suffixes });
    }
    i += maxAdvance;
  }

  return { events };
}

// ── MIDI / String Assignment ──────────────────────────────────────────
function midiToMandolinOptions(midi) {
  const options = [];
  for (const ms of MANDOLIN_TUNING) {
    const fret = midi - ms.midi;
    if (fret >= 0 && fret <= MAX_MANDOLIN_FRET) {
      options.push({ string: ms.name, fret });
    }
  }
  return options;
}

function assignNotesToStrings(noteOptions, prevFret = null) {
  let bestAssignment = null;
  let bestScore = null;

  function scoreAssignment(assignment) {
    const placed = assignment.filter((a) => a !== null);
    const stringsUsed = new Set(placed.map((a) => a.string)).size;
    const fretSum = placed.reduce((sum, a) => sum + a.fret, 0);
    const fretted = placed.filter((a) => a.fret > 0).map((a) => a.fret);
    const span = fretted.length > 1
      ? Math.max(...fretted) - Math.min(...fretted)
      : 0;
    // Melody distance: how far this single note is from the previous note
    const melodyDistance =
      prevFret !== null && placed.length === 1
        ? Math.abs(placed[0].fret - prevFret)
        : 0;
    const openCount = placed.filter((a) => a.fret === 0).length;
    return { withinSpan: span <= MAX_FRET_SPAN, strings: stringsUsed, melodyDistance, openCount, fretSum };
  }

  function isBetter(score) {
    if (!bestScore) return true;
    // 1. Prefer assignments that fit within the fret span
    if (score.withinSpan && !bestScore.withinSpan) return true;
    if (!score.withinSpan && bestScore.withinSpan) return false;
    // 2. Maximize strings used
    if (score.strings > bestScore.strings) return true;
    if (score.strings < bestScore.strings) return false;
    // 3. Prefer open strings
    if (score.openCount > bestScore.openCount) return true;
    if (score.openCount < bestScore.openCount) return false;
    // 4. Minimize total fret distance (prefer lower frets / avoid climbing high on one string)
    if (score.fretSum < bestScore.fretSum) return true;
    if (score.fretSum > bestScore.fretSum) return false;
    // 5. Minimize melody distance from previous note
    if (score.melodyDistance < bestScore.melodyDistance) return true;
    if (score.melodyDistance > bestScore.melodyDistance) return false;
    return false;
  }

  function backtrack(idx, assignment, usedStrings) {
    if (idx === noteOptions.length) {
      const score = scoreAssignment(assignment);
      if (isBetter(score)) {
        bestScore = score;
        bestAssignment = [...assignment];
      }
      return;
    }

    const note = noteOptions[idx];
    for (const opt of note.options) {
      if (!usedStrings.has(opt.string)) {
        assignment[idx] = opt;
        usedStrings.add(opt.string);
        backtrack(idx + 1, assignment, usedStrings);
        usedStrings.delete(opt.string);
      }
    }
    assignment[idx] = null;
    backtrack(idx + 1, assignment, usedStrings);
  }

  backtrack(0, new Array(noteOptions.length).fill(null), new Set());
  return bestAssignment;
}

// Convert guitar events to mandolin events
function convertToMandolin(events, capo, tuning, transpose) {
  capo = capo || 0;
  transpose = transpose || 0;
  // Build tuning lookup: string name → MIDI value
  const stringOrder = ["E", "A", "D", "G", "B", "e"];
  const activeTuning = {};
  if (tuning && tuning.length === 6) {
    for (let i = 0; i < 6; i++) activeTuning[stringOrder[i]] = tuning[i];
  } else {
    for (const key of stringOrder) activeTuning[key] = GUITAR_TUNING[key];
  }
  const results = [];
  const warnings = [];
  const minMandolin = MANDOLIN_TUNING[0].midi; // G3 = 55

  // First pass: find the lowest MIDI note across all events in this section
  let lowestMidi = Infinity;
  for (const event of events) {
    if (event.type !== "notes") continue;
    for (const [guitarString, fret] of Object.entries(event.column)) {
      if (fret === null || fret === "x") continue;
      const openMidi = activeTuning[guitarString];
      if (openMidi === undefined) continue;
      const midi = openMidi + capo + fret + transpose;
      if (midi < lowestMidi) lowestMidi = midi;
    }
  }

  // Compute a uniform octave shift so the lowest note fits mandolin range
  let octaveShift = 0;
  if (lowestMidi !== Infinity && lowestMidi < minMandolin) {
    while (lowestMidi + octaveShift < minMandolin) {
      octaveShift += 12;
    }
    const oct = octaveShift / 12;
    warnings.push(
      `Section transposed up ${oct} octave${oct > 1 ? "s" : ""} to fit mandolin range (intervals preserved).`
    );
  }

  // Second pass: convert all notes with the uniform shift
  let noteIndex = 0;
  let prevFret = null;
  for (const event of events) {
    if (event.type === "bar") {
      results.push({ type: "bar" });
      continue;
    }

    const col = event.column;
    const noteOptions = [];
    noteIndex++;

    for (const [guitarString, fret] of Object.entries(col)) {
      if (fret === null || fret === "x") continue;

      const openMidi = activeTuning[guitarString];
      if (openMidi === undefined) continue;

      const midi = openMidi + capo + fret + transpose + octaveShift;

      const options = midiToMandolinOptions(midi);
      if (options.length > 0) {
        noteOptions.push({ midi, options, source: { guitarString, fret } });
      } else {
        warnings.push(
          `Column ${noteIndex}: Note on guitar string ${guitarString} fret ${fret} (MIDI ${midi}) is out of mandolin range. Dropped.`
        );
      }
    }

    const uniqueByMidi = [];
    const seenMidi = new Set();
    for (const n of noteOptions) {
      if (!seenMidi.has(n.midi)) {
        seenMidi.add(n.midi);
        uniqueByMidi.push(n);
      }
    }
    uniqueByMidi.sort((a, b) => a.options.length - b.options.length);

    const isMelody = uniqueByMidi.length === 1;
    const mandoCol = { G: null, D: null, A: null, E: null };
    const mandoSuffixes = {};
    const assignment = assignNotesToStrings(uniqueByMidi, isMelody ? prevFret : null);
    if (assignment) {
      let placedFret = null;
      for (let ai = 0; ai < assignment.length; ai++) {
        const a = assignment[ai];
        if (a !== null) {
          mandoCol[a.string] = a.fret;
          placedFret = a.fret;
          // Carry articulation suffix from guitar string to mandolin string
          const gStr = uniqueByMidi[ai].source.guitarString;
          if (event.suffixes && event.suffixes[gStr]) {
            mandoSuffixes[a.string] = event.suffixes[gStr];
          }
        }
      }
      prevFret = isMelody && placedFret !== null ? placedFret : null;
    } else {
      prevFret = null;
    }

    results.push({ type: "notes", column: mandoCol, suffixes: mandoSuffixes });
  }

  return { events: results, warnings };
}

// Format mandolin events back into tab notation (with bar lines)
function formatMandolinTab(events) {
  const stringOrder = ["E", "A", "D", "G"];

  // Compute max fret width from note events only
  const noteColumns = events
    .filter((e) => e.type === "notes")
    .map((e) => e.column);
  const maxFretWidth = getMaxFretWidth(noteColumns);

  const lines = {};
  for (const s of stringOrder) {
    lines[s] = `${s}|`;
  }

  const cellWidth = maxFretWidth + 1;

  for (const event of events) {
    if (event.type === "bar") {
      for (const s of stringOrder) {
        lines[s] += "|";
      }
      continue;
    }

    const col = event.column;
    const suf = event.suffixes || {};
    for (const s of stringOrder) {
      const fret = col[s];
      if (fret !== null && fret !== undefined) {
        const fretStr = fret.toString();
        const suffix = suf[s] || "";
        lines[s] += (fretStr + suffix).padEnd(cellWidth, "-");
      } else {
        lines[s] += "-".repeat(cellWidth);
      }
    }
  }

  for (const s of stringOrder) {
    lines[s] += "|";
  }

  return stringOrder.map((s) => lines[s]).join("\n");
}

function getMaxFretWidth(columns) {
  let max = 1;
  for (const col of columns) {
    for (const val of Object.values(col)) {
      if (val !== null && val !== undefined) {
        max = Math.max(max, val.toString().length);
      }
    }
  }
  return max;
}

// ── Rendering ─────────────────────────────────────────────────────────
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function joinDiagramsSideBySide(diagrams, gap = 2, maxWidth = 72) {
  const split = diagrams.map((d) => d.split("\n"));
  const widths = split.map((lines) =>
    Math.max(...lines.map((l) => l.length))
  );
  const spacer = " ".repeat(gap);

  // Group diagrams into rows that fit within maxWidth
  const groups = [];
  let groupStart = 0;
  let lineWidth = 0;
  for (let d = 0; d < diagrams.length; d++) {
    const added = (lineWidth === 0) ? widths[d] : lineWidth + gap + widths[d];
    if (added > maxWidth && lineWidth > 0) {
      groups.push({ start: groupStart, end: d });
      groupStart = d;
      lineWidth = widths[d];
    } else {
      lineWidth = added;
    }
  }
  groups.push({ start: groupStart, end: diagrams.length });

  // Render each group side-by-side, join groups with a blank line
  const groupTexts = groups.map(({ start, end }) => {
    const groupSplit = split.slice(start, end);
    const groupWidths = widths.slice(start, end);
    const maxLines = Math.max(...groupSplit.map((lines) => lines.length));
    const rows = [];
    for (let i = 0; i < maxLines; i++) {
      const parts = groupSplit.map((lines, di) =>
        (lines[i] || "").padEnd(groupWidths[di])
      );
      rows.push(parts.join(spacer).trimEnd());
    }
    return rows.join("\n");
  });

  return groupTexts.join("\n\n");
}

function renderTabBlock(events, chords, inputFirstLine) {
  const tab = formatMandolinTab(events);
  let html = "";

  // If chords are linked to this tab section, align them to the output
  if (chords && chords.length > 0 && inputFirstLine) {
    const outputFirstLine = tab.split("\n")[0];
    const aligned = alignChordsToTab(chords, inputFirstLine, outputFirstLine);
    let chordStr = "";
    for (const ch of aligned) {
      while (chordStr.length < ch.position) chordStr += " ";
      chordStr += ch.name;
    }
    html += `<pre class="tab-chords"><span class="chord-names">${escapeHtml(chordStr)}</span></pre>`;
  }

  html += `<pre class="tab-block">${escapeHtml(tab)}</pre>`;
  return html;
}

function alignChordsToTab(chords, inputFirstLine, outputFirstLine) {
  // Find | positions in input and output tab lines
  const inputBars = [];
  for (let i = 0; i < inputFirstLine.length; i++) {
    if (inputFirstLine[i] === "|") inputBars.push(i);
  }
  const outputBars = [];
  for (let i = 0; i < outputFirstLine.length; i++) {
    if (outputFirstLine[i] === "|") outputBars.push(i);
  }

  const aligned = chords.map((chord) => {
    // Find which bar segment this chord falls in
    let segIdx = 0;
    for (let b = 0; b < inputBars.length; b++) {
      if (inputBars[b] <= chord.position) segIdx = b;
      else break;
    }
    // Proportional position within the segment
    const segStart = inputBars[segIdx] || 0;
    const segEnd =
      segIdx + 1 < inputBars.length
        ? inputBars[segIdx + 1]
        : inputFirstLine.length;
    const fraction =
      segEnd > segStart ? (chord.position - segStart) / (segEnd - segStart) : 0;

    // Map to the same segment in output
    const outStart =
      segIdx < outputBars.length ? outputBars[segIdx] : 0;
    const outEnd =
      segIdx + 1 < outputBars.length
        ? outputBars[segIdx + 1]
        : outputFirstLine.length;
    const outPos = Math.round(outStart + fraction * (outEnd - outStart));
    return { name: chord.name, position: outPos };
  });

  // Enforce minimum spacing: each chord must start after the previous one ends
  for (let i = 1; i < aligned.length; i++) {
    const minPos = aligned[i - 1].position + aligned[i - 1].name.length + 1;
    if (aligned[i].position < minPos) {
      aligned[i].position = minPos;
    }
  }

  return aligned;
}

function renderChordLyricBlock(chords, lyrics) {
  // Chord names positioned above lyrics — no diagrams inline
  let chordLine = "";
  for (const chord of chords) {
    while (chordLine.length < chord.position) {
      chordLine += " ";
    }
    chordLine += chord.name;
  }

  let html = `<pre class="chord-lyric-block">`;
  html += `<span class="chord-names">${escapeHtml(chordLine)}</span>\n`;
  html += escapeHtml(lyrics);
  html += `</pre>`;
  return html;
}

function renderTextBlock(content) {
  return `<div class="text-block">${escapeHtml(content)}</div>`;
}

// ── Main Conversion ───────────────────────────────────────────────────
function convert() {
  const input = document.getElementById("guitar-input").value;
  const warningsEl = document.getElementById("warnings");
  const outputEl = document.getElementById("mandolin-output");

  if (!input.trim()) {
    outputEl.innerHTML = "";
    warningsEl.textContent = "";
    warningsEl.className = "warnings";
    const td = document.getElementById("guitar-tuning-display");
    td.textContent = "E A D G B e";
    td.classList.remove("tuning-custom");
    return;
  }

  const parsed = parseGuitarTab(input);
  const allWarnings = [...parsed.warnings];

  // Update guitar tuning display
  const tuningDisplay = document.getElementById("guitar-tuning-display");
  if (parsed.tuning && parsed.tuning.length === 6) {
    const names = parsed.tuning.map(midiToNoteName);
    tuningDisplay.textContent = names.join(" ");
    tuningDisplay.classList.add("tuning-custom");
  } else {
    tuningDisplay.textContent = "E A D G B e";
    tuningDisplay.classList.remove("tuning-custom");
  }

  if (parsed.blocks.length === 0) {
    outputEl.innerHTML = "";
    warningsEl.textContent =
      "Could not parse any input. Paste guitar tab (6 lines per section) or chord+lyrics format.";
    warningsEl.className = "warnings visible";
    return;
  }

  // Collect unique chords across all blocks for reference section
  const seenChords = new Set();
  const uniqueChords = [];
  for (const block of parsed.blocks) {
    const chordList =
      block.type === "chordlyric" ? block.chords :
      block.type === "tab" && block.chords ? block.chords :
      null;
    if (chordList) {
      for (const chord of chordList) {
        if (!seenChords.has(chord.name)) {
          seenChords.add(chord.name);
          uniqueChords.push(chord.name);
        }
      }
    }
  }

  let html = "";

  for (const block of parsed.blocks) {
    if (block.type === "tab") {
      const mandolin = convertToMandolin(block.events, parsed.capo, parsed.tuning);
      allWarnings.push(...mandolin.warnings);
      html += renderTabBlock(mandolin.events, block.chords, block.inputFirstLine);
    } else if (block.type === "chordlyric") {
      html += renderChordLyricBlock(block.chords, block.lyrics);
    } else if (block.type === "text") {
      html += renderTextBlock(block.content);
    }
  }

  // Render chord reference section at the end
  if (uniqueChords.length > 0) {
    const diagrams = [];
    for (const name of uniqueChords) {
      const frets = lookupMandolinChord(name);
      if (frets) {
        diagrams.push(renderChordDiagram(name, frets));
      } else {
        allWarnings.push(`Unknown chord: "${name}" — no diagram available.`);
      }
    }
    if (diagrams.length > 0) {
      html += `<div class="chord-reference-divider">Chord Reference</div>`;
      html += `<pre class="chord-reference">${escapeHtml(joinDiagramsSideBySide(diagrams))}</pre>`;
    }
  }

  outputEl.innerHTML = html;

  if (allWarnings.length > 0) {
    const unique = [...new Set(allWarnings)];
    warningsEl.textContent = unique.join("\n");
    warningsEl.className = "warnings visible";
  } else {
    warningsEl.textContent = "";
    warningsEl.className = "warnings";
  }
}

// Load sample with both tab and chord+lyrics
function loadSample() {
  const sample = `[Verse]
G               C        D
Fly me to the moon and let me play
Em              Am       D7
Among the stars, let me see what spring is like
G               C
On Jupiter and Mars

e|---5---|---7---|---8---10--|--12--8---7---5---|
B|---5---|---8---|--10---10--|--12--10--8---5---|
G|---5---|---7---|---9---9---|--12--9---7---5---|
D|---7---|---9---|--10---12--|--12--10--9---7---|
A|---x---|---x---|---x---x---|--x---x---x---x---|
E|---x---|---x---|---x---x---|--x---x---x---x---|`;
  document.getElementById("guitar-input").value = sample;
  convert();
}

function clearAll() {
  document.getElementById("guitar-input").value = "";
  document.getElementById("mandolin-output").innerHTML = "";
  document.getElementById("warnings").textContent = "";
  document.getElementById("warnings").className = "warnings";
}

function copyOutput() {
  const output = document.getElementById("mandolin-output");
  navigator.clipboard.writeText(output.innerText);
  const btn = document.getElementById("copy-btn");
  btn.textContent = "Copied!";
  setTimeout(() => {
    btn.textContent = "Copy";
  }, 1500);
}

// ── Import ────────────────────────────────────────────────────────────
const UG_CONSOLE_CMD = `copy(JSON.stringify({a:UGAPP.store.page.data.tab.artist_name,n:UGAPP.store.page.data.tab.song_name,u:UGAPP.store.page.data.tab.username||'',c:(UGAPP.store.page.data.tab_view.wiki_tab||{}).content||'',tp:UGAPP.store.page.data.tab.type||''}))`;

function showImport() {
  document.getElementById("import-modal").classList.remove("hidden");
  document.getElementById("import-text").value = "";
  const artistEl = document.getElementById("import-artist");
  const nameEl = document.getElementById("import-name");
  const tabbyEl = document.getElementById("import-tabby");
  const srcEl = document.getElementById("import-tabsource");
  if (artistEl) artistEl.value = "";
  if (nameEl) nameEl.value = "";
  if (tabbyEl) tabbyEl.value = "";
  if (srcEl) srcEl.value = "";
  document.getElementById("import-status").textContent = "";
  document.getElementById("import-status").className = "import-status";
  document.getElementById("console-snippet").textContent = UG_CONSOLE_CMD;
}

function hideImport(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById("import-modal").classList.add("hidden");
}

function copySnippet() {
  navigator.clipboard.writeText(UG_CONSOLE_CMD);
  const btn = document.querySelector(".snippet-copy-btn");
  btn.textContent = "Copied!";
  setTimeout(() => { btn.textContent = "Copy"; }, 1500);
}

function stripUgMarkup(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\[\/?tab\]/g, "")
    .replace(/\[ch\](.*?)\[\/ch\]/g, "$1");
}

function parseImportText() {
  const raw = document.getElementById("import-text").value.trim();
  if (!raw) return null;

  // Try parsing as JSON from the console command
  try {
    const data = JSON.parse(raw);
    // Handle our compact format {a, n, u, c, tp}
    if (data.a || data.c) {
      const content = stripUgMarkup(data.c || data.content || "");
      if (!content && data.tp === "Official") {
        return {
          artist: data.a || "",
          name: data.n || "",
          tabBy: data.u || "",
          tabSource: "ultimate-guitar",
          content: "",
          error: 'This is an "Official" Guitar Pro tab — UG encrypts these so they can\'t be exported. Try a user-submitted tab version for this song instead, or upload a standard .gpx file from another source.',
        };
      }
      return {
        artist: data.a || data.artist || "",
        name: data.n || data.name || "",
        tabBy: data.u || data.tabBy || "",
        tabSource: "ultimate-guitar",
        content,
      };
    }
    // Handle full format {artist, name, content}
    if (data.artist || data.content) {
      return {
        artist: data.artist || "",
        name: data.name || "",
        tabBy: data.tabBy || "",
        tabSource: data.tabSource || "ultimate-guitar",
        content: stripUgMarkup(data.content || ""),
      };
    }
  } catch {
    // Not JSON — treat as plain tab text
  }

  return {
    artist: "",
    name: "",
    tabBy: "",
    tabSource: "",
    content: stripUgMarkup(raw),
  };
}

function doImport() {
  const statusEl = document.getElementById("import-status");
  const parsed = parseImportText();
  if (parsed && parsed.error) {
    statusEl.textContent = parsed.error;
    statusEl.className = "import-status error";
    return;
  }
  if (!parsed || !parsed.content) {
    statusEl.textContent = "Paste the console output or tab text first.";
    statusEl.className = "import-status error";
    return;
  }

  // Use JSON metadata if available, fall back to manual fields
  const artist = parsed.artist || (document.getElementById("import-artist") || {}).value?.trim() || "";
  const name = parsed.name || (document.getElementById("import-name") || {}).value?.trim() || "";

  if (!artist || !name) {
    statusEl.textContent = "Artist and song name are required. Fill them in below, or the JSON data was missing them.";
    statusEl.className = "import-status error";
    // Auto-open the manual fields section
    const details = document.querySelector(".import-alt");
    if (details) details.open = true;
    return;
  }

  const tabBy = parsed.tabBy || (document.getElementById("import-tabby") || {}).value?.trim() || "";
  const tabSource = parsed.tabSource || (document.getElementById("import-tabsource") || {}).value?.trim() || "";

  // Save to library
  const songs = getLibrary();
  const id = songs.length > 0 ? Math.max(...songs.map((s) => s.id)) + 1 : 1;
  songs.push({ id, artist, name, tabBy, tabSource, input: parsed.content });
  saveLibrary(songs);
  renderLibrary();

  // Load into editor
  document.getElementById("guitar-input").value = parsed.content;
  convert();

  statusEl.textContent = `Saved "${name}" by ${artist} to library.`;
  statusEl.className = "import-status success";
  setTimeout(() => hideImport(), 1200);
}

function importToEditor() {
  const statusEl = document.getElementById("import-status");
  const parsed = parseImportText();
  if (parsed && parsed.error) {
    statusEl.textContent = parsed.error;
    statusEl.className = "import-status error";
    return;
  }
  if (!parsed || !parsed.content) {
    statusEl.textContent = "Paste the console output or tab text first.";
    statusEl.className = "import-status error";
    return;
  }

  document.getElementById("guitar-input").value = parsed.content;
  convert();
  hideImport();
}

// ── View Navigation ───────────────────────────────────────────────────
function switchView(view) {
  const container = document.querySelector(".container");
  const converterEl = document.getElementById("view-converter");
  const libraryEl = document.getElementById("view-library");
  const tabs = document.querySelectorAll(".nav-tab");

  if (view === "library") {
    converterEl.classList.add("hidden");
    libraryEl.classList.remove("hidden");
    tabs[0].classList.remove("active");
    tabs[1].classList.add("active");
    container.classList.add("wide");
    document.body.style.padding = "1rem";
    renderLibrary();
  } else {
    libraryEl.classList.add("hidden");
    converterEl.classList.remove("hidden");
    tabs[1].classList.remove("active");
    tabs[0].classList.add("active");
    container.classList.remove("wide");
    document.body.style.padding = "";
  }
}

// ── Song Library (localStorage) ───────────────────────────────────────
const LIBRARY_KEY = "mandoLibrary";

function getLibrary() {
  try {
    const songs = JSON.parse(localStorage.getItem(LIBRARY_KEY)) || [];
    return songs.map((s) => ({
      ...s,
      artist: s.artist || "Unknown",
    }));
  } catch {
    return [];
  }
}

function saveLibrary(songs) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(songs));
}

function exportLibrary() {
  const songs = getLibrary();
  if (songs.length === 0) return;
  const blob = new Blob([JSON.stringify(songs, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mando-library.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importLibrary(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error("Not an array");
      const existing = getLibrary();
      const maxId = existing.length > 0 ? Math.max(...existing.map((s) => s.id)) : 0;
      let added = 0;
      for (const song of imported) {
        // Skip duplicates by artist+name match
        const dup = existing.some(
          (s) => s.artist === song.artist && s.name === song.name
        );
        if (dup) continue;
        existing.push({ ...song, id: maxId + added + 1 });
        added++;
      }
      saveLibrary(existing);
      renderLibrary();
      alert(`Imported ${added} song${added !== 1 ? "s" : ""} (${imported.length - added} duplicates skipped).`);
    } catch (err) {
      alert("Invalid library file: " + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function saveSong() {
  const input = document.getElementById("guitar-input").value;
  if (!input.trim()) return;
  const artist = prompt("Artist name:");
  if (!artist || !artist.trim()) return;
  const name = prompt("Song name:");
  if (!name || !name.trim()) return;
  const tabBy = prompt("Tab by (username, optional):");
  const tabSource = prompt("Source (e.g. ultimate-guitar, emilstabs — optional):");
  const songs = getLibrary();
  const id = songs.length > 0 ? Math.max(...songs.map((s) => s.id)) + 1 : 1;
  songs.push({ id, artist: artist.trim(), name: name.trim(), input, tabBy: (tabBy || "").trim(), tabSource: (tabSource || "").trim() });
  saveLibrary(songs);
  renderLibrary();
}

// ── Library Rendering ─────────────────────────────────────────────────
function renderLibrary() {
  const songs = getLibrary();
  const searchInput = document.getElementById("library-search");
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

  const filtered = query
    ? songs.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.artist.toLowerCase().includes(query)
      )
    : songs;

  renderTree(filtered);
  renderSongList(filtered);
}

function renderTree(songs) {
  const treeEl = document.getElementById("library-tree");
  if (!treeEl) return;

  const groups = {};
  for (const s of songs) {
    if (!groups[s.artist]) groups[s.artist] = [];
    groups[s.artist].push(s);
  }

  let html = `<div class="tree-all" onclick="resetSearch()">All Songs (${songs.length})</div>`;

  const artists = Object.keys(groups).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  for (const artist of artists) {
    const artistSongs = groups[artist];
    html += `<div class="tree-artist" onclick="toggleArtist(this)">\u25BC ${escapeHtml(artist)} (${artistSongs.length})</div>`;
    html += `<div class="tree-artist-songs">`;
    for (const s of artistSongs) {
      html += `<div class="tree-song" onclick="viewSong(${s.id})">${escapeHtml(s.name)}</div>`;
    }
    html += `</div>`;
  }

  if (songs.length === 0) {
    html += '<div class="library-empty">No songs found</div>';
  }

  treeEl.innerHTML = html;
}

function renderSongList(songs) {
  const detailEl = document.getElementById("library-detail");
  if (!detailEl) return;

  if (songs.length === 0) {
    detailEl.innerHTML = '<div class="library-empty">No songs found</div>';
    return;
  }

  detailEl.innerHTML = songs
    .map(
      (s) =>
        `<div class="library-item">
          <div class="library-item-info" style="cursor:pointer" onclick="viewSong(${s.id})">
            <div class="library-item-name">${escapeHtml(s.name)}</div>
            <div class="library-item-artist">${escapeHtml(s.artist)}</div>
          </div>
          <div class="library-actions">
            <button onclick="viewSong(${s.id})">View</button>
            <button onclick="editSong(${s.id})">Edit</button>
            <button onclick="deleteSong(${s.id})">Delete</button>
          </div>
        </div>`
    )
    .join("");
}

// ── Performer View (song detail) ──────────────────────────────────────
function viewSong(id, transpose) {
  transpose = transpose || 0;
  const songs = getLibrary();
  const song = songs.find((s) => s.id === id);
  if (!song) return;

  // Convert the guitar input to mandolin output
  const parsed = parseGuitarTab(song.input);
  let html = "";
  for (const block of parsed.blocks) {
    if (block.type === "tab") {
      const mandolin = convertToMandolin(block.events, parsed.capo, parsed.tuning, transpose);
      html += renderTabBlock(mandolin.events, block.chords, block.inputFirstLine);
    } else if (block.type === "chordlyric") {
      html += renderChordLyricBlock(block.chords, block.lyrics);
    } else if (block.type === "text") {
      html += renderTextBlock(block.content);
    }
  }

  // Chord reference
  const seenChords = new Set();
  const uniqueChords = [];
  for (const block of parsed.blocks) {
    const chordList =
      block.type === "chordlyric" ? block.chords :
      block.type === "tab" && block.chords ? block.chords :
      null;
    if (chordList) {
      for (const chord of chordList) {
        if (!seenChords.has(chord.name)) {
          seenChords.add(chord.name);
          uniqueChords.push(chord.name);
        }
      }
    }
  }
  if (uniqueChords.length > 0) {
    const diagrams = [];
    for (const name of uniqueChords) {
      const frets = lookupMandolinChord(name);
      if (frets) diagrams.push(renderChordDiagram(name, frets));
    }
    if (diagrams.length > 0) {
      html += `<div class="chord-reference-divider">Chord Reference</div>`;
      html += `<pre class="chord-reference">${escapeHtml(joinDiagramsSideBySide(diagrams))}</pre>`;
    }
  }

  // Build credit line: "Adapted from [user] at [source]"
  const by = song.tabBy || song.source || "";
  const src = song.tabSource || "";
  let creditText = "";
  if (by && src) creditText = `Adapted from ${escapeHtml(by)} at ${escapeHtml(src)}`;
  else if (by) creditText = `Adapted from ${escapeHtml(by)}`;
  else if (src) creditText = `Adapted from ${escapeHtml(src)}`;
  const sourceHtml = creditText
    ? `<div class="song-detail-source">${creditText}</div>`
    : "";

  const detailEl = document.getElementById("library-detail");
  detailEl.innerHTML =
    `<div class="song-detail-header">
      <div class="song-detail-info">
        <h3>${escapeHtml(song.name)}</h3>
        <div class="song-detail-artist">${escapeHtml(song.artist)}</div>
        ${sourceHtml}
      </div>
      <div class="song-detail-actions">
        <button onclick="renderLibrary()">Back</button>
        <button onclick="editSong(${song.id})">Edit</button>
        <button onclick="loadToConverter(${song.id})">Open in Converter</button>
        <button onclick="deleteSong(${song.id})">Delete</button>
        <div class="transpose-control">
          <button onclick="viewSong(${song.id}, ${transpose - 1})">−</button>
          <span class="transpose-value">${transpose > 0 ? "+" : ""}${transpose}</span>
          <button onclick="viewSong(${song.id}, ${transpose + 1})">+</button>
        </div>
      </div>
    </div>
    <div class="song-detail-output">${html || '<div class="library-empty">No tab content</div>'}</div>`;
}

function loadToConverter(id) {
  const songs = getLibrary();
  const song = songs.find((s) => s.id === id);
  if (!song) return;
  document.getElementById("guitar-input").value = song.input;
  convert();
  switchView("converter");
}

// ── Edit Song ─────────────────────────────────────────────────────────
function editSong(id) {
  const songs = getLibrary();
  const song = songs.find((s) => s.id === id);
  if (!song) return;

  const detailEl = document.getElementById("library-detail");
  detailEl.innerHTML =
    `<div class="song-edit-form">
      <div class="song-detail-header">
        <div class="song-detail-info"><h3>Edit Song</h3></div>
        <div class="song-detail-actions">
          <button onclick="renderLibrary()">Cancel</button>
        </div>
      </div>
      <div>
        <label for="edit-artist">Artist</label>
        <input type="text" id="edit-artist" value="${escapeHtml(song.artist)}" />
      </div>
      <div>
        <label for="edit-name">Song Name</label>
        <input type="text" id="edit-name" value="${escapeHtml(song.name)}" />
      </div>
      <div>
        <label for="edit-tabby">Tab By</label>
        <input type="text" id="edit-tabby" value="${escapeHtml(song.tabBy || song.source || "")}" placeholder="Username or transcriber" />
      </div>
      <div>
        <label for="edit-tabsource">Source</label>
        <input type="text" id="edit-tabsource" value="${escapeHtml(song.tabSource || "")}" placeholder="e.g. ultimate-guitar, emilstabs" />
      </div>
      <div>
        <label for="edit-input">Guitar Tab</label>
        <textarea id="edit-input" spellcheck="false">${escapeHtml(song.input)}</textarea>
      </div>
      <div class="song-edit-actions">
        <button class="btn-accent" onclick="saveEdit(${song.id})">Save Changes</button>
        <button onclick="renderLibrary()">Cancel</button>
      </div>
    </div>`;
}

function saveEdit(id) {
  const artist = document.getElementById("edit-artist").value.trim();
  const name = document.getElementById("edit-name").value.trim();
  const tabBy = document.getElementById("edit-tabby").value.trim();
  const tabSource = document.getElementById("edit-tabsource").value.trim();
  const input = document.getElementById("edit-input").value;
  if (!artist || !name || !input.trim()) return;

  const songs = getLibrary();
  const idx = songs.findIndex((s) => s.id === id);
  if (idx === -1) return;
  songs[idx] = { ...songs[idx], artist, name, tabBy, tabSource, input };
  saveLibrary(songs);
  viewSong(id);
}

// ── Library Helpers ───────────────────────────────────────────────────
function filterLibrary() {
  renderLibrary();
}

function resetSearch() {
  const searchInput = document.getElementById("library-search");
  if (searchInput) searchInput.value = "";
  renderLibrary();
}

function toggleArtist(el) {
  const songsDiv = el.nextElementSibling;
  if (!songsDiv) return;
  const collapsed = songsDiv.classList.toggle("collapsed");
  el.textContent = el.textContent.replace(/^[▼▶]/, collapsed ? "\u25B6" : "\u25BC");
}

function deleteSong(id) {
  if (!confirm("Delete this song from your library?")) return;
  const songs = getLibrary().filter((s) => s.id !== id);
  saveLibrary(songs);
  renderLibrary();
}

// ── Guitar Pro File Handler ────────────────────────────────────────────
function handleGpFile(file) {
  const statusEl = document.getElementById("import-status");
  const reader = new FileReader();

  reader.onload = async function (e) {
    try {
      statusEl.textContent = "Parsing Guitar Pro file...";
      statusEl.className = "import-status";
      const tabText = await parseGPX(e.target.result);
      document.getElementById("import-text").value = tabText;
      statusEl.textContent =
        "Guitar Pro file parsed successfully. Click Import & Save or Load Only.";
      statusEl.className = "import-status success";
    } catch (err) {
      statusEl.textContent = "Error parsing GP file: " + err.message;
      statusEl.className = "import-status error";
    }
  };

  reader.onerror = function () {
    statusEl.textContent = "Error reading file.";
    statusEl.className = "import-status error";
  };

  reader.readAsArrayBuffer(file);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("guitar-input").addEventListener("input", convert);

  const gpInput = document.getElementById("gp-file-input");
  if (gpInput) {
    gpInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleGpFile(e.target.files[0]);
      }
    });
  }

  renderLibrary();
});
