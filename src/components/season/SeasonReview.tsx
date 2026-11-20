'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { ArrowRight } from 'lucide-react';
import { MButton, Modal, PageHeader, Panel, TeamCrest } from '@/components/mynba/primitives';
import { auctionTypeFor, campaignLength, campaignYear, isFinalSeason } from '@/lib/flow/season-flow';
import type { SeasonAward, SeasonSummary } from '@/lib/types/game';

/** This campaign's seasons only, one row per year (older saves may hold rows from earlier campaigns). */
function campaignHonours(history: SeasonSummary[], startingSeason: number, currentSeason: number): SeasonSummary[] {
  const byYear = new Map<number, SeasonSummary>();
  for (const s of history) if (s.year >= startingSeason && s.year <= currentSeason) byYear.set(s.year, s);
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

const AWARDS: { type: SeasonAward['type']; label: string; unit?: string; color: string }[] = [
  { type: 'OrangeCap', label: 'Orange Cap', unit: 'runs', color: '#C2561A' },
  { type: 'PurpleCap', label: 'Purple Cap', unit: 'wickets', color: '#6B4BC4' },
  { type: 'MVP', label: 'Most Valuable Player', unit: 'pts', color: 'var(--m-green)' },
  { type: 'EmergingPlayer', label: 'Emerging Player', color: 'var(--m-cyan)' },
];

export function SeasonReview() {
  const { currentSeason, seasonAwards, seasonHistory: allHistory, humanFranchiseId, franchises, standings, playoffFixtures, settings, advanceSeason, setPhase } = useGameStore();
  // Advancing develops players and retires veterans; the recap slides then show those results.
  const seasonHistory = campaignHonours(allHistory, settings.startingSeason, currentSeason);
  const startOffseason = () => {
    advanceSeason();
    setPhase('Retention');
  };
  const [summaryOpen, setSummaryOpen] = useState(false);
  const final = isFinalSeason(currentSeason, settings);
  const year = campaignYear(currentSeason, settings);

  const finalMatch = playoffFixtures.find((f) => f.playoffType === 'Final');
  const championId = finalMatch?.result?.winnerId;
  const myPos = standings.findIndex((r) => r.franchiseId === humanFranchiseId) + 1;
  const myRow = standings.find((r) => r.franchiseId === humanFranchiseId);
  const teamName = (id?: string) => franchises.find((f) => f.id === id)?.shortName ?? '';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <PageHeader
        kicker={`IPL ${currentSeason} · Year ${year} of ${campaignLength(settings)} · Wrap-up`}
        title="Season Review"
        subtitle={
          final
            ? `That was the last season of the campaign. Finish it to see how your ${campaignLength(settings)} seasons stack up.`
            : auctionTypeFor(currentSeason + 1, settings) === 'Mega'
            ? `The season is over. Next: IPL ${currentSeason + 1}, with a MEGA auction in November ${currentSeason} — retain up to 6, everyone else goes back into the pool.`
            : `The season is over. Next: IPL ${currentSeason + 1}, with a mini auction in December ${currentSeason} — squads stay together, so trades and smart releases decide who improves.`
        }
        right={
          final ? (
            <MButton variant="go" size="lg" onClick={() => setSummaryOpen(true)}>
              Finish campaign <ArrowRight className="w-4 h-4" />
            </MButton>
          ) : (
            <MButton variant="primary" size="lg" onClick={startOffseason}>
              Start IPL {currentSeason + 1} offseason <ArrowRight className="w-4 h-4" />
            </MButton>
          )
        }
      />

      <div className="grid sm:grid-cols-2 gap-5">
        <Panel title="Champions">
          {championId ? (
            <div className="flex items-center gap-4">
              <TeamCrest franchiseId={championId} size="lg" />
              <div>
                <div className="m-display text-3xl italic">{franchises.find((f) => f.id === championId)?.name}</div>
                {finalMatch?.result?.winMargin && <div className="text-sm text-[var(--m-dim)] mt-1">{finalMatch.result.winMargin} in the Final</div>}
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--m-faint)]">The Final has not been played.</div>
          )}
        </Panel>
        <Panel title="Your season">
          <div className="flex items-center gap-4">
            <TeamCrest franchiseId={humanFranchiseId} size="lg" />
            <div>
              <div className="m-display text-3xl italic">
                {championId === humanFranchiseId ? 'Champions' : myPos ? `${ordinal(myPos)} in the league` : '—'}
              </div>
              {myRow && (
                <div className="text-sm text-[var(--m-dim)] mt-1">
                  {myRow.won} won · {myRow.lost} lost · {myRow.points} points
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <section>
        <h2 className="m-label !text-[var(--m-text)] mb-3">Awards</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {AWARDS.map((a) => {
            const award = seasonAwards.find((x) => x.type === a.type);
            return (
              <div key={a.type} className="m-panel px-4 py-4">
                <div className="m-label !text-[0.62rem]" style={{ color: a.color }}>
                  {a.label}
                </div>
                <div className="font-semibold mt-2 truncate">{award?.playerName ?? 'Not awarded'}</div>
                {award && (
                  <div className="text-xs text-[var(--m-faint)] mt-0.5">
                    {teamName(award.franchiseId)}
                    {a.unit ? ` · ${award.value} ${a.unit}` : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {seasonHistory.length > 0 && (
        <Panel title="Roll of honour" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left m-label !text-[0.62rem] border-b border-[var(--m-line)]">
                <th className="py-2.5 pl-4">Year</th>
                <th className="py-2.5">Champions</th>
                <th className="py-2.5 hidden sm:table-cell">Runners-up</th>
                <th className="py-2.5 pr-4 hidden md:table-cell">Orange / Purple Cap</th>
              </tr>
            </thead>
            <tbody>
              {seasonHistory.map((s) => (
                <tr key={s.year} className="border-b border-[var(--m-line)]/50">
                  <td className="py-2.5 pl-4 tabular-nums text-[var(--m-dim)]">{s.year}</td>
                  <td className="py-2.5 font-semibold">{s.championId}</td>
                  <td className="py-2.5 text-[var(--m-dim)] hidden sm:table-cell">{s.runnerUpId}</td>
                  <td className="py-2.5 pr-4 text-[var(--m-dim)] hidden md:table-cell">
                    {s.orangeCapPlayer} / {s.purpleCapPlayer}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <CampaignSummary open={summaryOpen} onClose={() => setSummaryOpen(false)} />
    </div>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** End of the campaign: results, titles and the moves you made. */
function CampaignSummary({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { seasonHistory: allHistory, currentSeason, humanFranchiseId, franchises, careerState, saveGame, returnToMainMenu, settings } = useGameStore();
  const seasonHistory = campaignHonours(allHistory, settings.startingSeason, currentSeason);
  const human = franchises.find((f) => f.id === humanFranchiseId);
  const titles = seasonHistory.filter((s) => s.championId === human?.name).length;
  const myTrades = (careerState.trade?.history ?? []).filter((t) => t.franchiseIds.includes(humanFranchiseId)).length;
  const mySignings = (careerState.transactions ?? []).filter((t) => t.franchiseId === humanFranchiseId && t.type === 'Signed').length;
  const best = seasonHistory.length ? Math.min(...seasonHistory.map((s) => s.humanFranchisePosition || 99)) : 0;
  return (
    <Modal open={open} onClose={onClose} width="max-w-3xl" labelledBy="campaign-title">
      <div className="px-6 pt-6 pb-2 flex items-center gap-4">
        <TeamCrest franchiseId={humanFranchiseId} size="lg" />
        <div>
          <div className="m-label">Campaign complete · {campaignLength(settings)} seasons</div>
          <h2 id="campaign-title" className="m-display text-3xl italic">{human?.name}</h2>
        </div>
      </div>
      <div className="px-6 pb-6 space-y-5 overflow-y-auto m-scroll">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Titles', titles],
            ['Best finish', best && best < 99 ? ordinal(best) : '—'],
            ['Trades made', myTrades],
            ['Auction signings', mySignings],
          ].map(([k, v]) => (
            <div key={k as string} className="m-panel px-4 py-3">
              <div className="m-label !text-[0.62rem]">{k}</div>
              <div className="font-display font-extrabold text-2xl">{v}</div>
            </div>
          ))}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left m-label !text-[0.62rem] border-b border-[var(--m-line)]">
              <th className="py-2">Season</th>
              <th className="py-2">Auction</th>
              <th className="py-2">Your finish</th>
              <th className="py-2">Record</th>
              <th className="py-2">Champions</th>
            </tr>
          </thead>
          <tbody>
            {seasonHistory.map((s, i) => (
              <tr key={s.year} className="border-b border-[var(--m-line)]/50">
                <td className="py-2 tabular-nums">{s.year}</td>
                <td className="py-2 text-[var(--m-dim)]">{auctionTypeFor(s.year, settings)}</td>
                <td className="py-2">{s.championId === human?.name ? 'Champions' : ordinal(s.humanFranchisePosition)}</td>
                <td className="py-2 tabular-nums text-[var(--m-dim)]">{s.humanFranchiseWins}–{s.humanFranchiseLosses}</td>
                <td className="py-2">{s.championId}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end gap-2">
          <MButton variant="ghost" onClick={onClose}>Keep browsing</MButton>
          <MButton
            variant="primary"
            onClick={() => {
              saveGame();
              returnToMainMenu();
            }}
          >
            Back to main menu
          </MButton>
        </div>
      </div>
    </Modal>
  );
}
