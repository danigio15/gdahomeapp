/* Quello che la casa sa di se', messo in fila per rispondere alle domande.
 *
 * «Chiedi alla casa…» risponde con quello che la plancia sa gia': i sensori
 * di temperatura scelti per le stanze, il meteo con le sue previsioni, le
 * persone, le luci, le finestre, l'energia, le macchine, l'auto, le
 * telecamere, l'agenda, i rifiuti. Qui si mette insieme tutto in una forma
 * sola, con i nomi che si leggono e le stanze di ognuno.
 *
 * Due strade per ogni cosa. Quella buona e' quella della plancia: chi ha
 * scelto i termometri delle stanze, le persone da seguire, le telecamere, le
 * ha scelte apposta, e quelle valgono. Dove la plancia non ha niente si guarda
 * Home Assistant direttamente: i sensori di temperatura con una stanza, le
 * persone (`person.*`), le finestre per classe, gli aggiornamenti. Cosi' la
 * casa risponde anche a chi non ha configurato niente, e non si inventa
 * niente: quello che non c'e' resta vuoto, e la risposta lo dice.
 *
 * Puro: gli stati arrivano da chi chiama, insieme a come si trova la stanza
 * di un'entita' e all'ora di adesso.
 */

const pulito = (valore) => String(valore ?? "").trim();
const elenco = (valore) => (Array.isArray(valore) ? valore.filter(Boolean) : []);
const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "" || typeof valore === "boolean")
    return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/** I domini che si possono comandare a parole. */
export const DOMINI_COMANDABILI = Object.freeze([
  "light",
  "switch",
  "cover",
  "fan",
  "climate",
  "media_player",
  "lock",
  "input_boolean",
  "valve",
  "humidifier",
]);

const MUTI = new Set(["unavailable", "unknown"]);

/* Le cose che stanno fuori: un termometro in giardino non e' la temperatura
 * della casa. */
const ESTERNO =
  /(estern|outdoor|outside|fuori|giardin|balcon|terrazz|cortile|garden|meteo|weather)/i;
/* E quelle che hanno un termometro ma non sono una stanza: il frigo, il
 * forno, il computer, l'acqua calda. */
const NON_STANZA =
  /(frig|freez|congel|forno|oven|cpu|processor|nas\b|server|batter|acqua|water|boiler|caldaia|piscin|pool|auto\b|car\b|mandata|ritorno|pannell|inverter|scaldabagno|puffer|accumul|stampant|printer|router|disk|disco|motore|engine|esp\b|chip|rpi|raspberry|tv\b|lavatric|lavastovigl|asciugatric|aquari|acquari|compressore)/i;
/* La batteria di casa: l'accumulo dell'impianto, non quella di un sensore. */
const ACCUMULO =
  /(accumul|storage|powerwall|home batter|batteria (?:di casa|impianto|fotovolt|inverter)|battery (?:storage|soc|level)|state of charge|\bsoc\b)/i;
const CANCELLO = /(cancell|garage|basculante|carrabile|gate)/i;

function nomeDi(entity, stato) {
  return (
    pulito(stato?.attributes?.friendly_name) ||
    pulito(entity).split(".")[1]?.replace(/_/g, " ") ||
    entity
  );
}

function daQuando(stato, adesso) {
  const quando = Date.parse(stato?.last_changed || stato?.last_updated || "");
  return Number.isFinite(quando) ? Math.max(0, adesso - quando) : null;
}

/* La stanza di un'entita': chi chiama sa come trovarla (il registro delle
 * aree di Home Assistant); per le prove basta una mappa. */
function trovaArea(fonti) {
  if (typeof fonti.areaDi === "function")
    return (entity) => {
      try {
        return pulito(fonti.areaDi(entity));
      } catch (_errore) {
        return "";
      }
    };
  const mappa = fonti.areaDi && typeof fonti.areaDi === "object" ? fonti.areaDi : {};
  return (entity) => pulito(mappa[entity]);
}

const media = (valori) => {
  const buoni = valori.filter((v) => v !== null);
  return buoni.length ? buoni.reduce((s, v) => s + v, 0) / buoni.length : null;
};

/* Le temperature delle stanze lette da Home Assistant: per ogni stanza la
 * media dei suoi termometri, e il termostato solo dove un termometro manca. */
function stanzeDaHomeAssistant(entita) {
  const perStanza = new Map();
  const aggiungi = (area, campo, valore, entity) => {
    if (!area || valore === null) return;
    if (!perStanza.has(area))
      perStanza.set(area, { stanza: area, t: [], u: [], tc: [], entity: "" });
    const voce = perStanza.get(area);
    voce[campo].push(valore);
    if (campo === "t" && !voce.entity) voce.entity = entity;
  };
  for (const e of entita) {
    if (ESTERNO.test(`${e.nome} ${e.area}`) || NON_STANZA.test(`${e.entity} ${e.nome}`)) continue;
    if (e.dominio === "sensor" && e.classe === "temperature")
      aggiungi(e.area, "t", numero(e.stato), e.entity);
    else if (e.dominio === "sensor" && e.classe === "humidity")
      aggiungi(e.area, "u", numero(e.stato), e.entity);
    else if (e.dominio === "climate")
      aggiungi(e.area, "tc", numero(e.attributi?.current_temperature), e.entity);
  }
  return [...perStanza.values()]
    .map((v) => ({
      stanza: v.stanza,
      entity: v.entity,
      temperatura: media(v.t.length ? v.t : v.tc),
      umidita: media(v.u),
    }))
    .filter((v) => v.temperatura !== null || v.umidita !== null)
    .sort((a, b) => a.stanza.localeCompare(b.stanza));
}

function fuoriDallaCasa(states, entita, fonti) {
  const meteoId =
    pulito(fonti.meteo) || Object.keys(states).find((id) => id.startsWith("weather.")) || "";
  const meteo = states[meteoId];
  const sensore = entita.find(
    (e) =>
      e.dominio === "sensor" &&
      e.classe === "temperature" &&
      ESTERNO.test(`${e.entity} ${e.nome} ${e.area}`) &&
      !/(meteo|weather)/i.test(e.entity) &&
      numero(e.stato) !== null,
  );
  const umido = entita.find(
    (e) =>
      e.dominio === "sensor" &&
      e.classe === "humidity" &&
      ESTERNO.test(`${e.entity} ${e.nome} ${e.area}`) &&
      numero(e.stato) !== null,
  );
  const a = meteo?.attributes || {};
  return {
    meteo: meteo ? meteoId : "",
    condizione: meteo && !MUTI.has(pulito(meteo.state)) ? pulito(meteo.state) : "",
    temperatura:
      numero(fonti.fuori?.temperatura) ?? (sensore ? numero(sensore.stato) : numero(a.temperature)),
    umidita: umido ? numero(umido.stato) : numero(a.humidity),
    vento: numero(a.wind_speed),
    unitaVento: pulito(a.wind_speed_unit) || "km/h",
    sensore: sensore?.nome || "",
  };
}

function personeDellaCasa(states, fonti, adesso) {
  const scelte = elenco(fonti.persone);
  const zone = new Map(
    Object.entries(states)
      .filter(([id]) => id.startsWith("zone."))
      .map(([id, s]) => [id.slice(5), nomeDi(id, s)]),
  );
  const voci = scelte.length
    ? scelte.map((p) => ({ nome: pulito(p.nome || p.name), entity: pulito(p.entity) }))
    : Object.entries(states)
        .filter(([id]) => id.startsWith("person."))
        .map(([id, s]) => ({ nome: nomeDi(id, s), entity: id }));
  return voci
    .filter((p) => p.nome)
    .map((p) => {
      const s = states[p.entity];
      const stato = pulito(s?.state);
      const zona =
        stato && !["home", "not_home", "unknown", "unavailable"].includes(stato)
          ? zone.get(stato.toLowerCase().replace(/\s+/g, "_")) || stato
          : "";
      return {
        nome: p.nome,
        entity: p.entity,
        stato,
        // Anche una zona fatta apposta per la casa, che si chiama «Casa».
        inCasa: stato === "home" || /^(?:a\s+)?(?:casa|home)(?:\s+\S+)?$/i.test(zona),
        noto: Boolean(stato) && !MUTI.has(stato),
        zona,
        daQuando: daQuando(s, adesso),
      };
    });
}

function energiaDiOggi(entita, fonti) {
  const data = fonti.energiaOggi && typeof fonti.energiaOggi === "object" ? fonti.energiaOggi : {};
  const fuori = {
    consumo: numero(data.consumo),
    produzione: numero(data.produzione),
    prelievo: numero(data.prelievo),
    immissione: numero(data.immissione),
  };
  const oggi = /(oggi|today|daily|giornalier|giorno|day)/i;
  for (const e of entita) {
    if (e.dominio !== "sensor" || e.classe !== "energy") continue;
    const testo = `${e.entity} ${e.nome}`;
    if (!oggi.test(testo)) continue;
    let kwh = numero(e.stato);
    if (kwh === null) continue;
    if (/^wh$/i.test(pulito(e.attributi?.unit_of_measurement))) kwh /= 1000;
    if (/(produz|solar|fotovolt|\bpv\b|yield|produc)/i.test(testo)) fuori.produzione ??= kwh;
    else if (/(immess|export|cedut|vendut|feed)/i.test(testo)) fuori.immissione ??= kwh;
    else if (/(prelev|import|rete|grid)/i.test(testo)) fuori.prelievo ??= kwh;
    else if (/(consum|load|casa|house|home)/i.test(testo)) fuori.consumo ??= kwh;
  }
  return fuori;
}

function energiaAdesso(entita, fonti) {
  const data = fonti.energia && typeof fonti.energia === "object" ? fonti.energia : {};
  const fuori = {
    solare: numero(data.solare),
    rete: numero(data.rete),
    casa: numero(data.casa),
    batteria: numero(data.batteria),
    soc: numero(data.soc),
  };
  if (fuori.soc === null) {
    const soc = entita.find(
      (e) =>
        e.dominio === "sensor" &&
        (e.classe === "battery" || /%/.test(pulito(e.attributi?.unit_of_measurement))) &&
        ACCUMULO.test(`${e.entity} ${e.nome}`) &&
        numero(e.stato) !== null,
    );
    if (soc) fuori.soc = numero(soc.stato);
  }
  /* Senza la plancia, le potenze si cercano per nome: e' meglio di niente,
   * e chi ha configurato l'Energia non passa di qui. */
  const watt = (re) => {
    const e = entita.find(
      (x) =>
        x.dominio === "sensor" &&
        x.classe === "power" &&
        re.test(`${x.entity} ${x.nome}`) &&
        numero(x.stato) !== null,
    );
    if (!e) return null;
    const v = numero(e.stato);
    return /^kw$/i.test(pulito(e.attributi?.unit_of_measurement)) ? v * 1000 : v;
  };
  fuori.solare ??= watt(/(solar|fotovolt|\bpv\b|produz)/i);
  fuori.rete ??= watt(/(grid|rete|contatore|meter)/i);
  fuori.casa ??= watt(/(consum|load|house|casa|home)/i);
  return fuori;
}

function eventiDelCalendario(states, fonti) {
  if (Array.isArray(fonti.eventi))
    return elenco(fonti.eventi)
      .map((e) => ({
        titolo: pulito(e.summary || e.titolo || e.message),
        inizio: numero(e.inizio) ?? Date.parse(e.start?.dateTime || e.start?.date || e.start || ""),
        fine: numero(e.fine) ?? Date.parse(e.end?.dateTime || e.end?.date || e.end || ""),
        tuttoIlGiorno: Boolean(
          e.tuttoIlGiorno ?? e.all_day ?? (e.start?.date && !e.start?.dateTime),
        ),
      }))
      .filter((e) => e.titolo && Number.isFinite(e.inizio))
      .sort((a, b) => a.inizio - b.inizio);
  return Object.entries(states)
    .filter(([id, s]) => id.startsWith("calendar.") && s?.attributes?.message)
    .map(([, s]) => ({
      titolo: pulito(s.attributes.message),
      inizio: Date.parse(String(s.attributes.start_time || "").replace(" ", "T")),
      fine: Date.parse(String(s.attributes.end_time || "").replace(" ", "T")),
      tuttoIlGiorno: Boolean(s.attributes.all_day),
    }))
    .filter((e) => Number.isFinite(e.inizio))
    .sort((a, b) => a.inizio - b.inizio);
}

/**
 * Tutto quello che la casa sa adesso, pronto per le domande.
 *
 * `fonti`:
 *   states        gli stati di Home Assistant (obbligatori);
 *   adesso        l'istante di adesso;
 *   areaDi        la stanza di un'entita': una funzione o una mappa;
 *   aree          i nomi delle aree di Home Assistant;
 *   stanze        le stanze della plancia (nomi o `{ name }`);
 *   temperature   i termometri scelti per le stanze: `{ name, entity,
 *                 temperature, humidity, fuori }`, con `fuori` vero per le
 *                 stanze segnate «All'aperto»;
 *   persone       le persone scelte: `{ name, entity }`;
 *   meteo         l'entita' del meteo scelta;
 *   previsioni    `{ giorni, ore }` da `weather.get_forecasts`;
 *   energia       le potenze di adesso `{ solare, rete, casa, batteria, soc }`;
 *   energiaOggi   i totali di oggi in kWh;
 *   elettrodomestici, auto, telecamere, eventi, rifiuti, batterieBasse,
 *   nonRispondono, aggiornamenti: le righe che la plancia ha gia';
 *   antifurto     l'entita' della centrale scelta;
 *   luci          le luci scelte nella plancia: `{ entity, nome, stanza }`;
 *   varchi        le porte e finestre della plancia: `{ entity, nome, tipo,
 *                 stato }`, con `tipo` porta|finestra e `stato`
 *                 aperto|chiuso;
 *   comandabile   chi si puo' comandare (le entita' messe in sola lettura
 *                 no).
 */
export function sapereDellaCasa(fonti = {}) {
  const states = fonti.states && typeof fonti.states === "object" ? fonti.states : {};
  const adesso = numero(fonti.adesso) ?? Date.now();
  const areaDi = trovaArea(fonti);
  const comandabile = typeof fonti.comandabile === "function" ? fonti.comandabile : () => true;

  const entita = Object.entries(states)
    .filter(([id, s]) => id.includes(".") && s && typeof s === "object")
    .map(([id, s]) => {
      const dominio = id.split(".")[0];
      return {
        entity: id,
        dominio,
        nome: nomeDi(id, s),
        area: areaDi(id),
        stato: pulito(s.state),
        classe: pulito(s.attributes?.device_class),
        attributi: s.attributes || {},
        daQuando: daQuando(s, adesso),
        gruppo: Array.isArray(s.attributes?.entity_id) && s.attributes.entity_id.length > 0,
        comandabile: DOMINI_COMANDABILI.includes(dominio) && comandabile(id) !== false,
      };
    });

  /* Le luci della plancia: il nome e la stanza che ci ha dato chi la usa
   * battono quelli di Home Assistant, che spesso sono del dispositivo
   * («Luce Camera da letto switch_0»). E una luce scelta e' una luce anche
   * quando in Home Assistant e' un interruttore. */
  const scelte = new Map();
  for (const voce of elenco(fonti.luci)) {
    const id = pulito(voce?.entity);
    if (id.includes(".")) scelte.set(id, voce);
  }
  for (const e of entita) {
    const voce = scelte.get(e.entity);
    if (!voce) continue;
    e.luce = true;
    e.nome = pulito(voce.nome || voce.name) || e.nome;
    e.area = pulito(voce.stanza) || e.area;
  }

  /* Le porte e le finestre della plancia (la sezione Varchi, con i contatti
   * scritti nelle Finestre): sono quelle che conta la tessera «finestre
   * aperte», con i loro nomi, porta o finestra come detto li', e aperte o
   * chiuse col verso giusto anche per i contatti girati. Un contatto senza
   * classe in Home Assistant c'e' lo stesso. */
  const varchi = new Map();
  for (const voce of elenco(fonti.varchi)) {
    const id = pulito(voce?.entity);
    if (id.includes(".")) varchi.set(id, voce);
  }
  for (const e of entita) {
    const voce = varchi.get(e.entity);
    if (!voce) continue;
    e.varco = true;
    e.nome = pulito(voce.nome || voce.name) || e.nome;
    if (voce.tipo === "finestra") e.classe = "window";
    else if (voce.tipo === "porta" && e.classe === "window") e.classe = "door";
    else if (!["window", "door", "opening", "garage_door"].includes(e.classe)) e.classe = "door";
    if (voce.stato === "aperto") e.stato = "on";
    else if (voce.stato === "chiuso") e.stato = "off";
    else e.stato = "unavailable";
  }

  const aree = new Set();
  for (const a of elenco(fonti.aree))
    aree.add(pulito(typeof a === "object" ? a.name || a.nome : a));
  for (const s of elenco(fonti.stanze))
    aree.add(pulito(typeof s === "object" ? s.name || s.nome : s));
  for (const e of entita) if (e.area) aree.add(e.area);
  aree.delete("");

  const configurate = elenco(fonti.temperature)
    .map((r) => ({
      stanza: pulito(r.name || r.nome || r.stanza),
      entity: pulito(r.entity),
      temperatura: numero(r.temperature ?? r.temperatura),
      umidita: numero(r.humidity ?? r.umidita),
      /* Il balcone segnato «All'aperto» (#251) resta fra le stanze — «quanti
       * gradi ci sono sul balcone?» ha una risposta — ma chi fa la media della
       * casa lo salta. La chiave c'e' solo quando e' vera. */
      ...(r.fuori === true ? { fuori: true } : {}),
    }))
    .filter((r) => r.stanza && (r.temperatura !== null || r.umidita !== null));
  const dentro = configurate.length ? configurate : stanzeDaHomeAssistant(entita);

  const unitaTemperatura =
    pulito(states[dentro[0]?.entity]?.attributes?.unit_of_measurement) === "°F" ? "°F" : "°C";

  const centrale =
    (pulito(fonti.antifurto) && states[pulito(fonti.antifurto)] ? pulito(fonti.antifurto) : "") ||
    Object.keys(states).find((id) => id.startsWith("alarm_control_panel.")) ||
    "";

  const previsioni =
    fonti.previsioni && typeof fonti.previsioni === "object" ? fonti.previsioni : {};
  const fuori = fuoriDallaCasa(states, entita, fonti);
  const giorni = elenco(previsioni.giorni).length
    ? elenco(previsioni.giorni)
    : elenco(states[fuori.meteo]?.attributes?.forecast);

  const telecamere = (
    Array.isArray(fonti.telecamere)
      ? elenco(fonti.telecamere).map((c) => ({
          entity: pulito(c.entity),
          nome: pulito(c.name || c.nome) || nomeDi(c.entity, states[c.entity]),
        }))
      : entita
          .filter((e) => e.dominio === "camera")
          .map((e) => ({ entity: e.entity, nome: e.nome }))
  )
    .filter((c) => c.entity)
    .map((c) => ({ ...c, area: areaDi(c.entity) }));

  return {
    adesso,
    lingua: pulito(fonti.lingua) || "it",
    aree: [...aree].sort((a, b) => a.localeCompare(b)),
    entita,
    dentro,
    unitaTemperatura,
    fuori,
    previsioni: { giorni, ore: elenco(previsioni.ore) },
    persone: personeDellaCasa(states, fonti, adesso),
    energia: energiaAdesso(entita, fonti),
    energiaOggi: energiaDiOggi(entita, fonti),
    elettrodomestici: elenco(fonti.elettrodomestici).map((a) => ({
      nome: pulito(a.name || a.nome),
      stato: pulito(a.mode || a.stato),
      tipo: pulito(a.type || a.tipo),
      restano: numero(a.restano),
      prontaAlle: numero(a.prontaAlle),
      fase: pulito(a.fase),
      programma: pulito(a.programma),
      stanza: pulito(a.stanza),
    })),
    auto: elenco(fonti.auto).map((v) => ({
      nome: pulito(v.nome || v.name),
      percentuale: numero(v.percentuale),
      km: numero(v.km),
      inCarica: Boolean(v.inCarica),
      fine: pulito(v.fine),
      carburante: v.carburante === true,
    })),
    telecamere,
    eventi: eventiDelCalendario(states, fonti),
    rifiuti: elenco(fonti.rifiuti).map((r) => ({
      nome: pulito(r.name || r.nome),
      quando: pulito(r.quando),
      giorni: numero(r.giorni),
    })),
    batterieBasse: Array.isArray(fonti.batterieBasse)
      ? elenco(fonti.batterieBasse).map((b) => ({
          nome: pulito(b.name || b.nome),
          livello: numero(b.level ?? b.livello),
        }))
      : entita
          .filter(
            (e) =>
              e.dominio === "sensor" &&
              e.classe === "battery" &&
              !ACCUMULO.test(`${e.entity} ${e.nome}`) &&
              numero(e.stato) !== null &&
              numero(e.stato) <= 20,
          )
          .map((e) => ({
            nome: e.nome.replace(/\s*(batteria|battery)\s*$/i, "") || e.nome,
            livello: numero(e.stato),
          }))
          .sort((a, b) => a.livello - b.livello),
    nonRispondono: Array.isArray(fonti.nonRispondono)
      ? elenco(fonti.nonRispondono).map((n) => ({ nome: pulito(n.name || n.nome) }))
      : entita
          .filter(
            (e) =>
              (DOMINI_COMANDABILI.includes(e.dominio) || e.dominio === "camera") &&
              e.stato === "unavailable",
          )
          .map((e) => ({ nome: e.nome })),
    aggiornamenti: Array.isArray(fonti.aggiornamenti)
      ? elenco(fonti.aggiornamenti).map((u) => ({
          nome: pulito(u.name || u.nome || u.title),
          versione: pulito(u.versione || u.latest_version || u.a),
        }))
      : entita
          .filter((e) => e.dominio === "update" && e.stato === "on")
          .map((e) => ({
            nome:
              pulito(e.attributi?.title) || e.nome.replace(/\s*(update|aggiornamento)\s*$/i, ""),
            versione: pulito(e.attributi?.latest_version),
          })),
    antifurto: centrale
      ? {
          entity: centrale,
          nome: nomeDi(centrale, states[centrale]),
          stato: pulito(states[centrale].state),
          attributi: states[centrale].attributes || {},
          statoHa: states[centrale],
        }
      : null,
  };
}

/** Le finestre e le porte, coi contatti di Home Assistant. */
export function contattiDellaCasa(sapere) {
  const dellaPlancia = elenco(sapere?.entita).filter((e) => e.varco);
  if (dellaPlancia.length) return dellaPlancia;
  return elenco(sapere?.entita).filter(
    (e) =>
      e.dominio === "binary_sensor" &&
      ["window", "door", "opening", "garage_door"].includes(e.classe) &&
      !/(frig|freez|congel)/i.test(`${e.entity} ${e.nome}`),
  );
}

/** Il cancello o il garage, fra le coperture e gli interruttori. */
export function eUnCancello(e) {
  if (!e) return false;
  if (e.dominio === "cover" && ["gate", "garage"].includes(e.classe)) return true;
  return (
    CANCELLO.test(`${e.entity} ${e.nome}`) &&
    ["cover", "switch", "button", "lock"].includes(e.dominio)
  );
}
