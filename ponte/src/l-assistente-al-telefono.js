/* L'assistente al telefono: quello che la casa direbbe, anche a schermo spento.
 *
 * La plancia ha il suo assistente (`plancia/src/core/assistente-di-casa.js`):
 * accanto alle persone, in Home, dice la cosa piu' importante da fare adesso.
 * Ma la plancia la guarda chi e' davanti al tablet, e la serratura rimasta
 * aperta alle due di notte non la guarda nessuno. Queste sono le stesse idee,
 * dette al telefono: una notifica dell'assistente (`suggerimenti`), con il
 * tasto che fa la cosa.
 *
 * Le regole sono funzioni di una **vista**: quello che la sentinella sa in
 * quel momento — gli stati, l'ora, se la casa e' vuota e da quanto, se e'
 * notte e se dorme, l'area di ogni entita' (dai registri di Home Assistant,
 * quando ci sono), la configurazione della plancia, le letture dell'energia.
 * Ogni regola torna gli eventi che varrebbero adesso, nella forma di quelli
 * della sentinella (`sentinella.js`): tipo, urgenza, importante, chiave,
 * pausa, parole, azioni. La sentinella li dice una volta sola finche' la cosa
 * resta vera (`_unaVolta`), e si riarma quando smette.
 *
 * Una cosa le regole se la devono ricordare fra un giro e l'altro: da quanto
 * il sole avanza, da quanto una stanza e' calda, se oggi la lavatrice e' gia'
 * stata proposta. Sta in `vista.memoria`, una mappa che la sentinella tiene
 * per loro e che nessun altro tocca. Tutto il resto entra dalla vista ed esce
 * dagli eventi: una prova accende una casa finta e un orologio finto e guarda
 * cosa dicono.
 *
 * Una regola che non trova quello che le serve non dice niente: senza aree
 * la finestra non si lega al clima della stessa stanza, senza la soglia
 * scritta vale quella di un contatore da tre chilowatt, senza registri i
 * dispositivi muti non si contano. Meglio tacere che indovinare.
 *
 * Il «Va bene così» (`basta`) sotto queste notifiche zittisce quella chiave
 * per dodici ore su quel telefono (`notifiche.js`); il «Più tardi» per un'ora.
 */

import {
  dominioDi,
  eNotte,
  nomeDellElettrodomestico,
  nomeDi,
  perQuanto,
  tastoGuarda,
} from "./sentinella.js";
import { nomePulito } from "./capire-la-casa.js";
import { carichiDellaPlancia } from "./l-energia-di-casa.js";
import {
  elettrodomesticoDellaPlancia,
  tipoDellElettrodomestico,
} from "./il-tipo-dell-elettrodomestico.js";
import { soleCheAvanza } from "../plancia/src/core/assistente-di-casa.js";
import { wattsFromState } from "../plancia/src/core/signed-energy.js";
import { elencoComandi } from "../plancia/src/core/comandi-accanto.js";
import { sogliaDellaPotenza } from "../plancia/src/core/la-soglia-della-potenza.js";
import { letturaRifiuti, rifiutiConfigurati } from "../plancia/src/core/rifiuti-model.js";
import {
  entitaDellaRicarica,
  letturaDellAuto,
  modoPerEvcc,
  stessoModo,
} from "../plancia/src/core/ricarica-di-notte.js";
import { codiceDellaRicarica } from "../plancia/src/core/stato-della-ricarica.js";

/* Attenzione all'anello: `sentinella.js` importa questo modulo, e questo
 * importa da lei i suoi aiutanti. Va bene finche' qui, fuori dalle funzioni,
 * non si chiama niente di suo: quando una regola gira, tutti e due i moduli
 * sono gia' caricati. */

const MINUTO = 60 * 1000;
const ORA = 60 * MINUTO;

/* ─── Le soglie ──────────────────────────────────────────────────────────── */

/* La serratura aperta da dieci minuti, con la casa vuota da dieci: chi esce
 * e torna indietro per le chiavi non riceve niente. */
const SERRATURA_APERTA_DA = 10 * MINUTO;
const SERRATURA_CASA_VUOTA_DA = 10 * MINUTO;
/* Cinque minuti di finestra aperta: arieggiare va bene, il clima che
 * rinfresca il giardino no. */
const FINESTRA_APERTA_DA = 5 * MINUTO;
/* Di notte, una luce accesa da un'ora dove nessuno si muove da mezz'ora. */
const LUCE_DI_NOTTE_DA = ORA;
const NESSUNO_SI_MUOVE_DA = 30 * MINUTO;
/* Il sole che avanza: un chilowatt e mezzo per un quarto d'ora basta a una
 * lavatrice; per l'auto ne bastano 1,4 (sei ampere a 230 volt, il minimo di
 * una wallbox) per dieci minuti. */
const SOLE_PER_ELETTRODOMESTICO = 1500; // W
const SOLE_PER_ELETTRODOMESTICO_DA = 15 * MINUTO;
const SOLE_PER_AUTO = 1400; // W
const SOLE_PER_AUTO_DA = 10 * MINUTO;
/* Le ore del sole buono: un lavaggio partito alle quattro finisce ancora col
 * sole; l'auto si carica fino a sera. */
const SOLE_DALLE = 9;
const SOLE_ALLE = 16;
const AUTO_DALLE = 8;
const AUTO_ALLE = 19;
/* Un elettrodomestico fermo: sotto i quindici watt e' lo standby. */
const FERMO_SOTTO = 15; // W
/* La rete: il novanta per cento del limite per due minuti. Il limite e' la
 * soglia rossa scritta nella plancia (`cd_energia_soglia`, «adesso salta»);
 * senza, quella ambra e' gia' «occhio» e vale cosi' com'e'; senza nessuna
 * delle due, il contratto piu' comune in Italia, tre chilowatt — e la
 * soglia a 2,7. Il contatore stacca dopo un po' sopra il limite, non subito:
 * due minuti sono il tempo di accorgersene prima. */
const LIMITE_DI_SERIE = 3000; // W
const QUOTA_DEL_LIMITE = 0.9;
const RETE_ALTA_DA = 2 * MINUTO;
/* Un carico sotto i cento watt non vale la pena di nominarlo. */
const CARICO_DA_NOMINARE = 100; // W
/* I rifiuti: la sera prima, o la mattina stessa. In minuti dalla mezzanotte. */
const RIFIUTI_SERA = [19 * 60, 21 * 60 + 30];
const RIFIUTI_MATTINA = [6 * 60 + 30, 8 * 60 + 30];
/* Un appuntamento fra venticinque e trentacinque minuti: il tempo di uscire. */
const APPUNTAMENTO_FRA = [25 * MINUTO, 35 * MINUTO];
/* Il comfort: sopra i 27 o sotto i 16 gradi per mezz'ora, con qualcuno in casa. */
const TROPPO_CALDO = 27; // °C
const TROPPO_FREDDO = 16; // °C
const COMFORT_DA = 30 * MINUTO;
/* L'aria: oltre 1200 ppm di CO₂ (dove la concentrazione si sente) o il 75%
 * di umidita' (dove arriva la muffa), per un quarto d'ora. */
const CO2_ALTA = 1200; // ppm
const UMIDITA_ALTA = 75; // %
const ARIA_DA = 15 * MINUTO;
/* I dispositivi muti da sei ore, e gli aggiornamenti: una volta al giorno,
 * alle dieci, quando si ha un minuto per guardarli. */
const MUTO_DA = 6 * ORA;
const MANUTENZIONE_DALLE = 10 * 60;
const MANUTENZIONE_ALLE = 10 * 60 + 15;

/* ─── Come si riconoscono le cose ────────────────────────────────────────── */

const MOVIMENTO = new Set(["motion", "occupancy", "presence"]);
/* Fuori casa: un termometro del giardino a 30 gradi d'agosto e' l'estate,
 * non una stanza da rinfrescare. */
const ALL_APERTO =
  /estern|outdoor|outside|fuori|giardin|garden|balcon|terrazz|terrace|cortil|patio|veranda/i;
/* I termometri che non dicono com'e' una stanza: il frigo, l'acqua, il
 * boiler, la piscina, i computer, le batterie, l'auto. */
const NON_E_UNA_STANZA =
  /frig|fridge|refriger|freez|congel|acqua|water|boiler|scaldabagn|piscin|pool|cpu|processor|chip|batter|inverter|forno|oven|acquari|terrari|mandata|ritorno|collettor|sonda|motore|engine|vehicle|veicol|router|server|\bnas\b|\bups\b|stampant|printer/i;
/* Il comando che fa partire un elettrodomestico: lo stesso criterio della
 * plancia (`assistente-di-casa-section.js`, `comandoDiAvvio`). */
const PARTENZA = /(start|avvi|inizia|run|play)/i;
const FERMATA = /(stop|ferma|pausa|pause|off|spegni)/i;
/* Quello che lavora, nello stato di un elettrodomestico. */
const LAVORA =
  /run|wash|lavagg|lavand|dry|asciug|rins|risciacq|spin|centrifug|in corso|in funzione|program|active|attiv|working/i;
/* Quello che non si mette in pausa: il frigo, il congelatore, la rete di
 * casa. */
const NON_SI_RIMANDA = /frig|fridge|freez|congel|router|server|\bnas\b|acquari|modem/i;

const ENTITA = /^[a-z_]+\.[a-z0-9_]+$/;

const duePassi = (it, en) => ({ it, en });
const tastoPiuTardi = () => ({
  id: "piu-tardi",
  parole: duePassi("Più tardi", "Later"),
  piuTardi: true,
});
/** «Va bene così»: quella cosa, a quel telefono, non si ridice per dodici ore. */
export const tastoBasta = (parole = duePassi("Va bene così", "That's fine")) => ({
  id: "basta",
  parole,
  basta: true,
});

const numero = (valore) => {
  if (valore === null || valore === undefined || String(valore).trim() === "") return null;
  const n = Number(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/* Un chilowatt con un decimale, con la virgola per chi legge italiano. */
const kw = (watt, lingua) => {
  const scritto = (watt / 1000).toFixed(1);
  return lingua === "en" ? scritto : scritto.replace(".", ",");
};

/* Le migliaia col punto (1.450) in italiano, con la virgola in inglese. */
const migliaia = (n, lingua) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, lingua === "en" ? "," : ".");

/* Tre nomi si scrivono, oltre si conta: «Taverna, Garage e altre 2». */
function elenco(nomi, lingua, { quanti = 3 } = {}) {
  const scritti = nomi.slice(0, quanti).join(", ");
  const resto = nomi.length - quanti;
  if (resto <= 0) return scritti;
  return lingua === "en" ? `${scritti} and ${resto} more` : `${scritti} e altri ${resto}`;
}

/* Due cose si legano con «e»: «la plastica e la carta». */
const eAnche = (nomi, lingua) =>
  nomi.length <= 1
    ? nomi[0] || ""
    : `${nomi.slice(0, -1).join(", ")} ${lingua === "en" ? "and" : "e"} ${nomi.at(-1)}`;

const minutiDelGiorno = (data) => data.getHours() * 60 + data.getMinutes();
const dentro = (data, [dalle, alle]) => {
  const m = minutiDelGiorno(data);
  return m >= dalle && m < alle;
};
const giornoDi = (ora) => new Date(ora).toDateString();

/* Da quanto una condizione regge, nella memoria delle regole: zero quando non
 * regge, e allora si dimentica. Serve per i numeri, che cambiano a ogni
 * lettura e non hanno un «da quando» loro. */
function regge(memoria, chiave, vale, ora) {
  if (!vale) {
    memoria.delete(chiave);
    return 0;
  }
  if (!memoria.has(chiave)) memoria.set(chiave, ora);
  return ora - memoria.get(chiave);
}

/* L'area di un'entita', come la dice Home Assistant: vuota se non si sa. */
const areaDi = (vista, id) => String(vista.aree?.get?.(id) || "").trim();
const stessaArea = (a, b) => Boolean(a) && a.toLowerCase() === String(b || "").toLowerCase();

/* I gradi di un termometro, in Celsius. */
function gradi(stato) {
  const n = numero(stato?.state);
  if (n === null) return null;
  return /F/.test(String(stato?.attributes?.unit_of_measurement || "")) ? ((n - 32) * 5) / 9 : n;
}

/* Gli stati, uno per uno, con l'identificativo e il dominio. */
function* gliStati(vista, dominio = null) {
  for (const [id, stato] of vista.stati) {
    if (dominio && dominioDi(id) !== dominio) continue;
    yield [id, stato];
  }
}

/* Un valore della plancia, che puo' essere salvato come testo JSON. */
function json(valore) {
  if (typeof valore !== "string") return valore ?? null;
  try {
    return JSON.parse(valore);
  } catch (_errore) {
    return null;
  }
}

/* Le entita' scritte in un elettrodomestico della plancia: ogni campo che ne
 * nomina una, e i suoi comandi. */
function entitaDellaVoce(voce) {
  const tutte = new Set(elencoComandi(voce?.comandi));
  for (const [chiave, valore] of Object.entries(voce || {})) {
    if (chiave === "comandi") continue;
    if (typeof valore === "string" && ENTITA.test(valore.trim())) tutte.add(valore.trim());
    else if (Array.isArray(valore))
      for (const una of valore) {
        const id = String(typeof una === "string" ? una : una?.entity || "").trim();
        if (ENTITA.test(id)) tutte.add(id);
      }
  }
  return [...tutte];
}

/* ─── 1. La serratura aperta ─────────────────────────────────────────────── */

/**
 * Una serratura (`lock.*`) aperta da dieci minuti, con la casa vuota da dieci
 * o di notte quando la casa dorme. «Chiudi a chiave» la chiude; con una
 * serratura che vuole il codice, il tasto apre l'app.
 */
export function serrature(vista) {
  const { ora, vuota, vuotaDa, notte, dorme } = vista;
  const vuotaAbbastanza = vuota === true && (vuotaDa ?? 0) >= SERRATURA_CASA_VUOTA_DA;
  if (!vuotaAbbastanza && !(notte && dorme)) return [];
  const fuori = [];
  for (const [id, stato] of gliStati(vista, "lock")) {
    if (!["unlocked", "open"].includes(stato.state)) continue;
    if (ora - stato.dal < SERRATURA_APERTA_DA) continue;
    const nome = nomePulito(nomeDi(stato, id));
    const chiudi = stato.attributes?.code_format
      ? { id: "chiudi", parole: duePassi("Chiudi a chiave", "Lock"), apre: true }
      : {
          id: "chiudi",
          parole: duePassi("Chiudi a chiave", "Lock"),
          servizio: { dominio: "lock", servizio: "lock", entita: [id] },
        };
    fuori.push({
      tipo: "suggerimenti",
      urgenza: "normale",
      importante: true,
      chiave: `suggerimenti:serrature:${id}`,
      pausa: ORA,
      entita: id,
      parole: {
        it: {
          titolo: `🔓 ${nome} non chiusa a chiave`,
          testo: vuotaAbbastanza
            ? `Nessuno in casa da ${perQuanto(vuotaDa)}. La chiudo?`
            : "È notte. La chiudo?",
        },
        en: {
          titolo: `🔓 ${nome} is unlocked`,
          testo: vuotaAbbastanza
            ? `Nobody home for ${perQuanto(vuotaDa, "en")}. Lock it?`
            : "It's night. Lock it?",
        },
      },
      azioni: [chiudi, tastoPiuTardi()],
    });
  }
  return fuori;
}

/* ─── 2. La finestra aperta col clima acceso ─────────────────────────────── */

/**
 * Un clima acceso e una finestra (`device_class: window`) aperta da cinque
 * minuti nella stessa area. Senza aree non si sa cosa sta vicino a cosa, e
 * non si dice.
 */
export function finestraClima(vista) {
  const { ora } = vista;
  const finestre = [];
  for (const [id, stato] of gliStati(vista, "binary_sensor"))
    if (
      stato.attributes?.device_class === "window" &&
      stato.state === "on" &&
      ora - stato.dal >= FINESTRA_APERTA_DA &&
      areaDi(vista, id)
    )
      finestre.push({ id, area: areaDi(vista, id) });
  if (!finestre.length) return [];
  const fuori = [];
  for (const [id, stato] of gliStati(vista, "climate")) {
    if (["off", "unavailable", "unknown"].includes(stato.state)) continue;
    const area = areaDi(vista, id);
    if (!area || !finestre.some((f) => stessaArea(f.area, area))) continue;
    const caldo = stato.state === "heat" || stato.attributes?.hvac_action === "heating";
    const temperatura = numero(stato.attributes?.current_temperature);
    const dove = (lingua) =>
      temperatura === null
        ? area
        : `${area} · ${lingua === "en" ? temperatura : String(temperatura).replace(".", ",")} °C`;
    fuori.push({
      tipo: "suggerimenti",
      urgenza: "bassa",
      importante: true,
      chiave: `suggerimenti:finestra-clima:${id}`,
      pausa: ORA,
      entita: id,
      parole: {
        it: {
          titolo: caldo
            ? "🔥 Finestra aperta col riscaldamento acceso"
            : "❄️ Finestra aperta col clima acceso",
          testo: `${dove("it")}. Spengo il clima finché è aperta?`,
        },
        en: {
          titolo: caldo ? "🔥 Window open with the heating on" : "❄️ Window open with the AC on",
          testo: `${dove("en")}. Turn it off while it's open?`,
        },
      },
      azioni: [
        {
          id: "spegni",
          parole: duePassi("Spegni il clima", "Turn it off"),
          servizio: { dominio: "climate", servizio: "turn_off", entita: [id] },
        },
        tastoBasta(),
      ],
    });
  }
  return fuori;
}

/* ─── 3. Di notte, le luci dove non c'e' nessuno ─────────────────────────── */

/**
 * Di notte, con qualcuno in casa (con la casa vuota ci pensa la regola delle
 * luci della sentinella), le luci accese da un'ora. Dove l'area ha un sensore
 * di movimento o di presenza, solo se nessuno si e' mosso da mezz'ora; dove
 * non ce l'ha, basta l'ora. Le luci che l'assistente lascia stare (l'acquario,
 * la notturna, quelle a orario) restano fuori.
 */
export function notteLuci(vista) {
  const { ora, vuota, notte } = vista;
  if (!notte || vuota === true) return [];
  /* I sensori di movimento per area, e se qualcuno si e' mosso da poco. */
  const sensori = new Map();
  for (const [id, stato] of gliStati(vista, "binary_sensor")) {
    if (!MOVIMENTO.has(stato.attributes?.device_class)) continue;
    const area = areaDi(vista, id).toLowerCase();
    if (!area) continue;
    const mosso = stato.state === "on" || ora - stato.dal < NESSUNO_SI_MUOVE_DA;
    sensori.set(area, sensori.get(area) || false || mosso);
  }
  const accese = [];
  for (const [id, stato] of gliStati(vista, "light")) {
    if (stato.state !== "on" || ora - stato.dal < LUCE_DI_NOTTE_DA) continue;
    const nome = nomeDi(stato, id);
    if (vista.lasciaStare?.(id, nome)) continue;
    const area = areaDi(vista, id);
    if (area && sensori.get(area.toLowerCase()) === true) continue;
    accese.push({ id, dove: area || nomePulito(nome), da: ora - stato.dal });
  }
  if (!accese.length) return [];
  const dove = [...new Set(accese.map((a) => a.dove))];
  const da = Math.min(...accese.map((a) => a.da));
  const una = accese.length === 1;
  const ids = accese.map((a) => a.id).slice(0, 40);
  return [
    {
      tipo: "suggerimenti",
      urgenza: "bassa",
      importante: false,
      chiave: "suggerimenti:notte-luci",
      pausa: 2 * ORA,
      parole: {
        it: {
          titolo: "🌙 Luci accese di notte dove non c'è nessuno",
          testo: `${elenco(dove, "it")} · da ${perQuanto(da)}. ${una ? "La spengo?" : "Le spengo?"}`,
        },
        en: {
          titolo: "🌙 Lights on at night where nobody is",
          testo: `${elenco(dove, "en")} · for ${perQuanto(da, "en")}. Turn ${una ? "it" : "them"} off?`,
        },
      },
      azioni: [
        {
          id: "spegni",
          parole: duePassi("Spegni", "Turn off"),
          servizio: { dominio: "light", servizio: "turn_off", entita: ids },
        },
        {
          id: "resta",
          parole: una
            ? duePassi("Resta così", "Leave it on")
            : duePassi("Restano così", "Leave them on"),
          resta: ids,
        },
      ],
    },
  ];
}

/* ─── 4. C'e' sole: e' il momento della lavatrice ────────────────────────── */

/* Il sole che avanza, dalle letture della sentinella: la produzione meno il
 * consumo, o quello che va alla rete. Lo stesso conto della plancia. */
const sole = (letture) =>
  soleCheAvanza({ solare: letture?.sole, casa: letture?.casa, rete: letture?.rete });

/* Gli elettrodomestici della plancia: quelli della pagina (dentro
 * `dm_dashboard_state`), o — per una plancia di prima — `cd_appliances`. */
function elettrodomestici(valori) {
  const stato = json(valori?.dm_dashboard_state);
  const dallaPagina = stato?.sections?.appliances;
  if (Array.isArray(dallaPagina) && dallaPagina.length) return dallaPagina;
  const vecchi = json(valori?.cd_appliances);
  return Array.isArray(vecchi) ? vecchi : [];
}

const PAROLE_DEL_TIPO = Object.freeze({
  washer: { it: "della lavatrice", en: "the washing machine" },
  dishwasher: { it: "della lavastoviglie", en: "the dishwasher" },
});

/* Se un elettrodomestico e' fermo: dalla sua potenza, o dal suo stato. Senza
 * nessuna delle due non si sa, e allora non lo si propone. */
function eFermo(voce, vista) {
  const potenza = String(voce?.power_entity || voce?.power || "").trim();
  const watt = potenza ? wattsFromState(vista.stati.get(potenza)) : null;
  if (watt !== null) return watt < FERMO_SOTTO;
  const statoId = String(voce?.state_entity || "").trim();
  const stato = statoId ? vista.stati.get(statoId) : null;
  if (!stato || ["unavailable", "unknown"].includes(stato.state)) return false;
  return !LAVORA.test(stato.state);
}

/* Il tasto che lo fa partire: un `button` o uno `switch` che si chiama come
 * una partenza, fra le entita' della sua voce. */
function avvioDi(voce, vista) {
  for (const id of entitaDellaVoce(voce)) {
    if (!vista.stati.has(id) || !PARTENZA.test(id) || FERMATA.test(id)) continue;
    if (dominioDi(id) === "button") return { dominio: "button", servizio: "press", entita: [id] };
    if (dominioDi(id) === "switch") return { dominio: "switch", servizio: "turn_on", entita: [id] };
  }
  return null;
}

/**
 * Di giorno (dalle 9 alle 16) il sole avanza di un chilowatt e mezzo da un
 * quarto d'ora, e la lavatrice o la lavastoviglie della plancia sono ferme:
 * e' il momento. Una volta al giorno. «Avvia» c'e' solo se la plancia sa
 * come farla partire.
 */
export function soleElettrodomestico(vista) {
  const { ora, data, memoria } = vista;
  const avanza = sole(vista.letture);
  const ore = data.getHours();
  const buono = avanza >= SOLE_PER_ELETTRODOMESTICO && ore >= SOLE_DALLE && ore < SOLE_ALLE;
  const da = regge(memoria, "sole-elettrodomestico:dal", buono, ora);
  if (!buono || da < SOLE_PER_ELETTRODOMESTICO_DA) return [];
  if (memoria.get("sole-elettrodomestico:giorno") === giornoDi(ora)) return [];
  const pronti = elettrodomestici(vista.valori)
    .map((voce) => ({ voce, tipo: tipoDellElettrodomestico({ voce, parole: [voce?.name] }) }))
    .filter(({ voce, tipo }) => PAROLE_DEL_TIPO[tipo] && eFermo(voce, vista));
  if (!pronti.length) return [];
  /* Prima la lavatrice: il bucato di solito aspetta, i piatti si fanno la
   * sera. */
  pronti.sort((a, b) => (a.tipo === "washer" ? -1 : 0) - (b.tipo === "washer" ? -1 : 0));
  const { voce, tipo } = pronti[0];
  memoria.set("sole-elettrodomestico:giorno", giornoDi(ora));
  const avvia = avvioDi(voce, vista);
  const parole = PAROLE_DEL_TIPO[tipo];
  return [
    {
      tipo: "suggerimenti",
      urgenza: "bassa",
      importante: false,
      chiave: "suggerimenti:sole-elettrodomestico",
      pausa: 6 * ORA,
      parole: {
        it: {
          titolo: `☀️ C'è sole: è il momento ${parole.it}`,
          testo: avvia
            ? `${kw(avanza, "it")} kW dai pannelli. La avvio?`
            : `${kw(avanza, "it")} kW dai pannelli: è il momento buono.`,
        },
        en: {
          titolo: `☀️ Sunny: time for ${parole.en}`,
          testo: avvia
            ? `${kw(avanza, "en")} kW from the panels. Start it?`
            : `${kw(avanza, "en")} kW from the panels: a good moment.`,
        },
      },
      azioni: avvia
        ? [{ id: "avvia", parole: duePassi("Avvia", "Start"), servizio: avvia }, tastoPiuTardi()]
        : [tastoGuarda(), tastoPiuTardi()],
    },
  ];
}

/* ─── 5. L'auto attaccata, col sole che avanza ───────────────────────────── */

/* Le caselle della potenza della ricarica, le stesse della giornata di casa
 * (`la-giornata-di-casa.js`). */
const CASELLE_DELLA_POTENZA = [
  "dm.ev_potenza_ricarica",
  "dm.ev_charge_power",
  "dm.ev_potenza_wallbox",
];
const CASELLA_DEL_COMANDO = "dm.ev_comando_ricarica";

function entitaDellaCasella(vista, casella) {
  let id = "";
  try {
    id = String(vista.risolvi?.(casella) || "");
  } catch (_errore) {
    id = "";
  }
  return ENTITA.test(id) && !id.startsWith("dm.") && vista.stati.has(id) ? id : "";
}

/**
 * Di giorno il sole avanza di 1,4 kW da dieci minuti, e l'auto e' attaccata
 * ma non carica: «Ricarica col sole» mette evcc in modalita' solare, o accende
 * l'interruttore della ricarica. Con evcc gia' in modalita' solare non si dice
 * niente: partira' da solo. Una volta per ogni volta che la si attacca.
 */
export function soleAuto(vista) {
  const { ora, data, memoria } = vista;
  const entita = entitaDellaRicarica(vista.risolvi);
  const leggi = (id) => vista.stati.get(id) || null;
  /* Senza la modalita', il cavo o lo stato della ricarica non c'e' un'auto
   * da guardare: `letturaDellAuto` la direbbe collegata per non lasciarla a
   * secco, ma qui si propone, e allora si vuole saperlo davvero. */
  const conosciuta = [entita.modo, ...entita.cavo, ...entita.stato].some((id) => id && leggi(id));
  if (!conosciuta) return [];
  const lettura = letturaDellAuto(entita, leggi);
  if (lettura.collegata === false) memoria.delete("sole-auto:detto");
  const avanza = sole(vista.letture);
  const ore = data.getHours();
  const buono = avanza >= SOLE_PER_AUTO && ore >= AUTO_DALLE && ore < AUTO_ALLE;
  const da = regge(memoria, "sole-auto:dal", buono, ora);
  if (!buono || da < SOLE_PER_AUTO_DA || lettura.collegata !== true) return [];
  if (memoria.get("sole-auto:detto")) return [];
  const potenzaId =
    CASELLE_DELLA_POTENZA.map((c) => entitaDellaCasella(vista, c)).find(Boolean) || "";
  const watt = potenzaId ? wattsFromState(leggi(potenzaId)) : null;
  const codice = codiceDellaRicarica({
    stato: leggi(entita.stato[0])?.state,
    collegata: lettura.collegata,
    potenza: watt,
  });
  if (codice === "C" || (watt !== null && watt > 200)) return [];
  if (lettura.soc !== null && lettura.limite !== null && lettura.soc >= lettura.limite) return [];
  if (lettura.modo && stessoModo(lettura.modo, "pv")) return [];
  let tasto = tastoGuarda();
  const opzione = entita.modo && lettura.modo ? modoPerEvcc("pv", lettura.opzioni) : "";
  const comando = entitaDellaCasella(vista, CASELLA_DEL_COMANDO);
  if (opzione && ["select", "input_select"].includes(dominioDi(entita.modo)))
    tasto = {
      id: "sole",
      parole: duePassi("Ricarica col sole", "Charge on solar"),
      servizio: {
        dominio: dominioDi(entita.modo),
        servizio: "select_option",
        entita: [entita.modo],
        dati: { option: opzione },
      },
    };
  else if (comando && dominioDi(comando) === "switch" && leggi(comando)?.state === "off")
    tasto = {
      id: "sole",
      parole: duePassi("Ricarica col sole", "Charge on solar"),
      servizio: { dominio: "switch", servizio: "turn_on", entita: [comando] },
    };
  memoria.set("sole-auto:detto", true);
  return [
    {
      tipo: "suggerimenti",
      urgenza: "bassa",
      importante: false,
      chiave: "suggerimenti:sole-auto",
      pausa: 2 * ORA,
      parole: {
        it: {
          titolo: "☀️ L'auto è attaccata e c'è sole",
          testo: `Avanzano ${kw(avanza, "it")} kW dai pannelli. La carico col sole?`,
        },
        en: {
          titolo: "☀️ The car is plugged in and it's sunny",
          testo: `${kw(avanza, "en")} kW to spare from the panels. Charge on solar?`,
        },
      },
      azioni: [tasto, tastoPiuTardi()],
    },
  ];
}

/* ─── 6. La rete che tira troppo ─────────────────────────────────────────── */

/* La soglia e il limite, dalla plancia. Vedi le soglie qui sopra. */
function sogliaDellaRete(valori) {
  const scritta = sogliaDellaPotenza(valori?.cd_energia_soglia);
  if (scritta.rossa !== null && scritta.rossa > 0)
    return { soglia: scritta.rossa * QUOTA_DEL_LIMITE, limite: scritta.rossa };
  if (scritta.ambra !== null && scritta.ambra > 0)
    return { soglia: scritta.ambra, limite: scritta.ambra };
  return { soglia: LIMITE_DI_SERIE * QUOTA_DEL_LIMITE, limite: LIMITE_DI_SERIE };
}

/* L'interruttore di un carico: il carico stesso, se e' uno switch, o uno
 * switch fra le entita' del suo elettrodomestico nella plancia. */
function interruttoreDi(id, vista) {
  if (dominioDi(id) === "switch") return id;
  const voce = elettrodomesticoDellaPlancia(vista.valori, id);
  return (
    (voce ? entitaDellaVoce(voce) : []).find(
      (una) => dominioDi(una) === "switch" && vista.stati.get(una)?.state === "on",
    ) || ""
  );
}

/**
 * Dalla rete arriva il novanta per cento del limite da due minuti: si dicono
 * i due carichi che tirano di piu', e «Pausa» spegne il piu' grosso che si
 * puo' rimandare, se ha un interruttore.
 */
export function reteAlta(vista) {
  const { ora, memoria, letture } = vista;
  const rete = numero(letture?.rete);
  const { soglia, limite } = sogliaDellaRete(vista.valori);
  const alta = rete !== null && rete >= soglia;
  if (regge(memoria, "rete-alta:dal", alta, ora) < RETE_ALTA_DA || !alta) return [];
  const nomi = new Map(carichiDellaPlancia(vista.valori).map(({ id, nome }) => [id, nome]));
  const carichi = Object.entries(letture?.carichi || {})
    .filter(([, w]) => typeof w === "number" && w >= CARICO_DA_NOMINARE)
    .sort((a, b) => b[1] - a[1])
    .map(([id, w]) => ({
      id,
      w,
      /* Il nome della plancia, o quello della presa senza «power». */
      nome: nomi.get(id) || nomeDellElettrodomestico(nomeDi(vista.stati.get(id), id)),
    }));
  const primi = carichi.slice(0, 2);
  const rimandabile = carichi.find((c) => !NON_SI_RIMANDA.test(`${c.id} ${c.nome}`));
  const interruttore = rimandabile ? interruttoreDi(rimandabile.id, vista) : "";
  const accesi = (lingua) => primi.map((c) => `${c.nome} ${kw(c.w, lingua)} kW`).join(", ");
  return [
    {
      tipo: "suggerimenti",
      urgenza: "normale",
      importante: true,
      chiave: "suggerimenti:rete-alta",
      pausa: 30 * MINUTO,
      parole: {
        it: {
          titolo: `⚡ Dalla rete ${kw(rete, "it")} kW: vicino al limite`,
          testo: primi.length
            ? `Il limite è ${kw(limite, "it")} kW. Accesi: ${accesi("it")}.`
            : `Il limite è ${kw(limite, "it")} kW.`,
        },
        en: {
          titolo: `⚡ ${kw(rete, "en")} kW from the grid: near the limit`,
          testo: primi.length
            ? `The limit is ${kw(limite, "en")} kW. On: ${accesi("en")}.`
            : `The limit is ${kw(limite, "en")} kW.`,
        },
      },
      azioni: [
        ...(interruttore
          ? [
              {
                id: "pausa",
                parole: duePassi(
                  `Pausa ${rimandabile.nome}`.slice(0, 30),
                  `Pause ${rimandabile.nome}`.slice(0, 30),
                ),
                servizio: { dominio: "switch", servizio: "turn_off", entita: [interruttore] },
              },
            ]
          : []),
        tastoBasta(),
      ],
    },
  ];
}

/* ─── 7. I rifiuti ───────────────────────────────────────────────────────── */

/* I materiali detti a una persona, con l'articolo. */
const PAROLE_DEI_RIFIUTI = Object.freeze({
  plastica: ["la plastica", "plastic"],
  carta: ["la carta", "paper"],
  vetro: ["il vetro", "glass"],
  organico: ["l'organico", "organic waste"],
  indifferenziato: ["l'indifferenziato", "general waste"],
  metalli: ["i metalli", "metal"],
  verde: ["il verde", "garden waste"],
  ingombranti: ["gli ingombranti", "bulky waste"],
  oli: ["gli oli", "oil"],
  pannolini: ["i pannolini", "nappies"],
  altro: ["i rifiuti", "waste"],
});

/* I sensori che portano un ritiro, quando la plancia non ne ha configurati:
 * quelli di Waste Collection Schedule (`daysTo`, `upcoming`) e quelli che si
 * chiamano come un ritiro. */
const NOME_DEI_RIFIUTI = /rifiut|waste|garbage|raccolta|afval|abfall|muell|müll|trash|bin_/i;
function configurazioneDeiRifiuti(vista) {
  const scritta = json(vista.valori?.cd_rifiuti);
  if (rifiutiConfigurati(scritta)) return scritta;
  const righe = [];
  for (const [id, stato] of gliStati(vista, "sensor")) {
    const a = stato.attributes || {};
    if (a.daysTo !== undefined || Array.isArray(a.upcoming) || NOME_DEI_RIFIUTI.test(id))
      righe.push({ entity: id });
  }
  return righe.length ? { righe } : null;
}

/**
 * Il ritiro dei rifiuti: la sera prima (dalle 19 alle 21:30) per domani, o la
 * mattina stessa (dalle 6:30 alle 8:30) per oggi, se la sera prima non lo si
 * era gia' detto. Dalla configurazione della plancia (`cd_rifiuti`), o dai
 * sensori di Waste Collection Schedule.
 */
export function rifiuti(vista) {
  const { ora, data, memoria } = vista;
  const sera = dentro(data, RIFIUTI_SERA);
  const mattina = dentro(data, RIFIUTI_MATTINA);
  if (!sera && !mattina) return [];
  const config = configurazioneDeiRifiuti(vista);
  if (!config) return [];
  const lettura = letturaRifiuti(config, vista.statiComeOggetto(), vista.risolvi, ora);
  let righe = sera ? lettura.domani : lettura.oggi;
  const domani = new Date(data);
  domani.setDate(domani.getDate() + 1);
  const detti = memoria.get("rifiuti:sera");
  if (mattina && detti?.per === data.toDateString())
    righe = righe.filter((r) => !detti.materiali.includes(r.materiale));
  if (!righe.length) return [];
  const materiali = [...new Set(righe.map((r) => r.materiale))].sort();
  if (sera) memoria.set("rifiuti:sera", { per: domani.toDateString(), materiali });
  const nomi = (lingua) => [
    ...new Set(
      righe.map(
        (r) =>
          r.nome ||
          (PAROLE_DEI_RIFIUTI[r.materiale] || PAROLE_DEI_RIFIUTI.altro)[lingua === "en" ? 1 : 0],
      ),
    ),
  ];
  const piu = nomi("it").length > 1;
  const chiave = `suggerimenti:rifiuti:${materiali.join("+")}`;
  const cosaEn = eAnche(nomi("en"), "en");
  return [
    {
      tipo: "suggerimenti",
      urgenza: "bassa",
      importante: false,
      chiave,
      volta: `${chiave}:${sera ? "sera" : "mattina"}`,
      pausa: 6 * ORA,
      parole: {
        it: {
          titolo: `🗑️ ${sera ? "Domani" : "Oggi"} ritirano ${eAnche(nomi("it"), "it")}`,
          testo: sera
            ? `Stasera ${piu ? "sono" : "è"} da mettere fuori.`
            : `${piu ? "Sono" : "È"} da mettere fuori stamattina.`,
        },
        en: {
          titolo: `🗑️ ${cosaEn.charAt(0).toUpperCase()}${cosaEn.slice(1)} collection ${sera ? "tomorrow" : "today"}`,
          testo: sera ? "Put it out tonight." : "Put it out this morning.",
        },
      },
      azioni: [
        tastoBasta(duePassi("Fatto", "Done")),
        { id: "dopo", parole: duePassi("Ricordamelo dopo", "Remind me later"), piuTardi: true },
      ],
    },
  ];
}

/* ─── 8. Un appuntamento che sta per cominciare ──────────────────────────── */

/* L'inizio di un evento del calendario: Home Assistant lo scrive «2026-10-19
 * 18:30:00», nell'ora di casa. */
function inizioDi(testo) {
  const scritto = String(testo || "").trim();
  if (!scritto) return null;
  const quando = Date.parse(scritto.includes("T") ? scritto : scritto.replace(" ", "T"));
  return Number.isFinite(quando) ? quando : null;
}

const oraMinuti = (istante) => {
  const d = new Date(istante);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * Un evento di un calendario (`calendar.*`) che comincia fra venticinque e
 * trentacinque minuti, non di tutto il giorno.
 */
export function appuntamento(vista) {
  const { ora } = vista;
  const fuori = [];
  for (const [id, stato] of gliStati(vista, "calendar")) {
    const a = stato.attributes || {};
    if (a.all_day === true || a.all_day === "true") continue;
    const inizio = inizioDi(a.start_time);
    if (inizio === null) continue;
    const fra = inizio - ora;
    if (fra < APPUNTAMENTO_FRA[0] || fra > APPUNTAMENTO_FRA[1]) continue;
    const minuti = Math.round(fra / MINUTO);
    const cosa = String(a.message || "")
      .trim()
      .slice(0, 80);
    const dove = String(a.location || "")
      .trim()
      .slice(0, 60);
    fuori.push({
      tipo: "suggerimenti",
      urgenza: "bassa",
      importante: false,
      chiave: `suggerimenti:appuntamento:${id}:${a.start_time}`,
      pausa: ORA,
      entita: id,
      parole: {
        it: {
          titolo: `📅 Fra ${minuti} minuti: ${cosa || "un impegno"}`,
          testo: `alle ${oraMinuti(inizio)}${dove ? ` · ${dove}` : ""}`,
        },
        en: {
          titolo: `📅 In ${minuti} minutes: ${cosa || "an appointment"}`,
          testo: `at ${oraMinuti(inizio)}${dove ? ` · ${dove}` : ""}`,
        },
      },
      azioni: [tastoGuarda(), tastoBasta(duePassi("Ok", "OK"))],
    });
  }
  return fuori;
}

/* ─── 9. Una stanza troppo calda o troppo fredda ─────────────────────────── */

/* Se un sensore e' dentro casa: non all'aperto, ne' dal nome ne' dall'area. */
function eDiCasa(vista, id, stato) {
  const testo = `${id} ${nomeDi(stato, id)} ${areaDi(vista, id)}`;
  return !ALL_APERTO.test(testo);
}

/**
 * Con qualcuno in casa, un termometro di una stanza sopra i 27 o sotto i 16
 * gradi da mezz'ora. Se nella stessa area c'e' un clima spento, «Accendi il
 * clima»; se ce n'e' uno acceso, ci sta gia' pensando lui, e non si dice.
 */
export function comfort(vista) {
  const { ora, vuota, memoria } = vista;
  const fuori = [];
  const viste = new Set();
  for (const [id, stato] of gliStati(vista, "sensor")) {
    if (stato.attributes?.device_class !== "temperature") continue;
    if (!eDiCasa(vista, id, stato) || NON_E_UNA_STANZA.test(`${id} ${nomeDi(stato, id)}`)) continue;
    const t = gradi(stato);
    const fuoriMisura = vuota === false && t !== null && (t >= TROPPO_CALDO || t <= TROPPO_FREDDO);
    if (regge(memoria, `comfort:${id}`, fuoriMisura, ora) < COMFORT_DA || !fuoriMisura) continue;
    const area = areaDi(vista, id);
    const dove = area || nomePulito(nomeDi(stato, id));
    if (viste.has(dove.toLowerCase())) continue;
    viste.add(dove.toLowerCase());
    const climi = area
      ? [...gliStati(vista, "climate")].filter(([uno]) => stessaArea(areaDi(vista, uno), area))
      : [];
    if (climi.some(([, s]) => !["off", "unavailable", "unknown"].includes(s.state))) continue;
    const spento = climi.find(([, s]) => s.state === "off")?.[0] || "";
    const caldo = t >= TROPPO_CALDO;
    fuori.push({
      tipo: "suggerimenti",
      urgenza: "bassa",
      importante: false,
      chiave: `suggerimenti:comfort:${dove.toLowerCase()}`,
      pausa: 3 * ORA,
      entita: id,
      parole: {
        it: {
          titolo: `${caldo ? "🥵" : "🥶"} ${dove}: ${Math.round(t)} °C`,
          testo: spento
            ? "Qualcuno è in casa. Accendo il clima?"
            : `Qualcuno è in casa, e fa ${caldo ? "caldo" : "freddo"}.`,
        },
        en: {
          titolo: `${caldo ? "🥵" : "🥶"} ${dove}: ${Math.round(t)} °C`,
          testo: spento
            ? "Someone is home. Turn on the climate?"
            : `Someone is home, and it's ${caldo ? "hot" : "cold"}.`,
        },
      },
      azioni: [
        spento
          ? {
              id: "accendi",
              parole: duePassi("Accendi il clima", "Turn on climate"),
              servizio: { dominio: "climate", servizio: "turn_on", entita: [spento] },
            }
          : tastoGuarda(),
        tastoBasta(),
      ],
    });
  }
  return fuori;
}

/* ─── 10. L'aria da cambiare ─────────────────────────────────────────────── */

/**
 * Con qualcuno in casa, la CO₂ sopra i 1200 ppm o l'umidita' sopra il 75%
 * in una stanza da un quarto d'ora. Con una ventola (`fan.*`) spenta nella
 * stessa area, «Accendi la ventilazione»; con una gia' accesa non si dice.
 */
export function aria(vista) {
  const { ora, vuota, memoria } = vista;
  const fuori = [];
  const viste = new Set();
  for (const [id, stato] of gliStati(vista, "sensor")) {
    const classe = stato.attributes?.device_class;
    if (classe !== "carbon_dioxide" && classe !== "humidity") continue;
    if (!eDiCasa(vista, id, stato)) continue;
    const valore = numero(stato.state);
    const soglia = classe === "carbon_dioxide" ? CO2_ALTA : UMIDITA_ALTA;
    const pesante = vuota === false && valore !== null && valore >= soglia;
    if (regge(memoria, `aria:${id}`, pesante, ora) < ARIA_DA || !pesante) continue;
    const area = areaDi(vista, id);
    const dove = area || nomePulito(nomeDi(stato, id));
    if (viste.has(dove.toLowerCase())) continue;
    viste.add(dove.toLowerCase());
    const ventole = area
      ? [...gliStati(vista, "fan")].filter(([uno]) => stessaArea(areaDi(vista, uno), area))
      : [];
    if (ventole.some(([, s]) => s.state === "on")) continue;
    const ventola = ventole.find(([, s]) => s.state === "off")?.[0] || "";
    const misura = (lingua) =>
      classe === "carbon_dioxide"
        ? `CO₂ ${migliaia(valore, lingua)} ppm`
        : `${lingua === "en" ? "Humidity" : "Umidità"} ${Math.round(valore)}%`;
    fuori.push({
      tipo: "suggerimenti",
      urgenza: "bassa",
      importante: false,
      chiave: `suggerimenti:aria:${dove.toLowerCase()}`,
      pausa: 3 * ORA,
      entita: id,
      parole: {
        it: {
          titolo: `💨 Aria da cambiare in ${dove}`,
          testo: ventola
            ? `${misura("it")}. Accendo la ventilazione?`
            : `${misura("it")}. Meglio aprire una finestra per qualche minuto.`,
        },
        en: {
          titolo: `💨 ${dove} needs fresh air`,
          testo: ventola
            ? `${misura("en")}. Turn on the ventilation?`
            : `${misura("en")}. Open a window for a few minutes.`,
        },
      },
      azioni: [
        ...(ventola
          ? [
              {
                id: "ventila",
                parole: duePassi("Accendi la ventilazione", "Turn on ventilation"),
                servizio: { dominio: "fan", servizio: "turn_on", entita: [ventola] },
              },
            ]
          : []),
        tastoBasta(),
      ],
    });
  }
  return fuori;
}

/* ─── 11. I dispositivi che non rispondono ───────────────────────────────── */

/**
 * Una volta al giorno, alle dieci: i dispositivi che non rispondono da sei
 * ore. Un dispositivo e' muto quando nessuna delle sue entita' risponde (la
 * stessa regola del riepilogo, `cosaSistemare`), e conta una volta; le entita'
 * nascoste, disattivate o di diagnostica non contano. Senza registri non si
 * sa di chi e' un'entita', e non si dice.
 */
export function nonRispondono(vista) {
  const { ora, data, memoria } = vista;
  if (!dentro(data, [MANUTENZIONE_DALLE, MANUTENZIONE_ALLE])) return [];
  if (memoria.get("non-rispondono:giorno") === giornoDi(ora)) return [];
  const dispositivi = new Map();
  for (const [id, stato] of vista.stati) {
    const suo = vista.dispositivoDi?.[id];
    if (!suo || vista.daNonContare?.has?.(id)) continue;
    const voce = dispositivi.get(suo) || { vivo: false, da: 0, primo: id };
    if (stato.state === "unavailable") voce.da = Math.max(voce.da, stato.dal);
    else voce.vivo = true;
    dispositivi.set(suo, voce);
  }
  const muti = [...dispositivi]
    .filter(([, v]) => !v.vivo && ora - v.da >= MUTO_DA)
    .map(([suo, v]) => ({
      nome: String(
        vista.nomiDeiDispositivi?.[suo] || nomePulito(nomeDi(vista.stati.get(v.primo), v.primo)),
      ).slice(0, 40),
      da: ora - v.da,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  if (!muti.length) return [];
  memoria.set("non-rispondono:giorno", giornoDi(ora));
  const da = Math.min(...muti.map((m) => m.da));
  const nomi = muti.map((m) => m.nome);
  const uno = muti.length === 1;
  return [
    {
      tipo: "suggerimenti",
      urgenza: "bassa",
      importante: false,
      chiave: "suggerimenti:non-rispondono",
      pausa: 12 * ORA,
      parole: {
        it: {
          titolo: uno
            ? `📡 ${nomi[0]} non risponde`
            : `📡 ${muti.length} dispositivi non rispondono`,
          testo: `${elenco(nomi, "it")} · da ${perQuanto(da)}.`,
        },
        en: {
          titolo: uno
            ? `📡 ${nomi[0]} is not responding`
            : `📡 ${muti.length} devices are not responding`,
          testo: `${elenco(nomi, "en")} · for ${perQuanto(da, "en")}.`,
        },
      },
      azioni: [tastoGuarda(), tastoBasta()],
    },
  ];
}

/* ─── 12. Gli aggiornamenti ──────────────────────────────────────────────── */

/**
 * Gli aggiornamenti in attesa (`update.*` accesi): una volta al giorno alle
 * dieci, o quando ne arriva uno nuovo. Al primo giro dopo l'accensione del
 * ponte si conta e basta: quelli che c'erano gia' non sono una novita'.
 */
export function aggiornamenti(vista) {
  const { ora, data, memoria } = vista;
  const attesi = [];
  for (const [id, stato] of gliStati(vista, "update")) {
    if (stato.state !== "on" || vista.daNonContare?.has?.(id)) continue;
    attesi.push(String(stato.attributes?.title || nomeDi(stato, id)).slice(0, 40));
  }
  const prima = memoria.get("aggiornamenti:quanti");
  memoria.set("aggiornamenti:quanti", attesi.length);
  if (!attesi.length) return [];
  const oggi = giornoDi(ora);
  const finestra =
    dentro(data, [MANUTENZIONE_DALLE, MANUTENZIONE_ALLE]) &&
    memoria.get("aggiornamenti:giorno") !== oggi;
  const crescono = prima !== undefined && attesi.length > prima;
  if (!finestra && !crescono) return [];
  memoria.set("aggiornamenti:giorno", oggi);
  const uno = attesi.length === 1;
  return [
    {
      tipo: "suggerimenti",
      urgenza: "bassa",
      importante: false,
      chiave: "suggerimenti:aggiornamenti",
      volta: `suggerimenti:aggiornamenti:${attesi.length}`,
      pausa: 30 * MINUTO,
      parole: {
        it: {
          titolo: uno
            ? "⬆️ 1 aggiornamento in attesa"
            : `⬆️ ${attesi.length} aggiornamenti in attesa`,
          testo: `${elenco(attesi, "it")}.`,
        },
        en: {
          titolo: uno ? "⬆️ 1 update waiting" : `⬆️ ${attesi.length} updates waiting`,
          testo: `${elenco(attesi, "en")}.`,
        },
      },
      azioni: [tastoGuarda(), tastoPiuTardi()],
    },
  ];
}

/* ─── Tutte insieme ──────────────────────────────────────────────────────── */

/** Le regole, nell'ordine in cui si guardano: prima la sicurezza. */
export const REGOLE_DELL_ASSISTENTE = Object.freeze([
  ["serrature", serrature],
  ["finestra-clima", finestraClima],
  ["rete-alta", reteAlta],
  ["notte-luci", notteLuci],
  ["sole-elettrodomestico", soleElettrodomestico],
  ["sole-auto", soleAuto],
  ["rifiuti", rifiuti],
  ["appuntamento", appuntamento],
  ["comfort", comfort],
  ["aria", aria],
  ["non-rispondono", nonRispondono],
  ["aggiornamenti", aggiornamenti],
]);

/**
 * Tutti gli eventi dell'assistente, adesso. Una regola che cade non ferma le
 * altre: `sbaglia(nome, errore)` lo racconta a chi tiene il registro.
 */
export function regoleDellAssistente(vista, { sbaglia = () => {} } = {}) {
  const v = {
    ...vista,
    data: vista.data || new Date(vista.ora),
    notte: vista.notte ?? eNotte(new Date(vista.ora)),
    memoria: vista.memoria || new Map(),
    statiComeOggetto: vista.statiComeOggetto || (() => Object.fromEntries(vista.stati)),
    risolvi: vista.risolvi || (() => ""),
  };
  const fuori = [];
  for (const [nome, regola] of REGOLE_DELL_ASSISTENTE) {
    try {
      fuori.push(...regola(v));
    } catch (errore) {
      sbaglia(nome, errore);
    }
  }
  return fuori;
}
