/* La ricevuta di chi compra fuori casa, arrivata dal centralino.
 *
 * Il centralino la gira alla casa com'e', e alla sua porta puo' bussare
 * chiunque. Quindi la prova che conta e' quella del no: una ricevuta che non
 * ha firmato un telefono abbinato a questa casa non arriva al quadro — non
 * una firma storta, non un telefono staccato, non una firma vecchia, non una
 * firma buona su un prodotto cambiato.
 *
 * E la firma e' la stessa dell'app: il vettore qui sotto sta uguale in
 * `app/test/licenza/ricevuta_da_fuori_test.dart`, ed e' stato controllato con
 * un'altra implementazione. Se cambia da una parte, una delle due prove cade.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { LicenzaNo } from "../src/licenze.js";
import { firmaDellaRicevuta, laRicevutaDaFuori, SCARTO_MASSIMO } from "../src/ricevuta-da-fuori.js";

const CASA = "casa_0123456789abcdef0123456789abcdef";
const CHI = "dm_0123456789abcdef";
const CHIAVE = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const ADESSO = 1_760_000_000_000;

const VETTORE = Object.freeze({
  chiaveDelFilo: CHIAVE,
  casa: CASA,
  chi: CHI,
  quando: ADESSO,
  app: "gdahome",
  piattaforma: "ios",
  prodotto: "gdahome_premium_mensile",
  ricevuta: "2000000123456789",
});
const FIRMA_DEL_VETTORE = "kPMUsCuWIslki3PWUUhD13AreHc879BRMMogvYqCRZQ";

/* Una ricevuta come la manda l'app, firmata con la chiave del telefono. */
function unaRicevuta(altro = {}, chiave = CHIAVE) {
  const campi = {
    chi: CHI,
    quando: ADESSO,
    app: "gdahome",
    piattaforma: "ios",
    prodotto: "gdahome_premium_mensile",
    ricevuta: "2000000123456789",
    ...altro,
  };
  return {
    v: 1,
    ...campi,
    firma: firmaDellaRicevuta({ chiaveDelFilo: chiave, casa: CASA, ...campi }),
  };
}

/* I telefoni della casa: uno solo, con la sua chiave del filo. */
const dispositivi = { chiaveDi: (id) => (id === CHI ? CHIAVE : null) };

/* Il quadro, visto dalla casa: si ricorda cosa gli si e' chiesto. */
function leLicenze(
  risposta = () => ({ gdahome: { attiva: true }, gdanav: {}, gettoni: { gdahome: "g" } }),
) {
  const chieste = [];
  return {
    chieste,
    negozio: async (dati) => {
      chieste.push(dati);
      return risposta(dati);
    },
  };
}

const provaLa = (corpo, licenze, altro = {}) =>
  laRicevutaDaFuori(corpo, { casa: CASA, dispositivi, licenze, adesso: () => ADESSO, ...altro });

test("la firma e' quella del contratto: il vettore di prova", () => {
  assert.equal(firmaDellaRicevuta(VETTORE), FIRMA_DEL_VETTORE);
});

test("una ricevuta di un telefono della casa va al quadro, e torna la licenza", async () => {
  const licenze = leLicenze();
  const risposta = await provaLa(unaRicevuta(), licenze);
  assert.equal(risposta.stato, 200);
  assert.deepEqual(licenze.chieste, [
    {
      app: "gdahome",
      piattaforma: "ios",
      prodotto: "gdahome_premium_mensile",
      ricevuta: "2000000123456789",
    },
  ]);
  assert.equal(risposta.corpo.gdahome.attiva, true);
  assert.deepEqual(risposta.corpo.gettoni, { gdahome: "g" });
  /* Solo quello che serve al telefono: la licenza e i gettoni. */
  assert.deepEqual(Object.keys(risposta.corpo).sort(), ["gdahome", "gdanav", "gettoni"]);
});

test("senza la firma giusta non si va al quadro", async () => {
  const licenze = leLicenze();
  const storte = [
    /* Firmata con un'altra chiave: non e' un telefono di questa casa. */
    unaRicevuta({}, "ff".repeat(32)),
    /* Firmata per un prodotto e mandata per un altro. */
    { ...unaRicevuta(), prodotto: "gdahome_premium_annuale" },
    { ...unaRicevuta(), ricevuta: "2000000999999999" },
    /* Una firma qualunque. */
    { ...unaRicevuta(), firma: "x".repeat(43) },
    { ...unaRicevuta(), firma: "" },
  ];
  for (const corpo of storte) {
    const risposta = await provaLa(corpo, licenze);
    assert.equal(risposta.stato, 403, JSON.stringify(corpo));
    assert.equal(risposta.corpo.errore, "firma-sbagliata");
  }
  assert.equal(licenze.chieste.length, 0);
});

test("un telefono che la casa non conosce, o che ha staccato, non passa", async () => {
  const licenze = leLicenze();
  const risposta = await provaLa(unaRicevuta({ chi: "dm_sconosciuto" }), licenze);
  assert.deepEqual(risposta, { stato: 403, corpo: { errore: "telefono-sconosciuto" } });
  assert.equal(licenze.chieste.length, 0);
});

test("una firma vecchia non vale: un quarto d'ora, prima o dopo", async () => {
  const licenze = leLicenze();
  const vecchia = await provaLa(unaRicevuta({ quando: ADESSO - SCARTO_MASSIMO - 1 }), licenze);
  assert.deepEqual(vecchia, { stato: 403, corpo: { errore: "ricevuta-scaduta" } });
  const avanti = await provaLa(unaRicevuta({ quando: ADESSO + SCARTO_MASSIMO + 1 }), licenze);
  assert.equal(avanti.stato, 403);
  assert.equal(licenze.chieste.length, 0);
  /* Dentro il quarto d'ora si'. */
  const giusta = await provaLa(unaRicevuta({ quando: ADESSO - SCARTO_MASSIMO + 1000 }), licenze);
  assert.equal(giusta.stato, 200);
});

test("una ricevuta fatta male non e' nemmeno guardata", async () => {
  const licenze = leLicenze();
  for (const corpo of [
    null,
    [],
    "testo",
    { ...unaRicevuta(), v: 2 },
    { ...unaRicevuta(), quando: "ieri" },
    { ...unaRicevuta(), app: undefined },
    { ...unaRicevuta(), ricevuta: "à caso" },
    { ...unaRicevuta(), prodotto: "a\nb" },
  ]) {
    const risposta = await provaLa(corpo, licenze);
    assert.deepEqual(
      risposta,
      { stato: 400, corpo: { errore: "ricevuta-storta" } },
      JSON.stringify(corpo),
    );
  }
  assert.equal(licenze.chieste.length, 0);
});

test("i no del quadro tornano al telefono col loro stato", async () => {
  const casi = [
    ["ricevuta-non-valida", 402],
    ["verifica-non-configurata", 503],
    ["quadro-irraggiungibile", 502],
    ["troppe-richieste", 429],
    ["non-ti-riconosco", 502],
  ];
  for (const [codice, stato] of casi) {
    const licenze = leLicenze(() => {
      throw new LicenzaNo(codice, "no");
    });
    const risposta = await provaLa(unaRicevuta(), licenze);
    assert.deepEqual(risposta, { stato, corpo: { errore: codice } }, codice);
  }
});
