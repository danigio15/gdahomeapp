/* Chi puo' mettere mano alla Configurazione di una plancia.
 *
 * Nel blocco «Generali» della Config c'e' una casella: «Utente admin (vuoto =
 * Config visibile a tutti)». Chi la riempie col proprio nome si aspetta una
 * cosa sola, ed e' giusta: da quel momento la Config la apre e la cambia lui,
 * e nessun altro.
 *
 * Non succedeva, e per tre ragioni che si davano la mano:
 *
 *  1. **Il nome stava sul vetro, non nella plancia.** La casella scriveva in
 *     `cd_connection`, che e' la chiave delle cose di un dispositivo solo — il
 *     gettone, l'indirizzo remoto — e che apposta non viaggia con la
 *     configurazione condivisa. Il telefono di un altro quella riga non
 *     l'aveva mai vista: per lui la casella era vuota, e vuota vuol dire
 *     «Config per tutti».
 *  2. **Nell'app nessuno sapeva chi stava guardando.** La pagina chiedeva il
 *     nome all'Home Assistant che la ospita (`hass.user`); nell'app chi la
 *     ospita e' il servitore del telefono, e la risposta era sempre vuota. E
 *     la voce «Configurazione» del menu dell'app la Config la apre toccando
 *     la sua linguetta anche quando e' nascosta.
 *  3. **Il controllo stava solo nella pagina**, e nascondere un bottone non
 *     e' un divieto: il ponte accettava la configurazione nuova da chiunque
 *     amministrasse Home Assistant, nome o non nome.
 *
 * Qui sta la regola, una volta sola per il ponte: la usa `commissioni.js` per
 * rifiutare le scritture (`dashboardmodern/config/set` e `/restore`, che
 * comprendono il «Reset totale») e per dire alla pagina — rispondendo a
 * `auth/current_user` — se a chi guarda la Config si apre. La pagina ha la sua
 * copia della stessa regola per quando il ponte non c'e' (il pannello
 * dell'integrazione): `plancia/src/core/chi-configura.js`.
 *
 * ─── La regola ───────────────────────────────────────────────────────────
 *
 *  - Casella vuota: **come prima**. La Config si vede, e scrivere resta a chi
 *    amministra Home Assistant (`SOLO_CHI_AMMINISTRA`).
 *  - Casella piena: la Config e' di chi ci e' scritto. Si confronta prima
 *    l'identificativo di Home Assistant, poi il nome che Home Assistant
 *    mostra; senza badare a maiuscole e a spazi in testa e in coda, ma **per
 *    intero**: «Ann» non e' «Anna». Prima il confronto era «il nome contiene
 *    quello che c'e' scritto», e una lettera sola apriva la Config a mezza
 *    casa.
 *  - Chi non si sa chi sia, con la casella piena, **non entra**. Un telefono
 *    abbinato prima che i telefoni si intestassero a qualcuno, un Home
 *    Assistant che non dice chi sono i suoi utenti: una restrizione che cade
 *    quando non si sa niente non e' una restrizione.
 *  - Un nome che **non e' di nessuno** in casa — scritto a meta', o di un
 *    utente tolto — non chiude fuori tutti per sempre: la Config resta a chi
 *    amministra Home Assistant, che e' quello che sarebbe con la casella
 *    vuota. Senza questa riga, un errore di battitura nella casella sarebbe
 *    stato l'ultimo salvataggio di quella plancia. Chi non amministra resta
 *    fuori lo stesso.
 */

/* Il nome come si confronta: senza spazi ai lati, e senza maiuscole. */
export function perConfrontare(testo) {
  return String(testo ?? "")
    .trim()
    .toLocaleLowerCase();
}

/* Quanti nomi si guardano al massimo. La casella ne scrive uno; l'elenco c'e'
 * perche' la plancia l'ha sempre tenuto cosi', e un elenco senza tetto e' un
 * elenco che qualcuno riempie. */
const AL_MASSIMO = 20;

/* I nomi scritti nella casella, da un elenco qualunque: solo testi, puliti,
 * non vuoti. */
export function nomiPuliti(elenco) {
  if (!Array.isArray(elenco)) return [];
  const fuori = [];
  for (const uno of elenco) {
    if (typeof uno !== "string") continue;
    const pulito = uno.trim().slice(0, 120);
    if (pulito && !fuori.includes(pulito)) fuori.push(pulito);
    if (fuori.length >= AL_MASSIMO) break;
  }
  return fuori;
}

/* Gli amministratori di una plancia, dai valori del suo scatto condiviso.
 *
 * Stanno in `cd_branding.admin_users`: `cd_branding` e' la chiave del blocco
 * «Generali» — il titolo, il sottotitolo — e viaggia con la configurazione,
 * che e' proprio quello che a `cd_connection` mancava. I valori dello scatto
 * sono testi JSON, come li tiene la pagina; uno che non si legge vale vuoto. */
export function amministratoriDellaPlancia(valori) {
  const grezzo = valori && typeof valori === "object" ? valori.cd_branding : null;
  let letto = grezzo;
  if (typeof grezzo === "string") {
    try {
      letto = JSON.parse(grezzo);
    } catch (_errore) {
      return [];
    }
  }
  if (!letto || typeof letto !== "object" || Array.isArray(letto)) return [];
  return nomiPuliti(letto.admin_users);
}

/* Se quello che c'e' scritto nella casella e' questo utente.
 *
 * `utente` e' come lo tiene `utenti.js`: `{id, nome}`. */
export function stessaPersona(scritto, utente) {
  const voce = perConfrontare(scritto);
  if (!voce || !utente) return false;
  return voce === perConfrontare(utente.id) || voce === perConfrontare(utente.nome);
}

/**
 * Se chi chiede puo' aprire e cambiare la Configurazione di una plancia.
 *
 * @param {object} chi
 * @param {string[]} chi.amministratori i nomi della casella (vedi sopra)
 * @param {string} chi.chiChiede l'identificativo di Home Assistant di chi
 *   chiede: l'utente a cui e' intestato il telefono, o chi guarda dentro Home
 *   Assistant. Vuoto vuol dire «non si sa».
 * @param {Array<{id: string, nome: string, attivo?: boolean}>|null} chi.utenti
 *   l'elenco di casa, o `null` se Home Assistant non l'ha detto
 * @param {boolean} chi.puoAmministrare se chi chiede amministra Home Assistant
 */
export function puoConfigurare({
  amministratori = [],
  chiChiede = "",
  utenti = null,
  puoAmministrare = false,
} = {}) {
  const nomi = nomiPuliti(amministratori);
  if (!nomi.length) return true;
  const chi = String(chiChiede || "").trim();
  if (!chi || !Array.isArray(utenti)) return false;
  const vivi = utenti.filter((uno) => uno && uno.attivo !== false);
  const lui = vivi.find((uno) => uno.id === chi);
  if (!lui) return false;
  if (nomi.some((scritto) => stessaPersona(scritto, lui))) return true;
  /* Il nome scritto e' di qualcun altro che c'e': la Config e' sua. */
  const diQualcuno = vivi.some((uno) => nomi.some((scritto) => stessaPersona(scritto, uno)));
  if (diQualcuno) return false;
  /* Non e' di nessuno: resta a chi amministra, come con la casella vuota. */
  return puoAmministrare === true;
}
