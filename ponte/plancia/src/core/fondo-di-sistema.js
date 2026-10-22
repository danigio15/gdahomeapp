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
export function fondoDiSistema(proprio, ospite, giaLasciato = 0, sottoLaFinestra = 0) {
  const mio = numero(proprio);
  const suo = Math.max(0, numero(ospite) - numero(giaLasciato));
  const valore = Math.min(FONDO_MASSIMO, Math.max(mio, suo));
  /* La fascia c'e', ma la finestra non ci arriva.
   *
   * «Guarda la navbar ora e vedi se secondo te e' corretta»: dentro Home
   * Assistant su Android, coi tre tasti, sotto i nomi della barra restava
   * una striscia vuota alta quanto i tasti. L'app di Home Assistant ormai la
   * finestra la accorcia da se' — finisce dove cominciano i tasti — ma la
   * pagina si sente dire lo stesso `env(safe-area-inset-bottom)` = 48: lo
   * spazio dei tasti contato due volte, una dall'app e una da noi.
   *
   * Chi lo ha gia' lasciato si vede dallo schermo: se fra il fondo della
   * finestra e il fondo del vetro manca esattamente la fascia, la fascia e'
   * fuori dalla finestra, e qui non c'e' niente da scansare. Solo se torna
   * pari: una finestra piu' corta per altre ragioni — la barra degli
   * indirizzi di un browser in cima, la tastiera — non dice niente su chi sta
   * in fondo, e la fascia resta com'era. */
  if (valore > 0 && Math.abs(numero(sottoLaFinestra) - valore) <= 2) return 0;
  return valore;
}

/**
 * Quanto del vetro sta fuori dalla finestra, in altezza: lo schermo meno la
 * finestra, girati tutti e due nello stesso verso (su qualche Android lo
 * schermo resta detto in verticale anche col telefono coricato).
 */
export function fuoriDallaFinestra(schermo, finestra) {
  const largo = numero(schermo?.width);
  const alto = numero(schermo?.height);
  const w = numero(finestra?.innerWidth);
  const h = numero(finestra?.innerHeight);
  if (!alto || !h) return 0;
  const coricata = w > h;
  const altezza = coricata === largo > alto ? alto : largo;
  return Math.max(0, altezza - h);
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

/* Dove sta la nostra cornice nello schermo del documento in cima.
 *
 * Non nello schermo di chi la contiene: Home Assistant puo' mettere la
 * plancia dentro una cornice dentro un'altra cornice, e il riquadro di una
 * cornice si misura sempre rispetto a quella che la contiene. Preso cosi', un
 * pannello che comincia sotto l'orologio diceva «comincio a zero», e la
 * fascia si scansava due volte: una la lasciava Home Assistant, l'altra la
 * plancia — la striscia vuota sotto l'orologio su iPhone. Si sale cornice per
 * cornice fino in cima, sommando. `null` quando non si puo' sapere. */
export function laCorniceNellaCima(finestra) {
  try {
    let sopra = 0;
    let altezza = null;
    let w = finestra;
    while (w && w !== w.parent && w.frameElement) {
      const riquadro = w.frameElement.getBoundingClientRect();
      if (altezza === null) altezza = riquadro.height;
      sopra += riquadro.top;
      w = w.parent;
    }
    if (altezza === null) return null;
    return { sopra, sotto: sopra + altezza };
  } catch (_error) {
    return null;
  }
}
