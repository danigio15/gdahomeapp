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

/* Quello che un tasto non si può fare da solo, a schermo spento.
 *
 * Un'azione rapida premuta in macchina la esegue l'app, e l'app può essere
 * chiusa: in quel caso non c'è nessuno schermo, nessuno che guarda e nessuno a
 * cui chiedere. Alcune azioni quel mondo non lo reggono, e vanno lasciate
 * indietro invece di eseguirle a metà:
 *
 * — quelle che aprono qualcosa nella plancia (un pannello delle luci, una voce
 *   del guscio): senza plancia non c'è niente da aprire;
 * — quelle con una domanda di conferma: la conferma è il segno che chi l'ha
 *   messa voleva essere guardato in faccia prima, e a schermo spento quella
 *   domanda non la vede nessuno;
 * — il menu a tendina senza una voce fissata: la voce si sceglie, e scegliere
 *   vuol dire un dito su uno schermo;
 * — la serratura e il lettore, perché lì il servizio giusto dipende da com'è
 *   messa l'entità ADESSO. La ricetta invece è scritta prima, e una ricetta
 *   che congela lo stato di mezz'ora fa chiuderebbe una porta che intanto
 *   qualcuno ha aperto.
 *
 * Quelle restano com'erano: partono quando l'app torna viva, e il tasto in
 * macchina lo dice. */
const DIPENDE_DA_ADESSO = new Set(["lock", "media_player"]);
const CHIEDE_UNA_VOCE = new Set(["select", "input_select"]);
const NON_ESCE_DALLA_PLANCIA = new Set(["builtin", "luci_group"]);

/**
 * Come si esegue questo tasto senza nessuno che guardi, o `null`.
 *
 * `risolvi` dice quale entità è davvero — la plancia ha le sue sostituzioni —
 * e quale servizio vuole: sono due cose che sa la sezione, e che qui non si
 * rifanno. Quello che si decide qui è se si può eseguire da soli, che è una
 * scelta, non un conto.
 */
export function laRicettaDellAzione(azione, risolvi) {
  if (!azione) return null;
  const tipo = pulito(azione.type).toLowerCase();
  if (NON_ESCE_DALLA_PLANCIA.has(tipo)) return null;
  if (pulito(azione.confirm)) return null;
  const risolta = typeof risolvi === "function" ? risolvi(azione) : null;
  const entita = pulito(risolta?.entita);
  if (!entita.includes(".")) return null;
  const dominio =
    tipo === "script" ? "script" : tipo === "scene" ? "scene" : entita.split(".")[0].toLowerCase();
  if (DIPENDE_DA_ADESSO.has(dominio)) return null;
  const dati = risolta?.dati && typeof risolta.dati === "object" ? { ...risolta.dati } : {};
  if (CHIEDE_UNA_VOCE.has(dominio) && !pulito(dati.option)) return null;
  const servizio =
    pulito(risolta?.servizio) ||
    (dominio === "script" || dominio === "scene" ? "turn_on" : "toggle");
  return { dominio, servizio, entita, dati };
}

/* I tasti, col loro posto.
 *
 * Un'azione rapida un nome suo con cui chiamarla non ce l'ha: la plancia le
 * preme per posto nell'elenco — `qaRun(3)` — e il posto da solo non basta a
 * chi torna dall'auto. Fra la fotografia e il tasto premuto qualcuno può aver
 * riordinato l'elenco, e allora il terzo posto non è più la stessa azione: in
 * macchina si preme «Cancello» e in casa parte «Buonanotte», che è il modo
 * peggiore di sbagliare perché nessuno se ne accorge finché non è successo.
 *
 * Quindi il segno porta tutt'e due: «3|Cancello». Chi esegue lo confronta con
 * l'elenco di adesso, e se non torna non preme niente — un tasto che non fa
 * quello che c'è scritto è peggio di un tasto che non fa niente.
 *
 * Il posto è quello dell'elenco VERO, non di questa lista: una voce saltata
 * qui — una senza nome — non deve spostare di uno tutti quelli che vengono
 * dopo. Per questo si conta sull'indice di chi entra, non su quanti ne sono
 * usciti. E per la stessa ragione il segno lo fa questo file e lo legge questo
 * file: sono i due capi della stessa cosa. */
function iTastiColPosto(azioni, risolvi) {
  const fuori = [];
  for (const [posto, azione] of (Array.isArray(azioni) ? azioni : []).entries()) {
    if (fuori.length >= AZIONI_AL_MASSIMO) break;
    const nome = pulito(azione?.name);
    /* Senza un nome non c'è niente da scrivere sul tasto, e un tasto muto in
     * macchina non si preme: si preme quello sbagliato accanto. */
    if (!nome) continue;
    fuori.push({
      posto,
      id: `${posto}|${nome}`,
      nome,
      segno: pulito(azione?.icon),
      ricetta: laRicettaDellAzione(azione, risolvi),
    });
  }
  return fuori;
}

function leAzioni(azioni, risolvi) {
  return iTastiColPosto(azioni, risolvi).map(({ id, nome, segno, ricetta }) => ({
    id,
    nome,
    segno,
    /* Se parte da sola o se aspetta l'app. Lo dice il tasto in macchina, e
     * dirlo è il punto: «è partito» su una cosa che parte fra mezz'ora è la
     * bugia peggiore che possa dire un cruscotto. */
    subito: Boolean(ricetta),
  }));
}

/**
 * Le ricette dei tasti che possono partire da soli.
 *
 * Non finiscono nel file che legge l'auto: lì ci vanno i nomi, e nomi e basta.
 * Queste stanno in un file dell'app, che è l'unica che poi le esegue — e
 * l'unica che ha di che farlo.
 */
export function leRicettePerLAuto(azioni, risolvi) {
  return iTastiColPosto(azioni, risolvi)
    .filter((tasto) => tasto.ricetta)
    .map((tasto) => ({ id: tasto.id, ...tasto.ricetta }));
}

/**
 * Quale tasto dell'elenco di ADESSO ha chiesto l'auto, o `null`.
 *
 * `null` vuol dire «non premere»: l'elenco è cambiato da quando la fotografia
 * è partita, e quello che in macchina c'era scritto adesso non c'è più o sta
 * altrove. Meglio un tasto che non fa niente di un tasto che fa un'altra cosa.
 */
export function ilTastoDelComando(id, azioni = []) {
  const quale = pulito(id);
  if (!quale) return null;
  const tasto = iTastiColPosto(azioni).find((uno) => uno.id === quale);
  return tasto ? { posto: tasto.posto, nome: tasto.nome } : null;
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
  risolvi = null,
  adesso = Date.now(),
} = {}) {
  const foto = {
    casa: pulito(casa),
    quando: Number.isFinite(adesso) ? adesso : Date.now(),
    fotovoltaico: leMisure(energia),
    persone: lePersone(persone, states),
    azioni: leAzioni(azioni, risolvi),
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
