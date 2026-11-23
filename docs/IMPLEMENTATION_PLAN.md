# PLAN ZERO v2.0 — Script & PvP Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade PLAN ZERO's Story Mode script/campaign (multi-speaker event-driven radio comms, 7-chapter narrative arc bridging to Oslo, rank-reactive newspaper endings) and overhaul Rival Heist PvP (Chrono-Dash/Tackle ability, echo laser/gate enforcement, upgraded Guard/Hacker/Runner abilities, dynamic mid-match bullion drops, 3 selectable arenas, and 3 AI bot difficulty tiers).

**Architecture:** Maintain the zero-dependency deterministic 60 FPS (`FIXED_DT = 1/60`) simulation architecture in `src/game/` while extracting declarative narrative triggers into `src/game/scriptEngine.ts` and multi-arena definitions into `src/game/rivalMaps.ts`. React components in `src/components/` remain lightweight HUD shells over the HTML5 Canvas renderers.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, HTML5 Canvas 2D, Web Audio API, Node.js native test runner (`node --import tsx --test`).

**Spec:** `docs/PRD_V2_SCRIPT_AND_PVP.md`

## Global Constraints

- Fixed simulation timestep: `FIXED_FPS = 60`, `FIXED_DT = 1 / 60`, `LOOP_TICKS = 600` (`10.00s`).
- Logical canvas resolution: `CANVAS_WIDTH = 960`, `CANVAS_HEIGHT = 540`.
- Zero external image or audio assets: 100% Canvas 2D / inline SVG rendering and procedural Web Audio API synthesis.
- Strict backward compatibility with existing keyboard controls (`WASD`/`Arrows`, `R`, `C`, `M`, `Esc`, `1/2/3`, `J/K/L`) while adding `Space`/`ShiftLeft` (P1 Dash/Tackle) and `Enter`/`ShiftRight` (P2 Dash/Tackle).

## Review Focus

1. **Multi-Gold Pickup in Story Mode (Chapter 6):** Collecting one gold case in a multi-gold chapter must not prematurely unlock the exit door until all required gold cases in `level.goldCases` are collected, and loop resets must restore all gold cases cleanly.
2. **Echo Gate & Laser Enforcement in PvP:** When a `RUNNER` echo collides with a closed laser gate (`openProgress < 0.4`) or sweeping laser, it must drop its carried gold at a wall-safe floor coordinate and enter stun without crashing or corrupting its recorded frame array.
3. **Chrono-Dash Wall Collision & Cooldown:** Dashing at `2.1x` speed near thin `20px–30px` walls must still resolve via axis-separated `resolveCircleWalls` without tunneling through walls or outer boundaries.
4. **Runner Ping-Pong Frame Indexing:** When a `RUNNER` echo at `1.2x` speed exceeds `frames.length - 1` (e.g. after tick 500 or after an early recording), its ping-pong reverse index calculation must stay strictly within `[0, frames.length - 1]` even for 1-frame recordings.
5. **Hacker Stash-Shield Fairness:** A `HACKER` echo stationed within `55px` of its own stash blocks rival stash-stealing, but once stunned or overwritten by the 4-echo FIFO cap, the stash immediately becomes stealable again.

---

## File Structure

- **Modify:** `src/types.ts` — Add multi-speaker radio types (`RadioSpeaker`, `RadioTransmission`, `LevelScriptDef`), multi-gold support (`goldCases?: GoldCaseDef[]`), PvP dash/tackle state (`dashTimer`, `dashCooldown`), PvP arena & bot difficulty types (`RivalArenaId`, `RivalBotDifficulty`), and `2`-point Diamond Briefcase value (`value: 1 | 2 | 3`).
- **Create:** `src/game/scriptEngine.ts` — Event-driven radio transmission selector for Story Mode and Rival Heist live banter, speaker metadata (color badges, frequencies), and rank-based newspaper copy generator.
- **Modify:** `src/game/levels.ts` — Upgrade Chapters 1–4 & 7 with rich multi-speaker dialogue scripts and add Chapter 5 (`PLAN ECLIPSE` — Dual-Plate AND Gate + Oslo radio hijack) and Chapter 6 (`PLAN PARADOX` — Twin Gold Vaults), expanding the story campaign to 7 chapters.
- **Modify:** `src/game/engine.ts` — Support multi-gold collection (`collectedGoldIds`), emit granular script trigger events, and adjust Rank `S` / `A` / `B` thresholds dynamically based on campaign total Par loops.
- **Create:** `src/game/rivalMaps.ts` — Define 3 symmetric PvP arenas (`BULLION_HALL`, `LASER_ROTUNDA`, `TWIN_VAULTS`) with walls, plates, gates, lasers, and spawns.
- **Modify:** `src/game/rivalEngine.ts` — Implement Chrono-Dash/Tackle (`Space`/`Enter`), echo gate/laser stun & gold drop, `HACKER` ECM jamming aura (`55px` slow + stash-shield), `RUNNER` ping-pong patrol, Loop 3 Diamond Briefcase (`2 pts`) + Loop 4–5 corridor bullion drops, and 3-tier AI Bot (`OPERATIVE`, `TACTICIAN`, `MASTERMIND`).
- **Modify:** `src/game/renderer.ts` & `src/game/rivalRenderer.ts` — Render multi-gold cases, `GUARD` threat rings (`34px`), `HACKER` ECM jamming hex-auras (`55px`), Chrono-Dash trail/cooldown arcs, and arena themes.
- **Modify:** `src/game/audio.ts` — Add speaker-specific radio blip pitches, Chrono-Dash whoosh/tackle impact sound, and ECM jammer hum.
- **Modify:** `src/App.tsx`, `src/components/TitleScreen.tsx`, `src/components/ChapterCard.tsx`, `src/components/NewspaperEnding.tsx`, `src/components/RivalHeistArena.tsx`, `src/components/AssignDutyOverlay.tsx`, `src/components/RivalNewspaperEnding.tsx` — Wire multi-speaker HUD badges, PvP live radio ticker, arena & bot difficulty selectors, and rank-branched newspaper stories.
- **Modify:** `src/game/engine.test.ts` & `src/game/rivalEngine.test.ts` — Full unit test coverage for all 7 story chapters, multi-voice script engine, Chrono-Dash tackle, echo gate/laser rules, Hacker ECM shield, Loop 3/4/6 dynamic drops, and all 3 PvP arenas.

---

### Task 1: Expand Core Types & Multi-Speaker Script Engine

**Files:**
- Modify: `src/types.ts`
- Create: `src/game/scriptEngine.ts`
- Test: `src/game/engine.test.ts`

**Interfaces:**
- Produces in `src/types.ts`:
  - `RadioSpeaker = 'ARCHITECT' | 'VEGA' | 'OSLO' | 'CHRONO_OS'`
  - `RadioTransmission = { speaker: RadioSpeaker; tag: string; color: string; text: string }`
  - `LevelScriptDef = { intro: RadioTransmission; firstEcho?: RadioTransmission; plateActive?: RadioTransmission; goldPickup?: RadioTransmission; laserHitPool: RadioTransmission[]; overPar?: RadioTransmission; urgent?: RadioTransmission }`
  - `RivalArenaId = 'BULLION_HALL' | 'LASER_ROTUNDA' | 'TWIN_VAULTS'`
  - `RivalBotDifficulty = 'OPERATIVE' | 'TACTICIAN' | 'MASTERMIND'`
- Produces in `src/game/scriptEngine.ts`:
  - `resolveStoryRadioTransmission(state: GameState, lastEvent: SimEventType | null): RadioTransmission`
  - `resolveRivalBanter(state: RivalGameState, event: RivalSimEvent): RadioTransmission | null`
  - `getStoryEndingEditorial(stats: RunStatsSnapshot): { stamp: string; headline: string; subhead: string; leadParagraph: string; architectQuote: string }`

- [ ] **Step 1: Write failing tests in `src/game/engine.test.ts` for `resolveStoryRadioTransmission` and `getStoryEndingEditorial`**
- [ ] **Step 2: Run `npx tsx --test src/game/engine.test.ts` to verify failure**
- [ ] **Step 3: Update `src/types.ts` and implement `src/game/scriptEngine.ts`**
- [ ] **Step 4: Run `npx tsx --test src/game/engine.test.ts` to verify pass**

---

### Task 2: Upgrade Story Campaign to 7 Chapters & Multi-Gold Engine Support

**Files:**
- Modify: `src/game/levels.ts`
- Modify: `src/game/engine.ts`
- Modify: `src/game/renderer.ts`
- Test: `src/game/engine.test.ts`

**Interfaces:**
- Consumes: `LevelScriptDef`, `GoldCaseDef` from `src/types.ts`
- Produces:
  - `LEVELS` (7 deterministic chapters in `src/game/levels.ts`: `PLAN ALPHA`, `PLAN MIRROR`, `PLAN DOMINO`, `PLAN MIDAS`, `PLAN ECLIPSE`, `PLAN PARADOX`, `PLAN ZERO`)
  - Updated `GameState.collectedGoldIds: Set<number>` in `src/game/engine.ts` supporting single `goldCase` and multiple `goldCases`
  - Dynamic `computeHeistRank(totalLoopsUsed: number, totalPar?: number): 'S' | 'A' | 'B'`

- [ ] **Step 1: Write failing solvability & geometry tests in `src/game/engine.test.ts` for all 7 chapters (including Dual-Plate AND Gate in Ch 5 and Twin Gold Cases in Ch 6)**
- [ ] **Step 2: Run `npx tsx --test src/game/engine.test.ts` to verify failure**
- [ ] **Step 3: Implement 7 chapters with full `script` blocks in `src/game/levels.ts`, multi-gold tracking in `src/game/engine.ts`, and multi-gold rendering in `src/game/renderer.ts`**
- [ ] **Step 4: Run `npx tsx --test src/game/engine.test.ts` to verify all 7 chapters solve within Par loops under 600 ticks**

---

### Task 3: Create 3 Symmetric PvP Arenas (`src/game/rivalMaps.ts`)

**Files:**
- Create: `src/game/rivalMaps.ts`
- Test: `src/game/rivalEngine.test.ts`

**Interfaces:**
- Consumes: `RivalArenaId`, `Wall`, `Plate`, `Gate`, `SweepingLaser`, `Vec2` from `src/types.ts`
- Produces:
  - `RivalArenaDef = { id: RivalArenaId; name: string; subtitle: string; p1Spawn: Vec2; p2Spawn: Vec2; walls: Wall[]; plates: Plate[]; gates: Gate[]; baseLasers: SweepingLaser[]; loop6ExtraLaser: SweepingLaser; vaultGoldCoords: Vec2[]; corridorDropCoords: Vec2[] }`
  - `RIVAL_ARENAS: Record<RivalArenaId, RivalArenaDef>`
  - `RIVAL_ARENA_LIST: RivalArenaDef[]`

- [ ] **Step 1: Write failing symmetry and clearance tests in `src/game/rivalEngine.test.ts` for all 3 arenas (`BULLION_HALL`, `LASER_ROTUNDA`, `TWIN_VAULTS`)**
- [ ] **Step 2: Run `npx tsx --test src/game/rivalEngine.test.ts` to verify failure**
- [ ] **Step 3: Implement `src/game/rivalMaps.ts` with symmetric coordinates across `x = 480` and `y = 270`**
- [ ] **Step 4: Run `npx tsx --test src/game/rivalEngine.test.ts` to verify pass**

---

### Task 4: Overhaul PvP Simulation Engine (Chrono-Dash/Tackle, Echo Security, ECM Jammer, Dynamic Drops & Bot Tiers)

**Files:**
- Modify: `src/game/rivalEngine.ts`
- Modify: `src/game/rivalRenderer.ts`
- Modify: `src/game/audio.ts`
- Test: `src/game/rivalEngine.test.ts`

**Interfaces:**
- Consumes: `RIVAL_ARENAS` from `src/game/rivalMaps.ts`, `resolveRivalBanter` from `src/game/scriptEngine.ts`
- Produces in `src/game/rivalEngine.ts`:
  - `createInitialRivalState(vsBot?: boolean, arenaId?: RivalArenaId, botDifficulty?: RivalBotDifficulty): RivalGameState`
  - `stepRivalSimulation(state: RivalGameState, p1Input: RivalInputState, p2Input: RivalInputState): RivalSimEvent[]` (where `RivalInputState extends InputState { dash?: boolean }`)
  - Chrono-Dash (`0.18s` duration at `2.1x` speed, `2.5s` cooldown) + Tackle stun (`0.9s`) & gold knock-loose on rival player/Runner contact
  - Echo gate/laser enforcement (`RUNNER` echoes blocked/stunned `1.0s` & drop gold on closed laser gates or sweeping lasers)
  - `HACKER` ECM Jamming Field (`55px` radius: `0.75x` slow on enemies + blocks rival stash theft when covering own stash)
  - `RUNNER` ping-pong trajectory patrol when `tick * 1.2 >= frames.length`
  - Loop 3 Diamond Briefcase (`2 pts`) + Loops 4–5 corridor gold spawns + Loop 6 `20%` laser overdrive & `3-pt` Crown
  - 3 AI Bot difficulty tiers (`OPERATIVE`, `TACTICIAN`, `MASTERMIND`) with Guard avoidance and dash-tackling

- [ ] **Step 1: Write failing unit tests in `src/game/rivalEngine.test.ts` for Chrono-Dash tackle, Runner gate/laser stun, Runner ping-pong patrol, Hacker ECM stash-shield, Loop 3 Diamond Case spawn, and AI Bot tiers**
- [ ] **Step 2: Run `npx tsx --test src/game/rivalEngine.test.ts` to verify failure**
- [ ] **Step 3: Implement all PvP simulation upgrades in `src/game/rivalEngine.ts`, visual telegraphs in `src/game/rivalRenderer.ts`, and sound effects in `src/game/audio.ts`**
- [ ] **Step 4: Run `npx tsx --test src/game/rivalEngine.test.ts` to verify all tests pass**

---

### Task 5: Wire UI Components for Multi-Voice Script, PvP Banter, Arena/Bot Selectors & Endings

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/TitleScreen.tsx`
- Modify: `src/components/ChapterCard.tsx`
- Modify: `src/components/NewspaperEnding.tsx`
- Modify: `src/components/RivalHeistArena.tsx`
- Modify: `src/components/AssignDutyOverlay.tsx`
- Modify: `src/components/RivalNewspaperEnding.tsx`

**Interfaces:**
- Consumes: `resolveStoryRadioTransmission`, `getStoryEndingEditorial`, `RIVAL_ARENA_LIST`, `RivalArenaId`, `RivalBotDifficulty`
- Produces:
  - Color-coded speaker badge in Story HUD (`[THE ARCHITECT]`, `[SWAT // VEGA]`, `[OSLO // RIVAL]`, `[CHRONO-OS]`) with reactive event lines
  - Multi-gold counter in Story HUD when `level.goldCases.length > 1`
  - Arena selector (`BULLION HALL`, `LASER ROTUNDA`, `TWIN VAULTS`) and Bot Difficulty selector (`OPERATIVE`, `TACTICIAN`, `MASTERMIND`) on `TitleScreen` and `RivalHeistArena` pause/rematch modals
  - Live PvP radio banter strip in `RivalHeistArena` header + Dash cooldown HUD indicator (`Space: Dash/Tackle`, `Enter: Dash/Tackle`)
  - Dynamic rank-based editorial copy in `NewspaperEnding.tsx` + direct `"SETTLE THE SCORE: LAUNCH RIVAL HEIST VS OSLO"` CTA button

- [ ] **Step 1: Update `TitleScreen.tsx`, `ChapterCard.tsx`, `NewspaperEnding.tsx`, and `App.tsx` with multi-voice radio comms and 7-chapter progression**
- [ ] **Step 2: Update `RivalHeistArena.tsx`, `AssignDutyOverlay.tsx`, and `RivalNewspaperEnding.tsx` with Dash input (`Space`/`Enter`), arena/difficulty selectors, and live radio banter**
- [ ] **Step 3: Run `npm run lint` (`tsc --noEmit`), `npx tsx --test src/game/engine.test.ts src/game/rivalEngine.test.ts`, and `npm run build` to verify zero errors**
