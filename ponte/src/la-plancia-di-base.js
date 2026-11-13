/* La plancia di chi ha gdahome Base.
 *
 * Con Base la plancia e' una sola, la principale (`primary`): le altre restano
 * nel ponte ma non si vedono, ne' fra le Plance di Home Assistant ne'
 * nell'app, e tornano il giorno che la casa e' Premium.
 *
 * Il guaio e' di chi il lavoro l'aveva fatto in un'altra: una casa che aveva
 * la principale vuota e la sua plancia vera in una seconda — per esempio una
 * «casa» aggiunta per ripristinarci il backup di prima — dopo l'aggiornamento
 * apriva la principale e trovava una plancia da configurare, mentre la sua
 * spariva. Il lavoro non era perso, era solo nascosto.
 *
 * Qui lo si riporta: se la principale e' vuota e un'altra plancia ha dentro
 * qualcosa, la sua configurazione si copia nella principale. Si copia e non
 * si sposta: l'altra resta com'e', e con Premium torna anche lei. Quando la
 * principale ha gia' qualcosa dentro non si tocca niente — e' il lavoro di
 * chi ci abita, e non si scrive sopra a quello.
 *
 * Fra piu' plance configurate vince quella scritta per ultima: e' quella su
 * cui si stava lavorando. */

import { PROFILO_PRINCIPALE, STATO, eConfigurata } from "./configurazione.js";

/* Torna il profilo da cui si e' copiato, o `""` se non c'era niente da fare. */
export function portaNellaPrincipale({ plance, configurazione, registro } = {}) {
  if (!plance || !configurazione) return "";
  const principale = configurazione.leggi(PROFILO_PRINCIPALE)?.snapshot;
  if (principale && eConfigurata(principale.values)) return "";

  let scelta = null;
  for (const una of plance.elenco()) {
    if (una.profilo === PROFILO_PRINCIPALE) continue;
    const scatto = configurazione.leggi(una.profilo)?.snapshot;
    if (!scatto || !eConfigurata(scatto.values)) continue;
    if (!scelta || scatto.updated_at > scelta.scatto.updated_at) scelta = { una, scatto };
  }
  if (!scelta) return "";

  const esito = configurazione.scrivi(PROFILO_PRINCIPALE, scelta.scatto.values, {
    keys_revision: scelta.scatto.keys_revision,
    /* Una generazione piu' alta di quella che aveva la principale: chi la
     * teneva aperta vuota non deve poterci riscrivere sopra il niente. */
    writer_generation:
      Math.max(scelta.scatto.writer_generation, principale?.writer_generation || 0) + 1,
  });
  if (esito?.status !== STATO.salvato) return "";
  registro?.info?.(
    `con Base si vede solo la plancia principale, ed era vuota: ci ho copiato ` +
      `la configurazione di «${scelta.una.titolo}», che resta com'era`,
  );
  return scelta.una.profilo;
}
