/* La faccia di gdahome sulla plancia.
 *
 * La plancia si chiama DashboardModern dentro di se', e continua a
 * chiamarsi cosi': quel nome, in `ponte/plancia/`, non e' solo una scritta.
 * E' dentro le chiavi con cui la pagina si ricorda le cose, nei percorsi con
 * cui chiede i suoi file, nei nomi delle sue classi. Cambiarlo in novecento
 * file vorrebbe dire rincorrere per giorni delle rotture che non si vedono
 * subito, per guadagnare niente: quello che deve cambiare e' **quello che si
 * legge**.
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
 *     «home», che e' lo stesso disegno col nostro nome;
 *  6. il **segno in cima a Configurazione**. Li' c'era una casetta azzurra
 *     disegnata a mano dentro la pagina — non un logo di nessuno, ma
 *     nemmeno il nostro — e chi apriva quella schermata vedeva il marchio
 *     cambiare sotto gli occhi. Adesso e' lo stesso `logo.png` della
 *     testata, cioe' il nostro, o quello dell'installatore dove c'e': una
 *     riga sola, e i due segni non possono piu' divergere;
 *  7. i **numeri di versione** che la plancia dichiara di se' stessa
 *     (`legacy/build-info.js`). Dicevano `1.4.32` mentre l'add-on diceva
 *     1.5.9.1, e si leggevano in due posti a schermo: sotto
 *     «CONFIGURAZIONE» e nella diagnostica runtime. Quei numeri li scrive
 *     uno script della plancia quando la si costruisce, e non sa niente di
 *     gdahome; qui si rimettono in pari col nostro, che e' lo stesso che
 *     sta in `ORIGINE.json`.
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

/* Quanto puo' pesare un logo per finire **dentro** la pagina, nel velo
 * d'avvio: quello sta in base64 nell'HTML e arriva prima di qualunque altra
 * cosa. Il nostro, in WebP a 152 punti, pesa quattro kilobyte. Oltre questa
 * misura il velo resta il nostro e il logo dell'installatore si vede un attimo
 * dopo, in cima alla plancia: mezzo secondo di marchio nostro all'avvio costa
 * meno di due secondi di schermo bianco. */
const VELO_MASSIMO = 24 * 1024;

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

/* I numeri che la plancia dichiara di se' stessa. Sono dentro un `Object.freeze`
 * scritto su una riga sola, e si riconoscono per nome. */
const IL_BUILD_INFO = "legacy/build-info.js";
const LA_VERSIONE_DELLA_PLANCIA = /("(?:integrationVersion|dashboardVersion)":")[^"]*(")/g;

/* Il segno in cima a Configurazione: una casetta azzurra disegnata dentro la
 * pagina. Si riconosce il contenitore — `cfg-hero-ico` — e si butta via quello
 * che c'e' dentro: quel disegno cambia a ogni versione della plancia, il nome
 * della classe no. */
const IL_SEGNO_DI_CONFIGURAZIONE =
  /(<div class="cfg-hero-ico"[^>]*>)\s*<svg[\s\S]*?<\/svg>\s*(<\/div>)/;

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
export function vestiDiGdahome(relativo, corpo, tipo, suo = null, versione = "") {
  const quale = String(relativo || "");
  const chi = daInstallatore(suo);
  try {
    if (quale === IL_BUILD_INFO) {
      const nostra = numeroDiVersione(versione);
      if (!nostra) return { corpo, tipo };
      const testo = corpo.toString("utf8");
      const fatto = testo.replace(LA_VERSIONE_DELLA_PLANCIA, `$1${nostra}$2`);
      if (fatto === testo) return { corpo, tipo };
      return { corpo: Buffer.from(fatto, "utf8"), tipo };
    }
    if (quale === IL_LOGO) {
      const nostro = chi?.logo || ilLogo();
      if (!nostro) return { corpo, tipo };
      return { corpo: nostro, tipo: (chi?.logo && chi.tipo) || tipo };
    }
    if (quale.endsWith(".html")) {
      return { corpo: Buffer.from(laPagina(corpo.toString("utf8"), chi), "utf8"), tipo };
    }
    if (/^legacy\/dashboard-runtime-[a-z]{2}\.js$/.test(quale)) {
      const testo = corpo.toString("utf8");
      const [davanti, dietro] = inDuePezzi(chi ? chi.nome : NOME);
      /* Si sostituisce e poi si guarda se e' cambiato qualcosa, invece di
       * chiedere prima «c'e'?»: su un'espressione con la `g`, `test` si
       * ricorda dove era arrivata, e la seconda domanda risponde dal punto
       * sbagliato. Sostituire e confrontare non ha memoria. */
      const fatto = testo
        .replace(L_ALT_DEL_LOGO, `alt="${perUnAttributo(chi ? chi.nome : NOME)}"`)
        .replace(LA_SCRITTA_DEL_LOGO, `$1${davanti}$2${dietro}$3`);
      if (fatto === testo) return { corpo, tipo };
      return { corpo: Buffer.from(fatto, "utf8"), tipo };
    }
    return { corpo, tipo };
  } catch (_errore) {
    return { corpo, tipo };
  }
}

/* Chi ha montato l'impianto, se c'e' e se ha qualcosa da far vedere.
 *
 * Torna `null` quando non c'e' niente da cambiare, cosi' chi disegna ha un
 * caso solo da guardare invece di tre campi da controllare uno per uno. */
function daInstallatore(suo) {
  const nome = perDisegnare(suo?.nome);
  const logo = Buffer.isBuffer(suo?.logo) && suo.logo.length ? suo.logo : null;
  if (!nome && !logo) return null;
  return { nome: nome || NOME, logo, tipo: String(suo?.tipo || "") };
}

/* Il nome di un installatore, ripulito per finire dentro una pagina.
 *
 * Arriva dal quadro, cioe' da fuori, e va a finire in un `<title>`, in un
 * `alt=""` e dentro due `span`. Via i segni che in quei tre posti vogliono
 * dire qualcosa — `<`, `>`, `"`, `&` — e via i «a capo», che in un attributo
 * non ci stanno. Quello che resta e' un nome.
 *
 * Non si scappa, si **toglie**: un nome con dentro un `&lt;` lo si legge nel
 * `<title>` ma non nei due `span`, dove finirebbe in mezzo a del testo gia'
 * scritto. Togliere da' lo stesso risultato dappertutto. */
function perDisegnare(nome) {
  return String(nome ?? "")
    .replace(/[<>"'&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

const perUnAttributo = (nome) => perDisegnare(nome);

/* Un numero di versione, ripulito: cifre e punti e basta.
 *
 * Finisce dentro una stringa JSON in un file che il browser esegue, e arriva
 * da `ORIGINE.json` — un file, quindi qualcosa che un giorno qualcuno
 * modifica. Un apice in mezzo romperebbe la plancia intera, e qui non passa. */
function numeroDiVersione(quale) {
  const pulito = String(quale ?? "").trim();
  return /^[0-9]+(\.[0-9]+){1,3}$/.test(pulito) ? pulito : "";
}

/* La scritta accanto al logo e' fatta di **due** pezzi attaccati: «gda» in
 * chiaro e «home» in azzurro. Un nome di due parole ci sta com'e'; uno di una
 * parola sola va tutto nel primo, e il secondo resta vuoto — che a schermo
 * vuol dire una parola sola, giusta, invece di una spezzata a meta' a caso. */
function inDuePezzi(nome) {
  const pulito = perDisegnare(nome);
  if (pulito === NOME) return ["gda", "home"];
  const spazio = pulito.indexOf(" ");
  if (spazio <= 0) return [pulito, ""];
  return [pulito.slice(0, spazio), pulito.slice(spazio + 1)];
}

/* La pagina, vestita. Sta a parte perche' la prova la guarda come testo, che
 * e' il modo in cui si legge quello che cambia. */
export function laPagina(testo, suo = null) {
  let fatto = String(testo);
  const chi = suo && suo.nome ? suo : null;
  /* Il segno di Configurazione: lo stesso file della testata, che due righe
   * piu' su diventa il nostro o quello dell'installatore. Indicarlo invece di
   * incollarlo di nuovo e' quello che impedisce ai due segni di divergere: e'
   * lo stesso. `./logo.png` perche' questa pagina sta in `legacy/`, come lui. */
  fatto = fatto.replace(
    IL_SEGNO_DI_CONFIGURAZIONE,
    `$1<img src="./logo.png" alt="${perUnAttributo(chi ? chi.nome : NOME)}" width="52" height="52" style="display:block;object-fit:contain;border-radius:13px" />$2`,
  );
  /* Il velo d'avvio: l'immagine si cambia solo se ce n'e' una da mettere. Il
   * logo di un installatore in un `data:` dentro la pagina pesa quanto pesa —
   * fino a centoventotto kilobyte prima del primo disegno — e allora li' resta
   * il nostro, che di kilobyte ne pesa quattro. La **parola** invece cambia:
   * e' quella che si legge. */
  const velo = chi?.logo && chi.logo.length <= VELO_MASSIMO ? chi.logo : ilVelo();
  const razza = velo === chi?.logo ? chi.tipo || "image/png" : "image/webp";
  if (velo) {
    fatto = fatto.replace(
      LIMMAGINE_DEL_VELO,
      `$1data:${razza};base64,${velo.toString("base64")}$2`,
    );
  }
  /* Ripulito **qui**, e non solo da chi chiama: questa funzione e' esportata —
   * la prova la usa da sola, e domani la usera' qualcun altro — e un nome che
   * arriva dal quadro finisce dentro un `<title>`. Una funzione che si fida di
   * chi la chiama e' una funzione che un giorno qualcuno chiama male. */
  const nome = perDisegnare(chi ? chi.nome : NOME) || NOME;
  fatto = fatto.replace(LA_PAROLA_DEL_VELO, `$1${nome}$2`);
  fatto = fatto.replace(IL_TITOLO, `<title>${nome}</title>`);
  return fatto;
}
