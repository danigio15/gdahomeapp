/* Il registro.
 *
 * Va sul registro dell'add-on, che l'utente legge dalla scheda in Home
 * Assistant. Due regole: mai un segno, mai un codice di abbinamento — chi
 * chiede aiuto incolla il registro in una segnalazione pubblica senza
 * rileggerlo, ed e' successo abbastanza volte da doverlo dare per scontato.
 */

const SCALA = Object.freeze({ debug: 10, info: 20, attenzione: 30, errore: 40 });

export function apriIlRegistro(livello = "info") {
  const soglia = SCALA[livello] ?? SCALA.info;
  const scrivi = (nome, colonna) => (messaggio) => {
    if (SCALA[nome] < soglia) return;
    const quando = new Date().toISOString().slice(11, 19);
    process.stdout.write(`[${quando}] ${colonna} ${messaggio}\n`);
  };
  return {
    debug: scrivi("debug", "  ."),
    info: scrivi("info", "  ·"),
    attenzione: scrivi("attenzione", "  !"),
    errore: scrivi("errore", "  ✗"),
  };
}
