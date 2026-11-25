// src/core/la-qualita-della-casa-3d.js
var PIXEL_AL_MASSIMO = 26e5;
var PIXEL_AL_MASSIMO_CON_MEMORIA = 42e5;
var SCHERMO_GRANDE = 5e5;
var POCA_MEMORIA = 2;
var MEMORIA_MEDIA = 4;
var POCHI_NUCLEI = 4;
var GRADINI_PER_LA_LENTEZZA = 4;
var numero = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
function memoriaDelDispositivo(nav) {
  try {
    const m = numero(nav?.deviceMemory);
    return m && m > 0 ? m : null;
  } catch (_errore) {
    return null;
  }
}
function nucleiDelDispositivo(nav) {
  try {
    const n = numero(nav?.hardwareConcurrency);
    return n && n > 0 ? n : null;
  } catch (_errore) {
    return null;
  }
}
function qualitaDellaCasa3D({
  dpr = 1,
  larghezza = 0,
  altezza = 0,
  memoria = null,
  cadute = 0,
  nuclei = null,
  lenta = 0,
  debole = false
} = {}) {
  const base = numero(dpr) && dpr > 0 ? dpr : 1;
  let pixel = Math.min(2, base);
  const mem = numero(memoria);
  const cpu = numero(nuclei);
  const poca = mem !== null && (mem <= POCA_MEMORIA || mem <= MEMORIA_MEDIA && cpu !== null && cpu <= POCHI_NUCLEI);
  const media = mem === null || mem <= MEMORIA_MEDIA;
  const giu = Math.max(0, Math.floor(numero(cadute) || 0));
  const area = Math.max(0, numero(larghezza) || 0) * Math.max(0, numero(altezza) || 0);
  const piano = debole === true;
  if (poca || giu > 0 || piano) pixel = Math.min(pixel, 1);
  else if (area >= SCHERMO_GRANDE) pixel = Math.min(pixel, 1.5);
  const tetto = media ? PIXEL_AL_MASSIMO : PIXEL_AL_MASSIMO_CON_MEMORIA;
  if (area > 0 && area * pixel * pixel > tetto)
    pixel = Math.max(Math.min(1, pixel), Math.sqrt(tetto / area));
  const antialias = !poca && giu === 0 && !piano;
  let ombra = piano ? 0 : giu >= 2 ? 512 : poca || giu === 1 ? 1024 : 2048;
  const passi = Math.min(GRADINI_PER_LA_LENTEZZA, Math.max(0, Math.floor(numero(lenta) || 0)));
  for (let i = 0; i < passi; i++) {
    if (pixel > 1.5) pixel = 1.5;
    else if (pixel > 1) pixel = 1;
    else if (ombra > 0) ombra = 0;
    else pixel = Math.min(pixel, 0.75);
  }
  pixel = Math.round(pixel * 100) / 100;
  return {
    pixel,
    antialias,
    ombra,
    leggera: pixel < Math.min(2, base) || !antialias || ombra < 2048,
    /* Materiali senza riflessi (Lambert invece di Standard): meno conti per
     * ogni punto dello schermo. Sulla grafica debole e dopo due cadute. */
    semplice: piano || giu >= 2,
    /* Il lato piu' lungo della tela del pavimento di un piano, in pixel: ogni
     * piano e' una trama, e a 2048 sono sedici mega di memoria grafica. */
    tela: piano || giu >= 1 ? 1024 : 2048
  };
}
var ATTESA_DEL_RITORNO_MS = 2500;
var CADUTE_AL_MASSIMO = 3;
var FINESTRA_DELLE_CADUTE_MS = 5 * 60 * 1e3;
function cosaFareDopoLaCaduta(prima = [], adesso = Date.now()) {
  const ora = numero(adesso) ?? 0;
  const cadute = (Array.isArray(prima) ? prima : []).map(numero).filter((t) => t !== null && ora - t < FINESTRA_DELLE_CADUTE_MS && t <= ora);
  cadute.push(ora);
  return { azione: cadute.length > CADUTE_AL_MASSIMO ? "basta" : "riprova", cadute };
}
var GRAZIA_DEL_RITORNO_MS = 5e3;
function laCadutaConta({ nascosta = false, tornataIl = 0, adesso = Date.now() } = {}) {
  if (nascosta === true) return false;
  const ora = numero(adesso) ?? 0;
  const tornata = numero(tornataIl) || 0;
  return !(tornata > 0 && ora >= tornata && ora - tornata < GRAZIA_DEL_RITORNO_MS);
}
function senzaLeCaduteDiAdesso(cadute = [], adesso = Date.now()) {
  const ora = numero(adesso) ?? 0;
  return (Array.isArray(cadute) ? cadute : []).map(numero).filter((t) => t !== null && !(t <= ora && ora - t < GRAZIA_DEL_RITORNO_MS));
}
var FOTOGRAMMI_DA_MISURARE = 8;
var TEMPO_DA_MISURARE_MS = 1200;
var FOTOGRAMMI_AL_SECONDO_MINIMI = 20;
var FOTOGRAMMI_AL_SECONDO_DA_FERMI = 5;
function fotogrammiLenti(intervalli = []) {
  const validi = (Array.isArray(intervalli) ? intervalli : []).map(numero).filter((t) => t !== null && t > 0);
  const tempo = validi.reduce((a, b) => a + b, 0);
  if (validi.length < FOTOGRAMMI_DA_MISURARE || tempo < TEMPO_DA_MISURARE_MS) return null;
  const ordinati = validi.slice().sort((a, b) => a - b);
  const mediana = ordinati[Math.floor(ordinati.length / 2)];
  if (mediana > 1e3 / FOTOGRAMMI_AL_SECONDO_DA_FERMI) return 2;
  return mediana > 1e3 / FOTOGRAMMI_AL_SECONDO_MINIMI ? 1 : 0;
}

// src/core/le-scritte-della-casa-3d.js
var MODI_DEI_NOMI = Object.freeze(["tutti", "accesi", "nessuno"]);
var NOMI_DI_SERIE = "tutti";
var CHIAVE_NOMI_CASA3D = "dm_casa3d_nomi";
var LATO_DEL_PALLINO = 22;
var STACCO = 3;
var CELLA = 48;
function modoDeiNomi(scritto) {
  const v = String(scritto ?? "").trim().toLowerCase();
  return MODI_DEI_NOMI.includes(v) ? v : NOMI_DI_SERIE;
}
function modoDopo(modo) {
  const i = MODI_DEI_NOMI.indexOf(modoDeiNomi(modo));
  return MODI_DEI_NOMI[(i + 1) % MODI_DEI_NOMI.length];
}
var PASSI_AL_MASSIMO = 4;
function postiDelPallino(lato, stacco) {
  const s = lato + stacco;
  const posti = [];
  for (let j = -PASSI_AL_MASSIMO; j <= 1; j++)
    for (let i = -PASSI_AL_MASSIMO; i <= PASSI_AL_MASSIMO; i++) posti.push([i, j]);
  const peso = ([i, j]) => i * i + j * j + (j > 0 ? 2.5 : 0);
  return posti.sort((a, b) => peso(a) - peso(b) || Math.abs(a[0]) - Math.abs(b[0]) || b[0] - a[0]).map(([i, j]) => [i * s, j * s]);
}
function creaGriglia() {
  const celle = /* @__PURE__ */ new Map();
  const giro = (r, fai) => {
    const cx0 = Math.floor(r.x0 / CELLA);
    const cx1 = Math.floor(r.x1 / CELLA);
    const cy0 = Math.floor(r.y0 / CELLA);
    const cy1 = Math.floor(r.y1 / CELLA);
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) if (fai(`${cx},${cy}`) === true) return true;
    return false;
  };
  return {
    metti(r) {
      giro(r, (k) => {
        const qui = celle.get(k);
        if (qui) qui.push(r);
        else celle.set(k, [r]);
      });
    },
    tocca(r, stacco) {
      return giro(
        r,
        (k) => (celle.get(k) || []).some(
          (m) => r.x0 < m.x1 + stacco && m.x0 < r.x1 + stacco && r.y0 < m.y1 + stacco && m.y0 < r.y1 + stacco
        )
      );
    }
  };
}
var numero2 = (v, altrimenti = 0) => Number.isFinite(Number(v)) ? Number(v) : altrimenti;
function chiPrendeLaScritta(voci, opzioni = {}) {
  const elenco = Array.isArray(voci) ? voci : [];
  const modo = modoDeiNomi(opzioni.modo);
  const lato = numero2(opzioni.lato, LATO_DEL_PALLINO);
  const stacco = numero2(opzioni.stacco, STACCO);
  const vuolePiena = (v) => Boolean(v?.primo) || modo === "tutti" || modo === "accesi" && Boolean(v?.acceso);
  const ordine = elenco.map((v, i) => ({
    i,
    primo: v?.primo ? 1 : 0,
    piena: vuolePiena(v) ? 1 : 0,
    priorita: numero2(v?.priorita),
    distanza: numero2(v?.distanza, Infinity)
  })).sort(
    (a, b) => b.primo - a.primo || b.piena - a.piena || b.priorita - a.priorita || a.distanza - b.distanza || a.i - b.i
  );
  const griglia = creaGriglia();
  for (const o of Array.isArray(opzioni.ostacoli) ? opzioni.ostacoli : []) {
    const r = { x0: numero2(o?.x0), y0: numero2(o?.y0), x1: numero2(o?.x1), y1: numero2(o?.y1) };
    if (r.x1 > r.x0 && r.y1 > r.y0) griglia.metti(r);
  }
  const posti = postiDelPallino(lato, stacco);
  const esito = new Array(elenco.length);
  for (const o of ordine) {
    const v = elenco[o.i] || {};
    const x = numero2(v.x);
    const y = numero2(v.y);
    if (o.piena) {
      const w = Math.max(0, numero2(v.w));
      const h = Math.max(0, numero2(v.h));
      const r2 = { x0: x - w / 2, x1: x + w / 2, y0: y - h, y1: y };
      if (o.primo || !griglia.tocca(r2, stacco)) {
        griglia.metti(r2);
        esito[o.i] = { piena: true, dx: 0, dy: 0 };
        continue;
      }
    }
    let scelto = posti[0];
    let r = null;
    for (const posto of posti) {
      const prova = {
        x0: x + posto[0] - lato / 2,
        x1: x + posto[0] + lato / 2,
        y0: y + posto[1] - lato,
        y1: y + posto[1]
      };
      if (!griglia.tocca(prova, stacco)) {
        scelto = posto;
        r = prova;
        break;
      }
    }
    if (!r) r = { x0: x - lato / 2, x1: x + lato / 2, y0: y - lato, y1: y };
    griglia.metti(r);
    esito[o.i] = { piena: false, dx: scelto[0], dy: scelto[1] };
  }
  return esito;
}

export {
  CHIAVE_NOMI_CASA3D,
  LATO_DEL_PALLINO,
  modoDeiNomi,
  modoDopo,
  chiPrendeLaScritta,
  GRADINI_PER_LA_LENTEZZA,
  memoriaDelDispositivo,
  nucleiDelDispositivo,
  qualitaDellaCasa3D,
  ATTESA_DEL_RITORNO_MS,
  cosaFareDopoLaCaduta,
  laCadutaConta,
  senzaLeCaduteDiAdesso,
  fotogrammiLenti
};
