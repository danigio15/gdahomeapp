/* Le altre macchine di casa, fra il ponte e il cruscotto.
 *
 * «Nel lato installatore devono comparire anche eventuali macchine inserite e
 * nodi presenti.» Chi ha un cluster — un Proxmox, un NAS, un secondo mini PC —
 * lo dichiara nella sezione MiniPC della plancia, e da lì non usciva: chi
 * installa vedeva la macchina di Home Assistant e non le altre, cioè non
 * vedeva proprio quelle su cui nessuno guarda mai.
 *
 * Anche qui i due lati non si importano: il ponte riempie `nodi` in
 * `ponte/src/ferro.js`, la console lo disegna in `quadro/console/index.html`.
 * Fra i due c'è un oggetto JSON che viaggia, e una chiave ribattezzata da una
 * parte sola farebbe sparire il riquadro in silenzio. Qui si guardano in
 * faccia una volta.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { iNodiDelCluster } from "../../ponte/src/ferro.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const CONSOLE = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

/* Un cluster come lo scrive la plancia: tre righe in `cd_nodi`. */
const SCATTO = {
  cd_nodi: JSON.stringify([
    {
      id: "n1",
      nome: "pve1",
      stato: "binary_sensor.pve1_status",
      cpu: "sensor.pve1_cpu",
      ram: "sensor.pve1_ram",
      disco: "sensor.pve1_disk",
      temperatura: "sensor.pve1_temp",
    },
    { id: "n2", nome: "pve2", stato: "binary_sensor.pve2_status", cpu: "sensor.pve2_cpu" },
    { id: "n3", nome: "NAS", stato: "binary_sensor.nas_online" },
  ]),
};
const STATI = [
  stato("binary_sensor.pve1_status", "on"),
  stato("sensor.pve1_cpu", "23", { unit_of_measurement: "%" }),
  stato("sensor.pve1_ram", "61", { unit_of_measurement: "%" }),
  stato("sensor.pve1_disk", "44", { unit_of_measurement: "%" }),
  stato("sensor.pve1_temp", "58", { unit_of_measurement: "°C" }),
  stato("binary_sensor.pve2_status", "unavailable"),
  stato("sensor.pve2_cpu", "12", { unit_of_measurement: "%" }),
  stato("binary_sensor.nas_online", "off"),
];

test("le chiavi che il ponte manda sono quelle che la console legge", () => {
  const nodi = iNodiDelCluster(SCATTO, STATI);
  assert.equal(nodi.length, 3);
  /* Ogni nodo porta queste, e la console non ne cerca altre. */
  assert.deepEqual(Object.keys(nodi[0]).sort(), [
    "acceso",
    "cpu",
    "disco",
    "muto",
    "nome",
    "ram",
    "temperatura",
  ]);
  for (const chiave of Object.keys(nodi[0]))
    assert.ok(
      new RegExp(`uno\\.${chiave}\\b`).test(CONSOLE),
      `la console non legge mai «${chiave}»: il ponte lo manda per niente`,
    );
  /* E il riquadro si prende l'elenco da `c.nodi`, che è dove il ponte lo mette. */
  assert.match(CONSOLE, /Array\.isArray\(c\.nodi\) \? c\.nodi : \[\]/);
});

test("il riquadro sta accanto a quello della macchina, dove chi installa lo cerca", () => {
  assert.match(CONSOLE, /\$\{laMacchina\(c\)\} \$\{leAltreMacchine\(c\)\} \$\{laRete\(c\)\}/);
  assert.match(CONSOLE, /<h3>Le altre macchine<\/h3>/);
});

test("una casa senza cluster non ha un riquadro vuoto: non ha un riquadro", () => {
  assert.deepEqual(iNodiDelCluster({ cd_stanze: "[]" }, STATI), []);
  /* E la console, con l'elenco vuoto, non disegna niente — come la plancia,
   * dove la fascia non esiste finché nessuno ha configurato un nodo. */
  assert.match(CONSOLE, /if \(!nodi\.length\) return "";/);
});

test("una macchina giù finisce fra le anomalie, che è dove si guarda per primo", () => {
  const nodi = iNodiDelCluster(SCATTO, STATI);
  const giu = nodi.filter((uno) => uno.muto || uno.acceso === false);
  /* Due: pve2 non risponde, il NAS è spento. pve1 sta su. */
  assert.deepEqual(
    giu.map((uno) => uno.nome),
    ["pve2", "NAS"],
  );
  assert.match(CONSOLE, /const macchineGiu = \(Array\.isArray\(c\.nodi\) \? c\.nodi : \[\]\)/);
  assert.match(CONSOLE, /macchineGiu\s*\.map\(/);
  /* «Nessuna anomalia» non si scrive più quando una macchina è giù. */
  assert.match(CONSOLE, /!rotti\.length && !macchineGiu\.length && stato\.chiave !== "offline"/);
});

test("«non risponde» e «spento» restano due parole diverse fino in fondo", () => {
  const [, muto, spento] = iNodiDelCluster(SCATTO, STATI);
  assert.deepEqual([muto.muto, muto.acceso], [true, null]);
  assert.deepEqual([spento.muto, spento.acceso], [false, false]);
  /* Portano a due lavori diversi — la rete o l'interruttore — e la console le
   * tiene separate sia nella riga sia fra le anomalie. */
  assert.match(CONSOLE, /uno\.muto\s*\?\s*"non risponde"\s*:\s*"spento"/);
  assert.match(CONSOLE, /\? "non risponde"[\s\S]{0,120}\? "spento"/);
});

test("le entità di casa non escono: viaggiano i numeri e il nome scelto", () => {
  const scritto = JSON.stringify(iNodiDelCluster(SCATTO, STATI));
  assert.equal(scritto.includes("binary_sensor"), false);
  assert.equal(scritto.includes("sensor."), false);
  /* Il nome sì: senza, chi installa avrebbe tre macchine tutte uguali e non
   * saprebbe quale andare a guardare. */
  assert.ok(scritto.includes("pve1"));
});
