/* Scegliere cosa suonare, invece di alzare il volume a quello che già suona.
 *
 * «Con Sonos e Music Assistant, dalla plancia non si riesce a scegliere cosa
 * suonare.» La scheda Musica sapeva fare tutto il resto — la pausa, il brano
 * avanti, il volume, la sorgente — e tutto il resto vale su qualcosa che
 * qualcun altro ha fatto partire da un'altra app. Chi accende la musica non
 * accendeva mai la musica da qui.
 *
 * Home Assistant sa già rispondere: `media_player/browse_media` chiede a un
 * lettore cosa ha da offrire, e risponde con una cartella — un titolo, e dei
 * figli che a loro volta si aprono o si suonano. È lo stesso albero che apre
 * il frontend di Home Assistant, e su Music Assistant sono le playlist, gli
 * artisti, le radio; su Sonos le stazioni e le liste salvate; su un
 * Chromecast quel che l'app di turno espone.
 *
 * Questo modulo è puro: costruisce messaggi e mette in ordine le risposte.
 * Non parla con nessuno, non tocca il DOM, non conosce nessuna sezione —
 * come `media-picker.js`, che fa lo stesso lavoro per le cartelle delle foto
 * e con cui NON si sovrappone: quello sfoglia `media_source`, cioè i file su
 * disco, questo sfoglia il lettore, cioè la sua libreria.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Il messaggio che chiede a un lettore cos'ha da offrire. */
export const DOMANDA_SFOGLIA = "media_player/browse_media";

/**
 * La domanda per una cartella di quel lettore.
 *
 * Senza `id` si chiede la radice, e la radice **non** si chiede mandando
 * `media_content_id: ""`: Home Assistant distingue «non me l'hai detto» da
 * «me l'hai detto vuoto», e col vuoto risponde che quel contenuto non esiste.
 * I due campi viaggiano insieme o non viaggiano, perché il tipo senza l'id
 * non identifica niente.
 */
export function laDomandaPerSfogliare(entity, { id = "", tipo = "" } = {}) {
  const dove = pulito(entity);
  if (!dove.includes(".")) return null;
  const domanda = { type: DOMANDA_SFOGLIA, entity_id: dove };
  const cercato = pulito(id);
  if (cercato) {
    domanda.media_content_id = cercato;
    domanda.media_content_type = pulito(tipo);
  }
  return domanda;
}

/* Un'immagine che si può mettere in un `src`, o niente.
 *
 * Le miniature arrivano da fuori: le manda l'integrazione, che a sua volta le
 * ha prese dal servizio di musica. Possono essere un indirizzo intero
 * (Spotify, TuneIn), un percorso di Home Assistant che comincia per «/», o
 * un `media-source://` — che è un riferimento interno e in un `src` non ci
 * va. Tutto il resto, `javascript:` compreso, non entra: una miniatura non è
 * un posto da cui accettare del codice.
 */
export function laMiniatura(valore) {
  const grezzo = pulito(valore);
  if (!grezzo) return "";
  if (grezzo.startsWith("/") && !grezzo.startsWith("//")) return grezzo;
  return /^https?:\/\//i.test(grezzo) ? grezzo : "";
}

/* Una voce dell'elenco, come la usa chi la disegna.
 *
 * `sfogliabile` e `suonabile` sono quello che ha detto Home Assistant, e non
 * si indovinano dal tipo: una playlist di Music Assistant si apre **e** si
 * suona, un artista si apre soltanto, una radio si suona soltanto. Chi
 * disegna guarda queste due e non deve sapere niente di musica.
 */
export function unaVoceDaSfogliare(grezza) {
  const id = pulito(grezza?.media_content_id);
  const sfogliabile = grezza?.can_expand === true;
  const suonabile = grezza?.can_play === true;
  /* Una voce che non si apre e non si suona è una riga su cui non si può fare
   * niente: nell'elenco non ci va. Senza id non si può fare niente comunque,
   * perché è l'id la cosa che si rimanda indietro. */
  if (!id || (!sfogliabile && !suonabile)) return null;
  return {
    id,
    tipo: pulito(grezza?.media_content_type),
    classe: pulito(grezza?.media_class),
    titolo: pulito(grezza?.title) || id,
    miniatura: laMiniatura(grezza?.thumbnail),
    sfogliabile,
    suonabile,
  };
}

/**
 * Il contenuto di una cartella: il suo titolo e le voci che si possono usare.
 *
 * Le cartelle vengono prima delle canzoni, perché una cartella porta altrove
 * e una canzone finisce lì: cercando si scende, e scendere è la cosa che si
 * fa più spesso. Dentro i due gruppi l'ordine resta quello che ha mandato
 * l'integrazione — è lei a sapere se quelle playlist hanno un ordine.
 */
export function laCartella(risposta) {
  const figli = Array.isArray(risposta?.children) ? risposta.children : [];
  const voci = figli.map(unaVoceDaSfogliare).filter(Boolean);
  const cartelle = voci.filter((voce) => voce.sfogliabile);
  const brani = voci.filter((voce) => !voce.sfogliabile);
  /* Quante ne ha lasciate fuori Home Assistant, più quelle che abbiamo
   * lasciato fuori noi. Dirlo è meglio che far credere che la cartella
   * contenga solo questo. */
  const suoi = Number(risposta?.not_shown);
  return {
    id: pulito(risposta?.media_content_id),
    tipo: pulito(risposta?.media_content_type),
    classe: pulito(risposta?.media_class),
    titolo: pulito(risposta?.title),
    voci: [...cartelle, ...brani],
    nonMostrate: (Number.isFinite(suoi) && suoi > 0 ? suoi : 0) + (figli.length - voci.length),
  };
}

/**
 * Il comando che fa partire una voce, o la mette in coda.
 *
 * `enqueue` lo capiscono solo i lettori che dichiarano `MEDIA_ENQUEUE`: su un
 * Chromecast quel campo viene ignorato e la coda diventa un'interruzione, per
 * cui chi chiama deve avere guardato `puo.accoda` prima di chiedere «coda».
 * Qui si costruisce il comando e basta — la bandiera la guarda la scheda,
 * che è quella che disegna il tasto.
 */
export function ilComandoPerSuonare(entity, voce, come = "subito") {
  const dove = pulito(entity);
  const id = pulito(voce?.id);
  if (!dove.includes(".") || !id || voce?.suonabile !== true) return null;
  const dati = { entity_id: dove, media_content_id: id, media_content_type: pulito(voce?.tipo) };
  if (come === "coda") dati.enqueue = "add";
  return { domain: "media_player", service: "play_media", data: dati };
}

/* ── il filo, cioè dove siamo dentro l'albero ──────────────────────────────
 *
 * Sfogliare vuol dire scendere, e chi scende deve poter risalire. Il filo è
 * l'elenco dei passi fatti — la radice in testa — e serve a due cose: le
 * briciole di pane in cima alla finestra, e il tasto «indietro».
 */

/** La radice: un passo senza id, che è come si chiede la prima cartella. */
export function ilFiloDallaRadice(titolo = "") {
  return [{ id: "", tipo: "", titolo: pulito(titolo) }];
}

/**
 * Il filo dopo essere entrati in una voce.
 *
 * Entrare due volte nella stessa cartella non allunga il filo: succede quando
 * si preme due volte, o quando una cartella contiene sé stessa (accade, nelle
 * librerie generate), e un filo che cresce a ogni tocco diventa una fila di
 * briciole identiche che non riporta più da nessuna parte.
 */
export function ilFiloDopo(filo, voce) {
  const passi = Array.isArray(filo) ? filo : [];
  const passo = { id: pulito(voce?.id), tipo: pulito(voce?.tipo), titolo: pulito(voce?.titolo) };
  if (!passo.id) return passi.length ? passi : ilFiloDallaRadice();
  const gia = passi.findIndex((riga) => pulito(riga?.id) === passo.id);
  if (gia >= 0) return passi.slice(0, gia + 1);
  return [...passi, passo];
}

/** Il filo tornando a un passo: quello e tutti quelli prima. */
export function ilFiloFinoA(filo, indice) {
  const passi = Array.isArray(filo) ? filo : [];
  const dove = Number(indice);
  if (!Number.isInteger(dove) || dove < 0 || dove >= passi.length) return passi;
  return passi.slice(0, dove + 1);
}

/** Dove siamo adesso: l'ultimo passo del filo. */
export function ilPassoDiAdesso(filo) {
  const passi = Array.isArray(filo) ? filo : [];
  return passi.length ? passi[passi.length - 1] : { id: "", tipo: "", titolo: "" };
}
