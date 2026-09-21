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

import { computer, MARCHIO, mettiInScena, segno, t, tavoletta, telefono } from "./pezzi.js";

const misure = new URLSearchParams(location.search);
const quale = misure.get("tipo") || "gruppo";
document.documentElement.style.setProperty("--largo", `${misure.get("largo") || 1640}px`);
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
  ${pastiglia(t("Tutto gratis", "All free"), segno("spunta", 24, "#86efac"), "#86efac")}
  ${pastiglia(t("Su Google Play dal 30 settembre", "On Google Play from 30 September"), segno("calendario", 22, "#fcd34d"), "#fcd34d")}`;

/* I tre schermi, e dentro **la plancia vera**.
 *
 * Non una ricostruzione: le tre fotografie le fa `plancia-vera.mjs`, aprendo
 * in un Chromium la pagina di DashboardModern che sta in `ponte/plancia/` —
 * quella che l'add-on serve davvero — con dietro una casa finta che le
 * risponde come le risponderebbe Home Assistant. La plancia si configura da
 * sola col suo 🪄, e quello che si vede e' quello che vede chi ce l'ha.
 *
 * Le cornici hanno le proporzioni delle fotografie, non le loro: una
 * fotografia dentro una cornice con un'altra forma o si stira o si taglia, e
 * tagliare vuol dire perdere la barra in fondo, che e' meta' di quello che
 * fa vedere che e' un'app.
 *
 *   telefono  390×844   → schermo 292×632
 *   tablet    820×1180  → schermo 400×576
 *   computer 1440×900   → schermo 700×438
 */
const dentroLoSchermo = (quale) =>
  `<img src="${t(`plancia-${quale}`, `plancia-${quale}-en`)}.png" alt="" style="display:block;width:100%;height:100%;object-fit:fill" />`;

const IL_COMPUTER = (scala) =>
  computer({ largo: 700, alto: 438, scala, dentro: dentroLoSchermo("computer") });

const IL_TABLET = (scala) =>
  tavoletta({ largo: 428, alto: 604, scala, dentro: dentroLoSchermo("tablet") });

const IL_TELEFONO = (scala) =>
  telefono({ scala, alto: 654, barra: false, dentro: dentroLoSchermo("telefono") });

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
          ${t("La tua casa, <b>su ogni schermo</b>", "Your home, <b>on every screen</b>")}
        </p>
        <p class="motto" style="font-size:26px;margin-top:12px;font-weight:500;color:#9db0cc">
          ${t(
            "Telefono, tablet e computer: la stessa plancia, per tutta la casa.",
            "Phone, tablet and computer: the same dashboard, for the whole house.",
          )}
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
          ${t("La tua casa, <b>su ogni schermo</b>", "Your home, <b>on every screen</b>")}
        </p>
        <div class="pastiglie" style="justify-content:center;margin-top:14px;gap:12px">
          <span class="vetro" style="font-size:22px;padding:12px 20px;border-color:#86efac66;color:#86efac">
            ${segno("spunta", 21, "#86efac")} ${t("Tutto gratis", "All free")}
          </span>
          <span class="vetro" style="font-size:22px;padding:12px 20px;border-color:#fcd34d66;color:#fcd34d">
            ${segno("calendario", 19, "#fcd34d")} ${t("Su Google Play dal 30 settembre", "On Google Play from 30 September")}
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

/* ══ L'immagine del profilo: 1080×1080, e dentro un cerchio ════════════
 *
 * Facebook la mostra **tonda**, e piccola: sulla pagina e' un francobollo
 * accanto al nome. Percio' qui non c'e' scritto niente — un motto in un
 * cerchio da centosettanta pixel non lo legge nessuno — c'e' il marchio e
 * basta, tenuto dentro il cerchio inscritto con aria intorno, cosi' il
 * ritaglio non morde mai un angolo.
 *
 * E' l'unica immagine senza parole: non ha una versione inglese perche' non
 * ne ha bisogno.
 */
if (quale === "profilo") {
  SCENE.push({
    nome: "profilo",
    durata: 1,
    contenuto: () => `
      ${alone(140, 130, 800, 800)}
      <div style="position:absolute;inset:0;display:grid;place-items:center">
        <img src="${MARCHIO}" width="700" height="700" alt=""
             style="border-radius:174px;box-shadow:0 42px 90px rgba(0,0,0,.6),0 0 0 2px rgba(255,255,255,.1)" />
      </div>`,
  });
}

mettiInScena(SCENE);
