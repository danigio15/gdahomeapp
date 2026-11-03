/* I consumi di un climatizzatore, trovati da soli.
 *
 * «Continua a non funzionare, i dati storici non mi da il valore.» Quattro
 * split senza valvola e senza la casella del consumo: per i mesi passati il
 * report sapeva solo la temperatura, e le ore restavano «—». Eppure molti
 * climatizzatori i loro watt li pubblicano gia' — le integrazioni di
 * Daikin, Midea, Gree, LG, Samsung, Tuya hanno un sensore di potenza o di
 * energia sullo **stesso dispositivo** del `climate` — e Home Assistant ne
 * tiene le statistiche per sempre. Bastava andarli a prendere.
 *
 * Le regole, e sono decisioni:
 *
 *  - **solo lo stesso dispositivo.** Il registro delle entita' dice di chi e'
 *    ogni entita' (`device_id`); un sensore di un altro dispositivo — la presa
 *    della lavatrice, il contatore di casa — non e' mai del climatizzatore,
 *    anche se sta nella stessa stanza. Una presa smart sotto lo split la
 *    conosce solo chi l'ha montata: si scrive nella casella «Entita' consumo»
 *    della sua scheda, e quella vince sempre su quello che si trova qui;
 *  - **solo sensori con le statistiche.** Senza `state_class` Home Assistant
 *    non tiene le medie d'ora, e un sensore che non ha passato non serve al
 *    report: la potenza vuole `measurement`, l'energia `total` o
 *    `total_increasing`;
 *  - **prima la potenza, poi l'energia.** Dai watt si sa quanto di ogni ora
 *    e' stato acceso (media e massimo); dall'energia solo se in quell'ora ha
 *    consumato. Fra due della stessa specie vince quello che nel nome dice
 *    di esserlo («power», «potenza», «consumo»), poi l'ordine alfabetico,
 *    cosi' la scelta e' sempre la stessa.
 *
 * Puro: entrano la mappa entita' → dispositivo (la stessa di
 * `i-dispositivi-di-home-assistant.js`, e del ponte in `registri.js`) e un
 * modo di leggere lo stato di un'entita'. Esce `{ entity, tipo }` o `null`.
 */

const pulito = (valore) => String(valore ?? "").trim();
const minuscolo = (valore) => pulito(valore).toLowerCase();

const UNITA_DI_POTENZA = new Set(["w", "kw"]);
const UNITA_DI_ENERGIA = new Set(["wh", "kwh", "mwh"]);
const CLASSI_DELL_ENERGIA = new Set(["total", "total_increasing"]);

/* Le parole che dicono «sono io la potenza del climatizzatore». */
const PAROLE_GIUSTE = /\b(power|potenza|consumo|consumption|energy|energia|watt)\b/;
/* Un costo non e' un consumo, anche se ha la state_class giusta. */
const PAROLE_SBAGLIATE = /\b(cost|costo|price|prezzo)\b/;
/* Un contatore del giorno riparte a mezzanotte: va bene (Home Assistant ne
 * conta la variazione d'ora anche attraverso la ripartenza), ma se c'e' quello
 * di sempre si prende quello. Ieri non e' un consumo di adesso. */
const DEL_GIORNO = /\b(today|oggi|daily|giornalier[ao])\b/;
const DI_IERI = /\b(yesterday|ieri)\b/;

const parole = (id, attributi) =>
  ` ${[id.split(".").slice(1).join("."), attributi?.friendly_name]
    .map(minuscolo)
    .join(" ")
    .replaceAll(/[_\-./]+/g, " ")} `;

/**
 * Che consumo e' quell'entita': `"potenza"`, `"energia"` o `""`.
 *
 * Guarda l'unita' di misura, la `device_class` e la `state_class`: senza
 * quest'ultima non ci sono statistiche, e per il report non e' niente.
 */
export function tipoDelConsumo(stato) {
  const attributi = stato?.attributes || {};
  const unita = minuscolo(attributi.unit_of_measurement);
  const classe = minuscolo(attributi.device_class);
  const statistica = minuscolo(attributi.state_class);
  if ((classe === "power" || UNITA_DI_POTENZA.has(unita)) && statistica === "measurement")
    return "potenza";
  if ((classe === "energy" || UNITA_DI_ENERGIA.has(unita)) && CLASSI_DELL_ENERGIA.has(statistica))
    return "energia";
  return "";
}

/**
 * Il sensore di consumo dello stesso dispositivo del climatizzatore, o `null`.
 *
 * `di` e' la mappa entita' → dispositivo; `stato(id)` dice lo stato di
 * un'entita' (`{ state, attributes }`), o `null`.
 */
export function consumoDelDispositivo(entity, { di = {}, stato = () => null } = {}) {
  const id = pulito(entity);
  const suo = pulito(di?.[id]);
  if (!id || !suo) return null;
  const candidati = [];
  for (const [altra, dispositivo] of Object.entries(di || {})) {
    if (altra === id || pulito(dispositivo) !== suo) continue;
    if (!altra.startsWith("sensor.")) continue;
    const letto = stato(altra);
    const tipo = tipoDelConsumo(letto);
    if (!tipo) continue;
    const dette = parole(altra, letto?.attributes);
    if (PAROLE_SBAGLIATE.test(dette) || DI_IERI.test(dette)) continue;
    candidati.push({
      entity: altra,
      tipo,
      peso:
        (tipo === "potenza" ? 10 : 0) +
        (PAROLE_GIUSTE.test(dette) ? 1 : 0) -
        (DEL_GIORNO.test(dette) ? 2 : 0),
    });
  }
  candidati.sort((x, y) => y.peso - x.peso || x.entity.localeCompare(y.entity));
  const scelto = candidati[0];
  return scelto ? { entity: scelto.entity, tipo: scelto.tipo } : null;
}

/**
 * Le unita' del clima col loro consumo: quello scritto nella scheda, se c'e';
 * altrimenti quello trovato sul dispositivo, segnato `consumoTrovato`.
 *
 * Si trova per l'entita' del climatizzatore com'e' in Home Assistant: chi
 * chiama la passa gia' risolta. Chi ha gia' scritto il suo consumo non viene
 * toccato.
 */
export function conIlConsumoTrovato(unita = [], { di = {}, stato = () => null } = {}) {
  return (unita || []).map((u) => {
    if (pulito(u?.consumo)) return u;
    const trovato = consumoDelDispositivo(u?.entity, { di, stato });
    if (!trovato) return u;
    return { ...u, consumo: trovato.entity, consumoTrovato: true, consumoTipo: trovato.tipo };
  });
}
