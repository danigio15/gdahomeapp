/* Le prove della cartolina: cosa parte da questa casa, e cosa non ne esce.
 *
 * Quello che si prova davvero, e in quest'ordine di importanza:
 *
 *  1. **che dentro non ci sia niente di chi ci abita.** Non e' una promessa
 *     scritta in un commento: e' una prova che compila una cartolina da una
 *     casa piena di nomi che raccontano una famiglia — la camera di Marco, il
 *     Wi-Fi «Casa Rossi» — e controlla che nel testo spedito non ce ne sia
 *     nemmeno uno. E' la stessa forma della prova che il centralino ha su se
 *     stesso, ed e' li' per lo stesso motivo;
 *  2. **che senza codice non parta niente**, perche' questo e' il caso di
 *     quasi tutte le case del mondo e deve essere quello sicuro;
 *  3. che quello che non si sa resti `null` invece di diventare zero;
 *  4. che la chiave non finisca nel corpo, dove la console la farebbe leggere;
 *  5. che un quadro spento non si prenda una richiesta ogni quarto d'ora da
 *     quaranta case.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CodiceIllegibile,
  CodiceTroppoNuovo,
  compila,
  fabbricaLaCartolina,
  leggiIlCodice,
  ogniQuanto,
  Postino,
} from "../src/cartolina.js";
import { gliAddon, laMacchina, laRete } from "../src/ferro.js";
import { ilBackup, leBatterie, leEntita } from "../src/salute.js";

const ZITTO = { debug() {}, info() {}, attenzione() {}, errore() {} };

/* ─── Il codice del quadro ─────────────────────────────────────────────── */

test("il codice si legge, e dentro ci sono tutte e due le cose che servono", () => {
  const letto = leggiIlCodice("quadro|1|https://quadro.impiantirossi.it/|K7M2-9XQF-3BHT-R4VN");
  assert.deepEqual(letto, {
    dove: "https://quadro.impiantirossi.it",
    chiave: "K7M2-9XQF-3BHT-R4VN",
  });
});

test("una casella vuota non e' un errore: e' il caso normale", () => {
  assert.equal(leggiIlCodice(""), null);
  assert.equal(leggiIlCodice("   "), null);
  assert.equal(leggiIlCodice(null), null);
});

test("su http non si manda: in mezzo c'e' come sta la casa di qualcuno", () => {
  assert.throws(
    () => leggiIlCodice("quadro|1|http://quadro.impiantirossi.it|K7M2-9XQF"),
    CodiceIllegibile,
  );
});

test("un codice di qualcos'altro, o senza chiave, si rifiuta invece di provarci", () => {
  assert.throws(() => leggiIlCodice("gdahome|1|ABC|DEF"), CodiceIllegibile);
  assert.throws(() => leggiIlCodice("quadro|1|https://q.it|corta"), CodiceIllegibile);
  assert.throws(() => leggiIlCodice("quadro|1|non-un-indirizzo|K7M2-9XQF"), CodiceIllegibile);
});

test("un codice piu' nuovo di questo ponte lo dice, invece di leggerne meta'", () => {
  assert.throws(
    () => leggiIlCodice("quadro|2|https://q.it|K7M2-9XQF|e-qualcosa-di-nuovo"),
    CodiceTroppoNuovo,
  );
});

test("ogni quanto sta dentro i suoi limiti, e una sciocchezza torna al difetto", () => {
  assert.equal(ogniQuanto(15), 15);
  assert.equal(ogniQuanto(1), 5, "sotto i cinque minuti si scalda una macchina per niente");
  assert.equal(ogniQuanto(99999), 1440);
  assert.equal(ogniQuanto("boh"), 15);
});

/* ─── Il foglio ────────────────────────────────────────────────────────── */

test("quello che non si sa resta fuori dal foglio, invece di diventare zero", () => {
  const foglio = compila({
    casa: "casa_abc",
    versioni: { ponte: "1.4.32.14" },
    adesso: () => Date.parse("2026-09-18T09:41:12Z"),
  });
  assert.equal(foglio.casa, "casa_abc");
  assert.equal(foglio.quando, "2026-09-18T09:41:12.000Z");
  assert.equal(foglio.ponte, "1.4.32.14");
  /* Una casa di cui non si e' saputo niente non ha la macchina a zero: non ce
   * l'ha, e il quadro lo dice con quelle parole. */
  assert.ok(!("macchina" in foglio));
  assert.ok(!("rete" in foglio));
  assert.ok(!("addon" in foglio));
});

test("gli apparati di casa stanno dentro la rete, dove li cerca chi legge", () => {
  const foglio = compila({
    casa: "casa_abc",
    rete: { internet: true, schede: [] },
    apparati: { quante: 3, giu: 1 },
  });
  assert.deepEqual(foglio.rete.sorvegliate, { quante: 3, giu: 1 });
});

test("senza rete, gli apparati non si appiccicano a niente", () => {
  const foglio = compila({ casa: "casa_abc", apparati: { quante: 3, giu: 1 } });
  assert.ok(!("rete" in foglio));
});

/* ─── La prova che conta ───────────────────────────────────────────────── */

test("dalla cartolina non esce niente di chi ci abita", () => {
  /* Una casa vera: i nomi delle entita' raccontano una famiglia, le stanze e
   * gli orari. Nessuna di queste parole deve comparire nel testo spedito. */
  const stati = [
    { entity_id: "binary_sensor.camera_di_marco_finestra", state: "unavailable", attributes: {} },
    { entity_id: "device_tracker.telefono_di_laura", state: "home", attributes: {} },
    {
      entity_id: "sensor.serratura_ingresso_batteria",
      state: "12",
      attributes: { device_class: "battery", unit_of_measurement: "%" },
    },
    {
      entity_id: "camera.cameretta",
      state: "recording",
      attributes: { friendly_name: "Cameretta" },
    },
    { entity_id: "person.giovanni_rossi", state: "not_home", attributes: {} },
    {
      entity_id: "sensor.backup_last_successful_automatic_backup",
      state: "2026-09-16T03:00:00Z",
      attributes: {},
    },
  ];
  const network = {
    interfaces: [
      {
        interface: "wlan0",
        type: "wireless",
        connected: true,
        primary: true,
        ipv4: { address: ["192.168.1.50/24"] },
        wifi: { ssid: "Casa Rossi", signal: 71 },
      },
    ],
  };

  const foglio = compila({
    casa: "casa_a3f19c74e05b2d8890fa4c1e6b73d052",
    versioni: { ponte: "1.4.32.14", ha: "2026.9.1" },
    macchina: laMacchina({
      os: { board: "odroid-n2" },
      host: { disk_total: 32, disk_used: 15 },
      stati,
    }),
    rete: laRete({ network, filoSu: true }),
    addon: gliAddon({ addons: [{ name: "Mosquitto broker", state: "started", boot: "auto" }] }),
    entita: leEntita(stati, { sale: "il-sale-di-questa-casa" }),
    batterie: leBatterie(stati),
    backup: ilBackup(stati, { adesso: () => Date.parse("2026-09-18T09:00:00Z") }),
  });

  const spedito = JSON.stringify(foglio);
  const maiPiu = [
    "marco",
    "laura",
    "giovanni",
    "rossi",
    "cameretta",
    "camera_di",
    "serratura",
    "ingresso",
    "Casa Rossi",
    "binary_sensor",
    "device_tracker",
    "person.",
    "camera.",
    "ssid",
  ];
  for (const parola of maiPiu) {
    assert.ok(
      !spedito.toLowerCase().includes(parola.toLowerCase()),
      `«${parola}» non deve uscire da questa casa, e sta nella cartolina`,
    );
  }

  /* E quello che serve c'e' lo stesso: la spia suona, senza dire su cosa. */
  assert.equal(foglio.entita.sparite, 1);
  assert.equal(foglio.entita.impronte.length, 1);
  assert.equal(foglio.batterie.scariche, 1);
  assert.equal(foglio.backup.giorniFa, 2);
  assert.equal(foglio.rete.schede[0].ip, "192.168.1.50");
});

/* ─── Il postino ───────────────────────────────────────────────────────── */

test("senza codice non parte niente e non si apre nessuna connessione", async () => {
  let bussato = 0;
  const postino = new Postino({
    fabbrica: () => ({}),
    registro: ZITTO,
    fetch: async () => {
      bussato += 1;
      return { ok: true };
    },
  });
  assert.equal(postino.acceso, false);
  postino.parti();
  assert.equal(await postino.manda(), false);
  assert.equal(bussato, 0);
});

test("la chiave viaggia in testa e non nel corpo, che la console fa leggere", async () => {
  let vista = null;
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "una-chiave-segretissima",
    casa: "casa_abc",
    fabbrica: () => ({ casa: "casa_abc", ponte: "1.4.32.14" }),
    registro: ZITTO,
    fetch: async (dove, come) => {
      vista = { dove, come };
      return { ok: true };
    },
  });
  assert.equal(await postino.manda(), true);
  assert.equal(vista.dove, "https://quadro.it/cartolina");
  assert.equal(vista.come.headers.authorization, "Bearer una-chiave-segretissima");
  assert.ok(!vista.come.body.includes("segretissima"));
  /* E quello che la console fa leggere e' esattamente quello che e' partito. */
  assert.deepEqual(postino.ultima, { casa: "casa_abc", ponte: "1.4.32.14" });
  assert.equal(postino.ultimoEsito.andata, true);
});

test("un quadro spento si dice una volta, e poi si rallenta invece di insistere", async () => {
  const dette = [];
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "chiave-lunga-abbastanza",
    casa: "casa_abc",
    fabbrica: () => ({}),
    registro: { ...ZITTO, attenzione: (riga) => dette.push(riga) },
    fetch: async () => {
      throw new Error("connessione rifiutata");
    },
  });
  for (let i = 0; i < 5; i += 1) assert.equal(await postino.manda(), false);
  /* Novantasei righe uguali al giorno sono un registro che non si legge
   * piu': si dice la prima volta. */
  assert.equal(dette.length, 1);
  assert.match(dette[0], /non arriva/);
  assert.equal(postino.ultimoEsito.andata, false);
});

test("una cartolina che non si compila non e' colpa del quadro, e non lo rallenta", async () => {
  let bussato = 0;
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "chiave-lunga-abbastanza",
    casa: "casa_abc",
    fabbrica: () => {
      throw new Error("Home Assistant non risponde");
    },
    registro: ZITTO,
    fetch: async () => {
      bussato += 1;
      return { ok: true };
    },
  });
  assert.equal(await postino.manda(), false);
  assert.equal(bussato, 0, "non si va a bussare con niente in mano");
  assert.match(postino.ultimoEsito.perche, /Home Assistant/);
});

test("quando il quadro torna, si torna al passo normale", async () => {
  const dette = [];
  let risponde = false;
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "chiave-lunga-abbastanza",
    casa: "casa_abc",
    fabbrica: () => ({}),
    registro: { ...ZITTO, info: (riga) => dette.push(riga) },
    fetch: async () => ({ ok: risponde, status: 502 }),
  });
  await postino.manda();
  risponde = true;
  assert.equal(await postino.manda(), true);
  assert.ok(dette.some((riga) => /risponde di nuovo/.test(riga)));
});

/* ─── La fabbrica: da dove viene ogni numero ───────────────────────────── */

const ferroFinto = (detto) => ({ chiedi: async () => detto });

test("la fabbrica mette insieme quello che c'e', e chiama ogni volta", async () => {
  let giri = 0;
  const fabbrica = fabbricaLaCartolina({
    identita: { casa: "casa_abc", sale: "sale" },
    casa: {
      chiedi: async () => {
        giri += 1;
        return [{ entity_id: "sensor.uno", state: "unavailable", attributes: {} }];
      },
    },
    ferro: ferroFinto({
      os: { board: "odroid-n2", version: "14.2" },
      host: { disk_total: 32, disk_used: 16 },
      network: { interfaces: [{ interface: "eth0", type: "ethernet", connected: true }] },
      addons: [{ name: "gdahome", state: "started", boot: "auto" }],
      core: { version: "2026.9.1" },
      supervisor: { version: "2026.08.3" },
    }),
    chiamata: { dove: "wss://tramite", accesa: true },
    versioni: { ponte: "1.4.32.14", plancia: "1.4.32" },
    registro: ZITTO,
    adesso: () => Date.parse("2026-09-18T09:41:12Z"),
  });

  const foglio = await fabbrica();
  assert.equal(foglio.casa, "casa_abc");
  assert.equal(foglio.ha, "2026.9.1");
  assert.equal(foglio.supervisor, "2026.08.3");
  assert.equal(foglio.sistema, "Home Assistant OS 14.2");
  assert.equal(foglio.macchina.scheda, "ODROID-N2");
  assert.equal(foglio.rete.internet, true);
  assert.equal(foglio.addon.quanti, 1);
  assert.equal(foglio.entita.sparite, 1);
  assert.deepEqual(foglio.fuori, { acceso: true, filo: true });

  /* Ogni cartolina e' di adesso, non di quando il ponte si e' acceso. */
  await fabbrica();
  assert.equal(giri, 2);
});

test("mezza cartolina e' meglio di nessuna, e quel giorno e' la piu' importante", async () => {
  const fabbrica = fabbricaLaCartolina({
    identita: { casa: "casa_abc", sale: "sale" },
    /* Home Assistant giu': e' esattamente il giorno in cui l'installatore deve
     * ricevere qualcosa. */
    casa: {
      chiedi: async () => {
        throw new Error("il filo e' caduto");
      },
    },
    ferro: ferroFinto({ os: { board: "odroid-n2" }, host: {}, network: null, addons: [] }),
    registro: ZITTO,
  });

  const foglio = await fabbrica();
  assert.equal(foglio.casa, "casa_abc");
  assert.equal(foglio.macchina.scheda, "ODROID-N2");
  /* Quello che dipendeva dagli stati non c'e', e non c'e' a zero. */
  assert.ok(!("entita" in foglio));
  assert.ok(!("batterie" in foglio));
  assert.ok(!("rete" in foglio));
});

test("gli aggiornamenti si contano per razza, e il firmware si vede a parte", async () => {
  const fabbrica = fabbricaLaCartolina({
    identita: { casa: "casa_abc", sale: "s" },
    casa: { chiedi: async () => [] },
    ferro: ferroFinto(null),
    aggiornamenti: {
      elenco: async () => [
        {
          nome: "gdahome",
          da: "1.4.32.9",
          a: "1.4.32.14",
          nostra: true,
          installabile: true,
          stacca: true,
        },
        {
          nome: "Home Assistant Core",
          da: "2026.6.2",
          a: "2026.9.1",
          installabile: true,
          stacca: true,
        },
        { nome: "Mosquitto broker", da: "6.4.0", a: "6.5.1", installabile: true },
        /* Un firmware che si porta col cacciavite: contato, e senza tasto. */
        { nome: "Termostato camera", da: "1.9", a: "2.0", installabile: false },
      ],
    },
    registro: ZITTO,
  });

  const foglio = await fabbrica();
  assert.equal(foglio.aggiornamenti.quanti, 4);
  assert.equal(foglio.aggiornamenti.gdahome, true);
  assert.equal(foglio.aggiornamenti.ha, true);
  assert.equal(foglio.aggiornamenti.addon, 1);
  assert.equal(foglio.aggiornamenti.firmware, 1);
  assert.equal(foglio.aggiornamenti.elenco.length, 4);
});

test("i telefoni: conta di piu' quanti si sono visti che quanti sono abbinati", async () => {
  const adesso = Date.parse("2026-09-18T09:00:00Z");
  const giorni = (quanti) => adesso - quanti * 24 * 60 * 60 * 1000;
  const fabbrica = fabbricaLaCartolina({
    identita: { casa: "casa_abc", sale: "s" },
    casa: { chiedi: async () => [] },
    ferro: ferroFinto(null),
    dispositivi: {
      elenco: () => [{ vistoIl: giorni(1) }, { vistoIl: giorni(3) }, { vistoIl: giorni(40) }],
    },
    registro: ZITTO,
    adesso: () => adesso,
  });
  const foglio = await fabbrica();
  assert.deepEqual(foglio.telefoni, { abbinati: 3, visti7gg: 2 });
});
