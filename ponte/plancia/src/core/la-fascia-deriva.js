/* La fascia sotto il meteo, quando le pastiglie non ci stanno.
 *
 * «La barra sotto al meteo deve essere su una riga: da smartphone, se non
 *  entra, la devi rendere scorrevole o che scorre lei automaticamente.»
 *
 * Era andata a capo per la #400 — «va oltre pagina a destra e devi scorrere
 * per vederle» — e quella obiezione era giusta: uno scorrimento orizzontale in
 * cima a una pagina che scorre in verticale non lo trova nessuno, e quello che
 * sta oltre il bordo destro è di fatto quello che non esiste.
 *
 * Torna su una riga, e l'obiezione cade per un'altra strada: non c'è più
 * niente da trovare, perché la fascia si muove da sola. Va fino al fondo,
 * torna, e così ogni pastiglia passa davanti senza che nessuno debba sapere
 * che si poteva trascinare.
 *
 * ── Perché qui c'è solo aritmetica, e nessun timer ──────────────────────────
 *
 * Il movimento lo fa un'animazione del foglio di stile, non un `setInterval`
 * che sposta lo scorrimento un pixel per volta. Sono la stessa cosa vista da
 * fuori e due cose diverse per la macchina: la prima la disegna il
 * compositore e non sveglia nessuno, la seconda è un risveglio ogni quaranta
 * millesimi finché la Home resta aperta. Questa plancia ha già avuto un giro
 * che scaldava un mini PC, e c'è una prova che tiene il conto di chi fa
 * polling: la fascia non deve entrarci.
 *
 * Al foglio serve una cosa sola che non può calcolare da sé — quanta strada
 * c'è da fare — e una che è meglio non lasciargli decidere: quanto tempo
 * metterci. Stanno qui.
 */

const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) ? n : 0;
};

/* Due pixel di tolleranza: gli scorrimenti frazionari — uno schermo a densità
 * due, un ingrandimento del browser — lasciano scarti sotto il pixel, e senza
 * tolleranza una fascia che ci sta tutta deriverebbe di mezzo pixel. */
const TOLLERANZA = 2;

/**
 * Quanti pixel di pastiglie restano fuori dal bordo: `0` se ci stanno tutte.
 *
 * È anche la condizione da cui la sezione capisce se c'è qualcosa da muovere:
 * su una casa tranquilla, con due voci, non si muove niente.
 *
 * ── L'imbottitura va tolta, e prima non lo era ─────────────────────────────
 *
 * La fascia ha un bordo interno — sei pixel per parte — e il nastro comincia
 * DENTRO quel bordo. La larghezza che il documento chiama `clientWidth`
 * l'imbottitura però la comprende: sottraendo quella, la strada risultava più
 * corta di dodici pixel, il nastro si fermava prima del suo capo e l'ultima
 * pastiglia restava tagliata — proprio quella che si stava aspettando, e col
 * velo sul bordo sopra.
 *
 * Chi chiama passa quanto misura l'imbottitura: è l'unica cosa che il
 * documento sa e questo modulo no.
 */
export function spazioDaPercorrere({ scrollWidth, clientWidth, imbottitura = 0 } = {}) {
  const dentro = numero(clientWidth) - Math.max(0, numero(imbottitura));
  const oltre = numero(scrollWidth) - dentro;
  return oltre > TOLLERANZA ? Math.round(oltre) : 0;
}

/* Quanto sporge il velo dentro la fascia, a ogni capo.
 *
 * I due bordi sono sfumati per dire «continua»: dove la sfumatura è piena, la
 * pastiglia che le sta sotto non si legge. Finché il nastro cammina non è un
 * danno — quello che sfuma adesso si legge un istante dopo — ma ai due capi il
 * nastro si ferma, e lì la pastiglia che si stava aspettando restava sotto il
 * velo senza più strada per uscirne. «La fascia si taglia ai lati»: era vero,
 * e si tagliava proprio dove si era fermata ad aspettare.
 *
 * Allora la corsa non finisce dove finiscono le pastiglie, ma un velo più in
 * là: ai due capi il nastro sporge di quanto la fascia sfuma, e la prima e
 * l'ultima pastiglia si fermano in chiaro.
 *
 * Il numero sta qui, uno solo, e da qui lo prende anche il foglio di stile —
 * `--dm-casa-velo`, che è quello con cui disegna la sfumatura. Scritto in due
 * posti, prima o poi uno dei due cambierebbe da solo e la pastiglia tornerebbe
 * mezza sfumata senza che nessuno avesse toccato la sfumatura.
 */
export const VELO_DELLA_FASCIA = 22;

/**
 * La corsa intera del nastro: quello che sporge, più un velo per capo.
 *
 * È questa — non il solo spazio fuori — la strada che il nastro percorre
 * davvero, quindi è questa che va detta al foglio e data alla durata: il tempo
 * si calcola sulla distanza, e sulla distanza sbagliata la velocità non
 * sarebbe più quella.
 */
export function laCorsaDelNastro(spazio) {
  const fuori = Math.max(0, numero(spazio));
  return fuori ? Math.round(fuori) + 2 * VELO_DELLA_FASCIA : 0;
}

/* Quanto ci mette a percorrerlo, a velocità costante.
 *
 * A velocità costante e non a durata costante, ed è la differenza fra una cosa
 * che si legge e una che non si legge: con una durata fissa, una fascia con
 * due pastiglie di troppo striscerebbe piano e una con sei sfreccerebbe. Sono
 * venticinque pixel al secondo, cioè il passo con cui si legge una parola
 * mentre passa.
 *
 * L'andata si ferma un attimo prima di tornare — lo fa la curva
 * dell'animazione — quindi la durata è quella del solo viaggio. */
const PIXEL_AL_SECONDO = 25;
const ALMENO = 4;
const AL_MASSIMO = 40;

/** La durata di un viaggio, in secondi, per quello spazio. */
export function durataDellaDeriva(spazio) {
  const strada = Math.max(0, numero(spazio));
  if (!strada) return 0;
  const secondi = strada / PIXEL_AL_SECONDO;
  return Math.round(Math.min(AL_MASSIMO, Math.max(ALMENO, secondi)) * 10) / 10;
}
