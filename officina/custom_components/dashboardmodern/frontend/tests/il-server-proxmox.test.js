/* Il server Proxmox, per intero.
 *
 * «Proxmox non lo aggiunge correttamente: o lo aggiungi come macchina e mi fai
 * vedere tutti i dati, o lo aggiungi come nodi», e «più cose per il nodo
 * principale, anche aggiornamenti da fare».
 *
 * Il server e' quello dell'integrazione Proxmox VE 4.0.2 di HACS, con i nomi
 * di dispositivo e le chiavi di traduzione che crea lei (vedi
 * `fixtures/proxmox-pve.js`).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  entitaRaccontate,
  quantita,
  serverProxmox,
  tipoDelDispositivo,
} from "../src/core/proxmox.js";
import { DISPOSITIVI, ENTITA, MORTE, stati } from "./fixtures/proxmox-pve.js";

const ADESSO = Date.parse("2026-10-25T11:05:00Z");
const server = () =>
  serverProxmox({ dispositivi: DISPOSITIVI, entita: ENTITA, states: stati(ADESSO) });

test("ognuno e' quello che e': nodo, VM, container, disco, storage; la lavatrice no", () => {
  const tipo = (id) =>
    tipoDelDispositivo(
      DISPOSITIVI.find((d) => d.id === id),
      ENTITA[id],
    );
  assert.equal(tipo("dev-node"), "nodo");
  assert.equal(tipo("dev-qemu100"), "qemu");
  assert.equal(tipo("dev-lxc101"), "lxc");
  assert.equal(tipo("dev-disk1"), "disco");
  assert.equal(tipo("dev-storage"), "storage");
  /* Un nodo rinominato a mano resta un nodo: lo dicono le sue entita'. */
  assert.equal(
    tipoDelDispositivo({ name: "Il mio server", model: "Intel(R) N100" }, ENTITA["dev-node"]),
    "nodo",
  );
  const { nodi } = server();
  assert.equal(nodi.length, 1);
  assert.ok(!JSON.stringify(nodi).includes("Lavatrice"));
});

test("il nodo principale: stato, CPU, memoria, disco, swap, da quando e' acceso, quante VM e container", () => {
  const [pve] = server().nodi;
  assert.equal(pve.nome, "pve");
  assert.equal(pve.processore, "Intel(R) N100");
  assert.equal(pve.stato, "su");
  assert.equal(pve.cpu, 14.6);
  assert.equal(pve.memoria.perc, 60.95);
  assert.equal(quantita(pve.memoria.usata, "it"), "20,3 GB");
  assert.equal(pve.disco.perc, 33.3);
  assert.equal(pve.swap, 4.1);
  assert.equal(pve.vmAccese, 1);
  assert.equal(pve.ctAccesi, 2);
  assert.ok(Math.abs(Date.parse(pve.avvio) - (ADESSO - 21.3 * 86_400_000)) < 1000);
});

test("gli aggiornamenti da fare: quanti, e quali pacchetti", () => {
  const [pve] = server().nodi;
  assert.equal(pve.aggiornamenti.quanti, 118);
  assert.equal(pve.aggiornamenti.ci, true);
  assert.ok(pve.aggiornamenti.pacchetti.includes("pve-manager 8.4.14"));
  /* Senza il conto basta il sensore «ci sono aggiornamenti». */
  const senzaConto = {
    ...ENTITA,
    "dev-node": ENTITA["dev-node"].filter((e) => e.translation_key !== "updates_total"),
  };
  const [n] = serverProxmox({
    dispositivi: DISPOSITIVI,
    entita: senzaConto,
    states: stati(ADESSO),
  }).nodi;
  assert.equal(n.aggiornamenti.quanti, null);
  assert.equal(n.aggiornamenti.ci, true);
});

test("le VM e i container stanno sotto il loro nodo, coi loro numeri e i loro tasti", () => {
  const [pve] = server().nodi;
  assert.deepEqual(
    pve.guest.map((g) => `${g.tipo} ${g.vmid} ${g.nome}`),
    ["qemu 100 homeassistant", "lxc 101 cloudflared", "lxc 102 docker-frigate"],
  );
  const frigate = pve.guest.find((g) => g.vmid === "102");
  assert.equal(frigate.stato, "su");
  assert.equal(frigate.cpu, 37.9);
  assert.equal(frigate.memoria.perc, 83.5);
  assert.equal(frigate.disco.perc, 92.4);
  assert.deepEqual(Object.keys(frigate.tasti).sort(), ["shutdown", "start"]);
  const ha = pve.guest.find((g) => g.vmid === "100");
  assert.equal(quantita(ha.reteIn, "it"), "1834 MB");
  assert.equal(ha.problema, false);
});

test("i dischi con la salute, la temperatura e la vita che resta; lo storage pieno quanto", () => {
  const [pve] = server().nodi;
  assert.deepEqual(
    pve.dischi.map((d) => [d.nome, d.sano, d.temperatura, d.vita]),
    [
      ["CT1000P3PSSD8", true, 41, 97],
      ["WD BLACK SN850X 1000GB", true, 38, 98],
    ],
  );
  assert.equal(pve.storage[0].nome, "local-lvm");
  assert.equal(pve.storage[0].perc, 47.6);
});

test("un disco che si guasta lo dice", () => {
  const states = stati(ADESSO);
  states["binary_sensor.disk_pve_ct1000p3pssd8_health"].state = "on";
  const [pve] = serverProxmox({ dispositivi: DISPOSITIVI, entita: ENTITA, states }).nodi;
  assert.equal(pve.dischi.find((d) => d.nome === "CT1000P3PSSD8").sano, false);
});

test("una VM ferma e un nodo che non risponde non inventano numeri", () => {
  const states = stati(ADESSO);
  states["binary_sensor.qemu_homeassistant_100_status"].state = "off";
  states["sensor.node_pve_cpu_used"].state = "unavailable";
  states["binary_sensor.node_pve_status"].state = "unavailable";
  const [pve] = serverProxmox({ dispositivi: DISPOSITIVI, entita: ENTITA, states }).nodi;
  assert.equal(pve.stato, "");
  assert.equal(pve.cpu, null);
  const ha = pve.guest.find((g) => g.vmid === "100");
  assert.equal(ha.stato, "giu");
  /* Chi e' acceso viene prima di chi e' fermo. */
  assert.equal(pve.guest.at(-1).vmid, "100");
});

test("finche' le entita' non arrivano il server c'e' lo stesso, coi nomi", () => {
  const [pve] = serverProxmox({ dispositivi: DISPOSITIVI, entita: {}, states: {} }).nodi;
  assert.equal(pve.nome, "pve");
  assert.equal(pve.guest.length, 3);
  assert.equal(pve.cpu, null);
});

test("le fasce delle macchine non ripetono quello che racconta il pannello", () => {
  const raccontate = entitaRaccontate(server());
  assert.ok(raccontate.has("binary_sensor.lxc_cloudflared_101_status"));
  assert.ok(raccontate.has("binary_sensor.node_pve_status"));
  for (const morta of MORTE) assert.ok(!raccontate.has(morta));
});

test("senza Proxmox non c'e' niente", () => {
  assert.deepEqual(
    serverProxmox({ dispositivi: [DISPOSITIVI.at(-1)], entita: {}, states: {} }).nodi,
    [],
  );
});
