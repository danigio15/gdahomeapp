/* La valvola dell'acqua di casa: com'e' adesso, e come si apre e si chiude.
 *
 * «Sarebbe comodo avere il tasto per aprire e chiudere la valvola dell'acqua
 * nella tessera allagamenti» (#495).
 *
 * La finestra degli Allagamenti la valvola la mostrava gia', ma solo quella che
 * Home Assistant dichiara da se': un `valve.*` di classe `water`. E' la meno
 * comune delle tre strade che ci sono davvero in casa:
 *
 *  - un `valve.*` che la classe non la dice (tante integrazioni la lasciano
 *    vuota, e una valvola d'irrigazione e' un `valve.*` come lei);
 *  - un `switch.*`, quando la valvola e' un motore comandato da un rele';
 *  - un `input_boolean.*`, quando in mezzo c'e' un'automazione che fa il resto.
 *
 * Indovinare quale delle valvole di casa sia «quella dell'acqua» non si puo':
 * la si sceglie. Qui ci sono le regole — cosa si puo' scegliere, come si legge
 * lo stato, quale servizio la apre e quale la chiude — e niente DOM.
 *
 * ── Acceso vuol dire chiusa ─────────────────────────────────────────────
 *
 * Un rele' non dice se la valvola e' aperta: dice se e' eccitato. Le valvole
 * di sicurezza si montano spesso «normalmente aperte», e allora il rele'
 * acceso e' l'acqua CHIUSA. Non c'e' un modo di saperlo da fuori, e sbagliare
 * vuol dire un tasto «Chiudi» che apre: la scelta e' di chi configura, con la
 * spunta `inverti`. Su un `valve.*` la spunta non conta, perche' la valvola lo
 * dice con le sue parole.
 *
 * ── In movimento ───────────────────────────────────────────────────────
 *
 * Una valvola motorizzata ci mette dieci, venti secondi a chiudersi, e un rele'
 * puo' non rispondere subito. Fra il tocco e il nuovo stato la tessera non deve
 * restare ferma su «Aperta»: si ricorda il comando (`attesa`) e dice «In
 * chiusura» finche' lo stato vero non arriva, o finche' non e' passato troppo
 * tempo per crederci ancora.
 */

/** Dove si scrive la scelta. */
export const CHIAVE_VALVOLA_ACQUA = "cd_valvola_acqua";

/** I domini che possono essere una valvola dell'acqua. */
export const DOMINI_DELLA_VALVOLA = Object.freeze(["valve", "switch", "input_boolean"]);

/* Quanto si crede a un comando senza risposta. Una valvola a sfera motorizzata
 * ne impiega una ventina; oltre il minuto il comando e' andato perso, e dire
 * ancora «In chiusura» sarebbe dire il falso. */
export const ATTESA_MASSIMA_MS = 60_000;

/* Un nome e' un nome: il tetto c'e' perche' sta su una riga della finestra. */
const NOME_AL_MASSIMO = 40;

const pulito = (valore) => String(valore ?? "").trim();
const dominio = (entity) => pulito(entity).split(".")[0];

/** Se questa entita' si puo' scegliere come valvola dell'acqua. */
export function puoEssereLaValvola(entity) {
  const id = pulito(entity);
  return /^[a-z0-9_]+\.[a-z0-9_]+$/i.test(id) && DOMINI_DELLA_VALVOLA.includes(dominio(id));
}

/**
 * La scelta, ripulita: `{ entity, nome, inverti }`, con `entity` vuoto quando
 * non c'e' niente di scelto. Si accetta anche l'entita' scritta nuda, che e'
 * quello che uno scriverebbe a mano.
 */
export function normalizzaValvolaDellAcqua(stored) {
  const dato =
    typeof stored === "string"
      ? { entity: stored }
      : stored && typeof stored === "object" && !Array.isArray(stored)
        ? stored
        : {};
  const entity = pulito(dato.entity);
  if (!puoEssereLaValvola(entity)) return { entity: "", nome: "", inverti: false };
  return {
    entity,
    nome: pulito(dato.nome).slice(0, NOME_AL_MASSIMO),
    /* Solo dove conta: su un `valve.*` la spunta resterebbe scritta senza
     * fare niente, e la prossima lettura la troverebbe a dire una cosa falsa. */
    inverti: dominio(entity) !== "valve" && dato.inverti === true,
  };
}

/* Le parole di Home Assistant per una valvola, tradotte nelle quattro di qui. */
const DA_VALVE = Object.freeze({
  open: "aperta",
  opening: "in-apertura",
  closed: "chiusa",
  closing: "in-chiusura",
});

/**
 * Lo stato della valvola: `"aperta"`, `"chiusa"`, `"in-apertura"`,
 * `"in-chiusura"` oppure `"muta"` quando non risponde (o non c'e').
 *
 * `attesa` e' il comando appena mandato, `{ verso: "apertura"|"chiusura", da }`:
 * finche' lo stato vero non e' arrivato dove il comando voleva — e non e'
 * passato `ATTESA_MASSIMA_MS` — la valvola e' «in movimento» verso di li'.
 * Uno stato vero che dice gia' «in chiusura» vince sull'attesa: lo dice lei.
 */
export function statoDellaValvola(
  entity,
  stato,
  { inverti = false, attesa = null, adesso = Date.now() } = {},
) {
  const grezzo = pulito(stato?.state).toLowerCase();
  let vero = "muta";
  if (stato && dominio(entity) === "valve") vero = DA_VALVE[grezzo] || "muta";
  else if (stato && (grezzo === "on" || grezzo === "off")) {
    const acceso = grezzo === "on";
    vero = acceso !== Boolean(inverti) ? "aperta" : "chiusa";
  }
  if (!attesa || !attesaValida(attesa, adesso)) return vero;
  const meta = attesa.verso === "chiusura" ? "chiusa" : "aperta";
  if (vero === meta || vero.startsWith("in-")) return vero;
  return attesa.verso === "chiusura" ? "in-chiusura" : "in-apertura";
}

/** Se un comando mandato e' ancora da aspettare. */
export function attesaValida(attesa, adesso = Date.now()) {
  const da = Number(attesa?.da);
  if (!Number.isFinite(da)) return false;
  if (attesa?.verso !== "chiusura" && attesa?.verso !== "apertura") return false;
  return adesso - da >= 0 && adesso - da < ATTESA_MASSIMA_MS;
}

/** Se lo stato vero e' arrivato dove il comando voleva: l'attesa si puo' dimenticare. */
export function attesaArrivata(attesa, statoVero) {
  if (!attesa) return true;
  return attesa.verso === "chiusura" ? statoVero === "chiusa" : statoVero === "aperta";
}

/** Se l'acqua passa, o sta per passare: e' la valvola che, con una perdita, va chiusa. */
export const acquaCheScorre = (statoValvola) =>
  statoValvola === "aperta" || statoValvola === "in-apertura";

/**
 * Il servizio che apre (`"apri"`) o chiude (`"chiudi"`) la valvola, come
 * `{ domain, service, data }`.
 *
 * Su un rele' si accende e si spegne, e la spunta `inverti` scambia i due: con
 * la valvola normalmente aperta, chiudere l'acqua vuol dire accendere.
 */
export function comandoDellaValvola(entity, azione, { inverti = false } = {}) {
  const id = pulito(entity);
  const d = dominio(id);
  if (!puoEssereLaValvola(id) || (azione !== "apri" && azione !== "chiudi")) return null;
  const apri = azione === "apri";
  if (d === "valve")
    return {
      domain: "valve",
      service: apri ? "open_valve" : "close_valve",
      data: { entity_id: id },
    };
  const accendi = apri !== Boolean(inverti);
  return { domain: d, service: accendi ? "turn_on" : "turn_off", data: { entity_id: id } };
}

/* Una valvola che Home Assistant dichiara dell'acqua: e' quello che la finestra
 * mostrava prima che si potesse scegliere, e chi non sceglie niente continua a
 * vederlo. */
const valvolaDichiarata = (entity, stato) =>
  dominio(entity) === "valve" && pulito(stato?.attributes?.device_class).toLowerCase() === "water";

/**
 * Le valvole della finestra: quella scelta per prima, poi quelle che Home
 * Assistant dichiara dell'acqua, senza doppioni.
 *
 * Ognuna esce con quello che serve a chi la disegna e a chi la comanda:
 * `entity`, `name` (il nome scritto, poi quello di Home Assistant), `inverti`,
 * `scelta` (se l'ha scelta qualcuno) e `stato`.
 *
 * Quella scelta c'e' anche quando non risponde: e' stata scelta, e una valvola
 * che sparisce quando il rele' va offline e' proprio la cosa che non si vuole
 * scoprire con una perdita in corso. Le dichiarate invece si prendono solo se
 * Home Assistant le conosce, perche' e' da li' che vengono.
 */
export function valvoleDellAcqua(config, states = {}, { attese = {}, adesso = Date.now() } = {}) {
  const scelta = normalizzaValvolaDellAcqua(config);
  const elenco = [];
  if (scelta.entity) elenco.push({ ...scelta, scelta: true });
  for (const [entity, stato] of Object.entries(states || {})) {
    if (entity === scelta.entity || !valvolaDichiarata(entity, stato)) continue;
    elenco.push({ entity, nome: "", inverti: false, scelta: false });
  }
  return elenco.map((voce) => {
    const stato = states?.[voce.entity];
    return {
      entity: voce.entity,
      name: voce.nome || pulito(stato?.attributes?.friendly_name) || voce.entity,
      inverti: voce.inverti,
      scelta: voce.scelta,
      stato: statoDellaValvola(voce.entity, stato, {
        inverti: voce.inverti,
        attesa: attese?.[voce.entity] || null,
        adesso,
      }),
    };
  });
}

/* Le parole di Home Assistant che corrispondono ai cinque stati di qui: chi
 * legge ancora `state` come lo dice un `valve.*` — l'assistente di casa — trova
 * le stesse parole anche quando la valvola e' un rele'. */
const COME_VALVE = Object.freeze({
  aperta: "open",
  chiusa: "closed",
  "in-apertura": "opening",
  "in-chiusura": "closing",
  muta: "unavailable",
});

/** Lo stato di qui detto con le parole di un `valve.*`. */
export const statoComeValve = (statoValvola) => COME_VALVE[statoValvola] || "unavailable";
