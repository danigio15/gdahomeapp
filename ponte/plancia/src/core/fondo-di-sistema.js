/* Quanto si prende il sistema in fondo allo schermo, e quanto ne resta a noi.
 *
 * «Nello smartphone la barra inferiore è parzialmente coperta dai tasti
 * Android» (#249). La risposta era già scritta e giusta: non alzare la barra di
 * un tanto fisso — su un telefono a gesti o su un tablet resterebbe sospesa per
 * niente — ma alzarla di quello che il sistema si è preso, che lo dice il
 * dispositivo con `env(safe-area-inset-bottom)`.
 *
 * Solo che quel valore, dentro la plancia, è sempre zero. La plancia ospitata
 * vive in una cornice `srcdoc` dentro il pannello di Home Assistant, e le zone
 * sicure sono una proprietà della finestra in cima: dentro una cornice
 * `env(safe-area-inset-bottom)` risponde zero comunque, per quanto la cornice
 * dichiari `viewport-fit=cover`. La regola c'era, non si è mai accesa, e da
 * fuori si vede come «era già stato fatto ma non funziona».
 *
 * Il numero quindi si va a prendere dove esiste — il documento in cima, che è
 * della stessa origine — e si sottrae quello che l'ospite ha già lasciato
 * libero sotto di noi: se un giorno Home Assistant scanserà i tasti per conto
 * suo, questa parte smetterà di aggiungere niente invece di alzare la barra due
 * volte.
 *
 * Qui c'è solo l'aritmetica, che si prova senza schermo. Chi misura sta accanto
 * alla barra, che è la sua.
 */

/* Oltre questo non è più una fascia di sistema: è una lettura sbagliata.
 *
 * I tre tasti di Android stanno sui 48 punti, la barra a gesti sui 24, la
 * tacca di un iPhone sui 34. Un numero molto più grande arriva da una misura
 * presa mentre la pagina si stava ancora impaginando, e alzare la barra di
 * duecento pixel è peggio del difetto che si sta correggendo. */
export const FONDO_MASSIMO = 96;

const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Di quanto alzarsi dal fondo della propria pagina.
 *
 * `proprio` è quello che dice il proprio documento — vero solo quando la
 * plancia è la pagina, non quando è ospitata. `ospite` è quello del documento
 * in cima. `giaLasciato` è lo spazio che l'ospite lascia già libero sotto la
 * cornice: quello che scansa lui non lo dobbiamo scansare noi.
 */
export function fondoDiSistema(proprio, ospite, giaLasciato = 0) {
  const mio = numero(proprio);
  const suo = Math.max(0, numero(ospite) - numero(giaLasciato));
  return Math.min(FONDO_MASSIMO, Math.max(mio, suo));
}

/** Il valore come lo scrive un foglio di stile. */
export function inPixel(valore) {
  return `${Math.round(numero(valore))}px`;
}

/* E quanto si prende in cima (#215, #214).
 *
 * «Quando va sulle luci rgb per impostare i colori non si riesce più a
 * cliccare chiudi per tornare indietro»: sul telefono la finestra della luce
 * prende tutto lo schermo, e la sua intestazione — il nome a sinistra, «✕
 * CHIUDI» a destra — cominciava dal bordo di sopra. Dentro l'app di Home
 * Assistant su iPhone quel bordo e' sotto l'orologio e la batteria: la
 * pastiglia c'era, disegnata sotto la barra di stato, e un dito li' lo prende
 * il sistema, non la pagina. Restava solo chiudere l'app.
 *
 * E' lo stesso conto del fondo, rovesciato. Dentro la cornice
 * `env(safe-area-inset-top)` risponde zero; il numero vero lo ha il documento
 * in cima. Quello che l'ospite lascia gia' libero sopra la cornice — la barra
 * di Home Assistant, quando la plancia non e' a schermo intero — non lo si
 * scansa due volte: col chiosco la cornice parte da zero e la fascia e' tutta
 * nostra, senza chiosco ci sta gia' sotto e qui torna zero. */
export const CIMA_MASSIMA = 96;

export function cimaDiSistema(proprio, ospite, giaLasciatoSopra = 0) {
  const mio = numero(proprio);
  const suo = Math.max(0, numero(ospite) - numero(giaLasciatoSopra));
  return Math.min(CIMA_MASSIMA, Math.max(mio, suo));
}
