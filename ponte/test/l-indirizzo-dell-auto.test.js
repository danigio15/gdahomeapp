/* «Non mi devi mostrare coordinate ma voglio vedere indirizzo.»
 *
 * Il ponte chiede la via a Nominatim (OpenStreetMap): qui si prova che dal
 * punto esce una via scritta bene, che esce solo il punto arrotondato, che
 * si rispetta una domanda al secondo, che un punto gia' chiesto non si
 * richiede, e che il comando passa dalle commissioni. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { Indirizzi, indirizzoDaNominatim, NOMINATIM, puntoBuono } from "../src/indirizzi.js";
import { Commissioni } from "../src/commissioni.js";

/* Un utente di Home Assistant: le commissioni sono per chi e' entrato. */
const CHI_DI_PROVA = "c0ffee00c0ffee00c0ffee00c0ffee00";

const ZITTO = { info() {}, attenzione() {}, errore() {}, debug() {} };

const RISPOSTA = {
  display_name: "12, Via Roma, Centro, Milano, Lombardia, 20121, Italia",
  address: {
    house_number: "12",
    road: "Via Roma",
    suburb: "Centro",
    city: "Milano",
    postcode: "20121",
  },
};

function unNominatim(risposta = RISPOSTA) {
  const chieste = [];
  const prendi = async (url, opzioni) => {
    chieste.push({ url, opzioni });
    return { ok: true, json: async () => risposta };
  };
  return { chieste, prendi };
}

test("dalla risposta di Nominatim esce «via e civico, citta'»", () => {
  assert.equal(indirizzoDaNominatim(RISPOSTA), "Via Roma 12, Milano");
  assert.equal(
    indirizzoDaNominatim({ address: { amenity: "Parcheggio Esselunga", town: "Monza" } }),
    "Parcheggio Esselunga, Monza",
  );
  assert.equal(
    indirizzoDaNominatim({ address: { road: "SP 12", village: "Brenna" } }),
    "SP 12, Brenna",
  );
  assert.equal(indirizzoDaNominatim({ display_name: "A, B, C, D, E" }), "A, B, C");
  assert.equal(indirizzoDaNominatim({}), "");
});

test("esce solo il punto, arrotondato, con il nome di chi chiede", async () => {
  const { chieste, prendi } = unNominatim();
  const indirizzi = new Indirizzi({ prendi, versione: "1.17.1", aspetta: async () => {} });
  assert.equal(await indirizzi.indirizzoDi(45.4642113, 9.1901234), "Via Roma 12, Milano");
  assert.equal(chieste.length, 1);
  const url = new URL(chieste[0].url);
  assert.equal(`${url.origin}${url.pathname}`, NOMINATIM);
  assert.equal(url.searchParams.get("lat"), "45.4642");
  assert.equal(url.searchParams.get("lon"), "9.1901");
  assert.match(chieste[0].opzioni.headers["user-agent"], /^GdAHome\/1\.17\.1 /);
});

test("un punto gia' chiesto non si richiede, e due domande insieme fanno una sola", async () => {
  const { chieste, prendi } = unNominatim();
  const indirizzi = new Indirizzi({ prendi, aspetta: async () => {} });
  const [a, b] = await Promise.all([
    indirizzi.indirizzoDi(45.4642, 9.19),
    indirizzi.indirizzoDi(45.46421, 9.19001),
  ]);
  assert.equal(a, "Via Roma 12, Milano");
  assert.equal(b, a);
  await indirizzi.indirizzoDi(45.4642, 9.19);
  assert.equal(chieste.length, 1);
});

test("fra una domanda e l'altra passa piu' di un secondo", async () => {
  const { prendi } = unNominatim();
  let ora = 1_000_000;
  const attese = [];
  const indirizzi = new Indirizzi({
    prendi,
    adesso: () => ora,
    aspetta: async (ms) => {
      attese.push(ms);
      ora += ms;
    },
  });
  await indirizzi.indirizzoDi(45.1, 9.1);
  await indirizzi.indirizzoDi(45.2, 9.2);
  assert.ok(attese.length === 1 && attese[0] >= 1000, `attese: ${attese}`);
});

test("un punto storto o una rete che non risponde danno «non si sa», senza cadere", async () => {
  assert.equal(puntoBuono("abc", 9), null);
  assert.equal(puntoBuono(0, 0), null);
  assert.equal(puntoBuono(91, 9), null);
  const indirizzi = new Indirizzi({
    prendi: async () => {
      throw new Error("rete");
    },
    aspetta: async () => {},
  });
  assert.equal(await indirizzi.indirizzoDi(45, 9), "");
  assert.equal(await indirizzi.indirizzoDi("x", 9), "");
});

test("il comando ponte/indirizzo passa dalle commissioni", async () => {
  const { prendi } = unNominatim();
  const con = new Commissioni({
    registro: ZITTO,
    indirizzi: new Indirizzi({ prendi, aspetta: async () => {} }),
  });
  assert.equal(con.riconosce({ type: "ponte/indirizzo" }), true);
  const si = await con.rispondi(
    { id: 1, type: "ponte/indirizzo", lat: 45.4642, lon: 9.19 },
    { chiChiede: CHI_DI_PROVA },
  );
  assert.deepEqual(si.result, { indirizzo: "Via Roma 12, Milano" });
  const no = await con.rispondi(
    { id: 2, type: "ponte/indirizzo", lat: "x", lon: 9 },
    { chiChiede: CHI_DI_PROVA },
  );
  assert.equal(no.success, false);
  assert.equal(no.error.code, "not_found");
});
