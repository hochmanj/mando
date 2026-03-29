// ── Guitar Pro (.gpx) File Parser ────────────────────────────────────
// Decodes GP6+ binary files: BCFZ → BCFS → score.gpif XML → guitar tab text

// ── BitReader ────────────────────────────────────────────────────────
class BitReader {
  constructor(data) {
    this.data = data;
    this.byteOffset = 0;
    this.bitPosition = 0; // 0-7, LSB-first within each byte
  }

  readBit() {
    if (this.byteOffset >= this.data.length) return 0;
    const bit = (this.data[this.byteOffset] >> this.bitPosition) & 1;
    this.bitPosition++;
    if (this.bitPosition >= 8) {
      this.bitPosition = 0;
      this.byteOffset++;
    }
    return bit;
  }

  readBits(n) {
    let value = 0;
    for (let i = 0; i < n; i++) {
      value |= this.readBit() << i;
    }
    return value;
  }
}

// ── BCFZ Decompression ──────────────────────────────────────────────
function decompressBCFZ(data) {
  // Validate BCFZ magic header
  if (
    data[0] !== 0x42 ||
    data[1] !== 0x43 ||
    data[2] !== 0x46 ||
    data[3] !== 0x5a
  ) {
    throw new Error("Not a valid BCFZ file (bad magic header)");
  }

  // Expected uncompressed size (little-endian uint32 at offset 4)
  const expectedSize =
    data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);

  const reader = new BitReader(data.subarray(8));
  const output = [];

  while (output.length < expectedSize) {
    const bit = reader.readBit();
    if (bit === 1) {
      // Literal byte: read 8 bits
      output.push(reader.readBits(8));
    } else {
      // Back-reference
      const wordSize = reader.readBits(4);
      const offset = reader.readBits(wordSize);
      const length = reader.readBits(wordSize);

      const srcStart = output.length - offset;
      for (let i = 0; i < length; i++) {
        // Source index can overlap with destination (run-length style)
        output.push(output[srcStart + i]);
      }
    }
  }

  return new Uint8Array(output);
}

// ── BCFS Container Parser ───────────────────────────────────────────
function parseBCFS(data) {
  // Validate BCFS magic header
  if (
    data[0] !== 0x42 ||
    data[1] !== 0x43 ||
    data[2] !== 0x46 ||
    data[3] !== 0x53
  ) {
    throw new Error("Not a valid BCFS container (bad magic header)");
  }

  const SECTOR_SIZE = 4096;
  const files = new Map();
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // File table starts at sector 1 (offset 4096)
  let entryOffset = SECTOR_SIZE;

  while (entryOffset + 288 <= data.length) {
    // Read file size at entry offset + 256
    const fileSize = view.getUint32(entryOffset + 256, true);

    // Zero file size marks end of table
    if (fileSize === 0) break;

    // Read filename: 127 UTF-16LE characters starting at entry offset
    let filename = "";
    for (let i = 0; i < 127; i++) {
      const charCode = view.getUint16(entryOffset + i * 2, true);
      if (charCode === 0) break;
      filename += String.fromCharCode(charCode);
    }

    // First sector index at entry offset + 260
    const firstSector = view.getUint32(entryOffset + 260, true);

    // Read file data by following sectors
    const fileData = new Uint8Array(fileSize);
    let bytesRead = 0;
    let sectorIndex = firstSector;

    while (bytesRead < fileSize) {
      const sectorOffset = sectorIndex * SECTOR_SIZE;
      const bytesToRead = Math.min(SECTOR_SIZE, fileSize - bytesRead);

      if (sectorOffset + bytesToRead > data.length) break;

      fileData.set(
        data.subarray(sectorOffset, sectorOffset + bytesToRead),
        bytesRead
      );
      bytesRead += bytesToRead;
      sectorIndex++;
    }

    files.set(filename, fileData);
    entryOffset += 288;
  }

  return files;
}

// ── GPIF XML Parser ─────────────────────────────────────────────────
function parseGpifXml(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Failed to parse GPIF XML: " + parseError.textContent);
  }

  // Parse tracks
  const tracks = [];
  for (const trackEl of doc.querySelectorAll("Tracks > Track")) {
    const id = trackEl.getAttribute("id");
    const name =
      trackEl.querySelector("Name")?.textContent?.trim() || `Track ${id}`;

    // Parse tuning from Properties
    let tuning = [];
    const props = trackEl.querySelectorAll("Properties > Property");
    for (const prop of props) {
      if (prop.getAttribute("name") === "Tuning") {
        const pitchesEl = prop.querySelector("Pitches");
        if (pitchesEl) {
          tuning = pitchesEl.textContent
            .trim()
            .split(/\s+/)
            .map(Number);
        }
      }
    }

    // Default standard guitar tuning if not specified
    if (tuning.length === 0) {
      tuning = [64, 59, 55, 50, 45, 40]; // e B G D A E (high to low)
    }

    tracks.push({ id, name, tuning });
  }

  // Parse MasterBars
  const masterBars = [];
  for (const mbEl of doc.querySelectorAll("MasterBars > MasterBar")) {
    const barsText = mbEl.querySelector("Bars")?.textContent?.trim() || "";
    const barIds = barsText.split(/\s+/).filter(Boolean);
    masterBars.push({ barIds });
  }

  // Parse Bars
  const bars = {};
  for (const barEl of doc.querySelectorAll("Bars > Bar")) {
    const id = barEl.getAttribute("id");
    const voicesText =
      barEl.querySelector("Voices")?.textContent?.trim() || "";
    const voiceIds = voicesText.split(/\s+/).filter(Boolean);
    bars[id] = { id, voiceIds };
  }

  // Parse Voices
  const voices = {};
  for (const voiceEl of doc.querySelectorAll("Voices > Voice")) {
    const id = voiceEl.getAttribute("id");
    const beatsText =
      voiceEl.querySelector("Beats")?.textContent?.trim() || "";
    const beatIds = beatsText.split(/\s+/).filter(Boolean);
    voices[id] = { id, beatIds };
  }

  // Parse Beats
  const beats = {};
  for (const beatEl of doc.querySelectorAll("Beats > Beat")) {
    const id = beatEl.getAttribute("id");
    const rhythmRef =
      beatEl.querySelector("Rhythm")?.getAttribute("ref") || "";
    const notesText =
      beatEl.querySelector("Notes")?.textContent?.trim() || "";
    const noteIds = notesText ? notesText.split(/\s+/).filter(Boolean) : [];

    // Check for beat properties
    const dynamic =
      beatEl.querySelector("Dynamic")?.textContent?.trim() || "";

    beats[id] = { id, rhythmRef, noteIds, dynamic };
  }

  // Parse Notes
  const notes = {};
  for (const noteEl of doc.querySelectorAll("Notes > Note")) {
    const id = noteEl.getAttribute("id");
    const properties = {};

    const propsEl = noteEl.querySelector("Properties");
    if (propsEl) {
      for (const prop of propsEl.querySelectorAll("Property")) {
        const propName = prop.getAttribute("name");
        const fretEl = prop.querySelector("Fret");
        const stringEl = prop.querySelector("String");
        const enableEl = prop.querySelector("Enable");
        const flagsEl = prop.querySelector("Flags");

        if (propName === "Fret" && fretEl) {
          properties.fret = parseInt(fretEl.textContent.trim(), 10);
        } else if (propName === "String" && stringEl) {
          properties.string = parseInt(stringEl.textContent.trim(), 10);
        } else if (propName === "HopoOrigin" || propName === "HopoDestination") {
          properties.hammerOn = true;
        } else if (propName === "Slide" && flagsEl) {
          properties.slide = true;
        }
      }
    }

    // Check for hammer-on/pull-off via direct child elements too
    if (noteEl.querySelector("HammerOn")) {
      properties.hammerOn = true;
    }
    if (noteEl.querySelector("PullOff")) {
      properties.pullOff = true;
    }
    if (noteEl.querySelector("Slide")) {
      properties.slide = true;
    }

    notes[id] = { id, properties };
  }

  // Parse Rhythms
  const rhythms = {};
  for (const rhythmEl of doc.querySelectorAll("Rhythms > Rhythm")) {
    const id = rhythmEl.getAttribute("id");
    const noteValue =
      rhythmEl.querySelector("NoteValue")?.textContent?.trim() || "Quarter";
    const augDot = rhythmEl.querySelector("AugmentationDot");
    const dots = augDot ? parseInt(augDot.getAttribute("count") || "1", 10) : 0;

    // Tuplet
    let tuplet = null;
    const primaryTupletEl = rhythmEl.querySelector("PrimaryTuplet");
    if (primaryTupletEl) {
      tuplet = {
        num: parseInt(primaryTupletEl.getAttribute("num") || "1", 10),
        den: parseInt(primaryTupletEl.getAttribute("den") || "1", 10),
      };
    }

    rhythms[id] = { id, noteValue, dots, tuplet };
  }

  return { tracks, masterBars, bars, voices, beats, notes, rhythms };
}

// ── GP Data to Guitar Tab ───────────────────────────────────────────
function gpDataToGuitarTab(gpData, trackIndex) {
  const { tracks, masterBars, bars, voices, beats, notes, rhythms } = gpData;

  // Find a guitar track (6-string)
  if (trackIndex === undefined) {
    trackIndex = tracks.findIndex((t) => t.tuning.length === 6);
    if (trackIndex === -1) trackIndex = 0;
  }

  const track = tracks[trackIndex];
  if (!track) throw new Error("No tracks found in GP file");

  const numStrings = track.tuning.length;
  // Tuning array is high-to-low in GPIF, string index 0 = highest
  const tuning = track.tuning;

  // Standard string labels for 6-string guitar (high to low)
  const STRING_LABELS_6 = ["e", "B", "G", "D", "A", "E"];
  const STRING_LABELS_4 = ["E", "A", "D", "G"]; // mandolin/bass
  const STRING_LABELS_7 = ["e", "B", "G", "D", "A", "E", "B"];

  let stringLabels;
  if (numStrings === 6) stringLabels = STRING_LABELS_6;
  else if (numStrings === 4) stringLabels = STRING_LABELS_4;
  else if (numStrings === 7) stringLabels = STRING_LABELS_7;
  else {
    // Generic numbered strings
    stringLabels = Array.from({ length: numStrings }, (_, i) => `${i + 1}`);
  }

  // Column widths based on rhythm note values
  const NOTE_WIDTHS = {
    Whole: 8,
    Half: 6,
    Quarter: 4,
    Eighth: 3,
    "16th": 2,
    "32nd": 2,
    "64th": 1,
  };

  // Build output lines, one per string
  const lines = stringLabels.map((label) => label + "|");

  // Walk MasterBars → Bars → Voices → Beats → Notes
  for (let mbIdx = 0; mbIdx < masterBars.length; mbIdx++) {
    const mb = masterBars[mbIdx];
    const barId = mb.barIds[trackIndex];
    if (!barId || !bars[barId]) continue;

    const bar = bars[barId];
    // Use first voice
    const voiceId = bar.voiceIds[0];
    if (!voiceId || voiceId === "-1" || !voices[voiceId]) continue;

    const voice = voices[voiceId];

    for (const beatId of voice.beatIds) {
      const beat = beats[beatId];
      if (!beat) continue;

      const rhythm = rhythms[beat.rhythmRef];
      const width = rhythm ? NOTE_WIDTHS[rhythm.noteValue] || 3 : 3;

      // Build column: determine fret on each string
      const column = new Array(numStrings).fill(null);
      const articulations = new Array(numStrings).fill("");

      for (const noteId of beat.noteIds) {
        const note = notes[noteId];
        if (!note || note.properties.fret === undefined) continue;

        const stringIdx = note.properties.string;
        if (stringIdx === undefined || stringIdx < 0 || stringIdx >= numStrings)
          continue;

        column[stringIdx] = note.properties.fret;

        // Articulation markers
        if (note.properties.hammerOn) articulations[stringIdx] = "h";
        else if (note.properties.pullOff) articulations[stringIdx] = "p";
        else if (note.properties.slide) articulations[stringIdx] = "/";
      }

      // Write column to each string line
      for (let s = 0; s < numStrings; s++) {
        if (column[s] !== null) {
          const fretStr = column[s].toString();
          const artic = articulations[s];
          const cell = fretStr + artic;
          lines[s] += cell.padEnd(width, "-");
        } else {
          lines[s] += "-".repeat(width);
        }
      }
    }

    // Bar line separator
    for (let s = 0; s < numStrings; s++) {
      lines[s] += "|";
    }
  }

  return lines.join("\n");
}

// ── ZIP Reader (for GP7+ files) ─────────────────────────────────────
function parseZip(data) {
  const files = new Map();
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  while (offset + 30 <= data.length) {
    const sig = view.getUint32(offset, true);
    // Local file header signature: PK\x03\x04 = 0x04034b50
    if (sig !== 0x04034b50) break;

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const nameBytes = data.subarray(offset + 30, offset + 30 + nameLen);
    const filename = new TextDecoder("utf-8").decode(nameBytes);

    const dataStart = offset + 30 + nameLen + extraLen;

    if (compressionMethod === 0) {
      // Stored (no compression)
      files.set(filename, data.subarray(dataStart, dataStart + uncompressedSize));
    } else if (compressionMethod === 8) {
      // Deflate — use browser's DecompressionStream
      const compressed = data.subarray(dataStart, dataStart + compressedSize);
      // Store raw compressed data; we'll decompress what we need
      files.set(filename, { compressed, uncompressedSize, deflate: true });
    }

    offset = dataStart + compressedSize;
  }

  return files;
}

async function decompressDeflate(compressed) {
  // Wrap raw deflate in a minimal zlib stream (header + data + dummy checksum)
  // DecompressionStream('deflate') expects zlib format (RFC 1950)
  const zlib = new Uint8Array(compressed.length + 6);
  zlib[0] = 0x78; // CMF: deflate, window size 32K
  zlib[1] = 0x01; // FLG: no dict, check bits
  zlib.set(compressed, 2);
  // Adler-32 placeholder (4 bytes) — DecompressionStream is lenient
  zlib[zlib.length - 4] = 0;
  zlib[zlib.length - 3] = 0;
  zlib[zlib.length - 2] = 0;
  zlib[zlib.length - 1] = 0;

  const ds = new DecompressionStream("deflate");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  writer.write(zlib);
  writer.close();

  const chunks = [];
  let totalLen = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
  }

  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

// ── Main Entry Point ────────────────────────────────────────────────
async function parseGPX(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);

  if (data.length < 4) {
    throw new Error("File too small to be a Guitar Pro file");
  }

  const magic = String.fromCharCode(data[0], data[1], data[2], data[3]);
  const hexHeader = Array.from(data.subarray(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");

  // GP6 formats
  if (magic === "BCFZ") {
    return parseGPXFromBCFS(decompressBCFZ(data));
  }
  if (magic === "BCFS") {
    return parseGPXFromBCFS(data);
  }

  // GP7+ format (ZIP archive, starts with PK\x03\x04)
  if (data[0] === 0x50 && data[1] === 0x4b) {
    return await parseGPXFromZip(data);
  }

  throw new Error(
    "Unsupported Guitar Pro format. Header bytes: " + hexHeader
  );
}

function parseGPXFromBCFS(bcfsData) {
  const files = parseBCFS(bcfsData);
  const gpifData = findGpif(files);
  const xmlString = new TextDecoder("utf-8").decode(gpifData);
  const gpData = parseGpifXml(xmlString);
  return gpDataToGuitarTab(gpData);
}

async function parseGPXFromZip(data) {
  const files = parseZip(data);

  // Find score.gpif in the ZIP (may be at Content/score.gpif or just score.gpif)
  let gpifEntry = null;
  let gpifName = null;
  for (const [name, content] of files) {
    if (name.toLowerCase().endsWith("score.gpif")) {
      gpifEntry = content;
      gpifName = name;
      break;
    }
  }

  if (!gpifEntry) {
    throw new Error(
      "No score.gpif found in GP file. Files found: " +
        [...files.keys()].join(", ")
    );
  }

  let gpifBytes;
  if (gpifEntry.deflate) {
    gpifBytes = await decompressDeflate(gpifEntry.compressed);
  } else {
    gpifBytes = gpifEntry;
  }

  const xmlString = new TextDecoder("utf-8").decode(gpifBytes);
  const gpData = parseGpifXml(xmlString);
  return gpDataToGuitarTab(gpData);
}

function findGpif(files) {
  for (const [name, content] of files) {
    if (name.toLowerCase() === "score.gpif") {
      return content;
    }
  }
  throw new Error(
    "No score.gpif found in GP file. Files found: " +
      [...files.keys()].join(", ")
  );
}
