/* Le modalita' di ricarica di evcc, lette da evcc invece che scritte a mano.
 *
 * «Ha cambiato la funzionalità sulle modalità di ricarica: ora si chiama
 * intelligente e poi ha messo always.»
 *
 * evcc ha rifatto le modalita' (evcc-io/evcc#32490). Erano quattro e adesso
 * sono tre:
 *
 *   · `pv` si chiama `smart`. Non e' solo un nome nuovo: quella modalita' oggi
 *     copre anche chi il fotovoltaico non ce l'ha e usa evcc per le tariffe
 *     orarie, e «solare» non lo diceva piu';
 *   · `minpv` non c'e' piu'. Quello che faceva — non fermarsi mai, tenere
 *     almeno il minimo anche oltre il surplus — e' diventato **«always»**, che
 *     NON e' una quarta modalita': e' un'opzione che si affianca a `smart`, con
 *     tre stati suoi (off, on, once), su un'altra entita'. «Da sola usa solo
 *     surplus; con always si mantiene sempre un minimo al di la' del surplus.»
 *
 * ── Perche' i tasti erano rimasti spenti ─────────────────────────────────
 *
 * Il guscio accendeva il tasto cercando `m-btn-<stato>`. evcc ha cominciato a
 * rispondere `smart`, `m-btn-smart` non esiste, e da quel momento non si e'
 * acceso piu' niente. Il comando invece partiva davvero — evcc accetta ancora
 * `pv` e `minpv` come scritture deprecate — quindi da fuori si vedeva la cosa
 * peggiore: un tasto che fa quello che deve e sembra rotto.
 *
 * ── La regola, adesso ────────────────────────────────────────────────────
 *
 * I tasti sono quelli che l'entita' DICHIARA nelle sue `options`, non quattro
 * scritti a mano. E' la stessa regola dei comandi di un lettore (#132) — si
 * disegna solo quello che il dispositivo sa eseguire davvero — e vale anche al
 * contrario: quando evcc cambiera' di nuovo i nomi, qui non si rompe niente,
 * perche' i nomi non stanno qui.
 *
 * Chi non dichiara le `options` — un evcc vecchio, un template fatto a mano —
 * si tiene i quattro di prima: senza saperne abbastanza non si toglie niente a
 * nessuno.
 *
 * Nessun DOM e nessuna chiamata: entra lo stato dell'entita', escono i tasti da
 * disegnare e quale accendere.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* Le modalita' che sappiamo chiamare per nome, con le loro parole e il loro
 * colore. Chi non e' in questa tabella si disegna lo stesso, col nome che ha:
 * un tasto che non sappiamo battezzare e' meglio di una modalita' che evcc
 * offre e noi nascondiamo. */
const RAPIDA = Object.freeze({
  /* «Fast» e non «Subito»: e' la parola che l'integrazione scrive nella tendina
   * di Home Assistant, e chiamarla in due modi vuol dire due modalita' per chi
   * legge. Il nome nell'API e' `now`, quello mostrato e' `fast`: sono la stessa,
   * e stanno qui tutte e due perche' quale delle due arrivi lo decide
   * l'integrazione, non noi. */
  it: "Fast",
  en: "Fast",
  icona: "🚀",
  colore: "#0284c7",
  sfondo: "#f0f9ff",
});
const SOLE = Object.freeze({ icona: "☀️", colore: "#059669", sfondo: "#f0fdf4" });

const MODI = Object.freeze({
  off: { it: "Spento", en: "Off", icona: "🛑", colore: "#e11d48", sfondo: "#fff1f2" },
  pv: { it: "Solar", en: "Solar", ...SOLE },
  smart: { it: "Intelligente", en: "Smart", ...SOLE },
  minpv: { it: "Min+Sol", en: "Min+Sol", icona: "⛅", colore: "#d97706", sfondo: "#fffbeb" },
  now: RAPIDA,
  fast: RAPIDA,
});

/** Le quattro di sempre: il ripiego di chi non dichiara cosa sa fare. */
export const MODI_STORICI = Object.freeze(["off", "pv", "minpv", "now"]);

/* `pv` e `smart` sono la stessa cosa, e vanno sullo stesso tasto.
 *
 * Serve durante il passaggio, ed e' l'unico punto in cui i due nomi si
 * incontrano: un guscio che ha ancora il tasto `pv` disegnato e un evcc che
 * risponde `smart` devono capirsi, o resta spento come prima. */
const LO_STESSO = Object.freeze({ pv: "smart", smart: "pv" });

const sonoLoStesso = (uno, altro) => uno === altro || LO_STESSO[uno] === altro;

/** Le modalita' che questo evcc offre davvero, in ordine, pronte da disegnare. */
export function iModiDiEvcc(stato) {
  const dichiarate = stato?.attributes?.options;
  const elenco = (Array.isArray(dichiarate) ? dichiarate : [])
    .map(pulito)
    .filter(Boolean)
    .filter((voce, indice, tutte) => tutte.indexOf(voce) === indice);
  const quali = elenco.length ? elenco : MODI_STORICI;
  return quali.map((id) => {
    /* Le maiuscole non contano. L'integrazione evcc di casa scrive «Off»,
     * «Smart» e «Fast» con l'iniziale grande, e una tabella che guarda solo le
     * minuscole non avrebbe riconosciuto nessuna delle tre: tre tasti grigi col
     * nome inglese, invece di tre tasti veri. L'`id` resta pero' quello che
     * l'entita' ha scritto — e' quello che si rimanda indietro col comando, e li'
     * una maiuscola sbagliata e' un'opzione che non esiste. */
    const noto = MODI[id.toLowerCase()];
    return {
      id,
      it: noto?.it || id,
      en: noto?.en || id,
      icona: noto?.icona || "⚡",
      colore: noto?.colore || "#64748b",
      sfondo: noto?.sfondo || "#f1f5f9",
      /* Vero quando il nome non lo conosciamo: chi disegna puo' decidere di
       * scriverlo com'e' invece di fingere di saperlo tradurre. */
      ignoto: !noto,
    };
  });
}

/**
 * Quale tasto accendere, fra quelli disegnati.
 *
 * Torna `""` quando non si sa: un'entita' muta, uno stato che nessun tasto
 * rappresenta. Accendere quello sbagliato direbbe che la macchina sta
 * caricando in un modo in cui non sta caricando.
 */
export function ilModoAcceso(stato, disegnati = iModiDiEvcc(stato)) {
  const adesso = pulito(stato?.state).toLowerCase();
  if (!adesso || adesso === "unavailable" || adesso === "unknown" || adesso === "—") return "";
  const esatto = disegnati.find((modo) => modo.id.toLowerCase() === adesso);
  if (esatto) return esatto.id;
  const equivalente = disegnati.find((modo) => sonoLoStesso(modo.id.toLowerCase(), adesso));
  return equivalente?.id || "";
}

/**
 * Se questa modalita' e' quella che lavora col surplus — cioe' quella a cui
 * l'opzione «always» si affianca.
 *
 * Gli altri due modi non la vogliono: da spenti non si carica, e «subito» carica
 * al massimo comunque. Chi disegna l'opzione la mostra solo qui.
 */
export function eIlModoIntelligente(id) {
  const quale = pulito(id).toLowerCase();
  return quale === "smart" || quale === "pv";
}

/* ── «Always charge»: l'opzione che si affianca a smart ─────────────────────
 *
 * «Da sola usa solo surplus; con always si mantiene sempre un minimo al di la'
 * del surplus.»
 *
 * Non e' una quarta modalita' ed e' importante che non lo diventi: e'
 * un'entita' a parte — nella casa di chi l'ha chiesta
 * `select.evcc_lektrico_always_charge` — con tre stati, Off, On e Once. Disegnarla
 * in fila coi modi vorrebbe dire far credere che scegliendo lei si esce da
 * smart, e invece ci si resta dentro.
 *
 * Le parole sono nostre perche' «Off/On/Once» non dice cosa fa: «Mai», «Sempre»
 * e «Stavolta» si leggono senza sapere cos'e' evcc. Ma valgono solo per i tre
 * nomi che conosciamo: se quell'entita' un giorno ne offre un quarto, si mostra
 * col nome che ha, come per i modi.
 */

const IL_SEMPRE = Object.freeze({
  off: { it: "Mai", en: "Never" },
  on: { it: "Sempre", en: "Always" },
  once: { it: "Stavolta", en: "This time" },
});

/** Le scelte che l'entita' del «sempre» offre, pronte da disegnare. */
export function iValoriDelSempre(stato) {
  const dichiarate = stato?.attributes?.options;
  const elenco = (Array.isArray(dichiarate) ? dichiarate : [])
    .map(pulito)
    .filter(Boolean)
    .filter((voce, indice, tutte) => tutte.indexOf(voce) === indice);
  return elenco.map((id) => {
    const noto = IL_SEMPRE[id.toLowerCase()];
    return { id, it: noto?.it || id, en: noto?.en || id, ignoto: !noto };
  });
}

/** Quale delle tre e' scelta adesso, `""` se non si sa. */
export function ilValoreDelSempreAcceso(stato, disegnati = iValoriDelSempre(stato)) {
  const adesso = pulito(stato?.state).toLowerCase();
  if (!adesso || adesso === "unavailable" || adesso === "unknown" || adesso === "—") return "";
  return disegnati.find((voce) => voce.id.toLowerCase() === adesso)?.id || "";
}

/**
 * Se la fila del «sempre» ha senso adesso.
 *
 * Vuole due cose insieme: che l'entita' ci sia e dichiari le sue scelte, e che
 * la modalita' accesa sia quella intelligente. Da spenti non si carica, e in
 * «Fast» si carica al massimo comunque: li' quell'opzione non cambia niente, e
 * una fila che non cambia niente e' una fila che confonde.
 */
export function laFilaDelSempreServe(statoDelSempre, modoAcceso) {
  return iValoriDelSempre(statoDelSempre).length > 0 && eIlModoIntelligente(modoAcceso);
}
