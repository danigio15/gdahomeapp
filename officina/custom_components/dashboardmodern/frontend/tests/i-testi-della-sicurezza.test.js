/* «Ho in Home Assistant due sensori che restituiscono una stringa di testo:
 * uno con lo stato del sistema di sicurezza, uno con le anomalie. Vorrei
 * vedere le scritte piccole che scorrono nella Home, e vederle anche nella
 * sezione Sicurezza» (#472).
 *
 * La regola che conta e' una sola: quando una frase DICE qualcosa. In
 * Sicurezza la riga c'e' sempre e si colora quando dice qualcosa; in Home
 * c'e' solo allora. Sbagliare in un verso vuol dire una scritta che scorre per
 * sempre per dire «Nessuna anomalia»; sbagliare nell'altro vuol dire
 * un'anomalia che non si vede, che e' il guasto peggiore dei due.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CHIAVE_TESTI_SICUREZZA,
  FRASI_NEUTRE,
  QUANTI_TESTI,
  ceQualcheTesto,
  eNeutro,
  entitaDeiTesti,
  fraseDaConfrontare,
  letturaDeiTesti,
  letturaDelTesto,
  normalizzaTestiDellaSicurezza,
  testiPerLaHome,
} from "../src/core/testi-della-sicurezza.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";
import {
  daQuantoECambiato,
  riquadroDeiTesti,
  rigaDelTestoInHome,
  schedaDeiTestiMarkup,
} from "../src/sections/testi-della-sicurezza-section.js";

const leggi = (quale) => readFileSync(new URL(quale, import.meta.url), "utf8");

const ADESSO = Date.parse("2026-11-22T10:00:00Z");
const stato = (state, extra = {}) => ({
  state,
  attributes: { friendly_name: "Anomalie centrale" },
  last_changed: "2026-11-22T09:55:00Z",
  last_updated: "2026-11-22T09:59:00Z",
  ...extra,
});

test("la frase si confronta senza maiuscole, accenti e punteggiatura", () => {
  assert.equal(fraseDaConfrontare("  Nessuna   ANOMALIA. "), "nessuna anomalia");
  assert.equal(fraseDaConfrontare("Tutto OK!"), "tutto ok");
  assert.equal(fraseDaConfrontare("tutto-ok"), "tutto ok");
  assert.equal(fraseDaConfrontare("Normalità"), "normalita");
  assert.equal(fraseDaConfrontare("Nessùna anomalìa"), "nessuna anomalia");
  assert.equal(fraseDaConfrontare(null), "");
  assert.equal(fraseDaConfrontare(undefined), "");
});

test("le frasi tranquille sono neutre, comunque siano scritte", () => {
  for (const frase of [
    "",
    "   ",
    "unknown",
    "unavailable",
    "none",
    "None",
    "null",
    "OK",
    "ok.",
    "Nessuna",
    "Nessuna anomalia",
    "NESSUNA ANOMALIA!",
    "Normale",
    "Tutto OK",
    "tutto ok :)",
    "No anomalie",
    "no problems",
    "No Problems.",
  ])
    assert.equal(eNeutro(frase), true, `«${frase}» deve essere neutro`);
  /* L'elenco e' scritto gia' ripulito: una voce scritta con una maiuscola o
   * un punto non si incontrerebbe mai col testo confrontato. */
  for (const frase of FRASI_NEUTRE) assert.equal(fraseDaConfrontare(frase), frase);
});

test("quello che non e' nell'elenco e' una notizia", () => {
  for (const frase of [
    "Batteria scarica sirena esterna",
    "Inserito parziale, zona 3 esclusa",
    "Anomalia linea telefonica",
    "Nessuna rete",
    "OK, ma porta garage aperta",
    "No",
    "Guasto",
  ])
    assert.equal(eNeutro(frase), false, `«${frase}» non deve essere neutro`);
});

test("la configurazione: due righe al massimo, entita' vere, senza doppioni", () => {
  assert.equal(CHIAVE_TESTI_SICUREZZA, "cd_testi_sicurezza");
  assert.equal(QUANTI_TESTI, 2);
  assert.deepEqual(normalizzaTestiDellaSicurezza(null), { righe: [], home: true });
  assert.deepEqual(normalizzaTestiDellaSicurezza("boh"), { righe: [], home: true });
  const config = normalizzaTestiDellaSicurezza({
    righe: [
      { entity: " sensor.stato_allarme ", etichetta: "  Stato allarme " },
      { entity: "sensor.stato_allarme", etichetta: "doppione" },
      { entity: "non un'entita" },
      { entity: "" },
      { entity: "input_text.anomalie" },
      { entity: "sensor.terzo" },
    ],
  });
  assert.deepEqual(config, {
    righe: [
      { entity: "sensor.stato_allarme", etichetta: "Stato allarme" },
      { entity: "input_text.anomalie", etichetta: "" },
    ],
    home: true,
  });
  assert.equal(ceQualcheTesto(config), true);
  assert.equal(ceQualcheTesto(normalizzaTestiDellaSicurezza({})), false);
  assert.deepEqual(entitaDeiTesti(config), ["sensor.stato_allarme", "input_text.anomalie"]);
});

test("la Home si spegne solo con un no scritto", () => {
  for (const home of [undefined, null, true, "si", 0])
    assert.equal(normalizzaTestiDellaSicurezza({ home }).home, true, `${home} deve accendere`);
  assert.equal(normalizzaTestiDellaSicurezza({ home: false }).home, false);
});

test("l'etichetta ha un tetto, e un elenco nudo di entita' vale come righe", () => {
  const lunga = "x".repeat(90);
  const config = normalizzaTestiDellaSicurezza({
    righe: [{ entity: "sensor.a", etichetta: lunga }],
  });
  assert.equal(config.righe[0].etichetta.length, 40);
  assert.deepEqual(normalizzaTestiDellaSicurezza(["sensor.a", "sensor.b"]).righe, [
    { entity: "sensor.a", etichetta: "" },
    { entity: "sensor.b", etichetta: "" },
  ]);
});

test("la lettura: avviso, neutro, muto, e da quando e' cambiato", () => {
  const riga = { entity: "sensor.anomalie", etichetta: "" };
  const avviso = letturaDelTesto(riga, stato("Batteria scarica sirena"));
  assert.deepEqual(avviso, {
    entity: "sensor.anomalie",
    etichetta: "Anomalie centrale",
    testo: "Batteria scarica sirena",
    stato: "avviso",
    /* `last_changed`, non `last_updated`: un attributo che si muove non
     * cambia la frase. */
    da: Date.parse("2026-11-22T09:55:00Z"),
  });
  assert.equal(letturaDelTesto(riga, stato("Nessuna anomalia")).stato, "neutro");
  assert.equal(letturaDelTesto(riga, stato("")).stato, "neutro");
  assert.equal(letturaDelTesto(riga, stato("none")).stato, "neutro");
  /* Un sensore che non risponde non e' un sensore che dice «tutto ok». */
  assert.equal(letturaDelTesto(riga, stato("unavailable")).stato, "muto");
  assert.equal(letturaDelTesto(riga, stato("unknown")).stato, "muto");
  assert.equal(letturaDelTesto(riga, stato("unknown")).testo, "");
  assert.equal(letturaDelTesto(riga, undefined).stato, "muto");
  /* L'etichetta scritta vince sul nome di Home Assistant, e senza nessuno
   * dei due resta l'entita'. */
  assert.equal(
    letturaDelTesto({ ...riga, etichetta: "Anomalie" }, stato("x")).etichetta,
    "Anomalie",
  );
  assert.equal(letturaDelTesto(riga, undefined).etichetta, "sensor.anomalie");
  assert.equal(letturaDelTesto(riga, { state: "x" }).da, null);
});

test("in Home vanno solo i testi che dicono qualcosa, e solo se la Home li vuole", () => {
  const states = {
    "sensor.stato_allarme": stato("Nessuna anomalia"),
    "sensor.anomalie": stato("Batteria scarica sirena esterna"),
  };
  const config = normalizzaTestiDellaSicurezza({
    righe: [
      { entity: "sensor.stato_allarme" },
      { entity: "sensor.anomalie", etichetta: "Anomalie" },
    ],
  });
  assert.equal(letturaDeiTesti(config, states).length, 2);
  assert.deepEqual(
    testiPerLaHome(config, states).map((lettura) => lettura.entity),
    ["sensor.anomalie"],
  );
  assert.deepEqual(testiPerLaHome({ ...config, home: false }, states), []);
  /* Muto non va in Home: «non disponibile» e' un avviso sul sensore, non
   * sulla casa. */
  assert.deepEqual(testiPerLaHome(config, { "sensor.anomalie": stato("unavailable") }), []);
});

test("la scelta viaggia con la configurazione", () => {
  /* Scelte dal computer, le anomalie devono comparire anche sul tablet: e
   * senza stare nell'elenco il cancello degli stati non lascerebbe passare i
   * loro cambi. */
  assert.ok(CONFIG_KEYS.includes(CHIAVE_TESTI_SICUREZZA));
});

test("il riquadro in Sicurezza: tutte le righe, la frase per intero, l'avviso colorato", () => {
  const letture = [
    letturaDelTesto({ entity: "sensor.stato_allarme", etichetta: "Stato" }, stato("Normale")),
    letturaDelTesto(
      { entity: "sensor.anomalie", etichetta: "Anomalie" },
      stato("Batteria scarica <sirena> & co"),
    ),
    letturaDelTesto({ entity: "sensor.muto", etichetta: "Muto" }, stato("unavailable")),
  ];
  const markup = riquadroDeiTesti(letture, ADESSO);
  assert.equal((markup.match(/class="dm-sec-testo"/g) || []).length, 3);
  assert.match(markup, /data-stato="neutro"[\s\S]*Normale/);
  assert.match(markup, /data-stato="avviso"[\s\S]*Batteria scarica &lt;sirena&gt; &amp; co/);
  assert.match(markup, /data-stato="muto"[\s\S]*Non disponibile/);
  assert.match(markup, /Cambiato 5 minuti fa/);
  /* Il testo viene da fuori: niente di quello che scrive un sensore deve
   * poter diventare markup. */
  assert.doesNotMatch(markup, /<sirena>/);
  assert.equal(riquadroDeiTesti([]), "");
});

test("da quanto e' cambiato, in parole", () => {
  assert.equal(daQuantoECambiato(ADESSO - 20_000, ADESSO), "Cambiato appena adesso");
  assert.equal(daQuantoECambiato(ADESSO - 5 * 60_000, ADESSO), "Cambiato 5 minuti fa");
  assert.equal(daQuantoECambiato(ADESSO - 3 * 3_600_000, ADESSO), "Cambiato 3 ore fa");
  assert.equal(daQuantoECambiato(null, ADESSO), "");
});

test("la riga in Home: etichetta, testo su un nastro, e il testo intero nel titolo", () => {
  const lettura = letturaDelTesto(
    { entity: "sensor.anomalie", etichetta: "Anomalie" },
    stato('Batteria scarica "sirena"'),
  );
  const riga = rigaDelTestoInHome(lettura);
  assert.match(riga, /^<button type="button" class="dm-sic-testo" data-entity="sensor\.anomalie"/);
  assert.match(riga, /<b class="dm-sic-testo-cap">Anomalie<\/b>/);
  assert.match(
    riga,
    /<span class="dm-sic-testo-finestra"><span class="dm-sic-testo-nastro">Batteria scarica &quot;sirena&quot;<\/span><\/span>/,
  );
  assert.match(riga, /title="Anomalie: Batteria scarica &quot;sirena&quot;"/);
});

test("la scheda: due righe da riempire, l'interruttore della Home, il tasto", () => {
  const config = normalizzaTestiDellaSicurezza({
    righe: [{ entity: "sensor.anomalie", etichetta: "Anomalie" }],
    home: false,
  });
  const markup = schedaDeiTestiMarkup(config, { "sensor.anomalie": stato("Guasto sirena") });
  assert.equal((markup.match(/data-tsic-riga=/g) || []).length, 2);
  assert.match(markup, /data-tsic-entity value="sensor\.anomalie"/);
  assert.match(markup, /data-tsic-etichetta maxlength="40" value="Anomalie"/);
  assert.match(markup, /Adesso: «Guasto sirena»/);
  assert.match(markup, /data-tsic-pick="dm-tsic-entity-0"/);
  assert.match(markup, /data-tsic-pick="dm-tsic-entity-1"/);
  assert.match(markup, /<input type="checkbox" data-tsic-home>/);
  assert.match(markup, /data-tsic-salva/);
  assert.match(
    schedaDeiTestiMarkup(normalizzaTestiDellaSicurezza({}), {}),
    /<input type="checkbox" data-tsic-home checked>/,
  );
});

test("la Home scorre solo se non ci sta, ed e' ferma per chi chiede meno animazioni", () => {
  const sezione = leggi("../src/sections/testi-della-sicurezza-section.js");
  /* La strada e la durata sono quelle della fascia: tre derive in cima alla
   * Home, una sola velocita'. */
  assert.match(
    sezione,
    /spazioDaPercorrere\(\{\s*scrollWidth: finestra\.scrollWidth,\s*clientWidth: finestra\.clientWidth/,
  );
  assert.match(sezione, /durataDellaDeriva\(strada\)/);
  assert.match(sezione, /if \(!strada\) \{\s*delete finestra\.dataset\.dmDeriva;/);
  assert.match(sezione, /@media \(prefers-reduced-motion:reduce\)\{[\s\S]*?animation:none/);
  /* Il tocco porta in Sicurezza con la voce vera della barra. */
  assert.match(sezione, /\.tab\[data-tab="security"\]/);
});

test("la scheda sta nella Sicurezza e la sezione si installa", () => {
  const runtime = leggi("../src/sections/section-runtime.js");
  assert.match(runtime, /senzaCadere\(installTestiDellaSicurezza\)/);
  /* Dopo i tasti su misura, sotto i quali si mette la scheda. */
  assert.ok(
    runtime.indexOf("senzaCadere(installTestiDellaSicurezza)") >
      runtime.indexOf("senzaCadere(installAntifurtoSuMisuraEditorSection)"),
  );
  const cerca = leggi("../src/sections/cerca-nel-config-section.js");
  assert.match(cerca, /cd_testi_sicurezza: "sez4"/);
});
