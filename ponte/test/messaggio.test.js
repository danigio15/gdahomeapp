/* Il messaggio della Home: agli Echo e ai telefoni di famiglia.
 *
 * La casa e' finta — una `chiedi` che si segna le chiamate — e cosi' gli
 * utenti. Si guarda che lo mandi solo chi e' entrato, che arrivi solo agli
 * Echo veri e alle persone di casa, che chi scrive non lo riceva, e che non
 * si possa far suonare la casa di continuo.
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

function unBanco() {
  const cartella = mkdtempSync(join(tmpdir(), "messaggio-"));
  const chiamate = [];
  const notifiche = new Notifiche({
    cartella,
    dispositivi: new Dispositivi({ cartella }),
    casa: {
      chiedi: async (comando) => {
        chiamate.push(comando);
        return [];
      },
      ascolta: async () => () => {},
    },
    registro: ZITTO,
    configurazione: { leggi: () => ({ snapshot: { values: { cd_lingua: "it" } } }) },
  });
  notifiche.utenti = {
    elenco: async () => [
      { id: "u_marco", nome: "Marco Rossi", attivo: true },
      { id: "u_giulia", nome: "Giulia", attivo: true },
    ],
  };
  notifiche.sentinella.stati.set("media_player.echo_cucina", {
    state: "idle",
    attributes: { friendly_name: "Echo Cucina", last_called: false },
  });
  notifiche.sentinella.stati.set("media_player.sonos", {
    state: "idle",
    attributes: { friendly_name: "Sonos" },
  });
  const consegnate = [];
  notifiche.consegna = async (evento) => {
    consegnate.push(evento);
    return 1;
  };
  const commissioni = new Commissioni({ registro: ZITTO });
  commissioni.notifiche = notifiche;
  return { cartella, chiamate, consegnate, notifiche, commissioni };
}

const MANDA = (altro = {}) => ({
  id: 3,
  type: "ponte/messaggio/manda",
  testo: "A tavola!",
  echo: ["media_player.echo_cucina"],
  telefoni: true,
  persone: [],
  ...altro,
});

test("senza un nome non parte niente, e non si sa chi c'e'", async () => {
  const banco = unBanco();
  try {
    const negato = await banco.commissioni.rispondi(MANDA(), {});
    assert.equal(negato.error.code, "unauthorized");
    const chi = await banco.commissioni.rispondi({ id: 4, type: "ponte/messaggio/chi" }, {});
    assert.equal(chi.error.code, "unauthorized");
    assert.equal(banco.chiamate.length, 0);
    assert.equal(banco.consegnate.length, 0);
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("chi e' entrato lo manda agli Echo e ai telefoni, e lui non lo riceve", async () => {
  const banco = unBanco();
  try {
    const fatto = await banco.commissioni.rispondi(MANDA(), { chiChiede: "u_marco" });
    assert.deepEqual(fatto.result, { telefoni: 1, echo: 1 });
    const [chiamata] = banco.chiamate;
    assert.equal(chiamata.domain, "notify");
    assert.equal(chiamata.service, "alexa_media");
    assert.deepEqual(chiamata.service_data.target, ["media_player.echo_cucina"]);
    assert.equal(chiamata.service_data.message, "Messaggio da Marco: A tavola!");
    const [evento] = banco.consegnate;
    assert.equal(evento.tipo, "messaggio");
    assert.equal(evento.tranne, "u_marco");
    assert.equal(evento.solo, undefined);
    assert.deepEqual(evento.parole.it, { titolo: "💬 Marco", testo: "A tavola!" });
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("solo Echo veri e persone di casa", async () => {
  const banco = unBanco();
  try {
    const fatto = await banco.commissioni.rispondi(
      MANDA({
        echo: ["media_player.sonos", "light.sala; rm -rf"],
        persone: ["u_giulia", "u_estraneo"],
      }),
      { chiChiede: "u_marco" },
    );
    assert.equal(fatto.result.echo, 0);
    assert.equal(banco.chiamate.length, 0);
    assert.deepEqual(banco.consegnate[0].solo, ["u_giulia"]);
    /* Solo persone che non sono di casa: ai telefoni non parte niente. */
    const nessuno = await banco.commissioni.rispondi(MANDA({ echo: [], persone: ["u_estraneo"] }), {
      chiChiede: "u_marco",
    });
    assert.equal(nessuno.result.telefoni, 0);
    assert.equal(banco.consegnate.length, 1);
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("al piu' sei messaggi al minuto per chi scrive", async () => {
  const banco = unBanco();
  try {
    for (let volta = 0; volta < 6; volta += 1) {
      const fatto = await banco.commissioni.rispondi(MANDA(), { chiChiede: "u_marco" });
      assert.equal(fatto.success, true);
    }
    const troppi = await banco.commissioni.rispondi(MANDA(), { chiChiede: "u_marco" });
    assert.equal(troppi.error.code, "rate_limited");
    /* Un altro che scrive non paga per lui. */
    const altro = await banco.commissioni.rispondi(MANDA(), { chiChiede: "u_giulia" });
    assert.equal(altro.success, true);
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("un messaggio vuoto, o senza nessuno a cui mandarlo, non parte", async () => {
  const banco = unBanco();
  try {
    const vuoto = await banco.commissioni.rispondi(MANDA({ testo: "   " }), {
      chiChiede: "u_marco",
    });
    assert.equal(vuoto.error.code, "invalid");
    const aNessuno = await banco.commissioni.rispondi(MANDA({ echo: [], telefoni: false }), {
      chiChiede: "u_marco",
    });
    assert.equal(aNessuno.error.code, "invalid");
    assert.equal(banco.chiamate.length + banco.consegnate.length, 0);
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("chi puo' ricevere: solo chi ha un telefono abbinato, tranne chi chiede", async () => {
  const banco = unBanco();
  try {
    banco.notifiche.dispositivi.elenco = () => [
      { id: "t1", utente: "u_giulia" },
      { id: "t2", utente: "u_marco" },
    ];
    banco.notifiche.archivio.dati.telefoni = { t1: { gettone: "x" }, t2: { gettone: "y" } };
    const chi = await banco.commissioni.rispondi(
      { id: 5, type: "ponte/messaggio/chi" },
      { chiChiede: "u_marco" },
    );
    assert.deepEqual(chi.result, { persone: [{ id: "u_giulia", nome: "Giulia" }] });
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("col volume scelto: gli Echo si alzano, dicono il messaggio, e tornano com'erano", async () => {
  const banco = unBanco();
  banco.notifiche.attesaDelVolume = 0;
  banco.notifiche.sentinella.stati.set("media_player.echo_cucina", {
    state: "idle",
    attributes: { friendly_name: "Echo Cucina", last_called: false, volume_level: 0.1 },
  });
  const orologi = [];
  const vero = globalThis.setTimeout;
  globalThis.setTimeout = (fai, quanto) => {
    if (quanto >= 8000) {
      orologi.push({ fai, quanto });
      return { unref() {} };
    }
    return vero(fai, quanto);
  };
  try {
    const fatto = await banco.commissioni.rispondi(MANDA({ volume: 70, telefoni: false }), {
      chiChiede: "u_marco",
    });
    assert.deepEqual(fatto.result, { telefoni: 0, echo: 1 });
    assert.deepEqual(
      banco.chiamate.map((c) => `${c.domain}.${c.service}`),
      ["media_player.volume_set", "notify.alexa_media"],
    );
    assert.deepEqual(banco.chiamate[0].service_data, {
      entity_id: ["media_player.echo_cucina"],
      volume_level: 0.7,
    });
    /* Dopo il tempo di dirlo, il volume di prima. */
    assert.equal(orologi.length, 1);
    orologi[0].fai();
    await new Promise((fatto) => vero(fatto, 0));
    assert.deepEqual(banco.chiamate[2].service_data, {
      entity_id: "media_player.echo_cucina",
      volume_level: 0.1,
    });
  } finally {
    globalThis.setTimeout = vero;
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});

test("senza volume, o con uno inventato, il volume non si tocca", async () => {
  const banco = unBanco();
  try {
    for (const volume of [undefined, null, 42, "100", 1000]) {
      banco.chiamate.length = 0;
      await banco.commissioni.rispondi(MANDA({ volume, telefoni: false }), {
        chiChiede: `u_${String(volume)}`,
      });
      assert.deepEqual(
        banco.chiamate.map((c) => `${c.domain}.${c.service}`),
        ["notify.alexa_media"],
        String(volume),
      );
    }
  } finally {
    rmSync(banco.cartella, { recursive: true, force: true });
  }
});
