/* Una plancia nuova, con il suo modello e chi la vede.
 *
 * «Gestiscila tu la creazione di una nuova plancia: quando si sceglie di
 * aggiungerne un'altra, si sceglie il modello — classica o a muro — e anche
 * l'utente che deve vederla.» Prima erano tre passi in tre posti: aggiungerla
 * qui, spuntare chi la vede, poi aprirla sul tablet e accendere «A muro» nel
 * suo config. Adesso e' un gesto solo, e una plancia a muro nasce gia' accesa,
 * con le pagine riempite dalla plancia principale.
 *
 * Sta in un posto solo perche' le strade sono due — la console, con
 * `POST /api/plance`, e l'app, con `ponte/plance/aggiungi` — e devono fare la
 * stessa cosa.
 */
import { CONFIG_KEYS_REVISION } from "../plancia/src/core/chiavi-di-configurazione.js";
import {
  CHIAVE_MURO,
  PROFILO_DI_ORIGINE,
  fonteDaiValori,
  muroDiPartenza,
  muroPulito,
} from "../plancia/src/core/plancia-a-muro.js";

export const MODELLI_DI_PLANCIA = Object.freeze(["classica", "muro"]);

/** Il modello chiesto, o la classica: e' quella che c'era prima di oggi. */
export function modelloPulito(modello) {
  const detto = String(modello || "").trim();
  return MODELLI_DI_PLANCIA.includes(detto) ? detto : "classica";
}

/** Se la configurazione di questa plancia la fa partire a muro. */
export function eAMuro(configurazione, profilo) {
  if (!configurazione) return false;
  try {
    const valori = configurazione.leggi(profilo)?.snapshot?.values || {};
    return valori[CHIAVE_MURO] ? muroPulito(valori[CHIAVE_MURO]).attiva === true : false;
  } catch (_errore) {
    return false;
  }
}

/* Il config a muro di partenza, letto dalla plancia principale. */
function muroDallaPrincipale(configurazione) {
  let valori = {};
  try {
    valori = configurazione?.leggi(PROFILO_DI_ORIGINE)?.snapshot?.values || {};
  } catch (_errore) {
    valori = {};
  }
  return muroDiPartenza(fonteDaiValori(valori));
}

/**
 * Aggiunge una plancia: il titolo, il modello, chi la vede.
 *
 * Il limite di Base e quello delle trenta plance restano dove sono, in
 * `plance.aggiungi`: questa funzione non aggiunge regole, mette insieme i
 * passi. Se scrivere il config a muro non riesce, la plancia resta — classica
 * — e lo dice il registro: toglierla di nascosto sarebbe peggio.
 */
export function aggiungiUnaPlancia(
  { plance, configurazione = null, registro = null, adesso = () => Date.now() },
  { titolo = "", modello = "classica", utenti = null } = {},
) {
  let quale = plance.aggiungi(titolo);
  if (Array.isArray(utenti) && utenti.length) quale = plance.chiLaVede(quale.profilo, utenti);
  if (modelloPulito(modello) === "muro" && configurazione) {
    try {
      configurazione.scrivi(
        quale.profilo,
        { [CHIAVE_MURO]: JSON.stringify(muroDallaPrincipale(configurazione)) },
        { keys_revision: CONFIG_KEYS_REVISION, updated_at: adesso() },
      );
      registro?.info?.(`la plancia «${quale.titolo}» parte a muro`);
    } catch (errore) {
      registro?.errore?.(
        `la plancia «${quale.titolo}» non e' partita a muro: ${errore?.message || errore}`,
      );
    }
  }
  return { ...quale, a_muro: eAMuro(configurazione, quale.profilo) };
}

/** L'elenco delle plance, ognuna con il suo «a muro». */
export function conIlModello(elenco, configurazione) {
  return (Array.isArray(elenco) ? elenco : []).map((una) => ({
    ...una,
    a_muro: eAMuro(configurazione, una.profilo),
  }));
}
