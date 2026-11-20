'use client';

// Off-season recap, shown right after a season advance. The advance is what
// develops players and retires veterans, so these slides read the results of
// the season that just ended (never the one before it).

import React, { useState } from 'react';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { useGameStore } from '@/lib/store/game-store';
import { getLeaguePurseForSeason } from '@/lib/engines/career/contract-engine';
import { auctionTypeFor } from '@/lib/flow/season-flow';
import { formatPrice } from '@/lib/utils';
import { MButton, Modal, OvrBadge } from '@/components/mynba/primitives';

const STEPS = ['Growth', 'Retirements', 'Next season'] as const;

export function SeasonTransitionModal() {
  const { seasonRecapPending, dismissSeasonRecap, currentSeason, humanFranchiseId, franchises, careerState, settings } = useGameStore();
  const [step, setStep] = useState(0);
  if (!seasonRecapPending) return null;

  const endedSeason = currentSeason - 1;
  const myIds = new Set((franchises.find((f) => f.id === humanFranchiseId)?.players ?? []).map((p) => p.id));
  const growth = careerState.recentProgressionDeltas
    .filter((d) => myIds.has(d.playerId))
    .sort((a, b) => b.overallDelta - a.overallDelta);
  const retirements = careerState.retirements.filter((r) => r.retirementSeason === endedSeason);
  const myRetirements = retirements.filter((r) => r.lastFranchiseId === humanFranchiseId);
  const isMega = auctionTypeFor(currentSeason, settings) === 'Mega';
  const purse = getLeaguePurseForSeason(currentSeason, settings);
  const prevPurse = getLeaguePurseForSeason(endedSeason, settings);
  const risers = growth.filter((d) => d.overallDelta > 0).length;
  const fallers = growth.filter((d) => d.overallDelta < 0).length;

  const close = () => {
    setStep(0);
    dismissSeasonRecap();
  };

  return (
    <Modal open onClose={close} width="max-w-2xl" labelledBy="recap-title">
      <div className="px-6 pt-6 pb-4 border-b border-[var(--m-line)]">
        <div className="flex items-center gap-2" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className={`text-xs font-medium px-3 py-1 rounded-full border ${
                i === step ? 'bg-[var(--m-ink)] text-[var(--m-bg)] border-[var(--m-ink)]' : 'text-[var(--m-dim)] border-[var(--m-line-strong)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <h2 id="recap-title" className="m-display text-4xl mt-4">
          {step === 0 && 'How your squad grew'}
          {step === 1 && 'Farewells'}
          {step === 2 && `Welcome to IPL ${currentSeason}`}
        </h2>
        <p className="text-sm text-[var(--m-dim)] mt-1">
          {step === 0 &&
            (growth.length
              ? `After IPL ${endedSeason}: ${risers} improved, ${fallers} declined.`
              : `No rating changes for your squad after IPL ${endedSeason}.`)}
          {step === 1 &&
            (retirements.length
              ? `${retirements.length} player${retirements.length > 1 ? 's' : ''} retired after IPL ${endedSeason}.`
              : `Nobody retired after IPL ${endedSeason}.`)}
          {step === 2 && (isMega ? 'A mega auction year: retain up to 6, everyone else goes back in the pool.' : 'A mini auction year: your squad stays together. Release a few to free up purse.')}
        </p>
      </div>

      <div className="px-6 py-4 overflow-y-auto m-scroll flex-1 min-h-[240px]">
        {step === 0 && (
          <ul>
            {growth.map((d) => (
              <li key={d.playerId} className="flex items-center gap-3 py-2 border-b border-[var(--m-line)] last:border-0">
                <OvrBadge ovr={d.newOverall} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{d.playerName}</div>
                  <div className="text-[11px] text-[var(--m-faint)] truncate">
                    Age {d.age} · {d.progressionNote}
                  </div>
                </div>
                <span className="text-xs text-[var(--m-faint)] tabular-nums">{d.previousOverall} →</span>
                <Delta value={d.overallDelta} />
              </li>
            ))}
          </ul>
        )}

        {step === 1 &&
          (retirements.length ? (
            <ul>
              {[...myRetirements, ...retirements.filter((r) => !myRetirements.includes(r))].map((r) => (
                <li key={r.playerId} className="flex items-center gap-3 py-2 border-b border-[var(--m-line)] last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {r.playerName}
                      {r.lastFranchiseId === humanFranchiseId && <span className="m-chip ml-2">Your squad</span>}
                      {r.hallOfFame && <span className="m-chip ml-2 !text-[var(--m-gold)]">Hall of Fame</span>}
                    </div>
                    <div className="text-[11px] text-[var(--m-faint)]">
                      Age {r.age} · {r.careerMatches} matches · {r.careerRuns} runs · {r.careerWickets} wickets
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-10 text-center text-sm text-[var(--m-faint)]">Every veteran is back for another season.</div>
          ))}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="m-panel px-4 py-4">
              <div className="m-label">Auction</div>
              <div className="m-display text-3xl mt-1">{isMega ? 'Mega' : 'Mini'}</div>
              <div className="text-xs text-[var(--m-dim)] mt-1">
                {isMega ? 'November' : 'December'} {endedSeason}
              </div>
            </div>
            <div className="m-panel px-4 py-4">
              <div className="m-label">Purse per team</div>
              <div className="m-display text-3xl mt-1">{formatPrice(purse)}</div>
              <div className="text-xs text-[var(--m-dim)] mt-1">
                {purse > prevPurse ? `Up ${formatPrice(purse - prevPurse)} on last year` : 'Same as last year'}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-[var(--m-line)] flex items-center justify-between">
        <MButton variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Back
        </MButton>
        {step < STEPS.length - 1 ? (
          <MButton variant="primary" onClick={() => setStep((s) => s + 1)}>
            Next <ArrowRight className="w-4 h-4" />
          </MButton>
        ) : (
          <MButton variant="go" onClick={close}>
            {isMega ? 'Open retentions' : 'Open releases'} <ArrowRight className="w-4 h-4" />
          </MButton>
        )}
      </div>
    </Modal>
  );
}

function Delta({ value }: { value: number }) {
  if (value > 0)
    return (
      <span className="w-12 inline-flex items-center justify-end gap-0.5 text-[var(--m-green)] font-semibold tabular-nums">
        <TrendingUp className="w-3.5 h-3.5" /> +{value}
      </span>
    );
  if (value < 0)
    return (
      <span className="w-12 inline-flex items-center justify-end gap-0.5 text-[var(--m-red)] font-semibold tabular-nums">
        <TrendingDown className="w-3.5 h-3.5" /> {value}
      </span>
    );
  return <span className="w-12 text-right text-[var(--m-faint)]">±0</span>;
}
