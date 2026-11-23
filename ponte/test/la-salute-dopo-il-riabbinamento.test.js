/* La Salute dopo un riabbinamento.
 *
 * «Quando ho riassociato il telefono ho perso i dati salute, non mi compaiono
 * piu'.» Le strade per cui un telefono rientra in casa sono quattro, e la
 * Salute della persona deve restare sugli STESSI sensori in tutte:
 *
 *   - il QR per riabbinare proprio quel telefono (`_riabbina`): stesso id;
 *   - «Collega un'app nuova»: un telefono nuovo, e quello di prima resta
 *     finche' qualcuno non lo stacca;
 *   - `sostituisci`: il nuovo, col vecchio segno, stacca quello di prima;
 *   - l'app cancellata e rimessa: niente vecchio segno, l'interruttore della
 *     Salute torna spento.
 *
 * Qui i telefoni sono quelli veri (`Dispositivi`), e la casa e' finta: tiene
 * gli stati come li terrebbe Home Assistant, cosi' si vede cosa resta.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { Dispositivi } from "../src/dispositivi.js";
import {
  IlCorpoDalTelefono,
  SALUTE_MISURE,
  SALUTE_SPEGNI,
  radiceDelTelefono,
} from "../src/il-corpo-dal-telefono.js";

const ADESSO = Date.parse("2026-11-23T10:00:00Z");
/* Due utenti di Home Assistant inventati: trentadue cifre esadecimali. */
const MARCO = "0a1b2c3d4e5f60718293a4b5c6d7e8f9";
const GIULIA = "f9e8d7c6b5a4938271605f4e3d2c1b0a";

const MISURE = {
  passi: { valore: 7842, quando: "2026-11-23T09:40:00Z" },
  battito: { valore: 72, quando: "2026-11-23T09:38:00Z" },
  peso: { valore: 78.4, quando: "2026-11-22T07:05:00Z" },
};

/* Una casa che tiene gli stati: un POST li scrive, un DELETE li toglie. */
function casaFinta() {
  const stati = new Map();
  const chiamate = [];
  return {
    stati,
    chiamate,
    async api(metodo, percorso, corpo) {
      chiamate.push({ metodo, percorso });
      const entita = percorso.replace(/^states\//, "");
      if (metodo === "POST") stati.set(entita, corpo);
      if (metodo === "DELETE") stati.delete(entita);
      return {};
    },
  };
}

function banco() {
  const cartella = mkdtempSync(join(tmpdir(), "salute-riabbina-"));
  let ora = ADESSO;
  const adesso = () => ora;
  const dispositivi = new Dispositivi({ cartella, massimi: 5, adesso });
  const casa = casaFinta();
  const righe = [];
  const registro = {
    info: (r) => righe.push(r),
    attenzione: (r) => righe.push(r),
    errore: (r) => righe.push(r),
  };
  const nuovoCorpo = () =>
    new IlCorpoDalTelefono({ cartella, casa, dispositivi, registro, adesso });
  const corpo = nuovoCorpo();
  /* Il telefono come lo vede il filo (`riconosci`). */
  const delFilo = (segno) => dispositivi.riconosci(segno);
  const manda = (c, segno, extra = {}) =>
    c.rispondi(
      { id: 1, type: SALUTE_MISURE, misure: MISURE, ...extra },
      { dispositivo: delFilo(segno) },
    );
  return {
    cartella,
    dispositivi,
    casa,
    corpo,
    nuovoCorpo,
    manda,
    righe,
    passa: (ms) => (ora += ms),
    via: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

const passiDi = (radice) => `sensor.${radice}_passi`;

test("il QR per riabbinare lo stesso telefono: stessi sensori, stessa persona", async () => {
  const b = banco();
  try {
    const prima = b.dispositivi.abbina({ nome: "Pixel", sistema: "android", utente: MARCO });
    await b.manda(b.corpo, prima.segno, { persona: "Marco" });
    const radice = radiceDelTelefono(prima.dispositivo.id);
    assert.ok(b.casa.stati.has(passiDi(radice)));
    /* Il QR del telefono: l'utente non lo si sceglie di nuovo. */
    const dopo = b.dispositivi.abbina({
      nome: "Pixel",
      sistema: "android",
      sostituisce: prima.dispositivo.id,
    });
    assert.equal(dopo.dispositivo.utente, MARCO, "l'intestazione resta");
    await b.corpo.rimettiGliStati();
    assert.ok(b.casa.stati.has(passiDi(radice)), "il giro non li toglie");
    const r = await b.manda(b.corpo, dopo.segno, { persona: "Marco" });
    assert.equal(r.success, true);
    assert.deepEqual(
      [...b.casa.stati.keys()].filter((e) => e.endsWith("_passi")),
      [passiDi(radice)],
    );
  } finally {
    b.via();
  }
});

test("«Collega un'app nuova»: il telefono nuovo manda prima di staccare il vecchio, e la serie resta quella", async () => {
  const b = banco();
  try {
    const vecchio = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    await b.manda(b.corpo, vecchio.segno, { persona: "Marco" });
    const radice = radiceDelTelefono(vecchio.dispositivo.id);
    const nuovo = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    /* Il filo si apre: la Salute parte prima che `sostituisci` arrivi. */
    await b.manda(b.corpo, nuovo.segno, { persona: "Marco" });
    /* Due telefoni vivi: per ora ognuno la sua serie. */
    assert.ok(b.casa.stati.has(passiDi(radiceDelTelefono(nuovo.dispositivo.id))));
    assert.ok(
      b.dispositivi.sostituisci({
        nuovo: nuovo.dispositivo.id,
        vecchio: vecchio.dispositivo.id,
        segno: vecchio.segno,
      }),
    );
    await b.corpo.passaIlTelefono(vecchio.dispositivo.id, nuovo.dispositivo.id);
    await b.corpo.rimettiGliStati();
    assert.ok(b.casa.stati.has(passiDi(radice)), "la serie della persona c'e' ancora");
    assert.ok(
      !b.casa.stati.has(passiDi(radiceDelTelefono(nuovo.dispositivo.id))),
      "e quella di passaggio se n'e' andata: niente doppioni",
    );
    b.casa.chiamate.length = 0;
    await b.manda(b.corpo, nuovo.segno, { persona: "Marco" });
    assert.ok(b.casa.chiamate.some((c) => c.percorso === `states/${passiDi(radice)}`));
  } finally {
    b.via();
  }
});

test("sostituisci prima del primo invio: la serie passa subito, senza buchi", async () => {
  const b = banco();
  try {
    const vecchio = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    await b.manda(b.corpo, vecchio.segno, { persona: "Marco" });
    const radice = radiceDelTelefono(vecchio.dispositivo.id);
    const nuovo = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    b.dispositivi.sostituisci({
      nuovo: nuovo.dispositivo.id,
      vecchio: vecchio.dispositivo.id,
      segno: vecchio.segno,
    });
    await b.corpo.passaIlTelefono(vecchio.dispositivo.id, nuovo.dispositivo.id);
    b.casa.chiamate.length = 0;
    /* Il giro dei dieci minuti passa prima che il nuovo mandi. */
    await b.corpo.rimettiGliStati();
    assert.ok(!b.casa.chiamate.some((c) => c.metodo === "DELETE"), "niente cancellato");
    assert.ok(b.casa.stati.has(passiDi(radice)));
    await b.manda(b.corpo, nuovo.segno);
    assert.equal(b.casa.stati.get(passiDi(radice)).attributes.gdahome_persona, "Marco");
  } finally {
    b.via();
  }
});

test("sostituisci non passa la serie a un telefono di un'altra persona", async () => {
  const b = banco();
  try {
    const vecchio = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    await b.manda(b.corpo, vecchio.segno, { persona: "Marco" });
    const nuovo = b.dispositivi.abbina({ nome: "iPhone", utente: GIULIA });
    b.dispositivi.sostituisci({
      nuovo: nuovo.dispositivo.id,
      vecchio: vecchio.dispositivo.id,
      segno: vecchio.segno,
    });
    await b.corpo.passaIlTelefono(vecchio.dispositivo.id, nuovo.dispositivo.id);
    await b.manda(b.corpo, nuovo.segno, { persona: "Giulia" });
    const radiceMarco = radiceDelTelefono(vecchio.dispositivo.id);
    assert.notEqual(b.casa.stati.get(passiDi(radiceMarco))?.attributes?.gdahome_persona, "Giulia");
    assert.ok(b.casa.stati.has(passiDi(radiceDelTelefono(nuovo.dispositivo.id))));
  } finally {
    b.via();
  }
});

test("l'app rimessa: il vecchio staccato dalla console, il nuovo riaccende e ritrova la serie", async () => {
  const b = banco();
  try {
    const vecchio = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    await b.manda(b.corpo, vecchio.segno, { persona: "Marco" });
    const radice = radiceDelTelefono(vecchio.dispositivo.id);
    const nuovo = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    /* L'interruttore e' spento: il nuovo non manda. Il vecchio si stacca. */
    b.dispositivi.stacca(vecchio.dispositivo.id);
    await b.corpo.rimettiGliStati();
    assert.ok(!b.casa.stati.has(passiDi(radice)), "senza nessuno che la scrive, la serie tace");
    /* Riacceso, senza nome nell'app: la persona resta «Marco». */
    await b.manda(b.corpo, nuovo.segno);
    const passi = b.casa.stati.get(passiDi(radice));
    assert.ok(passi, "stessi sensori: lo storico continua");
    assert.equal(passi.attributes.gdahome_persona, "Marco");
  } finally {
    b.via();
  }
});

test("l'app rimessa e riaccesa prima di staccare il vecchio: staccato lui, la serie passa al nuovo", async () => {
  const b = banco();
  try {
    const vecchio = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    await b.manda(b.corpo, vecchio.segno, { persona: "Marco" });
    const radice = radiceDelTelefono(vecchio.dispositivo.id);
    b.passa(60_000);
    const nuovo = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    await b.manda(b.corpo, nuovo.segno, { persona: "Marco" });
    const diPassaggio = radiceDelTelefono(nuovo.dispositivo.id);
    assert.ok(b.casa.stati.has(passiDi(diPassaggio)));
    b.dispositivi.stacca(vecchio.dispositivo.id);
    await b.corpo.rimettiGliStati();
    assert.ok(b.casa.stati.has(passiDi(radice)), "la serie della persona resta");
    assert.ok(!b.casa.stati.has(passiDi(diPassaggio)), "quella di passaggio se ne va");
    b.casa.chiamate.length = 0;
    await b.manda(b.corpo, nuovo.segno, { persona: "Marco" });
    assert.ok(b.casa.chiamate.some((c) => c.percorso === `states/${passiDi(radice)}`));
  } finally {
    b.via();
  }
});

test("chi c'e' gia' cascato: all'avvio il telefono nuovo riprende la serie orfana", async () => {
  const b = banco();
  try {
    /* Com'e' adesso la casa del proprietario: il vecchio telefono staccato
     * e cancellato, il nuovo su una serie sua, la persona che ricorda la
     * serie di prima. */
    const vecchio = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    await b.manda(b.corpo, vecchio.segno, { persona: "Marco" });
    const radice = radiceDelTelefono(vecchio.dispositivo.id);
    const nuovo = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    await b.manda(b.corpo, nuovo.segno, { persona: "Marco" });
    b.dispositivi.stacca(vecchio.dispositivo.id);
    /* Il disco come l'ha lasciato il ponte di prima. */
    const dati = b.corpo.archivio.dati;
    delete dati.telefoni[vecchio.dispositivo.id];
    dati.telefoni[nuovo.dispositivo.id].radice = radiceDelTelefono(nuovo.dispositivo.id);
    delete dati.telefoni[nuovo.dispositivo.id].utente;
    dati.radici = { [MARCO]: radice };
    b.corpo.archivio.salva();
    b.casa.stati.delete(passiDi(radice));

    /* Il ponte aggiornato riparte. */
    const corpo = b.nuovoCorpo();
    await corpo.rimettiGliStati();
    assert.ok(b.casa.stati.has(passiDi(radice)), "la serie di prima torna");
    assert.ok(!b.casa.stati.has(passiDi(radiceDelTelefono(nuovo.dispositivo.id))));
    b.casa.chiamate.length = 0;
    await b.manda(corpo, nuovo.segno, { persona: "Marco" });
    assert.ok(b.casa.chiamate.some((c) => c.percorso === `states/${passiDi(radice)}`));
  } finally {
    b.via();
  }
});

test("due telefoni vivi della stessa persona restano due serie, e un terzo di un altro non tocca niente", async () => {
  const b = banco();
  try {
    const telefono = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    const tablet = b.dispositivi.abbina({ nome: "iPad", utente: MARCO });
    const suo = b.dispositivi.abbina({ nome: "Pixel", utente: GIULIA });
    await b.manda(b.corpo, telefono.segno, { persona: "Marco" });
    await b.manda(b.corpo, tablet.segno, { persona: "Marco" });
    await b.manda(b.corpo, suo.segno, { persona: "Giulia" });
    await b.corpo.rimettiGliStati();
    for (const t of [telefono, tablet, suo]) {
      assert.ok(b.casa.stati.has(passiDi(radiceDelTelefono(t.dispositivo.id))));
    }
  } finally {
    b.via();
  }
});

test("un telefono riabbinato per un'altra persona non scrive sui sensori di quella di prima", async () => {
  const b = banco();
  try {
    const prima = b.dispositivi.abbina({ nome: "Pixel", utente: MARCO });
    await b.manda(b.corpo, prima.segno, { persona: "Marco" });
    const radice = radiceDelTelefono(prima.dispositivo.id);
    const dopo = b.dispositivi.abbina({
      nome: "Pixel",
      utente: GIULIA,
      sostituisce: prima.dispositivo.id,
    });
    await b.manda(b.corpo, dopo.segno, { persona: "Giulia" });
    assert.ok(!b.casa.stati.has(passiDi(radice)), "quelli di Marco non sono di Giulia");
    const sue = [...b.casa.stati.values()].filter((s) => s.attributes.gdahome_persona === "Giulia");
    assert.ok(sue.length > 0);
  } finally {
    b.via();
  }
});

test("sostituisci: il nuovo senza utente eredita quello del vecchio, mai il contrario", () => {
  const cartella = mkdtempSync(join(tmpdir(), "salute-utente-"));
  try {
    const d = new Dispositivi({ cartella });
    const vecchio = d.abbina({ nome: "iPhone", utente: MARCO });
    /* Un codice di prima, senza nessuno. */
    const nuovo = d.abbina({ nome: "iPhone" });
    assert.equal(d.utenteDi(nuovo.dispositivo.id), "");
    d.sostituisci({ nuovo: nuovo.dispositivo.id, vecchio: vecchio.dispositivo.id, segno: "no" });
    assert.equal(d.utenteDi(nuovo.dispositivo.id), "", "senza il segno giusto, niente");
    assert.ok(
      d.sostituisci({
        nuovo: nuovo.dispositivo.id,
        vecchio: vecchio.dispositivo.id,
        segno: vecchio.segno,
      }),
    );
    assert.equal(d.utenteDi(nuovo.dispositivo.id), MARCO);
    /* Uno gia' intestato resta di chi e'. */
    const terzo = d.abbina({ nome: "Pixel", utente: GIULIA });
    const quarto = d.abbina({ nome: "Pixel", utente: MARCO });
    d.sostituisci({
      nuovo: quarto.dispositivo.id,
      vecchio: terzo.dispositivo.id,
      segno: terzo.segno,
    });
    assert.equal(d.utenteDi(quarto.dispositivo.id), MARCO);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("spegnere resta togliere, anche dopo aver ereditato la serie", async () => {
  const b = banco();
  try {
    const vecchio = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    await b.manda(b.corpo, vecchio.segno, { persona: "Marco" });
    const radice = radiceDelTelefono(vecchio.dispositivo.id);
    const nuovo = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    b.dispositivi.stacca(vecchio.dispositivo.id);
    await b.manda(b.corpo, nuovo.segno, { persona: "Marco" });
    assert.ok(b.casa.stati.has(passiDi(radice)));
    await b.corpo.rispondi(
      { id: 2, type: SALUTE_SPEGNI },
      { dispositivo: b.dispositivi.riconosci(nuovo.segno) },
    );
    assert.equal([...b.casa.stati.keys()].length, 0);
  } finally {
    b.via();
  }
});

/* ─── Le serie che il ponte non ricorda piu' ───────────────────────────── */

/* La casa del proprietario se il vecchio telefono e' stato staccato prima
 * che le persone ricordassero la loro serie: il ponte non sa piu' niente di
 * quella di prima, il Recorder si'. */
async function primaDelleRadici(b, { nataIl, nomeDiAdesso = "Marco", altri = [] } = {}) {
  const vecchio = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
  const orfana = radiceDelTelefono(vecchio.dispositivo.id);
  b.dispositivi.stacca(vecchio.dispositivo.id);
  const nuovo = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
  await b.manda(b.corpo, nuovo.segno, { persona: nomeDiAdesso });
  for (const altro of altri) {
    const suo = b.dispositivi.abbina({ nome: "Pixel", utente: altro.utente });
    await b.manda(b.corpo, suo.segno, { persona: altro.nome });
  }
  const diAdesso = radiceDelTelefono(nuovo.dispositivo.id);
  const secondi = (ms) => ms / 1000;
  const chieste = [];
  b.casa.chiedi = async (comando) => {
    chieste.push(comando);
    if (comando.type === "recorder/list_statistic_ids") {
      return [
        { statistic_id: `sensor.${orfana}_passi` },
        { statistic_id: `sensor.${orfana}_peso` },
        { statistic_id: `sensor.${diAdesso}_passi` },
        { statistic_id: "sensor.cucina_temperatura" },
      ];
    }
    if (comando.type === "history/history_during_period") {
      return {
        [`sensor.${orfana}_passi`]: [
          { s: "9001", a: { gdahome_persona: "Marco" }, lu: secondi(ADESSO - 10 * 86_400_000) },
          { s: "4200", a: { gdahome_persona: "Marco" }, lu: secondi(ADESSO - 3 * 86_400_000) },
          /* La riga vuota di quando il ponte l'ha tolto. */
          { s: "", a: {}, lu: secondi(ADESSO - 2.9 * 86_400_000) },
        ],
        [`sensor.${diAdesso}_passi`]: [
          { s: "7842", a: { gdahome_persona: nomeDiAdesso }, lu: secondi(nataIl) },
        ],
      };
    }
    throw new Error(`domanda inattesa ${comando.type}`);
  };
  return { orfana, diAdesso, nuovo, chieste };
}

test("una serie che il ponte non ricorda, col nome della persona: torna sua", async () => {
  const b = banco();
  try {
    const { orfana, diAdesso, nuovo, chieste } = await primaDelleRadici(b, {
      nataIl: ADESSO - 2 * 86_400_000,
    });
    await b.corpo.rimettiGliStati();
    assert.ok(b.casa.stati.has(passiDi(orfana)), "la serie di prima e' tornata");
    assert.ok(!b.casa.stati.has(passiDi(diAdesso)), "niente doppioni");
    assert.equal(b.corpo.radici[MARCO], orfana);
    /* La storia si chiede per le serie che servono, non per tutta la casa. */
    const storia = chieste.find((c) => c.type === "history/history_during_period");
    assert.ok(storia.entity_ids.every((e) => e.startsWith("sensor.gdahome_")));
    /* Una volta per avvio: il giro dopo non richiede. */
    chieste.length = 0;
    await b.corpo.rimettiGliStati();
    assert.equal(chieste.length, 0);
    b.casa.chiamate.length = 0;
    await b.manda(b.corpo, nuovo.segno, { persona: "Marco" });
    assert.ok(b.casa.chiamate.some((c) => c.percorso === `states/${passiDi(orfana)}`));
  } finally {
    b.via();
  }
});

test("ma non se la serie di adesso le stava accanto: era un altro telefono", async () => {
  const b = banco();
  try {
    const { orfana, diAdesso } = await primaDelleRadici(b, {
      nataIl: ADESSO - 40 * 86_400_000,
    });
    await b.corpo.rimettiGliStati();
    assert.ok(!b.casa.stati.has(passiDi(orfana)));
    assert.ok(b.casa.stati.has(passiDi(diAdesso)));
    assert.equal(b.corpo.radici[MARCO], diAdesso);
  } finally {
    b.via();
  }
});

test("ne' se quel nome e' di due persone della casa", async () => {
  const b = banco();
  try {
    const { orfana } = await primaDelleRadici(b, {
      nataIl: ADESSO - 2 * 86_400_000,
      altri: [{ utente: GIULIA, nome: "Marco" }],
    });
    await b.corpo.rimettiGliStati();
    assert.ok(!b.casa.stati.has(passiDi(orfana)));
  } finally {
    b.via();
  }
});

test("ne' una serie che il ponte ha tolto apposta", async () => {
  const b = banco();
  try {
    const { orfana, chieste } = await primaDelleRadici(b, { nataIl: ADESSO - 2 * 86_400_000 });
    b.corpo.archivio.dati.lasciate = [orfana];
    await b.corpo.rimettiGliStati();
    assert.ok(!b.casa.stati.has(passiDi(orfana)));
    assert.ok(!chieste.some((c) => c.type === "history/history_during_period"));
  } finally {
    b.via();
  }
});

test("il Recorder che non risponde non ferma il giro: si dice nel registro, senza nomi", async () => {
  const b = banco();
  try {
    const vecchio = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    await b.manda(b.corpo, vecchio.segno, { persona: "Marco" });
    b.casa.chiedi = async () => {
      throw Object.assign(new Error("giu'"), { code: "giu" });
    };
    b.casa.stati.clear();
    await b.corpo.rimettiGliStati();
    assert.ok(b.casa.stati.has(passiDi(radiceDelTelefono(vecchio.dispositivo.id))));
    assert.ok(b.righe.every((r) => !/marco/i.test(r)));
  } finally {
    b.via();
  }
});

test("spenta su un telefono, la serie va all'altro suo; riaccesa, non si scrivono in due", async () => {
  const b = banco();
  try {
    const telefono = b.dispositivi.abbina({ nome: "iPhone", utente: MARCO });
    await b.manda(b.corpo, telefono.segno, { persona: "Marco" });
    b.passa(60_000);
    const tablet = b.dispositivi.abbina({ nome: "iPad", utente: MARCO });
    await b.manda(b.corpo, tablet.segno, { persona: "Marco" });
    const radice = radiceDelTelefono(telefono.dispositivo.id);
    await b.corpo.rispondi(
      { id: 2, type: SALUTE_SPEGNI },
      { dispositivo: b.dispositivi.riconosci(telefono.segno) },
    );
    await b.corpo.rimettiGliStati();
    assert.equal(b.corpo.telefoni[tablet.dispositivo.id].radice, radice);
    await b.manda(b.corpo, telefono.segno, { persona: "Marco" });
    assert.notEqual(b.corpo.telefoni[telefono.dispositivo.id].radice, radice);
    assert.equal(b.corpo.telefoni[tablet.dispositivo.id].radice, radice);
  } finally {
    b.via();
  }
});
