/* «Ho premuto Toglilo d'imperio ed e' ricomparso da solo.»
 *
 * Forzando, Zigbee2MQTT cancella la riga ma l'apparecchio non lo sa: tiene le
 * chiavi della rete e al primo risveglio rientra. Adesso il forzato lo blocca
 * fuori, il ponte se lo ricorda, e quando si riapre la rete per abbinare
 * qualcosa toglie dalla lista dei bloccati solo quelli che ci aveva messo lui.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { Zigbee, comeSiElimina, comeSiSblocca, iBloccatiDellaRete } from "../src/zigbee.js";

const Z2M = { quale: "zigbee2mqtt", cassetta: "zigbee2mqtt" };
const TARGA = "0xa4c1383bc66e8728";
const zitto = { debug() {}, info() {}, attenzione() {}, errore() {} };
const subito = async () => {};
const ilCorpo = (ordine) => JSON.parse(ordine.service_data.payload);

test("forzando, l'ordine blocca anche fuori; il garbato no", () => {
  assert.equal(ilCorpo(comeSiElimina(Z2M, TARGA, { forza: true })).block, true);
  assert.equal("block" in ilCorpo(comeSiElimina(Z2M, TARGA)), false);
});

test("si tolgono dalla lista solo quelli del ponte", () => {
  const ordine = comeSiSblocca(Z2M, [TARGA.toUpperCase(), "0xaltro"], [TARGA]);
  assert.equal(ordine.service_data.topic, "zigbee2mqtt/bridge/request/options");
  assert.deepEqual(ilCorpo(ordine), { options: { blocklist: ["0xaltro"] } });
  /* Niente da togliere: niente ordine. */
  assert.equal(comeSiSblocca(Z2M, ["0xaltro"], [TARGA]), null);
  assert.equal(comeSiSblocca(Z2M, [TARGA], []), null);
  assert.equal(comeSiSblocca({ quale: "zha", cassetta: "" }, [TARGA], [TARGA]), null);
});

test("la lista dei bloccati si legge da bridge/info", () => {
  assert.deepEqual(iBloccatiDellaRete({ config: { blocklist: [TARGA] } }), [TARGA]);
  assert.deepEqual(iBloccatiDellaRete({}), []);
});

function casaZ2M({ bloccati = [] } = {}) {
  const detto = [];
  return {
    detto,
    async chiedi(comando) {
      detto.push(comando);
      if (comando.type === "config_entries/get") return [];
      if (comando.type === "config/device_registry/list") return [];
      return null;
    },
    async ascoltaIl(comando, onEvento) {
      const topic = comando.topic;
      const payload = topic.endsWith("bridge/info")
        ? JSON.stringify({ config: { blocklist: bloccati } })
        : "[]";
      queueMicrotask(() => onEvento({ topic: topic.replace(/^\+/, "zigbee2mqtt"), payload }));
      return async () => {};
    },
    async ascolta() {
      return async () => {};
    },
  };
}

test("tolto d'imperio, il ponte se lo ricorda; riaprendo la rete lo sblocca", async () => {
  const archivio = {
    dati: { bloccati: [] },
    salvato: 0,
    salva() {
      this.salvato += 1;
    },
  };
  const casa = casaZ2M({ bloccati: [TARGA, "0xaltro"] });
  const zigbee = new Zigbee({ casa, registro: zitto, aspetta: subito, archivio });
  const fuori = await zigbee.elimina(TARGA, { perForza: true });
  assert.equal(fuori.fatto, true);
  assert.deepEqual(archivio.dati.bloccati, [TARGA]);

  await zigbee.apri({ secondi: 60 });
  const sblocca = casa.detto.find((uno) =>
    String(uno?.service_data?.topic || "").endsWith("bridge/request/options"),
  );
  assert.ok(sblocca, "riaprendo si toglie il blocco");
  assert.deepEqual(ilCorpo(sblocca), { options: { blocklist: ["0xaltro"] } });
  /* E l'ordine di sblocco parte prima di quello che apre. */
  const dove = (pezzo) =>
    casa.detto.findIndex((uno) => String(uno?.service_data?.topic || "").endsWith(pezzo));
  assert.ok(dove("bridge/request/options") < dove("bridge/request/permit_join"));
  assert.deepEqual(archivio.dati.bloccati, []);
  zigbee.ferma?.();
});
