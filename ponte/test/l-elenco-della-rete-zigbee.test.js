/* Chi c'e' nella rete, e come si toglie.
 *
 * «Voglio vedere elenco completo dei dispositivi e poterli eliminare.»
 *
 * Le due reti l'elenco lo danno in due modi diversi — ZHA risponde a una
 * domanda sul filo, Zigbee2MQTT lo tiene scritto in una cassetta — e quello
 * che esce dal ponte deve essere una forma sola: se chi disegna dovesse sapere
 * quale rete c'è in casa, ogni schermata andrebbe scritta due volte, e il
 * giorno che una delle due cambia le due direbbero cose diverse.
 *
 * E l'elimina si controlla. Non perché sia prudente: perché la rinomina ha già
 * insegnato, dal campo, quanto vale un «fatto» che nessuno ha guardato — «in
 * Home Assistant non ha cambiato il nome», mentre la schermata diceva che sì.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  comeSiChiedeLElenco,
  comeSiElimina,
  COORDINATORE,
  laCassettaDellElenco,
  laPotenza,
  laRigaDiZ2M,
  laRigaDiZha,
  lElencoDellaRete,
  leStradePerEliminare,
  ROUTER,
  TERMINALE,
  Z2M,
  ZHA,
  Zigbee,
} from "../src/zigbee.js";

const zitto = { debug() {}, info() {}, attenzione() {}, errore() {} };

/* Come le scrive ZHA. */
const DA_ZHA = [
  {
    ieee: "00:12:4B:00:1C:A1:B2:C3",
    user_given_name: "Presa garage",
    name: "lumi.plug",
    manufacturer: "LUMI",
    model: "lumi.plug.maeu01",
    device_type: "Router",
    power_source: "Mains",
    device_reg_id: "dev-presa",
    neighbors: [{ ieee: "00:12:4b:00:00:00:00:01", lqi: 180 }],
  },
  {
    ieee: "00:12:4B:00:00:00:00:01",
    name: "Coordinator",
    device_type: "Coordinator",
    power_source: "Mains",
  },
  {
    ieee: "00:15:8D:00:0A:BB:CC:DD",
    user_given_name: "Sensore cantina",
    manufacturer: "Aqara",
    model: "RTCGQ11LM",
    device_type: "EndDevice",
    power_source: "Battery or Unknown",
  },
];

/* E come li scrive Zigbee2MQTT. */
const DA_Z2M = [
  {
    ieee_address: "0x00124b001ca1b2c3",
    friendly_name: "Presa garage",
    type: "Router",
    power_source: "Mains (single phase)",
    definition: { vendor: "Xiaomi", model: "ZNCZ12LM" },
  },
  {
    ieee_address: "0x00158d000abbccdd",
    friendly_name: "Sensore cantina",
    type: "EndDevice",
    power_source: "Battery",
    definition: { vendor: "Aqara", model: "RTCGQ11LM" },
  },
];

test("una riga di ZHA e una di Zigbee2MQTT escono con la stessa faccia", () => {
  const zha = laRigaDiZha(DA_ZHA[0]);
  const z2m = laRigaDiZ2M(DA_Z2M[0]);
  assert.deepEqual(Object.keys(zha).sort(), Object.keys(z2m).sort());
  /* Il nome, il tipo e come va alimentato sono gli stessi fatti detti in due
   * dialetti: qui diventano una lingua sola. */
  for (const chiave of ["nome", "tipo", "potenza"]) assert.equal(zha[chiave], z2m[chiave]);
  assert.equal(zha.nome, "Presa garage");
  assert.equal(zha.tipo, ROUTER);
  assert.equal(zha.potenza, "rete");
});

test("la targa si scrive in un modo solo, anche se le due la scrivono diversa", () => {
  /* ZHA la scrive coi due punti e in maiuscolo, Zigbee2MQTT tutta attaccata
   * con lo «0x» davanti. Sono lo stesso apparecchio, e per la plancia devono
   * esserlo: se no lo stesso coso comparirebbe due volte. */
  assert.equal(laRigaDiZha(DA_ZHA[0]).id, "00:12:4b:00:1c:a1:b2:c3");
  assert.equal(laRigaDiZ2M(DA_Z2M[0]).id, "0x00124b001ca1b2c3");
});

test("i tre tipi si riconoscono in tutt'e due i dialetti", () => {
  assert.equal(
    lElencoDellaRete(ZHA, DA_ZHA).find((una) => una.tipo === COORDINATORE).nome,
    "Coordinator",
  );
  assert.equal(laRigaDiZha(DA_ZHA[2]).tipo, TERMINALE);
  assert.equal(laRigaDiZ2M(DA_Z2M[1]).tipo, TERMINALE);
});

test("a batteria o a corrente, e «non si sa» resta vuoto", () => {
  /* Sapere chi va a batteria è metà del mestiere quando una rete fa i
   * capricci. Chi non lo dice però non lo si inventa: vuoto è vuoto, ed è
   * diverso da «a corrente». */
  assert.equal(laPotenza("Battery or Unknown"), "batteria");
  assert.equal(laPotenza("Mains (single phase)"), "rete");
  assert.equal(laPotenza("DC Source"), "rete");
  assert.equal(laPotenza(""), "");
  assert.equal(laPotenza("boh"), "");
});

test("l'elenco esce in ordine di nome, che è l'unica cosa che uno riconosce", () => {
  const righe = lElencoDellaRete(ZHA, DA_ZHA);
  assert.deepEqual(
    righe.map((una) => una.nome),
    ["Coordinator", "Presa garage", "Sensore cantina"],
  );
});

test("una riga senza targa non entra: non si saprebbe di chi parla", () => {
  assert.equal(laRigaDiZha({ name: "Boh" }), null);
  assert.equal(lElencoDellaRete(Z2M, [{ friendly_name: "Boh" }]).length, 0);
});

test("i vicini si tengono, e servono alla mappa", () => {
  assert.deepEqual(laRigaDiZha(DA_ZHA[0]).vicini, [
    { id: "00:12:4b:00:00:00:00:01", qualita: 180 },
  ]);
  /* Chi non li ha non ha una mappa, e non è un guasto: la topologia si legge
   * quando qualcuno l'ha guardata. */
  assert.deepEqual(laRigaDiZha(DA_ZHA[1]).vicini, []);
});

test("a ZHA l'elenco si chiede, a Zigbee2MQTT si va a leggere", () => {
  assert.deepEqual(comeSiChiedeLElenco({ quale: ZHA }), { type: "zha/devices" });
  assert.equal(comeSiChiedeLElenco({ quale: Z2M }), null);
  assert.equal(laCassettaDellElenco("zigbee2mqtt"), "zigbee2mqtt/bridge/devices");
  assert.equal(laCassettaDellElenco("casa/zigbee"), "casa/zigbee/bridge/devices");
  assert.equal(laCassettaDellElenco(""), "");
});

test("togliere uno: il servizio per primo, e il comando interno dopo", () => {
  /* Stessa ragione di «apri»: il servizio è la superficie pubblica e si rompe
   * molto più di rado del comando interno, perché romperlo vuol dire rompere
   * le automazioni di chiunque. */
  const strade = leStradePerEliminare({ quale: ZHA }, "00:12:4B:00:1C:A1:B2:C3");
  assert.equal(strade.length, 2);
  assert.equal(strade[0].domain, "zha");
  assert.equal(strade[0].service, "remove");
  assert.equal(strade[0].service_data.ieee, "00:12:4b:00:1c:a1:b2:c3");
  assert.equal(strade[1].type, "zha/remove");
});

test("su Zigbee2MQTT si imbuca, e non si forza", () => {
  const comando = comeSiElimina({ quale: Z2M, cassetta: "zigbee2mqtt" }, "0x00124b001ca1b2c3");
  assert.equal(comando.service_data.topic, "zigbee2mqtt/bridge/request/device/remove");
  const scritto = JSON.parse(comando.service_data.payload);
  assert.equal(scritto.id, "0x00124b001ca1b2c3");
  /* Forzare toglie la riga senza che l'apparecchio lo sappia, e quello resta
   * appeso a cercare un coordinatore che non gli risponde più. */
  assert.equal(scritto.force, false);
});

test("senza rete non si toglie niente da nessuna parte", () => {
  assert.equal(comeSiElimina({ quale: "" }, "0x01"), null);
  assert.equal(comeSiElimina({ quale: Z2M, cassetta: "" }, "0x01"), null);
  assert.deepEqual(leStradePerEliminare({ quale: "" }, "0x01"), []);
});

/* ── E il giro vero, con una casa finta ────────────────────────────────── */

function casaConZha({ righe = DA_ZHA, toglie = null } = {}) {
  const detto = [];
  let dentro = righe.slice();
  return {
    detto,
    async chiedi(comando) {
      detto.push(comando);
      if (comando.type === "config_entries/get") return [{ domain: "zha", state: "loaded" }];
      if (comando.type === "zha/devices") return dentro;
      if (comando.domain === "zha" && comando.service === "remove") {
        if (toglie === false) return null;
        dentro = dentro.filter(
          (una) => una.ieee.toLowerCase() !== comando.service_data.ieee.toLowerCase(),
        );
        return null;
      }
      return null;
    },
    async ascoltaIl() {
      return async () => {};
    },
  };
}

test("l'elenco arriva davvero, passando per il giro", async () => {
  const casa = casaConZha();
  const zigbee = new Zigbee({ casa, registro: zitto });
  const fuori = await zigbee.elenco();
  assert.equal(fuori.quale, ZHA);
  assert.equal(fuori.righe.length, 3);
  assert.equal(fuori.perche, "");
});

test("in una casa senza Zigbee l'elenco è vuoto e lo dice, invece di rompersi", async () => {
  const casa = {
    async chiedi(comando) {
      if (comando.type === "config_entries/get") return [];
      return null;
    },
    async ascoltaIl() {
      return async () => {};
    },
  };
  const fuori = await new Zigbee({ casa, registro: zitto }).elenco();
  assert.deepEqual(fuori.righe, []);
  assert.match(fuori.perche, /non c'e' una rete Zigbee/);
});

test("tolto uno, l'elenco che torna non ce l'ha più", async () => {
  const casa = casaConZha();
  const zigbee = new Zigbee({ casa, registro: zitto });
  const fuori = await zigbee.elimina("00:15:8D:00:0A:BB:CC:DD");
  assert.equal(fuori.fatto, true);
  assert.ok(!fuori.righe.some((una) => una.nome === "Sensore cantina"));
  assert.equal(fuori.righe.length, 2);
});

test("se la rete dice sì e non lo toglie, non si dice «fatto»", async () => {
  /* È la lezione della rinomina, applicata prima che costi una segnalazione:
   * nessuna delle due reti conferma quello che è successo dopo — rispondono
   * di aver mandato l'ordine. L'unica conferma è riguardare l'elenco. */
  const casa = casaConZha({ toglie: false });
  const fuori = await new Zigbee({ casa, registro: zitto }).elimina("00:15:8D:00:0A:BB:CC:DD");
  assert.equal(fuori.fatto, false);
  assert.match(fuori.perche, /ancora li/);
  assert.equal(fuori.righe.length, 3);
});

test("senza targa non si tocca niente", async () => {
  const casa = casaConZha();
  const fuori = await new Zigbee({ casa, registro: zitto }).elimina("");
  assert.equal(fuori.fatto, false);
  assert.equal(casa.detto.length, 0, "non si chiede nemmeno che rete c'è");
});
