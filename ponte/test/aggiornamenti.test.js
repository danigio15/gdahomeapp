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

import {
  Aggiornamenti,
  aggiornamentiDaFare,
  ilLogoDi,
  ilMarchioDi,
  ilSegnoDiZigbee2mqtt,
  QuestoNoNo,
} from "../src/aggiornamenti.js";
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

test("l'indirizzo del logo non viaggia: sul filo passa un si'", () => {
  const fila = aggiornamentiDaFare([
    unAggiornamento("update.uno", {
      title: "Uno",
      entity_picture: "https://brands.home-assistant.io/_/uno/icon.png",
    }),
    unAggiornamento("update.due", { title: "Due" }),
  ]);
  /* Per tutti c'e' qualcosa da provare: chi dichiara un indirizzo ha quello,
   * chi non dichiara niente ha il marchio dell'integrazione da cui viene. */
  assert.equal(
    fila.every((quale) => quale.logo === true),
    true,
  );
  /* E l'indirizzo resta nel ponte. */
  assert.equal(JSON.stringify(fila).includes("brands.home-assistant.io"), false);
});

test("chi non dichiara un logo lo prende dall'integrazione da cui viene", async () => {
  /* Certi aggiornamenti non hanno `entity_picture` affatto, e restavano con
   * la loro iniziale. Quello che si sa di loro e' da dove vengono, e le
   * integrazioni hanno il loro marchio. */
  const chieste = [];
  const casa = {
    async chiedi(comando) {
      chieste.push(comando);
      if (comando.type === "get_states") {
        return [unAggiornamento("update.switch_casa", { friendly_name: "Switch casa" })];
      }
      if (comando.type === "config/entity_registry/get") {
        return { entity_id: comando.entity_id, platform: "zha" };
      }
      return null;
    },
  };
  const quali = new Aggiornamenti({ casa, registro: ZITTO });
  assert.equal(
    await quali.doveIlLogo("update.switch_casa"),
    "https://brands.home-assistant.io/zha/icon.png",
  );

  /* E si chiede **una volta**: la seconda risponde la memoria. */
  const quante = chieste.filter((una) => una.type === "config/entity_registry/get").length;
  await quali.doveIlLogo("update.switch_casa");
  assert.equal(chieste.filter((una) => una.type === "config/entity_registry/get").length, quante);
});

test("un firmware che arriva per MQTT prende il segno di Zigbee2MQTT", async () => {
  /* La prima casa vera l'ha detto subito: con il marchio dell'integrazione
   * tre interruttori Zigbee prendevano il logo di **MQTT**, che e' la strada
   * che hanno fatto e non chi li comanda. Chi li comanda ce l'ha in casa, ed
   * e' l'add-on di Zigbee2MQTT: il segno si prende da li'.
   *
   * E si prende **senza chiedere niente**: Home Assistant fa un'entita'
   * `update.` per ogni add-on installato, anche per quelli a posto — questa
   * sta a `off` — e ognuna si porta dietro l'indirizzo della sua icona. */
  const casa = casaFinta({
    stati: [
      unAggiornamento("update.switch_casa", {
        friendly_name: "Switch casa",
        device_class: "firmware",
      }),
      unAggiornamento(
        "update.zigbee2mqtt_update",
        {
          title: "Zigbee2MQTT",
          entity_picture: "/api/hassio/addons/45df7312_zigbee2mqtt/icon",
        },
        "off",
      ),
    ],
    quandoComanda: (comando) =>
      comando.type === "config/entity_registry/get"
        ? { entity_id: comando.entity_id, platform: "mqtt" }
        : null,
  });
  const quali = new Aggiornamenti({ casa, registro: ZITTO });
  assert.equal(
    await quali.doveIlLogo("update.switch_casa"),
    "/api/hassio/addons/45df7312_zigbee2mqtt/icon",
  );
});

test("e se Zigbee2MQTT in casa non c'e', resta l'iniziale invece di MQTT", async () => {
  /* Zigbee2MQTT puo' girare da un'altra parte, e allora un segno non ce l'ha.
   * Fra l'iniziale e il logo di MQTT si sceglie l'iniziale: dice la prima
   * lettera di quello che stai aggiornando, che e' meno di niente ma non e'
   * il nome di un'altra cosa. */
  const casa = casaFinta({
    stati: [
      unAggiornamento("update.switch_casa", {
        friendly_name: "Switch casa",
        device_class: "firmware",
      }),
    ],
    quandoComanda: (comando) =>
      comando.type === "config/entity_registry/get"
        ? { entity_id: comando.entity_id, platform: "mqtt" }
        : null,
  });
  const quali = new Aggiornamenti({ casa, registro: ZITTO });
  assert.equal(await quali.doveIlLogo("update.switch_casa"), "");
});

test("e quello che arriva per MQTT e non e' un firmware il suo marchio ce l'ha", async () => {
  /* La regola tocca i **firmware**: quelli sono apparecchi, e per MQTT ci
   * arrivano da Zigbee2MQTT. Tutto il resto che passa da MQTT e' roba di
   * MQTT, e il suo marchio e' quello giusto. */
  const casa = casaFinta({
    stati: [unAggiornamento("update.qualcosa", { title: "Qualcosa" })],
    quandoComanda: (comando) =>
      comando.type === "config/entity_registry/get"
        ? { entity_id: comando.entity_id, platform: "mqtt" }
        : null,
  });
  const quali = new Aggiornamenti({ casa, registro: ZITTO });
  assert.equal(
    await quali.doveIlLogo("update.qualcosa"),
    "https://brands.home-assistant.io/mqtt/icon.png",
  );
});

test("l'add-on di Zigbee2MQTT si riconosce, e un altro add-on non si scambia", () => {
  const conQuesto = (dove) => [
    unAggiornamento("update.uno_update", { entity_picture: dove }, "off"),
  ];
  for (const dove of [
    "/api/hassio/addons/45df7312_zigbee2mqtt/icon",
    "/api/hassio/addons/45df7312_zigbee2mqtt_edge/icon",
    "/api/hassio/addons/zigbee2mqtt/icon",
  ]) {
    assert.equal(ilSegnoDiZigbee2mqtt(conQuesto(dove)), dove, dove);
  }
  /* E nessun altro: ne' un add-on che gli somiglia, ne' un indirizzo che
   * quella forma non ce l'ha. */
  for (const dove of [
    "/api/hassio/addons/a0d7b954_vscode/icon",
    "/api/hassio/addons/45df7312_zigbee2mqttproxy/icon",
    "https://brands.home-assistant.io/zigbee2mqtt/icon.png",
    "/api/hassio/addons/45df7312_zigbee2mqtt/../../altro/icon",
  ]) {
    assert.equal(ilSegnoDiZigbee2mqtt(conQuesto(dove)), "", dove);
  }
  assert.equal(ilSegnoDiZigbee2mqtt(null), "");
});

test("l'indirizzo vero dei marchi passa comunque", () => {
  /* `I_MARCHI` e' la lista di quello che passa, e resta l'indirizzo vero
   * anche quando il banco si fa servire i marchi da un'altra parte: sono due
   * lavori diversi, e confonderli faceva rifiutare proprio l'indirizzo che
   * Home Assistant dichiara. */
  const dentro = (dove) => ilLogoDi(unAggiornamento("update.uno", { entity_picture: dove }));
  assert.equal(
    dentro("https://brands.home-assistant.io/homeassistant/icon.png"),
    "https://brands.home-assistant.io/homeassistant/icon.png",
  );
});

test("il nome di un'integrazione non porta da un'altra parte", () => {
  assert.equal(ilMarchioDi("mqtt"), "https://brands.home-assistant.io/mqtt/icon.png");
  assert.equal(ilMarchioDi("zha"), "https://brands.home-assistant.io/zha/icon.png");
  for (const brutto of ["../altro", "uno/due", "uno.due", "http://x", "", "  ", null]) {
    assert.equal(ilMarchioDi(brutto), "", String(brutto));
  }
});

test("il marchio che si costruisce non ha il `_/`, che servirebbe un segnaposto", () => {
  /* I marchi di Home Assistant servono lo stesso indirizzo in due modi: con
   * il `_/` davanti, un'integrazione che un marchio non ce l'ha risponde
   * `200` con dentro il disegno «logo mancante» invece di `404`. Il telefono
   * lo prenderebbe per un logo e lo disegnerebbe al posto dell'iniziale. */
  assert.equal(ilMarchioDi("mai_sentita").includes("/_/"), false);
});

test("di un'entita' che l'elenco non ha non si chiede nemmeno di chi e'", async () => {
  const chieste = [];
  const casa = {
    async chiedi(comando) {
      chieste.push(comando);
      if (comando.type === "get_states") return [];
      return { platform: "mqtt" };
    },
  };
  const quali = new Aggiornamenti({ casa, registro: ZITTO });
  assert.equal(await quali.doveIlLogo("update.mai_vista"), "");
  assert.equal(
    chieste.some((una) => una.type === "config/entity_registry/get"),
    false,
  );
});

test("un registro che non risponde e' un logo che non c'e', non un guasto", async () => {
  const casa = {
    async chiedi(comando) {
      if (comando.type === "get_states") {
        return [unAggiornamento("update.uno", { title: "Uno" })];
      }
      throw new RispostaNegativa("unknown_command", "non conosco quel registro");
    },
  };
  const quali = new Aggiornamenti({ casa, registro: ZITTO });
  assert.equal(await quali.doveIlLogo("update.uno"), "");
});

test("l'icona di un add-on la chiede al Supervisor, non al proxy di casa", async () => {
  /* In una casa vera il proxy di Home Assistant ha risposto **403** per
   * l'icona di un add-on di un altro, mentre dava la nostra: il segno che
   * abbiamo e' quello del Supervisor, non di un amministratore di Home
   * Assistant. Al Supervisor la stessa cosa si chiede diretta, col suo segno,
   * ed e' per questo che il manifesto dichiara `hassio_role: manager`. */
  const casa = casaFinta({
    stati: [
      unAggiornamento("update.un_altro_addon", {
        title: "Un altro add-on",
        entity_picture: "/api/hassio/addons/a0d7b954_vscode/icon",
      }),
    ],
  });
  casa.indirizzo = "http://supervisor/core";
  casa.supervisor = "http://supervisor";
  casa.segno = "IL-SEGNO-DEL-SUPERVISOR";

  const chieste = [];
  const commissioni = new Commissioni({
    casa,
    registro: ZITTO,
    aggiornamenti: new Aggiornamenti({ casa, registro: ZITTO }),
    scarica: async (quale) => {
      chieste.push(quale);
      return { stato: 200, tipo: "image/png", corpo: Buffer.from([7, 7]) };
    },
  });

  const preso = await commissioni.rispondi({
    id: 1,
    type: "ponte/aggiornamenti/logo",
    entity_id: "update.un_altro_addon",
  });
  assert.equal(preso.success, true);
  assert.equal(chieste.length, 1);
  /* Diretta al Supervisor: niente `/core/api/hassio/` in mezzo. */
  assert.equal(chieste[0].url, "http://supervisor/addons/a0d7b954_vscode/icon");
  assert.equal(chieste[0].intestazioni.authorization, "Bearer IL-SEGNO-DEL-SUPERVISOR");
});

test("senza Supervisor l'icona di un add-on passa da dove passava", async () => {
  /* Fuori dal Supervisor — sul banco, su un computer di prova — quella strada
   * non esiste, e si torna al proxy di Home Assistant invece di non chiedere
   * niente. */
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
  casa.supervisor = "";

  const chieste = [];
  const commissioni = new Commissioni({
    casa,
    registro: ZITTO,
    aggiornamenti: new Aggiornamenti({ casa, registro: ZITTO }),
    scarica: async (quale) => {
      chieste.push(quale);
      return { stato: 200, tipo: "image/png", corpo: Buffer.from([1]) };
    },
  });

  const preso = await commissioni.rispondi({
    id: 1,
    type: "ponte/aggiornamenti/logo",
    entity_id: "update.un_addon",
  });
  assert.equal(preso.success, true);
  assert.equal(chieste[0].url, "http://dentro:8123/api/hassio/addons/uno/icon");
});

test("il logo di casa passa dal segno di Home Assistant", async () => {
  const casa = casaFinta({
    stati: [
      unAggiornamento("update.una_cosa", {
        title: "Una cosa",
        /* Un indirizzo di casa che non e' l'icona di un add-on: quello passa
         * dal segno di Home Assistant, come i file della plancia. */
        entity_picture: "/api/image/serve/abcd/512x512",
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
    entity_id: "update.una_cosa",
  });
  assert.equal(preso.success, true);
  assert.equal(preso.result.tipo, "image/png");
  assert.equal(Buffer.from(preso.result.corpo, "base64").length, 3);
  /* Non compresso: un PNG gzippato pesa quanto prima, e farlo aprire al
   * telefono per niente e' lavoro per niente. */
  assert.equal(preso.result.compresso, undefined);

  assert.equal(chieste.length, 1);
  assert.equal(chieste[0].url, "http://dentro:8123/api/image/serve/abcd/512x512");
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
