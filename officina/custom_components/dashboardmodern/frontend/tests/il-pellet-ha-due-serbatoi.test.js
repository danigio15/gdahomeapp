/* «Ciao potresti aggiungere ancora una lettura pellet in %? Ce n'è una ma la
 * utilizzo già. E me servirebbe una seconda. Attualmente ho messo la seconda
 * lettura pellet nella cartella ossigeno.» (#182)
 *
 * La casella dell'ossigeno faceva da secondo serbatoio, e la scena lo
 * scriveva come ossigeno: un numero giusto sotto il nome sbagliato. Queste
 * prove tengono ferme tre cose: il secondo serbatoio si legge come il primo,
 * conta come il primo quando sta finendo, e chi ne ha uno solo non vede
 * cambiare niente.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CASELLE_CALDAIA,
  GRUPPO_PELLET,
  PELLET_SCARSO,
  entitaDellaCaldaia,
  letturaCaldaia,
  normalizzaCaldaia,
  serbatoiDellaCaldaia,
} from "../src/core/impianti-termici.js";

const sorgente = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");

const STATI = {
  "sensor.pellet": { state: "62", attributes: { unit_of_measurement: "%" } },
  "sensor.pellet_2": { state: "12", attributes: { unit_of_measurement: "%" } },
  "sensor.silo": { state: "180", attributes: { unit_of_measurement: "kg" } },
  "sensor.spento": { state: "unavailable" },
};

test("il secondo serbatoio e' una casella del gruppo del pellet, subito dopo il primo", () => {
  const campi = CASELLE_CALDAIA.map(({ campo }) => campo);
  assert.equal(campi.indexOf("pellet2"), campi.indexOf("pellet") + 1);
  assert.equal(CASELLE_CALDAIA.find(({ campo }) => campo === "pellet2").gruppo, GRUPPO_PELLET);
  /* Il primo resta `pellet`: chi ne ha uno solo non ha niente da migrare. */
  assert.ok(campi.includes("pellet"));
});

test("la configurazione col secondo serbatoio fa il giro e torna intera", () => {
  const scritta = { pellet: "sensor.pellet", pellet2: " sensor.pellet_2 " };
  const pulita = normalizzaCaldaia(scritta);
  assert.equal(pulita.pellet2, "sensor.pellet_2");
  assert.deepEqual(normalizzaCaldaia(pulita), pulita);
  /* Ed entra fra le entita' da tenere d'occhio, o nessuno si abbonerebbe ai
   * suoi cambi di stato. */
  assert.deepEqual(entitaDellaCaldaia(scritta), ["sensor.pellet", "sensor.pellet_2"]);
  /* Una caldaia di prima non ha la casella, e non la trova piena di niente. */
  assert.equal(normalizzaCaldaia({ pellet: "sensor.pellet" }).pellet2, "");
});

test("il secondo serbatoio si legge come il primo: in percentuale o in chili", () => {
  const due = letturaCaldaia({ pellet: "sensor.pellet", pellet2: "sensor.pellet_2" }, STATI);
  assert.equal(due.pellet, 62);
  assert.equal(due.pellet2, 12);
  assert.equal(due.pellet2Chili, null);
  const chili = letturaCaldaia({ pellet: "sensor.pellet", pellet2: "sensor.silo" }, STATI);
  assert.equal(chili.pellet2, null);
  assert.equal(chili.pellet2Chili, 180);
  /* Non mappato non e' vuoto: e' assente. */
  const uno = letturaCaldaia({ pellet: "sensor.pellet" }, STATI);
  assert.equal(uno.pellet2, null);
  assert.equal(uno.pellet2Chili, null);
});

test("i serbatoi sono quelli che rispondono, e ognuno dice se sta finendo", () => {
  const leggi = (config) => serbatoiDellaCaldaia(letturaCaldaia(config, STATI));
  assert.deepEqual(leggi({}), []);
  /* Uno solo, il primo: com'era prima. */
  assert.deepEqual(leggi({ pellet: "sensor.pellet" }), [
    { campo: "pellet", pellet: 62, chili: null, scarso: false },
  ]);
  /* Due: il secondo sotto la soglia conta quanto il primo. */
  assert.deepEqual(leggi({ pellet: "sensor.pellet", pellet2: "sensor.pellet_2" }), [
    { campo: "pellet", pellet: 62, chili: null, scarso: false },
    { campo: "pellet2", pellet: 12, chili: null, scarso: true },
  ]);
  assert.ok(12 <= PELLET_SCARSO);
  /* Il secondo da solo e' un serbatoio solo. */
  assert.deepEqual(
    leggi({ pellet2: "sensor.pellet_2" }).map((serbatoio) => serbatoio.campo),
    ["pellet2"],
  );
  /* In chili non c'e' una quota: non e' scarso, e' un numero. */
  assert.deepEqual(leggi({ pellet: "sensor.pellet", pellet2: "sensor.silo" })[1], {
    campo: "pellet2",
    pellet: null,
    chili: 180,
    scarso: false,
  });
  /* Un serbatoio che non risponde non e' un serbatoio vuoto: non si disegna. */
  assert.equal(leggi({ pellet: "sensor.pellet", pellet2: "sensor.spento" }).length, 1);
});

test("la scena: due serbatoi affiancati, uno solo com'era", () => {
  const scena = sorgente("../src/sections/impianti-termici-section.js");
  /* Con due, il nodo dei due serbatoi; con uno, il disegno di sempre nello
   * stesso posto — il primo, o il secondo se e' l'unico. */
  assert.match(scena, /if \(serbatoi\.length > 1\) return dueSerbatoiMarkup\(serbatoi\);/);
  assert.match(scena, /const solo = serbatoi\[0\] \|\| \{ pellet: null, chili: null \};/);
  assert.match(scena, /"left:11%;top:80%"/);
  /* «Pellet 1», «Pellet 2»: il numero dopo la parola di sempre. */
  assert.match(scena, /const nome = `\$\{t\("Pellet", "Pellet"\)\} \$\{indice \+ 1\}`;/);
  /* Ognuno si fa rosso da solo, disegno e nome. */
  assert.match(scena, /data-scarso="\$\{serbatoio\.scarso\}"/);
});

test("sul telefono i due serbatoi stanno su una mensola, e la scena resta com'era", () => {
  const scena = sorgente("../src/sections/impianti-termici-section.js");
  /* Il palco lo sa solo con due serbatoi: con uno l'attributo non c'e'. */
  assert.match(
    scena,
    /const mensola = attiva === "caldaia" && serbatoiDellaCaldaia\(dentro\)\.length > 1 \? "2" : "";/,
  );
  assert.match(scena, /else delete mia\.dataset\.dmItSerbatoi;/);
  /* La mensola allunga il palco di quanto la scena lascia libero in fondo:
   * la scena resta alta come prima, e le letture dentro — Acqua calda e
   * Ritorno in basso — non si spostano. */
  const telefono = scena.slice(scena.indexOf("@media (max-width:768px){"));
  const misura = (regola) => Number(regola.exec(telefono)?.[1]);
  const palco = misura(/\.dm-it-stage\{height:(\d+)px/);
  const lungo = misura(/\.dm-it-stage\[data-dm-it-serbatoi="2"\]\{height:(\d+)px\}/);
  const libero = misura(/\.dm-it-stage\[data-dm-it-serbatoi="2"\]>\.dm-it-scena\{bottom:(\d+)px\}/);
  assert.ok(palco > 0 && libero > 0);
  assert.equal(lungo - libero, palco);
  /* I serbatoi sulla mensola, e lo stato con la leva in fondo, sotto di loro. */
  assert.match(
    telefono,
    /\[data-dm-it-serbatoi="2"\] \.dm-it-nodo-serbatoi\{\s*left:50%!important;top:calc\(100% \+ \d+px\)!important\}/,
  );
  assert.match(telefono, /\[data-dm-it-serbatoi="2"\] \.dm-it-comandi-caldaia\{bottom:-\d+px\}/);
});

test("la scheda ha la casella del secondo serbatoio, con le sue parole", () => {
  const scheda = sorgente("../src/sections/impianti-termici-editor-section.js");
  assert.match(scheda, /^ {2}pellet2: \{\n {4}it: "Livello del pellet, secondo serbatoio",/m);
  assert.ok(scheda.includes('en: "Pellet level, second hopper"'));
  assert.ok(scheda.includes('esempio: "sensor.caldaia_pellet_2"'));
  const corpus = sorgente("../src/i18n/source-index.js");
  assert.ok(corpus.includes('"Livello del pellet, secondo serbatoio"'));
});
