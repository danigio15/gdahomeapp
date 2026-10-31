/* «Casa 3D»: gli arredi e i dispositivi, fatti di forme semplici.
 *
 * Ogni pezzo e' un piccolo modello in metri, con l'origine al centro della
 * sua impronta sul pavimento e il davanti verso +z. `w` e `d` del catalogo
 * sono l'ingombro, per trovargli posto e per non farlo entrare in un altro.
 *
 * I dispositivi (le chiavi di DISPOSITIVI_3D: luce, telecamera, ...) hanno
 * invece l'origine nel punto dove sono montati: la scena li mette all'altezza
 * giusta (`h`), girati col dorso verso il muro (-z).
 *
 * three non si importa qui: arriva da chi chiama, cosi' il modulo si legge
 * anche dove three non c'e' (le prove, il catalogo nella pagina) e la
 * libreria si scarica solo quando la casa si apre davvero.
 */

/* Il catalogo: [chiave, icona, nome, name, larghezza, profondita']. */
export const CATALOGO_ARREDI = Object.freeze([
  {
    k: "soggiorno",
    nome: ["Soggiorno", "Living room"],
    voci: [
      ["divano", "🛋️", "Divano 3 posti", "3-seat sofa", 2.2, 0.95],
      ["angolare", "🛋️", "Divano angolare", "Corner sofa", 2.7, 1.9],
      ["poltrona", "💺", "Poltrona", "Armchair", 0.85, 0.85],
      ["tavolino", "☕", "Tavolino", "Coffee table", 1.1, 0.6],
      ["tv", "📺", "Mobile TV", "TV stand", 1.9, 0.45],
      ["libreria", "📚", "Libreria", "Bookcase", 1.6, 0.38],
      ["tappeto", "🟫", "Tappeto", "Rug", 2.4, 1.7],
      ["stelo", "💡", "Lampada a stelo", "Floor lamp", 0.4, 0.4],
      ["camino", "🔥", "Camino", "Fireplace", 1.4, 0.5],
      ["pianta", "🪴", "Pianta", "Plant", 0.5, 0.5],
      ["madia", "🗄️", "Madia", "Sideboard", 1.8, 0.45],
      ["pensile", "🔲", "Pensile", "Wall cabinet", 1.6, 0.36],
      ["quadro", "🖼️", "Quadro", "Painting", 1.4, 0.06],
    ],
  },
  {
    k: "cucina",
    nome: ["Pranzo e cucina", "Dining and kitchen"],
    voci: [
      ["pranzo6", "🍽️", "Tavolo 6 posti", "6-seat table", 1.9, 1.6],
      ["tondo4", "⭕", "Tavolo tondo", "Round table", 1.4, 1.4],
      ["cucina", "🍳", "Cucina lineare", "Kitchen run", 3.0, 0.65],
      ["isola", "🏝️", "Isola con sgabelli", "Island with stools", 1.8, 1.4],
      ["frigo", "🧊", "Frigorifero doppio", "Double fridge", 0.92, 0.72],
    ],
  },
  {
    k: "camera",
    nome: ["Camera", "Bedroom"],
    voci: [
      ["matrimoniale", "🛏️", "Letto matrimoniale", "Double bed", 1.75, 2.15],
      ["singolo", "🛏️", "Letto singolo", "Single bed", 0.95, 2.05],
      ["comodino", "🗄️", "Comodino", "Bedside table", 0.5, 0.42],
      ["armadio", "🚪", "Armadio", "Wardrobe", 2.2, 0.62],
      ["cassettiera", "🗃️", "Cassettiera", "Chest of drawers", 1.1, 0.5],
      ["culla", "👶", "Lettino", "Cot", 0.75, 1.3],
    ],
  },
  {
    k: "bagno",
    nome: ["Bagno", "Bathroom"],
    voci: [
      ["vasca", "🛁", "Vasca", "Bathtub", 1.7, 0.75],
      ["doccia", "🚿", "Doccia", "Shower", 0.9, 0.9],
      ["wc", "🚽", "WC sospeso", "Toilet", 0.4, 0.55],
      ["bidet", "🚰", "Bidet", "Bidet", 0.4, 0.55],
      ["lavabo", "🪥", "Mobile lavabo", "Vanity unit", 0.9, 0.48],
      ["lavatrice", "🫧", "Lavatrice", "Washing machine", 0.62, 0.6],
    ],
  },
  {
    k: "studio",
    nome: ["Studio e altro", "Study and more"],
    voci: [
      ["scrivania", "🖥️", "Scrivania", "Desk", 1.5, 0.75],
      ["ufficio", "🪑", "Sedia da ufficio", "Office chair", 0.6, 0.6],
      ["pianoforte", "🎹", "Pianoforte", "Piano", 1.5, 0.6],
      ["cyclette", "🚴", "Cyclette", "Exercise bike", 0.6, 1.1],
    ],
  },
]);

/** Ogni voce del catalogo per chiave: { k, icona, nome: [it, en], w, d }. */
export const VOCI_ARREDI = Object.freeze(
  Object.fromEntries(
    CATALOGO_ARREDI.flatMap((g) =>
      g.voci.map(([k, icona, it, en, w, d]) => [k, Object.freeze({ k, icona, nome: [it, en], w, d, gruppo: g.k })]),
    ),
  ),
);

/* Gli arredi che stanno a terra sotto gli altri (un tappeto) o appesi al
 * muro sopra gli altri (un pensile, un quadro): non si scontrano. */
export const ARREDI_SOTTO = Object.freeze(["tappeto", "pensile", "quadro"]);

/* I tessuti che si possono cambiare. */
export const CON_TESSUTO = /divano|angolare|poltrona|matrimoniale|singolo|tappeto|isola|cyclette/;

/* Il modello di ogni tipo di dispositivo della casa. */
const MODELLO_DEL_DISPOSITIVO = Object.freeze({
  luce: "faretto",
  telecamera: "cam_dome",
  tapparella: "contatto",
  finestra: "contatto",
  porta: "contatto",
  movimento: "pir",
  antifurto: "pir",
  presenza: "presenza",
  termometro: "termo",
  clima: "split",
  termostato: "termostato",
  fumo: "fumo",
  acqua: "acqua",
  presa: "presa",
  tv: "televisore",
  altoparlante: "altoparlante",
  pannello: "pannello",
});

export const modelloDelDispositivo = (k) => MODELLO_DEL_DISPOSITIVO[k] || "";

/* I materiali di tutti i giorni, uno per tipo e per libreria. */
const COMUNI = new WeakMap();

function comuni(THREE) {
  let c = COMUNI.get(THREE);
  if (c) return c;
  const M = (colore, o = {}) => new THREE.MeshStandardMaterial({ color: colore, roughness: 0.75, metalness: 0, ...o });
  c = {
    M,
    legnoChiaro: M("#c8a27a"),
    legnoScuro: M("#6b4a32"),
    bianco: M("#f4f1ea", { roughness: 0.5 }),
    laccato: M("#e8e4dc", { roughness: 0.35 }),
    metallo: M("#2b2f36", { metalness: 0.6, roughness: 0.4 }),
    acciaio: M("#c7ccd3", { metalness: 0.7, roughness: 0.25 }),
    ceramica: M("#fbfbfa", { roughness: 0.2 }),
    nero: M("#0b1220", { roughness: 0.15 }),
    vetro: new THREE.MeshPhysicalMaterial({ color: "#d6ecff", transmission: 0.6, transparent: true, opacity: 0.35, roughness: 0.05 }),
  };
  COMUNI.set(THREE, c);
  return c;
}

/**
 * Il modello di un arredo del catalogo, o di un dispositivo della casa.
 * Torna un THREE.Group; `userData.occhio` (le telecamere) e' il punto da cui
 * guardano, `userData.lampada` (i punti luce) il pezzo che si accende.
 */
export function arredo3D(THREE, k, tinta = "#64748b") {
  const { M, legnoChiaro, legnoScuro, bianco, laccato, metallo, acciaio, ceramica, nero, vetro } = comuni(THREE);
  const g = new THREE.Group();
  const tela = /^#[0-9a-f]{6}$/i.test(String(tinta || "")) ? tinta : "#64748b";
  const stoffa = M(tela, { roughness: 0.95 });
  const scatola = (dove, w, h, d, m, x = 0, y = 0, z = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y + h / 2, z);
    b.castShadow = b.receiveShadow = true;
    dove.add(b);
    return b;
  };
  const cilindro = (dove, r, h, m, x = 0, y = 0, z = 0, seg = 18, r2 = r) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, seg), m);
    c.position.set(x, y + h / 2, z);
    c.castShadow = true;
    dove.add(c);
    return c;
  };
  const gambe = (dove, w, d, h, m, r = 0.025, dentro = 0.06) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cilindro(dove, r, h, m, sx * (w / 2 - dentro), 0, sz * (d / 2 - dentro), 8);
  };
  const lucina = (dove, colore, r, x, y, z) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), M(colore, { emissive: colore, emissiveIntensity: 2 }));
    l.position.set(x, y, z);
    dove.add(l);
    return l;
  };
  const sedia = (ruote) => {
    const s = new THREE.Group();
    if (ruote) {
      cilindro(s, 0.25, 0.04, metallo, 0, 0.04, 0, 5);
      cilindro(s, 0.025, 0.42, metallo, 0, 0.06, 0, 8);
      scatola(s, 0.5, 0.08, 0.48, M("#1e293b"), 0, 0.46);
      scatola(s, 0.46, 0.55, 0.06, M("#1e293b"), 0, 0.55, -0.24);
      return s;
    }
    scatola(s, 0.44, 0.05, 0.44, legnoChiaro, 0, 0.45);
    gambe(s, 0.42, 0.42, 0.45, legnoScuro, 0.015, 0.03);
    scatola(s, 0.42, 0.42, 0.04, legnoChiaro, 0, 0.5, -0.2);
    return s;
  };
  const chiave = MODELLO_DEL_DISPOSITIVO[k] || k;
  switch (chiave) {
    /* ── soggiorno ── */
    case "divano":
      scatola(g, 2.2, 0.42, 0.95, stoffa, 0, 0.08);
      scatola(g, 2.2, 0.45, 0.2, stoffa, 0, 0.42, -0.37);
      for (const s of [-1, 1]) scatola(g, 0.18, 0.25, 0.95, stoffa, s * 1.01, 0.42);
      for (let i = -1; i <= 1; i++) scatola(g, 0.66, 0.12, 0.7, M(tela, { roughness: 1 }), i * 0.68, 0.5, 0.08);
      gambe(g, 2.1, 0.85, 0.08, metallo, 0.02);
      break;
    case "angolare":
      scatola(g, 2.7, 0.42, 0.95, stoffa, 0, 0.08, -0.47);
      scatola(g, 0.95, 0.42, 0.95, stoffa, 0.87, 0.08, 0.47);
      scatola(g, 2.7, 0.45, 0.2, stoffa, 0, 0.42, -0.85);
      scatola(g, 0.2, 0.45, 1.9, stoffa, 1.25, 0.42, 0);
      for (let i = 0; i < 3; i++) scatola(g, 0.7, 0.12, 0.66, M(tela, { roughness: 1 }), -0.9 + i * 0.72, 0.5, -0.4);
      break;
    case "poltrona":
      scatola(g, 0.85, 0.4, 0.85, stoffa, 0, 0.12);
      scatola(g, 0.85, 0.45, 0.18, stoffa, 0, 0.52, -0.33);
      for (const s of [-1, 1]) scatola(g, 0.14, 0.22, 0.85, stoffa, s * 0.355, 0.52);
      gambe(g, 0.8, 0.8, 0.12, legnoScuro, 0.02);
      break;
    case "tavolino":
      scatola(g, 1.1, 0.05, 0.6, legnoChiaro, 0, 0.38);
      gambe(g, 1.1, 0.6, 0.38, metallo, 0.02);
      break;
    case "tv":
      scatola(g, 1.9, 0.45, 0.45, laccato, 0, 0.12);
      gambe(g, 1.8, 0.4, 0.12, metallo, 0.015);
      scatola(g, 1.45, 0.84, 0.05, nero, 0, 0.62, -0.12);
      scatola(g, 0.3, 0.05, 0.2, metallo, 0, 0.57, -0.1);
      break;
    case "libreria": {
      scatola(g, 1.6, 2.1, 0.38, bianco);
      const dorsi = ["#b91c1c", "#1d4ed8", "#ca8a04", "#15803d", "#334155"].map((c) => M(c));
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 7; j++) if ((i * 7 + j) % 3) scatola(g, 0.12 + (j % 3) * 0.03, 0.28, 0.24, dorsi[(i + j) % 5], -0.62 + j * 0.2, 0.1 + i * 0.4, 0.04);
      break;
    }
    case "tappeto":
      scatola(g, 2.4, 0.015, 1.7, M(tela, { roughness: 1 }));
      scatola(g, 2.1, 0.017, 1.4, M("#e7dccb", { roughness: 1 }));
      break;
    case "stelo":
      cilindro(g, 0.16, 0.03, metallo);
      cilindro(g, 0.015, 1.55, metallo, 0, 0.03);
      cilindro(g, 0.12, 0.28, M("#f5ead6", { emissive: "#ffcf8a", emissiveIntensity: 0.6 }), 0, 1.5, 0, 18, 0.2);
      break;
    case "camino":
      scatola(g, 1.4, 1.1, 0.5, M("#d6d0c4"));
      scatola(g, 0.8, 0.55, 0.1, M("#111827"), 0, 0.15, 0.21);
      scatola(g, 1.6, 0.08, 0.6, M("#9a8f80"), 0, 1.1);
      scatola(g, 0.5, 0.18, 0.06, M("#f97316", { emissive: "#f97316", emissiveIntensity: 1.2 }), 0, 0.2, 0.25);
      break;
    case "pianta": {
      cilindro(g, 0.2, 0.4, M("#b45309"), 0, 0, 0, 14, 0.15);
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), M("#3f7d4f", { flatShading: true }));
      f.position.y = 0.95;
      f.castShadow = true;
      g.add(f);
      break;
    }
    case "madia":
      scatola(g, 1.1, 0.6, 0.45, M("#8b5d37", { roughness: 0.6 }), -0.35, 0);
      scatola(g, 0.7, 0.42, 0.45, M("#e2dccb", { roughness: 0.3 }), 0.55, 0.08);
      scatola(g, 1.8, 0.2, 0.43, bianco, 0, 0.66);
      break;
    case "pensile":
      scatola(g, 1.6, 0.36, 0.36, M(tela === "#64748b" ? "#9d958b" : tela, { roughness: 0.4 }), 0, 1.95);
      break;
    case "quadro": {
      scatola(g, 1.4, 1.0, 0.04, M("#d6d3d1"), 0, 1.45, -0.01);
      const c = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6"];
      for (let i = 0; i < 4; i++) scatola(g, 1.3, 0.22, 0.01, M(c[i]), 0, 1.52 + i * 0.22, 0.015);
      break;
    }
    /* ── pranzo e cucina ── */
    case "pranzo6":
      scatola(g, 1.9, 0.05, 0.95, legnoChiaro, 0, 0.72);
      gambe(g, 1.85, 0.9, 0.72, legnoScuro, 0.03, 0.1);
      for (const [x, z, r] of [[-0.55, -0.68, 0], [0, -0.68, 0], [0.55, -0.68, 0], [-0.55, 0.68, Math.PI], [0, 0.68, Math.PI], [0.55, 0.68, Math.PI]]) {
        const s = sedia();
        s.position.set(x, 0, z);
        s.rotation.y = r;
        g.add(s);
      }
      break;
    case "tondo4":
      cilindro(g, 0.6, 0.05, legnoChiaro, 0, 0.72, 0, 32);
      cilindro(g, 0.05, 0.72, metallo);
      for (let i = 0; i < 4; i++) {
        const s = sedia();
        const a = (i / 4) * Math.PI * 2;
        s.position.set(Math.sin(a) * 0.72, 0, Math.cos(a) * 0.72);
        s.rotation.y = a + Math.PI;
        g.add(s);
      }
      break;
    case "cucina": {
      scatola(g, 2.1, 0.86, 0.62, laccato, -0.45, 0.04);
      scatola(g, 2.12, 0.04, 0.64, M("#475569", { roughness: 0.3 }), -0.45, 0.9);
      scatola(g, 0.6, 2.2, 0.62, laccato, 1.2, 0);
      scatola(g, 2.1, 0.7, 0.35, laccato, -0.45, 1.5, -0.13);
      cilindro(g, 0.2, 0.01, M("#111111"), -0.9, 0.94, 0.05, 20);
      cilindro(g, 0.2, 0.01, M("#111111"), -0.45, 0.94, 0.05, 20);
      scatola(g, 0.5, 0.02, 0.4, acciaio, 0.2, 0.93, 0);
      for (let i = 0; i < 4; i++) scatola(g, 0.01, 0.6, 0.02, metallo, -1.3 + i * 0.55, 0.15, 0.31);
      break;
    }
    case "isola":
      scatola(g, 1.8, 0.88, 0.9, laccato, 0, 0.02, -0.25);
      scatola(g, 1.9, 0.04, 1.2, M("#e5e7eb", { roughness: 0.2 }), 0, 0.9, -0.1);
      for (const x of [-0.6, 0, 0.6]) {
        cilindro(g, 0.18, 0.04, M(tela), x, 0.72, 0.5);
        cilindro(g, 0.02, 0.72, metallo, x, 0, 0.5, 8);
      }
      break;
    case "frigo":
      scatola(g, 0.92, 1.8, 0.72, acciaio);
      scatola(g, 0.005, 1.7, 0.01, metallo, 0, 0.05, 0.36);
      for (const s of [-1, 1]) scatola(g, 0.02, 0.5, 0.03, metallo, s * 0.06, 0.9, 0.38);
      break;
    /* ── camera ── */
    case "matrimoniale":
      scatola(g, 1.75, 0.3, 2.1, legnoChiaro, 0, 0.08);
      scatola(g, 1.65, 0.22, 2.0, M("#f8fafc"), 0, 0.38);
      scatola(g, 1.68, 0.06, 1.35, stoffa, 0, 0.58, 0.32);
      scatola(g, 1.8, 1.0, 0.1, stoffa, 0, 0.08, -1.05);
      for (const s of [-1, 1]) scatola(g, 0.65, 0.14, 0.4, M("#ffffff"), s * 0.42, 0.6, -0.72);
      break;
    case "singolo":
      scatola(g, 0.95, 0.3, 2.0, legnoChiaro, 0, 0.08);
      scatola(g, 0.88, 0.2, 1.92, M("#f8fafc"), 0, 0.38);
      scatola(g, 0.9, 0.06, 1.3, stoffa, 0, 0.56, 0.3);
      scatola(g, 1.0, 0.8, 0.08, legnoChiaro, 0, 0.08, -1.0);
      scatola(g, 0.6, 0.12, 0.35, M("#ffffff"), 0, 0.58, -0.7);
      break;
    case "comodino":
      scatola(g, 0.5, 0.48, 0.42, legnoChiaro);
      scatola(g, 0.44, 0.01, 0.01, metallo, 0, 0.3, 0.21);
      cilindro(g, 0.08, 0.28, M("#f5ead6", { emissive: "#ffcf8a", emissiveIntensity: 0.5 }), 0.1, 0.48, -0.05, 14, 0.11);
      break;
    case "armadio":
      scatola(g, 2.2, 2.4, 0.62, laccato);
      for (let i = 1; i < 4; i++) scatola(g, 0.006, 2.3, 0.01, M("#cbd5e1"), -1.1 + i * 0.55, 0.05, 0.31);
      for (let i = 0; i < 4; i++) scatola(g, 0.02, 0.4, 0.03, metallo, -0.9 + i * 0.55 + (i % 2 ? -0.1 : 0.1), 1.0, 0.33);
      break;
    case "cassettiera":
      scatola(g, 1.1, 0.85, 0.5, legnoChiaro);
      for (let i = 0; i < 3; i++) scatola(g, 1.04, 0.005, 0.01, legnoScuro, 0, 0.27 + i * 0.27, 0.25);
      break;
    case "culla":
      scatola(g, 0.75, 0.3, 1.3, bianco, 0, 0.35);
      for (let i = 0; i < 9; i++) for (const s of [-1, 1]) cilindro(g, 0.015, 0.5, bianco, s * 0.36, 0.6, -0.6 + i * 0.15, 6);
      gambe(g, 0.7, 1.25, 0.35, bianco, 0.025, 0.03);
      break;
    /* ── bagno ── */
    case "vasca":
      scatola(g, 1.7, 0.55, 0.75, ceramica);
      scatola(g, 1.5, 0.02, 0.55, M("#bfe3f5", { roughness: 0.05 }), 0, 0.5);
      cilindro(g, 0.02, 0.2, acciaio, 0.7, 0.55, -0.3, 8);
      break;
    case "doccia":
      scatola(g, 0.9, 0.04, 0.9, ceramica);
      scatola(g, 0.9, 1.95, 0.01, vetro, 0, 0.04, 0.45);
      scatola(g, 0.01, 1.95, 0.9, vetro, 0.45, 0.04, 0);
      cilindro(g, 0.12, 0.01, acciaio, -0.3, 1.95, -0.3, 16);
      cilindro(g, 0.012, 0.3, acciaio, -0.3, 1.95, -0.38, 6);
      break;
    case "wc":
      scatola(g, 0.36, 0.38, 0.5, ceramica, 0, 0.2, 0.05);
      scatola(g, 0.4, 0.8, 0.12, ceramica, 0, 0, -0.22);
      scatola(g, 0.2, 0.01, 0.1, acciaio, 0, 0.8, -0.16);
      break;
    case "bidet":
      scatola(g, 0.36, 0.36, 0.5, ceramica, 0, 0.2, 0.05);
      scatola(g, 0.4, 0.6, 0.1, ceramica, 0, 0, -0.22);
      cilindro(g, 0.015, 0.12, acciaio, 0, 0.56, -0.12, 8);
      break;
    case "lavabo":
      scatola(g, 0.9, 0.5, 0.48, legnoChiaro, 0, 0.35);
      scatola(g, 0.92, 0.12, 0.5, ceramica, 0, 0.85);
      cilindro(g, 0.015, 0.2, acciaio, 0, 0.97, -0.15, 8);
      scatola(g, 0.8, 0.8, 0.02, M("#dbeafe", { metalness: 0.9, roughness: 0.05 }), 0, 1.3, -0.24);
      break;
    case "lavatrice": {
      scatola(g, 0.6, 0.85, 0.6, M("#f8fafc", { roughness: 0.3 }));
      const oblo = new THREE.Mesh(new THREE.CircleGeometry(0.2, 28), M("#334155", { roughness: 0.1 }));
      oblo.position.set(0, 0.42, 0.301);
      g.add(oblo);
      scatola(g, 0.5, 0.06, 0.01, M("#94a3b8"), 0, 0.74, 0.3);
      break;
    }
    /* ── studio ── */
    case "scrivania": {
      scatola(g, 1.5, 0.04, 0.75, legnoChiaro, 0, 0.72);
      gambe(g, 1.45, 0.7, 0.72, metallo, 0.02);
      scatola(g, 0.6, 0.38, 0.03, nero, 0, 0.92, -0.25);
      scatola(g, 0.1, 0.18, 0.08, metallo, 0, 0.76, -0.25);
      const s = sedia(true);
      s.position.set(0, 0, 0.6);
      s.rotation.y = Math.PI;
      g.add(s);
      break;
    }
    case "ufficio":
      g.add(sedia(true));
      break;
    case "pianoforte":
      scatola(g, 1.5, 1.25, 0.6, M("#0b0b0f", { roughness: 0.15 }));
      scatola(g, 1.4, 0.04, 0.25, M("#f8fafc"), 0, 0.72, 0.4);
      scatola(g, 1.0, 0.45, 0.3, M("#0b0b0f", { roughness: 0.15 }), 0, 0, 0.75);
      break;
    case "cyclette": {
      scatola(g, 0.12, 0.08, 1.0, metallo, 0, 0);
      cilindro(g, 0.03, 0.8, metallo, 0, 0.05, 0.25, 8);
      scatola(g, 0.22, 0.06, 0.28, M("#111111"), 0, 0.85, 0.25);
      cilindro(g, 0.03, 1.0, metallo, 0, 0.05, -0.35, 8);
      scatola(g, 0.5, 0.04, 0.05, metallo, 0, 1.05, -0.35);
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 20), M(tela));
      r.rotation.y = Math.PI / 2;
      r.position.set(0, 0.3, -0.1);
      g.add(r);
      break;
    }

    /* ── i dispositivi: l'origine e' il punto di montaggio ── */
    case "faretto": {
      /* il punto luce: il rosone sul soffitto e la lampadina che si accende */
      cilindro(g, 0.09, 0.03, bianco, 0, 0.02, 0, 20);
      cilindro(g, 0.008, 0.18, metallo, 0, -0.16, 0, 6);
      const lampada = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 16, 12),
        new THREE.MeshStandardMaterial({ color: "#fff7e6", emissive: "#ffc98a", emissiveIntensity: 0 }),
      );
      lampada.position.y = -0.22;
      g.add(lampada);
      g.userData.lampada = lampada;
      break;
    }
    case "cam_dome": {
      cilindro(g, 0.09, 0.03, bianco, 0, 0.04, 0, 24);
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M("#0f172a", { roughness: 0.1 }));
      d.rotation.x = Math.PI;
      d.position.set(0, 0.04, 0);
      g.add(d);
      lucina(g, "#ef4444", 0.012, 0, 0.02, 0.07);
      g.userData.occhio = new THREE.Vector3(0, -0.03, 0.05);
      break;
    }
    case "cam_bullet": {
      scatola(g, 0.06, 0.12, 0.05, bianco, 0, -0.02, -0.06);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 16), bianco);
      c.rotation.x = Math.PI / 2 + 0.45;
      c.position.set(0, 0.04, 0.06);
      c.castShadow = true;
      g.add(c);
      const v = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), M("#0f172a", { roughness: 0.05 }));
      v.position.set(0, -0.01, 0.165);
      v.rotation.x = -0.45;
      g.add(v);
      lucina(g, "#ef4444", 0.01, 0.03, 0.09, 0.12);
      g.userData.occhio = new THREE.Vector3(0, 0, 0.17);
      break;
    }
    case "pir": {
      scatola(g, 0.09, 0.11, 0.05, bianco, 0, -0.05, -0.02);
      const lente = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M("#e5e7eb", { roughness: 0.2 }));
      lente.rotation.x = Math.PI / 2;
      lente.position.set(0, 0, 0.005);
      g.add(lente);
      break;
    }
    case "presenza":
      cilindro(g, 0.06, 0.025, bianco, 0, -0.025);
      lucina(g, "#22c55e", 0.01, 0.03, -0.03, 0);
      break;
    case "contatto":
      scatola(g, 0.03, 0.09, 0.025, bianco, -0.03, -0.05, -0.01);
      scatola(g, 0.03, 0.05, 0.02, bianco, 0.03, -0.03, -0.01);
      break;
    case "termo": {
      scatola(g, 0.09, 0.09, 0.025, bianco, 0, -0.045, -0.01);
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.035), M("#0f172a", { emissive: "#38bdf8", emissiveIntensity: 0.35 }));
      sc.position.set(0, 0.005, 0.004);
      g.add(sc);
      break;
    }
    case "termostato": {
      cilindro(g, 0.055, 0.03, bianco, 0, -0.015, -0.005, 24).rotation.x = Math.PI / 2;
      const sc = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), M("#0f172a", { emissive: "#f97316", emissiveIntensity: 0.45 }));
      sc.position.set(0, 0, 0.012);
      g.add(sc);
      break;
    }
    case "split":
      /* il climatizzatore a muro: lungo, bianco, la feritoia sotto */
      scatola(g, 0.85, 0.28, 0.2, bianco, 0, -0.14, 0.02);
      scatola(g, 0.75, 0.03, 0.02, M("#94a3b8"), 0, -0.12, 0.125);
      lucina(g, "#38bdf8", 0.008, 0.33, -0.03, 0.125);
      break;
    case "fumo":
      cilindro(g, 0.07, 0.035, bianco, 0, -0.035, 0, 24);
      lucina(g, "#22c55e", 0.008, 0, -0.04, 0.05);
      break;
    case "acqua":
      cilindro(g, 0.05, 0.02, bianco, 0, 0.005, 0, 20);
      cilindro(g, 0.012, 0.004, M("#38bdf8", { emissive: "#38bdf8", emissiveIntensity: 0.6 }), 0.025, 0.025, 0, 10);
      break;
    case "presa":
      scatola(g, 0.12, 0.08, 0.02, bianco, 0, -0.04, -0.005);
      for (const x of [-0.025, 0.025]) cilindro(g, 0.016, 0.004, M("#cbd5e1"), x, -0.002, 0.007, 12).rotation.x = Math.PI / 2;
      break;
    case "televisore":
      scatola(g, 1.25, 0.72, 0.05, nero, 0, -0.36, 0);
      break;
    case "altoparlante":
      cilindro(g, 0.05, 0.15, M("#1f2937", { roughness: 0.9 }), 0, -0.15, 0, 20);
      cilindro(g, 0.05, 0.01, M("#38bdf8", { emissive: "#38bdf8", emissiveIntensity: 0.5 }), 0, 0, 0, 20);
      break;
    case "pannello":
      scatola(g, 0.1, 0.1, 0.015, bianco, 0, -0.05, -0.005);
      scatola(g, 0.07, 0.03, 0.005, M("#94a3b8"), 0, -0.03, 0.004);
      break;
    default:
      scatola(g, 0.6, 0.6, 0.6, M(tela));
  }
  return g;
}
