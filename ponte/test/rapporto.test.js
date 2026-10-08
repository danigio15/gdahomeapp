/* Le prove del rapporto: cosa parte da questa casa, e cosa non ne esce.
 *
 * Quello che si prova davvero, e in quest'ordine di importanza:
 *
 *  1. **che dentro non ci sia niente di chi ci abita.** Non e' una promessa
 *     scritta in un commento: e' una prova che compila un rapporto da una
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
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CodiceIllegibile,
  compila,
  fabbricaIlRapporto,
  leggiIlCodice,
  ogniQuanto,
  perchePreciso,
  Postino,
  secondiDiFreno,
} from "../src/rapporto.js";
import { gliAddon, laMacchina, laRete } from "../src/ferro.js";
import { ilBackup, leBatterie, leEntita } from "../src/salute.js";
import { Aggiornamenti } from "../src/aggiornamenti.js";
import { ilSegnoDi } from "../src/segni.js";

const ZITTO = { debug() {}, info() {}, attenzione() {}, errore() {} };

/* ─── Il codice del quadro ─────────────────────────────────────────────── */

test("il codice e' solo il codice: l'indirizzo lo sa il programma", () => {
  /* Prima ci voleva una riga con dentro anche l'indirizzo. Adesso il quadro e'
   * uno solo e sta su una macchina di gdahome: chi installa incolla venti
   * caratteri e ha finito. */
  const letto = leggiIlCodice("K7M2-9XQF-3BHT-R4VN");
  assert.equal(letto.chiave, "K7M2-9XQF-3BHT-R4VN");
  assert.match(letto.dove, /^https:\/\//);
});

test("una casella vuota non e' un errore: e' il caso normale", () => {
  assert.equal(leggiIlCodice(""), null);
  assert.equal(leggiIlCodice("   "), null);
  assert.equal(leggiIlCodice(null), null);
});

test("chi incolla la riga vecchia si sente dire quale pezzo serve", () => {
  /* Un «codice non valido» lo manderebbe a rigenerarlo cinque volte. Il codice
   * che ha in mano va benissimo: e' il resto della riga che e' di troppo. */
  assert.throws(
    () => leggiIlCodice("quadro|2|https://quadro.impiantirossi.it|K7M2-9XQF-3BHT-R4VN"),
    (male) => male instanceof CodiceIllegibile && /solo il codice/.test(male.message),
  );
  assert.throws(
    () => leggiIlCodice("https://quadro.impiantirossi.it"),
    (male) => male instanceof CodiceIllegibile && /non un indirizzo/.test(male.message),
  );
});

test("quello che non e' un codice si rifiuta invece di provarci", () => {
  assert.throws(() => leggiIlCodice("corto"), CodiceIllegibile);
  assert.throws(() => leggiIlCodice("ABCD-EF!!-1234-5678"), CodiceIllegibile);
});

test("i trattini non contano, e il codice resta com'e' stato scritto", () => {
  /* A confrontarlo e' il quadro, che li toglie da tutt'e due le parti: qui non
   * si riscrive quello che l'installatore ha incollato. */
  assert.equal(leggiIlCodice("k7m29xqf3bhtr4vn").chiave, "k7m29xqf3bhtr4vn");
  assert.equal(leggiIlCodice("  K7M2-9XQF-3BHT-R4VN  ").chiave, "K7M2-9XQF-3BHT-R4VN");
});

test("ogni quanto sta dentro i suoi limiti, e una sciocchezza torna al difetto", () => {
  assert.equal(ogniQuanto(15), 15);
  assert.equal(
    ogniQuanto(1),
    1,
    "il minuto e' il passo di serie, non una sciocchezza da correggere",
  );
  assert.equal(ogniQuanto(0.4), 1, "sotto il minuto non si scende");
  assert.equal(ogniQuanto(-30), 1, "e un numero all'indietro nemmeno");
  assert.equal(ogniQuanto(99999), 1440);
  assert.equal(ogniQuanto("boh"), 1);
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

test("dal rapporto esce il nome di cio' che non risponde, e nient'altro di casa", () => {
  /* Una casa vera: i nomi raccontano una famiglia, le stanze e gli orari.
   *
   * Di tutta questa roba ne esce **una**: il dispositivo che in questo
   * momento non risponde. E' una scelta, ed e' costata la promessa di prima
   * — «nessun nome, punto» — perche' quella promessa la manteneva un elenco
   * di codici `#00a7` davanti al quale chi ha montato l'impianto telefonava
   * a chi ci abita per farsi leggere i nomi. Il prezzo sta scritto nella
   * casella dell'add-on prima che qualcuno incolli il codice.
   *
   * Quello che questa prova tiene fermo e' il **confine**: uno che non
   * risponde esce, tutti gli altri no. */
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
  const registri = {
    dispositivi: [
      { id: "d1", name: "Contatto finestra", name_by_user: "Finestra camera di Marco" },
      { id: "d2", name: "Telefono di Laura" },
      { id: "d3", name: "Serratura ingresso" },
      { id: "d4", name: "Cameretta" },
    ],
    entita: [
      { entity_id: "binary_sensor.camera_di_marco_finestra", device_id: "d1" },
      { entity_id: "device_tracker.telefono_di_laura", device_id: "d2" },
      { entity_id: "sensor.serratura_ingresso_batteria", device_id: "d3" },
      { entity_id: "camera.cameretta", device_id: "d4" },
    ],
  };
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
    entita: leEntita(stati, { registri }),
    batterie: leBatterie(stati),
    backup: ilBackup(stati, { adesso: () => Date.parse("2026-09-18T09:00:00Z") }),
  });

  const spedito = JSON.stringify(foglio);

  /* Quello che esce, e che e' tutto il motivo per cui il quadro serve a
   * qualcosa: chi deve venire sa **cosa** e' giu'. */
  assert.deepEqual(foglio.entita.nomi, ["Finestra camera di Marco"]);

  /* E il confine: gli altri tre dispositivi rispondono, e di loro nel
   * rapporto non c'e' nemmeno il nome. */
  const maiPiu = [
    "laura",
    "giovanni",
    "rossi",
    "cameretta",
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
      `«${parola}» non deve uscire da questa casa, e sta nel rapporto`,
    );
  }

  /* E quello che serve c'e' lo stesso. */
  assert.equal(foglio.entita.giu, 1);
  assert.equal(foglio.entita.dispositivi, 1);
  assert.equal(foglio.batterie.scariche, 1);
  assert.equal(foglio.backup.giorniFa, 2);
  assert.equal(foglio.rete.schede[0].ip, "192.168.1.50");
});

test("un dispositivo che funziona resta fuori anche se si chiama come uno giu'", () => {
  /* Il filtro e' lo stato, non il nome: due prese dello stesso modello, una
   * staccata e una no, non devono uscire tutt'e due. */
  const stati = [
    { entity_id: "switch.presa_uno", state: "unavailable", attributes: {} },
    { entity_id: "switch.presa_due", state: "on", attributes: {} },
  ];
  const registri = {
    dispositivi: [
      { id: "a", name: "Presa lavatrice" },
      { id: "b", name: "Presa asciugatrice" },
    ],
    entita: [
      { entity_id: "switch.presa_uno", device_id: "a" },
      { entity_id: "switch.presa_due", device_id: "b" },
    ],
  };
  const conto = leEntita(stati, { registri });
  assert.deepEqual(conto.nomi, ["Presa lavatrice"]);
});

/* Aspetta che una cosa diventi vera, senza dormire a caso: il filo vive fuori
 * da chi lo chiama, e provarlo vuol dire guardare finche' non succede. */
async function aspetta(che, quanto = 2000) {
  const fino = Date.now() + quanto;
  while (Date.now() < fino) {
    if (che()) return;
    await new Promise((ok) => setTimeout(ok, 5));
  }
  throw new Error("non e' successo in tempo");
}

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
  /* Le richieste sono due — il rapporto, e il filo che resta in linea — e
   * quella che si guarda qui e' la prima. Si tengono tutte perche' la regola
   * vale per tutte e due: la chiave sta in testa, e nel corpo non c'e'. */
  const viste = [];
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "una-chiave-segretissima",
    casa: "casa_abc",
    fabbrica: () => ({ casa: "casa_abc", ponte: "1.4.32.14" }),
    registro: ZITTO,
    fetch: async (dove, come) => {
      viste.push({ dove, come });
      return { ok: true };
    },
  });
  assert.equal(await postino.manda(), true);
  postino.ferma();
  const vista = viste.find((una) => una.dove.endsWith("/rapporto"));
  assert.ok(vista, "il rapporto non e' partito");
  assert.equal(vista.dove, "https://quadro.it/rapporto");
  for (const una of viste) {
    assert.equal(una.come.headers.authorization, "Bearer una-chiave-segretissima");
    assert.ok(!String(una.come.body ?? "").includes("segretissima"));
  }
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

test("un rapporto che non si compila non e' colpa del quadro, e non lo rallenta", async () => {
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
  const chiesto = [];
  const fabbrica = fabbricaIlRapporto({
    identita: { casa: "casa_abc" },
    casa: {
      chiedi: async ({ type }) => {
        chiesto.push(type);
        if (type === "config/device_registry/list") return [{ id: "d1", name: "Sonda cantina" }];
        if (type === "config/entity_registry/list")
          return [{ entity_id: "sensor.uno", device_id: "d1" }];
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
  assert.equal(foglio.entita.giu, 1);
  assert.deepEqual(foglio.entita.nomi, ["Sonda cantina"]);
  assert.deepEqual(foglio.fuori, { acceso: true, filo: true });

  /* Ogni rapporto e' di adesso, non di quando il ponte si e' acceso. */
  await fabbrica();
  assert.equal(giri, 2);

  /* I registri pero' no: chiesti una volta e tenuti. Un rapporto al minuto
   * che si porta dietro due elenchi di registro ogni volta e' traffico per
   * due nomi che sono gli stessi di un'ora fa. */
  assert.equal(chiesto.filter((che) => che === "config/device_registry/list").length, 1);
  assert.equal(chiesto.filter((che) => che === "config/entity_registry/list").length, 1);
});

test("i registri che non rispondono lasciano il rapporto senza il conto dei dispositivi", async () => {
  /* Un Home Assistant che i registri non li da' — troppo vecchio, o un segno
   * senza permessi — non deve far cadere il rapporto: si manda tutto il
   * resto, e su quella riga si dice «non lo so».
   *
   * Prima si ripiegava sui nomi delle entita', e quel ripiego e' esattamente
   * quello che in una casa vera ha prodotto centottanta «dispositivi non
   * collegati» che dispositivi non erano. Senza i registri la domanda non si
   * puo' fare, e una risposta inventata e' peggio di nessuna risposta. */
  const fabbrica = fabbricaIlRapporto({
    identita: { casa: "casa_abc" },
    casa: {
      chiedi: async ({ type }) => {
        if (type === "get_states")
          return [{ entity_id: "sensor.pompa_calore", state: "unavailable", attributes: {} }];
        throw new Error("questo comando non lo conosco");
      },
    },
    ferro: ferroFinto({ os: {}, host: {}, network: null, addons: [] }),
    registro: ZITTO,
    adesso: () => Date.parse("2026-09-18T09:41:12Z"),
  });

  const foglio = await fabbrica();
  assert.equal(foglio.entita.giu, null);
  assert.equal(foglio.entita.totali, null);
  assert.equal(foglio.entita.dispositivi, null);
  assert.deepEqual(foglio.entita.nomi, []);
  /* E il resto del rapporto c'e' tutto: e' una riga che non si sa, non un
   * rapporto caduta. */
  assert.equal(foglio.casa, "casa_abc");
});

test("mezza rapporto e' meglio di nessuna, e quel giorno e' la piu' importante", async () => {
  const fabbrica = fabbricaIlRapporto({
    identita: { casa: "casa_abc" },
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
  const fabbrica = fabbricaIlRapporto({
    identita: { casa: "casa_abc" },
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
  const fabbrica = fabbricaIlRapporto({
    identita: { casa: "casa_abc" },
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

test("quando non arriva, il perché lo capisce chi ci abita", () => {
  /* `fetch` di Node alza sempre lo stesso «fetch failed» e mette la ragione
   * vera in `cause`. Quel messaggio finisce nella scheda che legge chi abita la
   * casa: «fetch failed» non gli dice niente e non gli fa fare niente. */
  const con = (codice, messaggio = "") =>
    Object.assign(new Error("fetch failed"), { cause: { code: codice, message: messaggio } });

  assert.match(
    perchePreciso(con("ENOTFOUND", "getaddrinfo ENOTFOUND quadro.gdahome.org")),
    /non si trova/,
  );
  assert.match(perchePreciso(con("ECONNREFUSED")), /non risponde su quella porta/);
  assert.match(perchePreciso(con("CERT_HAS_EXPIRED")), /certificato/);
  assert.match(
    perchePreciso(Object.assign(new Error("fetch failed"), { name: "TimeoutError" })),
    /non ha risposto in tempo/,
  );

  /* Un errore che non si conosce passa com'è, e non si inventa una frase:
   * mandare qualcuno a cercare la cosa sbagliata è peggio che non dirgli
   * niente. Ma si dice la ragione sotto, non il «fetch failed» che la nasconde. */
  assert.equal(perchePreciso(con("MAI_VISTO", "qualcosa di nuovo")), "qualcosa di nuovo");
  assert.equal(perchePreciso(new Error("un errore qualunque")), "un errore qualunque");
});

test("il nome dell'installatore arriva nella risposta, e la casa se lo ricorda", async () => {
  /* La casa non ha altro modo di saperlo: nel codice incollato c'è solo un
   * codice. Serve alla scheda nella console, dove chi ci abita legge a chi
   * vanno i suoi numeri. */
  const postino = new Postino({
    dove: "https://quadro.gdahome.org",
    chiave: "K7M2-9XQF-3BHT-R4VN",
    casa: "casa_abc",
    fabbrica: () => ({ casa: "casa_abc", ponte: "1.4.32.15" }),
    registro: ZITTO,
    fetch: async () => ({ ok: true, json: async () => ({ presa: true, di: "Impianti Rossi" }) }),
  });

  assert.equal(postino.chi, "", "prima del primo rapporto non si inventa niente");
  assert.equal(await postino.manda(), true);
  assert.equal(postino.chi, "Impianti Rossi");
});

test("una risposta senza nome, o che non è JSON, non fa danni", async () => {
  /* Il rapporto è arrivata, ed è quello che conta: il nome resta vuoto e la
   * scheda mostra l'indirizzo, che è quello che faceva prima. */
  const conRisposta = (risposta) =>
    new Postino({
      dove: "https://quadro.gdahome.org",
      chiave: "K7M2-9XQF-3BHT-R4VN",
      casa: "casa_abc",
      fabbrica: () => ({ casa: "casa_abc" }),
      registro: ZITTO,
      fetch: async () => risposta,
    });

  const senzaNome = conRisposta({ ok: true, json: async () => ({ presa: true }) });
  const nonJson = conRisposta({
    ok: true,
    json: async () => {
      throw new Error("non è JSON");
    },
  });

  assert.equal(
    await senzaNome.manda(),
    true,
    "una risposta senza nome non deve far fallire l'invio",
  );
  assert.equal(await nonJson.manda(), true, "una risposta che non è JSON nemmeno");
  assert.equal(senzaNome.chi, "");
  assert.equal(nonJson.chi, "");
});

/* ─── Cosa parte di un aggiornamento ───────────────────────────────────── */

test("dell'aggiornamento partono il marchio e cosa cambia, e non l'entita'", async () => {
  const stati = [
    {
      entity_id: "update.camera_di_marco_termostato",
      state: "on",
      attributes: {
        supported_features: 1,
        friendly_name: "Termostato",
        installed_version: "1.2.0",
        latest_version: "1.3.0",
        release_summary: "Risolve il riavvio notturno.",
        release_url: "https://example.invalid/note",
      },
    },
  ];
  const fabbrica = fabbricaIlRapporto({
    identita: { casa: "casa_abc" },
    casa: {
      chiedi: async ({ type }) => {
        if (type === "get_states") return stati;
        if (type === "config/entity_registry/get") return { platform: "shelly" };
        return [];
      },
    },
    ferro: ferroFinto({ os: {}, host: {}, network: null, addons: [] }),
    aggiornamenti: new Aggiornamenti({
      casa: { chiedi: async () => stati },
      registro: ZITTO,
    }),
    registro: ZITTO,
    adesso: () => Date.parse("2026-09-18T09:41:12Z"),
  });

  const foglio = await fabbrica();
  const uno = foglio.aggiornamenti.elenco[0];
  assert.equal(uno.nome, "Termostato");
  assert.equal(uno.cosaCambia, "Risolve il riavvio notturno.");
  assert.equal(uno.note, "https://example.invalid/note");

  /* E l'entita' no: `update.camera_di_marco_termostato` direbbe chi abita in
   * questa casa e in quale stanza dorme, e per far vedere che c'e' una
   * versione nuova non serve. */
  assert.equal(uno.entita, undefined);
  assert.ok(!JSON.stringify(foglio).includes("camera_di_marco"));
});

test("l'indirizzo delle note passa solo se e' un indirizzo da cliccare", async () => {
  /* Arriva da un attributo dell'entita', cioe' da fuori, e nel quadro diventa
   * un collegamento. `javascript:` in un `href` e' un programma. */
  for (const [dove, atteso] of [
    ["https://example.invalid/note", "https://example.invalid/note"],
    ["javascript:alert(1)", ""],
    ["http://example.invalid/note", ""],
    ["https://example.invalid/ a b", ""],
    [`https://example.invalid/${"x".repeat(400)}`, ""],
    ["", ""],
  ]) {
    const stati = [
      {
        entity_id: "update.uno",
        state: "on",
        attributes: {
          supported_features: 1,
          friendly_name: "Uno",
          installed_version: "1",
          latest_version: "2",
          release_url: dove,
        },
      },
    ];
    const fabbrica = fabbricaIlRapporto({
      identita: { casa: "casa_abc" },
      casa: { chiedi: async ({ type }) => (type === "get_states" ? stati : []) },
      ferro: ferroFinto({ os: {}, host: {}, network: null, addons: [] }),
      aggiornamenti: new Aggiornamenti({ casa: { chiedi: async () => stati }, registro: ZITTO }),
      registro: ZITTO,
      adesso: () => Date.parse("2026-09-18T09:41:12Z"),
    });
    const foglio = await fabbrica();
    assert.equal(foglio.aggiornamenti.elenco[0].note, atteso, `«${dove}»`);
  }
});

/* ─── Il comando che arriva nella risposta ─────────────────────────────── */

test("quello che il quadro mette nella risposta arriva a chi lo deve fare", async () => {
  /* E' l'unica strada per cui un comando entra in casa, e passa **dentro una
   * risposta**: verso una casa non c'e' nessuna porta aperta. */
  const arrivati = [];
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "una-chiave",
    casa: "casa_abc",
    fabbrica: () => ({}),
    fai: (detto) => {
      arrivati.push(detto);
    },
    registro: ZITTO,
    fetch: async () => ({
      ok: true,
      json: async () => ({ presa: true, di: "Impianti Rossi", fai: { id: "x", cosa: "installa" } }),
    }),
  });
  assert.equal(await postino.manda(), true);
  assert.deepEqual(arrivati, [{ id: "x", cosa: "installa" }]);
  /* E il nome dell'installatore arriva lo stesso: le due cose stanno nella
   * stessa risposta e non si portano via a vicenda. */
  assert.equal(postino.chi, "Impianti Rossi");
});

test("una risposta senza comando non fa succedere niente", async () => {
  let chiamate = 0;
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "una-chiave",
    casa: "casa_abc",
    fabbrica: () => ({}),
    fai: () => {
      chiamate += 1;
    },
    registro: ZITTO,
    fetch: async () => ({ ok: true, json: async () => ({ presa: true, di: "Rossi" }) }),
  });
  await postino.manda();
  assert.equal(chiamate, 0);
});

test("un lavoro che non parte non fa sembrare caduto un rapporto arrivato", async () => {
  /* Le due cose sono separate apposta: chi guarda la console dell'add-on deve
   * leggere «il rapporto arriva», perche' arriva. Cos'e' andato storto nel
   * lavoro si legge nel rapporto del minuto dopo. */
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "una-chiave",
    casa: "casa_abc",
    fabbrica: () => ({}),
    fai: () => {
      throw new Error("non e' partito");
    },
    registro: ZITTO,
    fetch: async () => ({ ok: true, json: async () => ({ fai: { id: "x", cosa: "installa" } }) }),
  });
  assert.equal(await postino.manda(), true);
  assert.equal(postino.ultimoEsito.andata, true);
});

test("il rapporto dice sempre se la manutenzione e' aperta, anche quando e' chiusa", async () => {
  /* «Chiusa» e «non lo dice» sono due cose diverse: il quadro con la prima
   * scrive «questa casa non ha aperto la manutenzione», con la seconda non sa
   * cosa scrivere. */
  const fai = (manutenzione) =>
    fabbricaIlRapporto({
      identita: { casa: "casa_abc" },
      casa: { chiedi: async () => [] },
      ferro: ferroFinto({ os: {}, host: {}, network: null, addons: [] }),
      manutenzione,
      registro: ZITTO,
      adesso: () => Date.parse("2026-09-18T09:41:12Z"),
    })();
  assert.equal((await fai(false)).manutenzione, false);
  assert.equal((await fai(true)).manutenzione, true);
});

/* ─── Il filo tenuto aperto ─────────────────────────────────────────────── */

test("dopo il rapporto la casa resta in linea, e quello che arriva lo fa subito", async () => {
  /* E' la meta' di casa del tempo reale: il quadro tiene aperta la richiesta e
   * risponde quando qualcuno preme il tasto; qui si prova che questa casa
   * quella richiesta la apra, e che quello che ne esce lo faccia. */
  const chieste = [];
  let dilloAlFilo;
  const fatti = [];
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "una-chiave",
    casa: "casa_abc",
    fabbrica: () => ({ casa: "casa_abc" }),
    registro: ZITTO,
    fai: (detto) => {
      fatti.push(detto);
    },
    fetch: async (dove, come) => {
      chieste.push(dove);
      if (dove.endsWith("/attesa")) {
        /* Il filo: si tiene aperto finche' questa prova non ci mette dentro
         * qualcosa, che e' esattamente quello che fa il quadro. */
        return new Promise((ok) => {
          dilloAlFilo = (cosa) => ok({ ok: true, json: async () => cosa });
        });
      }
      void come;
      return { ok: true, json: async () => ({ presa: true }) };
    },
  });

  try {
    assert.equal(await postino.manda(), true);
    /* Il filo si apre da se', subito dopo il rapporto. */
    await aspetta(() => chieste.includes("https://quadro.it/attesa"));
    assert.ok(dilloAlFilo, "la casa non e' rimasta in linea");

    /* E quello che il quadro ci mette dentro si fa, senza aspettare il
     * rapporto del minuto dopo. */
    dilloAlFilo({ fai: { id: "x", cosa: "installa", nome: "Mosquitto broker", a: "6.5.1" } });
    await aspetta(() => fatti.length === 1);
    assert.equal(fatti[0].nome, "Mosquitto broker");

    /* E subito dopo parte un rapporto, che dice com'e' andata: senza, chi ha
     * premuto il tasto guarderebbe uno schermo fermo per un minuto buono con
     * l'installazione gia' partita. */
    await aspetta(() => chieste.filter((una) => una.endsWith("/rapporto")).length >= 2);
  } finally {
    postino.ferma();
  }
});

test("se il quadro dice «un rapporto, adesso», parte un rapporto senza nessun lavoro", async () => {
  /* I nomi scelti per le plance e una plancia in piu' viaggiano nella
   * risposta al rapporto, non come lavoro: il quadro sveglia il filo con
   * `rapporto: true`, e la casa passa subito invece di aspettare il minuto.
   * Un ponte che quella parola non la conosce riapre il filo e basta. */
  const chieste = [];
  let dilloAlFilo;
  const fatti = [];
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "una-chiave",
    casa: "casa_abc",
    fabbrica: () => ({ casa: "casa_abc" }),
    registro: ZITTO,
    fai: (detto) => {
      fatti.push(detto);
    },
    fetch: async (dove) => {
      chieste.push(dove);
      if (dove.endsWith("/attesa")) {
        return new Promise((ok) => {
          dilloAlFilo = (cosa) => ok({ ok: true, json: async () => cosa });
        });
      }
      return { ok: true, json: async () => ({ presa: true }) };
    },
  });
  try {
    assert.equal(await postino.manda(), true);
    await aspetta(() => chieste.includes("https://quadro.it/attesa"));
    dilloAlFilo({ rapporto: true });
    await aspetta(() => chieste.filter((una) => una.endsWith("/rapporto")).length >= 2);
    assert.equal(fatti.length, 0, "non c'era nessun lavoro da fare");
  } finally {
    postino.ferma();
  }
});

test("il filo non gira a vuoto nemmeno se dall'altra parte risponde all'istante", async () => {
  /* Il paracadute di `IL_FILO_ALMENO`. Senza, un quadro che riconsegnasse
   * sempre lo stesso lavoro farebbe girare questa casa — lavoro, rapporto,
   * filo, lavoro — quanto ne e' capace il processore. E' successo davvero,
   * scrivendolo. */
  let quante = 0;
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "una-chiave",
    casa: "casa_abc",
    fabbrica: () => ({ casa: "casa_abc" }),
    registro: ZITTO,
    fai: () => {},
    fetch: async (dove) => {
      quante += 1;
      return {
        ok: true,
        json: async () =>
          dove.endsWith("/attesa") ? { fai: { id: "x", cosa: "installa", nome: "n", a: "2" } } : {},
      };
    },
  });
  try {
    await postino.manda();
    await new Promise((ok) => setTimeout(ok, 250));
    /* In un quarto di secondo, con un pavimento di un secondo, i giri sono
     * pochissimi. Senza pavimento sarebbero decine di migliaia. */
    assert.ok(quante < 20, `${quante} richieste in 250ms: sta girando a vuoto`);
  } finally {
    postino.ferma();
  }
});

test("quando il quadro non chiede piu' niente, la casa smette di mandare", async () => {
  /* L'elenco di quello che il quadro ha chiesto e' quello che al giro dopo
   * viaggia. Prima si teneva solo quando arrivava — `if (Array.isArray(manca))`
   * — e una risposta buona che non chiedeva piu' niente lasciava intatto
   * l'elenco di prima: le stesse icone rimandate ogni minuto, per sempre.
   * Arrivate, salvate, e rimandate, perche' nessuno aveva mai detto «basta».
   *
   * Una risposta buona che non chiede niente **e'** quel «basta». */
  const risposte = [
    { manca: ["e574160d1c8dc4e2", "0123456789abcdef"] },
    /* Le ha ricevute: adesso non chiede piu'. */
    { presa: true },
  ];
  let giro = 0;
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "una-chiave-segretissima",
    casa: "casa_abc",
    fabbrica: () => ({ casa: "casa_abc" }),
    registro: ZITTO,
    fetch: async () => ({
      ok: true,
      status: 200,
      async json() {
        return risposte[Math.min(giro++, risposte.length - 1)];
      },
    }),
  });
  postino.parti();

  await postino.manda();
  assert.deepEqual(
    postino.segniChiesti,
    ["e574160d1c8dc4e2", "0123456789abcdef"],
    "non si e' segnato quello che il quadro gli ha chiesto",
  );

  await postino.manda();
  assert.deepEqual(postino.segniChiesti, [], "le rimanda ogni minuto per sempre");

  postino.ferma();
});

test("il segno di un aggiornamento viaggia dentro la sua riga", async () => {
  /* La riga che teneva spenta tutta la faccenda: `iConti` prendeva i segni
   * come terzo argomento — glieli passavamo — ma la sua firma ne dichiarava
   * due, e la riga non ne emetteva nessuno. Il quadro non vedeva mai un segno,
   * quindi non ne chiedeva mai uno, quindi un'icona non arrivava mai.
   *
   * Le prove di prima guardavano i pezzi — il segno si calcola bene, il quadro
   * risponde bene a un rapporto scritto a mano — e nessuna guardava il giro
   * intero. */
  const scrivi = fabbricaIlRapporto({
    identita: { casa: "casa_abc" },
    aggiornamenti: {
      async elenco() {
        return [
          {
            entita: "update.mosquitto_broker",
            nome: "Mosquitto broker",
            da: "6.4.0",
            a: "6.5.1",
            installabile: true,
          },
        ];
      },
      async marchioDi() {
        return "mosquitto";
      },
    },
    adesso: () => Date.now(),
  });
  const carta = await scrivi();
  const riga = carta.aggiornamenti.elenco[0];
  assert.equal(riga.segno, ilSegnoDi("Mosquitto broker", "6.5.1"));
  assert.match(riga.segno, /^[0-9a-f]{16}$/);
  /* E l'entita' non passa: direbbe chi ci abita e in quale stanza. */
  assert.equal(JSON.stringify(carta).includes("update.mosquitto_broker"), false);
});

/* ─── Chi e' questa casa, per il quadro ─────────────────────────────────── */

test("ogni richiesta al quadro porta il segreto della casa, lo stesso dopo un riavvio", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "postino-segreto-"));
  try {
    const viste = [];
    const unPostino = () =>
      new Postino({
        dove: "https://quadro.it",
        chiave: "chiave-di-adesso",
        casa: "casa_abc",
        cartella,
        fabbrica: () => ({}),
        registro: ZITTO,
        fetch: async (dove, come) => {
          viste.push({ dove, come });
          return { ok: true, status: 200, json: async () => ({}) };
        },
      });
    const primo = unPostino();
    assert.equal(await primo.manda(), true);
    primo.ferma();
    const segreto = viste[0].come.headers["x-casa-segreto"];
    assert.match(segreto, /^[0-9a-f]{64}$/);
    /* Il segreto non e' la chiave, e non sta nel corpo. */
    assert.notEqual(segreto, "chiave-di-adesso");
    assert.ok(!String(viste[0].come.body).includes(segreto));

    const secondo = unPostino();
    assert.equal(await secondo.manda(), true);
    secondo.ferma();
    assert.equal(viste.at(-1).come.headers["x-casa-segreto"], segreto, "lo stesso di prima");
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("cambiato il codice, si manda anche quello di prima finche' il nuovo non risponde", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "postino-prima-"));
  try {
    const viste = [];
    /* Solo i rapporti: il filo tenuto aperto parte da se', e qui non conta. */
    const ultimo = () => viste.filter((una) => una.dove.endsWith("/rapporto")).at(-1).come;
    let risponde = true;
    const unPostino = (chiave) =>
      new Postino({
        dove: "https://quadro.it",
        chiave,
        casa: "casa_abc",
        cartella,
        fabbrica: () => ({}),
        registro: ZITTO,
        fetch: async (dove, come) => {
          viste.push({ dove, come });
          return risponde
            ? { ok: true, status: 200, json: async () => ({}) }
            : { ok: false, status: 403, json: async () => ({}) };
        },
      });
    const vecchio = unPostino("codice-vecchio");
    await vecchio.manda();
    vecchio.ferma();
    assert.equal(ultimo().headers["x-chiave-prima"], undefined);

    risponde = false;
    const nuovo = unPostino("codice-nuovo");
    await nuovo.manda();
    assert.equal(ultimo().headers["x-chiave-prima"], "codice-vecchio");
    risponde = true;
    await nuovo.manda();
    assert.equal(ultimo().headers["x-chiave-prima"], "codice-vecchio");
    /* Il nuovo ha avuto risposta: quello di prima non serve piu'. */
    await nuovo.manda();
    nuovo.ferma();
    assert.equal(ultimo().headers["x-chiave-prima"], undefined);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("un 429 del quadro si rispetta: si aspetta quanto dice, senza raddoppiare", async () => {
  let ora = 1_000_000;
  let bussate = 0;
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "chiave-lunga-abbastanza",
    casa: "casa_abc",
    fabbrica: () => ({}),
    registro: ZITTO,
    adesso: () => ora,
    fetch: async () => {
      bussate += 1;
      return {
        ok: false,
        status: 429,
        headers: new Headers({ "retry-after": "120" }),
        json: async () => ({}),
      };
    },
  });
  assert.equal(await postino.manda(), false);
  assert.equal(bussate, 1);
  assert.match(postino.ultimoEsito.perche, /120 secondi/);
  /* Non e' un quadro spento: non si rallenta come per un guasto. */
  assert.equal(postino._quanteVoltePerNiente, 0);
  /* Prima dei due minuti non si bussa. */
  ora += 60_000;
  assert.equal(await postino.manda(), false);
  assert.equal(bussate, 1);
  ora += 61_000;
  await postino.manda();
  assert.equal(bussate, 2);
  postino.ferma();
  assert.equal(secondiDiFreno("abc"), 60);
  assert.equal(secondiDiFreno("999999"), 3600);
});
