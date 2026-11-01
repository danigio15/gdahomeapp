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
  CHIAVE_OCCHIO,
  occhioDiPartenza,
  occhioPulito,
} from "../plancia/src/core/colpo-d-occhio.js";
import { CHIAVE_CASA3D, casa3dPulita } from "../plancia/src/core/casa-3d.js";
import {
  CHIAVE_MURO,
  PROFILO_DI_ORIGINE,
  fonteDaiValori,
  muroDiPartenza,
  muroPulito,
} from "../plancia/src/core/plancia-a-muro.js";

/* «Colpo d'occhio» (`occhio`): una pagina sola coi riquadri grandi, e ognuno
 * apre il suo popup — vedi `plancia/src/core/colpo-d-occhio.js`. */
/* «Casa 3D» (`casa3d`): la casa in tre dimensioni, coi suoi piani, gli arredi
 * e i dispositivi — vedi `plancia/src/core/casa-3d.js`. */
export const MODELLI_DI_PLANCIA = Object.freeze(["classica", "muro", "occhio", "casa3d"]);

/* Da dove parte una plancia nuova a muro o a colpo d'occhio: dalla
 * principale, con quello che lei sa, o da zero, coi riquadri da riempire. */
export const PARTENZE = Object.freeze(["principale", "zero"]);
export const partenzaPulita = (partenza) => (partenza === "zero" ? "zero" : "principale");

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

/** Se la configurazione di questa plancia la fa partire a colpo d'occhio. */
export function eAColpoDOcchio(configurazione, profilo) {
  if (!configurazione) return false;
  try {
    const valori = configurazione.leggi(profilo)?.snapshot?.values || {};
    return valori[CHIAVE_OCCHIO] ? occhioPulito(valori[CHIAVE_OCCHIO]).attiva === true : false;
  } catch (_errore) {
    return false;
  }
}

/** Se la configurazione di questa plancia la fa partire con la Casa 3D.
 *
 * Mai la principale: la Casa 3D e' una plancia a se', e sulla principale non
 * si accende (casa-3d-section.js). Fino alla 1.18.7.23 creare la casa dal
 * Config della principale la diceva accesa li', e la console mostrava la
 * principale «casa 3D» — «la principale che diventa da sola in 3D». */
export function eCasa3D(configurazione, profilo) {
  if (!configurazione || profilo === PROFILO_DI_ORIGINE) return false;
  try {
    const valori = configurazione.leggi(profilo)?.snapshot?.values || {};
    const grezza = valori[CHIAVE_CASA3D];
    if (!grezza) return false;
    return casa3dPulita(typeof grezza === "string" ? JSON.parse(grezza) : grezza).attiva === true;
  } catch (_errore) {
    return false;
  }
}

/* Le cose della plancia principale, come le legge il tablet a muro. */
function fonteDellaPrincipale(configurazione) {
  let valori = {};
  try {
    valori = configurazione?.leggi(PROFILO_DI_ORIGINE)?.snapshot?.values || {};
  } catch (_errore) {
    valori = {};
  }
  return fonteDaiValori(valori);
}

/* Il config a muro di partenza, letto dalla plancia principale. */
function muroDallaPrincipale(configurazione) {
  return muroDiPartenza(fonteDellaPrincipale(configurazione));
}

/* Il primo config di una plancia nuova, secondo il modello e la partenza:
 * `null` per la classica, che parte dal cassetto vuoto come sempre. */
function configDiPartenza(configurazione, modello, partenza) {
  if (modello === "muro")
    return { [CHIAVE_MURO]: JSON.stringify(muroDallaPrincipale(configurazione)) };
  /* La Casa 3D nasce vuota, tutta sua: svincolata dalla principale, la
   * casa si crea dal suo Config o dal suo «Crea la tua casa». */
  if (modello === "casa3d")
    return { [CHIAVE_CASA3D]: JSON.stringify(casa3dPulita({ attiva: true })) };
  if (modello === "occhio")
    return {
      [CHIAVE_OCCHIO]: JSON.stringify(
        occhioDiPartenza(
          partenzaPulita(partenza) === "zero" ? null : fonteDellaPrincipale(configurazione),
        ),
      ),
    };
  return null;
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
  { titolo = "", modello = "classica", utenti = null, partenza = "principale" } = {},
) {
  let quale = plance.aggiungi(titolo);
  /* Una plancia nuova nasce col cassetto vuoto, sempre. Il profilo si ricava
   * dal titolo, e il cassetto di una plancia tolta con lo stesso titolo
   * dovrebbe essere gia' vuoto (`togli` lo svuota). Ma prima di oggi una
   * pagina rimasta aperta su quella plancia poteva riempirlo di nuovo dopo
   * che era stata tolta, e quel cassetto e' ancora li' ad aspettare: senza
   * questa riga la plancia rifatta se lo ritroverebbe — a muro, se la morta
   * era a muro. Quello che c'e' qui dentro non e' di nessuna plancia che
   * esiste, quindi non e' il lavoro di nessuno. */
  try {
    configurazione?.dimentica?.(quale.profilo);
  } catch (errore) {
    registro?.attenzione?.(
      `la plancia «${quale.titolo}» poteva ritrovarsi una configurazione di prima: ${errore?.message || errore}`,
    );
  }
  if (Array.isArray(utenti) && utenti.length) quale = plance.chiLaVede(quale.profilo, utenti);
  const primo = configurazione
    ? configDiPartenza(configurazione, modelloPulito(modello), partenza)
    : null;
  if (primo) {
    const come = { muro: "a muro", occhio: "a colpo d'occhio", casa3d: "con la Casa 3D" }[
      modelloPulito(modello)
    ];
    try {
      configurazione.scrivi(quale.profilo, primo, {
        keys_revision: CONFIG_KEYS_REVISION,
        updated_at: adesso(),
      });
      registro?.info?.(`la plancia «${quale.titolo}» parte ${come}`);
    } catch (errore) {
      registro?.errore?.(
        `la plancia «${quale.titolo}» non e' partita ${come}: ${errore?.message || errore}`,
      );
    }
  }
  return {
    ...quale,
    a_muro: eAMuro(configurazione, quale.profilo),
    a_occhio: eAColpoDOcchio(configurazione, quale.profilo),
    a_casa3d: eCasa3D(configurazione, quale.profilo),
  };
}

/** L'elenco delle plance, ognuna con il suo modello. */
export function conIlModello(elenco, configurazione) {
  return (Array.isArray(elenco) ? elenco : []).map((una) => ({
    ...una,
    a_muro: eAMuro(configurazione, una.profilo),
    a_occhio: eAColpoDOcchio(configurazione, una.profilo),
    a_casa3d: eCasa3D(configurazione, una.profilo),
  }));
}
