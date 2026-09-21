/* Le stanze in gruppi per piano, e cosa dice ognuna senza entrarci (#17).
 *
 * «Rooms must be displayed in groups based on the selected floor, with the
 * room icon and name centered. Small icons should appear on the card to
 * indicate the status or count of lights (on/off), climate control, power
 * outlets, alerts, doors, windows, and temperature.»
 *
 * Sono due cose, e questa e' la parte che si prova senza un documento: come si
 * raggruppa un elenco di stanze, e quali pastiglie merita una stanza dato
 * quello che c'e' dentro adesso. Le entita' non si leggono qui — i conti li fa
 * la sezione, che ha gli stati in mano — ed e' la stessa divisione di tutto il
 * nucleo.
 *
 * La terza parte della richiesta — toccare la lampadina per spegnere senza
 * entrare — dichiara qui quali pastiglie comandano e quali no, perche' e' una
 * regola e non un disegno: «una pastiglia che a volte comanda e a volte no
 * sarebbe peggio di due disegni diversi».
 */

const pulito = (valore) => String(valore ?? "").trim();
const conta = (valore) => {
  const numero = Number(valore);
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero) : 0;
};

/* Il piano di una stanza che il piano non ce l'ha. Vuoto e non «Altro»: un
 * titolo inventato sopra meta' delle stanze e' peggio di nessun titolo. */
export const SENZA_PIANO = "";

/**
 * Le stanze divise per piano, nell'ordine dei piani della casa.
 *
 * `piani` e' l'ordine dichiarato in Home Assistant: i piani che non ci sono
 * vanno in fondo in ordine di comparsa, e le stanze senza piano per ultime —
 * sono quelle a cui nessuno l'ha ancora detto, e stanno in fondo all'elenco
 * come le cose da sistemare.
 *
 * Con un gruppo solo il piano non si scrive: un titolo sopra tutte le stanze
 * della casa dice quello che si sa gia', e ruba una riga a ogni schermata.
 * Esce comunque un gruppo, con `intitolare: false`, perche' chi disegna non
 * deve avere due strade.
 *
 * Con piu' gruppi si intitolano TUTTI, anche quello delle stanze senza piano:
 * un gruppo muto in fondo a un elenco diviso non si legge come «queste non
 * hanno un piano», si legge come «queste stanno nel piano qui sopra». Come
 * chiamarlo lo dice chi disegna — qui non si scrivono parole.
 */
export function stanzePerPiano(pagine, { piani = [] } = {}) {
  const elenco = Array.isArray(pagine) ? pagine.filter(Boolean) : [];
  const gruppi = new Map();
  for (const stanza of elenco) {
    const piano = pulito(stanza.floor);
    if (!gruppi.has(piano)) gruppi.set(piano, []);
    gruppi.get(piano).push(stanza);
  }
  const dichiarati = (Array.isArray(piani) ? piani : []).map(pulito).filter(Boolean);
  const posto = (piano) => {
    if (!piano) return Number.MAX_SAFE_INTEGER;
    const indice = dichiarati.indexOf(piano);
    return indice < 0 ? Number.MAX_SAFE_INTEGER - 1 : indice;
  };
  const chiavi = [...gruppi.keys()].sort((una, altra) => {
    const differenza = posto(una) - posto(altra);
    if (differenza) return differenza;
    /* Due piani che il registro non conosce restano nell'ordine in cui sono
     * comparsi: inventare un alfabeto li rimescolerebbe a ogni stanza nuova. */
    return 0;
  });
  const uno = chiavi.length < 2;
  return chiavi.map((piano) => ({
    piano,
    intitolare: !uno,
    stanze: gruppi.get(piano),
  }));
}

/* ── le pastiglie di una stanza ──────────────────────────────────────────── */

/* Quali pastiglie esistono, in che ordine, e quali comandano.
 *
 * L'ordine e' quello con cui si guarda una stanza da fuori: prima cosa e'
 * rimasto acceso — la luce, la presa — poi com'e' messa — i gradi, i varchi —
 * e in fondo quello che non va. Le prime due si comandano, le altre no: una
 * finestra non si chiude da una pastiglia, i gradi non sono un interruttore, e
 * un avviso si guarda, non si spegne.
 *
 * `comanda` dice cosa fa il tocco: `spegni` porta il comando, `entra` porta
 * dentro la stanza. Non c'e' una terza risposta — «a volte comanda» — ed e'
 * voluto: la mano impara un gesto solo.
 */
export const PASTIGLIE_DELLA_STANZA = Object.freeze([
  Object.freeze({ chiave: "luci", icona: "💡", comanda: "spegni" }),
  Object.freeze({ chiave: "prese", icona: "🔌", comanda: "spegni" }),
  Object.freeze({ chiave: "gradi", icona: "🌡️", comanda: "entra" }),
  Object.freeze({ chiave: "clima", icona: "❄️", comanda: "entra" }),
  Object.freeze({ chiave: "finestre", icona: "🪟", comanda: "entra" }),
  Object.freeze({ chiave: "porte", icona: "🚪", comanda: "entra" }),
  Object.freeze({ chiave: "mute", icona: "⚠️", comanda: "entra" }),
]);

/**
 * Le pastiglie da disegnare sulla tessera di una stanza.
 *
 * `conti` e' quello che la sezione ha gia' contato: `{ luci, prese, clima,
 * finestre, porte, mute }` sono numeri di cose accese o aperte, `gradi` e' una
 * lettura che puo' mancare.
 *
 * Esce solo quello che ha qualcosa da dire, come sotto il meteo: una stanza a
 * riposo porta la sua temperatura e basta, e una tessera che dice «0 luci, 0
 * prese, 0 finestre» occupa mezza schermata per dire che non succede niente.
 */
export function pastiglieDellaStanza(conti = {}) {
  const fuori = [];
  for (const voce of PASTIGLIE_DELLA_STANZA) {
    if (voce.chiave === "gradi") {
      /* Non basta `Number()`: una stanza senza sonda arriva `null` o stringa
       * vuota, e `Number(null)` e `Number("")` fanno tutti e due ZERO. Senza
       * questa riga ogni stanza senza termometro porterebbe una pastiglia che
       * dice «0°» — non una misura mancante, una misura sbagliata. Lo zero
       * vero invece si dice: fuori puo' fare zero gradi. */
      const letta = conti.gradi;
      const gradi = letta === null || letta === undefined || letta === "" ? NaN : Number(letta);
      if (!Number.isFinite(gradi)) continue;
      fuori.push({ ...voce, valore: gradi, conto: 0 });
      continue;
    }
    const conto = conta(conti[voce.chiave]);
    if (!conto) continue;
    fuori.push({ ...voce, conto, valore: null });
  }
  return fuori;
}

/* ── il tocco che spegne (#17, parte 3) ──────────────────────────────────── */

/* «Clicking on one of these small icons — for example, the light icon — should
 * toggle the device without needing to enter the room.»
 *
 * E' la parte delicata, e non per il codice: una tessera che finora si toccava
 * per ENTRARE diventa una tessera con sette bersagli dentro, e il tocco
 * sbagliato spegne le luci a chi voleva solo guardare. Percio' il tocco non
 * spegne: chiede. La domanda resta il tempo di leggerla, e dopo che si e'
 * spento resta il modo di tornare indietro.
 *
 * I due tempi stanno qui perche' sono una regola, non un'animazione. Due
 * secondi per la domanda: il tempo di leggerla e di decidere, non tanto da
 * restare li' a ingombrare la tessera di chi passava. Cinque per l'annulla:
 * chi ha sbagliato se ne accorge guardando la stanza, e guardare la stanza
 * richiede piu' tempo che leggere tre parole. */
export const QUANTO_DURA_LA_DOMANDA = 2000;
export const QUANTO_DURA_L_ANNULLA = 5000;

/**
 * Quante luci sono accese in un piano intero.
 *
 * E' la riga accanto al titolo del piano: chi sale le scale vuole sapere se
 * lassu' e' rimasto acceso qualcosa, e il conto stanza per stanza lo
 * costringerebbe a farlo con gli occhi. Zero non e' un numero da scrivere —
 * chi disegna ci mette «tutto spento», che e' la stessa cosa detta bene.
 */
export function acceseNelPiano(gruppo, conti = {}) {
  let accese = 0;
  for (const stanza of gruppo?.stanze || []) accese += conta(conti[pulito(stanza?.id)]?.luci);
  return accese;
}
