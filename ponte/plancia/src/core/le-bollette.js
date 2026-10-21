/* Le bollette vere (#295).
 *
 * «E' possibile creare una nuova scheda che riporta i dati reali delle
 * bollette arrivate.» Le integrazioni dei fornitori — EON Energia Italia, per
 * esempio — portano in Home Assistant l'ultima bolletta, il totale fatturato,
 * quanto resta da pagare, lo stato del pagamento, la potenza impegnata e la
 * scadenza dell'offerta. Qui c'e' solo come si leggono: quali sensori sono
 * quali, e cosa dicono. Il disegno lo fa `la-bolletta-section.js`.
 *
 * I sensori si trovano da soli dai loro nomi, in italiano e in inglese; chi
 * vuole sceglierli lo fa nelle impostazioni dell'Energia, e la scelta vince.
 */

const clean = (valore) => String(valore ?? "").trim();

/** Dove si scrive la scelta dei sensori: `{ voci: { ultima: "sensor.x", … } }`. */
export const CHIAVE_BOLLETTE = "cd_bollette";

/* Le voci della bolletta, e come si riconoscono dall'entity_id o dal nome.
 * L'ordine e' quello in cui si cercano: «unpaid invoices» va trovato prima di
 * «invoices», e la data della scadenza prima di qualunque «offerta». */
export const VOCI_DELLA_BOLLETTA = Object.freeze([
  Object.freeze({
    chiave: "daPagare",
    tipo: "euro",
    cerca: /unpaid_invoice|unpaid_bill|da_pagare|insolut|non_pagat|amount_due|importo_dovuto/,
  }),
  Object.freeze({
    chiave: "stato",
    tipo: "testo",
    cerca: /payment_status|stato_(del_)?pagamento|stato_(bolletta|fattura)|bill_status/,
  }),
  Object.freeze({
    chiave: "ultima",
    tipo: "euro",
    cerca: /latest_invoice|last_invoice|latest_bill|last_bill|ultima_(bolletta|fattura)/,
  }),
  Object.freeze({
    chiave: "totale",
    tipo: "euro",
    cerca: /total_invoiced|total_billed|totale_fatturato|totale_(bollette|fatture)/,
  }),
  Object.freeze({
    chiave: "potenza",
    tipo: "numero",
    cerca: /potenza_impegnata|contracted_power|committed_power/,
  }),
  Object.freeze({
    chiave: "scadenza",
    tipo: "data",
    cerca: /scadenza_(dell_)?offerta|offer_(end|expir)|contract_(end|expir)|fine_contratto/,
  }),
  Object.freeze({
    chiave: "consumoGiorno",
    tipo: "numero",
    cerca: /daily_consumption|consumo_giornaliero/,
  }),
]);

const CHIAVI = new Set(VOCI_DELLA_BOLLETTA.map((voce) => voce.chiave));

/** La scelta salvata, ripulita: solo le voci che esistono, solo entity_id. */
export function normalizzaBollette(salvate) {
  const dato = salvate && typeof salvate === "object" && !Array.isArray(salvate) ? salvate : {};
  const voci = {};
  for (const [chiave, entita] of Object.entries(dato.voci || {})) {
    const id = clean(entita);
    if (CHIAVI.has(chiave) && /^[a-z_]+\.[a-z0-9_]+$/i.test(id)) voci[chiave] = id;
  }
  return { voci };
}

/* Il nome su cui si cerca: l'entity_id e il nome che si vede, in minuscolo e
 * coi trattini bassi, cosi' «Unpaid Invoices» e `sensor.eon_unpaid_invoices`
 * dicono la stessa cosa. */
function comeSiChiama(id, stato) {
  const nome = clean(stato?.attributes?.friendly_name).toLowerCase();
  return `${id.toLowerCase()} ${nome.replace(/[^a-z0-9]+/g, "_")}`;
}

/** Quale sensore e' quale voce: la scelta salvata, o il primo che si chiama cosi'. */
export function sensoriDellaBolletta(states = {}, salvate = {}) {
  const scelte = normalizzaBollette(salvate).voci;
  const presi = new Set(Object.values(scelte));
  const fuori = {};
  const candidati = Object.entries(states || {})
    .filter(([id]) => id.startsWith("sensor."))
    .sort(([a], [b]) => a.localeCompare(b));
  for (const voce of VOCI_DELLA_BOLLETTA) {
    if (scelte[voce.chiave]) {
      fuori[voce.chiave] = scelte[voce.chiave];
      continue;
    }
    const trovato = candidati.find(
      ([id, stato]) => !presi.has(id) && voce.cerca.test(comeSiChiama(id, stato)),
    );
    if (trovato) {
      fuori[voce.chiave] = trovato[0];
      presi.add(trovato[0]);
    }
  }
  return fuori;
}

const MUTI = new Set(["", "unknown", "unavailable", "none", "null"]);

function numero(valore) {
  const n = Number(clean(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* Pagata, da pagare, o non si sa: le parole dei fornitori sono tante, e chi
 * non dice niente di chiaro resta «non si sa». */
export function laBollettaEPagata(testo) {
  const detto = clean(testo).toLowerCase();
  if (!detto || MUTI.has(detto)) return null;
  if (/unpaid|non[_ ]?pagat|da[_ ]?pagare|overdue|scadut|due|pending|insolut/.test(detto))
    return false;
  if (/paid|pagat|saldat|ok|regolare/.test(detto)) return true;
  return null;
}

/**
 * Le bollette come si leggono adesso.
 *
 * `null` se non c'e' niente da dire: la linguetta allora non c'e'.
 */
export function laBolletta(states = {}, salvate = {}) {
  const sensori = sensoriDellaBolletta(states, salvate);
  const voci = {};
  for (const voce of VOCI_DELLA_BOLLETTA) {
    const id = sensori[voce.chiave];
    if (!id) continue;
    const stato = states?.[id];
    const grezzo = clean(stato?.state);
    const muto = !stato || MUTI.has(grezzo.toLowerCase());
    const riga = {
      entity: id,
      muto,
      unita: clean(stato?.attributes?.unit_of_measurement),
      testo: muto ? "" : grezzo,
      valore: null,
      data: null,
    };
    if (!muto && (voce.tipo === "euro" || voce.tipo === "numero")) riga.valore = numero(grezzo);
    if (!muto && voce.tipo === "data") {
      const quando = Date.parse(grezzo);
      riga.data = Number.isFinite(quando) ? quando : null;
    }
    voci[voce.chiave] = riga;
  }
  const soldi = ["daPagare", "ultima", "totale"].some((chiave) => voci[chiave]);
  if (!soldi) return null;
  const daPagare = voci.daPagare?.valore ?? null;
  let pagata = laBollettaEPagata(voci.stato?.testo);
  if (pagata === null && daPagare !== null) pagata = daPagare <= 0.004;
  return { voci, daPagare, pagata };
}

/** I mesi interi da `adesso` alla scadenza (negativi se e' gia' passata). */
export function mesiAllaScadenza(data, adesso = Date.now()) {
  if (!Number.isFinite(data)) return null;
  const da = new Date(adesso);
  const a = new Date(data);
  let mesi = (a.getFullYear() - da.getFullYear()) * 12 + (a.getMonth() - da.getMonth());
  if (a.getDate() < da.getDate()) mesi -= 1;
  return mesi;
}
