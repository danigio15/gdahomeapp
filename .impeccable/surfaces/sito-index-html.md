---
version: 1
slug: "sito-index-html"
primary_target: "sito/index.html"
related_targets: ["sito/privacy.html"]
---

# Surface brief: sito/index.html (gdahome.org)

Scope: redesign of the public site (index + privacy), Persuade mode. Audience: anyone (Home Assistant owners first, then families who do not know Home Assistant, installers, drivers for gdanav). Job: understand in seconds what gdahome is, see the real app, know the price, install the add-on and get the app; installers ask for access. Proof: real screenshots in sito/statico, real prices from docs/LICENZE.md, the automated end-to-end encryption test. Constraints: texts, prices and the IT/EN data-en mechanism stay; nothing loaded from outside; light cover; centralino/test/sito.test.js must pass.

## Direction contract

THESIS: gdahome.org is the product catalogue of a home: every screen of the app is a plate photographed straight on white paper, with its caption line and its series, the way an Italian switch-and-plate catalogue (Bticino, Vimar) shows what you will have on the wall. It refuses the glowing-phone hero over a blurred sky and the three-column card grid.

OWN-WORLD: bright white paper ground; a cool paper-grey field (#eef0f3) for specimen areas; ink #0b1220 (notte); catalogue blue #1d4ed8 for running heads, rules of emphasis, links and the one primary button; amber #f59e0b only for the single lit element on screen at a time ("acceso": the active thumb-tab, the hovered series icon, the toggled switch in the hero plate). Hairline rules (1px #c9ced6) build the grid; no shadows, no blur, no gradients, no rounded cards: plates sit on the paper with a 1px edge. Type: Archivo (variable width) as the catalogue voice: Expanded Black for series titles, Normal for text, Narrow Medium in small caps for captions and article lines; Oswald stays for tabular numbers (prices, dimensions), the plancia's own numeral face. Raise from the videocitofono (declined for the dark cover): one lit element at a time, never two amber things on screen. Raise from the planimetria (declined for the drawing it needs): the series is organised by room and by section, named, never by feature-card.

STORY: the visitor sees the app at true scale as a catalogue plate, reads the one line that says what it is, scans the series of thirty sections, understands "the home calls out" from a technical drawing, reads prices as a catalogue price list, and installs.

FIRST VIEWPORT: a running head rule across the top (gdahome mark 28px, name, and the thumb index as text tabs: La plancia · Come funziona · L'app · gdanav · Prezzi · Installatori · Scaricala · Contatti, IT/EN, primary button). Below, a two-column catalogue spread on a hairline grid: left column 5/12 carries the series title in Archivo Expanded Black at ~4.5rem on desktop ("La tua casa in una plancia. Anche fuori casa, senza aprire porte."), the one-paragraph description, the primary button "Installa l'add-on" (blue, square-cornered) and the index link "Guarda la plancia"; right column 7/12 carries plate 1: the lights screenshot, flat, no phone chrome, 1px edge, with dimension ticks on its left and bottom and the caption "Fig. 1 · Le luci, stanza per stanza" plus the article line "GDA · LUCI · SEZIONE 1/30". Under the spread, one full-width specimen strip on paper-grey: the thirty section icons in a row with names under them, the series index; hovering lights one amber. Mobile: the running head collapses to mark + menu; the spread stacks title, plate, button; the strip scrolls sideways.

FORM: catalogue spread (my candidate 6 of 7, assigned by the roll; seed key f618642c; degraded roll, no challengers). Signature interaction: the thumb index in the running head follows the scroll (the current section's tab is the one lit element), and on desktop a vertical set of thumb tabs on the right edge of the page mirrors it. Motion grammar: no entrance animations per section; one authored moment, the hero plate's "ACCESO" switch marker lights amber 600 ms after load (respecting reduced motion); everything else is instant.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
