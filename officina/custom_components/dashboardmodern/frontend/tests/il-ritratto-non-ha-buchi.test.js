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
 *
 * Dalla #162 la domanda non si pone piu': la pastiglia delle tapparelle conta
 * i soli motori su, sempre, e le ante aperte stanno nella pastiglia delle
 * finestre. Qui resta la prova che la parola e' quella giusta.
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

/* La tessera delle Finestre come la fa la Home: tre motori su, e un'anta
 * aperta che non e' affar suo. */
const conLAnta = {
  key: "tapparelle",
  icon: "🪟",
  accent: "#0ea5e9",
  open: [{ entity: "binary_sensor.anta_bagno", name: "Bagno" }],
  alzate: [
    { entity: "cover.camera", name: "Camera" },
    { entity: "cover.sala", name: "Sala" },
    { entity: "cover.studio", name: "Studio" },
  ],
  contattiAperti: [{ entity: "binary_sensor.anta_bagno", name: "Bagno" }],
  soloMotori: false,
};

test("la pastiglia delle tapparelle conta i motori su, anche con un'anta aperta", () => {
  const [pastiglia] = pastiglieDellaCasa([conLAnta], {
    barra: { voci: { tapparelle: true, finestreAperte: false } },
  });
  assert.equal(pastiglia.chiave, "tapparelle");
  assert.equal(pastiglia.conto, 3);
  assert.deepEqual(
    pastiglia.voci.map((voce) => voce.entity),
    ["cover.camera", "cover.sala", "cover.studio"],
  );
});

test("e la parola e' tapparelle aperte, sempre", () => {
  const sezione = leggi("sections/come-sta-la-casa-section.js");
  assert.match(sezione, /t\("tapparelle aperte", "shutters open"\)/);
  assert.doesNotMatch(sezione, /modello\?\.soloMotori/);
  assert.doesNotMatch(sezione, /t\("tapparelle alzate", "shutters up"\)/);
});
