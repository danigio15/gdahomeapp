/* La radio di casa: le stazioni preferite, e su quale lettore suonarle.
 *
 * «Voglio una integrazione radio che parte se è configurata la Musica, e la
 * possibilità di integrarla in Alexa.» Le radio si scelgono nel Config
 * (Musica › Radio) e si ascoltano dalla pagina Musica, su un lettore di casa
 * o sugli Echo.
 *
 * Da dove arrivano le stazioni: dall'integrazione «Radio Browser» di Home
 * Assistant, che le espone come `media-source://radio_browser/…` — le
 * stazioni vicine (il paese della casa), le piu' ascoltate, per paese. La
 * plancia lo chiede a Home Assistant con `media_source/browse_media`, come
 * le cartelle delle foto: nessun altro server.
 *
 * Come si suona:
 *
 * - su un lettore qualsiasi, `media_player.play_media` con l'id della
 *   stazione: e' Home Assistant a trasformarlo nell'indirizzo del flusso;
 * - su un Echo no — un Echo non suona un indirizzo — e allora la si chiede a
 *   TuneIn per nome, con Alexa Media Player (`media_content_type: TUNEIN`).
 *   Una radio scritta solo per nome si sente solo sugli Echo.
 *
 * Il modulo e' puro: prepara domande e chiamate, mette in ordine le
 * risposte, ripulisce quello che si salva.
 */

/** La casella della plancia: le stazioni preferite, per tutta la casa. */
export const CHIAVE_RADIO = "cd_radio";

/** Quante preferite al piu', e quanto lungo il nome. */
export const RADIO_AL_PIU = 24;
const NOME_AL_PIU = 80;

/** La radice delle radio di Home Assistant, e i posti dove cercarle. */
export const RADICE_RADIO = "media-source://radio_browser";
export const POSTI_RADIO = Object.freeze(["local", "popular"]);

const LETTORE = /^media_player\.[a-z0-9_]{1,120}$/;
const ID_RADIO = /^media-source:\/\/radio_browser\/[A-Za-z0-9_\-/.]{1,120}$/;
const MIME = /^[a-z]+\/[a-z0-9.+-]{1,40}$/i;

const pulito = (valore) => String(valore ?? "").trim();

const nomePulito = (nome) =>
  pulito(
    String(nome ?? "")
      .replace(/[\u0000-\u001f\u007f<>{}]/g, " ")
      .replace(/\s+/g, " "),
  ).slice(0, NOME_AL_PIU);

/* Il logo di una stazione: solo un indirizzo vero, o niente. */
function logoPulito(valore) {
  const grezzo = pulito(valore);
  return /^https?:\/\/[^\s"'<>]{1,500}$/i.test(grezzo) ? grezzo : "";
}

/** Una stazione com'e' scritta, ripulita; null se non ha un nome. */
export function stazionePulita(grezza) {
  const nome = nomePulito(grezza?.nome);
  if (!nome) return null;
  const id = pulito(grezza?.id);
  const tipo = pulito(grezza?.tipo);
  return {
    nome,
    id: ID_RADIO.test(id) ? id : "",
    tipo: MIME.test(tipo) ? tipo.toLowerCase() : "",
    logo: logoPulito(grezza?.logo),
  };
}

/** Le preferite com'e' scritte: pulite, senza doppioni, al piu' RADIO_AL_PIU. */
export function normalizzaRadio(grezzo) {
  let valore = grezzo;
  if (typeof valore === "string") {
    try {
      valore = JSON.parse(valore);
    } catch (_errore) {
      valore = null;
    }
  }
  const viste = new Set();
  const preferite = [];
  for (const una of Array.isArray(valore?.preferite) ? valore.preferite : []) {
    const stazione = stazionePulita(una);
    if (!stazione) continue;
    const chiave = stazione.id || `nome:${stazione.nome.toLowerCase()}`;
    if (viste.has(chiave)) continue;
    viste.add(chiave);
    preferite.push(stazione);
    if (preferite.length >= RADIO_AL_PIU) break;
  }
  return { preferite };
}

/** La domanda per un posto delle radio: le vicine, le piu' ascoltate, la radice. */
export function domandaDelleRadio(posto = "") {
  const dove = pulito(posto);
  return {
    type: "media_source/browse_media",
    media_content_id: dove ? `${RADICE_RADIO}/${dove}` : RADICE_RADIO,
  };
}

/** Le stazioni di una risposta: solo quelle che si suonano, con nome e logo. */
export function stazioniDellaRisposta(risposta) {
  const figli = Array.isArray(risposta?.children) ? risposta.children : [];
  return figli
    .filter((figlio) => figlio?.can_play === true)
    .map((figlio) =>
      stazionePulita({
        nome: figlio.title,
        id: figlio.media_content_id,
        tipo: figlio.media_content_type,
        logo: figlio.thumbnail,
      }),
    )
    .filter((una) => una && una.id);
}

/** Le stazioni che contengono le parole cercate, senza badare a maiuscole e accenti. */
export function filtraLeStazioni(stazioni, testo) {
  const piano = (valore) => pulito(valore).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const parole = piano(testo).split(/\s+/).filter(Boolean);
  if (!parole.length) return stazioni;
  return stazioni.filter((una) => parole.every((parola) => piano(una.nome).includes(parola)));
}

/**
 * La chiamata che fa suonare una stazione su un lettore, o null se li' non
 * si puo': su un Echo la si chiede a TuneIn per nome, altrove serve l'id.
 */
export function chiamataDellaRadio(stazione, lettore, { echo = false } = {}) {
  const chi = pulito(lettore);
  const una = stazionePulita(stazione);
  if (!una || !LETTORE.test(chi)) return null;
  if (echo)
    return {
      domain: "media_player",
      service: "play_media",
      data: { entity_id: chi, media_content_id: una.nome, media_content_type: "TUNEIN" },
    };
  if (!una.id) return null;
  return {
    domain: "media_player",
    service: "play_media",
    data: { entity_id: chi, media_content_id: una.id, media_content_type: una.tipo || "music" },
  };
}

/**
 * Le radio pronte, senza passare dal Config: «io farei un menu a tendina per
 * le radio, gia' preimpostate». Le piu' ascoltate in Italia, ognuna col suo
 * bollino (la sigla e il colore che la fanno riconoscere al volo). Per nome: un Echo
 * le chiede a TuneIn cosi' come sono scritte; un altro lettore le cerca fra le
 * radio italiane di Radio Browser (`RADIO_DEL_PAESE`).
 */
export const RADIO_PRONTE = Object.freeze(
  [
    ["RTL 102.5", "RTL", "#e30613"],
    ["Radio Deejay", "DJ", "#111827"],
    ["RDS 100% Grandi Successi", "RDS", "#be123c"],
    ["Radio 105", "105", "#f59e0b"],
    ["Radio Italia", "RI", "#16a34a"],
    ["Virgin Radio", "V", "#dc2626"],
    ["m2o", "m2o", "#0ea5e9"],
    ["Radio Kiss Kiss", "KK", "#db2777"],
    ["Kiss Kiss Napoli", "KKN", "#9d174d"],
    ["Radio Capital", "CAP", "#1d4ed8"],
    ["R101", "101", "#7c3aed"],
    ["Radio Monte Carlo", "RMC", "#0f766e"],
    ["Radio 24", "24", "#2563eb"],
    ["Radio Zeta", "Z", "#f97316"],
    ["Radio Subasio", "SUB", "#059669"],
    ["Radio Freccia", "F", "#b91c1c"],
    ["Radio Marte", "M", "#9333ea"],
    ["Rai Radio 1", "R1", "#0369a1"],
    ["Rai Radio 2", "R2", "#0891b2"],
    ["Rai Radio 3", "R3", "#4338ca"],
  ].map(([nome, sigla, colore]) => Object.freeze({ nome, sigla, colore })),
);

/** Dove Radio Browser tiene le radio italiane. */
export const RADIO_DEL_PAESE = "country/IT";

const piano = (valore) =>
  pulito(valore)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * La stazione che porta quel nome, fra quelle di Radio Browser: prima quella
 * che si chiama proprio cosi', poi quella che ne contiene tutte le parole e
 * ha il nome piu' corto («RTL 102.5» e non «RTL 102.5 Best»). Null se non c'e'.
 */
export function stazioneDalNome(stazioni, nome) {
  const cercato = piano(nome);
  if (!cercato) return null;
  const elenco = Array.isArray(stazioni) ? stazioni.filter((una) => una?.id) : [];
  const uguale = elenco.find((una) => piano(una.nome) === cercato);
  if (uguale) return uguale;
  const parole = cercato.split(" ");
  const simili = elenco
    .filter((una) => {
      const suo = ` ${piano(una.nome)} `;
      return parole.every((parola) => suo.includes(` ${parola} `));
    })
    .sort((a, b) => piano(a.nome).length - piano(b.nome).length);
  return simili[0] || null;
}

/** Fermare quello che suona su quel lettore. */
export function chiamataPerFermare(lettore) {
  const chi = pulito(lettore);
  return LETTORE.test(chi)
    ? { domain: "media_player", service: "media_stop", data: { entity_id: chi } }
    : null;
}
