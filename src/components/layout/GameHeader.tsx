"use client";

import React, { useEffect, useRef, useState } from "react";
import { useGameStore, buildTradeWorld } from "@/lib/store/game-store";
import { formatPrice } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  CircleHelp,
  Database,
  Home,
  ListOrdered,
  ScrollText,
  Lock,
  Menu,
  Save,
  Shield,
} from "lucide-react";
import { getTeamTheme } from "@/lib/theme/team-themes";
import { GlobalPlayerDatabase } from "@/components/scouting/GlobalPlayerDatabase";
import { TeamCrest } from "@/components/mynba/primitives";
import { CHAPTERS, getFlowView, auctionTypeFor, campaignYear, campaignLength, seasonLabel } from "@/lib/flow/season-flow";
import { isWindowOpen } from "@/lib/engines/trade/trade-rules";
import { SeasonGuide } from "./SeasonGuide";

const GUIDE_SEEN_KEY = "ipl-dynasty.guide-seen.v1";

export function GameHeader() {
  const state = useGameStore();
  const {
    phase,
    setPhase,
    humanFranchiseId,
    franchises,
    currentSeason,
    saveGame,
    returnToMainMenu,
    openTradeCenter,
    closeTradeCenter,
    careerState,
  } = state;

  const windowType = auctionTypeFor(state.currentSeason, state.settings);
  const flow = getFlowView({ ...state, mini: windowType === "Mini" });
  const FLOW_STEPS = flow.steps;
  const year = campaignYear(state.currentSeason, state.settings);
  const tradeWindow = (() => {
    try {
      return isWindowOpen(buildTradeWorld(state));
    } catch {
      return { open: false, reason: "", closesAt: "" };
    }
  })();

  const incomingOffers = (careerState.trade?.proposals || []).filter(
    (p) =>
      p.status === "SUBMITTED" &&
      p.initiatedBy === "cpu" &&
      p.sides.some((s) => s.franchiseId === humanFranchiseId),
  ).length;

  const [showGlobalDb, setShowGlobalDb] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  // First visit to a career opens the guide once (per browser).
  const [guideOpen, setGuideOpen] = useState(() => {
    try {
      return (
        typeof localStorage !== "undefined" &&
        !localStorage.getItem(GUIDE_SEEN_KEY)
      );
    } catch {
      return false;
    }
  });
  const closeGuide = () => {
    setGuideOpen(false);
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, "1");
    } catch {
      /* private mode: show again next time */
    }
  };

  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 1800);
    return () => clearTimeout(t);
  }, [savedFlash]);

  const human = franchises.find((f) => f.id === humanFranchiseId);
  const theme = getTeamTheme(humanFranchiseId);
  const overseas =
    human?.players.filter((p) => p.nationality === "Overseas").length ?? 0;
  const chapter = CHAPTERS.find((c) => c.id === flow.current.chapter);

  const menuItem = (
    icon: React.ElementType,
    label: string,
    onClick: () => void,
    hint?: string,
  ) => {
    const Icon = icon;
    return (
      <button
        role="menuitem"
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-ink/5 rounded-[3px]"
        onClick={() => {
          setMenuOpen(false);
          onClick();
        }}
      >
        <Icon className="w-4 h-4 text-[var(--m-dim)]" />
        <span className="flex-1">{label}</span>
        {hint && (
          <span className="text-[11px] text-[var(--m-faint)]">{hint}</span>
        )}
      </button>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[var(--m-ink)] bg-[var(--m-bg)]/95 backdrop-blur-md transition-colors duration-500">
        <div
          className="h-1 w-full"
          aria-hidden
          style={{
            background: "linear-gradient(90deg, var(--m-accent) 0 78%, var(--m-accent-2) 78% 92%, var(--m-ink) 92%)",
          }}
        />

        {/* Row 1 — identity · season journey · essentials */}
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-5">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <TeamCrest franchiseId={humanFranchiseId} size="sm" />
            <div className="min-w-0 hidden sm:block">
              <div className="m-display text-[21px] leading-none truncate max-w-[190px]" title={theme.tagline}>
                {human?.name || "IPL Dynasty"}
              </div>
              <div className="m-label !text-[0.6rem] mt-1">
                <span title={`${seasonLabel(currentSeason, state.settings)} · campaign year ${year} of ${campaignLength(state.settings)}`}>
                  IPL {currentSeason} · {windowType} auction ’{String(currentSeason - 1).slice(2)} · {year}/{campaignLength(state.settings)}
                </span>
              </div>
            </div>
          </div>

          <nav
            className="flex-1 min-w-0 flex justify-center"
            aria-label="Season progress"
          >
            <ol className="flex items-center gap-3 overflow-x-auto m-scroll">
              {CHAPTERS.map((ch, ci) => (
                <li key={ch.id} className="flex items-center gap-3">
                  {ci > 0 && (
                    <span
                      className="w-4 h-px bg-[var(--m-line-strong)] hidden md:block"
                      aria-hidden
                    />
                  )}
                  <div className="flex flex-col items-start gap-1">
                    <span
                      className={`m-label !text-[0.56rem] hidden lg:block ${
                        ch.id === flow.current.chapter
                          ? "!text-[var(--m-text)]"
                          : "!text-[var(--m-faint)]"
                      }`}
                    >
                      {ch.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {FLOW_STEPS.map((s, i) => ({ s, i }))
                        .filter(({ s }) => s.chapter === ch.id)
                        .map(({ s, i }) => {
                          const st = flow.statuses[i];
                          const isCurrent = st === "current";
                          const onCurrentScreen = isCurrent && !flow.sidePage;
                          const done =
                            i < flow.currentIndex ||
                            (i < flow.reachedIndex && st !== "locked");
                          const clickable =
                            st === "open" || (isCurrent && !!flow.sidePage);
                          return (
                            <button
                              key={s.id}
                              disabled={!clickable}
                              onClick={() => clickable && setPhase(s.phase)}
                              aria-current={
                                onCurrentScreen ? "step" : undefined
                              }
                              title={`${i + 1}. ${s.label}${st === "locked" ? " (locked until earlier steps are done)" : ""}`}
                              className={`h-7 flex items-center gap-1.5 rounded-full font-medium text-[12.5px] whitespace-nowrap transition-colors ${
                                isCurrent
                                  ? "px-2.5 bg-ink text-[var(--m-bg)]"
                                  : clickable
                                    ? "px-1.5 text-[var(--m-text)] hover:bg-ink/10 cursor-pointer"
                                    : "px-1.5 text-[var(--m-faint)] cursor-default"
                              }`}
                            >
                              <span
                                className={`w-4 h-4 inline-flex items-center justify-center text-[10px] rounded-full ${
                                  isCurrent
                                    ? "bg-[var(--m-bg)] text-ink"
                                    : done
                                      ? "bg-[var(--m-green)] text-white"
                                      : "border border-[var(--m-line-strong)]"
                                }`}
                              >
                                {done && !isCurrent ? (
                                  <Check className="w-3 h-3" strokeWidth={3} />
                                ) : (
                                  i + 1
                                )}
                              </span>
                              {isCurrent && <span>{s.label}</span>}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {human && (
              <div className="hidden lg:flex items-center gap-4 pr-3 mr-1 border-r border-[var(--m-line)]">
                <HeaderStat
                  label="Purse"
                  value={formatPrice(human.remainingPurse)}
                  tone="text-[var(--m-green)]"
                />
                <HeaderStat
                  label="Squad"
                  value={`${human.players.length}`}
                  suffix={`/${human.maxSquadSize}`}
                />
                <HeaderStat
                  label="Overseas"
                  value={`${overseas}`}
                  suffix={`/${human.maxOverseas}`}
                />
              </div>
            )}
            <button
              className={`m-btn m-btn-sm relative ${phase === "TradeCenter" ? "m-btn-primary" : "m-btn-ghost"}`}
              onClick={openTradeCenter}
              title={
                incomingOffers
                  ? `Trades — ${incomingOffers} new offer${incomingOffers > 1 ? "s" : ""}`
                  : "Trades"
              }
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span className="hidden xl:inline">Trades</span>
              {incomingOffers > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--m-red)] text-white text-[10px] font-bold flex items-center justify-center">
                  {incomingOffers}
                </span>
              )}
            </button>

            <button
              className={`m-btn m-btn-sm ${phase === "Transactions" ? "m-btn-primary" : "m-btn-ghost"}`}
              onClick={() => setPhase("Transactions")}
              title="League transactions"
            >
              <ScrollText className="w-4 h-4" />
              <span className="hidden xl:inline">Transactions</span>
            </button>
            <div className="relative" ref={menuRef}>
              <button
                className="m-btn m-btn-ghost m-btn-sm"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                title="Menu"
              >
                {savedFlash ? (
                  <Check className="w-4 h-4 text-[var(--m-green)]" />
                ) : (
                  <Menu className="w-4 h-4" />
                )}
                <span className="hidden xl:inline">
                  {savedFlash ? "Saved" : "Menu"}
                </span>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-64 m-panel p-1.5 z-50"
                >
                  {menuItem(CircleHelp, "How a season works", () =>
                    setGuideOpen(true),
                  )}
                  {menuItem(Database, "Player database", () =>
                    setShowGlobalDb(true),
                  )}
                  {menuItem(
                    Shield,
                    "Franchise office",
                    () => setPhase("CareerDashboard"),
                    "contracts · history",
                  )}
                  {menuItem(ScrollText, "League transactions", () => setPhase("Transactions"), "every move")}
                  {state.fixtures.length > 0 &&
                    menuItem(ListOrdered, "Points table", () =>
                      setPhase("Standings"),
                    )}
                  <div className="my-1.5 h-px bg-[var(--m-line)]" />
                  {menuItem(Save, "Save game", () => {
                    saveGame();
                    setSavedFlash(true);
                  })}
                  {menuItem(Home, "Save & exit to main menu", () => {
                    saveGame();
                    returnToMainMenu();
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2 — where you are and what to do next */}
        <div className="border-t border-[var(--m-line)]">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 min-h-11 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            {flow.sidePage ? (
              <>
                <button
                  className="m-btn m-btn-ghost m-btn-sm !px-2"
                  onClick={() => (phase === 'TradeCenter' ? closeTradeCenter() : setPhase(flow.current.phase))}
                >
                  <ArrowLeft className="w-4 h-4" /> Back to {flow.current.label}
                </button>
                <span className="text-[var(--m-dim)] truncate">
                  You are in the{" "}
                  <b className="text-[var(--m-text)] font-semibold">
                    {flow.sidePage}
                  </b>
                  . Your season is paused on step {flow.currentIndex + 1}.
                </span>
              </>
            ) : (
              <>
                <span className="m-label !text-[0.62rem] shrink-0">
                  {chapter?.label} · Step {flow.currentIndex + 1} of{" "}
                  {FLOW_STEPS.length}
                </span>
                <span
                  className="text-[var(--m-dim)] min-w-0 flex-1 truncate"
                  title={flow.current.todo}
                >
                  {flow.current.todo}
                </span>
              </>
            )}
            <div className="ml-auto flex items-center gap-3 shrink-0">
              <button
                onClick={openTradeCenter}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--m-dim)] hover:text-[var(--m-text)]"
                title={
                  tradeWindow.open
                    ? `Trade window open — closes ${tradeWindow.closesAt}`
                    : tradeWindow.reason
                }
              >
                {tradeWindow.open ? (
                  <span
                    className="w-2 h-2 rounded-full bg-[var(--m-green)]"
                    aria-hidden
                  />
                ) : (
                  <Lock className="w-3 h-3" aria-hidden />
                )}
                Trade window {tradeWindow.open ? "open" : "closed"}
              </button>
              <button
                onClick={() => setGuideOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--m-dim)] hover:text-[var(--m-text)]"
              >
                <CircleHelp className="w-3.5 h-3.5" /> How it works
              </button>
            </div>
          </div>
        </div>
      </header>
      {/* Modals live outside the header: its backdrop-filter would trap fixed children. */}
      {showGlobalDb && (
        <GlobalPlayerDatabase
          isOpen={showGlobalDb}
          onClose={() => setShowGlobalDb(false)}
        />
      )}
      <SeasonGuide open={guideOpen} onClose={closeGuide} flow={flow} year={year} />
    </>
  );
}

function HeaderStat({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: string;
}) {
  return (
    <div className="text-right">
      <div className="m-label !text-[0.56rem]">{label}</div>
      <div
        className={`font-display text-[21px] leading-none tabular-nums mt-0.5 ${tone || ""}`}
      >
        {value}
        {suffix && <span className="text-[var(--m-faint)]">{suffix}</span>}
      </div>
    </div>
  );
}
