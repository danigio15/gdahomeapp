/* Le prove del ferro: la macchina, la rete e gli add-on.
 *
 * Quello che si prova davvero: che i tre numeri che il Supervisor **non ha** —
 * CPU, memoria, temperatura — restano `null` invece di diventare zero, perche'
 * scrivere «CPU al 3%» su una scheda in ginocchio e' peggio che non scrivere
 * niente; che **l'SSID non esce**, che e' la sola cosa di questo rapporto che
 * parlerebbe di una persona; che un add-on fermo si conta solo se parte
 * all'avvio; e che un Supervisor mezzo muto da' mezza rapporto invece di
 * nessuna.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  Ferro,
  gliAddon,
  gliApparati,
  laMacchina,
  laRete,
  laScheda,
  leCaselleDelMiniPc,
} from "../src/ferro.js";

const ZITTO = { debug() {}, info() {}, attenzione() {}, errore() {} };

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

test("la scheda si chiama come la chiama chi la ripara", () => {
  assert.equal(laScheda("odroid-n2"), "ODROID-N2");
  assert.equal(laScheda("rpi5"), "Raspberry Pi 5");
  assert.equal(laScheda("generic-x86-64"), "PC x86-64");
  /* Una scheda che non conosciamo si lascia com'e': inventarle un
   * abbellimento vuol dire storpiarne il nome. */
  assert.equal(laScheda("khadas-vim4"), "KHADAS-VIM4");
  /* E dove il Supervisor non dice nessuna scheda — Supervised su una macchina
   * qualunque — si ripiega su cosa ci gira sopra. */
  assert.equal(laScheda("", "Debian GNU/Linux 13"), "Debian GNU/Linux 13");
});

test("senza System Monitor, CPU memoria e temperatura sono null e non zero", () => {
  const m = laMacchina({
    os: { board: "odroid-n2" },
    host: { disk_total: 32, disk_used: 16, disk_free: 16, disk_life_time: 11 },
    stati: [stato("light.cucina", "on")],
  });
  assert.equal(m.cpu, null);
  assert.equal(m.ram, null);
  assert.equal(m.temperatura, null);
  /* Quello che il Supervisor sa davvero c'e' lo stesso: e' il punto di
   * tenerli separati. */
  assert.equal(m.disco, 50);
  assert.equal(m.discoVita, 11);
  assert.equal(m.scheda, "ODROID-N2");
});

test("con System Monitor i tre numeri arrivano, coi nomi di adesso e con quelli di prima", () => {
  const nuovi = laMacchina({
    stati: [
      stato("sensor.system_monitor_processor_use", "14"),
      stato("sensor.system_monitor_memory_use_percent", "38.4"),
      stato("sensor.system_monitor_processor_temperature", "46.2"),
    ],
  });
  assert.deepEqual([nuovi.cpu, nuovi.ram, nuovi.temperatura], [14, 38, 46]);

  /* Una casa ferma a due anni fa e' esattamente la casa che un quadro deve
   * saper guardare. */
  const vecchi = laMacchina({
    stati: [stato("sensor.processor_use", "9"), stato("sensor.memory_use_percent", "22")],
  });
  assert.deepEqual([vecchi.cpu, vecchi.ram], [9, 22]);
});

test("chi ha mappato a mano la sezione MiniPC viene letto, e viene letto per primo", () => {
  /* «Ho inserito manualmente i dati della sezione dal configurazione... da
   * cruscotto installatore non escono le informazioni.» Quella casa non ha i
   * nomi di serie: ha i suoi, e la plancia li mostrava gia'. */
  const mappate = leCaselleDelMiniPc({
    cd_entity_overrides: JSON.stringify({
      "dm.server_cpu": "sensor.minipc_carico",
      "dm.server_ram": "sensor.minipc_memoria",
      "dm.server_temperatura_cpu": "sensor.package_id_0",
      /* Le altre caselle della sezione ci sono e non c'entrano: si ignorano. */
      "dm.server_speedtest_download": "sensor.giu",
    }),
  });
  assert.deepEqual(mappate, {
    cpu: "sensor.minipc_carico",
    ram: "sensor.minipc_memoria",
    temperatura: "sensor.package_id_0",
  });

  const m = laMacchina({
    mappate,
    stati: [
      stato("sensor.minipc_carico", "14.2"),
      stato("sensor.minipc_memoria", "62"),
      stato("sensor.package_id_0", "66"),
      /* E in casa c'e' anche System Monitor, che dice un'altra cosa: vince
       * quella scelta da chi abita, che ha mappato apposta. */
      stato("sensor.system_monitor_processor_use", "3"),
    ],
  });
  assert.deepEqual([m.cpu, m.ram, m.temperatura], [14, 62, 66]);
});

test("una casella vuota o scritta male ricade sui nomi di serie, invece di perdere il numero", () => {
  const m = laMacchina({
    mappate: leCaselleDelMiniPc({
      cd_entity_overrides: JSON.stringify({ "dm.server_cpu": "", "dm.server_ram": "senza-punto" }),
    }),
    stati: [
      stato("sensor.system_monitor_processor_use", "7"),
      stato("sensor.system_monitor_memory_use_percent", "21"),
    ],
  });
  assert.deepEqual([m.cpu, m.ram], [7, 21]);

  /* E una casella che punta a un sensore che non risponde non porta via il
   * numero: dietro c'e' ancora il nome di serie. */
  const muto = laMacchina({
    mappate: { cpu: "sensor.sparito" },
    stati: [
      stato("sensor.sparito", "unavailable"),
      stato("sensor.system_monitor_processor_use", "7"),
    ],
  });
  assert.equal(muto.cpu, 7);
});

test("uno scatto senza mappature non e' un errore: e' una casa che non le ha compilate", () => {
  assert.deepEqual(leCaselleDelMiniPc(null), {});
  assert.deepEqual(leCaselleDelMiniPc(undefined), {});
  assert.deepEqual(leCaselleDelMiniPc({}), {});
  /* Uno scatto scritto male non fa cadere il rapporto: si guarda altrove. */
  assert.deepEqual(leCaselleDelMiniPc({ cd_entity_overrides: "{non e' json" }), {});
  assert.deepEqual(leCaselleDelMiniPc({ cd_entity_overrides: "null" }), {});
  assert.deepEqual(leCaselleDelMiniPc({ cd_entity_overrides: 42 }), {});
  /* E lo scatto di una casa che non ha toccato il MiniPC lascia tutto ai
   * nomi di serie, che e' il comportamento di sempre. */
  const m = laMacchina({
    mappate: leCaselleDelMiniPc({ cd_stanze: '[{"name":"Sala"}]' }),
    stati: [stato("sensor.processor_use", "9")],
  });
  assert.equal(m.cpu, 9);
});

test("un sensore che non risponde non e' un numero: vale come se non ci fosse", () => {
  const m = laMacchina({
    stati: [
      stato("sensor.system_monitor_processor_use", "unavailable"),
      stato("sensor.processor_use", "17"),
    ],
  });
  assert.equal(m.cpu, 17);
});

test("una temperatura impossibile non e' una temperatura", () => {
  const m = laMacchina({ stati: [stato("sensor.processor_temperature", "3600")] });
  assert.equal(m.temperatura, null);
});

test("un disco che non dice la sua vita resta null: uno zero sarebbe rassicurante e falso", () => {
  const m = laMacchina({ host: { disk_total: 500, disk_used: 120, disk_free: 380 } });
  assert.equal(m.discoVita, null);
  assert.equal(m.disco, 24);
  assert.equal(m.discoLiberi, 380);
});

test("l'SSID non esce dalla casa", () => {
  const rete = laRete({
    network: {
      interfaces: [
        {
          interface: "wlan0",
          type: "wireless",
          enabled: true,
          connected: true,
          primary: true,
          ipv4: { address: ["192.168.4.22/24"] },
          wifi: { ssid: "Casa Rossi", signal: 38 },
        },
      ],
    },
    filoSu: true,
  });
  /* Una rete che si chiama «Casa Rossi» e' una persona, e questo rapporto va
   * a chi ha fatto l'impianto. Il segnale invece e' un numero, e spiega meta'
   * dei guai. */
  assert.ok(!JSON.stringify(rete).includes("Casa Rossi"));
  assert.ok(!JSON.stringify(rete).toLowerCase().includes("ssid"));
  assert.equal(rete.schede[0].segnale, 38);
  assert.equal(rete.schede[0].ip, "192.168.4.22");
});

test("una scheda giu' non porta con se' nessun indirizzo, e il segnale nemmeno", () => {
  const rete = laRete({
    network: {
      interfaces: [
        {
          interface: "eth0",
          type: "ethernet",
          connected: false,
          ipv4: { address: ["192.168.1.9/24"] },
        },
        { interface: "wlan0", type: "wireless", connected: false, wifi: { signal: 70 } },
      ],
    },
  });
  assert.equal(rete.schede[0].ip, "");
  assert.equal(rete.schede[1].segnale, null);
  assert.equal(rete.internet, false);
});

test("«c'e' internet» e' il filo del ponte, non un ping a un indirizzo scelto da noi", () => {
  assert.equal(laRete({ filoSu: true }).internet, true);
  assert.equal(laRete({ filoSu: false }).internet, false);
});

test("gli apparati non spuntati sono zero, e zero si manda", () => {
  const stati = [
    stato("binary_sensor.router", "on", { device_class: "connectivity" }),
    stato("binary_sensor.telefono_di_marco", "on", { device_class: "connectivity" }),
  ];
  /* Senza scelte non si adotta niente: la classe da sola prenderebbe dentro
   * ogni telefono e ogni presa Wi-Fi della casa, ed e' la regola che la
   * plancia si e' gia' data. */
  assert.deepEqual(gliApparati(stati), { quante: 0, giu: 0 });
  assert.deepEqual(gliApparati(stati, { scelte: ["binary_sensor.router"] }), {
    quante: 1,
    giu: 0,
  });
});

test("per un apparato, «non risponde» e «Home Assistant non ci parla piu'» sono lo stesso guaio", () => {
  const conto = gliApparati(
    [
      stato("binary_sensor.ripetitore_su", "on"),
      stato("binary_sensor.ripetitore_giu", "off"),
      stato("binary_sensor.ripetitore_sparito", "unavailable"),
    ],
    {
      scelte: [
        "binary_sensor.ripetitore_su",
        "binary_sensor.ripetitore_giu",
        "binary_sensor.ripetitore_sparito",
      ],
    },
  );
  assert.deepEqual(conto, { quante: 3, giu: 2 });
});

test("fermo vuol dire fermo **e** con l'avvio automatico", () => {
  const conto = gliAddon({
    addons: [
      { name: "Mosquitto broker", state: "stopped", boot: "auto" },
      /* Spento a mano da chi ci abita: e' una scelta, non un guasto, e
       * ripeterglielo ogni quarto d'ora insegna a non guardare piu'. */
      { name: "Studio Code Server", state: "stopped", boot: "manual" },
      { name: "gdahome", state: "started", boot: "auto" },
    ],
  });
  assert.equal(conto.quanti, 3);
  assert.equal(conto.accesi, 1);
  assert.equal(conto.spentiCheDovrebbero, 1);
  /* In ordine alfabetico, cosi' due rapporti di fila non sembrano diverse.
   * Non e' l'ordine di `aggiornamentiDaFare`, che mette le cose nostre in
   * cima: li' serve a far trovare subito gdahome in un elenco di sei righe
   * uguali, qui l'elenco e' di pastiglie e si legge tutto insieme. */
  assert.deepEqual(
    conto.elenco.map((uno) => uno.nome),
    ["gdahome", "Mosquitto broker", "Studio Code Server"],
  );
});

test("un Supervisor mezzo muto da' mezza rapporto, non nessuna", async () => {
  const ferro = new Ferro({
    segno: "segno-finto",
    registro: ZITTO,
    async fetch(dove) {
      if (dove.endsWith("/network/info")) return { ok: false, status: 403 };
      if (dove.endsWith("/addons"))
        return { ok: true, json: async () => ({ data: { addons: [{ name: "gdahome" }] } }) };
      return { ok: true, json: async () => ({ data: { board: "odroid-n2" } }) };
    },
  });
  const detto = await ferro.chiedi();
  assert.equal(detto.network, null);
  assert.equal(detto.addons.length, 1);
  assert.equal(detto.os.board, "odroid-n2");
});

test("senza il segno del Supervisor non si bussa nemmeno", async () => {
  let bussato = 0;
  const ferro = new Ferro({
    segno: "",
    registro: ZITTO,
    fetch: async () => {
      bussato += 1;
      return { ok: true, json: async () => ({}) };
    },
  });
  await ferro.chiedi();
  assert.equal(bussato, 0);
});

test("una risposta vale un minuto: quaranta rapporti non fanno quaranta giri di domande", async () => {
  let quante = 0;
  let ora = 0;
  const ferro = new Ferro({
    segno: "s",
    registro: ZITTO,
    adesso: () => ora,
    quantoDura: 60_000,
    fetch: async () => {
      quante += 1;
      return { ok: true, json: async () => ({ data: {} }) };
    },
  });
  await ferro.chiedi();
  await ferro.chiedi();
  assert.equal(quante, 6, "sei vie, chieste una volta sola");
  ora += 61_000;
  await ferro.chiedi();
  assert.equal(quante, 12);
});
