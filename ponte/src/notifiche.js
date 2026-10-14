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
import { CATEGORIE, EVENTI, Sentinella, URGENZE, categoriaDi } from "./sentinella.js";
import { chiudiLaSpinta, CONTENUTO_MASSIMO } from "./spinta.js";
import { vedeQualcosa } from "./plance.js";

const MINUTO = 60 * 1000;
const ORA = 60 * MINUTO;

/* Quanto vive il riferimento ai tasti di una notifica. Dopo, «Spegni» non
 * spegne piu' niente: la situazione di due ore fa non e' quella di adesso. */
const VITA_DEI_TASTI = 2 * ORA;
const TASTI_TENUTI_AL_PIU = 500;

/* Quante notifiche per telefono in un'ora, al massimo, comprese le urgenti.
 * Una casa che ne vuole mandare di piu' ha un sensore impazzito, e trenta
 * notifiche in un'ora sono gia' un telefono da buttare dalla finestra. */
const PER_TELEFONO_ALL_ORA = 30;
/* E di prova, per non farne un campanello. */
const PROVE_OGNI_DIECI_MINUTI = 3;

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
]);

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
  };
}

/* Le impostazioni come arrivano dal telefono, ripulite: quello che non si
 * capisce resta com'era. */
export function impostazioniPulite(dette, prima = impostazioniDiSerie()) {
  const base = { ...impostazioniDiSerie(), ...prima };
  const nuove = { ...base, eventi: { ...base.eventi }, silenzio: { ...base.silenzio } };
  if (!dette || typeof dette !== "object") return nuove;
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
    adesso = () => Date.now(),
  } = {}) {
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
      quando: (evento) => {
        void this.consegna(evento);
      },
    });
    this.sentinella.personalizzate = this.archivio.dati.personalizzate;
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
          if (dati?.entity_id)
            this.sentinella.cambia(dati.entity_id, dati.new_state, dati.old_state);
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
  }

  ferma() {
    clearInterval(this._giro);
    this._giro = null;
    const disdici = this._disdici;
    this._disdici = null;
    void disdici?.();
  }

  async _battito() {
    if (!this._disdici) await this._abbonati();
    this.sentinella.battito();
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

  /* Il riepilogo della sera: ogni telefono alla sua ora. */
  async _riepiloghi() {
    const ora = new Date(this.adesso());
    const adessoInMinuti = ora.getHours() * 60 + ora.getMinutes();
    const oggi = ora.toDateString();
    let riepilogo;
    for (const [telefono, voce] of Object.entries(this.archivio.dati.telefoni)) {
      const imp = impostazioniPulite(voce.impostazioni);
      if (!imp.eventi.riepilogo) continue;
      const quando = minutiDi(imp.riepilogo);
      if (adessoInMinuti < quando || adessoInMinuti > quando + 10) continue;
      if (this._riepilogoDel.get(telefono) === oggi) continue;
      this._riepilogoDel.set(telefono, oggi);
      riepilogo ??= this.sentinella.riepilogo();
      if (!riepilogo) return;
      await this.consegna({ ...riepilogo, quando: this.adesso(), azioni: [] }, { soloA: telefono });
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
    if (imp.eventi[evento.tipo] === false) return false;
    if (evento.tipo === "suggerimenti" && imp.assistente === "importanti" && !evento.importante)
      return false;
    if (evento.tipo === "arrivi" && !imp.persone.includes(evento.persona)) return false;
    if (evento.solo?.length && !evento.solo.includes(utente)) return false;
    if (evento.urgenza !== "urgente" && inSilenzio(imp, new Date(this.adesso()))) return false;
    const categoria = categoriaDi(evento.tipo);
    if (imp.soloFuori && (categoria === "casa" || categoria === "assistente")) {
      if (this.sentinella.aCasa(utente) === true) return false;
    }
    return true;
  }

  _cePosto(telefono, evento) {
    const ora = this.adesso();
    const volte = (this._conti.get(telefono) || []).filter((una) => ora - una < ORA);
    if (evento.tipo === "prova") {
      const prove = (this._conti.get(`${telefono}|prova`) || []).filter(
        (una) => ora - una < 10 * MINUTO,
      );
      if (prove.length >= PROVE_OGNI_DIECI_MINUTI) return false;
      prove.push(ora);
      this._conti.set(`${telefono}|prova`, prove);
    }
    if (volte.length >= PER_TELEFONO_ALL_ORA) return false;
    volte.push(ora);
    this._conti.set(telefono, volte);
    return true;
  }

  /* Manda un evento a chi lo deve sapere. Torna quanti telefoni l'hanno
   * avuto. `soloA`: un telefono solo (il riepilogo, la prova). */
  async consegna(evento, { soloA = null } = {}) {
    const elenco = this.dispositivi.elenco();
    const chiCe = await this._chiCe();
    const ora = this.adesso();
    let quanti = 0;
    for (const dispositivo of elenco) {
      if (soloA && dispositivo.id !== soloA) continue;
      const voce = this.archivio.dati.telefoni[dispositivo.id];
      if (!voce?.gettone) continue;
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
      const contenuto = this._contenuto(evento, imp.lingua, {
        camera: this._vedeLaTelecamera(utente, amministra, evento.camera) ? evento.camera : null,
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

  /* Quello che va dentro la busta. Le parole nella lingua del telefono; i
   * tasti col loro nome, e senza il comando — quello resta qui. */
  _contenuto(evento, lingua, { camera }) {
    const parole = evento.parole?.[lingua] ?? evento.parole?.it ?? { titolo: "gdahome", testo: "" };
    const contenuto = {
      v: 1,
      id: randomBytes(9).toString("base64url"),
      tipo: evento.tipo,
      cat: categoriaDi(evento.tipo) ?? "prova",
      urg: evento.urgenza,
      titolo: String(parole.titolo || "").slice(0, 120),
      testo: String(parole.testo || "").slice(0, 300),
      quando: evento.quando ?? this.adesso(),
      scade: (evento.quando ?? this.adesso()) + VITA_DEI_TASTI,
      ...(evento.entita ? { entita: evento.entita } : {}),
      ...(camera ? { camera } : {}),
      ...(evento.chiamata ? { chiamata: true } : {}),
      azioni: (evento.azioni || []).slice(0, 3).map((una) => ({
        id: una.id,
        etichetta: String(una.parole?.[lingua] ?? una.parole?.it ?? una.id).slice(0, 30),
        ...(una.apre ? { apre: true } : {}),
      })),
    };
    /* Una notifica troppo lunga si accorcia nel testo, mai nel resto. */
    while (
      Buffer.byteLength(JSON.stringify(contenuto)) > CONTENUTO_MASSIMO - 50 &&
      contenuto.testo.length > 10
    )
      contenuto.testo = `${contenuto.testo.slice(0, Math.floor(contenuto.testo.length * 0.7))}…`;
    return contenuto;
  }

  _ricordaITasti(id, telefono, evento) {
    const azioni = {};
    for (const una of evento.azioni || []) {
      if (una.servizio) azioni[una.id] = { servizio: una.servizio };
      else if (una.piuTardi) azioni[una.id] = { piuTardi: true, chiave: evento.chiave };
    }
    if (!Object.keys(azioni).length) return;
    this._tasti.set(id, { telefono, azioni, scade: this.adesso() + VITA_DEI_TASTI });
    while (this._tasti.size > TASTI_TENUTI_AL_PIU)
      this._tasti.delete(this._tasti.keys().next().value);
  }

  /* ─── Quello che chiede il telefono ────────────────────────────────── */

  riconosce(tipo) {
    return typeof tipo === "string" && tipo.startsWith("ponte/notifiche/");
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
          const mandate = await this.consegna(
            regola ? this._provaDi(regola) : this._provaQualunque(),
            { soloA: telefono },
          );
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
    if (!utente || (this.utenti && !(await this.utenti.eVivo(utente).catch(() => false))))
      return no("unauthorized", "l'utente di questo telefono non c'e' piu'");
    const { dominio, servizio, entita } = azione.servizio;
    if (!SERVIZI_DEI_TASTI.has(`${dominio}.${servizio}`))
      return no("unauthorized", "questo tasto no");
    await this.casa.chiedi({
      type: "call_service",
      domain: dominio,
      service: servizio,
      target: { entity_id: entita },
    });
    this.registro.info(`dal tasto di una notifica: ${dominio}.${servizio}`);
    return si({ fatto: true });
  }
}
