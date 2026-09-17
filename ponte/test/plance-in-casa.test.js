/* Le plance fra le «Plance» di Home Assistant.
 *
 * Quello che qui si tiene fermo non e' «funziona»: e' **cosa** il ponte fa
 * dentro la casa di qualcun altro, adesso che per questo mestiere gli serve
 * poter scrivere nella cartella di Home Assistant.
 *
 *  - scrive **un percorso solo**, e quel percorso comincia per `www/gdahome/`.
 *    Li' dentro ci sono automazioni, temi e segreti di chi ci abita, e Home
 *    Assistant non sa mappare una sottocartella: il permesso e' grosso, e la
 *    prova e' il modo di dire fin dove si arriva;
 *  - dichiara la cartina a Lovelace, e con la versione dentro l'indirizzo:
 *    senza, il browser terrebbe quella di ieri e `custom:` non esisterebbe;
 *  - una Plancia per plancia, una vista sola a pagina intera;
 *  - quando una plancia cambia nome la Plancia cambia titolo, e quando una
 *    plancia va via la sua Plancia va via;
 *  - e non tocca le Plance di nessun altro.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CARTELLA,
  DAVANTI,
  PlanceInCasa,
  indirizzoDi,
  lePlanceDiPrima,
} from "../src/plance-in-casa.js";
import { Plance } from "../src/plance.js";

/* Una Home Assistant finta al livello dei comandi: tiene le Plance e le
 * risorse in memoria, come le tiene lei, e mette in fila tutto quello che le
 * arriva — perche' meta' di questa prova e' **quali** comandi partono. */
function casaFinta({ plance = [], risorse = [] } = {}) {
  const dette = [];
  const viste = new Map();
  const avvisi = new Map();
  let contatore = 0;
  return {
    dette,
    plance,
    risorse,
    viste,
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
        case "lovelace/config": {
          const quale = viste.get(comando.url_path);
          if (!quale) throw new Error("config_not_found");
          return JSON.parse(JSON.stringify(quale));
        }
        case "lovelace/config/save":
          viste.set(comando.url_path, JSON.parse(JSON.stringify(comando.config)));
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

/* Cosa risponde Home Assistant a chi gli chiede la cartina.
 *
 * Tre risposte, e sono le tre che si prendono davvero: `si` la serve, `no` non
 * l'ha (`/local/` aperto all'avvio, cartella `www` fatta da noi dopo), `zitto`
 * non risponde — e quella non e' un «no», e' un «non lo so». */
function rispondeAllaCartina(come) {
  const chiamate = [];
  const prendi = async (dove) => {
    chiamate.push(String(dove));
    if (come === "no")
      return {
        ok: false,
        status: 404,
        async text() {
          return "niente";
        },
      };
    if (come === "rotta")
      return {
        ok: true,
        status: 200,
        async text() {
          return "// vuota";
        },
      };
    if (come === "si") {
      return {
        ok: true,
        status: 200,
        async text() {
          return 'customElements.define("gdahome-plancia", Plancia);';
        },
      };
    }
    throw new Error("Home Assistant non risponde");
  };
  return { prendi, chiamate };
}

/* Quello che l'add-on scrive nei suoi log. C'e' roba che si dice **solo**
 * li' — un avviso per chi apre i log dell'add-on — e senza questo non si
 * poteva provare. */
function unRegistro() {
  const detto = { info: [], avvisi: [], errori: [] };
  return {
    detto,
    info: (una) => detto.info.push(String(una)),
    attenzione: (una) => detto.avvisi.push(String(una)),
    errore: (una) => detto.errori.push(String(una)),
  };
}

function banco({ plance: dentro, risorse, cartina } = {}) {
  const radice = mkdtempSync(join(tmpdir(), "plance-in-casa-"));
  /* La cartella della configurazione esiste, `www` no: e' come sta una casa
   * appena installata, e la `www` la fa il ponte. */
  const casaSuDisco = join(radice, "config");
  mkdirSync(casaSuDisco, { recursive: true });
  const www = join(casaSuDisco, "www");
  const plance = new Plance({ cartella: radice });
  const casa = casaFinta({ plance: dentro, risorse });
  /* Chi non dice niente di `cartina` resta come prima: una casa che non sa
   * dove stiano i suoi file statici, cioe' un «non lo so», cioe' la vista
   * vera. Le prove di prima non cambiano di una riga. */
  const rete = cartina === undefined ? null : rispondeAllaCartina(cartina);
  if (rete) casa.doveStaLaPlancia = async () => "http://ha-finta:8123";
  const registro = unRegistro();
  const in_casa = new PlanceInCasa({
    casa,
    plance,
    www,
    versione: "0.21.0",
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

/* La risorsa gia' dichiarata, con l'indirizzo che il ponte le da'.
 *
 * Serve a mettere il banco nello **stato di regime**: la prima volta che
 * l'add-on gira in una casa la dichiara lui, e in quel momento la pagina
 * aperta quel modulo non l'ha caricato — quindi nella Plancia ci va il
 * foglietto che dice di ricaricare, non la tessera. Le prove che guardano la
 * vista vera partono da dopo. */
const RISORSA_CE = [{ id: "r0", url: "/local/gdahome/plancia.js?v=0.21.0", type: "module" }];

test("scrive un file solo, e sta sotto www/gdahome", async () => {
  const b = banco();
  try {
    /* Il percorso, prima di toccare il disco: e' l'unico che questa classe
     * conosce, e lo dice un metodo suo perche' questa riga lo possa guardare. */
    assert.equal(b.in_casa.doveVaLaCarta, join(b.www, CARTELLA, "plancia.js"));

    const esito = await b.in_casa.sistema();
    assert.equal(esito.fatto, true);

    /* E adesso quello che c'e' davvero sul disco: tutto quello che e' comparso
     * dentro la cartella di Home Assistant. Non «il file che mi aspettavo c'e'»
     * — quello lo direbbe anche uno che ne ha scritti altri dieci — ma
     * **l'elenco intero**, confrontato riga per riga. */
    const comparsi = tuttoQuelloCheCE(b.casaSuDisco);
    assert.deepEqual(comparsi.sort(), [
      "www",
      "www/gdahome",
      "www/gdahome/LEGGIMI.txt",
      "www/gdahome/plancia.js",
    ]);

    /* Ed e' la cartina, non qualcosa che le somiglia. */
    const scritta = readFileSync(join(b.www, CARTELLA, "plancia.js"), "utf8");
    assert.match(scritta, /const NOME = "gdahome-plancia";/);
    assert.match(scritta, /customElements\.define\(NOME, PlanciaDiGdahome\)/);
    assert.equal(scritta, readFileSync(b.in_casa.carta, "utf8"));
  } finally {
    b.via();
  }
});

test("dove non c'e' nessuna Home Assistant non scrive niente", async () => {
  const radice = mkdtempSync(join(tmpdir(), "plance-senza-casa-"));
  try {
    const plance = new Plance({ cartella: radice });
    const casa = casaFinta();
    /* Una cartella che non c'e', dentro una che non c'e': e' come sta un ponte
     * su un banco di prova, o sul computer di chi lo sviluppa. */
    const www = join(radice, "non-c-e", "www");
    const in_casa = new PlanceInCasa({ casa, plance, www });
    assert.equal(in_casa.cE, false);
    const esito = await in_casa.sistema();
    assert.equal(esito.fatto, false);
    /* E soprattutto: niente cartelle fabbricate a caso, e nessun comando
     * partito verso una casa che non c'e'. */
    assert.equal(existsSync(join(radice, "non-c-e")), false);
    assert.deepEqual(casa.dette, []);
  } finally {
    rmSync(radice, { recursive: true, force: true });
  }
});

test("la cartina si dichiara a Lovelace, con la versione dentro l'indirizzo", async () => {
  const b = banco();
  try {
    await b.in_casa.sistema();
    assert.deepEqual(b.casa.risorse, [
      { id: "r1", url: "/local/gdahome/plancia.js?v=0.21.0", type: "module" },
    ]);

    /* Un altro giro non la dichiara due volte. */
    b.casa.dette.length = 0;
    await b.in_casa.sistema();
    assert.equal(b.casa.risorse.length, 1);
    assert.equal(
      b.casa.dette.some((una) => una.type === "lovelace/resources/create"),
      false,
    );

    /* Ma un ponte nuovo, con una versione nuova, le cambia l'indirizzo: se no
     * il browser si terrebbe la cartina di ieri, e una plancia che non si apre
     * per un file in cache e' la peggiore delle segnalazioni. */
    const dopo = new PlanceInCasa({
      casa: b.casa,
      plance: b.plance,
      www: b.www,
      versione: "0.22.0",
    });
    await dopo.sistema();
    assert.deepEqual(b.casa.risorse, [
      { id: "r1", url: "/local/gdahome/plancia.js?v=0.22.0", type: "module" },
    ]);
  } finally {
    b.via();
  }
});

test("«solo amministratori» finisce sulla voce di Home Assistant, e nella cartina", async () => {
  /* Questa e' la meta' che fa Home Assistant da se': con `require_admin` quella
   * voce non compare nella barra laterale di chi non amministra, e la sua
   * configurazione non gliela da'. L'altra meta' — l'add-on che rifiuta la
   * pagina a chi ci arriva per un'altra strada — sta in «plancia-in-casa».
   *
   * E si guarda anche che si **spenga**: una voce rimasta per sempre solo
   * degli amministratori perche' nessuno ha riscritto quella riga sarebbe un
   * guaio che si scopre mesi dopo. */
  const b = banco();
  const IO = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
  try {
    await b.in_casa.sistema();
    /* Di serie no: la plancia la guarda anche chi abita la casa. */
    assert.equal(b.casa.plance[0].require_admin, false);

    b.plance.soloChiAmministra("primary", true);
    await b.in_casa.sistema();
    assert.equal(b.casa.plance[0].require_admin, true, "la voce non lo ha saputo");

    /* E la cartina se lo porta dietro, per dirlo invece di restare bianca. */
    const dentro = b.casa.viste.get("gdahome-primary");
    assert.equal(dentro.views[0].cards[0].solo_admin, true);

    /* Riscrivere la stessa cosa non manda un aggiornamento: salvare una
     * Plancia fa ridisegnare tutte le pagine aperte di Home Assistant, e non
     * si fa per niente. */
    const prima = b.casa.dette.filter((una) => una.type === "lovelace/dashboards/update").length;
    await b.in_casa.sistema();
    const dopo = b.casa.dette.filter((una) => una.type === "lovelace/dashboards/update").length;
    assert.equal(dopo, prima, "ha riscritto la voce per dirle la stessa cosa");

    /* Spegnendola, la voce torna di tutti. */
    b.plance.soloChiAmministra("primary", false);
    await b.in_casa.sistema();
    assert.equal(b.casa.plance[0].require_admin, false, "la voce e' rimasta chiusa");

    /* Le spunte, invece, Home Assistant non le sa e non le deve sapere: quelle
     * le fa rispettare l'add-on. Finiscono solo dentro la cartina. */
    b.plance.chiLaVede("primary", [IO]);
    await b.in_casa.sistema();
    assert.deepEqual(b.casa.viste.get("gdahome-primary").views[0].cards[0].utenti, [IO]);
  } finally {
    b.via();
  }
});

test("una Plancia per plancia, e la vista e' una pagina intera", async () => {
  const b = banco({ risorse: RISORSA_CE });
  try {
    b.plance.aggiungi("Casa al mare");
    await b.in_casa.sistema();

    assert.deepEqual(
      b.casa.plance.map((una) => [una.url_path, una.title, una.show_in_sidebar, una.require_admin]),
      [
        ["gdahome-primary", "gdahome", true, false],
        ["gdahome-casa-al-mare", "Casa al mare", true, false],
      ],
    );

    const salvate = b.casa.dette.filter((una) => una.type === "lovelace/config/save");
    assert.deepEqual(
      salvate.map((una) => una.url_path),
      ["gdahome-primary", "gdahome-casa-al-mare"],
    );
    /* Una vista sola, a pagina intera, e dentro la cartina. `panel: true` e non
     * una griglia: la plancia e' una pagina, e in una colonna da quattrocento
     * punti sarebbe illeggibile. */
    assert.deepEqual(salvate[1].config, {
      views: [
        {
          title: "Casa al mare",
          panel: true,
          cards: [
            {
              type: "custom:gdahome-plancia",
              profilo: "casa-al-mare",
              addon: "",
              ingresso: "",
              /* Chi la vede, e come si chiama: servono alla cartina per dire
               * «non e' abilitata per te» invece di restare bianca. Vuoto
               * vuol dire tutti. */
              utenti: [],
              titolo: "Casa al mare",
              solo_admin: false,
            },
          ],
        },
      ],
    });
    /* La prima non dice quale aprire: e' la risposta di sempre, ed e' quella
     * che il ponte da' a chi non chiede niente. */
    assert.equal(salvate[0].config.views[0].cards[0].profilo, "");
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
    /* Il titolo si cambia, l'indirizzo no: cambiarlo vorrebbe dire che chi si
     * era messo quella Plancia fra i preferiti si ritrova un link morto. */
    assert.deepEqual(
      b.casa.plance.map((una) => una.url_path),
      ["gdahome-primary", "gdahome-casa-al-mare"],
    );
    /* E non se ne fabbrica una seconda. */
    assert.equal(
      b.casa.dette.some((una) => una.type === "lovelace/dashboards/create"),
      false,
    );
  } finally {
    b.via();
  }
});

test("una plancia che va via si porta dietro la sua Plancia, e nient'altro", async () => {
  /* Una Plancia scritta a mano da chi ci abita, e una che sembra nostra ma non
   * lo e': la seconda serve perche' il filtro non e' «tutto quello che comincia
   * per gdahome-», e' «quello che comincia per gdahome- e non e' di nessuna
   * plancia» — cioe' proprio quella che va tolta. */
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
    /* Un secondo giro, senza che niente sia cambiato: la Plancia c'e' gia', il
     * titolo e' quello, e non si crea e non si rinomina niente. */
    await b.in_casa.sistema();
    /* Tre letture e nessuna scrittura: l'elenco per trovare la sua Plancia,
     * quello della pulizia, e quello del controllo — che rilegge da Home
     * Assistant com'e' rimasta la casa. Leggere non e' toccare; quello che
     * questa prova tiene fermo e' che non ci sia nessun `create`, `update` o
     * `delete`. */
    assert.deepEqual(
      b.casa.dette.map((una) => una.type).filter((quale) => quale.includes("dashboards")),
      ["lovelace/dashboards/list", "lovelace/dashboards/list", "lovelace/dashboards/list"],
    );
  } finally {
    b.via();
  }
});

test("la vista non si riscrive se non e' cambiata", async () => {
  const b = banco({ risorse: RISORSA_CE });
  try {
    await b.in_casa.sistema();
    assert.equal(b.casa.dette.filter((una) => una.type === "lovelace/config/save").length, 1);

    /* Un secondo avvio, senza che niente sia cambiato: niente da riscrivere.
     *
     * Non e' per risparmiare una scrittura: salvare la configurazione di una
     * Plancia manda un `lovelace_updated` a tutte le pagine di Home Assistant
     * aperte, e quelle si ridisegnano. Senza questo, ogni riavvio dell'add-on
     * farebbe lampeggiare il tablet in cucina. */
    b.casa.dette.length = 0;
    await b.in_casa.sistema();
    assert.deepEqual(
      b.casa.dette.filter((una) => una.type === "lovelace/config/save"),
      [],
    );

    /* Ma se cambia davvero — una plancia rinominata, e il titolo sta anche
     * dentro la vista — la si riscrive. */
    b.plance.rinomina("primary", "La mia plancia");
    b.casa.dette.length = 0;
    await b.in_casa.sistema();
    assert.equal(b.casa.dette.filter((una) => una.type === "lovelace/config/save").length, 1);
    assert.equal(b.casa.viste.get("gdahome-primary").views[0].title, "La mia plancia");
  } finally {
    b.via();
  }
});

test("se la risorsa non si dichiara, le Plance si fanno comunque", async () => {
  /* Il difetto che questa prova tiene fermo, e che c'e' stato davvero.
   *
   * I tre pezzi stavano in un `try` solo: se la cartina non si dichiarava a
   * Lovelace — modalita' YAML, un permesso che manca, una versione di Home
   * Assistant che quel comando non ce l'ha — saltava anche la creazione delle
   * Plance. Cioe' la voce nella barra laterale non compariva **per un motivo
   * che non la riguardava**, e a chi guardava sembrava che non funzionasse
   * niente. Adesso quello che riesce riesce. */
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

    /* Non e' «a posto», e lo dice per nome. */
    assert.equal(esito.fatto, false);
    assert.match(esito.perche, /non si e' dichiarata a Lovelace/);
    /* Ma la Plancia c'e', ed e' quello che si vede nella barra laterale. */
    assert.equal(esito.quante, 1);
    assert.deepEqual(
      b.casa.plance.map((una) => una.url_path),
      ["gdahome-primary"],
    );
    /* E l'esito resta da parte, perche' la console lo mostri: un guasto che si
     * legge solo nel registro e' un guasto che nessuno legge. */
    assert.equal(b.in_casa.esito.fatto, false);
    assert.match(b.in_casa.esito.quando, /^\d{4}-\d{2}-\d{2}T/);

    /* E **cosa ha risposto Lovelace**, parola per parola, in un campo suo.
     *
     * Non e' lo stesso che averlo dentro `perche`: la console su questo campo
     * cambia consiglio — una cartina che Lovelace non dichiara non si aggiusta
     * ricaricando la pagina ne' riavviando Home Assistant, va scritta a mano in
     * `configuration.yaml` — e per cambiare consiglio deve poterlo riconoscere
     * senza leggere una frase. */
    assert.equal(esito.risorsa, "");
    assert.match(esito.risorsa_guaio, /modalita' YAML/);
  } finally {
    b.via();
  }
});

test("se Home Assistant dice no, il ponte resta in piedi", async () => {
  const b = banco();
  try {
    /* Lovelace in modalita' YAML: le Plance non si aggiungono da fuori, e Home
     * Assistant lo dice con un errore. Non e' un guasto del ponte, e non deve
     * portarselo dietro: la plancia dall'app e dall'ingress funziona uguale. */
    b.casa.chiedi = async () => {
      throw new Error("lovelace in modalita' YAML");
    };
    const esito = await b.in_casa.sistema();
    assert.equal(esito.fatto, false);
    assert.match(esito.perche, /YAML/);
    /* E niente Plance: quando non risponde a nessun comando, non c'e' niente
     * da salvare a meta'. */
    assert.equal(esito.quante, 0);
  } finally {
    b.via();
  }
});

test("aggiungere una plancia sistema le Plance da se'", async () => {
  const b = banco();
  try {
    /* Il giro intero, come gira nell'add-on: chi aggiunge una plancia dalla
     * scheda o dall'app non deve riavviare niente per vederla nella barra
     * laterale. La cucitura sta in `plance.quandoCambia`, e questa riga e' il
     * solo posto che tiene fermo che sia attaccata. */
    let quanti = 0;
    b.plance.quandoCambia = async () => {
      quanti += 1;
      await b.in_casa.sistema();
    };
    b.plance.aggiungi("Casa al mare");
    /* `quandoCambia` non si aspetta — chi ha aggiunto una plancia ha gia' la
     * sua risposta — quindi si lascia girare il giro. */
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

test("l'indirizzo di una Plancia ha il trattino che Home Assistant vuole", () => {
  /* Non e' estetica: Home Assistant rifiuta l'indirizzo di una Plancia senza
   * trattino, per non confonderla coi suoi pannelli. `primary` da solo non
   * passerebbe, `gdahome-primary` si'. */
  assert.equal(indirizzoDi({ profilo: "primary" }), "gdahome-primary");
  assert.match(indirizzoDi({ profilo: "primary" }), /-/);
  assert.equal(DAVANTI, "gdahome-");
});

/* Tutto quello che c'e' dentro una cartella, percorsi relativi, cartelle
 * incluse. Serve a una riga sola, e quella riga e' il motivo per cui questo
 * add-on puo' scrivere nella cartella di Home Assistant. */
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
  /* Il difetto che non somiglia a un difetto.
   *
   * Home Assistant apre `/local/` **all'avvio**, guardando se la cartella `www`
   * c'e'. In una casa che non l'ha mai usata non c'e', e la fa il ponte al
   * primo avvio: da quel momento il file sta sul disco, e' dichiarato a
   * Lovelace, la Plancia c'e' nella barra laterale — e aprendola esce «Errore
   * di configurazione» e niente altro, perche' `/local/gdahome/plancia.js`
   * risponde «non c'e'» e Home Assistant il motivo non lo scrive (lo mostra
   * solo dentro l'editor delle tessere).
   *
   * Chi lo vede non ha nessun modo di arrivare a «riavvia Home Assistant».
   * Quindi lo dice l'add-on, nella sua scheda. */
  const b = banco();
  try {
    assert.equal(existsSync(b.www), false);
    const esito = await b.in_casa.sistema();
    assert.equal(esito.fatto, true);
    assert.equal(esito.riavvia, true);

    /* E si dice **dove** sta la cartina, perche' da qui dentro «Home Assistant
     * la serve?» non si sa: lo sa la console, che gira dentro una sua pagina e
     * da li' la puo' chiedere. */
    assert.equal(esito.cartina, b.in_casa.indirizzoDellaCarta);
    assert.match(esito.cartina, /^\/local\/gdahome\/plancia\.js\?v=/);
  } finally {
    b.via();
  }
});

test("se la www c'era gia', non si chiede nessun riavvio", async () => {
  const b = banco();
  try {
    /* Come sta una casa dove qualcuno ha gia' messo una foto in `www`: li'
     * Home Assistant `/local/` l'ha aperto al suo avvio, e i file nuovi li
     * serve subito. */
    mkdirSync(b.www, { recursive: true });
    const esito = await b.in_casa.sistema();
    assert.equal(esito.fatto, true);
    assert.equal(esito.riavvia, false);
    /* La cartina e' comunque stata dichiarata adesso, e quello si dice: il
     * browser una risorsa nuova la va a prendere al giro dopo. */
    assert.equal(esito.ricarica, true);
    assert.equal(esito.risorsa, "aggiunta");
    assert.equal(esito.risorsa_guaio, "");
  } finally {
    b.via();
  }
});

test("al secondo avvio non si chiede ne' riavvio ne' ricarica", async () => {
  const b = banco();
  try {
    mkdirSync(b.www, { recursive: true });
    await b.in_casa.sistema();
    /* Lo stesso ponte, un'altra volta: la cartina c'e', la risorsa c'e', e non
     * c'e' niente da chiedere a nessuno. Un avviso che resta a schermo quando
     * non serve piu' e' un avviso che nessuno legge la volta che serve. */
    const dinuovo = new PlanceInCasa({
      casa: b.casa,
      plance: b.plance,
      www: b.www,
      versione: "0.21.0",
    });
    const esito = await dinuovo.sistema();
    assert.equal(esito.fatto, true);
    assert.equal(esito.riavvia, false);
    assert.equal(esito.ricarica, false);
  } finally {
    b.via();
  }
});

test("l'esito dice cosa ne pensa Home Assistant, riletto da lui", async () => {
  /* Tre passaggi riusciti non vogliono dire che Home Assistant l'abbia preso.
   * Le risposte le abbiamo viste noi; questa riga dice cosa c'e' scritto **da
   * lui** adesso — se la cartina e' nel suo elenco delle risorse, e che tessera
   * c'e' davvero nella Plancia. Sono i due fatti che mancavano a chi guarda una
   * plancia che esce con «Errore di configurazione». */
  const b = banco({ risorse: RISORSA_CE });
  try {
    const esito = await b.in_casa.sistema();
    assert.equal(esito.fatto, true);
    assert.equal(esito.risorsa_in_elenco, true);
    assert.equal(esito.tessera_nella_vista, "custom:gdahome-plancia");
  } finally {
    b.via();
  }
});

test("se Lovelace non tiene le risorse, l'esito lo dice invece di tacere", async () => {
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

    /* «Non lo so» e «no» sono due cose diverse: qui non si e' potuto chiedere,
     * e dirlo come un «no» manderebbe chi legge a cercare dalla parte
     * sbagliata. */
    assert.equal(esito.risorsa_in_elenco, null);
    /* Ma la Plancia c'e' lo stesso, e dentro c'e' la tessera giusta: il pezzo
     * che manca e' uno solo, e adesso si vede quale. */
    assert.equal(esito.tessera_nella_vista, "custom:gdahome-plancia");
  } finally {
    b.via();
  }
});

test("l'esito elenca tutte le Plance, e dice quali non sono nostre", async () => {
  /* La casa che ha avuto l'integrazione di DashboardModern si ritrova le sue
   * Plance ancora li', con dentro la tessera di un pannello che non esiste
   * piu': quelle si aprono con «Errore di configurazione» per sempre, e questo
   * add-on non ci puo' fare niente — non sono sue, e le Plance di qualcun altro
   * non si toccano. Ma se nella barra laterale ce n'e' una nostra che si chiama
   * uguale, chi guarda non ha modo di sapere quale ha aperto. Allora si
   * elencano tutte, e si dice quali sono nostre. */
  const b = banco({
    plance: [{ id: "vecchia", url_path: "dashboardmodern", title: "gdahome" }],
  });
  try {
    const esito = await b.in_casa.sistema();
    assert.deepEqual(esito.altre_plance, [
      { dove: "dashboardmodern", titolo: "gdahome", nostra: false },
      { dove: "gdahome-primary", titolo: "gdahome", nostra: true },
    ]);
    /* E quella di qualcun altro resta dov'e': si guarda, non si tocca. */
    assert.ok(b.casa.plance.some((una) => una.url_path === "dashboardmodern"));
  } finally {
    b.via();
  }
});

/* ─── Quando la plancia non si puo' aprire, e cosa si legge invece ───────────
 *
 * E' il difetto che ha fatto scrivere «errore di configurazione» a due persone
 * il giorno del rilascio, e la parte peggiore non era che non si aprisse: era
 * che non si capisse. Home Assistant apre `/local/` **all'avvio**; in una casa
 * che la cartella `www` non l'aveva — quasi tutte — quella cartella l'ha fatta
 * l'add-on un momento prima, e finche' Home Assistant non riparte quel file
 * non lo serve. La voce nella barra laterale c'e', la Plancia c'e', la cartina
 * e' dichiarata: e la pagina esce con «Errore di configurazione», che di
 * motivi non ne da' nessuno.
 *
 * Quindi quello che si tiene fermo qui non e' «funziona»: e' **cosa c'e'
 * scritto sullo schermo di chi ha appena installato l'add-on**, nel momento in
 * cui la cosa e' rotta, e che ci torni la plancia da se' quando non lo e' piu'.
 */

test("se Home Assistant non serve la cartina, nella Plancia ci va una frase e non un errore", async () => {
  const b = banco({ cartina: "no" });
  try {
    const esito = await b.in_casa.sistema();
    assert.equal(esito.servita, false, "Home Assistant ha detto che non ce l'ha");

    /* Gliel'ha chiesta, e all'indirizzo giusto — con la versione dentro, che
     * e' quella che fa riprendere il file al browser invece di tenersi quello
     * di ieri. */
    assert.deepEqual(b.rete.chiamate, ["http://ha-finta:8123/local/gdahome/plancia.js?v=0.21.0"]);

    /* E la vista scritta e' quella che si apre **sempre**: una tessera di Home
     * Assistant, che non ha bisogno di nessuna cartina. */
    const dentro = b.casa.viste.get("gdahome-primary");
    assert.equal(dentro.views[0].cards.length, 1);
    assert.equal(dentro.views[0].cards[0].type, "markdown");
    assert.equal(dentro.views[0].panel, true);

    /* Cosa c'e' scritto conta piu' del fatto che ci sia scritto qualcosa: il
     * passaggio da fare, e dove si fa. */
    const testo = dentro.views[0].cards[0].content;
    assert.match(testo, /Home Assistant va riavviato/);
    assert.match(testo, /Impostazioni → Sistema/);
    assert.match(testo, /Restart Home Assistant/, "anche per chi non legge l'italiano");
    assert.doesNotMatch(testo, /Errore di configurazione/, "non si ripete l'errore, si spiega");

    /* E lo dice dove chi ci abita guarda: la campanella di Home Assistant. Il
     * registro dell'add-on non basta — le due persone che l'hanno visto non
     * avevano nessun motivo di aprirlo. */
    const avviso = b.casa.avvisi.get("gdahome_riavvia_home_assistant");
    assert.ok(avviso, "l'avviso in Home Assistant c'e'");
    assert.match(avviso.message, /Riavvia/);
  } finally {
    b.via();
  }
});

test("e appena la serve, la plancia torna al suo posto e l'avviso si leva", async () => {
  const b = banco({ cartina: "no" });
  try {
    await b.in_casa.sistema();
    assert.equal(b.casa.viste.get("gdahome-primary").views[0].cards[0].type, "markdown");
    assert.equal(b.casa.avvisi.size, 1);

    /* Home Assistant e' ripartito: adesso la cartina la serve. */
    b.in_casa.prendi = rispondeAllaCartina("si").prendi;
    const esito = await b.in_casa.sistema();

    assert.equal(esito.servita, true);
    assert.equal(
      b.casa.viste.get("gdahome-primary").views[0].cards[0].type,
      "custom:gdahome-plancia",
    );
    assert.equal(b.casa.avvisi.size, 0, "un avviso che resta appeso non lo legge piu' nessuno");
  } finally {
    b.via();
  }
});

test("la guardia ci ripensa da se': l'add-on non si riavvia insieme a Home Assistant", async () => {
  /* Senza questa, il foglietto resterebbe al posto della plancia **per
   * sempre**: chi ci abita riavvia Home Assistant un'ora dopo, e l'add-on non
   * riparte con lui — nessuno riguarda niente. */
  const b = banco({ cartina: "no" });
  try {
    await b.in_casa.sistema();
    assert.equal(b.casa.viste.get("gdahome-primary").views[0].cards[0].type, "markdown");

    b.in_casa.sorveglia(10);
    b.in_casa.prendi = rispondeAllaCartina("si").prendi;

    const scade = Date.now() + 3_000;
    while (Date.now() < scade) {
      if (b.casa.viste.get("gdahome-primary").views[0].cards[0].type !== "markdown") break;
      await new Promise((ok) => setTimeout(ok, 5));
    }
    assert.equal(
      b.casa.viste.get("gdahome-primary").views[0].cards[0].type,
      "custom:gdahome-plancia",
      "la guardia doveva rimettere la plancia",
    );
    assert.equal(b.casa.avvisi.size, 0);
    /* E si spegne: una guardia che continua a guardare una cosa sistemata e'
     * una richiesta ogni cinque minuti per niente, per sempre. */
    assert.equal(b.in_casa._guardia, null);
  } finally {
    b.in_casa.smettiDiSorvegliare();
    b.via();
  }
});

test("su un «non lo so» non si manda nessuno a riavviare", async () => {
  /* Fuori da un add-on, o con Home Assistant che non risponde, la risposta e'
   * `null` — e `null` non e' «no». Dire a chi ci abita di riavviare Home
   * Assistant per un dubbio nostro vorrebbe dire togliergli la plancia per
   * niente. Quindi: niente foglietto del riavvio, e nessun avviso. */
  for (const come of ["zitto", undefined]) {
    const b = banco(
      come === undefined ? { risorse: RISORSA_CE } : { cartina: come, risorse: RISORSA_CE },
    );
    try {
      const esito = await b.in_casa.sistema();
      assert.equal(esito.servita, null, `«${come}» doveva restare un non lo so`);
      assert.equal(esito.manca, "", "un dubbio non e' un motivo per cambiare la pagina");
      assert.equal(
        b.casa.viste.get("gdahome-primary").views[0].cards[0].type,
        "custom:gdahome-plancia",
      );
      assert.equal(b.casa.avvisi.size, 0, "e non si avvisa di niente");
    } finally {
      b.via();
    }
  }
});

test("la prima volta, nella Plancia ci va «ricarica la pagina» e non l'errore nudo", async () => {
  /* E' il caso che mancava, ed e' il piu' frequente: la casa ha la cartella
   * `www` da sempre — gliel'ha fatta HACS — quindi Home Assistant il file lo
   * serve e il riavvio non serve a niente. Ma la risorsa Lovelace e' stata
   * dichiarata **adesso**, e la pagina aperta in questo momento quel modulo non
   * l'ha caricato: la tessera non esiste, e chi apre quella voce si prendeva
   * «Errore di configurazione» nudo.
   *
   * E' lo stesso difetto che l'integrazione si e' sentita segnalare dieci
   * volte, dall'altro lato: li' funzionava il pannello e cadeva la dashboard,
   * qui funziona il tasto della console e cade la voce nella barra. */
  const b = banco({ cartina: "si" });
  try {
    const esito = await b.in_casa.sistema();
    assert.equal(esito.servita, true, "il file lo serve: non e' il caso del riavvio");
    assert.equal(esito.manca, "ricarica");

    const dentro = b.casa.viste.get("gdahome-primary");
    assert.equal(dentro.views[0].cards[0].type, "markdown");
    const testo = dentro.views[0].cards[0].content;
    assert.match(testo, /ricarica questa pagina/);
    assert.match(testo, /F5/);
    assert.doesNotMatch(testo, /riavviato/, "riavviare qui non serve, e dirlo sarebbe sbagliato");
    assert.match(testo, /reload this page/, "anche per chi non legge l'italiano");

    /* Nessun avviso in Home Assistant per questo: una ricarica la fa chi
     * guarda, nella pagina che ha davanti, e la campanella si accende per le
     * cose che restano. */
    assert.equal(b.casa.avvisi.size, 0);

    /* Al giro dopo la risorsa c'era gia', e nella Plancia torna la tessera. */
    const dopo = await b.in_casa.sistema();
    assert.equal(dopo.manca, "");
    assert.equal(
      b.casa.viste.get("gdahome-primary").views[0].cards[0].type,
      "custom:gdahome-plancia",
    );
  } finally {
    b.via();
  }
});

test("una cartina che si scarica ma non registra la tessera conta come non servita", async () => {
  /* Il caso di chi ha una vecchia `plancia.js` in `www/gdahome/`, o un file
   * mangiato a meta': Home Assistant risponde «200» e quel duecento non vuol
   * dire niente. Quello che conta e' se dentro c'e' la tessera. */
  const b = banco({ cartina: "rotta" });
  try {
    const esito = await b.in_casa.sistema();
    assert.equal(esito.servita, false);
    assert.equal(b.casa.viste.get("gdahome-primary").views[0].cards[0].type, "markdown");
  } finally {
    b.via();
  }
});

/* ─── La Plancia rimasta dall'integrazione ───────────────────────────────────
 *
 * E' l'unica delle cose che fanno uscire «Errore di configurazione» che un
 * riavvio non aggiusta **mai**, ed e' quella su cui qualcuno ha riavviato Home
 * Assistant tre volte prima di andare a chiederlo su Facebook. Il ponte
 * quell'elenco ce l'aveva — lo scriveva nel registro — e non lo diceva a
 * nessuno.
 *
 * Qui si tiene fermo il riconoscimento, e la cosa che conta e' il **no**: una
 * plancia che chi ci abita si e' fatta da se' non si nomina, non si propone di
 * togliere, e non si tocca.
 */

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
    "solo quella dell'integrazione: le altre sono di chi ci abita",
  );

  /* Il nome si riconosce anche scritto sciolto o solo nell'indirizzo — chi
   * l'ha rinominata «Dashboard Modern» e' la stessa persona con lo stesso
   * problema. */
  assert.equal(
    lePlanceDiPrima([{ dove: "x", titolo: "Dashboard Modern", nostra: false }]).length,
    1,
  );
  assert.equal(
    lePlanceDiPrima([{ dove: "dashboardmodern-2", titolo: "Casa", nostra: false }]).length,
    1,
  );

  /* E le nostre mai, nemmeno se si chiamassero cosi'. */
  assert.deepEqual(
    lePlanceDiPrima([{ dove: "gdahome-x", titolo: "DashboardModern", nostra: true }]),
    [],
  );
  assert.deepEqual(lePlanceDiPrima(null), []);
});

test("e lo si dice a chi ci abita, una volta, e si leva quando non c'e' piu'", async () => {
  const b = banco({
    plance: [{ id: "d9", url_path: "dashboardmodern", title: "DashboardModern v2" }],
    cartina: "si",
  });
  try {
    const esito = await b.in_casa.sistema();
    assert.deepEqual(
      esito.plance_di_prima.map((una) => una.titolo),
      ["DashboardModern v2"],
      "l'esito la porta, cosi' la console la puo' nominare",
    );
    const avviso = b.casa.avvisi.get("gdahome_plancia_dell_integrazione");
    assert.ok(avviso, "l'avviso in Home Assistant c'e'");
    assert.match(avviso.message, /DashboardModern v2/);
    assert.match(avviso.message, /Impostazioni → Dashboard/);
    assert.match(avviso.message, /non la tocca/, "e si dice che non la tocchiamo noi");

    /* Due giri non fanno due avvisi: un avviso per accensione sarebbe un
     * avviso che si impara a chiudere senza leggerlo. */
    await b.in_casa.sistema();
    assert.equal(b.casa.avvisi.size, 1);

    /* E quando chi ci abita la leva, l'avviso se ne va da se'. */
    b.casa.plance.splice(
      b.casa.plance.findIndex((una) => una.url_path === "dashboardmodern"),
      1,
    );
    await b.in_casa.sistema();
    assert.equal(b.casa.avvisi.size, 0, "un avviso che resta appeso non lo legge piu' nessuno");
  } finally {
    b.via();
  }
});

test("una casa senza roba di prima non si sente dire niente", async () => {
  const b = banco({ cartina: "si" });
  try {
    const esito = await b.in_casa.sistema();
    assert.deepEqual(esito.plance_di_prima, []);
    assert.equal(b.casa.avvisi.size, 0);
  } finally {
    b.via();
  }
});

test("l'add-on aggiornato lo dice, perche' una pagina gia' aperta gira ancora quella di prima", async () => {
  /* Il difetto che si e' visto in una fotografia: la barra di Home Assistant
   * sopra la plancia, dopo un aggiornamento che quella barra la toglie.
   *
   * L'indirizzo della cartina porta la versione dell'add-on proprio perche' il
   * browser non si tenga quella di ieri. Ma l'elenco delle risorse Home
   * Assistant lo legge **all'avvio della pagina**: su una pagina gia' aperta
   * continua a girare la cartina di prima, e la correzione non arriva. Di
   * questo caso non parlava nessuno — la console diceva che andava tutto bene.
   *
   * In elenco c'e' la cartina di una versione piu' vecchia di quella del
   * banco: e' esattamente un add-on appena aggiornato. */
  const b = banco({
    risorse: [{ id: "r0", url: "/local/gdahome/plancia.js?v=0.20.0", type: "module" }],
  });
  try {
    const esito = await b.in_casa.sistema();
    assert.equal(esito.risorsa, "aggiornata");
    assert.equal(esito.aggiornata, true);

    /* Ma nella vista non si tocca niente: con la cartina di prima ancora in
     * pagina `custom:gdahome-plancia` si risolve, e la plancia si apre.
     * Metterci il foglietto vorrebbe dire cancellare una plancia che funziona
     * a ogni aggiornamento dell'add-on. */
    assert.equal(esito.manca, "");
    assert.equal(esito.tessera_nella_vista, "custom:gdahome-plancia");

    /* E la si dice anche nei log, che e' dove guarda chi non apre la console. */
    assert.ok(
      b.registro.detto.avvisi.some((una) => /F5/.test(una)),
      "l'aggiornamento della cartina non e' finito nel registro",
    );
  } finally {
    b.via();
  }
});

test("la prima volta invece e' «aggiunta», e quella la vista la deve dire", async () => {
  /* La differenza fra le due: alla prima dichiarazione la cartina in pagina non
   * c'e' **per niente**, e la plancia uscirebbe con «Errore di configurazione».
   * Li' il foglietto serve. Dopo un aggiornamento no. */
  const b = banco();
  try {
    const esito = await b.in_casa.sistema();
    assert.equal(esito.risorsa, "aggiunta");
    assert.equal(esito.aggiornata, false);
    assert.equal(esito.ricarica, true);
    assert.equal(esito.manca, "ricarica");
  } finally {
    b.via();
  }
});

test("una cartina gia' giusta non chiede niente a nessuno", async () => {
  /* Il caso di tutti i giorni: l'add-on riparte, la cartina in elenco e' gia'
   * la sua. Nessuna ricarica, nessun avviso — se no si chiederebbe un F5 a ogni
   * riavvio dell'add-on, e un avviso che compare sempre non lo legge nessuno. */
  const b = banco({ risorse: RISORSA_CE });
  try {
    const esito = await b.in_casa.sistema();
    assert.equal(esito.risorsa, "c'era");
    assert.equal(esito.aggiornata, false);
    assert.equal(esito.ricarica, false);
    assert.equal(esito.manca, "");
    assert.equal(
      b.registro.detto.avvisi.filter((una) => /F5/.test(una)).length,
      0,
      "ha chiesto un F5 senza motivo",
    );
  } finally {
    b.via();
  }
});
