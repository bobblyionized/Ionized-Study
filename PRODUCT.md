# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One user: the student who built it. They are preparing for the AMC 10/12 and taking a Precalculus class that follows a textbook chapter by chapter, at Belmont High School (2026–27 block schedule). They use it in a browser on a Windows computer and on an iPhone (Safari, saved to the Home Screen).

There is no other audience. Decisions can be tuned to exactly how this one person studies.

## Product Purpose

One place to study instead of a pile of separate apps ("every other study tool sucks"). From a single site the user can:

- start a timed focus session;
- learn a topic and work problems with full worked solutions;
- take timed mock exams;
- keep handwritten and typed math notes;
- open their own textbook;
- graph, and play focus music.

Progress and files follow them to every device. Success means they study here instead of reaching for other tools.

## Positioning

It is built around one student's real workload, which no general study tool covers in one place:

- **AMC 10/12:** a 20-year AMC 10 course with every past exam linked, about 7,100 problems with worked solutions, and AMC 10/12-style mock exams.
- **Precalculus:** sections that match their textbook's chapters, the assigned review problems, and the textbook PDFs themselves.
- **School:** their school's actual bell schedule.

## Operating Context

- **Timer screen (the landing page):** set a focus time, describe the session, keep a study-history log. Notebooks and focus music are reachable from here.
- **Study areas:** a hub leads to two tracks, AMC and Precalculus, then topic → subtopic or section, with the tabs Lesson · Problem Set · Notebook · Graph. Mock exams are timed.
- **Sync code:** 8 characters, entered once per device. Progress, settings, block names, notebooks, textbook PDFs and music all follow the code.
- **Clock sheet:** the Belmont High block schedule (7-day cycle, 1st/2nd lunch, Wednesdays, holidays and early releases) with a countdown to the next block, plus local and UTC time.
- **Ask AI:** sends a problem to Google AI Mode in a new tab.

## Capabilities and Constraints

**Permanent rules** (confirmed 2026-10-26):

- **No accounts, ever.** Sync stays code-based; no sign-ups or logins.
- **Works fully offline.** Every feature must keep working with no internet.
  - Status: not yet true on the website. The page and its CDN libraries need a connection to load; sync already tolerates going offline and catches up later. Open work.
- **Free.** No paid tiers, ads or paid services. Stays on Firebase's free Spark plan (1 GB stored, 10 GB/month downloaded; writes stop at the limit rather than billing).

**Current implementation** (not a rule; may change):

- A single-file static page built by `build.py` from `src/`, hosted on GitHub Pages.
- Firebase Realtime Database over REST.
- Libraries from CDNs: KaTeX, PDF.js, MathQuill, nerdamer, Google Fonts.

**Dropped:** a native iOS app was built and then removed on 2026-10-26. It is not part of the plan.

**Terminology:** sync code, track, topic, subtopic / section, Lesson, Problem Set, mock (exam), Notebook, block.

## Brand Commitments

- **Name:** Ionized Study.
- **Voice:** casual and blunt. The README reads "vibe coded study tool because every other study tool SUCKS!". This is the existing voice, recorded as evidence rather than as a binding rule.

## Evidence on Hand

- **Problem banks** in `src/topics/`: 7,113 problems, 1,432 hand-written and the rest generated. AoPS links to the 42 AMC 10 exams from 2006–2025.
- **Textbook chapter PDFs and answer scans:** the user's own copies, kept only under their sync code. Never commit them; the repo is public.
- **Focus music:** 19 "DeepWork Research" MP3s, the user's copies, kept only under their sync code. Redistribution rights are unconfirmed, so never publish them.
- **Belmont High 2026–27 schedule:** from the official cycle spreadsheet and the district calendar.
- **No proof exists:** no testimonials, other users, metrics or press. Do not invent any.

## Product Principles

1. **Everything in one place.** A new study need becomes part of Ionized Study, not a link out to another tool.
2. **Peers, not a hierarchy.** The timer, AMC prep, precalc and the tools matter equally; no part buries the others.
3. **Fit one student exactly.** Prefer this student's real classes, schedule, books and habits over generic users.
4. **Never locked out.** Access never depends on an account, a connection or money.
5. **Work is never lost.** Answers, notes, files and settings survive across devices and sessions.
