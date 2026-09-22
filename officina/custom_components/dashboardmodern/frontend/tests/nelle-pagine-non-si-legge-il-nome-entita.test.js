/* «Non voglio vedere il nome entità.»
 *
 * Detto la prima volta per le finestre dei dispositivi — «nei popup dei
 * dispositivi accesi mi devi togliere la riga sotto al nome» — e subito dopo
 * allargato: «questo lo devi emulare per tutti quanti», e poi «sì fallo anche
 * nelle pagine».
 *
 * Sotto il nome di una porta c'era `binary_sensor.porta_cantina`, sotto una
 * batteria `sensor.telecomando_battery`, sotto una riga delle sue entità il
 * nome tecnico che si era scelto da solo. Quella riga risponde a una domanda
 * che si fa chi CONFIGURA — «quale entità ho messo in questa casella» — e chi
 * configura ha le sue schede, dove l'identificativo c'è, si legge e serve.
 * Chi apre una pagina vuole sapere se la finestra è aperta.
 *
 * Qui si guarda che resti diviso così: le pagine e le finestre che si
 * **guardano** non scrivono identificativi, le schede che si **compilano** sì.
 * E si guarda su tutte, non solo su quelle sistemate quel giorno: una sezione
 * nuova che rimette l'identificativo sotto un nome deve far cadere questa
 * prova, non passare inosservata.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const SEZIONI = join(QUI, "..", "src", "sections");

/* Un identificativo **scritto a schermo**: un `<small>`, un `<b>`, un `<p>`
 * con addosso la classe che lo mette in carattere fisso. Non una casella da
 * riempire (`<input class="ed-input mono">`): quella è una casella, e sta in
 * una scheda della configurazione per definizione. */
const SCRITTO_A_SCHERMO = /<(?:small|span|p|b|code|div|strong)[^>]*class="[^"]*\bmono\b/;

/* Le schede che si compilano: lì l'identificativo ci vuole, e toglierlo
 * sarebbe il difetto opposto — una casella piena di cui non si sa cosa
 * contiene. Tutte quelle col nome `*-editor-*`, più queste, che editor si
 * chiamano in un altro modo. */
const ANCHE_QUESTE_SI_COMPILANO = new Map([
  ["auto-integrazione-section.js", "la scheda che lega un'auto a un'integrazione"],
  ["beta26-real-device-stability-section.js", "le caselle dei carichi figli"],
  [
    "come-sta-la-casa-section.js",
    "la scheda della barra sotto il meteo: le entità scelte a mano, una riga per pastiglia",
  ],
  ["editor-polish-section.js", "le caselle dei server"],
  ["entity-search-section.js", "il cercatore di entità: l'elenco da cui si sceglie"],
  ["flood-alerts-section.js", "la scheda degli allagamenti"],
  ["lights-alerts-section.js", "la scheda delle luci"],
  ["prese-section.js", "la scheda delle prese"],
  [
    "scheda-dichiarata-section.js",
    "la scheda che Varchi, Batterie, Presenza e Macchine usano tutte e quattro: e' una scheda, anche se non ha «editor» nel nome",
  ],
  ["smoke-alerts-section.js", "la scheda del fumo"],
]);

const siCompila = (nome) =>
  nome.includes("-editor-") || ANCHE_QUESTE_SI_COMPILANO.has(nome);

const tutte = readdirSync(SEZIONI).filter((nome) => nome.endsWith("-section.js"));
const sorgente = (nome) => readFileSync(join(SEZIONI, nome), "utf8");

test("nessuna pagina che si guarda scrive un identificativo", () => {
  assert.ok(tutte.length > 100, "le sezioni non si trovano più");
  const colpevoli = tutte
    .filter((nome) => !siCompila(nome))
    .filter((nome) => SCRITTO_A_SCHERMO.test(sorgente(nome)));
  assert.deepEqual(
    colpevoli,
    [],
    "queste pagine scrivono ancora il nome dell'entità sotto il nome vero",
  );
});

test("quelle che si compilano invece lo scrivono ancora", () => {
  /* L'altra metà della regola. Senza, questa prova si accontenterebbe di una
   * plancia da cui l'identificativo è sparito dappertutto — e chi deve dire
   * «questa presa è quella» resterebbe a indovinare. */
  for (const quale of [
    "varchi-editor-section.js",
    "batterie-editor-section.js",
    "presenza-editor-section.js",
    "macchine-editor-section.js",
    "entita-mie-editor-section.js",
  ]) {
    const testo = sorgente(quale);
    /* Quattro di queste la casella non la scrivono più da sé: la disegna la
     * scheda condivisa (#74), e la garanzia sta lì. Vale l'una o l'altra, mai
     * nessuna delle due. */
    const sua = /mono/.test(testo);
    const delegata = testo.includes('from "./scheda-dichiarata-section.js"');
    assert.ok(
      sua || delegata,
      `${quale}: la scheda non fa più vedere quale entità si sta mappando`,
    );
  }
  assert.match(
    sorgente("scheda-dichiarata-section.js"),
    /class="ed-input mono"/,
    "la scheda condivisa deve far vedere quale entità si sta mappando",
  );
});

test("le sei pagine e le due finestre, una per una", () => {
  /* Le pagine che ha nominato lui — «Varchi, Batterie, Presenza, Macchine, Le
   * tue entità», più le sezioni che si fa da sé — e le due finestre rimaste:
   * il dettaglio di un'allerta, e quella di una luce o di una presa. */
  for (const quale of [
    "varchi-section.js",
    "presenza-section.js",
    "batterie-section.js",
    "macchine-e-rete-section.js",
    "sezioni-mie-section.js",
    "entita-mie-section.js",
    "allerte-section.js",
    "lights-scene-section.js",
  ]) {
    const testo = sorgente(quale);
    assert.doesNotMatch(testo, SCRITTO_A_SCHERMO, `${quale}: l'identificativo è tornato`);
    /* E non ci torna nemmeno travestito: un `<small>` col nome dell'entità
     * dentro, senza la classe. */
    assert.doesNotMatch(
      testo,
      /<small[^>]*>\$\{esc\((?:riga|voce|view|lettura)\.(?:entity|id)\)\}/,
      `${quale}: l'identificativo è tornato senza la classe`,
    );
  }
});

test("dove c'era «da quanto», senza istante non si scrive niente", () => {
  /* Varchi e Presenza scrivevano l'identificativo in un caso solo: quando
   * Home Assistant non dice da quando quella porta sta così. Inventare «da
   * poco» sarebbe una bugia, e l'identificativo non lo vuole più nessuno:
   * quella riga resta vuota, e lo stato in parole è già in fondo alla riga. */
  for (const quale of ["varchi-section.js", "presenza-section.js"])
    assert.match(
      sorgente(quale),
      /if \(riga\.da === null \|\| riga\.da === undefined\) return "";/,
      `${quale}: senza istante scrive ancora qualcosa`,
    );
});
