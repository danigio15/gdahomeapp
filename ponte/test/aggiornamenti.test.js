/* Le prove degli aggiornamenti di casa: quello che aspetta, e i due tasti.
 *
 * Quello che si prova davvero: che l'elenco e' **lo stesso** che fa la
 * plancia — stesse entita', stesso ordine, stessi nomi — perche' chi guarda
 * la dashboard e chi guarda l'app non devono vedere due cose diverse; che un
 * comando che non torna non e' un errore, perche' `update.install` torna a
 * cose fatte e `homeassistant.restart` non torna affatto; che un aggiornamento
 * che non c'e' o che non si installa di qui si dice invece di far finta; e che
 * si sa **prima** quali portano giu' il filo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Aggiornamenti, aggiornamentiDaFare, ilLogoDi, QuestoNoNo } from "../src/aggiornamenti.js";
import { aggiornamentiDaFare as quelliDellaPlancia } from "../plancia/src/core/aggiornamenti-da-fare.js";
import { Commissioni } from "../src/commissioni.js";
import { RispostaNegativa } from "../src/casa.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };

/* Una casa che risponde quello che le si dice, e si ricorda cosa le e' stato
 * chiesto. */
function casaFinta({ stati = [], quandoComanda = null } = {}) {
  const chieste = [];
  return {
    chieste,
    async chiedi(comando, opzioni = {}) {
      chieste.push({ ...comando, _entro: opzioni.entro });
      if (comando.type === "get_states") return stati;
      if (quandoComanda) return quandoComanda(comando);
      return null;
    },
  };
}

function unAggiornamento(entity_id, attributi = {}, stato = "on") {
  return {
    entity_id,
    state: stato,
    attributes: { supported_features: 1, ...attributi },
  };
}

/* Una casa come se ne trovano: il sistema, un add-on, la plancia, un firmware
 * che si cambia col cacciavite, e roba che con gli aggiornamenti non c'entra
 * niente. */
const CASA_VERA = [
  unAggiornamento("update.home_assistant_core_update", {
    title: "Home Assistant Core",
    installed_version: "2025.9.1",
    latest_version: "2025.9.3",
    release_url: "https://example.invalid/core",
  }),
  unAggiornamento("update.gdahome_update", {
    title: "gdahome",
    installed_version: "0.20.0",
    latest_version: "0.21.0",
  }),
  unAggiornamento("update.dashboardmodern_update", {
    title: "DashboardModern",
    installed_version: "1.4.30",
    latest_version: "1.4.31",
    release_summary: "Le finestre non restano piu' offuscate.",
  }),
  unAggiornamento("update.presa_cucina", { title: "Presa cucina" }, "off"),
  unAggiornamento("update.termostato_firmware", {
    friendly_name: "Termostato",
    supported_features: 0,
    latest_version: "3.1",
  }),
  unAggiornamento("update.sensore_muto", { title: "Sensore" }, "unavailable"),
  { entity_id: "light.cucina", state: "on", attributes: {} },
];

/* ─── L'elenco ───────────────────────────────────────────────────────────── */

test("aspettano solo quelli accesi, e la plancia va davanti", () => {
  const fila = aggiornamentiDaFare(CASA_VERA);
  assert.deepEqual(
    fila.map((uno) => uno.entita),
    [
      /* La plancia per prima: e' quella per cui questa tessera e' stata
       * chiesta. Gli altri in ordine alfabetico, che e' l'unico ordine
       * stabile fra una lettura e l'altra. */
      "update.dashboardmodern_update",
      "update.gdahome_update",
      "update.home_assistant_core_update",
      "update.termostato_firmware",
    ],
  );
  /* Quello spento e quello che non risponde non sono aggiornamenti da fare:
   * uno e' gia' a posto, l'altro e' un'integrazione rotta. */
  assert.equal(
    fila.some((uno) => uno.entita.includes("presa_cucina") || uno.entita.includes("muto")),
    false,
  );
});

test("l'elenco e' lo stesso che fa la plancia: stesse righe, stesso ordine, stessi nomi", () => {
  /* Le due strade sono due programmi diversi — la tessera ambra della Home
   * legge gli stati che il browser ha gia' in mano, il ponte li va a chiedere
   * a Home Assistant — ma quello che esce deve essere la stessa cosa. Chi
   * passa dalla dashboard all'app non deve trovarsi un elenco diverso, e uno
   * dei due sarebbe quello sbagliato.
   *
   * La plancia prende gli stati a mappa e il ponte a elenco: e' l'unica
   * differenza, e sta nella forma con cui arrivano, non nelle regole. */
  const aMappa = Object.fromEntries(CASA_VERA.map((uno) => [uno.entity_id, uno]));
  const loro = quelliDellaPlancia(aMappa);
  const nostri = aggiornamentiDaFare(CASA_VERA);
  assert.deepEqual(
    nostri.map((uno) => [uno.entita, uno.nome, uno.da, uno.a, uno.installabile, uno.nostra]),
    loro.map((uno) => [uno.entity, uno.nome, uno.da, uno.a, uno.installabile, uno.nostra]),
  );
});

test("il nome e' quello che si legge, e le versioni sono quelle vere", () => {
  const fila = aggiornamentiDaFare(CASA_VERA);
  const core = fila.find((uno) => uno.entita.includes("core"));
  assert.equal(core.nome, "Home Assistant Core");
  assert.equal(core.da, "2025.9.1");
  assert.equal(core.a, "2025.9.3");
  assert.equal(core.note, "https://example.invalid/core");
  /* Senza `title` si ripiega sul nome amichevole: «Termostato» e non
   * «update.termostato_firmware». */
  const termostato = fila.find((uno) => uno.entita.includes("termostato"));
  assert.equal(termostato.nome, "Termostato");
  /* E quello si fa col cacciavite: niente tasto. */
  assert.equal(termostato.installabile, false);
});

test("si sa prima quali portano giu' il filo: gdahome, e Home Assistant", () => {
  /* E' la riga che fa la differenza fra un'attesa e un guasto. Chi preme
   * «Installa» su gdahome vede l'app sconnettersi un istante dopo: se non
   * gliel'ha detto nessuno pensa di aver rotto qualcosa, e la volta dopo quel
   * tasto non lo preme piu'. */
  const dove = Object.fromEntries(
    aggiornamentiDaFare(CASA_VERA).map((uno) => [uno.entita, uno.stacca]),
  );
  assert.equal(dove["update.gdahome_update"], true);
  assert.equal(dove["update.home_assistant_core_update"], true);
  assert.equal(dove["update.dashboardmodern_update"], false);
  assert.equal(dove["update.termostato_firmware"], false);
});

test("sta andando: si legge in tutti e tre i modi in cui Home Assistant lo dice", () => {
  const fila = aggiornamentiDaFare([
    unAggiornamento("update.oggi", { title: "Oggi", in_progress: true }),
    unAggiornamento("update.ieri", { title: "Ieri", in_progress: 40 }),
    unAggiornamento("update.aparte", { title: "A parte", update_percentage: 12 }),
    unAggiornamento("update.fermo", { title: "Fermo", in_progress: false }),
  ]);
  const dove = Object.fromEntries(fila.map((uno) => [uno.entita, [uno.inCorso, uno.quanto]]));
  assert.deepEqual(dove["update.oggi"], [true, -1]);
  /* `in_progress: 40` e' la percentuale di ieri: sta andando, ma quel numero
   * non e' `update_percentage` e non si finge che lo sia. */
  assert.deepEqual(dove["update.ieri"], [true, -1]);
  assert.deepEqual(dove["update.aparte"], [true, 12]);
  /* Uno zero in `in_progress` vuol dire fermo, non «allo zero per cento». */
  assert.deepEqual(dove["update.fermo"], [false, -1]);
});

test("l'elenco si tiene qualche secondo, e chi lo muove se lo fa ridare", async () => {
  /* Senza, la schermata che si riguarda da sola sarebbe un `get_states` intero
   * ogni pochi secondi. Con, un'installazione appena partita resterebbe
   * invisibile per dieci secondi: per quello chi la fa partire dimentica. */
  let ora = 1000;
  const casa = casaFinta({ stati: CASA_VERA });
  const quali = new Aggiornamenti({ casa, registro: ZITTO, adesso: () => ora });

  await quali.elenco();
  await quali.elenco();
  assert.equal(casa.chieste.filter((una) => una.type === "get_states").length, 1);

  ora += 11_000;
  await quali.elenco();
  assert.equal(casa.chieste.filter((una) => una.type === "get_states").length, 2);

  quali.dimentica();
  await quali.elenco();
  assert.equal(casa.chieste.filter((una) => una.type === "get_states").length, 3);
});

/* ─── Installare ─────────────────────────────────────────────────────────── */

test("installare chiama update.install su quell'entita' e basta", async () => {
  const casa = casaFinta({ stati: CASA_VERA });
  const quali = new Aggiornamenti({ casa, registro: ZITTO });
  const esito = await quali.installa("update.gdahome_update");
  assert.deepEqual(esito, { avviato: true, gia: false, stacca: true });
  const comando = casa.chieste.find((una) => una.type === "call_service");
  assert.deepEqual(
    { domain: comando.domain, service: comando.service, target: comando.target },
    { domain: "update", service: "install", target: { entity_id: "update.gdahome_update" } },
  );
});

test("quello che non c'e', quello spento e quello che non si installa si dicono", async () => {
  const casa = casaFinta({ stati: CASA_VERA });
  const quali = new Aggiornamenti({ casa, registro: ZITTO });
  await assert.rejects(() => quali.installa("light.cucina"), QuestoNoNo);
  await assert.rejects(() => quali.installa("update.presa_cucina"), QuestoNoNo);
  /* Il firmware del termostato si cambia col cacciavite: chiamare il servizio
   * non farebbe niente e non lo direbbe a nessuno. */
  await assert.rejects(() => quali.installa("update.termostato_firmware"), QuestoNoNo);
  assert.equal(
    casa.chieste.some((una) => una.type === "call_service"),
    false,
  );
});

test("quello che sta gia' andando non riparte da capo", async () => {
  const casa = casaFinta({
    stati: [unAggiornamento("update.gdahome_update", { title: "gdahome", in_progress: true })],
  });
  const quali = new Aggiornamenti({ casa, registro: ZITTO });
  const esito = await quali.installa("update.gdahome_update");
  assert.deepEqual(esito, { avviato: true, gia: true, stacca: true });
  assert.equal(
    casa.chieste.some((una) => una.type === "call_service"),
    false,
  );
});

test("un comando che non torna e' un comando partito, non un guasto", async () => {
  /* `update.install` torna quando l'aggiornamento e' **finito**, e un add-on
   * ci mette minuti; `homeassistant.restart` non torna affatto, che spegne la
   * casa e con lei il filo. Aspettare la risposta vera vorrebbe dire tenere il
   * telefono appeso per tutto il tempo e poi dirgli «non ha risposto» di una
   * cosa che sta andando benissimo. */
  const muta = {
    chieste: [],
    async chiedi(comando) {
      this.chieste.push(comando);
      if (comando.type === "get_states") return CASA_VERA;
      throw new Error("Home Assistant non ha risposto in tempo");
    },
  };
  const quali = new Aggiornamenti({ casa: muta, registro: ZITTO });
  assert.deepEqual(await quali.installa("update.dashboardmodern_update"), {
    avviato: true,
    gia: false,
    stacca: false,
  });
  assert.deepEqual(await quali.riavvia(), { avviato: true });
});

test("un no di Home Assistant invece e' un no, e si dice", async () => {
  /* Il permesso negato, l'entita' sconosciuta: rifare la stessa cosa non
   * serve, e far finta che sia partita e' peggio che dirlo. */
  const severa = {
    async chiedi(comando) {
      if (comando.type === "get_states") return CASA_VERA;
      throw new RispostaNegativa("unauthorized", "non ti e' permesso");
    },
  };
  const quali = new Aggiornamenti({ casa: severa, registro: ZITTO });
  await assert.rejects(() => quali.riavvia(), /non ti e' permesso/);
});

test("il riavvio e' homeassistant.restart, su nessuna entita'", async () => {
  const casa = casaFinta({ stati: [] });
  const quali = new Aggiornamenti({ casa, registro: ZITTO });
  await quali.riavvia();
  const comando = casa.chieste.at(-1);
  assert.equal(comando.domain, "homeassistant");
  assert.equal(comando.service, "restart");
  assert.equal("target" in comando, false);
  /* E non si aspetta venti secondi una risposta che non arrivera'. */
  assert.ok(comando._entro <= 5000);
});

/* ─── Sul filo ───────────────────────────────────────────────────────────── */

test("i tre comandi sul filo, e quello che risponde un ponte che non li sa fare", async () => {
  const casa = casaFinta({ stati: CASA_VERA });
  const commissioni = new Commissioni({
    casa,
    registro: ZITTO,
    aggiornamenti: new Aggiornamenti({ casa, registro: ZITTO }),
  });

  for (const tipo of [
    "ponte/aggiornamenti/elenco",
    "ponte/aggiornamenti/installa",
    "ponte/aggiornamenti/riavvia",
  ]) {
    assert.equal(commissioni.riconosce({ type: tipo }), true, tipo);
  }

  const elenco = await commissioni.rispondi({ id: 1, type: "ponte/aggiornamenti/elenco" });
  assert.equal(elenco.success, true);
  assert.equal(elenco.result.aggiornamenti.length, 4);
  assert.equal(elenco.result.aggiornamenti[0].entita, "update.dashboardmodern_update");

  const messo = await commissioni.rispondi({
    id: 2,
    type: "ponte/aggiornamenti/installa",
    entity_id: "update.dashboardmodern_update",
  });
  assert.equal(messo.success, true);
  assert.equal(messo.result.avviato, true);

  const storto = await commissioni.rispondi({
    id: 3,
    type: "ponte/aggiornamenti/installa",
    entity_id: "sensor.niente",
  });
  assert.equal(storto.success, false);
  assert.equal(storto.error.code, "not_found");

  /* Un ponte di prima non li conosce, e lo dice con la stessa parola con cui
   * l'app spiega «gdahome in casa e' piu' vecchio dell'app». */
  const vecchio = new Commissioni({ casa, registro: ZITTO });
  const niente = await vecchio.rispondi({ id: 4, type: "ponte/aggiornamenti/elenco" });
  assert.equal(niente.success, false);
  assert.equal(niente.error.code, "unknown_command");
});

/* Il segno di chi si aggiorna: quali indirizzi passano, e quali no.
 *
 * Qui la prova che conta non e' che un logo arrivi: e' che **non passi un
 * indirizzo qualunque**. `entity_picture` e' un attributo di un'entita', e un
 * attributo lo scrive chi puo' scrivere in Home Assistant: se il ponte
 * andasse a prendere quello che c'e' scritto, chiunque possa scriverlo
 * avrebbe il ponte come messaggero per andare dove vuole — dalla rete di
 * casa, con il segno di Home Assistant in tasca. Due razze di indirizzo, e
 * nient'altro. */
test("il logo: di casa o dei marchi, e niente altro", () => {
  const dentro = (dove) => ilLogoDi(unAggiornamento("update.uno", { entity_picture: dove }));

  /* Di casa: l'icona di un add-on, che senza il segno non si apre. */
  assert.equal(dentro("/api/hassio/addons/gdahome/icon"), "/api/hassio/addons/gdahome/icon");
  /* I marchi di Home Assistant, dove stanno i loghi delle integrazioni. */
  assert.equal(
    dentro("https://brands.home-assistant.io/_/shelly/icon.png"),
    "https://brands.home-assistant.io/_/shelly/icon.png",
  );

  /* E tutto il resto no. */
  for (const brutto of [
    "https://qualcunaltro.example/logo.png",
    "http://brands.home-assistant.io/_/shelly/icon.png",
    "https://brands.home-assistant.io.example.com/x.png",
    "//brands.home-assistant.io/_/shelly/icon.png",
    "data:image/png;base64,AAAA",
    "file:///etc/passwd",
    "",
    "   ",
  ]) {
    assert.equal(dentro(brutto), "", brutto);
  }

  /* Senza l'attributo non c'e' logo, e non e' un guasto. */
  assert.equal(ilLogoDi(unAggiornamento("update.uno")), "");
  assert.equal(ilLogoDi(null), "");
});

test("la riga dice se un logo c'e', e l'indirizzo non viaggia", () => {
  const fila = aggiornamentiDaFare([
    unAggiornamento("update.uno", {
      title: "Uno",
      entity_picture: "https://brands.home-assistant.io/_/uno/icon.png",
    }),
    unAggiornamento("update.due", { title: "Due" }),
  ]);
  const uno = fila.find((quale) => quale.entita === "update.uno");
  const due = fila.find((quale) => quale.entita === "update.due");
  assert.equal(uno.logo, true);
  assert.equal(due.logo, false);
  /* L'indirizzo resta nel ponte: sul filo passa un si' o un no. */
  assert.equal(JSON.stringify(fila).includes("brands.home-assistant.io"), false);
});

test("il logo di casa passa dal segno di Home Assistant", async () => {
  const casa = casaFinta({
    stati: [
      unAggiornamento("update.un_addon", {
        title: "Un add-on",
        entity_picture: "/api/hassio/addons/uno/icon",
      }),
    ],
  });
  casa.indirizzo = "http://dentro:8123";
  casa.segno = "IL-SEGNO";

  const chieste = [];
  const commissioni = new Commissioni({
    casa,
    registro: ZITTO,
    aggiornamenti: new Aggiornamenti({ casa, registro: ZITTO }),
    scarica: async (quale) => {
      chieste.push(quale);
      return { stato: 200, tipo: "image/png", corpo: Buffer.from([1, 2, 3]) };
    },
  });

  assert.equal(commissioni.riconosce({ type: "ponte/aggiornamenti/logo" }), true);
  const preso = await commissioni.rispondi({
    id: 1,
    type: "ponte/aggiornamenti/logo",
    entity_id: "update.un_addon",
  });
  assert.equal(preso.success, true);
  assert.equal(preso.result.tipo, "image/png");
  assert.equal(Buffer.from(preso.result.corpo, "base64").length, 3);
  /* Non compresso: un PNG gzippato pesa quanto prima, e farlo aprire al
   * telefono per niente e' lavoro per niente. */
  assert.equal(preso.result.compresso, undefined);

  assert.equal(chieste.length, 1);
  assert.equal(chieste[0].url, "http://dentro:8123/api/hassio/addons/uno/icon");
  assert.equal(chieste[0].intestazioni.authorization, "Bearer IL-SEGNO");
});

test("il logo dei marchi si prende fuori, senza il segno di casa", async () => {
  const dove = "https://brands.home-assistant.io/_/shelly/icon.png";
  const casa = casaFinta({
    stati: [unAggiornamento("update.una_presa", { title: "Una presa", entity_picture: dove })],
  });
  casa.indirizzo = "http://dentro:8123";
  casa.segno = "IL-SEGNO";

  const chieste = [];
  const commissioni = new Commissioni({
    casa,
    registro: ZITTO,
    aggiornamenti: new Aggiornamenti({ casa, registro: ZITTO }),
    scarica: async (quale) => {
      chieste.push(quale);
      return { stato: 200, tipo: "image/png", corpo: Buffer.from([9]) };
    },
  });

  const preso = await commissioni.rispondi({
    id: 1,
    type: "ponte/aggiornamenti/logo",
    entity_id: "update.una_presa",
  });
  assert.equal(preso.success, true);
  assert.equal(chieste[0].url, dove);
  /* Il segno di casa non si manda a nessun altro. */
  assert.equal(chieste[0].intestazioni.authorization, undefined);
});

test("il logo di un'entita' che l'elenco non ha non si va a prendere", async () => {
  const casa = casaFinta({
    stati: [
      unAggiornamento("update.uno", {
        title: "Uno",
        entity_picture: "/api/hassio/addons/uno/icon",
      }),
      /* Spento: non aspetta niente, e quindi non ha un logo da chiedere. */
      unAggiornamento(
        "update.spento",
        { title: "Spento", entity_picture: "/api/hassio/addons/spento/icon" },
        "off",
      ),
    ],
  });
  casa.indirizzo = "http://dentro:8123";
  casa.segno = "IL-SEGNO";

  let andata = false;
  const commissioni = new Commissioni({
    casa,
    registro: ZITTO,
    aggiornamenti: new Aggiornamenti({ casa, registro: ZITTO }),
    scarica: async () => {
      andata = true;
      return { stato: 200, tipo: "image/png", corpo: Buffer.from([1]) };
    },
  });

  for (const chi of ["update.spento", "sensor.niente", "update.mai_vista", "", "../etc/passwd"]) {
    const niente = await commissioni.rispondi({
      id: 1,
      type: "ponte/aggiornamenti/logo",
      entity_id: chi,
    });
    assert.equal(niente.success, false, chi);
    assert.equal(niente.error.code, "not_found", chi);
  }
  assert.equal(andata, false);
});

test("un ponte senza aggiornamenti non conosce nemmeno i loghi", async () => {
  const casa = casaFinta({ stati: [] });
  const vecchio = new Commissioni({ casa, registro: ZITTO });
  const niente = await vecchio.rispondi({
    id: 1,
    type: "ponte/aggiornamenti/logo",
    entity_id: "update.uno",
  });
  assert.equal(niente.success, false);
  assert.equal(niente.error.code, "unknown_command");
});

/* Le note lunghe di una versione.
 *
 * Quello che si prova: che si chiedono **solo** a chi ha detto di saperle —
 * il quinto bit di `supported_features` — perche' un no prevedibile leggendo
 * un bit non e' un no da far vedere a nessuno; che un'entita' che le sa e non
 * ha niente da dire risponde vuoto, ed e' una risposta; e che il nome
 * dell'entita' non lo scrive il telefono.
 */
test("le note si chiedono a chi ha detto di saperle", async () => {
  const chieste = [];
  const casa = {
    indirizzo: "http://dentro:8123",
    segno: "IL-SEGNO",
    async chiedi(comando) {
      chieste.push(comando);
      if (comando.type === "get_states") {
        return [
          unAggiornamento("update.gdahome", {
            title: "gdahome",
            /* 1 = si installa, 16 = le note le sa. */
            supported_features: 1 | 16,
            installed_version: "1.4.32.7",
            latest_version: "1.4.32.8",
          }),
          unAggiornamento("update.una_presa", {
            title: "Una presa",
            supported_features: 1,
          }),
        ];
      }
      return "## 1.4.32.8\n\nIl firewall dell'ufficio.";
    },
  };
  const quali = new Aggiornamenti({ casa, registro: ZITTO });

  /* Nell'elenco si vede chi le sa e chi no. */
  const fila = await quali.elenco();
  assert.equal(fila.find((una) => una.entita === "update.gdahome").leNote, true);
  assert.equal(fila.find((una) => una.entita === "update.una_presa").leNote, false);

  const dette = await quali.note("update.gdahome");
  assert.match(dette.note, /firewall/);
  assert.equal(dette.versione, "1.4.32.8");
  assert.equal(
    chieste.some(
      (uno) => uno.type === "update/release_notes" && uno.entity_id === "update.gdahome",
    ),
    true,
  );

  /* A chi non le sa non si chiede niente: si dice, e basta. */
  chieste.length = 0;
  await assert.rejects(() => quali.note("update.una_presa"), QuestoNoNo);
  assert.equal(
    chieste.some((uno) => uno.type === "update/release_notes"),
    false,
  );
});

test("un'entita' che l'elenco non ha non fa chiedere niente", async () => {
  const chieste = [];
  const casa = {
    async chiedi(comando) {
      chieste.push(comando);
      if (comando.type === "get_states") {
        return [
          unAggiornamento("update.spenta", { title: "Spenta", supported_features: 1 | 16 }, "off"),
        ];
      }
      return "niente";
    },
  };
  const quali = new Aggiornamenti({ casa, registro: ZITTO });
  for (const chi of ["update.spenta", "update.mai_vista", "sensor.niente", ""]) {
    await assert.rejects(() => quali.note(chi), QuestoNoNo, chi);
  }
  assert.equal(
    chieste.some((uno) => uno.type === "update/release_notes"),
    false,
  );
});

test("le note vuote sono una risposta, non un guasto", async () => {
  const casa = {
    async chiedi(comando) {
      if (comando.type === "get_states") {
        return [
          unAggiornamento("update.uno", {
            title: "Uno",
            supported_features: 1 | 16,
            latest_version: "2.0",
          }),
        ];
      }
      /* Home Assistant, per un'entita' che le sa e che per questa versione non
       * ha niente da dire, risponde `null`. */
      return null;
    },
  };
  const dette = await new Aggiornamenti({ casa, registro: ZITTO }).note("update.uno");
  assert.equal(dette.note, "");
  assert.equal(dette.versione, "2.0");
});

test("un no di Home Assistant sulle note si dice com'e'", async () => {
  const casa = {
    async chiedi(comando) {
      if (comando.type === "get_states") {
        return [unAggiornamento("update.uno", { title: "Uno", supported_features: 1 | 16 })];
      }
      throw new RispostaNegativa("unknown_command", "non conosco update/release_notes");
    },
  };
  const commissioni = new Commissioni({
    casa,
    registro: ZITTO,
    aggiornamenti: new Aggiornamenti({ casa, registro: ZITTO }),
  });
  assert.equal(commissioni.riconosce({ type: "ponte/aggiornamenti/note" }), true);

  /* Una Home Assistant vecchia che quel comando non lo conosce: il no e' il
   * suo, e ha un codice **suo** — non `unknown_command`, che nell'app vuol
   * dire «aggiorna l'add-on» e manderebbe a aggiornare la cosa sbagliata. */
  const niente = await commissioni.rispondi({
    id: 1,
    type: "ponte/aggiornamenti/note",
    entity_id: "update.uno",
  });
  assert.equal(niente.success, false);
  assert.equal(niente.error.code, "note_non_date");
});

test("le note passano dal ponte con la loro versione", async () => {
  const casa = casaFinta({ stati: CASA_VERA });
  const commissioni = new Commissioni({
    casa,
    registro: ZITTO,
    aggiornamenti: new Aggiornamenti({ casa, registro: ZITTO }),
  });
  /* `CASA_VERA` non dichiara il bit delle note su nessuno: percio' la
   * risposta e' un no chiaro, e non una pagina vuota. */
  const niente = await commissioni.rispondi({
    id: 1,
    type: "ponte/aggiornamenti/note",
    entity_id: "update.dashboardmodern_update",
  });
  assert.equal(niente.success, false);
  assert.equal(niente.error.code, "not_found");
});
