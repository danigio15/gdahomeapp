/* Se la pagina Sicurezza deve disegnare il blocco delle telecamere (#113).
 *
 * «Possibilità di togliere la sezione se uno non dispone di telecamere.»
 *
 * Le telecamere non sono una sezione della plancia: stanno **dentro**
 * Sicurezza, insieme all'allarme e ai varchi. Chi non ne ha una poteva solo
 * spegnere Sicurezza intera — e perdere anche l'allarme e le porte, che con le
 * telecamere non c'entrano niente. Quello che restava era un riquadro CCTV
 * sempre vuoto in cima alla pagina, con dentro la scritta che invita a
 * configurarne una: giusta per chi sta montando l'impianto, rumore per chi
 * telecamere non ne vuole.
 *
 * Quindi un interruttore, e non una regola automatica.
 *
 * La regola automatica sarebbe stata «nessuna telecamera configurata, niente
 * riquadro», e si scriveva in una riga. Ma quel riquadro vuoto è anche l'unico
 * posto dove uno scopre che le telecamere si possono mettere: toglierlo da
 * solo vorrebbe dire che chi non ne ha ancora non saprà mai che può. Con
 * l'interruttore lo decide chi ha la casa — e finché non lo tocca tutto resta
 * com'era.
 *
 * ── Perché acceso vale anche «non l'ho mai toccato» ──────────────────────
 *
 * Una casa che si aggiorna non deve vedere sparire niente: la chiave non c'è
 * ancora, e la risposta a «non c'è scritto» deve essere quella di prima. Si
 * spegne solo scrivendolo, ed è l'unico valore che toglie il riquadro.
 *
 * È puro: entra quello che c'è scritto, esce la risposta. Chi legge il
 * deposito sta nella sezione.
 */

/** Dove si scrive la scelta. Una chiave sola, che tiene un `false`. */
export const CHIAVE_TELECAMERE_IN_SICUREZZA = "cd_telecamere_in_sicurezza";

/**
 * Se il blocco delle telecamere si deve disegnare.
 *
 * Tutto quello che non è un «no» scritto vale sì: `null` di una casa che non
 * ha mai aperto quella scheda, una chiave rimasta a mezzo, un valore di una
 * versione futura. Davanti a un dubbio si mostra, perché nascondere una cosa
 * che c'è è il guasto peggiore dei due — chi la voleva via la toglie in un
 * tocco, chi se la vede sparire non sa nemmeno cosa cercare.
 */
export function leTelecamereSiVedono(scritto) {
  if (scritto === false) return false;
  if (scritto && typeof scritto === "object" && scritto.mostra === false) return false;
  return true;
}

/** Quello che si scrive nel deposito quando si tocca l'interruttore. */
export function laSceltaDelleTelecamere(mostra) {
  return { mostra: mostra !== false };
}
