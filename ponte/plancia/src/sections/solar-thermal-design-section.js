// Visual owner of the Solar Thermal page (#page-boiler).
//
// The legacy runtime keeps every behaviour: it writes probe temperatures, the
// tank gradient variables, the pump/valve `active` classes, the flow lines and
// the nine control buttons. This module never reads or writes Home Assistant
// state and never touches an id, an onclick or a class the runtime toggles.
//
// What it owns is the scene, and the scene is an illustration.
//
// «Il solare termico è troppo grande, non entra nelle pagine e non mi piace.»
// The first answer was an isometric plant 600 px tall that pushed the controls
// below the fold; the second, a flat schematic, fitted but looked like a
// wiring diagram («non mi piace, fai di meglio»). Of three mockups the owner
// picked the illustrated one, and this is it: a glass collector under a sun
// glow, a glossy insulated tank whose window shows the stratification the two
// probes measure, thick insulated pipes on smooth curves with light running
// through them while their pump turns, and the readings as floating glass
// chips with leader lines. The nine controls are a row of pills inside the
// same card. Header, scene and controls fit on one screen from 1024×768 up.
//
// How it stays in step with the runtime:
//
//   * one coordinate system. The plant is a box with the exact proportions of
//     the drawing's viewBox, centred in the scene and sized with container
//     units, so a point of the drawing and a percentage of the box are the
//     same place at every size. The artwork, the legacy pipes and the legacy
//     hardware (pumps, valve, readouts, the three statistics cards) all sit in
//     that box;
//   * the artwork is drawn into the legacy SVG, behind and in front of the
//     legacy pipe paths. The runtime only ever toggles `active` on those paths
//     by id, so their geometry and the groups around them are ours to own;
//   * colours come from CSS custom properties, including the tank's own
//     `--tank-top` / `--tank-bottom` that the runtime paints from the probes,
//     so a theme switch or a new reading needs no redraw;
//   * a portrait layout swaps in on phones, driven by a media-query listener
//     rather than polling or an observer.
//
// Every DOM change is idempotent and additive, and every moved node keeps its
// id, its onclick and its classes.
import {
  doc,
  installStyle,
  restyleOnLocaleChange,
  root,
  scriviTestoSeCambia,
  t,
  wrapFunction,
} from "./shared.js";
import { PRESSIONE_NORMA, comeStaLaPressione } from "./finestre/la-pressione.js";

const KEY = "__DASHBOARDMODERN_SOLAR_THERMAL_DESIGN__";
const STYLE_ID = "dm-solar-thermal-design";
const SVG_NS = "http://www.w3.org/2000/svg";
const PORTRAIT_QUERY = "(max-width: 600px)";
const state = (root[KEY] ||= { installed: false, frame: 0, query: null });

const RUNS = Object.freeze({
  "flow-sol-hot": "hot",
  "flow-sol-cold": "cold",
  "flow-ricircolo": "loop",
});

/* Both layouts, in drawing units. Pipe runs start and end under a piece of
 * hardware, and they run in the direction the water goes, so the light in
 * them travels the right way. */
const LANDSCAPE = Object.freeze({
  name: "landscape",
  w: 1100,
  h: 430,
  panel: { x: 110, y: 110, w: 270, h: 150, s: 40, d: 18 },
  tank: { cx: 700, top: 66, w: 150, h: 300 },
  sun: [320, 70, 150],
  tap: [1040, 120],
  routes: {
    "flow-sol-hot": "M 378 116 C 470 116, 520 116, 560 130 C 600 144, 608 168, 625 168",
    "flow-sol-cold": "M 625 330 C 560 330, 520 372, 440 372 L 250 372 C 170 372, 140 350, 130 300",
    "flow-ricircolo":
      "M 775 120 L 1000 120 C 1030 120, 1040 130, 1040 160 L 1040 320 C 1040 350, 1030 360, 1000 360 L 775 360",
  },
  leaders: {
    collector: [330, 66, 300, 122],
    alto: [818, 180, 739, 140],
    basso: [818, 294, 739, 318],
  },
});

const PORTRAIT = Object.freeze({
  name: "portrait",
  w: 400,
  h: 600,
  panel: { x: 24, y: 64, w: 196, h: 112, s: 24, d: 12 },
  tank: { cx: 222, top: 262, w: 104, h: 168 },
  sun: [170, 40, 90],
  tap: null,
  routes: {
    "flow-sol-hot":
      "M 216 70 C 300 70, 352 76, 352 130 L 352 196 C 352 222, 340 236, 300 236 L 250 236 C 234 236, 226 246, 224 262",
    "flow-sol-cold":
      "M 200 420 C 190 452, 170 458, 140 458 L 60 458 C 30 458, 18 440, 18 410 L 18 230 C 18 210, 26 202, 38 198",
    "flow-ricircolo":
      "M 270 300 L 340 300 C 364 300, 374 310, 374 334 L 374 396 C 374 420, 364 430, 340 430 L 270 430",
  },
  leaders: {
    collector: [254, 34, 196, 74],
    alto: [156, 291, 197, 300],
    basso: [156, 375, 197, 396],
  },
});

/* Where the HTML pieces sit, in drawing units: [x, y] of the anchor. Pumps and
 * the valve are centred on their point; chips hang from their top-left. */
const PLACES = Object.freeze({
  landscape: {
    pump: [400, 372],
    valve: [520, 120],
    rpump: [1040, 250],
    collectorHit: [110, 110, 288, 190],
    tankNode: [735, 42],
    chipCollector: [285, 12],
    chipAlto: [818, 152],
    chipBasso: [818, 266],
    delta: [470, 236],
    press: [792, 10],
    power: [942, 10],
    tapTag: [1012, 120],
  },
  portrait: {
    pump: [92, 458],
    valve: [352, 150],
    rpump: [374, 366],
    collectorHit: [24, 64, 208, 136],
    tankNode: [244, 240],
    chipCollector: [254, 6],
    chipAlto: [28, 268],
    chipBasso: [28, 352],
    delta: [80, 24],
    press: [16, 500],
    power: [206, 500],
    tapTag: [0, 0],
  },
});

const PUMP_LABELS = [
  ["syn-p-solare", () => t("Pompa solare", "Solar pump")],
  ["syn-p-ricircolo", () => t("Ricircolo", "Recirculation")],
];

/* The control pills carry the same names as the config fields that feed
 * them, so what the page shows is what the configuration asks for. */
const BUTTON_LABELS = [
  ["b-c-pompasol", () => t("Pompa solare", "Solar pump")],
  ["b-c-ricircolo", () => t("Ricircolo", "Recirculation")],
  ["b-c-solare", () => t("Ctrl Solare", "Solar control")],
  ["b-c-valvola", () => t("Chiave solare", "Solar valve")],
  ["b-c-sicurezza", () => t("V. sicurezza", "Safety valve")],
];

const KPI_ORDER = ["delta", "press", "power"];

const pct = (value, total) => `${((value / total) * 100).toFixed(3)}%`;

function placeRules(layout) {
  const P = PLACES[layout.name];
  const at = (sel, [x, y]) =>
    `#page-boiler ${sel}{left:${pct(x, layout.w)} !important;top:${pct(y, layout.h)} !important}`;
  const [hx, hy, hw, hh] = P.collectorHit;
  return [
    at("#syn-p-solare", P.pump),
    at("#syn-v-chiave", P.valve),
    at("#syn-p-ricircolo", P.rpump),
    at(".dm-st-node-tank", P.tankNode),
    at(".dm-st-plant > .syn-solar-content", P.chipCollector),
    at('.dm-st-plant .probe[data-dm-st-probe="alto"]', P.chipAlto),
    at('.dm-st-plant .probe[data-dm-st-probe="basso"]', P.chipBasso),
    at('.dm-st-plant > [data-dm-st-kpi="delta"]', P.delta),
    at('.dm-st-plant > [data-dm-st-kpi="press"]', P.press),
    at('.dm-st-plant > [data-dm-st-kpi="power"]', P.power),
    at(".dm-st-tap-tag", P.tapTag),
    `#page-boiler .dm-st-node-collector{left:${pct(hx, layout.w)} !important;top:${pct(hy, layout.h)} !important;width:${pct(hw, layout.w)};height:${pct(hh, layout.h)}}`,
    `#page-boiler .dm-st-plant{--vw:${layout.w};--vh:${layout.h};width:min(100cqw, 100cqh * ${layout.w} / ${layout.h});height:min(100cqh, 100cqw * ${layout.h} / ${layout.w});--k:calc(min(100cqw, 100cqh * ${layout.w} / ${layout.h}) / ${layout.w})}`,
  ].join("\n");
}

function stylesheet() {
  const idle = t("Impianto in attesa", "System idle");
  const recirculating = t("Ricircolo attivo", "Recirculation running");
  const charging = t("Carico solare attivo", "Solar charging");
  const safety = t("Limite di sicurezza", "Safety limit");
  const open = t("Aperta", "Open");
  const closed = t("Chiusa", "Closed");

  return `
  /* ───────── tokens ───────── */
  #page-boiler {
    --st-card:var(--card-bg, #ffffff);
    --st-line:var(--card-border, #e8edf3);
    --st-ink:var(--text, #0f172a);
    --st-dim:var(--text-dim, #64748b);
    --st-chip:rgba(255,255,255,.88);
    --st-chip-line:rgba(15,23,42,.08);
    --st-chip-shadow:0 6px 16px rgba(15,23,42,.10);
    --st-hot:#fb923c;
    --st-cold:#60a5fa;
    --st-loop:#a78bfa;
    --st-pipe-out:rgba(148,163,184,.55);
    --st-pipe-hot:#fed7aa;
    --st-pipe-cold:#bfdbfe;
    --st-pipe-loop:#ddd6fe;
    --st-pipe-hi:rgba(255,255,255,.65);
    --st-frame:#cbd5e1;
    --st-frame-fill:#e2e8f0;
    --st-j0:#cfd8e3; --st-j1:#ffffff; --st-j2:#eef2f6; --st-j3:#b8c4d3;
    --st-cap:#f8fafc;
    --st-window:#e2e8f0;
    --st-metal-0:#ffffff; --st-metal-1:#dbe3ec; --st-metal-2:#94a3b8;
    --st-shadow:rgba(15,23,42,.14);
    --st-sky:
      radial-gradient(40% 70% at 24% 0%, rgba(251,191,36,.26), transparent 70%),
      radial-gradient(50% 80% at 85% 110%, rgba(59,130,246,.10), transparent 70%),
      linear-gradient(180deg, #f3f8ff 0%, #fbfcfe 62%, #eef2f7 100%);
  }
  html[data-theme="dark"] #page-boiler {
    --st-chip:rgba(22,31,54,.86);
    --st-chip-line:rgba(148,163,184,.22);
    --st-chip-shadow:0 6px 16px rgba(0,0,0,.40);
    --st-pipe-out:rgba(10,17,32,.9);
    --st-pipe-hot:#7c2d12;
    --st-pipe-cold:#1e3a8a;
    --st-pipe-loop:#4c1d95;
    --st-pipe-hi:rgba(255,255,255,.12);
    --st-frame:#64748b;
    --st-frame-fill:#334155;
    --st-j0:#1e293b; --st-j1:#475569; --st-j2:#334155; --st-j3:#1e293b;
    --st-cap:#64748b;
    --st-window:#0b1222;
    --st-metal-0:#94a3b8; --st-metal-1:#475569; --st-metal-2:#1e293b;
    --st-shadow:rgba(0,0,0,.50);
    --st-sky:
      radial-gradient(40% 70% at 24% 0%, rgba(251,146,60,.18), transparent 70%),
      radial-gradient(50% 80% at 85% 110%, rgba(59,130,246,.12), transparent 70%),
      linear-gradient(180deg, #121b31 0%, #141d34 62%, #0f1729 100%);
  }

  /* ───────── card shell ───────── */
  #page-boiler .boiler-dashboard {
    padding:0;
    border-radius:28px;
    border:1px solid var(--st-line);
    background:var(--st-card);
    box-shadow:var(--shadow-sculpted, 0 4px 20px rgba(15,23,42,.06));
    overflow:hidden;
  }
  /* With the page masthead holding the title this header has nothing left to
     say; engines without :has() keep it, which is the old layout. */
  @supports selector(:has(*)) {
    #page-boiler .boiler-header:has([data-dm-mast-folded="true"]) { display:none; }
  }
  #page-boiler .boiler-header {
    display:block;
    margin:0;
    padding:18px 22px 14px;
    border-bottom:1px solid var(--st-line);
  }
  #page-boiler .boiler-title {
    font-size:clamp(20px, 2.6vw, 28px);
    letter-spacing:1.5px;
    color:var(--boiler, #ea580c) !important;
  }
  #page-boiler .dm-st-sub {
    margin-top:5px;
    font-size:11px;
    font-weight:800;
    letter-spacing:1.2px;
    text-transform:uppercase;
    color:var(--st-dim);
  }
  #page-boiler .boiler-dashboard > .dm-it-quali-solare { margin:14px 16px 0; }

  /* ───────── the scene ───────── */
  #page-boiler .synoptic-stage {
    position:relative;
    display:block;
    width:auto;
    height:auto;
    margin:0;
    padding:0;
    border:0;
    border-radius:0;
    background:none;
    box-shadow:none;
    overflow:visible;
  }
  #page-boiler .synoptic-stage[hidden] { display:none !important; }
  #page-boiler .dm-st-scene {
    position:relative;
    /* The page keeps ~160 px under the card for the dock; header, scene and
       the pill row share what is left, so nothing scrolls from 1024×768 up. */
    height:clamp(280px, calc(100vh - 412px), 520px);
    container-type:size;
    background:var(--st-sky);
    overflow:hidden;
  }
  #page-boiler .dm-st-plant {
    position:absolute;
    inset:0;
    margin:auto;
  }
  #page-boiler .boiler-stats-row { display:none !important; }

  /* Live status pill, top left of the scene. */
  #page-boiler .dm-st-live { display:none; }
  @supports selector(:has(*)) {
    #page-boiler .dm-st-live {
      position:absolute;
      left:18px; top:16px;
      z-index:8;
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:7px 14px 7px 11px;
      border-radius:999px;
      border:1px solid var(--st-chip-line);
      background:var(--st-chip);
      -webkit-backdrop-filter:blur(8px);
      backdrop-filter:blur(8px);
      box-shadow:var(--st-chip-shadow);
      font-size:10.5px;
      font-weight:900;
      letter-spacing:1px;
      line-height:1.2;
      text-transform:uppercase;
      color:var(--st-dim);
    }
    #page-boiler .dm-st-live::before {
      content:"";
      flex:none;
      width:8px; height:8px;
      border-radius:50%;
      background:currentColor;
      box-shadow:0 0 0 4px rgba(100,116,139,.16);
    }
    #page-boiler .dm-st-live::after { content:"${idle}"; }
    #page-boiler:has(#syn-p-ricircolo.active) .dm-st-live { color:#7c3aed; border-color:rgba(124,58,237,.28); }
    #page-boiler:has(#syn-p-ricircolo.active) .dm-st-live::after { content:"${recirculating}"; }
    #page-boiler:has(#syn-p-solare.active) .dm-st-live { color:#c2410c; border-color:rgba(234,88,12,.28); }
    #page-boiler:has(#syn-p-solare.active) .dm-st-live::after { content:"${charging}"; }
    #page-boiler:has(#syn-p-solare.active) .dm-st-live::before {
      box-shadow:0 0 0 4px rgba(249,115,22,.18);
      animation:dmStBreathe 1.9s ease-in-out infinite;
    }
    #page-boiler:has(#syn-safety-icon.active) .dm-st-live { color:#dc2626; border-color:rgba(220,38,38,.34); }
    #page-boiler:has(#syn-safety-icon.active) .dm-st-live::after { content:"${safety}"; }
    /* Same precedence in the dark: safety, then charging, then recirculation. */
    html[data-theme="dark"] #page-boiler:has(#syn-p-ricircolo.active) .dm-st-live { color:#a78bfa; }
    html[data-theme="dark"] #page-boiler:has(#syn-p-solare.active) .dm-st-live { color:#fb923c; }
    html[data-theme="dark"] #page-boiler:has(#syn-safety-icon.active) .dm-st-live { color:#f87171; }
  }
  @keyframes dmStBreathe {
    0%,100% { box-shadow:0 0 0 3px rgba(234,88,12,.22); }
    50%     { box-shadow:0 0 0 7px rgba(234,88,12,0); }
  }

  /* ───────── artwork and pipes, one SVG ───────── */
  #page-boiler .dm-st-plant > .syn-svg {
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    z-index:1;
    overflow:visible;
    pointer-events:none;
  }
  #page-boiler .syn-pipe-bg,
  #page-boiler .syn-pipe-inner,
  #page-boiler .dm-st-pipe-hi,
  #page-boiler .syn-flow { fill:none; stroke-linecap:round; stroke-linejoin:round; vector-effect:none; }
  #page-boiler .syn-pipe-bg    { stroke:var(--st-pipe-out); stroke-width:17; opacity:1; }
  #page-boiler .syn-pipe-inner { stroke-width:13; }
  #page-boiler .syn-pipe-inner.dm-st-run-hot  { stroke:var(--st-pipe-hot); }
  #page-boiler .syn-pipe-inner.dm-st-run-cold { stroke:var(--st-pipe-cold); }
  #page-boiler .syn-pipe-inner.dm-st-run-loop { stroke:var(--st-pipe-loop); }
  #page-boiler .dm-st-pipe-hi  { stroke:var(--st-pipe-hi); stroke-width:3; transform:translateY(-3px); }
  #page-boiler .syn-flow {
    stroke-width:5;
    stroke-dasharray:14 64;
    opacity:0;
    filter:url(#dm-st-glow);
    transition:opacity .4s ease;
  }
  #page-boiler .syn-flow.dm-st-run-hot  { stroke:var(--st-hot); }
  #page-boiler .syn-flow.dm-st-run-cold { stroke:var(--st-cold); }
  #page-boiler .syn-flow.dm-st-run-loop { stroke:var(--st-loop); }
  /* Light runs only while its pump turns: the runtime sets .active. */
  #page-boiler .syn-flow.active { opacity:1; animation:dmStFlow 1.4s linear infinite; }
  @keyframes dmStFlow { to { stroke-dashoffset:-78; } }

  #page-boiler .dm-st-sun { opacity:.75; transition:opacity .6s ease; }
  html[data-theme="dark"] #page-boiler .dm-st-sun { opacity:.45; }
  #page-boiler .dm-st-scene:has(.syn-solar-panel.active) .dm-st-sun { opacity:1; }
  html[data-theme="dark"] #page-boiler .dm-st-scene:has(.syn-solar-panel.active) .dm-st-sun { opacity:.62; }
  #page-boiler .dm-st-frame { fill:var(--st-frame-fill); stroke:var(--st-frame); stroke-width:3; stroke-linejoin:round; }
  #page-boiler .dm-st-stand { stroke:var(--st-frame); stroke-width:5; stroke-linecap:round; fill:none; }
  #page-boiler .dm-st-riser { stroke:#f59e0b; stroke-opacity:.55; stroke-width:2; }
  #page-boiler .dm-st-manifold { stroke:#c2410c; stroke-width:4; stroke-linecap:round; }
  #page-boiler .dm-st-rim { fill:none; stroke:#fbbf24; stroke-opacity:.35; stroke-width:2; transition:stroke-opacity .4s ease; }
  #page-boiler .dm-st-scene:has(.syn-solar-panel.active) .dm-st-rim { stroke-opacity:.9; }
  #page-boiler .dm-st-tank-body { fill:url(#dm-st-jacket); stroke:var(--st-frame); stroke-width:1.5; }
  #page-boiler .dm-st-tank-cap { fill:var(--st-cap); stroke:var(--st-frame); stroke-width:1.5; }
  #page-boiler .dm-st-tank-window { fill:var(--st-window); }
  #page-boiler .dm-st-tank-shadow { fill:var(--st-shadow); }
  #page-boiler .dm-st-coil { fill:none; stroke:#fff; stroke-opacity:.45; stroke-width:2; }
  #page-boiler .dm-st-tap-disc { fill:var(--st-card); stroke:var(--st-frame); stroke-width:2; }
  #page-boiler .dm-st-lead { stroke-width:1.5; stroke-dasharray:3 3; opacity:.85; }
  #page-boiler .dm-st-lead-dot { stroke:#fff; stroke-width:2; }
  #page-boiler [data-dm-st-art="lead-collector"] { stroke:#f59e0b; fill:#f59e0b; }
  #page-boiler [data-dm-st-art="lead-alto"]      { stroke:#ef4444; fill:#ef4444; }
  #page-boiler [data-dm-st-art="lead-basso"]     { stroke:#3b82f6; fill:#3b82f6; }

  /* Whatever the runtime hides takes its drawing with it. */
  @supports selector(:has(*)) {
    #page-boiler .dm-st-scene:has(.dm-st-node-collector[style*="display: none"]) [data-dm-st-art="collector"],
    #page-boiler .dm-st-scene:has(.syn-solar-content[style*="display: none"]) [data-dm-st-art="lead-collector"],
    #page-boiler .dm-st-scene:has(.probe[data-dm-st-probe="alto"][style*="display: none"]) [data-dm-st-art="lead-alto"],
    #page-boiler .dm-st-scene:has(.probe[data-dm-st-probe="basso"][style*="display: none"]) [data-dm-st-art="lead-basso"],
    #page-boiler .dm-st-scene:has(#syn-p-ricircolo[style*="display: none"]) .dm-st-run-loop,
    #page-boiler .dm-st-scene:has(#syn-p-ricircolo[style*="display: none"]) [data-dm-st-art="tap"],
    #page-boiler .dm-st-scene:has(#syn-p-ricircolo[style*="display: none"]) .dm-st-tap-tag { display:none; }
  }

  /* ───────── HTML pieces on the drawing ───────── */
  #page-boiler .dm-st-plant > * { position:absolute; }
  #page-boiler .dm-st-plant .syn-node-boiler {
    z-index:2;
    transform:none !important;
  }
  #page-boiler .dm-st-plant .syn-node-boiler::after { content:none; }
  /* The collector is drawn; its legacy body is the click target over it. */
  #page-boiler .dm-st-node-collector .syn-solar-panel {
    position:absolute;
    inset:0;
    width:auto; height:auto;
    padding:0;
    border:0;
    border-radius:12px;
    background:transparent;
    box-shadow:none !important;
    transform:none !important;
    overflow:visible;
  }
  #page-boiler .dm-st-node-collector .syn-solar-panel:hover { transform:none !important; }
  #page-boiler .syn-solar-grid,
  #page-boiler .syn-solar-glass { display:none; }
  /* The tank is drawn too; its node only carries the safety valve. */
  #page-boiler .dm-st-node-tank { width:0; height:0; }
  #page-boiler .dm-st-node-tank .syn-tank { display:none; }
  #page-boiler .dm-st-node-tank .sv-wrap {
    left:0; top:0;
    transform:scale(calc(var(--k) * .85));
    transform-origin:0 0;
  }
  #page-boiler .tank-probes { display:contents; }
  #page-boiler .dm-st-plant .probe { position:absolute; }

  /* Glass chips. */
  #page-boiler .dm-st-plant > .syn-solar-content,
  #page-boiler .dm-st-plant .probe,
  #page-boiler .dm-st-plant > .b-stat-card {
    z-index:5;
    box-sizing:border-box;
    min-width:calc(var(--k) * 150);
    min-height:calc(var(--k) * 54);
    margin:0;
    padding:calc(var(--k) * 7) calc(var(--k) * 14) calc(var(--k) * 7) calc(var(--k) * 22);
    display:flex;
    flex-direction:column;
    justify-content:center;
    align-items:flex-start;
    gap:1px;
    border-radius:calc(var(--k) * 14);
    border:1px solid var(--st-chip-line);
    background:var(--st-chip);
    -webkit-backdrop-filter:blur(8px);
    backdrop-filter:blur(8px);
    box-shadow:var(--st-chip-shadow);
    text-align:left;
    transform:none;
    overflow:visible;
  }
  #page-boiler .dm-st-plant > .syn-solar-content::before,
  #page-boiler .dm-st-plant .probe::before,
  #page-boiler .dm-st-plant > .b-stat-card::before {
    content:"";
    position:absolute;
    left:calc(var(--k) * 10);
    top:calc(var(--k) * 12);
    bottom:calc(var(--k) * 12);
    width:calc(var(--k) * 4);
    border-radius:2px;
    background:var(--st-accent, #f59e0b);
  }
  #page-boiler .dm-st-plant > .syn-solar-content::after,
  #page-boiler .dm-st-plant .probe::after,
  #page-boiler .dm-st-plant > .b-stat-card::after { content:none; }
  #page-boiler .dm-st-plant > .syn-solar-content { --st-accent:#f59e0b; }
  #page-boiler .probe[data-dm-st-probe="alto"]  { --st-accent:#ef4444; }
  #page-boiler .probe[data-dm-st-probe="basso"] { --st-accent:#3b82f6; }
  #page-boiler .sun-icon { display:none; }
  #page-boiler .syn-lbl,
  #page-boiler .dm-st-probe-tag,
  #page-boiler .dm-st-plant > .b-stat-card .lbl {
    margin:0;
    display:flex;
    align-items:center;
    gap:5px;
    font-size:max(8.5px, calc(var(--k) * 9.5));
    font-weight:800;
    letter-spacing:.9px;
    line-height:1.2;
    text-transform:uppercase;
    white-space:nowrap;
    color:var(--st-dim) !important;
    text-align:left;
  }
  #page-boiler .dm-st-probe-tag::before { content:none; }
  #page-boiler .syn-val,
  #page-boiler .probe-val,
  #page-boiler .dm-st-plant > .b-stat-card .val {
    font-family:'Oswald', sans-serif;
    font-size:max(16px, calc(var(--k) * 23));
    font-weight:700;
    line-height:1.1;
    letter-spacing:.3px;
    color:var(--st-ink) !important;
    text-shadow:none;
    white-space:nowrap;
  }

  /* ΔT: a green pill in the middle of the circuit. */
  #page-boiler .dm-st-plant > [data-dm-st-kpi="delta"] {
    min-width:0;
    min-height:0;
    transform:translate(-50%, -50%);
    flex-direction:row;
    align-items:baseline;
    gap:calc(var(--k) * 8);
    padding:calc(var(--k) * 7) calc(var(--k) * 16);
    border-radius:999px;
    border-color:#a7f3d0;
    background:#ecfdf5;
  }
  #page-boiler .dm-st-plant > [data-dm-st-kpi="delta"]::before { content:none; }
  #page-boiler .dm-st-plant > [data-dm-st-kpi="delta"] .lbl { color:#047857 !important; letter-spacing:.6px; }
  #page-boiler .dm-st-plant > [data-dm-st-kpi="delta"] .val { color:#047857 !important; font-size:max(15px, calc(var(--k) * 19)); }
  html[data-theme="dark"] #page-boiler .dm-st-plant > [data-dm-st-kpi="delta"] { border-color:#14532d; background:#052e1c; }
  html[data-theme="dark"] #page-boiler .dm-st-plant > [data-dm-st-kpi="delta"] .lbl,
  html[data-theme="dark"] #page-boiler .dm-st-plant > [data-dm-st-kpi="delta"] .val { color:#4ade80 !important; }

  /* Pressure and heater power, top right. */
  #page-boiler .dm-st-plant > [data-dm-st-kpi="press"],
  #page-boiler .dm-st-plant > [data-dm-st-kpi="power"] {
    min-width:calc(var(--k) * 145);
    padding-left:calc(var(--k) * 48);
  }
  #page-boiler .dm-st-plant > [data-dm-st-kpi="press"]::before,
  #page-boiler .dm-st-plant > [data-dm-st-kpi="power"]::before { content:none; }
  #page-boiler .dm-st-plant > [data-dm-st-kpi="power"] .lbl::before {
    content:"⚡";
    position:absolute;
    left:calc(var(--k) * 14);
    top:50%;
    transform:translateY(-50%);
    font-size:max(15px, calc(var(--k) * 20));
    letter-spacing:0;
  }
  #page-boiler .dm-st-plant > [data-dm-st-kpi="press"] .lbl::before,
  #page-boiler .dm-st-plant > [data-dm-st-kpi="delta"] .lbl::before { content:none; }
  #page-boiler .dm-st-plant .val { font-size:max(15px, calc(var(--k) * 20)); }
  #page-boiler .dm-st-gauge {
    position:absolute;
    left:calc(var(--k) * 10);
    top:50%;
    width:calc(var(--k) * 30);
    height:calc(var(--k) * 30);
    transform:translateY(-50%);
    border-radius:50%;
    background:conic-gradient(from -120deg, var(--dm-st-gauge, #22c55e) 0 var(--dm-st-press, 0deg), rgba(148,163,184,.25) 0 240deg, transparent 0);
    -webkit-mask:radial-gradient(circle, transparent 0 58%, #000 61%);
    mask:radial-gradient(circle, transparent 0 58%, #000 61%);
  }
  #page-boiler .dm-st-needle {
    position:absolute;
    left:calc(var(--k) * 25);
    top:50%;
    width:calc(var(--k) * 3);
    height:calc(var(--k) * 12);
    margin-top:calc(var(--k) * -12);
    border-radius:2px;
    background:var(--st-ink);
    transform-origin:50% 100%;
    transform:rotate(calc(var(--dm-st-press, 0deg) - 120deg));
  }
  #page-boiler .dm-st-needle::after {
    content:"";
    position:absolute;
    left:50%; bottom:calc(var(--k) * -3);
    width:calc(var(--k) * 7); height:calc(var(--k) * 7);
    transform:translateX(-50%);
    border-radius:50%;
    background:var(--st-ink);
  }

  /* Circulators and the solar valve: glossy discs on the line. */
  #page-boiler .dm-st-plant .syn-pump,
  #page-boiler .dm-st-plant .syn-valve {
    --d:calc(var(--k) * 40);
    width:var(--d);
    height:var(--d);
    margin:0;
    transform:translate(-50%, -50%) !important;
    display:block;
    z-index:6;
  }
  #page-boiler .dm-st-plant #syn-v-chiave { --d:calc(var(--k) * 34); }
  #page-boiler .dm-st-plant .syn-pump .icon,
  #page-boiler .dm-st-plant #syn-v-chiave .icon {
    position:relative;
    box-sizing:border-box;
    width:100% !important;
    height:100% !important;
    padding:0;
    display:grid;
    place-items:center;
    border-radius:50%;
    border:calc(var(--k) * 3) solid var(--st-frame) !important;
    background:radial-gradient(circle at 35% 30%, var(--st-metal-0), var(--st-metal-1) 60%, var(--st-metal-2)) !important;
    box-shadow:0 calc(var(--k) * 5) calc(var(--k) * 12) var(--st-shadow) !important;
    overflow:visible;
    transition:border-color .3s ease, box-shadow .3s ease;
  }
  #page-boiler .dm-st-plant .syn-pump .icon::before,
  #page-boiler .dm-st-plant .syn-pump .icon::after,
  #page-boiler .dm-st-plant #syn-v-chiave .icon::before,
  #page-boiler .dm-st-plant #syn-v-chiave .icon::after { content:none; }
  #page-boiler .dm-st-rotor {
    position:absolute;
    inset:18%;
    display:block !important;
    border-radius:50%;
    background:conic-gradient(from 0deg,
      #94a3b8 0 16%, transparent 16% 33.3%,
      #94a3b8 33.3% 49.3%, transparent 49.3% 66.6%,
      #94a3b8 66.6% 82.6%, transparent 82.6% 100%);
    -webkit-mask:radial-gradient(circle, transparent 0 16%, #000 18%);
    mask:radial-gradient(circle, transparent 0 16%, #000 18%);
  }
  #page-boiler .dm-st-plant #syn-p-solare.active .icon {
    border-color:#f97316 !important;
    box-shadow:0 0 0 calc(var(--k) * 5) rgba(249,115,22,.16), 0 0 calc(var(--k) * 22) rgba(249,115,22,.45) !important;
  }
  #page-boiler #syn-p-solare.active .dm-st-rotor {
    background:conic-gradient(from 0deg,
      #f97316 0 16%, transparent 16% 33.3%,
      #f97316 33.3% 49.3%, transparent 49.3% 66.6%,
      #f97316 66.6% 82.6%, transparent 82.6% 100%);
  }
  #page-boiler .dm-st-plant #syn-p-ricircolo.active .icon {
    border-color:#8b5cf6 !important;
    box-shadow:0 0 0 calc(var(--k) * 5) rgba(139,92,246,.16), 0 0 calc(var(--k) * 22) rgba(139,92,246,.45) !important;
  }
  #page-boiler #syn-p-ricircolo.active .dm-st-rotor {
    background:conic-gradient(from 0deg,
      #8b5cf6 0 16%, transparent 16% 33.3%,
      #8b5cf6 33.3% 49.3%, transparent 49.3% 66.6%,
      #8b5cf6 66.6% 82.6%, transparent 82.6% 100%);
  }
  #page-boiler #syn-v-chiave .valve-svg { width:66%; height:66%; }
  #page-boiler .dm-st-plant #syn-v-chiave.active .icon {
    border-color:#16a34a !important;
    box-shadow:0 0 0 calc(var(--k) * 5) rgba(22,163,74,.14), 0 calc(var(--k) * 5) calc(var(--k) * 12) var(--st-shadow) !important;
  }
  #page-boiler .dm-st-plant #syn-v-chiave:not(.active) .icon { border-color:#ef4444 !important; }

  /* Name tags: the name, then the state the runtime already drew. */
  #page-boiler .dm-st-plant .syn-pump .lbl,
  #page-boiler .dm-st-plant .syn-valve .lbl,
  #page-boiler .dm-st-plant > .dm-st-tap-tag {
    position:absolute;
    z-index:7;
    margin:0;
    display:inline-flex;
    align-items:center;
    gap:6px;
    padding:calc(var(--k) * 4) calc(var(--k) * 10);
    border-radius:999px;
    font-size:max(8.5px, calc(var(--k) * 9.5));
    font-weight:800;
    letter-spacing:.8px;
    line-height:1.3;
    text-transform:uppercase;
    white-space:nowrap;
    color:var(--st-dim);
    background:var(--st-chip);
    border:1px solid var(--st-chip-line);
    box-shadow:0 2px 6px rgba(15,23,42,.06);
  }
  #page-boiler .dm-st-plant .syn-pump .lbl::before,
  #page-boiler .dm-st-plant .syn-valve .lbl::before,
  #page-boiler .dm-st-plant > .dm-st-tap-tag::before {
    content:"";
    flex:none;
    width:7px; height:7px;
    border-radius:50%;
    background:#94a3b8;
  }
  #page-boiler .dm-st-plant .syn-pump .lbl::after { content:"· OFF"; margin-left:-2px; }
  #page-boiler .dm-st-plant .syn-pump.active .lbl::after { content:"· ON"; }
  #page-boiler .dm-st-plant .syn-valve .lbl::after { content:"· ${closed}"; margin-left:-2px; }
  #page-boiler .dm-st-plant .syn-valve.active .lbl::after { content:"· ${open}"; }
  #page-boiler .dm-st-plant #syn-p-solare.active .lbl::before { background:#f97316; }
  #page-boiler .dm-st-plant #syn-p-ricircolo.active .lbl::before,
  #page-boiler .dm-st-plant > .dm-st-tap-tag::before { background:#8b5cf6; }
  #page-boiler .dm-st-plant #syn-v-chiave.active .lbl::before { background:#16a34a; }
  #page-boiler .dm-st-plant #syn-v-chiave:not(.active) .lbl::before { background:#ef4444; }
  #page-boiler .dm-st-plant #syn-p-solare .lbl { left:50%; bottom:calc(100% + var(--k) * 8); transform:translateX(-50%); }
  #page-boiler .dm-st-plant #syn-v-chiave .lbl { left:50%; top:calc(100% + var(--k) * 8); transform:translateX(-50%); }
  #page-boiler .dm-st-plant #syn-p-ricircolo .lbl { right:calc(100% + var(--k) * 8); top:50%; transform:translateY(-50%); }
  #page-boiler .dm-st-plant > .dm-st-tap-tag { transform:translate(-100%, -50%); }
  #page-boiler .dm-st-plant > .dm-st-tap-tag::after { content:none; }

  /* Safety banner, bottom right of the scene. */
  #page-boiler .dm-st-scene > .syn-safety-alert {
    top:auto; left:auto;
    right:14px; bottom:14px;
    padding:6px 14px;
    border-radius:999px;
    border:1px solid #fca5a5;
    background:#fef2f2;
    color:#b91c1c;
    font-size:10px;
    letter-spacing:1px;
    box-shadow:0 6px 16px rgba(220,38,38,.18);
    z-index:9;
  }
  #page-boiler .dm-st-scene > .syn-safety-alert.active { animation:dmStAlert 1.8s ease-in-out infinite; }
  @keyframes dmStAlert {
    0%,100% { box-shadow:0 6px 16px rgba(220,38,38,.18); }
    50%     { box-shadow:0 6px 22px rgba(220,38,38,.42); }
  }

  ${placeRules(LANDSCAPE)}

  /* ───────── the controls: a row of pills in the same card ───────── */
  #page-boiler .b-controls-grid {
    display:grid;
    grid-template-columns:repeat(9, minmax(0, max-content));
    justify-content:space-between;
    gap:8px;
    margin:0;
    padding:12px 16px 14px;
    border-top:1px solid var(--st-line);
  }
  #page-boiler .b-btn {
    position:relative;
    min-width:0;
    display:flex;
    flex-direction:row;
    align-items:center;
    justify-content:flex-start;
    gap:7px;
    padding:5px 8px 5px 5px;
    border-radius:999px;
    border:1px solid var(--st-line);
    background:var(--st-card);
    box-shadow:none;
    transform:none;
    overflow:hidden;
  }
  #page-boiler .b-btn .icon {
    flex:none;
    width:26px; height:26px;
    display:grid;
    place-items:center;
    border-radius:50%;
    font-size:13px;
    background:var(--surface-3, #f1f5f9);
    filter:grayscale(1) opacity(.6);
    transform:none;
    box-shadow:none;
  }
  #page-boiler .b-btn .lbl {
    flex:1 1 auto;
    min-width:0;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
    font-size:11.5px;
    font-weight:700;
    letter-spacing:0;
    text-transform:none;
    text-align:left;
    color:var(--st-dim);
  }
  #page-boiler .b-btn .state {
    flex:none;
    padding:2px 7px;
    border-radius:999px;
    border:0;
    font-size:9px;
    font-weight:800;
    letter-spacing:.7px;
    color:var(--st-dim);
    background:var(--surface-3, #f1f5f9);
  }
  #page-boiler .b-btn.active {
    transform:none;
    border-color:rgba(var(--c-rgb), .38);
    background:rgba(var(--c-rgb), .07);
    box-shadow:none;
  }
  #page-boiler .b-btn.active::after { content:none; }
  #page-boiler .b-btn.active .icon { filter:none; transform:none; background:rgba(var(--c-rgb), .16); box-shadow:none; }
  #page-boiler .b-btn.active .lbl { color:rgb(var(--c-rgb)); }
  #page-boiler .b-btn.active .state { color:#fff; background:rgb(var(--c-rgb)); }
  html[data-theme="dark"] #page-boiler .b-btn.active .lbl { color:color-mix(in srgb, rgb(var(--c-rgb)) 60%, #ffffff); }
  #page-boiler .b-btn:hover { border-color:rgba(var(--c-rgb), .45); }
  #page-boiler .b-btn:active { transform:scale(.97); }
  #page-boiler .b-btn.active .spin-active { display:inline-block; animation:spinAnim 1.6s linear infinite; }
  #page-boiler .b-btn.active .blink-active { display:inline-block; animation:dmStBlink 1.25s ease-in-out infinite; }
  @keyframes dmStBlink { 0%,100% { opacity:1; } 50% { opacity:.35; } }
  /* Narrower cards: the icon bubble goes first, then the row folds 5 + 4. */
  @media (max-width:1360px) {
    #page-boiler .b-btn .icon { display:none; }
    #page-boiler .b-btn { gap:6px; padding-left:12px; }
  }
  @media (max-width:1100px) {
    #page-boiler .b-controls-grid { grid-template-columns:repeat(5, minmax(0, 1fr)); justify-content:stretch; }
    #page-boiler .dm-st-scene { height:clamp(260px, calc(100vh - 456px), 520px); }
  }

  /* ───────── phones: the plant stands up ───────── */
  @media ${PORTRAIT_QUERY} {
    #page-boiler .boiler-dashboard { border-radius:22px; }
    #page-boiler .boiler-dashboard > .dm-it-quali-solare { margin:12px 12px 0; }
    #page-boiler .dm-st-scene { height:auto; aspect-ratio:${PORTRAIT.w} / ${PORTRAIT.h}; }
    #page-boiler .dm-st-live { left:12px; right:12px; top:auto; bottom:12px; justify-content:center; font-size:9.5px; padding:7px 12px 7px 10px; }
    #page-boiler .dm-st-plant > .dm-st-tap-tag { display:none; }
    ${placeRules(PORTRAIT)}
    #page-boiler .dm-st-plant > .syn-solar-content,
    #page-boiler .dm-st-plant .probe { min-width:calc(var(--k) * 98); min-height:calc(var(--k) * 46); }
    #page-boiler .dm-st-plant .probe { max-width:calc(var(--k) * 128); padding-right:calc(var(--k) * 8); }
    #page-boiler .dm-st-plant .dm-st-probe-tag { letter-spacing:.3px; }
    #page-boiler .dm-st-plant > [data-dm-st-kpi="press"],
    #page-boiler .dm-st-plant > [data-dm-st-kpi="power"] { min-width:calc(var(--k) * 178); }
    #page-boiler .dm-st-plant > [data-dm-st-kpi="delta"] { transform:translate(-30%, -50%); }
    #page-boiler .dm-st-plant .syn-pump .lbl,
    #page-boiler .dm-st-plant .syn-valve .lbl { letter-spacing:.4px; }
    #page-boiler .dm-st-plant #syn-v-chiave .lbl { left:auto; right:-6px; transform:none; top:calc(100% + var(--k) * 10); }
    #page-boiler .dm-st-plant #syn-p-ricircolo .lbl { left:auto; right:0; top:calc(100% + var(--k) * 66); transform:none; }
    /* Three to a row; the name on top, its state under it. */
    #page-boiler .b-controls-grid { grid-template-columns:repeat(3, minmax(0, 1fr)); gap:6px; padding:10px 12px 12px; }
    #page-boiler .b-btn { flex-direction:column; align-items:flex-start; gap:3px; padding:7px 10px 8px; border-radius:14px; }
    #page-boiler .b-btn .icon { display:none; }
    #page-boiler .b-btn .lbl { width:100%; font-size:11px; }
    #page-boiler .b-btn .state { font-size:8px; padding:1px 6px; }
  }

  @media (prefers-reduced-motion: reduce) {
    #page-boiler .syn-flow.active,
    #page-boiler .syn-pump.active .anim-icon,
    #page-boiler .dm-st-scene > .syn-safety-alert.active,
    #page-boiler .dm-st-live::before,
    #page-boiler .b-btn.active .spin-active,
    #page-boiler .b-btn.active .blink-active { animation:none !important; }
  }
  `;
}

/* ───────── the artwork ───────── */

const poly = (pts) => pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ");
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

function defsMarkup() {
  return `<filter id="dm-st-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="dm-st-soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="dm-st-drop" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#0f172a" flood-opacity=".18"/></filter>
  <radialGradient id="dm-st-sun"><stop offset="0" stop-color="#fde68a" stop-opacity=".95"/><stop offset=".35" stop-color="#fbbf24" stop-opacity=".55"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient>
  <linearGradient id="dm-st-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#244b7a"/><stop offset=".55" stop-color="#0f2744"/><stop offset="1" stop-color="#16345c"/></linearGradient>
  <linearGradient id="dm-st-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".35" stop-color="#fff" stop-opacity=".06"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset=".78" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="dm-st-jacket" x1="0" x2="1"><stop offset="0" style="stop-color:var(--st-j0)"/><stop offset=".28" style="stop-color:var(--st-j1)"/><stop offset=".6" style="stop-color:var(--st-j2)"/><stop offset="1" style="stop-color:var(--st-j3)"/></linearGradient>
  <linearGradient id="dm-st-strat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--tank-top, #ef4444)"/><stop offset=".5" style="stop-color:color-mix(in srgb, var(--tank-top, #ef4444), var(--tank-bottom, #3b82f6))"/><stop offset="1" style="stop-color:var(--tank-bottom, #3b82f6)"/></linearGradient>
  <linearGradient id="dm-st-win" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".3" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>`;
}

function backMarkup(L) {
  const [x, y, r] = L.sun;
  return `<circle class="dm-st-sun" cx="${x}" cy="${y}" r="${r}" fill="url(#dm-st-sun)"/>`;
}

function frontMarkup(L) {
  const P = L.panel;
  const TL = [P.x, P.y + P.s];
  const TR = [P.x + P.w, P.y];
  const BR = [P.x + P.w + P.d, P.y + P.h];
  const BL = [P.x + P.d, P.y + P.h + P.s];
  const centre = [(TL[0] + BR[0]) / 2, (TL[1] + BR[1]) / 2];
  const inset = L.name === "portrait" ? 0.07 : 0.06;
  const [iTL, iTR, iBR, iBL] = [TL, TR, BR, BL].map((p) => lerp(p, centre, inset));
  const legs = L.name === "portrait" ? [20, 24] : [34, 40];
  const a = lerp(BL, BR, 0.2);
  const b = lerp(BL, BR, 0.8);
  let collector = `<g data-dm-st-art="collector">`;
  collector += `<path class="dm-st-stand" d="M ${a[0]} ${a[1]} L ${BL[0] + 30} ${BL[1] + legs[0]} M ${b[0]} ${b[1]} L ${BR[0] - 10} ${BR[1] + legs[1]}"/>`;
  collector += `<g filter="url(#dm-st-drop)"><polygon class="dm-st-frame" points="${poly([TL, TR, BR, BL])}"/></g>`;
  collector += `<polygon points="${poly([iTL, iTR, iBR, iBL])}" fill="url(#dm-st-glass)"/>`;
  for (let i = 1; i < 12; i += 1) {
    const top = lerp(iTL, iTR, i / 12);
    const bottom = lerp(iBL, iBR, i / 12);
    collector += `<line class="dm-st-riser" x1="${top[0].toFixed(1)}" y1="${top[1].toFixed(1)}" x2="${bottom[0].toFixed(1)}" y2="${bottom[1].toFixed(1)}"/>`;
  }
  for (const k of [0.08, 0.92]) {
    const left = lerp(iTL, iBL, k);
    const right = lerp(iTR, iBR, k);
    collector += `<line class="dm-st-manifold" x1="${left[0].toFixed(1)}" y1="${left[1].toFixed(1)}" x2="${right[0].toFixed(1)}" y2="${right[1].toFixed(1)}"/>`;
  }
  collector += `<polygon points="${poly([iTL, iTR, iBR, iBL])}" fill="url(#dm-st-sheen)"/>`;
  collector += `<polygon class="dm-st-rim" points="${poly([iTL, iTR, iBR, iBL])}"/></g>`;

  const T = L.tank;
  const tx = T.cx - T.w / 2;
  const ry = T.w * 0.16;
  const wx = T.cx - T.w * 0.26;
  const ww = T.w * 0.52;
  const wy = T.top + ry + 14;
  const wh = T.h - ry - 26;
  let tank = `<g data-dm-st-art="tank">`;
  tank += `<ellipse class="dm-st-tank-shadow" cx="${T.cx}" cy="${T.top + T.h + 6}" rx="${T.w * 0.62}" ry="${ry * 0.9}" filter="url(#dm-st-soft)"/>`;
  tank += `<path class="dm-st-tank-body" d="M ${tx} ${T.top} L ${tx} ${T.top + T.h} A ${T.w / 2} ${ry} 0 0 0 ${tx + T.w} ${T.top + T.h} L ${tx + T.w} ${T.top} Z"/>`;
  tank += `<ellipse class="dm-st-tank-cap" cx="${T.cx}" cy="${T.top}" rx="${T.w / 2}" ry="${ry}"/>`;
  tank += `<rect class="dm-st-tank-window" x="${wx - 4}" y="${wy - 4}" width="${ww + 8}" height="${wh + 8}" rx="${ww / 2 + 4}"/>`;
  tank += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="${ww / 2}" fill="url(#dm-st-strat)" opacity=".25" filter="url(#dm-st-soft)"/>`;
  tank += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="${ww / 2}" fill="url(#dm-st-strat)"/>`;
  let coil = `M ${wx + 8} ${wy + wh * 0.4}`;
  for (let i = 0; i < 5; i += 1) {
    const y = wy + wh * (0.4 + i * 0.1);
    coil += ` Q ${T.cx} ${y + wh * 0.05}, ${wx + ww - 8} ${y} Q ${T.cx} ${y + wh * 0.055}, ${wx + 8} ${y + wh * 0.1}`;
  }
  tank += `<path class="dm-st-coil" d="${coil}"/>`;
  tank += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="${ww / 2}" fill="url(#dm-st-win)"/></g>`;

  let tap = "";
  if (L.tap) {
    const [x, y] = L.tap;
    tap = `<g data-dm-st-art="tap" filter="url(#dm-st-drop)"><circle class="dm-st-tap-disc" cx="${x}" cy="${y}" r="24"/><text x="${x}" y="${y + 7}" text-anchor="middle" font-size="20">🚿</text></g>`;
  }

  let leads = "";
  for (const [name, [x1, y1, x2, y2]] of Object.entries(L.leaders)) {
    leads += `<g data-dm-st-art="lead-${name}"><path class="dm-st-lead" d="M ${x1} ${y1} L ${x2} ${y2}" fill="none"/><circle class="dm-st-lead-dot" cx="${x2}" cy="${y2}" r="4"/></g>`;
  }
  return collector + tank + tap + leads;
}

function svgGroup(svg, cls, where) {
  let group = svg.querySelector(`:scope > g.${cls}`);
  if (!group) {
    group = doc.createElementNS(SVG_NS, "g");
    group.setAttribute("class", cls);
    if (where === "start") svg.prepend(group);
    else svg.append(group);
  }
  return group;
}

/** Draw the artwork around the legacy pipes, once per layout. */
function drawArt(svg, layout) {
  const defs = svgGroup(svg, "dm-st-defs", "start");
  if (!defs.firstChild) {
    const node = doc.createElementNS(SVG_NS, "defs");
    node.innerHTML = defsMarkup();
    defs.append(node);
  }
  const back = svgGroup(svg, "dm-st-back", "start");
  if (back.previousElementSibling !== defs) defs.after(back);
  const front = svgGroup(svg, "dm-st-front", "end");
  if (svg.lastElementChild !== front) svg.append(front);
  if (svg.dataset.dmStLayout === layout.name && front.firstChild) return;
  svg.dataset.dmStLayout = layout.name;
  back.innerHTML = backMarkup(layout);
  front.innerHTML = frontMarkup(layout);
}

/* ───────── DOM wiring ───────── */

function element(tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) scriviTestoSeCambia(node, text);
  return node;
}

function markNodes() {
  const panel = doc.querySelector("#page-boiler .syn-solar-panel");
  const tank = doc.querySelector("#page-boiler .syn-tank");
  panel?.closest(".syn-node-boiler")?.classList.add("dm-st-node-collector");
  tank?.closest(".syn-node-boiler")?.classList.add("dm-st-node-tank");
  const cards = doc.querySelectorAll("#page-boiler .boiler-stats-row > .b-stat-card");
  cards.forEach((card, index) => {
    if (!card.dataset.dmStKpi && KPI_ORDER[index]) card.dataset.dmStKpi = KPI_ORDER[index];
  });
  const probes = doc.querySelectorAll("#page-boiler .tank-probes .probe");
  probes.forEach((probe, index) => {
    if (!probe.dataset.dmStProbe) probe.dataset.dmStProbe = index === 0 ? "alto" : "basso";
  });
}

/**
 * The stage becomes the scene: a sky with the plant box in the middle. The
 * legacy hardware, the readouts and the three statistics cards move into the
 * plant box; the live pill and the safety banner stay on the scene frame.
 */
function buildStage() {
  const stage = doc.querySelector("#page-boiler .synoptic-stage");
  if (!stage) return;
  let scene = stage.querySelector(":scope > .dm-st-scene");
  if (!scene) {
    scene = element("div", "dm-st-scene");
    stage.prepend(scene);
  }
  let plant = scene.querySelector(":scope > .dm-st-plant");
  if (!plant) {
    plant = element("div", "dm-st-plant");
    scene.prepend(plant);
  }
  for (const node of [...stage.children]) {
    if (node !== scene) scene.append(node);
  }
  for (const node of [...scene.children]) {
    if (node === plant || node.classList.contains("syn-safety-alert")) continue;
    if (node.classList.contains("dm-st-live")) continue;
    plant.append(node);
  }

  const live = doc.querySelector("#page-boiler .dm-st-live") || element("div", "dm-st-live");
  if (live.parentElement !== scene) scene.append(live);

  const readout = doc.querySelector("#page-boiler .syn-solar-content");
  if (readout && readout.parentElement !== plant) plant.append(readout);
  const probes = doc.querySelector("#page-boiler .tank-probes");
  if (probes && probes.parentElement !== plant) plant.append(probes);
  for (const card of doc.querySelectorAll("#page-boiler .b-stat-card[data-dm-st-kpi]")) {
    if (card.parentElement !== plant) plant.append(card);
  }

  let tag = plant.querySelector(":scope > .dm-st-tap-tag");
  if (!tag) {
    tag = element("div", "dm-st-tap-tag");
    plant.append(tag);
  }
  scriviTestoSeCambia(tag, t("Acqua calda", "Hot water"));
}

function buildPumps() {
  for (const [id, label] of PUMP_LABELS) {
    const pump = doc.getElementById(id);
    if (!pump || pump.querySelector(".icon")) continue;
    const icon = element("div", "icon");
    icon.append(element("span", "anim-icon dm-st-rotor"));
    pump.append(icon, element("div", "lbl", label()));
  }
}

function nameValve() {
  const valve = doc.getElementById("syn-v-chiave");
  if (!valve || valve.querySelector(".lbl")) return;
  valve.append(element("div", "lbl", t("Chiave solare", "Solar valve")));
}

function captionProbes() {
  const captions = {
    alto: () => t("Accumulo alto", "Tank top"),
    basso: () => t("Accumulo basso", "Tank bottom"),
  };
  for (const probe of doc.querySelectorAll("#page-boiler .probe[data-dm-st-probe]")) {
    let tag = probe.querySelector(".dm-st-probe-tag");
    if (!tag) {
      tag = element("span", "dm-st-probe-tag");
      probe.prepend(tag);
    }
    scriviTestoSeCambia(tag, captions[probe.dataset.dmStProbe]());
  }
}

/** The pressure card gets a small manometer, needle on the reading. */
function pressureGauge() {
  const card = doc.querySelector('#page-boiler [data-dm-st-kpi="press"]');
  if (!card) return;
  if (!card.querySelector(".dm-st-gauge")) {
    card.prepend(element("span", "dm-st-gauge"), element("span", "dm-st-needle"));
  }
  const text = doc.getElementById("syn-v-press")?.textContent || "";
  const bar = Number.parseFloat(text.replace(",", "."));
  const known = Number.isFinite(bar);
  const turn = known ? (240 * Math.max(0, Math.min(PRESSIONE_NORMA.fondo, bar))) / PRESSIONE_NORMA.fondo : 0;
  const colour = comeStaLaPressione(known ? bar : null) === "norma" ? "#22c55e" : "#ef4444";
  const angle = `${turn.toFixed(1)}deg`;
  if (card.style.getPropertyValue("--dm-st-press") !== angle) card.style.setProperty("--dm-st-press", angle);
  if (card.style.getPropertyValue("--dm-st-gauge") !== colour) card.style.setProperty("--dm-st-gauge", colour);
}

function routePipes(layout) {
  const svg = doc.querySelector("#page-boiler .syn-svg");
  if (!svg) return;
  const box = `0 0 ${layout.w} ${layout.h}`;
  if (svg.getAttribute("viewBox") !== box) svg.setAttribute("viewBox", box);
  if (svg.getAttribute("preserveAspectRatio") !== "none") svg.setAttribute("preserveAspectRatio", "none");
  drawArt(svg, layout);

  for (const [id, route] of Object.entries(layout.routes)) {
    const flow = doc.getElementById(id);
    if (!flow) continue;
    const tag = `dm-st-run-${RUNS[id]}`;
    const body = flow.previousElementSibling?.classList.contains("syn-pipe-inner")
      ? flow.previousElementSibling
      : null;
    // The highlight sits between the pipe body and the light.
    let highlight = body?.nextElementSibling;
    if (body && !highlight?.classList?.contains("dm-st-pipe-hi")) {
      highlight = doc.createElementNS(SVG_NS, "path");
      highlight.setAttribute("class", "dm-st-pipe-hi");
      body.after(highlight);
    }
    const run = [flow];
    let sibling = flow.previousElementSibling;
    while (
      sibling &&
      (sibling.classList.contains("syn-pipe-inner") ||
        sibling.classList.contains("syn-pipe-bg") ||
        sibling.classList.contains("dm-st-pipe-hi"))
    ) {
      run.push(sibling);
      sibling = sibling.previousElementSibling;
    }
    for (const path of run) {
      if (path.getAttribute("d") !== route) path.setAttribute("d", route);
      if (!path.classList.contains(tag)) path.classList.add(tag);
      if (path.hasAttribute("vector-effect")) path.removeAttribute("vector-effect");
    }
  }
}

function nameButtons() {
  for (const [id, label] of BUTTON_LABELS) {
    const button = doc.getElementById(id);
    if (!button) continue;
    let node = button.querySelector(".lbl");
    if (!node) {
      node = element("div", "lbl");
      const stateNode = button.querySelector(".state");
      if (stateNode) button.insertBefore(node, stateNode);
      else button.append(node);
    }
    scriviTestoSeCambia(node, label());
  }
}

function buildHeader() {
  const header = doc.querySelector("#page-boiler .boiler-header");
  if (!header || header.querySelector(".dm-st-sub")) return;
  header.append(
    element(
      "div",
      "dm-st-sub",
      t(
        "Circuito primario · Boiler · Ricircolo sanitario",
        "Primary loop · Tank · DHW recirculation",
      ),
    ),
  );
}

/**
 * The runtime hides any element whose onclick names only unmapped entities
 * (`cdAutoHide`), symmetrically, so cards come back once mapped. What this
 * module adds follows: a hidden collector takes its click target with it, a
 * readout with nothing to read goes too, and the drawing follows through the
 * :has() rules in the sheet.
 */
function mirrorRuntimeVisibility() {
  const hidden = (node) => node?.style.display === "none";
  const collector = doc.querySelector("#page-boiler .dm-st-node-collector");
  const panel = doc.querySelector("#page-boiler .syn-solar-panel");
  if (collector && panel) collector.style.display = hidden(panel) ? "none" : "";
  const readout = doc.querySelector("#page-boiler .syn-solar-content");
  const reading = doc.getElementById("syn-v-pannello");
  if (readout && reading) readout.style.display = hidden(reading) ? "none" : "";
}

function currentLayout() {
  return state.query?.matches ? PORTRAIT : LANDSCAPE;
}

function decorate() {
  if (!doc?.getElementById("page-boiler")) return false;
  buildHeader();
  markNodes();
  buildStage();
  buildPumps();
  nameValve();
  captionProbes();
  pressureGauge();
  routePipes(currentLayout());
  nameButtons();
  mirrorRuntimeVisibility();
  return true;
}

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      decorate();
    }) || 0;
  if (!state.frame) decorate();
}

export function installSolarThermalDesignSection() {
  installStyle(STYLE_ID, stylesheet());
  /* The live-state words sit in `content:`, where no text node exists for the
   * translation pass to find; the sheet is rebuilt when the language changes,
   * and the captions with it. */
  restyleOnLocaleChange(STYLE_ID, () => {
    schedule();
    return stylesheet();
  });
  state.query ||= root.matchMedia?.(PORTRAIT_QUERY) || null;
  decorate();
  if (state.installed) return true;
  state.installed = true;
  // The portrait drawing swaps in on a media-query event, never on a timer.
  state.query?.addEventListener?.("change", schedule);
  /* Solo `render`: `renderBoiler` e `renderSolarThermal` non esistono in
   * nessun guscio — sono due nomi che il registro delle sezioni legacy prova,
   * non due funzioni — e avvolgerli non agganciava niente. */
  wrapFunction("render", "__dmSolarThermalDesign_render", schedule);
  return true;
}
