/* L'elenco dichiarato: la forma che hanno tutte le sezioni (#74).
 *
 * «Va cambiata per tutte quelle che hanno questa cosa. Le sezioni si devono
 *  comportare tutte alla stessa maniera.»
 *
 * Quattro schede — Varchi, Batterie, Presenza, Macchine — non erano schede:
 * erano RILEVAMENTI con delle correzioni sopra. L'elenco lo faceva Home
 * Assistant, il cestino non cancellava ma escludeva, e l'escluso restava
 * scritto sotto. Il resto della plancia — Porte e cancelli, i Carichi, gli
 * Elettrodomestici — funziona nell'altro modo: una riga la metti tu, e quando
 * la elimini e' eliminata.
 *
 * Qui c'e' la regola che le fa comportare tutte alla stessa maniera, scritta
 * una volta sola. Quattro copie della stessa regola sono quattro regole che
 * fra sei mesi non dicono piu' la stessa cosa, e la segnalazione nasceva
 * proprio da li': quattro schede scritte una alla volta, e si vedeva.
 *
 * ── «Non lo so» e «non ne voglio nessuno» ────────────────────────────────
 *
 * E' la distinzione su cui regge tutto, ed e' una riga di codice.
 *
 * `righe` ASSENTE vuol dire che questa casa non ha ancora dichiarato niente,
 * e la' si continua a leggere il rilevamento di prima: chi non apre mai la
 * configurazione non deve vedersi sparire una pagina per un aggiornamento.
 *
 * `righe` PRESENTE, anche VUOTO, vuol dire che ha dichiarato, e allora comanda
 * quello e basta. Senza questa seconda meta' — cioe' con l'elenco vuoto letto
 * come «non lo so» — cancellando l'ultima riga tornerebbero tutte, che e'
 * esattamente la segnalazione da cui si e' partiti.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* I campi in piu' che una sezione puo' tenere per riga.
 *
 * Tre cose ce le hanno tutte — entita', nome, disegno — e una quarta ce l'ha
 * solo chi ne ha bisogno: le Macchine tengono a quale famiglia appartiene la
 * riga, le Batterie le due soglie di ricarica. Passano di qui per NOME, non
 * «tutto quello che c'e' nell'oggetto»: un elenco esplicito e' l'unica forma
 * che dice cosa si salva, e cosa invece e' roba di passaggio che non deve
 * finire nel deposito.
 */

/** Una riga dichiarata, ripulita. Torna `null` se non e' una riga. */
export function rigaPulita(voce, inPiu = []) {
  if (!voce || typeof voce !== "object") return null;
  const entity = pulito(voce.entity);
  const name = pulito(voce.name);
  const icon = pulito(voce.icon);
  /* Una riga senza entita' e senza nome non e' una riga: e' un «＋ Aggiungi»
   * premuto per sbaglio, e tenerla vorrebbe dire una scheda che si riempie di
   * righe vuote. Col solo nome invece resta: e' una riga cominciata e non
   * finita, e la scheda lo dice. */
  if (!entity && !name) return null;
  const riga = { entity, name, icon };
  for (const campo of Array.isArray(inPiu) ? inPiu : [])
    if (voce[campo] !== undefined && voce[campo] !== null) riga[campo] = voce[campo];
  return riga;
}

/**
 * Le righe dichiarate, oppure `null` se questa casa non ne ha mai dichiarate.
 * `null` non e' l'elenco vuoto: vedi il capitolo qui sopra.
 */
export function righeDichiarate(stored, inPiu = []) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  if (!Array.isArray(dato.righe)) return null;
  const viste = new Set();
  const righe = [];
  for (const voce of dato.righe) {
    const riga = rigaPulita(voce, inPiu);
    if (!riga) continue;
    /* La stessa entita' due volte sarebbe la stessa cosa contata due volte, e
     * in cima alla pagina il conto direbbe un numero sbagliato — che e'
     * l'unico numero per cui quelle pagine esistono. Vince la prima. */
    if (riga.entity && viste.has(riga.entity)) continue;
    if (riga.entity) viste.add(riga.entity);
    righe.push(riga);
  }
  return righe;
}

/** La configurazione con questa riga al suo posto, pronta da salvare. */
export function conLaRiga(config, indice, riga, inPiu = []) {
  const righe = [...(righeDichiarate(config, inPiu) || [])];
  const pulita = rigaPulita(riga, inPiu) || { entity: "", name: "", icon: "" };
  if (indice >= 0 && indice < righe.length) righe[indice] = pulita;
  else righe.push(pulita);
  return { ...(config && typeof config === "object" ? config : {}), righe };
}

/** La configurazione senza questa riga. Eliminata vuol dire eliminata. */
export function senzaLaRiga(config, indice, inPiu = []) {
  const righe = (righeDichiarate(config, inPiu) || []).filter((_riga, posto) => posto !== indice);
  return { ...(config && typeof config === "object" ? config : {}), righe };
}

/** La configurazione con queste righe in fondo: e' quello che fa l'importazione. */
export function conLeRighe(config, aggiunte, inPiu = []) {
  const righe = [
    ...(righeDichiarate(config, inPiu) || []),
    ...(Array.isArray(aggiunte) ? aggiunte : []),
  ];
  return { ...(config && typeof config === "object" ? config : {}), righe };
}

/** Le entita' gia' dichiarate: serve a non riproporre quello che c'e' gia'. */
export function entitaDichiarate(config) {
  return new Set((righeDichiarate(config) || []).map((riga) => riga.entity).filter(Boolean));
}
