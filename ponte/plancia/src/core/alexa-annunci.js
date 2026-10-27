/* Le notifiche dette anche dagli Echo di casa.
 *
 * «Notifiche verso Alexa? O messaggi da app verso Alexa per comunicare
 * qualcosa a casa?» Le notifiche vanno ai telefoni; chi e' in casa con le
 * mani occupate non le sente. Qui si decide se una notifica la dice anche un
 * Echo, quale, e con che parole.
 *
 * Gli Echo li fa parlare Home Assistant con l'integrazione Alexa Media Player
 * (si installa da HACS): il servizio e' `notify.alexa_media`, con gli Echo
 * come destinatari e il tipo «announce» (il suono, poi la voce) o «tts» (la
 * voce e basta). Senza quell'integrazione gli Echo in Home Assistant non ci
 * sono, e la scelta non si offre.
 *
 * E' una scelta della casa e non del telefono: gli Echo stanno in casa, e
 * dicono la stessa cosa a chiunque ci sia. Sta nella plancia principale
 * (`cd_alexa`), e la legge il ponte quando manda una notifica.
 *
 * Qui non c'e' un documento ne' un filo: si prova da solo.
 */

/** La casella della plancia. */
export const CHIAVE_ALEXA = "cd_alexa";

/** Le famiglie di notifiche che si possono far dire, come nell'app. */
export const CATEGORIE_ALEXA = Object.freeze([
  Object.freeze({
    id: "urgenti",
    it: "Urgenti: antifurto, allarmi, campanello, blackout",
    en: "Urgent: alarm, sensors, doorbell, blackout",
  }),
  Object.freeze({
    id: "sicurezza",
    it: "Sicurezza: inserimenti, aperture, movimento",
    en: "Security: arming, openings, motion",
  }),
  Object.freeze({
    id: "casa",
    it: "Casa: elettrodomestici, frigo, pioggia, animali",
    en: "Home: appliances, fridge, rain, pets",
  }),
  Object.freeze({ id: "persone", it: "Persone: chi arriva", en: "People: who arrives" }),
  Object.freeze({
    id: "personalizzate",
    it: "Le tue notifiche personalizzate",
    en: "Your custom notifications",
  }),
  Object.freeze({
    id: "homeassistant",
    it: "Dalle automazioni di Home Assistant",
    en: "From Home Assistant automations",
  }),
]);

const ID_DELLE_CATEGORIE = new Set(CATEGORIE_ALEXA.map((voce) => voce.id));

/** Come si dice: col suono prima («annuncio») o solo la voce. */
export const MODI_ALEXA = Object.freeze(["annuncio", "voce"]);

/* Di serie: spenta, e quando la si accende dice solo le urgenti — una casa
 * che parla per ogni lavatrice finita la si spegne il giorno dopo. Di notte
 * sta zitta, tranne le urgenti. */
export const ALEXA_DI_SERIE = Object.freeze({
  attivo: false,
  altoparlanti: Object.freeze([]),
  categorie: Object.freeze(["urgenti"]),
  silenzio: Object.freeze({ da: "23:00", a: "07:00" }),
  modo: "annuncio",
  avvisi: Object.freeze([]),
});

/** Quanti Echo al massimo, e quanto lungo al massimo quello che si dice. */
export const ALTOPARLANTI_AL_PIU = 12;
export const PAROLE_AL_PIU = 280;

const ORARIO = /^([01]\d|2[0-3]):([0-5]\d)$/;
const LETTORE = /^media_player\.[a-z0-9_]{1,120}$/;

/** La scelta com'e' scritta, ripulita: quello che non si capisce torna di serie. */
export function normalizzaAlexa(grezzo) {
  let valore = grezzo;
  if (typeof valore === "string") {
    try {
      valore = JSON.parse(valore);
    } catch (_errore) {
      valore = null;
    }
  }
  if (!valore || typeof valore !== "object" || Array.isArray(valore))
    return {
      ...ALEXA_DI_SERIE,
      altoparlanti: [],
      categorie: [...ALEXA_DI_SERIE.categorie],
      silenzio: { ...ALEXA_DI_SERIE.silenzio },
      avvisi: [],
    };
  const altoparlanti = [
    ...new Set(
      (Array.isArray(valore.altoparlanti) ? valore.altoparlanti : [])
        .map((uno) => String(uno ?? "").trim())
        .filter((uno) => LETTORE.test(uno)),
    ),
  ].slice(0, ALTOPARLANTI_AL_PIU);
  const categorie = Array.isArray(valore.categorie)
    ? [...new Set(valore.categorie.map(String).filter((uno) => ID_DELLE_CATEGORIE.has(uno)))]
    : [...ALEXA_DI_SERIE.categorie];
  const silenzio = valore.silenzio === null ? null : orarioDelSilenzio(valore.silenzio);
  return {
    attivo: valore.attivo === true,
    altoparlanti,
    categorie,
    silenzio,
    modo: MODI_ALEXA.includes(valore.modo) ? valore.modo : ALEXA_DI_SERIE.modo,
    avvisi: avvisiPuliti(valore.avvisi),
  };
}

function orarioDelSilenzio(silenzio) {
  const da = String(silenzio?.da ?? "");
  const a = String(silenzio?.a ?? "");
  if (ORARIO.test(da) && ORARIO.test(a) && da !== a) return { da, a };
  return { ...ALEXA_DI_SERIE.silenzio };
}

const minuti = (orario) => {
  const [, ore, min] = ORARIO.exec(orario);
  return Number(ore) * 60 + Number(min);
};

/** Se adesso e' l'ora del silenzio. Passa la mezzanotte: 23:00–07:00. */
export function nelSilenzio(silenzio, data = new Date()) {
  if (!silenzio) return false;
  const adesso = data.getHours() * 60 + data.getMinutes();
  const da = minuti(silenzio.da);
  const a = minuti(silenzio.a);
  return da < a ? adesso >= da && adesso < a : adesso >= da || adesso < a;
}

/**
 * Se questa notifica la dicono gli Echo. `categoria` e' quella dell'app
 * (`sentinella.js`, `CATEGORIE`), `urgenza` «bassa», «normale» o «urgente».
 * Le urgenti passano anche nel silenzio; la prova e il riepilogo della sera
 * non si dicono mai — la prova ha il suo tasto, e il riepilogo e' una lettura.
 */
export function daDire(conf, { categoria, urgenza, tipo } = {}, data = new Date()) {
  if (!conf?.attivo || !conf.altoparlanti?.length) return false;
  if (tipo === "prova" || tipo === "riepilogo") return false;
  if (!conf.categorie?.includes(categoria)) return false;
  if (urgenza !== "urgente" && nelSilenzio(conf.silenzio, data)) return false;
  return true;
}

/* Le figurine non si leggono: un Echo direbbe «faccina che sorride». */
const FIGURINE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

/** Le parole da dire: il titolo, poi il testo, senza figurine. */
export function paroleDaDire(titolo, testo) {
  const pulito = (pezzo) =>
    String(pezzo ?? "")
      .replace(FIGURINE, "")
      .replace(/\s+/g, " ")
      .trim();
  const prima = pulito(titolo);
  const dopo = pulito(testo);
  const insieme = prima && dopo ? `${prima.replace(/[.!?:]$/, "")}. ${dopo}` : prima || dopo;
  return insieme.length > PAROLE_AL_PIU
    ? `${insieme.slice(0, PAROLE_AL_PIU - 1).trimEnd()}…`
    : insieme;
}

/** La chiamata a Home Assistant che fa parlare gli Echo scelti. */
export function chiamataAlexa(conf, parole, altoparlanti = conf.altoparlanti) {
  return {
    type: "call_service",
    domain: "notify",
    service: "alexa_media",
    service_data: {
      message: parole,
      target: [...altoparlanti],
      data: { type: conf.modo === "voce" ? "tts" : "announce" },
    },
  };
}

/**
 * Gli Echo che Home Assistant conosce: i lettori di Alexa Media Player, che
 * hanno di loro `last_called` (quale Echo ha sentito l'ultima richiesta) e
 * nessun altro lettore ha. Ordinati per nome.
 */
export function altoparlantiAlexa(stati) {
  const tutti = Array.isArray(stati) ? stati : Object.values(stati || {});
  return tutti
    .filter(
      (stato) =>
        LETTORE.test(String(stato?.entity_id ?? "")) &&
        stato.attributes &&
        Object.prototype.hasOwnProperty.call(stato.attributes, "last_called"),
    )
    .map((stato) => ({
      entita: stato.entity_id,
      nome: String(stato.attributes.friendly_name || stato.entity_id).trim(),
      spento: stato.state === "unavailable",
    }))
    .sort((uno, due) => uno.nome.localeCompare(due.nome, "it"));
}

/* ─── Gli avvisi personalizzati ─────────────────────────────────────────
 *
 * «Crea la possibilita' di fare avvisi personalizzati.» Oltre alle notifiche
 * della casa, gli Echo dicono frasi scritte da chi amministra:
 *
 * - a un orario, nei giorni scelti: «alle 7:30, dal lunedi' al venerdi':
 *   e' ora di andare a scuola»;
 * - quando una cosa di casa cambia e resta cosi' un po': «se il garage resta
 *   aperto 10 minuti: il garage e' aperto».
 *
 * Valgono solo con Alexa accesa e almeno un Echo. Quelli a orario si dicono
 * anche nell'ora del silenzio — l'orario l'ha scelto chi li ha scritti —;
 * quelli su una cosa di casa no, come le notifiche non urgenti.
 */

/** Quanti avvisi al massimo, e quanto lunga la frase. */
export const AVVISI_AL_PIU = 20;
export const FRASE_AL_PIU = 200;
export const QUANDO_AVVISO = Object.freeze(["orario", "stato"]);
export const CONDIZIONI_AVVISO = Object.freeze(["uguale", "diverso", "sopra", "sotto"]);

/* Dopo l'orario, per quanto lo si dice ancora: il ponte guarda ogni mezzo
 * minuto, e un ponte riavviato alle 7:31 deve dire l'avviso delle 7:30. */
const RITARDO_MASSIMO = 5 * 60 * 1000;

const ENTITA = /^[a-z_]+\.[a-z0-9_]{1,120}$/;
const pulisci = (testo, tetto) =>
  String(testo ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, tetto);
const intero = (valore, minimo, massimo, diSerie) => {
  const n = Math.round(Number(valore));
  return Number.isFinite(n) ? Math.max(minimo, Math.min(massimo, n)) : diSerie;
};

/** Un avviso com'e' scritto, ripulito; `null` se non si puo' dire. */
export function avvisoPulito(grezzo, indice = 0) {
  if (!grezzo || typeof grezzo !== "object") return null;
  const frase = pulisci(grezzo.frase, FRASE_AL_PIU);
  if (!frase) return null;
  const quando = QUANDO_AVVISO.includes(grezzo.quando) ? grezzo.quando : "orario";
  const id = /^a_[a-z0-9]{1,16}$/.test(String(grezzo.id || "")) ? grezzo.id : `a_${indice}`;
  const altoparlanti = [
    ...new Set(
      (Array.isArray(grezzo.altoparlanti) ? grezzo.altoparlanti : [])
        .map((uno) => String(uno ?? "").trim())
        .filter((uno) => LETTORE.test(uno)),
    ),
  ].slice(0, ALTOPARLANTI_AL_PIU);
  const base = { id, attivo: grezzo.attivo !== false, frase, quando, altoparlanti };
  if (quando === "orario") {
    const ora = ORARIO.test(String(grezzo.ora || "")) ? grezzo.ora : "08:00";
    const giorni = Array.isArray(grezzo.giorni)
      ? [
          ...new Set(
            grezzo.giorni.map(Number).filter((g) => Number.isInteger(g) && g >= 0 && g <= 6),
          ),
        ].sort()
      : [0, 1, 2, 3, 4, 5, 6];
    return { ...base, ora, giorni };
  }
  const entita = String(grezzo.entita || "").trim();
  return {
    ...base,
    entita: ENTITA.test(entita) ? entita : "",
    condizione: CONDIZIONI_AVVISO.includes(grezzo.condizione) ? grezzo.condizione : "uguale",
    valore: pulisci(grezzo.valore, 60),
    per: intero(grezzo.per, 0, 24 * 60, 0),
  };
}

/** Tutti gli avvisi della scelta, ripuliti, senza doppioni di id. */
export function avvisiPuliti(grezzi) {
  const visti = new Set();
  const fuori = [];
  for (const [indice, grezzo] of (Array.isArray(grezzi) ? grezzi : []).entries()) {
    const avviso = avvisoPulito(grezzo, indice);
    if (!avviso) continue;
    if (visti.has(avviso.id)) avviso.id = `a_${indice}x`;
    visti.add(avviso.id);
    fuori.push(avviso);
    if (fuori.length >= AVVISI_AL_PIU) break;
  }
  return fuori;
}

/* Lo stesso confronto delle notifiche personalizzate (`sentinella.js`,
 * `condizioneVera`): numeri se tutti e due lo sono, se no parole. */
const comeNumero = (valore) => {
  const testo = String(valore ?? "")
    .trim()
    .replace(",", ".");
  if (!testo) return null;
  const n = Number(testo);
  return Number.isFinite(n) ? n : null;
};

export function condizioneDellAvviso(avviso, stato) {
  const scritto = String(avviso?.valore ?? "").trim();
  const n = comeNumero(stato);
  const soglia = comeNumero(scritto);
  switch (avviso?.condizione) {
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

const giornoDi = (data) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;

/**
 * Gli avvisi da dire adesso. `stati` sono quelli di Home Assistant (per
 * entita'), `memoria` e' del chiamante e resta fra un giro e l'altro: chi e'
 * gia' stato detto oggi, da quando una condizione e' vera. Ogni avviso torna
 * con gli Echo a cui dirlo: i suoi, se ne ha, se no quelli della scelta.
 */
export function avvisiDaDire(conf, stati, data = new Date(), memoria = {}) {
  memoria.detti ||= {};
  memoria.veroDa ||= {};
  if (!conf?.attivo || !conf.altoparlanti?.length) return [];
  const adesso = data.getTime();
  const oggi = giornoDi(data);
  const fuori = [];
  const vivi = new Set();
  for (const avviso of conf.avvisi || []) {
    vivi.add(avviso.id);
    if (!avviso.attivo) continue;
    const altoparlanti = avviso.altoparlanti?.length ? avviso.altoparlanti : conf.altoparlanti;
    if (avviso.quando === "orario") {
      if (!avviso.giorni.includes(data.getDay())) continue;
      const [ore, minuti] = avviso.ora.split(":").map(Number);
      const allOra = new Date(data);
      allOra.setHours(ore, minuti, 0, 0);
      const dopo = adesso - allOra.getTime();
      if (dopo < 0 || dopo > RITARDO_MASSIMO || memoria.detti[avviso.id] === oggi) continue;
      memoria.detti[avviso.id] = oggi;
      fuori.push({ avviso, altoparlanti });
      continue;
    }
    if (!avviso.entita) continue;
    /* Gli stati come li tiene il ponte (una Map) o come oggetto. */
    const uno =
      typeof stati?.get === "function" ? stati.get(avviso.entita) : stati?.[avviso.entita];
    const stato = uno?.state;
    const vero =
      stato !== undefined && stato !== "unavailable" && condizioneDellAvviso(avviso, stato);
    if (!vero) {
      /* Tornata com'era: la prossima volta si ridice. */
      delete memoria.veroDa[avviso.id];
      delete memoria.detti[avviso.id];
      continue;
    }
    memoria.veroDa[avviso.id] ??= adesso;
    if (memoria.detti[avviso.id]) continue;
    if (adesso - memoria.veroDa[avviso.id] < avviso.per * 60 * 1000) continue;
    if (nelSilenzio(conf.silenzio, data)) continue;
    memoria.detti[avviso.id] = true;
    fuori.push({ avviso, altoparlanti });
  }
  for (const id of Object.keys(memoria.detti)) if (!vivi.has(id)) delete memoria.detti[id];
  for (const id of Object.keys(memoria.veroDa)) if (!vivi.has(id)) delete memoria.veroDa[id];
  return fuori;
}
