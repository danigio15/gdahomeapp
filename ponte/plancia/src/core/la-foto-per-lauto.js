/* La fotografia che il telefono lascia all'auto.
 *
 * In macchina non si disegna e non si legge molto: Android Auto mostra i suoi
 * modelli — un pannello, una lista, una griglia — e quello che ci sta dentro
 * deve entrare in un colpo d'occhio. Quindi qui non si prepara una plancia in
 * piccolo: si prepara il poco che serve guidando, e si butta via tutto il
 * resto.
 *
 * ── Perché una fotografia e non un filo ─────────────────────────────────
 *
 * Il servizio dell'auto vive nello stesso processo dell'app, ma l'app può
 * essere chiusa: chi sale in macchina accende Android Auto, non gdahome.
 * Aprire da lì un secondo collegamento verso la casa vorrebbe dire una seconda
 * copia delle chiavi, cioè due posti che sanno entrare in casa. Così la
 * plancia — che gli stati ce li ha già in mano — ne scrive tre righe, e l'auto
 * legge quelle.
 *
 * Per questo la fotografia porta il momento in cui è stata scattata: invecchia
 * in fretta, e una schermata che mostra numeri di mezz'ora fa facendo credere
 * che siano adesso è peggio di una schermata vuota — chi guarda non ha modo di
 * accorgersene, e magari decide di non passare da casa.
 *
 * ── Non si sceglie niente di nuovo ──────────────────────────────────────
 *
 * Il fotovoltaico è quello della tessera dell'Energia, le persone sono quelle
 * della sezione Persone, le azioni sono le azioni rapide. Nessuna casella in
 * più da compilare: quello che si è già scelto per la Home è quello che si
 * vede in auto. Una seconda configurazione per l'auto sarebbe una seconda
 * verità sulla stessa casa, e il giorno che si scostano nessuno sa quale
 * guardare.
 *
 * È puro: entrano le misure già scritte, le persone, gli stati e le azioni;
 * esce l'oggetto che diventa un file. Chi legge la plancia e chi scrive il
 * file stanno nella sezione.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* Quante misure entrano nel pannello. Tre: la quarta non si legge — in auto si
 * guarda, non si studia — e il modello ne mette comunque due grosse in cima. */
export const MISURE_AL_MASSIMO = 3;

/* Quante azioni entrano nella griglia. Sei: è quello che Android mostra in una
 * schermata, e la settima vorrebbe dire scorrere — una cosa che si fa da
 * fermi. Chi ne ha di più vede le prime sei, che sono quelle che ha messo
 * davanti. */
export const AZIONI_AL_MASSIMO = 6;

/* La parola con cui Home Assistant dice che una persona è a casa. È la stessa
 * per `person.*` e per `device_tracker.*`, ed è l'unica che conta: «not_home»,
 * il nome di una zona o un `unknown` vogliono dire tutti «non è qui». */
const IN_CASA = "home";

/** Se questa persona, adesso, è in casa. */
export function eInCasa(entity, states = {}) {
  return pulito(states?.[pulito(entity)]?.state).toLowerCase() === IN_CASA;
}

/* Le misure del fotovoltaico, gia' scritte come si leggono.
 *
 * Non arrivano le entita' e non arrivano i watt grezzi: arrivano le righe che
 * la finestra dell'Energia mostra gia' — «Casa 725 W», «Solare 485 W» — con
 * dentro la conversione da kW, il verso della batteria e la parola nella
 * lingua di chi guarda. Rifare qui quel conto vorrebbe dire una seconda
 * aritmetica dell'energia, e ce n'è già una che funziona e che qualcuno
 * guarda tutti i giorni: il giorno che si scostano, in macchina si legge il
 * numero sbagliato e in casa quello giusto, e nessuno sa quale credere.
 *
 * Qui si decide solo QUANTE ne entrano e in che ordine: prima il numero
 * grande — quanto sta tirando la casa — e poi le sorgenti. */
function leMisure(energia) {
  if (!energia) return [];
  const fuori = [];
  for (const riga of Array.isArray(energia.righe) ? energia.righe : []) {
    if (fuori.length >= MISURE_AL_MASSIMO) break;
    const nome = pulito(riga?.nome);
    const valore = pulito(riga?.valore);
    if (nome && valore) fuori.push({ nome, valore });
  }
  /* Il numero grande della tessera NON si aggiunge in cima: e' la potenza
   * della casa, ed e' la stessa cosa che dice la prima riga. Messo anche li'
   * usciva «Energia 1,24 kW» sopra «Casa 1,24 kW» — lo stesso numero due
   * volte su tre righe, con la rete lasciata fuori per fargli posto. Serve
   * solo quando righe non ce ne sono: una casa con un contatore solo e niente
   * altro mappato. */
  if (fuori.length) return fuori;
  const grande = pulito(energia.valore);
  return grande ? [{ nome: pulito(energia.nome) || "Energia", valore: grande }] : [];
}

function lePersone(persone, states) {
  const fuori = [];
  for (const persona of Array.isArray(persone) ? persone : []) {
    /* Chi è nascosto in Home resta nascosto anche in auto: è una scelta già
     * fatta, e rifarla qui vorrebbe dire chiederla due volte. */
    if (persona?.nascosta === true) continue;
    const nome = pulito(persona?.name);
    if (!nome) continue;
    fuori.push({ nome, inCasa: eInCasa(persona?.entity, states) });
  }
  return fuori;
}

function leAzioni(azioni) {
  const fuori = [];
  const viste = new Set();
  for (const azione of Array.isArray(azioni) ? azioni : []) {
    if (fuori.length >= AZIONI_AL_MASSIMO) break;
    const id = pulito(azione?.id);
    const nome = pulito(azione?.name);
    /* Senza un id non si può chiedere niente, e un tasto che si preme e non fa
     * niente è peggio di un tasto che non c'è. */
    if (!id || !nome || viste.has(id)) continue;
    viste.add(id);
    fuori.push({ id, nome, segno: pulito(azione?.icon) });
  }
  return fuori;
}

/**
 * La fotografia, pronta da scrivere.
 *
 * Torna `null` quando non c'è niente da mandare: senza energia, senza persone
 * e senza azioni in auto non ci sarebbe niente da guardare, e un file vuoto
 * farebbe credere all'auto di avere una fotografia quando non ce l'ha.
 */
export function laFotoPerLAuto({
  casa = "",
  energia = null,
  persone = [],
  states = {},
  azioni = [],
  adesso = Date.now(),
} = {}) {
  const foto = {
    casa: pulito(casa),
    quando: Number.isFinite(adesso) ? adesso : Date.now(),
    fotovoltaico: leMisure(energia),
    persone: lePersone(persone, states),
    azioni: leAzioni(azioni),
  };
  if (!foto.fotovoltaico.length && !foto.persone.length && !foto.azioni.length) return null;
  return foto;
}

/* La firma di quello che si è mandato: si rimanda solo quando cambia davvero.
 *
 * Gli stati arrivano a mazzetti più volte al secondo, e riscrivere un file sul
 * telefono a ogni mazzetto vorrebbe dire scrivere sul disco tutto il giorno
 * per dire la stessa cosa. Il momento resta fuori dalla firma apposta: se
 * cambiasse solo lui, cambierebbe a ogni giro. */
export function firmaDellaFoto(foto) {
  if (!foto) return "";
  return JSON.stringify([foto.casa, foto.fotovoltaico, foto.persone, foto.azioni]);
}
