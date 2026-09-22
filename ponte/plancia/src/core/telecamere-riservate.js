/* Una telecamera che si vede solo quando in casa non c'e' nessuno (#81).
 *
 * «Pensavo a una possibilita' di mettere un'impostazione aggiuntiva sulle
 *  telecamere. Tipo io ne ho una interna ma vorrei si potesse vedere solo se a
 *  casa non c'e' nessuno per una questione di privacy.»
 *
 * Una telecamera dentro casa serve a guardare la casa quando non ci sei. Serve
 * a quello, e a nient'altro: mentre ci sei, quell'immagine non la vuole
 * nessuno — ne' tu, ne' chi vive con te e non ha scelto di essere ripreso
 * mentre e' sul divano.
 *
 * ── Dove sta scritto, e perche' non dentro la telecamera ──────────────────
 *
 * In un elenco suo, `cd_telecamere_riservate`, come fanno i rilevamenti: la
 * forma di `cd_cameras` la conoscono l'autorilevamento, le migrazioni e il
 * guscio vendorizzato, e aggiungerle un campo vorrebbe dire toccare tutti e
 * tre per una spunta. Qui invece e' una mappa `entita' -> vero`, e chi non ha
 * mai aperto quella casella non ha niente scritto da nessuna parte.
 *
 * ── Chi c'e' in casa ──────────────────────────────────────────────────────
 *
 * Le persone di `cd_people`, quelle della sezione Persone: `home` vuol dire in
 * casa, tutto il resto — `not_home`, una zona col nome, lo sconosciuto — vuol
 * dire fuori. Una persona che sta «in palestra» non e' in casa.
 *
 * ── E quando non si sa ────────────────────────────────────────────────────
 *
 * Se non c'e' nessuna persona configurata, o se nessuna delle loro entita'
 * risponde, la risposta non e' «non c'e' nessuno»: e' «non lo so». E davanti a
 * un «non lo so» la telecamera **resta nascosta**.
 *
 * Non e' prudenza per il gusto di esserlo. Fra i due sbagli possibili — una
 * telecamera nascosta a chi poteva vederla, e una telecamera accesa in salotto
 * mentre qualcuno ci passa davanti — il primo si scopre subito e si rimedia
 * con una spunta, il secondo non lo scopri mai. Chi accende questa opzione sta
 * chiedendo esattamente quella garanzia, e una garanzia che si arrende quando
 * il dato manca non e' una garanzia.
 *
 * Per questo l'editor la offre solo dove almeno una persona c'e', e lo dice.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Dove sta l'elenco. */
export const CHIAVE_RISERVATE = "cd_telecamere_riservate";

/* Gli stati con cui un'entita' di persona dice «sono a casa». Uno solo, ed e'
 * parola di Home Assistant: una zona col nome — «palestra», «ufficio» — e'
 * fuori, e `unknown` non e' una risposta. */
const IN_CASA = "home";

/** L'elenco normalizzato: una mappa `entita' -> true`, senza niente dentro di rotto. */
export function normalizzaRiservate(stored) {
  const dentro = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const fuori = {};
  for (const [entity, acceso] of Object.entries(dentro)) {
    const id = pulito(entity);
    if (id && acceso) fuori[id] = true;
  }
  return fuori;
}

/** Se questa telecamera si vede solo a casa vuota. */
export function eRiservata(entity, config) {
  const id = pulito(entity);
  return Boolean(id && normalizzaRiservate(config)[id]);
}

/** L'elenco con questa telecamera accesa o spenta, pronto da salvare. */
export function conLaRiservata(config, entity, acceso) {
  const prossima = normalizzaRiservate(config);
  const id = pulito(entity);
  if (!id) return prossima;
  if (acceso) prossima[id] = true;
  else delete prossima[id];
  return prossima;
}

/**
 * Se in casa c'e' qualcuno: `true`, `false`, oppure `null` quando non si sa.
 *
 * `null` e' una risposta, non un errore: nessuna persona configurata, o
 * nessuna delle loro entita' che risponde. Chi decide cosa farne e'
 * `telecamereVisibili`, e la risposta che da' e' «nascondi».
 */
export function cEQualcunoInCasa(persone = [], states = {}) {
  const righe = Array.isArray(persone) ? persone : [];
  let qualcosaSiSa = false;
  let qualcunoDentro = false;
  for (const persona of righe) {
    const entity = pulito(persona?.entity);
    if (!entity) continue;
    const stato = pulito(states?.[entity]?.state).toLowerCase();
    /* Un'entita' che non c'e', o che dice di non sapere, non conta ne' da una
     * parte ne' dall'altra: e' come se quella persona non fosse configurata. */
    if (!stato || stato === "unknown" || stato === "unavailable" || stato === "none") continue;
    qualcosaSiSa = true;
    if (stato === IN_CASA) qualcunoDentro = true;
  }
  return qualcosaSiSa ? qualcunoDentro : null;
}

/**
 * Le telecamere da disegnare adesso.
 *
 * Quelle senza la spunta passano sempre. Quelle con la spunta passano solo
 * quando si sa che in casa non c'e' nessuno — e «non si sa» non e' «non c'e'
 * nessuno».
 */
export function telecamereVisibili(cameras = [], { config = {}, persone = [], states = {} } = {}) {
  const righe = Array.isArray(cameras) ? cameras : [];
  const riservate = normalizzaRiservate(config);
  /* Se non c'e' nessuna riservata non si chiede niente a nessuno: la stragrande
   * maggioranza delle case sta qui, e leggere le persone per scartare zero
   * telecamere sarebbe lavoro buttato a ogni giro di disegno. */
  if (!Object.keys(riservate).length) return righe;
  const dentro = cEQualcunoInCasa(persone, states);
  /* `true` e `null` si comportano allo stesso modo: si nasconde. La differenza
   * la sa solo chi scrive la spiegazione nell'editor. */
  const nascondi = dentro !== false;
  if (!nascondi) return righe;
  return righe.filter((camera) => {
    const entity = pulito(camera?.entity || camera?.camera_entity || camera?.cam);
    return !riservate[entity];
  });
}
