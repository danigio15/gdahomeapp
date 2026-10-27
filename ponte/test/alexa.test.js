/* Gli Echo di casa: le notifiche dette anche da Alexa.
 *
 * La casa e' finta — una `chiedi` che si segna le chiamate — e cosi'
 * l'orologio. Si guarda cosa arriva a Home Assistant: `notify.alexa_media`
 * con gli Echo scelti, una volta per evento, mai di notte se non e' urgente,
 * e la prova solo da chi amministra.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Dispositivi } from "../src/dispositivi.js";
import { Notifiche } from "../src/notifiche.js";
import { Commissioni } from "../src/commissioni.js";

const ZITTO = { info() {}, attenzione() {}, errore() {}, debug() {} };
const ECHO = "media_player.echo_cucina";

const alle = (ore, minuti = 0) => new Date(2026, 9, 14, ore, minuti, 0).getTime();

function unBanco({ alexa, ora = alle(12), lingua = "it" } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "alexa-"));
  const orologio = { ora };
  const chiamate = [];
  const valori = { cd_lingua: lingua, ...(alexa === undefined ? {} : { cd_alexa: alexa }) };
  const casa = {
    chiedi: async (comando) => {
      chiamate.push(comando);
      return [];
    },
    ascolta: async () => () => {},
  };
  const notifiche = new Notifiche({
    cartella,
    dispositivi: new Dispositivi({ cartella, adesso: () => orologio.ora }),
    casa,
    registro: ZITTO,
    configurazione: { leggi: () => ({ snapshot: { values: valori } }) },
    adesso: () => orologio.ora,
  });
  const dette = () => chiamate.filter((una) => una.domain === "notify");
  return { cartella, orologio, chiamate, dette, notifiche, valori };
}

const accesa = (altro = {}) =>
  JSON.stringify({
    attivo: true,
    altoparlanti: [ECHO],
    categorie: ["urgenti", "casa"],
    silenzio: { da: "23:00", a: "07:00" },
    modo: "annuncio",
    ...altro,
  });

const campanello = (chiave = "campanello") => ({
  tipo: "campanello",
  urgenza: "urgente",
  chiave,
  parole: { it: { titolo: "🔔 Suonano alla porta", testo: "Ingresso" } },
});

const lavatrice = (chiave = "lavatrice") => ({
  tipo: "elettrodomestici",
  urgenza: "normale",
  chiave,
  parole: { it: { titolo: "Lavatrice finita", testo: "Ha lavorato 2 ore" } },
});

test("di serie gli Echo stanno zitti", async () => {
  const banco = unBanco();
  try {
    assert.equal(await banco.notifiche._dilloAdAlexa(campanello()), false);
    assert.equal(banco.dette().length, 0);
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("accesa, l'Echo scelto dice la notifica, senza figurine", async () => {
  const banco = unBanco({ alexa: accesa() });
  try {
    assert.equal(await banco.notifiche._dilloAdAlexa(campanello()), true);
    assert.deepEqual(banco.dette(), [
      {
        type: "call_service",
        domain: "notify",
        service: "alexa_media",
        service_data: {
          message: "Suonano alla porta. Ingresso",
          target: [ECHO],
          data: { type: "announce" },
        },
      },
    ]);
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("solo le famiglie scelte, e la prova non si dice", async () => {
  const banco = unBanco({ alexa: accesa({ categorie: ["urgenti"] }) });
  try {
    assert.equal(await banco.notifiche._dilloAdAlexa(lavatrice()), false);
    assert.equal(await banco.notifiche._dilloAdAlexa({ ...campanello(), tipo: "prova" }), false);
    assert.equal(banco.dette().length, 0);
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("di notte solo le urgenti", async () => {
  const banco = unBanco({ alexa: accesa(), ora: alle(2) });
  try {
    assert.equal(await banco.notifiche._dilloAdAlexa(lavatrice()), false);
    assert.equal(await banco.notifiche._dilloAdAlexa(campanello()), true);
    assert.equal(banco.dette().length, 1);
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("lo stesso evento non si ripete prima di due minuti, e in un'ora al piu' venti", async () => {
  const banco = unBanco({ alexa: accesa() });
  try {
    assert.equal(await banco.notifiche._dilloAdAlexa(lavatrice()), true);
    banco.orologio.ora += 60 * 1000;
    assert.equal(await banco.notifiche._dilloAdAlexa(lavatrice()), false);
    banco.orologio.ora += 61 * 1000;
    assert.equal(await banco.notifiche._dilloAdAlexa(lavatrice()), true);
    for (let i = 0; i < 30; i++) await banco.notifiche._dilloAdAlexa(lavatrice(`altra-${i}`));
    assert.equal(banco.dette().length, 20);
    banco.orologio.ora += 61 * 60 * 1000;
    assert.equal(await banco.notifiche._dilloAdAlexa(lavatrice("dopo")), true);
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("una consegna dice l'evento una volta; quella a un telefono solo no", async () => {
  const banco = unBanco({ alexa: accesa() });
  try {
    await banco.notifiche.consegna(campanello("uno"));
    await banco.notifiche.consegna(campanello("due"), { soloA: "dm_qualcuno" });
    await new Promise((fatto) => setImmediate(fatto));
    assert.equal(banco.dette().length, 1);
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("se Home Assistant dice di no, le notifiche vanno avanti", async () => {
  const banco = unBanco({ alexa: accesa() });
  banco.notifiche.casa = {
    chiedi: async () => {
      throw new Error("servizio notify.alexa_media non trovato");
    },
  };
  try {
    assert.equal(await banco.notifiche._dilloAdAlexa(campanello()), false);
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("la prova la fa solo chi amministra, e dice solo «fatto»", async () => {
  const banco = unBanco({ alexa: accesa(), lingua: "en" });
  const commissioni = new Commissioni({ registro: ZITTO });
  commissioni.notifiche = banco.notifiche;
  try {
    const detto = { id: 7, type: "ponte/alexa/prova", altoparlanti: [ECHO], modo: "voce" };
    const negato = await commissioni.rispondi(detto, { chiChiede: "u1" });
    assert.equal(negato.error.code, "unauthorized");
    assert.equal(banco.dette().length, 0);

    const fatto = await commissioni.rispondi(detto, { chiChiede: "u1", puoAmministrare: true });
    assert.deepEqual(fatto, { id: 7, type: "result", success: true, result: { fatto: true } });
    const [chiamata] = banco.dette();
    assert.deepEqual(chiamata.service_data.target, [ECHO]);
    assert.equal(chiamata.service_data.data.type, "tts");
    assert.match(chiamata.service_data.message, /^GdAHome test/);

    /* Un nome che non e' un Echo non arriva a Home Assistant. */
    banco.valori.cd_alexa = accesa({ altoparlanti: [] });
    const strano = await commissioni.rispondi(
      { id: 8, type: "ponte/alexa/prova", altoparlanti: ["light.sala; rm -rf"] },
      { puoAmministrare: true },
    );
    assert.equal(strano.success, false);
    assert.equal(banco.dette().length, 1);
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

/* ─── Gli avvisi personalizzati ─────────────────────────────────────── */

test("un avviso a orario lo dicono gli Echo suoi, una volta sola", async () => {
  const alexa = accesa({
    avvisi: [
      {
        id: "a_scuola",
        frase: "🎒 È ora di andare a scuola",
        ora: "07:30",
        giorni: [0, 1, 2, 3, 4, 5, 6],
        altoparlanti: ["media_player.echo_ingresso"],
      },
    ],
  });
  const banco = unBanco({ alexa, ora: alle(7, 30) });
  try {
    assert.equal(await banco.notifiche._gliAvvisiDiAlexa(), 1);
    banco.orologio.ora += 60 * 1000;
    assert.equal(await banco.notifiche._gliAvvisiDiAlexa(), 0);
    const [chiamata] = banco.dette();
    assert.equal(chiamata.service_data.message, "È ora di andare a scuola");
    assert.deepEqual(chiamata.service_data.target, ["media_player.echo_ingresso"]);
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("un avviso su una cosa di casa parte quando lo stato resta quello scritto", async () => {
  const alexa = accesa({
    avvisi: [
      {
        id: "a_garage",
        frase: "Il garage è aperto",
        quando: "stato",
        entita: "cover.garage",
        condizione: "uguale",
        valore: "open",
        per: 10,
      },
    ],
  });
  const banco = unBanco({ alexa, ora: alle(12) });
  try {
    banco.notifiche.sentinella.stati.set("cover.garage", { state: "open", attributes: {} });
    assert.equal(await banco.notifiche._gliAvvisiDiAlexa(), 0);
    banco.orologio.ora += 10 * 60 * 1000;
    assert.equal(await banco.notifiche._gliAvvisiDiAlexa(), 1);
    assert.deepEqual(banco.dette()[0].service_data.target, [ECHO]);
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("la prova di un avviso dice la sua frase", async () => {
  const banco = unBanco({ alexa: accesa() });
  try {
    const fatto = await banco.notifiche.provaAlexa({
      id: 1,
      altoparlanti: [ECHO],
      frase: "Il garage è aperto",
    });
    assert.equal(fatto.success, true);
    assert.equal(banco.dette()[0].service_data.message, "Il garage è aperto");
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});
