---
version: 1
slug: "sito-index-html"
primary_target: "sito/index.html"
related_targets: ["sito/privacy.html"]
---

# Surface brief: sito/index.html (gdahome.org)

Scope: redesign of the public site (index + privacy), Persuade mode. Audience: anyone (Home Assistant owners first, then families who do not know Home Assistant, installers, drivers for gdanav). Job: understand in seconds what gdahome is, see the real app, know the price, install the add-on and get the app; installers ask for access. Proof: real screenshots in sito/statico, real prices from docs/LICENZE.md, the automated end-to-end encryption test. Constraints: texts, prices and the IT/EN data-en mechanism stay; nothing loaded from outside; light cover; centralino/test/sito.test.js must pass.

## Direction contract

Round 2 (14 October 2026). The user rejected round 1 ("troppo bianco e vuoto") and took the standing exit: a modern, colourful app product site, executed at full fidelity. The round-1 catalogue contract is superseded.

THESIS: gdahome.org is a product site in the language of the apps its visitors already use: the gdahome blue as a real colour that owns whole bands of the page, the app shown inside a phone at scale, sections that change ground so the scroll has rhythm. It refuses the blurred-sky gradient, glass, glows and gradient text; colour is flat and committed.

OWN-WORLD: Committed colour strategy. Deep blue #1e3a8a and gdahome blue #1d4ed8 own the hero band, the Premium card and the footer; a blue-tinted light field #eef3ff and white alternate as section grounds; ink #0f172a; secondary text #475569 (#c7d2fe on blue); amber #f59e0b as the single accent for "acceso", the Premium badge and the lit nav item; green #16a34a only for "sì" marks. Shapes: 20px cards with a soft offset shadow (0 12px 32px rgba(15,23,42,.10)) on tinted grounds, 12px buttons, 999px chips for the section icons. Phones: a CSS frame with 40px radius, dark bezel, real offset shadow. Type: Archivo (self-hosted) at normal width, 700 for headlines (clamp 2.2–3.6rem), 400 text, 600 labels in sentence case; Oswald stays for prices.

STORY: the visitor lands on a blue band with the one-line promise and the phone showing the lights, sees the thirty sections as colourful chips, scrolls through white and tinted bands that each show one thing the app does with its real screens, reads prices as two plan cards, and installs.

FIRST VIEWPORT: a white header (mark, name, nav, IT/EN, blue button). Below it a full-width deep-blue band: left 6/12, headline in white, paragraph in blue-tinted white, blue-on-white primary button "Installa l'add-on" and an outlined white secondary; right 6/12, the lights screenshot inside a phone frame, large (about 360px wide on desktop), its bottom edge overlapping into the white section below. Under the band, on white, the series: thirty icon chips with names in a wrapping row (sideways scroll on phone). Mobile: headline, buttons, then the phone, then the chips.

FORM: app product site (the canon, taken by the user). Signature interaction: the nav item of the current section lights amber; the hero phone's "accesa" chip lights 600 ms after load. Motion: 160 ms ease-out hover lifts on cards and buttons; no entrance animations; reduced motion respected.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

Seed key f618642c (round 1 roll; round 2 is the user's standing exit, no roll).
