/* Da un rapporto a dieci controlli, e dai controlli a una parola.
 *
 * Sono le sole regole di questo pezzo, e stanno **qui e basta**: la console e'
 * una pagina che disegna quello che le arriva gia' deciso. Se le regole
 * stessero anche li', il giorno che una cambia ne cambierebbe una sola, e due
 * schermi direbbero due cose diverse della stessa casa.
 *
 * ─── Dieci controlli, e basta ────────────────────────────────────────────
 *
 * Qui c'era **il collaudo**: le stesse dieci righe, ma con sopra una cerimonia
 * — una casa restava «in collaudo» finche' non erano tutte verdi, si
 * «consegnava» una volta sola, e da allora quelle righe «si riaprivano». Era
 * una cosa che nessuno aveva chiesto, e sullo schermo si vedeva: una casa
 * appena abbinata veniva archiviata come lavoro non finito perche' aveva due
 * batterie scariche.
 *
 * Adesso sono dieci controlli e basta. Verde quello che va, rosso quello che
 * non va, e chi guarda decide da se' se e' un impianto finito. Non c'e' nessun
 * traguardo, niente da chiudere e niente da riaprire.
 *
 * ─── Tre risposte, non due ───────────────────────────────────────────────
 *
 * Un controllo puo' essere `true`, `false` o **`null`**, e la terza e' la piu'
 * importante. Il ponte lascia fuori dal rapporto quello che non e' riuscito
 * a sapere — una casa senza System Monitor non manda la CPU, un Supervisor che
 * non risponde non manda la macchina — e la differenza fra «non lo so» e «va
 * male» e' tutta la differenza fra un cruscotto utile e un cruscotto che
 * mente. `null` si dice «questa casa non lo dice», e non e' rosso.
 *
 * ─── Come sono scritte le righe ──────────────────────────────────────────
 *
 * Una regola sola, e vale per tutte e dieci:
 *
 *     il nome dice **di cosa** si parla — il numero dice **come sta** —
 *     il bollino dice **se va bene**.
 *
 * Il nome non giudica mai. Le righe erano scritte al contrario — «Sono
 * collegati tutti», «Niente da aggiornare», «Nessuna batteria da cambiare» —
 * e finche' erano verdi si leggevano bene; rosse, ognuna diceva il contrario
 * di se stessa a due dita di distanza:
 *
 *     ✗ Sono collegati tutti          17 dispositivi non collegati
 *     ✗ Niente da aggiornare          4 aggiornamenti in attesa
 *     ✗ Nessuna batteria da cambiare  2 sotto soglia
 *
 * Tre righe che si smentiscono da sole, sullo stesso schermo. E non era un
 * caso: **un controllo ha tre stati e un titolo solo**, quindi un titolo che
 * ne racconti uno e' sbagliato negli altri due. Adesso e' un nome e basta —
 * «I collegamenti», «Gli aggiornamenti», «Batterie dei dispositivi» — e si legge uguale
 * in tutti e tre.
 */

/* Dopo quanti rapporti saltati una casa e' offline. Uno solo puo' essere un
 * riavvio, tre no. */
export const OFFLINE_DOPO = 3;

/* Quanti giorni puo' stare fermo un backup prima che sia una cosa da guardare.
 * Due settimane: chi lo fa ogni notte se ne accorge subito, chi lo fa a mano
 * una volta al mese non viene tormentato. */
export const BACKUP_FERMO = 14;

/* La tacca della temperatura. Non e' un numero scelto qui: e' quella che la
 * plancia disegna gia' sull'arco del MiniPC, ed e' dove un ODROID comincia a
 * rallentarsi da solo. Sopra, la casa non si rompe — diventa lenta, e nessuno
 * capisce perche'. */
export const TROPPO_CALDO = 75;

/** Oltre quanto un disco e' pieno, e oltre quanto e' consumato. */
export const DISCO_PIENO = 85;
export const DISCO_FINITO = 80;

const MINUTO = 60 * 1000;

const numero = (valore) => (Number.isFinite(Number(valore)) ? Number(valore) : null);

const plurale = (quanti, uno, molti) => `${quanti} ${quanti === 1 ? uno : molti}`;

/* Quando una casa non manda quel pezzo di rapporto. Non e' zero e non e' un
 * guasto: e' silenzio, e si scrive sempre con le stesse parole perche' chi
 * guarda dieci righe deve riconoscerlo a colpo d'occhio senza rileggerlo. */
const NON_LO_DICE = "non comunicato";

export function daQuanto(quando, adesso = Date.now()) {
  const minuti = Math.round((adesso - Date.parse(String(quando))) / MINUTO);
  if (!Number.isFinite(minuti)) return "chissà quando";
  if (minuti < 1) return "adesso";
  if (minuti < 60) return `${minuti} min fa`;
  const ore = Math.round(minuti / 60);
  if (ore < 24) return `${ore} ${ore === 1 ? "ora" : "ore"} fa`;
  const giorni = Math.round(ore / 24);
  return `${giorni} ${giorni === 1 ? "giorno" : "giorni"} fa`;
}

export function eOffline(carta, adesso = Date.now()) {
  const quando = Date.parse(String(carta?.quando));
  if (!Number.isFinite(quando)) return true;
  const ogni = numero(carta?.ogni) || 15;
  return adesso - quando > ogni * OFFLINE_DOPO * MINUTO;
}

const backupFermo = (carta) => {
  if (!carta?.backup) return null;
  const giorni = carta.backup.giorniFa;
  return giorni === null || giorni === undefined || giorni > BACKUP_FERMO;
};

/* Quando un aggiornamento in attesa e' una cosa da guardare.
 *
 * Non sempre: un add-on che ha una versione nuova da ieri non e' un impianto
 * da andare a vedere, e una casa che diventa ambra per quello insegna a non
 * guardare piu' le case ambra. Conta quando tocca Home Assistant o gdahome —
 * li' dentro ci sono le correzioni di sicurezza — o quando se ne sono
 * accumulati tre.
 *
 * Fra i dieci controlli invece contano tutti, e quella riga e' severa apposta:
 * li' la domanda e' «questo impianto e' in ordine?», qui e' «devo andare a
 * vedere?». Due domande diverse sullo stesso numero, ed e' giusto che diano
 * due risposte diverse. */
export const aggiornamentiPesano = (a) =>
  Boolean(a) && ((numero(a.quanti) ?? 0) >= 3 || a.ha === true || a.gdahome === true);

/** Gli add-on che partono all'avvio e non girano. */
/* Quante entita' non rispondono, in questa casa.
 *
 * Due nomi per lo stesso numero: `giu` e' quello di adesso, `sparite` quello
 * dei ponti fino alla 1.5.6. Sta in una funzione e non scritto tre volte
 * perche' e' gia' costato una volta: rinominando la chiave nel ponte, questo
 * file e' rimasto indietro e il controllo diceva «undefined su 180»
 * — rossa per sempre, e senza che niente si rompesse.
 *
 * `null` vuol dire «questa casa non lo dice», che non e' zero. */
const quantiGiu = (c) => c?.entita?.giu ?? c?.entita?.sparite ?? null;

/* E quanti apparecchi sono: un termostato che se ne va porta giu' cinque
 * entita'. Le case ferme a un ponte di ieri non lo dicono, e allora si
 * ripiega sul conto delle entita'. */
const quantiApparecchi = (c) => c?.entita?.dispositivi ?? quantiGiu(c);

export const addonGiu = (carta) =>
  carta?.addon ? (numero(carta.addon.spentiCheDovrebbero) ?? 0) : null;

/**
 * I dieci controlli, da un rapporto.
 *
 * Sono le cose che chi ha montato l'impianto guarda quando apre la scheda di
 * una casa, e sono tutte gia' dentro il rapporto. Non c'e' nessun traguardo da
 * raggiungere: `va: false` vuol dire «questa cosa adesso non va», e domani puo'
 * tornare verde da sola.
 */
export function iControlli(carta) {
  const c = carta ?? {};
  const controlli = [];
  const metti = (cosa, va, dettaglio) => controlli.push({ cosa, va, dettaglio });

  metti(
    "La plancia",
    c.plance ? c.plance.configurate > 0 : null,
    c.plance
      ? c.plance.configurate > 0
        ? `${c.plance.configurate} su ${c.plance.quante}`
        : "nessuna configurata"
      : NON_LO_DICE,
  );
  metti(
    "I telefoni",
    c.telefoni ? c.telefoni.abbinati > 0 : null,
    c.telefoni
      ? c.telefoni.abbinati > 0
        ? plurale(c.telefoni.abbinati, "telefono abbinato", "telefoni abbinati")
        : "nessuno abbinato"
      : NON_LO_DICE,
  );
  metti(
    "Da fuori casa",
    c.fuori ? Boolean(c.fuori.acceso && c.fuori.filo) : null,
    c.fuori
      ? c.fuori.acceso
        ? c.fuori.filo
          ? "connesso"
          : "attivo, non connesso"
        : "disattivato"
      : NON_LO_DICE,
  );
  metti(
    "I collegamenti",
    quantiGiu(c) === null ? null : quantiGiu(c) === 0,
    quantiGiu(c) === null
      ? NON_LO_DICE
      : quantiGiu(c) === 0
        ? `${c.entita.totali} entità, tutte raggiungibili`
        : plurale(quantiApparecchi(c), "dispositivo non collegato", "dispositivi non collegati"),
  );
  metti(
    "Gli aggiornamenti",
    c.aggiornamenti ? c.aggiornamenti.quanti === 0 : null,
    c.aggiornamenti
      ? c.aggiornamenti.quanti === 0
        ? "tutto aggiornato"
        : `${c.aggiornamenti.quanti} in attesa`
      : NON_LO_DICE,
  );
  metti(
    "Gli add-on",
    c.addon ? addonGiu(c) === 0 : null,
    c.addon
      ? addonGiu(c) === 0
        ? `${c.addon.accesi} attivi su ${c.addon.quanti}`
        : `${plurale(addonGiu(c), "fermo", "fermi")} con l'avvio automatico`
      : NON_LO_DICE,
  );
  metti(
    "La rete",
    c.rete ? Boolean(c.rete.internet) && (c.rete.sorvegliate?.giu ?? 0) === 0 : null,
    c.rete
      ? !c.rete.internet
        ? "senza internet"
        : (c.rete.sorvegliate?.giu ?? 0) > 0
          ? plurale(
              c.rete.sorvegliate.giu,
              "apparato non raggiungibile",
              "apparati non raggiungibili",
            )
          : "internet raggiungibile"
      : NON_LO_DICE,
  );
  metti(
    "La macchina",
    laMacchinaRegge(c.macchina),
    c.macchina
      ? [
          c.macchina.temperatura === null || c.macchina.temperatura === undefined
            ? null
            : `${c.macchina.temperatura}°`,
          c.macchina.disco === null || c.macchina.disco === undefined
            ? null
            : `disco al ${c.macchina.disco}%`,
        ]
          .filter(Boolean)
          .join(" · ") || "nessun valore disponibile"
      : NON_LO_DICE,
  );
  metti(
    "Il backup",
    c.backup ? !backupFermo(c) : null,
    c.backup
      ? c.backup.giorniFa === null || c.backup.giorniFa === undefined
        ? "mai eseguito"
        : `l'ultimo ${plurale(c.backup.giorniFa, "giorno fa", "giorni fa")}`
      : NON_LO_DICE,
  );
  metti(
    "Batterie dei dispositivi",
    c.batterie ? c.batterie.scariche === 0 : null,
    c.batterie
      ? c.batterie.scariche === 0
        ? c.batterie.piuBassa === null || c.batterie.piuBassa === undefined
          ? "nessuna presente"
          : `la più bassa al ${c.batterie.piuBassa}%`
        : `${c.batterie.scariche} sotto soglia`
      : NON_LO_DICE,
  );

  return {
    controlli,
    bene: controlli.filter((uno) => uno.va === true).length,
    male: controlli.filter((uno) => uno.va === false).length,
    ignoti: controlli.filter((uno) => uno.va === null).length,
    quanti: controlli.length,
  };
}

/* La macchina regge? `null` dove non se ne sa abbastanza per dirlo — e una
 * macchina che dichiara solo il disco si giudica sul disco, invece di finire
 * fra quelle di cui non si sa niente. */
function laMacchinaRegge(m) {
  if (!m) return null;
  const guarda = [];
  if (m.temperatura !== null && m.temperatura !== undefined)
    guarda.push(m.temperatura < TROPPO_CALDO);
  if (m.disco !== null && m.disco !== undefined) guarda.push(m.disco < DISCO_PIENO);
  if (m.discoVita !== null && m.discoVita !== undefined) guarda.push(m.discoVita < DISCO_FINITO);
  if (!guarda.length) return null;
  return guarda.every(Boolean);
}

/**
 * Lo stato di una casa, in una parola.
 *
 * Tre, e l'ordine conta. **Offline batte tutto**: di una casa che non parla non
 * si sa niente, nemmeno che sta bene — quello che si vede di lei e' vecchio.
 * Poi quello che non va. Poi il resto.
 *
 * Ce n'era un quarto, «collaudo aperto», e teneva in una fila sua le case in
 * cui un controllo era rosso e nessuno aveva ancora dichiarato finito
 * l'impianto. Non serviva a niente che «da guardare» non dicesse gia': una casa
 * con due batterie scariche va guardata, che sia stata montata ieri o tre anni
 * fa. E archiviava come lavoro non finito una casa che funzionava.
 */
export function loStato(casa, adesso = Date.now()) {
  const c = casa?.carta ?? null;
  if (!c || eOffline(c, adesso)) {
    return {
      chiave: "offline",
      segno: "■",
      parola: "offline",
      perché: c
        ? `Nessun rapporto da ${daQuanto(c.quando, adesso)}: i dati qui sotto risalgono ad allora.`
        : "Nessun rapporto ancora ricevuto da questo impianto.",
    };
  }

  /* Quello che fa dire «vacci a vedere».
   *
   * Sono gli stessi dieci controlli, meno uno. Le prime tre righe qui sotto ci
   * sono arrivate togliendo il collaudo: una plancia vuota, nessun telefono
   * abbinato e il collegamento da fuori giu' erano cose che **solo** il
   * collaudo teneva d'occhio, e senza di lui una casa con la plancia vuota
   * sarebbe risultata «a posto» mentre nella sua scheda c'era una riga rossa.
   * Due schermi della stessa casa che dicevano il contrario.
   *
   * L'unica differenza che resta e' voluta ed e' spiegata su
   * `aggiornamentiPesano`: un aggiornamento solo si vede in elenco ma non
   * colora la casa, se no si smette di guardare le case colorate. */
  const guai = [];
  if (c.plance && c.plance.configurate === 0) guai.push("plancia da configurare");
  if (c.telefoni && c.telefoni.abbinati === 0) guai.push("nessun telefono abbinato");
  if (c.fuori && !(c.fuori.acceso && c.fuori.filo))
    guai.push(
      c.fuori.acceso ? "accesso da fuori casa non connesso" : "accesso da fuori casa disattivato",
    );
  if (c.rete && !c.rete.internet) guai.push("senza internet");
  if (addonGiu(c) > 0) guai.push(plurale(addonGiu(c), "add-on fermo", "add-on fermi"));
  if ((c.rete?.sorvegliate?.giu ?? 0) > 0)
    guai.push(
      plurale(
        c.rete.sorvegliate.giu,
        "apparato di rete non raggiungibile",
        "apparati di rete non raggiungibili",
      ),
    );
  if ((quantiGiu(c) ?? 0) > 0)
    guai.push(
      plurale(quantiApparecchi(c), "dispositivo non collegato", "dispositivi non collegati"),
    );
  if ((c.registro?.errori24h ?? 0) > 0)
    guai.push(`${plurale(c.registro.errori24h, "errore", "errori")} nel registro`);
  if ((c.macchina?.temperatura ?? 0) >= TROPPO_CALDO)
    guai.push(`${c.macchina.temperatura}° sulla scheda`);
  if ((c.macchina?.disco ?? 0) >= DISCO_PIENO) guai.push(`disco al ${c.macchina.disco}%`);
  if ((c.macchina?.discoVita ?? 0) >= DISCO_FINITO)
    guai.push(`disco consumato al ${c.macchina.discoVita}%`);
  if ((c.batterie?.scariche ?? 0) > 0)
    guai.push(plurale(c.batterie.scariche, "batteria scarica", "batterie scariche"));
  if (aggiornamentiPesano(c.aggiornamenti))
    guai.push(`${plurale(c.aggiornamenti.quanti, "aggiornamento", "aggiornamenti")} in attesa`);
  if (backupFermo(c)) guai.push("backup fermo");

  if (guai.length) {
    const prime = guai.slice(0, 3);
    const restano = guai.length - prime.length;
    return {
      chiave: "guardare",
      segno: "▲",
      parola: "da verificare",
      perché: restano
        ? `${prime.join(", ")} e altre ${restano} segnalazioni.`
        : `${prime.join(", ")}.`,
    };
  }
  return { chiave: "posto", segno: "●", parola: "in ordine", perché: "" };
}

/**
 * Le pastiglie di una riga: quello che non va, una cosa per pastiglia.
 *
 * Ci sono anche le cose che non fanno diventare ambra la casa — un
 * aggiornamento singolo si vede lo stesso, semplicemente non suona.
 */
export function lePastiglie(carta) {
  const c = carta ?? {};
  const p = [];
  const metti = (parola, come) => p.push({ parola, come });

  if (c.rete && !c.rete.internet) metti("senza internet", "male");
  if (addonGiu(c) > 0) metti(plurale(addonGiu(c), "add-on fermo", "add-on fermi"), "male");
  if ((c.rete?.sorvegliate?.giu ?? 0) > 0)
    metti(
      plurale(c.rete.sorvegliate.giu, "apparato non raggiungibile", "apparati non raggiungibili"),
      "male",
    );
  if ((quantiGiu(c) ?? 0) > 0)
    metti(plurale(quantiApparecchi(c), "non collegato", "non collegati"), "male");
  if ((c.registro?.errori24h ?? 0) > 0)
    metti(`${plurale(c.registro.errori24h, "errore", "errori")} in 24h`, "male");
  if ((c.macchina?.temperatura ?? 0) >= TROPPO_CALDO)
    metti(`${c.macchina.temperatura}° sulla scheda`, "attenta");
  if ((c.macchina?.disco ?? 0) >= DISCO_PIENO) metti(`disco al ${c.macchina.disco}%`, "attenta");
  if ((c.macchina?.discoVita ?? 0) >= DISCO_FINITO)
    metti(`disco consumato al ${c.macchina.discoVita}%`, "attenta");
  if ((c.batterie?.scariche ?? 0) > 0)
    metti(plurale(c.batterie.scariche, "batteria scarica", "batterie scariche"), "attenta");
  if ((c.aggiornamenti?.quanti ?? 0) > 0)
    metti(
      plurale(c.aggiornamenti.quanti, "aggiornamento", "aggiornamenti"),
      aggiornamentiPesano(c.aggiornamenti) ? "attenta" : "",
    );
  if (backupFermo(c))
    metti(
      c.backup.giorniFa === null || c.backup.giorniFa === undefined
        ? "backup mai eseguito"
        : `backup fermo da ${c.backup.giorniFa} gg`,
      "attenta",
    );
  if (c.plance && c.plance.configurate === 0) metti("plancia da configurare", "attenta");
  if (c.telefoni && c.telefoni.abbinati === 0) metti("nessun telefono abbinato", "attenta");

  if (!p.length) {
    metti(
      c.entita ? `${c.entita.totali} entità, tutte raggiungibili` : "nessuna segnalazione",
      "bene",
    );
  }
  return p;
}
