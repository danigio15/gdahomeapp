/* Che elettrodomestico e': per il disegno sulla scheda della notifica.
 *
 * «La notifica della lavastoviglie ha in alto a sinistra l'icona della
 *  lavatrice.» La scheda la disegna l'app, e l'app sapeva fare un disegno
 * solo: il cestello. Qui si dice CHE COSA disegnare, con le parole dei
 * disegni della plancia — `washer`, `dishwasher`, `oven`… — che sono anche i
 * nomi dei file in `app/assets/elettrodomestici/`: il telefono mette davanti
 * la stessa faccia che l'elettrodomestico ha sulla dashboard.
 *
 * Il tipo non si indovina due volte. Lo sa gia' la plancia
 * (`canonicalArtworkType`, lo stesso che sceglie il disegno grande della
 * card), e si chiede prima a quello che chi abita ha configurato — il tipo,
 * il disegno, l'icona, il nome che ha dato all'elettrodomestico — e solo dopo
 * al nome e all'id che vengono da Home Assistant.
 */
import { canonicalArtworkType } from "../plancia/src/core/appliance-artwork.js";

/* Quelli che il catalogo della plancia non distingue, ma che l'app sa
 * disegnare lo stesso (`app/lib/vestito/elettrodomestici.dart`, con la stessa
 * regola). La pompa di calore prima di tutto: «pompa di calore clima» e' lei,
 * non un condizionatore. «pompa» da sola non basta: la pompa di calore non e'
 * una piscina. */
const POMPA_DI_CALORE = /pompa\s*di\s*calore|heat[_ -]?pump|\bpdc\b/i;
const INDUZIONE = /induzion|induction/i;
const PISCINA = /piscin|pool/i;

/* I campi di un elettrodomestico configurato che dicono che cos'e', in
 * ordine: come `applianceArtworkType` della plancia. */
const CAMPI_CHE_DICONO_IL_TIPO = [
  "visual_key",
  "device_type",
  "type",
  "icon",
  "name",
  "report_label",
];

const testo = (valore) => String(valore ?? "").trim();
const idDi = (voce) => testo(typeof voce === "string" ? voce : voce?.entity || voce?.entity_id);

function statoDellaPlancia(valori = {}) {
  let stato = valori?.dm_dashboard_state;
  if (typeof stato === "string") {
    try {
      stato = JSON.parse(stato);
    } catch (_errore) {
      stato = null;
    }
  }
  return stato && typeof stato === "object" ? stato : null;
}

/** Le entita' di un elettrodomestico configurato: ogni campo che ne nomina una. */
function entitaDi(voce) {
  const tutte = new Set();
  for (const [chiave, valore] of Object.entries(voce || {})) {
    if (chiave === "entities" && Array.isArray(valore)) {
      for (const una of valore) if (idDi(una)) tutte.add(idDi(una));
    } else if (typeof valore === "string" && /^[a-z_]+\.[a-z0-9_]+$/.test(valore.trim())) {
      tutte.add(valore.trim());
    } else if (valore && typeof valore === "object" && idDi(valore)) {
      tutte.add(idDi(valore));
    }
  }
  return tutte;
}

/**
 * L'elettrodomestico della plancia che usa una di queste entita' (quella che
 * ha detto «finito», o la presa che ne ha misurato il ciclo), o `null`.
 */
export function elettrodomesticoDellaPlancia(valori, ...ids) {
  const cercati = ids.map(testo).filter(Boolean);
  if (!cercati.length) return null;
  const sezioni = statoDellaPlancia(valori)?.sections || {};
  for (const sezione of ["appliances", "loads"]) {
    const elenco = Array.isArray(sezioni[sezione]) ? sezioni[sezione] : [];
    for (const voce of elenco) {
      const sue = entitaDi(voce);
      if (cercati.some((id) => sue.has(id))) return voce;
    }
  }
  return null;
}

/* Il tipo da una parola sola, o "" se quella parola non lo dice. «generic»
 * non e' una risposta: una «presa lavastoviglie» e' una lavastoviglie, e si
 * guarda la parola dopo. */
function tipoDaUnaParola(parola) {
  if (POMPA_DI_CALORE.test(parola)) return "heat-pump";
  const canonico = canonicalArtworkType(parola);
  if (canonico && canonico !== "generic") return canonico;
  if (INDUZIONE.test(parola)) return "cooktop";
  if (PISCINA.test(parola)) return "pool-pump";
  return "";
}

/**
 * Il tipo del disegno: `{voce}` e' l'elettrodomestico configurato nella
 * plancia (o niente), `parole` quello che Home Assistant ne dice — id, nome.
 * Torna sempre qualcosa: `generic` se nessuno sa che cos'e'.
 */
export function tipoDellElettrodomestico({ voce = null, parole = [] } = {}) {
  const candidati = [
    ...(voce ? CAMPI_CHE_DICONO_IL_TIPO.map((campo) => voce[campo]) : []),
    ...parole,
  ];
  for (const candidato of candidati) {
    const tipo = tipoDaUnaParola(testo(candidato));
    if (tipo) return tipo;
  }
  return "generic";
}
