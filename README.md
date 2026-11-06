# J2Grows

**Grow. Discover. Experiment. Evolve.**

A premium botanical genetics and laboratory management simulator. You begin with a single growing room and a
handful of houseplants and end up running a research institution that breeds, edits and catalogues rare plants.
One-time purchase in spirit: no microtransactions, no energy timers, no pay-to-win.

This repository contains the complete game: a deterministic simulation engine (`src/engine`) and a React +
TypeScript interface (`src/ui`) with a dark botanical glass look. The collection is **99 aroids** (Alocasia,
Anthurium, Monstera, Philodendron), each shown with its own hero artwork.

## Run it

```bash
npm install
npm run dev          # Vite dev server
npm run build        # type-check + production build into dist/
npm test             # engine tests (node:test via tsx)
npm run e2e          # builds, then clicks through the game in headless Chromium (needs Playwright's browser)
```

No Vite? `bun scripts/build-bun.ts` produces the same static site in `dist/` using only Bun, React and the
files in this repo. The result is a plain static site: just open `dist/index.html` in a browser (or host the folder anywhere).

Everything is client side. The game saves to the browser's local storage every 15 seconds (key
`j2grows.save.v1`), keeps three rolling backups, repairs damaged saves on load, and refuses to let two tabs
overwrite each other. You can export / import a save as text, or sign in with an email code to keep a cloud copy
(see *Cloud saves and playtesting* below).

## What is in the game

| Area | What you do |
| --- | --- |
| **Cultivation** | Grow rooms with their own light, temperature, humidity, airflow and feed settings. Each of the 99 aroids has its own ideal band (shown on every slider), preferred medium, watering rhythm and hunger. Plants get thirsty, hungry, infected, rootbound or scorched. |
| **Genetics** | 12 diploid genes (growth rate, leaf size, shape, colour, variegation, roots, environmental tolerance, water and nutrient need, disease resistance, propagation efficiency, mutation potential). Alleles carry a value and a dominance, so recessives hide and reappear. Scan plants to reveal their genome (visual, phenotype, both alleles), predict a cross with the Mendelian preview, then breed. |
| **Propagation** | Seed, stem and leaf cuttings, division, cloning chambers, tissue culture (with contamination and somaclonal variation), cross-pollination, interspecific and intergeneric hybridisation. |
| **Tissue Culture** | A sterile pipeline (initiation, multiplication, rooting, acclimatisation) that turns one mother plant into dozens of plantlets, at some risk. |
| **Research** | A 70-technology tree in eight branches (genetics, cultivation, propagation, mutation, automation, commercial production, species discovery, plus a late-game Synthetic Botany branch). Projects cost research points, money and time and several can run in parallel. |
| **Laboratory** | Six facility stages, from a *Personal Growing Room* to an *Advanced Research Institution*. Four independently upgradeable departments (Cultivation, Tissue Culture, Genetics, Research) plus facility upgrades, and staff (growers, lab technicians, geneticists, researchers, sales managers) with wages and training. |
| **Market** | Buy stock, sell plants, take collector contracts, watch per-species prices move with demand and events, register named cultivars that earn royalties (up to three per species, one per trait line, a small trickle each). Stock bought from the shop resells for at most 60% of what it cost, so buying to flip does not pay. |
| **Collection** | A real-species database with discovery progress, a codex of 68 discoveries (novel alleles, rare traits, record specimens…), a hall of fame of the finest plants you have bred, and every plant's individual history. |
| **Automation** | Watering, feeding, treatment, climate control, analysis, planting, propagation, harvesting and selling, each unlocked by research and driven by a shared action budget plus your staff. Auto-sell has rules (minimum value, keep analysed plants, hold when demand is low). |
| **Goals** | An opening guide for new players, a "what next?" advisor that reads the whole game state, 42 achievements (they unlock colour themes, never power), and **plant shows**: a themed show opens every half hour, you enter your best plant and it is judged against three rivals. |
| **Plant diagnosis** | Every plant card explains why a plant is struggling in plain language (wrong light, too wet, fungus...) and what to change, worst problem first. |
| **Big collections** | Filter, sort and search the plants in a room, select many at once to water, feed, treat, sell or discard, and see the run's money, research, income and plant count as charts. |
| **Sound and display** | Synthesised sound effects and ambience (no audio files), reduce-motion, interface size, and colour themes. A manual (the ? button) covers care, genetics, analysis and the market. |
| **Idle play** | Closing the tab does not stop the lab. On return you get a *Welcome back* report: up to 4 hours (extendable) are simulated at 50% efficiency (also improvable). Outbreaks do not begin while you are away unless conditions are genuinely poor, and plants are never lost offline. |
| **Legacy (prestige)** | The first reset is the end of the main game: reach Stage 6, finish the whole core research tree and earn $50M in the run. You then hand on the legacy: reset the facility for Legacy Points spent on permanent upgrades (research output, discovery rewards, growth speed, offline time, prices, mutation, tissue culture…). Discoveries, the collection, cultivars and statistics are kept, and only discoveries you have not already been paid for add to the next reset's points. After the first reset you can start a run under a **challenge** (Bootstrap, Blight Year, Drought and Famine, Austerity); clearing it pays bonus points once. |

### A good first ten minutes

1. **Market:** buy a young Philodendron Brasil (cheap, forgiving) and a second plant.
2. **Cultivation:** click an empty slot, plant it, then water and feed when the bars drop.
3. Sell mature plants. Grow towards **10 matured plants and $400** for Stage 2 (*Propagation Facility*).
4. **Research:** cuttings and watering automation come first. Take cuttings from mature plants (mark good ones as *mother*).
5. Stage 3 (*Genetics Laboratory*) unlocks scanning and breeding. Start crossing your best plants.

## Architecture

```
src/
  engine/        Pure TypeScript. No DOM, no React, no timers. Everything the game *is*.
    types.ts       The plain-JSON GameState (mutated in place; seeded RNG lives in the state)
    genetics.ts    Genes, alleles, dominance, expression, recombination, mutation, phenotypes
    species.ts     The Species type, hybrids and compatibility; builds the 99 species from aroids.ts
    aroids.ts      The 99 aroids: one row each (ids are the artwork folder names) plus husbandry archetypes
    plants.ts      The per-plant simulation: water, nutrients, roots, disease, health, growth
    care.ts        Manual actions (water, feed, treat, repot, move, flag, discard)
    propagation.ts Seeds, cuttings, cloning, tissue culture, breeding and the breeding estimator
    research.ts    Tech projects        techs.ts  The 70-tech tree and its effects
    discoveries.ts Discovery rules      lab.ts    Stages, departments, rooms, staff, upgrades
    economy.ts     Pricing, market, contracts, selling, soft-lock rescue
    automation.ts  Auto systems and the action budget
    prestige.ts    Legacy resets        mods.ts   Derived modifiers recomputed from upgrades/techs/staff
    tick.ts        step(), run() and the offline simulation
    save.ts        Serialise / deserialise / export / import, repair of damaged saves, rolling backups
    guide.ts       The opening guide and the "what next?" advisor (pure functions of the state)
    achievements.ts, shows.ts, challenges.ts, series.ts, diagnose.ts   Goals, plant shows, challenge runs, run history, plant diagnosis
  store.ts       Browser store: game clock, autosave, tab lock, toasts, UI navigation state
  cloud.ts       Cloud saves over Supabase Auth (email code) and REST, plain fetch
  telemetry.ts   Local milestone log, feedback report and opt-in anonymous statistics
  tablock.ts     Keeps a second tab from overwriting the save
  ui/            React 19 function components, plain CSS (no UI library)
    artwork.ts     Supabase storage URLs, fallbacks, the Artwork setting
    HeroArt.tsx    Plant pictures (tinted by genes and health) and the logo / banner components
    PlantArt.tsx   Chooses picture or drawing; the procedural SVG plants live here
    brand.ts       Sets the browser tab icon from the logo
    audio.ts       Web Audio sound effects and ambience     prefs.ts  Per-device preferences
    manual.ts      The in-game manual                       charts.tsx  SVG line charts
scripts/         bot.ts + balance-sim.ts (pacing), pacing-guard.ts (CI), playtest-report.ts, gene-stats.ts,
                 make-save.ts, smoke.ts, build-bun.ts, shoot.cjs (screenshots), e2e.cjs (browser click-through)
tests/           engine.test.ts, species.test.ts, economy.test.ts, progress.test.ts
supabase/        migrations/001_*.sql: cloud saves and opt-in statistics (review, then apply)
docs/            PLAYTEST.md (how to run a playtest), RELEASE.md (release checklist and store copy)
.github/         workflows/ci.yml: typecheck, tests, pacing guard, build, browser test; weekly full pacing run
```

Design notes:

* **Deterministic and headless.** The engine takes `(state, dt)` and nothing else; time, randomness and saves are
  all explicit, so the same seed gives the same game. That is what makes the offline simulation, the balance bot
  and the tests possible.
* **Growth runs on real seconds** with a cosmetic in-game day (`DAY = 60`). Offline time is simulated by the
  same `step()` in coarse sub-steps, capped and discounted by research and legacy upgrades.
* **Discoveries are credited per (discovery, species)** so there is always something new in a species you
  have not yet explored, and analysis levels (0 visual → 3 full genome) gate what you can *see*, never what
  the plant *is*.
* **Balance is measured, not guessed.** `npm run balance` plays a goal-driven bot through the game, checking in
  every few seconds like an attentive player. The target is **80-100 hours of play before the first Legacy
  reset**. Measured with that bot (three seeds): Stage 2 after ~0.4 h, Stage 3 ~2-3 h, Stage 4 ~11-12 h,
  Stage 5 ~26-29 h, Stage 6 ~52-57 h, the whole core research tree ~78-86 h, which is when the reset opens
  (with around 150 Legacy Points on the first reset). A player who checks in only every half minute or so
  lands near 100 h. Offline time counts at 50% efficiency, so leaving the game running is slower than playing.

## Cloud saves and playtesting

Cloud saves and the anonymous statistics both need two tables that are **not created automatically**: review
and run `supabase/migrations/001_cloud_saves_and_telemetry.sql` in the Supabase SQL editor, and enable email
sign-in (one-time code) under Authentication. Until then the buttons report that the server is not set up and
the game works exactly as before from local storage. Statistics are opt-in and anonymous (a random device id,
stage, time played, a few counters). `docs/PLAYTEST.md` describes a first playtest round.

## Artwork

Pictures come from the project's public Supabase Storage buckets (`STORAGE` in `src/ui/artwork.ts`):

| What | Where |
| --- | --- |
| Plant artwork | `plant-images/species/<species-id>/hero.png` (one per species; `philodendron-pink-princess` lives under `Species/`) |
| Logo, sidebar and tab icon | `Artwork/logo.png` |
| Overview banner | `Artwork/banner with logo.png` |
| Backdrop of the stage card and the Welcome-back dialog | `Artwork/banner.png` |

The species ids in the game *are* the folder names, and `tests/species.test.ts` checks the two lists match
(`tests/species-slugs.txt`). Each picture is loaded as a resized copy (Supabase image transformation) when the
plan allows it, then as the original, and the procedural drawing is used if the picture cannot be loaded, so
the game also works offline. Settings has a switch for drawn plants and a retry button. Plants are tinted by their
colour gene and health, variegation and infection are overlaid, and young plants are drawn smaller.

Colour direction comes from the artwork: lime-olive (`--lime`, the logo's ring and "G"), cream (`--cream`, the "J2"), warm
gold light and near-black jungle green. It all lives in the CSS variables at the top of `src/styles.css`.

## Tools

```bash
npx tsx scripts/balance-sim.ts 360 3        # pacing report: 360 game-minutes, seed 3
npx tsx scripts/make-save.ts 360 3 > s.json # a mid-game save to import in Settings or to screenshot
node scripts/shoot.cjs shots all s.json     # screenshot every view from that save (needs a build)
ART=offline node scripts/shoot.cjs shots all s.json   # same with the artwork servers unreachable (mocks in scripts/mock-art.cjs)
ART_DIR=./art ART=originals node scripts/shoot.cjs shots all s.json   # serve real files from ./art/<bucket>/<path> instead of stand-ins
```

## Status

Playable end to end: all six facility stages, the full tech tree, breeding, tissue culture, automation, contracts,
legacy resets and saves. Content is data driven (`species.ts`, `techs.ts`, `discoveries.ts`, `config.ts`), so adding
species, technologies or discoveries is a matter of adding rows.

Species names and the habits attached to them are real horticulture (garden hybrids and trade cultivars are labelled as such); prices, genetics numbers and the research
tree are game design, not science.
