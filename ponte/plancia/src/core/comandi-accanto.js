/* I comandi che stanno accanto a un dispositivo.
 *
 * Un robot che lava non e' solo un `vacuum`, e una TV non e' solo un
 * `media_player`: l'integrazione pubblica accanto a loro i programmi come
 * tasti, le regolazioni come tendine, le funzioni come interruttori. Sono
 * entita' a parte, e una scheda che guarda solo l'entita' principale non le
 * vede.
 *
 * Queste regole sono nate dentro il modello del robot — «le varie entita' del
 * robot continuano a non essere visibili» (#306) — e da li' se le prendevano
 * gia' gli elettrodomestici, con un commento che diceva «sono nate li' perche'
 * li' e' arrivata la domanda per prima; sono le stesse». Quando la stessa
 * domanda e' arrivata per la terza volta, dalle TV (#451), tenerle di la'
 * voleva dire un lettore che importa dal robot. Stanno qui, dove le tre
 * sezioni le vedono senza sapere niente l'una dell'altra.
 *
 * Il modulo e' puro: non parla con Home Assistant e non tocca il DOM.
 */

import { nomeAccantoAlDispositivo } from "./nome-accanto-al-dispositivo.js";

const clean = (value) => String(value ?? "").trim();

export const DOMINI_COMANDO = Object.freeze({
  button: "tasto",
  input_button: "tasto",
  script: "tasto",
  scene: "tasto",
  /* Un apparecchio comandato a automazioni e' un apparecchio come gli altri.
   *
   * Non tutti pubblicano dei «button»: chi ha un robot che Home Assistant non
   * integra a fondo si scrive le automazioni — Pulizia, Pausa, Dock, Pulizia
   * programmata — ed e' quello il suo cruscotto. Lasciarle fuori voleva dire
   * far nascere quel robot dall'integrazione con la riga dei comandi vuota. */
  automation: "tasto",
  switch: "interruttore",
  input_boolean: "interruttore",
  select: "tendina",
  input_select: "tendina",
});

/* Dodici: una scheda e' una scheda, non la pagina delle impostazioni. */
export const COMANDI_MASSIMI = 12;

/** Che genere di comando e' quell'entita': tasto, tendina, interruttore — o niente. */
export function genereDelComando(entity) {
  return DOMINI_COMANDO[clean(entity).split(".")[0]] || "";
}

/** L'elenco pulito: solo entita' comandabili, una volta sola, non piu' di dodici. */
export function elencoComandi(input) {
  const grezzi = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[\s,;]+/)
      : [];
  const visti = new Set();
  const fuori = [];
  for (const voce of grezzi) {
    const entity = clean(voce && typeof voce === "object" ? voce.entity : voce);
    if (!entity || !genereDelComando(entity) || visti.has(entity)) continue;
    visti.add(entity);
    fuori.push(entity);
    if (fuori.length >= COMANDI_MASSIMI) break;
  }
  return fuori;
}

/** I comandi di un dispositivo come stanno adesso: nome, genere, stato, opzioni. */
export function comandiDelDispositivo(dispositivo = {}, states = {}) {
  return elencoComandi(dispositivo?.comandi).map((entity) => {
    const genere = genereDelComando(entity);
    const corrente = states?.[entity];
    const attributi = corrente?.attributes || {};
    const stato = clean(corrente?.state).toLowerCase();
    return {
      entity,
      genere,
      name: nomeAccantoAlDispositivo(entity, dispositivo, states),
      /* Un tasto mai premuto sta su «unknown», ed e' un tasto che funziona:
       * non raggiungibile e' solo chi lo dice. */
      available: Boolean(corrente) && stato !== "unavailable",
      acceso: genere === "interruttore" ? stato === "on" : null,
      opzioni:
        genere === "tendina" && Array.isArray(attributi.options)
          ? attributi.options.map(clean).filter(Boolean)
          : [],
      scelta: genere === "tendina" ? clean(corrente?.state) : "",
    };
  });
}

/**
 * Il servizio dietro un comando.
 *
 * Un tasto si preme, uno script e una scena si accendono, un'automazione si fa
 * partire, un interruttore si inverte, una tendina sceglie: cinque verbi per
 * nove domini, e nessun servizio inventato — sono quelli che Home Assistant ha
 * per quelle entita'.
 */
export function comandoDelDispositivo(voce = {}, valore = "") {
  const entity = clean(voce?.entity);
  const dominio = entity.split(".")[0];
  const genere = genereDelComando(entity);
  if (!genere) return null;
  if (genere === "tendina") {
    const opzione = clean(valore);
    if (!opzione) return null;
    return {
      domain: dominio,
      service: "select_option",
      data: { entity_id: entity, option: opzione },
    };
  }
  if (genere === "interruttore")
    return { domain: dominio, service: "toggle", data: { entity_id: entity } };
  if (dominio === "button" || dominio === "input_button")
    return { domain: dominio, service: "press", data: { entity_id: entity } };
  /* Un'automazione si fa PARTIRE, non si accende: «automation.turn_on» la
   * riabilita e basta — l'apparecchio non si muove, e chi tocca il tasto ha appena
   * cambiato di nascosto un'impostazione di Home Assistant. Il verbo giusto e'
   * «trigger», ed e' l'unico che fa quello che il tasto promette. */
  if (dominio === "automation")
    return { domain: dominio, service: "trigger", data: { entity_id: entity } };
  return { domain: dominio, service: "turn_on", data: { entity_id: entity } };
}

/* I domini con DUE gesti, non uno.
 *
 * «I tasti on/off in automazioni non funzionano» (#552). Il comando era
 * disegnato come una levetta — con tanto di stato acceso e spento — e al tocco
 * faceva PARTIRE l'automazione: la levetta scattava e tornava indietro, e
 * sembrava che non succedesse niente.
 *
 * Chiesto a chi ha segnalato quale dei due volesse, la risposta e' stata
 * «abilitarla o disabilitarla, perche' a volte le attivo io e a volte si
 * attivano da sole quando inserisco l'allarme». Sono due gesti diversi e
 * legittimi tutti e due, e un'automazione e' l'unica entita' che li ha
 * entrambi: si fa partire adesso, e si abilita o si disabilita — che e' quello
 * che Home Assistant mostra come suo stato.
 *
 * Quindi non si sceglie: si danno tutti e due. Il tasto la fa partire, e il
 * verbo e' quello di `comandoDelDispositivo`; la levetta la abilita, ed e'
 * questo. Fuori dalle automazioni una levetta non ha un secondo verbo, e qui
 * non risponde niente: chi disegna ne disegna una sola. */
const SI_ABILITANO = Object.freeze(new Set(["automation"]));

/** Se quell'entita', oltre a farsi partire, si puo' anche abilitare. */
export function siPuoAbilitare(entity) {
  return SI_ABILITANO.has(clean(entity).split(".")[0]);
}

/**
 * Se quell'entita' si comanda scegliendo, invece che accendendo o premendo.
 *
 * E' un `select` o un `input_select`: la sorgente dell'ampli, il programma
 * della lavatrice, la modalita' della casa. La domanda e' una riga, ma la
 * facevano gia' in tre posti diversi — le azioni rapide, le stanze, le sezioni
 * proprie — e tre copie della stessa riga diventano tre risposte diverse il
 * giorno che nasce un dominio nuovo. La tabella dei generi e' qui sopra, e la
 * risposta la da' lei.
 *
 * Si guarda il dominio e basta: se quel menu le sue voci le dica davvero e'
 * un'altra domanda, e la fa `vociDelMenu` a chi gli stati ce li ha in mano.
 */
export function siPuoScegliere(entity) {
  return genereDelComando(entity) === "tendina";
}

/**
 * Il servizio dietro la LEVETTA di un'entita': abilitare e disabilitare.
 *
 * `null` per tutte quelle che una levetta propria non ce l'hanno — la loro
 * levetta e' il comando di sempre, e il verbo lo dice `comandoDelDispositivo`.
 */
export function comandoCheAbilita(voce = {}) {
  const entity = clean(voce?.entity);
  if (!siPuoAbilitare(entity)) return null;
  return { domain: entity.split(".")[0], service: "toggle", data: { entity_id: entity } };
}

/* I comandi che stanno accanto a quel dispositivo, da proporre a chi configura.
 *
 * Le entita' di uno stesso dispositivo si riconoscono da come Home Assistant
 * le chiama: l'id comincia con l'id di quella principale —
 * `vacuum.roborock_qrevo` e `button.roborock_qrevo_asp_e_lav` — oppure il nome
 * comincia col suo nome. Sono proposte, non scelte: un robot pubblica anche i
 * tasti che azzerano i contatori dei filtri, e nessuno li vuole sotto il
 * pollice senza averlo detto. Chi configura li vede in scheda e tocca quelli
 * che vuole. */
export function comandiVicini(dispositivo = {}, states = {}) {
  const entity = clean(dispositivo?.entity);
  const radice = entity.split(".")[1] || "";
  if (!radice) return [];
  const nome = clean(states?.[entity]?.attributes?.friendly_name).toLowerCase();
  const gia = new Set(elencoComandi(dispositivo?.comandi));
  const trovati = [];
  for (const [id, corrente] of Object.entries(states || {})) {
    if (gia.has(id) || !genereDelComando(id)) continue;
    const oggetto = id.split(".")[1] || "";
    const stessoId = oggetto.startsWith(`${radice}_`);
    const suoNome = clean(corrente?.attributes?.friendly_name).toLowerCase();
    const stessoNome = Boolean(nome) && suoNome.startsWith(`${nome} `);
    if (stessoId || stessoNome) trovati.push(id);
  }
  const ordine = { tasto: 0, tendina: 1, interruttore: 2 };
  return trovati.sort(
    (a, b) => ordine[genereDelComando(a)] - ordine[genereDelComando(b)] || a.localeCompare(b),
  );
}
