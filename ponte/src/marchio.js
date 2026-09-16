/* La faccia di gdahome sulla plancia.
 *
 * La plancia e' DashboardModern, ed e' **la stessa**: la cartella
 * `ponte/plancia/` e' una copia verbatim, sigillata e ricontrollata a ogni
 * avvio (`provenienza.js`). Dentro quella cartella non si tocca niente, e non
 * per scrupolo: al prossimo `porta-la-plancia.mjs` si rifa' da zero, e ogni
 * modifica fatta li' sarebbe da rifare a ogni versione nuova della dashboard —
 * cioe' ogni pochi giorni.
 *
 * Quindi il nome e il marchio si mettono **al momento di servire**. E' lo
 * stesso posto dove stanno gia' tutte le altre aggiunte di gdahome alla pagina
 * (`premesse.js` e `premesse.dart`), ed e' quello che rende questo lavoro
 * gratis per sempre: la 1.4.24, la 1.4.25 e quella dell'anno prossimo arrivano
 * vestite senza che nessuno rifaccia niente.
 *
 * **Cosa si cambia, e cosa no.** Nella plancia la parola «DashboardModern»
 * compare trecentocinquanta volte, e trecentoquarantasei sono **nomi di
 * cose**: `window.DashboardModernModules`, `DashboardModernEnergyService`, i
 * ganci con cui i suoi stessi file si parlano. Cambiarli vorrebbe dire rompere
 * la plancia per un nome che nessuno legge. Quello che una persona **vede** e'
 * poco, ed e' tutto qui:
 *
 *  1. il **logo** — `legacy/logo.png`, che il runtime mette in cima;
 *  2. il **velo d'avvio** — la prima cosa a schermo: un logo e una parola in
 *     maiuscolo, dentro la pagina come immagine in base64 perche' si veda
 *     prima che qualunque richiesta sia tornata;
 *  3. il **titolo della pagina**, che si legge nella linguetta del browser;
 *  4. l'**`alt` del logo**, che si sente con un lettore di schermo e si legge
 *     quando un'immagine non arriva;
 *  5. la **scritta accanto al logo** nella testata. Questa mancava, e si
 *     vedeva: il segno era il nostro e le parole di fianco no, cioe' il
 *     marchio di un altro appoggiato al nostro. Sono due `span` attaccati —
 *     «Dashboard» in chiaro e «MODERN» in azzurro — e diventano «gda» e
 *     «home», che e' lo stesso disegno col nostro nome.
 *
 * Il velo resta leggero: il marchio di gdahome e' un disegno con sfumature, e
 * in PNG a 152 punti pesa quaranta kilobyte — dieci volte quello che c'era, e
 * tutti prima del primo disegno. In WebP alla stessa misura sono quattro, cioe'
 * quanto pesava il suo. Dei formati, l'unica cosa che conta e' che un WebView
 * di Android e il browser dentro Home Assistant lo leggono da anni.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* Come si chiama questo, dove si vede. */
export const NOME = "gdahome";

/* Il nome di prima, quello da coprire. Sta scritto qui una volta: se un giorno
 * la dashboard cambiasse il suo, questa e' la riga da cambiare. */
export const NOME_DI_PRIMA = "DashboardModern";

const QUI = dirname(fileURLToPath(import.meta.url));
const MARCHIO = join(QUI, "..", "marchio");

/* Il logo, e quello del velo. Si leggono una volta: sono due file che non
 * cambiano mentre il ponte gira, e rileggerli a ogni richiesta vorrebbe dire
 * un giro sul disco per niente. */
const ilLogo = leggiUnaVolta(join(MARCHIO, "gdahome.png"));
const ilVelo = leggiUnaVolta(join(MARCHIO, "gdahome-velo.webp"));

function leggiUnaVolta(dove) {
  let dentro;
  let letto = false;
  return () => {
    if (!letto) {
      letto = true;
      try {
        dentro = existsSync(dove) ? readFileSync(dove) : null;
      } catch (_errore) {
        dentro = null;
      }
    }
    return dentro;
  };
}

/* Il logo che il runtime chiede per nome. */
const IL_LOGO = "legacy/logo.png";

/* L'immagine del velo, dentro la pagina. Si riconosce da dove sta — subito
 * dopo l'apertura del velo — e non dal suo contenuto: quei byte cambiano a
 * ogni versione della dashboard, la sua posizione no. */
const LIMMAGINE_DEL_VELO = /(<div id="cd-boot-overlay"><img src=")data:[^"]*(")/;

/* La parola in maiuscolo sotto il logo del velo. */
const LA_PAROLA_DEL_VELO = new RegExp(`(<b>)${NOME_DI_PRIMA}(</b>)`);

/* Il titolo della pagina. Quello che c'e' non e' un marchio — «Smart Home
 * Dashboard» — ma e' la scritta nella linguetta del browser, ed e' un posto
 * dove il nome del prodotto ci va. */
const IL_TITOLO = /<title>[^<]*<\/title>/;

/* L'`alt` del logo, dentro il runtime. Con lo spazio: li' e' scritto
 * «Dashboard Modern», in due parole. */
const L_ALT_DEL_LOGO = /alt="Dashboard Modern"/g;

/* La scritta accanto al logo: due `span` attaccati, «Dashboard» e «MODERN».
 *
 * Si riconosce la **coppia**, non le due parole da sole: in un runtime di
 * quattromila righe la parola «Dashboard» puo' capitare in venti posti — e
 * cambiarla dove non e' un marchio vorrebbe dire rompere qualcosa per niente —
 * mentre «Dashboard» attaccato a «MODERN» e' quel marchio e nient'altro.
 *
 * Il secondo pezzo ha un colore e le lettere spaziate: lasciandogli il suo
 * stile, «gda» e «home» si leggono come il nostro nome con la seconda meta'
 * in evidenza, che e' esattamente il disegno che c'era. */
const LA_SCRITTA_DEL_LOGO = /(>)Dashboard(<\/span><span[^>]*>)MODERN(<\/span>)/g;

/* Se un file va vestito, e come.
 *
 * Torna `{corpo, tipo}` — gli stessi che si servirebbero, o quelli nuovi. Non
 * solleva mai: un marchio che manca e' una plancia che si vede col suo nome di
 * prima, e va infinitamente meglio di una plancia che non si apre.
 */
export function vestiDiGdahome(relativo, corpo, tipo) {
  const quale = String(relativo || "");
  try {
    if (quale === IL_LOGO) {
      const nostro = ilLogo();
      return nostro ? { corpo: nostro, tipo } : { corpo, tipo };
    }
    if (quale.endsWith(".html")) {
      return { corpo: Buffer.from(laPagina(corpo.toString("utf8")), "utf8"), tipo };
    }
    if (/^legacy\/dashboard-runtime-[a-z]{2}\.js$/.test(quale)) {
      const testo = corpo.toString("utf8");
      /* Si sostituisce e poi si guarda se e' cambiato qualcosa, invece di
       * chiedere prima «c'e'?»: su un'espressione con la `g`, `test` si
       * ricorda dove era arrivata, e la seconda domanda risponde dal punto
       * sbagliato. Sostituire e confrontare non ha memoria. */
      const fatto = testo
        .replace(L_ALT_DEL_LOGO, `alt="${NOME}"`)
        .replace(LA_SCRITTA_DEL_LOGO, "$1gda$2home$3");
      if (fatto === testo) return { corpo, tipo };
      return { corpo: Buffer.from(fatto, "utf8"), tipo };
    }
    return { corpo, tipo };
  } catch (_errore) {
    return { corpo, tipo };
  }
}

/* La pagina, vestita. Sta a parte perche' la prova la guarda come testo, che
 * e' il modo in cui si legge quello che cambia. */
export function laPagina(testo) {
  let fatto = String(testo);
  const velo = ilVelo();
  if (velo) {
    fatto = fatto.replace(
      LIMMAGINE_DEL_VELO,
      `$1data:image/webp;base64,${velo.toString("base64")}$2`,
    );
  }
  fatto = fatto.replace(LA_PAROLA_DEL_VELO, `$1${NOME}$2`);
  fatto = fatto.replace(IL_TITOLO, `<title>${NOME}</title>`);
  return fatto;
}
