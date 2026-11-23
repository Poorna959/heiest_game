# Product Requirements Document: PLAN ZERO

**Genre:** 2D Top-Down Stealth-Puzzle Thriller  
**Target Platform:** Desktop Web Browser (React + TypeScript + HTML5 Canvas)  
**Build Environment:** Google AI Studio (Build Mode)  
**Target Build Time:** 8-Hour Hackathon Sprint  

## 1. Executive Summary & Core Vision

**PLAN ZERO** is a single-player, *Money Heist*-inspired time-loop heist game set inside the locked-down **Royal Mint**. You play as **Kyoto**, a lone thief wearing an experimental 10-second chronometer, guided over an encrypted earpiece by **The Architect**.

SWAT is breaching the building, and the Mint's security locks were engineered to require a full heist crew. The Architect never sent a crew—he gave you the watch so your **past 10-second echoes become your team**. Every time the clock runs out (or you trigger a manual rewind), you snap back to the room's entrance while your previous runs replay simultaneously as physical holographic echoes that hold down biometric switches, unlock laser gates, and ultimately serve as a decoy so the real you walks out with the gold.

## 2. Target Experience & Design Pillars

- **Instant Comprehension (15-Second Hook):** Judges understand movement, the 10-second timer, and echo cooperation by the end of Chapter 2 with zero tutorial walls.
- **Prestige Heist Presentation:** Bold crimson-and-charcoal visual identity, 2-second TV-episode chapter cards (`CHAPTER 2 // PLAN MIRROR`), flashing red/blue SWAT siren borders, and a front-page newspaper finale.
- **Deterministic Precision:** A fixed 60 FPS simulation loop guarantees that every echo replays frame-for-frame identically so players can plan tight, rewarding timing chains.
- **Zero External Asset Dependencies:** All visuals render cleanly on HTML5 Canvas, and all sound effects synthesize procedurally via the Web Audio API so the app builds and deploys cleanly in Google AI Studio with zero broken links.

## 3. Narrative & Cast

- **Kyoto (Player):** Silent protagonist in a crimson jumpsuit (`#E63946`) with a stark white mask icon.
- **The Architect (Radio Handler):** Calm, chess-master strategist delivering concise one-line directives through a live typewriter radio bar at the top of the screen.
- **The Twist:** Through Chapters 1–4, The Architect treats your echoes as disposable tools. In Chapter 5 (**Plan Zero**), the final escape tunnel only opens from inside the vault—forcing you to leave an echo behind as a decoy for SWAT while the real Kyoto escapes into the night.

## 4. Core Gameplay Mechanics

### 4.1 Fixed-Timestep Simulation
- **Tick Rate:** Fixed `60 FPS` (`FIXED_DT = 1 / 60` seconds).
- **Loop Duration:** Exactly `10.00` seconds (`600` simulation ticks per loop).
- **Deterministic World:** Moving lasers and animated doors compute their position strictly as a function of the current loop tick `t` (`0 <= t < 600`) so hazards align identically on every loop.

### 4.2 Controls & Movement
- **Move:** `WASD` or `Arrow Keys` (8-directional movement normalized for diagonals, speed `220 px/s`).
- **Collision:** Circle-vs-AABB collision with smooth axis-separated wall sliding so Kyoto never snags on corners.
- **Manual Rewind (`R`):** Immediately saves the current run as an echo (if `t >= 15` ticks) and starts a new loop at `t = 0`.
- **Clear Echoes (`C`):** Wipes all recorded echoes in the current room and resets the loop cleanly if the player makes a mistake.
- **Audio Toggle (`M`):** Mutes or unmutes synthesized audio.

### 4.3 Echo Recording & Playback
- On every tick `t`, the engine records `{ x, y, facing, hasGold }` into `currentRecording[t]`.
- When `t` reaches `600` (or `R` is pressed), `currentRecording` is appended to `echoes[]` (maximum `5` active echoes per room; if a 6th is recorded, the oldest echo is dropped).
- During playback, each echo renders at `echo.frames[Math.min(t, echo.frames.length - 1)]`—meaning if a player ends a loop early at second 6 while standing on a switch, the echo stays anchored at its final position for seconds 6–10.
- Both Kyoto and active echoes have physical presence and activate **Biometric Pressure Plates**.

### 4.4 Interactive Vault Objects

| Entity | Behavior | Visual Representation |
| :--- | :--- | :--- |
| **Vault Wall** | Solid impassable barrier. | Charcoal steel (`#1A1F2B`) with thin slate bevel (`#334155`). |
| **Biometric Plate** | Activates whenever Kyoto or any echo overlaps its bounds; linked by ID to one or more gates. | Glowing floor pad connected by an animated dashed wire to its linked gate; turns bright green (`#22C55E`) when pressed. |
| **Laser Gate** | Blocks passage and kills Kyoto when active; opens smoothly when its linked Biometric Plate is pressed. | Pulsing crimson energy bar (`#EF4444`) between two metal emitters; fades to faint outline when open. |
| **Sweeping Laser** | Patrols along a defined start/end path using a deterministic sine wave synced to tick `t`. Lethal to Kyoto on contact. | Bright red beam with glowing core and moving emitter nodes. |
| **Gold Case** | Required collectible in Chapter 4; unlocks the exit door once picked up. | Shimmering gold bullion briefcase (`#FFD166`) with pulsing halo. |
| **Exit Door / Tunnel** | Completes the chapter when Kyoto steps inside (only active if room requirements are met). | Heavy vault doorway outlined in gold (`#FFD166`) with directional chevron arrows. |

### 4.5 Fail & Rewind States
- **Laser Contact:** Triggers `0.35s` screen shake, red flash, and electric zap sound, then resets the current loop to `t = 0` **without** saving the failed run (existing echoes remain intact so players aren't punished by corrupted ghosts).
- **Timer Expiration (`0.00s`):** Triggers a brief `0.25s` VHS scanline rewind flash and rewind whoosh sound, saves the run as a new echo, and starts the next loop immediately.

## 5. Five-Chapter Level Blueprint

All rooms render on a logical **`960 x 540`** canvas (16x9 aspect ratio, `60px` tile grid, scaled responsively to fit the viewport). Each room is designed to be 100% solvable within the 10-second loop window.

| Chapter | Plan Name | Story Beat & Architect Radio Line | Layout & Solvable Loop Strategy |
| :--- | :--- | :--- | :--- |
| **1. The Print Room** | `PLAN ALPHA` | Alarms trip as SWAT surrounds the Mint. *"Breathe, Kyoto. Ten seconds is an eternity if you spend it twice."* | Spawn left (`x: 90, y: 270`), Exit right (`x: 870, y: 270`). Two offset concrete pillars and one static laser divider with a clear S-curve path. **Solvable in 1 loop (~5s).** Teaches movement and timer urgency. |
| **2. Biometric Gate** | `PLAN MIRROR` | A two-person security lock seals the bullion hall. *"The Mint expects a crew. Let ten-seconds-ago-you hold the door."* | Biometric Plate A sits in the top-left alcove (`x: 240, y: 120`); linked Laser Gate A blocks the right corridor (`x: 690, y: 210–330`) leading to the Exit. **Loop 1:** Run to Plate A and hold until rewind. **Loop 2:** Sprint straight through open Gate A to Exit. |
| **3. The Laser Cage** | `PLAN DOMINO` | Sweeping beams guard the inner vault override. *"Three of you in the same room. Now we have a real heist."* | Plate A (top-left) opens Gate A guarding Plate B (bottom-center). Plate B opens Gate B guarding the Exit (far right). A sweeping laser patrols vertically across the middle lane. **Loop 1:** Hold Plate A. **Loop 2:** Pass Gate A and hold Plate B. **Loop 3:** Time the sweeping laser and run through Gate B to Exit. |
| **4. The Gold Vault** | `PLAN MIDAS` | Grabbing the bullion triggers lockdown shutters. *"You have the gold. Don't celebrate—SWAT just breached the lobby."* | Gold Case rests in the top-right chamber behind Gate A (linked to Plate A in bottom-left). Exit Door (bottom-right) requires carrying the Gold Case AND opening Gate B (linked to Plate B in top-center), with one sweeping laser patrolling the central hall. **Loop 1:** Hold Plate A. **Loop 2:** Hold Plate B. **Loop 3:** Dash past Gate A, grab the Gold Case, and escape through Gate B. |
| **5. The Decoy** | `PLAN ZERO` | SWAT closes in on the tunnel; someone must hold the override from inside. *"Plan Zero, Kyoto. Leave a ghost for the police—and walk out rich."* | Central glass-walled **Decoy Chamber** holds the Override Plate (`x: 450, y: 270`) linked to the final **Blast Door** (`x: 780`) guarding the Escape Tunnel (`x: 880, y: 270`). **Loop 1:** Run into the Decoy Chamber and hold the Override Plate. **Loop 2:** Dash past a sweeping security beam and into the Escape Tunnel. Stepping inside triggers a **2-second cinematic freeze-frame** as the Blast Door slams shut, spotlighting your trapped echo before cutting to the newspaper ending. |

## 6. Visual Design, HUD & Game Feel

### 6.1 Color Palette
- **Vault Floor:** `#0B0D12` with subtle `60px` architectural grid lines (`#141923`).
- **Walls & Pillars:** `#1A1F2B` fill, `#334155` crisp 2px border.
- **Kyoto (Live Player):** `#E63946` crimson jumpsuit with `#F8FAFC` white mask dot and subtle directional glow.
- **Echoes (Past Runs):** Semi-transparent `#38BDF8` cyan-rimmed crimson ghosts (`opacity: 0.48`) with a faint trailing ribbon and numbered badge (`#1`, `#2`, etc.).
- **Gold Loot & Exits:** `#FFD166` warm metallic gold.
- **Active Switches:** `#22C55E` emerald green.
- **Lasers & Alerts:** `#EF4444` neon red.

### 6.2 HUD & Screens
1. **Title Screen:** Dark blueprint background, bold red/white typography (`PLAN ZERO`), 2-sentence hook, quick control icons, and a prominent **"START HEIST"** button.
2. **Chapter Card Overlay (2.0s):** Full-screen crimson slash card displaying `CHAPTER X // PLAN NAME` with a crisp percussive hit before fading into gameplay (skippable with Space/Click).
3. **In-Game HUD:**
   - **Top Radio Bar:** Dark translucent strip with pulsing red `REC` dot, `[THE ARCHITECT]` label, and typewriter-animated dialogue line.
   - **Top-Right Chronometer:** Large monospaced `10.00s` countdown timer (turns crimson and pulses under `3.00s`), active Loop counter, and 5 visual Echo slots (`● ● ○ ○ ○`).
   - **SWAT Siren Vignette:** Subtle red-left / blue-right pulsing screen border whenever the timer drops below `3.00s`.
   - **Bottom Control Strip:** Minimal single-line legend (`WASD / Arrows: Move  •  R: Rewind Loop  •  C: Clear Echoes  •  M: Audio`).
4. **Front-Page Newspaper Ending (`THE ROYAL CHRONICLE`):**
   - Styled like a vintage high-contrast broadsheet with crimson stamp accents.
   - **Headline:** *"ROYAL MINT ROBBED — POLICE SEALED IN WITH A GHOST"*
   - **Stats Block:** Total Loops Used, Echoes Left Behind, Total Heist Time, and Heist Rank (`S` for ≤ 10 loops, `A` for ≤ 15 loops, `B` for 16+ loops).
   - **Actions:** `REPLAY HEIST` button and `JUMP TO CHAPTER` selector so judges can replay any room instantly.

## 7. Procedural Audio Spec (Web Audio API)

Implement a lightweight, zero-dependency `soundEngine.ts` initialized on the first user click/keypress:
- **Chronometer Tick:** Soft metallic click every second; doubles in tempo and pitch during the final 3 seconds.
- **Biometric Switch Click:** Crisp dual-tone positive chime when pressed; low dull thud when released.
- **Loop Rewind:** Filtered white-noise sweep + descending synth pitch (`0.25s`).
- **Laser Zap:** Short sawtooth buzz with rapid pitch drop on collision.
- **Gold Pickup:** Bright ascending arpeggio triad.
- **Chapter Slam:** Deep sub-bass thump when chapter cards appear and when the Chapter 5 Blast Door seals.
- **Radio Blip:** Very quiet soft beep synced to typewriter characters in The Architect's banner.

## 8. Recommended Technical Architecture (Google AI Studio)

Structure the generated React + TypeScript project into clean, decoupled modules so iterative prompting in AI Studio stays fast and bug-free:

- `src/types.ts` — Interfaces for `LevelDef`, `Wall`, `Plate`, `Gate`, `SweepingLaser`, `EchoRecording`, and `GameState`.
- `src/game/levels.ts` — Declarative definitions for all 5 chapters, radio scripts, coordinates, and links between plates and gates.
- `src/game/audio.ts` — Self-contained Web Audio API procedural sound synthesizer.
- `src/game/engine.ts` — Fixed-timestep (`60 FPS`) update loop, circle-vs-AABB sliding physics, echo recording/playback, and win/loss detection.
- `src/game/renderer.ts` — HTML5 Canvas rendering for the architectural floor grid, animated plate-to-gate wiring, lasers, Kyoto, holographic echoes, particles, and siren vignette.
- `src/components/TitleScreen.tsx` — Start screen with heist briefing and controls.
- `src/components/ChapterCard.tsx` — 2-second crimson chapter transition overlay.
- `src/components/NewspaperEnding.tsx` — Front-page broadsheet debrief with rank and replay controls.
- `src/App.tsx` — Top-level state machine (`TITLE` → `CHAPTER_CARD` → `PLAYING` → `FREEZE_FRAME` → `ENDING`) hosting the Canvas and HUD.

## 9. Acceptance Criteria (Hackathon Definition of Done)

- [ ] All 5 chapters load cleanly, display their chapter card and Architect radio line, and are 100% completable within 10-second loops.
- [ ] Echoes replay deterministically at 60 FPS and reliably hold down biometric plates even after manual `R` rewind.
- [ ] Touching an active laser resets only the current run without corrupting previously saved echoes.
- [ ] Pressing `C` clears echoes cleanly in the current room without breaking level state.
- [ ] Chapter 5 plays the 2-second blast-door freeze-frame before displaying the newspaper ending with accurate loop/echo statistics.
- [ ] Zero console errors, zero external asset 404s, and responsive layout on standard laptop screens (`1280x720` and `1440x900`).

## 10. Optional Stretch Goals (Only After Core 5 Rooms Are Shipped)

1. **Gemini-Powered Dynamic Architect Radio:** Wire the Gemini API into The Architect's earpiece so that if the player dies to a laser or exceeds 4 loops in a room, The Architect delivers a short, context-aware remark referencing the room name and loop count (keeping the 5 core chapter intros hardcoded for instant zero-latency playback).
2. **Speedrun Ghost Par:** Display a "Mastermind Par" loop count per chapter (1 / 2 / 3 / 3 / 2) to challenge replayability.
