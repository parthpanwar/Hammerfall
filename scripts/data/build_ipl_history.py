#!/usr/bin/env python3
"""
IPL DYNASTY — IPL history index.

Reads Cricsheet's IPL ball-by-ball CSV2 export (https://cricsheet.org/downloads/ipl_csv2.zip,
unzipped) and writes, for every player in the global database, their real IPL record:
seasons played, matches, first/last season, and batting/bowling output. Auction AI uses
it to tell proven IPL performers from overseas names who have never done it on Indian
pitches (or did, and flopped).

Usage:
  python3 scripts/data/build_ipl_history.py <extracted-dir> [src/lib/data/ipl-history.json]

Players are matched by Cricsheet registry id (the database's `cricsheetId`), falling back to
an exact name match. Data is Cricsheet's (ODC-BY 1.0), see https://cricsheet.org.
"""
import csv
import glob
import json
import os
import sys
from collections import defaultdict

root = sys.argv[1]
out_path = sys.argv[2] if len(sys.argv) > 2 else 'src/lib/data/ipl-history.json'
DB = 'src/lib/data/global-player-database.json'

rec = defaultdict(lambda: {
    'seasons': set(), 'matches': 0, 'runs': 0, 'balls': 0, 'outs': 0,
    'wkts': 0, 'bowlBalls': 0, 'conceded': 0, 'names': set(), 'teams': {},
})

BOWLER_WICKETS = {'bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket'}

for info in sorted(glob.glob(os.path.join(root, '*_info.csv'))):
    mid = os.path.basename(info).replace('_info.csv', '')
    season = None
    name_to_id = {}
    team_of = {}
    with open(info, newline='', encoding='utf-8') as fh:
        for row in csv.reader(fh):
            if len(row) < 3 or row[0] != 'info':
                continue
            if row[1] == 'season' and season is None:
                # "2020/21" style seasons → first year; IPL seasons are single years.
                season = int(str(row[2])[:4])
            elif row[1] == 'player':
                team_of[row[3]] = row[2]
            elif row[1] == 'registry' and row[2] == 'people':
                name_to_id[row[3]] = row[4]
    for name, team in team_of.items():
        pid = name_to_id.get(name)
        if not pid:
            continue
        r = rec[pid]
        r['matches'] += 1
        r['seasons'].add(season)
        r['names'].add(name)
        r['teams'][season] = team

    balls = os.path.join(root, f'{mid}.csv')
    if not os.path.exists(balls):
        continue
    with open(balls, newline='', encoding='utf-8') as fh:
        for b in csv.DictReader(fh):
            striker = name_to_id.get(b['striker'])
            bowler = name_to_id.get(b['bowler'])
            wide = b['wides'] not in ('', '0')
            nb = b['noballs'] not in ('', '0')
            if striker:
                s = rec[striker]
                s['runs'] += int(b['runs_off_bat'] or 0)
                if not wide:
                    s['balls'] += 1
                if b['player_dismissed'] and name_to_id.get(b['player_dismissed']) == striker:
                    s['outs'] += 1
            if bowler:
                w = rec[bowler]
                extras_to_bowler = int(b['wides'] or 0) + int(b['noballs'] or 0)
                w['conceded'] += int(b['runs_off_bat'] or 0) + extras_to_bowler
                if not wide and not nb:
                    w['bowlBalls'] += 1
                if b['wicket_type'] in BOWLER_WICKETS:
                    w['wkts'] += 1

players = json.load(open(DB))['players']
by_name = defaultdict(list)
by_initial = defaultdict(set)


def initial_key(name):
    parts = name.replace('.', ' ').split()
    if len(parts) < 2:
        return None
    return (parts[-1].lower(), parts[0][0].lower())


for pid, r in rec.items():
    for n in r['names']:
        by_name[n].append(pid)
        k = initial_key(n)
        if k:
            by_initial[k].add(pid)

# Database names Cricsheet spells differently (no unique initial/suffix match).
ALIASES = {
    'Dushmantha Chameera': 'PVD Chameera',
    'Kamindu Mendis': 'PHKD Mendis',
    'Digvesh Singh': 'DS Rathi',
    'Vyshak Vijaykumar': 'Vijaykumar Vyshak',
    'Smaran Ravichandran': 'R Smaran',
    'Jordan Cox': 'JM Cox',
}

out = {}
matched = 0
for p in players:
    pid = p.get('cricsheetId')
    if (not pid or pid not in rec) and p['name'] in ALIASES:
        al = by_name.get(ALIASES[p['name']], [])
        pid = al[0] if len(al) == 1 else None
    if not pid or pid not in rec:
        cands = by_name.get(p['name'], [])
        pid = cands[0] if len(cands) == 1 else None
        if not pid:
            # "Kyle Jamieson" ↔ Cricsheet "KA Jamieson": surname + first initial, if unique.
            k = initial_key(p['name'])
            ic = by_initial.get(k, set()) if k else set()
            pid = next(iter(ic)) if len(ic) == 1 else None
        if not pid:
            # "Prasidh Krishna" ↔ Cricsheet "M Prasidh Krishna": full name as a suffix, if unique.
            suf = [q for n, qs in by_name.items() if n.endswith(' ' + p['name']) for q in qs]
            pid = suf[0] if len(set(suf)) == 1 else None
    if not pid or pid not in rec:
        continue
    r = rec[pid]
    seasons = sorted(s for s in r['seasons'] if s)
    matched += 1
    out[p['id']] = {
        'seasons': len(seasons),
        'matches': r['matches'],
        'firstSeason': seasons[0],
        'lastSeason': seasons[-1],
        'runs': r['runs'],
        'strikeRate': round(r['runs'] * 100 / r['balls'], 1) if r['balls'] else 0,
        'battingAvg': round(r['runs'] / r['outs'], 1) if r['outs'] else float(r['runs']),
        'wickets': r['wkts'],
        'economy': round(r['conceded'] * 6 / r['bowlBalls'], 2) if r['bowlBalls'] else 0,
        'ballsBowled': r['bowlBalls'],
    }

meta = {
    'source': 'Cricsheet IPL ball-by-ball (ODC-BY 1.0) — https://cricsheet.org',
    'latestSeason': max((s for r in rec.values() for s in r['seasons'] if s), default=None),
    'players': len(out),
}
json.dump({'meta': meta, 'players': out}, open(out_path, 'w'), indent=0, separators=(',', ':'))
print(f"IPL history: {matched}/{len(players)} database players have IPL records; latest season {meta['latestSeason']}")
