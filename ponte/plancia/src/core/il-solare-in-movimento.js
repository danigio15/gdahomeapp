/* Il solare termico in movimento: quanto corre, quanto scalda.
 *
 * «Il solare termico e' statico.» La scena si muove con le classi che il
 * runtime gia' scrive — la pompa accesa, i tubi attivi, la chiave aperta — e
 * con tre numeri che vengono da qui, dalle letture vere e non dai testi a
 * schermo:
 *
 *   --dmx-cycle   quanto dura un passo dell'acqua nei tubi: piu' grande e' il
 *                 ΔT fra pannello e accumulo, piu' corre (sei passi, da 4 s a
 *                 0,67 s, tutti divisori di 4 s, cosi' ogni movimento torna
 *                 al suo inizio insieme agli altri);
 *   --dmx-rotor   il giro della girante della pompa, due volte il passo;
 *   --dmx-heat    da 0 a 1, quanto e' caldo il pannello (30 °C → 0, 90 °C → 1):
 *                 il bagliore del vetro;
 *   boiler        «on» quando la resistenza del boiler tira potenza: il vapore
 *                 sopra l'accumulo, la goccia al rubinetto, la resistenza che
 *                 si accende.
 *
 * Il modulo e' puro.
 */

const PERIODO = 4;
const PASSI = 6;

const numero = (valore) => {
  if (valore === null || valore === undefined || String(valore).trim() === "") return null;
  const n = Number(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Quanti passi per periodo: 1 a ΔT nullo, uno in piu' ogni 6 °C, fino a 6. */
export function passiDelFlusso(delta) {
  const d = numero(delta);
  return Math.max(1, Math.min(PASSI, 1 + Math.round(Math.max(0, d ?? 0) / 6)));
}

/** Da 0 a 1, quanto e' caldo il pannello. */
export function caloreDelPannello(gradi) {
  const g = numero(gradi);
  if (g === null) return 0;
  return Math.max(0, Math.min(1, (g - 30) / 60));
}

/**
 * I valori del movimento, da `{ delta, pannello, potenza }`.
 * Torna le tre variabili gia' scritte come le vuole il foglio di stile, e il
 * boiler acceso o no.
 */
export function ilMotoDelSolare({ delta, pannello, potenza } = {}) {
  const n = passiDelFlusso(delta);
  const w = numero(potenza);
  return {
    ciclo: `${(PERIODO / n).toFixed(4)}s`,
    rotore: `${(PERIODO / (n * 2)).toFixed(4)}s`,
    calore: caloreDelPannello(pannello).toFixed(3),
    boiler: w !== null && w > 0 ? "on" : "off",
  };
}

/* Le entita' della pagina, con i nomi del mappatore. */
export const RIFERIMENTI_DEL_MOTO = Object.freeze({
  delta: "dm.boiler_delta_temperatura",
  pannello: "dm.boiler_sonda_temperatura_1",
  potenza: "dm.boiler_potenza_resistenza_boiler",
});

/**
 * Le letture vere per il movimento: dagli stati, attraverso il mappatore.
 * La potenza in kW diventa W; uno stato che non c'e' o non e' un numero non
 * conta.
 */
export function lettureDelMoto(states = {}, risolvi = (rif) => rif) {
  const fuori = {};
  for (const [chiave, rif] of Object.entries(RIFERIMENTI_DEL_MOTO)) {
    let entita = "";
    try {
      entita = String(risolvi(rif) || "");
    } catch (_errore) {
      entita = "";
    }
    const stato = entita && entita !== rif ? states?.[entita] : null;
    let valore = numero(stato?.state);
    const unita = String(stato?.attributes?.unit_of_measurement || "").toLowerCase();
    if (valore !== null && chiave === "potenza" && unita === "kw") valore *= 1000;
    fuori[chiave] = valore;
  }
  return fuori;
}
