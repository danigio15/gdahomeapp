/* «Apri in mappa» dentro l'app: la persona si apre nel navigatore.
 *
 * «Da app gdahome quando clicco sulla persona e premo su Apri mappa, apri la
 * posizione su gdanav direttamente.» Nell'app il navigatore c'e' gia', e la
 * mappa di Home Assistant — quella che il tocco apriva (#438) — dentro un
 * riquadro non porta da nessuna parte: si vede il segnaposto e basta. Nel
 * navigatore invece c'e' la strada per arrivarci.
 *
 * La pagina lo sa fare solo se l'app la ascolta: il canale `gdahomeNavigatore`
 * lo registra l'app (`app/lib/schermate/riquadro/sul_telefono.dart`), e nel
 * browser o dentro Home Assistant non c'e'. Allora resta il tocco di sempre.
 *
 * Qui solo il messaggio: dove sta la persona, dalla sua entita'. Home
 * Assistant scrive `latitude` e `longitude` sulla persona quando il suo
 * tracker ha un GPS; senza, non c'e' un punto da dare al navigatore, e il
 * tocco resta quello di prima.
 */
import { latitudine, longitudine } from "./radar-mappa.js";

/** Il nome del canale dell'app che porta la persona nel navigatore. */
export const CANALE_DEL_NAVIGATORE = "gdahomeNavigatore";

/**
 * Il messaggio per il navigatore, o `null` se la persona non ha un punto.
 *
 * `{nome, lat, lon, indirizzo}`: il nome e l'indirizzo sono quelli che la
 * scheda mostra, cosi' nel navigatore la meta si chiama come la persona.
 */
export function laPersonaPerIlNavigatore(view, states = {}) {
  const attributi = states?.[view?.entity]?.attributes || {};
  const lat = latitudine(attributi.latitude);
  const lon = longitudine(attributi.longitude);
  if (lat === null || lon === null) return null;
  return {
    nome: String(view?.name ?? "").trim() || String(view?.entity ?? ""),
    lat,
    lon,
    indirizzo: String(view?.address ?? "").trim(),
  };
}

/**
 * Manda la persona al navigatore dell'app. `true` se l'ha mandata: allora il
 * collegamento non serve piu'.
 */
export function mandaLaPersonaAlNavigatore(view, states, root = globalThis) {
  const canale = root?.[CANALE_DEL_NAVIGATORE];
  if (typeof canale?.postMessage !== "function") return false;
  const messaggio = laPersonaPerIlNavigatore(view, states);
  if (!messaggio) return false;
  try {
    canale.postMessage(JSON.stringify(messaggio));
    return true;
  } catch (_errore) {
    return false;
  }
}
