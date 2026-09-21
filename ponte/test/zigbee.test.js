/* Un dispositivo Zigbee nuovo, dal telefono.
 *
 * «Vorrei poter abbinare un dispositivo zigbee direttamente dall'app, senza
 *  dover entrare in Home Assistant.»
 *
 * Qui si prova quello che decide: quale rete c'è in casa, come si apre, e chi
 * è entrato. Il giro alla casa si prova con una casa finta — un `chiedi` e un
 * `ascolta` che rispondono quello che gli si dice — perché il pezzo delicato
 * non è la rete: è l'ordine in cui si fanno le cose.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ATTESA_DELLA_CASSETTA,
  AL_PIU_APERTA,
  NESSUNA,
  QUANTO_RESTA_APERTA,
  Z2M,
  ZHA,
  Zigbee,
  ceZha,
  comeSiApre,
  comeSiChiude,
  comeSiPresenta,
  eUnoNuovo,
  laReteDiCasa,
  perQuanto,
  prefissoDellaCassetta,
} from "../src/zigbee.js";

/* ── quale rete c'è ─────────────────────────────────────────────────────── */

test("ZHA c'è solo se è davvero in piedi", () => {
  assert.equal(ceZha([{ domain: "zha", state: "loaded" }]), true);
  /* L'antenna staccata, il programma in errore: c'è la voce ma non la rete, e
   * un tasto che non fa niente è peggio di un tasto che manca. */
  assert.equal(ceZha([{ domain: "zha", state: "setup_error" }]), false);
  assert.equal(ceZha([{ domain: "zha", state: "not_loaded" }]), false);
  /* Le versioni più vecchie non dicono lo stato: chi non lo dice si considera
   * in piedi, che è come si comportava prima. */
  assert.equal(ceZha([{ domain: "zha" }]), true);
  assert.equal(ceZha([{ domain: "mqtt", state: "loaded" }]), false);
  assert.equal(ceZha([]), false);
  assert.equal(ceZha(null), false);
});

test("il prefisso della cassetta è tutto quello che sta prima di /bridge/info", () => {
  assert.equal(prefissoDellaCassetta("zigbee2mqtt/bridge/info"), "zigbee2mqtt");
  /* Un prefisso può avere delle barre dentro: tagliare alla prima vorrebbe
   * dire scrivere nella cassetta sbagliata. */
  assert.equal(prefissoDellaCassetta("casa/zigbee/bridge/info"), "casa/zigbee");
  assert.equal(prefissoDellaCassetta("zigbee2mqtt/bridge/state"), "");
  assert.equal(prefissoDellaCassetta(""), "");
});

test("con tutt'e due vince ZHA: è la strada più corta", () => {
  /* Sta dentro Home Assistant, quindi il comando arriva e la conferma torna
   * dalla stessa porta; Zigbee2MQTT passa per la posta e ha un pezzo in più
   * che può mancare. */
  assert.deepEqual(laReteDiCasa({ zha: true, cassetta: "zigbee2mqtt" }), {
    quale: ZHA,
    cassetta: "",
  });
  assert.deepEqual(laReteDiCasa({ zha: false, cassetta: "casa/zigbee" }), {
    quale: Z2M,
    cassetta: "casa/zigbee",
  });
  assert.deepEqual(laReteDiCasa({}), { quale: NESSUNA, cassetta: "" });
});

/* ── come si apre ───────────────────────────────────────────────────────── */

test("il tempo sta dentro i suoi limiti, e non va mai a caso", () => {
  assert.equal(perQuanto(60), 60);
  assert.equal(perQuanto(0), QUANTO_RESTA_APERTA);
  assert.equal(perQuanto(-5), QUANTO_RESTA_APERTA);
  assert.equal(perQuanto("boh"), QUANTO_RESTA_APERTA);
  assert.equal(perQuanto(99_999), AL_PIU_APERTA);
});

test("ZHA si apre con un comando suo, Zigbee2MQTT con una lettera", () => {
  assert.deepEqual(comeSiApre({ quale: ZHA }, 120), { type: "zha/permit", duration: 120 });

  const lettera = comeSiApre({ quale: Z2M, cassetta: "casa/zigbee" }, 120);
  assert.equal(lettera.type, "call_service");
  assert.equal(lettera.domain, "mqtt");
  assert.equal(lettera.service, "publish");
  assert.equal(lettera.service_data.topic, "casa/zigbee/bridge/request/permit_join");
  assert.deepEqual(JSON.parse(lettera.service_data.payload), { time: 120 });

  /* Senza rete non c'è comando: chi chiama se lo vede tornare vuoto invece di
   * mandare in casa un ordine che non vuol dire niente. */
  assert.equal(comeSiApre({ quale: NESSUNA }), null);
  assert.equal(comeSiApre({ quale: Z2M, cassetta: "" }), null);
});

test("la si richiude dalla stessa strada, con zero al posto del tempo", () => {
  assert.deepEqual(comeSiChiude({ quale: ZHA }), { type: "zha/permit", duration: 0 });
  const lettera = comeSiChiude({ quale: Z2M, cassetta: "zigbee2mqtt" });
  assert.deepEqual(JSON.parse(lettera.service_data.payload), { time: 0 });
  assert.equal(comeSiChiude({ quale: NESSUNA }), null);
});

/* ── chi è entrato ──────────────────────────────────────────────────────── */

test("un dispositivo rinominato non è un dispositivo nuovo", () => {
  /* Il registro annuncia anche le modifiche e le cancellazioni: chi guarda
   * l'attesa vedrebbe entrare qualcosa che era già in casa. */
  assert.equal(eUnoNuovo({ action: "create", device_id: "abc" }), true);
  assert.equal(eUnoNuovo({ action: "update", device_id: "abc" }), false);
  assert.equal(eUnoNuovo({ action: "remove", device_id: "abc" }), false);
  assert.equal(eUnoNuovo({ action: "create" }), false);
  assert.equal(eUnoNuovo(null), false);
});

test("un dispositivo si presenta col nome che gli ha dato chi lo guarda", () => {
  assert.deepEqual(
    comeSiPresenta({
      id: "d1",
      name: "TS0121",
      name_by_user: "Presa lavatrice",
      manufacturer: "TuYa",
      model: "TS0121",
      primary_config_entry_domain: "mqtt",
    }),
    {
      id: "d1",
      nome: "Presa lavatrice",
      marca: "TuYa",
      modello: "TS0121",
      tramite: "mqtt",
      entita: [],
    },
  );
  /* Appena entrato non ce l'ha ancora, e si presenta col suo modello: è
   * proprio per questo che il passo dopo chiede un nome. */
  assert.equal(comeSiPresenta({ id: "d2", name: "TS0121" }).nome, "TS0121");
  assert.equal(comeSiPresenta({}).nome, "");
});

test("e porta dentro le sue entità, che sono quelle che dicono cos'è", () => {
  /* Senza queste il passo dopo non si può fare: il foglietto «Dove lo metto?»
   * della plancia decide la sezione dall'ENTITÀ, e di un dispositivo senza
   * entità non sa dire niente. */
  const presa = comeSiPresenta({ id: "d1", name: "TS0121" }, [
    { entity_id: "switch.ts0121", original_device_class: "outlet", device_id: "d1" },
    {
      entity_id: "sensor.ts0121_power",
      device_class: "power",
      original_device_class: "energy",
      device_id: "d1",
    },
    {
      entity_id: "sensor.ts0121_rssi",
      original_device_class: "signal_strength",
      entity_category: "diagnostic",
      device_id: "d1",
    },
  ]);
  assert.deepEqual(presa.entita, [
    { entity: "switch.ts0121", classe: "outlet", categoria: "" },
    /* La classe cambiata a mano vince su quella di fabbrica: chi l'ha
     * corretta l'ha corretta per un motivo. */
    { entity: "sensor.ts0121_power", classe: "power", categoria: "" },
    { entity: "sensor.ts0121_rssi", classe: "signal_strength", categoria: "diagnostic" },
  ]);
});

test("una riga del registro senza entità non viaggia", () => {
  /* Non è teoria: un'entità disabilitata o appena cancellata può restare nel
   * registro senza `entity_id`, e una voce senza nome dall'altra parte
   * diventa una riga vuota in un elenco. */
  const suo = comeSiPresenta({ id: "d1" }, [
    { entity_id: "light.uno", device_id: "d1" },
    { device_id: "d1" },
    null,
  ]);
  assert.deepEqual(
    suo.entita.map((una) => una.entity),
    ["light.uno"],
  );
});

/* ── il giro ────────────────────────────────────────────────────────────── */

/* Le regole dei jolly di MQTT, quelle vere.
 *
 * `+` copre UN livello, `#` copre tutto quello che resta. Servono qui perché
 * la casa finta deve rifiutare quello che un broker rifiuterebbe: se consegna
 * a tutti, una domanda sbagliata sembra una domanda giusta. */
function copre(argomento, suo) {
  const chiesti = String(argomento ?? "").split("/");
  const arrivati = String(suo ?? "").split("/");
  for (let i = 0; i < chiesti.length; i += 1) {
    if (chiesti[i] === "#") return true;
    if (i >= arrivati.length) return false;
    if (chiesti[i] !== "+" && chiesti[i] !== arrivati[i]) return false;
  }
  return chiesti.length === arrivati.length;
}

function casaFinta({ voci = [], cassetta = "", dispositivi = [], entita = [] } = {}) {
  const detto = [];
  let mandaEvento = null;
  let mandaMqtt = null;
  return {
    detto,
    get mandaEvento() {
      return mandaEvento;
    },
    get mandaMqtt() {
      return mandaMqtt;
    },
    async chiedi(comando) {
      detto.push(comando);
      if (comando.type === "config_entries/get") return voci;
      if (comando.type === "config/device_registry/list") return dispositivi;
      if (comando.type === "config/entity_registry/list") return entita;
      return null;
    },
    async ascolta(evento, onEvento) {
      detto.push({ ascolta: evento });
      mandaEvento = onEvento;
      return async () => {
        detto.push({ smetti: evento });
        mandaEvento = null;
      };
    },
    async ascoltaIl(comando, onEvento) {
      detto.push({ ascoltaIl: comando.type, topic: comando.topic });
      mandaMqtt = onEvento;
      /* La cassetta risponde subito: il messaggio è già scritto lì dentro —
       * ma solo a chi ha chiesto un argomento che lo COPRE.
       *
       * Questa riga prima non c'era, e la casa finta consegnava a chiunque:
       * era più generosa di un broker vero, e per questo non si è accorta che
       * `+/bridge/info` non può far arrivare «casa/zigbee/bridge/info». In
       * MQTT il `+` copre un livello solo, e una prova che non lo sa è una
       * prova che dice sì dove la casa dice no. */
      const suo = `${cassetta}/bridge/info`;
      if (cassetta && copre(comando.topic, suo)) queueMicrotask(() => onEvento({ topic: suo }));
      return async () => {
        detto.push({ smetti: comando.type });
        mandaMqtt = null;
      };
    },
  };
}

test("con ZHA in casa non ci si affaccia nemmeno alla posta", () => {
  /* Con ZHA la risposta è già decisa: affacciarsi sarebbe un giro per niente,
   * e due secondi di attesa su una schermata che si sta aprendo. */
  const casa = casaFinta({ voci: [{ domain: "zha", state: "loaded" }], cassetta: "zigbee2mqtt" });
  const zigbee = new Zigbee({ casa });
  return zigbee.rete().then((rete) => {
    assert.equal(rete.quale, ZHA);
    assert.equal(
      casa.detto.some((uno) => uno.ascoltaIl),
      false,
    );
  });
});

test("senza ZHA si chiede alla posta come si chiama la cassetta", async () => {
  const casa = casaFinta({ cassetta: "casa/zigbee" });
  const zigbee = new Zigbee({ casa });
  const rete = await zigbee.rete();
  assert.deepEqual(rete, { quale: Z2M, cassetta: "casa/zigbee" });
  /* Col jolly, e a due profondità: non si tira a indovinare «zigbee2mqtt», e
   * un prefisso con le barre dentro deve poter arrivare. In MQTT il `+` copre
   * un livello solo, quindi `+/bridge/info` «casa/zigbee» non lo prende mai —
   * ed è il caso di questa prova. */
  const chiesti = casa.detto.filter((uno) => uno.ascoltaIl).map((uno) => uno.topic);
  assert.deepEqual(chiesti, ["+/bridge/info", "+/+/bridge/info"]);
  /* E ci si toglie di mezzo: l'abbonamento non resta appeso. */
  assert.equal(
    casa.detto.some((uno) => uno.smetti === "mqtt/subscribe"),
    true,
  );
});

test("una casa senza niente lo dice, e non aspetta due secondi ogni volta", async () => {
  const casa = casaFinta({ cassetta: "" });
  const zigbee = new Zigbee({ casa });
  const rete = await zigbee.rete();
  assert.equal(rete.quale, NESSUNA);
  /* La risposta si tiene: l'app la chiede a ogni apertura della schermata, e
   * «che rete hai» non cambia mentre uno guarda. */
  const quante = casa.detto.length;
  await zigbee.rete();
  assert.equal(casa.detto.length, quante);
});

test("si ascolta PRIMA di aprire: chi è già in attesa entra subito", async () => {
  /* Fra l'ordine e la rete aperta passano dei millisecondi, e un dispositivo
   * già in attesa entra in quel momento. Ascoltando dopo si perderebbe, e chi
   * guarda vedrebbe il conto alla rovescia scorrere su un dispositivo che è
   * già dentro. */
  const casa = casaFinta({ voci: [{ domain: "zha", state: "loaded" }] });
  const zigbee = new Zigbee({ casa });
  await zigbee.apri({ secondi: 30 });
  const ordine = casa.detto.map((uno) => uno.ascolta || uno.type).filter(Boolean);
  assert.deepEqual(ordine, ["config_entries/get", "device_registry_updated", "zha/permit"]);
  zigbee.spegni();
});

test("chi entra finisce nell'elenco, col suo nome, una volta sola", async () => {
  const casa = casaFinta({
    voci: [{ domain: "zha", state: "loaded" }],
    dispositivi: [{ id: "d1", name: "TS0121", manufacturer: "TuYa", model: "TS0121" }],
  });
  const zigbee = new Zigbee({ casa });
  await zigbee.apri({ secondi: 30 });

  await casa.mandaEvento({ action: "create", device_id: "d1" });
  /* Il registro annuncia anche le modifiche, e su un dispositivo appena
   * entrato ne arrivano parecchie. */
  await casa.mandaEvento({ action: "update", device_id: "d1" });
  await casa.mandaEvento({ action: "create", device_id: "d1" });

  const stato = await zigbee.stato();
  assert.equal(stato.entrati.length, 1);
  assert.equal(stato.entrati[0].nome, "TS0121");
  assert.equal(stato.entrati[0].marca, "TuYa");
  assert.equal(stato.aperta, true);
  assert.ok(stato.restano > 0 && stato.restano <= 30);
  zigbee.spegni();
});

test("chi entra porta con sé le sue entità, e solo le sue", async () => {
  const casa = casaFinta({
    voci: [{ domain: "zha", state: "loaded" }],
    dispositivi: [{ id: "d1", name: "TS0121" }],
    entita: [
      { entity_id: "switch.ts0121", original_device_class: "outlet", device_id: "d1" },
      { entity_id: "sensor.ts0121_power", original_device_class: "power", device_id: "d1" },
      /* Di un altro dispositivo: non deve viaggiare con questo. */
      { entity_id: "light.salone", device_id: "d2" },
    ],
  });
  const zigbee = new Zigbee({ casa });
  await zigbee.apri({ secondi: 30 });
  await casa.mandaEvento({ action: "create", device_id: "d1" });

  const suo = (await zigbee.stato()).entrati[0];
  assert.deepEqual(
    suo.entita.map((una) => una.entity),
    ["switch.ts0121", "sensor.ts0121_power"],
  );
  zigbee.spegni();
});

test("e se ne ricorda dopo la rinomina, senza richiedere il registro", async () => {
  /* Un cambio di nome non crea e non toglie entità: richiedere tutto il
   * registro per rileggere una cosa che si sa già sarebbe un giro per niente.
   * E senza ricordarsele, il comando che serve al passo dopo perderebbe per
   * strada proprio quello che al passo dopo serve. */
  const casa = casaFinta({
    voci: [{ domain: "zha", state: "loaded" }],
    dispositivi: [{ id: "d1", name: "TS0121" }],
    entita: [{ entity_id: "switch.ts0121", original_device_class: "outlet", device_id: "d1" }],
  });
  const zigbee = new Zigbee({ casa });
  await zigbee.apri({ secondi: 30 });
  await casa.mandaEvento({ action: "create", device_id: "d1" });
  const quanti = casa.detto.filter((uno) => uno.type === "config/entity_registry/list").length;

  const detto = await zigbee.rinomina("d1", "Presa lavatrice");
  assert.equal(detto.fatto, true);
  assert.deepEqual(
    detto.dispositivo.entita.map((una) => una.entity),
    ["switch.ts0121"],
  );
  assert.equal(
    casa.detto.filter((uno) => uno.type === "config/entity_registry/list").length,
    quanti,
    "il registro non si richiede per una rinomina",
  );
  zigbee.spegni();
});

test("riaprire la rete svuota l'elenco: quello di ieri non è quello di adesso", async () => {
  const casa = casaFinta({
    voci: [{ domain: "zha", state: "loaded" }],
    dispositivi: [{ id: "d1", name: "Vecchio" }],
  });
  const zigbee = new Zigbee({ casa });
  await zigbee.apri({ secondi: 30 });
  await casa.mandaEvento({ action: "create", device_id: "d1" });
  assert.equal((await zigbee.stato()).entrati.length, 1);

  await zigbee.apri({ secondi: 30 });
  assert.equal((await zigbee.stato()).entrati.length, 0);
  zigbee.spegni();
});

test("chiudere smette di ascoltare, e lo stato dice la verità", async () => {
  const casa = casaFinta({ voci: [{ domain: "zha", state: "loaded" }] });
  const zigbee = new Zigbee({ casa });
  await zigbee.apri({ secondi: 30 });
  await zigbee.chiudi();
  const stato = await zigbee.stato();
  assert.equal(stato.aperta, false);
  assert.equal(stato.restano, 0);
  await new Promise((fatto) => setImmediate(fatto));
  assert.equal(
    casa.detto.some((uno) => uno.smetti === "device_registry_updated"),
    true,
  );
});

test("in una casa senza rete non si apre niente, e si dice perché", async () => {
  const casa = casaFinta({});
  const zigbee = new Zigbee({ casa });
  const esito = await zigbee.apri();
  assert.equal(esito.fatto, false);
  assert.match(esito.perche, /non ha una rete/i);
  /* E non si è mandato niente in casa. */
  assert.equal(
    casa.detto.some((uno) => uno.type === "zha/permit" || uno.type === "call_service"),
    false,
  );
});

test("senza MQTT in casa la cassetta non c'è, e non è un guasto", async () => {
  const casa = {
    detto: [],
    async chiedi() {
      return [];
    },
    async ascolta() {
      return async () => {};
    },
    async ascoltaIl() {
      throw new Error("mqtt non configurato");
    },
  };
  const zigbee = new Zigbee({ casa });
  assert.equal((await zigbee.rete()).quale, NESSUNA);
});

test("l'attesa della cassetta è corta apposta", () => {
  /* Il messaggio è già scritto nella cassetta e arriva appena ci si affaccia:
   * far aspettare chi ha appena aperto una schermata è il modo di farla
   * sembrare rotta. */
  assert.ok(ATTESA_DELLA_CASSETTA <= 3000);
});

/* ── le commissioni: quello che il telefono può chiedere ─────────────────── */

test("i comandi zigbee esistono solo dove una rete c'è", async () => {
  const { Commissioni } = await import("../src/commissioni.js");
  const ZITTO = { info() {}, attenzione() {}, errore() {} };

  /* Un comando `ponte/zigbee/` è di questo ponte comunque — è nel suo nome —
   * e non si manda a Home Assistant, che non saprebbe cosa farsene. Anche su
   * un ponte che quella parte non ce l'ha: la risposta è un «non conosco»
   * suo, non una domanda girata a qualcun altro. */
  const senza = new Commissioni({ casa: {}, registro: ZITTO });
  assert.equal(senza.riconosce({ type: "ponte/zigbee/stato" }), true);
  const rifiuto = await senza.rispondi({ id: 1, type: "ponte/zigbee/stato" });
  assert.equal(rifiuto.success, false);
  assert.equal(rifiuto.error.code, "unknown_command");

  const casa = casaFinta({ voci: [{ domain: "zha", state: "loaded" }] });
  const zigbee = new Zigbee({ casa });
  const con = new Commissioni({ casa, registro: ZITTO, zigbee });
  for (const tipo of ["stato", "apri", "chiudi", "rinomina"])
    assert.equal(con.riconosce({ type: `ponte/zigbee/${tipo}` }), true, tipo);

  const stato = await con.rispondi({ id: 2, type: "ponte/zigbee/stato" });
  assert.equal(stato.success, true);
  assert.equal(stato.result.quale, ZHA);
  assert.equal(stato.result.aperta, false);

  const aperta = await con.rispondi({ id: 3, type: "ponte/zigbee/apri", secondi: 45 });
  assert.equal(aperta.success, true);
  assert.equal(aperta.result.restano, 45);

  /* E in una casa che una rete non ce l'ha, la risposta è «nessuna»: è quello
   * che l'app legge per non disegnare la voce nel menu. */
  const spoglia = new Zigbee({ casa: casaFinta({}) });
  const niente = await new Commissioni({ casa: {}, registro: ZITTO, zigbee: spoglia }).rispondi({
    id: 9,
    type: "ponte/zigbee/stato",
  });
  assert.equal(niente.success, true);
  assert.equal(niente.result.quale, NESSUNA);

  /* Un comando che non esiste si sente dire di no, non va in errore. */
  const boh = await con.rispondi({ id: 4, type: "ponte/zigbee/vola" });
  assert.equal(boh.success, false);
  assert.equal(boh.error.code, "unknown_command");
  zigbee.spegni();
});

test("il nome va nel registro di casa, in name_by_user e non sopra il modello", async () => {
  /* `name` è come si è presentato lui, e sovrascriverlo vorrebbe dire perdere
   * il modello — l'unica cosa che dice cos'è quell'oggetto quando fra un anno
   * non ci si ricorda più. */
  const casa = casaFinta({
    voci: [{ domain: "zha", state: "loaded" }],
    dispositivi: [{ id: "d1", name: "TS0121" }],
  });
  const zigbee = new Zigbee({ casa });
  await zigbee.apri({ secondi: 30 });
  await casa.mandaEvento({ action: "create", device_id: "d1" });

  const esito = await zigbee.rinomina("d1", "  Presa lavatrice  ");
  assert.equal(esito.fatto, true);
  const scritto = casa.detto.find((uno) => uno.type === "config/device_registry/update");
  assert.equal(scritto.device_id, "d1");
  assert.equal(scritto.name_by_user, "Presa lavatrice");
  assert.equal("name" in scritto, false);

  /* E chi sta guardando lo vede già col nome nuovo, senza richiedere tutto. */
  assert.equal((await zigbee.stato()).entrati[0].nome, "Presa lavatrice");

  assert.equal((await zigbee.rinomina("", "Boh")).fatto, false);
  assert.equal((await zigbee.rinomina("d1", "   ")).fatto, false);
  zigbee.spegni();
});

test("e la cassetta col nome semplice si trova lo stesso", () => {
  /* L'altra metà: «zigbee2mqtt», che è il nome di serie e quello che ha quasi
   * tutti. La copre la prima domanda, e la seconda non disturba nessuno. */
  const casa = casaFinta({ cassetta: "zigbee2mqtt" });
  return new Zigbee({ casa }).rete().then((rete) => {
    assert.deepEqual(rete, { quale: Z2M, cassetta: "zigbee2mqtt" });
  });
});
