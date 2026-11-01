/* La planimetria da un disegno CAD (DWG), senza il browser.
 *
 * LibreDWG legge il file e lo trasforma in un elenco di oggetti; qui quegli
 * oggetti diventano pezzi semplici — linee, campiture piene, scritte — in
 * unita' del disegno. Poi la procedura li disegna su una tela e la tela
 * passa per la stessa strada della foto di una planimetria, con la scala
 * gia' nota: nessun punto da toccare.
 *
 * Un disegno di architetto ha spesso tutti i piani uno accanto all'altro, le
 * quote, gli arredi, i cartigli. Le quote, gli arredi e le scritte non sono
 * muri e restano fuori; i piani si separano in gruppi, e si sceglie quale.
 */

/* Gli strati che non sono muri, dal nome: quote, arredi, testi. */
const STRATI_DA_SALTARE = /quot|dim|arred|furn|mobil|testi|text|cartig|retin|tratteg/i;
/* Le campiture che sono muri anche se non sono piene. */
const STRATI_DI_MURI = /tompagn|muri|muro|wall|murat|sezion|campit/i;
/* Gli infissi: le righe del vetro, che fanno capire le finestre. */
const STRATI_DI_INFISSI = /infiss|finestr|window|vetr|serrament|glaz/i;

/* Gli strati che di sicuro non sono muri: le cose viste sotto o sopra il
 * taglio (scale, rampe, sporti), le porte aperte, gli assi, i simboli. Lo
 * strato «0» in un disegno ordinato tiene le crocette e le linee d'aiuto. */
const STRATI_NON_MURI =
  /vist|proiez|scal|stair|rampa|ascens|lift|assi\b|asse\b|axis|simbol|symbol|arred|furn|quot|dim|defpoints|^0$/i;
/* Le porte: non sono muri, ma dicono dove un varco largo (un basculante,
 * un portone) e' un'apertura da chiudere. */
const STRATI_DI_PORTE = /port|door|basculant|serrand|cancell/i;

/**
 * Cosa disegna uno strato, dal nome: «muro» (i muri tagliati e le loro
 * campiture), «infisso» (finestre), «porta» (porte e basculanti), «altro»
 * (viste, proiezioni, scale, assi, simboli) o «forse» (un nome che non dice niente, come
 * «SANATORIA_DIFFORMI», che spesso tiene proprio dei tramezzi). Serve a non
 * far diventare muri le righe fitte delle scale.
 */
export function ruoloDelloStrato(nome) {
  const s = String(nome || "").trim();
  if (STRATI_DI_MURI.test(s)) return "muro";
  if (STRATI_DI_INFISSI.test(s)) return "infisso";
  if (STRATI_DI_PORTE.test(s)) return "porta";
  if (STRATI_NON_MURI.test(s)) return "altro";
  return "forse";
}
const TIPI_CHE_NON_SONO_MURI = new Set([
  "DIMENSION",
  "MULTILEADER",
  "LEADER",
  "POINT",
  "VIEWPORT",
  "INSERT",
  "ATTDEF",
  "ATTRIB",
  "IMAGE",
  "WIPEOUT",
]);
const SEGMENTI_PER_ARCO = 12;

/** Lo spazio del modello: il disegno vero, non i fogli di stampa. */
export function spazioDelModello(db) {
  const voci = db?.tables?.BLOCK_RECORD?.entries || [];
  const modello = voci.find((b) => /^\*model_space$/i.test(String(b?.name || "")));
  return modello ? String(modello.handle) : null;
}

const punto = (p) => (p && Number.isFinite(p.x) && Number.isFinite(p.y) ? [p.x, p.y] : null);

/* Una polilinea coi suoi archi (i «bulge») spezzati in segmenti. */
function polilinea(vertici, chiusa) {
  const v = (vertici || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  const out = [];
  for (let i = 0; i < v.length; i++) {
    const a = v[i],
      b = v[(i + 1) % v.length];
    out.push([a.x, a.y]);
    const ultimo = i === v.length - 1;
    if ((!ultimo || chiusa) && a.bulge) {
      const th = 4 * Math.atan(a.bulge),
        corda = Math.hypot(b.x - a.x, b.y - a.y);
      if (corda > 0 && Math.abs(Math.sin(th / 2)) > 1e-9) {
        const r = corda / (2 * Math.sin(th / 2)),
          mx = (a.x + b.x) / 2,
          my = (a.y + b.y) / 2,
          h = r * Math.cos(th / 2),
          nx = -(b.y - a.y) / corda,
          ny = (b.x - a.x) / corda,
          cx = mx + nx * h,
          cy = my + ny * h,
          a0 = Math.atan2(a.y - cy, a.x - cx),
          R = Math.abs(r);
        for (let k = 1; k < SEGMENTI_PER_ARCO; k++) {
          const t = a0 + (th * k) / SEGMENTI_PER_ARCO;
          out.push([cx + R * Math.cos(t), cy + R * Math.sin(t)]);
        }
      }
    }
  }
  if (chiusa && out.length) out.push(out[0]);
  return out;
}

function arco(c, r, da, a) {
  let fine = a;
  while (fine <= da) fine += 2 * Math.PI;
  const out = [];
  for (let k = 0; k <= SEGMENTI_PER_ARCO; k++) {
    const t = da + ((fine - da) * k) / SEGMENTI_PER_ARCO;
    out.push([c.x + r * Math.cos(t), c.y + r * Math.sin(t)]);
  }
  return out;
}

/* Il contorno di una campitura: lati diritti o polilinee. */
function contorni(e) {
  const out = [];
  for (const b of e.boundaryPaths || []) {
    if (Array.isArray(b.vertices) && b.vertices.length > 2) out.push(polilinea(b.vertices, true));
    else if (Array.isArray(b.edges)) {
      const pts = [];
      for (const ed of b.edges) {
        if (ed?.start && ed?.end) pts.push([ed.start.x, ed.start.y]);
        else if (ed?.center && Number.isFinite(ed.radius))
          pts.push(...arco(ed.center, ed.radius, ed.startAngle || 0, ed.endAngle || 0));
      }
      if (pts.length > 2) out.push(pts);
    }
  }
  return out;
}

/** Una scritta del disegno senza i codici di formato di MTEXT. */
export function scrittaPulita(testo) {
  return String(testo || "")
    .replace(/\\P/g, " ")
    .replace(/\\[A-Za-z][^;\\{}]*;/g, "")
    .replace(/\\[A-Za-z]/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* Una linea porta con se' il suo strato (per capire se e' un muro). */
const conStrato = (linea, strato) => Object.assign(linea, { strato });

/**
 * Dal disegno letto da LibreDWG ai pezzi: linee (spezzate), piene (campiture
 * di muri) e scritte, in unita' del disegno, col nord in alto come nel CAD.
 */
export function pezziDelDisegno(db) {
  const modello = spazioDelModello(db);
  const linee = [],
    piene = [],
    scritte = [];
  for (const e of db?.entities || []) {
    if (!e || e.isVisible === false) continue;
    if (modello && e.ownerBlockRecordSoftId && String(e.ownerBlockRecordSoftId) !== modello)
      continue;
    const strato = String(e.layer || "");
    if (e.type === "MTEXT" || e.type === "TEXT") {
      const t = scrittaPulita(e.text);
      const p = punto(e.insertionPoint || e.startPoint);
      if (t && p && !/^[\d.,\s+×x-]+$/.test(t)) scritte.push({ t, x: p[0], y: p[1] });
      continue;
    }
    if (TIPI_CHE_NON_SONO_MURI.has(e.type)) continue;
    if (STRATI_DA_SALTARE.test(strato)) continue;
    if (e.type === "LINE") {
      const a = punto(e.startPoint),
        b = punto(e.endPoint);
      if (a && b) linee.push(conStrato([a, b], strato));
    } else if (e.type === "LWPOLYLINE" || e.type === "POLYLINE2D" || e.type === "POLYLINE") {
      const p = polilinea(e.vertices, Boolean(e.flag & 1) || e.closed === true);
      if (p.length > 1) linee.push(conStrato(p, strato));
    } else if (e.type === "ARC" && e.center && Number.isFinite(e.radius)) {
      linee.push(conStrato(arco(e.center, e.radius, e.startAngle || 0, e.endAngle || 0), strato));
    } else if (e.type === "CIRCLE" && e.center && Number.isFinite(e.radius)) {
      linee.push(conStrato(arco(e.center, e.radius, 0, 2 * Math.PI - 1e-6), strato));
    } else if (e.type === "HATCH") {
      const piena =
        e.solidFill === 1 || e.solidFill === true || /^solid$/i.test(String(e.patternName || ""));
      if (!piena && !STRATI_DI_MURI.test(strato)) continue;
      for (const c of contorni(e)) piene.push(conStrato(c, strato));
    } else if (e.type === "SOLID") {
      const v = [e.corner1, e.corner2, e.corner4, e.corner3].map(punto).filter(Boolean);
      if (v.length >= 3) piene.push(conStrato(v, strato));
    }
  }
  return { linee, piene, scritte };
}

function riquadroDi(pts) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

/* La scala del disegno: l'unita' che da' a un piano una misura da casa.
 * L'intestazione ($INSUNITS) la dice, ma spesso mente: un disegno fatto in
 * metri dichiara i millimetri. Si prova prima quella dichiarata, poi le
 * solite, e vince la prima che fa una casa larga fra 4 e 80 metri. */
const UNITA = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1 };
export function metriPerUnita(larghezza, insunits) {
  const prove = [UNITA[insunits], 1, 0.01, 0.001, 0.0254, 0.3048].filter(Boolean);
  for (const f of prove) {
    const m = larghezza * f;
    if (m >= 4 && m <= 80) return f;
  }
  return larghezza > 400 ? 0.001 : larghezza > 80 ? 0.01 : 1;
}

/**
 * I piani del disegno: i pezzi si raccolgono in gruppi separati da spazio
 * vuoto (un disegno coi piani affiancati ne ha uno per piano). Tornano i
 * gruppi grandi, da sinistra a destra e dall'alto in basso, ognuno coi suoi
 * pezzi, le sue scritte e un nome preso dalle scritte se ne dice uno.
 */
export function pianiDelDisegno(pezzi, { insunits = 0 } = {}) {
  const tutti = [
    ...pezzi.linee.map((p) => ({ k: "l", p, r: riquadroDi(p) })),
    ...pezzi.piene.map((p) => ({ k: "p", p, r: riquadroDi(p) })),
  ].filter((o) => Number.isFinite(o.r.x0));
  if (!tutti.length) return [];
  /* La misura del disegno sul grosso dei pezzi: un cartiglio o una cornice
   * lontani mille metri non devono allargarla. */
  const xs = tutti.map((o) => (o.r.x0 + o.r.x1) / 2).sort((a, b) => a - b),
    ys = tutti.map((o) => (o.r.y0 + o.r.y1) / 2).sort((a, b) => a - b),
    q = (v, f) => v[Math.min(v.length - 1, Math.max(0, Math.floor(v.length * f)))];
  const lato = Math.max(q(xs, 0.98) - q(xs, 0.02), q(ys, 0.98) - q(ys, 0.02)) || 1;
  /* Due pezzi stanno nello stesso piano se distano meno di un centesimo del
   * disegno: i muri di un piano si toccano, fra un piano e l'altro c'e' il
   * vuoto di qualche metro. */
  const vicino = lato / 100,
    cella = vicino * 4;
  const padre = tutti.map((_, i) => i);
  const radice = (i) => (padre[i] === i ? i : (padre[i] = radice(padre[i])));
  const unisci = (a, b) => {
    const ra = radice(a),
      rb = radice(b);
    if (ra !== rb) padre[ra] = rb;
  };
  const celle = new Map();
  tutti.forEach((o, i) => {
    const cx0 = Math.floor((o.r.x0 - vicino) / cella),
      cx1 = Math.floor((o.r.x1 + vicino) / cella),
      cy0 = Math.floor((o.r.y0 - vicino) / cella),
      cy1 = Math.floor((o.r.y1 + vicino) / cella);
    if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > 400) return;
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cy = cy0; cy <= cy1; cy++) {
        const k = `${cx},${cy}`;
        const gia = celle.get(k);
        if (gia)
          for (const j of gia) {
            const q = tutti[j].r;
            if (
              q.x0 - vicino <= o.r.x1 &&
              o.r.x0 - vicino <= q.x1 &&
              q.y0 - vicino <= o.r.y1 &&
              o.r.y0 - vicino <= q.y1
            )
              unisci(i, j);
          }
        if (gia) gia.push(i);
        else celle.set(k, [i]);
      }
  });
  const gruppi = new Map();
  tutti.forEach((o, i) => {
    const r = radice(i);
    if (!gruppi.has(r)) gruppi.set(r, []);
    gruppi.get(r).push(o);
  });
  let piani = [...gruppi.values()].map((oggetti) => {
    const r = riquadroDi(
      oggetti.flatMap((o) => [
        [o.r.x0, o.r.y0],
        [o.r.x1, o.r.y1],
      ]),
    );
    return { ...r, oggetti };
  });
  /* Un piano e' fitto di pezzi; una cornice o una linea di terra che
   * racchiudono tutto sono grandi ma fatte di pochi tratti. */
  const piu = Math.max(...piani.map((p) => p.oggetti.length));
  piani = piani.filter((p) => p.oggetti.length >= Math.max(12, piu * 0.2));
  piani.sort((a, b) => (Math.abs(a.y1 - b.y1) > lato / 10 ? b.y1 - a.y1 : a.x0 - b.x0));
  return piani.map((p, i) => {
    const larghezza = p.x1 - p.x0,
      scala = metriPerUnita(Math.max(larghezza, p.y1 - p.y0), insunits);
    const dentro = pezzi.scritte.filter(
      (s) => s.x >= p.x0 && s.x <= p.x1 && s.y >= p.y0 && s.y <= p.y1,
    );
    /* Il titolo di un piano sta di solito appena sotto (o sopra) il disegno,
     * a volte spostato a sinistra: «PIANTA PIANO TERRA». */
    const w = p.x1 - p.x0,
      h = p.y1 - p.y0;
    const vicine = pezzi.scritte
      .filter(
        (s) =>
          s.x >= p.x0 - w * 0.4 &&
          s.x <= p.x1 &&
          (s.y < p.y0 ? p.y0 - s.y < h * 0.5 : s.y > p.y1 && s.y - p.y1 < h * 0.5),
      )
      .sort(
        (a, b) =>
          Math.min(Math.abs(a.y - p.y0), Math.abs(a.y - p.y1)) -
          Math.min(Math.abs(b.y - p.y0), Math.abs(b.y - p.y1)),
      );
    const linee = p.oggetti.filter((o) => o.k === "l").map((o) => o.p);
    const titolo =
      [...vicine, ...dentro].find((s) => /\b(pianta|piano|floor|level|plan)\b/i.test(s.t)) ||
      vicine.find((s) =>
        /terra|primo|second|seminterr|interrat|sottotett|attico|mansard|copertur/i.test(s.t),
      );
    return {
      n: i,
      x0: p.x0,
      y0: p.y0,
      x1: p.x1,
      y1: p.y1,
      metriPerUnita: scala,
      larghezzaMetri: larghezza * scala,
      profonditaMetri: (p.y1 - p.y0) * scala,
      nome: titolo ? titolo.t.slice(0, 40) : "",
      linee,
      piene: p.oggetti.filter((o) => o.k === "p").map((o) => o.p),
      scritte: dentro,
      /* I muri hanno il loro strato: si disegnano solo muri e infissi. */
      soloMuri: linee.filter((l) => ruoloDelloStrato(l.strato) === "muro").length >= 8,
    };
  });
}

/** Una scritta che sembra il nome di una stanza (non una quota, non un'area). */
export function eNomeDiStanza(t) {
  const s = String(t || "").trim();
  if (s.length < 2 || s.length > 32) return false;
  if (/\d+[.,]?\d*\s*(m2|mq|m²|m\b|cm)/i.test(s)) return false;
  if (/^(h|sup|s\.?u\.?|scala|n\.?|tav)\b/i.test(s)) return false;
  return /[a-zàèéìòù]{2,}/i.test(s);
}

/** Il nome scritto bene: «SALA D'ATTESA» diventa «Sala d'attesa». */
export function nomeDaScritta(t) {
  const s = String(t || "")
    .trim()
    .toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * I nomi delle stanze dalle scritte del disegno, sulla griglia della casa
 * riconosciuta (tipo: stanze 1..n, muri e fuori negativi). Una scritta che
 * cade su un muro o appena fuori va alla stanza piu' vicina entro un metro.
 * Se in una stanza cadono due scritte («bagno 2» e «disimpegno») il nome le
 * dice tutte e due: li' manca un muro, e cosi' si vede.
 *
 * scritte: [{ t, x, y }] in pixel della tela; lato: pixel per cella.
 */
export function nomiDalleScritte({ W, H, tipo, passo = 0.03 }, scritte, lato) {
  const raggio = Math.ceil(1 / passo);
  const stanzaVicina = (cx, cy) => {
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return 0;
    if (tipo[cy * W + cx] > 0) return tipo[cy * W + cx];
    for (let r = 1; r <= raggio; r++)
      for (let d = -r; d <= r; d++)
        for (const [x, y] of [
          [cx + d, cy - r],
          [cx + d, cy + r],
          [cx - r, cy + d],
          [cx + r, cy + d],
        ])
          if (x >= 0 && y >= 0 && x < W && y < H && tipo[y * W + x] > 0) return tipo[y * W + x];
    return 0;
  };
  const per = new Map();
  for (const s of scritte || []) {
    const id = stanzaVicina(Math.floor(s.x / lato), Math.floor(s.y / lato));
    if (!id) continue;
    const nomi = per.get(id) || [];
    if (!nomi.some((n) => n.toLowerCase() === s.t.toLowerCase())) nomi.push(s.t);
    per.set(id, nomi);
  }
  return Object.fromEntries([...per].map(([id, nomi]) => [id, nomi.join(" / ")]));
}

/**
 * Il nome di ripiego per una stanza senza nome: «Stanza 1», «Stanza 2»…
 * contando solo quelle senza nome e saltando i nomi gia' presi (il disegno
 * ha spesso una sua «stanza 2»).
 */
export function nomiDiRipiego(ids, presi, parola = "Stanza") {
  const usati = new Set(
    Object.values(presi || {}).flatMap((n) => String(n).toLowerCase().split(" / ")),
  );
  const fuori = {};
  let k = 0;
  for (const id of ids) {
    if (presi?.[id]) continue;
    let nome;
    do nome = `${parola} ${++k}`;
    while (usati.has(nome.toLowerCase()));
    usati.add(nome.toLowerCase());
    fuori[id] = nome;
  }
  return fuori;
}

/** Una scritta che dice uno spazio aperto: cortile, giardino, terrazzo… */
export function eNomeDiFuori(t) {
  return /cortil|giardin|terrazz|balcon|loggi|portic|patio|esterno|corte\b|area scoperta|scoperto|yard|garden|terrace|balcony|porch/i.test(
    String(t || ""),
  );
}
