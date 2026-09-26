/* Il tasto della ventola dell'inverter manda un ordine vero (#112).
 *
 * «Ventola inverter indica il sensore di potenza ma manca proprio la
 * possibilità di inserire entità switch.»
 *
 * La casella c'era, e da un pezzo: nella scheda «🌡️ Temperature e
 * raffreddamento» dell'Energia, col segnaposto `switch.ventola_inverter`.
 * Quello che non c'è mai stato è l'ORDINE. Premendo la card, il guscio
 * mandava a Home Assistant:
 *
 *     switch.toggle  →  entity_id: "dm.energy_interruttore_ventola_inverter"
 *
 * cioè il NOME DELLA CASELLA al posto dell'entità che ci avevano messo
 * dentro. Quel nome non è un'entità e non esiste in nessuna casa: Home
 * Assistant non trovava niente da accendere e non succedeva niente.
 *
 * La lettura invece passava — `getRawState` il riferimento lo scioglie — ed è
 * per questo che da fuori sembrava che la casella dello switch non ci fosse:
 * la potenza si vedeva, l'interruttore no.
 *
 * Queste prove tengono ferme le due metà della correzione: che l'ordine parta
 * sull'entità VERA, e che quando non si può partire lo si DICA — un tasto che
 * non fa niente e tace lascia chi lo preme a chiedersi se sia rotta la
 * ventola, il telefono o la plancia.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  DOMINI_DI_SOLA_LETTURA,
  RIFERIMENTO_DELLA_VENTOLA,
  ilComandoDellaVentola,
} from "../src/core/la-ventola-dell-inverter.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");

test("il riferimento della casella NON esce mai come entità", () => {
  /* Questa è la forma esatta del guasto, e la riga che lo tiene chiuso.
   *
   * `dm.energy_interruttore_ventola_inverter` è il nome della casella, non
   * un'entità: mandarlo a Home Assistant è chiedere di accendere una cosa che
   * non esiste. Chi non ha mappato niente si ritrova col riferimento non
   * sciolto in mano, ed è proprio lì che il guasto ricomparirebbe. */
  const detto = ilComandoDellaVentola(RIFERIMENTO_DELLA_VENTOLA);
  assert.equal(detto.si, false);
  assert.equal(detto.perche, "non-mappata");
  assert.equal(detto.chiamata, undefined, "non deve partire proprio niente");
  /* E qualunque altro riferimento non sciolto, non solo il suo. */
  for (const ref of ["dm.energy_potenza_ventola_inverter", "dm.core_031", "dm."])
    assert.equal(ilComandoDellaVentola(ref).si, false, `${ref} non è un'entità`);
});

test("uno switch, un fan, un input_boolean: la casella non dice «switch»", () => {
  /* Il segnaposto è un esempio, non una regola. Chi ha la ventola su un
   * `fan.` o su un `input_boolean.` ha ragione quanto chi ce l'ha su uno
   * `switch.`, e la plancia non deve decidere per lui. */
  for (const entita of [
    "switch.ventola_inverter",
    "fan.inverter_top",
    "input_boolean.ventola",
    "light.spia_ventola",
    "script.raffredda",
  ]) {
    const detto = ilComandoDellaVentola(entita);
    assert.equal(detto.si, true, `${entita} si deve poter comandare`);
    assert.deepEqual(detto.chiamata, {
      domain: "homeassistant",
      service: "toggle",
      entity_id: entita,
    });
  }
});

test("`homeassistant.toggle` e non `switch.toggle`: una regola sola", () => {
  /* `homeassistant.toggle` gira il comando al dominio giusto da solo. Una
   * tabella di domini invece andrebbe tenuta aggiornata, e il giorno che Home
   * Assistant ne aggiunge uno la plancia escluderebbe quella casa senza
   * dirlo. */
  const chiamata = ilComandoDellaVentola("fan.inverter_top").chiamata;
  assert.equal(chiamata.domain, "homeassistant");
  assert.notEqual(chiamata.domain, "fan", "il dominio non si indovina dall'entità");
  assert.notEqual(chiamata.domain, "switch", "e nemmeno si assume");
});

test("quello che si legge soltanto non si accende, e lo si dice", () => {
  for (const dominio of DOMINI_DI_SOLA_LETTURA) {
    const detto = ilComandoDellaVentola(`${dominio}.qualcosa`);
    assert.equal(detto.si, false, `${dominio} non si comanda`);
    assert.equal(detto.perche, "non-si-comanda");
    assert.equal(detto.entita, `${dominio}.qualcosa`, "e si dice quale");
  }
  /* L'elenco è quello corto di ciò che di sicuro NON si comanda, non quello
   * lungo di ciò che si comanda: così il dominio nuovo di domani passa invece
   * di essere escluso da una tabella che nessuno ha aggiornato. */
  assert.ok(DOMINI_DI_SOLA_LETTURA.includes("sensor"));
  assert.ok(!DOMINI_DI_SOLA_LETTURA.includes("switch"));
  assert.ok(!DOMINI_DI_SOLA_LETTURA.includes("fan"));
  assert.ok(DOMINI_DI_SOLA_LETTURA.length < 12, "l'elenco corto resta corto");
});

test("una casella vuota e una parola che non è un'entità si distinguono", () => {
  /* Sono due consigli diversi: la prima vuol dire «vai a metterci qualcosa»,
   * la seconda «quello che ci hai messo non si scrive così». Un messaggio
   * solo per tutt'e due manderebbe metà delle persone a cercare nel posto
   * sbagliato. */
  for (const niente of ["", "   ", null, undefined])
    assert.equal(ilComandoDellaVentola(niente).perche, "non-mappata");
  for (const storto of ["ventola", "switch.", "switch", ".ventola"])
    assert.equal(ilComandoDellaVentola(storto).perche, "non-un-entita", `«${storto}»`);
});

test("il tasto del guscio cambia padrone, e resta cambiato", async () => {
  const sorgente = await leggi("sections/la-ventola-dell-inverter-section.js");
  /* Il guscio ridefinisce `toggleVentola` quando si ricarica: metterlo una
   * volta sola non basta, e il segno serve a non incatenare venti copie della
   * stessa funzione a ogni giro. È la stessa mano con cui «Salva costi» ha
   * preso il suo padrone. */
  assert.ok(sorgente.includes("root.toggleVentola = toggleVentola"));
  assert.ok(sorgente.includes("__dmVentolaInverter"));
  assert.ok(
    sorgente.includes("ora.__dmVentolaInverter) return true"),
    "se c'è già il padrone buono non se ne mette un altro",
  );
  /* E l'entità si scioglie dal riferimento invece di mandarlo così com'è:
   * è il gesto che mancava. */
  assert.ok(sorgente.includes("resolver?.(RIFERIMENTO_DELLA_VENTOLA)"));
  /* La presa è quella vera — la stessa di luci, tapparelle e clima — e non
   * una inventata: mancando lei il tasto non chiamerebbe niente, ed è già
   * successo una volta col tasto del clima. */
  assert.ok(sorgente.includes("root.dmCallHaService"));
});

test("non si fallisce in silenzio: ogni «no» ha la sua frase", async () => {
  const sorgente = await leggi("sections/la-ventola-dell-inverter-section.js");
  /* Le tre ragioni del nucleo devono avere tutte una frase, o resta un «no»
   * muto — che è il modo in cui questo guasto è rimasto invisibile per tanto
   * tempo. */
  for (const motivo of ["non-mappata", "non-si-comanda"])
    assert.ok(sorgente.includes(`"${motivo}"`), `manca la frase per ${motivo}`);
  assert.ok(sorgente.includes("Temperature e raffreddamento"), "e dice DOVE mettercela");
  /* E anche quando nessuno prende la chiamata: «fatto» e «non c'era nessuno»
   * non sono la stessa cosa. */
  assert.ok(sorgente.includes("if (chiama(detto.chiamata)) return true"));
});
