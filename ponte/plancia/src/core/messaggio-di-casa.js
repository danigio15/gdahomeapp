/* Un messaggio a chi e' in casa e a chi e' fuori, dalla Home.
 *
 * «Una card nella Home per inviare messaggi istantanei.» Si scrive una frase
 * — o si tocca una di quelle pronte, «A tavola!» — e la si manda:
 *
 * - agli Echo scelti, che la dicono subito (Alexa Media Player,
 *   `notify.alexa_media`, come le notifiche dette dagli Echo);
 * - ai telefoni di famiglia con l'app GdAHome, come una notifica che dice
 *   chi l'ha scritta: a tutti, o solo a chi si sceglie.
 *
 * Lo fa il ponte, e solo per chi e' entrato: la plancia manda la frase e le
 * scelte, il ponte sa chi scrive (l'ingress o il telefono abbinato lo
 * dicono), controlla che gli Echo siano Echo e che le persone siano di
 * casa, e risponde solo quanti l'hanno avuto. Nel ponte non resta niente:
 * il messaggio parte e basta.
 *
 * Il modulo e' puro: lo usano la plancia e il ponte, e non parla con
 * nessuno.
 */

/** I comandi del ponte: chi puo' ricevere, e manda. */
export const MESSAGGIO_CHI = "ponte/messaggio/chi";
export const MESSAGGIO_MANDA = "ponte/messaggio/manda";

/** I volumi che si possono scegliere per gli Echo, in percento. `null`:
 * quello che l'Echo ha gia'. */
export const VOLUMI_DEL_MESSAGGIO = Object.freeze([30, 50, 70, 100]);

/** Quanto lungo al piu' un messaggio, e a quanti Echo e persone al piu'. */
export const MESSAGGIO_AL_PIU = 200;
const ECHO_AL_PIU = 12;
const PERSONE_AL_PIU = 30;

const LETTORE = /^media_player\.[a-z0-9_]{1,120}$/;
const UTENTE = /^[A-Za-z0-9_-]{1,64}$/;

/** La frase: una riga sola o poche, corta, senza caratteri di controllo. */
export function testoPulito(testo) {
  return String(testo ?? "")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f<>]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MESSAGGIO_AL_PIU)
    .trim();
}

/**
 * Quello che la plancia chiede, ripulito: la frase, gli Echo, se va ai
 * telefoni e a chi (`persone` vuoto = a tutti), annuncio o voce.
 * `null` quando non c'e' niente da mandare o nessuno a cui mandarlo.
 */
export function messaggioPulito(detto) {
  const testo = testoPulito(detto?.testo);
  if (!testo) return null;
  const echo = [
    ...new Set(
      (Array.isArray(detto?.echo) ? detto.echo : [])
        .map((uno) => String(uno ?? "").trim())
        .filter((uno) => LETTORE.test(uno)),
    ),
  ].slice(0, ECHO_AL_PIU);
  const telefoni = detto?.telefoni === true;
  const persone = [
    ...new Set(
      (Array.isArray(detto?.persone) ? detto.persone : [])
        .map((uno) => String(uno ?? "").trim())
        .filter((uno) => UTENTE.test(uno)),
    ),
  ].slice(0, PERSONE_AL_PIU);
  if (!echo.length && !telefoni) return null;
  /* «Se in casa mettono il volume basso io invio il messaggio ma non lo sente
   * nessuno»: il volume a cui gli Echo lo dicono, o `null` per lasciarli
   * come sono. Solo uno dei volumi della finestra. */
  const volume = VOLUMI_DEL_MESSAGGIO.includes(detto?.volume) ? detto.volume : null;
  return {
    testo,
    echo,
    telefoni,
    persone,
    modo: detto?.modo === "voce" ? "voce" : "annuncio",
    volume,
  };
}

/**
 * Quanto aspettare, dopo averlo mandato, prima di rimettere agli Echo il
 * volume di prima: il tempo di dire la frase (col suono dell'annuncio e
 * «Messaggio da …» davanti), con un margine. Fra 8 e 40 secondi.
 */
export function attesaPerIlVolume(testo) {
  const lettere = String(testo ?? "").length;
  return Math.min(40_000, Math.max(8_000, 6_000 + lettere * 90));
}

const nomeCorto = (nome) =>
  String(nome ?? "")
    .trim()
    .split(/\s+/)[0] || "";

/** Le parole della notifica sui telefoni: chi scrive nel titolo, la frase sotto. */
export function paroleDelMessaggio(testo, nome) {
  const chi = nomeCorto(nome);
  return {
    it: { titolo: chi ? `💬 ${chi}` : "💬 Messaggio da casa", testo },
    en: { titolo: chi ? `💬 ${chi}` : "💬 Message from home", testo },
  };
}

/** Quello che dicono gli Echo: chi scrive, poi la frase. */
export function fraseDegliEcho(testo, nome, lingua = "it") {
  const chi = nomeCorto(nome);
  if (!chi) return testo;
  return lingua === "en" ? `Message from ${chi}: ${testo}` : `Messaggio da ${chi}: ${testo}`;
}
