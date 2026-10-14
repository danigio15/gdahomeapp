/* Cosa sta accanto alle persone, in Home (#175).
 *
 * «Sul computer e sul tablet a destra delle card delle persone resta un buco
 * vuoto.» Il posto c'era apposta: la fila delle persone ha una corsia per un
 * compagno, ed era quella della card del flusso dell'energia, tolta nella
 * 1.4.20. Adesso ci sta l'assistente di casa (`assistente-di-casa.js`), o
 * niente, come si sceglie in Config › Persone.
 *
 * Qui ci sono soltanto la scelta e il posto: dove va la card e quanto e'
 * larga. Il modulo e' puro.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Dove si scrive la scelta: e' della casa, e viaggia fra i dispositivi. */
export const CHIAVE_ACCANTO = "cd_people_accanto";

/** Le cose che possono stare accanto alle persone. */
export const COSE_ACCANTO = Object.freeze(["assistente", "niente"]);

/* Di serie l'assistente: «niente» di serie vorrebbe dire lasciare il buco per
 * cui e' stata aperta la segnalazione. */
export const ACCANTO_DI_SERIE = "assistente";

/**
 * La scelta salvata, ripulita. Le due card di prima — il riepilogo e i
 * prossimi eventi — hanno lasciato il posto all'assistente: chi le aveva
 * scelte se lo ritrova lui, chi aveva scelto «niente» resta senza.
 */
export function normalizzaAccanto(salvato) {
  const dato = salvato && typeof salvato === "object" && !Array.isArray(salvato) ? salvato : {};
  const mostra = pulito(dato.mostra);
  return { mostra: mostra === "niente" ? "niente" : ACCANTO_DI_SERIE };
}

/**
 * Dove sta la card, e quanto e' larga.
 *
 * Sul computer e sul tablet va accanto alle persone se le persone stanno in
 * una riga sola e resta almeno una corsia libera: quello e' il buco. Prende
 * due corsie quando ce ne sono, una sola altrimenti. Se le persone riempiono
 * la riga, va sotto, larga quanto la fila: l'assistente non si spegne perche'
 * la famiglia e' numerosa.
 *
 * Sul telefono sta sempre sotto le persone, a tutta larghezza: mezza
 * larghezza di telefono non tiene un messaggio e i suoi tasti.
 */
export function postoAccanto({ colonne = 0, persone = 0, telefono = false } = {}) {
  const corsie = Math.floor(Number(colonne) || 0);
  const quante = Math.max(0, Math.floor(Number(persone) || 0));
  if (quante < 1) return { accanto: false, sotto: false, persone: quante };
  if (telefono || corsie - quante < 1) return { accanto: false, sotto: true, persone: quante };
  return { accanto: true, sotto: false, persone: quante, larghezza: Math.min(2, corsie - quante) };
}
