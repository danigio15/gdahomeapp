/* Quando il Supervisor dice di no, dirlo in italiano e dire dove guardare.
 *
 * Un utente ha scritto in Assistenza, due volte a quattro minuti di distanza:
 *
 *   «Non riesco a fare ultimo aggiornamento mi esce il seguente errore:
 *    "Impossibile eseguire l'azione: update/install Error updating gdahome:
 *    'AddonManager.update' blocked from execution, no host internet
 *    Connection"»
 *
 * Quella frase non e' nostra: la scrive il Supervisor di Home Assistant
 * (`supervisor/jobs/decorator.py`). Certe operazioni — fra cui aggiornare un
 * add-on — sono protette da condizioni, e se una non e' soddisfatta il
 * Supervisor **non prova nemmeno**: rifiuta prima di partire, e lo dice cosi'.
 *
 * Noi quel «no» lo riportavamo com'era. Chi legge `'AddonManager.update'
 * blocked from execution` non sa cosa farne, e infatti ha scritto in
 * Assistenza. Il rifiuto e' giusto e non c'e' niente da aggirare: quello che
 * si puo' fare e' spiegarlo.
 *
 * ─── Perche' un elenco scritto a mano, e corto ─────────────────────────────
 *
 * Perche' ogni riga qui dentro e' una frase che ho letto nel codice del
 * Supervisor, non una che mi sembrava giusta. Una frase indovinata non
 * aggancerebbe mai, e nessuno se ne accorgerebbe: resterebbe l'inglese di
 * prima, con in piu' la convinzione di averlo sistemato. Quelle che non
 * riconosciamo passano com'erano, ed e' meglio di una traduzione sbagliata.
 *
 * `gdahome` dentro quel messaggio e' solo il nome dell'add-on che si stava
 * aggiornando: premendo aggiorna su un altro add-on la frase sarebbe la
 * stessa, col suo nome. Non e' il nostro pacchetto a non andare.
 */

/** La forma del rifiuto: `'<Qualcosa.metodo>' blocked from execution, <perche>`. */
const IL_RIFIUTO = /'[^']+'\s+blocked from execution,\s*(.+)$/i;

/* I motivi, come li scrive il Supervisor.
 *
 * `quando` e' cercato nel motivo, tutto in minuscolo, e sta corto apposta: il
 * Supervisor in certe righe ci infila dentro dei pezzi che cambiano — quanto
 * spazio e' rimasto, quali plugin — e una frase intera non aggancerebbe piu'.
 */
const I_MOTIVI = Object.freeze([
  {
    quando: "no host internet connection",
    perche:
      "Home Assistant dice che questa casa non ha internet, e allora gli aggiornamenti non li fa partire nemmeno.",
    cosaFare:
      "Quasi sempre non è la linea: è il controllo della connessione che non passa, e il colpevole più comune è il DNS — un Pi-hole, un AdGuard, o il DNS del provider. In Impostazioni → Sistema → Rete si vede cosa ne pensa Home Assistant. Dal terminale: «ha dns reset» e poi «ha supervisor restart».",
  },
  {
    quando: "no supervisor internet connection",
    perche:
      "Il Supervisor di Home Assistant non riesce ad arrivare fuori, e senza quello un aggiornamento non lo scarica.",
    cosaFare:
      "È la stessa famiglia di prima, un gradino più in là: «ha dns reset» e poi «ha supervisor restart». Se c'è un blocca-pubblicità sul DNS, va escluso Home Assistant.",
  },
  {
    quando: "not enough free space",
    perche: "Sul disco non c'è più spazio per scaricare l'aggiornamento.",
    cosaFare:
      "Vanno tolte le copie di riserva vecchie (Impostazioni → Sistema → Backup) e i registri delle vecchie versioni. Il Supervisor si tiene un margine apposta, quindi il disco è già più pieno di quanto dica il numero.",
  },
  {
    quando: "system is not healthy",
    perche:
      "Home Assistant si considera «non in salute», e in quello stato blocca gli aggiornamenti.",
    cosaFare:
      "Impostazioni → Sistema → Riparazioni dice cosa non gli torna. Sistemato quello, l'aggiornamento riparte da sé.",
  },
  {
    quando: "system is not running",
    perche: "Home Assistant sta ancora partendo, o si sta fermando.",
    cosaFare: "Basta aspettare che finisca di avviarsi e riprovare.",
  },
  {
    quando: "supervisor needs to be updated first",
    perche: "Prima va aggiornato il Supervisor, e solo dopo gli add-on.",
    cosaFare: "Impostazioni → Sistema → Aggiornamenti: lì c'è il Supervisor, e va fatto per primo.",
  },
  {
    quando: "host network manager not available",
    perche: "Home Assistant non riesce a parlare col gestore di rete della macchina.",
    cosaFare: "Di solito si rimette a posto riavviando la macchina, non solo Home Assistant.",
  },
]);

/**
 * Il «no» del Supervisor, detto in italiano — o `null` se non è lui.
 *
 * Torna `null` anche per un rifiuto del Supervisor con un motivo che non
 * conosciamo: meglio l'inglese giusto di un italiano inventato.
 */
export function ilNoDelSupervisore(messaggio) {
  const detto = String(messaggio || "");
  const rifiuto = IL_RIFIUTO.exec(detto);
  if (!rifiuto) return null;
  const motivo = rifiuto[1].trim().toLowerCase();
  const quale = I_MOTIVI.find((uno) => motivo.includes(uno.quando));
  if (!quale) return null;
  return { perche: quale.perche, cosaFare: quale.cosaFare };
}

/**
 * Lo stesso, già scritto in una frase sola da mostrare.
 *
 * Il messaggio di Home Assistant resta in coda, fra parentesi: chi deve
 * cercare aiuto in rete ha bisogno delle parole esatte, e toglierle vorrebbe
 * dire rendere il guasto più difficile da raccontare, non più facile.
 */
export function comeDirlo(messaggio) {
  const suo = ilNoDelSupervisore(messaggio);
  if (!suo) return null;
  return `${suo.perche} ${suo.cosaFare} (Home Assistant dice: ${String(messaggio).trim()})`;
}
