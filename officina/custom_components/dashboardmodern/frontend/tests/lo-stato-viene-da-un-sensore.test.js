/* Lo stato di un'apparecchiatura di rete letto da un sensore (#177).
 *
 * «Ho un sistema di ping esterno che per ogni apparecchio mi dà online,
 * latenza, uptime, pacchetti persi.» Lo stato arriva in un `sensor.*` che
 * scrive `online` o `up`, e la riga diceva «Assente» di un apparecchio che
 * rispondeva: la regola capiva solo la lingua dei `binary_sensor`.
 *
 * Qui si tiene fermo che:
 *   · l'automatico capisca anche online, up, connesso, raggiungibile — senza
 *     che chi aveva gia' configurato debba toccare niente;
 *   · «Scelgo io» guardi lo stato o un attributo, con le parole scelte, e
 *     dica del resto quello che si e' scelto;
 *   · `unavailable` e `unknown` restino «non risponde» in tutt'e due i modi;
 *   · la regola arrivi al salvataggio e torni indietro intera;
 *   · fra le altre letture, un indirizzo IP o una versione si leggano interi.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPI_IN_PIU,
  comeSta,
  conLaRiga,
  macchineERete,
  paroleDiPartenza,
  regolaDelloStato,
  regolaScritta,
  righeDichiarate,
  valoreDelloStato,
} from "../src/core/macchine-e-rete.js";
import { letturaDelDispositivo } from "../src/core/letture-accanto.js";

const sensore = (state, attributes = {}) => ({ state, attributes });

test("l'automatico capisce anche le parole di un sensore qualunque", () => {
  for (const parola of ["online", "up", "Online", "UP", "connesso", "reachable", "raggiungibile"])
    assert.equal(comeSta(sensore(parola)), "su", parola);
  /* Le parole di sempre dicono quello che dicevano. */
  for (const parola of ["on", "true", "home", "connected", "running", "open"])
    assert.equal(comeSta(sensore(parola)), "su", parola);
  for (const parola of ["off", "offline", "down", "disconnected", "false"])
    assert.equal(comeSta(sensore(parola)), "giu", parola);
});

test("unavailable e unknown non dicono mai giù, in nessuno dei due modi", () => {
  const mia = { modo: "mio", inLinea: ["up"], altrimenti: "giu" };
  const sullAttributo = { modo: "mio", attributo: "stato_ping", inLinea: ["up"] };
  for (const muta of ["unavailable", "unknown", "Unavailable"]) {
    assert.equal(comeSta(sensore(muta)), "", muta);
    assert.equal(comeSta(sensore(muta), mia), "", muta);
    /* Anche se l'attributo e' rimasto scritto: e' l'ultima cosa saputa, non
     * quella di adesso. */
    assert.equal(comeSta(sensore(muta, { stato_ping: "up" }), sullAttributo), "", muta);
  }
  assert.equal(comeSta(undefined), "");
});

test("Scelgo io: contano le parole scelte, e il resto dice quello che si è scelto", () => {
  const regola = { modo: "mio", inLinea: ["attivo", "OK"], altrimenti: "giu" };
  assert.equal(comeSta(sensore("attivo"), regola), "su");
  assert.equal(comeSta(sensore("ok"), regola), "su", "le maiuscole non contano");
  /* Una parola dell'automatico che chi configura non ha scelto non vale. */
  assert.equal(comeSta(sensore("on"), regola), "giu");
  assert.equal(comeSta(sensore("spento"), { ...regola, altrimenti: "muto" }), "");
});

test("Scelgo io: si può guardare un attributo invece dello stato", () => {
  const regola = { modo: "mio", attributo: "raggiungibile", inLinea: ["true"], altrimenti: "giu" };
  const ap = sensore("192.168.1.20", { raggiungibile: true, friendly_name: "Access point" });
  assert.equal(comeSta(ap, regola), "su");
  assert.deepEqual(valoreDelloStato(ap, regola), { valore: "true", muto: false });
  assert.equal(comeSta(sensore("192.168.1.20", { raggiungibile: false }), regola), "giu");
  /* Un attributo che non c'e' non e' una risposta: non risponde. */
  assert.equal(comeSta(sensore("192.168.1.20", {}), regola), "");
  /* In automatico l'attributo scritto non si guarda: si guarda lo stato. */
  assert.equal(comeSta(ap, { ...regola, modo: "auto" }), "giu");
});

test("la regola si ripulisce, e l'automatico mai toccato non si scrive", () => {
  assert.deepEqual(regolaDelloStato(undefined), {
    modo: "auto",
    attributo: "",
    inLinea: [],
    altrimenti: "giu",
  });
  assert.deepEqual(
    regolaDelloStato({ modo: "mio", inLinea: [" Up ", "up", "unavailable", ""], altrimenti: "x" }),
    { modo: "mio", attributo: "", inLinea: ["up"], altrimenti: "giu" },
  );
  assert.equal(regolaScritta(undefined), null);
  assert.equal(regolaScritta({ modo: "auto" }), null);
  assert.equal(regolaScritta({ modo: "mio" }).modo, "mio");
});

test("chi passa a Scelgo io parte da parole che danno lo stesso esito", () => {
  assert.deepEqual(paroleDiPartenza(sensore("up")), ["up", "online", "on"]);
  assert.deepEqual(paroleDiPartenza(sensore("offline")), ["online", "on", "up"]);
  const regola = { modo: "mio", inLinea: paroleDiPartenza(sensore("up")) };
  assert.equal(comeSta(sensore("up"), regola), comeSta(sensore("up")));
});

test("la regola è un campo della riga, e arriva al salvataggio intera", () => {
  assert.ok(CAMPI_IN_PIU.includes("stato"), "senza stare qui la regola non si salva");
  const riga = {
    entity: "sensor.nas_stato",
    name: "NAS",
    icon: "server",
    famiglia: "rete",
    stato: { modo: "mio", attributo: "", inLinea: ["up", "online"], altrimenti: "muto" },
  };
  const salvata = conLaRiga({}, -1, riga, CAMPI_IN_PIU);
  const riletta = righeDichiarate(JSON.parse(JSON.stringify(salvata)), CAMPI_IN_PIU);
  assert.deepEqual(riletta[0].stato, riga.stato);
});

test("nella fascia Rete un sensor che vale up è connesso, e la regola della riga conta", () => {
  const states = {
    "sensor.ap_sala_stato": sensore("up"),
    "sensor.ap_garage_stato": sensore("down"),
    "sensor.nas_stato": sensore("alive", { ping: "ok" }),
  };
  const config = {
    righe: [
      { entity: "sensor.ap_sala_stato", name: "Access point sala", famiglia: "rete" },
      { entity: "sensor.ap_garage_stato", name: "Access point garage", famiglia: "rete" },
      {
        entity: "sensor.nas_stato",
        name: "NAS",
        famiglia: "rete",
        stato: { modo: "mio", attributo: "ping", inLinea: ["ok"] },
      },
    ],
  };
  const { rete } = macchineERete(states, config);
  const di = (nome) => rete.find((riga) => riga.name === nome)?.stato;
  assert.equal(di("Access point sala"), "su");
  assert.equal(di("Access point garage"), "giu");
  assert.equal(di("NAS"), "su");
  /* Prima quello che e' giu': e' la ragione per cui uno apre la pagina. */
  assert.equal(rete[0].name, "Access point garage");
});

test("fra le altre letture un indirizzo IP e una versione si leggono interi", () => {
  const states = {
    "sensor.ap_sala_ip": sensore("192.168.1.20", { friendly_name: "Access point sala IP" }),
    "sensor.ap_sala_firmware": sensore("2.4.1", { friendly_name: "Access point sala Firmware" }),
    "sensor.ap_sala_latenza": sensore("3.2", {
      friendly_name: "Access point sala Latenza",
      unit_of_measurement: "ms",
    }),
    "sensor.ap_sala_persi": sensore("-0,5", { friendly_name: "Access point sala Persi" }),
  };
  const riga = { entity: "sensor.ap_sala_stato", name: "Access point sala" };
  const ip = letturaDelDispositivo("sensor.ap_sala_ip", riga, states, "it");
  assert.equal(ip.testo, "192.168.1.20");
  assert.equal(ip.valore, null);
  assert.equal(letturaDelDispositivo("sensor.ap_sala_firmware", riga, states, "it").testo, "2.4.1");
  /* I numeri veri restano numeri, con la loro unita'. */
  const latenza = letturaDelDispositivo("sensor.ap_sala_latenza", riga, states, "it");
  assert.equal(latenza.testo, "3,2 ms");
  assert.equal(latenza.valore, 3.2);
  assert.equal(letturaDelDispositivo("sensor.ap_sala_persi", riga, states, "it").valore, -0.5);
});
