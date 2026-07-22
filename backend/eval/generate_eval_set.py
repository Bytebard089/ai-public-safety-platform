"""
Synthetic evaluation dataset generator.

All text is authored/templated by the developer for testing purposes only —
no real victim data, no scraped scam scripts. Templates are deliberately
varied in phrasing (not just filled-in copies of the regex patterns in
detector.py) so recall is measured honestly rather than against the exact
strings the rule engine was written to catch.

Three subtypes:
- scam: true digital-arrest / impersonation scam patterns, label=1
- benign_easy: ordinary unrelated calls, label=0
- benign_hard: legitimate calls that use scam-adjacent vocabulary
  (authority names, urgency, verification language) without being scams —
  the set most likely to produce false positives, which is exactly what a
  false-positive-rate claim needs to be tested against.
"""

import json
import random

random.seed(42)

NAMES = ["Ramesh", "Sunita", "Arjun", "Priya", "Vikram", "Anjali", "Suresh", "Meena", "Rahul", "Kavita",
         "Deepak", "Neha", "Manoj", "Pooja", "Sanjay", "Divya"]
CITIES = ["Mumbai", "Delhi", "Pune", "Bengaluru", "Lucknow", "Ahmedabad", "Chennai", "Jaipur",
          "Kolkata", "Hyderabad", "Nagpur", "Indore"]
AMOUNTS = ["25000", "50000", "80000", "120000", "15000", "60000", "35000", "95000"]
CASE_REFS = ["CY/2026/4471", "CBI/CC/9012", "FIR-3390", "ED/MUM/775", "NCB-2291", "CY/2026/8834", "CBI/CC/1207"]

# ---------------------------------------------------------------------------
# SCAM templates — paraphrased across authority / isolation / urgency / payment,
# many deliberately NOT matching the exact regex wording, to measure real recall.
# ---------------------------------------------------------------------------
SCAM_TEMPLATES = [
    "Hello {name}, I am calling from the {city} Cyber Crime branch. Your name has come up in a case ref {case}. You must stay connected on this video call and not hang up while we sort this out.",
    "This is Officer Verma, CBI. A parcel booked under your Aadhaar contains banned substances. To avoid being taken into custody today you need to move {amount} rupees to the account we verify you with.",
    "Sir, this is a Customs Department notice. Case {case} is open against you. Please do not mention this call to anyone at home, it could jeopardise the investigation.",
    "Ma'am this is the Enforcement Directorate. A look-out notice has been issued in your name. Keep your camera switched on and remain on this call until the matter is resolved.",
    "We are from the income tax intelligence wing regarding case {case}. If you disconnect now it will be recorded as non-cooperation and a team will be sent to your residence in {city}.",
    "This is a legal notice call. Your bank account is under scrutiny for a money laundering case. Send {amount} to the RBI holding account we provide to keep it from being frozen.",
    "{name}, this is the narcotics control bureau. Do not tell your family about this matter, it is strictly confidential until the case {case} is closed.",
    "Attention, this is your final warning before an arrest team reaches your address in {city}. Complete the identity verification and OTP confirmation right now to avoid this.",
    "This is Inspector {name2} calling. Stay on video, do not disconnect, and transfer {amount} as a refundable security deposit to clear the case against you.",
    "Your number is linked to an illegal SIM card racket under case {case}. Police will arrive within the hour unless you cooperate immediately and share the OTP sent to your phone.",
]

# ---------------------------------------------------------------------------
# BENIGN (easy) — ordinary, unrelated, low ambiguity.
# ---------------------------------------------------------------------------
BENIGN_EASY_TEMPLATES = [
    "Hi {name}, this is Zomato, your order is 5 minutes away.",
    "Reminder: your dentist appointment in {city} is tomorrow at 4pm.",
    "Hello, this is the school office, tomorrow's sports day has been postponed due to rain.",
    "{name}, your Amazon package will be delivered between 2pm and 6pm today.",
    "This is a reminder that your gym membership renews next week, no action needed.",
    "Hi, calling to confirm your table for two at 8pm tonight.",
    "Your electricity bill of this month is now available to view online.",
    "This is your cab driver, I've arrived outside your building in {city}.",
    "Hello {name}, just checking if you're still coming for dinner on Sunday.",
    "This is a courtesy call from your gym about the new yoga class starting Monday.",
]

# ---------------------------------------------------------------------------
# BENIGN (hard) — legitimate but uses authority names / urgency / verification
# language, deliberately close to scam surface features without being one.
# ---------------------------------------------------------------------------
BENIGN_HARD_TEMPLATES = [
    "This is a reminder from the Income Tax Department that returns are due by July 31st. No action needed if you've already filed.",
    "Hello, this is your bank's fraud team. We noticed an unusual transaction and want to confirm if it was you — no OTP or payment is ever needed for this call.",
    "This is Customs regarding your recently ordered item; a small duty payment is pending, payable only through the official government portal, link sent via SMS.",
    "This is the {city} Municipal Corporation with an urgent notice about water supply maintenance in your area tomorrow.",
    "Reminder from RBI's public awareness team: banks will never call asking for your OTP. This is an automated advisory, no response needed.",
    "This is your bank's KYC department, your annual KYC update is due this month, you may complete it by visiting your branch at your convenience.",
    "This is the passport office, your application under reference {case} is ready, please collect it within 15 days.",
    "This is a police station SHO office callback regarding the noise complaint you filed yesterday.",
    "Urgent: your flight to {city} tomorrow has been rescheduled by two hours, please check the airline app.",
    "This is your society's security office, please verify if your car with number plate ending 4471 is parked correctly, it is blocking the gate.",
]


def fill(template):
    return template.format(
        name=random.choice(NAMES),
        name2=random.choice(NAMES),
        city=random.choice(CITIES),
        amount=random.choice(AMOUNTS),
        case=random.choice(CASE_REFS),
    )


def generate(n_per_template=20):
    rows = []
    idx = 0
    for subtype, templates, label in [
        ("scam", SCAM_TEMPLATES, 1),
        ("benign_easy", BENIGN_EASY_TEMPLATES, 0),
        ("benign_hard", BENIGN_HARD_TEMPLATES, 0),
    ]:
        for t in templates:
            seen = set()
            attempts = 0
            count = 0
            while count < n_per_template and attempts < n_per_template * 15:
                attempts += 1
                text = fill(t)
                if text in seen:
                    continue
                seen.add(text)
                rows.append({"id": f"{subtype}_{idx:04d}", "text": text, "label": label, "subtype": subtype})
                idx += 1
                count += 1
    random.shuffle(rows)
    return rows


if __name__ == "__main__":
    dataset = generate(n_per_template=20)
    with open("eval_dataset.json", "w") as f:
        json.dump({
            "note": "Synthetic evaluation set, developer-authored, not real victim or case data. "
                    "benign_hard entries are legitimate-but-scam-adjacent, used to stress-test false positive rate.",
            "examples": dataset,
        }, f, indent=2)
    from collections import Counter
    print(Counter(r["subtype"] for r in dataset), "total:", len(dataset))
