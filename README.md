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
`j2grows.save.v1`) and you can export / import a save as text from **Settings**.

## What is in the game

| Area | What you do |
| --- | --- |
| **Cultivation** | Grow rooms with their own light, temperature, humidity, airflow and feed settings. Each of the 99 aroids has its own ideal band (shown on every slider), preferred medium, watering rhythm and hunger. Plants get thirsty, hungry, infected, rootbound or scorched. |
| **Genetics** | 12 diploid genes (growth rate, leaf size, shape, colour, variegation, roots, environmental tolerance, water and nutrient need, disease resistance, propagation efficiency, mutation potential). Alleles carry a value and a dominance, so recessives hide and reappear. Scan plants to reveal their genome (visual, phenotype, both alleles), predict a cross with the Mendelian preview, then breed. |
| **Propagation** | Seed, stem and leaf cuttings, division, cloning chambers, tissue culture (with contamination and somaclonal variation), cross-pollination, interspecific and intergeneric hybridisation. |
| **Tissue Culture** | A sterile pipeline (initiation, multiplication, rooting, acclimatisation) that turns one mother plant into dozens of plantlets, at some risk. |
| **Research** | A 70-technology tree in eight branches (genetics, cultivation, propagation, mutation, automation, commercial production, species discovery, plus a late-game Synthetic Botany branch). Projects cost research points, money and time and several can run in parallel. |
| **Laboratory** | Six facility stages, from a *Personal Growing Room* to an *Advanced Research Institution*. Four independently upgradeable departments (Cultivation, Tissue Culture, Genetics, Research) plus facility upgrades, and staff (growers, lab technicians, geneticists, researchers, sales managers) with wages and training. |
| **Market** | Buy stock, sell plants, take collector contracts, watch per-species prices move with demand and events, register named cultivars that earn royalties. |
| **Collection** | A real-species database with discovery progress, a codex of 68 discoveries (novel alleles, rare traits, record specimens…), a hall of fame of the finest plants you have bred, and every plant's individual history. |
| **Automation** | Watering, feeding, treatment, climate control, analysis, planting, propagation, harvesting and selling, each unlocked by research and driven by a shared action budget plus your staff. Auto-sell has rules (minimum value, keep analysed plants, hold when demand is low). |
| **Idle play** | Closing the tab does not stop the lab. On return you get a *Welcome back* report: up to 4 hours (extendable) are simulated at 50% efficiency (also improvable). Outbreaks do not begin while you are away unless conditions are genuinely poor, and plants are never lost offline. |
| **Legacy (prestige)** | From Stage 4 you can hand on the legacy: reset the facility for Legacy Points spent on permanent upgrades (research output, discovery rewards, growth speed, offline time, prices, mutation, tissue culture…). Discoveries, the collection, cultivars and statistics are kept. |

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
    save.ts        Serialise / deserialise / export / import with forward-compatible merging
  store.ts       Browser store: game clock, autosave, toasts, UI navigation state
  ui/            React 19 function components, plain CSS (no UI library)
    artwork.ts     Supabase storage URLs, fallbacks, the Artwork setting
    HeroArt.tsx    Plant pictures (tinted by genes and health) and the logo / banner components
    PlantArt.tsx   Chooses picture or drawing; the procedural SVG plants live here
    brand.ts       Measures the accent colour from the logo and banner
scripts/         bot.ts + balance-sim.ts (pacing), gene-stats.ts, make-save.ts, smoke.ts,
                 build-bun.ts, shoot.cjs (screenshots), e2e.cjs (browser click-through)
tests/           engine.test.ts
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
* **Balance is measured, not guessed.** `npm run balance` plays a goal-driven bot through the game. Current
  pacing (six bot seeds): Stage 2 in roughly 15–23 min, Stage 3 in about 1.4–1.7 h, Stage 4 in about 4.5–5.3 h,
  Stage 5 in about 11–14 h. Stage 6 and prestige are intended as multi-day goals.

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

The accent colour (`--brand`: glows, highlights) is measured from the artwork at runtime and remembered; the rest of
the palette lives in the CSS variables at the top of `src/styles.css`.

## Tools

```bash
npx tsx scripts/balance-sim.ts 360 3        # pacing report: 360 game-minutes, seed 3
npx tsx scripts/make-save.ts 360 3 > s.json # a mid-game save to import in Settings or to screenshot
node scripts/shoot.cjs shots all s.json     # screenshot every view from that save (needs a build)
ART=offline node scripts/shoot.cjs shots all s.json   # same with the artwork servers unreachable (mocks in scripts/mock-art.cjs)
```

## Status

Playable end to end: all six facility stages, the full tech tree, breeding, tissue culture, automation, contracts,
legacy resets and saves. Content is data driven (`species.ts`, `techs.ts`, `discoveries.ts`, `config.ts`), so adding
species, technologies or discoveries is a matter of adding rows.

Species names and the habits attached to them are real horticulture (garden hybrids and trade cultivars are labelled as such); prices, genetics numbers and the research
tree are game design, not science.
