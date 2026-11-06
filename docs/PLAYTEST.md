# Playtesting J2Grows

The balance bot is a good proxy for an attentive player, but it never gets confused, bored or distracted. Real
players are the only way to know whether the first hour makes sense and whether hours 10-60 stay interesting.
This is the plan for the first round.

## Who and how many

- 6-10 people, split roughly: 3 who play management/sim games, 3 who are plant people but not gamers, 2-4 anyone.
- Nobody who has seen the game before. No hints, no walkthrough from you.
- Two sessions each: **a 45-minute observed first session**, then **a week of free play** with feedback at the end.

## The observed first session (45 min)

Sit with them (or screen-share) and say only: "Play it as you would at home. Think aloud." Write down the time of:

| Moment | What it tells you |
|---|---|
| First plant bought and potted | Is the opening guide clear? |
| First watering | Do they understand hydration? |
| First time they open a plant card | Do they find the diagnosis? |
| First sale | Is the loop obvious? |
| First research started | Is Research discoverable? |
| First time they say "what do I do now?" | Where the guidance fails |
| First time they look bored or reach for their phone | Where the pace drags |

Afterwards ask: *What was the goal? What was confusing? What would you do next? Would you keep playing?*

## The week of free play

Ask them to switch on **Settings > Playtesting > Share anonymous progress statistics** (or to send the report
file at the end). Check in on day 3 and day 7 with:

1. Where did you stop playing, and why?
2. Was there a day you wanted to play and did not? What was missing?
3. Which system did you ignore? (shows, commissions, breeding, tissue culture, automation)
4. Did anything feel unfair, grindy or pointless?
5. What did you tell someone else about the game?

## Collecting the data

- **Reports:** each player uses *Send feedback > Download report* and sends the text file. Put them in `reports/`
  and run `npx tsx scripts/playtest-report.ts reports/*.txt` for a stage-timing table plus every player's notes.
- **Telemetry (opt-in):** apply `supabase/migrations/001_cloud_saves_and_telemetry.sql`, then in the Supabase
  dashboard run `select * from pacing_by_stage;` for median / fastest / slowest hours per stage. Rows contain a
  random device id, stage, time played and counters. No names, emails or saves.

## Reading the results

| Signal | Likely problem | First thing to try |
|---|---|---|
| Median to Stage 2 over 1 h, or players stuck at the first plant | Opening too unclear | Rewrite guide steps, add a tooltip on the first plant |
| Many players stop between S3 and S4 | Mid-game slump | Add a commission chain or an event at the S3->S4 gate |
| A stage takes 2x the bot's time for everyone | Pacing | Lower that stage's cost or raise income there |
| A stage takes half the bot's time | Exploit | Look for a loop; check `scripts/balance-sim.ts` with that behaviour |
| Nobody enters shows or uses the diagnosis | Discoverability | Surface them in "What next?" earlier |
| Crash events (`crash` in the log) | Bug | Reproduce from the exported save |

Change one thing at a time and re-test on a fresh player: a returning tester already knows the answers.

## Before each round

`npm test`, `npx tsx scripts/pacing-guard.ts`, `npm run e2e`. Tag the build and bump `BUILD` in `src/telemetry.ts`
so reports can be matched to a version.
