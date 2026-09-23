/* Le prove della cifratura.
 *
 * Quello che si prova non e' «che cifri»: e' che **rifiuti** tutto quello che
 * va rifiutato. Una cifratura che apre buste altrui, buste toccate o buste
 * rigiocate non e' una cifratura, e' un rituale.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  APERTA_MASSIMA,
  aperturaNuova,
  Busta,
  BustaGuasta,
  chiaveDelFiloNuova,
  chiaveDiSessione,
  coppiaEffimera,
  SOGLIA_DI_COMPRESSIONE,
} from "../src/cifra.js";
import { impronta } from "../src/segreti.js";

/* Un codice come quelli della console: sedici lettere dell'alfabeto buono. */
const CODICE = "ABCDEFGHJKMNPQRS";

/* Una stretta di mano intera, come succede a ogni collegamento. Senza chiave
 * del filo e' quella di un abbinamento, col codice. */
function unaStretta({
  chiaveDelFilo = null,
  codice = chiaveDelFilo ? null : CODICE,
  apertura = aperturaNuova(),
} = {}) {
  const telefono = coppiaEffimera();
  const casa = coppiaEffimera();
  const comune = {
    delTelefono: telefono.pubblica,
    dellaCasa: casa.pubblica,
    apertura,
    chiaveDelFilo,
    codice,
  };
  return {
    telefono,
    casa,
    apertura,
    daDentroIlTelefono: chiaveDiSessione({
      ...comune,
      miaPrivata: telefono.privata,
      suaPubblica: casa.pubblica,
    }),
    daDentroLaCasa: chiaveDiSessione({
      ...comune,
      miaPrivata: casa.privata,
      suaPubblica: telefono.pubblica,
    }),
  };
}

function dueBuste(chiave) {
  return {
    telefono: new Busta(chiave, { io: "telefono" }),
    casa: new Busta(chiave, { io: "casa" }),
  };
}

/* ─── Le chiavi ──────────────────────────────────────────────────────────── */

test("le due punte arrivano alla stessa chiave senza mai mandarsela", () => {
  const stretta = unaStretta({ chiaveDelFilo: chiaveDelFiloNuova() });
  assert.deepEqual(stretta.daDentroIlTelefono, stretta.daDentroLaCasa);
  assert.equal(stretta.daDentroIlTelefono.length, 32);
});

test("nell'abbinamento la chiave viene dal codice, e le due punte ci arrivano uguali", () => {
  const stretta = unaStretta();
  assert.deepEqual(stretta.daDentroIlTelefono, stretta.daDentroLaCasa);
});

test("senza chiave del filo e senza codice una chiave non si fa piu'", () => {
  /* Era la stretta di mano dell'abbinamento di prima: il solo scambio
   * effimero, che non difende da chi sta in mezzo. Non deve poter tornare
   * nemmeno per sbaglio. */
  const telefono = coppiaEffimera();
  const casa = coppiaEffimera();
  const comune = {
    miaPrivata: telefono.privata,
    suaPubblica: casa.pubblica,
    delTelefono: telefono.pubblica,
    dellaCasa: casa.pubblica,
    apertura: aperturaNuova(),
  };
  assert.throws(() => chiaveDiSessione(comune));
  assert.throws(() =>
    chiaveDiSessione({ ...comune, chiaveDelFilo: chiaveDelFiloNuova(), codice: CODICE }),
  );
});

test("chi ha visto passare le due chiavi pubbliche non ricava niente", () => {
  /* E' quello che vede il centralino: due chiavi pubbliche e l'apertura. Con
   * quelle sole non si arriva alla chiave comune — nemmeno sapendo il
   * codice, che qui gli si regala. */
  const stretta = unaStretta();
  const chiGuarda = coppiaEffimera();
  const indovinata = chiaveDiSessione({
    miaPrivata: chiGuarda.privata,
    suaPubblica: stretta.casa.pubblica,
    delTelefono: stretta.telefono.pubblica,
    dellaCasa: stretta.casa.pubblica,
    apertura: stretta.apertura,
    codice: CODICE,
  });
  assert.notDeepEqual(stretta.daDentroLaCasa, indovinata);
});

test("chi si mette in mezzo a un abbinamento senza il codice arriva a un'altra chiave", () => {
  /* Il centralino l'impronta del codice la conosce — e' su quella che
   * instrada — e fa lui la stretta di mano con la casa, con una chiave
   * effimera sua. Tutto quello che gli manca e' il codice, e senza quello la
   * sua chiave e quella della casa non coincidono: la conferma non si apre. */
  const inMezzo = coppiaEffimera();
  const casa = coppiaEffimera();
  const apertura = aperturaNuova();
  const comune = { delTelefono: inMezzo.pubblica, dellaCasa: casa.pubblica, apertura };
  const dellaCasa = chiaveDiSessione({
    ...comune,
    miaPrivata: casa.privata,
    suaPubblica: inMezzo.pubblica,
    codice: CODICE,
  });
  const sua = chiaveDiSessione({
    ...comune,
    miaPrivata: inMezzo.privata,
    suaPubblica: casa.pubblica,
    /* L'impronta al posto del codice: e' tutto quello che ha. */
    codice: impronta(CODICE),
  });
  assert.notDeepEqual(dellaCasa, sua);
  assert.throws(
    () => new Busta(dellaCasa, { io: "casa" }).apri(new Busta(sua).chiudi("{}")),
    BustaGuasta,
  );
});

test("il codice battuto a mano da' la stessa chiave del codice inquadrato", () => {
  const telefono = coppiaEffimera();
  const casa = coppiaEffimera();
  const apertura = aperturaNuova();
  const comune = { delTelefono: telefono.pubblica, dellaCasa: casa.pubblica, apertura };
  const inquadrato = chiaveDiSessione({
    ...comune,
    miaPrivata: telefono.privata,
    suaPubblica: casa.pubblica,
    codice: CODICE,
  });
  const battuto = chiaveDiSessione({
    ...comune,
    miaPrivata: casa.privata,
    suaPubblica: telefono.pubblica,
    codice: "abcd-efgh jkmn-pqrs",
  });
  assert.deepEqual(inquadrato, battuto);
});

test("chi si mettesse in mezzo per davvero non passa, se c'e' la chiave del filo", () => {
  /* E' la differenza fra un centralino che guarda e uno riscritto per
   * attaccare. Con la chiave del filo, lo scambio effimero da solo non basta:
   * chi non ce l'ha arriva a un'altra chiave. */
  const stretta = unaStretta({ chiaveDelFilo: chiaveDelFiloNuova() });
  const inMezzo = coppiaEffimera();
  const suo = chiaveDiSessione({
    miaPrivata: inMezzo.privata,
    suaPubblica: stretta.casa.pubblica,
    delTelefono: stretta.telefono.pubblica,
    dellaCasa: stretta.casa.pubblica,
    apertura: stretta.apertura,
    chiaveDelFilo: chiaveDelFiloNuova(),
  });
  assert.notDeepEqual(stretta.daDentroLaCasa, suo);
});

test("lo stesso telefono ha una chiave diversa a ogni collegamento", () => {
  /* Senza, due collegamenti riuserebbero gli stessi nonce con la stessa
   * chiave — e in GCM quello non indebolisce: rompe. */
  const chiaveDelFilo = chiaveDelFiloNuova();
  const una = unaStretta({ chiaveDelFilo });
  const altra = unaStretta({ chiaveDelFilo });
  assert.notDeepEqual(una.daDentroLaCasa, altra.daDentroLaCasa);
});

test("due abbinamenti non danno mai la stessa chiave", () => {
  const chiavi = new Set();
  for (let i = 0; i < 20; i += 1) {
    chiavi.add(unaStretta().daDentroLaCasa.toString("hex"));
  }
  assert.equal(chiavi.size, 20);
});

/* ─── Le buste ───────────────────────────────────────────────────────────── */

test("quello che si chiude da una parte si apre dall'altra", () => {
  const { telefono, casa } = dueBuste(unaStretta().daDentroLaCasa);
  const detto = JSON.stringify({ type: "auth", access_token: "il-mio-segno" });

  const busta = telefono.chiudi(detto);
  assert.notEqual(busta, detto);
  assert.equal(busta.includes("access_token"), false, "in chiaro non si legge niente");
  assert.equal(casa.apri(busta), detto);
});

test("si parla nei due sensi, e i due versi non si mescolano", () => {
  const { telefono, casa } = dueBuste(unaStretta().daDentroLaCasa);
  assert.equal(casa.apri(telefono.chiudi("uno")), "uno");
  assert.equal(telefono.apri(casa.chiudi("due")), "due");
  assert.equal(casa.apri(telefono.chiudi("tre")), "tre");
});

test("una busta mandata da me non la posso aprire io", () => {
  const { telefono } = dueBuste(unaStretta().daDentroLaCasa);
  assert.throws(() => telefono.apri(telefono.chiudi("parlo da solo")), BustaGuasta);
});

test("una busta toccata anche di un byte non si apre", () => {
  const { telefono, casa } = dueBuste(unaStretta().daDentroLaCasa);
  const busta = Buffer.from(telefono.chiudi("non toccarmi"), "base64");
  for (const dove of [0, 13, busta.length - 1]) {
    const rovinata = Buffer.from(busta);
    rovinata[dove] ^= 0x01;
    assert.throws(() => casa.apri(rovinata.toString("base64")), BustaGuasta, `byte ${dove}`);
  }
});

test("una busta rigiocata non passa due volte", () => {
  const { telefono, casa } = dueBuste(unaStretta().daDentroLaCasa);
  const busta = telefono.chiudi("accendi tutto");
  assert.equal(casa.apri(busta), "accendi tutto");
  /* Chi sta in mezzo ha registrato quella busta e la rimanda. */
  assert.throws(() => casa.apri(busta), BustaGuasta);
});

test("le buste fuori ordine si rifiutano", () => {
  const { telefono, casa } = dueBuste(unaStretta().daDentroLaCasa);
  const prima = telefono.chiudi("prima");
  const seconda = telefono.chiudi("seconda");
  assert.throws(() => casa.apri(seconda), BustaGuasta, "non si salta avanti");
  assert.equal(casa.apri(prima), "prima");
  assert.equal(casa.apri(seconda), "seconda");
});

test("una busta di un altro filo non si apre", () => {
  const uno = dueBuste(unaStretta().daDentroLaCasa);
  const due = dueBuste(unaStretta().daDentroLaCasa);
  assert.throws(() => due.casa.apri(uno.telefono.chiudi("ciao")), BustaGuasta);
});

test("una busta storta non fa esplodere niente, dice solo di no", () => {
  const { casa } = dueBuste(unaStretta().daDentroLaCasa);
  for (const roba of ["", "non base64!!!", "AAAA", Buffer.alloc(27).toString("base64")]) {
    assert.throws(() => casa.apri(roba), BustaGuasta, `«${roba}»`);
  }
});

/* ─── La compressione ────────────────────────────────────────────────────── */

/* Un `get_states` come lo manda una casa vera: quattrocento entita', tutte
 * fatte allo stesso modo. */
const unaCasaGrande = () =>
  JSON.stringify({
    id: 7,
    type: "result",
    success: true,
    result: Array.from({ length: 400 }, (_, i) => ({
      entity_id: `sensor.temperatura_${i}`,
      state: String(20 + (i % 7)),
      attributes: {
        unit_of_measurement: "°C",
        friendly_name: `Temperatura ${i}`,
        device_class: "temperature",
      },
      last_changed: "2026-09-09T10:00:00.000000+00:00",
      last_updated: "2026-09-09T10:00:00.000000+00:00",
    })),
  });

/* Dodici di nonce, il testo com'e', sedici di marchio: e' una busta che non
 * ha compresso niente. */
const pesoSenzaComprimere = (testo) => 12 + Buffer.byteLength(testo, "utf8") + 16;

test("una busta compressa e' molto piu' piccola, e si apre uguale", () => {
  const chiave = unaStretta().daDentroLaCasa;
  const casa = new Busta(chiave, { io: "casa", comprime: true });
  const telefono = new Busta(chiave, { io: "telefono" });
  const testo = unaCasaGrande();
  assert.ok(testo.length > SOGLIA_DI_COMPRESSIONE);

  const busta = casa.chiudi(testo);
  assert.ok(
    busta.length < testo.length / 4,
    `${busta.length} caratteri per ${testo.length} di testo`,
  );
  assert.equal(telefono.apri(busta), testo);
  assert.equal(telefono.ricevo, 1);
});

test("sotto la soglia non si comprime: una busta piccola resta com'era", () => {
  const chiave = unaStretta().daDentroLaCasa;
  const casa = new Busta(chiave, { io: "casa", comprime: true });
  const telefono = new Busta(chiave, { io: "telefono" });
  const testo = JSON.stringify({ type: "event", event: { data: { entity_id: "light.cucina" } } });

  const busta = casa.chiudi(testo);
  assert.equal(Buffer.from(busta, "base64").length, pesoSenzaComprimere(testo));
  assert.equal(telefono.apri(busta), testo);
});

test("chi non ha detto di saper aprire il gzip non lo riceve, per quanto grande sia il testo", () => {
  const chiave = unaStretta().daDentroLaCasa;
  const casa = new Busta(chiave, { io: "casa" });
  const telefono = new Busta(chiave, { io: "telefono" });
  const testo = unaCasaGrande();

  const busta = casa.chiudi(testo);
  assert.equal(Buffer.from(busta, "base64").length, pesoSenzaComprimere(testo));
  assert.equal(telefono.apri(busta), testo);
});

test("una busta compressa si apre anche da chi non comprime: il contenuto si riconosce da solo", () => {
  const chiave = unaStretta().daDentroLaCasa;
  const telefono = new Busta(chiave, { io: "telefono", comprime: true });
  const casa = new Busta(chiave, { io: "casa", comprime: false });
  const testo = unaCasaGrande();
  assert.equal(casa.apri(telefono.chiudi(testo)), testo);
});

test("un testo che comincia con i caratteri del gzip non si scambia per un gzip", () => {
  /* I due byte con cui comincia un gzip, `1f 8b`, in UTF-8 non si possono
   * scrivere: `8b` da solo non e' un carattere, e un testo li' non ci arriva
   * mai. Percio' riconoscere il gzip dai primi due byte non ha falsi
   * positivi — nemmeno con un testo che ci prova. */
  const chiave = unaStretta().daDentroLaCasa;
  const casa = new Busta(chiave, { io: "casa", comprime: false });
  const telefono = new Busta(chiave, { io: "telefono" });
  const testo = "\u001f\u008bnon sono un gzip";
  assert.equal(telefono.apri(casa.chiudi(testo)), testo);
});

test("una bomba non si apre: oltre i sedici megabyte si dice di no", () => {
  const chiave = unaStretta().daDentroLaCasa;
  const casa = new Busta(chiave, { io: "casa", comprime: true });
  const telefono = new Busta(chiave, { io: "telefono" });
  /* Sedici megabyte di niente pesano venti chilobyte compressi. */
  const busta = casa.chiudi(" ".repeat(APERTA_MASSIMA + 1));
  assert.ok(busta.length < 100_000, `la bomba pesa ${busta.length} caratteri`);
  assert.throws(() => telefono.apri(busta), BustaGuasta);
  assert.equal(telefono.ricevo, 0, "una busta rifiutata non conta");
});
