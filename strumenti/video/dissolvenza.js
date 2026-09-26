/* Il film fatto di carte che si sciolgono l'una nell'altra.
 *
 * Non e' un film di scene che si sostituiscono: e' **una scena sola** con le
 * carte una sopra l'altra, e a passare da una all'altra e' l'opacita'. Cosi'
 * la dissolvenza e' vera — mentre una svanisce l'altra sta gia' comparendo —
 * invece di essere un buio in mezzo.
 *
 * Chi scrive un film di questi (`novita.js`, `gdanav.js`) mette solo la lista
 * delle carte: per ognuna quanto resta su e cosa c'e' dentro. I tempi li conta
 * questo, e non si scrivono a mano — cambiare la durata di una carta in mezzo
 * sposterebbe tutte quelle dopo.
 */

import { MARCHIO, STILI } from "./pezzi.js";

/* Quanto dura una dissolvenza, e di quanto le due carte si sovrappongono.
 *
 * Mezzo secondo e' la misura che si sente come «sfuma» invece che come
 * «cambia»; un terzo di sovrapposizione e' quello che toglie il buio in mezzo
 * senza che le due scritte si leggano insieme. */
const DISSOLVENZA = 0.55;
const SOVRAPPOSTE = 0.3;

/* Il respiro: la carta cresce di un filo mentre sta su. Fermo, un testo grande
   sembra una diapositiva; cosi' sembra ripreso. */
STILI.push(`@keyframes respiro{from{transform:scale(1)}to{transform:scale(1.045)}}`);

/* La barra che avanza: quanto manca alla fine, senza numeri. */
STILI.push(`@keyframes avanza{from{width:0}to{width:100%}}`);

/* Il palco, come per i social: quadrato per il feed, in piedi per TikTok, e
   l'aria da lasciare sopra e sotto dove il negozio ci mette la sua roba. */
export function misuraIlPalco() {
  const misure = new URLSearchParams(location.search);
  const dimmi = (nome, difetto) => misure.get(nome) ?? difetto;
  const radice = document.documentElement.style;
  radice.setProperty("--alto", `${dimmi("alto", 1920)}px`);
  radice.setProperty("--su", `${dimmi("su", 90)}px`);
  radice.setProperty("--giu", `${dimmi("giu", 90)}px`);
}

/* Le carte, una sopra l'altra, coi loro tempi.
 *
 * `testata` e' quello che resta fermo in cima per tutto il film — il nome di
 * quello di cui si sta parlando — e `marchio` il segno che gli sta accanto,
 * che non e' sempre quello di gdahome. Non compare sulla prima carta ne' sull'ultima:
 * li' c'e' gia' in mezzo allo schermo, e ripeterlo sarebbe dirlo due volte
 * nello stesso fotogramma.
 */
export function inDissolvenza(CARTE, { testata, marchio = MARCHIO }) {
  let orologio = 0;
  const contenuto = CARTE.map(({ resta, dentro }) => {
    const da = orologio;
    const viaA = da + DISSOLVENZA + resta;
    orologio = viaA + DISSOLVENZA - SOVRAPPOSTE;
    return `
    <div class="carta-film" style="
         opacity:0;
         animation:appari ${DISSOLVENZA}s ${da}s ease both,
                   sparisci ${DISSOLVENZA}s ${viaA}s ease forwards,
                   respiro ${(viaA - da + DISSOLVENZA).toFixed(2)}s ${da}s linear both">
      ${dentro()}
    </div>`;
  }).join("");

  /* Un attimo di coda dopo l'ultima dissolvenza: un film che finisce
     sull'ultimo fotogramma della sfumatura sembra tagliato. */
  const durata = Number((orologio + SOVRAPPOSTE + 0.4).toFixed(2));

  const entra = Number((CARTE[0].resta + DISSOLVENZA).toFixed(2));
  const esce = Number((durata - CARTE[CARTE.length - 1].resta - 1).toFixed(2));

  const cornice = `
  <div class="testata ap via" style="--t:${entra}s;--t2:${esce}s">
    <img src="${marchio}" width="44" height="44" style="border-radius:12px" alt="" />
    <span>${testata}</span>
  </div>
  <div class="barra ap via" style="--t:${entra}s;--t2:${esce}s">
    <div style="animation:avanza ${(esce - entra).toFixed(2)}s ${entra}s linear both"></div>
  </div>`;

  return { contenuto: contenuto + cornice, durata };
}
