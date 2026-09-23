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

/* Le risposte dell'app arrivano qui.
 *
 * Solo dall'app: una finestra della nostra origine che non sia la plancia.
 * La plancia sta sulla stessa origine, ma le risposte non le da' lei — e un
 * file che rispondesse a nome dell'app finirebbe in un'altra pagina. */
self.addEventListener("message", (evento) => {
  const mittente = evento.source;
  if (!mittente || mittente.type !== "window" || !mittente.url) return;
  if (new URL(mittente.url).origin !== self.location.origin) return;
  if (mittente.url.includes("/dashboardmodern_static/")) return;
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

/* Il percorso **dentro l'app**, tolto quello che sta davanti.
 *
 * Qui c'era un difetto che si e' visto solo in casa di qualcuno, ed era grosso.
 *
 * Dietro l'ingress di Home Assistant l'app sta su un indirizzo che comincia
 * con `/api/hassio_ingress/<gettone>/app/`. Il confronto era «il percorso
 * CONTIENE `/api/`?» — e a quel punto **ogni** cosa che l'app chiede di suo
 * contiene `/api/`: i suoi caratteri, i suoi disegni, e `caselle.json`, che e'
 * l'elenco delle cento caselle della configurazione. Finivano tutte al ponte,
 * che le girava a Home Assistant, che rispondeva 404. Il risultato a schermo:
 * l'auto senza le sue diciassette entita', e nessun errore da nessuna parte.
 *
 * L'ambito del service worker e' esattamente la cartella dell'app: quello che
 * viene prima non e' roba nostra e va tolto **prima** di cercare. */
function dentroLApp(pathname) {
  const ambito = new URL(self.registration.scope).pathname;
  if (ambito.length > 1 && pathname.startsWith(ambito)) {
    return pathname.slice(ambito.length - 1);
  }
  return pathname;
}

/* Quanto si tiene un file, e perche' quasi tutti si tengono per sempre.
 *
 * I file della plancia hanno **l'impronta nel percorso**:
 * `/dashboardmodern_static/<impronta>/…`, e l'impronta e' del contenuto.
 * Aggiornare la plancia cambia l'impronta, cambia i percorsi, e il browser si
 * ritrova dei file nuovi da chiedere senza che nessuno glielo dica. Quindi
 * quello che c'e' a quell'indirizzo oggi non cambiera' mai: tenerlo non fa
 * restare indietro nessuno, e vuol dire che la seconda volta la plancia si
 * apre **senza chiedere niente** — che da fuori casa e' la differenza fra
 * qualche secondo e zero.
 *
 * E' lo stesso che fa il servitore sul telefono, dove i file stanno sul disco
 * e non si riscaricano mai (`servitore.dart`).
 *
 * Tre cose no, e sono tre ragioni diverse:
 *
 *  - **la pagina**, che non e' un file della dashboard: porta le premesse, che
 *    dicono quale casa e' e in che lingua, e cambiano quando cambia la casa;
 *  - **le foto** caricate dalla plancia (`/dashboardmodern_static/www/`): il
 *    nome lo scegli tu, e ricaricarne una col nome di prima e' una cosa
 *    normale;
 *  - **tutto il resto** — `/api/`, `/local/` — che e' lo stato di adesso e la
 *    cartella `www` di casa.
 */
function quantoSiTiene(percorso, tipo) {
  const solo = percorso.split("?")[0];
  if (!solo.startsWith("/dashboardmodern_static/")) return "no-store";
  if (solo.startsWith("/dashboardmodern_static/www/")) return "no-store";
  if (`${tipo || ""}`.startsWith("text/html")) return "no-store";
  return "public, max-age=31536000, immutable";
}

self.addEventListener("fetch", (evento) => {
  const dove = new URL(evento.request.url);
  if (dove.origin !== self.location.origin) return;
  /* Il percorso col nome vero del file, non con i segni di percentuale:
   * «mia auto.png» viaggia come `mia%20auto.png`, e con quel nome il ponte
   * non trova niente — i suoi nomi li vuole con lo spazio dentro
   * (`ponte/src/foto.js`). Un percorso che non si scioglie si lascia
   * com'e': meglio chiederlo storto che non chiederlo. */
  let strada = dove.pathname;
  try {
    strada = decodeURIComponent(strada);
  } catch (_male) {
    /* Percentuali sbagliate: resta com'era. */
  }
  const dentro = dentroLApp(strada);
  const mia = MIE.find((quale) => dentro.includes(quale));
  if (!mia) return;

  /* Quello che si chiede all'app e' il percorso come lo scrive la plancia,
   * con la sua eventuale domanda: le chiamate REST — lo storico, le
   * istantanee delle telecamere — la portano dietro. */
  const percorso = dentro.slice(dentro.indexOf(mia)) + dove.search;
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
            "cache-control": quantoSiTiene(percorso, detto.tipo),
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
