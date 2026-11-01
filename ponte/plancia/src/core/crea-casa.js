/* «Crea la tua casa»: dalla procedura guidata al piano salvato.
 *
 * La procedura (vedi `sections/casa-3d-crea-section.js`) riconosce i muri
 * dalla foto della planimetria (`pianta-da-foto.js`), fa dare un nome alle
 * stanze — le aree di Home Assistant, quando ci sono — e dalle foto delle
 * stanze ricava gli arredi, i colori e i dispositivi. Dal campo: «se dalle
 * foto riconosci oggetti come punti luce, telecamere, finestre etc. poi devi
 * dare la possibilita' di associare le entita' di riferimento o nel caso a
 * mano libera aggiungerle».
 *
 * Il modulo e' puro: niente pagina, niente foto. Entra quello che la
 * procedura sa (la griglia da 3 cm, i nomi, i riquadri visti nelle foto) ed
 * esce il piano come lo vuole `casa-3d.js`: la griglia ritagliata sulla casa,
 * ricampionata a 5 cm e compressa, le stanze coi nomi e le aree, le porte e
 * le finestre in metri, gli arredi e i dispositivi al loro posto.
 *
 * Le foto qui non arrivano mai: arrivano i riquadri e i colori che se ne
 * sono ricavati sul dispositivo.
 */

import {
  CELLA,
  DISPOSITIVI_3D,
  PASSO_SALVATO,
  PIANI_AL_MASSIMO,
  comprimiGriglia,
  entita,
  espandiGriglia,
  ricampiona,
} from "./casa-3d.js";
import { PASSO, riconosciDaFoto } from "./pianta-da-foto.js";

const clean = (v) => String(v ?? "").trim();
const elenco = (v) => (Array.isArray(v) ? v : []);
const tra = (v, min, max) => Math.min(max, Math.max(min, v));
const colore = (v) => (/^#[0-9a-f]{6}$/i.test(clean(v)) ? clean(v).toLowerCase() : "");
const tondo = (v, cifre = 3) => Math.round(v * 10 ** cifre) / 10 ** cifre;

/* ── gli arredi che si riconoscono o si aggiungono dalle foto ────────────
 *
 * Le chiavi sono quelle del catalogo della vista 3D; qui servono solo il
 * segno e il nome per la procedura. */
export const ARREDI_DELLE_FOTO = Object.freeze({
  divano: { icona: "🛋️", nome: ["Divano", "Sofa"] },
  angolare: { icona: "🛋️", nome: ["Divano angolare", "Corner sofa"] },
  poltrona: { icona: "💺", nome: ["Poltrona", "Armchair"] },
  tavolino: { icona: "☕", nome: ["Tavolino", "Coffee table"] },
  tv: { icona: "📺", nome: ["Mobile TV", "TV stand"] },
  libreria: { icona: "📚", nome: ["Libreria", "Bookcase"] },
  tappeto: { icona: "🟫", nome: ["Tappeto", "Rug"] },
  stelo: { icona: "💡", nome: ["Lampada a stelo", "Floor lamp"] },
  camino: { icona: "🔥", nome: ["Camino", "Fireplace"] },
  pianta: { icona: "🪴", nome: ["Pianta", "Plant"] },
  madia: { icona: "🗄️", nome: ["Madia", "Sideboard"] },
  pensile: { icona: "🔲", nome: ["Pensile", "Wall cabinet"] },
  quadro: { icona: "🖼️", nome: ["Quadro", "Painting"] },
  pranzo6: { icona: "🍽️", nome: ["Tavolo da pranzo", "Dining table"] },
  tondo4: { icona: "⭕", nome: ["Tavolo tondo", "Round table"] },
  cucina: { icona: "🍳", nome: ["Cucina", "Kitchen"] },
  isola: { icona: "🏝️", nome: ["Isola", "Kitchen island"] },
  frigo: { icona: "🧊", nome: ["Frigorifero", "Fridge"] },
  matrimoniale: { icona: "🛏️", nome: ["Letto matrimoniale", "Double bed"] },
  singolo: { icona: "🛏️", nome: ["Letto singolo", "Single bed"] },
  comodino: { icona: "🗄️", nome: ["Comodino", "Nightstand"] },
  armadio: { icona: "🚪", nome: ["Armadio", "Wardrobe"] },
  cassettiera: { icona: "🗃️", nome: ["Cassettiera", "Chest of drawers"] },
  vasca: { icona: "🛁", nome: ["Vasca", "Bathtub"] },
  doccia: { icona: "🚿", nome: ["Doccia", "Shower"] },
  wc: { icona: "🚽", nome: ["WC", "Toilet"] },
  lavabo: { icona: "🪥", nome: ["Lavabo", "Washbasin"] },
  lavatrice: { icona: "🫧", nome: ["Lavatrice", "Washing machine"] },
  asciugatrice: { icona: "🌀", nome: ["Asciugatrice", "Dryer"] },
  lavastoviglie: { icona: "🍽️", nome: ["Lavastoviglie", "Dishwasher"] },
  forno: { icona: "🔥", nome: ["Forno", "Oven"] },
  microonde: { icona: "📟", nome: ["Microonde", "Microwave"] },
  scrivania: { icona: "🖥️", nome: ["Scrivania", "Desk"] },
  bidet: { icona: "🚰", nome: ["Bidet", "Bidet"] },
  culla: { icona: "👶", nome: ["Lettino", "Cot"] },
  ufficio: { icona: "🪑", nome: ["Sedia da ufficio", "Office chair"] },
  pianoforte: { icona: "🎹", nome: ["Pianoforte", "Piano"] },
  cyclette: { icona: "🚴", nome: ["Cyclette", "Exercise bike"] },
  scala: { icona: "🪜", nome: ["Scala", "Staircase"] },
});

/* Quelli che stanno contro il muro che si guarda: la profondita' nella foto
 * non conta, si appoggiano alla parete. */
export const ACCOSTATI = new Set([
  "tv",
  "libreria",
  "cucina",
  "armadio",
  "madia",
  "pensile",
  "quadro",
  "camino",
  "frigo",
  "lavabo",
  "wc",
  "vasca",
  "cassettiera",
  "lavatrice",
  "asciugatrice",
  "lavastoviglie",
  "forno",
  "microonde",
]);

/* Dalle classi del riconoscitore alle cose della casa. Il riconoscitore e'
 * D-FINE addestrato su Objects365 (365 cose, fra cui armadi, comodini,
 * lavatrici, condizionatori); restano anche i nomi di COCO, per le prove e per
 * chi avesse ancora il vecchio. Il nome della classe si scrive in minuscolo.
 * Qui c'e' solo la prima idea: il resto lo decide `oggettiDallaFoto`, che
 * guarda la stanza, la forma e le cose vicine. */
export const DALLE_CLASSI = Object.freeze({
  couch: { arredo: "divano" },
  sofa: { arredo: "divano" },
  bed: { arredo: "letto" },
  nightstand: { arredo: "comodino" },
  "cabinet/shelf": { arredo: "mobile" },
  "coffee table": { arredo: "tavolino" },
  "side table": { arredo: "laterale" },
  "dinning table": { arredo: "pranzo6" },
  "dining table": { arredo: "pranzo6" },
  desk: { arredo: "scrivania" },
  laptop: { arredo: "scrivania" },
  chair: { arredo: "sedia" },
  stool: { arredo: "sgabello" },
  lamp: { arredo: "lampada" },
  carpet: { arredo: "tappeto" },
  "picture/frame": { arredo: "quadro" },
  "potted plant": { arredo: "pianta" },
  "moniter/tv": { arredo: "tv", dispositivo: "tv" },
  tv: { arredo: "tv", dispositivo: "tv" },
  refrigerator: { arredo: "frigo" },
  oven: { dispositivo: "forno" },
  microwave: { arredo: "microonde" },
  "gas stove": { arredo: "cucina" },
  "induction cooker": { arredo: "cucina" },
  extractor: { arredo: "cucina" },
  toaster: { arredo: "cucina" },
  dishwasher: { dispositivo: "lavastoviglie" },
  "washing machine/drying machine": { dispositivo: "lavatrice" },
  sink: { arredo: "lavello" },
  toilet: { arredo: "wc" },
  bathtub: { arredo: "vasca" },
  showerhead: { arredo: "doccia" },
  piano: { arredo: "pianoforte" },
  "air conditioner": { dispositivo: "clima" },
  "surveillance camera": { dispositivo: "telecamera" },
  speaker: { dispositivo: "altoparlante" },
});

/* Le cose che, viste per sbaglio, cambiano tutta la stanza (un WC fa un
 * bagno, e il mobile diventa un lavabo) vogliono un riconoscimento piu'
 * sicuro delle altre. */
const SOGLIE = Object.freeze({
  toilet: 0.55,
  bathtub: 0.5,
  showerhead: 0.5,
  bed: 0.45,
  desk: 0.5,
  "moniter/tv": 0.45,
  "gas stove": 0.5,
  "induction cooker": 0.5,
  extractor: 0.5,
  "surveillance camera": 0.45,
  speaker: 0.5,
});

/* Il tipo della stanza, dal suo nome. */
function tipoDiStanza(nome) {
  const n = clean(nome).toLowerCase();
  if (/bagn|bath|wc|toilet|servizi|lavanderia/.test(n)) return "bagno";
  if (/cucin|kitchen|cottura/.test(n)) return "cucina";
  if (/camer|letto|bed|notte|ospiti/.test(n)) return "camera";
  if (/studio|ufficio|office|study/.test(n)) return "studio";
  return "giorno";
}

const area = (b) => b[2] * b[3];
/* quanto si coprono due riquadri, sul totale dei due (0 lontani, 1 uguali) */
const unione = (a, b) => {
  const x0 = Math.max(a[0], b[0]),
    y0 = Math.max(a[1], b[1]);
  const x1 = Math.min(a[0] + a[2], b[0] + b[2]),
    y1 = Math.min(a[1] + a[3], b[1] + b[3]);
  const dentro = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  return dentro / (area(a) + area(b) - dentro);
};
const allarga = (b, k) => [
  b[0] - b[2] * k,
  b[1] - b[3] * k,
  b[2] * (1 + 2 * k),
  b[3] * (1 + 2 * k),
];
const dentroPer = (a, b) => {
  const x0 = Math.max(a[0], b[0]),
    y0 = Math.max(a[1], b[1]);
  const x1 = Math.min(a[0] + a[2], b[0] + b[2]),
    y1 = Math.min(a[1] + a[3], b[1] + b[3]);
  return (Math.max(0, x1 - x0) * Math.max(0, y1 - y0)) / area(a);
};

const riquadro = (b) => {
  const [x, y, w, h] = elenco(b).map(Number);
  return [x, y, w, h].every(Number.isFinite) && w > 0 && h > 0 ? [x, y, w, h] : null;
};

function sovrapposti(a, b) {
  const x0 = Math.max(a[0], b[0]),
    y0 = Math.max(a[1], b[1]);
  const x1 = Math.min(a[0] + a[2], b[0] + b[2]),
    y1 = Math.min(a[1] + a[3], b[1] + b[3]);
  const dentro = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  return dentro / Math.min(a[2] * a[3], b[2] * b[3]);
}

/** Quello che il riconoscitore ha visto, nelle cose della casa:
 * `{ arredi, dispositivi }`. `rilevati` sono `{ class, bbox: [x, y, w, h],
 * score }`; `w` e `h` la foto. «Dalle foto non li riconosce bene e non e'
 * fedele con quanto presente in casa»: il mobile si decide anche dalla stanza
 * e dalla forma (alto in camera e' un armadio, basso una cassettiera; sotto
 * la TV e' il mobile TV), le sedie del tavolo non diventano poltrone, una
 * scatola dentro un mobile non e' un altro mobile. */
export function oggettiDallaFoto(rilevati, { soglia = 0.4, stanza = "", w = 0, h = 0 } = {}) {
  const arredi = [],
    dispositivi = [];
  const visti = elenco(rilevati)
    .map((d) => ({
      classe: clean(d?.class).toLowerCase(),
      box: riquadro(d?.bbox),
      score: Number(d?.score) || 0,
    }))
    .filter(
      (d) => d.box && DALLE_CLASSI[d.classe] && d.score >= Math.max(soglia, SOGLIE[d.classe] || 0),
    )
    .sort((a, b) => b.score - a.score)
    /* la stessa cosa vista come due cose diverse (un quadro e una TV nello
     * stesso riquadro): vale quella piu' sicura */
    .filter((d, i, tutti) =>
      tutti.slice(0, i).every((p) => p.classe === d.classe || unione(p.box, d.box) <= 0.7),
    );
  const W = Number(w) > 0 ? Number(w) : Math.max(1, ...visti.map((d) => d.box[0] + d.box[2])),
    H = Number(h) > 0 ? Number(h) : Math.max(1, ...visti.map((d) => d.box[1] + d.box[3]));
  let tipo = tipoDiStanza(stanza);
  const ci = (classe) => visti.filter((d) => d.classe === classe);
  if (tipo === "giorno" && (ci("toilet").length || ci("bathtub").length)) tipo = "bagno";
  if (tipo === "giorno" && ci("bed").length) tipo = "camera";
  /* anche in un open space chiamato «Soggiorno»: dove ci sono il forno e i
   * fuochi, la foto e' della cucina */
  if (
    tipo === "giorno" &&
    (ci("gas stove").length ||
      ci("induction cooker").length ||
      ci("extractor").length ||
      ci("oven").length ||
      ci("microwave").length + ci("dishwasher").length + ci("refrigerator").length >= 2)
  )
    tipo = "cucina";
  const tavoli = visti.filter((d) => /dinn?ing table|desk|laptop/.test(d.classe));
  const sgabelli = ci("stool");
  /* in cucina il piano coi sgabelli attorno non e' una scrivania: e' l'isola
   * (o la penisola) */
  const isola = (t) =>
    t.classe === "desk" &&
    (tipo === "cucina" ||
      sgabelli.filter((g) => dentroPer(g.box, allarga(t.box, 0.3)) > 0.3).length >= 2);
  const tv = visti.filter((d) => d.classe === "tv" || d.classe === "moniter/tv");
  const mobili = ci("cabinet/shelf");
  const sopraUnMobile = (b) =>
    mobili.some((m) => {
      const cx = b[0] + b[2] / 2,
        sotto = b[1] + b[3];
      return (
        cx > m.box[0] &&
        cx < m.box[0] + m.box[2] &&
        sotto > m.box[1] - H * 0.12 &&
        sotto < m.box[1] + m.box[3] * 0.4
      );
    });

  /* la cucina e' una sola, coi pensili sopra: quello che le sta sopra o
   * sotto e' la stessa cucina */
  const inColonna = (a, b) =>
    Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) >
    Math.min(a[2], b[2]) * 0.5;
  /* ...e anche quello accanto, a destra o a sinistra (una colonna del
   * forno, l'altro lato della L): la cucina si allarga fin li' */
  const accanto = (a, b) => {
    const spazio = Math.max(a[0], b[0]) - Math.min(a[0] + a[2], b[0] + b[2]);
    return spazio < W * 0.06;
  };
  const metti = (dove, k, d) => {
    if (dove.some((o) => o.k === k && sovrapposti(o.box, d.box) > 0.6)) return;
    const stessa =
      k === "cucina" &&
      dove.find((o) => o.k === k && (inColonna(o.box, d.box) || accanto(o.box, d.box)));
    if (stessa) {
      const x0 = Math.min(stessa.box[0], d.box[0]),
        y0 = Math.min(stessa.box[1], d.box[1]),
        x1 = Math.max(stessa.box[0] + stessa.box[2], d.box[0] + d.box[2]),
        y1 = Math.max(stessa.box[1] + stessa.box[3], d.box[1] + d.box[3]);
      stessa.box = [x0, y0, x1 - x0, y1 - y0];
      return;
    }
    dove.push({ k, box: d.box, score: tondo(d.score, 2) });
  };
  /* Il mobile: dove sta, quanto e' alto, cosa ci sta sopra. */
  const mobile = (d) => {
    const [, y, bw, bh] = d.box;
    if (y + bh < H * 0.45) return tipo === "cucina" ? "cucina" : "pensile";
    if (tipo === "cucina") return "cucina";
    if (tipo === "bagno") return "lavabo";
    const alto = bh > bw * 1.25;
    if (tipo === "camera") return alto ? "armadio" : "cassettiera";
    if (!alto && tv.some((t) => sopraUnMobile(t.box) && dentroPer(t.box, allarga(d.box, 0.3)) > 0))
      return "tv";
    return alto ? "libreria" : "madia";
  };
  const giaVisti = [];
  for (const d of visti) {
    const m = DALLE_CLASSI[d.classe];
    /* un pezzo dentro un mobile gia' visto (un'anta, una mensola) e' lo stesso mobile */
    if (
      d.classe === "cabinet/shelf" &&
      giaVisti.some((g) => g.classe === "cabinet/shelf" && dentroPer(d.box, g.box) > 0.7)
    )
      continue;
    giaVisti.push(d);
    let k = m.arredo || null;
    switch (k) {
      case "letto":
        k = /singol|bimb|ragazz|camerett/i.test(clean(stanza)) ? "singolo" : "matrimoniale";
        break;
      case "mobile":
        /* una cornice, una scatola: un mobile e' piu' grande */
        k = area(d.box) >= W * H * 0.015 ? mobile(d) : null;
        break;
      case "laterale":
        k = tipo === "camera" ? "comodino" : "tavolino";
        break;
      case "sedia": {
        /* le sedie del tavolo e della scrivania sono gia' col tavolo */
        const vicino = tavoli.find((t) => dentroPer(d.box, allarga(t.box, 0.35)) > 0.3);
        if (vicino) k = /desk|laptop/.test(vicino.classe) && !isola(vicino) ? "ufficio" : null;
        /* in cucina una sedia da sola e' del tavolo, non una poltrona */
        else k = tipo !== "cucina" && d.box[2] >= d.box[3] * 0.75 ? "poltrona" : null;
        break;
      }
      case "sgabello":
        /* gli sgabelli vanno con l'isola */
        k = null;
        break;
      case "scrivania":
        if (isola(d)) k = "isola";
        break;
      case "lampada":
        /* appesa in alto e' un punto luce; lunga e a terra, una lampada a stelo */
        if (d.box[1] + d.box[3] < H * 0.4) {
          /* piccola piccola, in alto sul muro, e' piu' spesso un sensore */
          if (area(d.box) >= W * H * 0.004) metti(dispositivi, "luce", d);
          k = null;
        } else k = d.box[3] > d.box[2] * 2 && d.box[1] + d.box[3] > H * 0.6 ? "stelo" : null;
        break;
      case "quadro":
        k = area(d.box) >= W * H * 0.012 ? "quadro" : null;
        break;
      case "tv":
        /* sulla scrivania e' uno schermo del computer; sopra un mobile, il
         * mobile e' gia' il mobile TV */
        if (
          tavoli.some(
            (t) => /desk|laptop/.test(t.classe) && dentroPer(d.box, allarga(t.box, 0.2)) > 0.5,
          )
        )
          continue;
        if (sopraUnMobile(d.box) || d.box[1] + d.box[3] < H * 0.55) k = null;
        break;
      case "lavello":
        k = tipo === "bagno" ? "lavabo" : "cucina";
        break;
      default:
    }
    if (k) metti(arredi, k, d);
    if (m.dispositivo) metti(dispositivi, m.dispositivo, d);
  }
  /* due pezzi di cucina che un terzo ha unito sono una cucina sola */
  for (let i = 0; i < arredi.length; i++)
    for (let j = arredi.length - 1; j > i; j--) {
      const a = arredi[i],
        b = arredi[j];
      if (a.k !== "cucina" || b.k !== "cucina") continue;
      if (!(inColonna(a.box, b.box) || accanto(a.box, b.box))) continue;
      const x0 = Math.min(a.box[0], b.box[0]),
        y0 = Math.min(a.box[1], b.box[1]);
      a.box = [
        x0,
        y0,
        Math.max(a.box[0] + a.box[2], b.box[0] + b.box[2]) - x0,
        Math.max(a.box[1] + a.box[3], b.box[1] + b.box[3]) - y0,
      ];
      arredi.splice(j, 1);
      j = arredi.length;
    }
  return { arredi, dispositivi };
}

/** Il nome di prima, per chi lo chiama ancora. */
export const oggettiDaCoco = oggettiDallaFoto;

/* ── i piani ─────────────────────────────────────────────────────────── */

const LIVELLI = {
  "-2": ["interrato", "Interrato", "Basement"],
  "-1": ["seminterrato", "Seminterrato", "Lower ground floor"],
  0: ["terra", "Piano terra", "Ground floor"],
  1: ["primo", "Primo piano", "First floor"],
  2: ["secondo", "Secondo piano", "Second floor"],
  3: ["terzo", "Terzo piano", "Third floor"],
  4: ["quarto", "Quarto piano", "Fourth floor"],
  5: ["quinto", "Quinto piano", "Fifth floor"],
};

/** La chiave e il nome (italiano, inglese) di un livello: -1 seminterrato, 0 terra, 1 primo... */
export function pianoDelLivello(livello) {
  const n = tra(Math.round(Number(livello) || 0), -3, 30);
  const noto = LIVELLI[n];
  if (noto) return { k: noto[0], livello: n, nome: [noto[1], noto[2]] };
  return n < 0
    ? { k: `sotto${-n}`, livello: n, nome: [`Interrato ${-n}`, `Basement ${-n}`] }
    : { k: `piano${n}`, livello: n, nome: [`Piano ${n}`, `Floor ${n}`] };
}

/** La casa con un piano in piu': quello con la stessa chiave si sostituisce. */
export function aggiungiPiano(casa, piano) {
  const c = casa && typeof casa === "object" ? casa : {};
  if (!piano?.k) return { ...c, piani: elenco(c.piani) };
  const piani = elenco(c.piani).filter((p) => p?.k !== piano.k);
  piani.push(piano);
  piani.sort((a, b) => (Number(a?.livello) || 0) - (Number(b?.livello) || 0));
  return { ...c, piani: piani.slice(0, PIANI_AL_MASSIMO) };
}

/** Le entita' gia' date a un dispositivo della casa (tranne `tranne`). */
export function entitaUsate(casa, tranne = null) {
  const out = [];
  for (const p of elenco(casa?.piani))
    for (const d of elenco(p?.dispositivi)) if (d !== tranne && d?.entity) out.push(d.entity);
  for (const d of elenco(casa?.esterno?.telecamere))
    if (d !== tranne && d?.entity) out.push(d.entity);
  return out;
}

/* ── le aree di Home Assistant ───────────────────────────────────────────
 *
 * Il guscio le tiene in `WIZ` (areaNames: area_id → nome; entReg: entita' →
 * { a: area, d: dispositivo }; devArea: dispositivo → area); dentro Home
 * Assistant ci sono anche `hass.areas`, `hass.entities`, `hass.devices`.
 * Si prende quello che c'e', senza chiedere niente a nessuno. */
export function areeDaiRegistri({ wiz = null, hass = null, ricordate = null } = {}) {
  const aree = {},
    diEntita = {};
  for (const [id, nome] of Object.entries(wiz?.areaNames || {}))
    if (clean(id) && clean(nome)) aree[clean(id)] = clean(nome);
  for (const a of Object.values(hass?.areas || {}))
    if (clean(a?.area_id) && clean(a?.name)) aree[clean(a.area_id)] ||= clean(a.name);
  for (const [id, riga] of Object.entries(wiz?.entReg || {})) {
    const area = clean(riga?.a) || clean(wiz?.devArea?.[clean(riga?.d)]);
    if (area) diEntita[id] = area;
  }
  for (const [id, e] of Object.entries(hass?.entities || {})) {
    if (diEntita[id]) continue;
    const area = clean(e?.area_id) || clean(hass?.devices?.[clean(e?.device_id)]?.area_id);
    if (area) diEntita[id] = area;
  }
  /* Senza registri vivi resta la mappa ricordata (entita' → nome della
   * stanza): il nome fa anche da codice. */
  if (!Object.keys(aree).length && ricordate && typeof ricordate === "object") {
    for (const [id, nome] of Object.entries(ricordate)) {
      const n = clean(nome);
      if (!n) continue;
      aree[n] = n;
      diEntita[id] = n;
    }
  }
  return { aree, diEntita };
}

/* ── dalla foto alla stanza ──────────────────────────────────────────────
 *
 * Chi fotografa sta in una stanza e guarda una parete (N, S, E, O: in alto,
 * in basso, a destra, a sinistra nella pianta). Quello che nella foto sta a
 * sinistra sta a sinistra lungo quella parete; quello che tocca terra piu' in
 * basso nella foto e' piu' vicino a chi scatta, cioe' piu' lontano dalla
 * parete. */
const ROT = { N: 0, S: Math.PI, E: -Math.PI / 2, O: Math.PI / 2 };

function lungoLaParete(r, verso, u, prof, margine) {
  const X0 = r.x0 + margine,
    X1 = Math.max(X0, r.x1 - margine),
    Y0 = r.y0 + margine,
    Y1 = Math.max(Y0, r.y1 - margine);
  switch (verso) {
    case "N":
      return { x: X0 + u * (X1 - X0), y: Y0 + prof * (Y1 - Y0) };
    case "S":
      return { x: X1 - u * (X1 - X0), y: Y1 - prof * (Y1 - Y0) };
    case "E":
      return { x: X1 - prof * (X1 - X0), y: Y0 + u * (Y1 - Y0) };
    default:
      return { x: X0 + prof * (X1 - X0), y: Y1 - u * (Y1 - Y0) };
  }
}

const riquadroDi = (s) =>
  s?.riquadro || {
    x0: (s?.sx || 0) - 2,
    x1: (s?.sx || 0) + 2,
    y0: (s?.sy || 0) - 2,
    y1: (s?.sy || 0) + 2,
  };
const versoDi = (v) => (["N", "S", "E", "O"].includes(v) ? v : "N");

/** Dove sta, nella stanza, una cosa vista nella foto: `{ x, y, rot }` in metri. */
export function posaDallaFoto(stanza, foto, box, { accostato = false, mont = "" } = {}) {
  const b = riquadro(box);
  const W = Number(foto?.w) || 1,
    H = Number(foto?.h) || 1,
    verso = versoDi(foto?.verso);
  if (!b) return { x: stanza?.sx || 0, y: stanza?.sy || 0, rot: ROT[verso] };
  let u = tra((b[0] + b[2] / 2) / W, 0, 1);
  let prof,
    margine = 0.35;
  if (mont === "soffitto") prof = tra((0.5 - (b[1] + b[3] / 2) / H) / 0.5, 0, 1);
  else if (mont === "pavimento" || (!mont && !accostato))
    prof = tra(((b[1] + b[3]) / H - 0.5) / 0.5, 0, 1);
  else prof = 0;
  if (mont && mont !== "soffitto" && mont !== "pavimento") margine = 0.08;
  if (mont === "angolo") {
    u = u < 0.5 ? 0 : 1;
    margine = 0.15;
  }
  return { ...lungoLaParete(riquadroDi(stanza), verso, u, prof, margine), rot: ROT[verso] };
}

/* Un punto che e' finito fuori dalla stanza (una stanza a L, un riquadro
 * largo) torna nella cella della stanza piu' vicina. */
export function nellaStanza(casa, id, x, y) {
  const { W, H, passo, tipo } = casa || {};
  if (!tipo || !W || !H) return { x, y };
  const cx = tra(Math.floor(x / passo), 0, W - 1),
    cy = tra(Math.floor(y / passo), 0, H - 1);
  if (tipo[cy * W + cx] === id) return { x, y };
  let meglio = -1,
    d = Infinity;
  for (let i = 0; i < W * H; i++) {
    if (tipo[i] !== id) continue;
    const q = ((i % W) - cx) ** 2 + (((i / W) | 0) - cy) ** 2;
    if (q < d) {
      d = q;
      meglio = i;
    }
  }
  if (meglio < 0) return { x, y };
  /* un passo piu' dentro, verso il centro della stanza: non sul filo del muro */
  const s = elenco(casa.stanze).find((v) => v.id === id);
  let px = ((meglio % W) + 0.5) * passo,
    py = (((meglio / W) | 0) + 0.5) * passo;
  if (s) {
    const dx = s.sx - px,
      dy = s.sy - py,
      l = Math.hypot(dx, dy) || 1,
      k = Math.min(l, 0.12);
    px += (dx / l) * k;
    py += (dy / l) * k;
  }
  return { x: px, y: py };
}

/* Le cose lunghe contro la parete che si guarda: quanto sono larghe si
 * vede nella foto, in proporzione alla parete. Con un limite, che la foto
 * non prende sempre tutta la parete. */
export const LARGHE_COME_NELLA_FOTO = Object.freeze({
  divano: 2.2,
  cucina: 3.0,
  armadio: 2.2,
  madia: 1.8,
  libreria: 1.6,
  tv: 1.9,
  cassettiera: 1.1,
  pensile: 1.6,
});

/** Quanto e' larga davvero una cosa vista nella foto, in metri; 0 se non si sa. */
export function larghezzaDallaFoto(stanza, foto, o) {
  const tipica = LARGHE_COME_NELLA_FOTO[o?.k],
    b = riquadro(o?.box),
    W = Number(foto?.w) || 0;
  if (!tipica || !b || !(W > 0) || o?.manuale) return 0;
  const r = riquadroDi(stanza),
    verso = versoDi(foto?.verso),
    parete = verso === "N" || verso === "S" ? r.x1 - r.x0 : r.y1 - r.y0;
  if (!(parete > 0)) return 0;
  return tondo(tra((b[2] / W) * parete, tipica * 0.6, Math.min(tipica * 1.6, parete)), 2);
}

/** Gli arredi di una foto, in metri dentro la stanza. */
export function arrediDallaFoto(casa, stanza, foto) {
  return elenco(foto?.oggetti)
    .filter((o) => ARREDI_DELLE_FOTO[o?.k])
    .map((o) => {
      const p = posaDallaFoto(stanza, foto, o.box, { accostato: ACCOSTATI.has(o.k) });
      const l = larghezzaDallaFoto(stanza, foto, o);
      return {
        k: o.k,
        stanza: stanza.id,
        ...nellaStanza(casa, stanza.id, p.x, p.y),
        rot: p.rot,
        tinta: colore(o.colore),
        ...(l ? { l } : {}),
      };
    });
}

/* L'altezza da terra di ogni dispositivo, se non la si sa meglio. */
export const ALTEZZA_DI_SERIE = Object.freeze({
  luce: 2.85,
  telecamera: 2.5,
  tapparella: 2.2,
  finestra: 1.4,
  porta: 2.0,
  movimento: 2.25,
  presenza: 2.9,
  termometro: 1.5,
  clima: 2.3,
  termostato: 1.5,
  fumo: 2.92,
  acqua: 0,
  lavatrice: 0,
  asciugatrice: 0,
  lavastoviglie: 0,
  forno: 0,
  presa: 0.3,
  tv: 1.1,
  altoparlante: 1.0,
  antifurto: 2.3,
  pannello: 1.2,
});

/** I dispositivi segnati o riconosciuti in una foto, al loro posto. */
export function dispositiviDallaFoto(casa, stanza, foto) {
  return elenco(foto?.dispositivi)
    .filter((d) => DISPOSITIVI_3D[d?.k])
    .map((d) => {
      const mont = DISPOSITIVI_3D[d.k].mont;
      let p = posaDallaFoto(stanza, foto, d.box, { mont });
      /* un sensore della finestra (o della porta) va sulla finestra vera, se ce
       * n'e' una li' vicino */
      if (mont === "finestra" || mont === "porta") {
        const vicina = elenco(casa?.aperture)
          .filter((a) => a.stanza === stanza.id && a.tipo === mont)
          .map((a) => ({ a, d: Math.hypot(a.cx - p.x, a.cy - p.y) }))
          .sort((a, b) => a.d - b.d)[0];
        if (vicina && vicina.d < 2.5) p = { ...p, x: vicina.a.cx, y: vicina.a.cy };
      }
      return {
        k: d.k,
        stanza: stanza.id,
        ...nellaStanza(casa, stanza.id, p.x, p.y),
        h: ALTEZZA_DI_SERIE[d.k] ?? 2.3,
        rot: p.rot,
        entity: entita(d.entity),
        nome: clean(d.nome).slice(0, 40),
        da: "foto",
        ...(d.k === "telecamera" ? { fov: 100 } : {}),
      };
    });
}

/** Dove mettere un dispositivo aggiunto senza foto: dove si monta di solito.
 * `quanti` sono quelli dello stesso tipo gia' nella stanza, per non
 * metterli uno sopra l'altro. */
export function posaDiRipiego(casa, stanza, k, quanti = 0) {
  const mont = DISPOSITIVI_3D[k]?.mont || "muro";
  const r = riquadroDi(stanza),
    passo = 0.4 * quanti;
  let p;
  if (mont === "finestra" || mont === "porta") {
    const tipo = mont === "porta" ? "porta" : "finestra";
    const sue = elenco(casa?.aperture).filter((a) => a.stanza === stanza.id && a.tipo === tipo);
    const a = sue[quanti % Math.max(1, sue.length)];
    if (a) p = { x: a.cx ?? a.x, y: a.cy ?? a.y, rot: 0 };
  }
  if (!p && mont === "angolo") {
    const angoli = [
      [r.x0 + 0.15, r.y0 + 0.15, Math.PI / 4],
      [r.x1 - 0.15, r.y0 + 0.15, -Math.PI / 4],
      [r.x1 - 0.15, r.y1 - 0.15, (-3 * Math.PI) / 4],
      [r.x0 + 0.15, r.y1 - 0.15, (3 * Math.PI) / 4],
    ];
    const [x, y, rot] = angoli[quanti % 4];
    p = { x, y, rot };
  }
  if (!p && (mont === "muro" || mont === "finestra" || mont === "porta"))
    p = { x: tra(stanza.sx + passo, r.x0 + 0.1, r.x1 - 0.1), y: r.y0 + 0.08, rot: 0 };
  /* al soffitto o a terra: un po' discosto dal centro, dove la pianta scrive il nome */
  if (!p) p = { x: stanza.sx + 0.7 + passo, y: stanza.sy + 0.5, rot: 0 };
  const dentro = nellaStanza(casa, stanza.id, p.x, p.y);
  return { ...dentro, rot: p.rot, h: ALTEZZA_DI_SERIE[k] ?? 2.3 };
}

/* ── i colori ────────────────────────────────────────────────────────── */

/** Il pavimento dal colore: un marrone caldo e' parquet, il resto gres. */
export function pavimentoDalColore(c) {
  const hex = colore(c);
  if (!hex) return null;
  const n = parseInt(hex.slice(1), 16),
    r = n >> 16,
    g = (n >> 8) & 255,
    b = n & 255;
  const legno = r > g && g > b && r - b > 45 && r < 235;
  return { tipo: legno ? "listoni" : "gres60", colore: hex };
}

/* ── il piano ────────────────────────────────────────────────────────── */

/* Le stanze ai due lati di un varco (quello che c'e' di qua e di la' del
 * muro, entro 60 cm). */
function latiDelVarco(casa, a) {
  const { W, H, passo, tipo } = casa;
  const cx = Math.floor(a.cx / passo),
    cy = Math.floor(a.cy / passo),
    lati = [];
  for (const segno of [-1, 1]) {
    for (let d = 1; d < Math.round(0.6 / passo); d++) {
      const x = a.orizz ? cx : cx + segno * d,
        y = a.orizz ? cy + segno * d : cy;
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      const v = tipo[y * W + x];
      if (v > 0 || v === CELLA.fuori) {
        lati.push(v);
        break;
      }
    }
  }
  return lati;
}

/**
 * Il piano da salvare, da quello che la procedura sa.
 *
 *  - `casa`: quello che torna `riconosciDaFoto` (griglia a 3 cm, stanze,
 *    aperture), eventualmente ritoccato a mano;
 *  - `nomi` / `aree`: id della stanza → nome, → area_id di Home Assistant;
 *  - `fuori`: gli id delle stanze che sono fuori (cortile, balcone);
 *  - `foto`: id della stanza → [{ verso, w, h, oggetti, dispositivi, pavimento, pareti }];
 *  - `dispositivi`: quelli aggiunti senza foto ({ k, stanza, entity, nome });
 *  - `livello`, `nome`, `k`: che piano e'.
 */
export function pianoDaRiconoscimento({
  casa,
  nomi = {},
  aree = {},
  fuori = [],
  foto = {},
  dispositivi = [],
  arredi: arrediGia = [],
  finiture = {},
  livello = 0,
  nome = "",
  k = "",
} = {}) {
  if (!casa?.tipo || !casa.W || !casa.H) return null;
  const { W, H, passo } = casa;
  const daFuori = new Set([...fuori].map(Number));
  const vive = elenco(casa.stanze).filter((s) => !daFuori.has(s.id));
  const idVivi = new Set(vive.map((s) => s.id));
  /* le stanze «fuori» diventano fuori anche nel 3D; le stanze sciolte pure */
  const tipo = Int16Array.from(casa.tipo, (v) => (v > 0 && !idVivi.has(v) ? CELLA.fuori : v));

  /* il ritaglio sulla casa, con mezzo metro intorno */
  let x0 = W,
    x1 = -1,
    y0 = H,
    y1 = -1;
  for (let i = 0; i < W * H; i++) {
    if (tipo[i] === CELLA.fuori) continue;
    const x = i % W,
      y = (i / W) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const bordo = Math.round(0.5 / passo);
  x0 = Math.max(0, x0 - bordo);
  y0 = Math.max(0, y0 - bordo);
  x1 = Math.min(W - 1, x1 + bordo);
  y1 = Math.min(H - 1, y1 + bordo);
  const Wr = x1 - x0 + 1,
    Hr = y1 - y0 + 1,
    tagliata = new Int16Array(Wr * Hr);
  for (let y = 0; y < Hr; y++)
    for (let x = 0; x < Wr; x++) tagliata[y * Wr + x] = tipo[(y + y0) * W + x + x0];
  const ox = x0 * passo,
    oy = y0 * passo;
  const salvata = ricampiona({ W: Wr, H: Hr, passo, tipo: tagliata }, PASSO_SALVATO);
  const sposta = (p) => ({ ...p, x: tondo(p.x - ox), y: tondo(p.y - oy) });
  const vista = { ...casa, tipo };

  const nomeDi = (id) => clean(nomi[id]) || vive.find((s) => s.id === id)?.nome || `Stanza ${id}`;
  const stanze = vive.map((s) => {
    const sue = elenco(foto[s.id]);
    const ultima = [...sue].reverse().find((f) => colore(f?.pavimento) || colore(f?.pareti));
    return {
      id: s.id,
      nome: nomeDi(s.id).slice(0, 40),
      area: clean(aree[s.id]).slice(0, 64),
      pavimento: ultima ? pavimentoDalColore(ultima.pavimento) : finiture[s.id]?.pavimento || null,
      pareti: colore(ultima?.pareti) || colore(finiture[s.id]?.pareti),
    };
  });

  /* i lati si guardano sulla griglia di prima: li' le stanze fuori ci sono ancora */
  const aperture = elenco(casa.aperture).flatMap((a) => {
    const lati = latiDelVarco(casa, a);
    const suFuori = lati.some((v) => daFuori.has(v)) || daFuori.has(a.stanza);
    const stanza = idVivi.has(a.stanza) ? a.stanza : lati.find((v) => idVivi.has(v)) || 0;
    if (!stanza && (suFuori || a.stanza)) return []; // fra due cose che sono fuori: non serve
    return [
      sposta({
        tipo: suFuori ? "finestra" : a.tipo,
        x: a.cx,
        y: a.cy,
        largo: tondo(a.largo, 2),
        orizz: a.orizz !== false,
        verso: a.verso || 0,
        portafinestra: a.portafinestra === true || (suFuori && a.tipo === "porta"),
        stanza: stanza || 0,
      }),
    ];
  });

  const arredi = [],
    posati = [];
  for (const s of vive) {
    for (const f of elenco(foto[s.id])) {
      arredi.push(...arrediDallaFoto(vista, s, f).map(sposta));
      posati.push(...dispositiviDallaFoto(vista, s, f).map(sposta));
    }
  }
  /* le scale disegnate nella pianta: un arredo «scala» al loro posto */
  for (const sc of elenco(casa.scale)) {
    if (!idVivi.has(sc.stanza)) continue;
    arredi.push(
      sposta({ k: "scala", stanza: sc.stanza, x: tondo(sc.x), y: tondo(sc.y), rot: sc.rot || 0 }),
    );
  }
  /* gli arredi di un piano ripreso: le foto non ci sono piu', gli arredi si' */
  for (const a of elenco(arrediGia))
    if (idVivi.has(Number(a?.stanza)) && Number.isFinite(a?.x) && Number.isFinite(a?.y))
      arredi.push(sposta({ ...a, stanza: Number(a.stanza) }));
  const contati = {};
  for (const d of elenco(dispositivi)) {
    const s = vive.find((v) => v.id === Number(d?.stanza));
    if (!s || !DISPOSITIVI_3D[d?.k]) continue;
    const chiave = `${s.id}:${d.k}`;
    const p =
      Number.isFinite(d.x) && Number.isFinite(d.y)
        ? { x: d.x, y: d.y, rot: d.rot || 0, h: d.h ?? ALTEZZA_DI_SERIE[d.k] }
        : posaDiRipiego(vista, s, d.k, contati[chiave] || 0);
    contati[chiave] = (contati[chiave] || 0) + 1;
    posati.push(
      sposta({
        k: d.k,
        stanza: s.id,
        x: p.x,
        y: p.y,
        h: p.h,
        rot: p.rot,
        entity: entita(d.entity),
        nome: clean(d.nome).slice(0, 40),
        da: d.da === "foto" ? "foto" : "mano",
        ...(d.k === "telecamera" ? { fov: Number(d.fov) || 100 } : {}),
      }),
    );
  }

  const qualePiano = pianoDelLivello(livello);
  return {
    k: clean(k) || qualePiano.k,
    nome: clean(nome) || qualePiano.nome[0],
    livello: qualePiano.livello,
    W: salvata.W,
    H: salvata.H,
    passo: PASSO_SALVATO,
    griglia: comprimiGriglia(salvata.tipo),
    stanze,
    aperture,
    arredi,
    dispositivi: posati,
  };
}

/**
 * Un piano salvato, di nuovo nella procedura: «dare la possibilita' di
 * modificare di nuovo la planimetria».
 *
 * La griglia salvata (a 5 cm) torna alla griglia dei muri della procedura (a
 * 3 cm) con un margine di fuori attorno: muri, vetri e soglie delle porte come
 * li avrebbe trovati il riconoscimento. Le stanze si riconoscono di nuovo e
 * ognuna ritrova la sua (quella salvata che le sta sotto di piu'): nome, area,
 * pavimento, pareti, dispositivi e arredi, spostati nelle nuove coordinate.
 *
 * Torna `{ griglia, casa, nomi, aree, finiture, dispositivi, arredi }`, o
 * `null` se il piano non ha una griglia.
 */
export function riprendiIlPiano(piano, { margine = 0.6 } = {}) {
  const W0 = Number(piano?.W) | 0,
    H0 = Number(piano?.H) | 0;
  if (!W0 || !H0 || !clean(piano?.griglia)) return null;
  const passo0 = Number(piano.passo) > 0 ? Number(piano.passo) : PASSO_SALVATO;
  const salvata = espandiGriglia(piano.griglia, W0 * H0);
  const r = ricampiona({ W: W0, H: H0, passo: passo0, tipo: salvata }, PASSO);
  const m = Math.max(2, Math.round(margine / PASSO)),
    W = r.W + 2 * m,
    H = r.H + 2 * m,
    N = W * H;
  const tipo = new Int16Array(N).fill(CELLA.fuori);
  for (let y = 0; y < r.H; y++)
    for (let x = 0; x < r.W; x++) tipo[(y + m) * W + x + m] = r.tipo[y * r.W + x];
  const muro = new Uint8Array(N),
    vetro = new Uint8Array(N),
    soglia = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (tipo[i] === CELLA.muro) muro[i] = 1;
    else if (tipo[i] === CELLA.davanzale) vetro[i] = 1;
    else if (tipo[i] === CELLA.porta) soglia[i] = 1;
  }
  /* la barriera: muri, vetri e soglie, ispessiti di una cella come nel
   * riconoscimento (una soglia storta lascia passaggi in diagonale) */
  const barriera = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (muro[i] || vetro[i] || soglia[i]) barriera[i] = 1;
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if ((vetro[i] || soglia[i]) && !muro[i])
        for (const j of [i - 1, i + 1, i - W, i + W]) barriera[j] = 1;
    }
  const griglia = { W, H, muro, barriera, vetro };
  const casa = riconosciDaFoto(griglia);
  /* ogni stanza nuova ritrova la sua: quella salvata che le sta sotto di piu' */
  const conti = new Map();
  for (let i = 0; i < N; i++) {
    const nuova = casa.tipo[i],
      vecchia = tipo[i];
    if (nuova > 0 && vecchia > 0) {
      const k = nuova * 256 + vecchia;
      conti.set(k, (conti.get(k) || 0) + 1);
    }
  }
  const migliore = new Map();
  for (const [k, n] of conti) {
    const nuova = Math.floor(k / 256),
      vecchia = k % 256;
    if (!migliore.has(nuova) || migliore.get(nuova).n < n) migliore.set(nuova, { vecchia, n });
  }
  const daA = new Map(); // id salvato -> id nuovo (la stanza piu' grande che lo prende)
  for (const [nuova, { vecchia, n }] of migliore)
    if (!daA.has(vecchia) || daA.get(vecchia).n < n) daA.set(vecchia, { nuova, n });
  const nomi = {},
    aree = {},
    finiture = {};
  for (const s of elenco(piano.stanze)) {
    const id = daA.get(Number(s?.id))?.nuova;
    if (!id) continue;
    if (clean(s.nome)) nomi[id] = clean(s.nome);
    if (clean(s.area)) aree[id] = clean(s.area);
    if (s.pavimento || s.pareti)
      finiture[id] = { pavimento: s.pavimento || null, pareti: colore(s.pareti) };
  }
  const dx = m * PASSO;
  const sposta = (o) => {
    const id = daA.get(Number(o?.stanza))?.nuova;
    if (!id || !Number.isFinite(o?.x) || !Number.isFinite(o?.y)) return [];
    return [{ ...o, stanza: id, x: tondo(o.x + dx), y: tondo(o.y + dx) }];
  };
  return {
    griglia,
    casa,
    nomi,
    aree,
    finiture,
    dispositivi: elenco(piano.dispositivi).flatMap(sposta),
    arredi: elenco(piano.arredi).flatMap(sposta),
  };
}
