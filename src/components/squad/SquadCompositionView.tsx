'use client';

import React from 'react';
import type { Franchise } from '@/lib/types/game';
import type { SquadRules } from '@/lib/types/squad-rules';
import { OFFICIAL_IPL_SQUAD_RULES } from '@/lib/types/squad-rules';
import { analyzeSquadComposition } from '@/lib/engines/squad-rules';
import { formatPrice } from '@/lib/utils';
import { Shield, AlertTriangle, CheckCircle2, Users, Globe, Award, DollarSign } from 'lucide-react';

interface SquadCompositionViewProps {
  franchise: Franchise;
  rules?: SquadRules;
  compact?: boolean;
}

export function SquadCompositionView({
  franchise,
  rules = OFFICIAL_IPL_SQUAD_RULES,
  compact = false,
}: SquadCompositionViewProps) {
  const comp = analyzeSquadComposition(franchise, rules);

  const squadProgress = Math.min(100, Math.round((comp.totalPlayers / rules.maxSquadSize) * 100));
  const overseasProgress = Math.min(100, Math.round((comp.overseasPlayers / rules.maxOverseas) * 100));

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-[var(--m-panel)] p-2.5 rounded-xl border border-[var(--m-line)] text-xs">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-[var(--m-dim)]" />
          <span className="font-medium text-[var(--m-dim)]">Squad:</span>
          <span
            className={`font-bold tabular-nums ${
              comp.totalPlayers >= rules.minSquadSize ? 'text-[var(--m-green)]' : 'text-[var(--m-gold)]'
            }`}
          >
            {comp.totalPlayers}/{rules.maxSquadSize}
          </span>
          <span className="text-[10px] text-[var(--m-dim)]/70">(min {rules.minSquadSize})</span>
        </div>

        <div className="h-3 w-[1px] bg-[var(--m-line)]" />

        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-[var(--m-accent-ink)]" />
          <span className="font-medium text-[var(--m-dim)]">Overseas:</span>
          <span
            className={`font-bold tabular-nums ${
              comp.overseasPlayers > rules.maxOverseas ? 'text-[var(--m-red)]' : 'text-[var(--m-accent-ink)]'
            }`}
          >
            {comp.overseasPlayers}/{rules.maxOverseas}
          </span>
        </div>

        <div className="h-3 w-[1px] bg-[var(--m-line)]" />

        <div className="flex items-center gap-1.5 ml-auto">
          {comp.isLegal ? (
            <span className="telemetry-badge-sm bg-[var(--m-green)]/15 text-[var(--m-green)] border border-[var(--m-green)]/30">
              <CheckCircle2 className="w-3 h-3" /> Legal Squad
            </span>
          ) : (
            <span className="telemetry-badge-sm bg-[var(--m-gold)]/15 text-[var(--m-gold)] border border-[var(--m-gold)]/30">
              <AlertTriangle className="w-3 h-3" /> Deficit ({comp.minSlotsNeeded} req)
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-card p-5 rounded-xl space-y-4">
      {/* Title & Overall Legality Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[var(--m-accent-ink)]" />
          <h3 className="font-bold text-[var(--m-text)] text-base tracking-wide uppercase font-heading">
            Official IPL Squad Constraints
          </h3>
        </div>

        {comp.isLegal ? (
          <div className="telemetry-badge-sm bg-[var(--m-green)]/15 text-[var(--m-green)] border border-[var(--m-green)]/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Official Legal Squad
          </div>
        ) : (
          <div className="telemetry-badge-sm bg-[var(--m-gold)]/15 text-[var(--m-gold)] border border-[var(--m-gold)]/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            {comp.minSlotsNeeded > 0
              ? `Needs ${comp.minSlotsNeeded} More Player${comp.minSlotsNeeded > 1 ? 's' : ''}`
              : 'Action Required'}
          </div>
        )}
      </div>

      {/* Constraints Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Total Squad Count (18-25) */}
        <div className="p-3.5 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)]">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className="text-[var(--m-dim)] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[var(--m-dim)]" /> Total Squad Size
            </span>
            <span className="text-[var(--m-text)] font-bold text-sm tabular-nums">
              {comp.totalPlayers} <span className="text-[var(--m-dim)] font-normal">/ {rules.maxSquadSize}</span>
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-[var(--m-panel)] border border-[var(--m-line)] overflow-hidden relative">
            {/* Target 18 marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[var(--m-gold)] z-10"
              style={{ left: `${(rules.minSquadSize / rules.maxSquadSize) * 100}%` }}
              title={`Min legal threshold: ${rules.minSquadSize}`}
            />
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                comp.totalPlayers < rules.minSquadSize
                  ? 'bg-[var(--m-gold)]'
                  : comp.totalPlayers <= rules.maxSquadSize
                  ? 'bg-[var(--m-green)]'
                  : 'bg-[var(--m-red)]'
              }`}
              style={{ width: `${squadProgress}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-[var(--m-dim)] font-medium mt-1">
            <span>0</span>
            <span className="text-[var(--m-gold)] font-semibold">Min 18 Required</span>
            <span>Max 25</span>
          </div>
        </div>

        {/* Overseas Players (Max 8) */}
        <div className="p-3.5 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)]">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className="text-[var(--m-dim)] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[var(--m-accent-ink)]" /> Overseas Limit
            </span>
            <span className="text-[var(--m-text)] font-bold text-sm tabular-nums">
              {comp.overseasPlayers} <span className="text-[var(--m-dim)] font-normal">/ {rules.maxOverseas}</span>
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-[var(--m-panel)] border border-[var(--m-line)] overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                comp.overseasPlayers <= rules.maxOverseas ? 'bg-[var(--m-accent-ink)]' : 'bg-[var(--m-red)]'
              }`}
              style={{ width: `${overseasProgress}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-[var(--m-dim)] font-medium mt-1">
            <span>0</span>
            <span className="text-[var(--m-dim)]">{comp.remainingOverseasSlots} slots available</span>
            <span className="text-[var(--m-accent-ink)] font-semibold">Max 8 Ceiling</span>
          </div>
        </div>
      </div>

      {/* Composition Breakdown Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
        <div className="p-2.5 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)]">
          <div className="text-[10px] font-bold text-[var(--m-dim)] uppercase tracking-wider">Indian Players</div>
          <div className="text-lg font-bold text-[var(--m-gold)] mt-0.5 tabular-nums">{comp.indianPlayers}</div>
          <div className="text-[10px] text-[var(--m-dim)] font-medium">
            {comp.cappedIndian} Capped • {comp.uncappedIndian} Uncapped
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)]">
          <div className="text-[10px] font-bold text-[var(--m-dim)] uppercase tracking-wider">Overseas Players</div>
          <div className="text-lg font-bold text-[var(--m-accent-ink)] mt-0.5 tabular-nums">{comp.overseasPlayers}</div>
          <div className="text-[10px] text-[var(--m-dim)] font-medium">
            {comp.cappedOverseas} Capped • {comp.uncappedOverseas} Uncapped
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)]">
          <div className="text-[10px] font-bold text-[var(--m-dim)] uppercase tracking-wider">Role Balance</div>
          <div className="text-xs font-bold text-[var(--m-text)] mt-1 space-x-1">
            <span title="Batters">{comp.batters} BAT</span> •
            <span title="Bowlers">{comp.bowlers} BOWL</span> •
            <span title="All-Rounders">{comp.allRounders} AR</span> •
            <span title="Wicketkeepers">{comp.wicketkeepers} WK</span>
          </div>
          <div className="text-[10px] text-[var(--m-dim)] font-medium mt-0.5">Tactical Spread</div>
        </div>

        <div className="p-2.5 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)]">
          <div className="text-[10px] font-bold text-[var(--m-dim)] uppercase tracking-wider">Purse Reserve</div>
          <div className="text-lg font-bold font-mono text-[var(--m-green)] mt-0.5">
            {formatPrice(comp.remainingPurse)}
          </div>
          <div className="text-[10px] text-[var(--m-dim)] font-medium">
            {comp.minSlotsNeeded > 0
              ? `₹${comp.minSlotsNeeded * 20}L reserved for slots`
              : 'Sufficient balance'}
          </div>
        </div>
      </div>

      {/* Validation Warnings / Errors if any */}
      {comp.validationErrors.length > 0 && (
        <div className="p-3 rounded-xl bg-[var(--m-gold)]/10 border border-[var(--m-gold)]/30 text-[var(--m-gold)] text-xs space-y-1">
          <div className="font-bold uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Rule Notes
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[var(--m-dim)]">
            {comp.validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
