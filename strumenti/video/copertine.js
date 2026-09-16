/* Le due copertine di Facebook.
 *
 * Quale delle due si disegna lo dice l'indirizzo — `copertine.html?tipo=gruppo`
 * — e quello che cambia non e' l'aspetto ma **dove Facebook taglia**:
 *
 * - il **gruppo** e' 1640×856 e si perde soprattutto in basso, dove sul
 *   telefono ci finisce sopra il nome del gruppo;
 * - la **pagina** e' 1640×624 e sul telefono se ne vede solo la parte in
 *   mezzo, due terzi scarsi della larghezza; in basso a sinistra, sul
 *   computer, ci sta sopra la foto del profilo.
 *
 * Quindi la pagina ha tutto in mezzo e niente ai lati, e il gruppo puo'
 * permettersi il telefono di fianco.
 */

import { MARCHIO, mettiInScena, oggetto, plancia, segno, telefono } from "./pezzi.js";

const misure = new URLSearchParams(location.search);
const quale = misure.get("tipo") || "gruppo";
document.documentElement.style.setProperty("--alto", `${misure.get("alto") || 856}px`);

const SCENE = [];

const firma = (lato, nome) => `
  <div class="firma">
    <img src="${MARCHIO}" width="${lato}" height="${lato}" style="border-radius:${Math.round(lato * 0.23)}px" alt="" />
    <h1 class="nome">gdahome</h1>
  </div>`;

const pastiglie = `
  <div class="pastiglie">
    <span class="vetro">${segno("ponte", 24, "#7dd3fc")} Un add-on di Home Assistant</span>
    <span class="vetro verde">${segno("spunta", 24, "#86efac")} Tutto gratis</span>
    <span class="vetro ambra">${segno("calendario", 22, "#fcd34d")} Su Google Play dal 30 settembre</span>
  </div>`;

/* Il contorno della copertina della pagina: i disegni della plancia, senza
   parole. Stanno **fuori** dalla parte che si vede sul telefono, ed e' apposta:
   li' ci va solo roba che si puo' perdere. Senza parole perche' una parola
   tagliata a meta' non sembra un contorno, sembra un errore — e con la parola
   accanto era quello che succedeva. */
const contorno = (dove, quali) => `
  <div class="contorno" style="${dove}">
    ${quali
      .map(
        (nome) =>
          `<div class="vetro" style="width:84px;height:84px;border-radius:26px;display:grid;place-items:center;padding:0">${oggetto(nome, 44)}</div>`,
      )
      .join("")}
  </div>`;

/* ══ La copertina del gruppo: 1640×856 ═════════════════════════════════ */

if (quale === "gruppo") {
  SCENE.push({
    nome: "gruppo",
    durata: 1,
    contenuto: () => `
      <div class="dentro" style="padding:0 96px 84px">
        <div style="width:880px">
          ${firma(126)}
          <p class="motto">La casa in una plancia.<br /><b>Sul telefono.</b></p>
          ${pastiglie}
        </div>
      </div>
      ${telefono({ x: 1132, y: 62, scala: 1.14, dentro: plancia() })}`,
  });
}

/* ══ La copertina della pagina: 1640×624 ═══════════════════════════════
 *
 * Tutto in mezzo. Sul telefono di questa striscia si vede solo la parte
 * centrale — da 279 a 1361 — e in basso a sinistra, sul computer, ci sta
 * sopra la foto del profilo: li' non ci va niente. */

if (quale === "pagina") {
  SCENE.push({
    nome: "pagina",
    durata: 1,
    contenuto: () => `
      ${contorno("left:74px;top:132px", ["luci", "clima", "energia"])}
      ${contorno("right:74px;top:132px", ["sicurezza", "telecamere", "tapparelle"])}

      <div class="dentro" style="justify-content:center;padding-bottom:12px">
        <div style="width:1040px;text-align:center">
          <div style="display:flex;justify-content:center">${firma(104)}</div>
          <p class="motto" style="font-size:36px">La casa in una plancia. <b>Sul telefono.</b></p>
          <div class="pastiglie" style="justify-content:center;margin-top:26px;font-size:23px">
            <span class="vetro" style="font-size:23px;padding:13px 22px">${segno("ponte", 22, "#7dd3fc")} Per Home Assistant</span>
            <span class="vetro verde" style="font-size:23px;padding:13px 22px">${segno("spunta", 22, "#86efac")} Tutto gratis</span>
            <span class="vetro ambra" style="font-size:23px;padding:13px 22px">${segno("calendario", 20, "#fcd34d")} Su Google Play dal 30 settembre</span>
          </div>
        </div>
      </div>`,
  });
}

mettiInScena(SCENE);
