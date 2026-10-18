/* Le notifiche di Home Assistant, anche in GdAHome.
 *
 * Chi ha la casa in Home Assistant ha gia' le sue automazioni che avvisano
 * il telefono: «Lavatrice finita», «Porta del garage aperta da 10 minuti».
 * Le manda l'app di Home Assistant (la Companion), con `notify.mobile_app_…`.
 * Qui le si trova e, per chi le accende, le si manda anche nell'app di
 * GdAHome: stesso momento, stesso testo, con la busta di sempre.
 *
 *   le automazioni ─► (lette dal ponte) ─► quali mandano notifiche, a chi
 *   Home Assistant  ─► `automation_triggered` ─► quale automazione corre
 *                   ─► `call_service` notify.* ─► il testo gia' scritto
 *                   ─► ai telefoni che l'hanno accesa (`notifiche.js`)
 *
 * ─── Trovarle ─────────────────────────────────────────────────────────────
 *
 * Dalla configurazione di ogni automazione (`automation/config`, la stessa
 * che le notifiche leggono gia' per l'assistente) si cammina fra le azioni:
 * le sequenze, le scelte (`choose` e il suo `default`), `if/then/else`, le
 * parallele, le ripetizioni, e gli script chiamati (un livello solo). Ogni
 * `notify.*` che manda un messaggio vero e' una notifica; i comandi della
 * Companion che non dicono niente («clear_notification», «TTS»,
 * «request_location_update», «command_…») no. Si rilegge quando Home
 * Assistant ricarica le automazioni (`automation_reloaded`), e comunque
 * ogni dieci minuti al piu' quando qualcuno guarda l'elenco.
 *
 * ─── A chi va ─────────────────────────────────────────────────────────────
 *
 * `notify.mobile_app_<slug>` e' il telefono di qualcuno in Home Assistant:
 * `device_tracker.<slug>` sta fra i `device_trackers` di una `person.*`, e la
 * persona ha il suo `user_id`. I telefoni di GdAHome intestati a quell'utente
 * sono «suoi». `notify.notify` e i gruppi vanno a tutti. Nessun nome di
 * persona esce di qui: un telefono si chiama col nome che chi lo usa ha
 * scritto nell'app di GdAHome, come nel resto dell'app.
 *
 * ─── Cosa sceglie un telefono ─────────────────────────────────────────────
 *
 * Per ogni automazione trovata, su questo telefono: se riceverla (di serie
 * **spenta**, tutte), dove («questo telefono», un altro telefono della casa,
 * tutti) e se rispettare le ore di silenzio (di serie si'). E «Proponimi le
 * nuove»: un'automazione nuova che manda notifiche si dice, e arriva spenta.
 *
 * ─── Base e Premium ───────────────────────────────────────────────────────
 *
 * Lo stesso criterio di `notifiche.js` (`premium`). In Base: il testo, solo
 * su questo telefono, e solo delle automazioni che mandano a lui (o a
 * tutti). Con Premium: la foto della telecamera (chiusa per quel telefono,
 * come le altre — e solo se quella telecamera a lui si mostra), i tasti (un
 * tasto premuto torna a Home Assistant come `mobile_app_notification_action`,
 * cosi' le automazioni che lo aspettano funzionano come prima), mandarle ad
 * altri telefoni o a tutti, e «Proponimi le nuove».
 *
 * Niente esce di casa che non uscisse gia': le buste partono dalla strada
 * delle notifiche di sempre, e nient'altro parla con nessuno.
 */

import { riassuntoDellAutomazione } from "./riassunto-delle-automazioni.js";

const MINUTO = 60 * 1000;
const ORA = 60 * MINUTO;

/* L'elenco si rilegge al piu' ogni dieci minuti quando lo si guarda, e dopo
 * cinque secondi da un «ricarica» di Home Assistant (che ne fa a raffica). */
const ELENCO_DURA = 10 * MINUTO;
const DOPO_LA_RICARICA = 5_000;
/* Quante automazioni si leggono, al piu'. */
const AUTOMAZIONI_AL_PIU = 200;
/* Quanto si ricorda che un contesto e' di un'automazione: le automazioni con
 * un'attesa mandano la notifica dopo, e venti minuti bastano. */
const CONTESTI_DURANO = 20 * MINUTO;
const CONTESTI_AL_PIU = 2_000;
/* Al piu' venti notifiche all'ora per automazione: una scritta male che
 * avvisa a ogni lettura di un sensore non fa vibrare i telefoni ogni secondo. */
export const PER_AUTOMAZIONE_ALL_ORA = 20;
/* Ogni quanto si controlla di essere ancora in ascolto. */
const ASCOLTO = 60_000;

/* I «messaggi» della Companion che sono comandi, non notifiche. */
const COMANDI_DELLA_COMPANION =
  /^(clear_notification|request_location_update|remove_channel|delete_alert|clear_badge|update_complications|update_widgets|update_sensors|tts|command_[a-z_]+)$/i;

/* I servizi notify che non sono un telefono di nessuno. */
const SERVIZI_DA_SALTARE = /^(persistent_notification|gdahome.*)$/;

const DESTINI = Object.freeze(["questo", "tutti"]);
const DISPOSITIVO_BUONO = /^[A-Za-z0-9_-]{1,80}$/;
const CHIAVE_BUONA = /^[A-Za-z0-9_.:-]{1,120}$/;

const elenco = (valore) => (Array.isArray(valore) ? valore : valore ? [valore] : []);

/* Un testo di Home Assistant per l'anteprima: i template diventano «…». */
export function senzaTemplate(testo) {
  return String(testo ?? "")
    .replace(/\{%[\s\S]*?%\}/g, "")
    .replace(/\{\{[\s\S]*?\}\}/g, "…")
    .replace(/\{#[\s\S]*?#\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* La telecamera di una notifica: `image: /api/camera_proxy/camera.x` (anche
 * un indirizzo intero che ci finisce), o `entity_id: camera.x` (l'iPhone). */
export function telecameraDi(data) {
  const d = data && typeof data === "object" ? data : {};
  const immagine = String(d.image ?? d.attachment?.url ?? "");
  const daImmagine = /camera_proxy(?:_stream)?\/(camera\.[a-z0-9_]+)/.exec(immagine)?.[1];
  if (daImmagine) return daImmagine;
  const entita = String(d.entity_id ?? "");
  return /^camera\.[a-z0-9_]+$/.test(entita) ? entita : null;
}

/** Com'e' fatta una notifica: con la foto, coi tasti, urgente. */
export function segniDi({ titolo = "", messaggio = "", data = null } = {}) {
  const d = data && typeof data === "object" ? data : {};
  const push = d.push && typeof d.push === "object" ? d.push : {};
  const canale = String(d.channel ?? "");
  return {
    conFoto: Boolean(d.image || d.attachment?.url || telecameraDi(d)),
    conTasti: Array.isArray(d.actions) && d.actions.length > 0,
    /* Urgente solo quando lo e' davvero: la critica dell'iPhone o il canale
     * della sveglia su Android. `priority: high` e `ttl: 0` no — molte
     * automazioni li mettono solo per svegliare il telefono, e passerebbero
     * le ore di silenzio. */
    urgente:
      String(push["interruption-level"] ?? "").toLowerCase() === "critical" ||
      (push.sound && typeof push.sound === "object" && Number(push.sound.critical) === 1) ||
      /alarm/i.test(canale),
    testoCheCambia: /\{\{|\{%/.test(`${titolo} ${messaggio}`),
  };
}

/* Il servizio di un'azione: `action` (nuovo) o `service` (vecchio). */
const servizioDi = (azione) => {
  const s = azione?.action ?? azione?.service;
  return typeof s === "string" ? s.trim() : "";
};

/* Una notifica vera, da un'azione `notify.*`; `null` per un comando. */
function notificaDa(azione) {
  const servizio = servizioDi(azione);
  if (!servizio.startsWith("notify.")) return null;
  const nome = servizio.slice("notify.".length);
  if (!nome || SERVIZI_DA_SALTARE.test(nome)) return null;
  const dati = azione.data ?? azione.service_data ?? {};
  const messaggio = typeof dati.message === "string" ? dati.message : "";
  if (COMANDI_DELLA_COMPANION.test(messaggio.trim())) return null;
  const titolo = typeof dati.title === "string" ? dati.title : "";
  const bersagli =
    nome === "send_message"
      ? [
          ...elenco(azione.target?.entity_id),
          ...elenco(azione.entity_id),
          ...elenco(dati.entity_id),
        ]
          .map(String)
          .filter((x) => x.startsWith("notify."))
      : [];
  return {
    servizio,
    bersagli,
    titolo,
    messaggio,
    data: dati.data && typeof dati.data === "object" ? dati.data : null,
  };
}

/* Gli script chiamati da un'azione: `script.nome`, o `script.turn_on` con
 * le entita'. */
function scriptChiamatiDa(azione) {
  const servizio = servizioDi(azione);
  if (!servizio.startsWith("script.")) return [];
  if (servizio === "script.turn_on" || servizio === "script.toggle")
    return [
      ...elenco(azione.target?.entity_id),
      ...elenco(azione.entity_id),
      ...elenco(azione.data?.entity_id),
    ]
      .map(String)
      .filter((x) => /^script\.[a-z0-9_]+$/.test(x));
  if (servizio === "script.reload" || servizio === "script.turn_off") return [];
  return /^script\.[a-z0-9_]+$/.test(servizio) ? [servizio] : [];
}

/* Cammina fra le azioni, dentro tutto quello che ne contiene altre. */
function cammina(azioni, fai, profondita = 0) {
  if (profondita > 12) return;
  for (const a of elenco(azioni)) {
    if (!a || typeof a !== "object") continue;
    fai(a);
    const giu = (altre) => cammina(altre, fai, profondita + 1);
    if (a.sequence) giu(a.sequence);
    if (a.choose) {
      for (const caso of elenco(a.choose)) if (caso && typeof caso === "object") giu(caso.sequence);
      if (a.default) giu(a.default);
    }
    if (a.if) {
      giu(a.then);
      giu(a.else);
    }
    if (a.parallel)
      for (const ramo of elenco(a.parallel))
        if (ramo && typeof ramo === "object") giu(ramo.sequence ? ramo.sequence : [ramo]);
    if (a.repeat && typeof a.repeat === "object") giu(a.repeat.sequence);
  }
}

const azioniDellaConfig = (config) => config?.actions ?? config?.action ?? config?.sequence ?? [];

/** Gli script che un'automazione chiama: da leggere prima di cercare. */
export function scriptChiamati(config) {
  const fuori = new Set();
  cammina(azioniDellaConfig(config), (a) => {
    for (const s of scriptChiamatiDa(a)) fuori.add(s);
  });
  return [...fuori];
}

/**
 * Le notifiche che un'automazione manda: `[{servizio, bersagli, titolo,
 * messaggio, data}]`. `scriptDi(id)` da' la configurazione di uno script gia'
 * letto (un livello: dentro uno script non si seguono altri script).
 */
export function notificheDellAutomazione(config, { scriptDi = () => null } = {}) {
  const fuori = [];
  const prendi = (dentroUnoScript) => (a) => {
    const una = notificaDa(a);
    if (una) fuori.push(una);
    if (dentroUnoScript) return;
    for (const s of scriptChiamatiDa(a)) {
      const suo = scriptDi(s);
      if (suo) cammina(azioniDellaConfig(suo), prendi(true));
    }
  };
  cammina(azioniDellaConfig(config), prendi(false));
  return fuori;
}

/**
 * A chi va un servizio notify, in Home Assistant: `{tutti: true}` per
 * `notify.notify`, i gruppi e quello che non e' il telefono di nessuno;
 * `{utenti: [user_id], persone: [person.*]}` per `notify.mobile_app_<slug>`.
 * `persone`: gli stati delle `person.*` (`[[id, stato]]`).
 */
export function aChiVa(servizio, persone = []) {
  const nome = String(servizio || "").replace(/^notify\./, "");
  if (!nome.startsWith("mobile_app_")) return { tutti: true, utenti: [], persone: [] };
  const tracciatore = `device_tracker.${nome.slice("mobile_app_".length)}`;
  const sue = [];
  const utenti = [];
  for (const [id, stato] of persone) {
    const tracciatori = elenco(stato?.attributes?.device_trackers).map(String);
    if (!tracciatori.includes(tracciatore)) continue;
    sue.push(id);
    const utente = String(stato?.attributes?.user_id || "");
    if (utente && !utenti.includes(utente)) utenti.push(utente);
  }
  return { tutti: false, utenti, persone: sue };
}

/* Come si dice da dove viene, sotto il testo. */
const fonteDi = (alias) => ({
  it: `Automazione di Home Assistant · ${alias}`.slice(0, 120),
  en: `Home Assistant automation · ${alias}`.slice(0, 120),
});

const telefonoVuoto = () => ({ proponi: true, automazioni: {}, viste: null, nuove: [] });

export class NotificheDiHomeAssistant {
  constructor({
    /* `notifiche.js`: la busta, i telefoni, il Premium, l'archivio. */
    notifiche,
    registro = null,
    adesso = () => Date.now(),
    ogni = (quanto, cosa) => setInterval(cosa, quanto),
    smetti = (segno) => clearInterval(segno),
    dopo = (quanto, cosa) => setTimeout(cosa, quanto),
  } = {}) {
    this.notifiche = notifiche;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {}, debug() {} };
    this.adesso = adesso;
    this._ogni = ogni;
    this._smetti = smetti;
    this._dopo = dopo;
    /** Le automazioni trovate: chiave → {chiave, entity_id, alias, config, notifiche}. */
    this.trovate = new Map();
    this._lettoIl = 0;
    this._lettura = null;
    /** Contesto di Home Assistant → {chiave, il}. */
    this._contesti = new Map();
    /** Chiave → [ore] delle notifiche mandate nell'ultima ora. */
    this._conti = new Map();
    /** Contesto|telefono|testo gia' consegnati: due notify uguali, una notifica. */
    this._gia = new Map();
    this._disdici = [];
    this._ascolto = null;
    this._abbonando = false;
    this._ricarica = null;
  }

  get casa() {
    return this.notifiche?.casa ?? null;
  }

  get premium() {
    return this.notifiche?.premium === true;
  }

  /* Cosa sta nell'archivio delle notifiche: `ha: {telefoni, ultime}`. */
  get dati() {
    const archivio = this.notifiche.archivio.dati;
    if (!archivio.ha || typeof archivio.ha !== "object") archivio.ha = {};
    const ha = archivio.ha;
    if (!ha.telefoni || typeof ha.telefoni !== "object") ha.telefoni = {};
    if (!ha.ultime || typeof ha.ultime !== "object") ha.ultime = {};
    return ha;
  }

  _telefono(id) {
    const tutti = this.dati.telefoni;
    const voce = (tutti[id] ??= telefonoVuoto());
    if (!voce.automazioni || typeof voce.automazioni !== "object") voce.automazioni = {};
    if (typeof voce.proponi !== "boolean") voce.proponi = true;
    if (!Array.isArray(voce.nuove)) voce.nuove = [];
    return voce;
  }

  _salva() {
    this.notifiche._salva?.();
  }

  _stati() {
    return this.notifiche?.sentinella?.stati ?? new Map();
  }

  _persone() {
    return [...this._stati().entries()].filter(([id]) => String(id).startsWith("person."));
  }

  /* ─── Accendere e spegnere ─────────────────────────────────────────── */

  parti() {
    if (this._ascolto) return;
    void this._abbonati();
    this._ascolto = this._ogni(ASCOLTO, () => void this._abbonati());
    this._ascolto?.unref?.();
  }

  ferma() {
    if (this._ascolto) this._smetti(this._ascolto);
    this._ascolto = null;
    const disdici = this._disdici;
    this._disdici = [];
    for (const una of disdici) void una?.();
  }

  /* Tre ascolti: chi corre, cosa chiama, e quando le automazioni cambiano.
   * Se il filo cade cadono tutti, e il giro dopo li rifa'. */
  async _abbonati() {
    if (this._disdici.length || this._abbonando || !this.casa?.ascolta) return;
    this._abbonando = true;
    const caduto = () => {
      const tutti = this._disdici;
      this._disdici = [];
      for (const una of tutti) void una?.();
    };
    try {
      const ascolti = [
        ["automation_triggered", (e) => this.scattata(e)],
        ["call_service", (e) => void this.chiamata(e).catch((x) => this._male(x))],
        ["automation_reloaded", () => this._rileggiFraPoco()],
      ];
      for (const [tipo, fai] of ascolti)
        this._disdici.push(await this.casa.ascolta(tipo, fai, { onCaduto: caduto }));
      if (!this._lettoIl) void this.leggi().catch((x) => this._male(x));
    } catch (errore) {
      caduto();
      this.registro.debug?.(
        `le notifiche di Home Assistant non si ascoltano: ${errore?.message || errore}`,
      );
    } finally {
      this._abbonando = false;
    }
  }

  _male(errore) {
    this.registro.attenzione?.(`notifiche di Home Assistant: ${errore?.message || errore}`);
  }

  _rileggiFraPoco() {
    if (this._ricarica) return;
    this._ricarica = this._dopo(DOPO_LA_RICARICA, () => {
      this._ricarica = null;
      void this.leggi().catch((x) => this._male(x));
    });
    this._ricarica?.unref?.();
  }

  /* ─── Trovarle ─────────────────────────────────────────────────────── */

  /* La chiave di un'automazione: il suo `id` di Home Assistant, che resta
   * anche se la si rinomina; senza (una scritta a mano), l'entita'. */
  _chiaveDi(entity) {
    const id = String(this._stati().get(entity)?.attributes?.id ?? "").trim();
    return CHIAVE_BUONA.test(id) ? id : entity;
  }

  /** Rilegge tutte le automazioni e tiene quelle che mandano notifiche. */
  leggi() {
    if (this._lettura) return this._lettura;
    this._lettura = (async () => {
      const casa = this.casa;
      if (!casa?.chiedi) return this.trovate;
      const stati = this._stati();
      const automazioni = [...stati.keys()]
        .filter((id) => String(id).startsWith("automation."))
        .slice(0, AUTOMAZIONI_AL_PIU);
      const configurazioni = new Map();
      for (const entity of automazioni) {
        try {
          const risposta = await casa.chiedi({ type: "automation/config", entity_id: entity });
          configurazioni.set(entity, risposta?.config || risposta || null);
        } catch (_errore) {
          /* Un'automazione che non si legge non ferma le altre. */
        }
      }
      const script = new Map();
      for (const config of configurazioni.values())
        for (const s of scriptChiamati(config)) script.set(s, null);
      for (const s of script.keys()) {
        try {
          const risposta = await casa.chiedi({ type: "script/config", entity_id: s });
          script.set(s, risposta?.config || risposta || null);
        } catch (_errore) {
          /* Uno script che non si legge: le sue notifiche non si vedono. */
        }
      }
      /* Home Assistant che non risponde: si tiene quello che si sapeva. */
      if (automazioni.length && !configurazioni.size) return this.trovate;
      const trovate = new Map();
      for (const [entity, config] of configurazioni) {
        if (!config || typeof config !== "object") continue;
        const sue = notificheDellAutomazione(config, { scriptDi: (s) => script.get(s) });
        if (!sue.length) continue;
        const chiave = this._chiaveDi(entity);
        trovate.set(chiave, {
          chiave,
          entity_id: entity,
          alias: String(
            stati.get(entity)?.attributes?.friendly_name || config.alias || entity,
          ).slice(0, 100),
          config,
          notifiche: sue,
        });
      }
      this.trovate = trovate;
      this._lettoIl = this.adesso();
      await this._leNuove();
      return trovate;
    })().finally(() => {
      this._lettura = null;
    });
    return this._lettura;
  }

  async _forseLeggi() {
    if (this.adesso() - this._lettoIl < ELENCO_DURA && this._lettoIl) return;
    try {
      await this.leggi();
    } catch (errore) {
      this._male(errore);
    }
  }

  /* «Proponimi le nuove»: a chi ha gia' visto l'elenco una volta, le
   * automazioni nuove si segnano e si dicono. Arrivano spente: le accende
   * chi le vuole. Con Base si ricordano e basta. */
  async _leNuove() {
    const vivi = new Set(this.notifiche.dispositivi?.elenco?.().map((uno) => uno.id) ?? []);
    const chiavi = [...this.trovate.keys()];
    let cambiato = false;
    for (const [telefono, voce] of Object.entries(this.dati.telefoni)) {
      if (!vivi.has(telefono)) {
        delete this.dati.telefoni[telefono];
        cambiato = true;
        continue;
      }
      if (!Array.isArray(voce.viste)) continue;
      const nuove = chiavi.filter((k) => !voce.viste.includes(k));
      if (!nuove.length) continue;
      voce.viste = [...voce.viste, ...nuove].slice(-AUTOMAZIONI_AL_PIU * 2);
      cambiato = true;
      if (!this.premium || voce.proponi === false) continue;
      voce.nuove = [...new Set([...(voce.nuove || []), ...nuove])].slice(-50);
      for (const chiave of nuove) {
        const alias = this.trovate.get(chiave)?.alias || chiave;
        await this.notifiche.consegna(
          {
            tipo: "ha_notify",
            urgenza: "normale",
            chiave: `ha-nuova:${chiave}`,
            quando: this.adesso(),
            parole: {
              it: {
                titolo: "Una nuova automazione manda notifiche",
                testo: `«${alias}»: se la vuoi anche qui, accendila nelle Notifiche di GdAHome.`,
              },
              en: {
                titolo: "A new automation sends notifications",
                testo: `"${alias}": if you want it here too, turn it on in GdAHome Notifications.`,
              },
            },
            azioni: [],
          },
          { soloA: telefono },
        );
      }
    }
    if (cambiato) this._salva();
  }

  /* ─── Quando corrono ───────────────────────────────────────────────── */

  /** `automation_triggered`: questo contesto e' di quell'automazione. */
  scattata(evento) {
    const entity = String(evento?.data?.entity_id || "");
    const contesto = String(evento?.context?.id || "");
    if (!entity.startsWith("automation.") || !contesto) return;
    const ora = this.adesso();
    this._contesti.set(contesto, { chiave: this._chiaveDi(entity), entity, il: ora });
    if (this._contesti.size > CONTESTI_AL_PIU) {
      for (const [id, uno] of this._contesti)
        if (ora - uno.il > CONTESTI_DURANO || this._contesti.size > CONTESTI_AL_PIU)
          this._contesti.delete(id);
    }
  }

  _diChiE(contesto) {
    const ora = this.adesso();
    for (const id of [contesto?.id, contesto?.parent_id]) {
      const uno = id ? this._contesti.get(String(id)) : null;
      if (uno && ora - uno.il <= CONTESTI_DURANO) return uno;
    }
    return null;
  }

  _cePosto(chiave) {
    const ora = this.adesso();
    const volte = (this._conti.get(chiave) || []).filter((t) => ora - t < ORA);
    if (volte.length >= PER_AUTOMAZIONE_ALL_ORA) {
      this._conti.set(chiave, volte);
      return false;
    }
    volte.push(ora);
    this._conti.set(chiave, volte);
    return true;
  }

  /* I telefoni di GdAHome: quelli abbinati, con un utente. */
  _telefoni() {
    try {
      return (this.notifiche.dispositivi?.elenco?.() ?? []).filter((uno) => uno?.id && uno.utente);
    } catch (_errore) {
      return [];
    }
  }

  /* Se un servizio notify va al telefono di questo utente (o a tutti). */
  _vaA(servizi, utente) {
    const persone = this._persone();
    return servizi.some((s) => {
      const chi = aChiVa(s, persone);
      return chi.tutti || (utente && chi.utenti.includes(utente));
    });
  }

  /**
   * `call_service`: se e' una notifica di un'automazione che qualcuno ha
   * acceso, la si manda a chi l'ha scelta. Torna quanti telefoni l'hanno
   * avuta.
   */
  async chiamata(evento) {
    const d = evento?.data;
    if (!d || d.domain !== "notify") return 0;
    const servizio = `notify.${d.service}`;
    const dati = d.service_data && typeof d.service_data === "object" ? d.service_data : {};
    const una = notificaDa({ service: servizio, data: dati });
    if (!una) return 0;
    const sua = this._diChiE(evento?.context);
    if (!sua) return 0;
    const { chiave } = sua;
    const testo = String(dati.message ?? "")
      .trim()
      .slice(0, 600);
    const titolo = String(dati.title ?? "")
      .trim()
      .slice(0, 120);
    if (!testo && !titolo) return 0;
    /* L'ultimo testo vero, per «Cosa dice». */
    this.dati.ultime[chiave] = { titolo, testo: testo.slice(0, 300), il: this.adesso() };
    this._salva();
    const accese = Object.entries(this.dati.telefoni).filter(
      ([, voce]) => voce?.automazioni?.[chiave]?.acceso === true,
    );
    if (!accese.length) return 0;
    if (!this._cePosto(chiave)) {
      this.registro.debug?.(`notifiche di Home Assistant: «${chiave}» ne manda troppe`);
      return 0;
    }
    const premium = this.premium;
    const telefoni = this._telefoni();
    const vivi = new Map(telefoni.map((uno) => [uno.id, uno]));
    const servizi = una.bersagli.length ? una.bersagli : [servizio];
    /* Chi la riceve, e se passa le ore di silenzio. */
    const a = new Map();
    for (const [telefono, voce] of accese) {
      const io = vivi.get(telefono);
      if (!io) continue;
      const scelta = voce.automazioni[chiave];
      const oltre = scelta.silenzio === false;
      let destinatari;
      if (!premium) {
        /* In Base: solo a questo telefono, e solo se era per lui. */
        if (!this._vaA(servizi, io.utente)) continue;
        destinatari = [telefono];
      } else if (scelta.a === "tutti") destinatari = telefoni.map((uno) => uno.id);
      else if (scelta.a && scelta.a !== "questo")
        destinatari = vivi.has(scelta.a) ? [scelta.a] : [];
      else destinatari = [telefono];
      for (const chi of destinatari) a.set(chi, a.get(chi) === true || oltre);
    }
    if (!a.size) return 0;
    const trovata = this.trovate.get(chiave);
    const alias = trovata?.alias || this._stati().get(sua.entity)?.attributes?.friendly_name || "";
    const segni = segniDi({ titolo, messaggio: testo, data: una.data });
    const camera = premium ? telecameraDi(una.data) : null;
    const azioni = premium
      ? elenco(una.data?.actions)
          .filter(
            (x) =>
              x &&
              typeof x.action === "string" &&
              x.action.trim() &&
              !["URI", "REPLY"].includes(x.action.trim().toUpperCase()),
          )
          .slice(0, 3)
          .map((x, i) => ({
            id: `ha${i + 1}`,
            parole: {
              it: String(x.title || x.action).slice(0, 30),
              en: String(x.title || x.action).slice(0, 30),
            },
            haAzione: x.action.trim().slice(0, 200),
          }))
      : [];
    const titoloVero = titolo || alias || "Home Assistant";
    let quanti = 0;
    const ora = this.adesso();
    for (const [chi, oltreIlSilenzio] of a) {
      const gia = `${evento?.context?.id || ""}|${chi}|${titoloVero}|${testo}`;
      if (this._gia.has(gia)) continue;
      this._gia.set(gia, ora);
      quanti += await this.notifiche.consegna(
        {
          tipo: "ha_notify",
          urgenza: segni.urgente ? "urgente" : "normale",
          chiave: `ha:${chiave}`,
          quando: ora,
          parole: {
            it: { titolo: titoloVero, testo },
            en: { titolo: titoloVero, testo },
          },
          fonte: fonteDi(alias || chiave),
          oltreIlSilenzio,
          ...(camera ? { camera, conFoto: true, stileDellaVoce: "elaborata" } : {}),
          ...(!camera ? { stileDellaVoce: "semplice" } : {}),
          azioni,
        },
        { soloA: chi },
      );
    }
    for (const [k, il] of this._gia) if (ora - il > CONTESTI_DURANO) this._gia.delete(k);
    return quanti;
  }

  /* ─── Quello che chiede il telefono ────────────────────────────────── */

  riconosce(tipo) {
    return typeof tipo === "string" && tipo.startsWith("ponte/notifiche/ha/");
  }

  /* Le righe dell'elenco, come le vede questo telefono. */
  _righe(telefono, utente, amministra) {
    const voce = this._telefono(telefono);
    const persone = this._persone();
    const telefoni = this._telefoni();
    const stati = this._stati();
    const righe = [];
    for (const trovata of this.trovate.values()) {
      const servizi = [
        ...new Set(
          trovata.notifiche.flatMap((n) => (n.bersagli.length ? n.bersagli : [n.servizio])),
        ),
      ];
      const tutti = servizi.some((s) => aChiVa(s, persone).tutti);
      const utenti = new Set(servizi.flatMap((s) => aChiVa(s, persone).utenti));
      const suoi = telefoni.filter((uno) => utenti.has(uno.utente)).map((uno) => uno.id);
      const perMe = tutti || utenti.has(utente);
      const bersaglio = perMe
        ? tutti && !utenti.has(utente)
          ? "tutti"
          : "questo"
        : suoi.length
          ? "altro"
          : "nessuno";
      const scelta = voce.automazioni[trovata.chiave] || {};
      const prima = trovata.notifiche[0];
      const segni = trovata.notifiche
        .map((n) => segniDi({ titolo: n.titolo, messaggio: n.messaggio, data: n.data }))
        .reduce(
          (tutti, uno) => ({
            conFoto: tutti.conFoto || uno.conFoto,
            conTasti: tutti.conTasti || uno.conTasti,
            urgente: tutti.urgente || uno.urgente,
            testoCheCambia: tutti.testoCheCambia || uno.testoCheCambia,
          }),
          { conFoto: false, conTasti: false, urgente: false, testoCheCambia: false },
        );
      /* Il testo di una notifica che va al telefono di un altro non e'
       * affar suo: se ne dice solo che c'e'. Chi amministra la casa vede
       * tutto, come in Home Assistant. */
      const vede = perMe || amministra === true || scelta.acceso === true;
      const ultima = Date.parse(stati.get(trovata.entity_id)?.attributes?.last_triggered || "");
      let quando = null;
      try {
        const nomeDi = (id) => String(stati.get(id)?.attributes?.friendly_name || "");
        const classeDi = (id) => String(stati.get(id)?.attributes?.device_class || "");
        quando = riassuntoDellAutomazione(trovata.config, { nomeDi, classeDi });
      } catch (_errore) {
        quando = null;
      }
      const ultimo = this.dati.ultime[trovata.chiave];
      righe.push({
        chiave: trovata.chiave,
        alias: trovata.alias,
        quando: quando ? { it: quando.it.split(" · ")[0], en: quando.en.split(" · ")[0] } : null,
        ultimaVolta: Number.isFinite(ultima) ? ultima : null,
        bersaglio,
        /* I telefoni di GdAHome a cui va in Home Assistant. */
        telefoni: bersaglio === "altro" ? suoi : [],
        ...(vede
          ? {
              anteprima: {
                titolo: senzaTemplate(prima.titolo).slice(0, 120),
                testo: senzaTemplate(prima.messaggio).slice(0, 300),
              },
              ...(ultimo ? { ultimo } : {}),
            }
          : {}),
        ...segni,
        acceso: scelta.acceso === true,
        a:
          scelta.a === "tutti" ||
          (typeof scelta.a === "string" && telefoni.some((uno) => uno.id === scelta.a))
            ? scelta.a
            : "questo",
        silenzio: scelta.silenzio !== false,
        nuova: voce.nuove.includes(trovata.chiave),
      });
    }
    return righe.sort((x, y) => x.alias.localeCompare(y.alias));
  }

  async elenco(telefono, utente, amministra) {
    await this._forseLeggi();
    const voce = this._telefono(telefono);
    const prima = Array.isArray(voce.viste);
    const righe = this._righe(telefono, utente, amministra);
    /* La prima volta tutte quelle che ci sono sono «viste»: nuove saranno
     * quelle dopo. */
    if (!prima) {
      voce.viste = [...this.trovate.keys()];
      this._salva();
    }
    return {
      premium: this.premium,
      proponi: voce.proponi !== false,
      telefoni: this._telefoni().map((uno) => ({
        id: uno.id,
        io: uno.id === telefono,
        /* Di chi e': il nome che chi lo usa ha scritto nell'app («Di chi e'
         * questo telefono?»), o niente. E il modello; senza, il nome del
         * telefono nella casa. */
        nome: String(uno.proprietario || "").slice(0, 30),
        modello: String(uno.modello || uno.nome || "").slice(0, 60),
      })),
      automazioni: righe,
    };
  }

  /* Le scelte di un'automazione, ripulite. Torna l'errore o `null`. */
  _imposta(telefono, utente, chiave, detta, righe) {
    if (!CHIAVE_BUONA.test(String(chiave)) || !detta || typeof detta !== "object")
      return ["invalid_format", "quale automazione?"];
    const riga = righe.find((r) => r.chiave === chiave);
    if (!riga) return ["not_found", "questa automazione non manda notifiche"];
    const voce = this._telefono(telefono);
    const prima = voce.automazioni[chiave] || {};
    const nuova = { ...prima };
    if (typeof detta.acceso === "boolean") nuova.acceso = detta.acceso;
    if (typeof detta.silenzio === "boolean") nuova.silenzio = detta.silenzio;
    if (typeof detta.a === "string") {
      if (DESTINI.includes(detta.a)) nuova.a = detta.a;
      else if (DISPOSITIVO_BUONO.test(detta.a) && this._telefoni().some((u) => u.id === detta.a))
        nuova.a = detta.a;
      else return ["invalid_format", "a quale telefono?"];
    }
    if (!this.premium) {
      /* In Base: su questo telefono, e solo quelle che vanno a lui. */
      if (nuova.a && nuova.a !== "questo" && typeof detta.a === "string")
        return ["premium-richiesto", "mandarle ad altri telefoni e' di GdAHome Premium"];
      if (nuova.acceso === true && riga.bersaglio !== "questo" && riga.bersaglio !== "tutti")
        return [
          "premium-richiesto",
          "ricevere le notifiche di un altro telefono e' di GdAHome Premium",
        ];
    }
    voce.automazioni[chiave] = nuova;
    voce.nuove = voce.nuove.filter((k) => k !== chiave);
    return null;
  }

  async rispondi(detto, { telefono, utente, amministra = false, si, no }) {
    if (!utente) return no("unauthorized", "le notifiche di Home Assistant si vedono da un utente");
    switch (detto.type) {
      case "ponte/notifiche/ha/elenco":
        return si(await this.elenco(telefono, utente, amministra));
      case "ponte/notifiche/ha/imposta": {
        await this._forseLeggi();
        const righe = this._righe(telefono, utente, amministra);
        const voci = detto.voci && typeof detto.voci === "object" ? detto.voci : null;
        if (!voci || Array.isArray(voci) || !Object.keys(voci).length)
          return no("invalid_format", "cosa cambiare?");
        if (Object.keys(voci).length > AUTOMAZIONI_AL_PIU)
          return no("invalid_format", "troppe in una volta");
        const voce = this._telefono(telefono);
        const prima = structuredClone(voce.automazioni);
        const nuovePrima = [...voce.nuove];
        for (const [chiave, detta] of Object.entries(voci)) {
          const male = this._imposta(telefono, utente, chiave, detta, righe);
          if (male) {
            /* Tutte o nessuna. */
            voce.automazioni = prima;
            voce.nuove = nuovePrima;
            return no(...male);
          }
        }
        this._salva();
        return si(await this.elenco(telefono, utente, amministra));
      }
      case "ponte/notifiche/ha/proponi": {
        if (typeof detto.acceso !== "boolean") return no("invalid_format", "si' o no?");
        if (!this.premium)
          return no("premium-richiesto", "«Proponimi le nuove» e' di GdAHome Premium");
        this._telefono(telefono).proponi = detto.acceso;
        this._salva();
        return si(await this.elenco(telefono, utente, amministra));
      }
      default:
        return no("unknown_command", "questo ponte non conosce questa domanda");
    }
  }
}
