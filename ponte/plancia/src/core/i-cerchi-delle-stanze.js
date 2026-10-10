/* I cerchi del flusso Energia, per stanza.
 *
 * «Nella sezione carichi, se sono impostati gli elettrodomestici, in
 * automatico deve creare i flussi — istantanea, giornaliera e mensile — con
 * le stanze. Ogni elettrodomestico è associato a una stanza: cerchio Cucina,
 * e dietro tutti gli elettrodomestici di Cucina. Fuori, la somma è il totale
 * del cerchio. L'unico che resta sempre fuori è la Wallbox, perché ha un suo
 * popup.»
 *
 * Il modulo e' puro: prende i carichi e gli elettrodomestici come sono
 * scritti, e le stanze della casa, e torna i carichi e gli elettrodomestici
 * come il flusso li deve leggere. Non scrive niente: la configurazione resta
 * quella dell'utente, e i cerchi delle stanze esistono solo a schermo — un
 * elettrodomestico aggiunto domani in Cucina entra nel suo cerchio senza
 * altro da fare.
 *
 * Le regole, nell'ordine:
 *
 *  · Senza elettrodomestici, o senza nessuno che abbia una stanza, non cambia
 *    niente: il flusso resta quello dei carichi scritti a mano.
 *  · La Wallbox resta un cerchio a se', con quello che le e' stato messo
 *    dentro.
 *  · Ogni altro carico entra nella stanza che porta scritta (`room_id`), o in
 *    «Altro». Un carico che fa da gruppo — un cerchio con dentro dei
 *    dispositivi — non entra lui: entrano i suoi dispositivi, perche' il suo
 *    numero e' gia' la loro somma e si conterebbe due volte.
 *  · Ogni elettrodomestico entra nella sua stanza, o in «Altro».
 *  · Un elettrodomestico che legge la stessa potenza di un carico scritto a
 *    mano e' lo stesso apparecchio: si tiene l'elettrodomestico, che ha la sua
 *    stanza e la sua scheda.
 *  · I cerchi sono al massimo quanti ne disegna il flusso: le stanze che non
 *    ci stanno finiscono in «Altro».
 */

/* Quanti cerchi stanno sotto Casa: e' il tetto di `flowStageLoads`. */
export const CERCHI_AL_MASSIMO = 8;

/* Il prefisso dei cerchi delle stanze, e quello di «Altro». */
export const PREFISSO_DELLA_STANZA = "stanza-";
export const CERCHIO_ALTRO = "stanza-altro";

const pulito = (valore) => (valore == null ? "" : String(valore).trim());

const WALLBOX_NOME = /wallbox|colonnina|ev[ _-]?charger|car[ _-]?charger/i;

/** La Wallbox: dichiarata, seminata, o riconosciuta dalle entita' dell'auto. */
export function eLaWallbox(carico = {}, entitaDellaWallbox = []) {
  if (pulito(carico?.metadata?.flow_kind) === "ev") return true;
  if (pulito(carico?.id) === "load-wallbox") return true;
  const note = new Set((entitaDellaWallbox || []).map(pulito).filter(Boolean));
  if (note.size)
    for (const campo of [
      "power_entity",
      "daily_energy_entity",
      "monthly_energy_entity",
      "total_energy_entity",
      "history_entity",
    ])
      if (pulito(carico?.[campo]) && note.has(pulito(carico[campo]))) return true;
  return WALLBOX_NOME.test(pulito(carico?.name));
}

const gruppoDi = (voce) => pulito(voce?.metadata?.beta27_subload_group);
const gruppoDelCerchio = (carico) => pulito(carico?.metadata?.flow_group) || pulito(carico?.id);

/* Un elettrodomestico conta se c'e' qualcosa da leggere. */
function misurabile(voce) {
  return Boolean(
    pulito(voce?.power_entity) ||
    pulito(voce?.power) ||
    pulito(voce?.daily_energy_entity) ||
    pulito(voce?.daily) ||
    pulito(voce?.monthly_energy_entity) ||
    pulito(voce?.monthly) ||
    pulito(voce?.total_energy_entity) ||
    pulito(voce?.history_entity),
  );
}

const potenzaDi = (voce) => pulito(voce?.power_entity) || pulito(voce?.power);

/* La stanza di una voce, fra quelle della casa: per id, o per nome come la
 * scriveva il guscio vecchio. */
function stanzaDi(voce, stanze) {
  const scritte = [voce?.room_id, voce?.roomId, voce?.room].map(pulito).filter(Boolean);
  if (!scritte.length) return null;
  for (const scritta of scritte) {
    const minuscola = scritta.toLowerCase();
    const trovata = stanze.find(
      (stanza) => stanza.id === scritta || stanza.nome.toLowerCase() === minuscola,
    );
    if (trovata) return trovata;
  }
  return null;
}

function elencoDelleStanze(stanze = []) {
  return (Array.isArray(stanze) ? stanze : [])
    .map((stanza, indice) => ({
      id: pulito(stanza?.id) || pulito(stanza?.room_id) || `room-${indice}`,
      nome: pulito(stanza?.name) || pulito(stanza?.nome),
      icona: pulito(stanza?.icon),
      indice,
    }))
    .filter((stanza) => stanza.nome);
}

const conIlGruppo = (voce, gruppo, extra = {}) => ({
  ...voce,
  ...extra,
  metadata: { ...(voce?.metadata || {}), beta27_subload_group: gruppo },
});

/**
 * I carichi e gli elettrodomestici come il flusso li legge, per stanza.
 *
 * Torna `{ loads, appliances, perStanza }`. Con `perStanza: false` i due
 * elenchi sono quelli ricevuti, tali e quali.
 */
export function cerchiDelleStanze({
  loads = [],
  appliances = [],
  rooms = [],
  entitaDellaWallbox = [],
  altro = "Altro",
} = {}) {
  const carichi = (Array.isArray(loads) ? loads : []).filter(Boolean);
  const apparecchi = (Array.isArray(appliances) ? appliances : []).filter(Boolean);
  const misurati = apparecchi.filter(misurabile);
  if (!misurati.length) return { loads: carichi, appliances: apparecchi, perStanza: false };

  const stanze = elencoDelleStanze(rooms);
  /* Le stanze si fanno cerchi quando gli elettrodomestici le portano: se
   * nessuno ha una stanza della casa, non c'e' niente per cui raggrupparli, e
   * il flusso resta quello dei carichi — coi gruppi fatti a mano. */
  if (!misurati.some((voce) => stanzaDi(voce, stanze)))
    return { loads: carichi, appliances: apparecchi, perStanza: false };
  const cerchi = carichi.filter(
    (carico) => !gruppoDi(carico) && carico.category !== "manual-report",
  );
  const wallbox = cerchi.filter((carico) => eLaWallbox(carico, entitaDellaWallbox));
  const gruppiDellaWallbox = new Set(wallbox.map(gruppoDelCerchio));
  const gruppiDiCarichi = new Set(cerchi.map(gruppoDelCerchio));
  /* Un carico che fa da gruppo: qualcuno ce l'ha scritto dentro. */
  const pieni = new Set(
    [...carichi, ...apparecchi].map(gruppoDi).filter((gruppo) => gruppiDiCarichi.has(gruppo)),
  );

  /* Chi va nelle stanze: i carichi senza dispositivi, i dispositivi dei
   * carichi-gruppo, e tutti gli elettrodomestici — tranne quel che e' della
   * Wallbox. */
  const carichiDaSistemare = [];
  for (const carico of carichi) {
    if (carico.category === "manual-report") continue;
    const suo = gruppoDi(carico);
    if (suo) {
      if (gruppiDellaWallbox.has(suo)) continue;
      carichiDaSistemare.push(carico);
      continue;
    }
    if (wallbox.includes(carico)) continue;
    if (pieni.has(gruppoDelCerchio(carico))) continue;
    if (misurabile(carico)) carichiDaSistemare.push(carico);
  }
  const apparecchiDaSistemare = apparecchi.filter(
    (voce) => !gruppiDellaWallbox.has(gruppoDi(voce)) && misurabile(voce),
  );
  /* Lo stesso apparecchio scritto due volte: vince l'elettrodomestico. */
  const potenzeDegliApparecchi = new Set(apparecchiDaSistemare.map(potenzaDi).filter(Boolean));
  const carichiSenzaDoppi = carichiDaSistemare.filter(
    (carico) => !potenzaDi(carico) || !potenzeDegliApparecchi.has(potenzaDi(carico)),
  );

  /* Le stanze che hanno qualcosa, nell'ordine della casa. */
  const perStanza = new Map();
  const metti = (voce, tipo) => {
    const stanza = stanzaDi(voce, stanze);
    const chiave = stanza ? stanza.id : "";
    if (!perStanza.has(chiave)) perStanza.set(chiave, { stanza, carichi: [], apparecchi: [] });
    perStanza.get(chiave)[tipo].push(voce);
  };
  for (const voce of apparecchiDaSistemare) metti(voce, "apparecchi");
  for (const voce of carichiSenzaDoppi) metti(voce, "carichi");

  const conStanza = [...perStanza.values()]
    .filter((gruppo) => gruppo.stanza)
    .sort((a, b) => a.stanza.indice - b.stanza.indice);
  const posti = Math.max(1, CERCHI_AL_MASSIMO - wallbox.length);
  const senzaStanza = perStanza.get("") || { stanza: null, carichi: [], apparecchi: [] };
  /* Se le stanze sono piu' dei posti, l'ultimo posto e' «Altro» e raccoglie
   * quelle che non ci stanno. */
  const serveAltro = senzaStanza.carichi.length + senzaStanza.apparecchi.length > 0;
  const tenute = conStanza.length + (serveAltro ? 1 : 0) > posti ? posti - 1 : conStanza.length;
  const inAltro = {
    carichi: [...senzaStanza.carichi],
    apparecchi: [...senzaStanza.apparecchi],
  };
  for (const gruppo of conStanza.slice(tenute)) {
    inAltro.carichi.push(...gruppo.carichi);
    inAltro.apparecchi.push(...gruppo.apparecchi);
  }

  const nuoviCarichi = [];
  const ritaggati = new Map();
  let ordine = 0;
  for (const carico of wallbox) nuoviCarichi.push({ ...carico, order: ordine++ });
  /* I dispositivi della Wallbox restano suoi. */
  for (const carico of carichi)
    if (gruppiDellaWallbox.has(gruppoDi(carico))) nuoviCarichi.push(carico);

  const cerchio = (id, nome, icona, gruppo) => {
    nuoviCarichi.push({
      id,
      name: nome,
      icon: icona || "mdi:home",
      order: ordine++,
      show_in_dashboard: true,
      metadata: { flow_group: id, cerchio_della_stanza: true },
    });
    for (const carico of gruppo.carichi)
      nuoviCarichi.push(conIlGruppo(carico, id, { show_in_dashboard: false }));
    for (const voce of gruppo.apparecchi) ritaggati.set(voce, conIlGruppo(voce, id));
  };
  for (const gruppo of conStanza.slice(0, tenute))
    cerchio(
      `${PREFISSO_DELLA_STANZA}${gruppo.stanza.id}`,
      gruppo.stanza.nome,
      gruppo.stanza.icona,
      gruppo,
    );
  if (inAltro.carichi.length || inAltro.apparecchi.length)
    cerchio(CERCHIO_ALTRO, altro, "mdi:home-outline", inAltro);

  /* Gli elettrodomestici restano tutti, nel loro ordine: quelli sistemati col
   * gruppo della loro stanza, gli altri — della Wallbox, o senza niente da
   * leggere — com'erano. */
  const nuoviApparecchi = apparecchi.map((voce) => ritaggati.get(voce) || voce);
  return { loads: nuoviCarichi, appliances: nuoviApparecchi, perStanza: true };
}
