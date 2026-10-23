/* Il mini video del movimento: cinque secondi prima e cinque dopo.
 *
 * Dal tester: «per le telecamere si riesce a fare un mini video, tipo cinque
 * secondi prima del rilevamento e cinque secondi dopo?». Per tutte le
 * telecamere, anche senza flusso video: il ponte tiene gli ultimi secondi di
 * istantanee e ci aggiunge quelli dopo. E con un'opzione, spenta di serie.
 * Sul disco il video e' chiuso con una chiave che ha solo la notifica; si da'
 * solo a chi e' entrato con un utente attivo, e solo della telecamera che
 * quell'utente puo' vedere. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chiaveBuona, DOPO, Filmati, idBuono, OGNI, PRIMA } from "../src/i-filmati.js";
import { esempioDi, Notifiche } from "../src/notifiche.js";
import { CONTENUTO_MASSIMO } from "../src/spinta.js";

/* Un orologio finto: `aspetta` mette in fila, `avanza` fa passare il tempo
 * a piccoli passi e sveglia chi deve. */
function unOrologio(inizio = 1_761_121_500_000) {
  let ora = inizio;
  const fila = [];
  const giro = () => new Promise((fatto) => setImmediate(fatto));
  return {
    adesso: () => ora,
    aspetta: (ms) => new Promise((fatto) => fila.push({ alle: ora + ms, fatto })),
    async avanza(ms) {
      const fine = ora + ms;
      while (ora < fine) {
        ora = Math.min(fine, ora + 50);
        for (const uno of fila.filter((u) => u.alle <= ora)) {
          fila.splice(fila.indexOf(uno), 1);
          uno.fatto();
        }
        await giro();
        await giro();
      }
    },
  };
}

function unBanco() {
  const cartella = mkdtempSync(join(tmpdir(), "mini-video-"));
  const orologio = unOrologio();
  const chieste = [];
  const filmati = new Filmati({
    cartella,
    casa: {
      immagine: async (percorso) => {
        chieste.push(percorso);
        return Buffer.from(`fotogramma ${orologio.adesso()}`);
      },
    },
    adesso: orologio.adesso,
    aspetta: orologio.aspetta,
    acaso: () => "abcdef123456",
  });
  return {
    cartella,
    orologio,
    chieste,
    filmati,
    via: () => {
      filmati.ferma();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

test("una telecamera tenuta in memoria da' il prima e il dopo", async () => {
  const { cartella, orologio, chieste, filmati, via } = unBanco();
  try {
    filmati.sorveglia(["camera.ingresso"]);
    assert.deepEqual(filmati.sorvegliate(), ["camera.ingresso"]);
    await orologio.avanza(8000);
    assert.equal(chieste[0], "camera_proxy/camera.ingresso?width=640");
    const quando = orologio.adesso();
    const { id, chiave } = filmati.registra("camera.ingresso", quando);
    assert.equal(id, `${quando}-abcdef123456`);
    assert.ok(idBuono(id));
    assert.ok(chiaveBuona(chiave));
    const letto = filmati.leggi(id, chiave);
    await orologio.avanza(DOPO + 1000);
    const video = await letto;
    assert.equal(video.camera, "camera.ingresso");
    assert.equal(video.quando, quando);
    const tempi = video.fotogrammi.map((f) => f.t);
    assert.ok(tempi[0] < -PRIMA + OGNI * 2, `il primo e' a ${tempi[0]}`);
    assert.ok(tempi.at(-1) > DOPO - OGNI * 2, `l'ultimo e' a ${tempi.at(-1)}`);
    assert.ok(tempi.every((t) => t >= -PRIMA && t <= DOPO));
    assert.ok(video.fotogrammi.length >= 18, `${video.fotogrammi.length} fotogrammi`);
    assert.match(Buffer.from(video.fotogrammi[0].jpeg, "base64").toString(), /^fotogramma /);
    /* Sul disco e' chiuso: senza la chiave della notifica non si legge,
     * nemmeno dal ponte. */
    const dove = join(cartella, "filmati");
    assert.equal(statSync(dove).mode & 0o777, 0o700);
    assert.deepEqual(readdirSync(dove), [`${id}.gdaf`]);
    assert.equal(statSync(join(dove, `${id}.gdaf`)).mode & 0o777, 0o600);
    const sulDisco = readFileSync(join(dove, `${id}.gdaf`));
    assert.equal(sulDisco.includes("camera.ingresso"), false);
    assert.equal(sulDisco.includes("fotogramma"), false);
    assert.equal(sulDisco.includes(video.fotogrammi[0].jpeg.slice(0, 12)), false);
    assert.equal(await filmati.leggi(id, Buffer.alloc(32, 7).toString("base64url")), null);
    assert.equal(await filmati.leggi(id, undefined), null);
    /* Un video rinominato non si apre nemmeno con la sua chiave. */
    writeFileSync(join(dove, "1761121599999-zzzz.gdaf"), sulDisco);
    assert.equal(await filmati.leggi("1761121599999-zzzz", chiave), null);
    assert.ok(await filmati.leggi(id, chiave));
  } finally {
    via();
  }
});

test("in memoria resta solo il prima che serve", async () => {
  const { orologio, filmati, via } = unBanco();
  try {
    filmati.sorveglia(["camera.ingresso"]);
    await orologio.avanza(60_000);
    const memoria = filmati._memorie.get("camera.ingresso");
    assert.ok(memoria.fotogrammi.length <= (PRIMA + OGNI) / OGNI + 2);
  } finally {
    via();
  }
});

test("una telecamera non tenuta in memoria registra solo il dopo, poi si ferma", async () => {
  const { orologio, filmati, via } = unBanco();
  try {
    const quando = orologio.adesso();
    const { id, chiave } = filmati.registra("camera.giardino", quando);
    const letto = filmati.leggi(id, chiave);
    await orologio.avanza(DOPO + 1000);
    const video = await letto;
    assert.ok(video.fotogrammi.length > 5);
    assert.ok(video.fotogrammi.every((f) => f.t >= 0));
    assert.deepEqual(filmati.sorvegliate(), []);
    await orologio.avanza(2000);
    assert.equal(filmati._memorie.has("camera.giardino"), false);
  } finally {
    via();
  }
});

/* «Sì ma con una telecamera l'altra no.» Una telecamera 4K manda
 * l'istantanea intera, a qualunque larghezza la si chieda: prima ogni
 * fotogramma si saltava, e il video di quella telecamera non c'era mai. */
test("una telecamera che manda istantanee enormi da' il video lo stesso, rimpicciolito", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "mini-video-"));
  const orologio = unOrologio();
  const rimpiccioliti = [];
  const filmati = new Filmati({
    cartella,
    casa: { immagine: async () => Buffer.alloc(1_500_000, 7) },
    adesso: orologio.adesso,
    aspetta: orologio.aspetta,
    acaso: () => "abcdef123456",
    rimpicciolisci: async (byte, opzioni) => {
      rimpiccioliti.push({ peso: byte.length, ...opzioni });
      return Buffer.from("piccolo");
    },
  });
  try {
    filmati.sorveglia(["camera.balconi"]);
    await orologio.avanza(6000);
    const quando = orologio.adesso();
    const { id, chiave } = filmati.registra("camera.balconi", quando);
    const letto = filmati.leggi(id, chiave);
    await orologio.avanza(DOPO + 1000);
    const video = await letto;
    assert.ok(video, "il video c'e'");
    assert.ok(video.fotogrammi.length > 10);
    assert.ok(
      video.fotogrammi.some((f) => f.t < 0),
      "c'e' anche il prima",
    );
    assert.equal(Buffer.from(video.fotogrammi[0].jpeg, "base64").toString(), "piccolo");
    assert.equal(rimpiccioliti[0].peso, 1_500_000);
    assert.deepEqual(rimpiccioliti[0].larghezze, [640, 480]);
    assert.ok(rimpiccioliti[0].massimo <= 400 * 1024);
  } finally {
    filmati.ferma();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("se non si riesce a rimpicciolire, il fotogramma enorme si salta come prima", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "mini-video-"));
  const orologio = unOrologio();
  const filmati = new Filmati({
    cartella,
    casa: { immagine: async () => Buffer.alloc(1_500_000, 7) },
    adesso: orologio.adesso,
    aspetta: orologio.aspetta,
    rimpicciolisci: async () => null,
  });
  try {
    filmati.sorveglia(["camera.balconi"]);
    await orologio.avanza(3000);
    assert.equal(filmati._memorie.get("camera.balconi").fotogrammi.length, 0);
  } finally {
    filmati.ferma();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("togliere una telecamera dalla sorveglianza la ferma", async () => {
  const { orologio, chieste, filmati, via } = unBanco();
  try {
    filmati.sorveglia(["camera.ingresso", "non una telecamera", "camera.x/../y"]);
    assert.deepEqual(filmati.sorvegliate(), ["camera.ingresso"]);
    await orologio.avanza(2000);
    filmati.sorveglia([]);
    await orologio.avanza(1000);
    const prima = chieste.length;
    await orologio.avanza(5000);
    assert.equal(chieste.length, prima);
  } finally {
    via();
  }
});

test("un id che non e' di un video non apre niente", async () => {
  const { filmati, via } = unBanco();
  try {
    for (const id of ["../../etc/passwd", "1761121500000-../x", "", null, "abc", "1761121500000-A"])
      assert.equal(await filmati.leggi(id, "a".repeat(43)), null, String(id));
    assert.equal(filmati.registra("../segreti", 1), null);
  } finally {
    via();
  }
});

test("i video piu' vecchi di tre giorni, e oltre i duecento, si cancellano", () => {
  const { cartella, orologio, via } = unBanco();
  try {
    const dove = join(cartella, "filmati");
    mkdirSync(dove, { recursive: true });
    const ora = orologio.adesso() + 10 * 24 * 3600 * 1000;
    const vecchio = `${ora - 4 * 24 * 3600 * 1000}-aaaa`;
    writeFileSync(join(dove, `${vecchio}.gdaf`), "x");
    for (let i = 0; i < 205; i++) writeFileSync(join(dove, `${ora - i * 1000}-bbbb.gdaf`), "x");
    new Filmati({ cartella, adesso: () => ora }).pulisci();
    assert.equal(existsSync(join(dove, `${vecchio}.gdaf`)), false);
    assert.equal(existsSync(join(dove, `${ora}-bbbb.gdaf`)), true);
    assert.equal(existsSync(join(dove, `${ora - 204 * 1000}-bbbb.gdaf`)), false);
  } finally {
    via();
  }
});

/* Il comando del telefono. */
const ID = "1761121500000-abcdef";
const CHIAVE = Buffer.alloc(32, 3).toString("base64url");
const FILM = { id: ID, chiave: CHIAVE };
const U1 = { id: "tel1", utente: "u1" };
const VUOTO = "1761121500000-fedcba";

function unaCasaColVideo({ premium = true, chiuse = [], utenti = null } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "mini-video-ponte-"));
  const video = {
    v: 1,
    camera: "camera.ingresso",
    quando: 1_761_121_500_000,
    fotogrammi: [{ t: -500, jpeg: "AAAA" }],
  };
  const notifiche = new Notifiche({
    cartella,
    casa: { chiedi: async () => [], ascolta: async () => () => {}, immagine: async () => null },
    registro: { info() {}, debug() {}, errore() {}, attenzione() {} },
    licenze: { attive: true, premium },
    utenti: { elenco: async () => utenti ?? [{ id: "u1" }] },
    commissioni: { telecamereChiuse: () => new Set(chiuse) },
    filmati: {
      leggi: async (id, chiave) => (id === ID && chiave === CHIAVE ? video : null),
      vuoto: (id) =>
        id === VUOTO ? { camera: "camera.ingresso", perche: "troppo-pesanti" } : null,
      sorveglia() {},
      ferma() {},
    },
    adesso: () => 1_761_121_500_000,
  });
  return { notifiche, via: () => rmSync(cartella, { recursive: true, force: true }) };
}

const chiedi = (notifiche, film, dispositivo) =>
  notifiche.rispondi({ id: 3, type: "ponte/notifiche/filmato", film }, { dispositivo });

test("il video va a chi e' entrato con un utente che vede la telecamera", async () => {
  const { notifiche, via } = unaCasaColVideo();
  try {
    const detto = await chiedi(notifiche, FILM, U1);
    assert.equal(detto.success, true);
    assert.equal(detto.result.camera, "camera.ingresso");
    assert.deepEqual(detto.result.fotogrammi, [{ t: -500, jpeg: "AAAA" }]);
  } finally {
    via();
  }
});

test("senza utente, spento, senza Premium, senza chiave, telecamera chiusa: niente", async () => {
  const altraChiave = Buffer.alloc(32, 9).toString("base64url");
  const casi = [
    [{}, FILM, { id: "tel1" }, "unauthorized"],
    [{}, FILM, undefined, "unauthorized"],
    [{ utenti: [{ id: "u1", attivo: false }] }, FILM, U1, "unauthorized"],
    [{ utenti: [{ id: "altro" }] }, FILM, U1, "unauthorized"],
    [{ premium: false }, FILM, U1, "premium-richiesto"],
    [{}, { id: "../../config", chiave: CHIAVE }, U1, "invalid_format"],
    [{}, { id: ID }, U1, "invalid_format"],
    [{}, ID, U1, "invalid_format"],
    [{}, { id: ID, chiave: altraChiave }, U1, "not_found"],
    [{ chiuse: ["camera.ingresso"] }, FILM, U1, "not_found"],
  ];
  for (const [casa, film, dispositivo, codice] of casi) {
    const { notifiche, via } = unaCasaColVideo(casa);
    try {
      const detto = await chiedi(notifiche, film, dispositivo);
      const caso = JSON.stringify([casa, film]);
      assert.equal(detto.success, false, caso);
      assert.equal(detto.error.code, codice, caso);
      assert.equal(JSON.stringify(detto).includes("AAAA"), false);
    } finally {
      via();
    }
  }
});

test("l'opzione e' spenta di serie e si accende dalla voce del movimento", async () => {
  const { notifiche, via } = unaCasaColVideo();
  try {
    const prima = await notifiche.rispondi(
      { id: 1, type: "ponte/notifiche/imposta", impostazioni: {} },
      { dispositivo: U1 },
    );
    assert.equal(prima.result.impostazioni.su?.movimento?.video ?? false, false);
    const dopo = await notifiche.rispondi(
      {
        id: 2,
        type: "ponte/notifiche/imposta",
        impostazioni: { su: { movimento: { video: true } } },
      },
      { dispositivo: U1 },
    );
    assert.equal(dopo.result.impostazioni.su.movimento.video, true);
  } finally {
    via();
  }
});

test("si tengono in memoria solo le telecamere di chi ha acceso l'opzione, e che vede", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "mini-video-quali-"));
  const sorvegliate = [];
  try {
    const notifiche = new Notifiche({
      cartella,
      casa: { chiedi: async () => [], ascolta: async () => () => {}, immagine: async () => null },
      registro: { info() {}, debug() {}, errore() {}, attenzione() {} },
      licenze: { attive: true, premium: true },
      dispositivi: {
        elenco: () => [
          { id: "tel1", utente: "u1" },
          { id: "tel2", utente: "u2" },
        ],
      },
      utenti: { elenco: async () => [{ id: "u1" }, { id: "u2" }] },
      commissioni: {
        telecamereChiuse: (utente) => new Set(utente === "u1" ? ["camera.segreta"] : []),
      },
      filmati: { sorveglia: (volute) => sorvegliate.push([...volute].sort()), ferma() {} },
      adesso: () => 1_761_121_500_000,
    });
    notifiche.sentinella.carica(
      ["camera.ingresso", "camera.segreta", "camera.giardino"].map((entity_id) => ({
        entity_id,
        state: "idle",
        attributes: {},
      })),
    );
    notifiche.archivio.dati.telefoni.tel1 = { gettone: "g1", impostazioni: {} };
    notifiche.archivio.dati.telefoni.tel2 = { gettone: "g2", impostazioni: {} };
    /* Spenta da tutti: nessuna. */
    await notifiche._leTelecamereDaTenere();
    assert.deepEqual(sorvegliate.at(-1), []);
    /* Accesa sul primo telefono, senza scelte: tutte quelle che il suo utente vede. */
    await notifiche.rispondi(
      {
        id: 1,
        type: "ponte/notifiche/imposta",
        impostazioni: { su: { movimento: { video: true } } },
      },
      { dispositivo: { id: "tel1", utente: "u1" } },
    );
    await notifiche._leTelecamereDaTenere();
    assert.deepEqual(sorvegliate.at(-1), ["camera.giardino", "camera.ingresso"]);
    /* Senza Premium, nessuna. */
    notifiche.licenze.premium = false;
    await notifiche._leTelecamereDaTenere();
    assert.deepEqual(sorvegliate.at(-1), []);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("la notifica del movimento porta numero e chiave del video, e ci sta ancora", () => {
  const { notifiche, via } = unaCasaColVideo();
  try {
    const evento = esempioDi("movimento", 1_761_121_500_000);
    const con = notifiche._contenuto(evento, "it", {
      camera: "camera.ingresso",
      stile: "elaborata",
      foto: { id: "f".repeat(40), t: "image/jpeg" },
      film: FILM,
    });
    assert.deepEqual(con.film, FILM);
    assert.ok(JSON.stringify(con).length < CONTENUTO_MASSIMO - 200);
    const senza = notifiche._contenuto(evento, "it", { camera: "camera.ingresso" });
    assert.equal("film" in senza, false);
  } finally {
    via();
  }
});

/* «Il video di questo movimento non c'è più», sei minuti dopo: il video non
 * c'era mai stato, la telecamera non aveva dato immagini. Lo si dice per
 * quello che e', e nel registro coi numeri. */
test("un video rimasto senza fotogrammi si dice vuoto, col perche', e finisce nel registro", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "mini-video-"));
  const orologio = unOrologio();
  const detto = [];
  const filmati = new Filmati({
    cartella,
    casa: { immagine: async () => null },
    registro: { info() {}, debug() {}, errore() {}, attenzione: (r) => detto.push(r) },
    adesso: orologio.adesso,
    aspetta: orologio.aspetta,
    acaso: () => "abcdef123456",
  });
  try {
    const quando = orologio.adesso();
    const { id, chiave } = filmati.registra("camera.ingresso", quando);
    const letto = filmati.leggi(id, chiave);
    await orologio.avanza(DOPO + 1000);
    assert.equal(await letto, null);
    assert.deepEqual(filmati.vuoto(id), { camera: "camera.ingresso", perche: "nessuna-immagine" });
    assert.equal(filmati.vuoto("1761121500000-zzzzzz"), null);
    assert.match(detto.at(-1), /mini video vuoto \(camera\.ingresso\).*0 istantanee buone su \d+/);
  } finally {
    filmati.ferma();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("al telefono il video vuoto arriva come «filmato-vuoto», solo a chi vede la telecamera", async () => {
  const { notifiche, via } = unaCasaColVideo();
  try {
    const detto = await chiedi(notifiche, { id: VUOTO, chiave: CHIAVE }, U1);
    assert.equal(detto.success, false);
    assert.equal(detto.error.code, "filmato-vuoto");
    assert.equal(detto.error.message, "troppo-pesanti");
  } finally {
    via();
  }
  const chiusa = unaCasaColVideo({ chiuse: ["camera.ingresso"] });
  try {
    const detto = await chiedi(chiusa.notifiche, { id: VUOTO, chiave: CHIAVE }, U1);
    assert.equal(detto.error.code, "not_found");
  } finally {
    chiusa.via();
  }
});
