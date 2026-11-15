#!/usr/bin/env python3
"""
Apply the real IPL 2026 squads (after the Dec 2025 auction + pre-auction trades)
to the bundled player database.

  python3 scripts/data/apply_ipl2026_squads.py

Source list: scripts/data/ipl2026_squads.txt  (TEAM | name | price in lakhs | role | I/O)
Compiled from the Times of Sports IPL 2026 squad tables (Dec 2025).

* Squad players get currentFranchiseId, contract value = their IPL 2026 price.
* Initials-style database entries are matched by hand (ALIASES) and renamed.
* Players missing from the database are created from NEW_PLAYERS with ESTIMATED
  ratings (dataQualityStatus = "Estimated", zero career stats — nothing invented).
* Every other player becomes an unsigned free agent.
"""
import copy
import json
import re
from collections import Counter
from datetime import datetime, timezone

DB_PATH = 'src/lib/data/global-player-database.json'
SQUADS = 'scripts/data/ipl2026_squads.txt'
REPORT = 'scripts/data/apply_ipl2026_squads.report.json'

TEAM = {'CSK': 'csk', 'DC': 'dc', 'MI': 'mi', 'RCB': 'rcb', 'KKR': 'kkr', 'LSG': 'lsg', 'GT': 'gt', 'SRH': 'srh', 'RR': 'rr', 'PBKS': 'pbks'}

# Squad name -> existing database name (initials-style or spelling variants)
ALIASES = {
    'Ayush Mhatre': 'A Mhatre', 'Jamie Overton': 'J Overton', 'Anshul Kamboj': 'A Kamboj',
    'Akeal Hosein': 'AJ Hosein', 'Abhishek Porel': 'Abishek Porel', 'Ben Duckett': 'BM Duckett',
    'Raj Angad Bawa': 'Raj Bawa', 'Corbin Bosch': 'C Bosch', 'Allah Ghazanfar': 'AM Ghazanfar',
    'Danish Malewar': 'DV Malewar', 'Jacob Bethell': 'JG Bethell', 'Jacob Duffy': 'JA Duffy',
    'Jordan Cox': 'JM Cox', 'Anukul Roy': 'AS Roy', 'Blessing Muzarabani': 'B Muzarabani',
    'Arshin Kulkarni': 'AA Kulkarni', 'Jayant Yadav': 'J Yadav', 'Brydon Carse': 'BA Carse',
    'Eshan Malinga': 'E Malinga', 'Jaydev Unadkat': 'JD Unadkat', 'Donovan Ferreira': 'D Ferreira',
    'Adam Milne': 'AF Milne', 'Cooper Connolly': 'C Connolly', 'Ben Dwarshuis': 'BJ Dwarshuis',
    'Digvesh Singh': 'Digvesh Rathi', 'Manimaran Siddharth': 'M Siddharth',
}
# Corrections for matched entries whose bio data was wrong in the source dataset.
FIX = {
    'Ayush Mhatre': {'age': 19, 'status': 'Capped'}, 'Allah Ghazanfar': {'country': 'Afghanistan', 'age': 20},
    'Jaydev Unadkat': {'age': 34}, 'Jacob Bethell': {'age': 23}, 'Jordan Cox': {'age': 25},
    'Ben Duckett': {'age': 31}, 'Adam Milne': {'age': 34}, 'Corbin Bosch': {'age': 31},
    'Donovan Ferreira': {'age': 27}, 'Cooper Connolly': {'age': 23}, 'Ben Dwarshuis': {'age': 32},
    'Jacob Duffy': {'age': 32}, 'Brydon Carse': {'age': 31}, 'Akeal Hosein': {'age': 33},
}

# name: (country, age, est. overall, bowling style code, Capped?, bats L?)
# Ratings are estimates from role, international standing and auction price.
NEW_PLAYERS = {
    'Urvil Patel': ('India', 27, 70, 'N', 0, 0), 'Ramakrishna Ghosh': ('India', 28, 62, 'RFM', 0, 0),
    'Shreyas Gopal': ('India', 32, 66, 'LB', 1, 0), 'Kartik Sharma': ('India', 19, 68, 'N', 0, 0),
    'Prashant Veer': ('India', 20, 68, 'SLA', 0, 1), 'Matthew Short': ('Australia', 30, 76, 'OB', 1, 0),
    'Aman Khan': ('India', 29, 64, 'RFM', 0, 0), 'Sarfaraz Khan': ('India', 28, 68, 'N', 1, 0),
    'Matt Henry': ('New Zealand', 34, 80, 'RFM', 1, 0), 'Zak Foulkes': ('New Zealand', 23, 70, 'RFM', 1, 0),
    'Karun Nair': ('India', 34, 74, 'N', 1, 0), 'Vipraj Nigam': ('India', 21, 70, 'LB', 0, 0),
    'Madhav Tiwari': ('India', 22, 62, 'RFM', 0, 0), 'Tripurana Vijay': ('India', 24, 60, 'OB', 0, 0),
    'Dushmantha Chameera': ('Sri Lanka', 34, 75, 'RF', 1, 0), 'Pathum Nissanka': ('Sri Lanka', 28, 80, 'N', 1, 0),
    'Lungi Ngidi': ('South Africa', 30, 78, 'RF', 1, 0), 'Sahil Parekh': ('India', 19, 58, 'OB', 0, 1),
    'Kyle Jamieson': ('New Zealand', 31, 77, 'RF', 1, 0), 'Ryan Rickelton': ('South Africa', 30, 79, 'N', 1, 1),
    'Robin Minz': ('India', 23, 62, 'N', 0, 1), 'Mitchell Santner': ('New Zealand', 34, 82, 'SLA', 1, 1),
    'Sherfane Rutherford': ('West Indies', 28, 78, 'RFM', 1, 1), 'Mayank Markande': ('India', 29, 70, 'LB', 1, 0),
    'Raghu Sharma': ('India', 33, 60, 'LB', 0, 0), 'Mohammad Izhar': ('India', 20, 58, 'RFM', 0, 0),
    'Atharva Ankolekar': ('India', 25, 60, 'SLA', 0, 1), 'Mayank Rawat': ('India', 25, 58, 'OB', 0, 0),
    'Satvik Deswal': ('India', 24, 58, 'SLA', 0, 1), 'Mangesh Yadav': ('India', 23, 64, 'LFM', 0, 1),
    'Vicky Ostwal': ('India', 24, 60, 'SLA', 0, 0), 'Vihaan Malhotra': ('India', 19, 58, 'OB', 0, 0),
    'Kanishk Chouhan': ('India', 19, 58, 'OB', 0, 0), 'Manish Pandey': ('India', 37, 68, 'N', 1, 0),
    'Tejasvi Singh': ('India', 23, 62, 'N', 0, 0), 'Tim Seifert': ('New Zealand', 31, 74, 'N', 1, 0),
    'Prashant Solanki': ('India', 26, 62, 'LB', 0, 0), 'Sarthak Ranjan': ('India', 29, 60, 'N', 0, 0),
    'Daksh Kamra': ('India', 20, 58, 'LB', 0, 0), 'Saurabh Dubey': ('India', 27, 60, 'LFM', 0, 0),
    'Matthew Breetzke': ('South Africa', 27, 75, 'N', 1, 0), 'Prince Yadav': ('India', 24, 66, 'RFM', 0, 0),
    'Mukul Choudhary': ('India', 22, 60, 'N', 0, 0), 'Naman Tiwari': ('India', 20, 60, 'LFM', 0, 1),
    'Akshat Raghuwanshi': ('India', 22, 62, 'N', 0, 0), 'Kumar Kushagra': ('India', 21, 64, 'N', 0, 0),
    'Nishant Sindhu': ('India', 21, 64, 'SLA', 0, 1), 'Prasidh Krishna': ('India', 30, 82, 'RF', 1, 0),
    'Manav Suthar': ('India', 23, 66, 'SLA', 0, 0), 'Tom Banton': ('England', 27, 74, 'N', 1, 0),
    'Prithviraj Yarra': ('India', 24, 60, 'LFM', 0, 0), 'Luke Wood': ('England', 31, 73, 'LF', 1, 0),
    'Smaran Ravichandran': ('India', 22, 64, 'N', 0, 1), 'Kamindu Mendis': ('Sri Lanka', 27, 76, 'OB', 1, 1),
    'Zeeshan Ansari': ('India', 26, 65, 'LB', 0, 0), 'Shivang Kumar': ('India', 23, 58, 'SLA', 0, 0),
    'Salil Arora': ('India', 23, 62, 'N', 0, 0), 'Sakib Hussain': ('India', 21, 62, 'RF', 0, 0),
    'Onkar Tarmale': ('India', 23, 58, 'RFM', 0, 0), 'Amit Kumar': ('India', 24, 58, 'RFM', 0, 0),
    'Praful Hinge': ('India', 24, 60, 'RFM', 0, 0), 'Krains Fuletra': ('India', 21, 56, 'SLA', 0, 0),
    'Shivam Mavi': ('India', 27, 68, 'RFM', 1, 0), 'Vaibhav Suryavanshi': ('India', 15, 76, 'N', 0, 1),
    'Lhuan-dre Pretorius': ('South Africa', 20, 72, 'N', 1, 1), 'Yudhvir Singh': ('India', 28, 66, 'RFM', 0, 0),
    'Kwena Maphaka': ('South Africa', 20, 72, 'LF', 1, 0), 'Sushant Mishra': ('India', 25, 62, 'LFM', 0, 1),
    'Vignesh Puthur': ('India', 25, 66, 'LC', 0, 0), 'Yash Raj Punja': ('India', 22, 58, 'LB', 0, 0),
    'Ravi Singh': ('India', 23, 60, 'N', 0, 0), 'Aman Rao': ('India', 21, 62, 'N', 0, 0),
    'Priyansh Arya': ('India', 25, 77, 'N', 0, 1), 'Pyla Avinash': ('India', 25, 60, 'N', 0, 0),
    'Musheer Khan': ('India', 21, 64, 'SLA', 0, 0), 'Harnoor Singh': ('India', 23, 64, 'N', 0, 1),
    'Suryansh Shedge': ('India', 23, 62, 'RM', 0, 0), 'Mitchell Owen': ('Australia', 24, 76, 'RM', 1, 0),
    'Vyshak Vijaykumar': ('India', 29, 71, 'RFM', 0, 0), 'Xavier Bartlett': ('Australia', 27, 75, 'RFM', 1, 0),
    'Pravin Dubey': ('India', 33, 60, 'LB', 0, 0), 'Ashok Sharma': ('India', 23, 62, 'RFM', 0, 0),
    'Gurnoor Brar': ('India', 25, 61, 'RFM', 0, 0), 'Digvesh Singh': ('India', 25, 74, 'LB', 0, 0),
    'Manimaran Siddharth': ('India', 27, 64, 'SLA', 0, 0), 'Auqib Nabi': ('India', 29, 70, 'RFM', 0, 0),
}
STYLE = {
    'N': 'None', 'RF': 'Right-arm Fast', 'RFM': 'Right-arm Fast Medium', 'RM': 'Right-arm Medium',
    'LF': 'Left-arm Fast', 'LFM': 'Left-arm Fast Medium', 'OB': 'Right-arm Off Break',
    'LB': 'Right-arm Leg Break', 'SLA': 'Left-arm Orthodox', 'LC': 'Left-arm Chinaman',
}
SPIN = {'OB', 'LB', 'SLA', 'LC'}


def norm(s):
    return re.sub(r'[^a-z]', '', s.lower())


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def base_price(lakhs):
    for bp in (200, 150, 100, 75, 50, 40, 30):
        if lakhs >= bp * 2:
            return bp
    return 30


def build_new(name, role, overseas, price, template, now):
    country, age, ovr, style, capped, left = NEW_PLAYERS[name]
    p = copy.deepcopy(template)
    youth = max(0, 26 - age)
    bat = {'Batter': ovr, 'Wicketkeeper': ovr, 'All-Rounder': ovr - 4, 'Bowler': 28}[role]
    bowl = {'Batter': 20 if style == 'N' else 35, 'Wicketkeeper': 15, 'All-Rounder': ovr - 4, 'Bowler': ovr}[role]
    p.update({
        'id': slug(name), 'name': name, 'age': age, 'nationality': 'Overseas' if overseas else 'Indian',
        'country': country, 'status': 'Capped' if capped else 'Uncapped', 'role': role,
        'previousFranchises': [], 'battingHand': 'Left' if left else 'Right', 'bowlingStyle': STYLE[style],
        'isSpinner': style in SPIN, 'isOpener': role in ('Batter', 'Wicketkeeper') and ovr >= 70,
        'isDeathBowler': style in ('RF', 'LF') and ovr >= 75, 'isPowerplayBowler': style in ('RF', 'RFM', 'LF', 'LFM'),
        'preferredBattingPosition': 3 if role in ('Batter', 'Wicketkeeper') else 6 if role == 'All-Rounder' else 9,
        # Uncapped base prices are capped at ₹50 L; nearly all newcomers register at ₹30 L.
        'basePrice': base_price(price) if capped else 30, 'estimatedMarketValue': max(30, price),
        'cricsheetId': None, 'alternateNames': [], 'secondaryRole': None,
        'dataQualityStatus': 'Estimated', 'ratingConfidence': 0.35, 'verificationConfidence': 0.5,
        'dataSource': 'Estimated from IPL 2026 squad listing (role, standing, auction price)',
        'verificationSource': 'IPL 2026 squad lists (Dec 2025)', 'lastVerificationDate': now,
        'manualReviewRequired': True, 'lastVerifiedMatch': None,
    })
    p['stats'] = {k: (0 if isinstance(v, (int, float)) else '-') for k, v in template['stats'].items()}
    r = p['ratings']
    r.update({
        'batting': bat, 'bowling': bowl, 'fielding': 70, 'powerHitting': max(30, bat - 3), 'consistency': ovr - 5,
        't20Adaptability': ovr, 'potential': min(95, ovr + youth * 2), 'overall': ovr,
        'rawPerformanceRating': ovr - 5, 'oppositionAdjustedRating': ovr, 'competitionAdjustedRating': ovr,
        'recentFormRating': ovr, 'experienceRating': 40 if not capped else 70, 'ratingConfidence': 0.35,
        'dataSource': 'Estimated', 'dataQualityStatus': 'Estimated',
    })
    for k in ('rawPerformanceRating', 'oppositionAdjustedRating', 'competitionAdjustedRating', 'recentFormRating'):
        p[k] = r[k]
    p['overallRating'] = ovr
    p['recentForm'] = ovr
    return p


def main():
    now = datetime.now(timezone.utc).isoformat()
    data = json.load(open(DB_PATH))
    players = data['players']
    rows = [l.split(' | ') for l in open(SQUADS).read().strip().split('\n')]
    by_norm = {norm(p['name']): p for p in players}

    signed, created, renamed = {}, [], []
    templates = {}
    for p in players:
        templates.setdefault(p['role'], p)

    for team, name, price, role, io in rows:
        price = int(price)
        target = by_norm.get(norm(name)) or by_norm.get(norm(ALIASES.get(name, '#')))
        if target is None:
            if name not in NEW_PLAYERS:
                raise SystemExit(f'No data for {name} ({team}) — add to ALIASES or NEW_PLAYERS')
            target = build_new(name, role, io == 'O', price, templates[role], now)
            players.append(target)
            by_norm[norm(name)] = target
            created.append(name)
        elif target['name'] != name:
            renamed.append(f"{target['name']} -> {name}")
            target['alternateNames'] = sorted(set((target.get('alternateNames') or []) + [target['name']]))
            target['name'] = name
        target.update(FIX.get(name, {}))
        target['nationality'] = 'Overseas' if io == 'O' else 'Indian'
        signed[target['id']] = (TEAM[team], price)

    if len({id(p) for p in players}) != len(players):
        raise SystemExit('duplicate objects')
    for p in players:
        if p['id'] in signed:
            fid, price = signed[p['id']]
            prev = p.get('currentFranchiseId')
            if prev and prev != fid:
                p['previousFranchises'] = sorted(set((p.get('previousFranchises') or []) + [prev]))
            p.update({'currentFranchiseId': fid, 'currentContractValue': price, 'soldPrice': price, 'isSold': True,
                      'isRetained': False, 'isRetired': False, 'isAvailableForAuction': True})
        else:
            p.update({'currentFranchiseId': None, 'isSold': False, 'soldPrice': 0, 'isRetained': False})

    counts = Counter(p['currentFranchiseId'] for p in players if p['currentFranchiseId'])
    overseas = Counter(p['currentFranchiseId'] for p in players if p['currentFranchiseId'] and p['nationality'] == 'Overseas')
    assert all(18 <= n <= 25 for n in counts.values()), counts
    assert all(n <= 8 for n in overseas.values()), overseas
    ids = [p['id'] for p in players]
    assert len(ids) == len(set(ids)), 'duplicate ids'

    data['provenance'].update({
        'squadsAsOf': 'IPL 2026 (after the Dec 2025 auction and trades)',
        'squadsSource': 'scripts/data/ipl2026_squads.txt',
        'totalPlayers': len(players), 'squadsAppliedAt': now,
    })
    json.dump(data, open(DB_PATH, 'w'), indent=2, ensure_ascii=False)
    json.dump({'created': created, 'renamed': renamed, 'squadCounts': counts, 'overseas': overseas}, open(REPORT, 'w'), indent=2)
    print(f'{len(signed)} squad players · {len(created)} created (estimated) · {len(renamed)} renamed · DB {len(players)}')
    print(dict(counts))


if __name__ == '__main__':
    main()
