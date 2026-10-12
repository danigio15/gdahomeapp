/* Chi puo' aprire la Config di questa plancia, vista dalla pagina.
 *
 * La casella «Utente admin (vuoto = Config visibile a tutti)», nel blocco
 * «Generali», promette una cosa: scritto un nome, la Config e' sua. La pagina
 * la manteneva solo dove nessuno la metteva alla prova, per tre motivi:
 *
 *  - il nome stava in `cd_connection`, che resta sul dispositivo dove lo si e'
 *    scritto: il telefono di un altro vedeva la casella vuota, e vuota vuol
 *    dire «per tutti». Adesso sta in `cd_branding`, la chiave dei «Generali»,
 *    che viaggia con la configurazione condivisa;
 *  - chi stava guardando lo si chiedeva all'Home Assistant che ospita la
 *    pagina (`hass.user`); nell'app la ospita il servitore del telefono, e la
 *    risposta era sempre vuota. Adesso lo si chiede anche al ponte
 *    (`auth/current_user`), che risponde con l'utente a cui e' intestato il
 *    telefono e dice lui se la Config gli si apre (`gdahome_config`);
 *  - il confronto era «il nome contiene quello scritto»: una lettera sola
 *    apriva la Config a mezza casa. Adesso e' il nome intero, senza maiuscole
 *    e senza spazi ai lati, oppure l'identificativo di Home Assistant.
 *
 * Questa pagina pero' non e' il lucchetto: il lucchetto sta nel ponte, che le
 * scritture di chi non e' nominato le rifiuta (`ponte/src/chi-configura.js`).
 * Qui si decide solo cosa mostrare, e la regola e' la stessa del ponte. Quando
 * il ponte ha risposto, vale la sua risposta: e' lui a sapere chi e' chi in
 * casa — anche che un nome scritto a meta' non e' di nessuno, e allora la
 * Config resta a chi amministra Home Assistant. Dove il ponte non c'e' (il
 * pannello dell'integrazione) si confronta qui col nome che Home Assistant da'
 * alla pagina.
 */

const AL_MASSIMO = 20;

/* Il nome come si confronta: senza spazi ai lati, e senza maiuscole. */
export function perConfrontare(testo) {
  return String(testo ?? "")
    .trim()
    .toLocaleLowerCase();
}

/* I nomi scritti nella casella: solo testi, puliti, non vuoti. */
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

/**
 * I nomi della casella, dalle chiavi che li hanno tenuti.
 *
 * `cd_branding.admin_users` e' dove stanno adesso, ed e' quello che vale anche
 * quando e' un elenco vuoto: vuol dire che qualcuno ha svuotato la casella.
 * Se non c'e' affatto si guarda dove stavano prima — `cd_connection`, e il
 * `config.js` di chi la plancia la serviva da solo — perche' su quel
 * dispositivo la casella era piena, e svuotarla senza che nessuno l'abbia
 * chiesto vorrebbe dire aprire la Config per un aggiornamento.
 */
export function amministratoriScritti({
  branding = null,
  collegamento = null,
  config = null,
} = {}) {
  if (branding && typeof branding === "object" && Array.isArray(branding.admin_users))
    return nomiPuliti(branding.admin_users);
  if (collegamento && typeof collegamento === "object" && Array.isArray(collegamento.admin_users))
    return nomiPuliti(collegamento.admin_users);
  if (config && typeof config === "object" && Array.isArray(config.admin_users))
    return nomiPuliti(config.admin_users);
  return [];
}

/* Se quello scritto e' questo utente: `utente` e' `{id, name}`, come lo dice
 * Home Assistant. */
export function stessaPersona(scritto, utente) {
  const voce = perConfrontare(scritto);
  if (!voce || !utente) return false;
  return voce === perConfrontare(utente.id) || voce === perConfrontare(utente.name);
}

/**
 * Se la Config si apre a chi sta guardando.
 *
 * @param {object} chi
 * @param {string[]} chi.amministratori i nomi della casella
 * @param {{id?: string, name?: string}|null} chi.utente chi sta guardando,
 *   se si sa
 * @param {boolean|null} chi.dalPonte la risposta del ponte, se c'e'
 */
export function siApreLaConfig({ amministratori = [], utente = null, dalPonte = null } = {}) {
  /* Il ponte conosce la casella salvata e chi c'e' in casa: dove ha
   * risposto, la sua risposta e' quella buona. */
  if (dalPonte === true || dalPonte === false) return dalPonte;
  const nomi = nomiPuliti(amministratori);
  if (!nomi.length) return true;
  if (!utente || (!perConfrontare(utente.id) && !perConfrontare(utente.name))) return false;
  return nomi.some((scritto) => stessaPersona(scritto, utente));
}
