'use client';

import React from 'react';
import { ArrowLeftRight, Check, Database, Shield, X } from 'lucide-react';
import { Modal, MButton } from '@/components/mynba/primitives';
import { CHAPTERS, campaignLength, cycleModeOf, IRL_END_SEASON, type FlowView } from '@/lib/flow/season-flow';
import { useGameStore } from '@/lib/store/game-store';

/** "How a season works": the whole year on one screen, with where you are now. */
export function SeasonGuide({ open, onClose, flow, year }: { open: boolean; onClose: () => void; flow: FlowView; year: number }) {
  const FLOW_STEPS = flow.steps;
  const settings = useGameStore((s) => s.settings);
  const irl = cycleModeOf(settings) === 'irl';
  return (
    <Modal open={open} onClose={onClose} width="max-w-4xl" labelledBy="season-guide-title">
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
        <div>
          <div className="m-label">How it works</div>
          <h2 id="season-guide-title" className="m-display text-3xl italic mt-1">A season in IPL Dynasty</h2>
          <p className="text-sm text-[var(--m-dim)] mt-2 max-w-xl leading-relaxed">
            Seasons are named by the year they are played; each season&apos;s auction is held late in the year before
            (the IPL 2027 auction happens in Dec 2026).{' '}
            {irl ? (
              <>You are following the <b className="text-[var(--m-text)]">real IPL cycle</b>: mega auctions before IPL 2028 and 2031, mini auctions in between, through IPL {IRL_END_SEASON}.</>
            ) : (
              <>This campaign is your own {campaignLength(settings)}-season cycle: a <b className="text-[var(--m-text)]">mega auction</b> before year 1, then <b className="text-[var(--m-text)]">mini auctions</b> where squads stay together and trades matter most.</>
            )}{' '}
            Each season runs through the same nine steps. You are in year {year} of {campaignLength(settings)}, on <b className="text-[var(--m-text)]">step {flow.currentIndex + 1}: {flow.current.label}</b>.
          </p>
        </div>
        <button className="m-btn m-btn-ghost m-btn-sm" onClick={onClose} aria-label="Close guide">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-y-auto m-scroll px-6 pb-6 space-y-6">
        <div className="grid sm:grid-cols-2 gap-3">
          {CHAPTERS.map((ch, ci) => {
            const steps = FLOW_STEPS.map((s, i) => ({ s, i })).filter(({ s }) => s.chapter === ch.id);
            return (
              <section key={ch.id} className="rounded-[4px] border border-[var(--m-line)] bg-ink/[0.02] p-4">
                <div className="flex items-baseline gap-2">
                  <span className="m-label !text-[var(--m-faint)]">Part {ci + 1}</span>
                  <h3 className="font-display font-extrabold uppercase text-lg tracking-wide">{ch.label}</h3>
                </div>
                <p className="text-xs text-[var(--m-dim)] mt-1 mb-3">{ch.blurb}</p>
                <ol className="space-y-2.5">
                  {steps.map(({ s, i }) => {
                    const st = flow.statuses[i];
                    const cur = st === 'current';
                    const done = i < flow.currentIndex;
                    return (
                      <li key={s.id} className="flex gap-3">
                        <span
                          className={`shrink-0 mt-0.5 w-6 h-6 rounded-[3px] inline-flex items-center justify-center text-[11px] font-bold ${
                            cur
                              ? 'bg-ink text-[var(--m-bg)]'
                              : done
                              ? 'bg-[var(--m-green)] text-white'
                              : 'border border-[var(--m-line-strong)] text-[var(--m-dim)]'
                          }`}
                        >
                          {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                        </span>
                        <div className="min-w-0">
                          <div className={`text-sm font-semibold ${cur ? 'text-ink' : ''}`}>
                            {s.label}
                            {cur && <span className="ml-2 m-label !text-[0.6rem] !text-[var(--m-green)]">You are here</span>}
                          </div>
                          <div className="text-xs text-[var(--m-dim)] leading-relaxed">{s.summary}</div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>

        <section>
          <h3 className="m-label !text-[var(--m-text)] mb-2">When can I trade?</h3>
          <div className="grid grid-cols-9 gap-1" aria-label="Trade window by step">
            {FLOW_STEPS.map((s) => (
              <div key={s.id} className="text-center">
                <div
                  className={`h-2 rounded-full ${s.trades ? 'bg-[var(--m-green)]' : 'bg-ink/10'}`}
                  title={`${s.label}: trade window ${s.trades ? 'open' : 'closed'}`}
                />
                <div className="text-[10px] text-[var(--m-faint)] mt-1 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--m-dim)] mt-2 leading-relaxed">
            Trading is open through the offseason, frozen once the auction list is final, open again after the
            auction until your first league match, and reopens at the end of the season.
          </p>
        </section>

        <section>
          <h3 className="m-label !text-[var(--m-text)] mb-2">Always in the toolbar</h3>
          <div className="grid sm:grid-cols-3 gap-3 text-xs text-[var(--m-dim)]">
            <ToolNote icon={ArrowLeftRight} title="Trades">Build deals, check CPU offers and your trade history.</ToolNote>
            <ToolNote icon={Database} title="Players">Search every player in the league with ratings and stats.</ToolNote>
            <ToolNote icon={Shield} title="Franchise office">Contracts, player development, history and saves.</ToolNote>
          </div>
        </section>

        <div className="flex justify-end">
          <MButton variant="primary" onClick={onClose}>Got it</MButton>
        </div>
      </div>
    </Modal>
  );
}

function ToolNote({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <Icon className="w-4 h-4 shrink-0 mt-0.5 text-[var(--m-text)]" />
      <div>
        <div className="font-semibold text-[var(--m-text)] text-sm">{title}</div>
        {children}
      </div>
    </div>
  );
}
