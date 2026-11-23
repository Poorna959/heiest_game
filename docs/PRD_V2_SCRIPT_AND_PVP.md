# Product Requirements Document (PRD): PLAN ZERO v2.0 — Narrative Script & Tactical PvP Overhaul

**Project:** PLAN ZERO (`heiest_game`)  
**Genre:** 2D Top-Down Time-Loop Stealth-Puzzle & Tactical PvP Heist Thriller  
**Platform:** Desktop Web Browser (React 19 + TypeScript + HTML5 Canvas + Web Audio API)  
**Status:** Drafted for Review  

---

## 1. Executive Summary & Vision

**PLAN ZERO** already delivers a crisp 60 FPS deterministic 10-second time-loop foundation where players record holographic echoes of their past runs to solve vault locks (Story Mode) or clash in a 6-loop head-to-head heist against a local player or AI bot (Rival Heist PvP).

However, a deep audit of the current build reveals two major opportunities to elevate the game from a hackathon prototype to a complete, replayable heist thriller:

1. **The Script & Narrative Experience (`Story Mode` + Cross-Mode Lore):**
   - Currently, each chapter only has 2 static lines (`radioLine` and `secondaryRadioLine`), with zero reactive commentary on laser deaths, gold pickups, echo milestones, timer urgency, or going over Par.
   - **Oslo** (the rival chronometer thief in PvP) is never introduced in the Story campaign, and **SWAT Commander Vega** never intrudes on the radio frequency to raise the stakes.
   - The 5 chapters lack pre-mission intelligence dossiers, mid-room reactive dialogue banter, and performance-driven narrative endings (e.g., *True Mastermind / Ghost Protocol* vs. *Compromised Escape*).

2. **The PvP Experience (`Rival Heist Mode` — 2P Local & vs. AI Bot):**
   - **Broken Gate/Laser Rule for Echoes:** Currently, `RUNNER` echoes completely ignore closed laser gates and sweeping lasers, bypassing the need for `HACKER` echoes.
   - **No Direct Player-vs-Player Interaction:** Live players (`Kyoto` and `Oslo`) pass right through each other with no way to tackle, stun, or contest a live carrier holding the 3-point Crown.
   - **Mid-Match Vault Drought (Loops 3–5):** Once the 6 initial gold bars are banked in Loops 1–3, the central Royal Vault sits empty until Loop 6.
   - **Static Single Arena & Single Bot Tier:** Only one map layout exists, `GUARD` echoes lack visible threat telegraphs, `HACKER` echoes lack utility off-plates, and the AI Bot (`Oslo`) does not dodge enemy Guards or adapt its strategy by difficulty.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals
- **Reactive Multi-Voice Radio Script Engine:** Transform the top HUD radio bar into an event-driven comms channel featuring **The Architect**, **Kyoto (Chrono-Log)**, **Inspector Vega (SWAT Tactical)**, and **Oslo (Rival Intercept)** responding dynamically to gameplay events (`LASER_HIT`, `GOLD_PICKUP`, `PLATE_ON`, `REWIND`, `OVER_PAR`, `FINAL_DECOY`).
- **Expanded Story Campaign & Narrative Continuity:** Enrich the existing 5 chapters with multi-beat dialogue scripts and introduce **2 new late-game Story Chapters (Chapters 6 & 7)** that bridge directly into Rival Heist by introducing Oslo's rival breach and a multi-lock vault showdown.
- **High-Stakes Tactical PvP Combat & Counter-Play:**
  - Give live players an active **Chrono-Dash / Shoulder Tackle** ability (`Space` / `Left Shift` for P1, `Enter` / `Right Shift` for P2) on a cooldown to burst-dodge lasers or knock gold loose from a rival carrier.
  - Enforce vault security on echoes (`RUNNER` echoes are blocked by closed laser gates and stunned by sweeping lasers, making `HACKER` gate timing essential).
  - Upgrade Echo Roles (`GUARD` visible stun aura + patrol radius, `HACKER` biometric plate lock + ECM jamming field that slows enemies/disables rival stash alarms, `RUNNER` 1.2x speed + auto-return loop patrol instead of freezing at frame 600).
- **Dynamic Per-Loop Vault Events & Multiple Arenas:** Keep Loops 1–6 continuously contested with mid-match bullion drops, EMP surge events, and **3 selectable PvP Arenas** (*Royal Bullion Hall*, *The Laser Rotunda*, *Crossfire Twin-Vaults*).
- **Smarter AI Bot Tiers:** Upgrade `Oslo` AI with 3 selectable difficulty profiles (`OPERATIVE`, `TACTICIAN`, `MASTERMIND`), Guard-avoidance steering, and defensive Guard deployment when defending a lead.

### 2.2 Non-Goals
- Online WebSocket/WebRTC multiplayer matchmaking (keep 100% deterministic local 2P + vs. AI Bot in-browser with zero backend server dependencies).
- External image/audio asset dependencies (all visuals remain pure HTML5 Canvas + SVG and all audio remains 100% procedural Web Audio API).

### 2.3 Anti-Goals
- **No Unskippable Cutscene Walls:** Every story beat must play inline via the live HUD radio bar or skippable 2-second dossier cards so speedrunners are never slowed down.
- **No Non-Deterministic Physics:** Every simulation change in Story and Rival modes must remain strictly deterministic at a fixed `60 FPS` (`FIXED_DT = 1/60`).

---

## 3. Part I: Script & Story Mode Improvements

### 3.1 Cast & Voice Profiles
| Speaker | Tag & HUD Accent | Personality & Role |Audio Signature |
| :--- | :--- | :--- | :--- |
| **The Architect** | `[THE ARCHITECT]` (`#E63946` Crimson) | Cold, surgical mastermind who engineered the 10-second chronometer. Views echoes as expendable pawns. | Crisp high-mid radio blip (`1020 Hz`). |
| **Inspector Vega** | `[SWAT // VEGA]` (`#3B82F6` Police Blue) | Lead tactical commander breaching the Royal Mint perimeter; intercepts your comms starting in Chapter 3. | Gritty low-band walkie static + dual-tone police chirp (`680 Hz`). |
| **Oslo** | `[OSLO // RIVAL]` (`#38BDF8` Cobalt Cyan) | Former protégé of The Architect wearing a stolen second chronometer; hacks the channel in Chapters 5–7 & Rival Mode. | Sharp encrypted digital synth blip (`1340 Hz`). |
| **Chrono-System** | `[CHRONO-OS]` (`#FFD166` Amber Gold) | Automated suit telemetry announcing paradox alerts, par thresholds, and lockdown overrides. | Clean telemetry harmonic ping (`880 Hz`). |

### 3.2 Event-Driven Radio Comms System (`src/game/scriptEngine.ts`)
Replace the static 2-line lookup in `App.tsx` with a priority queue & trigger table per chapter:
1. **`LOOP_START (Loop 1)`:** Primary briefing establishing the room's narrative stakes and tactical objective.
2. **`FIRST_REWIND (Loop 2)`:** Reaction to the player deploying their first echo in the chapter.
3. **`PLATE_UNLOCK` / `OBJECTIVE_PROGRESS`:** Contextual callout when a key gate opens or secondary lock disengages.
4. **`GOLD_SECURED`:** High-tension callout when bullion is picked up (triggers SWAT breach escalation).
5. **`LASER_HIT` (Rotating pool of 3+ lines per chapter):** Sharp remark from The Architect or taunt from Oslo/Vega when Kyoto is vaporized by a laser.
6. **`OVER_PAR` (`loopNumber > parLoops`):** Pressure line urging Kyoto to tighten the loop chain or press `C` to wipe corrupted echoes.
7. **`URGENT_TIMER` (`remaining < 2.5s` on critical loops):** Rapid one-line warning as the chronometer destabilizes.

### 3.3 Upgraded 7-Chapter Campaign Arc
We retain and polish the 5 core chapters while adding **Chapters 6 and 7** to deepen the puzzle mechanics and directly set up the **Rival Heist** showdown with Oslo:

| Ch | Title & Plan | Par | Narrative Beat & Script Arc | New / Upgraded Mechanics |
| :- | :--- | :-: | :--- | :--- |
| **1** | **The Print Room**<br>`PLAN ALPHA` | 1 | Alarms trip across Madrid. The Architect tests your chronometer calibration as SWAT vans surround the perimeter. | Refined S-curve with laser warning telemetry and reactive death/urgency voice lines. |
| **2** | **Biometric Gate**<br>`PLAN MIRROR` | 2 | The bullion hall demands a two-man turn-key. You realize the Architect sent no crew—you are the crew. | First echo deployment dialogue beat + visual ghost-sync tutorial prompt. |
| **3** | **The Laser Cage**<br>`PLAN DOMINO` | 3 | Inspector Vega hacks your radio channel, warning that thermal sensors detect *three* heat signatures in a sealed vault. | Multi-speaker banter (`[THE ARCHITECT]` vs. `[SWAT // VEGA]`) as you chain Plates A & B. |
| **4** | **The Gold Vault**<br>`PLAN MIDAS` | 3 | Lifting the bullion briefcase trips the seismic lockdown. Vega orders heavy breach charges on the outer doors. | Picking up the Gold Case triggers an immediate radio intercept and alarm lighting shift. |
| **5** | **The Signal Hijack**<br>`PLAN ECLIPSE` *(NEW)* | 3 | A second chronometer signature spikes on the Mint's grid. **Oslo** breaks into your earpiece—he's robbing the East Wing simultaneously. | **Dual-Plate AND Gate** (`gate-ab` requires *both* `plate-a` and `plate-b` held simultaneously by two echoes while Kyoto threads twin sweeping lasers). |
| **6** | **The Crossfire Vault**<br>`PLAN PARADOX` *(NEW)* | 4 | Oslo sabotages the primary lift. You must collect **two** Gold Cases (North & South vaults) using a 3-echo relay before the shutters seal. | **Multi-Loot Requirement** (Echoes or Kyoto must unlock both wings; teaches route optimization under the 10s ceiling). |
| **7** | **The Decoy**<br>`PLAN ZERO` | 2 | SWAT breaches the final corridor. The Architect reveals the truth behind Plan Zero: leave a holographic ghost locked in the glass chamber for Vega while you walk out rich—and head to the Royal Vault to settle the score with Oslo. | Climactic 2-second Blast Door slam freeze-frame + direct post-credits unlock/bridge into **Rival Heist (Kyoto vs. Oslo)**. |

### 3.4 Multiple Narrative Newspaper Endings (`NewspaperEnding.tsx`)
Instead of a single static article, `THE ROYAL CHRONICLE` dynamically adapts its headline, sub-headline, lead investigative story, and Architect post-script based on the player's **Mastermind Rank**:
- **Rank `S` (True Mastermind / Ghost Protocol — At or below total Par loops):** *"PHANTOM OF MADRID: ROYAL MINT EMPTIED WITHOUT A SINGLE TRACE"* — Vega admits forensics found zero physical footprints; Oslo leaves a cryptic challenge note.
- **Rank `A` (Clean Heist — Within +5 of Par):** *"ROYAL MINT ROBBED — POLICE SEALED IN WITH A GHOST"* — Classic cinematic heist getaway.
- **Rank `B` (Chaotic Escape — 6+ loops over Par):** *"CHRONO-ANOMALY AT THE MINT: FORTY GHOSTS BAFFLE SWAT IN MESSY HEIST"* — Highlights the temporal chaos and narrow escape.

---

## 4. Part II: PvP (`Rival Heist`) Overhaul

### 4.1 Core Combat & Movement Mechanics

#### 4.1.1 Active Ability: Chrono-Dash / Tackle (`Space` for P1, `Enter` for P2)
- **Mechanic:** Pressing the action key triggers a `0.18s` high-speed burst (`2.1x` movement speed) in the player's facing direction with a `2.5s` cooldown.
- **Offensive Counter-Play (Live Tackle):** If a dashing player collides with the rival live player (`P1` vs `P2`) or an enemy `RUNNER` echo:
  - The hit target is knocked back, stunned for `0.9s`, and **drops any carried gold bar or Crown onto the floor**.
  - The tackler receives brief steal priority so active interception in the open field is rewarding and skill-based.
- **Defensive Utility:** Allows clutching past a sweeping laser or escaping an incoming `GUARD` echo.
- **HUD & Canvas Telegraph:** A small cooldown arc beneath the player sprite and key prompt in the HUD footer (`Space: Dash/Tackle` · `Enter: Dash/Tackle`).

#### 4.1.2 Enforcing Vault Security on Echoes
- **Closed Laser Gates Block/Zap Echoes:** If a `RUNNER` echo hits a closed Laser Gate (`openProgress < 0.4`) or a Sweeping Laser:
  - The `RUNNER` echo drops any carried gold onto the floor and suffers a `1.0s` temporal glitch stun.
  - **Tactical Consequence:** Players can no longer spam `RUNNER` echoes through closed gates; they *must* maintain a `HACKER` echo on their plate (or time the enemy's `HACKER` window) to keep the vault corridor open.

#### 4.1.3 Deepened Echo Duties (`GUARD`, `HACKER`, `RUNNER`)
| Duty | Upgraded Behavior | Visual Telegraph on Canvas |
| :--- | :--- | :--- |
| **1. GUARD** (`Shield`) | Patrols recorded path. Stuns rival live player or rival `RUNNER` echoes within a `34px` enforcement radius for `1.2s` and knocks gold loose. If recording ended early, stands watch at final anchor point with a `1.15x` widened guard zone. | Pulsing team-colored tactical threat ring (`34px` radius) so players can clearly judge spacing. |
| **2. HACKER** (`Terminal`) | Activates biometric plates to open linked vault laser gates **AND** projects a `55px` **ECM Jamming Field**: rival players/runners inside the field move `25%` slower, and if placed on the player's own Stash, prevents rival stash-stealing while the Hacker is alive on the stash! | Animated hexagonal/dashed cyber-ring (`55px`) with rotating data nodes when hacking or jamming. |
| **3. RUNNER** (`Zap`) | Replays at `1.2x` speed, auto-loots vault/floor/rival stash, and **Ping-Pong Patrols**: once it reaches the end of its recorded frames before `10.00s`, it reverses back along its recorded path toward its home stash instead of standing frozen! | Speed trail ribbon + directional chevron badge. |

### 4.2 Dynamic 6-Loop Match Pacing & Vault Events
To eliminate the Loops 3–5 "empty vault" problem, the Royal Vault escalates across three match phases:
- **Loops 1–2 (The Breach):** 6 standard Gold Bars (`1 pt` each) inside the vault + 1 sweeping laser. Players establish their initial `HACKER` and `RUNNER` lines.
- **Loop 3 (Bullion Drop & Diamond Case):** If fewer than 3 gold bars remain in the vault, an automated vault elevator drops **2 fresh Gold Bars (`1 pt`) + 1 Diamond Briefcase (`2 pts`)** in the center chamber, announced via banner and radio voice line.
- **Loop 4–5 (Security Overdrive):** Sweeping laser speed increases by `20%`, and **2 lateral Floor Bullion caches (`1 pt`)** spawn in the top and bottom bypass corridors to spark flanking clashes and Guard ambushes.
- **Loop 6 (Plan Zero Climax — Crown & Dual Lasers):** The **3-Point Royal Crown** spawns in the center pedestal alongside the **2nd perpendicular Sweeping Laser** for a high-stakes sudden-death finale.

### 4.3 Three Selectable PvP Arenas (`src/game/rivalMaps.ts`)
Players can choose from 3 symmetric tactical arenas on the Title Screen / Pause Menu / Rematch Screen:
1. **SECTOR I: ROYAL BULLION HALL (Classic Balanced):** Center vault with left/right laser gates, diagonal plates A & B, and top/bottom bypass highways.
2. **SECTOR II: THE LASER ROTUNDA (High-Hazard Crossfire):** Open circular/octagonal center vault with 4 corner entry gates and dual rotating/crisscrossing sweeping beams—favors fast `RUNNER` chains and precise Dash dodges.
3. **SECTOR III: TWIN LOCKDOWN VAULTS (Split-Objective):** Two separate North and South mini-vaults plus a central bridge; Plate A (bottom-left) opens the North Vault while Plate B (top-right) opens the South Vault, forcing cross-map overlap between Kyoto and Oslo on every single loop.

### 4.4 Upgraded AI Bot (`Oslo`) with 3 Difficulty Tiers
- **`OPERATIVE` (Casual):** Standard pathing, occasional delay before picking duties, does not use Chrono-Dash tackle.
- **`TACTICIAN` (Default):** Smart Loop 1 `HACKER` deployment, dodges active lasers and enemy `GUARD` rings, uses Chrono-Dash to secure the Diamond Briefcase / Crown.
- **`MASTERMIND` (Hard):** Predicts player stash-raids, deploys a defensive `GUARD` or `HACKER` on its own stash when ahead by 2+ points, actively hunts and tackles a Crown-carrying P1, and optimizes ping-pong `RUNNER` trajectories.

### 4.5 Live PvP Radio Banter Strip
Add a compact live commentary ticker to the Rival Heist HUD header where **The Architect**, **Kyoto**, and **Oslo** exchange short, punchy 1-line trash talk on key events:
- *Stash Raid:* `[OSLO] "Left your back door wide open, Kyoto."`
- *Guard Stun:* `[THE ARCHITECT] "Walked right into a five-second-old trap."`
- *Tackle Hit:* `[KYOTO] "Drop the bullion, Oslo. That chronometer is mine."`
- *Loop 6 Crown:* `[THE ARCHITECT] "Sixty seconds up. The Royal Crown is live—take it all."`

---

## 5. Success Metrics & Verification Criteria

1. **Deterministic Integrity:** All existing and new unit tests in `src/game/engine.test.ts` and `src/game/rivalEngine.test.ts` pass at 60 FPS with zero non-deterministic drift.
2. **Solvability Proof:** Automated test suite proves all **7 Story Chapters** are 100% solvable within `parLoops` under the 600-tick (10.00s) window.
3. **PvP Counter-Play Proof:** Automated test suite verifies:
   - Chrono-Dash speed burst, cooldown, and tackle stun + gold drop on contact.
   - `RUNNER` echoes are stopped/stunned by closed laser gates unless a `HACKER` or player holds the linked plate.
   - `RUNNER` ping-pong return pathing when reaching the end of frames early.
   - `HACKER` ECM jamming aura prevents rival stash theft when stationed on own stash.
   - Loop 3 Diamond Briefcase (`2 pts`) and Loop 6 Royal Crown (`3 pts`) spawn deterministically.
   - All 3 PvP Arenas load symmetrically (`p1.x + p2.x === 960`) with zero wall-spawn overlaps.
4. **Build & Type Safety:** `npm run lint` (`tsc --noEmit`) and `npm run build` succeed with zero errors.
