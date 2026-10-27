/* La musica sugli Echo: la parte che decide.
 *
 * «In Alexa dai la possibilita' di trasmettere anche la musica presente.»
 * Due strade, tutte e due nella scheda «🎵 Musica» della sezione Alexa:
 *
 * - spostare sugli Echo la musica che sta gia' suonando in casa — un Sonos,
 *   la TV, uno Spotify Connect — con un tasto: gli Echo la cercano e la
 *   suonano, il lettore di prima si mette in pausa;
 * - scegliere cosa ascoltare: un artista, un brano, una playlist, una radio,
 *   da Amazon Music, Spotify, Apple Music, Deezer o TuneIn, e tenere i
 *   preferiti a portata di tocco.
 *
 * A suonare e' l'integrazione Alexa Media Player, con il servizio
 * `media_player.play_media`: il contenuto e' una frase di ricerca e il tipo
 * e' il servizio di musica. Un Echo non sa riprendere la musica di un altro
 * lettore dal secondo in cui era: la cerca per titolo e artista e la fa
 * ripartire. Una radio riparte in diretta, che e' lo stesso.
 *
 * Il modulo e' puro: legge stati e prepara chiamate, non parla con nessuno
 * e non tocca il DOM. Quello che finisce in una chiamata passa di qui, ed
 * e' ripulito: solo lettori `media_player.*` che sono Echo davvero, solo i
 * servizi di musica di questo elenco, frasi corte e senza caratteri strani.
 */

/** I servizi di musica che gli Echo sanno suonare, nell'ordine in cui si offrono. */
export const SERVIZI_MUSICA = Object.freeze([
  Object.freeze({ id: "AMAZON_MUSIC", nome: "Amazon Music" }),
  Object.freeze({ id: "SPOTIFY", nome: "Spotify" }),
  Object.freeze({ id: "APPLE_MUSIC", nome: "Apple Music" }),
  Object.freeze({ id: "DEEZER", nome: "Deezer" }),
  Object.freeze({ id: "TUNEIN", nome: "TuneIn" }),
]);

const SERVIZI = new Set(SERVIZI_MUSICA.map((uno) => uno.id));
export const SERVIZIO_DI_SERIE = "AMAZON_MUSIC";

/** Quanto lunga al piu' una ricerca, e quanti preferiti al piu'. */
export const CERCA_AL_PIU = 120;
export const PREFERITI_AL_PIU = 12;
const ECHO_AL_PIU = 12;

const LETTORE = /^media_player\.[a-z0-9_]{1,120}$/;
const pulito = (valore) => String(valore ?? "").trim();

/** Un servizio dell'elenco; quello che non si conosce torna Amazon Music. */
export function servizioPulito(id) {
  const scritto = pulito(id).toUpperCase();
  return SERVIZI.has(scritto) ? scritto : SERVIZIO_DI_SERIE;
}

/** La frase da cercare: una riga sola, corta, senza caratteri di controllo. */
export function cosaPulita(testo) {
  return pulito(
    String(testo ?? "")
      .replace(/[\u0000-\u001f\u007f<>{}]/g, " ")
      .replace(/\s+/g, " "),
  )
    .slice(0, CERCA_AL_PIU)
    .trim();
}

/** Vero quando lo stato e' quello di un Echo di Alexa Media Player. */
export function eUnEcho(stato) {
  return (
    LETTORE.test(pulito(stato?.entity_id)) &&
    Boolean(stato?.attributes) &&
    Object.prototype.hasOwnProperty.call(stato.attributes, "last_called")
  );
}

const elenco = (stati) => (Array.isArray(stati) ? stati : Object.values(stati || {}));

/** Gli Echo scelti, tenuti solo se in casa ci sono davvero. */
export function echoPuliti(scelti, stati) {
  const diCasa = new Set(
    elenco(stati)
      .filter(eUnEcho)
      .map((uno) => uno.entity_id),
  );
  return [
    ...new Set((Array.isArray(scelti) ? scelti : []).map(pulito).filter((uno) => diCasa.has(uno))),
  ].slice(0, ECHO_AL_PIU);
}

/** La chiamata che fa suonare `cosa` da `servizio` sugli Echo; null se manca qualcosa. */
export function chiamataPerSuonare({ echo, servizio, cosa }, stati) {
  const su = echoPuliti(echo, stati);
  const frase = cosaPulita(cosa);
  if (!su.length || !frase) return null;
  return {
    domain: "media_player",
    service: "play_media",
    data: {
      entity_id: su,
      media_content_id: frase,
      media_content_type: servizioPulito(servizio),
    },
  };
}

const COMANDI = Object.freeze({
  pausa: "media_pause",
  suona: "media_play",
  ferma: "media_stop",
  successivo: "media_next_track",
});

/** Un tasto sotto quello che suona: pausa, riprendi, ferma, avanti. */
export function chiamataSulLettore(entita, comando) {
  const chi = pulito(entita);
  const servizio = COMANDI[pulito(comando)];
  if (!LETTORE.test(chi) || !servizio) return null;
  return { domain: "media_player", service: servizio, data: { entity_id: chi } };
}

/* Da quale servizio arriva quello che suona, dalle parole che il lettore
 * dice di se': l'applicazione, la sorgente, l'indirizzo del contenuto. */
const DA_DOVE = [
  [/spotify/i, "SPOTIFY"],
  [/apple|itunes/i, "APPLE_MUSIC"],
  [/deezer/i, "DEEZER"],
  [/tune\s*in|radio/i, "TUNEIN"],
  [/amazon/i, "AMAZON_MUSIC"],
];

function letturaDi(stato) {
  const a = stato?.attributes || {};
  const app = pulito(a.app_name || a.source);
  const dove = `${app} ${pulito(a.media_content_id)}`;
  const tipo = pulito(a.media_content_type).toLowerCase();
  const titolo = pulito(a.media_title);
  const artista = pulito(a.media_artist || a.media_album_artist);
  const canale = pulito(a.media_channel);
  const radio =
    Boolean(canale) ||
    tipo === "channel" ||
    tipo === "radio" ||
    (!artista && /tune\s*in|radio/i.test(dove));
  const trovato = DA_DOVE.find(([prova]) => prova.test(dove));
  return {
    entita: stato.entity_id,
    nome: pulito(a.friendly_name) || stato.entity_id,
    stato: pulito(stato.state).toLowerCase(),
    titolo,
    artista,
    album: pulito(a.media_album_name),
    canale,
    app,
    radio,
    servizio: radio ? "TUNEIN" : trovato ? trovato[1] : SERVIZIO_DI_SERIE,
    foto: pulito(a.entity_picture),
  };
}

const sentibile = (lettura) => Boolean(lettura.titolo || lettura.canale);

/**
 * La musica che suona in casa fuori dagli Echo: quella che si puo' spostare.
 * Prima chi suona, poi chi e' in pausa; senza un titolo non c'e' niente da
 * cercare, e il lettore resta fuori.
 */
export function musicaCheSuona(stati) {
  return elenco(stati)
    .filter((stato) => LETTORE.test(pulito(stato?.entity_id)) && !eUnEcho(stato))
    .map(letturaDi)
    .filter((uno) => (uno.stato === "playing" || uno.stato === "paused") && sentibile(uno))
    .sort(
      (uno, due) =>
        Number(due.stato === "playing") - Number(uno.stato === "playing") ||
        uno.nome.localeCompare(due.nome, "it"),
    );
}

/** Quello che suona adesso sugli Echo, per fermarlo o metterlo in pausa. */
export function musicaSugliEcho(stati) {
  return elenco(stati)
    .filter(eUnEcho)
    .map(letturaDi)
    .filter((uno) => (uno.stato === "playing" || uno.stato === "paused") && sentibile(uno))
    .sort((uno, due) => uno.nome.localeCompare(due.nome, "it"));
}

/** Cosa chiedere agli Echo per riprendere quello che suona su un altro lettore. */
export function richiestaDaSpostare(lettura) {
  if (!lettura) return null;
  if (lettura.radio) {
    const cosa = cosaPulita(lettura.canale || lettura.titolo);
    return cosa ? { servizio: "TUNEIN", cosa } : null;
  }
  const cosa = cosaPulita([lettura.titolo, lettura.artista].filter(Boolean).join(" "));
  return cosa ? { servizio: servizioPulito(lettura.servizio), cosa } : null;
}

/**
 * Le chiamate per spostare la musica: prima gli Echo suonano, poi il lettore
 * di prima si mette in pausa — se suonava. Due musiche insieme nella stessa
 * casa non le vuole nessuno.
 */
export function chiamatePerSpostare(lettura, echo, stati) {
  const richiesta = richiestaDaSpostare(lettura);
  const suona = richiesta && chiamataPerSuonare({ echo, ...richiesta }, stati);
  if (!suona) return [];
  const pausa = lettura.stato === "playing" ? chiamataSulLettore(lettura.entita, "pausa") : null;
  return pausa ? [suona, pausa] : [suona];
}

/** Un preferito com'e' scritto, ripulito; null se non dice niente. */
export function preferitoPulito(grezzo) {
  const cosa = cosaPulita(grezzo?.cosa);
  if (!cosa) return null;
  return { servizio: servizioPulito(grezzo?.servizio), cosa };
}

/** I preferiti: puliti, senza doppioni, al piu' dodici. */
export function preferitiPuliti(grezzi) {
  const visti = new Set();
  const tenuti = [];
  for (const grezzo of Array.isArray(grezzi) ? grezzi : []) {
    const uno = preferitoPulito(grezzo);
    if (!uno) continue;
    const chiave = `${uno.servizio}|${uno.cosa.toLowerCase()}`;
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    tenuti.push(uno);
    if (tenuti.length >= PREFERITI_AL_PIU) break;
  }
  return tenuti;
}
