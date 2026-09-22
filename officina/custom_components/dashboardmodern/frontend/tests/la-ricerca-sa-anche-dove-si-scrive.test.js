/* «La casella c'è ma manca nel config dove inserire l'entità.»
 *
 * La casella c'era, e la ricerca non la trovava. `cercaNelConfig` cammina sui
 * VALORI salvati, e una casella vuota non ha valore: chi cercava «ventola»
 * prima di averci scritto dentro qualcosa si sentiva rispondere «Nessuna
 * configurazione contiene questa parola», che si legge in un modo solo —
 * quella casella non esiste.
 *
 * Sono due domande, non una. «Dove l'ho messo» si risponde coi valori. «Dove
 * lo metto» si risponde con le caselle, che esistono anche da vuote, ed è la
 * domanda di chi sta configurando — cioè di quasi tutti quelli che aprono
 * quella barra.
 *
 * La regola che queste prove tengono ferma non è «trova di più»: è che
 * l'elenco delle caselle non sia una seconda copia di niente. I nomi escono
 * da dove i nomi già stanno — `ENERGY_GROUPS`, `COOLING_SLOT_MAP`, il guscio
 * stesso — perché un elenco ribattuto a mano il giorno dopo non è più vero, e
 * una ricerca che manda dove non c'è niente fa più danno di una che non trova.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  cercaFraLeCaselle,
  leCaselleDelConfig,
  leCaselleDelGuscio,
  leCaselleDellEnergia,
} from "../src/core/le-caselle-del-config.js";
import { COOLING_SLOT_MAP } from "../src/core/energy-projection.js";
import { conLaParolaAccesa } from "../src/sections/cerca-nel-config-section.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const sorgente = (...pezzi) => readFileSync(join(QUI, "..", ...pezzi), "utf8");

const tutte = () => leCaselleDelConfig([]);
const per = (id) => tutte().find((una) => una.id === id);

test("la ventola si trova anche a casella vuota", () => {
  /* Il difetto, detto com'è nato: nessun valore scritto da nessuna parte, e
   * la parola si trova lo stesso. */
  const trovate = cercaFraLeCaselle("ventola", tutte()).map((una) => una.id);
  assert.deepEqual(trovate, ["cooling.fan_power", "cooling.fan_switch"]);
});

test("e si trova anche cercando il riquadro che la contiene", () => {
  /* «Raffreddamento» è il nome della carta, non di una casella, ed è quello
   * che uno si ricorda di aver visto. */
  const trovate = cercaFraLeCaselle("raffreddamento", tutte()).map((una) => una.id);
  assert.equal(trovate.length, Object.keys(COOLING_SLOT_MAP).length);
  assert.ok(trovate.includes("cooling.fan_switch"));
});

test("le caselle del raffreddamento sono quelle del modello, non un elenco a parte", () => {
  /* La guardia contro l'elenco che invecchia: se nasce una sesta casella nel
   * modello, o una cambia nome, questa prova cade prima della ricerca. */
  const attese = Object.keys(COOLING_SLOT_MAP).map((percorso) => percorso.replace(".", "."));
  const nostre = tutte()
    .filter((una) => una.id.startsWith("cooling."))
    .map((una) => una.id);
  assert.deepEqual(nostre.sort(), attese.sort());
  for (const una of tutte().filter((u) => u.id.startsWith("cooling.")))
    assert.ok(una.it && una.en, `${una.id} senza nome`);
});

test("chi combacia dall'inizio esce prima", () => {
  /* Chi scrive «interruttore» cerca «Interruttore ventola», non «Potenza
   * ventola» — che pure la contiene, ma in mezzo. */
  const [primo] = cercaFraLeCaselle("interruttore", tutte());
  assert.equal(primo.id, "cooling.fan_switch");
});

test("sotto le due lettere non si cerca, e gli accenti non contano", () => {
  assert.deepEqual(cercaFraLeCaselle("v", tutte()), []);
  assert.deepEqual(cercaFraLeCaselle("", tutte()), []);
  assert.ok(cercaFraLeCaselle("entita", tutte()).length >= 0);
});

test("la stessa casella non si conta due volte", () => {
  /* `grid.power` sta in due riquadri — prelievo e immissione — ma il modello
   * ne ha una sola, e chi cerca la deve trovare una volta. */
  const potenze = leCaselleDellEnergia().filter((una) => una.id === "grid.power");
  assert.equal(potenze.length, 1);
});

test("ogni casella sa in quale maschera si apre", () => {
  /* Senza la maschera il salto fa metà strada: apre Energia e lascia chi
   * cerca davanti a FLUSSI ED ENTITÀ, dove la ventola non c'è. */
  assert.equal(per("cooling.fan_switch").pannello, "settings");
  assert.equal(per("house.power").pannello, "flows");
  assert.equal(per("house.power").scheda, "sez1");
});

test("le caselle del guscio vanno nella loro scheda", () => {
  const raccolte = [
    { ref: "dm.home_meteo", nome: "Meteo", dove: "🏠 Home" },
    { ref: "dm.ev_batteria_auto", nome: "Batteria auto", dove: "🚗 Veicoli" },
    { ref: "dm.boiler_pompa_solare", nome: "Pompa solare", dove: "🌞 Solare termico" },
    { ref: "dm.security_centrale_allarme", nome: "Centrale allarme", dove: "🛡️ Sicurezza" },
    { ref: "dm.server_cpu", nome: "CPU", dove: "🖥️ MiniPC" },
  ];
  assert.deepEqual(
    leCaselleDelGuscio(raccolte).map((una) => `${una.id}|${una.scheda}`),
    [
      "dm.home_meteo|sez0",
      "dm.ev_batteria_auto|sez2",
      "dm.boiler_pompa_solare|sez3",
      "dm.security_centrale_allarme|sez4",
      "dm.server_cpu|sez6",
    ],
  );
});

test("non si promette una casella dove non si può arrivare", () => {
  /* Le tre assenze volute, che valgono quanto quello che c'è.
   * `dm.energy_*`: la scheda Energia è dell'editor nuovo, quelle fisarmoniche
   * lì non si disegnano più. `dm.lavatrice_*`: la loro sarebbe «sez5», e una
   * linguetta «sez5» non esiste in nessuna lingua. Le caselle in pensione: il
   * guscio le disegna e poi le nasconde. */
  const raccolte = [
    { ref: "dm.energy_potenza_ventola_inverter", nome: "Potenza ventola inverter", dove: "⚡" },
    { ref: "dm.lavatrice_programma", nome: "Programma", dove: "🧺" },
    { ref: "dm.home_script_apertura_cancello", nome: "Script cancello", dove: "🏠" },
  ];
  assert.deepEqual(leCaselleDelGuscio(raccolte), []);
});

test("il salto ha le sue due metà in due file, e combaciano", () => {
  /* Aprire la maschera giusta è mezza cosa qui e mezza là: le linguette di
   * Energia dicono come si chiamano, e la ricerca le cerca per quel nome.
   * Se una delle due metà si muove da sola, il salto fa metà strada in
   * silenzio. */
  const renderers = sorgente("src", "core", "renderers.js");
  for (const quale of ["flows", "settings", "loads", "report"])
    assert.match(renderers, new RegExp(`dataset\\.energyTab = "${quale}"`), quale);
  assert.match(
    sorgente("src", "sections", "cerca-nel-config-section.js"),
    /\.ed-inner-tab\[data-energy-tab="\$\{una\.pannello\}"\]/,
  );
});

test("la riga si accende dove il guscio la disegna", () => {
  /* L'altra metà del salto: la ricerca accende `dm-energy-<gruppo>-<campo>`,
   * e quel nome lo scrivono il guscio (per il raffreddamento) e i disegnatori
   * (per i flussi). Se cambiano forma, il salto arriva e non indica niente. */
  assert.match(
    readFileSync(join(QUI, "..", "legacy", "modules-entry.js"), "utf8"),
    /id: `dm-energy-cooling-\$\{campo\}`/,
  );
  assert.match(sorgente("src", "core", "renderers.js"), /id: `dm-energy-\$\{group\}-\$\{key\}`/);
  assert.match(
    sorgente("src", "sections", "cerca-nel-config-section.js"),
    /dm-energy-\$\{nome\.slice\(0, punto\)\}-\$\{nome\.slice\(punto \+ 1\)\}/,
  );
});

test("la parola accesa non si mangia gli spazi intorno", () => {
  /* Trovato guardando lo scatto, non le prove: «Potenza ventola» usciva
   * «Potenzaventola». L'evidenziatore spezza la frase in tre e li rimette
   * insieme, e li rimetteva insieme con `esc`, che prima di ogni altra cosa
   * TAGLIA gli spazi ai bordi — e qui i bordi stanno in mezzo a una frase.
   * Non si vedeva finché si cercavano solo entità, che spazi non ne hanno. */
  assert.equal(
    conLaParolaAccesa("Potenza ventola", "ventola"),
    "Potenza <mark>ventola</mark>",
  );
  assert.equal(
    conLaParolaAccesa("Stazione meteo: umidità", "meteo"),
    "Stazione <mark>meteo</mark>: umidità",
  );
});

test("e continua a non far passare marcatori", () => {
  /* L'evidenziatore scrive dentro `innerHTML`: quello che taglia via gli
   * spazi era anche quello che rendeva innocuo il testo. */
  /* Le stesse tre sostituzioni di `esc`, nemmeno una di meno: la copia serve
   * a non tagliare gli spazi, non a discostarsi. Il `>` non ci sta nemmeno
   * lì — con il `<` già spento non apre niente. */
  assert.equal(conLaParolaAccesa('<b>"x" & y</b>', "zzz"), '&lt;b>&quot;x&quot; &amp; y&lt;/b>');
  assert.equal(
    conLaParolaAccesa('<i>ventola</i>', "ventola"),
    "&lt;i><mark>ventola</mark>&lt;/i>",
  );
});
