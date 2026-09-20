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
import { inDuePezzi, NOME } from "./marchio.js";

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
/* L'avviso «non hai ancora collegato le tue entita'» non parla prima che la
 * configurazione sia arrivata.
 *
 * La plancia, mezzo secondo dopo che la pagina e' pronta, guarda quattro cose
 * — la mappa delle entita', le stanze, le unita' clima, le luci — e se sono
 * tutte vuote scrive in cima alla Home «non hai ancora collegato le tue
 * entita', quindi le card sono nascoste» (`cdEmptyStateCheck`, in
 * `dashboard-runtime-it.js`). Quella domanda se la fa **una volta sola**, e
 * l'avviso poi non se ne va piu' da solo.
 *
 * Dentro Home Assistant con l'integrazione quella regola e' giusta: la
 * configurazione sta nella pagina. Qui no: la configurazione la tiene il
 * ponte e arriva **sul filo**, dopo che la pagina si e' caricata. Di corsa
 * arriva prima del mezzo secondo e non si vede niente; su un filo lento la
 * domanda parte prima della risposta, e si vede l'avviso sopra una Home piena
 * di tessere coi dati dentro — cioe' la plancia dice «configurala» a chi
 * l'ha configurata.
 *
 * Allora il posto di quell'avviso lo si tiene occupato: un elemento col suo
 * nome, nascosto, e la loro domanda — che si ferma se quel nome c'e' gia' —
 * non fa niente. Quando la configurazione arriva (la plancia lo dice:
 * `dashboardmodern:persistence-restored`) si rifa' **la loro** domanda, con
 * le loro quattro risposte: se c'e' qualcosa l'avviso non compare; se e'
 * davvero vuota si toglie il posto e si chiama la loro funzione, che lo
 * scrive. Vuoto vuol dire vuoto, e allora l'avviso e' giusto.
 *
 * Se la configurazione non arriva mai, il posto resta occupato e l'avviso non
 * compare: a filo caduto la plancia lo dice gia' col suo pallino, e «non hai
 * collegato le entita'» sarebbe una bugia.
 *
 * **E per dodici secondi quella promessa era falsa.** Il posto si liberava
 * allo scadere di un orologio, e allo scadere si chiamava la loro funzione:
 * cioe' esattamente quello che la riga sopra dice di non fare. In casa non si
 * vedeva; dal browser, da fuori, con i file della plancia che arrivano sul
 * filo un pezzo per volta, dodici secondi finiscono prima che la pagina sia in
 * piedi — e la plancia diceva «non hai collegato le entita'» a una casa con
 * diciassette sezioni dentro. Poi non se ne andava piu': `finito` restava
 * alzato anche quando la configurazione arrivava.
 *
 * L'orologio non serviva a misurare il filo: serviva a distinguere «non e'
 * ancora arrivata» da «non c'e' niente da aspettare». E quella e' una domanda
 * con una risposta esatta, che ce l'ha in mano chi serve la pagina: la
 * configurazione la tiene il ponte. Quindi la dice, in `__GDAHOME_CONFIGURATA__`:
 *
 *  - `false` — questa casa non ha configurazione: il posto non si occupa
 *    nemmeno, e l'avviso compare subito invece che dopo dodici secondi.
 *  - `true` — ce l'ha, e allora l'avviso non compare **mai**. Nemmeno a
 *    configurazione arrivata: le quattro domande che la plancia si fa guardano
 *    entita', stanze, clima e luci, e una plancia fatta di musica e apriporta
 *    non ne riempie nessuna — tutte e quattro vuote su una casa configurata
 *    per bene. Il ponte le chiavi le conta tutte, ed e' la risposta meglio
 *    informata delle due.
 *  - assente — un'app di ieri, una strada non prevista: resta l'orologio di
 *    prima, cosi' non peggiora niente.
 *
 * La stessa cosa la mette il servitore dell'app in fondo alla pagina che
 * serve lui (`app/lib/plancia/premesse.dart`): il patto e' lo stesso e si
 * scrive in due posti, come `__DASHBOARDMODERN_HOSTED__`. */
export const AVVISO_ASPETTA_LA_CONFIGURAZIONE =
  "<script>(function(){" +
  'var NOME="cd-empty-banner";' +
  'var NOSTRO="data-gdahome-posto";' +
  "var OGNI=250;" +
  "var FINO_A=12000;" +
  "var GUARDO_FINO_A=30000;" +
  "var detto=window.__GDAHOME_CONFIGURATA__;" +
  "var configurata=detto===true;" +
  "var vuota=detto===false;" +
  "var pieno=function(){" +
  'try{if(typeof ENTITY_OVERRIDES!=="undefined"&&Object.keys(ENTITY_OVERRIDES||{}).length)return true;}catch(male){}' +
  'try{if(typeof cdCfgList==="function"){' +
  'if((cdCfgList("cd_stanze")||[]).length)return true;' +
  'if((cdCfgList("cd_clima_units")||[]).length)return true;}' +
  'if(typeof cdCfg==="function"&&Object.keys(cdCfg("cd_luci")||{}).length)return true;}catch(male){}' +
  "return false;" +
  "};" +
  "var quello=function(){return document.getElementById(NOME);};" +
  "var ilPosto=function(){var chi=quello();return chi&&chi.hasAttribute(NOSTRO)?chi:null;};" +
  "var togli=function(chi){if(chi&&chi.parentNode)chi.parentNode.removeChild(chi);};" +
  "var occupa=function(){" +
  "if(quello())return;" +
  "try{" +
  'var posto=document.createElement("div");' +
  "posto.id=NOME;" +
  'posto.setAttribute(NOSTRO,"1");' +
  'posto.style.display="none";' +
  "document.body.appendChild(posto);" +
  "}catch(male){}" +
  "};" +
  "var finito=false;" +
  "var battito=0;" +
  "var basta=function(){if(battito){clearInterval(battito);battito=0;}};" +
  "var guarda=function(scaduto){" +
  "if(finito)return;" +
  "if(pieno()){finito=true;basta();togli(quello());return;}" +
  "if(configurata||!scaduto)return;" +
  "finito=true;basta();" +
  "togli(ilPosto());" +
  'try{if(typeof cdEmptyStateCheck==="function")cdEmptyStateCheck();}catch(male){}' +
  "};" +
  "var parti=function(){" +
  "if(vuota)return;" +
  "occupa();" +
  "var fine=Date.now()+FINO_A;" +
  "var smetto=Date.now()+GUARDO_FINO_A;" +
  "battito=setInterval(function(){" +
  "guarda(Date.now()>=fine);" +
  "if(!finito&&Date.now()>=smetto)basta();" +
  "},OGNI);" +
  'window.addEventListener("dashboardmodern:persistence-restored",function(){' +
  "setTimeout(function(){guarda(true);},0);" +
  "});" +
  "};" +
  "if(document.body)parti();" +
  'else document.addEventListener("DOMContentLoaded",parti);' +
  "})();</script>";

/* Le vesti di questa plancia, se chi installa le ha scelte: la parola del
 * velo e la scritta della testata, in due pezzi. La pagina le legge al
 * momento di disegnare (vedi `marchio.js`: il velo e il runtime le cercano
 * per nome). Senza, non si scrive niente e la plancia porta il nome di chi
 * installa, o il nostro. Via `<` e `>` anche qui: finiscono dentro uno
 * `<script>`, e un `</script>` dentro una stringa chiuderebbe lo script. */
export function leVesti(vesti) {
  if (!vesti || typeof vesti !== "object") return "";
  const pulito = (cosa) => String(cosa ?? "").replace(/[<>]/g, "");
  let fuori = "";
  const velo = pulito(vesti.velo);
  if (velo) fuori += `window.__GDAHOME_VELO__=${JSON.stringify(velo)};`;
  const testata = pulito(vesti.testata);
  if (testata) fuori += `window.__GDAHOME_TESTATA__=${JSON.stringify(inDuePezzi(testata))};`;
  return fuori;
}

export function conLePremesse(
  pagina,
  { base, quale = null, lingua, doveIlWebSocket, configurata = null, vesti = null },
) {
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
    leVesti(vesti) +
    /* Se questa plancia ha una configurazione. `null` vuol dire «non lo so»,
     * e allora la pagina non lo scrive nemmeno: chi legge tiene l'orologio. */
    (typeof configurata === "boolean"
      ? `window.__GDAHOME_CONFIGURATA__=${configurata ? "true" : "false"};`
      : "") +
    "</script>" +
    AVVISO_ASPETTA_LA_CONFIGURAZIONE;
  const testa = /<head[^>]*>/i.exec(pagina);
  if (!testa) return `${premessa}${pagina}`;
  const dove = testa.index + testa[0].length;
  return pagina.slice(0, dove) + premessa + pagina.slice(dove);
}
