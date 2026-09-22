/* Chi, fra le cose configurate in questa casa, in questo momento non risponde.
 *
 * «Potrebbe essere utile avere un widget che compare quando almeno una delle
 * entità mappate in gdahome diventa Non Disponibile. Ho dei comandi domotici
 * in giardino (tra cui alcuni dedicati alla piscina) che ogni tanto, causa
 * segnale wifi non sufficiente, vanno in offline: avere l'avviso mi allerta di
 * ripristinarli per evitare che la pompa ad esempio resti ferma troppo a
 * lungo» (#33).
 *
 * È il difetto più cattivo che una casa domotica abbia, perché è muto: una
 * presa che sparisce non fa rumore, la sua tessera resta lì con l'ultimo
 * valore che aveva, e uno se ne accorge quando la piscina è verde. La plancia
 * sapeva già tutto quello che serve per dirlo — quali entità sono configurate
 * e qual è il loro stato — e non lo diceva.
 *
 * ─── Cosa conta come «non risponde», e cosa no ───────────────────────────
 *
 * Solo `unavailable`. È la parola con cui Home Assistant dice «questa entità
 * esiste, e non riesco a parlarle»: è esattamente il caso della presa in
 * giardino col wifi debole, ed è un guasto.
 *
 * `unknown` NON conta, ed è voluto. Vuol dire un'altra cosa — l'entità c'è e
 * risponde, ma non ha ancora un valore da dire — ed è normalissima nei primi
 * secondi dopo un riavvio di Home Assistant, su un sensore che parla una volta
 * all'ora, su un pulsante che non è mai stato premuto. Contarla vorrebbe dire
 * una tessera rossa a ogni riavvio, cioè un avviso che si impara a ignorare:
 * e un avviso che si ignora è peggio di nessun avviso.
 *
 * Nemmeno le entità che in questa casa non ci sono proprio. Quella è una
 * configurazione da correggere — un'entità rinominata, un'integrazione tolta —
 * non una cosa che è andata offline: sono due guai diversi e vogliono due
 * risposte diverse, e mescolarli riempirebbe la tessera di rumore vecchio
 * finché quella vera non si perde in mezzo.
 *
 * Il modulo è puro: entrano gli identificativi e gli stati, esce l'elenco.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** La parola con cui Home Assistant dice «non riesco a parlarle». */
export const NON_RISPONDE = "unavailable";

/** Se quello stato è un'entità che non risponde. */
export function nonRisponde(stato) {
  return pulito(stato?.state).toLowerCase() === NON_RISPONDE;
}

/**
 * Chi non risponde, fra le entità date.
 *
 * `nomeDi` serve a chiamarle come le chiama chi abita: senza, resterebbe
 * l'identificativo, e `switch.0x00158d0004a1b2c3` non dice a nessuno quale
 * presa andare a guardare. Se non c'è un nome amichevole resta
 * l'identificativo, che è comunque meglio del niente.
 *
 * In ordine alfabetico per nome: l'elenco si guarda, e un ordine che cambia a
 * ogni giro perché cambia l'ordine degli stati è un elenco che non si riesce a
 * leggere.
 */
export function chiNonRisponde(entita, states = {}, { nomeDi = null } = {}) {
  const viste = new Set();
  const fuori = [];
  for (const grezzo of entita || []) {
    const entity = pulito(grezzo);
    if (!entity || viste.has(entity)) continue;
    viste.add(entity);
    const stato = states?.[entity];
    /* Un'entità che qui dentro non c'è proprio non è «offline»: è un'altra
     * cosa, e sta scritto in cima perché non entri di soppiatto. */
    if (!stato || !nonRisponde(stato)) continue;
    let nome = "";
    try {
      nome = pulito(nomeDi?.(entity));
    } catch (_errore) {
      nome = "";
    }
    fuori.push({
      entity,
      nome: nome || pulito(stato?.attributes?.friendly_name) || entity,
      /* Da quando: è la domanda che uno si fa subito dopo «chi». Cinque
       * minuti è un riavvio, due giorni è una presa da andare a premere. */
      da: Date.parse(pulito(stato?.last_changed)) || null,
    });
  }
  return fuori.sort((una, altra) => una.nome.localeCompare(altra.nome));
}

/* ── e adesso per dispositivo, non per entita' ──────────────────────────── */

/* «Non devi mettere le entita' ma i dispositivi non connessi, cosi' come li
 * mostri nel cruscotto installatore.»
 *
 * Aveva ragione, e il guaio era piu' grosso della forma dell'elenco. Qui si
 * elencava ogni singola entita' muta, e fra quelle finiva
 * `lock.asciugatrice_child_lock`: un'asciugatrice che risponde benissimo, di
 * cui tace una sola entita' — quella serratura bambini che l'integrazione
 * pubblica e che e' `unavailable` quando la macchina non sta lavando. Cioe'
 * l'avviso diceva «non connesso» di una cosa connessa, che e' esattamente il
 * modo in cui un avviso si impara a ignorare.
 *
 * Il ponte questa regola ce l'ha gia', ed e' quella che vede il cruscotto
 * (`ponte/src/salute.js`): si raggruppa per dispositivo, e un dispositivo e'
 * giu' **solo se tacciono tutte le sue entita'**. Una che parla vuol dire che
 * la strada c'e', e allora il guasto e' di quell'entita' li', non del
 * dispositivo. Qui si rifa' la stessa, e non una somigliante: due regole per
 * la stessa domanda sono due verita', e il giorno che si scostano nessuno sa
 * quale guardare.
 *
 * «Tutte le sue entita'» vuol dire tutte quelle che Home Assistant ha in casa,
 * non solo quelle configurate nella plancia: se dell'asciugatrice qui dentro
 * c'e' mappata la sola serratura bambini, a dire che l'asciugatrice sta bene
 * sono le altre — e vanno guardate, se no il raggruppamento non servirebbe a
 * niente proprio nel caso che l'ha reso necessario.
 */

/* Il nome del dispositivo quando il registro non lo dice.
 *
 * Il piu' corto fra i nomi delle sue entita': «Leapmotor B10» sta dentro
 * «Leapmotor B10 Autonomia residua CLTC» e dentro «Leapmotor B10 Batteria»,
 * perche' Home Assistant i nomi delle entita' li fa cosi' — il nome del
 * dispositivo davanti, e poi cosa misura. Non e' una regola, e' un'abitudine:
 * per questo e' il ripiego e non la prima scelta. */
function ilPiuCorto(nomi) {
  let scelto = "";
  for (const nome of nomi) if (!scelto || nome.length < scelto.length) scelto = nome;
  return scelto;
}

/**
 * Chi non risponde, raggruppato per dispositivo.
 *
 * `di` dice di chi e' un'entita', `nomi` come si chiama quel qualcuno: sono le
 * due mappe di `i-dispositivi-di-home-assistant.js`. Senza, o per le entita'
 * che un dispositivo non ce l'hanno — un template, un `input_boolean`, il
 * meteo — si torna riga per riga come prima: raggruppare per un dispositivo
 * che non c'e' vorrebbe dire inventarlo.
 *
 * Ogni riga porta `entita`, cioe' tutte le entita' mute che ci stanno dentro.
 * Serve al cestino: mettere da parte un dispositivo vuol dire mettere da parte
 * le sue, e cosi' l'elenco delle escluse resta fatto di entita' — come era
 * prima, e come restano leggibili quelle gia' scritte.
 */
export function chiNonRispondePerDispositivo(
  entita,
  states = {},
  { nomeDi = null, di = null, nomi = null } = {},
) {
  const sciolte = chiNonRisponde(entita, states, { nomeDi });
  const diChiE = di && typeof di === "object" ? di : {};
  if (!Object.keys(diChiE).length) return sciolte;

  /* Chi parla, fra i dispositivi: si guarda tutta la casa, non le configurate.
   * Un giro solo su tutti gli stati, e non uno per dispositivo. */
  const parla = new Set();
  for (const [id, stato] of Object.entries(states || {})) {
    const suo = pulito(diChiE[pulito(id)]);
    if (suo && !nonRisponde(stato)) parla.add(suo);
  }

  const perDispositivo = new Map();
  const fuori = [];
  for (const una of sciolte) {
    const suo = pulito(diChiE[una.entity]);
    if (!suo) {
      fuori.push(una);
      continue;
    }
    /* Il dispositivo parla da un'altra bocca: il guasto non e' suo. */
    if (parla.has(suo)) continue;
    const gia = perDispositivo.get(suo);
    if (gia) gia.push(una);
    else perDispositivo.set(suo, [una]);
  }

  const nomeDelDispositivo = nomi && typeof nomi === "object" ? nomi : {};
  for (const [suo, quelle] of perDispositivo) {
    fuori.push({
      entity: `dispositivo:${suo}`,
      dispositivo: suo,
      nome: pulito(nomeDelDispositivo[suo]) || ilPiuCorto(quelle.map((una) => una.nome)),
      /* Da quando: il dispositivo e' irraggiungibile da quando ha smesso di
       * parlare l'ULTIMA delle sue, non la prima — prima di allora una voce
       * c'era ancora. */
      da: quelle.reduce((piu, una) => (una.da && (!piu || una.da > piu) ? una.da : piu), null),
      entita: quelle.map((una) => una.entity),
    });
  }
  return fuori
    .map((una) => (una.entita ? una : { ...una, entita: [una.entity] }))
    .sort((una, altra) => una.nome.localeCompare(altra.nome));
}
