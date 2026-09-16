/* Le due copertine di Facebook.
 *
 * Fanno vedere una cosa sola, e in un colpo: **la stessa casa su tutti e tre
 * gli schermi**. Chi vede gdahome per la prima volta pensa a un'app da
 * telefono; il computer e il tablet non se li immagina, e a dirglielo a parole
 * non ci crede. Percio' qui non c'e' scritto «va su tutti i dispositivi»: ci
 * sono i tre dispositivi, con sopra la plancia com'e' davvero su ognuno —
 * quattro colonne e il menu aperto di fianco sul computer, tre sul tablet, due
 * sul telefono.
 *
 * Quale delle due si disegna lo dice l'indirizzo — `copertine.html?tipo=gruppo`
 * — e quello che cambia non e' il disegno ma **dove Facebook taglia**:
 *
 * - il **gruppo** e' 1640×856: sul telefono si accorcia, e in fondo ci finisce
 *   sopra il nome del gruppo. Percio' le parole stanno in alto e gli schermi
 *   sotto, dove al massimo si perde un pezzo di cornice.
 * - la **pagina** e' 1640×624: sul telefono se ne vede solo la parte in mezzo,
 *   due terzi scarsi — da 279 a 1361 — e in basso a sinistra, sul computer, ci
 *   sta sopra la foto del profilo. Percio' e' tutto in mezzo, e gli schermi
 *   cominciano piu' a destra di dove arriva quella foto.
 */

import {
  computer,
  MARCHIO,
  mettiInScena,
  plancia,
  planciaLarga,
  segno,
  tavoletta,
  telefono,
} from "./pezzi.js";

const misure = new URLSearchParams(location.search);
const quale = misure.get("tipo") || "gruppo";
document.documentElement.style.setProperty("--alto", `${misure.get("alto") || 856}px`);

const SCENE = [];

/* L'alone dietro gli schermi: senza, i tre stanno appiccicati sul fondo
   scuro; con, sembrano poggiati su qualcosa. */
const alone = (x, y, largo, alto) => `
  <div style="position:absolute;left:${x}px;top:${y}px;width:${largo}px;height:${alto}px;
              background:radial-gradient(closest-side,rgba(14,165,233,.42),rgba(56,189,248,.12) 55%,rgba(14,165,233,0));
              filter:blur(6px)"></div>`;

/* L'ombra sotto: senza, i tre schermi galleggiano sul fondo; con, poggiano. */
const ombra = (x, y, largo) => `
  <div style="position:absolute;left:${x}px;top:${y}px;width:${largo}px;height:46px;border-radius:50%;
              background:radial-gradient(closest-side,rgba(0,0,0,.6),rgba(0,0,0,0));filter:blur(10px)"></div>`;

const pastiglia = (testo, disegno, tinta) => `
  <span class="vetro" style="border-color:${tinta}66;color:${tinta}">${disegno} ${testo}</span>`;

const LE_PASTIGLIE = `
  ${pastiglia("Tutto gratis", segno("spunta", 24, "#86efac"), "#86efac")}
  ${pastiglia("Su Google Play dal 30 settembre", segno("calendario", 22, "#fcd34d"), "#fcd34d")}`;

/* I tre schermi, con sopra la plancia che gli tocca. */
const IL_COMPUTER = (scala) =>
  computer({
    largo: 700,
    alto: 438,
    scala,
    dentro: planciaLarga({ colonne: 4, quante: 12, menu: true }),
  });

/* Il tablet si disegna grande — quattrocentoventi per cinquecentosessanta, le
 * proporzioni vere — e poi lo si guarda da lontano. Disegnarlo piccolo voleva
 * dire tessere strette un terzo, e «3 accese» che andava a capo dentro una
 * tessera alta come le altre: usciva dal bordo di sotto. */
const IL_TABLET = (scala) =>
  tavoletta({
    largo: 420,
    alto: 560,
    scala,
    dentro: planciaLarga({ colonne: 3, quante: 12 }),
  });

const IL_TELEFONO = (scala) => telefono({ scala, dentro: plancia() });

/* ══ La copertina del gruppo: 1640×856 ═════════════════════════════════ */

if (quale === "gruppo") {
  SCENE.push({
    nome: "gruppo",
    durata: 1,
    contenuto: () => `
      <div style="position:absolute;left:0;right:0;top:38px;text-align:center">
        <div style="display:flex;align-items:center;justify-content:center;gap:20px">
          <img src="${MARCHIO}" width="74" height="74" style="border-radius:18px" alt="" />
          <h1 class="nome" style="font-size:66px">gdahome</h1>
        </div>
        <p class="motto" style="font-size:46px;margin-top:20px;font-weight:800;letter-spacing:-.025em">
          La tua casa, <b>su ogni schermo</b>
        </p>
        <p class="motto" style="font-size:26px;margin-top:12px;font-weight:500;color:#9db0cc">
          Telefono, tablet e computer: la stessa plancia, per tutta la casa.
        </p>
        <div class="pastiglie" style="justify-content:center;margin-top:20px">${LE_PASTIGLIE}</div>
      </div>

      ${alone(400, 320, 860, 530)}
      ${ombra(190, 806, 1250)}
      <div style="position:absolute;left:502px;top:342px">${IL_COMPUTER(1)}</div>
      <div style="position:absolute;left:158px;top:348px;z-index:2">${IL_TABLET(0.86)}</div>
      <div style="position:absolute;left:1222px;top:334px;z-index:2">${IL_TELEFONO(0.78)}</div>`,
  });
}

/* ══ La copertina della pagina: 1640×624 ═══════════════════════════════ */

if (quale === "pagina") {
  SCENE.push({
    nome: "pagina",
    durata: 1,
    contenuto: () => `
      <div style="position:absolute;left:0;right:0;top:32px;text-align:center">
        <div style="display:flex;align-items:center;justify-content:center;gap:16px">
          <img src="${MARCHIO}" width="56" height="56" style="border-radius:14px" alt="" />
          <h1 class="nome" style="font-size:52px">gdahome</h1>
        </div>
        <p class="motto" style="font-size:34px;margin-top:14px;font-weight:800;letter-spacing:-.02em">
          La tua casa, <b>su ogni schermo</b>
        </p>
        <div class="pastiglie" style="justify-content:center;margin-top:14px;gap:12px">
          <span class="vetro" style="font-size:22px;padding:12px 20px;border-color:#86efac66;color:#86efac">
            ${segno("spunta", 21, "#86efac")} Tutto gratis
          </span>
          <span class="vetro" style="font-size:22px;padding:12px 20px;border-color:#fcd34d66;color:#fcd34d">
            ${segno("calendario", 19, "#fcd34d")} Su Google Play dal 30 settembre
          </span>
        </div>
      </div>

      ${alone(560, 250, 720, 400)}
      ${ombra(400, 596, 950)}
      <div style="position:absolute;left:666px;top:269px">${IL_COMPUTER(0.72)}</div>
      <div style="position:absolute;left:410px;top:273px;z-index:2">${IL_TABLET(0.62)}</div>
      <div style="position:absolute;left:1180px;top:289px;z-index:2">${IL_TELEFONO(0.52)}</div>`,
  });
}

mettiInScena(SCENE);
