/* Le procedure guidate di Home Assistant, lette per la plancia.
 *
 * Una procedura (`config_entries/flow`) e' una domanda alla volta: un modulo
 * coi suoi campi, un menu, un «apri nel browser», un'attesa, e alla fine la
 * voce creata o un no. Il ponte la passa com'e' (`ponte/src/integrazioni.js`,
 * `passoDelFlusso`) con le parole di quell'integrazione nella lingua di chi
 * guarda (`parole`: le chiavi di Home Assistant senza il prefisso, come
 * `step.user.title` o `error.cannot_connect`).
 *
 * Qui niente pagina: solo le regole. Il modulo di Home Assistant
 * (`data_schema`, coi suoi selettori) diventa un elenco di campi semplici —
 * testo, numero, si/no, una scelta, piu' scelte, un'entita', una durata —
 * e le risposte tornano nella forma che Home Assistant si aspetta. Un
 * selettore che qui non ha un campo suo si scrive come testo: meglio una
 * casella che una domanda che non si puo' finire.
 */

const pulito = (v) => String(v ?? "").trim();

/* Il nome di un campo, quando l'integrazione non ne da' uno: «api_key» →
 * «Api key». */
export function nomeLeggibile(chiave) {
  const t = pulito(chiave).replaceAll("_", " ");
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

/* Le frasi di Home Assistant portano `{segnaposto}` e un po' di Markdown:
 * qui si riempiono i segnaposto e si toglie il Markdown, il testo resta
 * testo. */
export function testoDelPasso(testo, segnaposti = {}) {
  let t = pulito(testo);
  if (!t) return "";
  t = t.replace(/\{([a-zA-Z0-9_]+)\}/g, (tutto, nome) =>
    segnaposti && segnaposti[nome] !== undefined && segnaposti[nome] !== null
      ? String(segnaposti[nome])
      : tutto,
  );
  return t
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/<[^>]+>/g, "");
}

/* Le scelte di un elenco, nelle tre forme in cui arrivano: `[[v, l]]`,
 * `{v: l}`, o `[{value, label}]` / `["v"]` di un selettore. */
function scelteDi(opzioni, parole, chiaveTraduzione) {
  const voci = [];
  if (Array.isArray(opzioni)) {
    for (const o of opzioni) {
      if (Array.isArray(o)) voci.push({ valore: o[0], etichetta: pulito(o[1]) || pulito(o[0]) });
      else if (o && typeof o === "object")
        voci.push({ valore: o.value, etichetta: pulito(o.label) || pulito(o.value) });
      else voci.push({ valore: o, etichetta: pulito(o) });
    }
  } else if (opzioni && typeof opzioni === "object") {
    for (const [v, l] of Object.entries(opzioni))
      voci.push({ valore: v, etichetta: pulito(l) || v });
  }
  if (chiaveTraduzione)
    for (const v of voci) {
      const detto = parole[`selector.${chiaveTraduzione}.options.${v.valore}`];
      if (detto) v.etichetta = detto;
    }
  return voci;
}

/* Il genere di un campo, dal selettore o dal tipo di voluptuous. */
function genereDelCampo(voce) {
  const sel = voce?.selector && typeof voce.selector === "object" ? voce.selector : null;
  if (sel) {
    const [nome] = Object.keys(sel);
    const cfg = sel[nome] || {};
    if (nome === "text" || nome === "template")
      return {
        tipo:
          cfg.type === "password"
            ? "password"
            : cfg.multiline || nome === "template"
              ? "testo-lungo"
              : "testo",
        multiplo: cfg.multiple === true,
      };
    if (nome === "number")
      return {
        tipo: "numero",
        min: cfg.min,
        max: cfg.max,
        passo: cfg.step === "any" ? "any" : cfg.step,
        unita: pulito(cfg.unit_of_measurement),
      };
    if (nome === "boolean") return { tipo: "si-no" };
    if (nome === "select")
      return {
        tipo: cfg.multiple ? "scelte" : "scelta",
        opzioni: cfg.options,
        traduzione: pulito(cfg.translation_key),
        libera: cfg.custom_value === true,
      };
    if (nome === "entity") {
      const filtri = [].concat(cfg.filter || []);
      const domini = new Set([].concat(cfg.domain || []));
      for (const f of filtri) for (const d of [].concat(f?.domain || [])) domini.add(d);
      return {
        tipo: "entita",
        multiplo: cfg.multiple === true,
        domini: [...domini].filter(Boolean),
      };
    }
    if (nome === "time") return { tipo: "ora" };
    if (nome === "duration") return { tipo: "durata" };
    if (nome === "constant") return { tipo: "costante", valore: cfg.value, etichetta: cfg.label };
    if (nome === "icon") return { tipo: "testo" };
    return { tipo: "testo" };
  }
  const tipo = pulito(voce?.type);
  if (tipo === "boolean") return { tipo: "si-no" };
  if (tipo === "integer" || tipo === "float")
    return {
      tipo: "numero",
      min: voce.valueMin,
      max: voce.valueMax,
      passo: tipo === "integer" ? 1 : "any",
    };
  if (tipo === "select") return { tipo: "scelta", opzioni: voce.options };
  if (tipo === "multi_select") return { tipo: "scelte", opzioni: voce.options };
  if (tipo === "constant") return { tipo: "costante", valore: voce.value };
  if (tipo === "positive_time_period_dict") return { tipo: "durata" };
  return { tipo: "testo" };
}

/* Un valore di partenza: quello suggerito, o quello predefinito. */
function valoreDiPartenza(voce) {
  const suggerito = voce?.description?.suggested_value;
  if (suggerito !== undefined && suggerito !== null) return suggerito;
  if (voce?.default !== undefined) return voce.default;
  return undefined;
}

/** I campi di un passo «form», nell'ordine di Home Assistant. Una sezione
 * (`type: "expandable"`) porta i suoi campi con `sezione`. */
export function campiDelPasso(passo) {
  const parole = passo?.parole || {};
  const step = pulito(passo?.step_id) || "user";
  const fuori = [];
  const leggi = (schema, sezione = "") => {
    for (const voce of Array.isArray(schema) ? schema : []) {
      const nome = pulito(voce?.name);
      if (!nome) continue;
      if (voce.type === "expandable") {
        leggi(voce.schema, nome);
        continue;
      }
      const dove = sezione ? `step.${step}.sections.${sezione}.` : `step.${step}.`;
      const g = genereDelCampo(voce);
      const campo = {
        nome,
        sezione,
        tipo: g.tipo,
        obbligatorio: voce.required === true,
        etichetta: pulito(parole[`${dove}data.${nome}`]) || nomeLeggibile(nome),
        aiuto: testoDelPasso(parole[`${dove}data_description.${nome}`], passo?.segnaposti),
        valore: g.tipo === "costante" ? g.valore : valoreDiPartenza(voce),
      };
      if (g.tipo === "numero") {
        if (Number.isFinite(Number(g.min)) && g.min !== null) campo.min = Number(g.min);
        if (Number.isFinite(Number(g.max)) && g.max !== null) campo.max = Number(g.max);
        campo.passo = g.passo ?? "any";
        if (g.unita) campo.unita = g.unita;
      }
      if (g.tipo === "scelta" || g.tipo === "scelte") {
        campo.opzioni = scelteDi(g.opzioni, parole, g.traduzione);
        if (g.libera) campo.libera = true;
      }
      if (g.tipo === "entita") {
        campo.domini = g.domini;
        campo.multiplo = g.multiplo;
      }
      if (g.multiplo && g.tipo !== "entita") campo.multiplo = true;
      fuori.push(campo);
    }
  };
  leggi(passo?.schema);
  return fuori;
}

/** Il titolo e la spiegazione di un passo, nella lingua di chi guarda. */
export function paroleDelPasso(passo, { nomeIntegrazione = "" } = {}) {
  const parole = passo?.parole || {};
  const step = pulito(passo?.step_id);
  const seg = passo?.segnaposti || {};
  const titolo =
    testoDelPasso(parole[`step.${step}.title`], seg) ||
    testoDelPasso(parole.title, seg) ||
    pulito(nomeIntegrazione) ||
    nomeLeggibile(passo?.handler);
  const spiegazione = testoDelPasso(parole[`step.${step}.description`], seg);
  return { titolo, spiegazione };
}

/** Le voci di un menu, con le parole. */
export function vociDelMenu(passo) {
  const parole = passo?.parole || {};
  const step = pulito(passo?.step_id);
  return (Array.isArray(passo?.menu) ? passo.menu : []).map((v) => ({
    valore: v,
    etichetta: pulito(parole[`step.${step}.menu_options.${v}`]) || nomeLeggibile(v),
  }));
}

/* Gli errori e i no che quasi tutte le integrazioni condividono, quando la
 * loro non ha parole sue. */
export const FRASI_COMUNI = Object.freeze({
  cannot_connect: { it: "Non riesco a collegarmi.", en: "Failed to connect." },
  invalid_auth: { it: "Credenziali non valide.", en: "Invalid authentication." },
  invalid_host: { it: "Indirizzo non valido.", en: "Invalid hostname or IP address." },
  unknown: { it: "Errore imprevisto.", en: "Unexpected error." },
  timeout_connect: {
    it: "Il collegamento ha tardato troppo.",
    en: "Timeout establishing connection.",
  },
  already_configured: { it: "È già configurata.", en: "Already configured." },
  already_in_progress: { it: "La stai già aggiungendo.", en: "Configuration already in progress." },
  single_instance_allowed: {
    it: "Ce ne può essere una sola, e c'è già.",
    en: "Already configured. Only a single configuration possible.",
  },
  no_devices_found: {
    it: "Nessun dispositivo trovato in rete.",
    en: "No devices found on the network.",
  },
  reauth_successful: { it: "Accesso rifatto.", en: "Re-authentication was successful." },
  reconfigure_successful: {
    it: "Configurazione aggiornata.",
    en: "Re-configuration was successful.",
  },
  not_implemented: {
    it: "Questa integrazione non si aggiunge da qui.",
    en: "This integration can't be added from here.",
  },
});

/** La frase di un errore o di un no: quella dell'integrazione, o quella
 * comune, o la sigla. `scegli` traduce una frase comune (`{it, en}`). */
export function fraseDiUnCodice(passo, genere, codice, { scegli = (c) => c.it } = {}) {
  const parole = passo?.parole || {};
  const c = pulito(codice);
  const sua = parole[`${genere}.${c}`];
  if (sua) return testoDelPasso(sua, passo?.segnaposti);
  const comune = FRASI_COMUNI[c];
  if (comune) return scegli(comune);
  return nomeLeggibile(c);
}

/** Gli errori di un modulo: quello di tutto il passo (`base`) e quelli dei
 * campi, gia' in parole. */
export function erroriDelPasso(passo, opzioni = {}) {
  const fuori = { base: "", campi: {} };
  for (const [campo, codice] of Object.entries(passo?.errori || {})) {
    const frase = fraseDiUnCodice(passo, "error", codice, opzioni);
    if (campo === "base") fuori.base = frase;
    else fuori.campi[campo] = frase;
  }
  return fuori;
}

/* «1:30:00» o «90» (minuti) → {hours, minutes, seconds}. */
export function durataDaTesto(testo) {
  const t = pulito(testo);
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    const m = Number(t);
    return { hours: Math.floor(m / 60), minutes: m % 60, seconds: 0 };
  }
  const p = t.split(":").map((x) => Number(x));
  if (p.length < 2 || p.length > 3 || p.some((x) => !Number.isInteger(x) || x < 0)) return null;
  const [hours, minutes, seconds = 0] = p;
  if (minutes > 59 || seconds > 59) return null;
  return { hours, minutes, seconds };
}

export function durataInTesto(d) {
  if (!d || typeof d !== "object") return pulito(d);
  const due = (n) => String(Math.max(0, Number(n) || 0)).padStart(2, "0");
  return `${Number(d.hours) || 0}:${due(d.minutes)}:${due(d.seconds)}`;
}

/** Le risposte di un modulo nella forma di Home Assistant. `valori` sono
 * quelli scritti nella pagina (testi, `true`/`false`, elenchi). Torna i dati
 * e i campi obbligatori rimasti vuoti. */
export function datiDelModulo(campi, valori = {}) {
  const dati = {};
  const mancanti = [];
  const metti = (campo, v) => {
    if (campo.sezione) {
      dati[campo.sezione] ||= {};
      dati[campo.sezione][campo.nome] = v;
    } else dati[campo.nome] = v;
  };
  for (const campo of campi) {
    const grezzo = valori[campo.nome];
    let v;
    if (campo.tipo === "costante") v = campo.valore;
    else if (campo.tipo === "si-no") v = grezzo === true || grezzo === "true" || grezzo === "on";
    else if (campo.tipo === "numero") {
      const t = pulito(grezzo).replace(",", ".");
      v = t === "" ? undefined : Number(t);
      if (v !== undefined && !Number.isFinite(v)) v = undefined;
    } else if (campo.tipo === "scelte" || (campo.tipo === "entita" && campo.multiplo)) {
      v = (Array.isArray(grezzo) ? grezzo : grezzo ? [grezzo] : []).map(pulito).filter(Boolean);
      if (!v.length) v = campo.obbligatorio ? undefined : [];
    } else if (campo.tipo === "durata") {
      v = durataDaTesto(typeof grezzo === "object" ? durataInTesto(grezzo) : grezzo) || undefined;
    } else if (campo.tipo === "scelta") {
      /* Il valore torna del suo tipo: una scelta numerica resta un numero. */
      const trovata = (campo.opzioni || []).find((o) => String(o.valore) === String(grezzo));
      v = trovata ? trovata.valore : pulito(grezzo) || undefined;
    } else {
      v = typeof grezzo === "string" ? grezzo : grezzo === undefined ? undefined : String(grezzo);
      if (v !== undefined && campo.tipo !== "password" && campo.tipo !== "testo-lungo")
        v = v.trim();
      if (v === "") v = undefined;
    }
    if (v === undefined) {
      if (campo.obbligatorio) mancanti.push(campo.nome);
      continue;
    }
    metti(campo, v);
  }
  return { dati, mancanti };
}

/** I valori di partenza dei campi, per la pagina. */
export function valoriDiPartenza(campi) {
  const valori = {};
  for (const c of campi) {
    if (c.valore === undefined || c.valore === null) {
      if (c.tipo === "si-no") valori[c.nome] = false;
      continue;
    }
    if (c.tipo === "durata") valori[c.nome] = durataInTesto(c.valore);
    else valori[c.nome] = c.valore;
  }
  return valori;
}
