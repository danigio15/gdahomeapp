/* Se questa casa il fotovoltaico ce l'ha, e se l'autosufficienza si può dire.
 *
 * «Uno switch che tolga completamente la gestione energetica casa con
 * fotovoltaico, pulendo da info errate la pagina energia» (#82, dal gruppo
 * Facebook).
 *
 * In una casa senza pannelli la pagina Energia mostrava lo stesso l'impianto,
 * con numeri che non vogliono dire niente:
 *
 *  · «Produzione FV 0,0 kWh» — che non è «produzione zero», è «non c'è nessun
 *    pannello»;
 *  · «Autosufficienza 100 %» — e questo è il numero sbagliato vero. Viene da
 *    `(consumo − prelievo da rete) / consumo`, e in quella casa il prelievo da
 *    rete è `0` perché nemmeno quello è configurato: una casa che prende tutto
 *    dalla rete legge di essere autosufficiente.
 *
 * Il consumo — l'unica cosa che quella casa misura davvero — si perdeva in
 * mezzo a due numeri finti.
 *
 * ── Due domande, non una ────────────────────────────────────────────────
 *
 * «C'è il fotovoltaico» e «si può dire l'autosufficienza» sembrano la stessa
 * domanda e non lo sono. Il 100 % è sbagliato anche in una casa CHE HA i
 * pannelli, se le manca il contatore di rete: il conto ha bisogno di tutte e
 * due le misure, e senza la seconda mente comunque. Perciò sono due funzioni,
 * e la seconda non si accontenta della prima.
 *
 * ── Automatico, con l'ultima parola a chi abita ─────────────────────────
 *
 * La risposta di solito la sa già la configurazione: senza nessuna entità di
 * produzione, i pannelli non ci sono e non c'è niente da chiedere a nessuno.
 * L'interruttore esplicito serve agli altri due casi — chi il pannello ce l'ha
 * ma quella pagina non la vuole, e chi ha un'entità che risponde male — e
 * quando c'è vince lui: è una cosa che si è detta a mano, e le cose dette a
 * mano non si indovinano una seconda volta.
 *
 * Sta nei `metadata` dell'impianto e non dentro `solar`, ed è una differenza
 * che conta: `plantIsConfigured` guarda dentro i quattro gruppi per decidere
 * se un impianto è configurato, e una spunta li dentro farebbe sembrare
 * configurato un impianto in cui non c'è scritto niente.
 *
 * È puro: entra l'impianto, esce un sì o un no.
 */

const oggetto = (valore) =>
  valore && typeof valore === "object" && !Array.isArray(valore) ? valore : {};

const scritto = (valore) => String(valore ?? "").trim().length > 0;

/** Il campo dei `metadata` che tiene la spunta. */
export const SENZA_FOTOVOLTAICO = "senza_fotovoltaico";

/** Se qualcuno ha detto a mano che qui il fotovoltaico non c'è. */
export const spentoAMano = (impianto) =>
  oggetto(oggetto(impianto).metadata)[SENZA_FOTOVOLTAICO] === true;

/** Se in un gruppo dell'impianto è scritta almeno una entità. */
const gruppoScritto = (impianto, gruppo) =>
  Object.values(oggetto(oggetto(impianto)[gruppo])).some(scritto);

/**
 * Se questa casa ha il fotovoltaico.
 *
 * La spunta vince su tutto; senza spunta la risposta è se c'è scritta almeno
 * una entità di produzione. Non si guarda il VALORE di quelle entità: una
 * giornata di pioggia produce zero, e zero di notte è la regola — spegnere la
 * pagina a ogni tramonto sarebbe peggio del difetto.
 */
export function cEIlFotovoltaico(impianto) {
  if (spentoAMano(impianto)) return false;
  return gruppoScritto(impianto, "solar");
}

/* Il prelievo dalla rete, fra le caselle del gruppo.
 *
 * Il gruppo `grid` tiene tre cose diverse: la potenza scambiata, quello che si
 * preleva e quello che si immette. All'autosufficienza serve il PRELIEVO: la
 * potenza non è energia e l'immissione è il verso opposto. Si riconoscono dal
 * nome, che è come il modello le chiama da sempre — `daily_import_energy`,
 * `total_import_energy` — e cercarle così vuol dire che una casella nuova con
 * lo stesso nome di famiglia entra da sé, invece di restare fuori da un elenco
 * scritto a mano che nessuno si ricorda di aggiornare.
 */
const cEIlPrelievoDaRete = (impianto) =>
  Object.entries(oggetto(oggetto(impianto).grid)).some(
    ([chiave, valore]) => chiave.includes("import") && scritto(valore),
  );

/**
 * Se il numero dell'autosufficienza ha un senso in questa casa.
 *
 * Servono tutte e tre le cose: i pannelli, il consumo di casa e il prelievo
 * dalla rete. Ne manca una e il conto esce lo stesso — ma esce sbagliato, ed è
 * esattamente il 100 % della segnalazione.
 */
export function siPuoDireLAutosufficienza(impianto) {
  return (
    cEIlFotovoltaico(impianto) && gruppoScritto(impianto, "house") && cEIlPrelievoDaRete(impianto)
  );
}

/**
 * L'impianto con la spunta messa o tolta.
 *
 * `acceso` è come lo legge chi guarda l'interruttore: acceso vuol dire «il
 * fotovoltaico c'è». Spento scrive la spunta; acceso la toglie invece di
 * scriverci `false`, così una configurazione che non l'ha mai toccata e una
 * che l'ha rimessa com'era si scrivono nello stesso modo.
 */
export function conIlFotovoltaico(impianto, acceso) {
  const base = oggetto(impianto);
  const metadata = { ...oggetto(base.metadata) };
  if (acceso) delete metadata[SENZA_FOTOVOLTAICO];
  else metadata[SENZA_FOTOVOLTAICO] = true;
  return { ...base, metadata };
}
