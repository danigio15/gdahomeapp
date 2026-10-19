/* Le prove dell'abbinamento e dell'archivio dei telefoni.
 *
 * L'orologio e' finto: cosi' la scadenza dei cinque minuti e la potatura dei
 * novanta giorni si provano davvero, invece di essere commentate come «non
 * provabile». `/data` e' una cartella temporanea che sparisce alla fine.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Abbinamento, CodiceSbagliato, TroppiTentativi } from "../src/abbinamento.js";
import { Dispositivi, TroppiDispositivi } from "../src/dispositivi.js";
import { codicePulito, impronta, segnoNuovo, stessoSegreto } from "../src/segreti.js";

const MINUTO = 60 * 1000;
const GIORNO = 24 * 60 * 60 * 1000;

/* Un orologio che si sposta a comando. */
function orologio(partenza = 1_700_000_000_000) {
  let ora = partenza;
  return {
    adesso: () => ora,
    avanti: (quanto) => {
      ora += quanto;
    },
  };
}

function cartellaFinta() {
  const dove = mkdtempSync(join(tmpdir(), "ponte-"));
  return { dove, via: () => rmSync(dove, { recursive: true, force: true }) };
}

/* ─── I segreti ──────────────────────────────────────────────────────────── */

test("il codice si legge come lo batte una persona", () => {
  assert.equal(codicePulito(" ab-cd 23 "), "ABCD23");
  assert.equal(codicePulito(null), "");
});

test("il confronto dice no su lunghezze diverse senza sollevare", () => {
  assert.equal(stessoSegreto("abc", "abcd"), false);
  assert.equal(stessoSegreto(impronta("x"), impronta("x")), true);
  assert.equal(stessoSegreto(impronta("x"), impronta("y")), false);
});

test("due segni non si somigliano mai", () => {
  const visti = new Set();
  for (let i = 0; i < 500; i += 1) visti.add(segnoNuovo());
  assert.equal(visti.size, 500);
});

/* ─── L'abbinamento ──────────────────────────────────────────────────────── */

test("il codice buono entra una volta sola", () => {
  const a = new Abbinamento({ adesso: orologio().adesso });
  const { codice } = a.nuovo();
  assert.ok(a.consuma(codice), "il codice buono non e' entrato");
  assert.throws(() => a.consuma(codice), CodiceSbagliato);
});

test("il codice si puo' battere minuscolo e con gli spazi", () => {
  const a = new Abbinamento({ adesso: orologio().adesso });
  const { codice } = a.nuovo();
  const battuto = `${codice.slice(0, 4).toLowerCase()} - ${codice.slice(4).toLowerCase()}`;
  assert.ok(a.consuma(battuto), "il codice buono non e' entrato");
});

test("dopo cinque minuti il codice non vale piu'", () => {
  const tempo = orologio();
  const a = new Abbinamento({ minutiDelCodice: 5, adesso: tempo.adesso });
  const { codice } = a.nuovo();
  tempo.avanti(5 * MINUTO + 1);
  assert.equal(a.stato().attivo, false);
  assert.throws(() => a.consuma(codice), CodiceSbagliato);
});

test("un codice nuovo spegne quello di prima", () => {
  const a = new Abbinamento({ adesso: orologio().adesso });
  const primo = a.nuovo().codice;
  const secondo = a.nuovo().codice;
  assert.throws(() => a.consuma(primo), CodiceSbagliato);
  assert.ok(a.consuma(secondo), "il codice buono non e' entrato");
});

test("cinque tentativi sbagliati chiudono la porta a chi li ha fatti, e il tempo la riapre", () => {
  const tempo = orologio();
  const a = new Abbinamento({ adesso: tempo.adesso });
  a.nuovo();
  const da = { da: "192.168.1.66" };
  for (let i = 0; i < 5; i += 1) assert.throws(() => a.consuma("SBAGLIATO", da), CodiceSbagliato);
  assert.throws(() => a.consuma("SBAGLIATO", da), TroppiTentativi);
  assert.notEqual(a.bloccato(da.da), null);

  tempo.avanti(15 * MINUTO + 1);
  assert.equal(a.bloccato(da.da), null);
  const { codice } = a.nuovo();
  assert.ok(a.consuma(codice, da), "il codice buono non e' entrato");
});

test("un estraneo che sbaglia non chiude la porta a chi ha il codice", () => {
  /* Prima i tentativi si contavano tutti insieme: dieci errori di chiunque
   * bloccavano l'abbinamento per un quarto d'ora anche a chi stava davanti
   * allo schermo col codice vero. */
  const a = new Abbinamento({ adesso: orologio().adesso });
  const { codice } = a.nuovo();
  for (let i = 0; i < 20; i += 1) {
    assert.throws(() => a.consuma("SBAGLIATO", { da: "estraneo" }), /codice|troppi/);
  }
  assert.notEqual(a.bloccato("estraneo"), null, "lui si' che aspetta");
  assert.equal(a.bloccato("192.168.1.20"), null);
  assert.ok(a.consuma(codice, { da: "192.168.1.20" }), "il codice buono non e' entrato");
});

test("tanti estranei insieme chiudono la porta a chi prova, non a chi ha il codice", () => {
  /* Il tetto di tutti insieme si riempie anche da fuori: se valesse per
   * tutti, bloccherebbe proprio chi sta davanti allo schermo col codice. Vale
   * per chi ha gia' sbagliato; chi non ha ancora provato passa, e chi il
   * codice lo presenta giusto entra. */
  const a = new Abbinamento({ adesso: orologio().adesso });
  const { codice } = a.nuovo();
  for (let i = 0; i < 999; i += 1) a.sbagliato(`estraneo ${i % 200}`);
  a.sbagliato("192.168.1.30");
  assert.notEqual(a.stato().bloccatoFinoA, null);
  assert.notEqual(a.bloccato("192.168.1.30"), null, "chi ha gia' sbagliato aspetta");
  assert.notEqual(a.bloccato("estraneo 3"), null);
  assert.equal(a.bloccato("192.168.1.20"), null, "chi non ha provato no");
  assert.ok(a.consuma(codice, { da: "192.168.1.30" }), "e il codice giusto entra");
});

test("dieci estranei non bastano piu' a far aspettare chi ha sbagliato una volta", () => {
  /* Col tetto di tutti insieme a cinquanta, dieci indirizzi da cinque
   * tentativi l'uno facevano aspettare un quarto d'ora chi aveva inquadrato
   * un QR vecchio: adesso ne servirebbero duecento. */
  const a = new Abbinamento({ adesso: orologio().adesso });
  const { codice } = a.nuovo();
  for (let i = 0; i < 10; i += 1) {
    for (let j = 0; j < 5; j += 1) a.sbagliato(`93.40.1.${i}`);
  }
  a.sbagliato("192.168.1.30");
  assert.equal(a.stato().bloccatoFinoA, null);
  assert.equal(a.bloccato("192.168.1.30"), null, "chi ha sbagliato una volta riprova");
  assert.notEqual(a.bloccato("93.40.1.4"), null, "chi ha sbagliato cinque volte no");
  assert.ok(a.consuma(codice, { da: "192.168.1.30" }), "e il codice giusto entra");
});

test("tutti gli estranei del mondo non fermano chi presenta il codice giusto", () => {
  const a = new Abbinamento({ adesso: orologio().adesso });
  const { codice } = a.nuovo();
  for (let i = 0; i < 5000; i += 1) a.sbagliato(`estraneo ${i}`);
  assert.notEqual(a.stato().bloccatoFinoA, null, "il tetto di tutti insieme e' pieno");
  assert.equal(a.bloccato("192.168.1.20"), null, "ma chi non ha provato non aspetta");
  assert.ok(a._sbagliati.length <= 1000, "e il mucchio non cresce senza fondo");
  assert.ok(a.consuma(codice, { da: "192.168.1.20" }), "e il codice giusto entra");
});

test("dal centralino senza indirizzo si conta come un gruppo, non come uno", () => {
  /* Un centralino che non dice l'indirizzo mette tutti in un mucchio solo:
   * col tetto di uno, cinque estranei chiudevano l'abbinamento da fuori casa
   * a tutti. */
  const tempo = orologio();
  const a = new Abbinamento({ adesso: tempo.adesso });
  a.nuovo();
  for (let i = 0; i < 49; i += 1) a.sbagliato("centralino");
  assert.equal(a.bloccato("centralino"), null);
  a.sbagliato("centralino");
  assert.notEqual(a.bloccato("centralino"), null, "ma un tetto ce l'ha anche lui");
  /* Chi arriva dal centralino con l'indirizzo e' uno, come sempre. */
  for (let i = 0; i < 5; i += 1) a.sbagliato("centralino 93.40.1.2");
  assert.notEqual(a.bloccato("centralino 93.40.1.2"), null);
  assert.equal(a.bloccato("centralino 93.40.1.3"), null);
  tempo.avanti(15 * MINUTO + 1);
  assert.equal(a.bloccato("centralino"), null, "e il tempo lo riapre");
});

test("chi continua a sbagliare aspetta dall'ultimo che ha riempito il tetto", () => {
  const tempo = orologio();
  const a = new Abbinamento({ adesso: tempo.adesso });
  a.nuovo();
  for (let i = 0; i < 5; i += 1) {
    a.sbagliato("93.40.1.9");
    tempo.avanti(MINUTO);
  }
  const finoA = a.bloccato("93.40.1.9");
  assert.notEqual(finoA, null);
  tempo.avanti(10 * MINUTO + 1);
  assert.equal(a.bloccato("93.40.1.9"), null, "il primo tentativo e' scaduto: ne restano quattro");
});

test("un tentativo si conta quando comincia: il sesto di una raffica aspetta", () => {
  /* Cinque strette di mano aperte insieme e nessuna ancora finita: prima
   * passavano tutte, e anche la sesta, la ventesima, perche' si contavano
   * solo alla fine. */
  const a = new Abbinamento({ adesso: orologio().adesso });
  a.nuovo();
  const aperti = [];
  for (let i = 0; i < 5; i += 1) aperti.push(a.comincia("93.40.1.9"));
  assert.throws(() => a.comincia("93.40.1.9"), TroppiTentativi);
  assert.throws(() => a.comincia("93.40.1.9"), TroppiTentativi);
  assert.equal(a.stato().tentativiSbagliati, 5, "i rifiutati non si contano");
  assert.notEqual(a.bloccato("93.40.1.9"), null);
  assert.ok(a.comincia("93.40.1.10"), "gli altri no");
});

test("un tentativo restituito non conta, e si restituisce una volta sola", () => {
  const a = new Abbinamento({ adesso: orologio().adesso });
  a.nuovo();
  for (let i = 0; i < 4; i += 1) a.sbagliato("93.40.1.9");
  const tentativo = a.comincia("93.40.1.9");
  assert.equal(a.stato().tentativiSbagliati, 5);
  assert.notEqual(a.bloccato("93.40.1.9"), null, "contato mentre e' in corso");
  a.restituisci(tentativo);
  a.restituisci(tentativo);
  assert.equal(a.stato().tentativiSbagliati, 4, "tornato una volta, non due");
  assert.equal(a.bloccato("93.40.1.9"), null);
  a.comincia("93.40.1.9");
  assert.throws(() => a.comincia("93.40.1.9"), TroppiTentativi);
});

test("chi restituisce il suo unico tentativo torna uno che non ha mai sbagliato", () => {
  /* Il tetto di tutti insieme vale solo per chi ha gia' sbagliato: un
   * tentativo andato bene non lo deve mettere fra quelli. */
  const a = new Abbinamento({ adesso: orologio().adesso });
  a.nuovo();
  for (let i = 0; i < 999; i += 1) a.sbagliato(`estraneo ${i % 200}`);
  const tentativo = a.comincia("192.168.1.20");
  assert.notEqual(a.bloccato("192.168.1.20"), null, "il mucchio di tutti e' pieno");
  a.restituisci(tentativo);
  assert.equal(a.stato().tentativiSbagliati, 999, "il mucchio di tutti torna com'era");
  assert.equal(a.bloccato("192.168.1.20"), null);
});

test("dal centralino senza indirizzo, il tetto del gruppo vale anche per chi comincia", () => {
  const a = new Abbinamento({ adesso: orologio().adesso });
  a.nuovo();
  for (let i = 0; i < 50; i += 1) a.comincia("centralino");
  assert.throws(() => a.comincia("centralino"), TroppiTentativi);
  assert.ok(a.comincia("centralino 93.40.1.2"), "chi dice l'indirizzo e' uno a parte");
});

test("un tentativo restituito dopo un codice nuovo non toglie niente a nessuno", () => {
  const a = new Abbinamento({ adesso: orologio().adesso });
  a.nuovo();
  const vecchio = a.comincia("93.40.1.9");
  a.nuovo();
  a.sbagliato("93.40.1.9");
  a.restituisci(vecchio);
  assert.equal(a.stato().tentativiSbagliati, 1);
});

test("un IPv6 conta per la sua rete /64, non per il singolo indirizzo", () => {
  const a = new Abbinamento({ adesso: orologio().adesso });
  a.nuovo();
  for (let i = 1; i <= 5; i += 1) a.sbagliato(`2001:db8:1:2::${i}`);
  assert.notEqual(a.bloccato("2001:db8:1:2:ffff::9"), null);
  assert.equal(a.bloccato("2001:db8:1:3::1"), null);
});

test("chi bussa da mille posti non riempie la memoria", () => {
  const a = new Abbinamento({ adesso: orologio().adesso });
  a.nuovo();
  for (let i = 0; i < 5000; i += 1) a.sbagliato(`da ${i}`);
  assert.ok(a._perChi.size <= 1000);
});

test("chi fabbrica un codice non paga per chi ha bussato prima", () => {
  const a = new Abbinamento({ adesso: orologio().adesso });
  a.nuovo();
  for (let i = 0; i < 5; i += 1) assert.throws(() => a.consuma("SBAGLIATO"), CodiceSbagliato);
  assert.throws(() => a.consuma("SBAGLIATO"), TroppiTentativi);
  const { codice } = a.nuovo();
  assert.equal(a.stato().tentativiSbagliati, 0);
  assert.ok(a.consuma(codice), "il codice buono non e' entrato");
});

test("senza nessun codice attivo non si entra", () => {
  const a = new Abbinamento({ adesso: orologio().adesso });
  assert.throws(() => a.consuma("QUALUNQUE"), CodiceSbagliato);
});

/* ─── I dispositivi ──────────────────────────────────────────────────────── */

test("un telefono abbinato si riconosce, e il suo segno non torna piu'", () => {
  const c = cartellaFinta();
  try {
    const d = new Dispositivi({ cartella: c.dove });
    const { dispositivo, segno } = d.abbina({ nome: "iPhone di Persona 2", sistema: "ios" });
    assert.equal(dispositivo.nome, "iPhone di Persona 2");
    assert.equal(d.riconosci(segno).id, dispositivo.id);
    assert.equal(d.riconosci("un segno inventato"), null);
    /* Ne' l'elenco ne' il file dicono il segno. */
    assert.equal(JSON.stringify(d.elenco()).includes(segno), false);
    assert.equal(readFileSync(join(c.dove, "dispositivi.json"), "utf8").includes(segno), false);
  } finally {
    c.via();
  }
});

test("nel file c'e' l'impronta, mai il segno", () => {
  const c = cartellaFinta();
  try {
    const d = new Dispositivi({ cartella: c.dove });
    const { segno } = d.abbina({ nome: "Pixel" });
    const scritto = JSON.parse(readFileSync(join(c.dove, "dispositivi.json"), "utf8"));
    assert.equal(scritto.dispositivi[0].impronta, impronta(segno));
  } finally {
    c.via();
  }
});

test("i telefoni restano dopo un riavvio", () => {
  const c = cartellaFinta();
  try {
    const primo = new Dispositivi({ cartella: c.dove });
    const { segno, dispositivo } = primo.abbina({ nome: "Tablet" });
    const dopoIlRiavvio = new Dispositivi({ cartella: c.dove });
    assert.equal(dopoIlRiavvio.riconosci(segno).id, dispositivo.id);
  } finally {
    c.via();
  }
});

test("oltre il numero massimo non se ne abbinano altri", () => {
  const c = cartellaFinta();
  try {
    const d = new Dispositivi({ cartella: c.dove, massimi: 2 });
    d.abbina({ nome: "uno" });
    d.abbina({ nome: "due" });
    assert.throws(() => d.abbina({ nome: "tre" }), TroppiDispositivi);
    assert.equal(d.quanti(), 2);
  } finally {
    c.via();
  }
});

test("staccare un telefono lo spegne subito, e solo quello", () => {
  const c = cartellaFinta();
  try {
    const d = new Dispositivi({ cartella: c.dove });
    const uno = d.abbina({ nome: "uno" });
    const due = d.abbina({ nome: "due" });
    assert.equal(d.stacca(uno.dispositivo.id), true);
    assert.equal(d.riconosci(uno.segno), null);
    assert.equal(d.riconosci(due.segno).id, due.dispositivo.id);
    assert.equal(d.stacca(uno.dispositivo.id), false);
  } finally {
    c.via();
  }
});

test("un telefono sparito da troppo tempo se ne va da solo", () => {
  const c = cartellaFinta();
  try {
    const tempo = orologio();
    const d = new Dispositivi({ cartella: c.dove, giorniDiSilenzio: 90, adesso: tempo.adesso });
    const vecchio = d.abbina({ nome: "vecchio" });
    tempo.avanti(91 * GIORNO);
    const nuovo = d.abbina({ nome: "nuovo" });
    assert.equal(d.potatura(), 1);
    assert.equal(d.riconosci(vecchio.segno), null);
    assert.equal(d.riconosci(nuovo.segno).id, nuovo.dispositivo.id);
  } finally {
    c.via();
  }
});

test("con zero giorni di silenzio non si pota niente", () => {
  const c = cartellaFinta();
  try {
    const tempo = orologio();
    const d = new Dispositivi({ cartella: c.dove, giorniDiSilenzio: 0, adesso: tempo.adesso });
    const uno = d.abbina({ nome: "uno" });
    tempo.avanti(4000 * GIORNO);
    assert.equal(d.potatura(), 0);
    assert.equal(d.riconosci(uno.segno).id, uno.dispositivo.id);
  } finally {
    c.via();
  }
});

test("l'ora dell'ultima visita non finisce sul disco a ogni messaggio", () => {
  const c = cartellaFinta();
  try {
    const tempo = orologio();
    const d = new Dispositivi({ cartella: c.dove, adesso: tempo.adesso });
    const { segno } = d.abbina({ nome: "uno" });
    const percorso = join(c.dove, "dispositivi.json");
    const primaVolta = readFileSync(percorso, "utf8");

    for (let i = 0; i < 200; i += 1) {
      tempo.avanti(500);
      d.riconosci(segno);
    }
    assert.equal(
      readFileSync(percorso, "utf8"),
      primaVolta,
      "cento secondi non bastano a scrivere",
    );

    tempo.avanti(10 * MINUTO);
    d.riconosci(segno);
    assert.notEqual(readFileSync(percorso, "utf8"), primaVolta, "dopo dieci minuti scrive");
  } finally {
    c.via();
  }
});

test("un file rovinato non impedisce al ponte di partire", () => {
  const c = cartellaFinta();
  try {
    writeFileSync(join(c.dove, "dispositivi.json"), "{ questo non e' json", "utf8");
    const d = new Dispositivi({ cartella: c.dove });
    assert.equal(d.quanti(), 0);
    assert.doesNotThrow(() => d.abbina({ nome: "uno" }));
  } finally {
    c.via();
  }
});

test("rinominare cambia il nome e basta", () => {
  const c = cartellaFinta();
  try {
    const d = new Dispositivi({ cartella: c.dove });
    const { dispositivo, segno } = d.abbina({ nome: "uno" });
    assert.equal(d.rinomina(dispositivo.id, "  Telefono   di  Persona 3 "), true);
    assert.equal(d.elenco()[0].nome, "Telefono di Persona 3");
    assert.equal(d.riconosci(segno).id, dispositivo.id);
    assert.equal(d.rinomina("dm_inesistente", "x"), false);
  } finally {
    c.via();
  }
});

/* ─── Il telefono riabbinato stacca se stesso di prima ──────────────────── */

test("riabbinato, il telefono stacca quello di prima col suo vecchio segno", () => {
  const c = cartellaFinta();
  try {
    const d = new Dispositivi({ cartella: c.dove, massimi: 2 });
    const prima = d.abbina({ nome: "Telefono Android", sistema: "android" });
    const dopo = d.abbina({ nome: "Telefono Android", sistema: "android" });
    assert.equal(d.quantiDiCasa(), 2);
    assert.equal(
      d.sostituisci({
        nuovo: dopo.dispositivo.id,
        vecchio: prima.dispositivo.id,
        segno: prima.segno,
      }),
      true,
    );
    assert.equal(d.quantiDiCasa(), 1);
    assert.equal(d.riconosci(prima.segno), null);
    assert.equal(d.riconosci(dopo.segno).id, dopo.dispositivo.id);
    /* Il posto liberato si riusa. */
    d.abbina({ nome: "Tablet" });
    assert.equal(d.quantiDiCasa(), 2);
  } finally {
    c.via();
  }
});

test("senza il segno giusto non si stacca nessuno, e mai se stessi", () => {
  const c = cartellaFinta();
  try {
    const d = new Dispositivi({ cartella: c.dove });
    const altro = d.abbina({ nome: "Telefono di un altro" });
    const io = d.abbina({ nome: "Il mio telefono" });
    const vecchio = altro.dispositivo.id;
    const nuovo = io.dispositivo.id;
    /* Sapere l'identificativo non basta: non e' un segreto. */
    assert.equal(d.sostituisci({ nuovo, vecchio, segno: io.segno }), false);
    assert.equal(d.sostituisci({ nuovo, vecchio, segno: "" }), false);
    assert.equal(d.sostituisci({ nuovo, vecchio, segno: segnoNuovo() }), false);
    assert.equal(d.sostituisci({ nuovo, vecchio }), false);
    /* Ne' se stessi, ne' per conto di un telefono che non c'e'. */
    assert.equal(d.sostituisci({ nuovo, vecchio: nuovo, segno: io.segno }), false);
    assert.equal(d.sostituisci({ nuovo: "dm_nessuno", vecchio, segno: altro.segno }), false);
    assert.equal(d.quantiDiCasa(), 2);
    assert.equal(stessoSegreto(impronta(altro.segno), impronta(altro.segno)), true);
  } finally {
    c.via();
  }
});
