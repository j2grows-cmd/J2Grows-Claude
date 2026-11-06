# Release checklist and store copy

## Before any public build

- [ ] `npm run typecheck`, `npm test`, `npx tsx scripts/pacing-guard.ts`, `npm run build`, `npm run e2e` all green (CI does this on every push).
- [ ] Weekly CI "pacing" job is green: first Legacy reset between 78 and 105 hours for the attentive bot.
- [ ] `supabase/migrations/001_cloud_saves_and_telemetry.sql` applied and **tested with a real email**: sign in, upload, download on a second browser.
- [ ] Email sign-in configured (sender name, template wording, rate limits) in Supabase Authentication.
- [ ] Row level security verified: a signed-in user can read only their own `cloud_saves` row; the public key cannot read `telemetry_events`.
- [ ] `BUILD` in `src/telemetry.ts` and `version` in `package.json` bumped and tagged.
- [ ] At least one playtest round done (`docs/PLAYTEST.md`) and its top three problems fixed.
- [ ] Privacy notice written (what the opt-in statistics contain; the cloud save stores the save file against an email address). Needed before any public statistics collection.

## Accessibility status

Done: keyboard-reachable controls with visible focus, skip link, modals trap and restore focus and close on Esc,
`aria-current` on navigation, labelled form controls and charts (`role="img"` with a text summary), live regions
for toasts and notices, reduce-motion setting (also follows the OS), interface size setting, 44 px touch targets on
touch devices, colour is never the only signal for plant warnings.

Still to do before release: a screen-reader pass (NVDA/VoiceOver) of the Genetics and Market screens, a contrast
audit of the four non-default themes, and a keyboard-only run of a full first hour.

## Localisation

All text is currently English and written inline. The manual (`src/ui/manual.ts`) is already data. Selling outside the
UK means moving UI strings into a catalogue and formatting money by locale; plan this before the store page goes live.

## Store page copy (draft)

**Title:** J2Grows: Botanical Genetics

**Tagline:** Grow. Discover. Experiment. Evolve.

**Short description:** Run a plant business that grows into a research institution. Breed 99 real aroids with real
genetics, discover traits nobody has seen, and build the collection of a lifetime. One-time purchase. No microtransactions.

**Long description:**
Start with a single windowsill plant and $200. Water it, feed it, sell it, and learn what each species wants.
Then learn why: every plant carries twelve genes with two alleles each, dominant and recessive, and what you see is
only part of the story. Analyse your plants, cross the best, and watch hidden traits come back two generations later.

- 99 species of Alocasia, Anthurium, Monstera and Philodendron, each with its own light, climate and water habits
- Real genetics: diploid genes, dominance, mutation, hybrids between species
- A 70-technology research tree, six facility stages and automation that runs while you are away
- Plant shows, collector commissions, registered cultivars and 40+ achievements
- About 80-100 hours to the end of the main game, then Legacy resets and challenge runs
- Cloud saves, no ads, no energy timers

## Trailer storyboard (60-75 s)

1. (0-5 s) Close on a single leaf unfurling. Title card: *J2Grows*.
2. (5-15 s) The first loop at speed: buy, pot, water, sell. Coins tick up. Text: *Start small.*
3. (15-30 s) The plant card diagnosis fixing a struggling plant; the room sliders sliding into the green band. Text: *Learn what each one needs.*
4. (30-45 s) Genetics screen: alleles lighting up, a cross predicted, a variegated seedling appearing. Discovery sting. Text: *Then learn why.*
5. (45-60 s) Time lapse: one room becomes ten, charts climbing, staff, robots, a show rosette. Text: *Build an institution.*
6. (60-70 s) Banner and logo. Text: *Grow. Discover. Experiment. Evolve.* Release date.

Capture with `scripts/shoot.cjs` for stills; record the video from a seeded mid-game save (`scripts/make-save.ts`)
so every take shows the same collection.
