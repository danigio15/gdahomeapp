/* La disposizione delle sezioni, sulla plancia (#379).
 *
 * «Il discorso drag & drop deve essere ovunque, non solo nei widget.» Ogni
 * pagina della plancia ha un tasto ✏️ «Modifica disposizione» (per chi puo'
 * configurare): premuto, i riquadri della pagina e gli elementi dei suoi
 * elenchi — le luci di una stanza, le telecamere, le zone — si trascinano li'
 * dove sono, col mouse o tenendo premuto col dito; l'occhio li nasconde,
 * «↔» li fa larghi. In basso una barra: «N modifiche · Annulla · Ripristina ·
 * Salva». «Salva» scrive `cd_disposizione` (vedi `core/disposizione.js`), che
 * viaggia col ponte: la pagina e' cosi' su ogni dispositivo.
 *
 * Le pagine non sanno niente di tutto questo, e non devono: la disposizione
 * si applica DOPO che hanno disegnato, a ogni ridisegno, e senza scelta
 * salvata non si tocca niente — la pagina resta com'e' sempre stata.
 *
 * Come si trovano le cose da spostare, senza che ogni pagina le dichiari:
 *   - i RIQUADRI: sotto la testata della pagina, si scende finche' c'e' un
 *     solo figlio (l'involucro, la «shell»); il primo livello con due o piu'
 *     figli visibili sono i riquadri. Un titolo (h2/h3, `.section-title`) va
 *     insieme a quello che lo segue.
 *   - gli ELENCHI: dentro un riquadro, un contenitore con due o piu' figli
 *     dello stesso tipo, alti abbastanza da essere carte (non i pallini di un
 *     grafico o i tasti di una barra).
 * Una pagina che vuole decidere da se' scrive `data-dm-blocco="id"` su un
 * riquadro o `data-dm-disposizione` su un contenitore: vince quello.
 *
 * Gli id delle voci sono quelli di `idDellaVoce`: l'entita' di Home Assistant
 * quando c'e' (la stessa luce resta la stessa luce), se no l'id, un nome, il
 * titolo scritto.
 */
import {
  CHIAVE_DISPOSIZIONE,
  conLaScelta,
  disposizioneDelleVoci,
  disposizionePulita,
  idDellaVoce,
  idUnici,
} from "../core/disposizione.js";
import { puoConfigurare } from "./la-config-e-di-chi-la-amministra-section.js";
import { STILE_RIORDINA, prendiIlPuntatore } from "./trascina-per-riordinare.js";
import { doc, esc, installStyle, readJson, root, senzaCadere, t, writeJsonIfChanged } from "./shared.js";

const KEY = "__DASHBOARDMODERN_DISPOSIZIONE__";
const state = (root[KEY] ||= {
  installed: false,
  osservatore: null,
  coda: 0,
  modifica: null,
  occupato: false,
});

/* Le pagine che hanno gia' il loro modo di riordinarsi, o che non sono
 * pagine da guardare: la Home ha le sue caselle (tessere, blocchi, stanze),
 * il Config e' il Config. */
const PAGINE_DA_SALTARE = new Set(["home", "config"]);

const TITOLO = "h1,h2,h3,h4,.section-title,.dm-sec-title";
const DATI_CHE_NOMINANO = /(^|-)(id|uid|key|entity|entita|room|stanza|zona|zone|nome|name|ref|cam|slug|chiave)$/i;
const NOSTRI = "[data-dm-disp-barra],[data-dm-disp-ctrl],[data-dm-disp-tasto]";

/* ── leggere e scrivere ─────────────────────────────────────────────────── */

function salvata() {
  return disposizionePulita(readJson(CHIAVE_DISPOSIZIONE, {}));
}

function nomeDellaPagina(pagina) {
  return String(pagina?.id || "").replace(/^page-/, "");
}

/* ── trovare le voci ────────────────────────────────────────────────────── */

function visibile(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.matches?.(`${NOSTRI},script,style,template,link,.dm-riordina-voce`)) return false;
  /* Nascosto da noi (una voce spenta, o il titolo che in modifica sta
   * sull'etichetta): c'e', e deve restare lo stesso — il nome di un elenco
   * viene anche dal titolo che lo precede. */
  if (el.hasAttribute?.("data-dm-nascosto") || el.hasAttribute?.("data-dm-disp-titolo")) return true;
  if (el.hidden) return false;
  const stile = root.getComputedStyle?.(el);
  if (!stile || stile.display === "none" || stile.visibility === "hidden") return false;
  if (stile.position === "fixed" || stile.position === "absolute") return false;
  const r = el.getBoundingClientRect?.();
  return Boolean(r && r.width > 0 && r.height > 0);
}

/* La testata di una pagina, o di un suo involucro («dm-cl-mast»): sta in cima
 * e non si sposta. */
const TESTATA = /(^|[-_\s])(page-)?mast($|[-_\s])|back-home-btn|sub-tabs|dm-stanze-indice-testa/;
function eTestata(el) {
  return TESTATA.test(typeof el?.className === "string" ? el.className : "");
}

/* Un titolo: un'intestazione, o una riga bassa che fa da testa al gruppo
 * che segue (la stanza sopra le sue luci). */
/* Anche le linguette che scelgono cosa c'e' sotto (Freddo/Caldo/Report del
 * Clima, le schede dell'Auto) stanno attaccate a quello che scelgono: un
 * riquadro di linguette da solo, spostato lontano dal suo pannello, non vuol
 * dire niente. */
const RIGA_DI_TESTA = /(^|[-_])(room|stanza|group|gruppo|head|header|testa|titolo|title|linguette|tabs|switch)($|[-_])/i;
function eTitolo(el) {
  if (el?.matches?.(TITOLO)) return true;
  const classi = typeof el?.className === "string" ? el.className : "";
  return RIGA_DI_TESTA.test(classi.split(/\s+/)[0] || "") && (el.getBoundingClientRect?.().height || 0) < 64;
}

/* Il titolo scritto di una voce: un'intestazione o un «titolo», mai un
 * valore — «67 %» cambia da un minuto all'altro, «Ricarica» no. */
function titoloDi(el) {
  const dichiarato = String(el.getAttribute?.("data-dm-disp-nome") || "").trim();
  if (dichiarato) return dichiarato.slice(0, 48);
  const testa = el.matches?.(TITOLO)
    ? el
    : [...(el.querySelectorAll?.(`${TITOLO},[class*='title'],[class*='titolo'],[class*='name'],[class*='nome'],summary`) || [])].find(
        (uno) => !dentroUnaFila(uno, el),
      );
  const testo = String(testa?.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
  return /[a-zà-ü]{3,}/i.test(testo) ? testo.replace(/[\d.,:%°]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 48) : "";
}

/* Una scritta che sta dentro una fila di carte uguali (i tasti del solare
 * termico, le luci) e' il nome di una carta, non del riquadro che le tiene:
 * «Pompa solare» non e' il nome dei comandi. */
function dentroUnaFila(nodo, fino) {
  for (let su = nodo; su && su !== fino; su = su.parentElement) {
    const padre = su.parentElement;
    if (!padre || padre === fino.parentElement) break;
    const fratelli = [...padre.children].filter((f) => f !== su && f.className && f.className === su.className);
    if (typeof su.className === "string" && su.className && fratelli.length) return true;
  }
  return false;
}

/* Le parole che le classi usano per dire cos'e' un riquadro. */
const COSA_DALLE_CLASSI = [
  [/synoptic|sinottic|schema|diagram|flow|flusso/i, () => t("Schema", "Diagram")],
  [/control|comand|action|azion|button|tasti/i, () => t("Comandi", "Controls")],
  [/chart|grafic|graph|trend|storia|history/i, () => t("Grafico", "Chart")],
  [/kpi|stats|numeri|metric/i, () => t("Numeri", "Figures")],
  [/session|sessione/i, () => t("Sessione", "Session")],
];

/* Un nome di ripiego per la maniglia: la prima scritta corta fatta di
 * parole («Autonomia»), non di numeri. */
function testoBreve(el) {
  for (const parte of el.querySelectorAll?.("strong,small,label,span,div,p") || []) {
    if (parte.children.length || dentroUnaFila(parte, el)) continue;
    const testo = String(parte.textContent || "").replace(/\s+/g, " ").trim();
    /* Parole, non misure: «Batteria telefono Persona 3» si', «9 %» no. */
    if (/[a-zà-ü]{3,}/i.test(testo) && !/^[\d.,]|[%°]/.test(testo) && testo.length <= 40) return testo;
  }
  return "";
}

function idDellElemento(el, titolo = "") {
  const attributi = [...(el.attributes || [])]
    .filter((a) => !/^(style|class|aria-|data-dm-(disp|riordina|nascosto|misura|maniglia|tieni|presa|fa-posto))/.test(a.name))
    .map((a) => `${a.name}=${a.value}`)
    .join(" ");
  const dati = [...(el.attributes || [])]
    .filter((a) => /^data-/.test(a.name) && DATI_CHE_NOMINANO.test(a.name.slice(5)) && !/^data-dm-disp/.test(a.name))
    .map((a) => a.value);
  return idDellaVoce({
    dichiarato: el.getAttribute?.("data-dm-blocco") || "",
    id: el.id || "",
    attributi,
    dati,
    titolo: titolo || titoloDi(el),
    classi: typeof el.className === "string" ? el.className : "",
  });
}

/* Le voci di un contenitore: i figli visibili, coi titoli attaccati a quello
 * che segue. Ogni voce e' `{ id, nome, el, insieme }`: `el` e' quella che si
 * prende in mano, `insieme` tutto quello che si sposta con lei. */
function vociDi(contenitore) {
  const figli = [...contenitore.children].filter((el) => visibile(el) && !eTestata(el) && !el.matches("nav"));
  const voci = [];
  for (let i = 0; i < figli.length; i += 1) {
    const el = figli[i];
    if (eTitolo(el) && figli[i + 1] && !eTitolo(figli[i + 1])) {
      const dopo = figli[i + 1];
      const nome = (dopo.getAttribute?.("data-dm-disp-nome") || "").trim() || titoloDi(el);
      voci.push({ id: idDellElemento(dopo, nome), nome, el: dopo, insieme: [el, dopo] });
      i += 1;
      continue;
    }
    voci.push({ id: idDellElemento(el), nome: titoloDi(el), el, insieme: [el] });
  }
  const unici = idUnici(voci.map((v) => v.id));
  voci.forEach((voce, i) => {
    voce.id = unici[i];
    voce.vuoto = eVuoto(voce.el);
    if (!voce.nome) voce.nome = nomeDiRipiego(voce.el, contenitore, i);
    /* «Luci» dentro la pagina Luci non dice quale riquadro: e' il riepilogo. */
    const pagina = titoloDellaPagina(contenitore);
    if (pagina && !voce.el.hasAttribute("data-dm-disp-nome") && voce.nome.toLowerCase() === pagina.toLowerCase())
      voce.nome = t(`Riepilogo ${pagina}`, `${pagina} summary`);
  });
  return voci;
}

/* Una voce che adesso non ha niente da mostrare (un riquadro che si riempie
 * solo in carica): niente scritte, niente immagini. */
function eVuoto(el) {
  const testo = [...el.childNodes]
    .filter((n) => !(n.nodeType === 1 && n.matches?.(NOSTRI)))
    .map((n) => n.textContent || "")
    .join("")
    .trim();
  return !testo && !el.querySelector?.("img,svg,canvas,video,picture,input,select,button:not([data-dm-disp-ctrl] *)");
}

/* Il titolo della pagina, per dare un nome ai riquadri che non ne hanno. */
function titoloDellaPagina(el) {
  const pagina = el.closest?.("section.page");
  const testa = pagina?.querySelector?.(".dm-page-mast h1,.dm-page-mast h2,[class*='mast'] h1,h1");
  const scritto = String(testa?.textContent || "").replace(/\s+/g, " ").trim();
  if (!scritto) return "";
  return scritto.charAt(0).toUpperCase() + scritto.slice(1).toLowerCase();
}

/* Un nome vero anche per chi non ha titolo: l'etichetta che la pagina gli
 * ha dato, una scritta corta, «Riepilogo …» per la carta in cima, e solo per
 * ultimo «Riquadro N». */
function nomeDiRipiego(el, contenitore, i) {
  const dato = el.getAttribute?.("aria-label") || el.getAttribute?.("title") || el.getAttribute?.("data-title") || "";
  /* «Ultime 24 ore · Finestra cucina»: il nome e' l'ultimo pezzo. */
  const ultimo = dato.split(" · ").pop().trim();
  if (/[a-zà-ü]{3,}/i.test(ultimo)) return ultimo.slice(0, 48);
  const classi = typeof el.className === "string" ? el.className : "";
  const pagina = titoloDellaPagina(contenitore);
  if (/(^|[-_\s])(hero|summary|riepilogo|overview)($|[-_\s])/i.test(classi) && pagina)
    return t(`Riepilogo ${pagina}`, `${pagina} summary`);
  for (const [prova, nome] of COSA_DALLE_CLASSI) if (prova.test(classi)) return nome();
  const breve = testoBreve(el);
  if (breve) return breve;
  return t(`Riquadro ${i + 1}`, `Box ${i + 1}`);
}

function testataDi(pagina) {
  return pagina.querySelector?.(":scope > .dm-page-mast");
}

/* Il contenitore dei riquadri: sotto la testata, giu' per gli involucri.
 * Se lungo la discesa si passa per una «vista» — un figlio scelto fra
 * fratelli che adesso non si vedono, come le linguette dell'Energia — la
 * vista entra nel nome: ogni vista ha la sua disposizione. */
function contenitoreDeiRiquadri(pagina) {
  const nome = nomeDellaPagina(pagina);
  const dichiarato = pagina.querySelector?.(`[data-dm-disposizione="${nome}"]`);
  if (dichiarato) return { contenitore: dichiarato, chiave: nome };
  let qui = pagina;
  let vista = "";
  for (let giro = 0; giro < 6; giro += 1) {
    const tutti = [...qui.children].filter((el) => !eTestata(el) && !el.matches("nav,script,style,template"));
    const figli = tutti.filter(visibile);
    /* Un figlio che fa quasi tutta la pagina, accanto a strisce sottili (la
     * scelta dell'auto sopra la sua scheda): i riquadri sono dentro di lui. */
    const altezze = figli.map((el) => el.getBoundingClientRect().height);
    const grande = altezze.indexOf(Math.max(...altezze, 0));
    const resto = altezze.reduce((a, h, i) => (i === grande ? a : a + h), 0);
    const selettore = (el) =>
      Boolean(el.querySelector?.("select,nav,[role=tablist]")) ||
      /picker|selettore|tabs|(^|[-_\s])(head|header|testa|intestazione)($|[-_\s])/i.test(String(el.className || el.id));
    const dominante =
      figli.length >= 2 &&
      altezze[grande] > 2 * resto &&
      figli.every((el, i) => i === grande || (altezze[i] < Math.max(120, altezze[grande] / 4) && selettore(el)));
    if (figli.length >= 2 && !dominante) return { contenitore: qui, chiave: vista ? `${nome}@${vista}` : nome };
    if (!figli.length) return null;
    const giu = dominante ? figli[grande] : figli[0];
    if (tutti.length > 1 && giu.id && !dominante) vista = giu.id;
    qui = giu;
  }
  return null;
}

/* Un contenitore e' un elenco se ha almeno due figli dello stesso tipo, e
 * sono carte: alti abbastanza da toccarli, non pallini o tasti. */
function eUnElenco(el) {
  if (!el || el.matches?.("svg,canvas,select,ul.sub-tabs,[role=tablist],nav,form")) return false;
  const figli = [...el.children].filter(visibile);
  if (figli.length < 2) return false;
  const tipi = new Map();
  for (const figlio of figli) {
    if (/^(BUTTON|SPAN|I|B|SVG|INPUT|LABEL|A|IMG)$/.test(figlio.tagName)) return false;
    const r = figlio.getBoundingClientRect();
    if (!figlio.hasAttribute("data-dm-nascosto") && (r.height < 36 || r.width < 60)) return false;
    const cosa = String(figlio.className || "").split(/\s+/)[0] || figlio.tagName;
    tipi.set(cosa, (tipi.get(cosa) || 0) + 1);
  }
  const piuComune = Math.max(...tipi.values());
  return piuComune >= 2 && piuComune / figli.length >= 0.75;
}

function elenchiDentro(riquadro, prefisso, fuori, profondita = 0) {
  if (profondita > 5) return;
  for (const figlio of riquadro.children) {
    if (!visibile(figlio) || figlio.matches(NOSTRI)) continue;
    if (eUnElenco(figlio) || figlio.hasAttribute("data-dm-disposizione")) {
      const quale = figlio.getAttribute("data-dm-disposizione") || idDellElemento(figlio, "") || "elenco";
      /* `/` e non `>`: una chiave con `>` non passa da `disposizionePulita`, e
       * la scelta di questi elenchi si perdeva al salvataggio. */
      fuori.push({ chiave: `${prefisso}/${quale}`, contenitore: figlio, riquadri: false });
      continue; /* dentro una carta non si cercano altri elenchi */
    }
    elenchiDentro(figlio, prefisso, fuori, profondita + 1);
  }
}

/* I riquadri dichiarati, pagina per pagina: un id che non cambia se cambia
 * il titolo (o la lingua) e un nome tradotto. Il riconoscimento automatico
 * resta il ripiego per tutto quello che qui non c'e'. Prima gli id venivano
 * dal titolo scritto — «sessione-ricarica» — e in inglese la stessa carta
 * avrebbe avuto un altro id, e perso il suo posto. */
const DICHIARATI = Object.freeze([
  ["ev", "#lm-hero-card", "auto", "La mia auto", "My car"],
  ["ev", ".dm-evv-power", "batteria", "Batteria", "Battery"],
  ["ev", ".dm-termica", "temperature", "Temperature", "Temperatures"],
  ["ev", "#lm-session-card,.lm-session-card", "sessione", "Sessione di ricarica", "Charging session"],
  ["ev", ".lm-session-grid", "sessione-numeri", "Numeri della sessione", "Session figures"],
  ["boiler", ".synoptic-stage", "schema", "Schema dell'impianto", "System diagram"],
  ["boiler", ".b-controls-grid", "comandi", "Comandi", "Controls"],
  ["luci", ".dm-lucip-hero", "riepilogo", "Riepilogo luci", "Lights summary"],
  ["energy", ".ed-kpi-banner", "numeri", "Numeri del periodo", "Period figures"],
  ["energy", "#ed-year-summary", "anno", "Riepilogo dell'anno", "Year summary"],
  ["energy", ".ed-fin-grid", "conti", "Conti", "Money"],
  ["energy", ".ed-auto-row", "autosufficienza", "Autosufficienza", "Self-sufficiency"],
  ["energy", ".ed-chart-card", "andamento", "Andamento giornaliero", "Daily trend"],
  ["ev", ".dm-na-eroe", "auto", "La mia auto", "My car"],
  ["ev", ".dm-na-pannello", "dettagli", "Dettagli", "Details"],
  ["appliances-main", ".dm-appl-side", "consumi", "Consumi", "Consumption"],
  ["appliances-main", ".dm-appl-main", "elettrodomestici", "Elettrodomestici", "Appliances"],
  ["temp", "#temp-grid", "stanze", "Stanze", "Rooms"],
  ["temp", "#dm-temperature-trend", "andamento", "Andamento", "Trend"],
  ["meteo", ".dm-meteo-posto", "adesso", "Adesso", "Now"],
  ["media", ".dm-radio", "radio", "Radio", "Radio"],
  ["media", ".dm-mp-wrap", "lettori", "Lettori", "Players"],
  ["tapparelle", ".dm-tapp-hero", "riepilogo", "Riepilogo finestre", "Windows summary"],
  ["varchi", ".dm-varchi-testa", "adesso", "In questo momento", "Right now"],
  ["varchi", ".dm-varchi-elenco", "elenco", "Porte e finestre", "Doors and windows"],
  ["presenza", ".dm-presenza-testa", "adesso", "In questo momento", "Right now"],
  ["presenza", ".dm-presenza-elenco", "elenco", "Sensori di presenza", "Presence sensors"],
  ["batterie", ".dm-batt-testa", "adesso", "In questo momento", "Right now"],
  ["batterie", ".dm-batt-elenco", "elenco", "Batterie", "Batteries"],
  ["piscina", ".dm-pool-stage", "vasca", "Piscina", "Pool"],
  ["piscina", ".dm-pool-tiles", "comandi", "Comandi", "Controls"],
  ["piscina", ".dm-pool-cards", "schede", "Qualità e filtrazione", "Quality and filtration"],
  ["robot", ".dm-robot-map", "mappa", "Mappa", "Map"],
  ["robot", ".dm-robot-meta", "stato", "Stato", "State"],
  ["robot", ".dm-robot-actions", "comandi", "Comandi", "Controls"],
  ["security", "#alarm-stage", "antifurto", "Antifurto", "Alarm"],
  ["security", ".dm-sec-smoke", "fumo", "Rilevatori di fumo", "Smoke detectors"],
  ["security", ".dm-sec-cctv", "telecamere", "Telecamere", "Cameras"],
  ["server", ".dm-srvx-shell", "server", "Server", "Servers"],
  ["server", "#dm-macchine-fasce", "macchine", "Macchine virtuali", "Virtual machines"],
  ["calendario", ".dm-calp-fascia", "giorni", "Giorni", "Days"],
  ["calendario", ".dm-calp-legenda", "legenda", "Legenda", "Legend"],
  ["calendario", ".dm-calp-nuovo-riga", "nuovo", "Nuovo evento", "New event"],
  ["calendario", ".dm-calp-agenda", "agenda", "Agenda", "Calendar"],
  ["calendario", ".dm-calp-cose", "da-fare", "Da fare", "To do"],
  ["gdanav", ".dm-gn-capo", "nuovo", "Nuovo viaggio", "New trip"],
  ["gdanav", ".dm-gn-griglia", "viaggi", "Viaggi", "Trips"],
  ["automazioni", ".ad-kpi", "numeri", "Numeri", "Figures"],
]);

/* Dove stanno i riquadri, quando non e' il primo involucro che si trova
 * scendendo: la Sicurezza ha l'antifurto, il fumo e le telecamere dentro un
 * guscio solo, e il Meteo un involucro con un figlio solo per volta. */
const CONTENITORI_DICHIARATI = Object.freeze([
  ["security", ".dm-sec-shell"],
  ["meteo", "#meteo-wrap"],
]);

/* Riquadri e voci il cui id o nome si legge dalla pagina: i piani delle
 * Stanze («Piano terra», senza «3 accese» accanto, che cambia), i lettori
 * della Musica (la stanza, non il brano che suona). */
const DICHIARATI_DALLA_PAGINA = Object.freeze([
  [
    "stanze",
    ".dm-stanze-indice-griglia",
    (el) => {
      const testa = el.previousElementSibling;
      if (!testa?.matches?.(".dm-stanze-piano")) return null;
      const nome = String(testa.querySelector?.("span")?.textContent || "")
        .replace(/[^\p{L}\p{N}\s'-]/gu, "")
        .trim();
      return nome ? { id: idDellaVoce({ titolo: nome }), nome } : null;
    },
  ],
  [
    "tapparelle",
    ".dm-tapp-card",
    (el) => {
      const nome = String(el.querySelector?.(".tapp-name")?.textContent || "").trim();
      return nome ? { nome } : null;
    },
  ],
  [
    "media",
    ".dm-mp-card",
    (el) => {
      const dove = String(el.querySelector?.(".dm-mp-dove")?.textContent || "").split(" · ")[0].trim();
      return dove ? { nome: dove } : null;
    },
  ],
]);

function marcaIDichiarati(pagina, nome) {
  for (const [di, dove, id, it, en] of DICHIARATI) {
    if (di !== nome) continue;
    for (const el of pagina.querySelectorAll?.(dove) || []) {
      if (!el.hasAttribute("data-dm-blocco")) el.setAttribute("data-dm-blocco", id);
      if (!el.hasAttribute("data-dm-disp-nome")) el.setAttribute("data-dm-disp-nome", t(it, en));
    }
  }
  for (const [di, dove] of CONTENITORI_DICHIARATI) {
    if (di !== nome || pagina.querySelector?.(`[data-dm-disposizione="${nome}"]`)) continue;
    pagina.querySelector?.(dove)?.setAttribute("data-dm-disposizione", nome);
  }
  for (const [di, dove, leggi] of DICHIARATI_DALLA_PAGINA) {
    if (di !== nome) continue;
    for (const el of pagina.querySelectorAll?.(dove) || []) {
      const letto = leggi(el);
      if (letto?.id) el.setAttribute("data-dm-blocco", letto.id);
      if (letto?.nome) el.setAttribute("data-dm-disp-nome", letto.nome);
    }
  }
}

/** Tutto quello che si riordina in una pagina: i riquadri e gli elenchi. */
export function elenchiDellaPagina(pagina) {
  const nome = nomeDellaPagina(pagina);
  if (!nome || PAGINE_DA_SALTARE.has(nome)) return [];
  marcaIDichiarati(pagina, nome);
  const fuori = [];
  const trovato = contenitoreDeiRiquadri(pagina);
  if (!trovato) return fuori;
  const { contenitore, chiave } = trovato;
  fuori.push({ chiave, contenitore, riquadri: true });
  for (const voce of vociDi(contenitore)) {
    /* Un riquadro che e' gia' un elenco (la griglia delle luci di una
     * stanza): i suoi figli si riordinano li'. */
    if (eUnElenco(voce.el)) fuori.push({ chiave: `${chiave}:${voce.id}`, contenitore: voce.el, riquadri: false });
    else elenchiDentro(voce.el, `${chiave}:${voce.id}`, fuori);
  }
  /* Due elenchi con la stessa chiave nello stesso riquadro si distinguono. */
  const unici = idUnici(fuori.map((e) => e.chiave));
  fuori.forEach((e, i) => (e.chiave = unici[i]));
  return fuori;
}

/* ── applicare ──────────────────────────────────────────────────────────── */

/* Nascosto davvero: con lo stile scritto addosso, che vince anche sulle
 * regole delle pagine che dicono `display:…!important`. In modifica si vede,
 * sbiadito, per poterlo riaccendere. */
function nascondi(el, si) {
  if (si) {
    el.setAttribute("data-dm-nascosto", "");
    if (state.modifica) el.style.removeProperty("display");
    else el.style.setProperty("display", "none", "important");
  } else if (el.hasAttribute("data-dm-nascosto")) {
    el.removeAttribute("data-dm-nascosto");
    el.style.removeProperty("display");
  }
}

function applicaAlContenitore(elenco, scelta) {
  const { contenitore } = elenco;
  const voci = vociDi(contenitore);
  if (voci.length < 2) return;
  const perId = new Map(voci.map((v) => [v.id, v]));
  /* L'ordine di serie: quello in cui la pagina le ha messe l'ultima volta che
   * le ha disegnate. Se l'insieme e' cambiato, ha ridisegnato: si rilegge. */
  const firma = voci
    .map((v) => v.id)
    .sort()
    .join("|");
  if (contenitore.__dmDispFirma !== firma) {
    contenitore.__dmDispFirma = firma;
    contenitore.__dmDispSerie = voci.map((v) => v.id);
  }
  const serie = contenitore.__dmDispSerie.filter((id) => perId.has(id));
  const disposte = disposizioneDelleVoci(serie, scelta);
  const attuale = voci.map((v) => v.id);
  const voluto = disposte.map((d) => d.id);
  if (attuale.join("|") !== voluto.join("|")) {
    /* In fondo, nell'ordine voluto: chi non e' una voce (un figlio nascosto
     * dalla pagina) resta davanti, dov'era. */
    for (const id of voluto) for (const el of perId.get(id).insieme) contenitore.appendChild(el);
  }
  for (const d of disposte) {
    const voce = perId.get(d.id);
    for (const el of voce.insieme) nascondi(el, d.nascosto);
    if (d.misura === "larga") voce.el.setAttribute("data-dm-misura", "larga");
    else voce.el.removeAttribute("data-dm-misura");
  }
}

function paginaAttiva() {
  return doc?.querySelector?.("section.page.active[id^='page-'], .page.active[id^='page-']") || null;
}

/** La disposizione salvata (o la bozza, in modifica) messa sulla pagina che
 * si guarda. */
export function applicaLaDisposizione(pagina = paginaAttiva()) {
  if (!pagina || state.occupato) return;
  /* Mentre una voce e' in mano non si rimette in fila niente. */
  if (doc.documentElement.hasAttribute("data-dm-trascinando")) return inCoda();
  const tutta = salvata();
  const nome = nomeDellaPagina(pagina);
  const inModifica = state.modifica?.pagina === pagina;
  const ce = inModifica || Object.keys(tutta).some((k) => k === nome || k.startsWith(`${nome}:`));
  if (!ce) return;
  state.occupato = true;
  state.giri = (state.giri || 0) + 1;
  try {
    for (const elenco of elenchiDellaPagina(pagina)) {
      const scelta = inModifica && state.modifica.bozze.has(elenco.chiave)
        ? state.modifica.bozze.get(elenco.chiave)
        : tutta[elenco.chiave];
      if (scelta || inModifica) applicaAlContenitore(elenco, scelta || {});
    }
    if (inModifica) segnaPerLaModifica(pagina);
  } finally {
    state.osservatore?.takeRecords?.();
    state.occupato = false;
  }
}

/* Si guardano le pagine, una per una, non tutto il documento: e' li' che le
 * sezioni ridisegnano, ed e' la loro classe a dire quale si vede. Una pagina
 * nata dopo (le pagine che si aggiungono da sole) si prende al giro dopo. */
function osservaLePagine() {
  if (!state.osservatore) return;
  state.osservate ||= new WeakSet();
  for (const pagina of doc.querySelectorAll("section.page[id^='page-']")) {
    if (state.osservate.has(pagina)) continue;
    state.osservate.add(pagina);
    state.osservatore.observe(pagina, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }
}

function inCoda() {
  if (state.coda) return;
  state.coda = root.setTimeout?.(() => {
    state.coda = 0;
    osservaLePagine();
    applicaLaDisposizione();
    mettiITasti();
  }, 60);
}

/* ── la modalita' modifica ──────────────────────────────────────────────── */

function contaLaBarra() {
  return state.modifica?.barra ? 1 : 0;
}

function conta() {
  return state.modifica ? state.modifica.cambiate.size + contaLaBarra() : 0;
}

function sceltaInMano(elenco) {
  const m = state.modifica;
  if (m.bozze.has(elenco.chiave)) return m.bozze.get(elenco.chiave);
  const s = salvata()[elenco.chiave];
  return s ? { ordine: [...s.ordine], nascosti: [...s.nascosti], misure: { ...s.misure } } : { ordine: [], nascosti: [], misure: {} };
}

function controlliMarkup(voce, elenco, scelta) {
  const nascosto = scelta.nascosti.includes(voce.id);
  const larga = scelta.misure[voce.id] === "larga";
  const griglia = root.getComputedStyle?.(elenco.contenitore)?.display?.includes("grid");
  const nome = esc(voce.nome);
  /* Quello che dice come sta la voce adesso, accanto al nome: vuota o
   * nascosta si vede anche quando la carta e' sbiadita. */
  const stato = [
    voce.vuoto ? t("vuoto adesso", "empty now") : "",
    nascosto ? t("nascosto", "hidden") : "",
  ].filter(Boolean);
  const nota = stato.length ? ` <em class="dm-disp-nota">(${esc(stato.join(" · "))})</em>` : "";
  /* Le voci di un elenco si prendono tutte intere: la loro riga di strumenti
   * ha il segno «⠿» e il nome (piccolo), e l'occhio subito accanto — mai
   * sopra i comandi della carta, che restano sotto. */
  const testa = elenco.riquadri
    ? `<button type="button" class="dm-disp-maniglia" data-dm-maniglia data-dm-tieni aria-label="${esc(
        t(`Sposta ${voce.nome}`, `Move ${voce.nome}`),
      )}">⠿ <span>${nome}</span>${nota}</button>`
    : `<span class="dm-disp-segno" aria-hidden="true">⠿</span>${nota}`;
  return `${testa}
    <button type="button" class="dm-disp-occhio" data-dm-non-trascinare data-dm-disp-occhio
      aria-pressed="${!nascosto}" aria-label="${esc(nascosto ? t(`Mostra ${voce.nome}`, `Show ${voce.nome}`) : t(`Nascondi ${voce.nome}`, `Hide ${voce.nome}`))}">${nascosto ? "🙈" : "👁"}</button>${
      griglia && elenco.riquadri
        ? `<button type="button" class="dm-disp-larga" data-dm-non-trascinare data-dm-disp-larga aria-pressed="${larga}"
      aria-label="${esc(t(`Larghezza piena: ${voce.nome}`, `Full width: ${voce.nome}`))}">↔</button>`
        : ""
    }`;
}

function togliISegni(el) {
  for (const nome of [
    "data-dm-disp-voce",
    "data-dm-disp-titolo",
    "data-dm-disp-vuoto",
    "data-dm-riordina-riga",
    "data-dm-maniglia",
    "data-dm-tieni",
  ])
    el.removeAttribute(nome);
  lasciaSu(el);
  if (el.hasAttribute("data-dm-disp-tab")) {
    el.removeAttribute("data-dm-disp-tab");
    el.removeAttribute("tabindex");
    el.removeAttribute("aria-label");
  }
}

/* Lo spazio in cima per la riga degli strumenti, scritto addosso alla voce:
 * le pagine fissano il loro `padding` con regole che passano per l'id della
 * pagina (`#page-ev … !important`), e solo lo stile scritto le batte. Quello
 * che c'era prima si tiene da parte e si rimette. */
function spingiGiu(el, quanto) {
  if (!el.__dmDispPad)
    el.__dmDispPad = [el.style.getPropertyValue("padding-top"), el.style.getPropertyPriority("padding-top")];
  const ora = parseFloat(root.getComputedStyle?.(el)?.paddingTop || "0") || 0;
  el.style.setProperty("padding-top", `${Math.max(quanto, Math.round(ora) + quanto - 12)}px`, "important");
}

function lasciaSu(el) {
  const prima = el.__dmDispPad;
  if (!prima) return;
  delete el.__dmDispPad;
  if (prima[0]) el.style.setProperty("padding-top", prima[0], prima[1]);
  else el.style.removeProperty("padding-top");
}

function segnaPerLaModifica(pagina) {
  for (const vecchio of pagina.querySelectorAll("[data-dm-disp-ctrl]")) vecchio.remove();
  for (const el of pagina.querySelectorAll("[data-dm-disp-elenco]")) {
    el.removeAttribute("data-dm-disp-elenco");
    el.removeAttribute("data-dm-disp-tipo");
    el.removeAttribute("data-dm-riordina");
  }
  for (const el of pagina.querySelectorAll("[data-dm-disp-voce],[data-dm-disp-titolo]")) {
    togliISegni(el);
  }
  for (const elenco of elenchiDellaPagina(pagina)) {
    const voci = vociDi(elenco.contenitore);
    if (voci.length < 2) continue;
    const scelta = sceltaInMano(elenco);
    elenco.contenitore.setAttribute("data-dm-disp-elenco", elenco.chiave);
    elenco.contenitore.setAttribute("data-dm-disp-tipo", elenco.riquadri ? "riquadri" : "voci");
    elenco.contenitore.setAttribute("data-dm-riordina", "griglia");
    for (const voce of voci) {
      voce.el.setAttribute("data-dm-disp-voce", voce.id);
      /* Il titolo attaccato si sposta con lei, ma in modifica non si vede: il
       * suo nome e' gia' sull'etichetta, due volte sarebbe rumore. */
      for (const el of voce.insieme) if (el !== voce.el) el.setAttribute("data-dm-disp-titolo", "");
      if (voce.vuoto) voce.el.setAttribute("data-dm-disp-vuoto", "");
      voce.el.setAttribute("data-dm-riordina-riga", voce.id);
      if (!elenco.riquadri) {
        voce.el.setAttribute("data-dm-maniglia", "");
        voce.el.setAttribute("data-dm-tieni", "");
        /* Si prende anche dalla tastiera: Tab fin li', poi le frecce. */
        if (!voce.el.hasAttribute("tabindex")) voce.el.setAttribute("data-dm-disp-tab", "");
        voce.el.setAttribute("tabindex", "0");
        voce.el.setAttribute("aria-label", t(`Sposta ${voce.nome}`, `Move ${voce.nome}`));
      }
      const ctrl = doc.createElement("div");
      ctrl.setAttribute("data-dm-disp-ctrl", elenco.riquadri ? "riquadro" : "voce");
      ctrl.innerHTML = controlliMarkup(voce, elenco, scelta);
      voce.el.prepend(ctrl);
      spingiGiu(voce.el, elenco.riquadri ? 52 : 40);
    }
  }
}

/* ── la barra delle sezioni ────────────────────────────────────────────
 *
 * In modifica anche le voci della barra in basso si trascinano: l'ordine
 * e' quello di sempre, `cd_navbar_order`, lo stesso che il Config cambia con
 * le frecce. Config resta l'ultima, e una voce nascosta non si sposta. */
function laBarraDelleSezioni() {
  /* Le voci non sono figlie di `nav.tabs`: le tiene la striscia che scorre
   * (`.dm-nav-scroll`), ed e' lei che si riordina. */
  return doc.querySelector("nav.tabs .tab[data-tab]")?.parentElement || null;
}

function vociDellaBarra(barra = laBarraDelleSezioni()) {
  return [...(barra?.querySelectorAll?.(":scope > .tab[data-tab]") || [])];
}

function nascostaNellaBarra(voce) {
  if (voce.style.display === "none") return true;
  try {
    return root.getComputedStyle?.(voce)?.display === "none";
  } catch (_errore) {
    return false;
  }
}

/* Le voci rimesse nell'ordine dato, ognuna in uno dei posti che le voci
 * occupano adesso: quello che sta in mezzo (le frecce) resta dov'e'. */
function mettiLeVoci(barra, posti, nuove) {
  const segni = posti.map((voce) => {
    const segno = doc.createComment("");
    voce.replaceWith(segno);
    return segno;
  });
  segni.forEach((segno, i) => segno.replaceWith(nuove[i]));
}

function segnaLaBarra(si) {
  const barra = laBarraDelleSezioni();
  if (!barra) return;
  if (!si) {
    barra.removeAttribute("data-dm-riordina");
    barra.removeAttribute("data-dm-disp-barra-sezioni");
    for (const voce of vociDellaBarra(barra))
      for (const nome of ["data-dm-riordina-riga", "data-dm-maniglia", "data-dm-tieni"]) voce.removeAttribute(nome);
    return;
  }
  barra.setAttribute("data-dm-riordina", "griglia");
  barra.setAttribute("data-dm-disp-barra-sezioni", "");
  for (const voce of vociDellaBarra(barra)) {
    if (voce.dataset.tab === "config" || nascostaNellaBarra(voce)) continue;
    voce.setAttribute("data-dm-riordina-riga", voce.dataset.tab);
    voce.setAttribute("data-dm-maniglia", "");
    voce.setAttribute("data-dm-tieni", "");
  }
}

function ordineDellaBarra() {
  return vociDellaBarra().map((voce) => voce.dataset.tab);
}

function onRiordinaLaBarra(event) {
  const m = state.modifica;
  const barra = laBarraDelleSezioni();
  if (!m || !barra || event.target !== barra) return false;
  /* Le voci che si spostano, nell'ordine di prima. Col dito la griglia ha gia'
   * messo la voce al suo posto; dalla tastiera no: l'ordine si tiene qui e la
   * barra si rimette uguale in tutti e due i casi. */
  const mobili = m.mobili || [];
  const { da, a } = event.detail || {};
  if (!Number.isInteger(da) || !Number.isInteger(a) || !mobili[da] || a < 0 || a >= mobili.length) return true;
  const nuove = [...mobili];
  nuove.splice(a, 0, ...nuove.splice(da, 1));
  m.mobili = nuove;
  mettiLeVoci(
    barra,
    vociDellaBarra(barra).filter((voce) => voce.hasAttribute("data-dm-riordina-riga")),
    nuove,
  );
  m.barra = ordineDellaBarra();
  disegnaLaBarra();
  return true;
}

function barraMarkup() {
  const n = conta();
  /* Una vista con un riquadro solo (il flusso dell'Energia): si dice, invece
   * di lasciare a cercare cosa trascinare. */
  const niente = n === 0 && !state.modifica?.pagina?.querySelector?.("[data-dm-disp-elenco]");
  return `<div class="dm-disp-barra-dentro">
    <span class="dm-disp-conta"${n === 0 ? " data-vuota" : ""}>${esc(
      niente
        ? t("In questa vista non c'è niente da spostare", "Nothing to move in this view")
        : n === 0
        ? t("Trascina riquadri ed elementi dove li vuoi", "Drag boxes and items where you want them")
        : n === 1
          ? t("1 modifica", "1 change")
          : t(`${n} modifiche`, `${n} changes`),
    )}</span>
    <button type="button" data-dm-disp-azione="annulla">${esc(t("Annulla", "Cancel"))}</button>
    <button type="button" data-dm-disp-azione="ripristina">${esc(t("Ripristina", "Reset"))}</button>
    <button type="button" class="dm-disp-salva" data-dm-disp-azione="salva"${n === 0 ? " disabled" : ""}>${esc(
      t("Salva", "Save"),
    )}${n ? ` <b class="dm-disp-quante">· ${n}</b>` : ""}</button>
  </div>`;
}

function disegnaLaBarra() {
  let barra = doc.querySelector("[data-dm-disp-barra]");
  if (!state.modifica) {
    barra?.remove();
    return;
  }
  if (!barra) {
    barra = doc.createElement("div");
    barra.setAttribute("data-dm-disp-barra", "");
    barra.setAttribute("role", "toolbar");
    barra.setAttribute("aria-label", t("Modifica disposizione", "Edit layout"));
    doc.body.appendChild(barra);
  }
  barra.innerHTML = barraMarkup();
}

export function entraInModifica(pagina = paginaAttiva()) {
  if (!pagina || !puoConfigurare()) return;
  esciDallaModifica();
  state.modifica = { pagina, bozze: new Map(), cambiate: new Set(), barra: null };
  doc.documentElement.setAttribute("data-dm-modifica", nomeDellaPagina(pagina));
  applicaLaDisposizione(pagina);
  segnaLaBarra(true);
  state.modifica.vociDiPrima = vociDellaBarra();
  state.modifica.mobili = state.modifica.vociDiPrima.filter((voce) => voce.hasAttribute("data-dm-riordina-riga"));
  disegnaLaBarra();
}

export function esciDallaModifica() {
  const m = state.modifica;
  if (!m) return;
  state.modifica = null;
  doc.documentElement.removeAttribute("data-dm-modifica");
  segnaLaBarra(false);
  state.occupato = true;
  try {
    for (const vecchio of m.pagina.querySelectorAll("[data-dm-disp-ctrl]")) vecchio.remove();
    for (const el of m.pagina.querySelectorAll("[data-dm-disp-elenco]")) {
      el.removeAttribute("data-dm-disp-elenco");
      el.removeAttribute("data-dm-disp-tipo");
      el.removeAttribute("data-dm-riordina");
    }
    for (const el of m.pagina.querySelectorAll("[data-dm-disp-voce],[data-dm-disp-titolo]")) togliISegni(el);
  } finally {
    state.osservatore?.takeRecords?.();
    state.occupato = false;
  }
  disegnaLaBarra();
}

function elencoDi(contenitore) {
  const chiave = contenitore?.getAttribute?.("data-dm-disp-elenco");
  if (!chiave || !state.modifica) return null;
  return elenchiDellaPagina(state.modifica.pagina).find((e) => e.chiave === chiave) || null;
}

function cambiaLaBozza(elenco, muta) {
  const m = state.modifica;
  const scelta = sceltaInMano(elenco);
  const voci = vociDi(elenco.contenitore);
  scelta.ordine = voci.map((v) => v.id);
  muta(scelta, voci);
  m.bozze.set(elenco.chiave, scelta);
  m.cambiate.add(elenco.chiave);
  applicaLaDisposizione(m.pagina);
  disegnaLaBarra();
}

function onRiordina(event) {
  if (onRiordinaLaBarra(event)) return;
  const elenco = elencoDi(event.target);
  if (!elenco) return;
  const { da, a } = event.detail || {};
  cambiaLaBozza(elenco, (scelta) => {
    const [presa] = scelta.ordine.splice(da, 1);
    if (presa) scelta.ordine.splice(Math.max(0, Math.min(a, scelta.ordine.length)), 0, presa);
  });
}

function salva() {
  const m = state.modifica;
  if (!m) return;
  let tutta = salvata();
  for (const elenco of elenchiDellaPagina(m.pagina)) {
    if (!m.bozze.has(elenco.chiave)) continue;
    const serie = elenco.contenitore.__dmDispSerie || vociDi(elenco.contenitore).map((v) => v.id);
    tutta = conLaScelta(tutta, elenco.chiave, m.bozze.get(elenco.chiave), serie);
  }
  writeJsonIfChanged(CHIAVE_DISPOSIZIONE, tutta);
  if (m.barra) {
    /* Config in fondo, come vuole chi applica l'ordine. */
    const ordine = [...m.barra.filter((k) => k !== "config"), "config"];
    writeJsonIfChanged("cd_navbar_order", ordine);
    try {
      root.cdMarkDirty?.();
      root.cdSyncPush?.();
    } catch (_errore) {}
  }
  esciDallaModifica();
  applicaLaDisposizione();
  if (m.barra) root.cdApplyNavOrder?.();
}

function annulla() {
  const m = state.modifica;
  if (!m) return;
  esciDallaModifica();
  if (m.barra) {
    /* La barra com'era quando si e' entrati: senza un ordine salvato chi lo
     * applica non tocca niente, quindi si rimette da qui. */
    const barra = laBarraDelleSezioni();
    const prima = (m.vociDiPrima || []).filter((voce) => voce.parentElement === barra);
    if (barra && prima.length) mettiLeVoci(barra, vociDellaBarra(barra).filter((voce) => prima.includes(voce)), prima);
    root.cdApplyNavOrder?.();
  }
  /* La pagina torna come la vuole la scelta salvata: chi era stato spostato
   * nella bozza torna al suo posto. */
  for (const elenco of elenchiDellaPagina(m.pagina)) applicaAlContenitore(elenco, salvata()[elenco.chiave] || {});
}

function ripristina() {
  const m = state.modifica;
  if (!m) return;
  for (const elenco of elenchiDellaPagina(m.pagina)) {
    m.bozze.set(elenco.chiave, { ordine: [...(elenco.contenitore.__dmDispSerie || [])], nascosti: [], misure: {} });
    m.cambiate.add(elenco.chiave);
  }
  applicaLaDisposizione(m.pagina);
  disegnaLaBarra();
}

function onClick(event) {
  const bersaglio = event.target;
  /* Un tocco qualunque puo' aver cambiato pagina: si riguarda. */
  if (!state.modifica) inCoda();
  const tasto = bersaglio?.closest?.("[data-dm-disp-tasto]");
  if (tasto) {
    event.preventDefault();
    event.stopPropagation();
    /* In Home la disposizione e' quella delle sue caselle (tessere, blocchi,
     * stanze), con la loro anteprima nel Config: il tasto porta li'. */
    if (tasto.getAttribute("data-dm-disp-tasto") === "home") {
      root.apriConfigEntita?.();
      root.queueMicrotask?.(() => root.editorSwitch?.("todo"));
      return;
    }
    if (state.modifica) esciDallaModifica();
    else entraInModifica(tasto.closest(".page"));
    return;
  }
  const azione = bersaglio?.closest?.("[data-dm-disp-azione]")?.getAttribute("data-dm-disp-azione");
  if (azione === "salva") return salva();
  if (azione === "annulla") return annulla();
  if (azione === "ripristina") return ripristina();
  if (!state.modifica) return;
  if (bersaglio?.closest?.("[data-dm-disp-barra-sezioni] .tab")) {
    /* In modifica la barra si riordina, non si cambia pagina. */
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const pagina = state.modifica.pagina;
  if (!pagina.contains(bersaglio)) return;
  /* In modifica la pagina non si comanda: un tocco su una luce non la
   * accende. Passano solo i nostri tasti. */
  const occhio = bersaglio.closest("[data-dm-disp-occhio]");
  const larga = bersaglio.closest("[data-dm-disp-larga]");
  event.preventDefault();
  event.stopPropagation();
  if (!occhio && !larga) return;
  const voceEl = bersaglio.closest("[data-dm-disp-voce]");
  const elenco = elencoDi(voceEl?.parentElement);
  if (!voceEl || !elenco) return;
  const id = voceEl.getAttribute("data-dm-disp-voce");
  cambiaLaBozza(elenco, (scelta) => {
    if (occhio) {
      const i = scelta.nascosti.indexOf(id);
      if (i >= 0) scelta.nascosti.splice(i, 1);
      else scelta.nascosti.push(id);
    } else if (scelta.misure[id] === "larga") delete scelta.misure[id];
    else scelta.misure[id] = "larga";
  });
}

/* In modifica il puntatore e' nostro: preso in cattura, prima dei gesti
 * delle carte (una luce si regola trascinando), e passato a chi trascina. */
function onPuntatore(event) {
  if (!state.modifica) return;
  const dentro =
    state.modifica.pagina.contains(event.target) ||
    Boolean(event.target?.closest?.("[data-dm-disp-barra-sezioni] [data-dm-riordina-riga]"));
  if (event.type === "pointerdown") {
    if (!dentro || event.target.closest?.("[data-dm-non-trascinare],[data-dm-disp-barra]")) return;
    prendiIlPuntatore.giu(event);
    event.stopPropagation();
    return;
  }
  if (!prendiIlPuntatore.inMano()) return;
  if (event.type === "pointermove") prendiIlPuntatore.muovi(event);
  else if (event.type === "pointerup") prendiIlPuntatore.su(event);
  else prendiIlPuntatore.annulla(event);
  event.stopPropagation();
}

function onKeyDown(event) {
  if (event.key === "Escape" && state.modifica && !doc.documentElement.hasAttribute("data-dm-trascinando")) annulla();
}

/* ── il tasto ✏️ in testa alle pagine ───────────────────────────────────── */

function testataPerIlTasto(pagina) {
  return (
    pagina.querySelector(":scope > .dm-page-mast") ||
    [...pagina.querySelectorAll("[class*='mast']")].find((el) => eTestata(el) && visibile(el)) ||
    null
  );
}

/* ✏️ e, dove c'e' posto, la parola: «Modifica». Il suggerimento dice tutto. */
function vestiIlTasto(tasto) {
  tasto.title = t("Modifica disposizione", "Edit layout");
  tasto.setAttribute("aria-label", t("Modifica disposizione", "Edit layout"));
  tasto.innerHTML = `<span aria-hidden="true">✏️</span><span class="dm-disp-tasto-parola">${esc(t("Modifica", "Edit"))}</span>`;
}

function tastoInHome(si) {
  const casa = doc.getElementById("page-home");
  const ce = casa?.querySelector(":scope > [data-dm-disp-tasto]");
  if (!casa || !si) return ce?.remove();
  if (ce) return;
  const tasto = doc.createElement("button");
  tasto.type = "button";
  tasto.className = "dm-disp-tasto dm-disp-tasto-home";
  tasto.setAttribute("data-dm-disp-tasto", "home");
  vestiIlTasto(tasto);
  casa.prepend(tasto);
}

function mettiITasti() {
  const si = puoConfigurare();
  tastoInHome(si);
  for (const pagina of doc.querySelectorAll("section.page[id^='page-']")) {
    const testata = testataPerIlTasto(pagina);
    if (!testata) continue;
    const nome = nomeDellaPagina(pagina);
    const ce = testata.querySelector(":scope > [data-dm-disp-tasto]");
    if (!si || PAGINE_DA_SALTARE.has(nome)) {
      ce?.remove();
      continue;
    }
    if (ce) continue;
    const tasto = doc.createElement("button");
    tasto.type = "button";
    tasto.setAttribute("data-dm-disp-tasto", "");
    tasto.className = "dm-disp-tasto";
    vestiIlTasto(tasto);
    testata.appendChild(tasto);
  }
  /* Si cambia pagina con la modifica aperta: la modifica si chiude, senza
   * salvare — quello che non si e' salvato non si e' voluto. */
  if (state.modifica && !state.modifica.pagina.classList.contains("active")) annulla();
}

/* ── installare ─────────────────────────────────────────────────────────── */

const STILE = `
html[data-dm-modifica] [data-dm-disp-barra-sezioni] > .tab[data-dm-riordina-riga]{cursor:grab;outline:2px dashed color-mix(in srgb,#0ea5e9 70%,transparent);outline-offset:-4px;border-radius:14px;touch-action:none;user-select:none;-webkit-user-select:none}
/* La voce presa della barra: le voci della barra non hanno fondo (stanno
 * sulla pillola), e una voce sollevata senza fondo si confondeva con quella
 * sotto. */
html[data-dm-modifica] [data-dm-disp-barra-sezioni] > [data-dm-fantasma]{background:var(--card-bg,#fff)!important;border-radius:16px;z-index:30;opacity:1!important}
html[data-dm-modifica] [data-dm-disp-barra-sezioni] > .tab[data-dm-presa]{cursor:grabbing;background:color-mix(in srgb,#0ea5e9 12%,transparent)!important;box-shadow:none!important}
html[data-dm-modifica] [data-dm-disp-barra-sezioni] > .tab[data-dm-presa] > *{opacity:0!important}

${STILE_RIORDINA}
[data-dm-nascosto]{display:none!important}
/* In modifica un nascosto si vede sbiadito, ma la sua etichetta no: si deve
 * poter leggere per riaccenderlo. */
html[data-dm-modifica] [data-dm-nascosto]{display:revert!important}
html[data-dm-modifica] [data-dm-nascosto]>:not([data-dm-disp-ctrl]){opacity:.38;filter:grayscale(.6)}
html[data-dm-modifica] [data-dm-disp-titolo]{display:none!important}
html[data-dm-modifica] [data-dm-disp-vuoto]{min-height:56px}
/* La barra in basso non copre l'ultima riga: la pagina ha spazio sotto. */
html[data-dm-modifica] section.page.active{padding-bottom:calc(220px + env(safe-area-inset-bottom,0px))!important}
[data-dm-misura="larga"]{grid-column:1/-1!important}
.dm-page-mast{position:relative}
#page-home{position:relative}
.dm-disp-tasto-home{top:0;right:4px}
.dm-disp-tasto{position:absolute;top:12px;right:12px;z-index:3;min-width:40px;height:40px;border-radius:14px;padding:0 10px;
  border:1px solid color-mix(in srgb,var(--text,#0f172a) 12%,transparent);background:var(--card-bg,#fff);color:var(--text,#0f172a);
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  font:600 14px/1 inherit;cursor:pointer;box-shadow:0 6px 16px -10px rgba(15,23,42,.4)}
.dm-disp-tasto>span[aria-hidden]{font-size:18px}
.dm-disp-tasto-parola{display:none}
@media (min-width:720px){.dm-disp-tasto{padding:0 14px 0 12px}.dm-disp-tasto-parola{display:inline}}
html[data-dm-modifica] .dm-disp-tasto{background:var(--accent,#2563eb);color:#fff}
html[data-dm-modifica] [data-dm-disp-voce]{position:relative;outline:2px dashed color-mix(in srgb,var(--accent,#2563eb) 55%,transparent);
  outline-offset:2px;border-radius:16px}
html[data-dm-modifica] [data-dm-disp-elenco]>[data-dm-disp-voce]{cursor:grab}
/* I riquadri: la barra coi tasti sta in cima al riquadro, dentro (molte
 * carte tagliano quello che esce), e il contenuto scende di quanto serve. */
[data-dm-disp-ctrl]{position:absolute;z-index:6;display:flex;gap:6px;align-items:center}
[data-dm-disp-ctrl="riquadro"]{top:8px;left:8px;right:8px;height:36px}
/* Le voci di un elenco: una riga di strumenti sopra la carta, a sinistra —
 * il segno «⠿» e l'occhio — e la carta scende di quanto serve, cosi' i suoi
 * comandi (l'interruttore di una luce) non stanno mai sotto l'occhio. */
html[data-dm-modifica] [data-dm-disp-tipo="voci"]>[data-dm-disp-voce]{height:auto!important;min-height:0!important}
[data-dm-disp-ctrl="voce"]{top:6px;left:8px;right:8px;height:30px;gap:8px}
[data-dm-disp-ctrl="voce"] .dm-disp-segno{font:700 15px/1 inherit;color:var(--accent,#2563eb);letter-spacing:-1px}
.dm-disp-nota{font:italic 600 12px/1 inherit;opacity:.9;white-space:nowrap}
[data-dm-disp-ctrl="voce"] .dm-disp-nota{color:var(--text-dim,#64748b);margin-right:auto}
[data-dm-disp-ctrl] button{height:36px;min-width:36px;border-radius:12px;border:1px solid color-mix(in srgb,var(--text,#0f172a) 14%,transparent);
  background:var(--card-bg,#fff);color:var(--text,#0f172a);font:600 13px/1 inherit;cursor:pointer;
  box-shadow:0 4px 12px -8px rgba(15,23,42,.5);display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px}
[data-dm-disp-ctrl="voce"] button{height:28px;min-width:28px;border-radius:999px;padding:0;font-size:13px}
[data-dm-disp-ctrl] .dm-disp-maniglia[data-dm-maniglia]{margin:0 auto 0 0;cursor:grab;touch-action:none;
  width:auto;height:36px;flex:0 1 auto;max-width:min(78%,320px);
  background:var(--accent,#2563eb);border-color:transparent;color:#fff;padding:0 14px 0 10px;font-size:13px}
[data-dm-disp-ctrl] .dm-disp-maniglia[data-dm-maniglia]:hover{background:var(--accent,#2563eb);color:#fff;filter:brightness(1.08)}
[data-dm-disp-ctrl] .dm-disp-maniglia span{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
[data-dm-disp-ctrl] button[aria-pressed="true"].dm-disp-larga{background:var(--accent,#2563eb);color:#fff}
/* La barra sta sopra la barra delle sezioni, non sopra le voci. */
[data-dm-disp-barra]{position:fixed;left:50%;bottom:calc(104px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9990;
  max-width:calc(100vw - 24px);transition:opacity .15s}
/* Mentre una voce e' in mano la barra si fa da parte, e la voce passa sopra
 * a tutto: si deve vedere dove la si lascia. */
html[data-dm-trascinando] [data-dm-disp-barra]{opacity:0;pointer-events:none}
html[data-dm-modifica] [data-dm-riordina="griglia"] [data-dm-fantasma="true"]{z-index:9995!important}
html[data-dm-modifica] [data-dm-riordina="griglia"] [data-dm-fantasma="true"]>[data-dm-disp-ctrl]{width:auto!important;height:auto!important;opacity:1!important}
.dm-disp-barra-dentro{display:flex;gap:8px;align-items:center;flex-wrap:nowrap;justify-content:center;padding:8px 10px;border-radius:20px;
  background:var(--card-bg,#fff);color:var(--text,#0f172a);box-shadow:0 18px 40px -16px rgba(15,23,42,.55);
  border:1px solid color-mix(in srgb,var(--text,#0f172a) 12%,transparent)}
.dm-disp-barra-dentro .dm-disp-conta{font:600 14px/1.2 inherit;padding:0 6px}
.dm-disp-barra-dentro button{min-height:44px;padding:0 16px;border-radius:14px;border:1px solid color-mix(in srgb,var(--text,#0f172a) 14%,transparent);
  background:transparent;color:inherit;font:600 14px/1 inherit;cursor:pointer;white-space:nowrap}
.dm-disp-barra-dentro .dm-disp-salva{background:var(--accent,#2563eb);border-color:transparent;color:#fff}
.dm-disp-barra-dentro .dm-disp-salva[disabled]{opacity:.45;cursor:default}
.dm-disp-quante{font-weight:800}
@media (max-width:560px){
  .dm-disp-barra-dentro{gap:6px;padding:6px 8px}
  .dm-disp-barra-dentro .dm-disp-conta{font-size:12.5px;white-space:nowrap;padding:0 2px}
  .dm-disp-barra-dentro .dm-disp-conta[data-vuota]{display:none}
  .dm-disp-barra-dentro button{padding:0 10px;font-size:13px}
}
`;

export function installDisposizione() {
  if (!doc?.body || state.installed) return;
  state.installed = true;
  installStyle("dm-disposizione-style", STILE);
  doc.addEventListener("click", onClick, true);
  for (const tipo of ["pointerdown", "pointermove", "pointerup", "pointercancel"])
    doc.addEventListener(tipo, onPuntatore, { capture: true, passive: false });
  doc.addEventListener("keydown", onKeyDown);
  doc.addEventListener("dm-riordina", onRiordina);
  if (root.MutationObserver) {
    state.osservatore = new root.MutationObserver(() => {
      if (!state.occupato) inCoda();
    });
    osservaLePagine();
  }
  root.addEventListener?.("storage", inCoda);
  root.addEventListener?.("dashboardmodern:config-synced", inCoda);
  inCoda();
}

/* Per le prove e per chi vuole guardare da fuori. */
root.dmDisposizione = {
  entraInModifica: () => entraInModifica(),
  esciDallaModifica,
  applicaLaDisposizione: () => applicaLaDisposizione(),
  giri: () => state.giri || 0,
  elenchi: () =>
    elenchiDellaPagina(paginaAttiva()).map((e) => {
      const voci = vociDi(e.contenitore);
      return { chiave: e.chiave, voci: voci.map((v) => v.id), nomi: voci.map((v) => v.nome) };
    }),
};

senzaCadere(installDisposizione);
