/* Il servitore, dentro il browser.
 *
 * Sul telefono la plancia arriva da un server vero che l'app apre su
 * 127.0.0.1. In un browser un server non si puo' aprire — e questa e' la sola
 * ragione per cui, fino a ieri, la versione web diceva «la plancia si vede sul
 * telefono».
 *
 * Un service worker fa la stessa cosa da dentro: si mette in mezzo alle
 * richieste di due cartelle — `dashboardmodern_static/`, dove sta tutta la
 * plancia, e `api/`, dove la pagina chiede lo storico e le istantanee delle
 * telecamere — e risponde lui. I file non ce li ha: li chiede alla pagina che
 * lo ha registrato, cioe' all'app, che li fa arrivare **sul filo** come li fa
 * arrivare sul telefono. Stessa strada, stessi byte, stessa cifratura: cambia
 * solo chi li serve all'ultimo metro.
 *
 * Tutto il resto passa: i file dell'app, i suoi caratteri, i suoi disegni. Un
 * service worker che risponde a tutto e' un service worker che prima o poi
 * risponde male a qualcosa.
 *
 * Cosa questo NON aggiunge: nessuna porta nuova sul ponte, e niente che esca
 * dal browser. Un service worker risponde solo alle pagine della sua origine,
 * e la sua origine e' l'app stessa.
 *
 * Perche' non basta un `fetch` diretto dalla pagina della plancia: la plancia
 * e' fatta di duecentosettanta moduli che si chiamano fra loro per indirizzo
 * relativo. Perche' funzionino serve qualcuno che risponda a quegli
 * indirizzi, ed e' esattamente quello che un service worker sa fare.
 */

/* Chi ha chiesto cosa: ogni richiesta ha un numero, e la risposta torna col
 * suo. Senza, due file chiesti nello stesso istante si scambierebbero i
 * contenuti — ed e' il genere di errore che si vede una volta su cento e non
 * si spiega mai. */
let prossima = 1;
const inAttesa = new Map();

/* Quanto si aspetta una risposta dall'app.
 *
 * Trenta secondi: un file della plancia viaggia sul filo, e il filo puo'
 * passare dal centralino con la casa dall'altra parte del paese. Meglio una
 * pagina lenta che una pagina a meta'. */
const ATTESA = 30000;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

/* Le risposte dell'app arrivano qui. */
self.addEventListener("message", (evento) => {
  const detto = evento.data;
  if (!detto || detto.che !== "gdahome/file") return;
  const chi = inAttesa.get(detto.numero);
  if (!chi) return;
  inAttesa.delete(detto.numero);
  chi(detto);
});

/* Le cartelle che si servono. Il resto non si tocca.
 *
 * `/local/` e' la cartella `www` di Home Assistant: le foto delle auto, i
 * loghi, gli sfondi che chi ha una casa da qualche anno tiene li'. Dentro Home
 * Assistant le serve Home Assistant; qui le legge il ponte dal disco, cosi'
 * una configurazione fatta nell'app mostra la stessa foto anche nella plancia
 * dentro Home Assistant. */
const MIE = ["/dashboardmodern_static/", "/api/", "/local/"];

async function chiediAllApp(percorso) {
  /* A chi si chiede: all'app. Il riquadro della plancia e' una pagina anche
   * lui, e a lui non serve chiedere niente — non saprebbe rispondere. */
  const pagine = await self.clients.matchAll({ type: "window" });
  const app = pagine.find((una) => !una.url.includes("/dashboardmodern_static/"));
  if (!app) throw new Error("l'app non c'e'");

  const numero = prossima++;
  const risposta = new Promise((ok, no) => {
    inAttesa.set(numero, ok);
    setTimeout(() => {
      if (!inAttesa.has(numero)) return;
      inAttesa.delete(numero);
      no(new Error("l'app non ha risposto"));
    }, ATTESA);
  });
  app.postMessage({ che: "gdahome/chiedi", numero, percorso });
  return risposta;
}

self.addEventListener("fetch", (evento) => {
  const dove = new URL(evento.request.url);
  if (dove.origin !== self.location.origin) return;
  const mia = MIE.find((quale) => dove.pathname.includes(quale));
  if (!mia) return;

  /* Quello che si chiede all'app e' il percorso come lo scrive la plancia,
   * con la sua eventuale domanda: le chiamate REST — lo storico, le
   * istantanee delle telecamere — la portano dietro. Davanti puo' esserci il
   * prefisso di dove sta l'app, e li' non c'entra niente. */
  const percorso =
    dove.pathname.slice(dove.pathname.indexOf(mia)) + dove.search;
  evento.respondWith(
    chiediAllApp(percorso).then(
      (detto) => {
        if (detto.stato >= 400) {
          return new Response(detto.corpo || "", {
            status: detto.stato,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }
        /* Il corpo arriva o come testo — le pagine, i programmi, gli stili —
         * o come byte: i caratteri, i ritratti, le istantanee. */
        const corpo = detto.byte ? detto.byte : detto.corpo;
        return new Response(corpo, {
          status: 200,
          headers: {
            "content-type": detto.tipo || "application/octet-stream",
            /* Niente deposito: i file cambiano quando cambia la plancia, e chi
             * li tiene se ne accorge tardi. Il deposito vero lo fa l'app, che
             * l'impronta della plancia ce l'ha. */
            "cache-control": "no-store",
          },
        });
      },
      (male) =>
        new Response(`gdahome: ${male.message}`, {
          status: 502,
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
    ),
  );
});
