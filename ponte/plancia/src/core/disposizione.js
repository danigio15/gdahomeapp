/* La disposizione delle sezioni: in che ordine stanno le cose, quali non si
 * vedono, quali stanno larghe.
 *
 * «Devi farlo ovunque, anche per l'Auto, per il solare termico, ovunque, e
 * capisci poi come salvare realmente quella visuale.» Le tessere della Home
 * si riordinavano gia', i blocchi della Home e le stanze anche, ognuno con la
 * sua casella. Il resto della plancia no: l'ordine dei riquadri dell'Auto, del
 * solare termico, dell'Energia, le luci dentro una stanza — scritto nel
 * codice, uguale per tutti.
 *
 * Qui c'e' una casella sola per tutto il resto, `cd_disposizione`, che
 * viaggia col ponte come le altre scelte della casa:
 *
 *     { "<elenco>": { ordine: [id…], nascosti: [id…], misure: { id: "larga" } } }
 *
 * Un «elenco» e' una cosa che si riordina: i blocchi di una pagina
 * (`ev`, `boiler`…) o gli elementi dentro un blocco (`luci:stanza-cucina`).
 * Gli id sono quelli che la pagina da' alle sue voci (vedi
 * `sections/disposizione-section.js`): qui non si sa niente di pagine, si fanno
 * solo i conti, cosi' si provano senza un browser.
 *
 * Le regole sono quelle che servono a una plancia che cambia versione:
 *   - una voce nuova (che nella scelta salvata non c'e') va al posto che ha di
 *     serie, fra le vicine che aveva intorno, non in fondo a caso;
 *   - una voce sparita si ignora, e la scelta resta per quando torna;
 *   - «Ripristina» toglie la scelta: senza scelta la pagina e' com'e' sempre
 *     stata, e niente si tocca.
 */

export const CHIAVE_DISPOSIZIONE = "cd_disposizione";

/** Le misure che una voce puo' avere. «normale» e' quella di serie: non si
 * scrive. */
export const MISURE = Object.freeze(["normale", "larga"]);

const ID_BUONO = /^[^\s"<>]{1,160}$/;

const pulita = (lista) => [
  ...new Set(
    (Array.isArray(lista) ? lista : [])
      .map((voce) => String(voce ?? "").trim())
      .filter((voce) => ID_BUONO.test(voce)),
  ),
];

/** Una scelta letta da fuori, rimessa in forma: niente doppioni, niente
 * spazzatura, solo misure che esistono. */
export function sceltaPulita(scelta) {
  const grezza = scelta && typeof scelta === "object" ? scelta : {};
  const ordine = pulita(grezza.ordine);
  const nascosti = pulita(grezza.nascosti);
  const misure = {};
  for (const [id, misura] of Object.entries(grezza.misure || {})) {
    if (ID_BUONO.test(id) && MISURE.includes(misura) && misura !== "normale") misure[id] = misura;
  }
  return { ordine, nascosti, misure };
}

/** Tutta la casella, rimessa in forma. */
export function disposizionePulita(tutta) {
  const fuori = {};
  if (!tutta || typeof tutta !== "object" || Array.isArray(tutta)) return fuori;
  for (const [elenco, scelta] of Object.entries(tutta)) {
    if (!ID_BUONO.test(elenco)) continue;
    const pulito = sceltaPulita(scelta);
    if (pulito.ordine.length || pulito.nascosti.length || Object.keys(pulito.misure).length)
      fuori[elenco] = pulito;
  }
  return fuori;
}

/** L'ordine in cui vanno le voci che la pagina ha adesso (`diSerie`, nel loro
 * ordine di serie) secondo la scelta salvata.
 *
 * Quelle della scelta vanno nell'ordine della scelta; una voce nuova si
 * infila dopo la voce che le stava subito prima di serie (o in cima, se di
 * serie era la prima): cosi' un riquadro che una versione nuova aggiunge non
 * finisce in fondo alla pagina, ma vicino a quelli con cui e' nato. */
export function ordineConLaScelta(diSerie, scelta) {
  const voci = pulita(diSerie);
  const { ordine } = sceltaPulita(scelta);
  const ci = new Set(voci);
  const fila = ordine.filter((id) => ci.has(id));
  const messe = new Set(fila);
  voci.forEach((id, i) => {
    if (messe.has(id)) return;
    let dopo = -1;
    for (let j = i - 1; j >= 0; j -= 1) {
      const k = fila.indexOf(voci[j]);
      if (k >= 0) {
        dopo = k;
        break;
      }
    }
    fila.splice(dopo + 1, 0, id);
    messe.add(id);
  });
  return fila;
}

/** Come stanno le voci: in fila, con chi non si vede e chi sta largo. */
export function disposizioneDelleVoci(diSerie, scelta) {
  const pulito = sceltaPulita(scelta);
  const nascosti = new Set(pulito.nascosti);
  return ordineConLaScelta(diSerie, pulito).map((id) => ({
    id,
    nascosto: nascosti.has(id),
    misura: pulito.misure[id] || "normale",
  }));
}

/** Se una scelta, per queste voci, non cambia niente rispetto alla serie. */
export function eComeDiSerie(diSerie, scelta) {
  const voci = pulita(diSerie);
  const pulito = sceltaPulita(scelta);
  const fila = ordineConLaScelta(voci, pulito);
  const ci = new Set(voci);
  return (
    fila.every((id, i) => id === voci[i]) &&
    !pulito.nascosti.some((id) => ci.has(id)) &&
    !Object.keys(pulito.misure).some((id) => ci.has(id))
  );
}

/** La casella con la scelta di un elenco scritta — o tolta, se la scelta e'
 * quella di serie. Le voci che la pagina non ha adesso, ma che la scelta
 * conosceva, restano nella scelta: tornano al loro posto quando tornano. */
export function conLaScelta(tutta, elenco, scelta, diSerie = null) {
  const fuori = disposizionePulita(tutta);
  if (!ID_BUONO.test(String(elenco || ""))) return fuori;
  const pulito = sceltaPulita(scelta);
  if (Array.isArray(diSerie) && eComeDiSerie(diSerie, pulito)) {
    delete fuori[elenco];
    return fuori;
  }
  if (!pulito.ordine.length && !pulito.nascosti.length && !Object.keys(pulito.misure).length) {
    delete fuori[elenco];
    return fuori;
  }
  const prima = fuori[elenco];
  if (prima && Array.isArray(diSerie)) {
    /* Le voci che ora non ci sono, ma che la scelta di prima metteva da
     * qualche parte: restano accanto a quella che le precedeva. */
    const ora = new Set(pulita(diSerie));
    const ordine = [...pulito.ordine];
    prima.ordine.forEach((id, i) => {
      if (ora.has(id) || ordine.includes(id)) return;
      const davanti = prima.ordine[i - 1];
      const k = davanti ? ordine.indexOf(davanti) : -1;
      ordine.splice(k + 1, 0, id);
    });
    pulito.ordine = ordine;
    for (const id of prima.nascosti)
      if (!ora.has(id) && !pulito.nascosti.includes(id)) pulito.nascosti.push(id);
    for (const [id, misura] of Object.entries(prima.misure))
      if (!ora.has(id) && !(id in pulito.misure)) pulito.misure[id] = misura;
  }
  fuori[elenco] = pulito;
  return fuori;
}

/** La casella senza la scelta di un elenco: «Ripristina». */
export function senzaLaScelta(tutta, elenco) {
  const fuori = disposizionePulita(tutta);
  delete fuori[elenco];
  return fuori;
}

/** La pagina di un elenco: la chiave comincia sempre col suo nome, poi
 * `:` (un elenco dentro un blocco), `@` (una vista della pagina) o `/` (un
 * elenco dentro una carta). */
export function paginaDellElenco(elenco) {
  return String(elenco || "").split(/[:@/>]/)[0];
}

/** La casella senza tutte le scelte di una pagina (l'elenco dei blocchi e
 * quelli dentro): «Ripristina la pagina». */
export function senzaLaPagina(tutta, pagina) {
  const fuori = disposizionePulita(tutta);
  for (const elenco of Object.keys(fuori))
    if (paginaDellElenco(elenco) === pagina) delete fuori[elenco];
  return fuori;
}

/** Le pagine che hanno una disposizione salvata, nell'ordine in cui
 * compaiono, con quanti elenchi sono cambiati e quante voci sono nascoste:
 * l'elenco «Disposizioni salvate» del Config. */
export function pagineCambiate(tutta) {
  const pagine = new Map();
  for (const [elenco, scelta] of Object.entries(disposizionePulita(tutta))) {
    const pagina = paginaDellElenco(elenco);
    if (!pagina) continue;
    const riga = pagine.get(pagina) || { pagina, elenchi: 0, nascosti: 0 };
    riga.elenchi += 1;
    riga.nascosti += scelta.nascosti?.length || 0;
    pagine.set(pagina, riga);
  }
  return [...pagine.values()];
}

/* ── gli id delle voci ──────────────────────────────────────────────────── */

/** Un pezzo di id leggibile da un testo: minuscolo, senza accenti, coi
 * trattini. */
export function pezzoDiId(testo, massimo = 40) {
  return String(testo ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, massimo)
    .replace(/-+$/, "");
}

const ENTITA = /\b([a-z_]{2,30}\.[a-z0-9_]{1,120})\b/;
const DOMINI = new Set([
  "light",
  "switch",
  "sensor",
  "binary_sensor",
  "climate",
  "cover",
  "camera",
  "media_player",
  "lock",
  "fan",
  "vacuum",
  "scene",
  "script",
  "automation",
  "input_boolean",
  "input_number",
  "input_select",
  "number",
  "select",
  "button",
  "water_heater",
  "humidifier",
  "person",
  "device_tracker",
  "alarm_control_panel",
  "weather",
  "calendar",
  "todo",
  "valve",
  "update",
  "event",
  "siren",
  "lawn_mower",
]);

/** L'entita' di Home Assistant che una voce porta scritta da qualche parte:
 * negli attributi (`data-entity`, un `onclick` con `toggle('light.cucina')`).
 * E' l'id piu' stabile che ci sia: la stessa luce resta la stessa luce. */
export function entitaNelTesto(testo) {
  const scritto = String(testo ?? "");
  const tutte = scritto.match(new RegExp(ENTITA.source, "g")) || [];
  return tutte.find((uno) => DOMINI.has(uno.split(".")[0])) || "";
}

/** Le classi che dicono come sta una voce, non chi e': non servono a
 * riconoscerla, e cambiano mentre la si guarda. */
const DI_STATO =
  /^(active|on|off|open|closed|is-|has-|dm-acces|dm-spent|dm-on|dm-off|acces|spent|selected|hidden|visible|show|hide|loading|empty|vuot|aperta|chiusa|dm-presa|dm-fa-posto|dm-disp)/i;

/** La classe che dice cos'e' una voce: la prima che non parla del suo
 * stato. */
export function classeDiCosa(classi) {
  return (
    String(classi ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .find((classe) => !DI_STATO.test(classe)) || ""
  );
}

/** L'id di una voce, da quello che la pagina le ha scritto addosso.
 *
 * In ordine di fiducia: un id dichiarato (`data-dm-blocco`), l'id
 * dell'elemento, un'entita' di Home Assistant, un `data-*` che sembra un
 * nome, il titolo scritto, la classe. Due voci che verrebbero uguali si
 * distinguono col numero d'ordine fra le uguali. */
export function idDellaVoce({
  dichiarato = "",
  id = "",
  attributi = "",
  dati = [],
  titolo = "",
  classi = "",
} = {}) {
  if (dichiarato) return String(dichiarato);
  if (id && !/^\d/.test(id) && !/[0-9a-f]{8,}/i.test(id)) return `#${id}`;
  const entita = entitaNelTesto(attributi);
  if (entita) return entita;
  for (const valore of dati) {
    const pezzo = pezzoDiId(valore, 60);
    if (pezzo && pezzo.length >= 2) return `=${pezzo}`;
  }
  const cosa = classeDiCosa(classi);
  const nome = pezzoDiId(titolo, 32);
  if (nome) return `${cosa ? `${cosa}~` : ""}${nome}`;
  return cosa ? `.${cosa}` : "";
}

/** Gli id di una fila di voci, resi unici: la seconda uguale prende «·2». */
export function idUnici(ids) {
  const visti = new Map();
  return ids.map((id) => {
    const base = id || "voce";
    const n = (visti.get(base) || 0) + 1;
    visti.set(base, n);
    return n === 1 ? base : `${base}·${n}`;
  });
}
