/* «Si potrebbero inserire le entità personalizzate nelle stanze tipo
 * Automazioni? E una sezione automazioni?» (#504).
 *
 * Le due metà della richiesta hanno risposte diverse, e nessuna delle due è una
 * sezione nuova.
 *
 * La prima. La scheda «Entità mie» la stanza la chiedeva già — c'è la sua
 * tendina accanto all'entità — ma quella scelta non arrivava fino alla pagina
 * Stanze: lì si leggevano solo le assegnazioni fatte con la tendina sparsa
 * nelle altre schede. Un'automazione messa in cucina restava scritta in
 * configurazione e non compariva in nessuna stanza.
 *
 * La seconda. Una sezione tutta sua un'automazione ce l'ha già: «Sezioni mie»
 * fa esattamente questo, e fra i domini che accetta l'automazione c'è da
 * sempre. Quello che non c'era è che funzionasse: il tocco chiamava
 * `automation.toggle`, che non fa partire niente — DISABILITA l'automazione.
 * Chi si era fatto la sua sezione toccava il tasto, non succedeva niente, e
 * intanto si era spenta un'automazione di casa senza saperlo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { comandoDelDispositivo, genereDelComando } from "../src/core/comandi-accanto.js";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { assignedItems, iconaVoce, segnoScelto } = await import(
  "../src/sections/rooms-page-section.js"
);

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

const STATI = {
  "automation.luci_sera": {
    state: "on",
    attributes: { friendly_name: "Automazione luci sera" },
  },
  "sensor.pressione": { state: "1013", attributes: { friendly_name: "Pressione" } },
};

function scrivi(chiave, valore) {
  magazzino.set(chiave, JSON.stringify(valore));
}

test("un'entità mia con la sua stanza arriva nella stanza", () => {
  magazzino.clear();
  scrivi("cd_entita_mie", [
    { entity: "automation.luci_sera", nome: "Luci sera", icona: "🌙", room_id: "r-cucina" },
    /* Senza stanza non va in nessuna stanza: è una scelta, non una mancanza. */
    { entity: "sensor.pressione", nome: "Pressione" },
  ]);
  const voci = assignedItems({}, STATI);
  assert.deepEqual(
    voci.map((voce) => voce.entity),
    ["automation.luci_sera"],
  );
  /* Il nome e l'icona sono quelli che le ha dato chi l'ha aggiunta: sono suoi,
   * e valgono più di quelli di Home Assistant. */
  assert.equal(voci[0].name, "Luci sera");
  assert.equal(voci[0].icon, "🌙");
  assert.equal(voci[0].room_id, "r-cucina");
});

test("l'assegnazione a mano resta, e comanda lei sui doppioni", () => {
  magazzino.clear();
  scrivi("cd_entita_mie", [{ entity: "automation.luci_sera", room_id: "r-cucina" }]);
  const voci = assignedItems({ "automation.luci_sera": "r-salone" }, STATI);
  /* Una riga sola, non due: due righe per la stessa entità sarebbero due volte
   * la stessa cosa nella stessa pagina. */
  assert.equal(voci.length, 1);
  /* E vince la tendina della sua riga, che è la più esplicita delle due. */
  assert.equal(voci[0].room_id, "r-salone");
});

test("ma il nome che le hai dato non lo porta via, perché lei un nome non ce l'ha", () => {
  /* Dal campo: «il campo che uso come nome facoltativo potrebbe anche andare
   * scritto sull'entità che trovi nella stanza? perché ora quel nome va solo
   * sulla lista delle mie entità».
   *
   * I due rubinetti sanno due cose diverse: l'assegnazione a mano è una mappa
   * entità → stanza e del nome non sa niente, «Le tue entità» sa anche come si
   * chiama e con che segno. Vinceva la prima arrivata TUTTA INTERA, e siccome
   * la mappa a mano si legge per prima, un'entità scritta in tutt'e due
   * perdeva il nome: nella stanza tornava a chiamarsi come la chiama Home
   * Assistant — su un `select` di un'integrazione tedesca, «Modus».
   *
   * Adesso si decide campo per campo: la stanza la dice quella scritta a mano,
   * il nome e il segno l'unica delle due che ce li ha. */
  magazzino.clear();
  scrivi("cd_entita_mie", [
    {
      entity: "automation.luci_sera",
      nome: "Luci sera",
      icona: "🌙",
      room_id: "r-cucina",
    },
  ]);
  const voci = assignedItems({ "automation.luci_sera": "r-salone" }, STATI);
  assert.equal(voci.length, 1);
  assert.equal(voci[0].room_id, "r-salone", "la stanza resta quella scritta a mano");
  assert.equal(voci[0].name, "Luci sera", "il nome scelto non si perde per strada");
  assert.equal(voci[0].icon, "🌙", "e nemmeno il segno");
});

test("e il nome glielo può dare anche l'azione rapida, che è dove l'ha scritto", () => {
  /* Dal campo, la seconda volta, con la foto della stanza davanti: «Leggo
   * ancora modus… sono azioni rapide, scene, queste, non modus».
   *
   * La prima correzione aveva guardato un rubinetto solo, «Le tue entità», e
   * lì quel nome non c'era: chi un'azione rapida ce l'ha non ha nessun motivo
   * di riscrivere la stessa entità in un'altra scheda per darle lo stesso
   * nome. Il nome che aveva scritto stava nell'azione rapida, e nella stanza
   * la riga continuava a chiamarsi come la chiama Home Assistant — «Modus»,
   * che è il `select` di un'integrazione tedesca. */
  magazzino.clear();
  scrivi("cd_quick_actions", [
    { type: "toggle", name: "Serata", icon: "🌆", entity: "select.modus" },
  ]);
  const voci = assignedItems({ "select.modus": "r-salone" }, STATI);
  assert.equal(voci.length, 1);
  assert.equal(voci[0].name, "Serata");
  assert.equal(voci[0].icon, "🌆");
  assert.equal(voci[0].room_id, "r-salone");
});

test("ma un'azione rapida da sola in nessuna stanza ci va", () => {
  /* Una stanza un'azione rapida non ce l'ha: il nome lo presta, la riga non la
   * crea. Se no la pagina Stanze si riempirebbe di tasti della Home che
   * nessuno ha messo lì. */
  magazzino.clear();
  scrivi("cd_quick_actions", [{ name: "Serata", entity: "select.modus" }]);
  assert.deepEqual(assignedItems({}, STATI), []);
});

test("e «Le tue entità» resta la più forte delle due", () => {
  /* Sono tutt'e due nomi scritti da chi ha la casa, ma non fanno lo stesso
   * mestiere: «Le tue entità» dà un nome A QUELL'ENTITÀ, l'azione rapida lo dà
   * a un tasto della Home. Dove ci sono tutt'e due, vince quello dell'entità. */
  magazzino.clear();
  scrivi("cd_entita_mie", [{ entity: "select.modus", nome: "Termostato", icona: "🌡️" }]);
  scrivi("cd_quick_actions", [{ name: "Serata", icon: "🌆", entity: "select.modus" }]);
  const voci = assignedItems({ "select.modus": "r-salone" }, STATI);
  assert.equal(voci[0].name, "Termostato");
  assert.equal(voci[0].icon, "🌡️");
});

test("un'azione integrata non presta nessun nome: un'entità non ce l'ha", () => {
  magazzino.clear();
  scrivi("cd_quick_actions", [{ type: "builtin", builtin: "scenes", name: "Scene" }]);
  const voci = assignedItems({ "sensor.pressione": "r-salone" }, STATI);
  assert.equal(voci[0].name, "Pressione");
  /* E una configurazione storta non fa cadere la pagina. */
  scrivi("cd_quick_actions", "non una lista");
  assert.equal(assignedItems({ "sensor.pressione": "r-salone" }, STATI)[0].name, "Pressione");
});

test("e senza un nome scelto resta quello di Home Assistant", () => {
  /* Il ripiego non cambia: chi non ha scritto niente nel campo facoltativo
   * continua a leggere il nome che la casa dà a quell'entità. */
  magazzino.clear();
  const voci = assignedItems({ "sensor.pressione": "r-salone" }, STATI);
  assert.equal(voci[0].name, "Pressione");
  assert.equal(voci[0].icon, "");
});

test("chi non ha scritto niente non si ritrova niente", () => {
  magazzino.clear();
  assert.deepEqual(assignedItems({}, STATI), []);
  assert.deepEqual(assignedItems(null, STATI), []);
  /* Una configurazione storta non fa cadere la pagina delle stanze. */
  scrivi("cd_entita_mie", "non una lista");
  assert.deepEqual(assignedItems({}, STATI), []);
});

/* ── il segno, e la finestra che si intitola come la riga ──────────────── */

test("il segno di un'azione rapida arriva nella stanza anche quando è un mdi:", () => {
  /* Dal campo, con la foto: «deve uscire icona dell'azione rapida». Il nome
   * era arrivato, il segno no — e non per caso: qui passava soltanto un
   * glifo, cioè qualcosa fuori dall'ASCII, e l'editor delle Azioni rapide di
   * serie ci mette un token del catalogo (`mdi:...`). Buttato quello, la riga
   * si prendeva il segno dedotto dal dominio: su un `select`, la lavagnetta. */
  assert.equal(segnoScelto({ icon: "mdi:tune" }), "mdi:tune");
  assert.equal(segnoScelto({ icon: "🌆" }), "🌆");
  assert.equal(segnoScelto({ emoji_icon: "🌙", icon: "mdi:tune" }), "🌙");
  /* La terza forma continua a non passare: `icon` su qualche riga è la CHIAVE
   * di un disegno del catalogo, e stampata com'è sarebbe la parola «washer»
   * sopra il nome. */
  assert.equal(segnoScelto({ icon: "washer" }), "");
  assert.equal(segnoScelto({}), "");
});

test("e iconaVoce lo porta fino alla riga", () => {
  magazzino.clear();
  scrivi("cd_quick_actions", [{ name: "Serata", icon: "mdi:tune", entity: "select.modus" }]);
  const voci = assignedItems({ "select.modus": "r-salone" }, STATI);
  assert.equal(voci[0].icon, "mdi:tune");
  assert.equal(iconaVoce(voci[0], { key: "altro" }), "mdi:tune");
});

test("la finestra delle voci si intitola come la riga che l'ha aperta", () => {
  /* La stessa finestra la aprono il tasto della Home e la riga della stanza.
   * Dalla Home le arriva l'azione — nome scelto, icona scelta — e si intitola
   * giusta; dalla stanza non le arrivava niente, e ripiegava sul nome di Home
   * Assistant: una finestra intitolata «MODUS» aperta da una riga che si
   * chiama «prova». I due campi sono già calcolati dove si disegna il tasto:
   * ci vanno addosso, e il gestore glieli ripassa. */
  const sorgente = leggi("sections/rooms-page-section.js");
  assert.match(sorgente, /data-dm-stanza-nome="\$\{esc\(nomeVoce\(item, states\)\)\}"/);
  assert.match(sorgente, /data-dm-stanza-segno="\$\{esc\(segnoScelto\(item\)\)\}"/);
  assert.match(
    sorgente,
    /apriIlMenu\(entity, \{\s*name: clean\(scegli\.getAttribute\("data-dm-stanza-nome"\)\),\s*icon: clean\(scegli\.getAttribute\("data-dm-stanza-segno"\)\),\s*\}\);/,
  );
  /* E il segno si disegna, non si stampa: `iconGlyphHtml` sa la differenza fra
   * un glifo e un token, ed è la ragione per cui esiste. */
  assert.doesNotMatch(sorgente, /\$\{esc\(iconaVoce\(item, blocco\)\)\}/);
  assert.match(sorgente, /<span class="dm-stanze-orb">\$\{segnoDaDisegnare\(item, blocco\)\}<\/span>/);
});

/* ── e quello che si fa partire, parte ───────────────────────────────── */

test("un'automazione si fa PARTIRE, non si disabilita", () => {
  /* Il verbo lo sa un posto solo, ed è quello che sbagliava chi lo riscriveva
   * a mano. `automation.toggle` non esegue: spegne. */
  assert.equal(genereDelComando("automation.luci_sera"), "tasto");
  assert.deepEqual(comandoDelDispositivo({ entity: "automation.luci_sera" }), {
    domain: "automation",
    service: "trigger",
    data: { entity_id: "automation.luci_sera" },
  });
});

test("le sezioni mie chiedono il verbo a chi lo sa, invece di riscriverlo", () => {
  const sorgente = leggi("sections/sezioni-mie-section.js");
  /* I verbi chiesti sono diventati due, e sono tutt'e due di la': la levetta
   * chiede quello che ABILITA, il tasto accanto quello che fa partire (#552).
   * La regola difesa qui non cambia — nessun verbo si riscrive a mano — e
   * l'ordine conta: chiedere per primo quello del tasto rimetterebbe la levetta
   * a far partire, che e' il difetto da cui si e' partiti. */
  assert.match(
    sorgente,
    /const comando = comandoCheAbilita\(\{ entity \}\) \|\|\s*\n?\s*comandoDelDispositivo\(\{ entity \}\) \|\| \{/,
  );
  assert.match(sorgente, /chiamaHa\(comando\.domain, comando\.service, comando\.data\);/);
  /* La regola scritta a mano non c'è più: era lei a mandare le automazioni nel
   * «tutto il resto si inverte». */
  assert.doesNotMatch(sorgente, /dominio === "scene" \|\| dominio === "script" \? "turn_on"/);
  /* E quello che `comandi-accanto` non conosce — una luce, una sirena — resta
   * roba che si accende e si spegne: non si è tolto niente a nessuno. */
  assert.match(sorgente, /service: "toggle",/);
});

test("nella stanza quello che si fa partire ha il suo tasto", () => {
  const sorgente = leggi("sections/rooms-page-section.js");
  /* Prima una riga così portava in Home, cioè da nessuna parte utile: un
   * interruttore ce l'avevano solo luci, prese, ventole e booleani. */
  assert.match(sorgente, /function siPuoAvviare\(entity\) \{\n\s*return genereDelComando\(entity\) === "tasto" && siComanda\(entity\);/);
  assert.match(sorgente, /data-dm-stanza-avvia="\$\{esc\(entity\)\}"/);
  /* Il tocco è del tasto, non della riga: senza, far partire un'automazione
   * cambierebbe pagina — è lo stesso inciampo dell'interruttore (#467). */
  assert.match(
    sorgente,
    /const avvia = event\.target\?\.closest\?\.\("\[data-dm-stanza-avvia\]"\);[\s\S]{0,400}?event\.stopPropagation\(\);/,
  );
  /* E il comando lo costruisce chi sa i verbi. */
  assert.match(sorgente, /comandoDelDispositivo\(\{ entity \}\) : null;/);
  /* Il divieto «si vede ma non si comanda» vale anche qui. */
  assert.match(sorgente, /entity && siComanda\(entity\) \? comandoDelDispositivo/);
});
