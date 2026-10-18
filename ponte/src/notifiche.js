/* Le notifiche: a chi, quando, e se.
 *
 * La sentinella (`sentinella.js`) dice che e' successo qualcosa. Qui si decide
 * chi lo deve sapere, e lo si dice a ognuno nella sua busta:
 *
 *   evento ─► per ogni telefono abbinato, con l'app che ha chiesto le notifiche
 *               · di un utente di Home Assistant che c'e' ed e' attivo
 *               · che vede almeno una plancia di questa casa
 *               · con l'interruttore generale e quello dell'evento accesi
 *               · fuori dalle sue ore di silenzio (le urgenti passano)
 *               · fuori casa, se ha chiesto «solo quando sono fuori»
 *               · non detto da poco (ogni evento ha la sua pausa)
 *               · senza la telecamera, se quella telecamera a lui non si mostra
 *           ─► chiusa con la sua chiave (`spinta.js`)
 *           ─► al centralino, che la porta a Firebase
 *
 * Le impostazioni sono **per telefono**, e stanno qui sul ponte e non sul
 * telefono: e' il ponte a decidere se mandare, e un telefono spento non puo'
 * dire «adesso no». Le notifiche personalizzate invece sono **della casa** —
 * una regola sul freezer vale per chi la riceve, non per il telefono che l'ha
 * scritta — e dicono loro a chi vanno.
 *
 * ─── I tasti sotto una notifica ───────────────────────────────────────────
 *
 * «Spegni», «Inserisci», «Apri cancello» non sono comandi che il telefono
 * scrive: sono **riferimenti** a un comando che il ponte ha scritto quando ha
 * mandato la notifica. Il telefono, dal suo filo — autenticato col suo segno,
 * come tutto — dice «la notifica tal dei tali, il tasto tal dei tali», e il
 * ponte esegue quello che aveva preparato per **quel** telefono, una volta
 * sola, entro due ore. Un telefono non puo' far eseguire un tasto di una
 * notifica che non era sua, ne' inventarsene uno.
 *
 * ─── Cosa sta sul disco ───────────────────────────────────────────────────
 *
 * `/data/notifiche.json`, chiuso a 600: il gettone di Firebase di ogni
 * telefono, le sue impostazioni, le personalizzate. Il gettone non apre niente
 * — serve solo a consegnare — ma e' un indirizzo, e un indirizzo non si lascia
 * in giro.
 */

import { join } from "node:path";
import { randomBytes } from "node:crypto";

import { Archivio } from "./archivio.js";
import { CapireLaCasa } from "./capire-la-casa.js";
import {
  CATEGORIE,
  EVENTI,
  Sentinella,
  URGENZE,
  categoriaDi,
  genereDiElettrodomestico,
} from "./sentinella.js";
import { chiudiLaFoto, chiudiLaSpinta, CONTENUTO_MASSIMO, FOTO_MASSIMA } from "./spinta.js";
import { vedeQualcosa } from "./plance.js";
import { PROFILO_PRINCIPALE } from "./configurazione.js";
import { TaccuinoDellEnergia } from "./l-energia-di-casa.js";
import {
  DiarioDellaCasa,
  batterieDiCasa,
  capacitaDellAccumulo,
  consiglioPerDomani,
  daSistemare,
  ilConfronto,
  ilMese,
  inBreve,
  prezziDelleFasce,
  prezzoDiCessione,
  senzaNomiDiPersone,
} from "./la-giornata-di-casa.js";
import { COMPOSITORI, PEZZI_DEL_CICLO } from "./parole-delle-notifiche.js";
import { NotificheDiHomeAssistant } from "./notifiche-di-home-assistant.js";

const MINUTO = 60 * 1000;
const ORA = 60 * MINUTO;
/* Le automazioni a orario si rileggono una volta al giorno. */
const AUTOMAZIONI_OGNI = 24 * ORA;

/* Quanto vive il riferimento ai tasti di una notifica. Dopo, «Spegni» non
 * spegne piu' niente: la situazione di due ore fa non e' quella di adesso. */
const VITA_DEI_TASTI = 2 * ORA;
const TASTI_TENUTI_AL_PIU = 500;

/* Quante notifiche per telefono in un'ora, al massimo, comprese le urgenti.
 * Una casa che ne vuole mandare di piu' ha un sensore impazzito, e trenta
 * notifiche in un'ora sono gia' un telefono da buttare dalla finestra. */
const PER_TELEFONO_ALL_ORA = 30;

/* I tasti del riepilogo della sera: «Apri la giornata» apre la pagina
 * nell'app, «OK» la chiude. Nessuno dei due comanda niente in casa. */
export const TASTI_DEL_RIEPILOGO = Object.freeze([
  Object.freeze({
    id: "giornata",
    parole: Object.freeze({ it: "Apri la giornata", en: "Open your day" }),
    apre: true,
  }),
  Object.freeze({ id: "ok", parole: Object.freeze({ it: "OK", en: "OK" }) }),
]);

/** La pagina «La tua giornata» dell'app: la chiede un telefono con un utente. */
export const LA_GIORNATA = "ponte/energia/giornata";

/* Quante notifiche personalizzate per casa. */
export const PERSONALIZZATE_AL_PIU = 40;

/* Ogni quanto gira la sentinella lenta, e ogni quanto si chiede la previsione. */
const BATTITO = 30 * 1000;
const PREVISIONE_OGNI = 15 * MINUTO;
const REGISTRI_OGNI = 6 * ORA;

const ORARIO = /^([01]\d|2[0-3]):([0-5]\d)$/;
const GETTONE_BUONO = /^[A-Za-z0-9_:\-.]{20,4096}$/;
const ENTITA_BUONA = /^[a-z_]+\.[a-z0-9_]+$/;
const UTENTE_BUONO = /^[a-f0-9]{32}$/i;

/* Le azioni che un tasto puo' fare. Sono quelle che la sentinella prepara, e
 * nient'altro: un tasto e' una scorciatoia per cose da tutti i giorni, non
 * una porta sul resto di Home Assistant. */
const SERVIZI_DEI_TASTI = new Set([
  "light.turn_off",
  "climate.turn_off",
  "media_player.media_pause",
  "alarm_control_panel.alarm_arm_away",
  "cover.close_cover",
  "cover.open_cover",
  "lock.unlock",
  "button.press",
  /* L'antifurto scattato: spegnere la sirena, disinserire. E l'inserimento
   * su misura (#413) dalla notifica di movimento: i servizi che un tasto su
   * misura sa chiamare (`plancia/src/core/antifurto-su-misura.js`). Il tasto
   * lo prepara il ponte, per quella entita' e basta: il telefono non sceglie
   * ne' il servizio ne' l'entita'. */
  "alarm_control_panel.alarm_disarm",
  "siren.turn_off",
  "switch.turn_off",
  "input_boolean.turn_off",
  "light.turn_on",
  "script.turn_on",
  "scene.turn_on",
  "input_button.press",
  "automation.trigger",
  "switch.turn_on",
  "input_boolean.turn_on",
  "select.select_option",
  "input_select.select_option",
]);

/* ─── Come le vuoi, e ognuna su misura ─────────────────────────────────────
 *
 * «Dai la scelta nelle impostazioni se vedere notifiche semplici o
 * elaborate.» Ogni telefono sceglie per tutte (`stile`), e poi — voce per
 * voce, toccandola nella pagina Notifiche dell'app — su misura (`su`): lo
 * stile di quella sola, quali dispositivi, una soglia, il suono, in che ore,
 * se subito o dentro il riepilogo della sera, e cosa scriverci.
 *
 * Di serie le notifiche sono **semplici**: con le elaborate, sull'iPhone, la
 * foto di una telecamera passa dal centralino (chiusa per quel telefono, e
 * cancellata appena presa — `spinta.js`), e quella strada si apre solo se la
 * sceglie chi tiene il telefono. */

export const STILI = Object.freeze(["semplici", "elaborate"]);
const STILI_DI_UNA = Object.freeze(["come-tutte", "semplice", "elaborata"]);
const SUONI = Object.freeze(["muta", "normale", "suo"]);
const COME = Object.freeze(["subito", "riepilogo"]);
/* Quando dire un movimento: «solo a casa vuota o di notte» e' quello di serie. */
export const QUANDO_IL_MOVIMENTO = Object.freeze([
  "sempre",
  "casa-vuota",
  "notte",
  "casa-vuota-o-notte",
]);

/** Quello che vale per un evento su quel telefono, coi difetti al loro posto. */
export function suDi(impostazioni, tipo) {
  const suo = impostazioni?.su?.[tipo] || {};
  return {
    stile: STILI_DI_UNA.includes(suo.stile) ? suo.stile : "come-tutte",
    quali: Array.isArray(suo.quali) ? suo.quali : [],
    soglia: typeof suo.soglia === "number" && suo.soglia > 0 ? suo.soglia : null,
    suono: SUONI.includes(suo.suono) ? suo.suono : "normale",
    orari:
      suo.orari && ORARIO.test(String(suo.orari.dalle)) && ORARIO.test(String(suo.orari.alle))
        ? suo.orari
        : null,
    come: COME.includes(suo.come) ? suo.come : "subito",
    dentro: Array.isArray(suo.dentro) ? suo.dentro : [...PEZZI_DEL_CICLO],
    quando: QUANDO_IL_MOVIMENTO.includes(suo.quando) ? suo.quando : "casa-vuota-o-notte",
  };
}

/** Lo stile che vale per quell'evento su quel telefono: «semplice» o «elaborata». */
export function stileDi(impostazioni, tipo) {
  const suo = suDi(impostazioni, tipo).stile;
  if (suo === "semplice" || suo === "elaborata") return suo;
  return impostazioni?.stile === "elaborate" ? "elaborata" : "semplice";
}

/* Una voce di `su` come arriva dal telefono, ripulita sopra quella di prima.
 * Un campo che non si capisce resta com'era; `null` toglie la voce. */
function unaVocePulita(detta, prima = {}) {
  const fuori = { ...prima };
  if (STILI_DI_UNA.includes(detta.stile)) fuori.stile = detta.stile;
  if (Array.isArray(detta.quali))
    fuori.quali = [...new Set(detta.quali.filter((una) => ENTITA_BUONA.test(String(una))))].slice(
      0,
      50,
    );
  if (detta.soglia === null) delete fuori.soglia;
  else if (
    Number.isFinite(Number(detta.soglia)) &&
    detta.soglia !== "" &&
    detta.soglia !== undefined
  )
    fuori.soglia = Math.max(0, Math.min(10_000, Number(detta.soglia)));
  if (SUONI.includes(detta.suono)) fuori.suono = detta.suono;
  if (detta.orari === null) delete fuori.orari;
  else if (
    detta.orari &&
    ORARIO.test(String(detta.orari.dalle)) &&
    ORARIO.test(String(detta.orari.alle))
  )
    fuori.orari = { dalle: detta.orari.dalle, alle: detta.orari.alle };
  if (COME.includes(detta.come)) fuori.come = detta.come;
  if (Array.isArray(detta.dentro))
    fuori.dentro = PEZZI_DEL_CICLO.filter((pezzo) => detta.dentro.includes(pezzo));
  if (QUANDO_IL_MOVIMENTO.includes(detta.quando)) fuori.quando = detta.quando;
  return fuori;
}

/* Se adesso e' dentro le ore scelte per quella voce. Uguali: tutte. */
function dentroLeOre(orari, data) {
  if (!orari) return true;
  const dalle = minutiDi(orari.dalle);
  const alle = minutiDi(orari.alle);
  if (dalle === alle) return true;
  const ora = data.getHours() * 60 + data.getMinutes();
  return dalle < alle ? ora >= dalle && ora < alle : ora >= dalle || ora < alle;
}

export function impostazioniDiSerie() {
  return {
    acceso: true,
    eventi: Object.fromEntries(EVENTI.map((uno) => [uno, true])),
    /* Le persone di cui dire arrivi e uscite: nessuna, finche' non si sceglie. */
    persone: [],
    /* «Solo gli importanti» o «tutti», per l'assistente. */
    assistente: "importanti",
    riepilogo: "20:30",
    silenzio: { acceso: true, dalle: "23:00", alle: "07:00" },
    soloFuori: false,
    lingua: "it",
    stile: "semplici",
    su: {},
  };
}

/* Le impostazioni come arrivano dal telefono, ripulite: quello che non si
 * capisce resta com'era. */
export function impostazioniPulite(dette, prima = impostazioniDiSerie()) {
  const base = { ...impostazioniDiSerie(), ...prima };
  const nuove = {
    ...base,
    eventi: { ...base.eventi },
    silenzio: { ...base.silenzio },
    su: base.su && typeof base.su === "object" && !Array.isArray(base.su) ? { ...base.su } : {},
  };
  if (!STILI.includes(nuove.stile)) nuove.stile = "semplici";
  if (!dette || typeof dette !== "object") return nuove;
  if (STILI.includes(dette.stile)) nuove.stile = dette.stile;
  if (dette.su && typeof dette.su === "object" && !Array.isArray(dette.su)) {
    for (const [tipo, voce] of Object.entries(dette.su)) {
      if (!EVENTI.includes(tipo)) continue;
      if (voce === null) delete nuove.su[tipo];
      else if (voce && typeof voce === "object")
        nuove.su[tipo] = unaVocePulita(voce, nuove.su[tipo] || {});
    }
  }
  if (typeof dette.acceso === "boolean") nuove.acceso = dette.acceso;
  if (dette.eventi && typeof dette.eventi === "object") {
    for (const uno of EVENTI)
      if (typeof dette.eventi[uno] === "boolean") nuove.eventi[uno] = dette.eventi[uno];
  }
  if (Array.isArray(dette.persone))
    nuove.persone = [
      ...new Set(
        dette.persone.filter((una) => typeof una === "string" && /^person\.[a-z0-9_]+$/.test(una)),
      ),
    ].slice(0, 30);
  if (dette.assistente === "importanti" || dette.assistente === "tutti")
    nuove.assistente = dette.assistente;
  if (typeof dette.riepilogo === "string" && ORARIO.test(dette.riepilogo))
    nuove.riepilogo = dette.riepilogo;
  if (dette.silenzio && typeof dette.silenzio === "object") {
    if (typeof dette.silenzio.acceso === "boolean") nuove.silenzio.acceso = dette.silenzio.acceso;
    if (ORARIO.test(String(dette.silenzio.dalle))) nuove.silenzio.dalle = dette.silenzio.dalle;
    if (ORARIO.test(String(dette.silenzio.alle))) nuove.silenzio.alle = dette.silenzio.alle;
  }
  if (typeof dette.soloFuori === "boolean") nuove.soloFuori = dette.soloFuori;
  if (dette.lingua === "it" || dette.lingua === "en") nuove.lingua = dette.lingua;
  return nuove;
}

const minutiDi = (orario) => {
  const [, ore, minuti] = ORARIO.exec(orario) || [null, "0", "0"];
  return Number(ore) * 60 + Number(minuti);
};

/* Se adesso e' dentro le ore di silenzio. Le ore possono passare la
 * mezzanotte (dalle 23 alle 7), e uguali vuol dire nessuna ora. */
export function inSilenzio(impostazioni, data) {
  const silenzio = impostazioni?.silenzio;
  if (!silenzio?.acceso) return false;
  const dalle = minutiDi(silenzio.dalle);
  const alle = minutiDi(silenzio.alle);
  if (dalle === alle) return false;
  const ora = data.getHours() * 60 + data.getMinutes();
  return dalle < alle ? ora >= dalle && ora < alle : ora >= dalle || ora < alle;
}

/* Una notifica personalizzata come arriva dal telefono, ripulita. `null` se
 * non sta in piedi. */
export function personalizzataPulita(detta) {
  if (!detta || typeof detta !== "object") return null;
  const entita = String(detta.entita || "").trim();
  if (!ENTITA_BUONA.test(entita)) return null;
  if (!["sopra", "sotto", "uguale", "diverso"].includes(detta.condizione)) return null;
  const titolo = String(detta.titolo || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (!titolo) return null;
  const minuti = (valore, tetto) => Math.max(0, Math.min(tetto, Math.round(Number(valore) || 0)));
  return {
    id: /^p_[a-f0-9]{12}$/.test(String(detta.id || ""))
      ? detta.id
      : `p_${randomBytes(6).toString("hex")}`,
    attiva: detta.attiva !== false,
    entita,
    condizione: detta.condizione,
    valore: String(detta.valore ?? "").slice(0, 60),
    per: minuti(detta.per, 24 * 60),
    titolo,
    testo: String(detta.testo || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120),
    conValore: detta.conValore !== false,
    urgenza: URGENZE.includes(detta.urgenza) ? detta.urgenza : "normale",
    chi: Array.isArray(detta.chi)
      ? [...new Set(detta.chi.filter((uno) => UTENTE_BUONO.test(String(uno))))].slice(0, 20)
      : [],
    nonRipetere: minuti(detta.nonRipetere ?? 60, 7 * 24 * 60),
  };
}

export class Notifiche {
  constructor({
    cartella = "/data",
    dispositivi,
    utenti = null,
    casa = null,
    commissioni = null,
    plance = null,
    registri = null,
    /* Chi porta la busta al centralino: `{spingi({telefono, gettone, busta,
     * urgente}) → bool, diIGettoni(elenco)}`. Lo mette `index.js` (la
     * chiamata); senza, le notifiche si preparano e non partono. */
    postino = null,
    registro = null,
    /* La configurazione della plancia (`configurazione.js`): le fasce, le
     * caselle dell'energia, gli UPS, l'antifurto su misura. Senza, le regole
     * che ne hanno bisogno tacciono. */
    configurazione = null,
    /* Le licenze (`licenze.js`): le elaborate, la foto, il riepilogo della
     * sera e «La tua giornata» sono di gdahome Premium. Senza — nelle prove
     * — vale come con le licenze spente: tutto acceso. */
    licenze = null,
    adesso = () => Date.now(),
  } = {}) {
    this.configurazione = configurazione;
    this.licenze = licenze;
    this.dispositivi = dispositivi;
    this.utenti = utenti;
    this.casa = casa;
    this.commissioni = commissioni;
    this.plance = plance;
    this.registri = registri;
    this.postino = postino;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {}, debug() {} };
    this.adesso = adesso;
    this.archivio = new Archivio(
      join(cartella, "notifiche.json"),
      { telefoni: {}, personalizzate: [] },
      { modo: 0o600 },
    );
    if (!this.archivio.dati.telefoni || typeof this.archivio.dati.telefoni !== "object")
      this.archivio.dati.telefoni = {};
    if (!Array.isArray(this.archivio.dati.personalizzate)) this.archivio.dati.personalizzate = [];
    this.sentinella = new Sentinella({
      adesso,
      registro: this.registro,
      capire: new CapireLaCasa({ cartella, adesso }),
      quando: (evento) => {
        try {
          this.diario.evento(evento);
        } catch (_errore) {
          /* Il diario non ferma una notifica. */
        }
        void this.consegna(evento);
      },
    });
    this.sentinella.personalizzate = this.archivio.dati.personalizzate;
    this.sentinella.valori = () => this._valori();
    /* Il taccuino dell'energia: i conti dei cicli e della giornata. */
    this.sentinella.taccuino = new TaccuinoDellEnergia({
      cartella: cartella || "",
      adesso,
      registro: this.registro,
    });
    /* Il diario della casa: il clima, il riscaldamento, il solare termico,
     * l'auto, l'acqua e quello che e' successo, per «La tua giornata». */
    this.diario = new DiarioDellaCasa({
      cartella: cartella || "",
      adesso,
      registro: this.registro,
    });
    /** Le righe che un telefono ha voluto «nel riepilogo della sera»: il
     * titolo, e l'evento per mandarlo da solo se il Premium finisce prima
     * della sera. */
    this._inCoda = new Map();
    /** Le notifiche che aspettano la loro soglia (il blackout «oltre N minuti»). */
    this._attese = [];
    /** L'ultima foto chiesta a ogni telefecamera: una al minuto, non di piu'. */
    this._fotoDi = new Map();
    this._domani = null;
    this._automazioniIl = 0;
    /** I tasti delle notifiche mandate: id → {telefono, azioni, scade}. */
    this._tasti = new Map();
    /** Quando si e' detto cosa, e a chi: `telefono|chiave` → ora. */
    this._detto = new Map();
    /** Gli eventi rimandati con «Più tardi»: `telefono|chiave` → fino a. */
    this._rimandati = new Map();
    /** Quante notifiche per telefono nell'ultima ora. */
    this._conti = new Map();
    this._riepilogoDel = new Map();
    this._firmaDeiGettoni = "";
    this._giro = null;
    this._disdici = null;
    this._previsioneIl = 0;
    this._registriIl = 0;
    /** Le notifiche che le automazioni di Home Assistant mandano ai telefoni,
     * anche qui (`notifiche-di-home-assistant.js`). */
    this.daHomeAssistant = new NotificheDiHomeAssistant({
      notifiche: this,
      registro: this.registro,
      adesso,
    });
  }

  /* ─── Premium ──────────────────────────────────────────────────────────
   *
   * Lo decide il ponte, con lo stesso criterio delle automazioni
   * (`automazioni.js`, `sbloccato`): gdahome Premium, o le licenze spente.
   *
   *  - Base: solo notifiche **semplici**, nessuna foto della telecamera,
   *    nessun riepilogo della sera (ne' testo ne' scheda), e la pagina «La
   *    tua giornata» risponde `premium-richiesto`. Le righe che un telefono
   *    aveva messo «nel riepilogo» partono subito, semplici.
   *  - Gli avvisi di sicurezza — antifurto, allarmi, perdite, blackout e
   *    batteria dell'UPS — partono sempre: Premium cambia come si vedono,
   *    mai se arrivano.
   *
   * Si guarda a ogni notifica: quando il Premium scade si torna da soli alle
   * semplici, e le impostazioni del telefono restano com'erano per quando
   * torna. */
  get premium() {
    try {
      if (!this.licenze?.attive) return true;
      return this.licenze.premium === true;
    } catch (_errore) {
      return false;
    }
  }

  /* La configurazione della plancia principale, come la tengono i
   * dispositivi. */
  _valori() {
    try {
      return this.configurazione?.leggi?.(PROFILO_PRINCIPALE)?.snapshot?.values || {};
    } catch (_errore) {
      return {};
    }
  }

  /* ─── Accendere e spegnere ─────────────────────────────────────────── */

  /* Guarda la casa: tutti gli stati, poi i cambi. Se il filo con Home
   * Assistant cade, ci si riabbona da soli al giro dopo. */
  async parti() {
    this.sincronizza();
    if (!this._giro) {
      this._giro = setInterval(() => void this._battito(), BATTITO);
      this._giro.unref?.();
    }
    await this._abbonati();
    this.daHomeAssistant.parti();
  }

  async _abbonati() {
    if (!this.casa || this._disdici || this._abbonando) return;
    this._abbonando = true;
    try {
      const stati = await this.casa.chiedi({ type: "get_states" });
      this.sentinella.carica(stati);
      this._disdici = await this.casa.ascolta(
        "state_changed",
        (evento) => {
          const dati = evento?.data;
          if (!dati?.entity_id) return;
          this.sentinella.cambia(dati.entity_id, dati.new_state, dati.old_state);
          try {
            this.diario.cambia(
              dati.entity_id,
              dati.new_state,
              dati.old_state,
              this.sentinella.stati,
            );
          } catch (errore) {
            this.registro.debug?.(`il diario della casa: ${errore?.message || errore}`);
          }
        },
        {
          onCaduto: () => {
            this._disdici = null;
          },
        },
      );
      void this._iRegistri();
    } catch (errore) {
      this.registro.debug?.(`le notifiche non vedono ancora la casa: ${errore?.message || errore}`);
    } finally {
      this._abbonando = false;
    }
  }

  async _iRegistri() {
    if (!this.registri) return;
    this._registriIl = this.adesso();
    try {
      const { di } = await this.registri.leMappe();
      this.sentinella.dispositivoDi = di || {};
    } catch (_errore) {
      /* Senza registri la telecamera si cerca per nome. */
    }
    await this._lAnagrafe();
    if (this.adesso() - this._automazioniIl >= AUTOMAZIONI_OGNI) await this._leAutomazioni();
  }

  /* «Cosa c'e' in casa», dal config: quello che l'assistente ha capito, e le
   * correzioni di chi amministra. Solo nomi e generi, niente stati. */
  casaCapita(detto) {
    const id = detto?.id ?? null;
    const capire = this.sentinella.capire;
    const si = (result) => ({ id, type: "result", success: true, result });
    if (detto?.type === "ponte/casa-capita/elenco") {
      const nome = (stato, entita) =>
        String(stato?.attributes?.friendly_name || entita).slice(0, 60);
      return si({ cose: capire.elenco(this.sentinella.stati, nome) });
    }
    if (detto?.type === "ponte/casa-capita/scegli") {
      if (!capire.scegli(String(detto.entita || ""), String(detto.scelta || "")))
        return {
          id,
          type: "result",
          success: false,
          error: { code: "invalid", message: "scelta non valida" },
        };
      capire.scrivi();
      return si({ fatto: true });
    }
    return {
      id,
      type: "result",
      success: false,
      error: { code: "unknown_command", message: `non conosco ${detto?.type}` },
    };
  }

  /* Quello che Home Assistant sa delle cose, per l'assistente: l'area dove
   * stanno, la marca e il modello del dispositivo. Una luce nell'area
   * «Giardino» e' esterna, una porta nell'area «Bagno» e' interna. Solo
   * nomi, e restano qui (`capire-la-casa.js`). */
  async _lAnagrafe() {
    try {
      const { dispositivi, entita } = await this.registri.chiedi();
      const aree = await this.casa?.chiedi({ type: "config/area_registry/list" }).catch(() => []);
      const nomeDellArea = new Map(
        (Array.isArray(aree) ? aree : []).map((a) => [a?.area_id, String(a?.name || "")]),
      );
      const dispositivo = new Map(
        (Array.isArray(dispositivi) ? dispositivi : []).map((d) => [d?.id, d]),
      );
      const descrizioni = {};
      for (const voce of Array.isArray(entita) ? entita : []) {
        const id = voce?.entity_id;
        if (typeof id !== "string" || !/^(light|switch|binary_sensor|cover)\./.test(id)) continue;
        const suo = dispositivo.get(voce?.device_id);
        const pezzi = [
          nomeDellArea.get(voce?.area_id || suo?.area_id),
          suo?.manufacturer,
          suo?.model,
          suo?.name_by_user || suo?.name,
        ]
          .map((p) => String(p || "").trim())
          .filter(Boolean);
        if (pezzi.length) descrizioni[id] = pezzi.join(" · ").slice(0, 160);
      }
      this.sentinella.capire.descrivi(descrizioni);
    } catch (_errore) {
      /* Senza anagrafe l'assistente guarda i nomi, come prima. */
    }
  }

  /* Le luci che un'automazione a orario accende o spegne da se' (all'ora,
   * al tramonto, a intervalli): sono a orario, e l'assistente non le propone.
   * Una volta al giorno: le automazioni cambiano di rado. */
  async _leAutomazioni() {
    this._automazioniIl = this.adesso();
    if (!this.casa) return;
    const gestite = new Set();
    const automazioni = [...this.sentinella.stati.keys()]
      .filter((id) => id.startsWith("automation."))
      .slice(0, 200);
    for (const id of automazioni) {
      try {
        const risposta = await this.casa.chiedi({ type: "automation/config", entity_id: id });
        const config = risposta?.config || risposta || {};
        const scatti = [].concat(config.triggers || config.trigger || []);
        const aOrario = scatti.some((s) =>
          ["time", "sun", "time_pattern"].includes(String(s?.trigger || s?.platform || "")),
        );
        if (!aOrario) continue;
        const azioni = JSON.stringify(config.actions || config.action || []);
        for (const entita of azioni.match(/\b(light|switch)\.[a-z0-9_]+/g) || [])
          gestite.add(entita);
      } catch (_errore) {
        /* Un'automazione che non si legge non ferma le altre. */
      }
    }
    this.sentinella.capire.gestiteDaAutomazioni([...gestite]);
  }

  /* Il diario della casa, a ogni battito: con le potenze che la sentinella
   * ha appena letto, per dividere la ricarica dell'auto fra sole e rete. */
  _campionaIlDiario() {
    try {
      const valori = this._valori();
      this.diario.campiona({
        stati: this.sentinella.stati,
        valori,
        energia: this.sentinella._ultimeLetture ?? null,
        prezzo: (istante) => this.sentinella.prezzo(istante, valori),
      });
    } catch (errore) {
      this.registro.errore?.(`il diario della casa: ${errore?.message || errore}`);
    }
  }

  ferma() {
    this.daHomeAssistant?.ferma();
    this.diario?.scrivi?.();
    clearInterval(this._giro);
    this._giro = null;
    const disdici = this._disdici;
    this._disdici = null;
    void disdici?.();
  }

  async _battito() {
    if (!this._disdici) await this._abbonati();
    this.sentinella.movimentoSempre = Object.values(this.archivio.dati.telefoni).some(
      (voce) => suDi(impostazioniPulite(voce?.impostazioni), "movimento").quando === "sempre",
    );
    this.sentinella.battito();
    this._campionaIlDiario();
    await this._leAttese();
    this.sincronizza();
    await this._riepiloghi();
    if (this.adesso() - this._previsioneIl >= PREVISIONE_OGNI) await this._previsione();
    if (this.adesso() - this._registriIl >= REGISTRI_OGNI) void this._iRegistri();
    this._pulisci();
  }

  /* La previsione oraria, per «tra mezz'ora piove». Solo se c'e' una finestra
   * aperta: altrimenti non c'e' niente da dire, e non si chiede. */
  async _previsione() {
    this._previsioneIl = this.adesso();
    if (!this.casa || !this.sentinella._finestreAperte().length) return;
    const tempo = [...this.sentinella.stati.keys()].find((id) => id.startsWith("weather."));
    if (!tempo) return;
    try {
      const risposta = await this.casa.chiedi({
        type: "execute_script",
        sequence: [
          {
            service: "weather.get_forecasts",
            data: { type: "hourly" },
            target: { entity_id: tempo },
            response_variable: "previsione",
          },
          { stop: "fatto", response_variable: "previsione" },
        ],
      });
      const elenco = risposta?.response?.[tempo]?.forecast;
      this.sentinella.previsione(tempo, elenco);
    } catch (_errore) {
      /* Una previsione che non c'e' non e' un guasto. */
    }
  }

  /* Il riepilogo della sera: ogni telefono alla sua ora, con la giornata
   * della casa, il meteo di domani e le notifiche che ha voluto lasciare per
   * la sera. */
  async _riepiloghi() {
    const premium = this.premium;
    /* In Base il riepilogo non c'e': le righe messe da parte quando il
     * Premium c'era partono adesso, ognuna da sola e semplice. */
    if (!premium) {
      const code = [...this._inCoda];
      this._inCoda.clear();
      for (const [telefono, righe] of code)
        for (const riga of righe)
          if (riga?.evento) await this.consegna(riga.evento, { soloA: telefono });
    }
    const ora = new Date(this.adesso());
    const adessoInMinuti = ora.getHours() * 60 + ora.getMinutes();
    const oggi = ora.toDateString();
    let riepilogo;
    let batterie;
    for (const [telefono, voce] of Object.entries(this.archivio.dati.telefoni)) {
      const imp = impostazioniPulite(voce.impostazioni);
      const quando = minutiDi(imp.riepilogo);
      if (adessoInMinuti < quando || adessoInMinuti > quando + 10) continue;
      if (this._riepilogoDel.get(telefono) === oggi) continue;
      this._riepilogoDel.set(telefono, oggi);
      /* Chi il riepilogo non lo riceve — una casa Base, o un telefono che
       * l'ha spento — le batterie da cambiare le sa lo stesso, alla stessa
       * ora: e' un avviso di sicurezza, mai dietro Premium. Chi lo riceve le
       * trova dentro il riepilogo, una volta sola. */
      if (!premium || !imp.eventi.riepilogo) {
        if (batterie === undefined) batterie = await this._leBatterieDaCambiare();
        if (batterie)
          await this.consegna({ ...batterie, quando: this.adesso() }, { soloA: telefono });
        continue;
      }
      if (riepilogo === undefined) {
        riepilogo = this.sentinella.riepilogo();
        if (riepilogo) riepilogo.componi.dati.domani = await this._ilTempoDiDomani();
      }
      const inCoda = (this._inCoda.get(telefono) || []).map((riga) => riga.titolo);
      this._inCoda.delete(telefono);
      if (!riepilogo && !inCoda.length) continue;
      const base = riepilogo ?? {
        tipo: "riepilogo",
        urgenza: "bassa",
        chiave: "riepilogo",
        pausa: 12 * ORA,
        componi: { tipo: "riepilogo", dati: { giornata: null } },
        parole: { it: { titolo: "🔋 Riepilogo di stasera", testo: "" } },
      };
      await this.consegna(
        {
          ...base,
          quando: this.adesso(),
          azioni: base.componi.dati.giornata ? TASTI_DEL_RIEPILOGO.map((t) => ({ ...t })) : [],
          componi: { ...base.componi, dati: { ...base.componi.dati, inCoda } },
        },
        { soloA: telefono },
      );
    }
  }

  /* «🔋 Batterie da cambiare»: le batterie scariche dei dispositivi di casa,
   * col nome e la carica. Non quelle dei telefoni e degli orologi, che sono
   * di qualcuno, e nessun nome di persona. `null` se non ce n'e'. */
  async _leBatterieDaCambiare() {
    let elenco = [];
    try {
      elenco = batterieDiCasa(this.sentinella.cosaSistemare().batterie);
    } catch (_errore) {
      elenco = [];
    }
    if (!elenco.length) return null;
    const chiCe = (await this._chiCe()) ?? [];
    const nomi = [
      ...this.sentinella
        .persone()
        .map(([, stato]) => String(stato?.attributes?.friendly_name || "")),
      ...chiCe.map((uno) => String(uno?.nome || "")),
    ].filter(Boolean);
    const righe = senzaNomiDiPersone(
      elenco
        .slice()
        .sort((a, b) => a.carica - b.carica)
        .map((b) => `${b.nome} ${Math.round(b.carica)}%`),
      nomi,
    );
    const mostrate = righe.slice(0, 5);
    const altre = righe.length - mostrate.length;
    const testo = (ancora) => [...mostrate, ...(altre ? [ancora] : [])].join(" · ");
    return {
      tipo: "riepilogo",
      /* Passa anche col riepilogo spento, e in Base: non e' il riepilogo. */
      sempre: true,
      stileDellaVoce: "semplice",
      urgenza: "normale",
      chiave: "batterie-da-cambiare",
      pausa: 20 * ORA,
      parole: {
        it: {
          titolo: "🔋 Batterie da cambiare",
          testo: testo(altre === 1 ? "+1 altra" : `+${altre} altre`),
        },
        en: { titolo: "🔋 Batteries to replace", testo: testo(`+${altre} more`) },
      },
      azioni: [],
    };
  }

  /* Il cielo di domani dalle nove alle cinque, per il consiglio del
   * riepilogo: una volta per sera, dalla previsione oraria di Home Assistant. */
  async _ilTempoDiDomani() {
    const giorno = new Date(this.adesso()).toDateString();
    if (this._domani?.giorno === giorno) return this._domani.dati;
    this._domani = { giorno, dati: null };
    const tempo = [...this.sentinella.stati.keys()].find((id) => id.startsWith("weather."));
    if (!tempo || !this.casa) return null;
    try {
      const risposta = await this.casa.chiedi({
        type: "execute_script",
        sequence: [
          {
            service: "weather.get_forecasts",
            data: { type: "hourly" },
            target: { entity_id: tempo },
            response_variable: "previsione",
          },
          { stop: "fatto", response_variable: "previsione" },
        ],
      });
      this._domani.dati = cieloDiDomani(risposta?.response?.[tempo]?.forecast, this.adesso());
    } catch (_errore) {
      /* Senza previsione, niente consiglio. */
    }
    return this._domani.dati;
  }

  /* Le notifiche che aspettano la loro soglia: partono se quello che dicono e'
   * ancora vero (la corrente e' ancora via dopo i minuti scelti). */
  async _leAttese() {
    const ora = this.adesso();
    const pronte = this._attese.filter((una) => una.dopo <= ora);
    this._attese = this._attese.filter((una) => una.dopo > ora);
    for (const una of pronte) {
      if (typeof una.evento.ancora === "function" && !una.evento.ancora()) continue;
      await this.consegna({ ...una.evento, attesa: true }, { soloA: una.telefono });
    }
  }

  _pulisci() {
    const ora = this.adesso();
    for (const [id, tasti] of this._tasti) if (tasti.scade <= ora) this._tasti.delete(id);
    for (const [chi, fino] of this._rimandati) if (fino <= ora) this._rimandati.delete(chi);
    for (const [chi, quando] of this._detto) if (ora - quando > 24 * ORA) this._detto.delete(chi);
    for (const [chi, volte] of this._conti) {
      const recenti = volte.filter((una) => ora - una < ORA);
      if (recenti.length) this._conti.set(chi, recenti);
      else this._conti.delete(chi);
    }
  }

  /* ─── I gettoni, e il centralino ───────────────────────────────────── */

  /* I telefoni che hanno un gettone e sono ancora abbinati. Quelli staccati
   * escono da qui, dal disco e dal centralino, al primo giro. */
  _conGettone() {
    const vivi = new Set(this.dispositivi.elenco().map((uno) => uno.id));
    let tolti = 0;
    for (const telefono of Object.keys(this.archivio.dati.telefoni)) {
      if (!vivi.has(telefono)) {
        delete this.archivio.dati.telefoni[telefono];
        tolti += 1;
      }
    }
    if (tolti) this._salva();
    return Object.entries(this.archivio.dati.telefoni)
      .filter(([, voce]) => typeof voce.gettone === "string" && voce.gettone)
      .map(([telefono, voce]) => ({ telefono, gettone: voce.gettone }));
  }

  /* Dice al centralino l'elenco dei gettoni, ma solo se e' cambiato. */
  sincronizza({ sempre = false } = {}) {
    const elenco = this._conGettone();
    const firma = elenco
      .map((uno) => `${uno.telefono}=${uno.gettone}`)
      .sort()
      .join("|");
    if (!sempre && firma === this._firmaDeiGettoni) return;
    this._firmaDeiGettoni = firma;
    this.postino?.diIGettoni?.(elenco);
  }

  /* Il centralino dice che Firebase quel gettone non lo conosce piu': l'app
   * e' stata tolta, o ha un gettone nuovo che non ha ancora detto. */
  gettoneMorto(telefono) {
    const voce = this.archivio.dati.telefoni[telefono];
    if (!voce?.gettone) return;
    voce.gettone = "";
    this._salva();
    this.sincronizza();
    this.registro.info(`un telefono non riceve piu' le notifiche: Firebase non lo conosce`);
  }

  _salva() {
    try {
      this.archivio.salva();
    } catch (errore) {
      this.registro.errore(`le notifiche non si salvano: ${errore?.message || errore}`);
    }
  }

  impostazioniDi(telefono) {
    return impostazioniPulite(this.archivio.dati.telefoni[telefono]?.impostazioni);
  }

  /* ─── Consegnare ───────────────────────────────────────────────────── */

  async _chiCe() {
    if (!this.utenti) return null;
    try {
      return await this.utenti.elenco();
    } catch (_errore) {
      return null;
    }
  }

  /* Se a questo utente quella telecamera si mostra: le stesse regole della
   * plancia (`commissioni.js`, `telecamereChiuse`). */
  _vedeLaTelecamera(utente, amministra, camera) {
    if (!camera) return false;
    const chiuse =
      amministra === true ? null : this.commissioni?.telecamereChiuse?.(utente, amministra);
    return !chiuse?.has?.(camera);
  }

  _vedeLaCasa(utente, amministra) {
    if (!this.plance) return true;
    try {
      return vedeQualcosa(this.plance.elenco(), utente, amministra);
    } catch (_errore) {
      return true;
    }
  }

  /* Se questo evento questo telefono lo vuole. */
  _lovuole(imp, evento, utente) {
    if (!imp.acceso) return false;
    if (evento.tipo === "prova") return true;
    /* Le batterie da cambiare passano anche col riepilogo spento. */
    if (imp.eventi[evento.tipo] === false && !evento.sempre) return false;
    if (evento.tipo === "suggerimenti" && imp.assistente === "importanti" && !evento.importante)
      return false;
    if (evento.tipo === "arrivi" && !imp.persone.includes(evento.persona)) return false;
    if (evento.solo?.length && !evento.solo.includes(utente)) return false;
    /* Un viaggio pianificato l'ha messo chi lo riceve, a quell'ora: passa le
     * ore di silenzio come le urgenti (la sveglia per partire alle sei). */
    if (
      evento.urgenza !== "urgente" &&
      !evento.oltreIlSilenzio &&
      inSilenzio(imp, new Date(this.adesso()))
    )
      return false;
    const categoria = categoriaDi(evento.tipo);
    if (imp.soloFuori && (categoria === "casa" || categoria === "assistente")) {
      if (this.sentinella.aCasa(utente) === true) return false;
    }
    /* Su misura, voce per voce. */
    const su = suDi(imp, evento.tipo);
    if (su.quali.length && ![evento.entita, evento.camera].some((uno) => su.quali.includes(uno)))
      return false;
    if (!dentroLeOre(su.orari, new Date(this.adesso()))) return false;
    if (evento.tipo === "movimento" && evento.perche) {
      const vuole = {
        sempre: true,
        "casa-vuota": evento.perche === "casa-vuota",
        notte: evento.perche === "notte",
        "casa-vuota-o-notte": evento.perche !== "giorno",
      }[su.quando];
      if (!vuole) return false;
    }
    if (
      evento.tipo === "elettrodomestici" &&
      su.soglia !== null &&
      typeof evento.misura?.euro === "number" &&
      evento.misura.euro < su.soglia
    )
      return false;
    return true;
  }

  _cePosto(telefono, evento) {
    const ora = this.adesso();
    const volte = (this._conti.get(telefono) || []).filter((una) => ora - una < ORA);
    /* Le prove non hanno limite e non contano fra le trenta dell'ora:
     * «non deve esserci alcun limite». Le preme a mano chi le vuole, e
     * provare le voci non deve zittire le notifiche vere. */
    if (evento.tipo === "prova") return true;
    if (volte.length >= PER_TELEFONO_ALL_ORA) return false;
    volte.push(ora);
    this._conti.set(telefono, volte);
    return true;
  }

  /* Manda un evento a chi lo deve sapere. Torna quanti telefoni l'hanno
   * avuto. `soloA`: un telefono solo (il riepilogo, la prova). */
  async consegna(evento, { soloA = null } = {}) {
    const premium = this.premium;
    /* Il riepilogo della sera in Base non esiste. */
    if (evento?.tipo === "riepilogo" && !evento.sempre && !premium) return 0;
    const elenco = this.dispositivi.elenco();
    const chiCe = await this._chiCe();
    const ora = this.adesso();
    let quanti = 0;
    /* E per le case che hanno gia' due abbinamenti con lo stesso indirizzo
     * (prima della regola qui sopra): a ogni indirizzo una busta sola, quella
     * dell'abbinamento aggiornato per ultimo. */
    const ultimoPer = new Map();
    for (const dispositivo of elenco) {
      const voce = this.archivio.dati.telefoni[dispositivo.id];
      if (!voce?.gettone) continue;
      const gia = ultimoPer.get(voce.gettone);
      const suo = Number(voce.aggiornatoIl) || 0;
      if (!gia || suo >= gia.quando)
        ultimoPer.set(voce.gettone, { id: dispositivo.id, quando: suo });
    }
    for (const dispositivo of elenco) {
      if (soloA && dispositivo.id !== soloA) continue;
      const voce = this.archivio.dati.telefoni[dispositivo.id];
      if (!voce?.gettone) continue;
      if (ultimoPer.get(voce.gettone)?.id !== dispositivo.id) continue;
      /* Solo telefoni di utenti veri, attivi adesso. Un telefono senza
       * utente — abbinato prima che i telefoni si intestassero — non riceve:
       * non si sa di chi sia, e allora non si sa cosa possa vedere. */
      const utente = dispositivo.utente;
      if (!utente || !chiCe) continue;
      const chi = chiCe.find((uno) => uno.id === utente);
      if (!chi || chi.attivo === false) continue;
      const amministra = chi.amministratore === true;
      if (!this._vedeLaCasa(utente, amministra)) continue;
      const imp = impostazioniPulite(voce.impostazioni);
      if (!this._lovuole(imp, evento, utente)) continue;
      const su = suDi(imp, evento.tipo);
      /* «Nel riepilogo della sera»: non parte adesso, si mette da parte una
       * riga. L'urgente parte sempre — una cosa urgente la sera non serve.
       * Senza Premium il riepilogo non c'e', e la notifica parte subito. */
      if (
        premium &&
        su.come === "riepilogo" &&
        evento.tipo !== "riepilogo" &&
        evento.tipo !== "prova" &&
        evento.urgenza !== "urgente"
      ) {
        const { titolo } = this._parole(evento, imp.lingua, { stile: "semplice", su });
        const coda = this._inCoda.get(dispositivo.id) || [];
        coda.push({ titolo: String(titolo).slice(0, 90), evento });
        this._inCoda.set(dispositivo.id, coda.slice(-6));
        continue;
      }
      /* Il blackout «oltre N minuti»: aspetta, e parte solo se la corrente e'
       * ancora via (`_leAttese`). E il ritorno di un blackout che a questo
       * telefono non si e' detto non si dice nemmeno lui. */
      if (evento.tipo === "blackout" && su.soglia) {
        if (evento.misura?.fase === "torna") {
          if ((evento.misura?.durata || 0) < su.soglia) continue;
        } else if (!evento.attesa) {
          const dopo = (evento.misura?.dal ?? ora) + su.soglia * MINUTO;
          if (dopo > ora) {
            this._attese.push({ telefono: dispositivo.id, evento, dopo });
            continue;
          }
        }
      }
      const chiave = `${dispositivo.id}|${evento.chiave}`;
      if ((this._rimandati.get(chiave) || 0) > ora) continue;
      if (
        evento.tipo !== "prova" &&
        evento.pausa &&
        ora - (this._detto.get(chiave) || 0) < evento.pausa
      )
        continue;
      if (!this._cePosto(dispositivo.id, evento)) continue;
      const chiaveDelFilo = this.dispositivi.chiaveDi(dispositivo.id);
      if (!chiaveDelFilo) continue;
      const camera = this._vedeLaTelecamera(utente, amministra, evento.camera)
        ? evento.camera
        : null;
      /* Senza Premium tutte semplici, qualunque cosa abbia scelto il telefono. */
      const stile = premium ? evento.stileDellaVoce || stileDi(imp, evento.tipo) : "semplice";
      /* La foto solo a chi ha scelto le elaborate, e solo della telecamera che
       * gli si mostra. Va al centralino prima della busta, che porta il numero
       * che il centralino le ha dato. */
      let foto = null;
      if (
        premium &&
        stile === "elaborata" &&
        evento.conFoto &&
        camera &&
        this.postino?.mandaLaFoto
      ) {
        const byte = await this._laFoto(evento, camera);
        if (byte) {
          try {
            const dati = chiudiLaFoto({ chiaveDelFilo, telefono: dispositivo.id, byte });
            const id = await this.postino.mandaLaFoto({ telefono: dispositivo.id, dati });
            if (typeof id === "string" && id) foto = { id, t: "image/jpeg" };
          } catch (errore) {
            this.registro.attenzione(`una foto non si chiude: ${errore?.message || errore}`);
          }
        }
      }
      const contenuto = this._contenuto(evento, imp.lingua, {
        camera,
        stile,
        su: evento.suDellaVoce || su,
        foto,
      });
      let busta;
      try {
        busta = chiudiLaSpinta({ chiaveDelFilo, telefono: dispositivo.id, contenuto });
      } catch (errore) {
        this.registro.attenzione(`una notifica non si chiude: ${errore?.message || errore}`);
        continue;
      }
      const partita = this.postino?.spingi?.({
        telefono: dispositivo.id,
        gettone: voce.gettone,
        busta,
        urgente: evento.urgenza === "urgente",
      });
      if (!partita) continue;
      this._detto.set(chiave, ora);
      this._ricordaITasti(contenuto.id, dispositivo.id, evento);
      quanti += 1;
    }
    if (quanti) this.registro.debug?.(`notifica «${evento.tipo}» a ${quanti} telefoni`);
    return quanti;
  }

  /* Le parole di un evento per quel telefono: quelle del racconto, nello
   * stile scelto, o quelle che l'evento porta gia'. */
  _parole(evento, lingua, { stile = "semplice", su = null } = {}) {
    const comporre = evento.componi && COMPOSITORI[evento.componi.tipo];
    if (comporre) {
      try {
        const fuori = comporre(evento.componi.dati, lingua, {
          stile,
          ...(su?.dentro ? { dentro: su.dentro } : {}),
        });
        if (fuori)
          return {
            titolo: fuori.titolo,
            testo: fuori.testo,
            scheda: stile === "elaborata" ? fuori.scheda || null : null,
          };
      } catch (errore) {
        this.registro.attenzione?.(`una notifica non si scrive: ${errore?.message || errore}`);
      }
    }
    const parole = evento.parole?.[lingua] ?? evento.parole?.it ?? { titolo: "GdAHome", testo: "" };
    return { titolo: parole.titolo, testo: parole.testo, scheda: null };
  }

  /* La foto di quella telecamera per questo evento: una per evento (tutti i
   * telefoni ricevono la stessa, chiusa ognuno con la sua chiave) e — tranne
   * l'antifurto — al piu' una al minuto per telecamera. Grande al piu' 1280
   * punti, e se pesa troppo 640: il centralino non tiene oltre 300 KB. */
  _laFoto(evento, camera) {
    if (evento._foto !== undefined) return evento._foto;
    evento._foto = (async () => {
      const ora = this.adesso();
      if (evento.tipo !== "antifurto" && ora - (this._fotoDi.get(camera) || 0) < MINUTO)
        return null;
      this._fotoDi.set(camera, ora);
      if (typeof this.casa?.immagine !== "function") return null;
      for (const larghezza of [1280, 640]) {
        try {
          const byte = await this.casa.immagine(`camera_proxy/${camera}?width=${larghezza}`);
          if (byte?.length && byte.length <= FOTO_MASSIMA) return byte;
        } catch (_errore) {
          return null;
        }
      }
      return null;
    })();
    return evento._foto;
  }

  /* Quello che va dentro la busta. Le parole nella lingua del telefono; i
   * tasti col loro nome, e senza il comando — quello resta qui. */
  _contenuto(evento, lingua, { camera, stile = "semplice", su = null, foto = null }) {
    const { titolo, testo, scheda } = this._parole(evento, lingua, { stile, su });
    const contenuto = {
      v: 1,
      id: randomBytes(9).toString("base64url"),
      tipo: evento.tipo,
      cat: categoriaDi(evento.tipo) ?? "prova",
      urg: evento.urgenza,
      titolo: String(titolo || "").slice(0, 120),
      testo: String(testo || "").slice(0, 600),
      quando: evento.quando ?? this.adesso(),
      scade: (evento.quando ?? this.adesso()) + VITA_DEI_TASTI,
      stile: stile === "elaborata" ? "e" : "s",
      ...(su && su.suono !== "normale" ? { suono: su.suono } : {}),
      ...(evento.entita ? { entita: evento.entita } : {}),
      ...(camera ? { camera } : {}),
      ...(evento.chiamata ? { chiamata: true } : {}),
      ...(scheda ? { scheda: structuredClone(scheda) } : {}),
      /* Da dove viene, sotto il testo: «Automazione di Home Assistant ·
       * Lavatrice finita». */
      ...(evento.fonte
        ? { fonte: String(evento.fonte[lingua] ?? evento.fonte.it ?? "").slice(0, 120) }
        : {}),
      ...(foto ? { foto } : {}),
      azioni: (evento.azioni || []).slice(0, 3).map((una) => ({
        id: una.id,
        etichetta: String(una.parole?.[lingua] ?? una.parole?.it ?? una.id).slice(0, 30),
        ...(una.apre ? { apre: true } : {}),
      })),
    };
    /* Una notifica troppo lunga si accorcia: prima il testo, poi le curve
     * della scheda (meta' dei punti), poi la scheda se ne va. La notifica
     * parte sempre. */
    const pesa = () => Buffer.byteLength(JSON.stringify(contenuto));
    while (pesa() > CONTENUTO_MASSIMO - 50) {
      const curve = contenuto.scheda
        ? ["w", "s", "p", "c", "met", "ev"].filter(
            (k) => Array.isArray(contenuto.scheda[k]) && contenuto.scheda[k].length > 4,
          )
        : [];
      if (contenuto.testo.length > 120)
        contenuto.testo = `${contenuto.testo.slice(0, Math.floor(contenuto.testo.length * 0.7))}…`;
      else if (curve.length)
        for (const k of curve)
          contenuto.scheda[k] = contenuto.scheda[k].filter((_v, i) => i % 2 === 0);
      else if (contenuto.scheda) delete contenuto.scheda;
      else if (contenuto.testo.length > 10)
        contenuto.testo = `${contenuto.testo.slice(0, Math.floor(contenuto.testo.length * 0.7))}…`;
      else break;
    }
    return contenuto;
  }

  _ricordaITasti(id, telefono, evento) {
    const azioni = {};
    for (const una of evento.azioni || []) {
      if (una.servizio) azioni[una.id] = { servizio: una.servizio };
      else if (una.piuTardi) azioni[una.id] = { piuTardi: true, chiave: evento.chiave };
      else if (Array.isArray(una.resta)) azioni[una.id] = { resta: una.resta.slice(0, 40) };
      else if (Array.isArray(una.vaBene)) azioni[una.id] = { vaBene: una.vaBene.slice(0, 10) };
      else if (typeof una.haAzione === "string") azioni[una.id] = { haAzione: una.haAzione };
    }
    if (!Object.keys(azioni).length) return;
    this._tasti.set(id, { telefono, azioni, scade: this.adesso() + VITA_DEI_TASTI });
    while (this._tasti.size > TASTI_TENUTI_AL_PIU)
      this._tasti.delete(this._tasti.keys().next().value);
  }

  /* ─── Quello che chiede il telefono ────────────────────────────────── */

  riconosce(tipo) {
    return (
      typeof tipo === "string" && (tipo.startsWith("ponte/notifiche/") || tipo === LA_GIORNATA)
    );
  }

  /**
   * La giornata della casa per la pagina «La tua giornata» dell'app: quello
   * che il riepilogo della sera racconta, con tutti i numeri, e il resto
   * della casa dal diario (`la-giornata-di-casa.js`): il clima delle stanze,
   * il riscaldamento, il solare termico, l'auto, l'acqua, gli eventi, i
   * conti, il mese, il confronto, le cose da sistemare e «In breve». Ogni
   * sezione c'e' solo se in casa c'e' quello che serve, altrimenti `null`.
   * Solo numeri, orari e nomi delle cose: niente entita', niente nomi di
   * persone, niente dati di altri telefoni. `{giornata: null}` se oggi non
   * si e' visto niente.
   */
  async giornataDettagliata() {
    const s = this.sentinella;
    const dati = s?._laGiornataDaRaccontare?.() || {};
    const g = dati.giornata;
    const valori = this._valori();
    const statiComeOggetto = s.statiComeOggetto();
    let casa = null;
    try {
      casa = this.diario.laGiornata({ stati: s.stati, valori });
    } catch (errore) {
      this.registro.attenzione?.(`il diario della casa: ${errore?.message || errore}`);
    }
    const sezioni = casa || {};
    const qualcosa =
      sezioni.clima ||
      sezioni.riscaldamento ||
      sezioni.solareTermico ||
      sezioni.auto ||
      sezioni.acqua ||
      sezioni.eventi?.length;
    if (!g && !qualcosa) return { giornata: null };
    let domani = null;
    try {
      domani = await this._ilTempoDiDomani();
    } catch (_errore) {
      domani = null;
    }
    const passati = s.taccuino?.giorniPassati?.() || [];
    /* Domani: la massima, e il consiglio per gli elettrodomestici che ci sono
     * e per l'auto, se c'e'. */
    if (domani) {
      const elettrodomestici = s
        ._prese()
        .map((id) =>
          genereDiElettrodomestico(`${id} ${s.stati.get(id)?.attributes?.friendly_name || ""}`),
        );
      domani = {
        met: domani.met,
        soleFino: domani.soleFino,
        pioggia: domani.pioggia,
        max: domani.max ?? null,
        consiglio: consiglioPerDomani({
          domani,
          conSole: Boolean(dati.conSole),
          elettrodomestici,
          conAuto: Boolean(sezioni.auto?.length),
        }),
      };
    }
    /* Quello che il sole ceduto ha fatto guadagnare, col prezzo di cessione
     * scritto nella plancia; e il prezzo di ogni fascia usata. */
    const cessione = prezzoDiCessione(valori, statiComeOggetto);
    const prezzi = g ? prezziDelleFasce(valori.cd_fasce_kwh, g.perFascia) : null;
    let batteria = null;
    try {
      batteria = s.taccuino?.laBatteria?.(capacitaDellAccumulo(valori, statiComeOggetto)) ?? null;
    } catch (_errore) {
      batteria = null;
    }
    let sistemare = [];
    try {
      sistemare = daSistemare(s.cosaSistemare());
    } catch (_errore) {
      sistemare = [];
    }
    const risposta = {
      giornata: g
        ? {
            d: g.d,
            sole: g.sole,
            casa: g.casa,
            presi: g.presi,
            ceduti: g.ceduti,
            euroCeduti:
              cessione && typeof g.ceduti === "number"
                ? Math.round(g.ceduti * cessione * 100) / 100
                : null,
            usato: g.usato,
            quotaInCasa: g.quotaInCasa,
            euroRete: g.euroRete,
            risparmio: g.risparmio,
            picco: g.picco,
            piccoIl: g.piccoIl,
            p: g.p,
            c: g.c,
            perFascia: g.perFascia,
          }
        : null,
      conSole: Boolean(dati.conSole),
      /* Chi ha consumato di piu', dal piu' grosso. */
      piu: Array.isArray(dati.piu) ? dati.piu : [],
      ieri: dati.ieri ?? null,
      media: dati.media ?? null,
      record: dati.record ?? null,
      /* La batteria di casa per la pagina (`laBatteria`); il riepilogo usa
       * ancora il numero della carica di stasera. */
      batteria,
      fasce:
        dati.fasce || prezzi ? { ...(dati.fasce || { nomi: {}, piuBassa: null }), prezzi } : null,
      domani,
      /* La settimana: i totali dei sette giorni prima. */
      settimana: passati.slice(-7).map((x) => ({ d: x.d, pk: x.pk, casa: x.casa, eur: x.eur })),
      clima: sezioni.clima ?? null,
      riscaldamento: sezioni.riscaldamento ?? null,
      solareTermico: sezioni.solareTermico ?? null,
      auto: sezioni.auto ?? null,
      acqua: sezioni.acqua ?? null,
      eventi: sezioni.eventi ?? [],
      conti: sezioni.conti ?? null,
      mese: g ? ilMese(passati, g) : null,
      confronto: g
        ? ilConfronto({ passati, giornata: g, conSole: Boolean(dati.conSole), media: dati.media })
        : null,
      daSistemare: sistemare,
    };
    risposta.inBreve = inBreve(risposta);
    /* Ultima cosa prima di partire: nessun nome di chi abita, in nessun
     * testo. Ne' delle persone di Home Assistant ne' degli utenti. */
    const chiCe = (await this._chiCe()) ?? [];
    const nomi = [
      ...s.persone().map(([, stato]) => String(stato?.attributes?.friendly_name || "")),
      ...chiCe.map((uno) => String(uno?.nome || "")),
    ].filter(Boolean);
    return senzaNomiDiPersone(risposta, nomi);
  }

  /* `dispositivo`: il telefono di questo filo, gia' riconosciuto. `amministra`:
   * se chi lo tiene amministra la casa. Non solleva: un no e' una risposta. */
  async rispondi(detto, { dispositivo, amministra = false } = {}) {
    const id = detto?.id ?? null;
    const si = (result) => ({ id, type: "result", success: true, result });
    const no = (code, message) => ({
      id,
      type: "result",
      success: false,
      error: { code, message },
    });
    const telefono = dispositivo?.id;
    if (!telefono) return no("unauthorized", "prima bisogna entrare");
    const utente = dispositivo.utente || "";
    try {
      /* La pagina «La tua giornata»: solo chi ha un utente sul filo. */
      /* Le notifiche di Home Assistant anche qui: solo chi ha un utente. */
      if (this.daHomeAssistant.riconosce(detto.type))
        return await this.daHomeAssistant.rispondi(detto, {
          telefono,
          utente,
          amministra,
          si,
          no,
        });
      if (detto.type === LA_GIORNATA) {
        if (!utente) return no("unauthorized", "la giornata della casa si vede da un utente");
        if (!this.premium)
          return no("premium-richiesto", "«La tua giornata» e' di GdAHome Premium");
        return si(await this.giornataDettagliata());
      }
      switch (detto.type) {
        case "ponte/notifiche/stato":
          return si(await this._stato(telefono, utente, amministra));
        case "ponte/notifiche/registra": {
          const gettone = String(detto.gettone || "");
          if (!GETTONE_BUONO.test(gettone)) return no("invalid_format", "gettone non valido");
          const voce = (this.archivio.dati.telefoni[telefono] ??= {
            impostazioni: impostazioniDiSerie(),
          });
          voce.gettone = gettone;
          /* Lo stesso telefono abbinato di nuovo (casa tolta e rimessa
           * nell'app) ha un abbinamento nuovo e lo stesso indirizzo di
           * Firebase. Il vecchio restava qui col suo indirizzo, e la casa
           * mandava due buste: quella nuova si apriva, quella vecchia — la
           * cui chiave il telefono non ha piu' — arrivava come «gdahome ·
           * nuova notifica». Un indirizzo e' di un abbinamento solo: l'ultimo
           * che lo dice. */
          for (const [altro, sua] of Object.entries(this.archivio.dati.telefoni))
            if (altro !== telefono && sua?.gettone === gettone) sua.gettone = "";
          voce.piattaforma = detto.piattaforma === "ios" ? "ios" : "android";
          voce.aggiornatoIl = this.adesso();
          if (detto.lingua === "it" || detto.lingua === "en")
            voce.impostazioni = impostazioniPulite({ lingua: detto.lingua }, voce.impostazioni);
          this._salva();
          this.sincronizza();
          return si(await this._stato(telefono, utente, amministra));
        }
        case "ponte/notifiche/togli": {
          const voce = this.archivio.dati.telefoni[telefono];
          if (voce) {
            voce.gettone = "";
            this._salva();
            this.sincronizza();
          }
          return si({ fatto: true });
        }
        case "ponte/notifiche/imposta": {
          const voce = (this.archivio.dati.telefoni[telefono] ??= {
            gettone: "",
            impostazioni: impostazioniDiSerie(),
          });
          voce.impostazioni = impostazioniPulite(detto.impostazioni, voce.impostazioni);
          this._salva();
          return si({ impostazioni: voce.impostazioni });
        }
        case "ponte/notifiche/prova": {
          const voce = this.archivio.dati.telefoni[telefono];
          if (!voce?.gettone)
            return no("not_found", "questo telefono non ha ancora chiesto le notifiche");
          if (!this.postino)
            return no("not_supported", "le notifiche passano dal centralino, e qui non c'e'");
          /* «Prova adesso» dall'editor di una personalizzata: arriva come
           * arriverebbe, col valore di adesso, ma solo a chi la sta scrivendo. */
          const regola = detto.regola ? personalizzataPulita(detto.regola) : null;
          if (detto.regola && !regola) return no("invalid_format", "la notifica non e' completa");
          /* «Prova: mandamela adesso» dal foglio di una voce: com'e' fatta
           * quella notifica, nello stile scelto, con numeri d'esempio. */
          const tipo = detto.tipo ?? detto.evento;
          const esempio = !regola && tipo ? esempioDi(tipo, this.adesso()) : null;
          if (tipo && !regola && !esempio)
            return no("invalid_format", "di questa notifica non c'e' un esempio");
          /* Il riepilogo della sera, in Base, non c'e' nemmeno di prova. */
          if (tipo === "riepilogo" && !regola && !this.premium)
            return no("premium-richiesto", "il riepilogo della sera e' di GdAHome Premium");
          const prova = regola ? this._provaDi(regola) : esempio || this._provaQualunque();
          if (esempio) {
            /* Lo stile e' quello che la voce avra' davvero. */
            const imp = this.impostazioniDi(telefono);
            prova.stileDellaVoce = stileDi(imp, tipo);
            prova.suDellaVoce = suDi(imp, tipo);
          }
          const mandate = await this.consegna(prova, { soloA: telefono });
          if (!mandate) return no("not_sent", "non e' partita: riprova fra qualche minuto");
          return si({ mandata: true });
        }
        case "ponte/notifiche/personalizzata/salva":
          return this._salvaUnaPersonalizzata(detto.regola, { utente, amministra, si, no });
        case "ponte/notifiche/personalizzata/togli":
          return this._togliUnaPersonalizzata(detto.regola, { utente, amministra, si, no });
        case "ponte/notifiche/azione":
          return this._unTasto(detto, { telefono, utente, si, no });
        default:
          return no("unknown_command", "questo ponte non conosce questa domanda");
      }
    } catch (errore) {
      this.registro.errore(`notifiche: ${errore?.message || errore}`);
      return no("ponte_notifiche", "non ha funzionato");
    }
  }

  _provaQualunque() {
    return {
      tipo: "prova",
      urgenza: "normale",
      chiave: "prova",
      quando: this.adesso(),
      parole: {
        it: {
          titolo: "✅ Notifica di prova",
          testo: "Se la leggi, le notifiche di questa casa arrivano.",
        },
        en: {
          titolo: "✅ Test notification",
          testo: "If you can read this, this home's notifications work.",
        },
      },
      azioni: [],
    };
  }

  /* Una personalizzata come arriverebbe adesso. */
  _provaDi(regola) {
    const stato = this.sentinella.stati.get(regola.entita);
    const nome = String(stato?.attributes?.friendly_name || regola.entita).slice(0, 60);
    const unita = stato?.attributes?.unit_of_measurement
      ? ` ${stato.attributes.unit_of_measurement}`
      : "";
    const valore = stato ? `${stato.state}${unita} · ${nome}` : nome;
    const testo = [regola.testo, regola.conValore ? valore : ""].filter(Boolean).join(" · ");
    return {
      tipo: "prova",
      urgenza: regola.urgenza,
      chiave: "prova",
      quando: this.adesso(),
      entita: regola.entita,
      parole: {
        it: { titolo: regola.titolo, testo: testo || nome },
        en: { titolo: regola.titolo, testo: testo || nome },
      },
      azioni: [],
    };
  }

  async _stato(telefono, utente, amministra) {
    const voce = this.archivio.dati.telefoni[telefono];
    const persone = this.sentinella.persone().map(([id, stato]) => ({
      id,
      nome: String(stato.attributes?.friendly_name || id).slice(0, 60),
    }));
    const chiCe = (await this._chiCe()) ?? [];
    return {
      impostazioni: impostazioniPulite(voce?.impostazioni),
      registrato: Boolean(voce?.gettone),
      /* Senza un utente un telefono non riceve: l'app lo dice e propone di
       * riabbinarlo. */
      intestato: Boolean(utente),
      /* Le notifiche partono dal centralino: con «da fuori casa» spento non
       * c'e' nessuno che le porti. */
      centralino: Boolean(this.postino?.pronto ?? this.postino),
      categorie: CATEGORIE,
      persone,
      /* Chi non amministra vede se stesso e le sue: i nomi degli altri
       * utenti, e le regole fatte per loro, non sono affar suo. */
      utenti: chiCe
        .filter((uno) => uno.attivo !== false && (amministra === true || uno.id === utente))
        .map((uno) => ({ id: uno.id, nome: uno.nome })),
      personalizzate: this.archivio.dati.personalizzate
        .filter((regola) => amministra === true || regola.chi.includes(utente))
        .map((regola) => ({
          ...regola,
          modificabile: this._puoToccare(regola, utente, amministra),
        })),
      io: utente,
      amministra: amministra === true,
      /* gdahome Premium: senza, l'app mette il lucchetto su «Elaborate» e sul
       * «Riepilogo della sera». */
      premium: this.premium,
    };
  }

  /* Chi amministra tocca tutte le personalizzate; gli altri solo quelle che
   * vanno a loro e basta. */
  _puoToccare(regola, utente, amministra) {
    if (amministra === true) return true;
    return Boolean(utente) && regola.chi.length === 1 && regola.chi[0] === utente;
  }

  _salvaUnaPersonalizzata(detta, { utente, amministra, si, no }) {
    const regola = personalizzataPulita(detta);
    if (!regola) return no("invalid_format", "la notifica non e' completa");
    if (!regola.chi.length && utente) regola.chi = [utente];
    const elenco = this.archivio.dati.personalizzate;
    const dove = elenco.findIndex((una) => una.id === regola.id);
    if (dove >= 0 && !this._puoToccare(elenco[dove], utente, amministra))
      return no("unauthorized", "questa notifica la cambia chi amministra la casa");
    if (!this._puoToccare(regola, utente, amministra))
      return no("unauthorized", "una notifica per altri la fa chi amministra la casa");
    if (dove < 0 && elenco.length >= PERSONALIZZATE_AL_PIU)
      return no("too_many", `al massimo ${PERSONALIZZATE_AL_PIU} notifiche personalizzate`);
    if (dove >= 0) elenco[dove] = regola;
    else elenco.push(regola);
    this._salva();
    return si({ regola });
  }

  _togliUnaPersonalizzata(id, { utente, amministra, si, no }) {
    const elenco = this.archivio.dati.personalizzate;
    const dove = elenco.findIndex((una) => una.id === id);
    if (dove < 0) return si({ fatto: true });
    if (!this._puoToccare(elenco[dove], utente, amministra))
      return no("unauthorized", "questa notifica la toglie chi amministra la casa");
    elenco.splice(dove, 1);
    this._salva();
    return si({ fatto: true });
  }

  /* Un tasto premuto sotto una notifica. */
  async _unTasto(detto, { telefono, utente, si, no }) {
    const tasti = this._tasti.get(String(detto.notifica || ""));
    if (!tasti || tasti.telefono !== telefono || tasti.scade <= this.adesso())
      return no("not_found", "questa notifica e' scaduta");
    const azione = tasti.azioni[String(detto.azione || "")];
    if (!azione) return no("not_found", "questo tasto non c'e'");
    /* Una volta sola: un secondo tocco, o un messaggio rigiocato, non rifa'. */
    delete tasti.azioni[String(detto.azione)];
    if (azione.piuTardi) {
      this._rimandati.set(`${telefono}|${azione.chiave}`, this.adesso() + ORA);
      return si({ fatto: true });
    }
    /* «Restano così» e «Va bene stanotte»: l'assistente lo ricorda per
     * tutta la casa (`capire-la-casa.js`). Non toccano niente in Home
     * Assistant: dicono solo cosa non proporre piu'. */
    if (azione.resta) {
      this.sentinella.capire.resta(azione.resta);
      this.sentinella.capire.scrivi();
      return si({ fatto: true });
    }
    if (azione.vaBene) {
      for (const id of azione.vaBene) this.sentinella.capire.vaBeneStanotte(id);
      this.sentinella.capire.scrivi();
      return si({ fatto: true });
    }
    if (!utente || (this.utenti && !(await this.utenti.eVivo(utente).catch(() => false))))
      return no("unauthorized", "l'utente di questo telefono non c'e' piu'");
    /* Un tasto di una notifica di Home Assistant: torna a Home Assistant come
     * lo manda la sua app, `mobile_app_notification_action` con l'azione, e
     * le automazioni che lo aspettano vanno avanti. Non comanda niente da se'. */
    if (azione.haAzione) {
      await this.casa.chiedi({
        type: "fire_event",
        event_type: "mobile_app_notification_action",
        event_data: { action: azione.haAzione },
      });
      this.registro.info(`dal tasto di una notifica di Home Assistant`);
      return si({ fatto: true });
    }
    const { dominio, servizio, entita, dati } = azione.servizio;
    if (!SERVIZI_DEI_TASTI.has(`${dominio}.${servizio}`))
      return no("unauthorized", "questo tasto no");
    /* L'unico dato che un tasto porta e' la voce di un menu (l'inserimento su
     * misura con un `select`): scritta dal ponte quando ha preparato il tasto. */
    const opzione =
      servizio === "select_option" && typeof dati?.option === "string"
        ? dati.option.slice(0, 100)
        : null;
    await this.casa.chiedi({
      type: "call_service",
      domain: dominio,
      service: servizio,
      target: { entity_id: entita },
      ...(opzione ? { service_data: { option: opzione } } : {}),
    });
    this.registro.info(`dal tasto di una notifica: ${dominio}.${servizio}`);
    return si({ fatto: true });
  }
}

/* ─── Il cielo di domani ─────────────────────────────────────────────────── */

const CIELI = Object.freeze({
  sunny: "sole",
  "clear-night": "sole",
  partlycloudy: "poco",
  cloudy: "nuvole",
  fog: "nuvole",
  windy: "nuvole",
  "windy-variant": "nuvole",
  rainy: "pioggia",
  pouring: "pioggia",
  "lightning-rainy": "pioggia",
  lightning: "pioggia",
  snowy: "pioggia",
  "snowy-rainy": "pioggia",
  hail: "pioggia",
});

/**
 * Dalla previsione oraria di Home Assistant, il cielo di domani alle 9, 11,
 * 13, 15 e 17, fino a che ora c'e' il sole (dalle nove in poi, senza
 * interruzioni), e se piove. `null` se domani nella previsione non c'e'.
 */
export function cieloDiDomani(previsione, adesso) {
  const domani = new Date(adesso);
  domani.setDate(domani.getDate() + 1);
  const giorno = domani.toDateString();
  const perOra = new Map();
  /* La temperatura di ogni ora di domani, per la massima. */
  const gradi = [];
  for (const una of Array.isArray(previsione) ? previsione : []) {
    const quando = new Date(Date.parse(una?.datetime || ""));
    if (Number.isNaN(quando.getTime()) || quando.toDateString() !== giorno) continue;
    perOra.set(quando.getHours(), CIELI[una?.condition] || "nuvole");
    const t = Number(una?.temperature);
    if (una?.temperature !== null && una?.temperature !== undefined && Number.isFinite(t))
      gradi.push(t);
  }
  if (!perOra.size) return null;
  const met = [9, 11, 13, 15, 17].filter((h) => perOra.has(h)).map((h) => [h, perOra.get(h)]);
  let soleFino = null;
  for (let h = 9; h <= 18; h += 1) {
    const cielo = perOra.get(h);
    if (cielo === undefined) continue;
    if (cielo === "sole" || cielo === "poco") soleFino = `${String(h + 1).padStart(2, "0")}:00`;
    else break;
  }
  if (soleFino && Number(soleFino.slice(0, 2)) < 12) soleFino = null;
  const pioggia = [...perOra.entries()].some(([h, c]) => h >= 8 && h <= 20 && c === "pioggia");
  /* Da che ora c'e' il sole, per «Auto: ricarica dalle 10». */
  let soleDa = null;
  for (let h = 8; h <= 17 && soleFino; h += 1)
    if (perOra.get(h) === "sole" || perOra.get(h) === "poco") {
      soleDa = h;
      break;
    }
  return {
    met,
    soleFino,
    pioggia,
    max: gradi.length ? Math.round(Math.max(...gradi) * 10) / 10 : null,
    soleDa,
  };
}

/* ─── Gli esempi ─────────────────────────────────────────────────────────── */

/**
 * Una notifica d'esempio di quel tipo, coi numeri dei disegni approvati: per
 * «Prova: mandamela adesso» e per le prove. `null` per un tipo che non
 * racconta niente.
 */
export function esempioDi(tipo, adesso = Date.now()) {
  const curva = [
    30, 1900, 2050, 1980, 400, 180, 160, 170, 150, 160, 170, 600, 620, 180, 170, 160, 600, 650, 700,
    300, 120, 110, 400, 450, 380, 60, 40, 20, 10,
  ];
  const sole = [
    1500, 1480, 1450, 1420, 400, 180, 160, 170, 150, 160, 170, 600, 620, 180, 170, 160, 600, 650,
    600, 300, 120, 110, 350, 300, 250, 60, 40, 20, 10,
  ];
  const base = { tipo: "prova", urgenza: "normale", chiave: "prova", quando: adesso, azioni: [] };
  const conParole = (evento, comporre, dati) => {
    const it = comporre(dati, "it");
    const en = comporre(dati, "en");
    return {
      ...evento,
      componi: { tipo: Object.keys(COMPOSITORI).find((k) => COMPOSITORI[k] === comporre), dati },
      parole: {
        it: { titolo: it.titolo, testo: it.testo },
        en: { titolo: en.titolo, testo: en.testo },
      },
    };
  };
  switch (tipo) {
    case "elettrodomestici":
      return conParole(base, COMPOSITORI.ciclo, {
        nome: "Lavatrice",
        genere: "lavatrice",
        conSole: true,
        fascia: "F1",
        ciclo: {
          da: "15:50",
          a: "17:42",
          min: 112,
          kwh: 0.94,
          sole: 0.72,
          batt: 0,
          rkwh: 0.26,
          eur: 0.05,
          reur: 0.05,
          senza: 0.16,
          w: curva,
          s: sole,
          meglio: null,
        },
      });
    case "riepilogo": {
      const p = [0, 0, 0, 0, 0, 0, 1, 5, 14, 25, 35, 43, 48, 49, 46, 39, 29, 17, 6, 1, 0, 0, 0, 0];
      const c = [4, 3, 3, 3, 3, 3, 5, 9, 7, 6, 19, 21, 8, 7, 6, 7, 12, 9, 14, 22, 16, 10, 7, 5];
      return conParole(
        { ...base, azioni: TASTI_DEL_RIEPILOGO.map((t) => ({ ...t })) },
        COMPOSITORI.riepilogo,
        {
          giornata: {
            d: new Date(adesso).toISOString().slice(0, 10),
            sole: 18.4,
            casa: 16.7,
            presi: 3.1,
            ceduti: 4.8,
            usato: 13.6,
            quotaInCasa: 0.74,
            euroRete: 0.52,
            risparmio: 2.41,
            picco: 4.9,
            piccoIl: "13:10",
            p,
            c,
            perFascia: {},
            cicli: [],
          },
          conSole: true,
          ieri: 16.4,
          media: 15.1,
          record: "mese",
          colSole: ["Lavatrice", "Lavastoviglie"],
          piuAcceso: null,
          batteria: 62,
          domani: {
            met: [
              [9, "sole"],
              [11, "sole"],
              [13, "sole"],
              [15, "poco"],
              [17, "nuvole"],
            ],
            soleFino: "15:00",
            pioggia: false,
          },
          fasce: { nomi: {}, piuBassa: null },
          daSistemare: { batterie: 1, spenti: 0, aggiornamenti: 1 },
          inCoda: [],
        },
      );
    }
    case "blackout":
      return conParole(base, COMPOSITORI.blackout, {
        nome: "UPS di casa",
        carica: 96,
        minuti: 25,
        watt: 180,
        dalle: "18:04",
        fase: "via",
      });
    case "movimento":
      return conParole(base, COMPOSITORI.movimento, {
        nome: "Ingresso",
        cam: "Ingresso",
        ora: "18:22",
        secondi: "18:22:07",
        vuota: true,
        notte: false,
      });
    case "antifurto":
      return conParole(base, COMPOSITORI.antifurto, {
        nome: "Antifurto",
        zona: "Finestra cucina",
        ora: "18:22",
        modo: "Totale",
        dalle: "08:10",
        sirena: true,
        ev: [
          ["18:22", "Finestra cucina · aperta", "r"],
          ["18:21", "Movimento · Cucina", "a"],
        ],
      });
    default:
      return null;
  }
}
