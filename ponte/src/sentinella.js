/* La sentinella: guarda la casa e dice quando c'e' qualcosa da dire.
 *
 * Non manda niente a nessuno. Guarda gli stati di Home Assistant — tutti
 * all'inizio, poi uno alla volta a ogni `state_changed` — e quando una regola
 * scatta tira fuori un **evento**: cos'e' successo, quanto e' urgente, di che
 * categoria e', con che parole dirlo e quali tasti metterci sotto. A chi
 * mandarlo, e se, lo decide `notifiche.js`, che sa dei telefoni, delle
 * persone, delle ore di silenzio e di chi vede quale telecamera.
 *
 * Le regole stanno tutte sul ponte, e non nell'app: il telefono puo' essere
 * spento, e la casa no. E stanno qui, in un posto solo, scritte come funzioni
 * di quello che si vede, cosi' una prova le accende con una casa finta e un
 * orologio finto e guarda cosa dicono.
 *
 * Le regole riconoscono le cose come le riconosce Home Assistant: per
 * `device_class` prima di tutto, e per nome solo dove Home Assistant una
 * classe non ce l'ha (un frigorifero, una lavatrice). Una regola che non
 * trova niente in casa non dice niente: una casa senza antifurto non riceve
 * «antifurto scattato», e una senza persone non sa quando e' vuota — e allora
 * non lo dice, invece di indovinare.
 */

import { CapireLaCasa, cosaApre, nomePulito } from "./capire-la-casa.js";
import {
  chiamataDelModo,
  ilModoChiedeIlCodice,
  modoCheDisinserisce,
  modoPerInserire,
  modoSuMisuraAcceso,
  normalizzaModiSuMisura,
  normalizzaScattato,
  SPEGNI_LA_SIRENA,
  valeScattato,
  CASELLA_DELLO_SCATTATO,
  CHIAVE_ANTIFURTO_SCATTATO,
  CHIAVE_ANTIFURTO_SU_MISURA,
} from "../plancia/src/core/antifurto-su-misura.js";
import { gliUps } from "./gli-ups.js";
import {
  carichiDellaPlancia,
  fasciaPiuBassa,
  giornoDi,
  letturaDellEnergia,
  prezzoAllOra,
} from "./l-energia-di-casa.js";
import { risolutoreDalla } from "./ricarica-di-notte.js";
import { batterieDiCasa } from "./la-giornata-di-casa.js";
import {
  elettrodomesticoDellaPlancia,
  tipoDellElettrodomestico,
} from "./il-tipo-dell-elettrodomestico.js";
import { laPappa, normalizzaAnimali } from "../plancia/src/core/animali-model.js";
import { CHIAVE_CITOFONO, normalizzaIngresso } from "../plancia/src/core/citofono-e-posta.js";
import { accesoPerIlConsumo } from "../plancia/src/core/consumo-del-clima.js";
import { canonicalClimateType } from "../plancia/src/core/device-model.js";
import { eUnTermostatoACoppia } from "../plancia/src/core/i-due-obiettivi-del-clima.js";
import { righeDichiarate } from "../plancia/src/core/elenco-dichiarato.js";
import {
  CAMPI_IN_PIU,
  CHIAVE_VARCHI,
  contattiDichiaratiNelleFinestre,
  eUnContatto,
  varchiConLeFinestre,
  varchiDiCasa,
} from "../plancia/src/core/varchi-di-casa.js";
import { CHIAVE_VERSI, insiemeInvertiti } from "../plancia/src/core/verso-aperture.js";
import { regoleDellAssistente } from "./l-assistente-al-telefono.js";
import {
  paroleDelBlackout,
  paroleDelCiclo,
  paroleDelMovimento,
  paroleDellAntifurto,
} from "./parole-delle-notifiche.js";

const MINUTO = 60 * 1000;
const ORA = 60 * MINUTO;

/* Le tre urgenze, e i loro nomi sul filo. */
export const URGENZE = Object.freeze(["bassa", "normale", "urgente"]);

/* Le categorie della pagina «Notifiche» nell'app, e gli eventi di ognuna. Il
 * nome dell'evento e' anche la chiave del suo interruttore nelle impostazioni
 * di un telefono (`notifiche.js`). */
export const CATEGORIE = Object.freeze({
  urgenti: ["antifurto", "allarmi", "campanello", "blackout"],
  sicurezza: ["inserimenti", "uscito", "aperture", "movimento"],
  casa: ["elettrodomestici", "frigo", "pioggia", "animali"],
  persone: ["arrivi"],
  assistente: ["suggerimenti"],
  manutenzione: ["riepilogo"],
  personalizzate: ["personalizzata"],
  /* I viaggi pianificati di gdanav (`viaggi.js`): «parti fra 10 minuti». */
  viaggi: ["viaggi"],
  /* Le notifiche delle automazioni di Home Assistant, anche in GdAHome
   * (`notifiche-di-home-assistant.js`). */
  homeassistant: ["ha_notify"],
});

export const EVENTI = Object.freeze(Object.values(CATEGORIE).flat());

export function categoriaDi(tipo) {
  for (const [categoria, tipi] of Object.entries(CATEGORIE))
    if (tipi.includes(tipo)) return categoria;
  return null;
}

/* ─── Come si riconoscono le cose ──────────────────────────────────────── */

const ALLARMI = Object.freeze({
  moisture: { it: "Allagamento", en: "Water leak", emoji: "💧" },
  smoke: { it: "Fumo", en: "Smoke", emoji: "🔥" },
  gas: { it: "Gas", en: "Gas", emoji: "⚠️" },
  carbon_monoxide: { it: "Monossido di carbonio", en: "Carbon monoxide", emoji: "⚠️" },
});

/* Gli stati dell'antifurto che si dicono quando cambiano: ogni modo di
 * inserirlo, e il disinserito. Non i passaggi («arming», «pending») ne'
 * lo scattato, che ha la sua notifica urgente. */
const MODI_DELL_ANTIFURTO = Object.freeze({
  armed_away: { it: "Inserito totale", en: "Armed away", emoji: "🔒" },
  armed_home: { it: "Inserito parziale (casa)", en: "Armed home", emoji: "🏠" },
  armed_night: { it: "Inserito notte", en: "Armed night", emoji: "🌙" },
  armed_vacation: { it: "Inserito vacanza", en: "Armed vacation", emoji: "🧳" },
  armed_custom_bypass: { it: "Inserito personalizzato", en: "Armed custom", emoji: "🛡️" },
  disarmed: { it: "Disinserito", en: "Disarmed", emoji: "🔓" },
});

const APERTURE = new Set(["door", "garage_door", "opening"]);
const COPERTURE_APERTE = new Set(["garage", "gate", "door"]);
const MOVIMENTO = new Set(["motion", "occupancy", "presence"]);

/* Anche «visitor» (Reolink) e «chime»: i citofoni non dicono tutti
 * «doorbell». Chi ha un nome diverso ancora lo sceglie nel Citofono della
 * plancia ([Sentinella._campanelliDellaPlancia]). */
const NOME_DEL_CAMPANELLO = /campanell|doorbell|citofon|ding|visitor|chime|suoneria/i;
/* Per gli eventi la parola intera: «ding» dentro «building» non e' un campanello. */
const EVENTO_DEL_CAMPANELLO = /campanell|doorbell|citofon|intercom|(^|[._])ding([._]|$)/i;
const NOME_DEL_CANCELLO = /cancell|gate|portone|cancel/i;
const NOME_DELLA_PIOGGIA = /pioggia|piove|rain/i;
const NOME_ELETTRODOMESTICO =
  /lavatric|lavastovigl|asciugatric|washer|washing|dishwasher|dryer|lavasciug/i;
const NOME_DEL_FREEZER = /freezer|congelator/i;

/* Il genere di un elettrodomestico, per non dirlo due volte. La lavastoviglie
 * prima della lavatrice: «dishwasher» contiene «washer». */
const GENERI_DI_ELETTRODOMESTICO = [
  ["lavastoviglie", /lavastovigl|dishwasher/i],
  ["lavasciuga", /lavasciug|washer.?dryer/i],
  ["asciugatrice", /asciugatric|dryer/i],
  ["lavatrice", /lavatric|washer|washing/i],
];
export function genereDiElettrodomestico(testo) {
  for (const [genere, forma] of GENERI_DI_ELETTRODOMESTICO) if (forma.test(testo)) return genere;
  return String(testo);
}
const STESSO_ELETTRODOMESTICO = 15 * 60 * 1000;

/* Il nome senza quello che dice la presa: «asciugatrice W», «Lavatrice
 * potenza», «Lavastoviglie kW» sono l'elettrodomestico, con la maiuscola. */
export function nomeDellElettrodomestico(nome) {
  const pulito = String(nome)
    .replace(/\b(potenza|power|consumo|watt|k?w)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!pulito) return String(nome);
  return pulito.charAt(0).toUpperCase() + pulito.slice(1);
}
const NOME_DEL_FRIGO = /frigo|fridge|refrigerat/i;

const PIOVE = new Set(["rainy", "pouring", "lightning-rainy", "hail", "snowy-rainy"]);
const FINITO =
  /^(finished|finish|end|ended|done|complete|completed|finito|terminato|completato|fine)$/i;

/* Le soglie di un frigorifero e di un congelatore: oltre, per un quarto
 * d'ora, si dice. Sono quelle di chi li vende, con un margine. */
const SOGLIA_DEL_FREEZER = -12;
const SOGLIA_DEL_FRIGO = 8;

/* Quanto deve durare una cosa perche' la si dica. Una porta aperta per un
 * minuto e' una porta che si sta chiudendo. */
const APERTA_DA = 10 * MINUTO;
const FRIGO_CALDO_DA = 15 * MINUTO;
const PORTA_DEL_FRIGO_DA = 3 * MINUTO;
const LUCI_CON_CASA_VUOTA_DA = 30 * MINUTO;
/* La casa dorme: niente luci e niente movimento da venti minuti. */
const CASA_CHE_DORME_DA = 20 * MINUTO;
const CLIMA_CON_CASA_VUOTA_DA = 60 * MINUTO;
const ELETTRODOMESTICO_ACCESO = 15; // W
const ELETTRODOMESTICO_FERMO = 5; // W
const ELETTRODOMESTICO_GIRA_ALMENO = 10 * MINUTO;
const ELETTRODOMESTICO_FERMO_DA = 5 * MINUTO;

/* Di notte: dalle dieci di sera alle sei del mattino, nell'ora di casa. */
export function eNotte(data) {
  const ora = data.getHours();
  return ora >= 22 || ora < 6;
}

/* Le parole che dicono dov'e' una cosa: dall'identificativo e dal nome, senza
 * quelle che dicono cos'e' («motion», «camera», «rilevamento»…), che due
 * sensori di due telecamere diverse hanno uguali. */
const PAROLE_DI_TUTTI =
  /^(binary|sensor|sensore|camera|telecamera|motion|movimento|detection|detected|rilevamento|rilevato|line|crossing|attraversamento|intrusion|intrusione|occupancy|presence|presenza|field|alarm|allarme|stream|main|snapshot)$/;
export function paroleDelNome(id, nome = "") {
  const testo = `${String(id || "").split(".")[1] || ""} ${String(nome || "")}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return new Set(
    testo.split(/[^a-z0-9]+/).filter((una) => una.length > 3 && !PAROLE_DI_TUTTI.test(una)),
  );
}

/* Il nome di un'entita': quello che le ha dato chi l'ha messa, o — senza —
 * dall'identificativo, con la prima lettera grande: «casa_al_lago» era
 * «casa al lago» in testa alla notifica. */
export const nomeDi = (stato, id) => {
  const scritto = stato?.attributes?.friendly_name;
  if (scritto) return String(scritto).slice(0, 60);
  const daLId = String(id || "")
    .split(".")[1]
    ?.replace(/_/g, " ")
    .trim();
  if (!daLId) return String(id || "").slice(0, 60);
  return (daLId[0].toUpperCase() + daLId.slice(1)).slice(0, 60);
};

export const dominioDi = (id) => String(id).split(".")[0];

const numero = (valore) => {
  const n = Number(String(valore ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const duePassi = (it, en) => ({ it, en });

/* Le parole semplici di un racconto, nelle due lingue: le stesse che
 * `notifiche.js` scrive a chi ha scelto le notifiche semplici. */
const inDueLingue = (comporre, dati) => {
  const it = comporre(dati, "it");
  const en = comporre(dati, "en");
  return { it: { titolo: it.titolo, testo: it.testo }, en: { titolo: en.titolo, testo: en.testo } };
};

const oraMinuti = (istante) => {
  const d = new Date(istante);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/* Il servizio di un tasto su misura, nella forma dei tasti delle notifiche:
 * dominio, servizio, entita' e — per un menu — l'opzione da scegliere. */
function servizioDelModo(modo) {
  const chiamata = chiamataDelModo(modo);
  if (!chiamata) return null;
  return {
    dominio: chiamata.domain,
    servizio: chiamata.service,
    entita: [chiamata.entity],
    ...(chiamata.data.option ? { dati: { option: chiamata.data.option } } : {}),
  };
}

const oraSecondi = (istante) => {
  const d = new Date(istante);
  return `${oraMinuti(istante)}:${String(d.getSeconds()).padStart(2, "0")}`;
};

/* Per quanto, detto a una persona. */
export function perQuanto(ms, lingua = "it") {
  const minuti = Math.max(1, Math.round(ms / MINUTO));
  if (minuti < 60) return `${minuti} min`;
  const ore = Math.round(minuti / 60);
  return lingua === "en" ? `${ore} h` : `${ore} h`;
}

/* ─── Le parole delle regole ───────────────────────────────────────────
 *
 * Come si dice ogni notifica che non ha un racconto
 * (`parole-delle-notifiche.js`): le stesse funzioni per la regola vera e per
 * l'esempio di «Prova: mandamela adesso» (`notifiche.js`, `esempioDi`), cosi'
 * la prova arriva con le parole e i tasti di quella vera. */

/** «Guarda», sotto una notifica: apre l'app. */
export const tastoGuarda = () => ({ id: "guarda", parole: duePassi("Guarda", "View"), apre: true });

/** L'antifurto inserito in un modo, o disinserito. `null` per uno stato che non si dice. */
export function paroleDellInserimento(stato, nome, chi = "") {
  const modo = MODI_DELL_ANTIFURTO[stato];
  if (!modo) return null;
  return {
    it: {
      titolo: `${modo.emoji} Antifurto · ${modo.it}`,
      testo: chi ? `${nome} · da ${chi}` : nome,
    },
    en: {
      titolo: `${modo.emoji} Alarm · ${modo.en}`,
      testo: chi ? `${nome} · by ${chi}` : nome,
    },
  };
}

/** Allagamento, fumo, gas, monossido: `classe` e' la `device_class`. */
export function paroleDellAllarme(classe, nome) {
  const cosa = ALLARMI[classe];
  if (!cosa) return null;
  return {
    it: {
      titolo: `${cosa.emoji} ${cosa.it} · ${nome}`,
      testo: "Il sensore se n'è accorto adesso",
    },
    en: { titolo: `${cosa.emoji} ${cosa.en} · ${nome}`, testo: "The sensor just noticed" },
  };
}

export function paroleDelCampanello(nome) {
  return {
    it: { titolo: "🔔 Suona il campanello", testo: `${nome} · adesso` },
    en: { titolo: "🔔 Someone's at the door", testo: `${nome} · now` },
  };
}

/**
 * Se il campanello scelto nel Citofono ha suonato, da com'era a com'e': un
 * evento o un pulsante che cambia (l'ora dell'ultima pressione), un sensore
 * che si accende, o che dice «ring». Mai da o verso «unavailable».
 */
export function suonaIlCitofono(dominio, era, adesso) {
  if (era === adesso || !adesso) return false;
  if (
    ["unavailable", "unknown"].includes(adesso) ||
    ["unavailable", "unknown", undefined].includes(era)
  )
    return false;
  if (["event", "button", "input_button"].includes(dominio)) return true;
  if (["binary_sensor", "switch", "input_boolean"].includes(dominio))
    return adesso === "on" && era === "off";
  if (dominio === "sensor")
    return (
      /^(on|ring|ringing|ding|pressed|true|1)$/i.test(adesso) || !Number.isNaN(Date.parse(adesso))
    );
  return adesso === "on";
}

/** Cosa apre il Citofono: una serratura, un cancello, un pulsante. */
function apriDalCitofono(id) {
  const dominio = dominioDi(String(id || ""));
  if (dominio === "lock") return { dominio: "lock", servizio: "unlock", entita: [id] };
  if (dominio === "cover") return { dominio: "cover", servizio: "open_cover", entita: [id] };
  if (dominio === "button") return { dominio: "button", servizio: "press", entita: [id] };
  return null;
}

/**
 * Se un clima sta lavorando davvero, non solo se e' in un modo diverso da
 * «off». Dal campo: «mi arriva sempre la notifica del clima acceso, ma e'
 * tutto spento». Un termostato col programma resta in «heat» o «auto» tutto
 * il giorno, e la plancia lo mostra spento quando `hvac_action` dice che e'
 * fermo («idle», «off»): conta quello. Senza `hvac_action`, il modo.
 */
export function climaCheLavora(stato) {
  const modo = String(stato?.state ?? "").toLowerCase();
  if (["off", "unavailable", "unknown", ""].includes(modo)) return false;
  const azione = String(stato?.attributes?.hvac_action ?? "").toLowerCase();
  if (azione)
    return ["heating", "preheating", "cooling", "drying", "fan", "defrosting"].includes(azione);
  return true;
}

/**
 * Il clima acceso come lo dice la plancia: chi ha messo una presa con la
 * soglia (`cd_clima_units`, `consumo` e `soglia_consumo`) lo legge dai watt —
 * un condizionatore spento col telecomando resta in «cool» per Home
 * Assistant, e la presa dice la verita'. Senza presa, `climaCheLavora`.
 * «Per il clima pero' lo da' ancora acceso»: le notifiche non guardavano i
 * watt, e la plancia si'.
 */
export function climaAcceso(id, stato, unita = [], statoDi = () => undefined) {
  const sua = (Array.isArray(unita) ? unita : []).find(
    (u) => String(u?.entity ?? "").trim() === id,
  );
  const presa = String(sua?.consumo ?? "").trim();
  if (sua && presa) {
    const daiWatt = accesoPerIlConsumo(sua, { [presa]: statoDi(presa) });
    if (daiWatt !== null) return daiWatt;
  }
  if (eUnTermostato(stato, sua)) return termostatoCheScalda(stato);
  return climaCheLavora(stato);
}

/* Le modalita' di chi raffresca: chi ne ha una e' un condizionatore o una
 * pompa di calore, non un termostato del riscaldamento. */
const MODI_DEL_FREDDO = new Set(["cool", "dry", "fan_only", "heat_cool"]);

/**
 * Un termostato: la valvola del termosifone, il cronotermostato della
 * caldaia, il termostato a coppia.
 *
 * «Sul clima devi vedere il discorso termostato, e' questo il problema
 * reale.» Un termostato sta in «heat» tutto l'inverno, giorno e notte, e
 * questo e' il suo mestiere: non e' un clima lasciato acceso. Si riconosce dal
 * tipo scritto nella plancia (`termo` nel Clima), dalle modalita' (scalda e
 * basta: nessuna del freddo) o dai due obiettivi del termostato a coppia.
 */
export function eUnTermostato(stato, unita = null) {
  if (unita && canonicalClimateType(unita.type) === "termo") return true;
  const attributi = stato?.attributes || {};
  if (eUnTermostatoACoppia(attributi)) return true;
  const modi = Array.isArray(attributi.hvac_modes)
    ? attributi.hvac_modes.map((m) => String(m).toLowerCase())
    : [];
  return modi.includes("heat") && !modi.some((m) => MODI_DEL_FREDDO.has(m));
}

/**
 * Se un termostato sta scaldando adesso — non se e' in «heat». Lo dice
 * `hvac_action`; chi non lo pubblica (tante valvole) scalda solo se la stanza
 * e' sotto l'obiettivo di almeno mezzo grado, come nel riepilogo della sera.
 */
export function termostatoCheScalda(stato) {
  const modo = String(stato?.state ?? "").toLowerCase();
  if (["off", "unavailable", "unknown", ""].includes(modo)) return false;
  const attributi = stato?.attributes || {};
  const azione = String(attributi.hvac_action ?? "").toLowerCase();
  if (azione) return ["heating", "preheating", "cooling"].includes(azione);
  const adesso = Number(attributi.current_temperature);
  const obiettivo = Number(attributi.temperature);
  if (!Number.isFinite(adesso) || !Number.isFinite(obiettivo)) return false;
  return adesso < obiettivo - 0.5;
}

/* Le unita' del clima della plancia, scritte come lista o come testo JSON. */
export function unitaDelClima(valori = {}) {
  const grezze = valori?.cd_clima_units;
  if (Array.isArray(grezze)) return grezze;
  if (typeof grezze === "string") {
    try {
      const lette = JSON.parse(grezze);
      return Array.isArray(lette) ? lette : [];
    } catch (_errore) {
      return [];
    }
  }
  return [];
}

/** I tasti del campanello: «Apri cancello» se c'e' un cancello, e «Ignora». */
export function tastiDelCampanello(cancello) {
  return [
    ...(cancello
      ? [{ id: "apri", parole: duePassi("Apri cancello", "Open gate"), servizio: cancello }]
      : []),
    { id: "ignora", parole: duePassi("Ignora", "Ignore"), ignora: true },
  ];
}

/** Una persona che arriva (`arriva`) o che esce. */
export function paroleDellArrivo(nome, arriva) {
  return arriva
    ? {
        it: { titolo: `🏠 ${nome} è arrivato a casa`, testo: "Adesso" },
        en: { titolo: `🏠 ${nome} got home`, testo: "Just now" },
      }
    : {
        it: { titolo: `👋 ${nome} è uscito`, testo: "Adesso" },
        en: { titolo: `👋 ${nome} left`, testo: "Just now" },
      };
}

/** L'ultimo esce e l'antifurto e' spento. */
export function paroleDellUscito(chi) {
  return {
    it: {
      titolo: "🛡️ Uscito senza antifurto",
      testo: `${chi} è l'ultimo a uscire e l'antifurto è spento`,
    },
    en: {
      titolo: "🛡️ Left without the alarm",
      testo: `${chi} was the last to leave and the alarm is off`,
    },
  };
}

/** «Inserisci» e «Più tardi»; con una centrale che vuole il codice, l'app. */
export function tastiDellUscito(centrale, { conCodice = false } = {}) {
  return conCodice
    ? [{ id: "guarda", parole: duePassi("Apri l'app", "Open the app"), apre: true }]
    : [
        {
          id: "inserisci",
          parole: duePassi("Inserisci", "Arm"),
          servizio: {
            dominio: "alarm_control_panel",
            servizio: "alarm_arm_away",
            entita: [centrale],
          },
        },
        { id: "piu-tardi", parole: duePassi("Più tardi", "Later"), piuTardi: true },
      ];
}

/** Una porta, una finestra o un garage rimasti aperti. `cosa` viene da
 * `cosaApre`; `da` sono i millisecondi; `ultima` l'ora dell'ultima uscita. */
export function paroleDellApertura({ dove, cosa, vuota, da, ultima = null }) {
  return {
    it: {
      titolo:
        vuota === true
          ? `🚪 ${dove}: ${cosa.it} aperta, in casa non c'è nessuno`
          : `🚪 ${dove}: la ${cosa.it} è ancora aperta`,
      testo:
        vuota === true
          ? `Aperta da ${perQuanto(da)}${ultima ? `, uscita l'ultima persona alle ${ultima}` : ""}.`
          : "In casa si dorme. Di solito di notte è chiusa.",
    },
    en: {
      titolo:
        vuota === true
          ? `🚪 ${dove}: ${cosa.en} open, nobody's home`
          : `🚪 ${dove}: the ${cosa.en} is still open`,
      testo:
        vuota === true
          ? `Open for ${perQuanto(da, "en")}${ultima ? `, last person left at ${ultima}` : ""}.`
          : "The house is asleep. It's usually closed at night.",
    },
  };
}

/** «Chiudi» (solo per una copertura), «Va bene così/stanotte», «Più tardi». */
export function tastiDellApertura(id, { copertura = false, vuota = false } = {}) {
  return [
    ...(copertura
      ? [
          {
            id: "chiudi",
            parole: duePassi("Chiudi", "Close"),
            servizio: { dominio: "cover", servizio: "close_cover", entita: [id] },
          },
        ]
      : []),
    {
      id: "va-bene",
      parole:
        vuota === true
          ? duePassi("Va bene così", "That's fine")
          : duePassi("Va bene stanotte", "Fine tonight"),
      vaBene: [id],
    },
    { id: "piu-tardi", parole: duePassi("Più tardi", "Later"), piuTardi: true },
  ];
}

/** E' l'ora della pappa: `nome` dell'animale (o la sua specie), `da` in ms
 * dall'ultima. */
export function paroleDellaPappa({ nome, specie, da }) {
  const chi = nome || { gatto: "del gatto", cane: "del cane" }[specie] || "dell'animale";
  const who = nome || { gatto: "the cat", cane: "the dog" }[specie] || "your pet";
  return {
    it: {
      titolo: `🍽️ È ora della pappa ${nome ? `di ${chi}` : chi}`,
      testo: `L'ultima ${perQuanto(da)} fa`,
    },
    en: { titolo: `🍽️ Feeding time for ${who}`, testo: `Last meal ${perQuanto(da, "en")} ago` },
  };
}

/** Il frigo o il congelatore troppo caldi: `valore` com'e' lo stato, `da` in ms. */
export function paroleDelFrigoCaldo({ nome, valore, unita = "°C", da }) {
  return {
    it: { titolo: `🧊 ${nome}: troppo caldo`, testo: `${valore} ${unita} da ${perQuanto(da)}` },
    en: {
      titolo: `🧊 ${nome}: too warm`,
      testo: `${valore} ${unita} for ${perQuanto(da, "en")}`,
    },
  };
}

export function paroleDellaPortaDelFrigo({ nome, da }) {
  return {
    it: { titolo: `🧊 ${nome}: porta aperta`, testo: `Aperta da ${perQuanto(da)}` },
    en: { titolo: `🧊 ${nome}: door open`, testo: `Open for ${perQuanto(da, "en")}` },
  };
}

/** Piove (o piovera' fra `fra` minuti) con queste finestre aperte. */
export function paroleDellaPioggia(aperte, { fra = null } = {}) {
  const quali = aperte.slice(0, 3).join(", ");
  return fra
    ? {
        it: { titolo: `🌧️ Tra ${fra} min piove`, testo: `Finestre aperte: ${quali}` },
        en: { titolo: `🌧️ Rain in ${fra} min`, testo: `Open windows: ${quali}` },
      }
    : {
        it: { titolo: "🌧️ Piove", testo: `Finestre aperte: ${quali}` },
        en: { titolo: "🌧️ It's raining", testo: `Open windows: ${quali}` },
      };
}

/** Le luci accese con la casa vuota da `per` ms: `accese` i nomi da spegnere,
 * `lasciate` quelli che l'assistente lascia stare. */
export function paroleDelleLuci({ per, accese, lasciate = [] }) {
  const quante = accese.length;
  /* Quelle lasciate stare si dicono, in una riga: chi legge sa che
   * l'assistente le ha viste, e perche' non le tocca. */
  const nomiLasciati = lasciate.slice(0, 2);
  const restaIt = nomiLasciati.length
    ? ` Restano accese ${nomiLasciati.join(", ")}${lasciate.length > 2 ? ` e altre ${lasciate.length - 2}` : ""}.`
    : "";
  const restaEn = nomiLasciati.length
    ? ` Leaving on ${nomiLasciati.join(", ")}${lasciate.length > 2 ? ` and ${lasciate.length - 2} more` : ""}.`
    : "";
  const elenco = (lingua) =>
    quante === 1
      ? accese[0]
      : `${accese.slice(0, 3).join(", ")}${quante > 3 ? (lingua === "en" ? ` and ${quante - 3} more` : ` e altre ${quante - 3}`) : ""}`;
  return {
    it: {
      titolo: `💡 Nessuno in casa da ${perQuanto(per)}`,
      testo: `${quante === 1 ? "Accesa" : "Accese"}: ${elenco("it")}.${restaIt} ${quante === 1 ? "La spengo?" : "Le spengo?"}`,
    },
    en: {
      titolo: `💡 Nobody home for ${perQuanto(per, "en")}`,
      testo: `On: ${elenco("en")}.${restaEn} Turn ${quante === 1 ? "it" : "them"} off?`,
    },
  };
}

/** «Spegni» spegne solo `entita` (non quelle lasciate stare), «Restano così»
 * se le ricorda, «Più tardi» rimanda. */
export function tastiDelleLuci(entita) {
  const quante = entita.length;
  return [
    {
      id: "spegni",
      parole:
        quante === 1
          ? duePassi("Spegni", "Turn off")
          : duePassi(`Spegni le ${quante} luci`, `Turn off ${quante} lights`),
      servizio: { dominio: "light", servizio: "turn_off", entita: entita.slice(0, 40) },
    },
    {
      id: "resta",
      parole:
        quante === 1
          ? duePassi("Resta così", "Leave it on")
          : duePassi("Restano così", "Leave them on"),
      resta: entita.slice(0, 40),
    },
    { id: "piu-tardi", parole: duePassi("Più tardi", "Later"), piuTardi: true },
  ];
}

/* ─── La sentinella ────────────────────────────────────────────────────── */

export class Sentinella {
  constructor({
    adesso = () => Date.now(),
    quando = () => {},
    registro = null,
    capire = null,
  } = {}) {
    this.adesso = adesso;
    /* Cosa sono le cose e cosa e' normale per questa casa
     * (`capire-la-casa.js`). Senza disco nelle prove. */
    this.capire = capire || new CapireLaCasa({ adesso, memoria: {} });
    this.quando = quando;
    this.registro = registro;
    /** Gli stati, per entita': `{state, attributes, dal}`. */
    this.stati = new Map();
    /** Di quale dispositivo e' ogni entita' (`registri.js`): serve a trovare
     * la telecamera dello stesso campanello. */
    this.dispositivoDi = {};
    /** L'area di ogni entita', col nome che le ha dato chi abita
     * (`registri.js`, via `notifiche.js`): «Cucina», «Taverna». Vuota senza
     * registri, e allora le regole che vogliono «la stessa stanza» tacciono. */
    this.aree = new Map();
    /** Le entita' che i registri dicono nascoste, disattivate o di
     * diagnostica: non contano fra i dispositivi muti. */
    this.daNonContare = new Set();
    /** Il nome di ogni dispositivo, per dire quale non risponde. */
    this.nomiDeiDispositivi = {};
    /** Le notifiche personalizzate, come le tiene `notifiche.js`. */
    this.personalizzate = [];
    /* Quello che una regola deve ricordarsi fra un giro e l'altro: da quando
     * un elettrodomestico gira, se una cosa lunga e' gia' stata detta. */
    this._memoria = new Map();
    /** La configurazione della plancia principale (i valori salvati): la
     * mette `notifiche.js`. Da qui si leggono le fasce, le caselle
     * dell'energia, gli UPS e l'antifurto su misura. */
    this.valori = () => ({});
    /** Il taccuino dell'energia (`l-energia-di-casa.js`): lo mette
     * `notifiche.js`. Senza, i conti dei cicli e della giornata non ci sono. */
    this.taccuino = null;
    /** Se almeno un telefono vuole il movimento sempre, anche con la gente in
     * casa e di giorno: lo dice `notifiche.js`. Di serie no — con qualcuno in
     * casa il movimento non e' una notizia. */
    this.movimentoSempre = false;
    /* Le ultime porte, finestre e movimenti accesi: «che cosa e' successo
     * prima» nella notifica dell'antifurto scattato. */
    this._recenti = [];
    /* Com'era ogni UPS al giro prima. */
    this._ups = new Map();
    this._conSole = false;
    /* Quello che le regole dell'assistente al telefono si ricordano fra un
     * giro e l'altro (`l-assistente-al-telefono.js`), e le chiavi che al giro
     * prima valevano: quelle che smettono di valere si riarmano. */
    this._memoriaDellAssistente = new Map();
    this._attiveDellAssistente = new Set();
  }

  /* ─── La configurazione della plancia ──────────────────────────────── */

  _valori() {
    try {
      return this.valori() || {};
    } catch (_errore) {
      return {};
    }
  }

  /* Casella della plancia → entita' (`dm.energy_potenza_fotovoltaico` →
   * `sensor.inverter_pv`). */
  _risolutore(valori = this._valori()) {
    const risolvi = risolutoreDalla(valori);
    return (casella) => {
      try {
        return risolvi(casella);
      } catch (_errore) {
        return "";
      }
    };
  }

  /* Gli stati nella forma di Home Assistant, per i moduli della plancia che
   * li vogliono come oggetto (`states[id].state`). Non si copia niente: si
   * guarda nella mappa quando chiedono. */
  statiComeOggetto() {
    const stati = this.stati;
    return new Proxy(
      {},
      {
        get(_t, id) {
          const st = stati.get(String(id));
          return st ? { ...st, last_changed: new Date(st.dal).toISOString() } : undefined;
        },
        has(_t, id) {
          return stati.has(String(id));
        },
        ownKeys() {
          return [...stati.keys()];
        },
        getOwnPropertyDescriptor(_t, id) {
          const st = stati.get(String(id));
          return st
            ? {
                enumerable: true,
                configurable: true,
                value: { ...st, last_changed: new Date(st.dal).toISOString() },
              }
            : undefined;
        },
      },
    );
  }

  /* Il prezzo della corrente in quell'istante, dalle fasce della plancia. */
  prezzo(istante, valori = this._valori()) {
    return prezzoAllOra(
      { fasce: valori.cd_fasce_kwh, costo: valori.cd_costo_kwh, stato: (id) => this.stati.get(id) },
      istante,
    );
  }

  /* L'antifurto su misura: quando e' scattato, e i suoi tasti. */
  _suMisura(valori = this._valori()) {
    const risolvi = this._risolutore(valori);
    let modi = valori[CHIAVE_ANTIFURTO_SU_MISURA];
    if (typeof modi === "string") {
      try {
        modi = JSON.parse(modi);
      } catch (_errore) {
        modi = [];
      }
    }
    return {
      scattato: normalizzaScattato(
        valori[CHIAVE_ANTIFURTO_SCATTATO],
        risolvi(CASELLA_DELLO_SCATTATO),
      ),
      modi: normalizzaModiSuMisura(modi),
    };
  }

  /* ─── Quello che arriva da Home Assistant ──────────────────────────── */

  /* Tutti gli stati insieme, all'inizio o dopo una caduta del filo. Non fa
   * scattare niente: quello che e' gia' cosi' non e' una novita'. */
  carica(elenco) {
    this.stati.clear();
    for (const uno of Array.isArray(elenco) ? elenco : []) {
      if (!uno?.entity_id) continue;
      this.stati.set(uno.entity_id, this._stato(uno));
    }
  }

  _stato(uno) {
    const dal = Date.parse(uno?.last_changed || "");
    return {
      state: String(uno?.state ?? ""),
      attributes: uno?.attributes && typeof uno.attributes === "object" ? uno.attributes : {},
      dal: Number.isFinite(dal) ? dal : this.adesso(),
    };
  }

  /* Un `state_changed`. */
  cambia(id, nuovo, vecchio = null) {
    if (typeof id !== "string" || !id.includes(".")) return;
    const prima = vecchio ? this._stato(vecchio) : (this.stati.get(id) ?? null);
    const vuotaPrima = this.casaVuota();
    if (nuovo) {
      const ora = this._stato(nuovo);
      /* Solo un attributo cambiato non e' un cambio di stato: il «da
       * quando» resta quello di prima. */
      if (prima && prima.state === ora.state) ora.dal = prima.dal;
      this.stati.set(id, ora);
    } else {
      this.stati.delete(id);
      return;
    }
    const dopo = this.stati.get(id);
    /* Una porta che si chiude dimentica il suo «va bene stanotte». */
    if (["off", "closed"].includes(dopo.state)) this.capire.chiusa(id);
    try {
      this._regoleDelMomento(id, dopo, prima, vuotaPrima);
      this._personalizzate();
    } catch (errore) {
      this.registro?.errore?.(`una regola delle notifiche: ${errore?.message || errore}`);
    }
  }

  /* Il giro lento: quello che scatta dopo che una cosa e' durata abbastanza.
   * `notifiche.js` lo chiama ogni mezzo minuto. */
  battito() {
    try {
      this._campiona();
      this._gliUpsAdesso();
    } catch (errore) {
      this.registro?.errore?.(`il taccuino dell'energia: ${errore?.message || errore}`);
    }
    try {
      this._durate();
      this._personalizzate();
      this._laPappa();
      this._lAssistente();
    } catch (errore) {
      this.registro?.errore?.(`una regola delle notifiche: ${errore?.message || errore}`);
    }
    /* Le abitudini su disco, e una volta al giorno via i giorni vecchi. */
    const oggi = new Date(this.adesso()).toDateString();
    if (this._potatoIl !== oggi) {
      this._potatoIl = oggi;
      this.capire.pota();
    }
    this.capire.scrivi();
  }

  /* ─── La pappa degli animali, a ogni battito ───────────────────────── */

  /* «Confermo che e' stato dato da mangiare e mi avvisa quando sara' da
   * rifare.» La pappa si segna dalla scheda dell'animale nella plancia, e sta
   * nella sua configurazione (`cd_animali`, vedi `core/animali-model.js`):
   * quando l'ora arriva lo si dice una volta per ogni pappa segnata. Segnata
   * la prossima, la chiave cambia, e alla sua ora si torna a dirlo. */
  _laPappa() {
    let grezzo = this._valori()?.cd_animali;
    try {
      if (typeof grezzo === "string") grezzo = JSON.parse(grezzo);
    } catch (_errore) {
      return;
    }
    if (!Array.isArray(grezzo) || !grezzo.length) return;
    const ora = this.adesso();
    for (const animale of normalizzaAnimali(grezzo)) {
      const pappa = laPappa(animale, ora);
      if (!pappa || pappa.ultimo === null || pappa.ogni === null) continue;
      if (!this._unaVolta(`pappa:${animale.id}:${pappa.ultimo}`, pappa.ora)) continue;
      this._dici({
        tipo: "animali",
        urgenza: "normale",
        chiave: `pappa:${animale.id}`,
        pausa: 30 * MINUTO,
        azioni: [
          { id: "pappa", parole: duePassi("Ha mangiato", "Fed"), pappa: animale.id },
          tastoGuarda(),
        ],
        parole: paroleDellaPappa({
          nome: animale.nome,
          specie: animale.specie,
          da: ora - pappa.ultimo,
        }),
      });
    }
  }

  /* ─── L'energia e gli UPS, a ogni battito ──────────────────────────── */

  /* Le prese degli elettrodomestici: le stesse che la sentinella segue per
   * dire «ha finito». L'elenco si rifa' ogni dieci minuti. */
  _prese() {
    const ora = this.adesso();
    if (!this._preseCache || ora - this._preseCache.il > 10 * MINUTO) {
      const ids = [];
      for (const [id, stato] of this.stati)
        if (
          dominioDi(id) === "sensor" &&
          NOME_ELETTRODOMESTICO.test(id) &&
          this._watt(stato) !== null
        )
          ids.push(id);
      this._preseCache = { il: ora, ids };
    }
    return this._preseCache.ids;
  }

  _campiona() {
    if (!this.taccuino) return;
    const valori = this._valori();
    const letture = letturaDellEnergia(this._risolutore(valori), (id) => this.stati.get(id));
    this._conSole = letture.sole !== null || letture.soleOggi !== null;
    this._ultimeLetture = letture;
    letture.apparecchi = {};
    for (const id of this._prese()) letture.apparecchi[id] = this._watt(this.stati.get(id));
    /* Per «chi ha consumato di piu'»: i carichi della plancia e gli
     * elettrodomestici trovati dal nome, ognuno una volta. */
    letture.carichi = { ...letture.apparecchi };
    for (const { id } of carichiDellaPlancia(valori))
      if (!(id in letture.carichi)) letture.carichi[id] = this._watt(this.stati.get(id));
    this.taccuino.campiona(letture, (istante) => this.prezzo(istante, valori));
  }

  /* La corrente che va via e torna, dagli UPS. Solo i cambi veri: un ponte
   * che si accende nel mezzo di un blackout non sa quando e' cominciato, e
   * non lo dice. */
  _gliUpsAdesso() {
    const valori = this._valori();
    const elenco = gliUps(this.stati, valori, this._risolutore(valori));
    const ora = this.adesso();
    const molti = elenco.length > 1;
    for (const ups of elenco) {
      const prima = this._ups.get(ups.chiave);
      const memoria = prima ?? { rete: ups.rete, dal: ora, bassa: false, detto: false };
      const dati = (fase, extra = {}) => ({
        nome: ups.name,
        molti,
        carica: ups.batteria,
        minuti: ups.autonomia,
        watt: ups.potenza,
        dalle: oraMinuti(memoria.dal),
        fase,
        ...extra,
      });
      const chiave = ups.chiave;
      if (prima && prima.rete === true && ups.rete === false) {
        memoria.dal = ora;
        memoria.bassa = false;
        memoria.detto = true;
        const d = dati("via");
        this._dici({
          tipo: "blackout",
          urgenza: "urgente",
          chiave: `blackout:${chiave}`,
          pausa: 10 * MINUTO,
          entita: ups.entita,
          misura: { fase: "via", dal: ora },
          ancora: () => this._ups.get(chiave)?.rete === false,
          componi: { tipo: "blackout", dati: d },
          parole: inDueLingue(paroleDelBlackout, d),
        });
      } else if (
        prima?.rete === false &&
        ups.rete === false &&
        memoria.detto &&
        !memoria.bassa &&
        ups.batteria !== null &&
        ups.batteria <= 30
      ) {
        memoria.bassa = true;
        const d = dati("bassa");
        this._dici({
          tipo: "blackout",
          urgenza: "urgente",
          chiave: `blackout-bassa:${chiave}`,
          pausa: 30 * MINUTO,
          entita: ups.entita,
          misura: { fase: "bassa", dal: memoria.dal },
          ancora: () => this._ups.get(chiave)?.rete === false,
          componi: { tipo: "blackout", dati: d },
          parole: inDueLingue(paroleDelBlackout, d),
        });
      } else if (prima?.rete === false && ups.rete === true && memoria.detto) {
        const minuti = Math.max(1, Math.round((ora - memoria.dal) / MINUTO));
        memoria.detto = false;
        const d = dati("torna", { durata: minuti });
        this._dici({
          tipo: "blackout",
          urgenza: "normale",
          chiave: `blackout-torna:${chiave}`,
          pausa: 0,
          entita: ups.entita,
          misura: { fase: "torna", durata: minuti },
          componi: { tipo: "blackout", dati: d },
          parole: inDueLingue(paroleDelBlackout, d),
        });
      }
      if (ups.rete !== null) memoria.rete = ups.rete;
      this._ups.set(chiave, memoria);
    }
  }

  _dici(evento) {
    try {
      this.quando({ quando: this.adesso(), azioni: [], ...evento });
    } catch (errore) {
      this.registro?.errore?.(`una notifica non e' partita: ${errore?.message || errore}`);
    }
  }

  /* ─── Chi c'e' in casa ─────────────────────────────────────────────── */

  persone() {
    return [...this.stati].filter(([id]) => dominioDi(id) === "person");
  }

  /* Vuota, piena, o non si sa (`null`): senza persone in Home Assistant non
   * c'e' modo di dirlo, e non lo si indovina. */
  casaVuota() {
    const persone = this.persone();
    if (!persone.length) return null;
    return persone.every(([, stato]) => stato.state !== "home");
  }

  /* L'entita' `person.*` di un utente di Home Assistant. */
  personaDi(utente) {
    if (!utente) return null;
    for (const [id, stato] of this.persone()) if (stato.attributes?.user_id === utente) return id;
    return null;
  }

  aCasa(utente) {
    const persona = this.personaDi(utente);
    return persona ? this.stati.get(persona)?.state === "home" : null;
  }

  /* ─── Le telecamere e i cancelli vicini ────────────────────────────── */

  /* La telecamera che fa vedere quello che e' successo: prima quella dello
   * stesso dispositivo, poi quella che ha una parola del nome in comune, poi
   * l'unica che c'e'. Altrimenti nessuna. */
  telecameraPer(id, { soloVicina = false } = {}) {
    const telecamere = [...this.stati.keys()].filter((uno) => dominioDi(uno) === "camera");
    if (!telecamere.length) return null;
    const suo = this.dispositivoDi?.[id];
    if (suo) {
      const stessa = telecamere.find((una) => this.dispositivoDi?.[una] === suo);
      if (stessa) return stessa;
    }
    /* Le parole in comune, nell'identificativo e nel nome: vince la
     * telecamera che ne ha di piu' (e di piu' lunghe). Prima vinceva la prima
     * che ne aveva una qualunque, e con due telecamere dello stesso modello —
     * `camera.ds_2cd…_<seriale>_101` — il modello bastava: il movimento del
     * balcone arrivava con la telecamera dell'ingresso. A pari merito non se
     * ne sceglie nessuna: meglio niente foto che quella sbagliata. */
    const sue = paroleDelNome(id, nomeDi(this.stati.get(id), ""));
    let migliore = null;
    let punti = 0;
    let pari = false;
    for (const una of telecamere) {
      const sueDellaTelecamera = paroleDelNome(una, nomeDi(this.stati.get(una), ""));
      let quanti = 0;
      for (const parola of sue)
        if (sueDellaTelecamera.has(parola) || una.includes(parola)) quanti += parola.length;
      if (quanti > punti) {
        migliore = una;
        punti = quanti;
        pari = false;
      } else if (quanti && quanti === punti) pari = true;
    }
    if (migliore && !pari) return migliore;
    /* L'unica telecamera di casa va bene per l'antifurto — fa vedere la casa —
     * ma non per il movimento della camera da letto: la foto sarebbe del
     * cancello. */
    if (soloVicina) return null;
    return telecamere.length === 1 ? telecamere[0] : null;
  }

  /* I campanelli scelti nel Citofono della plancia (`cd_citofono`), per
   * entita': il nome, la telecamera e cosa apre. Riletti al piu' ogni mezzo
   * minuto: `cambia` arriva molte volte al secondo. */
  _campanelliDellaPlancia() {
    const ora = this.adesso();
    if (this._citofoni && ora - this._citofoniLetti < 30 * 1000) return this._citofoni;
    const trovati = new Map();
    try {
      let grezzo = this._valori()?.[CHIAVE_CITOFONO];
      if (typeof grezzo === "string") grezzo = JSON.parse(grezzo);
      for (const voce of normalizzaIngresso(grezzo || {}).citofoni)
        if (voce.campanello) trovati.set(voce.campanello, voce);
    } catch (_errore) {
      /* Una configurazione guasta: si va coi nomi, come prima. */
    }
    this._citofoni = trovati;
    this._citofoniLetti = ora;
    return trovati;
  }

  /* Il cancello da aprire dal campanello: una serratura, una copertura o un
   * tasto che si chiama cancello. */
  cancello() {
    for (const [id] of this.stati) {
      const dominio = dominioDi(id);
      if (!NOME_DEL_CANCELLO.test(id)) continue;
      if (dominio === "lock") return { dominio: "lock", servizio: "unlock", entita: [id] };
      if (dominio === "cover") return { dominio: "cover", servizio: "open_cover", entita: [id] };
      if (dominio === "button") return { dominio: "button", servizio: "press", entita: [id] };
    }
    return null;
  }

  /* ─── L'antifurto ──────────────────────────────────────────────────── */

  /* L'antifurto su misura, riletto al piu' ogni mezzo minuto: `cambia` arriva
   * molte volte al secondo, e la configurazione cambia una volta al mese. */
  _suMisuraAdesso() {
    const ora = this.adesso();
    if (!this._suMisuraCache || ora - this._suMisuraCache.il > 30 * 1000)
      this._suMisuraCache = { il: ora, ...this._suMisura() };
    return this._suMisuraCache;
  }

  _ricorda(id, nome, colore) {
    const ora = this.adesso();
    this._recenti.push({ id, nome: nomePulito(nome), colore, quando: ora });
    this._recenti = this._recenti.filter((r) => ora - r.quando <= 15 * MINUTO).slice(-10);
  }

  /* Se la casa dormiva fino al giro prima. */
  _dormivaPrima(ora) {
    if (!this._memoria.has("svegliaFinoA")) return false;
    return ora - this._memoria.get("svegliaFinoA") >= CASA_CHE_DORME_DA;
  }

  /* «Inserisci» sotto una notifica: solo se l'antifurto adesso e' spento. Una
   * centrale vera senza codice si inserisce dal tasto; un modo su misura col
   * codice apre l'app, dove il tastierino c'e'. */
  _tastoInserisci() {
    for (const [id, stato] of this.stati) {
      if (dominioDi(id) !== "alarm_control_panel" || stato.state !== "disarmed") continue;
      if (stato.attributes?.code_arm_required)
        return [{ id: "inserisci", parole: duePassi("Inserisci", "Arm"), apre: true }];
      return [
        {
          id: "inserisci",
          parole: duePassi("Inserisci", "Arm"),
          servizio: { dominio: "alarm_control_panel", servizio: "alarm_arm_away", entita: [id] },
        },
      ];
    }
    const { modi } = this._suMisuraAdesso();
    if (!modi.length) return [];
    const acceso = modoSuMisuraAcceso(modi, this.statiComeOggetto());
    const disinserito = modoCheDisinserisce(modi);
    if (acceso && acceso !== disinserito?.id) return [];
    const modo = modoPerInserire(modi);
    if (!modo) return [];
    const parole = duePassi(
      `Inserisci · ${modo.nome || modo.id}`.slice(0, 30),
      `Arm · ${modo.nome || modo.id}`.slice(0, 30),
    );
    if (ilModoChiedeIlCodice(modo)) return [{ id: "inserisci", parole, apre: true }];
    const servizio = servizioDelModo(modo);
    return servizio ? [{ id: "inserisci", parole, servizio }] : [];
  }

  /* L'antifurto scattato, dalla centrale vera o dall'interruttore su misura:
   * zona, ora, sirena, cosa e' successo prima, e i tasti per spegnere. */
  _antifurtoScattato({ id, nome, centrale = null, scattato = null, modi = [] }) {
    const ora = this.adesso();
    const recenti = this._recenti.filter((r) => ora - r.quando <= 10 * MINUTO);
    const ultimo = recenti.at(-1) || null;
    let zona = "";
    let zonaId = ultimo?.id || null;
    if (scattato?.zona) {
      const st = this.stati.get(scattato.zona);
      const valore = String(st?.state || "");
      if (dominioDi(scattato.zona) === "binary_sensor") {
        if (valore === "on") {
          zona = nomePulito(nomeDi(st, scattato.zona));
          zonaId = scattato.zona;
        }
      } else if (
        valore &&
        !["unknown", "unavailable", "none", "on", "off"].includes(valore.toLowerCase())
      )
        zona = valore.slice(0, 40);
    }
    if (!zona && ultimo) zona = ultimo.nome;
    const camera = this.telecameraPer(zonaId || id);
    const sirena = scattato?.sirena
      ? this.stati.get(scattato.sirena)?.state === "on"
      : Boolean(centrale);
    let modo = "";
    let dalle = "";
    if (modi.length) {
      const acceso = modoSuMisuraAcceso(modi, this.statiComeOggetto());
      const suo = modi.find((m) => m.id === acceso);
      if (suo) {
        modo = suo.nome || suo.id;
        const st = this.stati.get(suo.stato);
        if (st?.dal) dalle = oraMinuti(st.dal);
      }
    }
    const ev = recenti
      .slice(-3)
      .reverse()
      .map((r) => [
        oraMinuti(r.quando),
        r.colore === "a" ? `Movimento · ${r.nome}`.slice(0, 40) : `${r.nome} · aperta`.slice(0, 40),
        r.colore,
      ]);
    const dati = { nome: nomePulito(nome), zona, ora: oraMinuti(ora), modo, dalle, sirena, ev };
    const azioni = [];
    if (scattato?.sirena) {
      const dominio = dominioDi(scattato.sirena);
      azioni.push({
        id: "spegni-sirena",
        parole: duePassi("Spegni sirena", "Siren off"),
        servizio: { dominio, servizio: SPEGNI_LA_SIRENA[dominio], entita: [scattato.sirena] },
      });
    }
    if (centrale) {
      if (centrale.attributes?.code_format)
        azioni.push({ id: "disinserisci", parole: duePassi("Disinserisci", "Disarm"), apre: true });
      else
        azioni.push({
          id: "disinserisci",
          parole: duePassi("Disinserisci", "Disarm"),
          servizio: { dominio: "alarm_control_panel", servizio: "alarm_disarm", entita: [id] },
        });
    } else {
      const spegni = modoCheDisinserisce(modi);
      if (spegni) {
        if (ilModoChiedeIlCodice(spegni))
          azioni.push({
            id: "disinserisci",
            parole: duePassi("Disinserisci", "Disarm"),
            apre: true,
          });
        else {
          const servizio = servizioDelModo(spegni);
          if (servizio)
            azioni.push({
              id: "disinserisci",
              parole: duePassi("Disinserisci", "Disarm"),
              servizio,
            });
        }
      }
    }
    azioni.push(tastoGuarda());
    const parole = inDueLingue(paroleDellAntifurto, dati);
    if (centrale?.attributes?.changed_by && !zona)
      parole.it.testo = `Da ${String(centrale.attributes.changed_by).slice(0, 40)}`;
    this._dici({
      tipo: "antifurto",
      urgenza: "urgente",
      chiave: `antifurto:${id}`,
      pausa: 5 * MINUTO,
      entita: id,
      camera,
      conFoto: Boolean(camera),
      componi: { tipo: "antifurto", dati },
      parole,
      azioni: azioni.slice(0, 3),
    });
  }

  /* ─── Le regole che scattano subito ────────────────────────────────── */

  _regoleDelMomento(id, dopo, prima, vuotaPrima) {
    const dominio = dominioDi(id);
    const classe = dopo.attributes?.device_class;
    const era = prima?.state;
    const nome = nomeDi(dopo, id);

    /* Le porte, le finestre e i movimenti che si accendono: si ricordano per
     * dieci minuti, per dire «che cosa e' successo prima» se l'antifurto
     * scatta. */
    if (
      dominio === "binary_sensor" &&
      dopo.state === "on" &&
      era !== "on" &&
      (APERTURE.has(classe) || classe === "window" || MOVIMENTO.has(classe))
    )
      this._ricorda(id, nome, MOVIMENTO.has(classe) ? "a" : "r");

    /* L'antifurto scattato: la centrale vera. */
    if (dominio === "alarm_control_panel" && dopo.state === "triggered" && era !== "triggered") {
      this._antifurtoScattato({ id, nome, centrale: dopo });
      return;
    }

    /* L'antifurto su misura: l'interruttore che dice «scattato». */
    const suMisura = this._suMisuraAdesso();
    if (
      suMisura.scattato &&
      id === suMisura.scattato.entita &&
      prima &&
      valeScattato(suMisura.scattato, dopo.state) &&
      !valeScattato(suMisura.scattato, era)
    ) {
      this._antifurtoScattato({ id, nome, scattato: suMisura.scattato, modi: suMisura.modi });
      return;
    }

    /* L'antifurto inserito, in uno dei suoi modi, o disinserito. Solo un
     * cambio vero: non al primo stato che si legge, non tornando da
     * «non disponibile», non fra due letture uguali. */
    const modo = MODI_DELL_ANTIFURTO[dopo.state];
    if (
      dominio === "alarm_control_panel" &&
      modo &&
      prima &&
      era !== dopo.state &&
      era !== "unavailable" &&
      era !== "unknown"
    ) {
      const chi = dopo.attributes?.changed_by
        ? String(dopo.attributes.changed_by).slice(0, 40)
        : "";
      this._dici({
        tipo: "inserimenti",
        urgenza: "normale",
        chiave: `inserimenti:${id}`,
        pausa: 0,
        entita: id,
        parole: paroleDellInserimento(dopo.state, nome, chi),
        azioni: [tastoGuarda()],
      });
      return;
    }

    /* Allagamento, fumo, gas: dal primo sensore che se ne accorge. */
    if (dominio === "binary_sensor" && ALLARMI[classe] && dopo.state === "on" && era !== "on") {
      if (classe === "moisture" && NOME_DELLA_PIOGGIA.test(id)) {
        this._piove(id);
        return;
      }
      this._dici({
        tipo: "allarmi",
        urgenza: "urgente",
        chiave: `allarmi:${id}`,
        pausa: 10 * MINUTO,
        entita: id,
        parole: paroleDellAllarme(classe, nome),
        azioni: [tastoGuarda()],
      });
      return;
    }

    /* Il campanello: un `event.*` di classe doorbell che cambia ora, o un
     * sensore che si chiama campanello e si accende. */
    /* Non tutti i campanelli dicono «doorbell»: il citofono di Ring, e altri,
     * arrivano come un `event.*` senza classe, col nome o l'evento che dicono
     * cos'e' («…_ding», `event_type: ding`). Il movimento no: e' un'altra
     * notifica, e ha la sua classe. */
    const tipoDiEvento = String(dopo.attributes?.event_type ?? "").toLowerCase();
    /* Il campanello scelto nel Citofono della plancia: suona quando la sua
     * entita' cambia, qualunque nome abbia. Dal campo: «non riesco a far
     * suonare il telefono con il campanello» — l'entita' era scelta nella
     * plancia, ma il ponte la riconosceva solo dal nome. */
    const dalCitofono = prima ? this._campanelliDellaPlancia().get(id) : null;
    if (dalCitofono && suonaIlCitofono(dominio, era, dopo.state)) {
      this._dici({
        tipo: "campanello",
        urgenza: "urgente",
        chiave: `campanello:${id}`,
        pausa: 30 * 1000,
        entita: id,
        camera: dalCitofono.telecamera || this.telecameraPer(id),
        chiamata: true,
        parole: paroleDelCampanello(dalCitofono.nome || nome),
        azioni: tastiDelCampanello(apriDalCitofono(dalCitofono.apri) || this.cancello()),
      });
      return;
    }
    const eUnCampanello =
      classe === "doorbell" ||
      (classe !== "motion" &&
        (EVENTO_DEL_CAMPANELLO.test(id) ||
          /^(ding|intercom_ding|ring|doorbell)$/.test(tipoDiEvento)));
    const suona =
      (dominio === "event" &&
        eUnCampanello &&
        prima &&
        era !== dopo.state &&
        era !== "unavailable" &&
        dopo.state !== "unavailable") ||
      (dominio === "binary_sensor" &&
        NOME_DEL_CAMPANELLO.test(id) &&
        dopo.state === "on" &&
        era === "off");
    if (suona) {
      this._dici({
        tipo: "campanello",
        urgenza: "urgente",
        chiave: `campanello:${id}`,
        pausa: 30 * 1000,
        entita: id,
        camera: this.telecameraPer(id),
        chiamata: true,
        parole: paroleDelCampanello(nome),
        azioni: tastiDelCampanello(this.cancello()),
      });
      return;
    }

    /* Le persone: chi arriva e chi esce, e la casa che si svuota. */
    if (dominio === "person" && prima && era !== dopo.state) {
      const arriva = dopo.state === "home" && era !== "home";
      const esce = era === "home" && dopo.state !== "home";
      if (arriva || esce) {
        this._dici({
          tipo: "arrivi",
          urgenza: "bassa",
          chiave: `arrivi:${id}:${arriva ? "su" : "giu"}`,
          pausa: 5 * MINUTO,
          entita: id,
          persona: id,
          parole: paroleDellArrivo(nome, arriva),
        });
      }
      if (vuotaPrima === false && this.casaVuota() === true) this._casaAppenaVuota(nome);
      return;
    }

    /* Il movimento: con la casa vuota, o di notte quando la casa dorme. Se
     * c'e' una telecamera li', con la sua foto per chi ha scelto le notifiche
     * elaborate. Chi lo vuole sempre lo dice nelle sue impostazioni. */
    if (
      dominio === "binary_sensor" &&
      MOVIMENTO.has(classe) &&
      dopo.state === "on" &&
      era !== "on"
    ) {
      const ora = this.adesso();
      const vuota = this.casaVuota() === true;
      /* La casa dorme se dormiva fino a un attimo fa: questo movimento e'
       * quello che la sveglia. */
      const notte = eNotte(new Date(ora)) && this._dormivaPrima(ora);
      if (vuota || notte || this.movimentoSempre) {
        const camera = this.telecameraPer(id, { soloVicina: true });
        const dati = {
          nome: nomePulito(nome),
          cam: camera ? nomePulito(nomeDi(this.stati.get(camera), camera)) : "",
          ora: oraMinuti(ora),
          secondi: oraSecondi(ora),
          vuota,
          notte: !vuota && notte,
        };
        this._dici({
          tipo: "movimento",
          urgenza: "normale",
          chiave: `movimento:${id}`,
          pausa: 10 * MINUTO,
          entita: id,
          camera,
          conFoto: Boolean(camera),
          perche: vuota ? "casa-vuota" : notte ? "notte" : "giorno",
          componi: { tipo: "movimento", dati },
          parole: inDueLingue(paroleDelMovimento, dati),
          azioni: [tastoGuarda(), ...this._tastoInserisci()],
        });
      }
      return;
    }

    /* La pioggia: il tempo che diventa pioggia, o un sensore di pioggia. */
    if (
      (dominio === "weather" && PIOVE.has(dopo.state) && !PIOVE.has(era)) ||
      (dominio === "binary_sensor" &&
        NOME_DELLA_PIOGGIA.test(id) &&
        dopo.state === "on" &&
        era !== "on")
    ) {
      this._piove(id);
      return;
    }

    /* Un elettrodomestico che dice da se' d'aver finito. */
    if (
      (dominio === "sensor" || dominio === "select") &&
      NOME_ELETTRODOMESTICO.test(id) &&
      FINITO.test(dopo.state) &&
      prima &&
      !FINITO.test(era)
    ) {
      this._elettrodomesticoFinito(id, nome);
      return;
    }

    /* Una potenza che scende: il conto lo fa `_durate`, qui si segna. */
    if (dominio === "sensor" && NOME_ELETTRODOMESTICO.test(id) && this._watt(dopo) !== null) {
      this._seguiLaPotenza(id, dopo);
    }
  }

  _watt(stato) {
    const unita = String(stato?.attributes?.unit_of_measurement || "");
    if (unita !== "W" && unita !== "kW") return null;
    const n = numero(stato.state);
    if (n === null) return null;
    return unita === "kW" ? n * 1000 : n;
  }

  _seguiLaPotenza(id, stato) {
    const watt = this._watt(stato);
    const chiave = `potenza:${id}`;
    const memoria = this._memoria.get(chiave) ?? { giraDal: null, fermoDal: null };
    const ora = this.adesso();
    if (watt >= ELETTRODOMESTICO_ACCESO) {
      memoria.giraDal ??= ora;
      memoria.fermoDal = null;
    } else if (watt <= ELETTRODOMESTICO_FERMO && memoria.giraDal !== null) {
      memoria.fermoDal ??= ora;
    }
    this._memoria.set(chiave, memoria);
  }

  /* Lo stesso elettrodomestico lo dice spesso da due parti: dal suo stato
   * («finished») e dalla presa che ne misura la potenza. «Perché arriva due
   * volte la notifica»: «Asciugatrice: finito» e «asciugatrice W: finito» alla
   * stessa ora. Di un genere (lavatrice, asciugatrice, lavastoviglie…) si dice
   * una volta sola per quarto d'ora, da qualunque parte arrivi. */
  _elettrodomesticoFinito(id, nome, { finitoIl = null } = {}) {
    const genere = genereDiElettrodomestico(`${id} ${nome}`);
    const chiave = `finito:${genere}`;
    const ora = this.adesso();
    const ultimo = this._memoria.get(chiave);
    if (ultimo != null && ora - ultimo < STESSO_ELETTRODOMESTICO) return;
    this._memoria.set(chiave, ora);
    const nomeDiCasa = nome;
    nome = nomeDellElettrodomestico(nome);
    /* I conti del ciclo, se il taccuino l'ha seguito: dalla presa di questa
     * entita', o — quando a dire «finito» e' lo stato dell'elettrodomestico —
     * dalla presa dello stesso genere. */
    let ciclo = null;
    let dove = null;
    const valori = this._valori();
    if (this.taccuino) {
      dove = this.taccuino.haUnCiclo(id) ? id : null;
      if (!dove)
        for (const altro of this.taccuino.cicli.keys())
          if (
            genereDiElettrodomestico(`${altro} ${nomeDi(this.stati.get(altro), altro)}`) === genere
          ) {
            dove = altro;
            break;
          }
      if (dove)
        ciclo = this.taccuino.chiudiIlCiclo(dove, {
          finitoIl,
          prezzoMigliore: fasciaPiuBassa(valori.cd_fasce_kwh),
        });
    }
    /* Che cosa disegnare sulla scheda: lo dice prima l'elettrodomestico
     * configurato nella plancia, poi il nome che gli da' Home Assistant. */
    const tipo = tipoDellElettrodomestico({
      voce: elettrodomesticoDellaPlancia(valori, id, dove),
      parole: [nomeDiCasa, id],
    });
    const dati = {
      nome,
      genere,
      tipo,
      ciclo,
      conSole: this._conSole,
      fascia: ciclo ? this.prezzo(finitoIl ?? ora, valori).fascia : "",
    };
    this._dici({
      tipo: "elettrodomestici",
      urgenza: "normale",
      chiave: `elettrodomestici:${id}`,
      pausa: 30 * MINUTO,
      entita: id,
      misura: { euro: ciclo?.eur ?? null },
      componi: { tipo: "ciclo", dati },
      parole: inDueLingue(paroleDelCiclo, dati),
    });
  }

  /* Le finestre aperte, quelle della plancia.
   *
   * «Deve vedere quelle reali impostate come finestre»: la pioggia diceva
   * «Finestre aperte: Termosifone Bagno Stato finestra» — il rilevamento della
   * finestra aperta di una valvola termostatica, che Home Assistant chiama
   * `window` ma non e' un'anta. Qui si guardano i varchi come li vede la
   * plancia (`varchi-di-casa.js`): le righe scritte nella scheda dei Varchi e
   * i contatti messi nelle Finestre, col verso girato di chi l'ha girato, e
   * solo quelli che sono finestre. Senza righe scritte vale il rilevamento,
   * ma un sensore «finestra» che sta sullo stesso apparecchio di un
   * termostato e' il termostato che stima, non un contatto sull'anta. */
  _finestreAperte() {
    const valori = this._valori();
    const leggi = (chiave, vuoto) => {
      const v = valori?.[chiave];
      if (typeof v !== "string") return v ?? vuoto;
      try {
        return JSON.parse(v);
      } catch (_errore) {
        return vuoto;
      }
    };
    const righeDelleFinestre = leggi("cd_tapparelle", []);
    const config = varchiConLeFinestre(leggi(CHIAVE_VARCHI, {}), righeDelleFinestre);
    const dichiaratiFinestre = new Set(contattiDichiaratiNelleFinestre(righeDelleFinestre));
    const scritte = Boolean(righeDichiarate(config, CAMPI_IN_PIU));
    const stati = this.statiComeOggetto();
    const diUnTermostato = (id) => {
      const suo = this.dispositivoDi?.[id];
      if (!suo) return false;
      return Object.keys(stati).some(
        (altro) => dominioDi(altro) === "climate" && this.dispositivoDi?.[altro] === suo,
      );
    };
    return varchiDiCasa(
      stati,
      config,
      insiemeInvertiti(leggi(CHIAVE_VERSI, {})),
      (id) => nomeDi(this.stati.get(id), id),
      dichiaratiFinestre,
    )
      .filter((riga) => riga.tipo === "finestra" && riga.stato === "aperto")
      .filter((riga) => eUnContatto(riga.entity))
      .filter(
        (riga) => scritte || dichiaratiFinestre.has(riga.entity) || !diUnTermostato(riga.entity),
      )
      .map((riga) => riga.name);
  }

  /* Piove, o sta per piovere: si dice solo se c'e' una finestra aperta. */
  _piove(id, { fra = null } = {}) {
    const aperte = this._finestreAperte();
    if (!aperte.length) return;
    this._dici({
      tipo: "pioggia",
      urgenza: "normale",
      chiave: "pioggia",
      pausa: 2 * ORA,
      entita: id,
      parole: paroleDellaPioggia(aperte, { fra }),
    });
  }

  /* La previsione oraria, chiesta da `notifiche.js` a `weather.get_forecasts`:
   * se nella prossima ora piove e c'e' una finestra aperta, lo si dice prima. */
  previsione(dove, elenco) {
    const ora = this.adesso();
    for (const una of Array.isArray(elenco) ? elenco : []) {
      const quando = Date.parse(una?.datetime || "");
      if (!Number.isFinite(quando) || quando < ora - 5 * MINUTO || quando > ora + ORA) continue;
      const probabilita = numero(una?.precipitation_probability);
      if (PIOVE.has(una?.condition) || (probabilita !== null && probabilita >= 70)) {
        this._piove(dove, { fra: Math.max(5, Math.round((quando - ora) / MINUTO / 5) * 5) || 30 });
        return;
      }
    }
  }

  /* L'ultimo esce e l'antifurto e' spento. */
  _casaAppenaVuota(chi) {
    for (const [id, stato] of this.stati) {
      if (dominioDi(id) !== "alarm_control_panel" || stato.state !== "disarmed") continue;
      const azioni = tastiDellUscito(id, {
        conCodice: Boolean(stato.attributes?.code_arm_required),
      });
      this._dici({
        tipo: "uscito",
        urgenza: "normale",
        chiave: `uscito:${id}`,
        pausa: 30 * MINUTO,
        entita: id,
        parole: paroleDellUscito(chi),
        azioni,
      });
      return;
    }
  }

  /* ─── Le regole che vogliono tempo ─────────────────────────────────── */

  _unaVolta(chiave, vale) {
    if (!vale) {
      this._memoria.delete(`detto:${chiave}`);
      return false;
    }
    if (this._memoria.get(`detto:${chiave}`)) return false;
    this._memoria.set(`detto:${chiave}`, true);
    return true;
  }

  /* Se la casa dorme: nessuna luce accesa e nessun movimento da venti
   * minuti. Le luci che restano accese per conto loro (l'acquario, la
   * notturna, quelle a orario) non tengono sveglia la casa. */
  _casaDorme(ora) {
    let sveglia = false;
    for (const [id, stato] of this.stati) {
      const dominio = dominioDi(id);
      if (dominio === "light" && stato.state === "on") {
        if (!this.capire.lasciaStare(id, nomeDi(stato, id), { tipo: "luce", ora })) sveglia = true;
      } else if (
        dominio === "binary_sensor" &&
        MOVIMENTO.has(stato.attributes?.device_class) &&
        stato.state === "on"
      ) {
        sveglia = true;
      }
      if (sveglia) break;
    }
    if (sveglia || !this._memoria.has("svegliaFinoA")) this._memoria.set("svegliaFinoA", ora);
    return ora - this._memoria.get("svegliaFinoA") >= CASA_CHE_DORME_DA;
  }

  /* L'ora in cui e' uscita l'ultima persona, se si sa: «alle 9:12». */
  _uscitaUltima() {
    const fuori = this.persone()
      .filter(([, stato]) => stato.state !== "home")
      .map(([, stato]) => stato.dal)
      .filter(Number.isFinite);
    if (!fuori.length) return null;
    const d = new Date(Math.max(...fuori));
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  _durate() {
    const ora = this.adesso();
    const vuota = this.casaVuota();
    const notte = eNotte(new Date(ora));
    const dorme = this._casaDorme(ora);
    this._dormeAdesso = dorme;
    /* Quanto e' passato dal battito di prima, per le abitudini: al piu' un
     * minuto, perche' un ponte fermo per un'ora non ha visto niente. */
    const passati = Math.min(1, Math.max(0, (ora - (this._ultimoBattito ?? ora)) / MINUTO));
    this._ultimoBattito = ora;
    const lasciate = [];
    const luciAccese = [];
    const luciDaSpegnere = [];
    let luciDa = Infinity;
    const climiAccesi = [];
    let climaDa = Infinity;

    for (const [id, stato] of this.stati) {
      const dominio = dominioDi(id);
      const classe = stato.attributes?.device_class;
      const da = ora - stato.dal;
      const nome = nomeDi(stato, id);

      /* Porte e garage aperti: con la casa vuota, o di notte quando la casa
       * dorme.
       *
       * «Questa notifica che senso ha?»: alle dieci di sera in punto, con
       * tutti svegli, «Sensore Porta/Finestra Cucina Porta aperta da 1 h · È
       * notte». Adesso, con la gente in casa, si aspetta che la casa dorma
       * (`casaDorme`), e si tace per una porta interna, per una che di notte
       * resta spesso aperta (l'abitudine) e per una a cui si e' gia' detto
       * «Va bene stanotte». Con la casa vuota si dice sempre: e' sicurezza. */
      const aperta =
        (dominio === "binary_sensor" && APERTURE.has(classe) && stato.state === "on") ||
        (dominio === "cover" && COPERTURE_APERTE.has(classe) && stato.state === "open");
      const eUnaApertura =
        (dominio === "binary_sensor" && APERTURE.has(classe)) ||
        (dominio === "cover" && COPERTURE_APERTE.has(classe));
      if (eUnaApertura && notte && dorme && vuota !== true)
        this.capire.portaDiNotte(id, aperta, ora);
      /* Con la casa vuota la tace solo chi l'ha detto: l'abitudine e una
       * porta interna valgono quando in casa c'e' qualcuno. */
      const detto = aperta ? this.capire.lasciaStare(id, nome, { tipo: "porta", ora }) : null;
      const lascia =
        aperta &&
        (vuota === true
          ? ["detto", "stanotte"].includes(detto?.perche)
          : detto !== null || this.capire.portaInterna(id, nome, classe));
      const daDire = aperta && !lascia && da >= APERTA_DA && (vuota === true || (notte && dorme));
      if (this._unaVolta(`aperture:${id}`, daDire)) {
        const dove = nomePulito(nome);
        const cosa = cosaApre(id, nome, classe);
        const ultima = vuota === true ? this._uscitaUltima() : null;
        this._dici({
          tipo: "aperture",
          urgenza: "normale",
          chiave: `aperture:${id}`,
          pausa: ORA,
          entita: id,
          camera: this.telecameraPer(id),
          parole: paroleDellApertura({ dove, cosa, vuota, da, ultima }),
          azioni: tastiDellApertura(id, { copertura: dominio === "cover", vuota }),
        });
      }

      /* Freezer e frigo troppo caldi, o con la porta aperta. */
      if (dominio === "sensor" && classe === "temperature") {
        const gradi = numero(stato.state);
        const soglia = NOME_DEL_FREEZER.test(id)
          ? SOGLIA_DEL_FREEZER
          : NOME_DEL_FRIGO.test(id)
            ? SOGLIA_DEL_FRIGO
            : null;
        if (soglia !== null) {
          const memoria = `caldo:${id}`;
          const sopra = gradi !== null && gradi > soglia;
          if (!sopra) this._memoria.delete(memoria);
          else if (!this._memoria.has(memoria)) this._memoria.set(memoria, ora);
          const daQuando = this._memoria.get(memoria);
          if (this._unaVolta(`frigo:${id}`, sopra && ora - daQuando >= FRIGO_CALDO_DA)) {
            const unita = stato.attributes?.unit_of_measurement || "°C";
            this._dici({
              tipo: "frigo",
              urgenza: "normale",
              chiave: `frigo:${id}`,
              pausa: ORA,
              entita: id,
              parole: paroleDelFrigoCaldo({
                nome,
                valore: stato.state,
                unita,
                da: ora - daQuando,
              }),
            });
          }
        }
      }
      if (
        dominio === "binary_sensor" &&
        (NOME_DEL_FREEZER.test(id) || NOME_DEL_FRIGO.test(id)) &&
        (classe === "door" || classe === "opening")
      ) {
        if (this._unaVolta(`portafrigo:${id}`, stato.state === "on" && da >= PORTA_DEL_FRIGO_DA)) {
          this._dici({
            tipo: "frigo",
            urgenza: "normale",
            chiave: `portafrigo:${id}`,
            pausa: 30 * MINUTO,
            entita: id,
            parole: paroleDellaPortaDelFrigo({ nome, da }),
          });
        }
      }

      /* Elettrodomestici che finiscono: la potenza e' scesa e resta giu'. */
      if (dominio === "sensor" && NOME_ELETTRODOMESTICO.test(id)) {
        const memoria = this._memoria.get(`potenza:${id}`);
        if (
          memoria?.giraDal != null &&
          memoria.fermoDal != null &&
          memoria.fermoDal - memoria.giraDal >= ELETTRODOMESTICO_GIRA_ALMENO &&
          ora - memoria.fermoDal >= ELETTRODOMESTICO_FERMO_DA
        ) {
          this._memoria.delete(`potenza:${id}`);
          this._elettrodomesticoFinito(id, nome, { finitoIl: memoria.fermoDal });
        } else if (
          memoria?.giraDal != null &&
          memoria.fermoDal != null &&
          memoria.fermoDal - memoria.giraDal < ELETTRODOMESTICO_GIRA_ALMENO &&
          ora - memoria.fermoDal >= ELETTRODOMESTICO_FERMO_DA
        ) {
          /* Un'accensione breve non e' un lavaggio. */
          this._memoria.delete(`potenza:${id}`);
          this.taccuino?.dimentica(id);
        }
      }

      if (vuota === true && dominio === "light" && stato.state === "on") {
        /* L'abitudine si impara prima di decidere: una luce accesa con la
         * casa vuota quasi tutti i giorni e' a orario. */
        if (passati > 0) this.capire.luceAccesaConLaCasaVuota(id, passati, ora);
        const lascia = this.capire.lasciaStare(id, nome, { tipo: "luce", ora });
        if (lascia) {
          lasciate.push({ id, nome, perche: lascia.perche });
        } else {
          luciAccese.push(nome);
          luciDaSpegnere.push(id);
          luciDa = Math.min(luciDa, stato.dal);
        }
      }
      /* Con la casa vuota si dice il clima lasciato acceso, non il
       * riscaldamento che tiene la temperatura col suo programma: un
       * termostato che scalda a casa vuota fa il suo mestiere. */
      if (
        vuota === true &&
        dominio === "climate" &&
        !this._eUnTermostato(id, stato) &&
        this._climaAcceso(id, stato)
      ) {
        climiAccesi.push(id);
        climaDa = Math.min(climaDa, stato.dal);
      }
    }

    /* L'assistente: luci e clima accesi con la casa vuota. */
    const vuotaDa = this._vuotaDa(vuota);
    const luciLunghe =
      luciAccese.length && ora - Math.max(luciDa, vuotaDa) >= LUCI_CON_CASA_VUOTA_DA;
    if (this._unaVolta("suggerimenti:luci", Boolean(luciLunghe))) {
      /* «Spegni» spegne solo quelle da spegnere: prima spegneva tutte le
       * luci accese, acquario compreso. */
      this._dici({
        tipo: "suggerimenti",
        urgenza: "bassa",
        importante: true,
        chiave: "suggerimenti:luci",
        pausa: 2 * ORA,
        parole: paroleDelleLuci({
          per: ora - Math.max(luciDa, vuotaDa),
          accese: luciAccese,
          lasciate: lasciate.map((l) => l.nome),
        }),
        azioni: tastiDelleLuci(luciDaSpegnere),
      });
    }
    const climaLungo =
      climiAccesi.length && ora - Math.max(climaDa, vuotaDa) >= CLIMA_CON_CASA_VUOTA_DA;
    if (this._unaVolta("suggerimenti:clima", Boolean(climaLungo))) {
      this._dici({
        tipo: "suggerimenti",
        urgenza: "bassa",
        importante: true,
        chiave: "suggerimenti:clima",
        pausa: 3 * ORA,
        parole: {
          it: {
            titolo: "🌡️ Clima acceso con la casa vuota",
            testo: "Assistente di casa · lo spengo?",
          },
          en: { titolo: "🌡️ Climate on with nobody home", testo: "Home assistant · turn it off?" },
        },
        azioni: [
          {
            id: "spegni",
            parole: duePassi("Spegni", "Turn off"),
            servizio: {
              dominio: "climate",
              servizio: "turn_off",
              entita: climiAccesi.slice(0, 20),
            },
          },
          { id: "piu-tardi", parole: duePassi("Più tardi", "Later"), piuTardi: true },
        ],
      });
    }
    /* Con «Tutti»: anche la musica rimasta accesa. */
    const suona =
      vuota === true
        ? [...this.stati].filter(
            ([id, s]) =>
              dominioDi(id) === "media_player" &&
              s.state === "playing" &&
              ora - s.dal >= LUCI_CON_CASA_VUOTA_DA,
          )
        : [];
    if (this._unaVolta("suggerimenti:musica", suona.length > 0)) {
      this._dici({
        tipo: "suggerimenti",
        urgenza: "bassa",
        importante: false,
        chiave: "suggerimenti:musica",
        pausa: 3 * ORA,
        parole: {
          it: {
            titolo: `🎵 ${nomeDi(suona[0][1], suona[0][0])} suona con la casa vuota`,
            testo: "Assistente di casa · la fermo?",
          },
          en: {
            titolo: `🎵 ${nomeDi(suona[0][1], suona[0][0])} is playing with nobody home`,
            testo: "Home assistant · stop it?",
          },
        },
        azioni: [
          {
            id: "spegni",
            parole: duePassi("Ferma", "Stop"),
            servizio: {
              dominio: "media_player",
              servizio: "media_pause",
              entita: suona.map(([id]) => id).slice(0, 10),
            },
          },
        ],
      });
    }
  }

  /* ─── L'assistente al telefono ─────────────────────────────────────── */

  /* Quello che le regole dell'assistente vedono adesso: la vista di
   * `l-assistente-al-telefono.js`. */
  /* Un termostato, col tipo scritto nella plancia quando c'e'. */
  _eUnTermostato(id, stato) {
    const sua = unitaDelClima(this._valori()).find((u) => String(u?.entity ?? "").trim() === id);
    return eUnTermostato(stato, sua);
  }

  /* Il clima acceso, coi watt della presa quando la plancia ne ha una. */
  _climaAcceso(id, stato) {
    return climaAcceso(id, stato, unitaDelClima(this._valori()), (presa) => this.stati.get(presa));
  }

  _vista() {
    const ora = this.adesso();
    const vuota = this.casaVuota();
    const vuotaDa = this._vuotaDa(vuota);
    const valori = this._valori();
    return {
      ora,
      data: new Date(ora),
      stati: this.stati,
      vuota,
      vuotaDa: Number.isFinite(vuotaDa) ? ora - vuotaDa : null,
      notte: eNotte(new Date(ora)),
      dorme: this._dormeAdesso ?? this._casaDorme(ora),
      aree: this.aree,
      dispositivoDi: this.dispositivoDi || {},
      nomiDeiDispositivi: this.nomiDeiDispositivi || {},
      daNonContare: this.daNonContare,
      valori,
      risolvi: this._risolutore(valori),
      letture: this._lettureDellAssistente(valori),
      statiComeOggetto: () => this.statiComeOggetto(),
      lasciaStare: (id, nome) => this.capire.lasciaStare(id, nome, { tipo: "luce", ora }),
      climaAcceso: (id, stato) =>
        climaAcceso(id, stato, unitaDelClima(valori), (presa) => this.stati.get(presa)),
      memoria: this._memoriaDellAssistente,
    };
  }

  /* Le potenze di adesso: quelle che il taccuino ha appena campionato, o —
   * senza taccuino — lette qui, con i carichi della plancia e le prese. */
  _lettureDellAssistente(valori) {
    if (this.taccuino && this._ultimeLetture) return this._ultimeLetture;
    const letture = letturaDellEnergia(this._risolutore(valori), (id) => this.stati.get(id));
    letture.carichi = {};
    for (const id of this._prese()) letture.carichi[id] = this._watt(this.stati.get(id));
    for (const { id } of carichiDellaPlancia(valori))
      if (!(id in letture.carichi)) letture.carichi[id] = this._watt(this.stati.get(id));
    return letture;
  }

  /* Le regole dell'assistente, a ogni battito: ognuna torna quello che
   * varrebbe adesso, e qui lo si dice una volta sola finche' resta vero. La
   * chiave del «una volta» e' quella dell'evento, o la sua `volta` quando la
   * regola ne vuole una sua (i rifiuti la sera e la mattina, gli
   * aggiornamenti che crescono). Quelle che al giro prima valevano e adesso no
   * si riarmano. */
  _lAssistente() {
    const eventi = regoleDellAssistente(this._vista(), {
      sbaglia: (nome, errore) =>
        this.registro?.errore?.(
          `la regola «${nome}» dell'assistente: ${errore?.message || errore}`,
        ),
    });
    const attive = new Set();
    for (const { volta, ...evento } of eventi) {
      const chiave = volta || evento.chiave;
      attive.add(chiave);
      if (this._unaVolta(chiave, true)) this._dici(evento);
    }
    for (const chiave of this._attiveDellAssistente)
      if (!attive.has(chiave)) this._unaVolta(chiave, false);
    this._attiveDellAssistente = attive;
  }

  /* Da quando la casa e' vuota: l'ultima persona uscita. */
  _vuotaDa(vuota) {
    if (vuota !== true) return Infinity;
    return Math.max(...this.persone().map(([, stato]) => stato.dal));
  }

  /* ─── Il riepilogo della sera ──────────────────────────────────────── */

  /* Quello che va sistemato, in una notifica sola. `null` se non c'e' niente:
   * un riepilogo vuoto non si manda. */
  riepilogo() {
    const tutto = this.cosaSistemare();
    const { spenti, aggiornamenti } = tutto;
    /* Le batterie dei telefoni e degli orologi sono di qualcuno: non si
     * contano fra le cose di casa da sistemare. */
    const batterie = batterieDiCasa(tutto.batterie);
    const daSistemare = { batterie: batterie.length, spenti, aggiornamenti };
    const dati = { ...this._laGiornataDaRaccontare(), daSistemare };
    const nienteDaSistemare = !batterie.length && !spenti && !aggiornamenti;
    if (nienteDaSistemare && !dati.giornata) return null;
    const pezziIt = [];
    const pezziEn = [];
    if (batterie.length) {
      pezziIt.push(
        batterie.length === 1 ? "1 batteria scarica" : `${batterie.length} batterie scariche`,
      );
      pezziEn.push(batterie.length === 1 ? "1 low battery" : `${batterie.length} low batteries`);
    }
    if (spenti) {
      pezziIt.push(
        spenti === 1 ? "1 dispositivo non connesso" : `${spenti} dispositivi non connessi`,
      );
      pezziEn.push(spenti === 1 ? "1 device offline" : `${spenti} devices offline`);
    }
    if (aggiornamenti) {
      pezziIt.push(aggiornamenti === 1 ? "1 aggiornamento" : `${aggiornamenti} aggiornamenti`);
      pezziEn.push(aggiornamenti === 1 ? "1 update" : `${aggiornamenti} updates`);
    }
    return {
      tipo: "riepilogo",
      urgenza: "bassa",
      chiave: "riepilogo",
      pausa: 12 * ORA,
      /* La giornata la scrive `notifiche.js`, per ogni telefono: con il meteo
       * di domani e le notifiche che quel telefono ha voluto «nel
       * riepilogo». Queste sono le parole di sempre, per chi non ha energia
       * da raccontare. */
      componi: { tipo: "riepilogo", dati },
      parole: {
        it: { titolo: "🔋 Riepilogo di stasera", testo: pezziIt.join(", ") },
        en: { titolo: "🔋 Tonight's summary", testo: pezziEn.join(", ") },
      },
    };
  }

  /* Quello che va sistemato: le batterie scariche (col nome e la carica,
   * per la pagina «La tua giornata»), quanti dispositivi non rispondono e
   * quanti aggiornamenti aspettano. Lo usano il riepilogo e la pagina. */
  cosaSistemare() {
    const batterie = [];
    let aggiornamenti = 0;
    /* «Non ci sono 65 dispositivi non connessi»: qui si contavano le entita'
     * mute che hanno un dispositivo, non i dispositivi. Adesso la regola e'
     * quella del cruscotto di chi installa (`salute.js`) e della pagina «Non
     * connessi» della plancia: un dispositivo e' giu' quando NESSUNA delle sue
     * entita' risponde, e conta una volta. Un canale non usato di uno switch
     * acceso, il blocco bambini di un'asciugatrice spenta, non lo fanno giu'. */
    const muti = new Set();
    const vivi = new Set();
    for (const [id, stato] of this.stati) {
      const dominio = dominioDi(id);
      if (dominio === "sensor" && stato.attributes?.device_class === "battery") {
        const n = numero(stato.state);
        if (n !== null && n <= 15) batterie.push({ nome: nomeDi(stato, id), carica: n });
      }
      if (dominio === "update" && stato.state === "on") aggiornamenti += 1;
      const suo = this.dispositivoDi?.[id];
      if (!suo) continue;
      if (stato.state === "unavailable") muti.add(suo);
      else vivi.add(suo);
    }
    const spenti = [...muti].filter((suo) => !vivi.has(suo)).length;
    return { batterie, spenti, aggiornamenti };
  }

  /* La giornata della casa, per il riepilogo: quello che il taccuino ha visto
   * e le cose belle — il record, gli elettrodomestici andati col sole, la
   * batteria per la notte. Senza taccuino, niente giornata. */
  _laGiornataDaRaccontare() {
    const g = this.taccuino?.laGiornata?.();
    if (!g || g.d !== giornoDi(this.adesso()) || (!g.sole && !g.casa && !g.presi))
      return { giornata: null };
    const conSole = Boolean(this._conSole && g.sole);
    const passati = this.taccuino.giorniPassati();
    const misura = (giorno) => (conSole ? giorno.pk : giorno.casa);
    const oggi = conSole ? g.sole : (g.casa ?? g.presi);
    const ieri = passati.at(-1);
    const settimana = passati
      .slice(-7)
      .map(misura)
      .filter((v) => v > 0);
    const media =
      settimana.length >= 3 ? settimana.reduce((a, b) => a + b, 0) / settimana.length : null;
    let record = null;
    if (conSole) {
      const mese = g.d.slice(0, 7);
      const anno = g.d.slice(0, 4);
      const delMese = passati.filter((x) => x.d.startsWith(mese));
      const dellAnno = passati.filter((x) => x.d.startsWith(anno));
      if (dellAnno.length >= 30 && dellAnno.every((x) => (x.pk || 0) < oggi)) record = "anno";
      else if (delMese.length >= 5 && delMese.every((x) => (x.pk || 0) < oggi)) record = "mese";
    }
    const nomeDellaPresa = (id) => nomeDellElettrodomestico(nomeDi(this.stati.get(id), id));
    const colSole = conSole
      ? [...new Set(g.cicli.filter((c) => c.sole >= 0.8).map((c) => nomeDellaPresa(c.id)))].slice(
          0,
          3,
        )
      : [];
    const grosso = g.cicli.slice().sort((a, b) => (b.kwh || 0) - (a.kwh || 0))[0];
    /* Chi ha consumato di piu': i carichi contati tutto il giorno, col nome
     * che gli ha dato la plancia (o quello di Home Assistant). */
    const nomiDellaPlancia = new Map(
      carichiDellaPlancia(this._valori()).map(({ id, nome }) => [id, nome]),
    );
    const nomeDelCarico = (id) => nomiDellaPlancia.get(id) || nomeDellaPresa(id);
    const piu = (g.carichi || [])
      .filter((c) => c.kwh >= 0.05)
      .slice(0, 5)
      .map((c) => ({ nome: nomeDelCarico(c.id), kwh: c.kwh, eur: c.eur, sole: c.sole }));
    const valori = this._valori();
    const bassa = fasciaPiuBassa(valori.cd_fasce_kwh);
    const nomi = {};
    for (const k of Object.keys(g.perFascia || {})) nomi[k] = `F${Number(k) + 1}`;
    return {
      giornata: g,
      conSole,
      ieri: ieri && ieri.d < g.d ? misura(ieri) || null : null,
      media,
      oggi,
      record,
      colSole,
      piu,
      piuAcceso: piu.length
        ? { nome: piu[0].nome, kwh: piu[0].kwh }
        : !conSole && grosso?.kwh > 0.2
          ? { nome: nomeDellaPresa(grosso.id), kwh: grosso.kwh }
          : null,
      batteria: this._ultimeLetture?.carica ?? null,
      fasce: {
        nomi,
        piuBassa: bassa
          ? {
              nome: bassa.nome,
              dalle: `${String(Math.floor(bassa.dalle / 60)).padStart(2, "0")}:${String(bassa.dalle % 60).padStart(2, "0")}`,
            }
          : null,
      },
    };
  }

  /* ─── Le personalizzate ────────────────────────────────────────────── */

  _personalizzate() {
    const ora = this.adesso();
    for (const regola of this.personalizzate) {
      if (!regola?.attiva) continue;
      const stato = this.stati.get(regola.entita);
      const vale = Boolean(stato) && condizioneVera(regola, stato.state);
      const memoria = `pers:${regola.id}`;
      if (!vale) {
        this._memoria.delete(memoria);
        continue;
      }
      if (!this._memoria.has(memoria)) this._memoria.set(memoria, { dal: ora, detta: 0 });
      const traccia = this._memoria.get(memoria);
      const serve = (Number(regola.per) || 0) * MINUTO;
      if (ora - traccia.dal < serve) continue;
      const ripeti = (Number(regola.nonRipetere) || 0) * MINUTO;
      if (traccia.detta && (!ripeti || ora - traccia.detta < ripeti)) continue;
      traccia.detta = ora;
      const nome = nomeDi(stato, regola.entita);
      const unita = stato.attributes?.unit_of_measurement
        ? ` ${stato.attributes.unit_of_measurement}`
        : "";
      const valore = `${stato.state}${unita}`;
      const da = perQuanto(Math.max(ora - traccia.dal, serve || MINUTO));
      const scritto = String(regola.testo || "").trim();
      const testoIt = regola.conValore !== false ? `${valore} da ${da} · ${nome}` : nome;
      const testoEn = regola.conValore !== false ? `${valore} for ${da} · ${nome}` : nome;
      this._dici({
        tipo: "personalizzata",
        urgenza: URGENZE.includes(regola.urgenza) ? regola.urgenza : "normale",
        chiave: `personalizzata:${regola.id}`,
        /* Il «non ripetere» lo tiene gia' la regola: il conto dei telefoni
         * non deve fermarne una seconda prima del tempo. */
        pausa: Math.max(0, ripeti - MINUTO),
        entita: regola.entita,
        solo: Array.isArray(regola.chi) ? regola.chi : [],
        parole: {
          it: { titolo: regola.titolo, testo: scritto ? `${scritto} · ${testoIt}` : testoIt },
          en: { titolo: regola.titolo, testo: scritto ? `${scritto} · ${testoEn}` : testoEn },
        },
      });
    }
  }
}

/* Se lo stato rispetta la condizione di una notifica personalizzata. I
 * numeri si confrontano come numeri, il resto come testo. */
export function condizioneVera(regola, stato) {
  const scritto = String(regola?.valore ?? "").trim();
  const n = numero(stato);
  const soglia = numero(scritto);
  switch (regola?.condizione) {
    case "sopra":
      return n !== null && soglia !== null && n > soglia;
    case "sotto":
      return n !== null && soglia !== null && n < soglia;
    case "uguale":
      return n !== null && soglia !== null ? n === soglia : String(stato) === scritto;
    case "diverso":
      return n !== null && soglia !== null ? n !== soglia : String(stato) !== scritto;
    default:
      return false;
  }
}
