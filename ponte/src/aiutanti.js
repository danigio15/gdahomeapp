/* Gli aiutanti di Home Assistant: le variabili e i sensori fatti in casa.
 *
 * «Implementiamo ultima cosa che sono gli aiutanti», tutti quelli di Home
 * Assistant. Sono di due specie, e Home Assistant li tiene in due modi:
 *
 *  - **i semplici** — interruttore, numero, elenco, testo, data e ora,
 *    pulsante, timer, contatore, programma — stanno nelle sue collezioni, e si
 *    leggono, si creano, si cambiano e si tolgono coi comandi della
 *    collezione (`input_boolean/list`, `…/create`, `…/update`, `…/delete`).
 *    Qui si scrivono **solo i campi di quel tipo**, controllati uno per uno:
 *    quello che non e' nell'elenco non arriva a Home Assistant;
 *  - **i calcolati** — gruppo, soglia, template, contatore di consumi,
 *    min/max, statistiche, derivata, integrale, termostato… — sono voci di
 *    configurazione come le integrazioni, e nascono e si cambiano con le
 *    procedure guidate di Home Assistant (`integrazioni.js`, `ponte/flussi/*`).
 *    Qui se ne da' l'elenco, coi tipi che questa casa sa fare.
 *
 * I valori di adesso e i comandi (accendere un interruttore, far partire un
 * timer) non passano di qui: sono stati e servizi di Home Assistant, che l'app
 * ha gia'.
 *
 * Le regole di chi puo' sono quelle delle integrazioni: **l'app, chi
 * amministra Home Assistant, GdAHome Premium**. Nel ponte non si vede niente,
 * e niente esce di casa.
 */

const no = (id, code, message) => ({
  id,
  type: "result",
  success: false,
  error: { code, message },
});
const si = (id, result) => ({ id, type: "result", success: true, result });
const pulito = (v) => String(v ?? "").trim();

export const COMANDI_DEGLI_AIUTANTI = Object.freeze([
  "ponte/aiutanti/elenco",
  "ponte/aiutanti/crea",
  "ponte/aiutanti/modifica",
  "ponte/aiutanti/elimina",
]);

const testo =
  (max = 255) =>
  (v) => {
    const t = pulito(v);
    return t.length <= max ? t : undefined;
  };
const numero = (v) =>
  Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : undefined;
const intero = (v) =>
  Number.isInteger(Number(v)) && v !== "" && v !== null ? Number(v) : undefined;
const vero = (v) => (typeof v === "boolean" ? v : undefined);
const fra =
  (...ammessi) =>
  (v) =>
    ammessi.includes(v) ? v : undefined;
const icona = (v) =>
  /^mdi:[a-z0-9-]{1,64}$/.test(pulito(v)) ? pulito(v) : v === "" ? "" : undefined;
const durata = (v) => (/^\d{1,3}:\d{2}:\d{2}$/.test(pulito(v)) ? pulito(v) : undefined);
const ORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const fasce = (v) => {
  if (!Array.isArray(v) || v.length > 12) return undefined;
  const buone = v
    .map((f) => ({ from: pulito(f?.from), to: pulito(f?.to) }))
    .filter((f) => ORA.test(f.from) && (ORA.test(f.to) || f.to === "24:00:00" || f.to === "24:00"));
  return buone.length === v.length ? buone : undefined;
};
const opzioni = (v) =>
  Array.isArray(v) &&
  v.length >= 1 &&
  v.length <= 64 &&
  v.every((o) => pulito(o) && pulito(o).length <= 255)
    ? v.map(pulito)
    : undefined;

/* I campi che ogni tipo semplice accetta, e come si controllano. Il nome c'e'
 * sempre; il resto e' di quel tipo e basta. */
const CAMPI = Object.freeze({
  input_boolean: { initial: vero },
  input_button: {},
  input_number: {
    min: numero,
    max: numero,
    step: numero,
    initial: numero,
    mode: fra("slider", "box"),
    unit_of_measurement: testo(32),
  },
  input_select: { options: opzioni, initial: testo() },
  input_text: {
    min: intero,
    max: intero,
    initial: testo(),
    mode: fra("text", "password"),
    pattern: testo(255),
  },
  input_datetime: { has_date: vero, has_time: vero, initial: testo(32) },
  timer: { duration: durata, restore: vero },
  counter: { initial: intero, step: intero, minimum: intero, maximum: intero, restore: vero },
  schedule: {
    monday: fasce,
    tuesday: fasce,
    wednesday: fasce,
    thursday: fasce,
    friday: fasce,
    saturday: fasce,
    sunday: fasce,
  },
});

export const TIPI_SEMPLICI = Object.freeze(Object.keys(CAMPI));

/** I campi di un aiutante semplice, ripuliti. `null` se uno e' storto: meglio
 * un no che un aiutante scritto a meta'. */
export function campiPuliti(tipo, dati, { nuovo = false } = {}) {
  const regole = CAMPI[tipo];
  if (!regole || !dati || typeof dati !== "object") return null;
  const fuori = {};
  const nome = pulito(dati.name);
  if (nome) {
    if (nome.length > 100) return null;
    fuori.name = nome;
  } else if (nuovo) return null;
  if (dati.icon !== undefined) {
    const i = icona(dati.icon);
    if (i === undefined) return null;
    fuori.icon = i || null;
  }
  for (const [campo, controlla] of Object.entries(regole)) {
    if (dati[campo] === undefined || dati[campo] === null) continue;
    const v = controlla(dati[campo]);
    if (v === undefined) return null;
    fuori[campo] = v;
  }
  if (tipo === "input_number") {
    if (nuovo && (fuori.min === undefined || fuori.max === undefined)) return null;
    if (fuori.min !== undefined && fuori.max !== undefined && fuori.min >= fuori.max) return null;
  }
  if (tipo === "input_select" && nuovo && !fuori.options) return null;
  return fuori;
}

const ID_BUONO = /^[a-z0-9_]{1,128}$/;
const VOCE_BUONA = /^[A-Za-z0-9_-]{6,64}$/;

export class Aiutanti {
  constructor({ casa = null, licenze = null, integrazioni = null, registro = null } = {}) {
    this.casa = casa;
    this.licenze = licenze;
    this.integrazioni = integrazioni;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
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
    return COMANDI_DEGLI_AIUTANTI.includes(tipo);
  }

  async elenco({ lingua = "it" } = {}) {
    const semplici = [];
    await Promise.all(
      TIPI_SEMPLICI.map(async (tipo) => {
        try {
          const elenco = await this.casa.chiedi({ type: `${tipo}/list` });
          for (const a of Array.isArray(elenco) ? elenco : []) {
            if (!ID_BUONO.test(pulito(a?.id))) continue;
            semplici.push({
              tipo,
              id: a.id,
              entity_id: `${tipo}.${a.id}`,
              nome: pulito(a.name),
              config: a,
            });
          }
        } catch (_errore) {
          /* Un tipo che questa casa non ha caricato: nessuno di quel tipo. */
        }
      }),
    );
    /* Il registro sa l'entita' vera, che puo' essere stata rinominata. */
    const registro = await this.casa
      .chiedi({ type: "config/entity_registry/list" })
      .catch(() => []);
    const perUnico = new Map();
    for (const e of Array.isArray(registro) ? registro : [])
      if (TIPI_SEMPLICI.includes(e?.platform)) perUnico.set(`${e.platform}:${e.unique_id}`, e);
    for (const a of semplici) {
      const e = perUnico.get(`${a.tipo}:${a.id}`);
      if (e?.entity_id) a.entity_id = e.entity_id;
      a.stanza = pulito(e?.area_id);
    }
    /* I calcolati: le voci con tipo «helper», e i tipi che si possono fare. */
    const [voci, descrizioni, nomi] = await Promise.all([
      this.casa.chiedi({ type: "config_entries/get", type_filter: ["helper"] }).catch(() => []),
      this.casa.chiedi({ type: "integration/descriptions" }).catch(() => ({})),
      this.integrazioni?._nomi?.(lingua) ?? {},
    ]);
    const entitaDellaVoce = new Map();
    for (const e of Array.isArray(registro) ? registro : [])
      if (e?.config_entry_id) {
        const elenco = entitaDellaVoce.get(e.config_entry_id) || [];
        elenco.push(e.entity_id);
        entitaDellaVoce.set(e.config_entry_id, elenco);
      }
    const calcolati = (Array.isArray(voci) ? voci : []).map((v) => ({
      voce: pulito(v.entry_id),
      dominio: pulito(v.domain),
      tipoNome: pulito(nomi[v.domain]) || pulito(v.domain),
      nome: pulito(v.title),
      entita: entitaDellaVoce.get(v.entry_id) || [],
      opzioni: v.supports_options === true,
    }));
    const tipiCalcolati = [];
    for (const parte of [descrizioni?.core, descrizioni?.custom])
      for (const [dominio, cosa] of Object.entries(parte?.helper || {}))
        if (cosa?.config_flow !== false && /^[a-z0-9_]+$/.test(dominio))
          tipiCalcolati.push({
            dominio,
            nome: pulito(nomi[dominio]) || pulito(cosa?.name) || dominio,
          });
    tipiCalcolati.sort((a, b) => a.nome.localeCompare(b.nome));
    semplici.sort((a, b) => a.nome.localeCompare(b.nome));
    calcolati.sort((a, b) => a.nome.localeCompare(b.nome));
    return { semplici, calcolati, tipiCalcolati };
  }

  async rispondi(detto, { utente = "", amministra = false, dalTelefono = false } = {}) {
    const id = detto?.id ?? null;
    const tipo = detto?.type;
    if (!this.riconosce(tipo)) return no(id, "unknown_command", `non conosco ${tipo}`);
    if (!pulito(utente)) return no(id, "unauthorized", "gli aiutanti li vede chi e' entrato");
    if (dalTelefono !== true)
      return no(id, "unauthorized", "gli aiutanti si gestiscono dall'app GdAHome");
    if (amministra !== true)
      return no(id, "unauthorized", "gli aiutanti li gestisce chi amministra Home Assistant");
    if (!this.sbloccato) return no(id, "premium-richiesto", "gli aiutanti sono di GdAHome Premium");
    try {
      if (tipo === "ponte/aiutanti/elenco") {
        const lingua = /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(pulito(detto.lingua))
          ? pulito(detto.lingua)
          : "it";
        return si(id, await this.elenco({ lingua }));
      }
      /* Un calcolato si toglie come una voce: con la conferma. */
      if (tipo === "ponte/aiutanti/elimina" && detto.voce !== undefined) {
        const voce = pulito(detto.voce);
        if (!VOCE_BUONA.test(voce)) return no(id, "invalid_format", "quale aiutante?");
        if (detto.conferma !== true) return no(id, "invalid_format", "serve la conferma");
        const r = await this.casa.api("DELETE", `config/config_entries/entry/${voce}`);
        return si(id, { riavvio: r?.require_restart === true });
      }
      const specie = pulito(detto.tipo);
      if (!TIPI_SEMPLICI.includes(specie)) return no(id, "invalid_format", "che tipo di aiutante?");
      if (tipo === "ponte/aiutanti/crea") {
        const campi = campiPuliti(specie, detto.campi, { nuovo: true });
        if (!campi) return no(id, "invalid_format", "controlla i campi");
        return si(id, await this.casa.chiedi({ type: `${specie}/create`, ...campi }));
      }
      const quale = pulito(detto.aiutante);
      if (!ID_BUONO.test(quale)) return no(id, "invalid_format", "quale aiutante?");
      if (tipo === "ponte/aiutanti/modifica") {
        const campi = campiPuliti(specie, detto.campi);
        if (!campi) return no(id, "invalid_format", "controlla i campi");
        return si(
          id,
          await this.casa.chiedi({ type: `${specie}/update`, [`${specie}_id`]: quale, ...campi }),
        );
      }
      if (detto.conferma !== true) return no(id, "invalid_format", "serve la conferma");
      await this.casa.chiedi({ type: `${specie}/delete`, [`${specie}_id`]: quale });
      return si(id, { fatto: true });
    } catch (errore) {
      this.registro.errore(`aiutanti: ${errore?.code || ""} ${errore?.message || errore}`);
      const perche = String(errore?.message || "");
      return no(id, "ponte_aiutanti", perche && perche.length < 200 ? perche : "non ha funzionato");
    }
  }
}
