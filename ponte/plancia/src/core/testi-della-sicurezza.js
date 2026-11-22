/* I testi della sicurezza: due sensori che parlano, e quando dicono qualcosa.
 *
 * «Ho in Home Assistant due sensori che restituiscono una stringa di testo:
 * uno con lo stato del sistema di sicurezza, uno con le anomalie. Vorrei
 * vedere le scritte piccole che scorrono nella Home, e vederle anche nella
 * sezione Sicurezza» (#472).
 *
 * Non sono numeri e non sono interruttori: sono frasi. Una centrale che non
 * passa da `alarm_control_panel` — un'integrazione che espone solo un
 * `sensor` con scritto «Inserito parziale, zona 3 esclusa» — oppure un
 * template che raccoglie in una riga le batterie scariche dei rilevatori, la
 * sirena che non risponde, la linea telefonica caduta. Nessuna tessera della
 * plancia sa leggerle, perche' nessuna tessera sa che cosa vogliono dire: e
 * qui non si prova a capirlo. Si mostrano per quello che sono, parola per
 * parola.
 *
 * L'unica cosa che si decide qui e' se la frase DICE qualcosa. Un sensore
 * delle anomalie passa quasi tutta la vita a scrivere «Nessuna anomalia»: in
 * Sicurezza quella riga va bene — e' la risposta alla domanda che uno si fa
 * entrando — ma in Home sarebbe una scritta che scorre per sempre per dire
 * che va tutto bene, cioe' rumore. Quindi in Home la riga c'e' solo quando il
 * testo non e' «neutro», e in Sicurezza la riga c'e' sempre e si colora
 * quando non lo e'.
 *
 * ── Perche' l'elenco dei neutri e' scritto a mano ──────────────────────────
 *
 * Non c'e' un modo di sapere da fuori che «Normale» e' tranquillo e «Guasto»
 * no: lo sa chi ha scritto il template. L'elenco qui sotto e' quello che le
 * integrazioni e i template scrivono davvero quando non c'e' niente da dire,
 * in italiano e in inglese, e il confronto si fa sulla frase ripulita —
 * senza maiuscole, senza accenti, senza punteggiatura — perche' «Nessuna
 * anomalia.» e «NESSUNA ANOMALIA» sono la stessa frase scritta da due
 * template diversi. Una frase che non e' nell'elenco e' una notizia: davanti a
 * un dubbio si mostra, perche' un'anomalia nascosta per sbaglio e' il guasto
 * peggiore dei due.
 *
 * E' puro: entra la configurazione e lo stato, esce cosa mostrare. Chi legge
 * il deposito e chi disegna stanno in `sections/testi-della-sicurezza-section.js`.
 */

/** Dove si scrive la configurazione dei testi. */
export const CHIAVE_TESTI_SICUREZZA = "cd_testi_sicurezza";

/* Due, come i sensori di chi l'ha chiesto: lo stato e le anomalie. Non e' un
 * limite tecnico, e' un limite di spazio — in Home ogni testo e' una riga in
 * cima alla pagina, e la terza riga di avvisi sopra il meteo comincia a
 * spingere giu' la casa. */
export const QUANTI_TESTI = 2;

/* Un'etichetta e' un nome, non una frase: «Stato allarme», «Anomalie». Il
 * tetto c'e' perche' in Home sta davanti al testo, e un'etichetta lunga quanto
 * il testo si mangerebbe la riga. */
const ETICHETTA_AL_MASSIMO = 40;

const clean = (valore) => String(valore ?? "").trim();

/* Quello che Home Assistant scrive quando non sa. Non sono neutri: sono muti
 * — l'entita' non risponde — e la differenza si vede in Sicurezza, dove un
 * sensore che non risponde non deve sembrare un sensore che dice «tutto ok». */
const MUTI = new Set(["unavailable", "unknown"]);

/**
 * La frase com'e' per il confronto: minuscola, senza accenti, senza
 * punteggiatura, con gli spazi ridotti a uno.
 *
 * Gli accenti si tolgono scomponendo la lettera (la «à» diventa «a» piu' il
 * segno) e buttando il segno: cosi' «Normalità» e «normalita» si incontrano
 * senza un elenco di lettere scritto a mano. La punteggiatura diventa uno
 * spazio, non niente, perche' «tutto-ok» e' due parole e non «tuttook».
 */
export function fraseDaConfrontare(testo) {
  return clean(testo)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/* Le frasi che non dicono niente, gia' ripulite. «none» e «null» stanno qui e
 * non fra i muti: sono quello che un template scrive quando la lista delle
 * anomalie e' vuota, e una lista vuota e' una risposta, non un silenzio. */
export const FRASI_NEUTRE = Object.freeze([
  "",
  "unknown",
  "unavailable",
  "none",
  "null",
  "ok",
  "nessuna",
  "nessuna anomalia",
  "normale",
  "tutto ok",
  "no anomalie",
  "no problems",
]);

const NEUTRE = new Set(FRASI_NEUTRE);

/** Se il testo non dice niente: vuoto, muto, o una delle frasi tranquille. */
export function eNeutro(testo) {
  return NEUTRE.has(fraseDaConfrontare(testo));
}

/**
 * La configurazione, ripulita.
 *
 * `righe` sono al massimo due, ognuna con l'entita' e un'etichetta che puo'
 * mancare; `home` dice se i testi si vedono anche in Home. Acceso di serie:
 * chi scrive un'entita' qui lo fa per vederla, e la Home e' la meta' della
 * richiesta. Si spegne solo con un `false` scritto.
 *
 * Un'entita' scritta due volte vale una: due righe identiche in Home non
 * direbbero niente di piu' di una. Una riga senza entita' non e' una riga —
 * e' una casella lasciata vuota — e se ne va.
 */
export function normalizzaTestiDellaSicurezza(stored) {
  const dato =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? stored
      : { righe: Array.isArray(stored) ? stored : [] };
  const viste = new Set();
  const righe = [];
  for (const riga of Array.isArray(dato.righe) ? dato.righe : []) {
    const entity = clean(typeof riga === "string" ? riga : riga?.entity);
    if (!/^[a-z0-9_]+\.[^\s.]+$/i.test(entity) || viste.has(entity)) continue;
    viste.add(entity);
    righe.push({
      entity,
      etichetta: clean(typeof riga === "string" ? "" : riga?.etichetta).slice(
        0,
        ETICHETTA_AL_MASSIMO,
      ),
    });
    if (righe.length >= QUANTI_TESTI) break;
  }
  return { righe, home: dato.home !== false };
}

/** Se c'e' almeno un testo configurato: chi non ne ha non deve pagare niente. */
export function ceQualcheTesto(config) {
  return Boolean(config?.righe?.length);
}

/**
 * Come sta un testo adesso.
 *
 * Torna l'entita', l'etichetta da mostrare (quella scritta, poi il nome che
 * Home Assistant da' all'entita', poi l'entita'), il testo per intero, da
 * quando e' cosi' (millisecondi, o `null`) e uno di tre stati:
 *
 *  - `"avviso"`: dice qualcosa, e va evidenziato;
 *  - `"neutro"`: dice che va tutto bene, o non dice niente;
 *  - `"muto"`: l'entita' non c'e' o non risponde.
 *
 * Il «da quando» e' `last_changed`, non `last_updated`: il secondo si muove
 * anche quando cambia solo un attributo, e «Nessuna anomalia da 2 minuti» su
 * una frase che e' la stessa da tre giorni sarebbe falso.
 */
export function letturaDelTesto(riga, stato) {
  const entity = clean(riga?.entity);
  const nome = clean(stato?.attributes?.friendly_name);
  const etichetta = clean(riga?.etichetta) || nome || entity;
  const grezzo = stato ? clean(stato.state) : "";
  const muto = !stato || MUTI.has(grezzo.toLowerCase());
  const testo = muto ? "" : grezzo;
  const quando = Date.parse(clean(stato?.last_changed || stato?.last_updated));
  return {
    entity,
    etichetta,
    testo,
    stato: muto ? "muto" : eNeutro(testo) ? "neutro" : "avviso",
    da: Number.isFinite(quando) ? quando : null,
  };
}

/** Tutti i testi configurati, letti adesso, nell'ordine in cui sono scritti. */
export function letturaDeiTesti(config, states = {}) {
  return (config?.righe || []).map((riga) => letturaDelTesto(riga, states?.[riga.entity]));
}

/**
 * I testi che vanno in Home: solo quelli che dicono qualcosa, e solo se la
 * Home li vuole.
 *
 * Un neutro non ci va, un muto nemmeno: in cima alla Home una riga che dice
 * «non disponibile» sarebbe un avviso su un sensore, non sulla casa — quello
 * lo dice gia' la pagina Sicurezza, a chi ci entra.
 */
export function testiPerLaHome(config, states = {}) {
  if (!config?.home) return [];
  return letturaDeiTesti(config, states).filter((lettura) => lettura.stato === "avviso");
}

/** Le entita' che i testi leggono: servono a chi decide se un cambio lo tocca. */
export function entitaDeiTesti(config) {
  return (config?.righe || []).map((riga) => riga.entity);
}
