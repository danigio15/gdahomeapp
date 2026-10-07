/* Un aggiornamento dell'Energia arriva in fondo, e si dipinge solo se il mese
 * e' ancora quello scelto (1.9.2).
 *
 * Il 1° ottobre il controllo del mese e' passato da `loadAtomicEnergyBundle` a
 * chi lo chiama, `eseguiIlRefresh`, ma con un nome che li' non esiste:
 * `chiave`. Il ReferenceError lo prendeva il `catch` dell'aggiornamento, quindi
 * non si vedeva niente di rotto: solo che nessun pacchetto si dipingeva piu', e
 * la pagina riprovava quaranta volte. Le prove chiamavano
 * `loadAtomicEnergyBundle` da sola, e quella era giusta.
 *
 * Qui si fa il giro intero, `refreshEnergy`, con un Recorder finto. Senza la
 * pagina il mese scelto e' quello dell'orologio, e l'orologio e' fermo: la
 * prova dice la stessa cosa in qualunque giorno giri.
 */
import assert from "node:assert/strict";
import test from "node:test";

const KWH = {
  unit_of_measurement: "kWh",
  device_class: "energy",
  state_class: "total_increasing",
};
const STATI = {
  "sensor.casa_tot": { state: "1234.5", attributes: KWH },
  "sensor.fv_tot": { state: "5678.9", attributes: KWH },
  "sensor.rete_imp_tot": { state: "300.1", attributes: KWH },
  "sensor.rete_exp_tot": { state: "200.2", attributes: KWH },
};
const ENERGIA = {
  house: { total_energy: "sensor.casa_tot" },
  solar: { total_energy: "sensor.fv_tot" },
  grid: {
    total_import_energy: "sensor.rete_imp_tot",
    total_export_energy: "sensor.rete_exp_tot",
  },
};

globalThis.document = undefined;
globalThis.STATES = STATI;
globalThis._RAW_STATES = STATI;
globalThis.DashboardModernModules = {
  data: { canonicalReportDevices: () => [] },
  store: {
    peekSection: (nome) =>
      ({
        energy: ENERGIA,
        appliances: [],
        loads: [],
        energyLoads: [],
        entityOverrides: {},
      })[nome],
  },
};

const energia = await import("../src/sections/energy-section.js");
const runtime = globalThis.__DASHBOARDMODERN_RUNTIME_ROOT__;
const broker = globalThis.DashboardModernEnergyService.broker;

/* Le due e mezza del pomeriggio del 6 settembre 2026: ci sono ore chiuse e
 * un'ora aperta, come in `il-pacchetto-dell-energia-in-tre-domande`. */
const ORA_FERMA = new Date(2026, 8, 6, 14, 30).getTime();

/* Un Recorder finto che risponde a tutto con mezzo kWh per secchiello. */
function recorderFinto() {
  broker.cache.clear();
  broker.inflight.clear();
  broker.statistics = async (ids, start, end, period) => {
    const passo =
      period === "5minute" ? 300e3 : period === "hour" ? 3600e3 : period === "day" ? 864e5 : 26e8;
    return Object.fromEntries(
      ids.map((id) => {
        const righe = [];
        let somma = 1000;
        for (let t = new Date(start).getTime(); t < new Date(end).getTime(); t += passo) {
          righe.push({ start: t, sum: somma });
          somma += 0.5;
        }
        return [id, righe];
      }),
    );
  };
}

function preparaIlGiro(t) {
  t.mock.timers.enable({ apis: ["Date"], now: ORA_FERMA });
  t.mock.method(console, "warn", () => {});
  runtime.bundle = null;
  runtime.lastError = "";
  recorderFinto();
}

test("l'aggiornamento arriva in fondo e il pacchetto si dipinge", async (t) => {
  preparaIlGiro(t);

  const fatto = await energia.refreshEnergy();

  assert.equal(runtime.lastError, "", "l'aggiornamento e' caduto per strada");
  assert.equal(fatto, true);
  assert.ok(runtime.bundle, "il pacchetto non e' arrivato alla pagina");
  assert.equal(runtime.bundle.period.year, 2026);
  assert.equal(runtime.bundle.period.month, 9);
  runtime.bundle = null;
});

test("un pacchetto di un mese che non e' quello scelto non si dipinge", async (t) => {
  preparaIlGiro(t);

  /* Il carico di agosto finisce quando sulla pagina c'e' gia' settembre: e'
   * quello che succede cambiando mese mentre il Recorder sta rispondendo. */
  const agosto = await energia.refreshEnergy({ year: 2026, month: 8 });

  assert.equal(runtime.lastError, "", "l'aggiornamento e' caduto per strada");
  assert.equal(agosto, false);
  assert.equal(runtime.bundle, null, "agosto si e' dipinto sopra settembre");
});
