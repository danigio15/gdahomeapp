/* Le integrazioni di Home Assistant, e le procedure guidate che le aggiungono.
 *
 * «Pensa a come poter gestire anche le integrazioni: o aggiungere
 * integrazioni, oppure vedere quelle già in essere installate.» E «devi dare
 * la possibilità di poter ricaricare anche le integrazioni».
 *
 * Le integrazioni sono quelle **vere di Home Assistant**: le tiene lui, e qui
 * si guardano e si comandano con le stesse porte che usa la sua pagina
 * Impostazioni → Dispositivi e servizi:
 *
 *  - `ponte/integrazioni/elenco`: le voci installate (`config_entries/get`),
 *    col nome dell'integrazione, lo stato (caricata, errore, disattivata),
 *    quanti dispositivi ed entita' porta ognuna (dai registri), e quelle
 *    trovate in rete e non ancora aggiunte (`config_entries/flow/progress`);
 *  - `…/ricarica`, `…/disattiva`, `…/elimina`: una voce, per il suo numero;
 *  - `…/catalogo`: quello che Home Assistant sa aggiungere
 *    (`integration/descriptions`), per la ricerca di «Aggiungi»;
 *  - `…/dispositivi`: i dispositivi di una voce, con la stanza;
 *  - `ponte/dispositivi/elenco`: i dispositivi veri della casa, stanza per
 *    stanza — «Quella sezione Dispositivi così com'è non ha senso»: era un
 *    elenco di entita' per tipo. Ognuno con l'integrazione da cui viene,
 *    marca e modello, le sue entita' (i valori e i comandi li ha gia' l'app,
 *    dagli stati della casa), la batteria se ce l'ha.
 *
 * Le procedure guidate (`ponte/flussi/*`) sono quelle di Home Assistant
 * (`config_entries/flow`): una domanda alla volta — un modulo, un menu, un
 * «apri nel browser» per chi chiede il login sul sito del produttore — fino
 * alla voce creata o a un no. Servono ad aggiungere un'integrazione, a
 * riparare quella che ha perso l'accesso, alle sue opzioni, e agli aiutanti
 * calcolati (gruppo, soglia, contatore di consumi…), che Home Assistant fa
 * nascere con le stesse procedure (`aiutanti.js`). Le parole di ogni domanda
 * arrivano tradotte da Home Assistant (`frontend/get_translations`).
 *
 * ── Chi puo' cosa ─────────────────────────────────────────────────────────
 *
 * Tutto vuole insieme: **l'app** (un telefono, o gdahome nel browser; non la
 * plancia servita dentro Home Assistant, che queste cose le ha gia' nella
 * pagina di Home Assistant), **chi amministra Home Assistant** — e' la sua
 * regola per quella pagina, e il segno dell'add-on non deve diventare la
 * porta di servizio di chi li' non entra — e **GdAHome Premium**. Il resto
 * riceve un no ben scritto. Nel ponte non si vede niente — nessuna pagina,
 * nessuna console — e niente esce di casa: si parla solo con Home Assistant.
 * Quello che si scrive in una domanda passa a Home Assistant e basta: non si
 * tiene, non va nei registri.
 */

const no = (id, code, message) => ({
  id,
  type: "result",
  success: false,
  error: { code, message },
});
const si = (id, result) => ({ id, type: "result", success: true, result });

const pulito = (v) => String(v ?? "").trim();

/* Il numero di una voce o di una procedura: quelli di Home Assistant sono
 * esadecimali da 32 o ULID da 26; niente barre, niente punti. */
const NUMERO_BUONO = /^[A-Za-z0-9_-]{6,64}$/;
const DOMINIO_BUONO = /^[a-z0-9_]{1,64}$/;
/* Quanto puo' pesare una risposta a una domanda: un modulo, non un file. */
const RISPOSTA_AL_PIU = 32 * 1024;

export const COMANDI_DELLE_INTEGRAZIONI = Object.freeze([
  "ponte/integrazioni/elenco",
  "ponte/integrazioni/ricarica",
  "ponte/integrazioni/disattiva",
  "ponte/integrazioni/elimina",
  "ponte/integrazioni/catalogo",
  "ponte/integrazioni/dispositivi",
  "ponte/integrazioni/logo",
  "ponte/dispositivi/elenco",
  "ponte/flussi/avvia",
  "ponte/flussi/passo",
  "ponte/flussi/leggi",
  "ponte/flussi/annulla",
]);

/* Le fonti di una procedura cominciata da Home Assistant da solo: un
 * dispositivo trovato in rete. Le altre (`user`, `reauth`, `import`) no. */
const TROVATE = new Set([
  "zeroconf",
  "ssdp",
  "dhcp",
  "homekit",
  "bluetooth",
  "usb",
  "mqtt",
  "discovery",
  "hassio",
  "integration_discovery",
]);

/* Che genere di procedura: un'integrazione nuova, le opzioni di una voce. */
const GENERI = Object.freeze({
  integrazione: "config/config_entries/flow",
  opzioni: "config/config_entries/options/flow",
});

const numeroBuono = (v) => NUMERO_BUONO.test(pulito(v));

/** Lo stato di una voce in tre parole: ok, errore, disattivata (piu' «in
 * avvio», che non e' ancora un errore). */
export function statoDellaVoce(voce) {
  if (voce?.disabled_by) return "disattivata";
  const stato = pulito(voce?.state);
  if (stato === "loaded") return "ok";
  if (stato === "setup_retry" || stato === "not_loaded") return "in-avvio";
  return "errore";
}

/** Una risposta ripulita per la plancia: solo campi e valori semplici, senza
 * niente di quello che Home Assistant porta per la sua pagina. */
export function voceDellElenco(voce, { nomi = {}, dispositivi = 0, entita = 0 } = {}) {
  const dominio = pulito(voce?.domain);
  return {
    id: pulito(voce?.entry_id),
    dominio,
    integrazione: pulito(nomi[dominio]) || dominio,
    titolo: pulito(voce?.title) || pulito(nomi[dominio]) || dominio,
    stato: statoDellaVoce(voce),
    perche: pulito(voce?.reason),
    fonte: pulito(voce?.source),
    opzioni: voce?.supports_options === true,
    ricaricabile: voce?.supports_unload !== false,
    disattivata: Boolean(voce?.disabled_by),
    dispositivi,
    entita,
  };
}

/** Quello che arriva da una procedura, ripulito per la plancia. Il modulo
 * resta quello di Home Assistant (`data_schema`, coi suoi selettori): lo
 * legge `core/flussi-di-home-assistant.js`. */
export function passoDelFlusso(r) {
  const tipo = pulito(r?.type);
  const base = {
    flow_id: pulito(r?.flow_id),
    handler: pulito(r?.handler),
    tipo,
    step_id: pulito(r?.step_id),
  };
  if (tipo === "form")
    return {
      ...base,
      schema: Array.isArray(r.data_schema) ? r.data_schema : [],
      errori: r.errors && typeof r.errors === "object" ? r.errors : {},
      segnaposti: r.description_placeholders || {},
      ultimo: r.last_step === true,
    };
  if (tipo === "menu")
    return {
      ...base,
      menu: Array.isArray(r.menu_options) ? r.menu_options : Object.keys(r.menu_options || {}),
      segnaposti: r.description_placeholders || {},
    };
  if (tipo === "external" || tipo === "external_step")
    return { ...base, tipo: "external", url: pulito(r.url) };
  if (tipo === "progress" || tipo === "show_progress")
    return { ...base, tipo: "progress", azione: pulito(r.progress_action) };
  if (tipo === "create_entry")
    return {
      ...base,
      voce: pulito(r.result?.entry_id || r.result),
      titolo: pulito(r.title),
    };
  if (tipo === "abort")
    return { ...base, perche: pulito(r.reason), segnaposti: r.description_placeholders || {} };
  return base;
}

export class Integrazioni {
  constructor({ casa = null, licenze = null, registro = null } = {}) {
    this.casa = casa;
    this.licenze = licenze;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    /* Le procedure cominciate da qui: numero → genere. Una risposta a una
     * procedura che non e' passata di qui (o fra quelle trovate in rete, o
     * fra le riparazioni) non la si inoltra. */
    this._flussi = new Map();
  }

  get sbloccato() {
    try {
      if (!this.licenze?.attive) return true;
      return this.licenze.premium === true;
    } catch (_errore) {
      return false;
    }
  }

  riconosce(tipo) {
    return COMANDI_DELLE_INTEGRAZIONI.includes(tipo);
  }

  /* I nomi delle integrazioni, nella lingua di chi guarda. */
  async _nomi(lingua = "it") {
    const nomi = {};
    try {
      const d = await this.casa.chiedi({ type: "integration/descriptions" });
      for (const parte of [d?.core, d?.custom])
        for (const gruppo of [parte?.integration, parte?.helper])
          for (const [dominio, cosa] of Object.entries(gruppo || {}))
            if (cosa?.name) nomi[dominio] = cosa.name;
    } catch (_errore) {
      /* Senza descrizioni restano i domini. */
    }
    try {
      const t = await this.casa.chiedi({
        type: "frontend/get_translations",
        language: lingua,
        category: "title",
      });
      for (const [chiave, testo] of Object.entries(t?.resources || {})) {
        const m = /^component\.([a-z0-9_]+)\.title$/.exec(chiave);
        if (m && testo) nomi[m[1]] = testo;
      }
    } catch (_errore) {}
    return nomi;
  }

  async elenco({ lingua = "it" } = {}) {
    const [voci, dispositivi, entita, progressi, nomi] = await Promise.all([
      this.casa.chiedi({ type: "config_entries/get" }),
      this.casa.chiedi({ type: "config/device_registry/list" }).catch(() => []),
      this.casa.chiedi({ type: "config/entity_registry/list" }).catch(() => []),
      this.casa.chiedi({ type: "config_entries/flow/progress" }).catch(() => []),
      this._nomi(lingua),
    ]);
    const quantiD = new Map();
    for (const d of Array.isArray(dispositivi) ? dispositivi : [])
      for (const voce of d?.config_entries || []) quantiD.set(voce, (quantiD.get(voce) || 0) + 1);
    const quantiE = new Map();
    for (const e of Array.isArray(entita) ? entita : [])
      if (e?.config_entry_id)
        quantiE.set(e.config_entry_id, (quantiE.get(e.config_entry_id) || 0) + 1);
    const elenco = (Array.isArray(voci) ? voci : [])
      /* Gli aiutanti calcolati sono voci anche loro: stanno negli Aiutanti. */
      .filter((v) => pulito(v?.domain) && v?.source !== "system")
      .map((v) =>
        voceDellElenco(v, {
          nomi,
          dispositivi: quantiD.get(v.entry_id) || 0,
          entita: quantiE.get(v.entry_id) || 0,
        }),
      );
    const trovate = [];
    const riparazioni = [];
    for (const f of Array.isArray(progressi) ? progressi : []) {
      const fonte = pulito(f?.context?.source);
      const voce = {
        flow_id: pulito(f?.flow_id),
        dominio: pulito(f?.handler),
        integrazione: pulito(nomi[f?.handler]) || pulito(f?.handler),
        titolo: pulito(f?.context?.title_placeholders?.name) || pulito(nomi[f?.handler]),
      };
      if (!numeroBuono(voce.flow_id)) continue;
      if (TROVATE.has(fonte)) trovate.push(voce);
      else if (fonte === "reauth" || fonte === "reconfigure")
        riparazioni.push({ ...voce, voce: pulito(f?.context?.entry_id) });
    }
    for (const f of [...trovate, ...riparazioni]) this._flussi.set(f.flow_id, "integrazione");
    return { voci: elenco, trovate, riparazioni };
  }

  async catalogo({ lingua = "it" } = {}) {
    const d = await this.casa.chiedi({ type: "integration/descriptions" });
    const installate = new Set(
      ((await this.casa.chiedi({ type: "config_entries/get" }).catch(() => [])) || []).map(
        (v) => v?.domain,
      ),
    );
    const nomi = await this._nomi(lingua);
    const tutte = [];
    for (const parte of [d?.core, d?.custom]) {
      for (const [dominio, cosa] of Object.entries(parte?.integration || {})) {
        if (!DOMINIO_BUONO.test(dominio) || cosa?.config_flow !== true) continue;
        tutte.push({
          dominio,
          nome: pulito(nomi[dominio]) || pulito(cosa?.name) || dominio,
          tipo: pulito(cosa?.integration_type) || "hub",
          cloud: /cloud/.test(pulito(cosa?.iot_class)),
          installata: installate.has(dominio),
          personalizzata: parte === d?.custom,
        });
      }
    }
    tutte.sort((a, b) => a.nome.localeCompare(b.nome));
    return { integrazioni: tutte };
  }

  async dispositivi({ voce }) {
    const [dispositivi, aree] = await Promise.all([
      this.casa.chiedi({ type: "config/device_registry/list" }),
      this.casa.chiedi({ type: "config/area_registry/list" }).catch(() => []),
    ]);
    const nomeArea = new Map((aree || []).map((a) => [a.area_id, a.name]));
    return {
      dispositivi: (dispositivi || [])
        .filter((d) => (d?.config_entries || []).includes(voce))
        .map((d) => ({
          id: pulito(d.id),
          nome: pulito(d.name_by_user) || pulito(d.name) || pulito(d.model),
          modello: [pulito(d.manufacturer), pulito(d.model)].filter(Boolean).join(" "),
          stanza: pulito(nomeArea.get(d.area_id)),
          versione: pulito(d.sw_version),
          disattivato: Boolean(d.disabled_by),
        })),
    };
  }

  async dispositiviDellaCasa({ lingua = "it" } = {}) {
    const [dispositivi, entita, aree, voci, nomi] = await Promise.all([
      this.casa.chiedi({ type: "config/device_registry/list" }),
      this.casa.chiedi({ type: "config/entity_registry/list" }).catch(() => []),
      this.casa.chiedi({ type: "config/area_registry/list" }).catch(() => []),
      this.casa.chiedi({ type: "config_entries/get" }).catch(() => []),
      this._nomi(lingua),
    ]);
    const dominioDellaVoce = new Map((voci || []).map((v) => [v.entry_id, v.domain]));
    const perDispositivo = new Map();
    for (const e of Array.isArray(entita) ? entita : []) {
      if (!e?.device_id || e.disabled_by || e.hidden_by) continue;
      const elenco = perDispositivo.get(e.device_id) || [];
      elenco.push({
        id: pulito(e.entity_id),
        nome: pulito(e.name) || pulito(e.original_name),
        /* La batteria la si riconosce dalla classe, come fa Home Assistant. */
        batteria: e.original_device_class === "battery" || e.device_class === "battery",
        diagnostica: e.entity_category === "diagnostic" || e.entity_category === "config",
      });
      perDispositivo.set(e.device_id, elenco);
    }
    const stanze = (aree || []).map((a) => ({ id: pulito(a.area_id), nome: pulito(a.name) }));
    const elenco = [];
    for (const d of Array.isArray(dispositivi) ? dispositivi : []) {
      if (d?.disabled_by || d?.entry_type === "service") continue;
      const sue = perDispositivo.get(d.id) || [];
      if (!sue.length) continue;
      const dominio = dominioDellaVoce.get(d.primary_config_entry || d.config_entries?.[0]) || "";
      elenco.push({
        id: pulito(d.id),
        nome: pulito(d.name_by_user) || pulito(d.name) || pulito(d.model),
        stanza: pulito(d.area_id),
        marca: pulito(d.manufacturer),
        modello: pulito(d.model),
        versione: pulito(d.sw_version),
        integrazione: pulito(nomi[dominio]) || dominio,
        dominio,
        voce: pulito(d.primary_config_entry || d.config_entries?.[0]),
        entita: sue,
      });
    }
    elenco.sort((a, b) => a.nome.localeCompare(b.nome));
    return { stanze, dispositivi: elenco };
  }

  async ricarica({ voce }) {
    const r = await this.casa.api("POST", `config/config_entries/entry/${voce}/reload`);
    return { riavvio: r?.require_restart === true };
  }

  async disattiva({ voce, disattiva }) {
    const r = await this.casa.chiedi({
      type: "config_entries/disable",
      entry_id: voce,
      disabled_by: disattiva ? "user" : null,
    });
    return { riavvio: r?.require_restart === true };
  }

  async elimina({ voce }) {
    const r = await this.casa.api("DELETE", `config/config_entries/entry/${voce}`);
    return { riavvio: r?.require_restart === true };
  }

  /* Le parole di una procedura: titolo, descrizione, nomi dei campi, errori,
   * nella lingua di chi guarda. Si chiedono a Home Assistant per quel
   * dominio; senza, la plancia usa i nomi dei campi. */
  async _parole(dominio, genere, lingua) {
    if (!DOMINIO_BUONO.test(dominio)) return {};
    try {
      const t = await this.casa.chiedi({
        type: "frontend/get_translations",
        language: lingua,
        category: genere === "opzioni" ? "options" : "config",
        integration: [dominio],
      });
      const radice = `component.${dominio}.${genere === "opzioni" ? "options" : "config"}.`;
      const parole = {};
      for (const [chiave, testo] of Object.entries(t?.resources || {}))
        if (chiave.startsWith(radice)) parole[chiave.slice(radice.length)] = testo;
      /* E i selettori condivisi (le scelte di un elenco). */
      const sel = `component.${dominio}.selector.`;
      for (const [chiave, testo] of Object.entries(t?.resources || {}))
        if (chiave.startsWith(sel)) parole[`selector.${chiave.slice(sel.length)}`] = testo;
      return parole;
    } catch (_errore) {
      return {};
    }
  }

  async _conLeParole(passo, genere, lingua, dominio) {
    const p = passoDelFlusso(passo);
    if (p.flow_id && !["create_entry", "abort"].includes(p.tipo))
      this._flussi.set(p.flow_id, genere);
    else this._flussi.delete(p.flow_id);
    return { ...p, genere, parole: await this._parole(dominio || p.handler, genere, lingua) };
  }

  async avvia({ handler, genere = "integrazione", lingua = "it", avanzate = false }) {
    const percorso = GENERI[genere];
    if (!percorso) return { errore: "invalid_format", perche: "che procedura?" };
    const r = await this.casa.api("POST", percorso, {
      handler,
      ...(genere === "integrazione" ? { show_advanced_options: avanzate === true } : {}),
    });
    /* Per le opzioni il «handler» e' il numero della voce: le parole stanno
     * sotto il dominio di quella voce. */
    let dominio = handler;
    if (genere === "opzioni") {
      const voci = await this.casa.chiedi({ type: "config_entries/get" }).catch(() => []);
      dominio = (voci || []).find((v) => v?.entry_id === handler)?.domain || "";
    }
    return this._conLeParole(r, genere, lingua, dominio);
  }

  async passo({ flow_id, dati, lingua = "it" }) {
    const genere = this._flussi.get(flow_id);
    const r = await this.casa.api("POST", `${GENERI[genere]}/${flow_id}`, dati || {});
    return this._conLeParole(r, genere, lingua);
  }

  async leggi({ flow_id, lingua = "it" }) {
    const genere = this._flussi.get(flow_id);
    const r = await this.casa.api("GET", `${GENERI[genere]}/${flow_id}`);
    return this._conLeParole(r, genere, lingua);
  }

  async annulla({ flow_id }) {
    const genere = this._flussi.get(flow_id);
    this._flussi.delete(flow_id);
    await this.casa.api("DELETE", `${GENERI[genere]}/${flow_id}`).catch(() => null);
    return { fatto: true };
  }

  /** Il no di chi non puo': `null` se puo'. Lo usa anche il logo, che lo
   * scarica `commissioni.js` dai marchi di Home Assistant. */
  vietato(detto, { utente = "", amministra = false, dalTelefono = false } = {}) {
    const id = detto?.id ?? null;
    const tipo = detto?.type;
    if (!this.riconosce(tipo)) return no(id, "unknown_command", `non conosco ${tipo}`);
    if (!pulito(utente)) return no(id, "unauthorized", "le integrazioni le vede chi e' entrato");
    if (dalTelefono !== true)
      return no(id, "unauthorized", "le integrazioni si gestiscono dall'app GdAHome");
    if (amministra !== true)
      return no(id, "unauthorized", "le integrazioni le gestisce chi amministra Home Assistant");
    if (!this.sbloccato)
      return no(id, "premium-richiesto", "le integrazioni sono di GdAHome Premium");
    return null;
  }

  async rispondi(detto, chi = {}) {
    const id = detto?.id ?? null;
    const tipo = detto?.type;
    const vietato = this.vietato(detto, chi);
    if (vietato) return vietato;
    const lingua = /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(pulito(detto.lingua))
      ? pulito(detto.lingua)
      : "it";
    try {
      if (tipo === "ponte/integrazioni/elenco") return si(id, await this.elenco({ lingua }));
      if (tipo === "ponte/integrazioni/catalogo") return si(id, await this.catalogo({ lingua }));
      if (tipo === "ponte/dispositivi/elenco")
        return si(id, await this.dispositiviDellaCasa({ lingua }));
      if (tipo === "ponte/flussi/avvia") {
        const genere = detto.genere === "opzioni" ? "opzioni" : "integrazione";
        const handler = pulito(detto.handler);
        if (genere === "integrazione" ? !DOMINIO_BUONO.test(handler) : !numeroBuono(handler))
          return no(id, "invalid_format", "quale integrazione?");
        const fatto = await this.avvia({ handler, genere, lingua, avanzate: detto.avanzate });
        return si(id, fatto);
      }
      if (tipo.startsWith("ponte/flussi/")) {
        const flow = pulito(detto.flow_id);
        if (!numeroBuono(flow) || !this._flussi.has(flow))
          return no(id, "not_found", "questa procedura non c'e' piu': ricomincia");
        if (tipo === "ponte/flussi/annulla") return si(id, await this.annulla({ flow_id: flow }));
        if (tipo === "ponte/flussi/leggi")
          return si(id, await this.leggi({ flow_id: flow, lingua }));
        const dati =
          detto.dati && typeof detto.dati === "object" && !Array.isArray(detto.dati)
            ? detto.dati
            : {};
        if (Buffer.byteLength(JSON.stringify(dati)) > RISPOSTA_AL_PIU)
          return no(id, "invalid_format", "risposta troppo lunga");
        return si(id, await this.passo({ flow_id: flow, dati, lingua }));
      }
      const voce = pulito(detto.voce);
      if (!numeroBuono(voce)) return no(id, "invalid_format", "quale integrazione?");
      if (tipo === "ponte/integrazioni/dispositivi")
        return si(id, await this.dispositivi({ voce }));
      if (tipo === "ponte/integrazioni/ricarica") return si(id, await this.ricarica({ voce }));
      if (tipo === "ponte/integrazioni/disattiva")
        return si(id, await this.disattiva({ voce, disattiva: detto.disattiva !== false }));
      if (tipo === "ponte/integrazioni/elimina") {
        /* Elimina chiede due volte nella pagina; qui vuole la parola. */
        if (detto.conferma !== true) return no(id, "invalid_format", "serve la conferma");
        return si(id, await this.elimina({ voce }));
      }
      return no(id, "unknown_command", `non conosco ${tipo}`);
    } catch (errore) {
      this.registro.errore(`integrazioni: ${errore?.code || ""} ${errore?.message || errore}`);
      const diHA = String(errore?.code || "").startsWith("http_");
      return no(id, "ponte_integrazioni", diHA ? String(errore.message) : "non ha funzionato");
    }
  }
}
