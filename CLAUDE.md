# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Guitar → Mandolin Tab Converter ("mando") — a single-page web application that converts guitar tablature to mandolin tablature using MIDI-based note mapping with backtracking optimization for playable string assignments. Built entirely in vanilla JavaScript with no external dependencies.

## Running the Application

```bash
npx serve -l 3456
```

Access at `http://localhost:3456`. No build step — all changes take effect on browser refresh.

## Architecture

Three main source files (~2800 lines total):

- **app.js** — Core application logic: parsing, conversion algorithm, rendering, library management, DOM event handling
- **gp-parser.js** — Guitar Pro file decoder (BCFZ/BCFS decompression → GPIF XML parsing → plain text tab)
- **index.html** / **style.css** — UI shell with two views (Converter and Library), dark theme with orange accents

### Data Flow

```
Input Text → parseGuitarTab() → IR {blocks, warnings, tuning, capo}
  → parseSection() → events [{type:"notes", column, suffixes} | {type:"bar"}]
    → convertToMandolin() → mandolin events (MIDI conversion + backtracking string assignment)
      → formatMandolinTab() → ASCII tab string → renderTabBlock() → DOM
```

### Core Algorithm (convertToMandolin)

Two-pass conversion:
1. **Octave shift** — Calculate uniform shift if guitar notes fall below mandolin range (G3=55 MIDI)
2. **Per-note mapping** — For each guitar note: compute MIDI value → find all valid mandolin fret/string options → backtracking search optimizes for playability (≤6 fret span, maximize strings used, minimize total fret distance)

### Key Data Structures

- **Guitar tuning**: MIDI values per string (`E:40, A:45, D:50, G:55, B:59, e:64`)
- **Mandolin tuning**: `G:55, D:62, A:69, E:76` (one octave higher range)
- **Event**: `{type: "notes", column: {stringName: fretNumber|"x"|null}, suffixes: {stringName: "h"|"p"|"/"|...}}`
- **IR blocks**: `{type: "tab"|"text"|"chordlyric", ...}` — intermediate representation from parser

### Tab Line Detection

Four regex formats handle varied tab notation styles (pipe-prefixed with labels, label+content without pipes, pipe-prefixed without labels, bare dashes). The parser auto-detects guitar tuning from text headers and supports 13+ named tunings.

### Library System

Songs stored in `localStorage` under key `"mandoLibrary"` as JSON array. Supports import from Ultimate Guitar JSON, Guitar Pro .gpx files, and bulk JSON. Each song: `{id, artist, name, tabBy, tabSource, input}`.

## Naming Conventions

- `UPPERCASE` constants: `GUITAR_TUNING`, `STANDARD_TUNING`, `MANDOLIN_CHORDS`
- Function prefixes: `parse*`, `convert*`, `render*`, `format*`, `detect*`, `is*`, `get*`/`save*`
- Guitar strings referenced high-to-low in UI (`e,B,G,D,A,E`), low-to-high for MIDI lookups (`E,A,D,G,B,e`)
- Mandolin strings: `G,D,A,E` (low to high)
