/* La plancia a muro: un tablet fisso, una schermata sola, comandi grandi.
 *
 * «Creami una plancia prettamente per dispositivi a muro: minimal, con comandi
 * ben precisi.» Non e' un'altra plancia da riempire da capo: e' una plancia
 * della casa che si accende «a muro» dal suo config, e che le cose — stanze,
 * luci, clima, tapparelle, azioni, antifurto — le prende da un'altra plancia,
 * di solito la principale. Qui si scrive solo COSA mostrare e COME si
 * comporta: quali pagine, con quale modello, quali sei comandi.
 *
 * Questo file non tocca la pagina: legge e pulisce. Tutto quello che qui si
 * decide si prova senza browser.
 *
 * ── Perche' i comandi puntano e non copiano ─────────────────────────────────
 *
 * Un comando a muro dice «la luce `light.tavolo`», non «la luce Tavolo con la
 * sua icona e la sua stanza». Il nome, il disegno e lo stato si leggono ogni
 * volta dalla plancia di origine e da Home Assistant: rinominare la luce nella
 * principale la rinomina anche sul tablet, e una luce tolta lascia il suo
 * posto vuoto invece di comandare un'entita' che non c'e' piu'. */

export const CHIAVE_MURO = "cd_muro";

export const MODELLI = Object.freeze(["stanza", "scene", "ingresso"]);
export const PAGINE_AL_MASSIMO = 4;
export const POSTI = 6;
export const TIPI_DI_COMANDO = Object.freeze(["luce", "clima", "tapparella", "azione"]);
export const ORIENTAMENTI = Object.freeze(["auto", "orizzontale", "verticale"]);
export const TEMI = Object.freeze(["plancia", "scuro", "chiaro", "orario"]);
export const MINUTI_DI_RIPOSO = Object.freeze([1, 2, 5, 10, 30]);
export const PROFILO_DI_ORIGINE = "primary";

const testo = (valore, massimo = 80) =>
  String(valore ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, massimo);
const entita = (valore) => {
  const pulita = testo(valore, 255).toLowerCase();
  return /^[a-z_]+\.[a-z0-9_]+$/.test(pulita) ? pulita : "";
};
const ora = (valore, ripiego) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(testo(valore, 5));
  if (!m) return ripiego;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return ripiego;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
};
const scelta = (valore, ammesse, ripiego) => (ammesse.includes(valore) ? valore : ripiego);
const vero = (valore, ripiego) => (typeof valore === "boolean" ? valore : ripiego);
const profilo = (valore) => {
  const pulito = testo(valore, 64).toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(pulito) ? pulito : PROFILO_DI_ORIGINE;
};

/* Il PIN per uscire: da quattro a otto cifre, o niente. Un PIN piu' corto si
 * indovina guardando le ditate sul vetro. */
export function pinPulito(valore) {
  const cifre = String(valore ?? "").replace(/\D/g, "");
  return cifre.length >= 4 && cifre.length <= 8 ? cifre : "";
}

/** Un comando di un posto: cosa comanda, e il nome scelto per il tablet. */
export function comandoPulito(input) {
  if (!input || typeof input !== "object") return null;
  const tipo = scelta(input.tipo, TIPI_DI_COMANDO, "");
  if (!tipo) return null;
  if (tipo === "azione") {
    const azione = testo(input.azione, 80);
    if (!azione) return null;
    return { tipo, azione, nome: testo(input.nome, 40), sotto: testo(input.sotto, 80) };
  }
  const id = entita(input.entita);
  if (!id) return null;
  return { tipo, entita: id, nome: testo(input.nome, 40) };
}

/* Una scena: un'azione della plancia di origine, col nome e il disegno da
 * mostrare sul tablet. */
function scenaPulita(input) {
  const comando = comandoPulito({ ...input, tipo: "azione" });
  if (!comando) return null;
  return { ...comando, disegno: testo(input?.disegno, 32) };
}

const INGRESSO_VUOTO = Object.freeze({
  centrale: "",
  telecamera: "",
  apri: "",
  apri2: "",
  esco: "",
  rientro: "",
  persone: true,
  finestre: true,
});

function ingressoPulito(input = {}) {
  const dentro = input && typeof input === "object" ? input : {};
  return {
    centrale: entita(dentro.centrale),
    telecamera: entita(dentro.telecamera),
    apri: entita(dentro.apri),
    apri2: entita(dentro.apri2),
    esco: testo(dentro.esco, 80),
    rientro: testo(dentro.rientro, 80),
    persone: vero(dentro.persone, INGRESSO_VUOTO.persone),
    finestre: vero(dentro.finestre, INGRESSO_VUOTO.finestre),
  };
}

const RIGA_PIENA = Object.freeze({ clima: true, antifurto: true, persone: true, meteo: true });

let contatore = 0;
const nuovoId = () => `p${Date.now().toString(36)}${(contatore++).toString(36)}`;

/** Una pagina del tablet. */
export function paginaPulita(input, indice = 0) {
  const dentro = input && typeof input === "object" ? input : {};
  const modello = scelta(dentro.modello, MODELLI, "stanza");
  const id = /^[a-z0-9-]{1,24}$/.test(String(dentro.id || "")) ? dentro.id : `p${indice + 1}`;
  const comandi = (Array.isArray(dentro.comandi) ? dentro.comandi : [])
    .map(comandoPulito)
    .filter(Boolean)
    .slice(0, POSTI);
  const scene = (Array.isArray(dentro.scene) ? dentro.scene : [])
    .map(scenaPulita)
    .filter(Boolean)
    .slice(0, POSTI);
  const riga = { ...RIGA_PIENA };
  if (dentro.riga && typeof dentro.riga === "object")
    for (const chiave of Object.keys(RIGA_PIENA))
      riga[chiave] = vero(dentro.riga[chiave], RIGA_PIENA[chiave]);
  return {
    id,
    modello,
    titolo: testo(dentro.titolo, 32),
    stanza: testo(dentro.stanza, 80),
    /* `scelti` dice se i comandi li ha scelti qualcuno. Finche' e' falso la
     * pagina segue la stanza: una luce aggiunta nella principale compare da
     * sola sul tablet. */
    scelti: vero(dentro.scelti, comandi.length > 0),
    comandi,
    scene,
    riga,
    ingresso: ingressoPulito(dentro.ingresso),
    confermaUscita: vero(dentro.confermaUscita, false),
  };
}

export const MURO_VUOTO = Object.freeze({
  attiva: false,
  fonte: PROFILO_DI_ORIGINE,
  orientamento: "auto",
  tema: "plancia",
  riposo: { attivo: true, minuti: 2 },
  notte: { attiva: false, da: "23:00", a: "06:30" },
  avvisi: true,
  risveglio: { attivo: false, entita: "" },
  blocco: { attivo: false, pin: "" },
  pagine: [],
});

/** Il config a muro pulito, da qualunque cosa ci sia in memoria. */
export function muroPulito(input) {
  let dentro = input;
  if (typeof dentro === "string") {
    try {
      dentro = JSON.parse(dentro);
    } catch {
      dentro = null;
    }
  }
  if (!dentro || typeof dentro !== "object" || Array.isArray(dentro)) dentro = {};
  const riposo = dentro.riposo && typeof dentro.riposo === "object" ? dentro.riposo : {};
  const notte = dentro.notte && typeof dentro.notte === "object" ? dentro.notte : {};
  const risveglio =
    dentro.risveglio && typeof dentro.risveglio === "object" ? dentro.risveglio : {};
  const blocco = dentro.blocco && typeof dentro.blocco === "object" ? dentro.blocco : {};
  const minuti = Number(riposo.minuti);
  const pin = pinPulito(blocco.pin);
  const visti = new Set();
  const pagine = (Array.isArray(dentro.pagine) ? dentro.pagine : [])
    .slice(0, PAGINE_AL_MASSIMO)
    .map((pagina, i) => paginaPulita(pagina, i))
    .map((pagina, i) => {
      if (visti.has(pagina.id)) pagina = { ...pagina, id: `p${i + 1}${nuovoId()}`.slice(0, 24) };
      visti.add(pagina.id);
      return pagina;
    });
  return {
    attiva: vero(dentro.attiva, false),
    fonte: profilo(dentro.fonte),
    orientamento: scelta(dentro.orientamento, ORIENTAMENTI, "auto"),
    tema: scelta(dentro.tema, TEMI, "plancia"),
    riposo: {
      attivo: vero(riposo.attivo, true),
      minuti: MINUTI_DI_RIPOSO.includes(minuti) ? minuti : 2,
    },
    notte: {
      attiva: vero(notte.attiva, false),
      da: ora(notte.da, "23:00"),
      a: ora(notte.a, "06:30"),
    },
    avvisi: vero(dentro.avvisi, true),
    risveglio: {
      attivo: vero(risveglio.attivo, false) && Boolean(entita(risveglio.entita)),
      entita: entita(risveglio.entita),
    },
    /* Senza PIN il blocco non c'e': un tablet bloccato senza la chiave per
     * uscire e' un tablet da smontare dal muro. */
    blocco: { attivo: vero(blocco.attivo, false) && Boolean(pin), pin },
    pagine,
  };
}

/**
 * La plancia a muro appena nata, gia' accesa e gia' riempita.
 *
 * «Gestiscila tu la creazione: per default parte a muro.» Chi aggiunge una
 * plancia «a muro» dalla console non deve poi aprirne il config per vedere
 * qualcosa sul tablet: nasce con le pagine che la fonte permette. Una Stanza
 * sempre — la prima della casa, coi suoi comandi che la seguono — le Scene se
 * fra le Azioni ce n'e' almeno una, l'Ingresso se c'e' una centrale o una
 * telecamera. Le stesse proposte di chi aggiunge le pagine a mano.
 */
export function muroDiPartenza(fonte = {}) {
  const pagine = [nuovaPagina("stanza", fonte, 0)];
  if (scenePropose(fonte).length) pagine.push(nuovaPagina("scene", fonte, pagine.length));
  if (elenco(fonte.centrali).length || elenco(fonte.telecamere).length)
    pagine.push(nuovaPagina("ingresso", fonte, pagine.length));
  return muroPulito({ ...MURO_VUOTO, attiva: true, fonte: PROFILO_DI_ORIGINE, pagine });
}

/** Una pagina nuova del modello scelto, gia' pronta a mostrare qualcosa. */
export function nuovaPagina(modello, fonte = {}, indice = 0) {
  const pagina = paginaPulita({ id: nuovoId().slice(0, 24), modello }, indice);
  if (pagina.modello === "stanza") pagina.stanza = fonte.stanze?.[0]?.name || "";
  if (pagina.modello === "scene") pagina.scene = scenePropose(fonte);
  if (pagina.modello === "ingresso") pagina.ingresso = ingressoProposto(fonte);
  return pagina;
}

/* ── la fonte: le cose della plancia da cui si legge ─────────────────────── */

const json = (valore, ripiego) => {
  if (valore && typeof valore === "object") return valore;
  try {
    const letto = JSON.parse(String(valore ?? ""));
    return letto ?? ripiego;
  } catch {
    return ripiego;
  }
};
const elenco = (valore) => (Array.isArray(valore) ? valore : []);

/**
 * Le cose che servono al tablet, dai valori del config di un'altra plancia —
 * quelli che il ponte rimanda con `dashboardmodern/config/get`.
 *
 * Si leggono le sezioni dallo stato della plancia (`dm_dashboard_state`,
 * schema 4), che sono gia' pulite; le azioni, le persone e le centrali dalle
 * loro caselle.
 */
export function fonteDaiValori(valori = {}) {
  const stato = json(valori.dm_dashboard_state, {});
  const sezioni = stato?.sections && typeof stato.sections === "object" ? stato.sections : {};
  return fonteDalleSezioni(sezioni, {
    azioni: json(valori.cd_quick_actions, []),
    persone: json(valori.cd_people, []),
    centrali: json(valori.cd_centrali, []),
    overrides: json(valori.cd_entity_overrides, {}),
    avvisi: json(valori.cd_avvisi_custom, []),
  });
}

/** La stessa fonte, quando le sezioni sono gia' in mano (la plancia stessa). */
export function fonteDalleSezioni(sezioni = {}, altro = {}) {
  const dispositivi = (nome) =>
    elenco(sezioni[nome]).filter((d) => d && d.enabled !== false && entita(d.entity));
  const overrides = altro.overrides && typeof altro.overrides === "object" ? altro.overrides : {};
  const centrali = elenco(altro.centrali)
    .map((c) => entita(c?.caselle?.["dm.security_centrale_allarme"]))
    .filter(Boolean);
  const centraleSola = entita(overrides["dm.security_centrale_allarme"]);
  if (centraleSola && !centrali.includes(centraleSola)) centrali.unshift(centraleSola);
  return {
    stanze: elenco(sezioni.rooms)
      .filter((s) => s && testo(s.name))
      .map((s) => ({
        id: testo(s.id, 80),
        name: testo(s.name),
        temp: entita(s.temp),
        hum: entita(s.hum),
      })),
    luci: dispositivi("lights"),
    clima: dispositivi("climate"),
    tapparelle: dispositivi("covers"),
    telecamere: dispositivi("cameras"),
    azioni: elenco(altro.azioni)
      .filter((a) => a && testo(a.name))
      .map((a) => ({
        name: testo(a.name),
        icon: testo(a.icon, 32),
        type: testo(a.type, 16),
        entity: testo(a.entity, 255),
        builtin: testo(a.builtin, 16),
        confirm: a.confirm === true,
        option: testo(a.option, 80),
      })),
    persone: elenco(altro.persone)
      .filter((p) => p && entita(p.entity) && p.nascosta !== true)
      .map((p) => ({ entity: entita(p.entity), name: testo(p.name) })),
    centrali,
    avvisi: elenco(altro.avvisi)
      .map((a) => ({
        name: testo(a?.name, 60),
        icon: testo(a?.icon, 16),
        entita: elenco(a?.entities?.length ? a.entities : [a?.entity])
          .map(entita)
          .filter(Boolean),
        cond: scelta(a?.cond, ["on", "off", "eq", "neq", "gt", "lt"], "on"),
        value: testo(a?.value, 40),
      }))
      .filter((a) => a.entita.length),
  };
}

const ACCESI = new Set(["on", "open", "opening", "unlocked", "detected", "wet", "home", "true"]);

/* Un avviso personalizzato della plancia di origine e' acceso? La stessa
 * regola del Quadro Avvisi: basta un'entita' che la rispetti. */
function avvisoAcceso(avviso, stati = {}) {
  return avviso.entita.some((id) => {
    const stato = String(stati[id]?.state ?? "").toLowerCase();
    if (!stato || stato === "unavailable" || stato === "unknown") return false;
    const numero = Number(stato);
    const soglia = Number(avviso.value);
    if (avviso.cond === "on") return ACCESI.has(stato);
    if (avviso.cond === "off") return !ACCESI.has(stato);
    if (avviso.cond === "eq") return stato === avviso.value.toLowerCase();
    if (avviso.cond === "neq") return stato !== avviso.value.toLowerCase();
    if (!Number.isFinite(numero) || !Number.isFinite(soglia)) return false;
    return avviso.cond === "gt" ? numero > soglia : numero < soglia;
  });
}

/** Gli avvisi da mostrare sul riposo: quelli accesi, e l'antifurto che suona. */
export function avvisiAccesi(fonte = {}, stati = {}, centrale = "") {
  const accesi = elenco(fonte.avvisi)
    .filter((a) => avvisoAcceso(a, stati))
    .map((a) => ({
      chiave: a.entita[0],
      testo: a.name || a.entita[0],
      icon: a.icon,
      grave: false,
    }));
  const allarme = entita(centrale) || elenco(fonte.centrali)[0] || "";
  if (allarme && String(stati[allarme]?.state) === "triggered")
    accesi.unshift({ chiave: allarme, testo: "", icon: "", grave: true });
  return accesi;
}

const diStanza = (dispositivo, stanza) =>
  Boolean(stanza) &&
  (dispositivo.room === stanza.name ||
    dispositivo.room === stanza.id ||
    (stanza.id && dispositivo.room_id === stanza.id));

/* Le azioni che sembrano della stanza: il nome della stanza nel nome
 * dell'azione («Cinema soggiorno»), o le scene in generale se di quelle della
 * stanza non ce n'e'. */
function azioniDellaStanza(fonte, stanza) {
  const azioni = elenco(fonte.azioni).filter((a) => eUnaScena(a));
  const nome = String(stanza?.name || "").toLowerCase();
  const sue = nome ? azioni.filter((a) => a.name.toLowerCase().includes(nome)) : [];
  return sue.length ? sue : azioni.filter((a) => a.type === "scene" || a.type === "script");
}

/**
 * I comandi che una stanza propone da sola: prima le luci, poi il clima e le
 * tapparelle, poi le sue azioni. Sei posti, come la griglia.
 */
export function comandiProposti(fonte = {}, nomeStanza = "") {
  const stanza =
    elenco(fonte.stanze).find((s) => s.name === nomeStanza || s.id === nomeStanza) || null;
  if (!stanza) return [];
  const proposti = [
    ...elenco(fonte.luci)
      .filter((d) => diStanza(d, stanza))
      .map((d) => ({ tipo: "luce", entita: d.entity, nome: "" })),
    ...elenco(fonte.clima)
      .filter((d) => diStanza(d, stanza))
      .map((d) => ({ tipo: "clima", entita: d.entity, nome: "" })),
    ...elenco(fonte.tapparelle)
      .filter((d) => diStanza(d, stanza))
      .map((d) => ({ tipo: "tapparella", entita: d.entity, nome: "" })),
  ];
  /* Le azioni riempiono i posti che restano, almeno due se ci stanno. */
  const liberi = Math.max(POSTI - proposti.length, Math.min(2, POSTI));
  const azioni = azioniDellaStanza(fonte, stanza)
    .slice(0, liberi)
    .map((a) => ({ tipo: "azione", azione: a.name, nome: "", sotto: "" }));
  return [...proposti.slice(0, POSTI - azioni.length), ...azioni]
    .map(comandoPulito)
    .filter(Boolean)
    .slice(0, POSTI);
}

/** I comandi che la pagina mostra adesso: quelli scelti, o quelli proposti. */
export function comandiDellaPagina(pagina, fonte = {}) {
  if (!pagina) return [];
  return pagina.scelti ? pagina.comandi : comandiProposti(fonte, pagina.stanza);
}

/* Un'azione che il tablet sa far partire da solo: le scene, gli script, i
 * tasti e gli interruttori. I pannelli gia' pronti della plancia (le luci, il
 * clima…) e i gruppi di luci aprono una finestra della plancia, e a muro non
 * ci sono. */
export function eUnaScena(azione) {
  return (
    Boolean(azione) && !["builtin", "luci_group"].includes(azione.type) && Boolean(azione.entity)
  );
}

/* Le scene proposte: le azioni che il tablet sa far partire. */
export function scenePropose(fonte = {}) {
  return elenco(fonte.azioni)
    .filter(eUnaScena)
    .slice(0, POSTI)
    .map((a) => scenaPulita({ azione: a.name }))
    .filter(Boolean);
}

const cercaAzione = (fonte, ...parole) =>
  elenco(fonte.azioni).find((a) => parole.some((p) => a.name.toLowerCase().includes(p)))?.name ||
  "";

export function ingressoProposto(fonte = {}) {
  return ingressoPulito({
    centrale: elenco(fonte.centrali)[0] || "",
    telecamera: elenco(fonte.telecamere)[0]?.entity || "",
    esco: cercaAzione(fonte, "esco", "uscita", "leave", "away"),
    rientro: cercaAzione(fonte, "rientro", "arrivo", "torno", "home"),
  });
}

/* ── il tempo: riposo, notte, tema ───────────────────────────────────────── */

const minutiDa = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};

/** Se adesso e' notte per il tablet. La fascia puo' scavalcare la mezzanotte. */
export function eNotte(muro, adesso = new Date()) {
  if (!muro?.notte?.attiva) return false;
  const da = minutiDa(muro.notte.da);
  const a = minutiDa(muro.notte.a);
  const qui = adesso.getHours() * 60 + adesso.getMinutes();
  if (da === a) return false;
  return da < a ? qui >= da && qui < a : qui >= da || qui < a;
}

/**
 * Il tema da usare: quello della plancia, uno fisso, o «con l'orario» —
 * chiaro dalle sette alle diciannove, scuro il resto.
 */
export function temaDelMomento(muro, adesso = new Date(), temaDellaPlancia = "dark") {
  const tema = muro?.tema || "plancia";
  if (tema === "scuro") return "dark";
  if (tema === "chiaro") return "light";
  if (tema === "orario") {
    const h = adesso.getHours();
    return h >= 7 && h < 19 ? "light" : "dark";
  }
  return temaDellaPlancia === "light" ? "light" : "dark";
}

/** Orizzontale o verticale, per questo schermo e questa scelta. */
export function verso(muro, larghezza, altezza) {
  if (muro?.orientamento === "orizzontale") return "orizzontale";
  if (muro?.orientamento === "verticale") return "verticale";
  return Number(larghezza) >= Number(altezza) ? "orizzontale" : "verticale";
}

/* La misura su cui sono disegnate le pagine. Lo schermo vero si riempie
 * tutto: la griglia si allunga o si allarga, e i testi crescono col lato
 * corto, cosi' un 7" resta leggibile e un 15" non diventa un cartellone. */
export const MISURA = Object.freeze({
  orizzontale: { larghezza: 1280, altezza: 800 },
  verticale: { larghezza: 800, altezza: 1280 },
});

/* Gli schermi piccoli — un NSPanel Pro da 4,7" o quello quadrato da 4" —
 * non sono un tablet rimpicciolito: la griglia da tablet ci entrerebbe solo
 * con le scritte a cinque pixel. Sotto i seicento pixel sul lato corto il
 * pannello passa alla forma compatta: tessere grandi con un tocco solo, e il
 * resto nella finestra che si apre. */
export const LATO_COMPATTO = 600;
export function eCompatto(larghezza, altezza) {
  return Math.min(Number(larghezza) || 0, Number(altezza) || 0) < LATO_COMPATTO;
}

export function scala(versoScelto, larghezza, altezza) {
  if (eCompatto(larghezza, altezza)) {
    const s = Math.min(Number(larghezza), Number(altezza)) / 420;
    return Number.isFinite(s) && s > 0 ? Math.max(0.75, Math.min(s, 1.4)) : 1;
  }
  const base = MISURA[versoScelto] || MISURA.orizzontale;
  const s = Math.min(Number(larghezza) / base.larghezza, Number(altezza) / base.altezza);
  return Number.isFinite(s) && s > 0 ? Math.max(0.45, Math.min(s, 1.6)) : 1;
}

/** Il PIN scritto e' quello giusto? Un muro senza blocco si apre sempre. */
export function pinGiusto(muro, scritto) {
  if (!muro?.blocco?.attivo) return true;
  return String(scritto ?? "") === muro.blocco.pin;
}
