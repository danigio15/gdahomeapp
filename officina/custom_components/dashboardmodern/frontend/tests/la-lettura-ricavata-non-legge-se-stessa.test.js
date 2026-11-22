/* La lettura ricavata non legge se stessa.
 *
 * «Maximum call stack size exceeded» sopra l'Energia, e molte entita' non
 * lette (la #480). Con la sola immissione dichiarata (o la sola scarica della
 * batteria) la plancia ricava la potenza con segno e la pubblica come
 * `dm_derived.grid_power`. Quel nome finiva nella sua casella delle entita' e,
 * al primo avvio dopo, il recupero della configurazione lo copiava nel campo
 * vuoto della potenza: da li' la lettura ricavata era anche una sua sorgente,
 * e il suo getter si richiamava fino a esaurire la pila. Ogni avvio dopo
 * ricadeva, perche' il nome restava salvato.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { adoptEnergySlots, ENERGY_SLOT_MAP } from "../src/core/energy-projection.js";
import { powerPairSource, signedSourceEntities } from "../src/core/signed-energy.js";

const SALVATA = {
  grid: { power: "dm_derived.grid_power", power_export: "sensor.rete_immissione_w" },
};

test("una lettura ricavata salvata come potenza non e' una sorgente", () => {
  const coppia = powerPairSource(SALVATA, "grid");
  assert.equal(coppia?.main ?? "", "", "il nome ricavato non e' il prelievo");
  assert.ok(
    !signedSourceEntities(SALVATA).some((id) => id.startsWith("dm_derived.")),
    "fra le sorgenti non c'e' nessuna lettura ricavata",
  );
});

test("la casella con il nome ricavato non torna nella configurazione", () => {
  const casella = Object.entries(ENERGY_SLOT_MAP).find(([path]) => path === "grid.power")?.[1];
  assert.ok(casella, "la casella della potenza della rete esiste");
  const energia = { grid: { power_export: "sensor.rete_immissione_w" } };
  const dopo = adoptEnergySlots(energia, { [casella]: "dm_derived.grid_power" });
  assert.equal(dopo.grid?.power ?? "", "");
  /* Un'entita' vera nella stessa casella invece si adotta come prima. */
  const vera = adoptEnergySlots(energia, { [casella]: "sensor.rete_w" });
  assert.equal(vera.grid.power, "sensor.rete_w");
});
