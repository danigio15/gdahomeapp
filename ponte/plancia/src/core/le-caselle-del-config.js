/* Le caselle che la configurazione offre, con il nome che hanno addosso.
 *
 * «La casella c'è ma manca nel config dove inserire l'entità.» La casella
 * c'era davvero, e la ricerca non la trovava: `cercaNelConfig` cammina sui
 * VALORI salvati, e una casella vuota non ha valore. Chi cercava «ventola»
 * prima di averci scritto qualcosa si sentiva rispondere «Nessuna
 * configurazione contiene questa parola», che si legge in un modo solo —
 * quella casella non esiste.
 *
 * Cercare fra i valori serve a chi chiede «dove l'ho messo». Questo elenco
 * serve all'altra domanda, che è quella di chi sta configurando: «dove lo
 * metto». Sono due domande diverse e vogliono due risposte diverse, e nessuna
 * delle due sostituisce l'altra.
 *
 * ── Dove stanno scritti i nomi ──────────────────────────────────────────
 *
 * Da nessuna parte qui, se si può evitare. Un elenco di cento caselle
 * ribattuto a mano è un elenco che il giorno dopo non è più vero, e una
 * ricerca che manda dove non c'è niente fa più danno di una che non trova.
 * Quindi:
 *
 *  · le caselle della maschera Flussi escono da `ENERGY_GROUPS`, che è la
 *    tabella con cui si disegnano;
 *  · le caselle del guscio storico si mietono dal guscio stesso, chiedendogli
 *    di disegnarle: `CD_SLOTS` e' un `const` dentro il suo copione e da fuori
 *    non si vede, ma `editorRenderSezioni()` e' una funzione su `globalThis`
 *    e torna tutte le fisarmoniche in un colpo — comprese le etichette che la
 *    persona si e' rinominata;
 *  · restano dichiarate qui le cinque del raffreddamento, che il guscio
 *    disegna da `legacy/modules-entry.js` e non espone a nessuno. Una prova
 *    le tiene allineate a `COOLING_SLOT_MAP`: se ne nasce una sesta, o una
 *    cambia nome, la prova cade prima che cada la ricerca.
 *
 * ── Quello che questo elenco non promette ───────────────────────────────
 *
 * Solo le caselle che si aprono davvero. Le `dm.energy_*` del guscio non
 * entrano: la scheda Energia adesso è dell'editor nuovo, e quelle
 * fisarmoniche lì non si disegnano più — mandarci qualcuno vorrebbe dire
 * mandarlo davanti a niente. Le `dm.lavatrice_*` nemmeno: la loro fisarmonica
 * sarebbe «sez5», e una linguetta «sez5» non esiste in nessuna lingua.
 */
import { COOLING_SLOT_MAP } from "./energy-projection.js";
import { isRetiredEditorSlot } from "./editor-slots.js";
import { ENERGY_GROUPS } from "./renderers.js";

const pulito = (valore) => String(valore ?? "").trim();

/** Senza accenti e senza maiuscole: «Città» e «citta» sono la stessa parola. */
export const appiattisci = (valore) =>
  pulito(valore)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/* La scheda del config che tiene ogni famiglia di slot del guscio.
 *
 * È l'ordine delle fisarmoniche che `editorRenderSezioni` apre una per
 * scheda: la prima è Home in «sez0», la seconda sarebbe Energia, e così via.
 * Le due assenze sono quelle spiegate in testa al file. */
const SCHEDA_DELLA_FAMIGLIA = Object.freeze({
  "dm.home_": "sez0",
  "dm.ev_": "sez2",
  "dm.boiler_": "sez3",
  "dm.security_": "sez4",
  "dm.server_": "sez6",
});

/* Le cinque del raffreddamento, che nessuno espone.
 *
 * L'ordine e i nomi sono quelli della carta «🌡️ Temperature e
 * raffreddamento», dentro le IMPOSTAZIONI di Energia. */
/* Esportata perche' e' una tabella bilingue, e il corpus delle lingue si fa
 * leggendo le tabelle bilingui: tenerla in casa vorrebbe dire cinque nomi che
 * in tedesco restano in italiano senza che nessuno se ne accorga. */
export const IL_RAFFREDDAMENTO = Object.freeze({
  inverter_ac_temperature: ["Temperatura inverter AC", "Inverter AC temperature"],
  inverter_dc_temperature: ["Temperatura inverter DC", "Inverter DC temperature"],
  battery_temperature: ["Temperatura batteria", "Battery temperature"],
  fan_power: ["Potenza ventola", "Fan power"],
  fan_switch: ["Interruttore ventola", "Fan switch"],
});

/* Le caselle sono quelle di `COOLING_SLOT_MAP`, non queste: quella mappa e' il
 * modello, questa e' solo la tabella dei nomi. Una casella senza nome non si
 * inventa un nome — resta fuori, e la prova lo grida. */
const raffreddamento = () =>
  Object.keys(COOLING_SLOT_MAP)
    .map((percorso) => percorso.slice(percorso.indexOf(".") + 1))
    .filter((chiave) => IL_RAFFREDDAMENTO[chiave])
    .map((chiave) => [chiave, ...IL_RAFFREDDAMENTO[chiave]]);

const RAFFREDDAMENTO = Object.freeze({
  it: "Temperature e raffreddamento",
  en: "Temperatures & cooling",
});

const FLUSSI = Object.freeze({ it: "Flussi ed entità", en: "Flows & entities" });

/**
 * Una casella: `{ id, it, en, scheda, pannello, dove }`.
 *
 * `id` è la stessa firma che porterebbe un risultato trovato fra i valori —
 * `cooling.fan_switch`, `dm.home_meteo` — così chi disegna sa riconoscere una
 * casella già piena e non la dice due volte. `dove` è il riquadro che la
 * contiene, da mostrare come strada.
 */
const casella = (id, it, en, scheda, pannello, dove) =>
  Object.freeze({ id, it, en, scheda, pannello, dove });

/** Le caselle dell'editor nuovo di Energia: Flussi e raffreddamento. */
export function leCaselleDellEnergia(gruppi = ENERGY_GROUPS) {
  const fuori = [];
  const viste = new Set();
  for (const [gruppo, titolo, campi] of Array.isArray(gruppi) ? gruppi : []) {
    for (const [chiave, etichetta] of Array.isArray(campi) ? campi : []) {
      const id = `${gruppo}.${chiave}`;
      /* La stessa casella compare in due riquadri — la potenza di rete sta
       * sotto prelievo e sotto immissione — ma il modello ne ha una sola, e
       * chi cerca la deve trovare una volta. */
      if (viste.has(id)) continue;
      viste.add(id);
      fuori.push(casella(id, etichetta, etichetta, "sez1", "flows", `${FLUSSI.it} · ${titolo}`));
    }
  }
  for (const [chiave, it, en] of raffreddamento())
    fuori.push(casella(`cooling.${chiave}`, it, en, "sez1", "settings", RAFFREDDAMENTO.it));
  return fuori;
}

/**
 * Le caselle del guscio storico, come il guscio stesso le disegna.
 *
 * `raccolte` sono `{ ref, nome, dove }` mietute dal guscio: `CD_SLOTS` e' un
 * `const` dentro il suo copione e da fuori non si vede, ma
 * `editorRenderSezioni()` sta su `globalThis` e torna il disegno di tutte le
 * fisarmoniche in una volta — con le etichette che la persona si e'
 * eventualmente rinominata, che una copia qui dentro non avrebbe mai.
 *
 * Il nome esce nella sua lingua sola: le etichette del guscio sono in
 * italiano e basta, e tradurle a mano vorrebbe dire mantenerne due.
 */
export function leCaselleDelGuscio(raccolte = []) {
  const fuori = [];
  for (const raccolta of Array.isArray(raccolte) ? raccolte : []) {
    const ref = pulito(raccolta?.ref);
    const nome = pulito(raccolta?.nome);
    if (!ref || !nome || isRetiredEditorSlot(ref)) continue;
    const scheda = Object.entries(SCHEDA_DELLA_FAMIGLIA).find(([inizio]) =>
      ref.startsWith(inizio),
    )?.[1];
    if (!scheda) continue;
    fuori.push(casella(ref, nome, nome, scheda, "", pulito(raccolta?.dove)));
  }
  return fuori;
}

/** Tutte insieme, senza ripetizioni: la prima che nomina un `id` se lo tiene. */
export function leCaselleDelConfig(raccolte = [], gruppi = ENERGY_GROUPS) {
  const viste = new Set();
  return [...leCaselleDellEnergia(gruppi), ...leCaselleDelGuscio(raccolte)].filter((una) => {
    if (viste.has(una.id)) return false;
    viste.add(una.id);
    return true;
  });
}

/**
 * Le caselle che si chiamano così.
 *
 * Le stesse regole della ricerca fra i valori: sotto le due lettere non si
 * cerca, gli accenti non contano, e chi combacia dall'inizio esce prima —
 * perché chi scrive «ventola» cerca «Ventola», non «Potenza ventola».
 */
export function cercaFraLeCaselle(parola, caselle = [], lingua = "it") {
  const ago = appiattisci(parola);
  if (ago.length < 2) return [];
  const quale = lingua === "en" ? "en" : "it";
  return caselle
    .map((una) => {
      /* Si cerca nel nome nella lingua di chi guarda, nell'altro nome e nel
       * riquadro: «raffreddamento» è il nome della carta, non di una casella,
       * ed è quello che uno si ricorda. */
      const dove = [una[quale], una.it, una.en, una.dove].map(appiattisci);
      const primo = dove.findIndex((testo) => testo.includes(ago));
      if (primo < 0) return null;
      const daCapo = dove.some((testo) => testo.startsWith(ago));
      return { casella: una, peso: (daCapo ? 0 : 10) + primo };
    })
    .filter(Boolean)
    .sort((uno, altro) => uno.peso - altro.peso)
    .map((uno) => uno.casella);
}
