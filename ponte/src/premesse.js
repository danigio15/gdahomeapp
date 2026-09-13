/* Le premesse: quello che si aggiunge alla pagina della plancia prima di
 * servirla **dentro Home Assistant**.
 *
 * La plancia di DashboardModern e' una pagina web nata per girare dentro il
 * pannello dell'integrazione. Per farla girare altrove le si dicono le stesse
 * cose che le diceva il pannello: che e' **ospitata** — e quindi non chiede
 * nessun segno e usa il WebSocket che trova — quale istanza e quale profilo
 * e', e in che lingua.
 *
 * **Non si tocca un file della dashboard.** I file restano quelli pubblicati,
 * e devono restarlo: il ponte li ricontrolla uno per uno, e una plancia con un
 * file cambiato si direbbe modificata. Qui si aggiunge soltanto qualcosa alla
 * **pagina servita**.
 *
 * Questo file e' il gemello di `app/lib/plancia/premesse.dart`, e **non ne e'
 * una copia**: l'app ne ha bisogno di piu' — le misure delle barre del
 * telefono, la porta della Config che nell'app diventa una voce del menu — e
 * qui quelle cose non hanno senso. Dentro Home Assistant la Config e' una
 * pagina come le altre, e le barre del telefono non ci sono. Quello che e' in
 * comune sono le sette righe di `<head>`, che sono le sette cose che la
 * plancia deve sapere: quelle si', identiche, e una prova le guarda.
 */

/* Il nome del prodotto, da una parte sola: e' l'istanza della prima plancia,
 * cioe' il nome sotto cui la pagina tiene le proprie cose nel deposito del
 * browser. */
import { NOME } from "./marchio.js";

/* La lingua di serie. La plancia ha una pagina per lingua — `dashboard.html`
 * e' l'italiano — e quale aprire lo decide questa. Home Assistant la sua
 * lingua non la dice a un add-on, quindi si prende l'italiano e si lascia
 * cambiare dall'indirizzo: `?lingua=en`. */
export const LINGUA_DI_SERIE = "it";

/* Il WebSocket che la pagina trova: qualunque indirizzo gli si dia, va al
 * ponte.
 *
 * La plancia ospitata apre un secondo filo per la configurazione e lo punta a
 * un nome finto (`dashboardmodern.invalid`), contando sul fatto che il
 * pannello dell'integrazione l'indirizzo lo ignorasse. Qui dall'altra parte
 * c'e' un server, e l'indirizzo va detto giusto: si dice una volta, qui, e non
 * si lascia decidere alla pagina.
 *
 * L'indirizzo e' **assoluto dalla radice del sito** e arriva da fuori, perche'
 * sotto l'ingress davanti c'e' un prefisso che cambia a ogni riavvio di Home
 * Assistant e che questa pagina non puo' indovinare. */
export function ilWebSocket(dove) {
  return (
    "(function(Vera){" +
    `var dove=(location.protocol==="https:"?"wss://":"ws://")+location.host+${JSON.stringify(dove)};` +
    "function Cucita(_indirizzo,protocolli){" +
    "return protocolli===undefined?new Vera(dove):new Vera(dove,protocolli);}" +
    "Cucita.prototype=Vera.prototype;" +
    "Cucita.CONNECTING=0;Cucita.OPEN=1;Cucita.CLOSING=2;Cucita.CLOSED=3;" +
    "return Cucita;})(window.WebSocket)"
  );
}

/* Quale pagina aprire per una lingua. La stessa regola di
 * `PannelloDellaPlancia.pagina` nell'app: l'italiano e' `dashboard.html`, le
 * altre lingue hanno il loro suffisso, e dove quella pagina non c'e' si torna
 * all'italiano, che c'e' sempre. */
export function paginaDellaLingua(varianti, lingua = LINGUA_DI_SERIE) {
  const dentro = Array.isArray(varianti) ? varianti : [];
  const quale = String(lingua || LINGUA_DI_SERIE);
  const voluta = quale === "it" ? "dashboard.html" : `dashboard-${quale}.html`;
  if (dentro.includes(voluta)) return voluta;
  if (quale !== "en" && dentro.includes("dashboard-en.html")) return "dashboard-en.html";
  return "dashboard.html";
}

/* Come si chiama la lingua, senza fidarsi di quello che arriva: due lettere,
 * eventualmente con un pezzo dopo un trattino. Serve perche' questo nome
 * finisce in un nome di file. */
export function linguaPulita(detta) {
  const testo = String(detta ?? "").trim();
  return /^[a-z]{2}(-[A-Za-z]{2,8})?$/.test(testo) ? testo : LINGUA_DI_SERIE;
}

/* La pagina, con in testa quello che le serve sapere.
 *
 * `base` e' dove stanno i suoi file visti dal browser — col prefisso
 * dell'ingress davanti, se c'e' — e va scritto in un `<base href>`: la pagina
 * chiama i propri file per nome relativo (`./dashboard-runtime-it.css`), e
 * servita da un indirizzo diverso dal suo li andrebbe a cercare dove non
 * sono. Gli indirizzi che partono con la barra — `/local/…` per le foto di
 * casa, `/api/camera_proxy/…` per le telecamere — il `<base>` non li tocca, e
 * qui e' proprio quello che serve: dentro Home Assistant quelli funzionano da
 * se', con la sessione di chi sta guardando.
 */
export function conLePremesse(pagina, { base, quale = null, lingua, doveIlWebSocket }) {
  const premessa =
    `<base href="${base.replace(/\/*$/, "/")}" />` +
    "<script>" +
    "window.__DASHBOARDMODERN_HOSTED__=true;" +
    `window.__DASHBOARDMODERN_BRIDGE_WS__=${ilWebSocket(doveIlWebSocket)};` +
    `window.__DASHBOARDMODERN_INSTANCE__=${JSON.stringify(quale?.istanza || NOME)};` +
    `window.__DASHBOARDMODERN_PROFILE__=${JSON.stringify(quale?.profilo || "primary")};` +
    `window.__DASHBOARDMODERN_PRIMARY__=${quale ? quale.primaria !== false : true};` +
    `window.__DASHBOARDMODERN_LOCALE__=${JSON.stringify(linguaPulita(lingua))};` +
    "window.__GDAHOME__=true;" +
    "</script>";
  const testa = /<head[^>]*>/i.exec(pagina);
  if (!testa) return `${premessa}${pagina}`;
  const dove = testa.index + testa[0].length;
  return pagina.slice(0, dove) + premessa + pagina.slice(dove);
}
