#!/usr/bin/env python3
"""
Calibrate overall / potential so ratings match real-world standing.

  python3 scripts/data/calibrate_ratings.py

Why: the ball-by-ball model rated some players far from their real standing
(Cameron Green 77 at a ₹25.2 Cr price, Prithvi Shaw 87 at ₹75 L), and
"potential" was often BELOW overall (Shreyas Iyer 85 / 35), which made every
star look like he was declining. Trades then broke: a CPU would never swap a
"77" Green for an equally priced "85" player.

How:
  1. CURATED: hand-set OVR / POT (ceiling) for prominent IPL 2026 squad players,
     like a sports-game ratings team would (2025-26 form, role, standing).
  2. Everyone else in a squad: blend the data rating with a price-implied rating
     (an IPL fee is the market's verdict at auction time). Young uncapped big-fee
     signings keep a modest overall but get a high potential instead.
  3. Everyone: potential >= overall; players 31+ have no headroom (POT = OVR).
  4. Batting / bowling sub-ratings move with the overall so profiles stay consistent.
"""
import json
import math

DB_PATH = 'src/lib/data/global-player-database.json'
REPORT = 'scripts/data/calibrate_ratings.report.json'

# name: (overall, potential)
CURATED = {
    # --- Batters / keepers
    'Virat Kohli': (90, 90), 'Rohit Sharma': (85, 85), 'Suryakumar Yadav': (88, 88), 'Shubman Gill': (90, 92),
    'Yashasvi Jaiswal': (88, 93), 'Abhishek Sharma': (89, 93), 'Travis Head': (88, 88), 'Heinrich Klaasen': (89, 89),
    'Nicholas Pooran': (89, 89), 'Jos Buttler': (88, 88), 'KL Rahul': (87, 87), 'Shreyas Iyer': (88, 89),
    'Sanju Samson': (85, 86), 'Ruturaj Gaikwad': (85, 87), 'Rishabh Pant': (84, 88), 'Ishan Kishan': (83, 85),
    'Sai Sudharsan': (88, 92), 'Tilak Varma': (85, 90), 'Rinku Singh': (81, 83), 'Phil Salt': (86, 87),
    'Quinton de Kock': (80, 80), 'Tristan Stubbs': (82, 88), 'Dhruv Jurel': (79, 85), 'Rajat Patidar': (82, 83),
    'Shimron Hetmyer': (80, 80), 'Jitesh Sharma': (78, 80), 'Prabhsimran Singh': (81, 84), 'Priyansh Arya': (80, 88),
    'Vaibhav Suryavanshi': (78, 94), 'Ayush Mhatre': (76, 90), 'Dewald Brevis': (81, 90), 'Shashank Singh': (79, 80),
    'Nehal Wadhera': (77, 81), 'Devdutt Padikkal': (78, 80), 'Tim David': (82, 83), 'Aiden Markram': (82, 82),
    'David Miller': (78, 78), 'Ajinkya Rahane': (77, 77), 'Manish Pandey': (70, 70), 'Karun Nair': (74, 74),
    'Prithvi Shaw': (72, 76), 'Rahul Tripathi': (72, 72), 'Sarfaraz Khan': (72, 75), 'Angkrish Raghuvanshi': (77, 84),
    'Ayush Badoni': (77, 81), 'Ryan Rickelton': (82, 84), 'Josh Inglis': (81, 82), 'Finn Allen': (79, 81),
    'Tim Seifert': (75, 75), 'Ben Duckett': (79, 80), 'Pathum Nissanka': (81, 82), 'Tom Banton': (75, 77),
    'Jordan Cox': (74, 78), 'Matthew Breetzke': (76, 80), 'Rovman Powell': (76, 76), 'Donovan Ferreira': (76, 78),
    'Lhuan-dre Pretorius': (73, 86), 'Kartik Sharma': (70, 84), 'Urvil Patel': (72, 77), 'MS Dhoni': (74, 74),
    'Abhishek Porel': (77, 82), 'Ashutosh Sharma': (77, 80), 'Sameer Rizvi': (72, 80), 'Nitish Rana': (76, 77),
    'Aniket Verma': (73, 82), 'Kumar Kushagra': (66, 76), 'Naman Dhir': (76, 81), 'Smaran Ravichandran': (70, 80),
    'Robin Minz': (66, 76), 'Salil Arora': (66, 74), 'Akshat Raghuwanshi': (68, 78), 'Harnoor Singh': (68, 76),
    'Aman Rao': (66, 76), 'Anuj Rawat': (68, 70), 'Himmat Singh': (66, 68), 'Tejasvi Singh': (66, 74),
    # --- All-rounders
    'Hardik Pandya': (87, 87), 'Axar Patel': (86, 86), 'Ravindra Jadeja': (84, 84), 'Cameron Green': (86, 89),
    'Sunil Narine': (86, 86), 'Marcus Stoinis': (82, 82), 'Liam Livingstone': (81, 81), 'Glenn Phillips': (81, 81),
    'Jason Holder': (79, 79), 'Washington Sundar': (82, 84), 'Krunal Pandya': (81, 81), 'Shivam Dube': (82, 83),
    'Nitish Kumar Reddy': (81, 87), 'Venkatesh Iyer': (78, 80), 'Marco Jansen': (83, 85), 'Mitchell Santner': (82, 82),
    'Rachin Ravindra': (81, 85), 'Azmatullah Omarzai': (80, 83), 'Jacob Bethell': (79, 86), 'Sam Curran': (80, 81),
    'Romario Shepherd': (79, 79), 'Kamindu Mendis': (77, 80), 'Jamie Overton': (78, 80), 'Corbin Bosch': (76, 77),
    'Mitchell Owen': (76, 82), 'Cooper Connolly': (76, 84), 'Matthew Short': (77, 77), 'Rahul Tewatia': (77, 77),
    'Shahrukh Khan': (76, 78), 'Prashant Veer': (70, 84), 'Harpreet Brar': (74, 75), 'Akeal Hosein': (77, 77),
    'Wanindu Hasaranga': (83, 83), 'Shahbaz Ahmed': (74, 76), 'Anukul Roy': (70, 70), 'Musheer Khan': (68, 80),
    'Raj Angad Bawa': (68, 76), 'Brydon Carse': (76, 78), 'Mitchell Marsh': (83, 83), 'Will Jacks': (82, 84),
    'Sherfane Rutherford': (79, 80), 'Ramandeep Singh': (74, 77), 'Abdul Samad': (76, 79), 'Riyan Parag': (81, 87),
    'Jayant Yadav': (64, 64),
    # --- Bowlers
    'Jasprit Bumrah': (95, 95), 'Rashid Khan': (88, 88), 'Varun Chakravarthy': (88, 88), 'Kuldeep Yadav': (87, 87),
    'Yuzvendra Chahal': (84, 84), 'Arshdeep Singh': (87, 88), 'Mohammed Siraj': (85, 85), 'Josh Hazlewood': (87, 87),
    'Mitchell Starc': (85, 85), 'Trent Boult': (85, 85), 'Pat Cummins': (84, 84), 'Kagiso Rabada': (85, 85),
    'Jofra Archer': (85, 85), 'Matheesha Pathirana': (83, 89), 'Noor Ahmad': (85, 90), 'Prasidh Krishna': (86, 86),
    'Bhuvneshwar Kumar': (83, 83), 'Mohammed Shami': (80, 80), 'Harshal Patel': (81, 81), 'T Natarajan': (78, 78),
    'Khaleel Ahmed': (81, 82), 'Deepak Chahar': (80, 80), 'Avesh Khan': (79, 80), 'Mayank Yadav': (79, 88),
    'Ravi Bishnoi': (81, 83), 'Lungi Ngidi': (81, 81), 'Anrich Nortje': (79, 79), 'Nathan Ellis': (79, 79),
    'Matt Henry': (80, 80), 'Kyle Jamieson': (77, 78), 'Lockie Ferguson': (80, 80), 'Xavier Bartlett': (77, 80),
    'Ben Dwarshuis': (77, 77), 'Mukesh Kumar': (77, 78), 'Tushar Deshpande': (77, 78), 'Sandeep Sharma': (79, 79),
    'Yash Dayal': (77, 79), 'Rasikh Dar Salam': (74, 80), 'Suyash Sharma': (75, 80), 'Digvesh Singh': (77, 84),
    'Vipraj Nigam': (72, 82), 'Allah Ghazanfar': (77, 86), 'Nuwan Thushara': (77, 77), 'Jacob Duffy': (77, 77),
    'Eshan Malinga': (76, 80), 'Kwena Maphaka': (72, 86), 'Nandre Burger': (75, 78), 'Adam Milne': (74, 74),
    'Luke Wood': (72, 72), 'Dushmantha Chameera': (75, 75), 'Blessing Muzarabani': (74, 74), 'Zak Foulkes': (70, 77),
    'Vaibhav Arora': (76, 79), 'Harshit Rana': (79, 84), 'Umran Malik': (70, 74), 'Anshul Kamboj': (76, 80),
    'Rahul Chahar': (76, 77), 'Mayank Markande': (71, 72), 'Sai Kishore': (78, 79), 'Mohsin Khan': (75, 78),
    'Ishant Sharma': (70, 70), 'Jaydev Unadkat': (72, 72), 'Shivam Mavi': (68, 70), 'Kartik Tyagi': (66, 70),
    'Mukesh Choudhary': (70, 72), 'Shreyas Gopal': (66, 66), 'Vyshak Vijaykumar': (73, 75), 'Yash Thakur': (72, 74),
    'Arshad Khan': (72, 75), 'Gurjapneet Singh': (70, 78), 'Ashwani Kumar': (71, 78), 'Auqib Nabi': (72, 78),
    'Manav Suthar': (66, 74), 'Ashok Sharma': (66, 74), 'Prince Yadav': (70, 76), 'Akash Singh': (66, 70),
    'Arjun Tendulkar': (64, 68), 'Naman Tiwari': (64, 74), 'Yudhvir Singh': (66, 70), 'Vignesh Puthur': (68, 78),
    'Kuldeep Sen': (68, 72), 'Sakib Hussain': (64, 72), 'Zeeshan Ansari': (68, 72), 'Harsh Dubey': (70, 78),
    'Gurnoor Brar': (63, 70), 'Manimaran Siddharth': (66, 70), 'Prithviraj Yarra': (63, 70), 'Mangesh Yadav': (66, 76),
    'Swapnil Singh': (66, 66), 'Nishant Sindhu': (64, 74),
}


def price_implied(price_lakhs):
    """Market verdict: ₹25 Cr ≈ 87, ₹14 Cr ≈ 83, ₹5 Cr ≈ 77, ₹2 Cr ≈ 72, ₹30 L ≈ 66."""
    return 64 + 7.2 * math.log(1 + price_lakhs / 100)


def clamp(v, lo=35, hi=99):
    return int(max(lo, min(hi, round(v))))


def main():
    data = json.load(open(DB_PATH))
    changes = []
    for p in data['players']:
        r = p['ratings']
        # Idempotent: always calibrate from the model's original numbers.
        r.setdefault('modelOverall', r['overall'])
        r.setdefault('modelPotential', r['potential'])
        cur_ovr, cur_pot = r['overall'], r['potential']
        old_ovr, old_pot = r['modelOverall'], r['modelPotential']
        age = p['age']
        price = p.get('soldPrice') or 0
        if p['name'] in CURATED:
            ovr, pot = CURATED[p['name']]
            source = 'curated'
        elif p.get('currentFranchiseId'):
            implied = price_implied(price)
            if p['status'] == 'Uncapped' and age <= 23:
                # A big fee for a youngster buys upside, not current level.
                ovr = min(old_ovr + 3, 0.7 * old_ovr + 0.3 * implied)
                pot = max(old_pot, implied + 4, ovr + 6)
            else:
                ovr = 0.6 * old_ovr + 0.4 * implied
                pot = old_pot
            source = 'price-blend'
        else:
            # Unsigned free agents: unproven at IPL level are capped below the stars;
            # nobody unsigned should rate like a franchise cornerstone.
            ovr = min(old_ovr, 82) if p['status'] == 'Capped' else min(old_ovr, 76)
            pot = old_pot
            source = 'free-agent-cap'
        ovr = clamp(ovr)
        # Potential is a ceiling: never below overall; no headroom from 31.
        if age >= 31:
            pot = ovr
        else:
            headroom = max(0, (27 - age)) * 1.5
            pot = clamp(max(pot, ovr, min(pot, ovr + headroom + 4)) if source != 'curated' else max(pot, ovr))
        delta = ovr - cur_ovr
        if delta:
            role = p['role']
            if role in ('Batter', 'Wicketkeeper'):
                r['batting'] = clamp(r['batting'] + delta, 5)
            elif role == 'Bowler':
                r['bowling'] = clamp(r['bowling'] + delta, 5)
            else:
                r['batting'] = clamp(r['batting'] + delta * 0.8, 5)
                r['bowling'] = clamp(r['bowling'] + delta * 0.8, 5)
            r['t20Adaptability'] = clamp(r.get('t20Adaptability', ovr) + delta * 0.5)
            r['consistency'] = clamp(r.get('consistency', ovr) + delta * 0.4)
        r['overall'] = ovr
        r['potential'] = pot
        p['overallRating'] = ovr
        if cur_ovr != ovr or cur_pot != pot:
            changes.append({'name': p['name'], 'team': p.get('currentFranchiseId'), 'source': source, 'ovr': [old_ovr, ovr], 'pot': [old_pot, pot]})
    data['provenance']['ratingsCalibrated'] = 'curated + price-blend (scripts/data/calibrate_ratings.py)'
    json.dump(data, open(DB_PATH, 'w'), indent=2, ensure_ascii=False)
    json.dump(changes, open(REPORT, 'w'), indent=2, ensure_ascii=False)
    print(f'{len(changes)} players recalibrated')


if __name__ == '__main__':
    main()
