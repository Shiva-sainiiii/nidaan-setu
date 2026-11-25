# User guide

Open the app, pick a demo user on the start page (there are no passwords in this demo) and follow your role below. **Demo controls** in the header can reset the data and move the demo clock forward (+1 h, +6 h, +24 h).

## Doctor (Hospital A, Dr. A. Mehta)
1. **New referral**: enter the patient's phone (or *Use demo patient*). Pick one or more tests and the priority:
   - **P1 Urgent**: the first lab to accept wins.
   - **P2 / P3**: labs offer slots for 1 h / 4 h, then the earliest slot wins.

   Then set the max distance and choose the consent mode:
   - **Verbal**: tick the checkbox after reading the consent text to the patient.
   - **Confirm by SMS**: the patient gets a Hindi + English SMS and must reply YES. Labs see nothing until then.
2. **My referrals** updates live. A badge shows the consent status (Verbal / Pending SMS / Granted via SMS / Refused / Expired).
3. **Referral detail** shows:
   - the timeline;
   - the offers received, with the winner and the reason (for example "earliest slot: 27 Nov vs 28 Nov");
   - the score breakdown;
   - the report, with "N days earlier";
   - **Print slip** (QR code, preparation text in Hindi + English).
4. **Hospital queue**: the original slot is held as a backup and released to the next patient once the test is done.

## Lab desk (Hospitals B–F)
1. **Incoming** lists requests sorted by a transparent score. The patient's identity stays hidden until you book.
2. During an offer window, use **Offer slot** (you can update it until the countdown ends). Otherwise use **Accept**. For bundles, **Offer/Accept all N here (one trip)**.
3. If another lab won, the card says "Already accepted by …" or explains why your offer was not selected.
4. **Booked/Today**: *Arrived* → *Test done* → *Upload report (PDF)*. Use *No-show* if the patient doesn't come; the request goes back to the labs and the original slot is kept.

## Patient
- **Patient phone** (simulated): SMS in Hindi + English. Quick replies: `YES हाँ`, `NO नहीं`, `1` (confirm).
- **Status page** `/s/<token>` (link in the SMS, QR on the slip): no login, Hindi/English, large text. Shows consent pending, booking, preparation, address and progress.

## District Health Officer
- KPIs: requests, acceptance rate, average days saved, slots freed, trips saved, no-show rate, consent by SMS.
- **District map**:
  - one marker per hospital, coloured by current wait days (green ≤1, amber ≤3, red more) and sized by accepted referrals;
  - Hospital A drawn as a square;
  - 10/20/30 km rings;
  - arrows for active referrals.

  Click a marker for its details. Filter by test and date range; the KPIs follow the filter.

## Audit log
Every action, including failed attempts and views of patient data, with actor, role, time and from → to state. Rows cannot be edited or deleted.
