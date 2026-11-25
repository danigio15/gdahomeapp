/* La Casa 3D su ogni dispositivo: col 3D dove regge, in pianta dove no
 * (`core/la-grafica-della-casa-3d.js`, `sections/casa-3d/pianta.js`).
 *
 * «Ci vogliono caratteristiche particolari del tablet per far girare l'app
 * del 3D?» Il motore del 3D vuole WebGL 2: un tablet col solo WebGL 1 restava
 * sullo sfondo con «non si apre». */
import assert from "node:assert/strict";
import test from "node:test";
import {
  CHIAVE_DELLA_VISTA,
  graficaDebole,
  comeMostrareLaCasa,
  perchéLaPianta,
  provaLaGrafica,
  ricordaLaVista,
  vistaRicordata,
} from "../src/core/la-grafica-della-casa-3d.js";
import { CELLA, comprimiGriglia } from "../src/core/casa-3d.js";
import { coloriDelPiano, pianoDellaPianta, scalaDelPiano } from "../src/sections/casa-3d/pianta.js";

/* Un documento finto: quali contesti da' la tela, e chi l'ha restituita. */
function documento({ webgl2 = true, webgl1 = true, gpu = "Mali-T720" } = {}) {
  const persi = [];
  return {
    persi,
    createElement: () => ({
      getContext(tipo) {
        if (tipo === "webgl2" && !webgl2) return null;
        if ((tipo === "webgl" || tipo === "experimental-webgl") && !webgl1) return null;
        if (tipo !== "webgl2" && tipo !== "webgl" && tipo !== "experimental-webgl") return null;
        return {
          RENDERER: 1,
          getParameter: (p) => (p === 7 ? gpu : "WebKit WebGL"),
          getExtension: (nome) =>
            nome === "WEBGL_debug_renderer_info"
              ? { UNMASKED_RENDERER_WEBGL: 7 }
              : nome === "WEBGL_lose_context"
                ? { loseContext: () => persi.push(tipo) }
                : null,
        };
      },
    }),
  };
}

test("la grafica: WebGL 2, solo WebGL 1, niente — e la tela di prova si restituisce", () => {
  const d2 = documento();
  assert.deepEqual(provaLaGrafica(d2), { webgl2: true, webgl1: true, gpu: "Mali-T720" });
  assert.deepEqual(d2.persi, ["webgl2"]);
  const d1 = documento({ webgl2: false, gpu: "Mali-400 MP" });
  assert.deepEqual(provaLaGrafica(d1), { webgl2: false, webgl1: true, gpu: "Mali-400 MP" });
  assert.deepEqual(d1.persi, ["webgl"]);
  assert.deepEqual(provaLaGrafica(documento({ webgl2: false, webgl1: false })), {
    webgl2: false,
    webgl1: false,
    gpu: "",
  });
  /* un browser che non sa nemmeno fare una tela non e' un errore */
  assert.deepEqual(provaLaGrafica(null), { webgl2: false, webgl1: false, gpu: "" });
});

test("3D o pianta: senza WebGL 2 sempre pianta, e senza il tasto per provare il 3D", () => {
  const solo1 = comeMostrareLaCasa({ grafica: { webgl2: false, webgl1: true }, scelta: "3d" });
  assert.deepEqual(solo1, { vista: "pianta", motivo: "solo-webgl1", si3d: false });
  assert.equal(
    comeMostrareLaCasa({ grafica: { webgl2: false, webgl1: false } }).motivo,
    "senza-webgl",
  );
  const pieno = { webgl2: true, webgl1: true };
  assert.deepEqual(comeMostrareLaCasa({ grafica: pieno }), {
    vista: "3d",
    motivo: "",
    si3d: true,
    leggera: false,
  });
  /* il 3D che non parte, o che cade troppe volte, porta in pianta col perche' */
  assert.equal(
    comeMostrareLaCasa({ grafica: pieno, rotto: "Error creating WebGL context" }).motivo,
    "non-parte",
  );
  assert.equal(comeMostrareLaCasa({ grafica: pieno, caduto: true }).motivo, "memoria");
  /* la scelta di chi guarda: pianta, senza dover spiegare niente */
  assert.deepEqual(comeMostrareLaCasa({ grafica: pieno, scelta: "pianta" }), {
    vista: "pianta",
    motivo: "",
    si3d: true,
  });
  /* senza sapere la grafica (la prova non e' riuscita) si prova il 3D */
  assert.equal(comeMostrareLaCasa({}).vista, "3d");
  for (const m of ["solo-webgl1", "senza-webgl", "non-parte", "memoria"]) {
    assert.match(perchéLaPianta(m), /pianta/);
    assert.match(perchéLaPianta(m, false), /floor plan/);
  }
  assert.equal(perchéLaPianta(""), "");
});

test("la scelta resta a questo dispositivo, e un browser senza memoria non e' un errore", () => {
  const m = new Map();
  const memoria = {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
  assert.equal(vistaRicordata(memoria), "");
  ricordaLaVista(memoria, "pianta");
  assert.equal(m.get(CHIAVE_DELLA_VISTA), "pianta");
  assert.equal(vistaRicordata(memoria), "pianta");
  ricordaLaVista(memoria, "3d");
  assert.equal(vistaRicordata(memoria), "3d");
  ricordaLaVista(memoria, "");
  assert.equal(vistaRicordata(memoria), "");
  m.set(CHIAVE_DELLA_VISTA, "boh");
  assert.equal(vistaRicordata(memoria), "");
  const rotta = {
    getItem() {
      throw new Error("SecurityError");
    },
    setItem() {
      throw new Error("SecurityError");
    },
  };
  assert.equal(vistaRicordata(rotta), "");
  assert.doesNotThrow(() => ricordaLaVista(rotta, "pianta"));
  assert.equal(vistaRicordata(null), "");
});

/* Un piano finto: 20×10 celle, muri intorno, due stanze, un bordo vuoto. */
function piano() {
  const W = 24,
    H = 14;
  const t = new Int16Array(W * H).fill(CELLA.fuori);
  const set = (x0, y0, x1, y1, v) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) t[y * W + x] = v;
  };
  set(2, 2, 22, 12, CELLA.muro);
  set(3, 3, 11, 11, 1);
  set(12, 3, 21, 11, 2);
  set(8, 2, 10, 3, CELLA.davanzale);
  return {
    W,
    H,
    passo: 0.5,
    griglia: comprimiGriglia(t),
    stanze: [
      { id: 1, nome: "Soggiorno", pavimento: { colore: "#c19a6b" } },
      { id: 2, nome: "Cucina" },
    ],
  };
}

test("la pianta: il riquadro senza i bordi vuoti, le stanze col nome in cima", () => {
  const P = pianoDellaPianta(piano());
  assert.deepEqual([P.x0, P.y0, P.x1, P.y1], [2, 2, 21, 11]);
  const [s1, s2] = P.stanze;
  assert.equal(s1.nome, "Soggiorno");
  assert.equal(s1.ny, 3);
  assert.equal(s1.nx, 7);
  assert.equal(s2.nx, 16.5);
  assert.equal(s1.m2, 8 * 8 * 0.25);
});

test("la pianta: i colori delle celle, chiari e scuri", () => {
  const P = pianoDellaPianta(piano());
  for (const tema of ["light", "dark"]) {
    const img = coloriDelPiano(P, tema);
    assert.equal(img.largo, 20);
    assert.equal(img.alto, 10);
    const px = (x, y) =>
      Array.from(img.pixel.slice((y * img.largo + x) * 4, (y * img.largo + x) * 4 + 4));
    /* il muro, la finestra, due stanze di colore diverso: tutto pieno */
    const muro = px(0, 0),
      finestra = px(6, 0),
      soggiorno = px(3, 3),
      cucina = px(14, 3);
    for (const c of [muro, finestra, soggiorno, cucina]) assert.equal(c[3], 255);
    assert.notDeepEqual(soggiorno, cucina);
    assert.notDeepEqual(muro, soggiorno);
    assert.deepEqual(finestra.slice(0, 3), [0x38, 0xbd, 0xf8]);
  }
  /* al buio i muri sono chiari, di giorno scuri */
  const chiaro = coloriDelPiano(P, "light").pixel[0];
  const scuro = coloriDelPiano(P, "dark").pixel[0];
  assert.ok(scuro > chiaro);
});

test("la pianta sta nel suo spazio, col margine, qualunque sia la forma", () => {
  const P = pianoDellaPianta(piano());
  const s = scalaDelPiano(P, 432, 300, 16);
  assert.equal(s, Math.min((432 - 32) / 20, (300 - 32) / 10));
  assert.ok(20 * s <= 432 - 32 && 10 * s <= 300 - 32);
  /* uno spazio che non c'e' ancora non fa una scala negativa */
  assert.ok(scalaDelPiano(P, 0, 0) > 0);
});

test("una grafica debole (il Teclast P25T, PowerVR GE8300) apre il 3D, leggero", () => {
  /* «Prima si apriva»: la casa la si vuole in 3D. */
  const p25t = { webgl2: true, webgl1: true, gpu: "PowerVR Rogue GE8300" };
  assert.equal(graficaDebole(p25t.gpu), true);
  assert.deepEqual(comeMostrareLaCasa({ grafica: p25t }), {
    vista: "3d",
    motivo: "",
    si3d: true,
    leggera: true,
  });
  assert.equal(
    comeMostrareLaCasa({ grafica: { webgl2: true, gpu: "Adreno (TM) 650" } }).leggera,
    false,
  );
  /* se anche il 3D leggero cade troppe volte, la pianta */
  assert.equal(comeMostrareLaCasa({ grafica: p25t, caduto: true }).vista, "pianta");
  for (const gpu of ["Mali-400 MP", "Mali-T720", "Adreno (TM) 306", "PowerVR Rogue GE8320"])
    assert.equal(graficaDebole(gpu), true, gpu);
  for (const gpu of ["Adreno (TM) 650", "Mali-G78", "Apple GPU", "ANGLE (Intel)", "", null])
    assert.equal(graficaDebole(gpu), false, String(gpu));
});

test("il 3D leggero: un pixel, niente antialias ne' ombra, materiali semplici, pavimenti piccoli", async () => {
  const { qualitaDellaCasa3D } = await import("../src/core/la-qualita-della-casa-3d.js");
  const leggero = qualitaDellaCasa3D({
    dpr: 1.5,
    larghezza: 1280,
    altezza: 700,
    memoria: 4,
    debole: true,
  });
  assert.deepEqual(leggero, {
    pixel: 1,
    antialias: false,
    ombra: 0,
    leggera: true,
    semplice: true,
    tela: 1024,
  });
  const pieno = qualitaDellaCasa3D({ dpr: 1, larghezza: 1400, altezza: 800, memoria: 8 });
  assert.equal(pieno.semplice, false);
  assert.equal(pieno.tela, 2048);
});
