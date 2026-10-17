/* I gruppi di continuita', per la notifica del blackout.
 *
 * «Sarebbe carino aggiungere dalle entità degli UPS la notifica dei
 * blackout.» Chi ha configurato l'UPS nella plancia (`cd_ups`, #256) l'ha gia'
 * detto dove guardare: si legge come lo legge la sua tessera
 * (`plancia/src/core/ups-model.js`), con la stessa regola delle sigle di NUT.
 * Chi non l'ha configurato ce l'ha lo stesso in Home Assistant, e le
 * integrazioni che lo portano — NUT e apcupsd — scrivono le entita' sempre
 * allo stesso modo: si trovano da sole.
 *
 *  - NUT: `sensor.<ups>_status_data` («OL», «OB DISCHRG») o `sensor.<ups>_status`
 *    («Online», «On Battery»), la carica in `_battery_charge`, l'autonomia in
 *    `_battery_runtime` (secondi), il carico in `_load` (%) e la potenza in
 *    `_realpower` / `_ups_realpower`.
 *  - apcupsd: `sensor.<ups>_status` («ONLINE», «ONBATT»), `_battery`,
 *    `_time_left` (minuti), `_load`, e il `binary_sensor.<ups>_online`.
 *
 * Il modulo e' puro: riceve gli stati e dice cosa vede.
 */

import {
  autonomiaInMinuti,
  batteriaScaricaDalloStato,
  elencoUps,
  letturaUps,
  reteDalloStato,
} from "../plancia/src/core/ups-model.js";

const numero = (valore) => {
  const n = Number(String(valore ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/* La rete da una sigla o da una frase. «Online Battery Charging» (la frase di
 * NUT mentre ricarica) contiene «battery» ma e' in linea: chi dice «online»
 * o «OL» e' in linea, il resto lo decide la regola della tessera. */
export function reteDi(stato) {
  const pezzi = String(stato ?? "")
    .toLowerCase()
    .split(/[\s,|/]+/)
    .filter(Boolean);
  if (pezzi.includes("ol") || pezzi.includes("online")) return true;
  return reteDalloStato(stato);
}

/* Se uno stato e' davvero quello di un UPS: una sigla o una frase che solo un
 * UPS scrive. Un `sensor.stampante_status` che dice «on» non e' un UPS, e
 * prenderlo per tale vorrebbe dire un blackout ogni volta che si spegne. */
export function eUnaSiglaDiUps(stato) {
  const testo = String(stato ?? "").toLowerCase();
  if (/\bon ?battery\b/.test(testo)) return true;
  const pezzi = testo.split(/[\s,|/]+/).filter(Boolean);
  return pezzi.some((p) => ["ol", "ob", "online", "onbatt", "lb", "chrg", "dischrg"].includes(p));
}

/* Le parole che chiudono il nome di un'entita' dello stato di un UPS. */
const FINE_DELLO_STATO = /_(ups_)?status(_data)?$/;

/**
 * I gruppi trovati da soli: uno per ogni `sensor.*_status` / `_status_data`
 * che dice una sigla di rete, piu' i `binary_sensor.*_online` di apcupsd. La
 * chiave e' il prefisso comune: `sensor.ups_salotto_status` → `ups_salotto`.
 */
export function upsTrovati(stati) {
  const gruppi = new Map();
  for (const [id, stato] of stati) {
    const [dominio, nome = ""] = id.split(".");
    if (dominio === "sensor" && FINE_DELLO_STATO.test(nome)) {
      if (!eUnaSiglaDiUps(stato?.state)) continue;
      const base = nome.replace(FINE_DELLO_STATO, "");
      const gruppo = gruppi.get(base) ?? { base };
      /* La sigla di NUT dice di piu' della frase: vince quella. */
      if (/_status_data$/.test(nome) || !gruppo.stato) gruppo.stato = id;
      gruppi.set(base, gruppo);
    } else if (dominio === "binary_sensor" && /_online$/.test(nome) && /ups|apc/i.test(nome)) {
      const base = nome.replace(/_online$/, "");
      const gruppo = gruppi.get(base) ?? { base };
      gruppo.online = id;
      gruppi.set(base, gruppo);
    }
  }
  return [...gruppi.values()];
}

function primoCheC(stati, ...ids) {
  for (const id of ids) if (stati.has(id)) return id;
  return null;
}

/** La lettura di un gruppo trovato da solo, nella forma di `letturaUps`. */
export function letturaTrovata(gruppo, stati) {
  const s = (id) => (id ? stati.get(id) : null);
  const b = gruppo.base;
  const statoId = gruppo.stato;
  let rete = statoId ? reteDi(s(statoId)?.state) : null;
  if (rete === null && gruppo.online) rete = reteDalloStato(s(gruppo.online)?.state);
  const caricaId = primoCheC(stati, `sensor.${b}_battery_charge`, `sensor.${b}_battery`);
  const autonomiaId = primoCheC(stati, `sensor.${b}_battery_runtime`, `sensor.${b}_time_left`);
  const potenzaId = primoCheC(
    stati,
    `sensor.${b}_realpower`,
    `sensor.${b}_ups_realpower`,
    `sensor.${b}_power`,
  );
  const caricoId = primoCheC(stati, `sensor.${b}_load`, `sensor.${b}_ups_load`);
  let autonomia = autonomiaId ? autonomiaInMinuti(s(autonomiaId)) : null;
  /* NUT dice l'autonomia in secondi anche quando non lo dichiara. */
  if (autonomiaId?.endsWith("_battery_runtime") && !s(autonomiaId)?.attributes?.unit_of_measurement)
    autonomia = numero(s(autonomiaId)?.state) !== null ? numero(s(autonomiaId).state) / 60 : null;
  const batteria = caricaId ? numero(s(caricaId)?.state) : null;
  return {
    chiave: `auto:${b}`,
    entita: statoId || gruppo.online,
    name: String(
      s(statoId)?.attributes?.friendly_name || s(gruppo.online)?.attributes?.friendly_name || b,
    )
      .replace(/\s*(status( data)?|stato|online)\s*$/i, "")
      .trim()
      .slice(0, 40),
    rete,
    batteria,
    autonomia: autonomia === null ? null : Math.round(autonomia),
    potenza: potenzaId ? numero(s(potenzaId)?.state) : null,
    carico: caricoId ? numero(s(caricoId)?.state) : null,
    scarica: statoId ? batteriaScaricaDalloStato(s(statoId)?.state) : false,
  };
}

/**
 * Tutti gli UPS della casa, letti adesso: prima quelli configurati nella
 * plancia, poi quelli trovati da soli che non sono gia' fra quelli.
 *
 * `valori`: la configurazione della plancia principale; `risolvi`: casella →
 * entita'.
 */
export function gliUps(stati, valori = {}, risolvi = (v) => v) {
  const comeOggetto = new Proxy(
    {},
    {
      get(_t, id) {
        const st = stati.get(String(id));
        return st ? { ...st, last_changed: new Date(st.dal).toISOString() } : undefined;
      },
    },
  );
  let configurati = [];
  try {
    let grezzo = valori?.cd_ups;
    if (typeof grezzo === "string") grezzo = JSON.parse(grezzo);
    configurati = elencoUps(grezzo);
  } catch (_errore) {
    configurati = [];
  }
  const fuori = [];
  const usate = new Set();
  for (const config of configurati) {
    const l = letturaUps(config, comeOggetto, risolvi);
    const entita = risolvi(config.rete) || config.rete || risolvi(config.stato) || config.stato;
    for (const campo of ["stato", "rete", "batteria", "autonomia"])
      if (config[campo]) usate.add(risolvi(config[campo]) || config[campo]);
    fuori.push({
      chiave: `cfg:${config.uid}`,
      entita,
      name: l.name || "UPS",
      rete: l.rete,
      batteria: l.batteria,
      autonomia: l.autonomia === null ? null : Math.round(l.autonomia),
      potenza: l.potenza,
      carico: l.carico,
      scarica: l.scarica,
    });
  }
  for (const gruppo of upsTrovati(stati)) {
    if ((gruppo.stato && usate.has(gruppo.stato)) || (gruppo.online && usate.has(gruppo.online)))
      continue;
    fuori.push(letturaTrovata(gruppo, stati));
  }
  return fuori;
}
