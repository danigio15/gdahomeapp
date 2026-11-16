/* Una casetta in GLB, fatta qui a mano: per le prove del modello 3D (#440).
 *
 * Niente file binari nel deposito e niente esportatori: un GLB e' un JSON e
 * un pezzo di byte, e scriverlo a mano dice anche, a chi legge, com'e' fatto
 * quello che la plancia accetta. Scatole (muri, solaio, porta, finestre) e un
 * tetto a due falde, ognuno col suo materiale.
 */

/* Una scatola con le sue normali: 24 vertici, 12 triangoli. */
function scatola([x0, y0, z0], [x1, y1, z1]) {
  const facce = [
    [[1, 0, 0], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]],
    [[-1, 0, 0], [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]]],
    [[0, 1, 0], [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]]],
    [[0, -1, 0], [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]]],
    [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
    [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]],
  ];
  return daFacce(facce);
}

function daFacce(facce) {
  const pos = [],
    nor = [],
    idx = [];
  for (const [n, vertici] of facce) {
    const base = pos.length / 3;
    for (const v of vertici) {
      pos.push(...v);
      nor.push(...n);
    }
    for (let i = 1; i + 1 < vertici.length; i++) idx.push(base, base + i, base + i + 1);
  }
  return { pos, nor, idx };
}

/* Il tetto a due falde, lungo X, con la cima a `h` sopra `y`. */
function tetto([x0, z0], [x1, z1], y, h, sporto = 0.4) {
  const a = [x0 - sporto, y, z0 - sporto],
    b = [x1 + sporto, y, z0 - sporto],
    c = [x1 + sporto, y, z1 + sporto],
    d = [x0 - sporto, y, z1 + sporto];
  const zm = (z0 + z1) / 2;
  const e = [x0 - sporto, y + h, zm],
    f = [x1 + sporto, y + h, zm];
  const norma = (v) => {
    const l = Math.hypot(...v);
    return v.map((x) => x / l);
  };
  return daFacce([
    [norma([0, z1 - zm + sporto, -h]), [a, e, f, b]],
    [norma([0, z1 - zm + sporto, h]), [c, f, e, d]],
    [[-1, 0, 0], [d, e, a]],
    [[1, 0, 0], [b, f, c]],
    [[0, -1, 0], [a, b, c, d]],
  ]);
}

/**
 * Il GLB. `pezzi` e' un elenco di { geo, colore } (geo da `scatola`/`tetto`);
 * `scala` moltiplica le coordinate (100 = un file in centimetri); `json` si
 * fonde nel JSON per le prove che lo vogliono rovinare.
 */
export function glbDiPezzi(pezzi, { scala = 1, zSu = false, json: extra = {}, nodi = null } = {}) {
  const parti = [];
  let offset = 0;
  const bufferViews = [],
    accessors = [],
    meshes = [],
    materials = [];
  for (const [i, { geo, colore }] of pezzi.entries()) {
    const p = geo.pos.map((v) => v * scala);
    if (zSu)
      for (let k = 0; k < p.length; k += 3) {
        const [x, y, z] = [p[k], p[k + 1], p[k + 2]];
        p[k] = x;
        p[k + 1] = -z;
        p[k + 2] = y;
      }
    const n = geo.nor.slice();
    if (zSu)
      for (let k = 0; k < n.length; k += 3) {
        const [x, y, z] = [n[k], n[k + 1], n[k + 2]];
        n[k] = x;
        n[k + 1] = -z;
        n[k + 2] = y;
      }
    const posB = Buffer.from(new Float32Array(p).buffer);
    const norB = Buffer.from(new Float32Array(n).buffer);
    const idxB = Buffer.from(new Uint16Array(geo.idx).buffer);
    const pad = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
    for (const [b, target] of [
      [posB, 34962],
      [norB, 34962],
      [idxB, 34963],
    ]) {
      bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: b.length, target });
      const pb = pad(b);
      parti.push(pb);
      offset += pb.length;
    }
    const min = [0, 1, 2].map((a) => Math.min(...p.filter((_v, k) => k % 3 === a)));
    const max = [0, 1, 2].map((a) => Math.max(...p.filter((_v, k) => k % 3 === a)));
    const bv = i * 3;
    accessors.push(
      { bufferView: bv, componentType: 5126, count: p.length / 3, type: "VEC3", min, max },
      { bufferView: bv + 1, componentType: 5126, count: n.length / 3, type: "VEC3" },
      { bufferView: bv + 2, componentType: 5123, count: geo.idx.length, type: "SCALAR" },
    );
    const hex = colore.replace("#", "");
    const rgb = [0, 2, 4].map((k) => (parseInt(hex.slice(k, k + 2), 16) / 255) ** 2.2);
    materials.push({ pbrMetallicRoughness: { baseColorFactor: [...rgb, 1], metallicFactor: 0, roughnessFactor: 0.85 } });
    meshes.push({
      primitives: [{ attributes: { POSITION: bv, NORMAL: bv + 1 }, indices: bv + 2, material: i }],
    });
  }
  const bin = Buffer.concat(parti);
  const json = {
    asset: { version: "2.0", generator: "gdahome prove" },
    scene: 0,
    scenes: [{ nodes: (nodi || meshes.map((_m, i) => ({ mesh: i }))).map((_n, i) => i) }],
    nodes: nodi || meshes.map((_m, i) => ({ mesh: i })),
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
    ...extra,
  };
  return glb(json, bin);
}

/** Un GLB da un JSON e un pezzo binario. */
export function glb(json, bin = Buffer.alloc(0)) {
  let testo = Buffer.from(JSON.stringify(json), "utf8");
  testo = Buffer.concat([testo, Buffer.alloc((4 - (testo.length % 4)) % 4, 0x20)]);
  const dati = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const conBin = dati.length > 0;
  const tutto = 12 + 8 + testo.length + (conBin ? 8 + dati.length : 0);
  const testa = Buffer.alloc(12);
  testa.write("glTF", 0, "latin1");
  testa.writeUInt32LE(2, 4);
  testa.writeUInt32LE(tutto, 8);
  const pezzo = (tipo, b) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(b.length, 0);
    h.writeUInt32LE(tipo, 4);
    return Buffer.concat([h, b]);
  };
  return Buffer.concat([testa, pezzo(0x4e4f534a, testo), ...(conBin ? [pezzo(0x004e4942, dati)] : [])]);
}

/** La casetta: 10 × 7 m, 3 m di muri, un tetto rosso, porta, finestre, un muro dentro. */
export function casettaGlb(opzioni = {}) {
  const W = 10,
    D = 7,
    H = 3,
    s = 0.2;
  const pezzi = [
    { geo: scatola([0, 0, 0], [W, 0.2, D]), colore: "#bfb6a6" },
    { geo: scatola([0, 0.2, 0], [W, H, s]), colore: "#efe3cc" },
    { geo: scatola([0, 0.2, D - s], [W, H, D]), colore: "#efe3cc" },
    { geo: scatola([0, 0.2, s], [s, H, D - s]), colore: "#e9dcc2" },
    { geo: scatola([W - s, 0.2, s], [W, H, D - s]), colore: "#e9dcc2" },
    { geo: scatola([6, 0.2, s], [6 + s, H, D - s]), colore: "#f5efe4" },
    { geo: scatola([4.3, 0.2, D - 0.02], [5.4, 2.3, D + 0.06]), colore: "#7c4a2d" },
    { geo: scatola([1.2, 1.1, D - 0.01], [2.8, 2.2, D + 0.05]), colore: "#7fb2d9" },
    { geo: scatola([7.2, 1.1, D - 0.01], [8.8, 2.2, D + 0.05]), colore: "#7fb2d9" },
    { geo: scatola([W - 0.01, 1.1, 2.5], [W + 0.05, 2.2, 4.5]), colore: "#7fb2d9" },
    { geo: tetto([0, 0], [W, D], H, 2.2), colore: "#b5532f" },
  ];
  return glbDiPezzi(pezzi, opzioni);
}

/** Lo stesso, in OBJ (solo la forma). */
export function casettaObj() {
  const righe = ["# casetta", "o casa"];
  let base = 1;
  for (const geo of [scatola([0, 0, 0], [10, 3, 7]), tetto([0, 0], [10, 7], 3, 2)]) {
    for (let k = 0; k < geo.pos.length; k += 3) righe.push(`v ${geo.pos[k]} ${geo.pos[k + 1]} ${geo.pos[k + 2]}`);
    for (let k = 0; k < geo.idx.length; k += 3)
      righe.push(`f ${geo.idx[k] + base} ${geo.idx[k + 1] + base} ${geo.idx[k + 2] + base}`);
    base += geo.pos.length / 3;
  }
  return Buffer.from(righe.join("\n"), "utf8");
}
