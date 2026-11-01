import {
  CELLA,
  DISPOSITIVI_3D,
  azioneDelTocco,
  dispositivoPulito,
  entita,
  entitaCandidate,
  espandiGriglia,
  statoDelDispositivo
} from "./chunk-CCMUJEI3.js";

// src/sections/casa-3d/arredi-3d.js
var CATALOGO_ARREDI = Object.freeze([
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
      ["quadro", "🖼️", "Quadro", "Painting", 1.4, 0.06]
    ]
  },
  {
    k: "cucina",
    nome: ["Pranzo e cucina", "Dining and kitchen"],
    voci: [
      ["pranzo6", "🍽️", "Tavolo 6 posti", "6-seat table", 1.9, 1.6],
      ["tondo4", "⭕", "Tavolo tondo", "Round table", 1.4, 1.4],
      ["cucina", "🍳", "Cucina lineare", "Kitchen run", 3, 0.65],
      ["isola", "🏝️", "Isola con sgabelli", "Island with stools", 1.8, 1.4],
      ["frigo", "🧊", "Frigorifero doppio", "Double fridge", 0.92, 0.72]
    ]
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
      ["culla", "👶", "Lettino", "Cot", 0.75, 1.3]
    ]
  },
  {
    k: "bagno",
    nome: ["Bagno", "Bathroom"],
    voci: [
      ["vasca", "🛁", "Vasca", "Bathtub", 1.7, 0.75],
      ["doccia", "🚿", "Doccia", "Shower", 0.9, 0.9],
      ["wc", "🚽", "WC sospeso", "Toilet", 0.4, 0.55],
      ["bidet", "🚰", "Bidet", "Bidet", 0.4, 0.55],
      ["lavabo", "🪥", "Mobile lavabo", "Vanity unit", 0.9, 0.48]
    ]
  },
  {
    k: "elettrodomestici",
    nome: ["Elettrodomestici", "Appliances"],
    voci: [
      ["lavatrice", "🫧", "Lavatrice", "Washing machine", 0.62, 0.6],
      ["asciugatrice", "🌀", "Asciugatrice", "Dryer", 0.62, 0.62],
      ["lavastoviglie", "🍽️", "Lavastoviglie", "Dishwasher", 0.6, 0.6],
      ["forno", "🔥", "Forno a colonna", "Oven column", 0.6, 0.6],
      ["microonde", "📟", "Microonde", "Microwave", 0.5, 0.4]
    ]
  },
  {
    k: "studio",
    nome: ["Studio e altro", "Study and more"],
    voci: [
      ["scrivania", "🖥️", "Scrivania", "Desk", 1.5, 0.75],
      ["ufficio", "🪑", "Sedia da ufficio", "Office chair", 0.6, 0.6],
      ["pianoforte", "🎹", "Pianoforte", "Piano", 1.5, 0.6],
      ["cyclette", "🚴", "Cyclette", "Exercise bike", 0.6, 1.1],
      ["scala", "🪜", "Scala", "Staircase", 0.9, 2.4]
    ]
  }
]);
var VOCI_ARREDI = Object.freeze(
  Object.fromEntries(
    CATALOGO_ARREDI.flatMap(
      (g) => g.voci.map(([k, icona, it, en, w, d]) => [k, Object.freeze({ k, icona, nome: [it, en], w, d, gruppo: g.k })])
    )
  )
);
var ARREDI_SOTTO = Object.freeze(["tappeto", "pensile", "quadro"]);
var CON_TESSUTO = /divano|angolare|poltrona|matrimoniale|singolo|tappeto|isola|cyclette/;
var MODELLO_DEL_DISPOSITIVO = Object.freeze({
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
  /* gli elettrodomestici: lo stesso modello dell'arredo, appoggiato al muro */
  lavatrice: "el_lavatrice",
  asciugatrice: "el_asciugatrice",
  lavastoviglie: "el_lavastoviglie",
  forno: "el_forno"
});
var COMUNI = /* @__PURE__ */ new WeakMap();
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
    vetro: new THREE.MeshPhysicalMaterial({ color: "#d6ecff", transmission: 0.6, transparent: true, opacity: 0.35, roughness: 0.05 })
  };
  COMUNI.set(THREE, c);
  return c;
}
function arredo3D(THREE, k, tinta = "#64748b") {
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
  const elettrodomestico = (dove, tipo) => {
    const smalto = M("#f8fafc", { roughness: 0.3 });
    const scuro = M("#334155", { roughness: 0.1 });
    const display = M("#0f172a", { emissive: "#22d3ee", emissiveIntensity: 0.25 });
    const oblo = (r, y) => {
      const o = new THREE.Mesh(new THREE.CircleGeometry(r, 28), scuro);
      o.position.set(0, y, 0.301);
      dove.add(o);
      const anello = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 8, 28), acciaio);
      anello.position.set(0, y, 0.302);
      dove.add(anello);
    };
    if (tipo === "lavatrice" || tipo === "asciugatrice") {
      scatola(dove, 0.6, 0.85, 0.6, smalto);
      oblo(0.2, 0.42);
      scatola(dove, 0.5, 0.06, 0.01, M("#94a3b8"), 0, 0.74, 0.3);
      scatola(dove, 0.12, 0.04, 0.01, display, 0.16, 0.75, 0.302);
      if (tipo === "asciugatrice") scatola(dove, 0.16, 0.05, 0.01, M("#cbd5e1"), -0.17, 0.75, 0.302);
    } else if (tipo === "lavastoviglie") {
      scatola(dove, 0.6, 0.82, 0.6, M("#e2e8f0", { roughness: 0.25, metalness: 0.3 }));
      scatola(dove, 0.56, 0.08, 0.01, display, 0, 0.72, 0.301);
      scatola(dove, 0.36, 0.025, 0.04, acciaio, 0, 0.66, 0.31);
    } else if (tipo === "forno") {
      scatola(dove, 0.6, 2.1, 0.6, laccato);
      scatola(dove, 0.54, 0.5, 0.01, nero, 0, 0.85, 0.301);
      scatola(dove, 0.4, 0.02, 0.03, acciaio, 0, 1.38, 0.31);
      scatola(dove, 0.54, 0.06, 0.01, display, 0, 1.43, 0.301);
    } else if (tipo === "microonde") {
      scatola(dove, 0.5, 0.9, 0.4, laccato);
      scatola(dove, 0.5, 0.3, 0.4, M("#1f2937", { roughness: 0.3 }), 0, 0.9);
      scatola(dove, 0.34, 0.22, 0.01, nero, -0.06, 0.94, 0.201);
      scatola(dove, 0.08, 0.2, 0.01, display, 0.18, 0.95, 0.201);
    }
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
        for (let j = 0; j < 7; j++) if ((i * 7 + j) % 3) scatola(g, 0.12 + j % 3 * 0.03, 0.28, 0.24, dorsi[(i + j) % 5], -0.62 + j * 0.2, 0.1 + i * 0.4, 0.04);
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
      scatola(g, 1.4, 1, 0.04, M("#d6d3d1"), 0, 1.45, -0.01);
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
        const a = i / 4 * Math.PI * 2;
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
      scatola(g, 5e-3, 1.7, 0.01, metallo, 0, 0.05, 0.36);
      for (const s of [-1, 1]) scatola(g, 0.02, 0.5, 0.03, metallo, s * 0.06, 0.9, 0.38);
      break;
    /* ── camera ── */
    case "matrimoniale":
      scatola(g, 1.75, 0.3, 2.1, legnoChiaro, 0, 0.08);
      scatola(g, 1.65, 0.22, 2, M("#f8fafc"), 0, 0.38);
      scatola(g, 1.68, 0.06, 1.35, stoffa, 0, 0.58, 0.32);
      scatola(g, 1.8, 1, 0.1, stoffa, 0, 0.08, -1.05);
      for (const s of [-1, 1]) scatola(g, 0.65, 0.14, 0.4, M("#ffffff"), s * 0.42, 0.6, -0.72);
      break;
    case "singolo":
      scatola(g, 0.95, 0.3, 2, legnoChiaro, 0, 0.08);
      scatola(g, 0.88, 0.2, 1.92, M("#f8fafc"), 0, 0.38);
      scatola(g, 0.9, 0.06, 1.3, stoffa, 0, 0.56, 0.3);
      scatola(g, 1, 0.8, 0.08, legnoChiaro, 0, 0.08, -1);
      scatola(g, 0.6, 0.12, 0.35, M("#ffffff"), 0, 0.58, -0.7);
      break;
    case "comodino":
      scatola(g, 0.5, 0.48, 0.42, legnoChiaro);
      scatola(g, 0.44, 0.01, 0.01, metallo, 0, 0.3, 0.21);
      cilindro(g, 0.08, 0.28, M("#f5ead6", { emissive: "#ffcf8a", emissiveIntensity: 0.5 }), 0.1, 0.48, -0.05, 14, 0.11);
      break;
    case "armadio":
      scatola(g, 2.2, 2.4, 0.62, laccato);
      for (let i = 1; i < 4; i++) scatola(g, 6e-3, 2.3, 0.01, M("#cbd5e1"), -1.1 + i * 0.55, 0.05, 0.31);
      for (let i = 0; i < 4; i++) scatola(g, 0.02, 0.4, 0.03, metallo, -0.9 + i * 0.55 + (i % 2 ? -0.1 : 0.1), 1, 0.33);
      break;
    case "cassettiera":
      scatola(g, 1.1, 0.85, 0.5, legnoChiaro);
      for (let i = 0; i < 3; i++) scatola(g, 1.04, 5e-3, 0.01, legnoScuro, 0, 0.27 + i * 0.27, 0.25);
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
    case "lavatrice":
    case "asciugatrice":
    case "lavastoviglie":
    case "forno":
    case "microonde":
      elettrodomestico(g, chiave);
      break;
    /* da dispositivo: l'origine e' sul muro, il corpo davanti */
    case "el_lavatrice":
    case "el_asciugatrice":
    case "el_lavastoviglie":
    case "el_forno": {
      const e = new THREE.Group();
      elettrodomestico(e, chiave.slice(3));
      e.position.z = 0.31;
      g.add(e);
      break;
    }
    /* ── la scala: sale verso il fondo (z negativa), dal pavimento al piano di sopra ── */
    case "scala": {
      const n = 13, lungo = 2.4, alzata = 2.8 / n, pedata = lungo / n;
      for (let i = 0; i < n; i++) {
        scatola(g, 0.9, (i + 1) * alzata, pedata, i % 2 ? legnoChiaro : legnoScuro, 0, 0, lungo / 2 - (i + 0.5) * pedata);
      }
      const corrimano = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, Math.hypot(lungo, 2.8), 8), metallo);
      corrimano.position.set(0.43, 1.4 + 0.9, 0);
      corrimano.rotation.x = -Math.atan2(lungo, 2.8);
      g.add(corrimano);
      for (let i = 0; i <= n; i += 3)
        cilindro(g, 0.012, 0.9, metallo, 0.43, i * alzata, lungo / 2 - i * pedata, 6);
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
      scatola(g, 1, 0.45, 0.3, M("#0b0b0f", { roughness: 0.15 }), 0, 0, 0.75);
      break;
    case "cyclette": {
      scatola(g, 0.12, 0.08, 1, metallo, 0, 0);
      cilindro(g, 0.03, 0.8, metallo, 0, 0.05, 0.25, 8);
      scatola(g, 0.22, 0.06, 0.28, M("#111111"), 0, 0.85, 0.25);
      cilindro(g, 0.03, 1, metallo, 0, 0.05, -0.35, 8);
      scatola(g, 0.5, 0.04, 0.05, metallo, 0, 1.05, -0.35);
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 20), M(tela));
      r.rotation.y = Math.PI / 2;
      r.position.set(0, 0.3, -0.1);
      g.add(r);
      break;
    }
    /* ── i dispositivi: l'origine e' il punto di montaggio ── */
    case "faretto": {
      cilindro(g, 0.09, 0.03, bianco, 0, 0.02, 0, 20);
      cilindro(g, 8e-3, 0.18, metallo, 0, -0.16, 0, 6);
      const lampada = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 16, 12),
        new THREE.MeshStandardMaterial({ color: "#fff7e6", emissive: "#ffc98a", emissiveIntensity: 0 })
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
      lente.position.set(0, 0, 5e-3);
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
      sc.position.set(0, 5e-3, 4e-3);
      g.add(sc);
      break;
    }
    case "termostato": {
      cilindro(g, 0.055, 0.03, bianco, 0, -0.015, -5e-3, 24).rotation.x = Math.PI / 2;
      const sc = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), M("#0f172a", { emissive: "#f97316", emissiveIntensity: 0.45 }));
      sc.position.set(0, 0, 0.012);
      g.add(sc);
      break;
    }
    case "split":
      scatola(g, 0.85, 0.28, 0.2, bianco, 0, -0.14, 0.02);
      scatola(g, 0.75, 0.03, 0.02, M("#94a3b8"), 0, -0.12, 0.125);
      lucina(g, "#38bdf8", 8e-3, 0.33, -0.03, 0.125);
      break;
    case "fumo":
      cilindro(g, 0.07, 0.035, bianco, 0, -0.035, 0, 24);
      lucina(g, "#22c55e", 8e-3, 0, -0.04, 0.05);
      break;
    case "acqua":
      cilindro(g, 0.05, 0.02, bianco, 0, 5e-3, 0, 20);
      cilindro(g, 0.012, 4e-3, M("#38bdf8", { emissive: "#38bdf8", emissiveIntensity: 0.6 }), 0.025, 0.025, 0, 10);
      break;
    case "presa":
      scatola(g, 0.12, 0.08, 0.02, bianco, 0, -0.04, -5e-3);
      for (const x of [-0.025, 0.025]) cilindro(g, 0.016, 4e-3, M("#cbd5e1"), x, -2e-3, 7e-3, 12).rotation.x = Math.PI / 2;
      break;
    case "televisore":
      scatola(g, 1.25, 0.72, 0.05, nero, 0, -0.36, 0);
      break;
    case "altoparlante":
      cilindro(g, 0.05, 0.15, M("#1f2937", { roughness: 0.9 }), 0, -0.15, 0, 20);
      cilindro(g, 0.05, 0.01, M("#38bdf8", { emissive: "#38bdf8", emissiveIntensity: 0.5 }), 0, 0, 0, 20);
      break;
    case "pannello":
      scatola(g, 0.1, 0.1, 0.015, bianco, 0, -0.05, -5e-3);
      scatola(g, 0.07, 0.03, 5e-3, M("#94a3b8"), 0, -0.03, 4e-3);
      break;
    default:
      scatola(g, 0.6, 0.6, 0.6, M(tela));
  }
  return g;
}

// src/sections/casa-3d/finiture.js
var PAVIMENTI = Object.freeze([
  { k: "listoni", nome: ["Parquet a listoni", "Plank parquet"], colori: ["#d8b68a", "#c19a6b", "#9c7048", "#6b4a32", "#e7dccb", "#a39e93"], legno: true },
  { k: "spina", nome: ["Parquet a spina", "Herringbone"], colori: ["#d8b68a", "#c19a6b", "#9c7048", "#6b4a32", "#e7dccb", "#a39e93"], legno: true },
  { k: "gres60", nome: ["Gres 60×60", "Tiles 60×60"], colori: ["#eeeae3", "#d9cbb3", "#b9b3a8", "#9aa0a6", "#5b6168", "#2f3337"] },
  { k: "gres120", nome: ["Gres 120×60", "Tiles 120×60"], colori: ["#eeeae3", "#d9cbb3", "#b9b3a8", "#9aa0a6", "#5b6168", "#2f3337"] },
  { k: "marmo", nome: ["Effetto marmo", "Marble look"], colori: ["#f3f1ec", "#e9e4da", "#d8d2c8", "#2a2c30"], vena: true },
  { k: "cotto", nome: ["Cotto", "Terracotta"], colori: ["#b5653a", "#c27a4a", "#a5543a", "#d39a6a"] },
  { k: "esagonette", nome: ["Esagonette", "Hexagons"], colori: ["#eeeae3", "#9cae94", "#3b5b7a", "#1f2326", "#d9cbb3", "#c98b6b"] },
  { k: "cementine", nome: ["Cementine", "Cement tiles"], colori: ["#3b5b7a", "#9cae94", "#c98b6b", "#1f2326", "#b08a3e"] },
  { k: "mosaico", nome: ["Mosaico", "Mosaic"], colori: ["#3b82c4", "#5fa8a0", "#e7e1d6", "#1f2326", "#9cae94"] },
  { k: "scacchiera", nome: ["Scacchiera", "Checkerboard"], colori: ["#1f2326", "#3b5b7a", "#9cae94", "#b5653a"] },
  { k: "resina", nome: ["Resina", "Resin"], colori: ["#e9e6df", "#c9c6bf", "#8d9095", "#4a4f55", "#d8c3a5"] },
  { k: "moquette", nome: ["Moquette", "Carpet"], colori: ["#b8a99a", "#8d9095", "#4f6b55", "#2f3f57"] }
]);
var PAVIMENTO_PER_CHIAVE = Object.freeze(Object.fromEntries(PAVIMENTI.map((p) => [p.k, p])));
var PARETI = Object.freeze([
  ["Bianco", "White", "#f4f1ea"],
  ["Panna", "Cream", "#efe4cf"],
  ["Grigio perla", "Pearl grey", "#d5d6d2"],
  ["Tortora", "Taupe", "#b8a99a"],
  ["Salvia", "Sage", "#b7c4ae"],
  ["Azzurro polvere", "Dusty blue", "#b9cad6"],
  ["Rosa cipria", "Powder pink", "#e2c2b8"],
  ["Ocra", "Ochre", "#d9b45c"],
  ["Terracotta", "Terracotta", "#c98b6b"],
  ["Verde bosco", "Forest green", "#4f6b55"],
  ["Blu notte", "Midnight blue", "#2f3f57"],
  ["Antracite", "Anthracite", "#4a4f55"]
]);
var PARETE_DI_PARTENZA = "#f1ece2";
var scurisci = (hex, k) => {
  const n = parseInt(String(hex).slice(1), 16) || 0;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`;
};
var varia = (hex, i, amp = 0.08) => scurisci(hex, 1 - amp + (i * 9301 + 49297) % 233280 / 233280 * amp * 2);
var fuga = (p, colore = "rgba(0,0,0,.18)") => {
  p.strokeStyle = colore;
  p.lineWidth = 1;
};
var grana = (i) => (i * 16807 % 2147483647 / 2147483647 + 1) % 1;
function riquadro(k, c = "#d9cbb3", c2 = "") {
  const n = 150;
  const cv = document.createElement("canvas");
  cv.width = cv.height = n;
  const p = cv.getContext("2d");
  switch (k) {
    case "listoni": {
      let i = 0;
      for (let y = 0; y < n; y += 15) {
        let x = -(y * 7 % 60);
        while (x < n) {
          const l = 70 + i * 37 % 50;
          p.fillStyle = varia(c, i++, 0.1);
          p.fillRect(x, y, l, 15);
          p.fillStyle = "rgba(60,35,15,.3)";
          p.fillRect(x, y, 1, 15);
          x += l;
        }
        p.fillStyle = "rgba(60,35,15,.28)";
        p.fillRect(0, y, n, 1);
      }
      break;
    }
    case "spina": {
      p.fillStyle = c;
      p.fillRect(0, 0, n, n);
      const w = 25, h = 10;
      let i = 0;
      for (let col = 0; col < n / w + 1; col++)
        for (let y = -w; y < n + w; y += h) {
          p.save();
          p.translate(col * w, y + (col % 2 ? 0 : h / 2));
          p.transform(1, col % 2 ? 0.45 : -0.45, 0, 1, 0, 0);
          p.fillStyle = varia(c, i++, 0.1);
          p.fillRect(0, 0, w, h);
          p.fillStyle = "rgba(60,35,15,.3)";
          p.fillRect(0, 0, w, 1);
          p.fillRect(0, 0, 1, h);
          p.restore();
        }
      break;
    }
    case "gres60":
    case "gres120": {
      const a = 45 * (k === "gres120" ? 2 : 1), b = 45;
      const sfalsa = (y) => k === "gres120" && y / b % 2 ? -a / 2 : 0;
      let i = 0;
      for (let y = 0; y < n; y += b)
        for (let x = sfalsa(y); x < n; x += a) {
          p.fillStyle = varia(c, i++, 0.025);
          p.fillRect(x, y, a, b);
        }
      fuga(p);
      for (let y = 0; y <= n; y += b) {
        p.beginPath();
        p.moveTo(0, y);
        p.lineTo(n, y);
        p.stroke();
      }
      for (let y = 0; y < n; y += b)
        for (let x = sfalsa(y); x <= n; x += a) {
          p.beginPath();
          p.moveTo(x, y);
          p.lineTo(x, y + b);
          p.stroke();
        }
      break;
    }
    case "marmo": {
      p.fillStyle = c;
      p.fillRect(0, 0, n, n);
      const vena = c2 || (c === "#2a2c30" ? "#d8d2c8" : "#9a948a");
      for (let i = 0; i < 9; i++) {
        p.strokeStyle = vena;
        p.globalAlpha = 0.18 + i % 3 * 0.08;
        p.lineWidth = 0.6 + i % 3 * 0.7;
        p.beginPath();
        const y0 = i * 41 % n;
        p.moveTo(-10, y0);
        p.bezierCurveTo(40, y0 - 30 + i * 3, 90, y0 + 35, 160, y0 + 10 - i * 2);
        p.stroke();
      }
      p.globalAlpha = 1;
      fuga(p, "rgba(0,0,0,.08)");
      for (const [x, y] of [[0, 0], [75, 0], [0, 75], [75, 75]]) p.strokeRect(x, y, 75, 75);
      break;
    }
    case "cotto": {
      p.fillStyle = "#e3d6c4";
      p.fillRect(0, 0, n, n);
      let i = 0;
      for (let y = 0; y < n; y += 25)
        for (let x = 0; x < n; x += 25) {
          p.fillStyle = varia(c, i++, 0.12);
          p.fillRect(x + 1.5, y + 1.5, 22, 22);
        }
      break;
    }
    case "esagonette": {
      p.fillStyle = "#d6d3cc";
      p.fillRect(0, 0, n, n);
      const r = 10, hx = r * Math.sqrt(3);
      let i = 0;
      for (let row = -1; row < n / (r * 1.5) + 1; row++)
        for (let col = -1; col < n / hx + 1; col++) {
          const cx = col * hx + (row % 2 ? hx / 2 : 0), cy = row * r * 1.5;
          p.beginPath();
          for (let a = 0; a < 6; a++) {
            const t = Math.PI / 6 + a * Math.PI / 3;
            p.lineTo(cx + Math.cos(t) * (r - 0.8), cy + Math.sin(t) * (r - 0.8));
          }
          p.closePath();
          p.fillStyle = c2 && i * 7 % 11 === 0 ? c2 : varia(c, i, 0.05);
          i++;
          p.fill();
        }
      break;
    }
    case "cementine": {
      const t = 25;
      for (let y = 0; y < n; y += t)
        for (let x = 0; x < n; x += t) {
          p.fillStyle = "#efe9de";
          p.fillRect(x, y, t, t);
          p.fillStyle = c;
          for (const [dx, dy, a] of [[0, 0, 0], [t, 0, Math.PI / 2], [t, t, Math.PI], [0, t, -Math.PI / 2]]) {
            p.beginPath();
            p.moveTo(x + dx, y + dy);
            p.arc(x + dx, y + dy, t * 0.42, a, a + Math.PI / 2);
            p.fill();
          }
          p.fillStyle = c2 || "#b08a3e";
          p.beginPath();
          p.arc(x + t / 2, y + t / 2, t * 0.14, 0, Math.PI * 2);
          p.fill();
          p.strokeStyle = c;
          p.lineWidth = 1.2;
          p.beginPath();
          p.moveTo(x + t / 2, y + 3);
          p.lineTo(x + t - 3, y + t / 2);
          p.lineTo(x + t / 2, y + t - 3);
          p.lineTo(x + 3, y + t / 2);
          p.closePath();
          p.stroke();
          fuga(p, "rgba(0,0,0,.12)");
          p.strokeRect(x, y, t, t);
        }
      break;
    }
    case "mosaico": {
      p.fillStyle = "#e5e7eb";
      p.fillRect(0, 0, n, n);
      let i = 0;
      for (let y = 0; y < n; y += 5)
        for (let x = 0; x < n; x += 5) {
          p.fillStyle = c2 && i * 13 % 7 === 0 ? c2 : varia(c, i, 0.16);
          i++;
          p.fillRect(x + 0.5, y + 0.5, 4.2, 4.2);
        }
      break;
    }
    case "scacchiera": {
      for (let y = 0; y < n; y += 25)
        for (let x = 0; x < n; x += 25) {
          p.fillStyle = (x + y) / 25 % 2 ? c2 || "#f1ede4" : c;
          p.fillRect(x, y, 25, 25);
        }
      fuga(p, "rgba(0,0,0,.1)");
      for (let i = 0; i <= n; i += 25) {
        p.beginPath();
        p.moveTo(i, 0);
        p.lineTo(i, n);
        p.moveTo(0, i);
        p.lineTo(n, i);
        p.stroke();
      }
      break;
    }
    case "resina": {
      const gr = p.createLinearGradient(0, 0, n, n);
      gr.addColorStop(0, scurisci(c, 1.03));
      gr.addColorStop(1, scurisci(c, 0.96));
      p.fillStyle = gr;
      p.fillRect(0, 0, n, n);
      for (let i = 1; i <= 500; i++) {
        p.fillStyle = `rgba(0,0,0,${grana(i) * 0.03})`;
        p.fillRect(grana(i * 3) * n, grana(i * 7) * n, 3, 3);
      }
      break;
    }
    case "moquette": {
      p.fillStyle = c;
      p.fillRect(0, 0, n, n);
      for (let i = 1; i <= 2600; i++) {
        p.fillStyle = `rgba(${grana(i * 5) < 0.5 ? "0,0,0" : "255,255,255"},${grana(i) * 0.07})`;
        p.fillRect(grana(i * 3) * n, grana(i * 11) * n, 1.5, 1.5);
      }
      break;
    }
    default:
      p.fillStyle = c;
      p.fillRect(0, 0, n, n);
  }
  return cv;
}
function finituraDiPartenza(nome = "", fuori = false) {
  if (fuori || /cortile|terrazz|balcon|loggia|veranda|patio|terrace|balcony/i.test(nome)) return { tipo: "cotto", colore: "#c27a4a" };
  if (/box|garage|tecnic|cantina|lavanderia|laundry|cellar/i.test(nome)) return { tipo: "resina", colore: "#8d9095" };
  if (/bagno|wc|bath|toilet/i.test(nome)) return { tipo: "gres60", colore: "#d9cbb3" };
  if (/cucina|kitchen/i.test(nome)) return { tipo: "gres60", colore: "#eeeae3" };
  if (/ingresso|disimpegno|corridoio|ripostiglio|hall|entrance|corridor/i.test(nome)) return { tipo: "gres60", colore: "#e7e1d6" };
  return { tipo: "listoni", colore: "#c19a6b" };
}
function finituraDellaStanza(s) {
  const f = s?.pavimento;
  if (f && PAVIMENTO_PER_CHIAVE[f.tipo]) return f;
  return finituraDiPartenza(s?.nome, s?.fuori);
}
var PIXEL_PER_METRO = 75;
var TELA_AL_MASSIMO = 2048;
function pavimentoDellaPianta(piano, tipo, disegna = riquadro) {
  const { W, H, passo } = piano;
  const scala = Math.max(1, Math.min(PIXEL_PER_METRO * passo, TELA_AL_MASSIMO / Math.max(W, H)));
  const fattore = scala / (PIXEL_PER_METRO * passo);
  const out = document.createElement("canvas");
  out.width = Math.round(W * scala);
  out.height = Math.round(H * scala);
  const g = out.getContext("2d");
  const maschere = /* @__PURE__ */ new Map();
  const segna = (id, i) => {
    if (!maschere.has(id)) maschere.set(id, new ImageData(W, H));
    maschere.get(id).data[i * 4 + 3] = 255;
  };
  for (let i = 0; i < W * H; i++) {
    const t = tipo[i];
    if (t > 0) segna(t, i);
    else if (t === -5) {
      const vicino = [i - 1, i + 1, i - W, i + W].map((j) => tipo[j]).find((x) => x > 0);
      if (vicino) segna(vicino, i);
    }
  }
  const perId = new Map((piano.stanze || []).map((s2) => [s2.id, s2]));
  const maschera = document.createElement("canvas");
  maschera.width = W;
  maschera.height = H;
  const mg = maschera.getContext("2d");
  const strato = document.createElement("canvas");
  strato.width = out.width;
  strato.height = out.height;
  const s = strato.getContext("2d");
  for (const [id, msk] of maschere) {
    const f = finituraDellaStanza(perId.get(id) || { nome: "" });
    s.globalCompositeOperation = "source-over";
    s.clearRect(0, 0, strato.width, strato.height);
    const motivo = s.createPattern(disegna(f.tipo, f.colore, f.colore2 || ""), "repeat");
    if (motivo?.setTransform && typeof DOMMatrix === "function") {
      const m = new DOMMatrix().scaleSelf(fattore, fattore);
      if (f.diagonale) m.rotateSelf(45);
      motivo.setTransform(m);
    }
    s.fillStyle = motivo || f.colore;
    s.fillRect(0, 0, strato.width, strato.height);
    mg.clearRect(0, 0, W, H);
    mg.putImageData(msk, 0, 0);
    s.globalCompositeOperation = "destination-in";
    s.imageSmoothingEnabled = false;
    s.drawImage(maschera, 0, 0, strato.width, strato.height);
    g.drawImage(strato, 0, 0);
  }
  return out;
}

// src/sections/casa-3d/scena.js
var HP = 2.95;
var TAGLIO = 1.55;
var PASSO_DEI_PIANI = 3.2;
var AGGANCIO = 0.05;
var LUCI_ACCESE_AL_MASSIMO = 6;
var TINTE_DI_PARTENZA = ["#64748b", "#7c8b6f", "#9b7b63", "#4b5f7a"];
var TESSUTI = ["#64748b", "#7c8b6f", "#9b7b63", "#4b5f7a", "#b8a99a", "#8b3a3a", "#d6c7a8", "#2f3f57"];
var ORDINALI = [
  ["Piano terra", "Ground floor"],
  ["Primo piano", "First floor"],
  ["Secondo piano", "Second floor"],
  ["Terzo piano", "Third floor"],
  ["Quarto piano", "Fourth floor"],
  ["Quinto piano", "Fifth floor"],
  ["Sesto piano", "Sixth floor"],
  ["Settimo piano", "Seventh floor"],
  ["Ottavo piano", "Eighth floor"],
  ["Nono piano", "Ninth floor"]
];
var TONI = {
  luce: "245,158,11",
  movimento: "124,58,237",
  allarme: "239,68,68",
  telecamera: "14,165,233",
  clima: "234,88,12",
  ok: "22,163,74",
  lavora: "16,185,129",
  neutro: "100,116,139",
  spento: "71,85,105"
};
var esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var copia = (v) => JSON.parse(JSON.stringify(v));
var MURO = (t) => t === CELLA.muro || t === CELLA.davanzale || t === CELLA.porta;
function rettangoli({ W, H, tipo, passo }, prova) {
  const out = [];
  const fatto = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (fatto[i] || !prova(tipo[i])) continue;
      let w = 1;
      while (x + w < W && !fatto[i + w] && prova(tipo[i + w])) w++;
      let h = 1;
      fuori: while (y + h < H) {
        for (let k = 0; k < w; k++) {
          const j = (y + h) * W + x + k;
          if (fatto[j] || !prova(tipo[j])) break fuori;
        }
        h++;
      }
      for (let yy = 0; yy < h; yy++) for (let k = 0; k < w; k++) fatto[(y + yy) * W + x + k] = 1;
      out.push({ x: x * passo, y: y * passo, w: w * passo, d: h * passo, cx: x, cy: y, cw: w, ch: h });
    }
  return out;
}
function stanzeDellaPianta(dati, tipo) {
  const { W, H, passo } = dati;
  const conti = /* @__PURE__ */ new Map();
  for (let i = 0; i < W * H; i++) {
    const t = tipo[i];
    if (t <= 0) continue;
    const c = conti.get(t) || { n: 0, sx: 0, sy: 0 };
    c.n++;
    c.sx += i % W;
    c.sy += i / W | 0;
    conti.set(t, c);
  }
  const out = [];
  for (const s of dati.stanze || []) {
    const c = conti.get(s.id);
    if (!c) continue;
    let cx = Math.round(c.sx / c.n), cy = Math.round(c.sy / c.n);
    if (tipo[cy * W + cx] !== s.id) {
      let meglio = Infinity, bx = cx, by = cy;
      for (let i = 0; i < W * H; i++) {
        if (tipo[i] !== s.id) continue;
        const x = i % W, y = i / W | 0, d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d < meglio) [meglio, bx, by] = [d, x, y];
      }
      cx = bx;
      cy = by;
    }
    out.push({ dati: s, id: s.id, nome: s.nome, sx: (cx + 0.5) * passo, sy: (cy + 0.5) * passo, area: c.n * passo * passo });
  }
  return out;
}
function creaScena(THREE, opzioni = {}) {
  const {
    contenitore,
    stati = () => ({}),
    italiano = true,
    admin = false,
    quandoTocchi = () => {
    },
    quandoSalvi = () => {
    },
    quandoCambiVista = () => {
    },
    nomeArea = () => ""
  } = opzioni;
  const L = (it, en) => italiano ? it : en;
  const leggiStati = () => (typeof stati === "function" ? stati() : stati) || {};
  const C = copia(opzioni.casa || {});
  C.piani ||= [];
  C.esterno ||= {};
  const E = C.esterno;
  const TIPO = C.tipo === "palazzo" ? "palazzo" : "villa";
  installaLoStile();
  const palco = document.createElement("div");
  palco.className = "c3-scena";
  palco.innerHTML = `<div class="c3-strato"></div><div class="c3-chip-strato"></div>
    <div class="c3-maniglie"><span data-c3-ruota="-1" title="${esc(L("Ruota a sinistra", "Rotate left"))}">↺</span><span data-c3-ruota="1" title="${esc(L("Ruota a destra", "Rotate right"))}">↻</span><span data-c3-gira title="${esc(L("Ruota di 90°", "Rotate 90°"))}">⟳ 90°</span><span data-c3-via class="c3-via" title="${esc(L("Togli", "Remove"))}">🗑</span></div>
    <div class="c3-sugg"></div>
    <div class="c3-zoom"><span data-c3-zoom="1.18">−</span><span data-c3-zoom="0.85">+</span><span data-c3-zoom="0">⌖</span></div>`;
  contenitore.appendChild(palco);
  const strato = palco.querySelector(".c3-strato");
  const stratoChip = palco.querySelector(".c3-chip-strato");
  const maniglie = palco.querySelector(".c3-maniglie");
  const sugg = palco.querySelector(".c3-sugg");
  let pannello = opzioni.pannello || null;
  if (!pannello && admin) {
    pannello = document.createElement("div");
    pannello.className = "c3-pannello-sopra";
    palco.appendChild(pannello);
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: Boolean(opzioni.perLeProve) });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const taglio = new THREE.Plane(new THREE.Vector3(0, -1, 0), 200);
  renderer.clippingPlanes = [taglio];
  palco.prepend(renderer.domElement);
  const scena = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 600);
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0, ...o });
  const tela = (disegna2, n = 256) => {
    const c = document.createElement("canvas");
    c.width = c.height = n;
    disegna2(c.getContext("2d"), n);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  const box = (gr, w, h, d, m, x, y, z) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y + h / 2, z);
    b.castShadow = b.receiveShadow = true;
    gr.add(b);
    return b;
  };
  let seme = 7;
  const caso = () => (seme = seme * 16807 % 2147483647) / 2147483647;
  const muroMat = mat("#efe8dc", { roughness: 0.9, side: THREE.DoubleSide });
  const solaioMat = mat("#d6d3cd", { roughness: 0.9 });
  const cimaMat = mat("#334155", { roughness: 0.6 });
  const telaioMat = mat("#f8fafc", { roughness: 0.5 });
  const intonaco = tela((g, n) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) {
      const v = 228 + caso() * 27;
      g.fillStyle = `rgba(${v},${v},${v - 6},.55)`;
      g.fillRect(caso() * n, caso() * n, 2, 2);
    }
  });
  const facciataMat = mat(E.facciata || "#e9d4ae", { map: intonaco, roughness: 0.95, side: THREE.DoubleSide });
  const pietraMat = mat(TIPO === "villa" ? "#b8a487" : "#cfc3ad", {
    map: tela((g, n) => {
      g.fillStyle = "#fff";
      g.fillRect(0, 0, n, n);
      g.strokeStyle = "rgba(90,80,60,.35)";
      g.lineWidth = 3;
      for (let y = 0; y < n; y += 32) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(n, y);
        g.stroke();
        for (let x = y / 32 % 2 ? 0 : 40; x < n; x += 80) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + 32);
          g.stroke();
        }
      }
    }),
    roughness: 0.9
  });
  const corniceMat = mat(TIPO === "villa" ? "#f5efe4" : "#ece6da", { roughness: 0.7 });
  const persianaMat = mat(E.persiane || "#3f6b4e", {
    roughness: 0.7,
    map: tela((g, n) => {
      g.fillStyle = "#fff";
      g.fillRect(0, 0, n, n);
      g.fillStyle = "rgba(0,0,0,.28)";
      for (let i = 0; i < n; i += 14) g.fillRect(0, i, n, 4);
    })
  });
  const ringhieraMat = mat("#2b2f36", { metalness: 0.6, roughness: 0.4 });
  const lamelleCanvas = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "#8793a5";
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = "#5f6b7d";
    for (let i = 0; i < 64; i += 8) g.fillRect(0, i, 64, 2);
    return c;
  })();
  const vetroAltrui = new THREE.MeshStandardMaterial({ color: "#9fc4e8", roughness: 0.05, transparent: true, opacity: 0.55, emissive: "#ffb860", emissiveIntensity: 0 });
  const lumeAltrui = new THREE.MeshBasicMaterial({ color: "#ffc27a", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const lumeSpento = new THREE.MeshBasicMaterial({ color: "#ffc27a", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const aloneTex = tela((g, n) => {
    const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    r.addColorStop(0, "rgba(255,210,140,1)");
    r.addColorStop(0.25, "rgba(255,190,110,.55)");
    r.addColorStop(1, "rgba(255,170,80,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, n, n);
  });
  const MIEI = C.piani.map((dati) => {
    const tipo = espandiGriglia(dati.griglia, dati.W * dati.H);
    return { dati, k: dati.k, nome: dati.nome, livello: dati.livello, W: dati.W, H: dati.H, passo: dati.passo, tipo, stanze: stanzeDellaPianta(dati, tipo) };
  }).sort((a, b) => a.livello - b.livello);
  const confini = (p) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < p.W * p.H; i++) {
      if (p.tipo[i] === CELLA.fuori) continue;
      const x = i % p.W, y = i / p.W | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (x0 === Infinity) return { x0: 0, x1: p.W * p.passo, y0: 0, y1: p.H * p.passo };
    return { x0: x0 * p.passo, x1: (x1 + 1) * p.passo, y0: y0 * p.passo, y1: (y1 + 1) * p.passo };
  };
  for (const p of MIEI) p.confini = confini(p);
  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
  for (const p of MIEI) {
    bx0 = Math.min(bx0, p.confini.x0);
    bx1 = Math.max(bx1, p.confini.x1);
    by0 = Math.min(by0, p.confini.y0);
    by1 = Math.max(by1, p.confini.y1);
  }
  if (!MIEI.length) [bx0, bx1, by0, by1] = [0, 10, 0, 8];
  const OX = -(bx0 + bx1) / 2, OZ = -(by0 + by1) / 2;
  const X = (x) => OX + x, Z = (y) => OZ + y;
  const LARGO = bx1 - bx0, FONDO = by1 - by0, MISURA = Math.max(LARGO, FONDO, 6);
  const CX = X((bx0 + bx1) / 2), FZ = Z(by1), RZ = Z(by0);
  const forma = new THREE.Shape();
  const R = 40 + MISURA;
  forma.moveTo(-R, -R);
  forma.lineTo(R, -R);
  forma.lineTo(R, R);
  forma.lineTo(-R, R);
  forma.lineTo(-R, -R);
  const buco = new THREE.Path();
  buco.moveTo(X(bx0), -Z(by0));
  buco.lineTo(X(bx1), -Z(by0));
  buco.lineTo(X(bx1), -Z(by1));
  buco.lineTo(X(bx0), -Z(by1));
  buco.lineTo(X(bx0), -Z(by0));
  forma.holes.push(buco);
  const prato = new THREE.Mesh(new THREE.ShapeGeometry(forma), mat(TIPO === "villa" && E.giardino !== false ? "#3d6b45" : "#7d8a74", { roughness: 1 }));
  prato.rotation.x = -Math.PI / 2;
  prato.receiveShadow = true;
  scena.add(prato);
  const FR = TIPO === "villa" && E.giardino !== false ? 7 : 0;
  const marciapiede = new THREE.Mesh(new THREE.BoxGeometry(2 * R, 0.06, 3.2), mat("#b8b2a6"));
  marciapiede.position.set(CX, 0.03, FZ + 3.4 + FR);
  marciapiede.receiveShadow = true;
  scena.add(marciapiede);
  const strada = new THREE.Mesh(new THREE.BoxGeometry(2 * R, 0.02, 7), mat("#3b3f46", { roughness: 0.95 }));
  strada.position.set(CX, 0.01, FZ + 8.6 + FR);
  strada.receiveShadow = true;
  scena.add(strada);
  const lineaMat = mat("#e5e7eb");
  for (let i = -8; i <= 8; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(2, 0.025, 0.15), lineaMat);
    t.position.set(CX + i * 5, 0.022, FZ + 8.6 + FR);
    scena.add(t);
  }
  const troncoMat = mat("#6b4f3a"), chiomaMat = mat("#3f7d4f", { flatShading: true }), cipressoMat = mat("#2f5d3c", { flatShading: true });
  const albero = (x, z, h = 1, cipresso = false) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * h, 0.2 * h, 2.2 * h, 10), troncoMat);
    t.position.set(x, 1.1 * h, z);
    t.castShadow = true;
    scena.add(t);
    const c = new THREE.Mesh(cipresso ? new THREE.ConeGeometry(0.9 * h, 5.5 * h, 10) : new THREE.IcosahedronGeometry(1.4 * h, 1), cipresso ? cipressoMat : chiomaMat);
    c.position.set(x, (cipresso ? 4.2 : 3) * h, z);
    c.castShadow = true;
    scena.add(c);
  };
  const lampioni = [];
  const lampione = (x, z, alto2 = 4.2) => {
    const pal = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, alto2, 8), ringhieraMat);
    pal.position.set(x, alto2 / 2, z);
    scena.add(pal);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: "#fff7e6", emissive: "#ffc98a", emissiveIntensity: 0 }));
    b.position.set(x, alto2, z);
    scena.add(b);
    const l = new THREE.PointLight("#ffc98a", 0, 11, 1.6);
    l.position.set(x, alto2 - 0.3, z);
    scena.add(l);
    lampioni.push({ b, l });
  };
  const auto = (x, z, c, ruota2 = 0) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ruota2;
    scena.add(g);
    box(g, 1.8, 0.7, 4.3, mat(c, { roughness: 0.3, metalness: 0.4 }), 0, 0.25, 0);
    box(g, 1.6, 0.55, 2.2, mat("#1e293b", { roughness: 0.1 }), 0, 0.95, -0.2);
    const ruotaMat = mat("#111111");
    for (const [dx, dz] of [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 14), ruotaMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(dx, 0.33, dz);
      g.add(w);
    }
  };
  let acqua = null;
  if (TIPO === "villa" && FR) {
    const lx0 = X(bx0) - 7, lx1 = X(bx1) + 11, lz0 = RZ - 6, lz1 = FZ + FR + 1.6;
    const siepe = mat("#2f5d3c", { roughness: 1, flatShading: true });
    box(scena, lx1 - lx0, 1.3, 0.7, siepe, (lx0 + lx1) / 2, 0, lz0);
    box(scena, 0.7, 1.3, lz1 - lz0, siepe, lx0, 0, (lz0 + lz1) / 2);
    box(scena, 0.7, 1.3, lz1 - lz0, siepe, lx1, 0, (lz0 + lz1) / 2);
    const gx = CX;
    box(scena, gx - 2 - lx0, 1.1, 0.3, pietraMat, (lx0 + gx - 2) / 2, 0, lz1);
    box(scena, lx1 - gx - 2, 1.1, 0.3, pietraMat, (lx1 + gx + 2) / 2, 0, lz1);
    for (let x = lx0 + 0.3; x < lx1; x += 0.22) if (Math.abs(x - gx) > 2) box(scena, 0.04, 0.6, 0.04, ringhieraMat, x, 1.1, lz1);
    for (const dx of [-2, 2]) {
      box(scena, 0.5, 1.8, 0.5, pietraMat, gx + dx, 0, lz1);
      box(scena, 0.6, 0.1, 0.6, corniceMat, gx + dx, 1.8, lz1);
    }
    for (let x = gx - 1.75; x <= gx + 1.75; x += 0.16) box(scena, 0.035, 1.5, 0.035, ringhieraMat, x, 0, lz1);
    box(scena, 3.5, 0.08, 0.06, ringhieraMat, gx, 1.45, lz1);
    box(scena, 3.2, 0.03, lz1 - FZ, mat("#d8cdb8", { roughness: 1 }), gx, 0, (FZ + lz1) / 2);
    const px = X(bx1) + 5.6, pz = (RZ + FZ) / 2;
    box(scena, 5, 0.12, 9.4, mat("#e9e2d2"), px, 0, pz);
    acqua = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.02, 8),
      new THREE.MeshStandardMaterial({ color: "#38bdf8", emissive: "#0ea5e9", emissiveIntensity: 0, roughness: 0.05, metalness: 0.1 })
    );
    acqua.position.set(px, 0.125, pz);
    scena.add(acqua);
    const lettino = mat("#f8fafc");
    for (const dz of [-2.4, 0.4]) box(scena, 0.7, 0.3, 1.9, lettino, px + 3, 0, pz + dz);
    albero(lx0 + 2.2, lz0 + 2.5, 1.2);
    albero(lx0 + 2, FZ + 2.6, 0.9);
    albero(lx1 - 1.5, lz0 + 1.8, 1.1);
    for (let i = 0; i < 4; i++) albero(lx1 - 1.2, pz - 4 + i * 2.6, 0.75, true);
    for (let i = 0; i < 3; i++) albero(lx0 + 1.2, RZ + 2 + i * 3, 0.7, true);
    lampione(gx - 2.6, lz1 - 0.6, 1);
    lampione(gx + 2.6, lz1 - 0.6, 1);
    lampione(px - 2.8, pz + 4.6, 2.4);
    auto(gx + 0.1, FZ + FR - 1.5, "#e2e8f0", Math.PI / 2 - 0.15);
  } else if (TIPO === "villa") {
    lampione(CX - 3, FZ + 2.2, 1);
    lampione(CX + 3, FZ + 2.2, 1);
  } else {
    const m2 = new THREE.Mesh(new THREE.BoxGeometry(LARGO + 6, 0.05, FONDO + 6), mat("#c4bdb0"));
    m2.position.set(CX, 0.02, (RZ + FZ) / 2);
    m2.receiveShadow = true;
    scena.add(m2);
    for (let i = -3; i <= 3; i++) if (i) albero(CX + i * 5.2, FZ + 4.4, 0.85);
    for (let i = -2; i <= 2; i++) lampione(CX + i * 10.4 + 2.6, FZ + 4.6);
    auto(CX - 8, FZ + 6.2, "#1d4ed8", Math.PI / 2);
    auto(CX + 2.5, FZ + 6.2, "#e11d48", Math.PI / 2);
    auto(CX + 12, FZ + 6.2, "#f8fafc", Math.PI / 2);
    const vicini = mat("#cbd5e1", { roughness: 0.95 });
    const alto2 = (E.pianiPalazzo || 6) * PASSO_DEI_PIANI;
    for (const lato of [-1, 1]) box(scena, 10, Math.max(7, alto2 * (lato < 0 ? 0.62 : 0.48)), FONDO, vicini, CX + lato * (LARGO / 2 + 5.2), 0, (RZ + FZ) / 2);
  }
  const pareteDi = (p, id) => {
    if (!p.pareti.has(id)) {
      const s = p.stanze.find((x) => x.id === id);
      p.pareti.set(id, mat(s?.dati.pareti || PARETE_DI_PARTENZA, { roughness: 0.92, side: THREE.DoubleSide }));
    }
    return p.pareti.get(id);
  };
  function costruisciPiano(p) {
    const gr = new THREE.Group();
    scena.add(gr);
    p.gr = gr;
    p.guscio = new THREE.Group();
    gr.add(p.guscio);
    const G = p.guscio;
    const { W, H, passo, tipo } = p;
    const fuoriId = new Set(p.stanze.filter((s) => s.dati.fuori).map((s) => s.id));
    const eFuori = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return true;
      const t = tipo[y * W + x];
      return t === CELLA.fuori || fuoriId.has(t);
    };
    for (const r of rettangoli(p, (t) => t !== CELLA.fuori)) {
      const s = box(G, r.w, 0.25, r.d, solaioMat, X(r.x + r.w / 2), -0.25, Z(r.y + r.d / 2));
      s.castShadow = false;
    }
    p.pavCanvas = pavimentoDellaPianta(p.dati, tipo, riquadro);
    const tx = new THREE.CanvasTexture(p.pavCanvas);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = 4;
    p.pavTex = tx;
    const pv = new THREE.Mesh(new THREE.PlaneGeometry(W * passo, H * passo), new THREE.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: 0.5, roughness: 0.75 }));
    pv.rotation.x = -Math.PI / 2;
    pv.position.set(X(W * passo / 2), 3e-3, Z(H * passo / 2));
    pv.receiveShadow = true;
    gr.add(pv);
    p.pavMesh = pv;
    p.veloCanvas = document.createElement("canvas");
    p.veloCanvas.width = W;
    p.veloCanvas.height = H;
    p.veloTex = new THREE.CanvasTexture(p.veloCanvas);
    p.veloTex.magFilter = THREE.NearestFilter;
    p.velo = new THREE.Mesh(new THREE.PlaneGeometry(W * passo, H * passo), new THREE.MeshBasicMaterial({ map: p.veloTex, transparent: true, depthWrite: false }));
    p.velo.rotation.x = -Math.PI / 2;
    p.velo.position.set(pv.position.x, 0.02, pv.position.z);
    p.velo.visible = false;
    gr.add(p.velo);
    const esterno = p.livello < 0 || TIPO === "palazzo" && p.numero === 0 ? pietraMat : facciataMat;
    p.pareti = /* @__PURE__ */ new Map();
    const lato = (celle) => {
      let fuoriN = 0;
      const conta = /* @__PURE__ */ new Map();
      for (const [x, y] of celle) {
        if (eFuori(x, y)) {
          fuoriN++;
          continue;
        }
        const t = tipo[y * W + x];
        if (t > 0) conta.set(t, (conta.get(t) || 0) + 1);
      }
      const migliore = [...conta].sort((a, b) => b[1] - a[1])[0];
      if (fuoriN > (migliore?.[1] || 0)) return esterno;
      return migliore ? pareteDi(p, migliore[0]) : muroMat;
    };
    const facce = (r) => {
      const col = (x) => Array.from({ length: r.ch }, (_, i) => [x, r.cy + i]);
      const riga = (y) => Array.from({ length: r.cw }, (_, i) => [r.cx + i, y]);
      return [lato(col(r.cx + r.cw)), lato(col(r.cx - 1)), muroMat, muroMat, lato(riga(r.cy + r.ch)), lato(riga(r.cy - 1))];
    };
    p.muri = [];
    for (const r of rettangoli(p, (t) => t === CELLA.muro)) p.muri.push(box(G, r.w, HP, r.d, facce(r), X(r.x + r.w / 2), 0, Z(r.y + r.d / 2)));
    for (const r of rettangoli(p, (t) => t === CELLA.davanzale)) {
      p.muri.push(box(G, r.w, 0.9, r.d, facce(r), X(r.x + r.w / 2), 0, Z(r.y + r.d / 2)));
      p.muri.push(box(G, r.w, HP - 2.2, r.d, facce(r), X(r.x + r.w / 2), 2.2, Z(r.y + r.d / 2)));
    }
    for (const r of rettangoli(p, (t) => t === CELLA.porta)) p.muri.push(box(G, r.w, HP - 2.15, r.d, facce(r), X(r.x + r.w / 2), 2.15, Z(r.y + r.d / 2)));
    if (p.livello >= 0) {
      const c2 = p.confini, w = c2.x1 - c2.x0, d = c2.y1 - c2.y0, cx = X((c2.x0 + c2.x1) / 2), cz = Z((c2.y0 + c2.y1) / 2);
      box(G, w + 0.24, 0.22, 0.24, corniceMat, cx, -0.25, Z(c2.y0));
      box(G, w + 0.24, 0.22, 0.24, corniceMat, cx, -0.25, Z(c2.y1));
      box(G, 0.24, 0.22, d, corniceMat, X(c2.x0), -0.25, cz);
      box(G, 0.24, 0.22, d, corniceMat, X(c2.x1), -0.25, cz);
    }
    p.cime = new THREE.Group();
    p.cime.visible = false;
    gr.add(p.cime);
    for (const r of rettangoli(p, (t) => t === CELLA.muro)) {
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.012, r.d), cimaMat);
      c2.position.set(X(r.x + r.w / 2), TAGLIO - 4e-3, Z(r.y + r.d / 2));
      p.cime.add(c2);
    }
    p.finestre = [];
    p.tapparelle = [];
    p.porte = [];
    for (const a of p.dati.aperture || []) {
      const g = new THREE.Group();
      g.position.set(X(a.x), 0, Z(a.y));
      g.rotation.y = a.orizz ? 0 : -Math.PI / 2;
      G.add(g);
      const est = (a.orizz ? a.verso : -a.verso) || 1;
      if (a.tipo === "finestra") {
        const basso = a.portafinestra ? 0.02 : 0.9;
        if (!a.portafinestra) box(g, a.largo + 0.08, 0.04, 0.42, telaioMat, 0, 0.9, 0);
        const anta = new THREE.Group();
        anta.position.set(-a.largo / 2, 0, -est * 0.05);
        g.add(anta);
        const vet = new THREE.Mesh(
          new THREE.BoxGeometry(a.largo - 0.08, 2.2 - basso - 0.04, 0.04),
          new THREE.MeshStandardMaterial({ color: "#9fc4e8", roughness: 0.05, transparent: true, opacity: 0.5, emissive: "#ffb860", emissiveIntensity: 0 })
        );
        vet.position.set(a.largo / 2, basso + (2.2 - basso) / 2, 0);
        anta.add(vet);
        const bordo = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(a.largo - 0.04, 2.2 - basso - 0.02, 0.05)), new THREE.LineBasicMaterial({ color: "#f8fafc" }));
        bordo.position.copy(vet.position);
        anta.add(bordo);
        const lume = new THREE.Mesh(
          new THREE.PlaneGeometry(a.largo - 0.1, 2.2 - basso - 0.06),
          new THREE.MeshBasicMaterial({ color: "#ffc27a", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
        );
        lume.position.set(0, basso + (2.2 - basso) / 2, -est * 0.1);
        lume.visible = false;
        g.add(lume);
        p.finestre.push({ a, anta, vet, lume, verso: -est, aperta: 0, voluto: 0 });
        const lamelle = new THREE.CanvasTexture(lamelleCanvas);
        lamelle.wrapS = lamelle.wrapT = THREE.RepeatWrapping;
        const tap = new THREE.Mesh(new THREE.BoxGeometry(a.largo + 0.04, 1, 0.05), mat("#8793a5", { map: lamelle, roughness: 0.6 }));
        tap.position.z = est * 0.24;
        g.add(tap);
        box(g, a.largo + 0.1, 0.12, 0.18, mat("#cbd5e1"), 0, 2.2, est * 0.24);
        box(g, a.largo + 0.3, 0.07, 0.16, corniceMat, 0, basso - 0.07, est * 0.3);
        box(g, a.largo + 0.3, 0.14, 0.1, corniceMat, 0, 2.2, est * 0.29);
        const ante = [];
        if (TIPO === "villa")
          for (const lt of [-1, 1]) {
            const cer = new THREE.Group();
            cer.position.set(lt * (a.largo / 2 + 0.02), 0, est * 0.3);
            g.add(cer);
            const an = new THREE.Mesh(new THREE.BoxGeometry(a.largo / 2, 2.2 - basso, 0.04), persianaMat);
            an.position.set(-lt * a.largo / 4, basso + (2.2 - basso) / 2, 0);
            an.castShadow = true;
            cer.add(an);
            ante.push({ cer, lato: lt, est });
          }
        if (a.portafinestra && p.livello >= 0 && (TIPO === "palazzo" ? p.numero > 0 : p.indice > 0)) {
          box(g, a.largo + 0.8, 0.14, 1, corniceMat, 0, -0.14, est * 0.8);
          for (let x = -a.largo / 2 - 0.35; x <= a.largo / 2 + 0.36; x += 0.12) box(g, 0.025, 1, 0.025, ringhieraMat, x, 0, est * 1.27);
          box(g, a.largo + 0.8, 0.05, 0.06, ringhieraMat, 0, 1, est * 1.27);
        }
        p.tapparelle.push({ a, tap, basso, ante, chiusa: 0, voluta: 0 });
      } else {
        const anta = new THREE.Group();
        anta.position.set(-a.largo / 2 + 0.03, 0, 0);
        g.add(anta);
        const legno = new THREE.Mesh(new THREE.BoxGeometry(a.largo - 0.06, 2.1, 0.04), mat(a.verso ? "#4b5563" : "#d6c4a8", { roughness: 0.6 }));
        legno.position.set((a.largo - 0.06) / 2, 1.05, 0);
        legno.castShadow = true;
        anta.add(legno);
        const chiusa = a.verso ? 0 : 1.25;
        anta.rotation.y = chiusa;
        p.porte.push({ a, anta, aperta: a.verso ? 0 : 1, voluto: a.verso ? 0 : 1, sensore: false });
      }
    }
    p.bordi = [];
    for (let cy = 1; cy < H - 1; cy++)
      for (let cx = 1; cx < W - 1; cx++) {
        const t = tipo[cy * W + cx];
        if (t <= 0) continue;
        let nx = 0, ny = 0, n = 0;
        if (MURO(tipo[cy * W + cx - 1])) nx += 1, n++;
        if (MURO(tipo[cy * W + cx + 1])) nx -= 1, n++;
        if (MURO(tipo[(cy - 1) * W + cx])) ny += 1, n++;
        if (MURO(tipo[(cy + 1) * W + cx])) ny -= 1, n++;
        if (n) p.bordi.push({ id: t, x: (cx + 0.5) * passo, y: (cy + 0.5) * passo, nx, ny, angolo: nx !== 0 && ny !== 0 });
      }
    p.evid = new THREE.Group();
    p.evid.visible = false;
    gr.add(p.evid);
    const c = p.confini;
    const eb = new THREE.Mesh(new THREE.BoxGeometry(c.x1 - c.x0 + 0.3, HP + 0.2, c.y1 - c.y0 + 0.3), new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.16, depthWrite: false }));
    eb.position.set(X((c.x0 + c.x1) / 2), HP / 2 - 0.15, Z((c.y0 + c.y1) / 2));
    p.evid.add(eb);
    const ee = new THREE.LineSegments(new THREE.EdgesGeometry(eb.geometry), new THREE.LineBasicMaterial({ color: "#7dd3fc" }));
    ee.position.copy(eb.position);
    p.evid.add(ee);
    p.arrediGr = new THREE.Group();
    gr.add(p.arrediGr);
    p.arredi = [];
    for (const dati of p.dati.arredi || []) mettiArredo(p, dati);
    p.dispGr = new THREE.Group();
    gr.add(p.dispGr);
    p.disp = [];
    p.luci = [];
    for (const dati of p.dati.dispositivi || []) mettiDispositivo(p, dati);
  }
  const voceDi = (k) => VOCI_ARREDI[k] || { k, icona: "📦", nome: [k, k], w: 0.6, d: 0.6 };
  const quarto = (rot) => Math.abs(Math.round(rot / (Math.PI / 2))) % 2 === 1;
  const ingombro = (k, rot) => {
    const v = voceDi(k);
    return quarto(rot) ? [v.d, v.w] : [v.w, v.d];
  };
  const stanzaIn = (p, x, y) => {
    const cx = Math.floor(x / p.passo), cy = Math.floor(y / p.passo);
    if (cx < 0 || cy < 0 || cx >= p.W || cy >= p.H) return null;
    const t = p.tipo[cy * p.W + cx];
    return p.stanze.find((s) => s.id === t) || null;
  };
  function mettiArredo(p, dati) {
    const s = p.stanze.find((x) => x.id === dati.stanza) || stanzaIn(p, dati.x, dati.y);
    const tinta = dati.tinta || TINTE_DI_PARTENZA[(s?.id || 0) % 4];
    const m = arredo3D(THREE, dati.k, tinta);
    m.position.set(X(dati.x), 0, Z(dati.y));
    m.rotation.y = dati.rot || 0;
    p.arrediGr.add(m);
    const [w, d] = ingombro(dati.k, dati.rot || 0);
    const A = { dati, k: dati.k, p, s, m, w, d, sotto: dati.sotto || ARREDI_SOTTO.includes(dati.k) };
    p.arredi.push(A);
    return A;
  }
  function ciSta(A, x, y, rot = A.dati.rot || 0) {
    const p = A.p;
    const [w, d] = ingombro(A.k, rot);
    const s = stanzaIn(p, x, y);
    if (!s) return null;
    for (let yy = y - d / 2; yy <= y + d / 2 + 1e-6; yy += p.passo)
      for (let xx = x - w / 2; xx <= x + w / 2 + 1e-6; xx += p.passo) {
        const cx = Math.floor(xx / p.passo), cy = Math.floor(yy / p.passo);
        if (cx < 0 || cy < 0 || cx >= p.W || cy >= p.H || p.tipo[cy * p.W + cx] <= 0) return null;
      }
    if (!A.sotto)
      for (const B of p.arredi) {
        if (B === A || B.sotto) continue;
        if (Math.abs(B.dati.x - x) < (B.w + w) / 2 - 0.02 && Math.abs(B.dati.y - y) < (B.d + d) / 2 - 0.02) return null;
      }
    return s;
  }
  function posa(A, x, y, rot = A.dati.rot || 0) {
    const s = ciSta(A, x, y, rot);
    if (!s) return false;
    [A.w, A.d] = ingombro(A.k, rot);
    Object.assign(A.dati, { x: +x.toFixed(3), y: +y.toFixed(3), rot: +rot.toFixed(4), stanza: s.id });
    A.s = s;
    return true;
  }
  function cercaPosto(p, s, k) {
    const prova = { k, p, sotto: ARREDI_SOTTO.includes(k), dati: {} };
    for (let r = 0; r < 6; r += 0.1)
      for (let an = 0; an < 6.28; an += 0.3) {
        const x = Math.round((s.sx + Math.cos(an) * r) / AGGANCIO) * AGGANCIO, y = Math.round((s.sy + Math.sin(an) * r) / AGGANCIO) * AGGANCIO;
        if (stanzaIn(p, x, y)?.id !== s.id) continue;
        if (ciSta(prova, x, y, 0)) return { x, y, rot: 0 };
        if (ciSta(prova, x, y, Math.PI / 2)) return { x, y, rot: Math.PI / 2 };
      }
    return null;
  }
  const altezzaVista = (h) => Math.min(h, TAGLIO - 0.08);
  function vesti(Dv) {
    const g = Dv.vesti;
    while (g.children.length) {
      const o = g.children.pop();
      o.traverse?.((x) => x.geometry?.dispose());
    }
    Dv.cono = null;
    Dv.zona = null;
    const y = altezzaVista(Dv.dati.h);
    if (Dv.k === "telecamera") {
      const lungo = 4.2, inclina = 0.5, r0 = Math.tan((Dv.dati.fov || 100) * Math.PI / 360) * lungo;
      const cono = new THREE.Mesh(
        new THREE.ConeGeometry(r0, lungo, 28, 1, true),
        new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })
      );
      cono.geometry.translate(0, -lungo / 2, 0);
      cono.rotation.x = -Math.PI / 2 - inclina;
      const perno = new THREE.Group();
      perno.position.copy(Dv.m.userData.occhio || new THREE.Vector3());
      perno.add(cono);
      const bordo = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.ConeGeometry(r0, lungo, 8, 1, true)),
        new THREE.LineBasicMaterial({ color: "#7dd3fc", transparent: true, opacity: 0.35 })
      );
      bordo.geometry.translate(0, -lungo / 2, 0);
      bordo.rotation.copy(cono.rotation);
      perno.add(bordo);
      g.add(perno);
      nonSiTocca(perno);
      Dv.cono = perno;
    }
    if (Dv.k === "movimento" || Dv.k === "presenza" || Dv.k === "antifurto") {
      const r = Dv.k === "presenza" ? 2.2 : 4.5;
      const geo = Dv.k === "presenza" ? new THREE.CircleGeometry(r, 40) : new THREE.CircleGeometry(r, 40, Math.PI / 2 - 0.9, 1.8);
      const zona = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: "#a78bfa", transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
      zona.rotation.x = Math.PI / 2;
      zona.position.y = -y + 0.03;
      g.add(zona);
      nonSiTocca(zona);
      Dv.zona = zona;
    }
    if (Dv.k === "acqua") {
      const anello = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.16, 32), new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      anello.rotation.x = -Math.PI / 2;
      anello.position.y = 0.012;
      g.add(anello);
      nonSiTocca(anello);
      Dv.zona = anello;
    }
  }
  const nonSiTocca = (o) => o.traverse((x) => x.raycast = () => {
  });
  function mettiDispositivo(p, dati, esterna = false) {
    const k = dati.k;
    const m = arredo3D(THREE, k === "telecamera" && esterna ? "cam_bullet" : k);
    const Dv = { dati, k, D: DISPOSITIVI_3D[k], p, m, esterna, stato: null };
    Dv.vesti = new THREE.Group();
    m.add(Dv.vesti);
    if (esterna) {
      m.position.set(X(dati.x), (terraP()?.base || 0.35) + dati.h, Z(dati.y));
      m.rotation.y = dati.rot || 0;
      scena.add(m);
    } else {
      m.position.set(X(dati.x), altezzaVista(dati.h), Z(dati.y));
      m.rotation.y = dati.rot || 0;
      p.dispGr.add(m);
    }
    vesti(Dv);
    if (k === "luce" && !esterna) {
      const s = p.stanze.find((x) => x.id === dati.stanza);
      const lato = Math.min(4.5, Math.sqrt(s?.area || 9) * 1.4);
      const alone = new THREE.Mesh(
        new THREE.PlaneGeometry(lato, lato),
        new THREE.MeshBasicMaterial({ map: aloneTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })
      );
      alone.rotation.x = -Math.PI / 2;
      alone.position.set(0, -altezzaVista(dati.h) + 0.02, 0);
      m.add(alone);
      nonSiTocca(alone);
      Dv.luce = { alone, livello: 0, voluto: 0 };
      p.luci.push(Dv);
    }
    if (esterna) ESTERNE.push(Dv);
    else p.disp.push(Dv);
    return Dv;
  }
  function togliDispositivo(Dv) {
    const p = Dv.p;
    Dv.m.parent?.remove(Dv.m);
    liberaOggetto(Dv.m);
    Dv.el?.remove();
    p.disp = p.disp.filter((x) => x !== Dv);
    p.luci = p.luci.filter((x) => x !== Dv);
    p.dati.dispositivi = p.dati.dispositivi.filter((x) => x !== Dv.dati);
  }
  const versoRot = (dx, dy) => Math.atan2(dx, dy);
  function postoDispositivo(p, s, k) {
    const D = DISPOSITIVI_3D[k];
    const miei = p.bordi.filter((b2) => b2.id === s.id);
    if (D.mont === "soffitto" || D.mont === "pavimento" || !miei.length) return { x: s.sx, y: s.sy + (D.mont === "pavimento" ? 0.6 : 0), rot: 0 };
    const vede = (b2) => {
      for (let t = 0; t <= 1; t += 0.04) {
        const cx = Math.floor((b2.x + (s.sx - b2.x) * t) / p.passo), cy = Math.floor((b2.y + (s.sy - b2.y) * t) / p.passo);
        if (p.tipo[cy * p.W + cx] !== s.id) return false;
      }
      return Math.hypot(s.sx - b2.x, s.sy - b2.y) > 1.2;
    };
    if (D.mont === "angolo") {
      const ang = miei.filter((b3) => b3.angolo && vede(b3));
      const lista = ang.length ? ang : miei.filter(vede).length ? miei.filter(vede) : miei;
      const usati = p.disp.filter((x) => x.dati.stanza === s.id).map((x) => [x.dati.x, x.dati.y]);
      const pena = (q) => usati.some(([ux, uy]) => Math.hypot(ux - q.x, uy - q.y) < 1.5) ? -100 : 0;
      const b2 = lista.slice().sort((a, c) => Math.hypot(c.x - s.sx, c.y - s.sy) + pena(c) - (Math.hypot(a.x - s.sx, a.y - s.sy) + pena(a)))[0];
      return { x: b2.x, y: b2.y, rot: versoRot(s.sx - b2.x, s.sy - b2.y) };
    }
    if (D.mont === "finestra" || D.mont === "porta") {
      const tipoA = D.mont === "porta" ? "porta" : "finestra";
      const ap = (p.dati.aperture || []).filter((a) => a.tipo === tipoA && (a.stanza === s.id || stanzaVicina(p, a) === s.id));
      if (ap.length) {
        const a = ap[0];
        const b2 = miei.slice().sort((u, v) => Math.hypot(u.x - a.x, u.y - a.y) - Math.hypot(v.x - a.x, v.y - a.y))[0];
        return { x: b2.x + (a.orizz ? a.largo / 2 : 0), y: b2.y + (a.orizz ? 0 : a.largo / 2), rot: versoRot(b2.nx, b2.ny) };
      }
    }
    const b = miei.filter((q) => !q.angolo).sort((u, v) => Math.hypot(u.x - s.sx, u.y - s.sy) - Math.hypot(v.x - s.sx, v.y - s.sy))[0] || miei[0];
    return { x: b.x, y: b.y, rot: versoRot(b.nx, b.ny) };
  }
  function stanzaVicina(p, a) {
    if (a.stanza) return a.stanza;
    for (const [dx, dy] of [[0, 0.3], [0, -0.3], [0.3, 0], [-0.3, 0]]) {
      const s = stanzaIn(p, a.x + dx, a.y + dy);
      if (s) return s.id;
    }
    return 0;
  }
  function aperturaDi(Dv, elenco) {
    const vicine = elenco.filter((F) => stanzaVicina(Dv.p, F.a) === Dv.dati.stanza || Math.hypot(F.a.x - Dv.dati.x, F.a.y - Dv.dati.y) < 2.5);
    return vicine.sort((u, v) => Math.hypot(u.a.x - Dv.dati.x, u.a.y - Dv.dati.y) - Math.hypot(v.a.x - Dv.dati.x, v.a.y - Dv.dati.y))[0] || null;
  }
  const ESTERNE = [];
  const PIANI = [];
  const nomeOrdinale = (i) => ORDINALI[i] ? L(ORDINALI[i][0], ORDINALI[i][1]) : L(`Piano ${i}`, `Floor ${i}`);
  if (TIPO === "villa") {
    MIEI.forEach((p, i) => {
      p.indice = i;
      costruisciPiano(p);
      PIANI.push(p);
    });
  } else {
    const N = Math.max(2, E.pianiPalazzo || 6);
    const mio = Math.min(N - 1, E.mioPiano || 0);
    MIEI.forEach((p, i) => {
      p.numero = mio + i;
      p.indice = i;
      costruisciPiano(p);
    });
    const modello = MIEI[0];
    const vetriMiei = new Set((modello?.finestre || []).map((F) => F.vet.material));
    const lumiMiei = new Set((modello?.finestre || []).map((F) => F.lume.material));
    for (let i = 0; i < Math.max(N, mio + MIEI.length); i++) {
      const p = MIEI[i - mio];
      if (p) {
        PIANI.push(p);
        continue;
      }
      if (!modello) continue;
      const gr = new THREE.Group();
      const guscio = modello.guscio.clone(true);
      guscio.traverse((o) => {
        if (vetriMiei.has(o.material)) o.material = vetroAltrui;
        else if (lumiMiei.has(o.material)) {
          o.material = (i + o.id) % 3 ? lumeSpento : lumeAltrui;
          o.visible = true;
        }
      });
      gr.add(guscio);
      scena.add(gr);
      PIANI.push({ k: `altro${i}`, nome: nomeOrdinale(i), numero: i, altrui: true, gr, confini: modello.confini, stanze: [], luci: [], disp: [], arredi: [], finestre: [], tapparelle: [], porte: [], cime: null, evid: null });
    }
  }
  let quota = PIANI[0]?.livello < 0 ? -1.5 : 0.35;
  for (const p of PIANI) {
    p.base = quota;
    p.gr.position.y = quota;
    quota += PASSO_DEI_PIANI;
  }
  function terraP() {
    return PIANI.find((p) => p.base > 0) || PIANI[0];
  }
  const cima = PIANI[PIANI.length - 1];
  const QUOTA_TETTO = (cima?.base || 0.35) + HP;
  const CIMA = QUOTA_TETTO + 2;
  if (TIPO === "villa" && cima) {
    const c = cima.confini, w = c.x1 - c.x0, d = c.y1 - c.y0, cx = X((c.x0 + c.x1) / 2), cz = Z((c.y0 + c.y1) / 2);
    const tetto = new THREE.Group();
    tetto.position.y = QUOTA_TETTO;
    scena.add(tetto);
    box(tetto, w + 0.5, 0.3, d + 0.5, corniceMat, cx, 0, cz);
    if (E.tetto !== "piano") {
      const coppi = E.coppi || "#b5532f";
      const ct = tela((g, n) => {
        g.fillStyle = coppi;
        g.fillRect(0, 0, n, n);
        const base = new THREE.Color(coppi);
        for (let y = 0; y < n; y += 16)
          for (let x = 0; x < n; x += 24) {
            const v = caso() * 0.12;
            g.fillStyle = `#${base.clone().offsetHSL(0, 0, v - 0.02).getHexString()}`;
            g.beginPath();
            g.ellipse(x + 12 + y / 16 % 2 * 12, y + 8, 10, 9, 0, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "rgba(60,20,10,.35)";
            g.fillRect(x, y + 14, 24, 2);
          }
      });
      const t = new THREE.Mesh(tettoAFalde(THREE, X(c.x0) - 0.7, X(c.x1) + 0.7, Z(c.y0) - 0.7, Z(c.y1) + 0.7, Math.min(w, d) * 0.2), mat("#ffffff", { map: ct, roughness: 0.85, side: THREE.DoubleSide }));
      t.position.y = 0.3;
      t.castShadow = true;
      tetto.add(t);
      box(tetto, 0.8, 1.9, 0.6, facciataMat, X(c.x0 + w * 0.72), 1.4, Z(c.y0 + d * 0.35));
      box(tetto, 1, 0.12, 0.8, mat("#7c2d12"), X(c.x0 + w * 0.72), 3.3, Z(c.y0 + d * 0.35));
    } else {
      box(tetto, w + 0.5, 0.9, 0.25, facciataMat, cx, 0.3, Z(c.y0) - 0.12);
      box(tetto, w + 0.5, 0.9, 0.25, facciataMat, cx, 0.3, Z(c.y1) + 0.12);
      box(tetto, 0.25, 0.9, d, facciataMat, X(c.x0) - 0.12, 0.3, cz);
      box(tetto, 0.25, 0.9, d, facciataMat, X(c.x1) + 0.12, 0.3, cz);
    }
  } else if (cima) {
    const g = new THREE.Group();
    g.position.y = QUOTA_TETTO;
    scena.add(g);
    box(g, LARGO, 0.25, FONDO, mat("#cfc8bb"), CX, 0, (RZ + FZ) / 2);
    box(g, LARGO + 0.6, 0.5, 0.5, corniceMat, CX, 0, RZ);
    box(g, LARGO + 0.6, 0.5, 0.5, corniceMat, CX, 0, FZ);
    box(g, 0.5, 0.5, FONDO, corniceMat, X(bx0), 0, (RZ + FZ) / 2);
    box(g, 0.5, 0.5, FONDO, corniceMat, X(bx1), 0, (RZ + FZ) / 2);
  }
  if (terraP()) {
    const T = terraP();
    const portone = (T.dati?.aperture || []).find((a) => a.tipo === "porta" && a.verso);
    let px = CX, pz = FZ + 0.8, giro2 = 0;
    if (portone) {
      const est = portone.orizz ? portone.verso : -portone.verso;
      giro2 = portone.orizz ? est > 0 ? 0 : Math.PI : est > 0 ? -Math.PI / 2 : Math.PI / 2;
      const fuoriX = portone.orizz ? 0 : -est, fuoriZ = portone.orizz ? est : 0;
      px = X(portone.x) + fuoriX * 0.8;
      pz = Z(portone.y) + fuoriZ * 0.8;
    }
    const pg = new THREE.Group();
    pg.position.set(px, T.base, pz);
    pg.rotation.y = giro2;
    scena.add(pg);
    box(pg, 3, 0.14, 1.6, TIPO === "villa" ? corniceMat : mat("#334155", { metalness: 0.4 }), 0, 2.45, 0);
    if (portone && T.base > 0.1) {
      box(pg, 2.4, 0.18, 1.2, pietraMat, 0, -T.base, 0.4);
      box(pg, 2, 0.18, 0.8, pietraMat, 0, -T.base + 0.18, 0.2);
    }
    const ap = new THREE.PointLight("#ffd7a0", 0, 6, 1.6);
    ap.position.set(0, 2.3, 0.1);
    pg.add(ap);
    lampioni.push({ b: null, l: ap });
  }
  {
    const posti = [
      [CX + 2.6, FZ + 0.25, 0],
      [X(bx1) + 0.25, (RZ + FZ) / 2, Math.PI / 2],
      [X(bx0) - 0.25, RZ + 0.4, -Math.PI * 0.75],
      [X(bx0) - 0.25, FZ - 0.4, -Math.PI / 4]
    ];
    (E.telecamere || []).forEach((dati, i) => {
      if (!dati.x && !dati.y && posti[i % 4]) {
        const [x, z, rot] = posti[i % 4];
        Object.assign(dati, { x: x - OX, y: z - OZ, rot });
      }
      if (!dati.h || dati.h > 3.5) dati.h = 2.6;
      const Dv = mettiDispositivo(terraP(), dati, true);
      Dv.cono?.children.forEach((o) => o.material.opacity *= 0.35);
    });
  }
  const PIANI_MIEI = PIANI.filter((p) => !p.altrui);
  const cielo = new THREE.HemisphereLight("#9fb4ff", "#0b1220", 0.4);
  scena.add(cielo);
  const sole = new THREE.DirectionalLight("#cdd8ff", 0.6);
  sole.position.set(CX - 16, 30 + CIMA, 18);
  sole.castShadow = true;
  sole.shadow.mapSize.set(2048, 2048);
  const ombra = MISURA + 12;
  Object.assign(sole.shadow.camera, { left: -ombra, right: ombra, top: ombra, bottom: -ombra, far: 120 + CIMA * 2 });
  sole.shadow.bias = -6e-4;
  scena.add(sole);
  const MUCCHIO = Array.from({ length: LUCI_ACCESE_AL_MASSIMO }, () => {
    const l = new THREE.PointLight("#ffc98a", 0, 8, 1.6);
    scena.add(l);
    return { l, Dv: null };
  });
  const VISTA_ESTERNA = TIPO === "villa" ? { az: 0.6, al: 0.36, d: MISURA * 1.4 + 24 + CIMA * 1.3, ty: CIMA * 0.3, tx: 0, tz: 0 } : { az: 0.66, al: 0.22, d: MISURA * 1.4 + 26 + CIMA * 1.6, ty: CIMA * 0.42, tx: 0, tz: 0 };
  const vistaPiano = (p) => ({ az: 0.55, al: 0.95, d: MISURA * 1.45 + 8, ty: p.base - 0.8, tx: 0, tz: 0 });
  const S = {
    vista: "esterno",
    cam: { ...VISTA_ESTERNA },
    camVoluta: { ...VISTA_ESTERNA },
    taglio: 200,
    taglioVoluto: 200,
    giorno: 1,
    giornoVoluto: 1,
    arreda: false,
    sel: null,
    pezzo: null,
    scheda: "arredi",
    cat: 0,
    evid: null,
    tempo: 0,
    raf: 0,
    ultimo: 0,
    morto: false,
    salvato: false,
    avviso: "",
    presa: null,
    stati: {}
  };
  function richiedi() {
    if (S.morto || S.raf || opzioni.perLeProve) return;
    S.ultimo = performance.now();
    S.raf = requestAnimationFrame(giro);
  }
  function giro(t) {
    S.raf = 0;
    if (S.morto) return;
    const dt = Math.min(0.1, Math.max(0, (t - S.ultimo) / 1e3));
    S.ultimo = t;
    const ancora = avanza(dt);
    disegna();
    const fermo = String(!S.vola);
    if (palco.dataset.fermo !== fermo) palco.dataset.fermo = fermo;
    if (ancora || S.presa) S.raf = requestAnimationFrame(giro);
  }
  function avanza(dt) {
    S.tempo += dt;
    let muove = false;
    let vola = false;
    const verso = (a, b, v) => {
      if (Math.abs(b - a) > 1e-3) muove = true;
      return a + Math.sign(b - a) * Math.min(Math.abs(b - a), v * dt);
    };
    const k = 1 - Math.pow(0.02, dt);
    for (const c of ["az", "al", "d", "ty", "tx", "tz"]) {
      const a = S.cam[c] ?? 0, b = S.camVoluta[c] ?? 0;
      if (Math.abs(b - a) > 1e-3 * (c === "d" ? 10 : 1)) muove = vola = true;
      S.cam[c] = Math.abs(b - a) < 1e-4 ? b : a + (b - a) * k;
    }
    if (Math.abs(S.taglio - S.taglioVoluto) > 0.01) muove = vola = true;
    S.vola = vola;
    S.taglio = Math.abs(S.taglio - S.taglioVoluto) < 5e-3 ? S.taglioVoluto : S.taglio + (S.taglioVoluto - S.taglio) * k;
    taglio.constant = S.taglio;
    const fermo = Math.abs(S.taglio - S.taglioVoluto) < 0.05;
    S.giorno = verso(S.giorno, S.giornoVoluto, 0.5);
    const g = S.giorno, notte = 1 - g;
    const esterno = S.vista === "esterno";
    for (const p2 of PIANI_MIEI) {
      const attivo = S.vista === p2.k;
      p2.cime.visible = attivo && fermo;
      for (const Dv of p2.luci) {
        const l = Dv.luce;
        l.livello = verso(l.livello, l.voluto, 1.4);
        l.alone.material.opacity = attivo ? l.livello * 0.55 : 0;
        if (Dv.m.userData.lampada) Dv.m.userData.lampada.material.emissiveIntensity = l.livello * 3;
      }
      for (const F of p2.finestre) {
        const lv = livelloDellaStanza(p2, stanzaVicina(p2, F.a));
        const bril = esterno ? lv * notte : 0;
        F.vet.material.emissiveIntensity = bril * 1.6;
        F.vet.material.opacity = 0.5 + bril * 0.4;
        F.lume.material.opacity = bril * 0.92;
        F.lume.visible = bril > 0.01;
        F.aperta = verso(F.aperta, F.voluto, 0.9);
        F.anta.rotation.y = F.verso * -F.aperta * 1.2;
      }
      for (const T of p2.tapparelle) {
        T.chiusa = verso(T.chiusa, T.voluta, 0.45);
        const h = (2.2 - T.basso - 0.05) * Math.max(0.02, T.chiusa);
        T.tap.scale.y = h;
        T.tap.position.y = 2.18 - h / 2;
        T.tap.material.map.repeat.set(1, Math.max(0.05, T.chiusa * 3));
        if (T.ante.length) {
          T.tap.visible = false;
          for (const A of T.ante) A.cer.rotation.y = A.lato * A.est * (Math.PI - 0.12) * (1 - Math.min(1, T.chiusa * 1.15));
        }
      }
      for (const P of p2.porte) {
        P.aperta = verso(P.aperta, P.voluto, 1.2);
        P.anta.rotation.y = P.aperta * 1.25;
      }
      for (const Dv of p2.disp) {
        if (Dv.cono) Dv.cono.visible = attivo;
        if (!Dv.zona) continue;
        Dv.zona.visible = attivo;
        const vivo = Dv.stato?.attivo && Dv.k !== "acqua";
        if (vivo && attivo) muove = true;
        Dv.zona.material.opacity = vivo ? 0.1 + 0.14 * (0.5 + 0.5 * Math.sin(S.tempo * 5)) : 0.06;
        Dv.zona.material.color.set(vivo ? "#8b5cf6" : Dv.k === "acqua" ? "#38bdf8" : "#a78bfa");
        if (Dv.k === "acqua") Dv.zona.material.color.set(Dv.stato?.attivo ? "#ef4444" : "#38bdf8");
      }
    }
    for (const Dv of ESTERNE) if (Dv.cono) Dv.cono.visible = esterno && S.taglio > 40;
    for (const { l, Dv } of MUCCHIO) l.intensity = Dv && S.vista === Dv.p.k ? Dv.luce.livello * 5 : 0;
    for (const Lp of lampioni) {
      Lp.l.intensity = esterno ? notte * 6 : 0;
      if (Lp.b) Lp.b.material.emissiveIntensity = notte * 3;
    }
    if (acqua) acqua.material.emissiveIntensity = notte * 0.9;
    vetroAltrui.emissiveIntensity = esterno ? notte * 0.5 : 0;
    lumeAltrui.opacity = esterno ? notte * 0.55 : 0;
    cielo.intensity = 0.4 + g * 1.1;
    cielo.color.set(g > 0.5 ? "#dbe7ff" : "#9fb4ff");
    sole.intensity = 0.6 + g * 2.6;
    sole.color.lerpColors(new THREE.Color("#cdd8ff"), new THREE.Color("#fff1d6"), g);
    palco.style.background = `linear-gradient(180deg, ${mescola("#0b1530", "#7fb2ea", g)}, ${mescola("#1b2b4f", "#d7e8fb", g)} 70%)`;
    const km = 1 - Math.pow(5e-4, dt);
    const p = PIANI_MIEI.find((x) => x.k === S.vista);
    for (const A of p?.arredi || []) {
      const [tx, ty] = A.fantasma && !A.fantasmaOk ? A.fantasma : [A.dati.x, A.dati.y];
      const dx = X(tx) - A.m.position.x, dz = Z(ty) - A.m.position.z, dr = (A.dati.rot || 0) - A.m.rotation.y;
      if (Math.abs(dx) + Math.abs(dz) + Math.abs(dr) > 1e-3) muove = true;
      A.m.position.x += dx * km;
      A.m.position.z += dz * km;
      A.m.position.y = A.fantasma && !A.fantasmaOk ? 0.12 : A.sotto ? 3e-3 : 0;
      A.m.rotation.y += dr * km;
      if (A.ruotaKo > 0) {
        A.ruotaKo -= dt;
        muove = true;
        if (A.ruotaKo <= 0) {
          A.dati.rot = A.rotPrima;
          maniglie.classList.remove("c3-no");
        }
      }
    }
    for (const Dv of p?.disp || []) {
      const dx = X(Dv.dati.x) - Dv.m.position.x, dz = Z(Dv.dati.y) - Dv.m.position.z, dr = (Dv.dati.rot || 0) - Dv.m.rotation.y;
      if (Math.abs(dx) + Math.abs(dz) + Math.abs(dr) > 1e-3) muove = true;
      Dv.m.position.x += dx * km;
      Dv.m.position.z += dz * km;
      Dv.m.rotation.y += dr * km;
    }
    return muove;
  }
  const mescola = (a, b, k) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
  function livelloDellaStanza(p, id) {
    let lv = 0;
    for (const Dv of p.luci) if (Dv.dati.stanza === id) lv = Math.max(lv, Dv.luce.livello);
    return lv;
  }
  let largo = 0, alto = 0;
  function inquadra() {
    const w = palco.clientWidth || 1, h = palco.clientHeight || 1;
    if (w !== largo || h !== alto) {
      largo = w;
      alto = h;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
    const { az, al, ty, tx, tz } = S.cam;
    const d = S.cam.d * Math.pow(Math.max(1, 1.1 / cam.aspect), 0.75);
    cam.position.set(tx + Math.sin(az) * Math.cos(al) * d, ty + Math.sin(al) * d, tz + Math.cos(az) * Math.cos(al) * d);
    cam.lookAt(tx, ty, tz);
  }
  function disegna() {
    if (S.morto) return;
    inquadra();
    renderer.render(scena, cam);
    etichette();
  }
  const vettore = new THREE.Vector3();
  const proietta = (x, y, z) => {
    vettore.set(x, y, z).project(cam);
    return [(vettore.x + 1) / 2 * largo, (1 - vettore.y) / 2 * alto, vettore.z];
  };
  const fuoriDalPalco = (x, y, z) => z > 1 || x < -40 || y < -40 || x > largo + 40 || y > alto + 40;
  for (const p of PIANI_MIEI)
    for (const s of p.stanze) {
      const el = document.createElement("div");
      el.className = "c3-etichetta";
      strato.appendChild(el);
      s.el = el;
    }
  const cartellini = PIANI_MIEI.map((p) => {
    const el = document.createElement("div");
    el.className = "c3-cartellino";
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      apri(p.k);
    });
    stratoChip.appendChild(el);
    return { p, el };
  });
  function chipDi(Dv) {
    if (Dv.el) return Dv.el;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "c3-chip";
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      tocca(Dv);
    });
    stratoChip.appendChild(el);
    Dv.el = el;
    return el;
  }
  function etichette() {
    const fermo = Math.abs(S.taglio - S.taglioVoluto) < 0.3;
    for (const p of PIANI_MIEI) {
      const aperto = S.vista === p.k && fermo;
      for (const s of p.stanze) {
        if (!aperto) {
          s.el.style.display = "none";
          continue;
        }
        const [x, y, z] = proietta(X(s.sx), p.base + 1.9, Z(s.sy));
        if (fuoriDalPalco(x, y, z)) {
          s.el.style.display = "none";
          continue;
        }
        s.el.style.display = "";
        s.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
        s.el.classList.toggle("c3-si", S.sel?.s === s);
        const testo = testoDellaStanza(p, s);
        if (s.el.dataset.testo !== testo) {
          s.el.dataset.testo = testo;
          s.el.innerHTML = testo;
        }
      }
      for (const Dv of p.disp) {
        const el = chipDi(Dv);
        if (!aperto) {
          el.style.display = "none";
          continue;
        }
        const yChip = Dv.D.mont === "soffitto" ? 0.35 : Dv.m.position.y + 0.15;
        const [x, y, z] = proietta(Dv.m.position.x, p.base + yChip, Dv.m.position.z);
        if (fuoriDalPalco(x, y, z)) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "";
        el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
        vestiChip(Dv, el);
      }
    }
    const fuori = S.vista === "esterno" && S.taglio > 40;
    for (const Dv of ESTERNE) {
      const el = chipDi(Dv);
      if (!fuori) {
        el.style.display = "none";
        continue;
      }
      const [x, y, z] = proietta(Dv.m.position.x, Dv.m.position.y + 0.35, Dv.m.position.z);
      el.style.display = fuoriDalPalco(x, y, z) ? "none" : "";
      el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
      vestiChip(Dv, el, Dv.dati.nome || L("Telecamera", "Camera"));
    }
    for (const { p, el } of cartellini) {
      if (!fuori) {
        el.style.display = "none";
        continue;
      }
      const c = p.confini;
      const [x, y, z] = proietta(X(c.x1) + 1.2, p.base + 1.6, Z(c.y1) - 1);
      el.style.display = fuoriDalPalco(x, y, z) ? "none" : "";
      el.style.transform = `translate(${(x + 14).toFixed(1)}px,${y.toFixed(1)}px) translate(0,-50%)`;
      el.classList.toggle("c3-si", S.evid === p.k);
      const testo = TIPO === "palazzo" ? `<b>${esc(L("La tua casa", "Your home"))}</b>${esc(`${nomeOrdinale(p.numero)} ·${sottoDelPiano(p)}`)}` : `<b>${esc(p.nome)}</b>${esc(sottoDelPiano(p))}`;
      if (el.dataset.testo !== testo) {
        el.dataset.testo = testo;
        el.innerHTML = testo;
      }
    }
    if (S.pezzo && S.arreda) {
      const b = new THREE.Box3().setFromObject(S.pezzo.m);
      const [x, y] = proietta((b.min.x + b.max.x) / 2, Math.min(b.max.y, (S.pezzo.p.base || 0) + TAGLIO) + 0.15, (b.min.z + b.max.z) / 2);
      maniglie.style.display = "flex";
      maniglie.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-130%)`;
    } else maniglie.style.display = "none";
  }
  function vestiChip(Dv, el, nome = "") {
    const st = Dv.stato || { testo: Dv.D.icona, tono: "neutro" };
    const scollegato = !Dv.dati.entity;
    const testo = `${scollegato ? `${Dv.D.icona} ?` : st.testo}${nome ? ` · ${nome}` : ""}`;
    if (el.textContent !== testo) el.textContent = testo;
    const c = TONI[st.tono] || TONI.neutro;
    if (el.dataset.c !== c) {
      el.dataset.c = c;
      el.style.setProperty("--c", c);
    }
    el.classList.toggle("c3-vivo", Boolean(st.attivo) && ["movimento", "allarme"].includes(st.tono));
    el.classList.toggle("c3-scollegato", scollegato);
    el.classList.toggle("c3-scelto", S.pezzo === Dv);
  }
  function testoDellaStanza(p, s) {
    const luci = p.luci.filter((Dv) => Dv.dati.stanza === s.id);
    const accesa = luci.some((Dv) => Dv.luce.voluto > 0);
    const termo = p.disp.find((Dv) => Dv.dati.stanza === s.id && Dv.k === "termometro" && Dv.stato?.disponibile);
    const pezzi = [];
    if (luci.length) pezzi.push(`<span>💡 <b>${esc(accesa ? L("accesa", "on") : L("spenta", "off"))}</b></span>`);
    if (termo) pezzi.push(`<span><b>${esc(termo.stato.testo)}</b></span>`);
    pezzi.push(`<span>${esc(Math.round(s.area))} m²</span>`);
    return `<div class="c3-n">${esc(s.nome)}</div><div class="c3-v">${pezzi.join("")}</div>`;
  }
  const lociDi = (p) => p.stanze.filter((s) => !s.dati.fuori).length;
  const luciAccese = (p) => p.luci.filter((Dv) => Dv.luce.voluto > 0).length;
  function sottoDelPiano(p) {
    const n = luciAccese(p);
    return ` ${lociDi(p)} ${L("locali", "rooms")}${p.luci.length ? ` · 💡 ${n}` : ""}`;
  }
  function aggiornaStati(states) {
    S.stati = states || leggiStati();
    const delSole = S.stati["sun.sun"]?.state;
    if (delSole) S.giornoVoluto = delSole === "above_horizon" ? 1 : 0;
    else {
      const ora = (/* @__PURE__ */ new Date()).getHours();
      S.giornoVoluto = ora >= 7 && ora < 19 ? 1 : 0;
    }
    for (const p of PIANI_MIEI) {
      for (const T of p.tapparelle) T.voluta = 0;
      for (const F of p.finestre) F.voluto = 0;
      for (const P of p.porte) P.sensore = false;
      for (const Dv of p.disp) {
        const st = Dv.dati.entity ? S.stati[Dv.dati.entity] : null;
        Dv.stato = st ? statoDelDispositivo(Dv.k, st, italiano) : null;
        if (Dv.luce) Dv.luce.voluto = Dv.stato?.attivo ? Math.max(0.25, Dv.stato.luminosita ?? 1) : 0;
        if (Dv.k === "tapparella" && Dv.stato) {
          const T = aperturaDi(Dv, p.tapparelle);
          if (T) T.voluta = 1 - (Dv.stato.apertura ?? 1);
        }
        if (Dv.k === "finestra" && Dv.stato?.attivo) {
          const F = aperturaDi(Dv, p.finestre);
          if (F) F.voluto = 1;
        }
        if (Dv.k === "porta" && Dv.stato) {
          const P = aperturaDi(Dv, p.porte);
          if (P) {
            P.sensore = true;
            P.voluto = Dv.stato.attivo ? 1 : 0;
          }
        }
      }
      for (const P of p.porte) if (!P.sensore) P.voluto = P.a.verso ? 0 : 1;
    }
    for (const Dv of ESTERNE) Dv.stato = Dv.dati.entity && S.stati[Dv.dati.entity] ? statoDelDispositivo("telecamera", S.stati[Dv.dati.entity], italiano) : null;
    assegnaLuci();
    if (S.arreda && !pannello?.contains(document.activeElement)) disegnaPannello();
    richiedi();
  }
  function assegnaLuci() {
    const p = PIANI_MIEI.find((x) => x.k === S.vista);
    const accese = (p?.luci || []).filter((Dv) => Dv.luce.voluto > 0 || Dv.luce.livello > 0.01).sort((a, b) => b.luce.voluto - a.luce.voluto);
    MUCCHIO.forEach((M, i) => {
      const Dv = accese[i] || null;
      M.Dv = Dv;
      if (Dv) {
        Dv.m.updateMatrixWorld(true);
        Dv.m.getWorldPosition(M.l.position);
        M.l.position.y -= 0.2;
      }
    });
  }
  function tocca(Dv) {
    if (S.arreda && !Dv.esterna) {
      const s = Dv.p.stanze.find((x) => x.id === Dv.dati.stanza);
      if (s && S.sel?.s !== s) scegliStanza(Dv.p, s);
      S.scheda = "dispositivi";
      scegliPezzo(Dv);
      return;
    }
    const entity = Dv.dati.entity;
    if (!entity) {
      quandoTocchi({ pagina: "scollegato", k: Dv.k });
      return;
    }
    if (Dv.k === "telecamera") {
      quandoTocchi({ pagina: "telecamera", entity });
      return;
    }
    const azione = azioneDelTocco(Dv.k, entity, S.stati[entity]);
    quandoTocchi(azione || { pagina: "entita", entity });
  }
  function apri(k) {
    const p = k === "esterno" ? null : PIANI_MIEI.find((x) => x.k === k);
    if (k !== "esterno" && !p) return false;
    S.vista = p ? p.k : "esterno";
    S.taglioVoluto = p ? p.base + TAGLIO : 200;
    S.camVoluta = p ? vistaPiano(p) : { ...VISTA_ESTERNA };
    S.sel = null;
    S.pezzo = null;
    S.evid = null;
    for (const x of PIANI_MIEI) {
      x.velo.visible = false;
      x.evid.visible = false;
    }
    if (!p && TIPO === "palazzo" && PIANI_MIEI[0]) {
      S.evid = PIANI_MIEI[0].k;
      PIANI_MIEI[0].evid.visible = true;
    }
    assegnaLuci();
    sugg.textContent = p ? "" : L("Tocca un piano per entrarci", "Tap a floor to step inside");
    sugg.style.display = p ? "none" : "";
    disegnaPannello();
    try {
      quandoCambiVista(S.vista);
    } catch (_errore) {
    }
    richiedi();
    return true;
  }
  function evidenzia(k) {
    if (!k && TIPO === "palazzo") k = PIANI_MIEI[0]?.k || null;
    if (k === S.evid) return;
    S.evid = k;
    for (const x of PIANI_MIEI) x.evid.visible = x.k === k;
    richiedi();
  }
  const raggio = new THREE.Raycaster(), pt = new THREE.Vector2();
  const punta = (ev) => {
    const b = renderer.domElement.getBoundingClientRect();
    pt.set((ev.clientX - b.left) / b.width * 2 - 1, -((ev.clientY - b.top) / b.height) * 2 + 1);
    raggio.setFromCamera(pt, cam);
  };
  function pianoSotto(ev) {
    if (S.vista !== "esterno") return null;
    punta(ev);
    const colpo = raggio.intersectObjects(PIANI.map((p2) => p2.gr), true)[0];
    if (!colpo) return null;
    const y = colpo.point.y;
    const p = PIANI.slice().reverse().find((x) => y >= x.base - 0.3) || null;
    return p && !p.altrui ? p : null;
  }
  const pianoTocco = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), puntoTocco = new THREE.Vector3();
  function versoPavimento(ev, p) {
    punta(ev);
    pianoTocco.constant = -p.base;
    return raggio.ray.intersectPlane(pianoTocco, puntoTocco) ? [puntoTocco.x - OX, puntoTocco.z - OZ] : null;
  }
  function pezzoSotto(ev, p) {
    punta(ev);
    const tutti = [...p.arredi, ...p.disp];
    const colpi = raggio.intersectObjects(tutti.map((A) => A.m), true);
    const diChi = (o) => {
      while (o && !tutti.some((A) => A.m === o)) o = o.parent;
      return tutti.find((A) => A.m === o) || null;
    };
    const trovati = colpi.map((c) => diChi(c.object)).filter(Boolean);
    return trovati.find((A) => !A.sotto) || trovati[0] || null;
  }
  const tela3d = renderer.domElement;
  const dita = /* @__PURE__ */ new Map();
  let gesto = null;
  tela3d.addEventListener("pointerdown", (ev) => {
    dita.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    tela3d.setPointerCapture?.(ev.pointerId);
    const p = PIANI_MIEI.find((x) => x.k === S.vista);
    if (dita.size === 1 && S.arreda && p) {
      const A = pezzoSotto(ev, p);
      if (A) {
        if (S.sel?.s !== A.s && A.s) scegliStanza(p, A.s);
        else if (!A.s) {
          const s = p.stanze.find((x) => x.id === A.dati.stanza);
          if (s && S.sel?.s !== s) scegliStanza(p, s);
        }
        if (A.D) S.scheda = "dispositivi";
        else if (S.scheda === "dispositivi") S.scheda = "arredi";
        scegliPezzo(A);
        const q = versoPavimento(ev, p);
        if (q) S.presa = { A, dx: A.dati.x - q[0], dy: A.dati.y - q[1], mosso: false };
        tela3d.style.cursor = "grabbing";
        gesto = { tipo: "pezzo", x: ev.clientX, y: ev.clientY };
        return;
      }
    }
    gesto = { tipo: dita.size > 1 ? "pizzico" : "gira", x: ev.clientX, y: ev.clientY, mosso: false, distanza: distanzaDita() };
  });
  const distanzaDita = () => {
    const d = [...dita.values()];
    return d.length > 1 ? Math.hypot(d[0].x - d[1].x, d[0].y - d[1].y) : 0;
  };
  tela3d.addEventListener("pointermove", (ev) => {
    const prima = dita.get(ev.pointerId);
    if (!prima) {
      if (S.vista === "esterno" && ev.pointerType === "mouse") {
        const p = pianoSotto(ev);
        evidenzia(p?.k || null);
        tela3d.style.cursor = p ? "pointer" : "";
      }
      return;
    }
    dita.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (!gesto) return;
    if (S.presa) {
      const A = S.presa.A;
      const q = versoPavimento(ev, A.p);
      if (!q) return;
      S.presa.mosso = true;
      trascina(A, q[0] + S.presa.dx, q[1] + S.presa.dy);
      richiedi();
      return;
    }
    if (dita.size > 1) {
      const d = distanzaDita();
      if (gesto.distanza && d) {
        S.camVoluta.d = Math.max(MISURA * 0.5, Math.min(MISURA * 6 + 80, S.camVoluta.d * (gesto.distanza / d)));
        S.cam.d = S.camVoluta.d;
      }
      gesto = { tipo: "pizzico", distanza: d, mosso: true };
      richiedi();
      return;
    }
    const dx = ev.clientX - prima.x, dy = ev.clientY - prima.y;
    if (!gesto.mosso && Math.hypot(ev.clientX - gesto.x, ev.clientY - gesto.y) < 5) return;
    gesto.mosso = true;
    S.camVoluta.az -= dx * 8e-3;
    S.camVoluta.al = Math.max(0.12, Math.min(1.45, S.camVoluta.al + dy * 6e-3));
    S.cam.az = S.camVoluta.az;
    S.cam.al = S.camVoluta.al;
    richiedi();
  });
  const lascia = (ev) => {
    dita.delete(ev.pointerId);
    const g = gesto;
    if (dita.size === 0) gesto = null;
    if (S.presa) {
      const { A, mosso } = S.presa;
      S.presa = null;
      tela3d.style.cursor = "";
      delete A.fantasma;
      delete A.fantasmaOk;
      maniglie.classList.remove("c3-no");
      if (mosso) {
        if (A.D) {
          A.dati.stanza = stanzaIn(A.p, A.dati.x, A.dati.y)?.id || A.dati.stanza;
          assegnaLuci();
        }
        salva();
      }
      disegnaPannello();
      richiedi();
      return;
    }
    if (ev.type !== "pointerup" || !g || g.mosso || g.tipo !== "gira") return;
    if (S.vista === "esterno") {
      const p2 = pianoSotto(ev);
      if (p2) apri(p2.k);
      return;
    }
    const p = PIANI_MIEI.find((x) => x.k === S.vista);
    if (!p) return;
    if (S.arreda) {
      punta(ev);
      const c = raggio.intersectObject(p.pavMesh)[0];
      if (!c) return;
      const s = stanzaIn(p, c.point.x - OX, c.point.z - OZ);
      if (s) scegliStanza(p, s);
      return;
    }
    const Dv = pezzoSotto(ev, p);
    if (Dv?.D) tocca(Dv);
  };
  tela3d.addEventListener("pointerup", lascia);
  tela3d.addEventListener("pointercancel", lascia);
  tela3d.addEventListener("pointerleave", () => {
    if (!dita.size && S.vista === "esterno") evidenzia(null);
  });
  tela3d.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      S.camVoluta.d = Math.max(MISURA * 0.5, Math.min(MISURA * 6 + 80, S.camVoluta.d * (ev.deltaY > 0 ? 1.1 : 0.9)));
      richiedi();
    },
    { passive: false }
  );
  palco.querySelector(".c3-zoom").addEventListener("click", (ev) => {
    const z = ev.target.closest("[data-c3-zoom]");
    if (!z) return;
    const f = Number(z.dataset.c3Zoom);
    if (f) S.camVoluta.d = Math.max(MISURA * 0.5, Math.min(MISURA * 6 + 80, S.camVoluta.d * f));
    else {
      const p = PIANI_MIEI.find((x) => x.k === S.vista);
      S.camVoluta = p ? vistaPiano(p) : { ...VISTA_ESTERNA };
    }
    richiedi();
  });
  function trascina(A, x, y) {
    if (A.D) {
      const mont = A.D.mont;
      if (mont !== "soffitto" && mont !== "pavimento") {
        let migliore = null;
        for (const q of A.p.bordi) {
          const d = Math.hypot(q.x - x, q.y - y);
          if (!migliore || d < migliore.d) migliore = { q, d };
        }
        if (migliore && migliore.d < 1.2) {
          const q = migliore.q, s2 = A.p.stanze.find((u) => u.id === q.id);
          const rot = mont === "angolo" && q.angolo && s2 ? Math.atan2(s2.sx - q.x, s2.sy - q.y) : Math.atan2(q.nx, q.ny);
          Object.assign(A.dati, { x: +q.x.toFixed(3), y: +q.y.toFixed(3), rot: +rot.toFixed(4), stanza: q.id });
          return;
        }
      }
      x = Math.round(x / AGGANCIO) * AGGANCIO;
      y = Math.round(y / AGGANCIO) * AGGANCIO;
      const s = stanzaIn(A.p, x, y);
      if (s) Object.assign(A.dati, { x: +x.toFixed(3), y: +y.toFixed(3), stanza: s.id });
      return;
    }
    x = Math.round(x / AGGANCIO) * AGGANCIO;
    y = Math.round(y / AGGANCIO) * AGGANCIO;
    A.fantasma = [x, y];
    A.fantasmaOk = posa(A, x, y);
    maniglie.classList.toggle("c3-no", !A.fantasmaOk);
  }
  function ruota(A, passi) {
    const prima = A.dati.rot || 0, nuovo = prima + passi * (Math.PI / 12);
    if (A.D) {
      A.dati.rot = +nuovo.toFixed(4);
      salva();
      richiedi();
      return true;
    }
    if (posa(A, A.dati.x, A.dati.y, nuovo)) {
      maniglie.classList.remove("c3-no");
      salva();
      disegnaPannello();
      richiedi();
      return true;
    }
    A.rotPrima = prima;
    A.dati.rot = nuovo;
    A.ruotaKo = 0.7;
    maniglie.classList.add("c3-no");
    richiedi();
    return false;
  }
  function togli(A) {
    if (A.D) togliDispositivo(A);
    else {
      A.m.parent?.remove(A.m);
      liberaOggetto(A.m);
      A.p.arredi = A.p.arredi.filter((x) => x !== A);
      A.p.dati.arredi = A.p.dati.arredi.filter((x) => x !== A.dati);
    }
    if (S.pezzo === A) S.pezzo = null;
    assegnaLuci();
    salva();
    disegnaPannello();
    richiedi();
  }
  maniglie.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  maniglie.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const A = S.pezzo;
    const t = ev.target.closest("span");
    if (!A || !t) return;
    if (t.dataset.c3Ruota) ruota(A, Number(t.dataset.c3Ruota));
    if (t.dataset.c3Gira !== void 0) ruota(A, 6);
    if (t.dataset.c3Via !== void 0) togli(A);
  });
  const tasti = (ev) => {
    if (!S.arreda || !S.pezzo || /input|select|textarea/i.test(ev.target?.tagName || "")) return;
    if (ev.key === "r" || ev.key === "R") ruota(S.pezzo, ev.shiftKey ? -6 : 6);
    else if (ev.key === "Delete" || ev.key === "Backspace") togli(S.pezzo);
    else if (ev.key === "Escape") scegliPezzo(null);
  };
  window.addEventListener("keydown", tasti);
  let timerSalva = 0;
  function salva() {
    clearTimeout(timerSalva);
    timerSalva = setTimeout(() => {
      try {
        quandoSalvi(copia(C));
        S.salvato = true;
      } catch (_errore) {
        S.salvato = false;
      }
      const el = pannello?.querySelector("[data-c3-salvato]");
      if (el) el.textContent = S.salvato ? L("✓ Salvato", "✓ Saved") : L("Non salvato", "Not saved");
    }, 300);
  }
  function scegliStanza(p, s) {
    S.sel = s ? { p, s } : null;
    S.pezzo = null;
    for (const x of PIANI_MIEI) x.velo.visible = false;
    if (s) {
      const g = p.veloCanvas.getContext("2d"), im = g.createImageData(p.W, p.H);
      for (let i2 = 0; i2 < p.W * p.H; i2++)
        if (p.tipo[i2] === s.id) {
          im.data[i2 * 4] = 56;
          im.data[i2 * 4 + 1] = 189;
          im.data[i2 * 4 + 2] = 248;
          im.data[i2 * 4 + 3] = 70;
        }
      g.putImageData(im, 0, 0);
      p.veloTex.needsUpdate = true;
      p.velo.visible = true;
      const gruppo = { camera: /camera|letto|bed/i, bagno: /bagno|wc|bath/i, cucina: /cucina|pranzo|kitchen|dining/i, studio: /studio|ufficio|office/i };
      const i = CATALOGO_ARREDI.findIndex((c) => gruppo[c.k]?.test(s.nome));
      S.cat = i >= 0 ? i : 0;
      S.camVoluta = { az: S.camVoluta.az, al: 1, d: 13 + Math.sqrt(s.area) * 1.6, ty: p.base + 0.2, tx: X(s.sx), tz: Z(s.sy) };
    } else if (p) S.camVoluta = vistaPiano(p);
    disegnaPannello();
    richiedi();
  }
  function scegliPezzo(A) {
    S.pezzo = A || null;
    disegnaPannello();
    richiedi();
  }
  function ridipingi(p) {
    p.pavCanvas = pavimentoDellaPianta(p.dati, p.tipo, riquadro);
    p.pavTex.image = p.pavCanvas;
    p.pavTex.needsUpdate = true;
  }
  function pittura(p, s, colore) {
    s.dati.pareti = colore;
    pareteDi(p, s.id).color.set(colore || PARETE_DI_PARTENZA);
  }
  function aggiungiArredo(p, s, k) {
    const posto = cercaPosto(p, s, k);
    if (!posto) {
      S.avviso = L("Non c'è posto nella stanza", "No room left in here");
      return null;
    }
    const dati = { k, stanza: s.id, x: posto.x, y: posto.y, rot: posto.rot, tinta: "", sotto: ARREDI_SOTTO.includes(k) };
    p.dati.arredi.push(dati);
    const A = mettiArredo(p, dati);
    return A;
  }
  function aggiungiDispositivo(p, s, k) {
    const posto = postoDispositivo(p, s, k);
    const dati = dispositivoPulito({ k, stanza: s.id, x: +posto.x.toFixed(3), y: +posto.y.toFixed(3), rot: +posto.rot.toFixed(4), da: "mano" });
    p.dati.dispositivi.push(dati);
    const Dv = mettiDispositivo(p, dati);
    Dv.stato = null;
    return Dv;
  }
  function cambiaTessuto(A, tinta) {
    A.dati.tinta = tinta;
    const nuovo = arredo3D(THREE, A.k, tinta);
    nuovo.position.copy(A.m.position);
    nuovo.rotation.copy(A.m.rotation);
    A.p.arrediGr.add(nuovo);
    A.m.parent?.remove(A.m);
    liberaOggetto(A.m);
    A.m = nuovo;
  }
  function candidati(Dv, s) {
    const states = S.stati && Object.keys(S.stati).length ? S.stati : leggiStati();
    const usate = [];
    for (const p of PIANI_MIEI) for (const x of p.disp) if (x !== Dv && x.dati.entity) usate.push(x.dati.entity);
    let area = "";
    try {
      area = s?.dati.area && nomeArea(s.dati.area) || s?.dati.area || "";
    } catch (_errore) {
    }
    return entitaCandidate(Dv.k, { stanza: s?.nome || "", area, states, aree: opzioni.aree || {}, usate });
  }
  function disegnaPannello() {
    if (!pannello) return;
    if (!S.arreda) {
      pannello.innerHTML = "";
      pannello.hidden = true;
      return;
    }
    pannello.hidden = false;
    const p = PIANI_MIEI.find((x) => x.k === S.vista);
    if (!p) {
      pannello.innerHTML = `<div class="c3-ar"><div class="c3-ar-testa">🎨 <b>${esc(L("Arreda e rifinisci", "Furnish and finish"))}</b></div><p class="c3-piccolo">${esc(L("Apri un piano per arredarlo.", "Open a floor to furnish it."))}</p></div>`;
      return;
    }
    const sel = S.sel;
    if (!sel) {
      pannello.innerHTML = `<div class="c3-ar"><div class="c3-ar-testa">🎨 <b>${esc(L("Arreda e rifinisci", "Furnish and finish"))}</b></div><p class="c3-piccolo">${esc(
        L(
          "Tocca una stanza della pianta per arredarla, scegliere il pavimento, il colore delle pareti e mettere i dispositivi.",
          "Tap a room on the plan to furnish it, pick the floor, the wall colour and place the devices."
        )
      )}</p></div>`;
      return;
    }
    const s = sel.s;
    const f = finituraDellaStanza(s.dati);
    const tipoP = PAVIMENTO_PER_CHIAVE[f.tipo] || PAVIMENTI[0];
    const nomeV = (v) => italiano ? v.nome[0] : v.nome[1];
    const P = S.pezzo && (S.pezzo.s === s || S.pezzo.dati.stanza === s.id) ? S.pezzo : null;
    let corpo = "";
    if (S.scheda === "arredi") {
      const dentro = p.arredi.filter((A) => A.dati.stanza === s.id);
      const testa = P && !P.D ? `<div class="c3-pezzo"><b>${voceDi(P.k).icona}</b><div><div class="c3-pn">${esc(nomeV(voceDi(P.k)))}</div><div class="c3-pc">${esc(
        `${P.w.toFixed(2)} × ${P.d.toFixed(2)} m · ${L("ruotato di", "rotated")} ${(Math.round((P.dati.rot || 0) * 180 / Math.PI) % 360 + 360) % 360}°`
      )}</div></div></div>${CON_TESSUTO.test(P.k) ? `<div class="c3-cat">${esc(L("Tessuto", "Fabric"))}</div><div class="c3-tinte">${TESSUTI.map((c) => `<span class="c3-tinta${P.dati.tinta === c ? " c3-si" : ""}" data-c3-tessuto="${c}" style="background:${c}"></span>`).join("")}</div>` : ""}` : "";
      corpo = `${testa}<div class="c3-chips">${CATALOGO_ARREDI.map((c, i) => `<span class="c3-ch${S.cat === i ? " c3-si" : ""}" data-c3-cat="${i}">${esc(italiano ? c.nome[0] : c.nome[1])}</span>`).join("")}</div>
        <div class="c3-griglia">${(CATALOGO_ARREDI[S.cat] || CATALOGO_ARREDI[0]).voci.map(([k, ic, it, en, w, d]) => `<button type="button" class="c3-voce" data-c3-metti="${k}"><b>${ic}</b>${esc(italiano ? it : en)}<i>${w.toFixed(1)}×${d.toFixed(1)} m</i></button>`).join("")}</div>
        ${S.avviso ? `<p class="c3-avviso">${esc(S.avviso)}</p>` : ""}
        <div class="c3-cat">${esc(L("Nella stanza", "In this room"))} · ${dentro.length}</div>
        <div class="c3-dentro">${dentro.map((A) => `<span data-c3-scegli="a${p.arredi.indexOf(A)}" class="${S.pezzo === A ? "c3-si" : ""}">${voceDi(A.k).icona} ${esc(nomeV(voceDi(A.k)))}<em data-c3-togli="a${p.arredi.indexOf(A)}">✕</em></span>`).join("") || `<span>${esc(L("vuota", "empty"))}</span>`}</div>
        <p class="c3-piccolo">${esc(L("Trascina un mobile per spostarlo (si aggancia ogni 5 cm), ↺ ↻ per girarlo, R lo gira di 90°.", "Drag a piece to move it (5 cm snap), ↺ ↻ to rotate, R turns it 90°."))}</p>`;
    } else if (S.scheda === "dispositivi") {
      const qui = p.disp.filter((Dv2) => Dv2.dati.stanza === s.id);
      const Dv = P?.D ? P : null;
      let scheda = "";
      if (Dv) {
        const cand = candidati(Dv, s).slice(0, 80);
        const ora = Dv.dati.entity;
        if (ora && !cand.some((c) => c.entity === ora)) cand.unshift({ entity: ora, nome: ora });
        const mont = { soffitto: L("a soffitto", "on the ceiling"), pavimento: L("a terra", "on the floor"), angolo: L("nell'angolo", "in the corner") }[Dv.D.mont] || L("a muro", "on the wall");
        scheda = `<div class="c3-pezzo"><b>${Dv.D.icona}</b><div><div class="c3-pn">${esc(Dv.dati.nome || L(Dv.D.nome[0], Dv.D.nome[1]))}</div><div class="c3-pc">${esc(`${Dv.stato?.testo || (ora ? "" : L("da collegare", "not linked"))} · ${L("montato", "mounted")} ${mont}`)}</div></div></div>
          <div class="c3-cat">${esc(L("Collega a Home Assistant", "Link to Home Assistant"))}</div>
          <select class="c3-campo" data-c3-entita><option value="">${esc(L("— nessuna —", "— none —"))}</option>${cand.map((c) => `<option value="${esc(c.entity)}"${c.entity === ora ? " selected" : ""}>${esc(c.nome === c.entity ? c.entity : `${c.nome} · ${c.entity}`)}</option>`).join("")}</select>
          <div class="c3-riga"><input class="c3-campo" data-c3-amano placeholder="${esc(L("entità a mano, es. light.salotto", "entity by hand, e.g. light.lounge"))}" value="${esc(ora)}"><button type="button" class="c3-ch" data-c3-amano-ok>✓</button></div>
          <div class="c3-riga"><input class="c3-campo" data-c3-nome placeholder="${esc(L("nome (facoltativo)", "name (optional)"))}" value="${esc(Dv.dati.nome)}"></div>
          ${Dv.k === "telecamera" ? `<div class="c3-cat">${esc(L("Angolo di visione", "Field of view"))}</div><div class="c3-chips">${[70, 90, 100, 110, 130].map((v) => `<span class="c3-ch${Dv.dati.fov === v ? " c3-si" : ""}" data-c3-fov="${v}">${v}°</span>`).join("")}${ora ? `<span class="c3-ch" data-c3-guarda>▶ ${esc(L("Guarda dal vivo", "Watch live"))}</span>` : ""}</div>` : ""}
          <div class="c3-cat">${esc(L("Altri nella stanza", "Others in this room"))}</div>`;
      }
      corpo = `${scheda}<div class="c3-dentro">${qui.map((x) => `<span data-c3-scegli="d${p.disp.indexOf(x)}" class="${S.pezzo === x ? "c3-si" : ""}">${x.D.icona} ${esc(x.dati.nome || L(x.D.nome[0], x.D.nome[1]))}${x.dati.entity ? "" : " ?"}<em data-c3-togli="d${p.disp.indexOf(x)}">✕</em></span>`).join("") || `<span>${esc(L("nessuno", "none"))}</span>`}</div>
        <div class="c3-cat">${esc(L("Aggiungi", "Add"))}</div>
        <div class="c3-griglia">${Object.entries(DISPOSITIVI_3D).map(([k, D]) => `<button type="button" class="c3-voce" data-c3-disp="${k}"><b>${D.icona}</b>${esc(L(D.nome[0], D.nome[1]))}</button>`).join("")}</div>
        <p class="c3-piccolo">${esc(L("I dispositivi si appendono da soli: le telecamere e i sensori nell'angolo che vede la stanza, i contatti sulla finestra, i rilevatori a soffitto. Trascinandoli si agganciano al muro più vicino.", "Devices hang themselves: cameras and sensors in the corner that sees the room, contacts on the window, detectors on the ceiling. Dragged, they snap to the nearest wall."))}</p>`;
    } else if (S.scheda === "pavimento") {
      corpo = `<div class="c3-griglia">${PAVIMENTI.map((t) => `<button type="button" class="c3-voce c3-pav${t.k === tipoP.k ? " c3-si" : ""}" data-c3-pav="${t.k}"><img alt="" src="${anteprima(t.k, t.k === tipoP.k ? f.colore : t.colori[0], t.k === tipoP.k ? f.colore2 : "")}">${esc(italiano ? t.nome[0] : t.nome[1])}</button>`).join("")}</div>
        <div class="c3-cat">${esc(L("Colore", "Colour"))} · ${esc(italiano ? tipoP.nome[0] : tipoP.nome[1])}</div><div class="c3-tinte">${tipoP.colori.map((c) => `<span class="c3-tinta${c === f.colore ? " c3-si" : ""}" data-c3-col="${c}" style="background:${c}"></span>`).join("")}</div>
        <div class="c3-cat">${esc(L("Posa", "Laying"))}</div><div class="c3-chips"><span class="c3-ch${!f.diagonale ? " c3-si" : ""}" data-c3-diag="0">${esc(L("Dritta", "Straight"))}</span><span class="c3-ch${f.diagonale ? " c3-si" : ""}" data-c3-diag="1">${esc(L("Diagonale 45°", "Diagonal 45°"))}</span><span class="c3-ch" data-c3-tutto="pav">${esc(L("Uguale in tutto il piano", "Same on the whole floor"))}</span></div>`;
    } else {
      const ora = s.dati.pareti || PARETE_DI_PARTENZA;
      corpo = `<div class="c3-muri">${PARETI.map(([it, en, c]) => `<button type="button" class="c3-muro${c === ora ? " c3-si" : ""}" data-c3-muro="${c}"><span style="background:${c}"></span>${esc(italiano ? it : en)}</button>`).join("")}</div>
        <div class="c3-chips"><span class="c3-ch" data-c3-tutto="muri">${esc(L("Stesso colore in tutto il piano", "Same colour on the whole floor"))}</span></div>`;
    }
    const linguetta = (k, testo) => `<span data-c3-scheda="${k}" class="${S.scheda === k ? "c3-si" : ""}">${esc(testo)}</span>`;
    pannello.innerHTML = `<div class="c3-ar">
      <div class="c3-ar-testa">🎨 <b>${esc(s.nome)}</b><span class="c3-piccolo">${esc(`${Math.round(s.area)} m² · ${p.nome}`)}</span></div>
      <div class="c3-salvato" data-c3-salvato>${esc(S.salvato ? L("✓ Salvato", "✓ Saved") : L("Le modifiche si salvano da sole", "Changes save themselves"))}</div>
      <div class="c3-linguette">${linguetta("arredi", L("🛋️ Arredi", "🛋️ Furniture"))}${linguetta("pavimento", L("▦ Pavimento", "▦ Floor"))}${linguetta("pareti", L("🖌️ Pareti", "🖌️ Walls"))}${linguetta("dispositivi", L("📷 Dispositivi", "📷 Devices"))}</div>
      ${corpo}</div>`;
    S.avviso = "";
  }
  const anteprime = /* @__PURE__ */ new Map();
  function anteprima(k, c, c2) {
    const chiave = `${k}${c}${c2}`;
    if (!anteprime.has(chiave)) anteprime.set(chiave, riquadro(k, c, c2).toDataURL());
    return anteprime.get(chiave);
  }
  function pezzoDa(p, segno) {
    const i = Number(String(segno).slice(1));
    return segno?.[0] === "d" ? p.disp[i] : p.arredi[i];
  }
  function alClicDelPannello(ev) {
    if (!S.arreda || !S.sel) return;
    const t = ev.target.closest(
      "[data-c3-scheda],[data-c3-cat],[data-c3-metti],[data-c3-togli],[data-c3-scegli],[data-c3-tessuto],[data-c3-pav],[data-c3-col],[data-c3-diag],[data-c3-muro],[data-c3-tutto],[data-c3-disp],[data-c3-fov],[data-c3-guarda],[data-c3-amano-ok]"
    );
    if (!t) return;
    const { p, s } = S.sel;
    const d = t.dataset;
    const finitura = () => s.dati.pavimento = { ...finituraDellaStanza(s.dati) };
    let cambia = true;
    if (d.c3Scheda) {
      S.scheda = d.c3Scheda;
      cambia = false;
    } else if (d.c3Cat) {
      S.cat = Number(d.c3Cat);
      cambia = false;
    } else if (d.c3Togli) {
      const A = pezzoDa(p, d.c3Togli);
      if (A) togli(A);
      return;
    } else if (d.c3Scegli) {
      scegliPezzo(pezzoDa(p, d.c3Scegli));
      return;
    } else if (d.c3Metti) {
      const A = aggiungiArredo(p, s, d.c3Metti);
      if (A) S.pezzo = A;
      else cambia = false;
    } else if (d.c3Disp) {
      S.pezzo = aggiungiDispositivo(p, s, d.c3Disp);
      assegnaLuci();
    } else if (d.c3Tessuto && S.pezzo && !S.pezzo.D) cambiaTessuto(S.pezzo, d.c3Tessuto);
    else if (d.c3Pav) {
      const f = finitura();
      f.tipo = d.c3Pav;
      f.colore = PAVIMENTO_PER_CHIAVE[f.tipo].colori[0];
      f.colore2 = "";
      ridipingi(p);
    } else if (d.c3Col) {
      finitura().colore = d.c3Col;
      ridipingi(p);
    } else if (d.c3Diag) {
      finitura().diagonale = d.c3Diag === "1";
      ridipingi(p);
    } else if (d.c3Muro) pittura(p, s, d.c3Muro);
    else if (d.c3Tutto === "pav") {
      const f = finitura();
      for (const x of p.stanze) if (!/bagno|wc|box|garage|tecnic|bath/i.test(x.nome) && !x.dati.fuori) x.dati.pavimento = { ...f };
      ridipingi(p);
    } else if (d.c3Tutto === "muri") {
      for (const x of p.stanze) pittura(p, x, s.dati.pareti || PARETE_DI_PARTENZA);
    } else if (d.c3Fov && S.pezzo?.D) {
      S.pezzo.dati.fov = Number(d.c3Fov);
      vesti(S.pezzo);
    } else if (d.c3Guarda !== void 0 && S.pezzo?.dati.entity) {
      quandoTocchi({ pagina: "telecamera", entity: S.pezzo.dati.entity });
      return;
    } else if (d.c3AmanoOk !== void 0) {
      collegaAMano();
      return;
    }
    if (cambia) salva();
    disegnaPannello();
    richiedi();
  }
  function collega(Dv, id) {
    Dv.dati.entity = id;
    Dv.stato = id && S.stati[id] ? statoDelDispositivo(Dv.k, S.stati[id], italiano) : null;
    aggiornaStati(S.stati);
    salva();
  }
  function collegaAMano() {
    const campo = pannello.querySelector("[data-c3-amano]");
    const Dv = S.pezzo;
    if (!campo || !Dv?.D) return;
    const id = entita(campo.value);
    if (campo.value.trim() && !id) {
      campo.classList.add("c3-sbagliato");
      return;
    }
    collega(Dv, id);
    disegnaPannello();
  }
  function alCambioDelPannello(ev) {
    const Dv = S.pezzo;
    if (!Dv?.D) return;
    if (ev.target.matches("[data-c3-entita]")) {
      collega(Dv, entita(ev.target.value));
      disegnaPannello();
    } else if (ev.target.matches("[data-c3-nome]")) {
      Dv.dati.nome = ev.target.value.trim().slice(0, 40);
      salva();
    }
  }
  function alTastoDelPannello(ev) {
    if (ev.key !== "Enter") return;
    if (ev.target.matches("[data-c3-amano]")) collegaAMano();
    if (ev.target.matches("[data-c3-nome]")) ev.target.blur();
  }
  if (pannello) {
    pannello.addEventListener("click", alClicDelPannello);
    pannello.addEventListener("change", alCambioDelPannello);
    pannello.addEventListener("keydown", alTastoDelPannello);
    pannello.addEventListener("input", (ev) => ev.target.classList?.remove("c3-sbagliato"));
  }
  function arreda(acceso) {
    if (!admin) return false;
    S.arreda = Boolean(acceso);
    palco.classList.toggle("c3-arreda", S.arreda);
    if (!S.arreda) {
      S.sel = null;
      S.pezzo = null;
      for (const x of PIANI_MIEI) x.velo.visible = false;
      const p = PIANI_MIEI.find((x) => x.k === S.vista);
      if (p) S.camVoluta = vistaPiano(p);
    }
    disegnaPannello();
    richiedi();
    return S.arreda;
  }
  function liberaOggetto(o) {
    o.traverse((x) => {
      x.geometry?.dispose?.();
    });
  }
  function distruggi() {
    if (S.morto) return;
    S.morto = true;
    if (S.raf) cancelAnimationFrame(S.raf);
    clearTimeout(timerSalva);
    osservatore?.disconnect();
    window.removeEventListener("keydown", tasti);
    if (pannello) {
      pannello.removeEventListener("click", alClicDelPannello);
      pannello.removeEventListener("change", alCambioDelPannello);
      pannello.removeEventListener("keydown", alTastoDelPannello);
      if (pannello !== opzioni.pannello) pannello.remove();
      else pannello.innerHTML = "";
    }
    const materiali = /* @__PURE__ */ new Set(), trame = /* @__PURE__ */ new Set();
    scena.traverse((o) => {
      o.geometry?.dispose?.();
      for (const m of [].concat(o.material || [])) materiali.add(m);
    });
    for (const m of materiali) {
      for (const v of Object.values(m)) if (v?.isTexture) trame.add(v);
      m.dispose();
    }
    for (const t of trame) t.dispose();
    sole.shadow.map?.dispose?.();
    renderer.dispose();
    palco.remove();
  }
  function ridimensiona() {
    largo = alto = 0;
    richiedi();
  }
  const osservatore = typeof ResizeObserver === "function" ? new ResizeObserver(() => ridimensiona()) : null;
  osservatore?.observe(palco);
  apri("esterno");
  aggiornaStati(leggiStati());
  S.cam = { ...S.camVoluta };
  S.taglio = S.taglioVoluto;
  S.giorno = S.giornoVoluto;
  for (const p of PIANI_MIEI) {
    for (const Dv of p.luci) Dv.luce.livello = Dv.luce.voluto;
    for (const T of p.tapparelle) T.chiusa = T.voluta;
    for (const F of p.finestre) F.aperta = F.voluto;
    for (const P of p.porte) P.aperta = P.voluto;
  }
  avanza(1 / 60);
  return {
    aggiornaStati: (states) => aggiornaStati(states),
    apri,
    arreda,
    distruggi,
    ridimensiona,
    /** Un fotogramma subito, senza aspettare il giro: per le prove. */
    fotogramma(dt = 1 / 60) {
      avanza(dt);
      disegna();
    },
    vista: () => S.vista,
    arredando: () => S.arreda,
    /** I piani da elencare: quelli della casa, dall'alto. */
    piani: () => PIANI_MIEI.slice().reverse().map((p) => ({ k: p.k, nome: p.nome, livello: p.livello, locali: lociDi(p), luci: p.luci.length, luciAccese: luciAccese(p) })),
    casa: () => copia(C),
    /** Per le prove: sceglie una stanza (per nome) in «Arreda». */
    scegliStanza(nome, scheda) {
      const p = PIANI_MIEI.find((x) => x.k === S.vista);
      const s = p?.stanze.find((x) => x.nome.toLowerCase() === String(nome).toLowerCase());
      if (scheda) S.scheda = scheda;
      if (p && s) scegliStanza(p, s);
      return Boolean(s);
    },
    /** Per le prove: sceglie un pezzo (arredo o dispositivo) per chiave. */
    scegliPezzo(k) {
      const p = PIANI_MIEI.find((x) => x.k === S.vista);
      const A = p && [...p.arredi, ...p.disp].find((x) => x.k === k);
      if (A) {
        if (A.D) S.scheda = "dispositivi";
        scegliPezzo(A);
      }
      return Boolean(A);
    }
  };
}
function tettoAFalde(THREE, x0, x1, z0, z1, h) {
  const w = x1 - x0, d = z1 - z0, v = [];
  const tri = (a, b, c) => v.push(...a, ...b, ...c);
  const A = [x0, 0, z0], B = [x1, 0, z0], C = [x1, 0, z1], D = [x0, 0, z1];
  if (w >= d) {
    const r0 = [x0 + d / 2, h, (z0 + z1) / 2], r1 = [x1 - d / 2, h, (z0 + z1) / 2];
    tri(D, C, r1);
    tri(D, r1, r0);
    tri(B, A, r0);
    tri(B, r0, r1);
    tri(A, D, r0);
    tri(C, B, r1);
  } else {
    const r0 = [(x0 + x1) / 2, h, z0 + w / 2], r1 = [(x0 + x1) / 2, h, z1 - w / 2];
    tri(A, D, r1);
    tri(A, r1, r0);
    tri(C, B, r0);
    tri(C, r0, r1);
    tri(B, A, r0);
    tri(D, C, r1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  const uv = [];
  for (let i = 0; i < v.length; i += 3) uv.push(v[i] * 0.35 + v[i + 1] * 0.35, v[i + 2] * 0.35 + v[i + 1] * 0.5);
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}
function installaLoStile() {
  if (document.getElementById("dm-casa3d-scena-stile")) return;
  const st = document.createElement("style");
  st.id = "dm-casa3d-scena-stile";
  st.textContent = `
  .c3-scena{position:absolute;inset:0;overflow:hidden;border-radius:inherit;touch-action:none;user-select:none;-webkit-user-select:none}
  .c3-scena>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
  .c3-strato,.c3-chip-strato{position:absolute;inset:0;pointer-events:none}
  .c3-etichetta{position:absolute;left:0;top:0;white-space:nowrap;background:rgba(15,23,42,.74);border:1px solid rgba(148,163,184,.25);border-radius:12px;padding:6px 9px;
    -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);display:flex;flex-direction:column;gap:2px;color:#e6edf7;will-change:transform}
  .c3-etichetta.c3-si{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,.35)}
  .c3-etichetta .c3-n{font-family:'Oswald',system-ui,sans-serif;font-weight:500;font-size:12px;letter-spacing:.05em;text-transform:uppercase}
  .c3-etichetta .c3-v{display:flex;gap:7px;font-size:10.5px;font-weight:700;color:#92a4c2}
  .c3-etichetta .c3-v b{color:#e6edf7}
  .c3-chip{position:absolute;left:0;top:0;pointer-events:auto;cursor:pointer;padding:3px 8px;border-radius:100px;font:700 10.5px 'Inter',system-ui,sans-serif;white-space:nowrap;
    background:rgba(var(--c,100,116,139),.88);color:#fff;border:1px solid rgba(var(--c,100,116,139),.6);will-change:transform}
  .c3-chip.c3-scollegato{opacity:.6;border-style:dashed}
  .c3-chip.c3-scelto{box-shadow:0 0 0 3px #38bdf8}
  .c3-chip.c3-vivo{animation:c3-pulsa 1.2s infinite}
  @keyframes c3-pulsa{0%,100%{box-shadow:0 0 0 3px rgba(var(--c),.35)}50%{box-shadow:0 0 0 7px rgba(var(--c),.1)}}
  .c3-cartellino{position:absolute;left:0;top:0;pointer-events:auto;cursor:pointer;background:rgba(15,23,42,.84);border:1px solid rgba(148,163,184,.3);border-radius:12px;
    padding:6px 10px;font-size:11px;color:#92a4c2;white-space:nowrap;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  .c3-cartellino b{font-family:'Oswald',system-ui,sans-serif;font-weight:500;font-size:13px;color:#e6edf7;letter-spacing:.04em;text-transform:uppercase;margin-right:6px}
  .c3-cartellino.c3-si{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,.25);color:#e0f2fe}
  .c3-sugg{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);padding:9px 14px;border-radius:100px;background:rgba(15,23,42,.8);
    border:1px solid rgba(148,163,184,.3);font-size:12px;color:#cbd5e1;white-space:nowrap;pointer-events:none}
  .c3-zoom{position:absolute;right:14px;bottom:14px;display:flex;gap:6px}
  .c3-zoom span{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:15px;font-weight:700;cursor:pointer;color:#e6edf7;
    background:rgba(15,23,42,.8);border:1px solid rgba(148,163,184,.3)}
  .c3-maniglie{position:absolute;left:0;top:0;display:none;gap:4px;padding:5px;border-radius:100px;background:rgba(15,23,42,.92);border:1px solid #38bdf8;
    box-shadow:0 6px 20px rgba(0,0,0,.4);z-index:6}
  .c3-maniglie span{min-width:34px;height:34px;padding:0 9px;display:flex;align-items:center;justify-content:center;border-radius:100px;background:#1b2540;
    font-size:15px;font-weight:700;cursor:pointer;color:#e6edf7}
  .c3-maniglie span.c3-via{background:rgba(190,18,60,.3)}
  .c3-maniglie.c3-no{border-color:#f87171}
  .c3-pannello-sopra{position:absolute;right:12px;top:12px;bottom:60px;width:min(330px,calc(100% - 24px));overflow:auto;z-index:7;border-radius:18px;
    background:rgba(22,31,54,.94);border:1px solid #263453;padding:14px;color:#e6edf7}
  .c3-ar{display:flex;flex-direction:column;gap:8px;font-size:12.5px}
  .c3-ar-testa{display:flex;align-items:baseline;gap:8px;font-family:'Oswald',system-ui,sans-serif;font-size:15px;text-transform:uppercase;letter-spacing:.06em}
  .c3-ar-testa .c3-piccolo{margin-left:auto;font-family:'Inter',system-ui,sans-serif;text-transform:none;letter-spacing:0}
  .c3-piccolo{font-size:11.5px;opacity:.75;margin:0;line-height:1.4}
  .c3-salvato{font-size:11.5px;font-weight:700;color:#16a34a}
  .c3-avviso{margin:0;font-size:12px;font-weight:700;color:#f87171}
  .c3-linguette{display:flex;gap:3px;background:rgba(148,163,184,.14);border-radius:100px;padding:3px}
  .c3-linguette span{flex:1;text-align:center;padding:7px 2px;border-radius:100px;font-size:11.5px;font-weight:700;cursor:pointer;opacity:.8;white-space:nowrap}
  .c3-linguette span.c3-si{background:#0ea5e9;color:#fff;opacity:1}
  .c3-cat{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;opacity:.7;margin-top:6px}
  .c3-chips{display:flex;gap:6px;flex-wrap:wrap}
  .c3-ch{padding:6px 11px;border-radius:100px;border:1px solid rgba(148,163,184,.35);background:rgba(148,163,184,.1);font:inherit;font-size:12px;cursor:pointer;color:inherit}
  .c3-ch.c3-si{background:#0ea5e9;border-color:#0ea5e9;color:#fff;font-weight:700}
  .c3-griglia{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
  .c3-voce{background:rgba(148,163,184,.1);border:1px solid rgba(148,163,184,.3);border-radius:12px;padding:8px 4px;text-align:center;cursor:pointer;
    font:inherit;font-size:11px;line-height:1.25;color:inherit}
  .c3-voce b{display:block;font-size:20px;margin-bottom:3px}
  .c3-voce i{display:block;font-style:normal;opacity:.7;font-size:10px;margin-top:2px}
  .c3-voce.c3-si{border-color:#38bdf8;background:rgba(14,165,233,.16)}
  .c3-pav{padding:5px;text-align:left}
  .c3-pav img{width:100%;height:42px;border-radius:8px;display:block;margin-bottom:5px;object-fit:cover}
  .c3-tinte{display:flex;flex-wrap:wrap;gap:7px}
  .c3-tinta{width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.2);cursor:pointer}
  .c3-tinta.c3-si{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,.35)}
  .c3-muri{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
  .c3-muro{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;background:rgba(148,163,184,.1);border:1px solid rgba(148,163,184,.3);
    font:inherit;font-size:12px;cursor:pointer;color:inherit;text-align:left}
  .c3-muro span{width:22px;height:22px;border-radius:6px;flex:none}
  .c3-muro.c3-si{border-color:#38bdf8;background:rgba(14,165,233,.16)}
  .c3-dentro{display:flex;flex-wrap:wrap;gap:5px}
  .c3-dentro span{padding:4px 8px;border-radius:8px;background:rgba(148,163,184,.16);font-size:11px;cursor:pointer}
  .c3-dentro span.c3-si{background:rgba(14,165,233,.3);box-shadow:inset 0 0 0 1px #38bdf8}
  .c3-dentro em{font-style:normal;color:#f87171;margin-left:5px;cursor:pointer}
  .c3-pezzo{display:flex;align-items:center;gap:10px;padding:10px;border-radius:14px;background:rgba(14,165,233,.12);border:1px solid rgba(56,189,248,.5)}
  .c3-pezzo b{font-size:22px}
  .c3-pn{font-weight:700;font-size:13px}
  .c3-pc{font-size:11px;opacity:.75}
  .c3-riga{display:flex;gap:6px}
  .c3-campo{width:100%;min-width:0;padding:9px 10px;border-radius:10px;background:rgba(148,163,184,.1);color:inherit;border:1px solid rgba(148,163,184,.35);font:inherit;font-size:12.5px}
  .c3-campo option{color:#0f172a}
  .c3-campo.c3-sbagliato{border-color:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.2)}
  `;
  document.head.appendChild(st);
}
export {
  creaScena
};
