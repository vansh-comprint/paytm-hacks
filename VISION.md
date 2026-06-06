# VISION.md — Galla

**The voice till & digital munshi for India's shops.**
*Paytm AI Hackathon · Theme 2 (AI for Small Businesses).*
*Pairs with `AGENTS.md` (the build + work split). This doc is the what & why.*

---

## The 10-second pitch

> Paytm gave shopkeepers a voice for the money coming *in* — digitally. But half the shop runs on
> **cash Paytm never sees**, and the owner keeps no books. **Galla** is a digital *munshi*: the owner
> just *speaks* every sale, asks it anything, and it nudges him on what to restock and who to collect
> from — then at day's end tells him his **true numbers**, cash and UPI together, in his own language.

---

## 1. The Problem

The neighbourhood shop owner runs his whole business from memory. He can't type, keeps no books, and
mixes personal and business money. Three things hurt every single day:

- **Cash is invisible.** Paytm and the AI Soundbox only see *digital* payments. Every cash sale —
  often half the shop's revenue — is dark. There is no true picture of the day.
- **He reorders by gut**, so he runs out of fast-movers and never sees demand for what he *doesn't* stock.
- **At 9pm nothing reconciles** — drawer cash vs UPI vs udhaar given. He doesn't know if he made a profit.

A big shop has a *munshi* — the trusted clerk who keeps the books and chases the dues. The one-person
kirana has no one. It's the most common, most ignored gap in retail, and it's dark to every tool that
exists — because they all track money that *moved digitally*.

## 2. The Insight (our wedge)

**Capture the cash economy by voice, then reconcile it against the UPI data Paytm already has.**

That hands Paytm the one thing it cannot get any other way — the shop's *real* numbers — and it's
territory most teams won't touch, because everyone crowds onto digital payments and khata reminders.
Cash + voice + reconciliation is the open lane.

## 3. What Galla Is

A voice-first assistant that lives as the **listening brain for the Soundbox / Paytm Business app** —
no new hardware. The owner talks to it the way he'd talk to a munshi.

**A day in the life.** It's 8pm at Sharma General Store. All day, Ramesh-ji has tapped through cash and
UPI sales. Each one, he just said *"Paytm, pachaas cash Maggi"* and Galla quietly logged it. Twice it
spoke up — *"Maggi teesri baar khatam, order list mein daal du?"* When a regular took goods on credit, a
tap sent a polite WhatsApp reminder with a payment link. Now he asks, *"Paytm, aaj ka hisaab?"* — and
Galla tells him: **₹4,200 today, ₹2,800 online and ₹1,400 cash, 47 sales, busiest 6–8pm, and 3 people
asked for Maggi he didn't have.** For the first time he knows his real number — including the ₹1,400 no
app ever saw.

## 4. How It Works (one brain, many doors)

- **One entry point, three modes.** Text, *"Hey Paytm"* wake-word, and an ambient listen — all just
  different ways the same words reach the brain. Ambient only *logs* (never interrupts); wake-word is the
  one mode that talks back.
- **One brain.** Everything becomes text → a single intent router decides what it is: log a sale, log
  udhaar, log a miss, answer a question, or complete a to-do.
- **Three capabilities** hang off that brain: **Logging** (the true ledger + EOD tally), **Collections**
  (udhaar → consent → reminder), **Procurement** (misses/low stock → restock).
- **Three actions** are the outputs: a **to-do**, a **WhatsApp message sent with the owner's consent**,
  and (roadmap) a **voice call to the other party — never to the owner.**

## 5. The Companion / Munshi Layer

Galla isn't a form you fill; it's a munshi you talk to.

- **He asks it:** "aaj kitna becha?", "kiska udhaar baaki hai?", "sabse zyada kya bikta hai?", even
  "kal chhutti le sakta hu?" (cash-flow-aware).
- **It tells him:** "Maggi khatam — order karein?", "Ramesh ka ₹500, 10 din purana — yaad dilaayein?",
  "aaj kal se 20% kam bika", a morning briefing.
- **Insights over time:** true revenue + the cash-gap number, busiest hours, top movers and dead stock,
  walked-out demand, lapsed regulars, cash-crunch warnings before a big outflow.

## 6. Why It Wins

**Track 2 fit (in their words).** Their examples literally list *"actionable business insights"* and
*"workflow automation"* — which *is* Galla: the EOD true tally is the insight; voice-logging + auto
to-dos/reminders is the automation. Their focus — *"empowering small business owners with cutting-edge
technology"* — is the non-tech-owner-by-voice story exactly.

**Against the five judging criteria:**
- **Innovation** — the cash wedge (the money Paytm can't see) is outside the box. *Lead with it.*
- **Feasibility** — proven tools (Sarvam, Porcupine, web), cue-based capture that dodges the ambient-ASR
  and privacy traps. It can work in the real world, and we can say *why* the hard parts are handled.
- **Impact** — millions of shops, half their revenue invisible today, plus the aggregate cash-visibility
  story.
- **Execution** — a live, working prototype (the rule says slides alone are not allowed; our core loop runs).
- **Relevance** — a core "operate" pain for SMBs, dead on the track.

## 7. What Makes Us Different

- **vs the Soundbox:** it answers "kitna collection hua" on *digital* data. Galla adds **cash + walked-out
  demand + reconciliation + a companion** — the parts it can't see.
- **vs Khatabook / OkCredit:** they need you to type and tap, and they only track money you enter. Galla is
  **voice-first for a non-literate owner**, captures **cash automatically by ear**, and *talks back*.
- **vs the hackathon crowd:** everyone builds on money that moved. We build on the money that didn't —
  cash, and the sale that walked out.

## 8. MVP vs Vision (demo small, narrate big)

- **What we demo in 4 hours:** wake-word/text capture → log cash + UPI sales → one spoken query → the
  **EOD true tally** (hero) → a consent-based WhatsApp collection card → a restock to-do. *(Build details: `AGENTS.md`.)*
- **What stays a roadmap slide:** the full companion, the connections below, and the calling agents.
  The judges must see the core *run*; everything else is narrated as where Galla goes.

## 9. Connections & Roadmap

Galla becomes the shop's operating system as it grows its reach:

- **Paytm Payment Links** → collect udhaar / send to customers.
- **Paytm payouts** → pay distributors straight from a reminder.
- **WhatsApp** → reminders out, voice notes in, EOD summary to the owner's phone.
- **Paytm bill payments** → remind and pay electricity / rent / recharge.
- **Distributor reorder** → restock list → order (WhatsApp/SMS now, ONDC later).
- **Calling agents (add-on):** Galla *calls* the **debtor** to collect, or the **distributor** to reorder —
  in Hindi, on the owner's behalf (never calling the owner). Built on Bolna/LiveKit + Sarvam.
- **Account Aggregator + Paytm lending (the big one):** the cash-flow truth Galla captures becomes the
  basis for a working-capital line — *"short ₹8k for Diwali stock — pre-approved."* **Cash-visibility →
  underwriting** is real revenue for Paytm. This is the slide that makes an exec lean in.

## 10. The Paytm-scale story

One shop's true numbers are useful. Aggregate Galla across millions of shops and you've handed Paytm the
**cash economy it has been structurally blind to** — and the data to lend against it. That's not a feature;
that's a new asset class of data only a voice-on-the-counter product can capture.

## 11. The Pitch Spine

> "Paytm gave merchants a voice for the money coming in — digitally. But half the shop runs on cash Paytm
> never sees, and the owner has no one to keep his books. **Galla** is a digital munshi: speak each sale,
> ask it anything, and it tells you your *true* numbers — cash and UPI together — in your own language.
> *Paytm saw the ₹2,800. We just showed them the ₹1,400 they were blind to — and the way to lend against it.*"

---

*Name:* **Galla** — the shop's cash drawer. Optional persona: "Munshi ji."
*Build, ownership, contract, timebox → see `AGENTS.md`.*
