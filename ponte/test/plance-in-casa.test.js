/* Le plance fra le «Plance» di Home Assistant.
 *
 * Quello che qui si tiene fermo non e' «funziona»: e' **cosa** il ponte fa
 * dentro la casa di qualcun altro, adesso che per questo mestiere gli serve
 * poter scrivere nella cartella di Home Assistant.
 *
 *  - scrive solo dentro `www/gdahome/`. Li' accanto ci sono automazioni, temi
 *    e segreti di chi ci abita, e Home Assistant non sa mappare una
 *    sottocartella: il permesso e' grosso, e la prova e' il modo di dire fin
 *    dove si arriva;
 *  - nelle Plance mette **solo tessere di Home Assistant**: la tessera «pagina
 *    web» che apre `/local/gdahome/apri.html`. Nessuna risorsa di Lovelace da
 *    dichiarare, quindi nessuna pagina da ricaricare perche' arrivi — ne' alla
 *    prima installazione, ne' a un aggiornamento, ne' sul telefono;
 *  - le nostre risorse di Lovelace se ne vanno, salvo dove la tessera la usa
 *    ancora qualcuno; quelle degli altri non si toccano;
 *  - il foglietto «ricarica questa pagina» non esiste piu', in nessun caso;
 *  - una Plancia per plancia, una vista sola a pagina intera;
 *  - quando una plancia cambia nome la Plancia cambia titolo, e quando una
 *    plancia va via la sua Plancia va via;
 *  - e non tocca le Plance di nessun altro.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  CARTELLA,
  DAVANTI,
  PlanceInCasa,
  IL_RIAVVIO,
  SEGNO_DELL_APERTURA,
  indirizzoDi,
  lePlanceDiPrima,
} from "../src/plance-in-casa.js";
import { Plance } from "../src/plance.js";
import { conLePremesse } from "../src/premesse.js";
import { IL_CRUSCOTTO, LA_GESTIONE } from "../src/voci-nella-barra.js";

/* Una Home Assistant finta al livello dei comandi: tiene le Plance e le
 * risorse in memoria, come le tiene lei, e mette in fila tutto quello che le
 * arriva — perche' meta' di questa prova e' **quali** comandi partono. */
function casaFinta({ plance = [], risorse = [], viste = {} } = {}) {
  const dette = [];
  const lePagine = new Map(Object.entries(viste));
  const avvisi = new Map();
  let contatore = 0;
  return {
    dette,
    plance,
    risorse,
    viste: lePagine,
    avvisi,
    async chiedi(comando) {
      dette.push(comando);
      switch (comando.type) {
        case "lovelace/dashboards/list":
          return plance.map((una) => ({ ...una }));
        case "lovelace/dashboards/create": {
          contatore += 1;
          const nuova = { id: `d${contatore}`, ...comando };
          delete nuova.type;
          plance.push(nuova);
          return { ...nuova };
        }
        case "lovelace/dashboards/update": {
          const quale = plance.find((una) => una.id === comando.dashboard_id);
          if (!quale) throw new Error("quella Plancia non c'e'");
          if (comando.title !== undefined) quale.title = comando.title;
          if (comando.require_admin !== undefined) quale.require_admin = comando.require_admin;
          return { ...quale };
        }
        case "lovelace/dashboards/delete": {
          const dove = plance.findIndex((una) => una.id === comando.dashboard_id);
          if (dove < 0) throw new Error("quella Plancia non c'e'");
          plance.splice(dove, 1);
          return null;
        }
        case "lovelace/resources":
          return risorse.map((una) => ({ ...una }));
        case "lovelace/resources/create": {
          contatore += 1;
          const nuova = { id: `r${contatore}`, url: comando.url, type: comando.res_type };
          risorse.push(nuova);
          return { ...nuova };
        }
        case "lovelace/resources/update": {
          const quale = risorse.find((una) => una.id === comando.resource_id);
          if (!quale) throw new Error("quella risorsa non c'e'");
          quale.url = comando.url;
          return { ...quale };
        }
        case "lovelace/resources/delete": {
          const dove = risorse.findIndex((una) => una.id === comando.resource_id);
          if (dove < 0) throw new Error("quella risorsa non c'e'");
          risorse.splice(dove, 1);
          return null;
        }
        case "lovelace/config": {
          /* `undefined` e' la dashboard di casa, quella senza indirizzo. */
          const quale = lePagine.get(comando.url_path ?? "");
          if (!quale) throw new Error("config_not_found");
          return JSON.parse(JSON.stringify(quale));
        }
        case "lovelace/config/save":
          lePagine.set(comando.url_path, JSON.parse(JSON.stringify(comando.config)));
          return null;
        case "call_service": {
          if (comando.domain !== "persistent_notification") {
            throw new Error(`la casa finta non chiama ${comando.domain}`);
          }
          const quale = String(comando.service_data?.notification_id || "");
          if (comando.service === "create") avvisi.set(quale, comando.service_data);
          else if (comando.service === "dismiss") avvisi.delete(quale);
          else throw new Error(`la casa finta non sa ${comando.service}`);
          return null;
        }
        default:
          throw new Error(`la casa finta non sa fare ${comando.type}`);
      }
    },
  };
}

/* Cosa risponde Home Assistant a chi gli chiede la pagina d'apertura.
 *
 * Quattro risposte, e sono quelle che si prendono davvero: `si` la serve,
 * `no` non l'ha (`/local/` aperto all'avvio, cartella `www` fatta da noi
 * dopo), `rotta` risponde qualcosa che non e' lei, `zitto` non risponde — e
 * quella non e' un «no», e' un «non lo so». */
function rispondeAllaPagina(come) {
  const chiamate = [];
  const prendi = async (dove) => {
    chiamate.push(String(dove));
    if (come === "no")
      return {
        ok: false,
        status: 404,
        async text() {
          return "404: Not Found";
        },
      };
    if (come === "rotta")
      return {
        ok: true,
        status: 200,
        async text() {
          return "<!doctype html><title>altro</title>";
        },
      };
    if (come === "si") {
      return {
        ok: true,
        status: 200,
        async text() {
          return `<!doctype html><head>${SEGNO_DELL_APERTURA}</head>`;
        },
      };
    }
    throw new Error("Home Assistant non risponde");
  };
  return { prendi, chiamate };
}

/* Quello che l'add-on scrive nei suoi log. */
function unRegistro() {
  const detto = { info: [], avvisi: [], errori: [] };
  return {
    detto,
    info: (una) => detto.info.push(String(una)),
    attenzione: (una) => detto.avvisi.push(String(una)),
    errore: (una) => detto.errori.push(String(una)),
  };
}

function banco({ plance: dentro, risorse, viste, pagina, tessere = false, versione } = {}) {
  const radice = mkdtempSync(join(tmpdir(), "plance-in-casa-"));
  /* La cartella della configurazione esiste, `www` no: e' come sta una casa
   * appena installata, e la `www` la fa il ponte. */
  const casaSuDisco = join(radice, "config");
  mkdirSync(casaSuDisco, { recursive: true });
  const www = join(casaSuDisco, "www");
  const plance = new Plance({ cartella: radice });
  const casa = casaFinta({ plance: dentro, risorse, viste });
  /* Chi non dice niente di `pagina` resta un «non lo so»: una casa che non
   * sa dove stiano i suoi file statici. */
  const rete = pagina === undefined ? null : rispondeAllaPagina(pagina);
  if (rete) casa.doveStaLaPlancia = async () => "http://ha-finta:8123";
  const registro = unRegistro();
  const in_casa = new PlanceInCasa({
    casa,
    plance,
    www,
    versione: versione ?? "0.21.0",
    tessere,
    registro,
    ...(rete ? { fetch: rete.prendi } : {}),
  });
  return {
    radice,
    casaSuDisco,
    www,
    plance,
    casa,
    in_casa,
    registro,
    rete,
    via: () => rmSync(radice, { recursive: true, force: true }),
  };
}

/* La risorsa che la versione di prima dichiarava, e quella del caricatore. */
const STABILE = "/local/gdahome/caricatore.js?giro=1";
const DI_HACS = { id: "x1", url: "/hacsfiles/button-card/button-card.js", type: "module" };

/* Le tessere che Home Assistant ha da se', in ogni pagina, senza che nessuno
 * dichiari niente. Una Plancia di gdahome deve stare dentro questo elenco. */
const DI_HOME_ASSISTANT = new Set(["iframe", "markdown"]);

function leTessere(config) {
  return (config?.views || []).flatMap((vista) => vista.cards || []);
}

function iDetti(indirizzo) {
  return Object.fromEntries(new URL(indirizzo, "http://ha-finta:8123").searchParams);
}

/* Il foglietto che non deve comparire mai piu', in nessuna delle sue forme. */
const LA_RICARICA = /ricaric|reload|\bF5\b|Manca un passaggio solo|Reset frontend cache/i;

function nessunaRicarica(b, perche) {
  for (const [dove, config] of b.casa.viste) {
    for (const tessera of leTessere(config)) {
      assert.doesNotMatch(
        JSON.stringify(tessera),
        LA_RICARICA,
        `${perche}: «${dove}» chiede di ricaricare`,
      );
    }
  }
  for (const riga of [...b.registro.detto.avvisi, ...b.registro.detto.info]) {
    assert.doesNotMatch(riga, /F5|ricarica la pagina/i, `${perche}: il registro chiede un F5`);
  }
}

test("scrive solo sotto www/gdahome, e la pagina d'apertura porta dentro l'accompagnatore", async () => {
  const b = banco();
  try {
    assert.equal(b.in_casa.doveVaLApertura, join(b.www, CARTELLA, "apri.html"));

    const esito = await b.in_casa.sistema();
    assert.equal(esito.fatto, true);

    /* Tutto quello che e' comparso dentro la cartella di Home Assistant, e
     * non «il file che mi aspettavo c'e'»: l'elenco intero. */
    assert.deepEqual(tuttoQuelloCheCE(b.casaSuDisco).sort(), [
      "www",
      "www/gdahome",
      "www/gdahome/LEGGIMI.txt",
      "www/gdahome/apri.html",
      "www/gdahome/caricatore.js",
      "www/gdahome/plancia.js",
      "www/gdahome/versione.json",
    ]);

    /* La pagina d'apertura: il segno con cui si riconosce, l'accompagnatore
     * cucito al suo posto — e il posto non c'e' piu' — e nessun `</script>`
     * che chiuda lo script prima del tempo. */
    const scritta = readFileSync(join(b.www, CARTELLA, "apri.html"), "utf8");
    assert.ok(scritta.includes(SEGNO_DELL_APERTURA));
    assert.ok(!scritta.includes("/*@accompagna@*/"), "l'accompagnatore non e' stato cucito");
    assert.match(scritta, /window\.__gdahomeAccompagna\b/);
    assert.match(scritta, /\/ingress\/session/);
    assert.match(scritta, /\/ingress\/validate_session/);
    assert.equal(
      scritta.match(/<\/script>/g).length,
      scritta.match(/<script>/g).length,
      "uno script chiuso prima del tempo",
    );
    /* E nessuna frase che chieda di ricaricare: questa e' la pagina che si
     * vede quando qualcosa non va, e quello che dice e' «riprovo da sola». Si
     * guarda quello che si legge, cioe' tutto tranne i commenti — che il
     * perche' della ricarica lo raccontano, e devono. */
    const siLegge = scritta.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(siLegge, /ricaric|reload|F5/i);
    assert.match(siLegge, /Riprovo da sola/);
    assert.equal(scritta, b.in_casa.laPaginaDApertura());
  } finally {
    b.via();
  }
});

test("dove non c'e' nessuna Home Assistant non scrive niente", async () => {
  const radice = mkdtempSync(join(tmpdir(), "plance-senza-casa-"));
  try {
    const plance = new Plance({ cartella: radice });
    const casa = casaFinta();
    const www = join(radice, "non-c-e", "www");
    const in_casa = new PlanceInCasa({ casa, plance, www });
    assert.equal(in_casa.cE, false);
    const esito = await in_casa.sistema();
    assert.equal(esito.fatto, false);
    assert.equal(existsSync(join(radice, "non-c-e")), false);
    assert.deepEqual(casa.dette, []);
  } finally {
    rmSync(radice, { recursive: true, force: true });
  }
});

test("nella Plancia ci sono solo tessere di Home Assistant: la «pagina web» che apre apri.html", async () => {
  const b = banco();
  try {
    b.plance.aggiungi("Casa al mare");
    await b.in_casa.sistema();

    for (const [dove, config] of b.casa.viste) {
      for (const tessera of leTessere(config)) {
        assert.ok(
          DI_HOME_ASSISTANT.has(tessera.type),
          `«${dove}» ha dentro «${tessera.type}», che Home Assistant da se' non ha`,
        );
        assert.doesNotMatch(String(tessera.type), /^custom:/);
      }
    }

    const mare = b.casa.viste.get("gdahome-casa-al-mare");
    assert.equal(mare.views.length, 1);
    assert.equal(mare.views[0].title, "Casa al mare");
    assert.equal(mare.views[0].panel, true);
    assert.equal(mare.views[0].cards.length, 1);
    const tessera = mare.views[0].cards[0];
    assert.deepEqual(Object.keys(tessera).sort(), ["type", "url"]);
    assert.equal(tessera.type, "iframe");
    assert.match(tessera.url, /^\/local\/gdahome\/apri\.html\?v=0\.21\.0-[0-9a-f]{10}&/);
    assert.deepEqual(iDetti(tessera.url), {
      v: b.in_casa.giroDellApertura,
      addon: "",
      profilo: "casa-al-mare",
      titolo: "Casa al mare",
    });

    /* La prima non dice quale aprire: e' la risposta di sempre. */
    const prima = iDetti(b.casa.viste.get("gdahome-primary").views[0].cards[0].url);
    assert.equal(prima.profilo, undefined);
  } finally {
    b.via();
  }
});

test("chi siamo per il Supervisor finisce nell'indirizzo: lo slug, e l'ingresso come ripiego", async () => {
  const b = banco();
  try {
    b.in_casa._io = { slug: "abc123_gdahome", ingresso: "/api/hassio_ingress/gettone" };
    await b.in_casa.sistema();
    const detti = iDetti(b.casa.viste.get("gdahome-primary").views[0].cards[0].url);
    assert.equal(detti.addon, "abc123_gdahome");
    assert.equal(detti.ingresso, "/api/hassio_ingress/gettone");
  } finally {
    b.via();
  }
});

test("nessuna risorsa di Lovelace si dichiara, mai", async () => {
  const b = banco();
  try {
    mkdirSync(b.www, { recursive: true });
    for (let giro = 0; giro < 3; giro += 1) await b.in_casa.sistema();
    assert.deepEqual(b.casa.risorse, []);
    assert.equal(
      b.casa.dette.some((una) => /^lovelace\/resources\/(create|update)$/.test(una.type)),
      false,
    );
  } finally {
    b.via();
  }
});

test("chi aggiorna: le nostre risorse vanno via, le altre restano, e la Plancia si riscrive", async () => {
  /* La casa che aggiorna da una versione che la plancia la apriva con la
   * tessera: in elenco c'e' la cartina con la versione, magari il caricatore
   * di un giro in mezzo, e una risorsa di HACS che non e' nostra. Nella
   * Plancia c'e' `custom:gdahome-plancia`. */
  const b = banco({
    plance: [{ id: "d0", url_path: "gdahome-primary", title: "gdahome", require_admin: false }],
    risorse: [
      { id: "r0", url: "/local/gdahome/plancia.js?v=0.20.0", type: "module" },
      { id: "r1", url: STABILE, type: "module" },
      { ...DI_HACS },
    ],
    viste: {
      "gdahome-primary": {
        views: [
          {
            title: "gdahome",
            panel: true,
            cards: [{ type: "custom:gdahome-plancia", profilo: "", addon: "", utenti: [] }],
          },
        ],
      },
    },
    pagina: "si",
  });
  mkdirSync(b.www, { recursive: true });
  try {
    const esito = await b.in_casa.sistema();
    assert.equal(esito.fatto, true);
    assert.equal(esito.risorsa, "tolta");
    assert.equal(esito.tessere, false);
    assert.deepEqual(b.casa.risorse, [DI_HACS], "quella di HACS non si tocca");

    /* La Plancia di prima, riscritta: Home Assistant la manda da se' a tutte
     * le pagine aperte, che si ridisegnano con la tessera «pagina web». */
    assert.equal(esito.manca, "");
    assert.equal(esito.tessera_nella_vista, "iframe");
    assert.match(esito.indirizzo_nella_vista, /^\/local\/gdahome\/apri\.html\?v=/);
    nessunaRicarica(b, "chi aggiorna");

    /* E una volta sola: il giro dopo non trova niente da fare. */
    b.casa.dette.length = 0;
    const dinuovo = await b.in_casa.sistema();
    assert.equal(dinuovo.risorsa, "nessuna");
    assert.equal(
      b.casa.dette.some((una) => /^lovelace\/(resources\/|config\/save)/.test(una.type)),
      false,
    );
  } finally {
    b.via();
  }
});

test("un aggiornamento cambia l'indirizzo nella Plancia, e solo quello", async () => {
  /* Il numero nell'indirizzo e' quello che fa riprendere la pagina al
   * browser — Home Assistant gliela fa tenere un mese — ed e' scritto nella
   * configurazione della Plancia: cambiarlo non chiede niente a nessuno,
   * perche' Home Assistant la configurazione nuova la porta da se' alle pagine
   * aperte. */
  const b = banco({ pagina: "si" });
  mkdirSync(b.www, { recursive: true });
  try {
    await b.in_casa.sistema();
    const prima = b.casa.viste.get("gdahome-primary").views[0].cards[0].url;
    b.casa.dette.length = 0;

    const dopo = new PlanceInCasa({
      casa: b.casa,
      plance: b.plance,
      www: b.www,
      versione: "0.22.0",
      fetch: b.rete.prendi,
      registro: b.registro,
    });
    const esito = await dopo.sistema();
    const adesso = b.casa.viste.get("gdahome-primary").views[0].cards[0].url;
    assert.notEqual(adesso, prima);
    assert.match(iDetti(adesso).v, /^0\.22\.0-/);
    assert.deepEqual({ ...iDetti(adesso), v: "" }, { ...iDetti(prima), v: "" });
    assert.equal(esito.manca, "");
    assert.deepEqual(
      b.casa.dette.filter((una) => una.type === "lovelace/config/save").map((una) => una.url_path),
      ["gdahome-primary"],
    );
    assert.equal(
      b.casa.dette.some((una) => String(una.type).startsWith("lovelace/resources/")),
      false,
    );
    /* E la pagina che Home Assistant chiede a quel numero e' quella nuova,
     * sul disco. */
    assert.ok(b.rete.chiamate.at(-1).endsWith(dopo.indirizzoDellApertura));
    nessunaRicarica(b, "un aggiornamento");
  } finally {
    b.via();
  }
});

test("l'impronta nell'indirizzo cambia se cambia la pagina, anche a versione ferma", async () => {
  const b = banco({ versione: "" });
  try {
    const prima = b.in_casa.giroDellApertura;
    assert.match(prima, /^[0-9a-f]{10}$/);
    const altra = join(b.radice, "apri.html");
    writeFileSync(altra, `${readFileSync(b.in_casa.apertura, "utf8")}<!-- un'altra -->`);
    const dopo = new PlanceInCasa({ casa: b.casa, plance: b.plance, www: b.www, apertura: altra });
    assert.notEqual(dopo.giroDellApertura, prima);
  } finally {
    b.via();
  }
});

test("chi usa ancora le tessere si tiene la risorsa, una e all'indirizzo fisso", async () => {
  /* Tre modi di usarla, e per tutti e tre la risorsa resta: le voci di chi
   * installa accese, la loro dashboard gia' scritta, una dashboard di chi ci
   * abita con la tessera della plancia dentro. La Plancia di gdahome invece
   * resta la «pagina web» in tutti i casi. */
  const casi = [
    { come: "voci accese", tessere: true, plance: [], viste: {} },
    {
      come: "la voce dell'installatore",
      plance: [{ id: "c", url_path: IL_CRUSCOTTO.dove, title: IL_CRUSCOTTO.titolo }],
      viste: {
        [IL_CRUSCOTTO.dove]: {
          views: [{ panel: true, cards: [{ type: "custom:gdahome-riquadro", dove: "https://x" }] }],
        },
      },
    },
    {
      come: "una dashboard di chi ci abita",
      plance: [{ id: "m", url_path: "casa-mia", title: "La mia" }],
      viste: {
        "casa-mia": { views: [{ cards: [{ type: "custom:gdahome-plancia", barra: true }] }] },
      },
    },
    {
      come: "la dashboard di casa",
      plance: [],
      viste: { "": { views: [{ cards: [{ type: "custom:gdahome-plancia" }] }] } },
    },
  ];
  for (const caso of casi) {
    const b = banco({
      plance: caso.plance,
      viste: caso.viste,
      tessere: caso.tessere,
      risorse: [{ id: "r0", url: "/local/gdahome/plancia.js?v=0.20.0", type: "module" }],
    });
    try {
      const esito = await b.in_casa.sistema();
      assert.equal(esito.tessere, true, caso.come);
      assert.ok(esito.tessere_in.length > 0, caso.come);
      assert.equal(esito.risorsa, "migrata", caso.come);
      assert.deepEqual(
        b.casa.risorse.map((una) => una.url),
        [STABILE],
        caso.come,
      );
      assert.equal(b.casa.viste.get("gdahome-primary").views[0].cards[0].type, "iframe");
      /* La dashboard di chi ci abita si e' letta, non scritta. */
      assert.equal(
        b.casa.dette.some(
          (una) => una.type === "lovelace/config/save" && una.url_path !== "gdahome-primary",
        ),
        false,
        caso.come,
      );
      nessunaRicarica(b, caso.come);
    } finally {
      b.via();
    }
  }
});

test("le Plance di GdAHome di prima non contano come chi usa le tessere", async () => {
  /* Hanno ancora `custom:gdahome-plancia`, ma sono proprio quelle che questo
   * giro riscrive: contarle vorrebbe dire non togliere mai la risorsa. */
  const b = banco({
    plance: [{ id: "d0", url_path: "gdahome-primary", title: "gdahome" }],
    viste: { "gdahome-primary": { views: [{ cards: [{ type: "custom:gdahome-plancia" }] }] } },
    risorse: [{ id: "r0", url: STABILE, type: "module" }],
  });
  try {
    const esito = await b.in_casa.sistema();
    assert.equal(esito.tessere, false);
    assert.deepEqual(esito.tessere_in, []);
    assert.deepEqual(b.casa.risorse, []);
  } finally {
    b.via();
  }
});

test("se l'elenco delle dashboard non si legge, la risorsa non si tocca", async () => {
  const b = banco({ risorse: [{ id: "r0", url: STABILE, type: "module" }] });
  try {
    const vera = b.casa.chiedi;
    let prima = true;
    b.casa.chiedi = async (comando) => {
      /* La prima lettura dell'elenco e' quella di chi usa le tessere. */
      if (comando.type === "lovelace/dashboards/list" && prima) {
        prima = false;
        throw new Error("non ora");
      }
      return vera(comando);
    };
    const esito = await b.in_casa.sistema();
    assert.equal(esito.tessere, null);
    assert.equal(esito.risorsa, "c'era");
    assert.deepEqual(
      b.casa.risorse.map((una) => una.url),
      [STABILE],
    );
  } finally {
    b.via();
  }
});

test("«solo amministratori» finisce sulla voce di Home Assistant, e nell'indirizzo", async () => {
  const b = banco();
  const IO = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
  try {
    await b.in_casa.sistema();
    assert.equal(b.casa.plance[0].require_admin, false);

    b.plance.soloChiAmministra("primary", true);
    await b.in_casa.sistema();
    assert.equal(b.casa.plance[0].require_admin, true, "la voce non lo ha saputo");
    const url = () => b.casa.viste.get("gdahome-primary").views[0].cards[0].url;
    assert.equal(iDetti(url()).solo_admin, "1");

    /* Riscrivere la stessa cosa non manda un aggiornamento. */
    const prima = b.casa.dette.filter((una) => una.type === "lovelace/dashboards/update").length;
    await b.in_casa.sistema();
    const dopo = b.casa.dette.filter((una) => una.type === "lovelace/dashboards/update").length;
    assert.equal(dopo, prima, "ha riscritto la voce per dirle la stessa cosa");

    b.plance.soloChiAmministra("primary", false);
    await b.in_casa.sistema();
    assert.equal(b.casa.plance[0].require_admin, false, "la voce e' rimasta chiusa");
    assert.equal(iDetti(url()).solo_admin, undefined);

    /* Le spunte Home Assistant non le sa: finiscono nell'indirizzo, per la
     * frase di chi non e' abilitato, e le fa rispettare l'add-on. */
    b.plance.chiLaVede("primary", [IO]);
    await b.in_casa.sistema();
    assert.equal(iDetti(url()).utenti, IO);
  } finally {
    b.via();
  }
});

test("una Plancia per plancia, nella barra laterale", async () => {
  const b = banco();
  try {
    b.plance.aggiungi("Casa al mare");
    await b.in_casa.sistema();
    assert.deepEqual(
      b.casa.plance.map((una) => [una.url_path, una.title, una.show_in_sidebar, una.require_admin]),
      [
        ["gdahome-primary", "GdAHome", true, false],
        ["gdahome-casa-al-mare", "Casa al mare", true, false],
      ],
    );
    const salvate = b.casa.dette.filter((una) => una.type === "lovelace/config/save");
    assert.deepEqual(
      salvate.map((una) => una.url_path),
      ["gdahome-primary", "gdahome-casa-al-mare"],
    );
  } finally {
    b.via();
  }
});

test("rinominare una plancia cambia il titolo della sua Plancia", async () => {
  const b = banco();
  try {
    const nuova = b.plance.aggiungi("Casa al mare");
    await b.in_casa.sistema();
    b.plance.rinomina(nuova.profilo, "Casa in montagna");
    b.casa.dette.length = 0;
    await b.in_casa.sistema();

    assert.equal(
      b.casa.plance.find((una) => una.url_path === indirizzoDi(nuova))?.title,
      "Casa in montagna",
    );
    assert.deepEqual(
      b.casa.plance.map((una) => una.url_path),
      ["gdahome-primary", "gdahome-casa-al-mare"],
    );
    assert.equal(
      b.casa.dette.some((una) => una.type === "lovelace/dashboards/create"),
      false,
    );
  } finally {
    b.via();
  }
});

test("una plancia che va via si porta dietro la sua Plancia, e nient'altro", async () => {
  const b = banco({
    plance: [
      { id: "sua", url_path: "casa-mia", title: "La mia" },
      { id: "orfana", url_path: "gdahome-di-ieri", title: "Una di ieri" },
    ],
  });
  try {
    const nuova = b.plance.aggiungi("Casa al mare");
    await b.in_casa.sistema();
    assert.deepEqual(
      b.casa.plance.map((una) => una.url_path).sort(),
      ["casa-mia", "gdahome-casa-al-mare", "gdahome-primary"].sort(),
    );

    b.plance.togli(nuova.profilo);
    const esito = await b.in_casa.sistema();
    assert.equal(esito.tolte, 1);
    assert.deepEqual(
      b.casa.plance.map((una) => una.url_path).sort(),
      ["casa-mia", "gdahome-primary"].sort(),
    );
  } finally {
    b.via();
  }
});

test("la prima plancia non si tocca, e non si tocca nemmeno la sua Plancia", async () => {
  const b = banco();
  try {
    await b.in_casa.sistema();
    b.casa.dette.length = 0;
    await b.in_casa.sistema();
    /* Quattro letture e nessuna scrittura: chi usa le tessere, la sua
     * Plancia, la pulizia, il controllo. Leggere non e' toccare. */
    assert.deepEqual(
      b.casa.dette.map((una) => una.type).filter((quale) => quale.includes("dashboards")),
      [
        "lovelace/dashboards/list",
        "lovelace/dashboards/list",
        "lovelace/dashboards/list",
        "lovelace/dashboards/list",
      ],
    );
  } finally {
    b.via();
  }
});

test("la vista non si riscrive se non e' cambiata", async () => {
  const b = banco();
  try {
    await b.in_casa.sistema();
    assert.equal(b.casa.dette.filter((una) => una.type === "lovelace/config/save").length, 1);

    /* Salvare la configurazione di una Plancia la fa ridisegnare a tutte le
     * pagine aperte — e con la «pagina web» vuol dire riaprire la plancia.
     * Lo si fa quando serve (un aggiornamento, un nome cambiato), mai per
     * riscriverci la stessa cosa. */
    b.casa.dette.length = 0;
    await b.in_casa.sistema();
    assert.deepEqual(
      b.casa.dette.filter((una) => una.type === "lovelace/config/save"),
      [],
    );

    b.plance.rinomina("primary", "La mia plancia");
    b.casa.dette.length = 0;
    await b.in_casa.sistema();
    assert.equal(b.casa.dette.filter((una) => una.type === "lovelace/config/save").length, 1);
    assert.equal(b.casa.viste.get("gdahome-primary").views[0].title, "La mia plancia");
  } finally {
    b.via();
  }
});

test("se Lovelace non tiene le risorse — dashboard in YAML — la plancia si apre lo stesso", async () => {
  /* Prima era un guasto: in modalita' YAML le risorse dallo storage Home
   * Assistant non le legge, e la tessera non esisteva. Adesso alla plancia
   * nessuna risorsa serve, e quella casa si vede la plancia come tutte. */
  const b = banco();
  try {
    const vera = b.casa.chiedi;
    b.casa.chiedi = async (comando) => {
      if (String(comando.type).startsWith("lovelace/resources")) {
        throw new Error("lovelace in modalita' YAML");
      }
      return vera(comando);
    };
    const esito = await b.in_casa.sistema();
    assert.equal(esito.fatto, true);
    assert.equal(esito.quante, 1);
    assert.equal(esito.risorsa, "");
    assert.match(esito.risorsa_guaio, /modalita' YAML/);
    assert.equal(esito.risorsa_in_elenco, null);
    assert.equal(esito.tessera_nella_vista, "iframe");
  } finally {
    b.via();
  }
});

test("ma chi la tessera la usa, se la risorsa non si dichiara, lo sente dire", async () => {
  const b = banco({ tessere: true });
  try {
    const vera = b.casa.chiedi;
    b.casa.chiedi = async (comando) => {
      if (String(comando.type).startsWith("lovelace/resources")) {
        throw new Error("lovelace in modalita' YAML");
      }
      return vera(comando);
    };
    const esito = await b.in_casa.sistema();
    assert.equal(esito.fatto, false);
    assert.match(esito.perche, /non si e' dichiarata a Lovelace/);
    /* Ma la Plancia c'e', ed e' la plancia. */
    assert.equal(esito.quante, 1);
    assert.equal(b.casa.viste.get("gdahome-primary").views[0].cards[0].type, "iframe");
  } finally {
    b.via();
  }
});

test("se Home Assistant dice no, il ponte resta in piedi", async () => {
  const b = banco();
  try {
    b.casa.chiedi = async () => {
      throw new Error("lovelace in modalita' YAML");
    };
    const esito = await b.in_casa.sistema();
    assert.equal(esito.fatto, false);
    assert.match(esito.perche, /YAML/);
    assert.equal(esito.quante, 0);
  } finally {
    b.via();
  }
});

test("aggiungere una plancia sistema le Plance da se'", async () => {
  const b = banco();
  try {
    let quanti = 0;
    b.plance.quandoCambia = async () => {
      quanti += 1;
      await b.in_casa.sistema();
    };
    b.plance.aggiungi("Casa al mare");
    await new Promise((ok) => setTimeout(ok, 20));
    assert.equal(quanti, 1);
    assert.deepEqual(
      b.casa.plance.map((una) => una.url_path),
      ["gdahome-primary", "gdahome-casa-al-mare"],
    );
  } finally {
    b.via();
  }
});

test("due giri insieme all'avvio non si pestano i piedi", async () => {
  const b = banco({ tessere: true });
  try {
    await Promise.all([b.in_casa.sistema(), b.in_casa.sistema(), b.in_casa.sistema()]);
    assert.deepEqual(
      b.casa.risorse.map((una) => una.url),
      [STABILE],
    );
    assert.equal(b.casa.plance.length, 1);
  } finally {
    b.via();
  }
});

test("l'indirizzo di una Plancia ha il trattino che Home Assistant vuole", () => {
  assert.equal(indirizzoDi({ profilo: "primary" }), "gdahome-primary");
  assert.match(indirizzoDi({ profilo: "primary" }), /-/);
  assert.equal(DAVANTI, "gdahome-");
});

/* Tutto quello che c'e' dentro una cartella, percorsi relativi, cartelle
 * incluse. */
function tuttoQuelloCheCE(radice, dentro = "") {
  const trovati = [];
  for (const voce of readdirSync(join(radice, dentro), { withFileTypes: true })) {
    const suo = dentro ? `${dentro}/${voce.name}` : voce.name;
    trovati.push(suo);
    if (voce.isDirectory()) trovati.push(...tuttoQuelloCheCE(radice, suo));
  }
  return trovati;
}

test("se la www non c'era, lo dice: Home Assistant va riavviato una volta", async () => {
  const b = banco();
  try {
    assert.equal(existsSync(b.www), false);
    const esito = await b.in_casa.sistema();
    assert.equal(esito.fatto, true);
    assert.equal(esito.riavvia, true);
    /* E si dice **dove** sta la pagina, perche' la console la possa provare
     * da dentro una pagina di Home Assistant. */
    assert.equal(esito.apertura, b.in_casa.indirizzoDellApertura);
    assert.match(esito.apertura, /^\/local\/gdahome\/apri\.html\?v=/);
  } finally {
    b.via();
  }
});

test("se la www c'era gia', non si chiede niente a nessuno", async () => {
  /* La prima installazione in una casa che la `www` l'aveva — quasi tutte
   * quelle con HACS. Era il caso del foglietto «ricarica questa pagina»: la
   * risorsa nata adesso, e la pagina aperta che non l'aveva. Adesso la
   * Plancia nasce con la plancia dentro. */
  const b = banco({ pagina: "si" });
  try {
    mkdirSync(b.www, { recursive: true });
    const esito = await b.in_casa.sistema();
    assert.equal(esito.fatto, true);
    assert.equal(esito.riavvia, false);
    assert.equal(esito.servita, true);
    assert.equal(esito.manca, "");
    assert.equal(esito.ricarica, undefined, "non c'e' piu' niente da ricaricare");
    assert.equal(b.casa.viste.get("gdahome-primary").views[0].cards[0].type, "iframe");
    assert.equal(b.casa.avvisi.size, 0);
    nessunaRicarica(b, "la prima installazione");
  } finally {
    b.via();
  }
});

test("l'esito dice cosa ne pensa Home Assistant, riletto da lui", async () => {
  const b = banco();
  try {
    const esito = await b.in_casa.sistema();
    assert.equal(esito.fatto, true);
    assert.equal(esito.risorsa_in_elenco, false);
    assert.equal(esito.tessera_nella_vista, "iframe");
    assert.equal(
      esito.indirizzo_nella_vista,
      b.casa.viste.get("gdahome-primary").views[0].cards[0].url,
    );
  } finally {
    b.via();
  }
});

test("l'esito elenca tutte le Plance, e dice quali non sono nostre", async () => {
  const b = banco({
    plance: [{ id: "vecchia", url_path: "dashboardmodern", title: "gdahome" }],
  });
  try {
    const esito = await b.in_casa.sistema();
    assert.deepEqual(esito.altre_plance, [
      { dove: "dashboardmodern", titolo: "gdahome", nostra: false },
      { dove: "gdahome-primary", titolo: "GdAHome", nostra: true },
    ]);
    assert.ok(b.casa.plance.some((una) => una.url_path === "dashboardmodern"));
  } finally {
    b.via();
  }
});

/* ─── Quando la plancia non si puo' aprire, e cosa si legge invece ───────────
 *
 * Resta un caso solo: la casa che la cartella `www` non l'aveva, e a cui l'ha
 * fatta l'add-on. Home Assistant apre `/local/` all'avvio, e finche' non
 * riparte la pagina d'apertura non la serve. Quello che manca e' un riavvio di
 * Home Assistant — non una pagina da ricaricare — e appena c'e' stato la
 * plancia compare da sola.
 */

test("se Home Assistant non serve la pagina, nella Plancia c'e' il riavvio, e niente ricarica", async () => {
  const b = banco({ pagina: "no" });
  try {
    const esito = await b.in_casa.sistema();
    assert.equal(esito.servita, false);
    assert.equal(esito.manca, "riavvio");
    assert.deepEqual(b.rete.chiamate, [`http://ha-finta:8123${b.in_casa.indirizzoDellApertura}`]);

    const dentro = b.casa.viste.get("gdahome-primary");
    assert.equal(dentro.views[0].cards.length, 1);
    assert.equal(dentro.views[0].cards[0].type, "markdown");
    assert.equal(dentro.views[0].panel, true);

    const testo = dentro.views[0].cards[0].content;
    assert.match(testo, /Serve riavviare Home Assistant una volta/);
    assert.match(testo, /Impostazioni → Sistema/);
    assert.match(testo, /Restart Home Assistant/);
    assert.match(testo, /da sola/, "si dice che dopo il riavvio non c'e' altro da fare");
    nessunaRicarica(b, "il riavvio");

    const avviso = b.casa.avvisi.get("gdahome_riavvia_home_assistant");
    assert.ok(avviso, "l'avviso in Home Assistant c'e'");
    assert.match(avviso.message, /Riavvia/);
    assert.doesNotMatch(avviso.message, LA_RICARICA);
  } finally {
    b.via();
  }
});

test("e appena la serve, la plancia torna al suo posto e l'avviso si leva", async () => {
  const b = banco({ pagina: "no" });
  try {
    await b.in_casa.sistema();
    assert.equal(b.casa.viste.get("gdahome-primary").views[0].cards[0].type, "markdown");
    assert.equal(b.casa.avvisi.size, 1);

    b.in_casa.prendi = rispondeAllaPagina("si").prendi;
    const esito = await b.in_casa.sistema();
    assert.equal(esito.servita, true);
    assert.equal(b.casa.viste.get("gdahome-primary").views[0].cards[0].type, "iframe");
    assert.equal(b.casa.avvisi.size, 0);
  } finally {
    b.via();
  }
});

test("la guardia ci ripensa da se': l'add-on non si riavvia insieme a Home Assistant", async () => {
  const b = banco({ pagina: "no" });
  try {
    await b.in_casa.sistema();
    b.in_casa.sorveglia(10);
    b.in_casa.prendi = rispondeAllaPagina("si").prendi;

    const scade = Date.now() + 3_000;
    while (Date.now() < scade) {
      if (b.casa.viste.get("gdahome-primary").views[0].cards[0].type !== "markdown") break;
      await new Promise((ok) => setTimeout(ok, 5));
    }
    assert.equal(b.casa.viste.get("gdahome-primary").views[0].cards[0].type, "iframe");
    assert.equal(b.casa.avvisi.size, 0);
    assert.equal(b.in_casa._guardia, null);
  } finally {
    b.in_casa.smettiDiSorvegliare();
    b.via();
  }
});

test("la guardia, dove non c'e' niente da aspettare, si spegne da sola", async () => {
  const b = banco({ pagina: "si" });
  mkdirSync(b.www, { recursive: true });
  try {
    await b.in_casa.sistema();
    b.in_casa.sorveglia(10);
    await new Promise((ok) => setTimeout(ok, 50));
    assert.equal(b.in_casa._guardia, null);
  } finally {
    b.in_casa.smettiDiSorvegliare();
    b.via();
  }
});

test("su un «non lo so» non si manda nessuno a riavviare", async () => {
  for (const come of ["zitto", undefined]) {
    const b = banco(come === undefined ? {} : { pagina: come });
    try {
      const esito = await b.in_casa.sistema();
      assert.equal(esito.servita, null, `«${come}» doveva restare un non lo so`);
      assert.equal(esito.manca, "");
      assert.equal(b.casa.viste.get("gdahome-primary").views[0].cards[0].type, "iframe");
      assert.equal(b.casa.avvisi.size, 0);
    } finally {
      b.via();
    }
  }
});

test("una risposta che non e' la nostra pagina conta come non servita", async () => {
  const b = banco({ pagina: "rotta" });
  try {
    const esito = await b.in_casa.sistema();
    assert.equal(esito.servita, false);
    assert.equal(b.casa.viste.get("gdahome-primary").views[0].cards[0].type, "markdown");
  } finally {
    b.via();
  }
});

test("il foglietto «ricarica questa pagina» non esce in nessun caso", async () => {
  /* Il requisito, detto tutto insieme: prima installazione con e senza `www`,
   * un aggiornamento da una versione con la tessera, la risorsa che nasce
   * per chi installa, la pagina servita, non servita, non so — e il secondo
   * giro di ognuno. In nessuna Plancia, in nessun avviso, in nessuna riga del
   * registro si chiede di ricaricare. */
  const situazioni = [
    { come: "prima installazione, www nuova", pagina: "no" },
    { come: "prima installazione, www c'era", pagina: "si", www: true },
    { come: "non lo so", pagina: "zitto", www: true },
    { come: "risorsa che nasce per chi installa", pagina: "si", www: true, tessere: true },
    {
      come: "aggiornamento con la tessera di prima",
      pagina: "si",
      www: true,
      risorse: [{ id: "r0", url: "/local/gdahome/plancia.js?v=0.20.0", type: "module" }],
      viste: { "gdahome-primary": { views: [{ cards: [{ type: "custom:gdahome-plancia" }] }] } },
    },
  ];
  for (const una of situazioni) {
    const b = banco(una);
    if (una.www) mkdirSync(b.www, { recursive: true });
    try {
      const esito = await b.in_casa.sistema();
      assert.notEqual(esito.manca, "ricarica", una.come);
      await b.in_casa.sistema();
      nessunaRicarica(b, una.come);
      for (const avviso of b.casa.avvisi.values()) {
        assert.doesNotMatch(String(avviso.message), LA_RICARICA, una.come);
      }
    } finally {
      b.via();
    }
  }
});

/* ─── La Plancia rimasta dall'integrazione ─────────────────────────────────── */

test("si riconosce la plancia dell'integrazione, e non quella di chi ci abita", () => {
  const dette = lePlanceDiPrima([
    { dove: "gdahome-primary", titolo: "gdahome", nostra: true },
    { dove: "dashboardmodern", titolo: "DashboardModern v2", nostra: false },
    { dove: "casa-mia", titolo: "Casa 3.0", nostra: false },
    { dove: "tablet-cucina", titolo: "Tablet cucina", nostra: false },
  ]);
  assert.deepEqual(
    dette.map((una) => una.titolo),
    ["DashboardModern v2"],
  );
  assert.equal(
    lePlanceDiPrima([{ dove: "x", titolo: "Dashboard Modern", nostra: false }]).length,
    1,
  );
  assert.equal(
    lePlanceDiPrima([{ dove: "dashboardmodern-2", titolo: "Casa", nostra: false }]).length,
    1,
  );
  assert.deepEqual(
    lePlanceDiPrima([{ dove: "gdahome-x", titolo: "DashboardModern", nostra: true }]),
    [],
  );
  assert.deepEqual(lePlanceDiPrima(null), []);
});

test("e lo si dice a chi ci abita, una volta, e si leva quando non c'e' piu'", async () => {
  const b = banco({
    plance: [{ id: "d9", url_path: "dashboardmodern", title: "DashboardModern v2" }],
    pagina: "si",
  });
  try {
    const esito = await b.in_casa.sistema();
    assert.deepEqual(
      esito.plance_di_prima.map((una) => una.titolo),
      ["DashboardModern v2"],
    );
    const avviso = b.casa.avvisi.get("gdahome_plancia_dell_integrazione");
    assert.ok(avviso);
    assert.match(avviso.message, /DashboardModern v2/);
    assert.match(avviso.message, /Impostazioni → Dashboard/);
    assert.match(avviso.message, /non la tocca/);

    await b.in_casa.sistema();
    assert.equal(b.casa.avvisi.size, 1);

    b.casa.plance.splice(
      b.casa.plance.findIndex((una) => una.url_path === "dashboardmodern"),
      1,
    );
    await b.in_casa.sistema();
    assert.equal(b.casa.avvisi.size, 0);
  } finally {
    b.via();
  }
});

test("una casa senza roba di prima non si sente dire niente", async () => {
  const b = banco({ pagina: "si" });
  try {
    const esito = await b.in_casa.sistema();
    assert.deepEqual(esito.plance_di_prima, []);
    assert.equal(b.casa.avvisi.size, 0);
  } finally {
    b.via();
  }
});

/* ─── La cartina e il caricatore, per chi la tessera la usa ancora ─────────── */

test("il caricatore chiede la versione senza cache e importa la cartina di quella", async () => {
  const b = banco();
  const prima = globalThis.fetch;
  const chieste = [];
  try {
    b.in_casa.versione = "9.9.9";
    b.in_casa.laCarta();
    const cartella = join(b.www, CARTELLA);
    writeFileSync(
      join(cartella, "plancia.js"),
      "globalThis.__cartinaImportata = import.meta.url;\n",
    );
    globalThis.fetch = async (dove, come) => {
      chieste.push({ dove: String(dove), come });
      return {
        ok: true,
        async json() {
          return JSON.parse(readFileSync(join(cartella, "versione.json"), "utf8"));
        },
      };
    };
    delete globalThis.__cartinaImportata;
    await import(pathToFileURL(join(cartella, "caricatore.js")).href);
    for (let i = 0; i < 50 && !globalThis.__cartinaImportata; i += 1) {
      await new Promise((ok) => setTimeout(ok, 10));
    }
    assert.equal(chieste.length, 1);
    assert.match(chieste[0].dove, /\/versione\.json\?t=\d+$/);
    assert.equal(chieste[0].come.cache, "no-store");
    assert.match(String(globalThis.__cartinaImportata), /\/plancia\.js\?v=9\.9\.9$/);
  } finally {
    globalThis.fetch = prima;
    delete globalThis.__cartinaImportata;
    b.via();
  }
});

test("il caricatore e la cartina sul disco sono quelli della repository", async () => {
  const b = banco();
  try {
    await b.in_casa.sistema();
    const scritto = readFileSync(join(b.www, CARTELLA, "caricatore.js"), "utf8");
    assert.equal(scritto, readFileSync(b.in_casa.caricatore, "utf8"));
    assert.doesNotMatch(scritto, /0\.21\.0/);
    const cartina = readFileSync(join(b.www, CARTELLA, "plancia.js"), "utf8");
    assert.equal(cartina, readFileSync(b.in_casa.carta, "utf8"));
    assert.deepEqual(JSON.parse(readFileSync(join(b.www, CARTELLA, "versione.json"), "utf8")), {
      versione: "0.21.0",
      cartina: "plancia.js",
    });
  } finally {
    b.via();
  }
});

test("il cestino non si porta via il Cruscotto e la Gestione, che Plance non sono", async () => {
  const b = banco({
    plance: [
      { id: "cruscotto", url_path: IL_CRUSCOTTO.dove, title: IL_CRUSCOTTO.titolo },
      { id: "gestione", url_path: LA_GESTIONE.dove, title: LA_GESTIONE.titolo },
      { id: "orfana", url_path: "gdahome-di-ieri", title: "Una di ieri" },
    ],
  });
  try {
    const esito = await b.in_casa.sistema();
    assert.equal(esito.tolte, 1, "se ne va l'orfana, e quella sola");
    assert.deepEqual(
      b.casa.plance.map((una) => una.url_path).sort(),
      [IL_CRUSCOTTO.dove, LA_GESTIONE.dove, "gdahome-primary"].sort(),
    );
    assert.equal(
      b.casa.dette.some(
        (una) => una.type === "lovelace/dashboards/delete" && una.dashboard_id !== "orfana",
      ),
      false,
    );
  } finally {
    b.via();
  }
});

/* ─── La plancia servita, con l'accompagnatore in testa ───────────────────── */

test("la pagina della plancia porta l'accompagnatore, che parte da se'", () => {
  /* E' lui che tiene viva la sessione dell'ingress mentre la plancia sta a
   * schermo, e che rimette la barra quando si va via: prima lo faceva la
   * tessera, che adesso non c'e'. */
  const pagina = conLePremesse("<html><head></head><body></body></html>", {
    base: "/x/",
    lingua: "it",
    doveIlWebSocket: "/plancia/api/websocket",
  });
  assert.match(pagina, /window\.__gdahomeAccompagna\b/);
  assert.match(pagina, /__gdahomeAccompagna\.accompagna\(\)/);
  assert.match(pagina, /\/ingress\/validate_session/);
  /* Dentro la testa, prima della pagina. */
  assert.ok(pagina.indexOf("__gdahomeAccompagna") < pagina.indexOf("</head>"));
});

/* ─── Il riavvio, detto in tre posti con le stesse parole ─────────────────────
 *
 * Quando Home Assistant va riavviato lo si dice nella Plancia, nella
 * campanella e nella Panoramica della pagina dell'add-on. Qui si tiene fermo
 * che lo dicano tutti e tre, con le stesse parole, e che nessuno dica
 * «ricarica».
 */

test("la nota nella Plancia dice il riavvio per primo, coi passi, in due lingue", async () => {
  const b = banco({ pagina: "no" });
  try {
    await b.in_casa.sistema();
    const testo = b.casa.viste.get("gdahome-primary").views[0].cards[0].content;
    const righe = testo.split("\n");
    /* La prima cosa che si legge, grossa: cosa serve, e come si fa. */
    assert.equal(righe[0], "## Serve riavviare Home Assistant una volta");
    assert.equal(
      righe[2],
      "**Impostazioni → Sistema → Riavvia (in alto a destra ⏻) → Riavvia Home Assistant**",
    );
    assert.ok(testo.includes(`## ${IL_RIAVVIO.title}`));
    assert.ok(testo.includes(`**${IL_RIAVVIO.steps}**`));
    assert.match(testo, /«GdAHome» è pronta/);
    assert.match(testo, /compare qui da sola/);
    assert.doesNotMatch(testo, LA_RICARICA);
  } finally {
    b.via();
  }
});

test("la campanella dice il riavvio coi passi, e se ne va appena Home Assistant serve la pagina", async () => {
  const b = banco({ pagina: "no" });
  try {
    await b.in_casa.sistema();
    const avviso = b.casa.avvisi.get("gdahome_riavvia_home_assistant");
    assert.ok(avviso, "l'avviso non c'e'");
    assert.equal(avviso.title, "GdAHome: serve riavviare Home Assistant una volta");
    assert.ok(avviso.message.startsWith(`**${IL_RIAVVIO.passi}**`));
    assert.ok(avviso.message.includes(IL_RIAVVIO.steps));
    assert.doesNotMatch(avviso.message, LA_RICARICA);
    /* Un giro dopo, ancora rotto: non se ne fa un secondo. */
    await b.in_casa.sistema();
    assert.equal(
      b.casa.dette.filter(
        (una) =>
          una.type === "call_service" &&
          una.service === "create" &&
          una.service_data.notification_id === "gdahome_riavvia_home_assistant",
      ).length,
      1,
    );

    b.in_casa.prendi = rispondeAllaPagina("si").prendi;
    await b.in_casa.sistema();
    assert.equal(b.casa.avvisi.has("gdahome_riavvia_home_assistant"), false);
  } finally {
    b.via();
  }
});

test("un avviso del riavvio rimasto da un avvio di prima si toglie lo stesso", async () => {
  /* L'add-on ha messo l'avviso, poi e' ripartito: questo giro non sa di
   * averlo messo. Appena Home Assistant serve la pagina se ne va comunque. */
  const b = banco({ pagina: "si" });
  mkdirSync(b.www, { recursive: true });
  try {
    b.casa.avvisi.set("gdahome_riavvia_home_assistant", { title: "vecchio" });
    await b.in_casa.sistema();
    assert.equal(b.casa.avvisi.has("gdahome_riavvia_home_assistant"), false);
    /* E una volta sola: i giri dopo non lo ritolgono a ogni accensione. */
    const prima = b.casa.dette.filter((una) => una.service === "dismiss").length;
    await b.in_casa.sistema();
    assert.equal(b.casa.dette.filter((una) => una.service === "dismiss").length, prima);
  } finally {
    b.via();
  }
});

/* La funzione vera della console, ritagliata dal suo file: e' un copione del
 * browser e non si importa. Le si da' il `due()` della pagina. */
function dallaConsole(nome, lingua = "it") {
  const sorgente = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "console", "console.js"),
    "utf8",
  );
  const inizio = sorgente.indexOf(`function ${nome}(`);
  assert.ok(inizio > 0, `la console non ha piu' ${nome}`);
  let profondo = 0;
  let fine = inizio;
  for (let i = sorgente.indexOf("{", inizio); i < sorgente.length; i += 1) {
    if (sorgente[i] === "{") profondo += 1;
    else if (sorgente[i] === "}") {
      profondo -= 1;
      if (!profondo) {
        fine = i + 1;
        break;
      }
    }
  }
  return new Function("due", `${sorgente.slice(inizio, fine)}; return ${nome};`)((it, en) =>
    lingua === "it" ? it : en,
  );
}

test("nella Panoramica della console c'e' la riga «Serve riavviare Home Assistant», con le stesse parole", () => {
  const it = dallaConsole("laRigaDelRiavvio", "it");
  const en = dallaConsole("laRigaDelRiavvio", "en");

  /* Le stesse parole della Plancia e della campanella. */
  const riga = it({ manca: "riavvio" }, "");
  assert.equal(riga.serve, true);
  assert.equal(riga.titolo, IL_RIAVVIO.titolo);
  assert.equal(riga.passi, IL_RIAVVIO.passi);
  assert.equal(en({ manca: "riavvio" }, "").titolo, IL_RIAVVIO.title);
  assert.equal(en({ manca: "riavvio" }, "").passi, IL_RIAVVIO.steps);
  for (const detto of [riga, en({ manca: "riavvio" }, "")]) {
    assert.doesNotMatch(JSON.stringify(detto), LA_RICARICA);
  }

  /* Si accende col «non c'e'» del ponte o con quello della prova fatta dalla
   * pagina; un «non lo so» o una plancia che si apre la lasciano spenta. */
  assert.equal(it({ manca: "" }, "no").serve, true);
  assert.equal(it({ manca: "" }, "si").serve, false);
  assert.equal(it({ manca: "" }, "").serve, false);
  assert.equal(it(null, "").serve, false);

  /* La riga sta in cima alla Panoramica, nascosta finche' non serve, e conta
   * fra le cose che non vanno (il numerino sulla linguetta). */
  const QUI = dirname(fileURLToPath(import.meta.url));
  const pagina = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");
  const panoramica = pagina.slice(
    pagina.indexOf('id="sezione-panoramica"'),
    pagina.indexOf('id="faccia-fuori"'),
  );
  assert.match(panoramica, /<li id="voce-riavvio" hidden>/);
  assert.match(panoramica, /Serve riavviare Home Assistant una volta/);
  const programma = readFileSync(join(QUI, "..", "console", "console.js"), "utf8");
  assert.match(programma, /"pas-casa", "pas-fuori", "pas-plancia", "pas-riavvio"/);
  assert.match(programma, /disegnaIlRiavvio\(stato\.plance_in_casa\)/);
});
