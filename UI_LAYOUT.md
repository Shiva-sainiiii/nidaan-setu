# Nidaan Setu — UI layout (as built)

This describes the screens as the current code renders them. Use it as the brief for the new design.
Every screen except the patient status page and the slip uses the same app shell. Content width is **max 1152px (max-w-6xl)**, with 16px side padding.

---

## 0. Design tokens (current)

| Token | Value | Use |
|---|---|---|
| brand-50 … brand-900 | `#eef4fa` → `#0e2a47` (deep navy) | primary buttons (700), headings/links (800), identity strip (900) |
| india-saffron / india-green | `#ff9933` / `#138808` | 4px tricolour strip at the top, logo pulse line, hero left border. Never large fills |
| Status colours | amber, sky, indigo, violet, teal, emerald, rose, slate | **meaning only** (see chips below) |
| Font | Latin sans + Noto Sans Devanagari fallback, 16px base, 1.5 line height | |
| Touch target | min 44px height on every button/input | |
| Radius | 6px buttons/inputs, 8px cards, 12–16px tiles, 2.5rem phone frame | |
| Theme | light only (projector and print friendly) | |
| Motion | new/changed rows flash pale yellow `#fff4d6` → white for 2.5s; "Live" dot pulses; both off with reduced motion | |

**Status chips** (pill, tinted background + ring):

| Status | Label EN / HI | Colour |
|---|---|---|
| open | Waiting for a lab / लैब का इंतज़ार | amber |
| accepted | Booked / बुक हो गई | sky |
| patient_confirmed | Patient confirmed | indigo |
| arrived | Patient arrived | violet |
| test_done | Test done | teal |
| report_sent | Report ready | emerald |
| closed / cancelled | Closed / Cancelled | slate |
| expired | Expired: keep original date | rose |
| no_show | No-show | rose |

**Priority chips** (solid, small): `P1 Urgent` red-600 · `P2 Soon` orange-500 · `P3 Routine` slate-500.
**Other badges:** `On temporary medication` (fuchsia), `BUNDLE NS-B501` (solid slate-800), `NEW` (solid amber-400), `Live` pill (green pulsing dot) / `Connection lost, retrying…` (rose).

**Shared components:** Card (white, 1px slate-300 border, 16px padding), Alert (info sky / success emerald / warn amber / error rose), Stat tile (uppercase label, 24px bold value, small hint), ScoreBreakdown (`Score 124 = [P2 +50] [temp meds +30] [waited 2d +4] [12 km −12]`, + green / − red), Timeline (vertical line, coloured dot per action, title, `time · actor (role) · from → to`, details), buttons: Primary (navy fill), Secondary (white, slate border), Danger (white, rose border).

---

## 1. App shell (all logged-in screens)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▬▬▬▬▬▬▬ saffron ▬▬▬▬▬▬▬▬ white ▬▬▬▬▬▬▬▬ green ▬▬▬▬▬▬▬  (4px)                │
├────────────────────────────────────────────────────────────────────────────┤
│ navy-900 strip (12px text)                                                 │
│ निदान सेतु · District diagnostic referral network   [Pilot concept · synthetic│
│                                                      demo data · not official]│ ← amber pill
├────────────────────────────────────────────────────────────────────────────┤
│ [NS] Nidaan Setu        My referrals | New referral | Hospital queue |      │
│      Diagnostic         Patient phone | Audit log        Dr. Mehta          │
│      referral desk      (active tab = 3px navy underline) doctor · Hosp A   │
│                                                [Switch user] [Demo controls ▾]│
└────────────────────────────────────────────────────────────────────────────┘  sticky
```
- Nav items by role: **doctor** → My referrals, New referral, Hospital queue · **lab** → Lab desk · **dho** → District dashboard. Everyone also gets Patient phone, Audit log.
- **Demo controls ▾** (dashed border) opens a 224px dropdown: red `Reset demo data` button, `+1h` `+6h` `+24h` buttons, note "Clock offset: +Nh". Label shows `· clock +6h` when the clock is moved.
- Page header pattern used on every screen: **H1 (24px bold) + grey subtitle** on the left, **Live badge + main action** on the right.

---

## 2. `/` Login picker

```
┌──────────────────────────────────────────────────────────────┐
│▌ Nidaan Setu · निदान सेतु                        (navy hero, │
│▌ A bridge to faster diagnosis (निदान = diagnosis, सेतु = bridge)  saffron
│▌ Your doctor stays the same. Only the test moves…   left border)
│▌ आपका डॉक्टर वही रहेगा। सिर्फ़ जाँच वहाँ होगी…                 │
└──────────────────────────────────────────────────────────────┘
Referring doctor            Creates test referrals and receives reports
[ Dr. Mehta              ]
[ Hospital A (A) · Govt  ]

Partner lab desks           Accept requests, mark arrived and done, upload reports
[ Lab B … ] [ Lab C … ] [ Lab D … ]      ← 3-col grid (2 on tablet, 1 on phone)
[ Lab E … ] [ Lab F · PPP, paid ]

District                    Network-level view
[ DHO · Demo District ]

No login needed
[ Patient phone (simulated SMS) ] [ Audit log ]
```
Each user is a clickable card (rounded-xl, hover → navy border). Error state: a red "Database not connected" card with the reason and a link to `/api/health`.

---

## 3. Doctor

### 3a. `/doctor` My referrals
```
My referrals                                         ● Live   [+ New referral]
Hospital A · test referrals to partner labs

┌ ✅ Report ready: NS-1001 · Ramesh Kumar · MRI done at Lab B · 14 days earlier → Open ┐  (one green alert per ready report)

[Active referrals 2] [Tests done elsewhere 1] [Patient-days saved 14] [Queue slots released 1]
                                            hint: original − actual   hint: given to next patient
┌──────────────────────────────────────────────────────────────────────────┐
│ REFERRAL   PATIENT        TEST  STATUS            LAB / SLOT   ORIGINAL  SAVED │
│ NS-1001    Ramesh Kumar   MRI   (Waiting for lab)  —           8 Dec     │
│ [P2][NS-B501] temp. medication   sent to 3 labs                          │
│ NS-1002 …                       (Report ready)    Lab B        8 Dec  14 d │
│                                                   26 Nov 10:00           │
└──────────────────────────────────────────────────────────────────────────┘
```
Stat tiles: 4 across on desktop, 2×2 on mobile. Table scrolls sideways on mobile. Empty: "No referrals yet. Create one to start."

### 3b. `/doctor/new` New referral (single column, 4 numbered cards)
```
Card 1. Patient                                    [Use demo patient (Ramesh Kumar)] (link)
  [Mobile number (or relative's)]   [ABHA ID (optional)]          ← 2 cols
  ⓘ Ramesh Kumar, 58 — MRI: original slot 8 Dec 10:00 (position 3), kept as backup
  ⚠ Already has an active referral for MRI (NS-1001). Untick it to continue.
  [New patient: name]   (only if the number is new)

Card 2. Tests and urgency
  Tests ordered (tick all that apply: one trip)
  [☑ MRI   your queue: 14 d] [☐ CT scan   your queue: 9 d]       ← 2-col checkbox tiles
  [☐ Ultrasound …        ] [☐ X-ray …              ]               (selected = navy border + tint)
  "2 tests → one bundle for this patient. One SMS; labs that can do all are shown first."
  [Current wait at your hospital (days)]  (only when no queue slot)
  Priority:  [P1 Urgent / desc] [P2 Soon / desc] [P3 Routine / desc]  ← 3 selectable tiles
  ☐ Patient is on temporary medication…
  [Short clinical note for the lab (280 left) ……………]

Card 3. Where to look
  Maximum travel distance: 25 km   ═══════●══════  (slider 5–60, step 5)
  3 partner labs within 25 km · 2 can do all 2 tests in one trip:
  ┌ Lab B  [all 2 tests, one trip]          12 km · MRI free ~1d · CT free ~2d ┐
  ├ Lab C                                    18 km · MRI ₹2500 ~0d             ┤
  └ None: widen the distance.  (empty)                                        ┘
  ⚠ No lab within 25 km offers X-ray. Widen the distance or untick it.

Card 4. Consent
  ☐ I explained to the patient (in Hindi/English)… and they agreed. (recorded in the audit log)

[Send to 3 labs] / [Send 2 tests to 3 labs]   [Cancel]
```
Send stays disabled until consent is ticked, at least one test is chosen, and labs cover every test.

### 3c. `/r/[id]` Referral detail (doctor and lab both use it)
```
NS-1001 (Booked) [P2] [On temp. medication] [BUNDLE NS-B501]   ● Live [Print slip] [Patient status page ↗]
MRI · referred by Dr. Mehta, Hospital A · 25 Nov 10:12

STATE BANNER (one of):
  open     ⚠ Waiting for a lab: sent to 3 labs within 25 km (radius widened). Offer window ends in 3 h…
  report   ┌ Report ready: 14 days earlier (big, green) ─────────────────────┐
           │ Original slot 8 Dec → test done 25 Nov at Lab B. Slot released… │
           │ [Open report (PDF)]  Reported by Dr. R. Sinha (Reg. HMC-12345)  │
           │ [Mark reviewed & close]                                        │
  expired  ✖ No lab accepted. The patient keeps the original date…
  cancelled ⓘ Cancelled. The patient keeps the original date…

┌──── left 2/3 ─────────────────────────────┐ ┌──── right 1/3 ───────────────┐
│ BOOKED AT                                   │ │ PATIENT                       │
│ Lab B — Sarvodaya District Hospital         │ │ Ramesh Kumar, 58  📱 98765…   │
│ address · phone                             │ │ Original slot: 8 Dec          │
│ Slot: 26 Nov 10:00 · 12 km · Free (govt)    │ │ "Low back pain radiating…"    │
├─────────────────────────────────────────────┤ ├───────────────────────────────┤
│ Timeline and audit        ☐ show data views │ │ OTHER TESTS IN BUNDLE NS-B501 │
│ ● Referral created  25 Nov 10:12 · Dr. Mehta│ │ CT NS-1002  (Booked)          │
│ ● Patient consent recorded                  │ │ Lab B · 26 Nov 10:00          │
│ ● Accepted by lab   … open → accepted       │ │ [All at one lab: one trip]    │
│ ● Accept rejected (already taken)  (red dot)│ ├───────────────────────────────┤
│ ● Original slot kept as backup (pink dot)   │ │ URGENCY (shown to every lab)  │
│ …                                           │ │ Score 124 = P2 +50 …          │
└─────────────────────────────────────────────┘ ├───────────────────────────────┤
                                                │ LABS NOTIFIED                 │
                                                │ Lab B 12 km        [accepted] │
                                                │ Lab C 18 km        [too late] │
                                                │ Lab D 30 km · round 2 [pending]│
                                                ├───────────────────────────────┤
                                                │ [Cancel: keep original date]  │ (danger, full width)
                                                └───────────────────────────────┘
```
On mobile the two columns stack (left column first).

### 3d. `/r/[id]/slip` Printable slip (max 672px, 2px black border, header bar hidden on print)
```
                                                         [Print]
┌──────────────────────────────────────────────────────────────┐
│ NIDAAN SETU (निदान सेतु) REFERRAL SLIP · रेफ़रल पर्ची     ┌──────┐│
│ NS-1001  (30px black)                                │  QR  ││
│ Ramesh Kumar · MRI (एमआरआई)                           └──────┘│
│ ┌ grey box: 26 Nov 10:00 / Lab B / address EN / address HI / 📞 · Free ┐
│   (or amber: "You will get an SMS when a lab is booked")      │
│ तैयारी            | Preparation                               │
│ साथ लाएँ           | Bring                                     │
│ ─────────────────────────────────────────────                 │
│ Report goes back to Dr. Mehta (Hospital A)… Original slot kept│
│ as backup: 8 Dec. Status: https://…/s/<token>                 │
└──────────────────────────────────────────────────────────────┘
```

### 3e. `/doctor/queue` Hospital queue (one card per test type)
```
Hospital queue                                                   ● Live
Hospital A diagnostic desk register. A referred patient's slot is held as a backup, then released…

┌ MRI ─────────────────────────────────────────────────────────────┐
│ 26 Nov 10:00 │ Pooja Devi     │ [booked] ↑ got an earlier slot   │ (green row)
│ 8 Dec 10:00  │ R̶a̶m̶e̶s̶h̶ ̶K̶u̶m̶a̶r̶  │ [released]                       │ Referral NS-1001 → Lab B (report sent) · slot given to Pooja
│ 10 Dec       │ Suresh         │ [held as backup]  (pink)         │
│ no date yet  │ Anita          │ [waiting] (amber)                │
└──────────────────────────────────────────────────────────────────┘
Reality check: most hospitals keep this register on paper… Back
```

---

## 4. Lab desk `/lab`
```
Lab desk                                                      ● Live
Lab B · test requests from nearby hospitals
[ toast alert, sticky: "Accepted NS-1001. Patient notified by SMS." / "Already accepted by Lab C" ]

Incoming requests (2)  |  Booked / today (1)  |  Done (0)      ← tabs, count pill amber when incoming > 0
```
New requests play a beep.

**Tab 1: Incoming.** Cards are sorted by score. A bundle that this lab can fully do gets +20.

Single request card (flashes with an amber ring for 15s when new):
```
┌───────────────────────────────────────────────────┬──────────────────────┐
│ MRI [P2] [On temporary medication] [NEW]            │ Slot you can offer   │
│ NS-1001 · from Hospital A · 12 km for the patient · │ [26/11/2026 10:00 ▾] │
│ Free at your lab (govt) · widened search            │ [      Accept      ] │
│ "Low back pain radiating to left leg…"              │ [      Decline     ] │
│ Score 124 = P2 +50 · temp meds +30 · …              │   (256px column)     │
│ Patient identity is shared only after you accept ·  │                      │
│ offer closes in 5 h                                  │                      │
└───────────────────────────────────────────────────┴──────────────────────┘
```
Bundle card (2px border, green when this lab can do every test):
```
┌───────────────────────────────────────────────────┬──────────────────────┐
│ [BUNDLE NS-B501] 2 tests for one patient [P2] [NEW] │ One slot for all     │
│ ✅ You can do all 2 open tests: one trip. +20 bonus  │ [26/11 10:00 ▾]      │
│   (or amber: "You can do 1 of 2; rest goes elsewhere")│ [Accept all 2 here  │
│ from Hospital A · 12 km · offer closes in 5 h       │   (one trip)]        │
│ ┌ MRI NS-1001 · free at your lab  [Accept only this]┐│                      │
│ │ Score …                                          ││                      │
│ ├ CT NS-1002 · ₹800 at your lab   [Accept only this]┤│                      │
│ └──────────────────────────────────────────────────┘│                      │
└───────────────────────────────────────────────────┴──────────────────────┘
```
Below the cards: **Recently closed for your lab**, grey rows: `NS-1003 MRI · Already accepted by Lab C` (red text) / `You declined`.
Empty: dashed box "No open requests right now. New ones appear here instantly."

**Tab 2: Booked / today** (one card per patient):
```
┌──────────────────────────────────────────────────────────────────────────┐
│ 26 Nov 10:00  MRI (Booked) [P2] [temp med]        [Arrived] [Test done] [No-show] │
│ NS-1001 · bundle NS-B501 · referred by Hospital A · "note"   (disabled when out of order)
│ Show patient details (link) → grey box: Ramesh Kumar, 58 · 📱 … (this view is logged)
│ ┌ only after Test done: navy-tint upload row (4 cols) ─────────────────┐ │
│ │ [Report PDF ⬆] [Reporting doctor] [Registration no.] [Upload & send] │ │
│ │                                                     [Use sample report]│
│ └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```
**Tab 3: Done:** list rows `NS-1001 · MRI · from Hospital A · 26 Nov 10:00   (Report ready) Report↗`.

---

## 5. Patient

### 5a. `/phone` Simulated phone (2 columns: controls | phone frame)
```
Patient phone  ● Live                        ┌─────────────────────────┐ 360×640, black 10px bezel
Simulated SMS. Patients need no app…         │ SMS · Nidaan Setu (NS-ALERT)│ navy header
                                             │ Ramesh Kumar  9876500001 │
PHONES WITH MESSAGES                         ├─────────────────────────┤ WhatsApp-beige bg #ece5dd
(Ramesh Kumar (2)) (Pooja Devi (1))  ← pills │ ┌ white bubble (left) ──┐│
                                             │ │ निदान सेतु: आपकी MRI… ││
Or any patient                               │ │ ───────────────────── ││
[Follow latest message ▾]                    │ │ Nidaan Setu: Your MRI…││
                                             │ │ ns.link/s/ab12…  10:14││
                                             │ └───────────────────────┘│
                                             │          ┌ green bubble ┐│ (patient reply, right)
                                             │          │ 1      10:15 ││
                                             │          └──────────────┘│
                                             ├─────────────────────────┤
                                             │ (1) [Reply…………] (Send)  │
                                             └─────────────────────────┘
```

### 5b. `/s/[token]` Public status page (no app shell, mobile-first, max 448px, 17px text)
```
[NS] निदान सेतु                                  (हिंदी | English)  ← pill toggle, Hindi default
नमस्ते Ramesh ji
आपकी जाँच: एमआरआई   (24px bold)
टोकन: NS-1001

┌ white card: 5-step list ─────────────┐
│ (✓) अनुरोध भेजा                       │  done = navy circle with ✓, bold
│ (✓) लैब में तारीख तय                   │
│ (3) आपने पुष्टि की                      │  pending = grey circle with number
│ (4) जाँच हो गई                         │
│ (5) रिपोर्ट डॉक्टर को भेजी               │
└──────────────────────────────────────┘
STATE CARD (one of):
  open:    amber  "Looking for an earlier slot… Your original date 8 Dec (Hospital A) is kept."
  booked:  white, 2px navy ring:  Go to / 26 Nov 10:00 (24px) / Lab B / address / Free (government)
           [📍 Open map] [📞 Call the lab]   ← 2 big equal buttons
           amber/green note: "Reply 1 to the SMS to confirm." / "You confirmed…" / "You are at the lab…"
  done:    navy tint  "Test done. The report will be sent to your doctor."
  report:  green      "The report has been sent to Dr. Mehta (Hospital A). Continue your treatment there."
  expired/cancelled: rose  "No earlier slot was found nearby. Your original date … is kept."
┌ Preparation / Bring with you ─────────┐  (while open or booked)
┌ Your other tests  (bundle) ───────────┐  CT NS-1002 · Lab B · 26 Nov 10:00 / Waiting for a lab
Updated: 25 Nov 10:15 · Questions? Contact your hospital.  (centered, small)
Demo with synthetic data. All names are fictional.
```

---

## 6. District `/dho` dashboard
```
District dashboard                                            ● Live
Demo District · all numbers are computed live from referral records

[Referrals sent] [Accepted by a lab 3 (75%)] [Tests done earlier] [Median days saved 13]
[Queue slots released] [Expired (no lab)] [On temp. med, >14 d] [Patient trips saved]
                                                                ← 8 stat tiles, 4 × 2 (2 × 4 on mobile)
┌ Facilities ────────────────────────────────────────────────────────────┐
│ FACILITY        SENT  RECEIVED  ACCEPTED   DECLINED  DONE FOR OTHERS   │
│ Lab B  Govt     0     3         2  67%     0         2                 │
└────────────────────────────────────────────────────────────────────────┘
┌ Priority use by doctor (spot queue-jumping) ┐ ┌ On temp. medication, test >14 days away ┐
│ DOCTOR  REFERRALS  P1 SHARE  TEMP MED FLAG  │ │ NS-1004 MRI · Hospital A · [P2]         │
│ Dr. Mehta  4       25%       50%            │ │        expected 12 Dec (Waiting…)       │
└─────────────────────────────────────────────┘ └─────────────────────────────────────────┘
DHO sees counts, not patient details. Open audit log
```

---

## 7. `/audit` Audit log
```
Audit log                                                     ● Live
Every action and every view of patient data… Append-only (the database rejects edits and deletes).

[Filter: NS-1001, accept, viewed…]  ☐ hide data views   42 rows (latest first)
┌──────────────────────────────────────────────────────────────────────────┐
│ #  TIME   ACTOR              ACTION                    REFERRAL STATE      DETAILS │
│ 42 10:15  Lab C · lab · C    [Accept rejected] (rose)  NS-1001  —         by: Lab B│
│ 41 10:15  Lab B · lab · B    [Accepted by lab] (navy)  NS-1001 open→accepted slot:…│
│ 40 10:14  Dr. Mehta          [Viewed referral] (grey)  NS-1001                     │
│ 39 …                         [Original slot released] (pink)                       │
│                              [Report sent] (green)                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Cross-screen behaviour to keep in the redesign
- **Live everywhere:** lists refresh every 2s; changed rows flash; the Live badge turns rose with "Connection lost, retrying…" when polling fails.
- **Safe actions:** buttons disable while busy ("Sending…", "Accepting…"); errors say "safe to retry".
- **Bilingual:** Hindi first on patient-facing pages (status page, SMS, slip); doctor/lab screens are English with Hindi in the brand.
- **Privacy cues:** "Patient identity is shared only after you accept", "this view is logged", "DHO sees counts, not patient details".
- **Synthetic-data disclaimer** must stay visible on every page (identity strip, status page footer).
- **Responsive:** grids collapse to 1 column on phones, tables scroll horizontally, all touch targets ≥ 44px. The status page is built phone-first.

## Screen inventory
| Route | Who | Purpose |
|---|---|---|
| `/` | everyone | demo login picker |
| `/doctor` | doctor | my referrals + 4 KPIs |
| `/doctor/new` | doctor | 4-step referral form |
| `/doctor/queue` | doctor / hospital desk | own hospital's waitlist, slot held → released |
| `/r/[id]` | doctor, lab | referral detail, timeline, report |
| `/r/[id]/slip` | doctor | printable bilingual slip with QR |
| `/lab` | lab | Incoming / Booked-today / Done tabs |
| `/phone` | demo (patient) | simulated SMS phone |
| `/s/[token]` | patient, no login | mobile status page, Hindi/English |
| `/dho` | district officer | 8 KPIs + 3 tables |
| `/audit` | everyone | append-only log |
