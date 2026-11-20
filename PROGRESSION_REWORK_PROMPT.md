# Task: Rework player growth, the youth pipeline and the rating spread (IPL Dynasty career mode)

You are working in this Next.js + TypeScript repo (an IPL auction + career-mode game). Read `AGENTS.md` first.
The three problems below are linked, so fix them as **one system** and tune them together against a
simulation harness. Don't tune each part on its own.

A career is **3 seasons = 1 mega-auction cycle** (year 1 mega, years 2–3 mini). Everything must feel
right inside that window: a youngster who is bought, plays and performs in season 1 should be a
visibly different player (rating, potential, price) by the season-2 and season-3 auctions.

---

## 0. Read these files before changing anything

| Area | File |
|---|---|
| Yearly growth/decline, domestic breakouts, India call-ups | `src/lib/engines/career/player-progression.ts` |
| Age phases (Emerging / EarlyPrime / PeakPrime / LatePrime / VeteranMaster) | `src/lib/intelligence/models/age-curve.ts` |
| New-player (rookie) generation | `src/lib/engines/career/player-generator.ts` |
| Season transition (calls progression → retirements → rookies → CPU releases) | `src/lib/engines/career/multi-season-controller.ts` |
| Who gets picked in the XI | `src/lib/engines/selection-score.ts`, `src/lib/engines/squad-engine.ts`, `src/lib/engines/cpu-gm/xi-value.ts` |
| Auction pool registration + base prices | `src/lib/engines/registration/registration-engine.ts`, `src/lib/engines/eligibility/auction-eligibility-engine.ts` |
| Auction pricing (youth/headroom value, "Uncapped prospect" tag) | `src/lib/engines/auction/market-value.ts`, `src/lib/engines/cpu-gm/advanced-valuation.ts` |
| Season stat accumulation | `src/lib/store/game-store.ts` (`updatePlayerSeasonStats`) |
| Starting ratings | `src/lib/data/global-player-database.json` (671 players), `scripts/data/calibrate_ratings.py` |
| Multi-season benchmark | `scripts/simulate_10_seasons.ts` (`npm run benchmark:dynasty`) |
| Existing tests | `npm test` (see `package.json`) |

---

## 1. Diagnosis (measured, not guessed)

I ran `scripts/simulate_10_seasons.ts` for 4 seasons with extra logging. Findings:

**A. The benchmark has a bug that hides growth.** It builds `playerSeasonStats` by hand and never sets
`strikeRate` or `economyRate` (they stay 0). `seasonPerformance()` then rates *every* batter at −1.0
(the floor), so every youngster "stalls" in the benchmark. Example: Vaibhav Suryavanshi went
78/94 → 80/90 → 80/86 → 79/84 even though he played 14 matches every season.
**Fix this first** (compute SR = runs/balls×100 and economy = runsConceded/overs before
`executeSeasonAdvance`). Every number below comes from the run with this fixed.

**B. The middle of the ratings drains away while the top inflates.** Overall rating counts by band,
active players, start of season 1 → start of season 4 (after 3 progressions):

| Band | S1 | S4 |
|---|---|---|
| 90+ | 1 | 12 |
| 85–89 | 28 | 21 |
| 80–84 | 70 | 48 |
| 75–79 | 72 | 60 |
| 70–74 | 43 | 88 |

Veterans lose 1–3 a year (LatePrime/Veteran), and only the 3–4 already-famous youngsters climb
(Mhatre 76 → 95, Suryavanshi 78 → 90). Nobody refills the 78–84 band. That's the user's complaint:
"there are few players in the 80s, and growth below that doesn't matter."

**C. Youngsters who don't already start never get going.** Prospects with 0–3 matches get
`gameTime = −0.6`, growth capped at +3, and potential that decays (Kartik Sharma 70/84 → 75/81 with no
games). Nothing lets a bench youngster earn a place in the middle of a season. `recentForm` is never
updated during a season (it's reset to 75 at the transition and read nowhere in-season), and
`selectionScore` gives young Indians at most +3.

**D. The rookie class is thin, fixed and the same in every career.**
`generateRookieDraftClass(seasonYear, 24)`:
- uses no RNG and ignores `settings.seed`, so every career gets the same rookies with the same names (and "Matthew Breetzke" clashes with a real player)
- only 17 Indians; ratings 66–72, potential 75–84; exactly 1 "prodigy" (76/91) a year
- the role cycles `i % 4`, so 25% are wicketkeepers; potential tiers are tied to index, not role
- has no "ready-now" domestic performers (the Shashank Singh / Ashutosh Sharma type who's 25–29 and IPL-ready)

**E. The uncapped Indian pool is filler.** 197 of the 283 uncapped Indians in the DB are rated 60–64
and 182 have potential 70–74. They pad the uncapped sets and nobody wants them.

**F. Smaller bugs in `progressPlayerAttributes`:**
- `newBatting = previousBatting + overallChange` for **every** role, so a bowler's batting rises with his bowling
- `newPotential` floor is `newOverall + 1` only up to age 25; there's no floor tied to age, so a 19-year-old can end up with potential = overall + 1 after one quiet season
- `domestic breakouts` are capped at 8 and only roll for ages 19–27; in practice 1–3 a season

---

## 2. Goals and how to tell they're met

### 2.1 Rating spread (the "shape" of the league)
Measure over the **IPL-relevant pool**: everyone in a squad + the top 60 of the auction pool by
overall. Targets at the start of **each** of seasons 1–4 (that is, after 0–3 progressions):

| Band | Target count | Notes |
|---|---|---|
| 90+ | **6–10** | Elite stays rare; never more than 10 |
| 85–89 | 20–32 | |
| 80–84 | **55–75** | Up from today's 44 in squads / 48 by S4 |
| 75–79 | **65–85** | |
| 70–74 | 45–65 | |
| <70 | the rest | |

Also: league mean overall drifts by no more than ±1.0 across the 4 seasons.

### 2.2 Youth growth (the "Suryavanshi test")
Over 3 progressions, for Indian players aged ≤23 at season 1:
- A youngster with **≥6 matches and a strong season** (`seasonPerformance ≥ 0.6`) gains **+5 to +10 overall** that year and **+3 to +6 potential**. Two strong seasons in a row move a 72 to roughly 82–85.
- Each season produces **8–15 "Breakout" Indian youngsters** (≤24), not 1–3.
- At least **12 Indians who start the career ≤23 and below 76** are **≥80** by season 4 (today it's about 3–4).
- A young player who plays and does badly (`perf ≤ −0.4`, ≥6 matches) loses 2–4 potential and gains little. Busts must still exist: 10–20% of prospects should stall.
- A prospect with **0 matches** still develops slowly (+0 to +3, from nets and domestic cricket) but doesn't break out. His potential drifts down only if he's ≥22 or has two empty seasons in a row.

### 2.3 Auction youth pool (every auction after season 1)
Each mini auction must contain, among uncapped Indians:
- **2–4 wonderkids**: age 16–19, OVR 72–78, POT 88–95
- **6–10 hot prospects**: age 18–22, OVR 70–77, POT 82–89
- **8–12 ready-now domestic performers**: age 22–29, OVR 74–80, POT 76–84
- **8–15 domestic breakouts** (existing players whose ratings jumped this off-season)
- CPU teams must buy them: **≥80% of wonderkids and hot prospects sold**, and wonderkid prices mostly ₹1–6 Cr (not all at base price, not ₹15 Cr).

### 2.4 Things that must not break
- `npm test` passes (update tests whose numbers change on purpose, and say which ones and why).
- Same seed + same choices = same career (determinism). New randomness goes through the seeded RNG (`playerRng` / `settings.seed`), never `Math.random`.
- **Old saves load.** Any new player field is optional and gets a sensible default when missing (derived deterministically from the player id).
- The 10-season benchmark still passes its inflation/retirement checks (inflation ≤ 4.0).

---

## 3. Design

These numbers are **starting values**. Tune them with the harness in §4 until §2 passes. Put every
tunable in one exported `PROGRESSION_TUNING` object (new file
`src/lib/engines/career/progression-tuning.ts`) so they can be adjusted in one place.

### 3.1 Hidden development profile (new, optional field)
Add `player.devProfile?: 'EarlyBloomer' | 'Standard' | 'LateBloomer' | 'Plateau'`. When missing,
derive it from `hashString(id)` (≈20% / 50% / 15% / 15%). It isn't shown in the UI; it only explains why
two similar prospects turn out differently.
- EarlyBloomer: growth ×1.25 up to age 22, ×0.8 after 24
- LateBloomer: ×0.8 up to age 22, ×1.3 from 24 to 28 (and eligible for domestic breakouts up to age 29)
- Plateau: ×0.6, and potential drifts down 1 a year after age 22 unless perf ≥ 0.6

### 3.2 Growth formula (replaces the Emerging/EarlyPrime branches in `progressPlayerAttributes`)
```
headroom      = max(0, potential − overall)
ageRate       = age ≤20: 0.30 | 21–22: 0.26 | 23–24: 0.22 | 25–27: 0.16 | 28: 0.08
playMult      = matches 0: 0.35 | 1–3: 0.6 | 4–7: 1.0 | 8–11: 1.25 | 12+: 1.4
perfBonus     = perf ≥1.0: +4 | ≥0.6: +3 | ≥0.3: +1.5 | ≥0: +0.5 | ≥−0.4: −0.5 | else −1.5   (null perf → 0)
luck          = rng in [−1, 1] × 1.0
raw           = headroom × ageRate × playMult × devProfileMult + perfBonus + luck
```
Clamp the result by age: ≤24 → [−2, +9]; 25–27 → [−2, +6]; 28 → [−3, +3].
Allow **one** "breakout leap" of up to +10 when matches ≥ 6, perf ≥ 0.8 and age ≤ 24.
Remove the old `if (matches < 4) overallChange = min(overallChange, 3)` rule for ages ≤ 24; use
`playMult` instead. Keep it for older players.

**Elite compression** (this keeps 90+ rare while letting 70s become 80s): apply the gain in
steps. Each point gained above 84 counts 0.6, above 88 counts 0.4, above 91 counts 0.25 (round at
the end). A 74 jumps to 82 easily; an 88 needs an outstanding season to reach 90.

### 3.3 Potential
- Strong season (perf ≥ 0.6, ≥6 matches, age ≤ 25): potential +3 to +6 (scaled by perf and luck).
- Good season (perf 0.3–0.6): +1 to +2.
- Poor season (perf ≤ −0.4, ≥6 matches): −2 to −4.
- No matches: −0 to −2, only if age ≥ 22 or the player had 0 matches last season too.
- **Floor by age:** potential ≥ newOverall + (age ≤19: 6 | 20–21: 5 | 22–23: 4 | 24–25: 2 | else 0).
- Cap: 97. From age 29 on, potential converges to overall (the existing −1/yr is fine).

### 3.4 Prime and decline (makes room without draining the 80s)
- PeakPrime (≈26–31 depending on role): keep it roughly flat, change = perf×1.3 ± luck, clamp [−3, +3].
- LatePrime and veterans: keep the decline, but scale it by output. Proven performers (perf ≥ 0.3) lose 0–1. **Mid-performing capped Indians aged 30+** (perf < 0.1, or under 6 matches) lose 2–3 and their `selectionScore` drops (see 3.5). That's the "experienced Indian out of international cricket who gets passed over" effect.
- Fix bug F: move batting, bowling and powerHitting **by role** (Batter/WK: batting only; Bowler: bowling only; All-Rounder: split by which skill is primary). Then recompute `overall` from the components with whatever formula the rating orchestrator uses (check `player-rating-orchestrator.ts` / `role-rating-models.ts`), or keep `overall` as the source of truth and nudge the components. Pick one and keep it consistent.

### 3.5 Playing time: let youngsters earn games
Growth needs matches, so selection has to let them in.
1. **In-season form.** After each match, update `recentForm` for everyone who played (an exponential moving average of a 0–100 match rating built from runs/SR or wickets/economy). Wire it in where the store records match stats (`updatePlayerSeasonStats` or the match-completion handler). Also check how the CPU's XI is built in `squad-engine.ts` / `cpu-manager.ts`.
2. **`selectionScore`:**
   - Young-Indian development bonus: age ≤ 23 and headroom ≥ 5 → `+min(5, 1 + headroom/4)` (was max +3).
   - Form term: `+clamp((recentForm − 75)/5, −3, +4)` once the player has ≥2 matches this season.
   - Capped Indian aged 30+ with IPL perf < 0.1 over the last season: −2.
3. **Blooding rule (CPU teams):** if the squad has an uncapped Indian with POT ≥ 84 who has played < 3 of the last 5 matches, and the team is not in a must-win game, give him a slot over the lowest-scoring non-overseas player in his role group with probability 0.35. Keep this light: an 8th-best batter still shouldn't open. Don't touch the human team's XI.
4. A youngster who plays well in his first 3–4 matches should then **stay** in the XI because of the form term. That's the Suryavanshi path: a few games, scores runs, keeps his place.

### 3.6 Rookie generator rewrite (`player-generator.ts`)
- Signature: `generateRookieDraftClass(seasonYear, seed, existingPlayers)`. Use a seeded RNG (reuse mulberry32 from progression). Update the caller in `multi-season-controller.ts`.
- **Class size: ~34** = 26 Indian + 8 overseas.
- Indian tiers (sample within the ranges, don't take them from the index):
  - Wonderkid ×2–3: age 16–19, OVR 72–78, POT 88–95, base price ₹30–40 L
  - Hot prospect ×6–8: age 18–22, OVR 70–77, POT 82–89
  - Ready-now domestic performer ×7–9: age 22–29, OVR 74–80, POT 76–84 (late bloomers; give them the LateBloomer or Standard devProfile)
  - Standard ×rest: age 18–24, OVR 65–72, POT 72–81
- Roles weighted roughly Batter 30% / Bowler 35% (split pace and spin by style) / All-Rounder 22% / WK 13%. Set `isOpener`, `isDeathBowler`, `isPowerplayBowler` and `preferredBattingPosition` from role and style, plus RNG. Don't use modulo patterns.
- Set the batting, bowling and powerHitting components so they're consistent with OVR for the role.
- **Names:** grow the pools (60+ first names, 60+ surnames, regionally varied). Reject any name that already exists among `existingPlayers` or earlier rookies (retry, then add a middle initial).
- Give every rookie a `development` note made from domestic numbers (reuse the `DOMESTIC_LINES` style: "U19 World Cup: 312 runs at SR 148", "SMAT: 21 wkts @ 6.8", "Ranji/SMAT 2027: 480 runs") so scouting has something to read.
- `basePrice` from `assignOfficialBasePrice` (registration engine), not hard-coded.

### 3.7 Domestic breakouts (`applyDomesticBreakouts`)
- Raise the cap from 8 to **15**; per-player chance ≈ 0.06 base, +0.04 if headroom ≥ 8, +0.02 if age ≤ 23; LateBloomer eligible to age 29.
- Target **8–15 per off-season** (assert this in the harness).
- Jump +5 to +10 (larger when OVR is lower); potential +2 to +5; OVR capped at 84 (not 86) so the 90+ tier isn't fed from domestic cricket.

### 3.8 Clean up the uncapped pool
- In the registration/eligibility step for **auctions after season 1**, an uncapped Indian registers only if OVR ≥ 66 **or** POT ≥ 78 **or** he played IPL in the last 2 seasons **or** he's a new rookie **or** a domestic breakout. Others stay in the database but skip the auction.
- Optionally (behind a flag) lift the 60–64 uncapped Indians in the base DB at load: ages ≤ 23 get potential lifted into 74–84 by a hash, so the season-1 pool also has some upside. Don't touch real stars.

### 3.9 Make sure the market values youth
- In `auctionRatingValue`, check that a 17-year-old 75/92 lands around ₹3–6 Cr and a 21-year-old 74/86 around ₹1.5–3 Cr. If not, adjust the `youth` weight (currently 0.35/0.25/0.10).
- Add `development.trend === 'Breakout' | 'Domestic breakout'` as a valuation bump (+10–20%), so CPU teams chase last year's breakout players.
- In `cpu-gm` personalities, at least the youth/rebuild-type archetypes should target wonderkids and hot prospects. Check `personalities.ts` and `strategy-planner.ts`.

### 3.10 Starting-rating spread (one-time, at load)
The starting DB has 80 players at 80–84 and 98 at 75–79 out of 671, but the 70–74 band holds many IPL
regulars. To hit §2.1 from season 1, add a **monotonic remap** for `overall` in
`src/lib/data/players.ts` (or a new `rating-distribution.ts` it calls):
- Keep the top 8 by overall unchanged.
- Map the rest by percentile among IPL-squad players to the target bands in §2.1 (piecewise linear; ranks preserved; nobody moves more than ±4).
- Apply the same delta to the role's primary component(s). Keep the raw value in `ratings.modelOverall` (already present).
- Guard it with a `RATING_REMAP_VERSION` so saves made before the change don't get remapped twice.

---

## 4. Calibration harness (build this, then tune until §2 passes)

Create `scripts/calibrate_progression.ts` (and an npm script `calibrate:progression`):
1. Fix the SR/economy bug in `simulate_10_seasons.ts` too.
2. Run the existing season loop (copy it from `simulate_10_seasons.ts`) for **4 seasons × 5 seeds** (1, 7, 42, 99, 2026). Include a real mini auction between seasons if the auction runner can run headless (`scripts/headless_auction_benchmark.ts` / `auction-runner.ts`). If not, at least feed new rookies and released players to squads with the CPU valuation.
3. After each progression, print:
   - the band table from §2.1 (IPL-relevant pool), plus the league mean
   - Breakout / Rising / Stalled / Bust / Domestic-breakout counts
   - the top 15 Indians ≤ 24: `name (age) ovr/pot trend matches perf`
   - for each auction: wonderkid, hot-prospect and ready-now counts in the pool, % sold, median price
4. End with PASS/FAIL per criterion in §2, averaged over the seeds.

Tune `PROGRESSION_TUNING` until all pass. Then also run `npm test` and `npm run benchmark:dynasty`.

---

## 5. UI touches (small)
- Season-transition / player cards already show `development.trend` and `note`. Make sure the new notes ("Breakout season (512 runs at SR 168): ceiling raised", "Earned a place in the XI after 4 strong games") show up, and that the scouting modal shows the domestic note for rookies.
- Optional: show a "Prospect" or "Wonderkid" badge for uncapped players with POT ≥ 88 in the auction hall.

---

## 6. What to hand back
1. A summary of each change, file by file.
2. The final `PROGRESSION_TUNING` values.
3. Harness output for seed 42 (all 4 seasons) and the PASS/FAIL table over 5 seeds.
4. Any test whose expected numbers you changed, and why.
5. Anything you couldn't do or chose not to do (for example if headless auctions aren't possible).
