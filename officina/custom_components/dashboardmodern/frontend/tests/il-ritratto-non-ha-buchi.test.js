/* Il cerchio vuoto attaccato alla faccia, e la parola della fascia.
 *
 * Due cose viste nello stesso video di una casa vera — quello mandato per il
 * problema delle icone su iOS — e trovate guardando i fotogrammi.
 *
 * ── La pastiglia sul ritratto ───────────────────────────────────────────────
 *
 * Due card accanto: una con la pastiglia e il suo disegno dentro (l'omino di
 * chi sta fermo), l'altra con un cerchio VUOTO. Sembra un'icona che non è
 * arrivata, e chi guarda la segnala come tale. Invece era il pallino di
 * presenza, disegnato sempre, che di chi non ha un'attività nota non aveva
 * niente da mettere dentro.
 *
 * E non aveva niente da dire nemmeno col suo colore: la presenza la
 * raccontano già l'anello intorno al ritratto e la pastiglia accanto al nome.
 * Il pallino la diceva una terza volta, coprendo un pezzo di faccia.
 *
 * ── «Finestre aperte» di sei tapparelle (#31) ───────────────────────────────
 *
 * «Nella scheda il titolo tapparelle è corretto, mentre in quei piccoli popup
 *  che si aprono sopra dice finestre aperte.»
 *
 * Quel numero è due cose diverse a seconda della casa: i motori ALZATI dove
 * non c'è un solo contatto sull'anta, le finestre APERTE dove ci sono. La
 * tessera lo dice giusto dalla #442 — «sei tapparelle tirate su sono una casa
 * normale, sei finestre aperte sono una casa da chiudere» — ma alla fascia
 * arrivava solo il numero, e la parola era sempre la seconda.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { pastiglieDellaCasa } from "../src/core/come-sta-la-casa.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

test("senza attività il ritratto non porta nessuna pastiglia", () => {
  const sezione = leggi("sections/people-section.js");
  /* Il ramo che disegnava il cerchio vuoto non c'è più: senza attività, niente. */
  assert.match(sezione, /: ""\;\s*\n\s*return `<span class="dm-person-portrait">/);
  assert.ok(
    !/: `<i class="dm-person-dot" aria-hidden="true"><\/i>`/.test(sezione),
    "il pallino muto è tornato",
  );
  /* E con l'attività c'è, col disegno dentro: quello era giusto. */
  assert.match(sezione, /data-activity="true" aria-hidden="true">\$\{activity\}/);
});

/* La tessera delle Finestre come la fa la Home: solo motori, tre alzati. */
const soloTapparelle = {
  key: "tapparelle",
  icon: "🪟",
  accent: "#0ea5e9",
  open: [
    { entity: "cover.camera", name: "Camera" },
    { entity: "cover.sala", name: "Sala" },
    { entity: "cover.studio", name: "Studio" },
  ],
  soloMotori: true,
};

test("la fascia sa se quel numero sono motori o contatti", () => {
  const [pastiglia] = pastiglieDellaCasa([soloTapparelle], {
    barra: { voci: { tapparelle: true } },
  });
  assert.equal(pastiglia.chiave, "tapparelle");
  assert.equal(pastiglia.conto, 3);
  assert.equal(pastiglia.soloMotori, true, "senza questo la parola resta quella sbagliata");
});

test("con un contatto sull'anta il conto torna a essere finestre aperte", () => {
  const [pastiglia] = pastiglieDellaCasa([{ ...soloTapparelle, soloMotori: false }], {
    barra: { voci: { tapparelle: true } },
  });
  assert.equal(pastiglia.soloMotori, false);
});

test("e la parola la scrive di conseguenza", () => {
  const sezione = leggi("sections/come-sta-la-casa-section.js");
  assert.match(sezione, /if \(modello\?\.soloMotori\)/);
  assert.match(sezione, /t\("tapparelle alzate", "shutters up"\)/);
  assert.match(sezione, /t\("finestre aperte", "windows open"\)/);
  /* E il modello arriva fin lì: senza, la condizione sopra non si accende mai. */
  assert.match(sezione, /parolaDelConto\(pastiglia\.chiave, pastiglia\.conto, pastiglia\)/);
});
