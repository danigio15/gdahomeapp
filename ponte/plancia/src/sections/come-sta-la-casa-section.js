/* La riga sotto il meteo, e la posta che arriva (#356, #357).
 *
 * «Una barra sotto la parte meteo che mostra le indicazioni principali. Icona
 * + organico. Lampadina con luci accese. Tapparella con tapparelle aperte
 * ecc.» (#356)
 *
 * «Animazione quando arriva Posta attivato da un sensore contact.» (#357)
 *
 * Sono due richieste della stessa persona e sono la stessa cosa: una fila di
 * pastiglie sotto il meteo che dice quello che conta adesso. Il ritiro di
 * stasera, le luci rimaste accese, le finestre aperte — e la posta, che e' la
 * sola voce con un'animazione, perche' e' la sola che annuncia un fatto
 * appena successo invece di descrivere come sta la casa.
 *
 * Qui non si contano entita': i conti li ha gia' fatti la griglia delle
 * tessere, e arrivano da la' col giro di disegno che li ha appena prodotti
 * (`renderHomeWidgets` chiama `disegnaComeStaLaCasa`). Quali pastiglie
 * escono lo decide il nucleo, che si prova senza un documento; qui si
 * scrivono le parole, si disegna, e si tiene la memoria della cassetta.
 *
 * Il posto e' subito sotto il meteo e SOPRA le pastiglie di stato del guscio:
 * quelle sono il punto da cui l'ordine dei blocchi (`home-blocchi-section`)
 * riparte a impaginare la Home, e una riga infilata sotto di loro finirebbe
 * spinta in fondo alla pagina al primo riordino.
 */
import {
  QUANTE_MIE,
  STATO_DI_SERIE,
  TINTA_MIA,
  VOCI_DELLA_BARRA,
  normalizzaBarra,
  passoDellaPosta,
  pastiglieDellaCasa,
  postaRitirata,
} from "../core/come-sta-la-casa.js";
import { comandoPerSpegnere } from "../core/come-si-spegne.js";
import {
  VELO_DELLA_FASCIA,
  durataDellaDeriva,
  laCorsaDelNastro,
  spazioDaPercorrere,
} from "../core/la-fascia-deriva.js";
import { haOggettoWidget, oggettoWidget } from "../core/oggetti-widget.js";
import { parolaDellaPorta, parolaDiStato } from "./le-parole-di-home-assistant.js";
import { windowOpenFromState } from "../core/shutter-window.js";
import { iconGlyphMarkup } from "./icon-engine-section.js";
import { apriLaSchedaDellEntita } from "./la-scheda-di-home-assistant.js";
import { CHIAVE_VERSI, apertaSecondoVerso, insiemeInvertiti } from "../core/verso-aperture.js";
import { parolaDelQuando } from "./rifiuti-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  writeJsonIfChanged,
  siComanda,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_COME_STA_LA_CASA__";
const state = (root[KEY] ||= { installed: false, firma: "", pastiglie: [], elenco: "" });

/** Quali voci si vedono, e da quale contatto arriva la posta. */
export const CHIAVE_BARRA = "cd_barra_casa";

/* Cosa sa questo dispositivo della cassetta: com'era l'ultima volta che l'ha
 * guardata, quando e' arrivata la posta e quando qualcuno l'ha ritirata.
 *
 * Non viaggia con la configurazione, ed e' voluto due volte. Lo scatto di
 * prima e' quello che permette di accorgersi di un'apertura avvenuta mentre
 * non si guardava: se fosse condiviso, il tablet acceso in cucina se ne
 * accorgerebbe per primo, aggiornerebbe lo scatto per tutti, e il telefono
 * ripreso in mano dopo non avrebbe piu' niente da confrontare. E il «vista»
 * e' di chi guarda: chi ritira la posta la ritira, chi non l'ha ancora vista
 * deve poterla vedere. */
const CHIAVE_POSTA = "cd_posta_stato";

/* ── le letture ─────────────────────────────────────────────────────────── */

function configurazione() {
  return normalizzaBarra(readJson(CHIAVE_BARRA, {}));
}

function memoriaDellaPosta() {
  const dato = readJson(CHIAVE_POSTA, {});
  return dato && typeof dato === "object" && !Array.isArray(dato) ? dato : {};
}

/* Il contatto della cassetta com'e' adesso.
 *
 * Il verso lo dice la stessa casella che lo dice a tutte le altre aperture
 * (#244): ci sono contatti che stanno a ON quando sono CHIUSI, e chi ne ha
 * uno l'ha gia' dichiarato una volta per tutta la plancia. */
function letturaDellaCassetta(entity, states) {
  const id = clean(entity);
  if (!id) return null;
  const risolta = clean(root.resolveEntity?.(id) || id);
  const stato = states?.[risolta] || states?.[id];
  if (!stato) return null;
  const girati = insiemeInvertiti(readJson(CHIAVE_VERSI, []));
  const aperto = apertaSecondoVerso(
    windowOpenFromState(stato.state),
    girati.has(risolta) || girati.has(id),
  );
  if (aperto === null) return null;
  const quando = Date.parse(stato.last_changed || stato.last_updated || "");
  return { aperto, cambiatoIl: Number.isFinite(quando) ? quando : Date.now() };
}

/* Le due misure scelte a mano, com'e' adesso ognuna (#461).
 *
 * «Ho un sensore esterno all'abitazione con cui mi regolo con i clima interni»:
 * il sensore lo sceglie chi abita la casa, e qui si legge quello e basta.
 * L'unita' la dichiara Home Assistant — °C o °F, % — e riscriverla a mano
 * vorrebbe dire dire gradi centigradi a chi li ha in Fahrenheit. Il nome serve
 * a chi si ferma sopra: nella pastiglia non ci sta, nel titolo si'.
 *
 * Una misura che non si sa non e' una misura a zero: torna `null`, e la
 * pastiglia semplicemente non compare. */
function letturaDellaMisura(entity, states) {
  const id = clean(entity);
  if (!id) return null;
  const risolta = clean(root.resolveEntity?.(id) || id);
  const stato = states?.[risolta] || states?.[id];
  if (!stato) return null;
  const valore = Number.parseFloat(String(stato.state ?? "").replace(",", "."));
  if (!Number.isFinite(valore)) return null;
  return {
    valore,
    unita: clean(stato.attributes?.unit_of_measurement),
    nome: clean(stato.attributes?.friendly_name) || id,
  };
}

/** Le misure della barra, gia' lette: il nucleo non guarda nessuna entita'. */
function leMisureAdesso(config, states) {
  return {
    temperatura: letturaDellaMisura(config.temperatura, states),
    umidita: letturaDellaMisura(config.umidita, states),
    pioggia: letturaDellaMisura(config.pioggia, states),
    pioggiaOggi: letturaDellaMisura(config.pioggiaOggi, states),
  };
}

/* Un'entita' scelta a mano, com'e' adesso (#7).
 *
 * Qui non si sa che cosa sara': un numero con la sua unita', una parola, un
 * orario. Percio' si legge tutto e si dichiara quale delle due cose e': il
 * numero solo quando lo stato E' un numero per intero, non quando ne comincia
 * con uno. «12:30» comincia con 12 e non e' dodici, e una lettura letta a
 * meta' e' peggio di una lettura che manca.
 *
 * La parola e' quella tradotta — «Acceso», non `on` — dalla stessa tabella con
 * cui parla l'elenco di cosa e' acceso: chi guarda la plancia in italiano non
 * deve trovarsi una parola inglese in mezzo alla fascia.
 *
 * Il segno lo dichiara Home Assistant quando ce l'ha (`icon`): un'entita' che
 * ha gia' la sua faccia se la porta dietro, e chi la vuole diversa la scrive
 * nella configurazione, che vince.
 *
 * Un'entita' che non risponde torna `null`: la pastiglia non compare, come per
 * tutte le altre voci della fascia.
 */
const SOLO_UN_NUMERO = /^-?\d+(?:[.,]\d+)?$/;

export function letturaDellaMia(entity, states) {
  const id = clean(entity);
  if (!id) return null;
  const risolta = clean(root.resolveEntity?.(id) || id);
  const stato = states?.[risolta] || states?.[id];
  if (!stato) return null;
  const grezzo = clean(stato.state);
  if (!grezzo || /^(unknown|unavailable)$/i.test(grezzo)) return null;
  const numero = SOLO_UN_NUMERO.test(grezzo) ? Number(grezzo.replace(",", ".")) : NaN;
  return {
    valore: Number.isFinite(numero) ? numero : null,
    testo: Number.isFinite(numero) ? "" : parolaDiStato(grezzo),
    unita: clean(stato.attributes?.unit_of_measurement),
    nome: clean(stato.attributes?.friendly_name) || id,
    icona: clean(stato.attributes?.icon),
  };
}

/* Com'e' adesso la voce che decide se una pastiglia si vede.
 *
 * Si legge grezza, come la dice Home Assistant: il confronto con quello che
 * ha scritto chi configura lo fa il nucleo, dove si prova senza un documento.
 * Un'entita' che non risponde torna stringa vuota, e li' il nucleo dice di
 * no — non si annuncia la modalita' vacanze quando non si sa se e' attiva. */
function condizioneDellaMia(entity, states) {
  const id = clean(entity);
  if (!id) return "";
  const risolta = clean(root.resolveEntity?.(id) || id);
  const stato = states?.[risolta] || states?.[id];
  const grezzo = clean(stato?.state);
  return !grezzo || /^(unknown|unavailable)$/i.test(grezzo) ? "" : grezzo;
}

/**
 * Le pastiglie scelte a mano, gia' lette: una voce per entita' configurata.
 *
 * Esportata perche' la provano: qui si leggono DUE entita' per riga — quella
 * da mostrare e quella che decide se si vede — e scambiarle vorrebbe dire una
 * fascia che mostra lo stato dell'interruttore delle vacanze.
 */
export function leMieAdesso(config, states) {
  const fuori = {};
  for (const mia of config.mie) {
    if (!mia.entity || fuori[mia.entity]) continue;
    fuori[mia.entity] = {
      ...(letturaDellaMia(mia.entity, states) || {}),
      condizione: condizioneDellaMia(mia.quando, states),
    };
  }
  return fuori;
}

/* Le due letture della pioggia, per chi le chiede da fuori (#478).
 *
 * L'irrigazione le legge da qui invece di avere due caselle sue: chi ha una
 * stazione meteo l'ha gia' dichiarata una volta, e due caselle per lo stesso
 * pluviometro sono due caselle che possono discordare. */
export function letturePioggia(states = allStates()) {
  const config = configurazione();
  return {
    intensita: letturaDellaMisura(config.pioggia, states),
    oggi: letturaDellaMisura(config.pioggiaOggi, states),
  };
}

/* Cosa dice la cassetta, e cosa se ne ricorda questo dispositivo.
 *
 * La memoria si riscrive solo quando e' cambiata davvero: questa funzione gira
 * a ogni giro di disegno della Home, cioe' molte volte al minuto. */
function laPostaAdesso(config, states) {
  const passo = passoDellaPosta(memoriaDellaPosta(), letturaDellaCassetta(config.posta, states));
  if (passo.cambiata) writeJsonIfChanged(CHIAVE_POSTA, passo.memoria, { sync: false });
  return passo;
}

/* ── le parole ──────────────────────────────────────────────────────────── */

/* La frase di una pastiglia che conta. Singolare e plurale separati: «1 luci
 * accese» e' il genere di sciatteria che si nota subito. */
/* La parola del conto, senza il numero dentro.
 *
 * Qui c'era `t(`${conto} luci accese`, ...)`, e il numero dentro la frase la
 * rompeva due volte. Una a schermo: «2 luci accese» tutto della stessa
 * grandezza, quando il resto della plancia il numero lo dice grosso e la parola
 * piccola. E una nei cataloghi: una chiave costruita con un valore dentro
 * cambia a ogni conto — «2 luci accese», «3 luci accese» — e nessuna di quelle
 * chiavi sta in nessuno dei tredici cataloghi. In italiano non si vedeva
 * perche' l'italiano e' la lingua sorgente; in tutte le altre quelle frasi non
 * sono mai state tradotte.
 *
 * Il numero esce dalla frase e resta un numero. Le parole diventano quattordici
 * chiavi ferme, che si traducono una volta e valgono per ogni conto.
 */
function parolaDelConto(chiave, conto, modello = null) {
  const uno = conto === 1;
  if (chiave === "luci") return uno ? t("luce accesa", "light on") : t("luci accese", "lights on");
  if (chiave === "tapparelle") {
    /* Dove non c'e' un solo contatto sull'anta, quel conto sono i motori
     * alzati e non le finestre aperte (#31): la tessera lo dice giusto da
     * quando c'e' la #442, qui arrivava solo il numero. */
    if (modello?.soloMotori)
      return uno ? t("tapparella alzata", "shutter up") : t("tapparelle alzate", "shutters up");
    return uno ? t("finestra aperta", "window open") : t("finestre aperte", "windows open");
  }
  if (chiave === "clima") return uno ? t("unità accesa", "unit on") : t("unità accese", "units on");
  if (chiave === "prese")
    return uno ? t("presa accesa", "socket on") : t("prese accese", "sockets on");
  if (chiave === "porte") return uno ? t("porta aperta", "door open") : t("porte aperte", "doors open");
  if (chiave === "varchi") return uno ? t("varco aperto", "opening open") : t("varchi aperti", "openings open");
  /* «In una stanza c'e' qualcuno» — la stanza, non il rilevatore: e' il posto
   * che la tessera conta, ed e' la risposta che uno cerca passando davanti. */
  if (chiave === "presenza")
    return uno ? t("stanza occupata", "room busy") : t("stanze occupate", "rooms busy");
  if (chiave === "stampanti")
    return uno
      ? t("stampante da guardare", "printer to check")
      : t("stampanti da guardare", "printers to check");
  /* «Credo che con aggiornamenti da eseguire il testo dovrebbe essere
   * Aggiornamenti pendenti» (#108): la parola che manca e' «in attesa». La
   * pastiglia esiste solo quando c'e' qualcosa da fare, e dirlo e' proprio il
   * suo mestiere. */
  if (chiave === "aggiornamenti")
    return uno
      ? t("aggiornamento in attesa", "update pending")
      : t("aggiornamenti in attesa", "updates pending");
  return uno ? t("in riproduzione", "playing") : t("in riproduzione", "playing");
}

/* Cosa e' acceso, dietro una pastiglia che conta.
 *
 * Le voci arrivano dal modello della tessera — sono le stesse righe che la
 * tessera conta — e le portano solo le pastiglie che dicono un numero: la
 * posta, il ritiro dei rifiuti, l'antifurto e le quattro misure raccontano una
 * cosa sola, e una cosa sola non e' un elenco. */
function vociDellaPastiglia(pastiglia) {
  return Array.isArray(pastiglia?.voci) ? pastiglia.voci : [];
}

/**
 * Le due righe di una voce, e cosa dice per esteso a chi si ferma.
 *
 * `testa` e' la parola grossa — il numero, il nome del ritiro, come sta
 * l'antifurto — e `coda` la micro-etichetta maiuscola che la qualifica. Sono la
 * stessa coppia con cui parla il resto della plancia: il numero grande e sotto
 * la parolina spaziata, come sulle tessere e sul carico del MiniPC. Averla
 * uguale per tutte le voci e' quello che fa sembrare la fascia una cosa sola
 * invece di sei etichette diverse messe in fila.
 */
function paroleDellaPastiglia(pastiglia) {
  if (pastiglia.chiave === "posta") {
    const coda = t("è arrivata", "has arrived");
    return {
      testa: t("Posta", "Mail"),
      coda,
      titolo: `${t("È arrivata la posta", "The mail has arrived")} — ${t("tocca per dire che l'hai ritirata", "tap to say you have collected it")}`,
    };
  }
  if (pastiglia.chiave === "rifiuti") {
    const quando = parolaDelQuando(pastiglia);
    const testa = pastiglia.nome || t("Ritiro", "Collection");
    return { testa, coda: quando, titolo: `${testa} · ${quando}` };
  }
  if (pastiglia.chiave === "sicurezza")
    return {
      testa: pastiglia.valore,
      coda: t("antifurto", "alarm"),
      titolo: pastiglia.valore,
    };
  if (pastiglia.chiave === "pioggia" || pastiglia.chiave === "pioggiaOggi") {
    /* La pioggia si scrive col decimo: fra zero e 0,4 mm all'ora c'e' la
     * differenza fra «piove» e «non piove», e arrotondare la cancella. */
    const testa = `${formatNumber(pastiglia.valore, 1)}${pastiglia.unita ? ` ${pastiglia.unita}` : ""}`;
    const coda =
      pastiglia.chiave === "pioggia" ? t("pioggia", "rain") : t("oggi", "today");
    return {
      testa,
      coda,
      titolo: pastiglia.nome ? `${pastiglia.nome} · ${testa}` : `${testa} ${coda}`,
    };
  }
  if (pastiglia.chiave === "temperatura" || pastiglia.chiave === "umidita") {
    /* La temperatura si scrive col decimo — fra 21 e 21,5 c'e' la differenza
     * per cui uno guarda il sensore — l'umidita' no: mezzo punto percentuale
     * non cambia niente a nessuno. */
    const decimali = pastiglia.chiave === "temperatura" ? 1 : 0;
    const testa = `${formatNumber(pastiglia.valore, decimali)}${pastiglia.unita ? ` ${pastiglia.unita}` : ""}`;
    const coda =
      pastiglia.chiave === "temperatura"
        ? t("temperatura", "temperature")
        : t("umidità", "humidity");
    /* Il nome del sensore nel titolo: nella pastiglia non ci starebbe, e sapere
     * QUALE sensore e' l'unica cosa che il numero da solo non dice. */
    return { testa, coda, titolo: pastiglia.nome ? `${pastiglia.nome} · ${testa}` : `${testa} ${coda}` };
  }
  if (pastiglia.chiave === "mia") {
    /* Il numero si scrive come lo scrivono le misure: col decimo se ce l'ha,
     * intero se e' intero. Qui non si sa che cosa sia — potenza, litri, un
     * conto di cose — e aggiungere un decimo a un numero tondo lo farebbe
     * sembrare una misura fine che non e'. */
    const testa = Number.isFinite(pastiglia.valore)
      ? `${formatNumber(pastiglia.valore, Number.isInteger(pastiglia.valore) ? 0 : 1)}${
          pastiglia.unita ? ` ${pastiglia.unita}` : ""
        }`
      : pastiglia.testo;
    /* La coda e' il nome che le ha dato chi l'ha messa li': la pastiglia dice
     * un numero, e senza il nome quel numero non e' di niente. */
    return { testa, coda: pastiglia.nome, titolo: `${pastiglia.nome} · ${testa}` };
  }
  const parola = parolaDelConto(pastiglia.chiave, pastiglia.conto, pastiglia);
  const testa = String(pastiglia.conto);
  const nomi = vociDellaPastiglia(pastiglia)
    .map((voce) => voce.name)
    .filter(Boolean)
    .join(" · ");
  const disteso = `${testa} ${parola}`;
  return { testa, coda: parola, titolo: nomi ? `${disteso}: ${nomi}` : disteso };
}

/* ── il disegno ─────────────────────────────────────────────────────────── */

/* La faccia della pastiglia: lo stesso disegno della sua tessera.
 *
 * Le pastiglie mostravano l'emoji di sistema, che cambia faccia da un telefono
 * a un altro e stava sopra una fila di tessere disegnate: due stili nella
 * stessa schermata, a tre dita di distanza. Si chiede lo stesso disegno che
 * chiede la tessera — `oggettoWidget` per le sezioni che ce l'hanno, il motore
 * delle icone per le altre — e l'emoji resta il ripiego di chi non ha nessuna
 * delle due. */
function facciaDellaPastiglia(pastiglia) {
  const chiave = clean(pastiglia?.chiave);
  /* Col posto: la pastiglia si porta dietro le SUE sfumature invece di
   * prenderle dal foglio in cima al corpo, che e' un rimando fra elementi
   * diversi e su WebKit lascia il disegno trasparente. Il posto e' la
   * chiave: una pastiglia per chiave, quindi sempre lo stesso a ogni giro. */
  if (haOggettoWidget(chiave)) return oggettoWidget(chiave, "", `fascia-${chiave}`);
  const nome = clean(pastiglia?.mdi);
  if (nome) return iconGlyphMarkup("action", nome, { size: 16 });
  return `<span class="dm-casa-emoji">${esc(String(pastiglia?.icona ?? ""))}</span>`;
}

/* Una pastiglia nuova, ancora senza parole: le mette `vestiLaPastiglia`. */
function nuovaPastiglia(pastiglia) {
  const nodo = doc.createElement("button");
  nodo.type = "button";
  nodo.className = "dm-casa-pastiglia";
  /* Due nomi, e servono tutti e due. `data-dm-casa` dice DI COSA parla la
   * pastiglia — lo leggono il tocco, che apre la cosa giusta, e lo stile, che
   * su «posta» accende l'animazione dello sportello. `data-dm-voce` dice QUALE
   * pastiglia e': con due bidoni fuori stasera ci sono due pastiglie che
   * parlano di rifiuti, e riconoscerle dalla sola chiave vorrebbe dire
   * scambiarle a ogni giro (#567). */
  nodo.dataset.dmCasa = pastiglia.chiave;
  nodo.dataset.dmVoce = pastiglia.id || pastiglia.chiave;
  nodo.innerHTML = `<span class="dm-casa-chip" aria-hidden="true"></span>
    <span class="dm-casa-testo"><b class="dm-casa-testa"></b><small class="dm-casa-coda"></small></span>`;
  return nodo;
}

/* Le parole addosso a una pastiglia che c'e' gia'.
 *
 * Si scrive solo quello che e' cambiato davvero. Riscrivere un attributo col
 * valore che aveva gia' non e' gratis: `data-avviso` e `data-dm-casa` sono i
 * ganci con cui lo stile accende l'animazione della posta, e toccarli la fa
 * ripartire da capo. */
function vestiLaPastiglia(nodo, pastiglia) {
  const { testa, coda, titolo } = paroleDellaPastiglia(pastiglia);
  const scrivi = (elemento, campo, valore) => {
    if (elemento && elemento[campo] !== valore) elemento[campo] = valore;
  };
  const attributo = (nome, valore) => {
    if (nodo.getAttribute(nome) !== valore) nodo.setAttribute(nome, valore);
  };
  attributo("data-tessera", pastiglia.tessera || "");
  /* L'entita' delle pastiglie scelte a mano (#7): una tessera non ce l'hanno,
   * e toccandole si apre la loro scheda di Home Assistant. */
  attributo("data-dm-entita", pastiglia.entity || "");
  attributo("data-avviso", String(Boolean(pastiglia.avviso)));
  attributo("title", titolo);
  attributo("aria-label", titolo);
  /* La tinta e' quella della tessera che racconta la stessa cosa per esteso:
   * si scrive sulla pastiglia come variabile, e lo stile la usa per il
   * riquadro del disegno. */
  const tinta = clean(pastiglia.tinta);
  if (tinta && nodo.style.getPropertyValue("--dm-casa-tinta") !== tinta)
    nodo.style.setProperty("--dm-casa-tinta", tinta);
  const chip = nodo.querySelector(".dm-casa-chip");
  const faccia = facciaDellaPastiglia(pastiglia);
  if (chip && chip.innerHTML !== faccia) chip.innerHTML = faccia;
  scrivi(nodo.querySelector(".dm-casa-testa"), "textContent", testa);
  scrivi(nodo.querySelector(".dm-casa-coda"), "textContent", coda);
}

/* Le pastiglie si aggiornano al loro posto, una per una.
 *
 * Riscrivere tutta la riga a ogni cambiamento farebbe rinascere anche le
 * pastiglie che non c'entrano niente: si accende una luce, il conto passa da 2
 * a 3, e la posta — che e' la sola voce animata — ricomincia a sbattere lo
 * sportello da capo, come se fosse appena arrivata. Ognuna e' riconosciuta
 * dalla sua chiave: quelle che restano cambiano solo le parole, quelle nuove
 * nascono al loro posto, quelle che non hanno piu' niente da dire se ne vanno.
 */
function aggiornaLePastiglie(riga, pastiglie) {
  const vive = new Map();
  for (const nodo of riga.querySelectorAll(":scope > [data-dm-voce]"))
    vive.set(nodo.dataset.dmVoce, nodo);
  let posto = riga.firstElementChild;
  for (const pastiglia of pastiglie) {
    const voce = pastiglia.id || pastiglia.chiave;
    const gia = vive.get(voce);
    vive.delete(voce);
    const nodo = gia || nuovaPastiglia(pastiglia);
    vestiLaPastiglia(nodo, pastiglia);
    if (nodo === posto) posto = posto.nextElementSibling;
    else riga.insertBefore(nodo, posto);
  }
  for (const nodo of vive.values()) nodo.remove();
}

/* Cosa dice la riga adesso, in una riga di testo: serve solo a saltare il giro
 * quando non e' cambiato niente. */
function firmaDellaRiga(pastiglie) {
  return pastiglie
    .map((pastiglia) => {
      const { testa, coda } = paroleDellaPastiglia(pastiglia);
      return `${pastiglia.id || pastiglia.chiave}~${pastiglia.icona}~${pastiglia.tinta}~${testa}~${coda}~${Boolean(pastiglia.avviso)}`;
    })
    .join("|");
}

/* La riga sta subito sotto il meteo. Nasce solo quando c'e' qualcosa da dire e
 * se ne va quando non ce n'e' piu': una fascia vuota sotto il meteo sarebbe
 * spazio speso per niente. */
/* La corsia in cima alla Home: gli avvisi e la fascia di cosa e' acceso.
 *
 * «I dispositivi accesi affianco, con una differenza: gli alert restano fissi,
 * i dispositivi accesi scorrono. Rendi omogenea la grafica.»
 *
 * Sono due cose diverse e vanno lette insieme, quindi stanno sulla stessa
 * riga: a sinistra quello che chiede attenzione adesso, subito accanto quello
 * che la casa sta facendo. La differenza e' nel modo, non nel vestito — un
 * avviso che scorresse via mentre lo leggi non sarebbe un avviso, e una fila
 * di stati ferma dovrebbe stare tutta dentro lo schermo.
 *
 * Sta qui e non in chi fa gli avvisi perche' il POSTO e' questo: sotto il
 * meteo e sopra le pastiglie del guscio, che e' il punto da cui l'ordine dei
 * blocchi riparte a impaginare. Chi vuole mettere un avviso in cima alla Home
 * chiede la corsia a questa funzione e ci appende il suo — cosi' il secondo
 * avviso che nascera' si mettera' in fila accanto al primo invece di
 * inventarsi un altro posto. */
export function corsiaDegliAvvisi() {
  const pagina = doc?.getElementById?.("page-home");
  if (!pagina) return null;
  const gia = doc.getElementById("dm-casa-fascia");
  if (gia?.parentElement === pagina) return gia;
  const corsia = gia || doc.createElement("div");
  corsia.id = "dm-casa-fascia";
  corsia.className = "dm-casa-fascia";
  /* Sotto il meteo vuol dire due posti diversi, e sono lo stesso posto: quando
   * il meteo sta ancora nella pagina, subito dopo di lui; quando invece e'
   * salito nella testata — la fascia in cima, che sta fuori dalla pagina — il
   * primo posto della Home E' quello sotto il meteo. */
  const meteo = pagina.querySelector(":scope > .weather-widget");
  if (meteo) meteo.after(corsia);
  else pagina.prepend(corsia);
  return corsia;
}

function ospite() {
  const corsia = corsiaDegliAvvisi();
  if (!corsia) return null;
  const gia = doc.getElementById("dm-casa-riga");
  if (gia?.parentElement === corsia) return gia;
  const riga = gia || doc.createElement("div");
  riga.id = "dm-casa-riga";
  riga.className = "dm-casa-riga";
  /* Le pastiglie stanno su un nastro, e la fascia lo ritaglia: e' il nastro a
   * scorrere, non lo scorrimento della fascia. Cosi' il movimento lo fa il
   * compositore e non c'e' nessun timer che sposti niente. */
  if (!riga.querySelector(":scope > .dm-casa-nastro")) {
    const nastro = doc.createElement("div");
    nastro.className = "dm-casa-nastro";
    riga.append(nastro);
  }
  /* Nella corsia sta sempre DOPO gli avvisi: quello che chiede attenzione si
   * legge prima di quello che descrive. */
  corsia.append(riga);
  return riga;
}

/* ── la deriva della fascia ──────────────────────────────────────────────── */

/* Quanta strada c'e' da fare, detta al foglio di stile una volta per disegno.
 *
 * Il foglio sa animare, ma non sa quanto sono larghe le pastiglie: quella
 * misura la puo' prendere solo chi ha il documento in mano, e la prende quando
 * il disegno e' appena finito — non a ogni fotogramma. Da qui in poi si muove
 * tutto da solo.
 *
 * `data-dm-deriva` accende l'animazione e le sfumature ai bordi: senza di lui
 * una fascia che ci sta tutta resterebbe ferma ma sfumata, cioe' direbbe che
 * c'e' altro quando non c'e'. */
/* Quanto misura il bordo interno della fascia, che il nastro non ha.
 *
 * E' l'unica cosa che sa il documento e non sa `spazioDaPercorrere`: la
 * misura si prende una volta per disegno, come le altre di qui, non a ogni
 * fotogramma. */
function imbottituraDellaFascia(riga) {
  const stile = root.getComputedStyle?.(riga);
  return (parseFloat(stile?.paddingLeft) || 0) + (parseFloat(stile?.paddingRight) || 0);
}

function tieniLaFasciaInMovimento(riga) {
  const nastro = riga?.querySelector(":scope > .dm-casa-nastro");
  if (!nastro) return false;
  const fuori = spazioDaPercorrere({
    scrollWidth: nastro.scrollWidth,
    clientWidth: riga.clientWidth,
    imbottitura: imbottituraDellaFascia(riga),
  });
  /* La corsa e' quello che sporge piu' un velo per capo: cosi' la prima e
   * l'ultima pastiglia, dove il nastro si ferma, escono da sotto la
   * sfumatura. Il velo lo dice il modulo, e lo scriviamo anche nel foglio —
   * la sfumatura si disegna con questo numero, non con una sua copia. */
  const strada = laCorsaDelNastro(fuori);
  if (!strada) {
    delete riga.dataset.dmDeriva;
    riga.style.removeProperty("--dm-casa-velo");
    riga.style.removeProperty("--dm-casa-strada");
    riga.style.removeProperty("--dm-casa-durata");
    return false;
  }
  riga.style.setProperty("--dm-casa-velo", `${VELO_DELLA_FASCIA}px`);
  riga.style.setProperty("--dm-casa-strada", `${strada}px`);
  riga.style.setProperty("--dm-casa-durata", `${durataDellaDeriva(strada)}s`);
  riga.dataset.dmDeriva = "true";
  return true;
}

/**
 * Disegna la riga con i modelli delle tessere di questo giro.
 *
 * La chiama `renderHomeWidgets`, che i modelli li ha appena fatti. Si tocca
 * solo quando cambia qualcosa: la Home si ridisegna a ogni evento di stato, e
 * rifare il disegno a ogni giro vorrebbe dire far ripartire l'animazione della
 * posta due volte al secondo.
 */
export function disegnaComeStaLaCasa(modelli, states) {
  if (!doc) return false;
  const config = configurazione();
  const posta = laPostaAdesso(config, states || {});
  const pastiglie = pastiglieDellaCasa(modelli, {
    barra: config,
    posta,
    misure: leMisureAdesso(config, states || {}),
    /* Le entita' scelte a mano, gia' lette anche loro, e con loro com'e'
     * adesso la voce che decide se si vedono (#7). */
    mie: leMieAdesso(config, states || {}),
    /* L'ora di adesso: serve a chi ha chiesto che dopo una certa ora la
     * pastiglia dei rifiuti passi al ritiro di domani (#565). L'orologio lo
     * legge la sezione, come tutto quello che viene da fuori: il nucleo fa i
     * conti su quello che gli si porta. */
    adesso: new Date(),
  });
  /* Quello che la barra sa adesso lo sa anche l'elenco aperto: e' lo stesso
   * conto, e rifarlo per conto suo vorrebbe dire due conti sulla stessa casa. */
  state.pastiglie = pastiglie;
  disegnaLElenco();
  const riga = pastiglie.length ? ospite() : doc.getElementById("dm-casa-riga");
  if (!riga) return false;
  if (!pastiglie.length) {
    riga.remove();
    state.firma = "";
    return false;
  }
  const nastro = riga.querySelector(":scope > .dm-casa-nastro") || riga;
  const attuale = firmaDellaRiga(pastiglie);
  if (state.firma !== attuale || nastro.childElementCount !== pastiglie.length) {
    state.firma = attuale;
    aggiornaLePastiglie(nastro, pastiglie);
  }
  /* Dopo il disegno, non prima: quante pastiglie ci stanno lo si sa solo a
   * fascia piena. */
  tieniLaFasciaInMovimento(riga);
  return true;
}

/* ── l'elenco di cosa e' acceso ─────────────────────────────────────────── */

/* «Devi cambiare popup dei dispositivi accesi che sono nella barra sotto al
 * menu. Devi mostrare solo quelli accesi e non una replica del popup widget.»
 *
 * La pastiglia apriva la tessera: «2 LUCI ACCESE» faceva aprire il popup delle
 * luci, che le mostra tutte — accese e spente, in zone, con i cursori. Da una
 * pastiglia che dice DUE ci si aspetta quelle due, e infatti e' il motivo per
 * cui uno la tocca: «quali sono rimaste accese?».
 *
 * Questa finestra e' sua. Non passa dal `#details-modal` del guscio: quello
 * ha un tipo attivo (`currentPopupType`) che il giro di disegno del guscio
 * ridisegna da solo a ogni notizia, e un elenco nostro dentro casa sua
 * sarebbe cancellato al primo cambio di stato. Il vestito pero' e' lo stesso —
 * le classi del guscio, quelle che vestono tutte le altre finestre — cosi'
 * questa e' una finestra della plancia e non una finestra a parte.
 */
const POPUP = "dm-casa-popup";

/* Le pastiglie che un elenco ce l'hanno. Le altre — posta, rifiuti,
 * antifurto, le misure — raccontano una cosa sola e continuano ad aprire la
 * loro tessera, che e' dove quella cosa si guarda per esteso. */
function haUnElenco(pastiglia) {
  return vociDellaPastiglia(pastiglia).length > 0;
}

function pastigliaDiChiave(chiave) {
  const cercata = clean(chiave);
  return (state.pastiglie || []).find((voce) => clean(voce?.chiave) === cercata) || null;
}

/* La finestra, una sola e sempre la stessa: nasce al primo elenco e da li' in
 * poi si riempie e si mostra. */
function finestra() {
  let nodo = doc.getElementById(POPUP);
  if (nodo) return nodo;
  nodo = doc.createElement("div");
  nodo.id = POPUP;
  nodo.hidden = true;
  /* La veste e' quella delle altre finestre della plancia — l'intestazione col
   * disegno, il titolo e il tasto che chiude, il corpo che scorre sotto — e non
   * si riscrive qui: le regole stanno nel foglio del ponte dei widget, che le
   * dichiara per «una finestra della plancia» e non per la sua soltanto.
   * Riscriverle sarebbe due vesti che si scollano alla prima ritoccata.
   *
   * Quello che cambia e' cio' che c'e' dentro: qui non c'e' la tessera aperta,
   * ci sono le cose accese e i tasti per spegnerle — «devi mostrare solo quelli
   * accesi e non una replica del popup widget». */
  nodo.innerHTML = `<article class="dm-widget-detail" data-dm-casa-scheda>
      <header class="dm-w-head">
        <button type="button" class="dm-w-close" data-dm-casa-chiudi aria-label="${esc(t("Chiudi", "Close"))}"><span aria-hidden="true">✕</span> ${esc(t("Chiudi", "Close"))}</button>
        <span class="dm-w-head-ic" aria-hidden="true" data-dm-casa-faccia></span>
        <strong data-dm-casa-titolo></strong>
        <small data-dm-casa-sotto></small>
      </header>
      <div class="dm-w-body dm-casa-elenco" data-dm-casa-elenco></div>
    </article>`;
  doc.body.append(nodo);
  return nodo;
}

/* Le pastiglie che parlano di qualcosa che si apre: li' «acceso» non e' la
 * parola: una finestra e' aperta, e chi legge «ON» sotto il nome di una
 * finestra deve tradurselo da solo. */
const SI_APRONO = new Set(["varchi", "porte", "finestre", "tapparelle"]);

/* Com'e' adesso quella voce, IN PAROLE.
 *
 * Prima si scriveva quello che dice Home Assistant e basta — `on`, `off`,
 * `unavailable` — sotto l'identificatore dell'entita' in maiuscolo:
 *
 *     BINARY_SENSOR.FINESTRA_BAGNO_GRANDE_CONTACT · ON
 *
 * Due righe per non dire niente. L'identificatore e' il nome che quella cosa
 * ha dentro Home Assistant, e in una plancia non serve a chi guarda: serve a
 * chi configura, e in configurazione infatti c'e'. E `ON` non e' una parola
 * italiana.
 *
 * Adesso resta il nome, e accanto c'e' com'e' adesso, detto: «Aperta»,
 * «Accesa», «In riproduzione». Le parole sono quelle di
 * `le-parole-di-home-assistant.js`, che e' il posto dove stanno tutte — e per
 * le cose che si aprono quelle al femminile, che e' l'altra meta' della stessa
 * tabella. Una voce che non risponde piu' lo dice.
 *
 * Esportata perche' la provano: le parole cambiano col tipo di pastiglia, e i
 * tipi sono sette — leggerle dal disegno di una finestra alla volta vorrebbe
 * dire provarne uno e fidarsi degli altri sei. */
export function statoDellaVoce(entity, states, chiave = "") {
  const id = clean(entity);
  if (!id) return { parola: "", muta: true };
  const risolta = clean(root.resolveEntity?.(id) || id);
  const stato = states?.[risolta] || states?.[id];
  const grezzo = clean(stato?.state);
  if (!grezzo || /^(unknown|unavailable)$/i.test(grezzo))
    return { parola: t("non risponde", "not responding"), muta: true };
  if (SI_APRONO.has(clean(chiave))) {
    /* Un contatto dice `on` quando e' aperto: e' la stessa cosa detta nella
     * lingua dei sensori. */
    const comeSiApre = { on: "open", off: "closed" }[grezzo.toLowerCase()] || grezzo;
    const detta = parolaDellaPorta(comeSiApre);
    if (detta) return { parola: detta, muta: false };
  }
  return { parola: parolaDiStato(grezzo), muta: false };
}

function rigaDellElenco(voce, states, chiave = "") {
  const entita = clean(voce?.entity);
  const nome = clean(voce?.name) || entita;
  const comando = comandoPerSpegnere(entita, states?.[entita]);
  const parole = {
    spegni: t("Spegni", "Turn off"),
    chiudi: t("Chiudi", "Close"),
    pausa: t("Pausa", "Pause"),
    ferma: t("Ferma", "Stop"),
  };
  /* Il lucchetto vale anche qui (#539).
   *
   * «Ho bloccato una entita' luci che non si deve spegnere. Nel widget basso
   * premendo su LUCI mi rileva accesa e non me la fa spegnere, mentre sotto la
   * barra meteo, sul riassunto di casa, quell'entita' mi mette il pulsante
   * spegni e la spengo.»
   *
   * Un blocco che vale in un posto e non nell'altro non e' un blocco: e' una
   * cosa in piu' da ricordarsi. La riga resta — vedere che e' accesa e' il
   * motivo per cui la si tiene in elenco — e sparisce solo il tasto. */
  const tasto =
    comando && siComanda(entita)
      ? `<button type="button" class="dm-casa-spegni" data-dm-casa-spegni="${esc(entita)}">${esc(
          parole[comando.parola] || parole.spegni,
        )}</button>`
      : "";
  const adesso = statoDellaVoce(entita, states, chiave);
  const pastiglia = adesso.parola
    ? `<span class="dm-casa-stato" data-dm-muta="${adesso.muta}"><i aria-hidden="true"></i>${esc(
        adesso.parola,
      )}</span>`
    : "";
  return `<div class="detail-row dm-casa-voce">
      <div class="d-info">
        <div class="d-name">${esc(nome)}</div>
      </div>${pastiglia}${tasto}</div>`;
}

/** Riempie l'elenco aperto con quello che e' acceso adesso. */
export function disegnaLElenco() {
  const chiave = clean(state.elenco);
  if (!chiave) return false;
  const nodo = doc?.getElementById?.(POPUP);
  if (!nodo || nodo.hidden) return false;
  const pastiglia = pastigliaDiChiave(chiave);
  const voci = vociDellaPastiglia(pastiglia);
  const titolo = nodo.querySelector("[data-dm-casa-titolo]");
  const elenco = nodo.querySelector("[data-dm-casa-elenco]");
  const faccia = nodo.querySelector("[data-dm-casa-faccia]");
  const sotto = nodo.querySelector("[data-dm-casa-sotto]");
  if (!titolo || !elenco) return false;
  /* Il disegno e' quello della pastiglia che si e' toccata, che e' quello
   * della sua tessera: chi ha toccato la lampadina la ritrova in cima. */
  if (faccia && pastiglia) {
    const disegno = facciaDellaPastiglia(pastiglia);
    if (faccia.innerHTML !== disegno) faccia.innerHTML = disegno;
  }
  /* E l'accento: la finestra prende il colore della cosa che racconta, come
   * fa la tessera aperta. */
  const tinta = clean(pastiglia?.tinta) || "#0ea5e9";
  const scheda = nodo.querySelector("[data-dm-casa-scheda]");
  if (scheda && scheda.style.getPropertyValue("--dm-widget-accent") !== tinta)
    scheda.style.setProperty("--dm-widget-accent", tinta);
  /* Il titolo e' quello che dice la pastiglia: «2 luci accese». Chi ha toccato
   * quella frase deve ritrovarla in cima, o non sa di aver aperto lei. */
  const { testa, coda } = pastiglia
    ? paroleDellaPastiglia(pastiglia)
    : { testa: "", coda: t("niente di acceso", "nothing on") };
  const parole = `${testa} ${coda}`.trim().toUpperCase();
  if (titolo.textContent !== parole) titolo.textContent = parole;
  const states = allStates() || {};
  /* Quando l'ultima si spegne l'elenco non resta aperto a dire il vuoto: la
   * domanda «cosa e' rimasto acceso» ha avuto la sua risposta. */
  if (!voci.length) {
    chiudiLElenco();
    return false;
  }
  if (sotto) {
    const briciola =
      voci.length === 1
        ? t("1 acceso · tocca per spegnere", "1 on · tap to turn off")
        : `${voci.length} ${t("accesi · tocca per spegnere", "on · tap to turn off")}`;
    if (sotto.textContent !== briciola) sotto.textContent = briciola;
  }
  const disegno = voci.map((voce) => rigaDellElenco(voce, states, chiave)).join("");
  if (elenco.innerHTML !== disegno) elenco.innerHTML = disegno;
  return true;
}

export function apriLElenco(chiave) {
  const pastiglia = pastigliaDiChiave(chiave);
  if (!haUnElenco(pastiglia)) return false;
  state.elenco = clean(chiave);
  finestra().hidden = false;
  /* Dietro non si scorre, come per la finestra delle tessere: e' la stessa
   * classe, e la mette e la toglie chi apre. */
  doc?.documentElement?.classList?.add("dm-widget-popup-open");
  disegnaLElenco();
  try {
    root.navigator?.vibrate?.(10);
  } catch (_errore) {}
  return true;
}

export function chiudiLElenco() {
  state.elenco = "";
  const nodo = doc?.getElementById?.(POPUP);
  if (nodo) nodo.hidden = true;
  doc?.documentElement?.classList?.remove("dm-widget-popup-open");
  return true;
}

/* Spegnere dall'elenco: il servizio giusto per quel dominio, e nient'altro.
 * La riga sparisce da sola al giro dopo — quando Home Assistant dice che si e'
 * spenta — e non appena la si tocca: dire «spenta» prima che lo sia vorrebbe
 * dire dire una cosa che magari non succede. */
function spegni(entita) {
  /* Il tasto non c'e', ma la regola non sta nel tasto: un comando che parte
   * lo stesso — da una scorciatoia, da un doppio disegno rimasto in pagina —
   * va rifiutato qui. E' la stessa scelta di `lightCommand`. */
  if (!siComanda(entita)) return false;
  const comando = comandoPerSpegnere(entita, (allStates() || {})[entita]);
  if (!comando || typeof root.dmCallHaService !== "function") return false;
  try {
    root.navigator?.vibrate?.(10);
  } catch (_errore) {}
  Promise.resolve(
    root.dmCallHaService(comando.dominio, comando.servizio, { entity_id: entita }),
  ).catch((errore) => {
    try {
      root.edToast?.(
        `${t("Home Assistant ha rifiutato", "Home Assistant refused")}: ${clean(
          errore?.message || errore,
        )}`,
      );
    } catch (_ignora) {}
  });
  return true;
}

function onClickElenco(event) {
  const nodo = doc?.getElementById?.(POPUP);
  if (!nodo || nodo.hidden) return;
  const dentro = event.target?.closest?.(`#${POPUP}`);
  if (!dentro) return;
  if (event.target.closest("[data-dm-casa-chiudi]") || event.target === nodo) {
    event.preventDefault();
    chiudiLElenco();
    return;
  }
  const tasto = event.target.closest("[data-dm-casa-spegni]");
  if (!tasto) return;
  event.preventDefault();
  spegni(clean(tasto.dataset.dmCasaSpegni));
}

/* ── il tocco ───────────────────────────────────────────────────────────── */

/* La posta si spegne toccandola — «l'ho ritirata» — e ogni altra pastiglia
 * apre la tessera che racconta la stessa cosa per esteso. Se quella tessera e'
 * nascosta non succede niente: la pastiglia resta una notizia, non una porta
 * che si apre sul vuoto. */
function onClick(event) {
  const pastiglia = event.target?.closest?.("#dm-casa-riga [data-dm-casa]");
  if (!pastiglia) return;
  event.preventDefault();
  if (clean(pastiglia.dataset.dmCasa) === "posta") {
    writeJsonIfChanged(CHIAVE_POSTA, postaRitirata(memoriaDellaPosta(), Date.now()), {
      sync: false,
    });
    /* Via subito: la Home si ridisegna al prossimo evento di stato, che con
     * una casa ferma puo' voler dire fra un minuto. */
    pastiglia.remove();
    state.firma = "";
    if (!doc.querySelector("#dm-casa-riga [data-dm-casa]"))
      doc.getElementById("dm-casa-riga")?.remove();
    return;
  }
  /* Una pastiglia che conta apre l'elenco di quello che conta, non la tessera:
   * chi tocca «2 luci accese» vuole quelle due. Le altre — il ritiro,
   * l'antifurto, le misure — dicono una cosa sola, e quella cosa si guarda per
   * esteso nella sua tessera, come prima. */
  const chiave = clean(pastiglia.dataset.dmCasa);
  if (apriLElenco(chiave)) return;
  const tessera = clean(pastiglia.dataset.tessera);
  if (tessera) {
    doc.querySelector(`#dm-widgets [data-dm-widget="${CSS.escape(tessera)}"]`)?.click();
    return;
  }
  /* Una pastiglia scelta a mano non ha una tessera e non ha un elenco: dice
   * una lettura sola, e chi la tocca vuole saperne di piu' su QUELLA. La
   * risposta lunga ce l'ha gia' Home Assistant — la storia, i comandi, gli
   * attributi — e si apre la sua, non una nostra versione piu' povera. */
  apriLaSchedaDellEntita(pastiglia.dataset.dmEntita);
}

/* ── la scheda: dove si sceglie cosa si vede ────────────────────────────── */

/* La barra si configura nella scheda Home dell'editor, dove si configura il
 * resto della Home: l'ordine dei blocchi sta li' sopra, e chi cerca cosa si
 * vede in Home lo cerca in Home. */
const SCHEDA_HOME = "sez0";

function schedaAperta() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/* I nomi delle voci. Sono gli stessi delle tessere che le raccontano — chi
 * legge «Finestre» nella scheda ritrova «Finestre» in Home — e la posta e' la
 * sola che una tessera non ce l'ha.
 *
 * Qui c'erano anche le emoji, ed erano le stesse che la barra mostrava quando
 * il catalogo non aveva il disegno: «icone barra sotto al menu non sono del
 * nostro catalogo». Adesso il disegno ce l'hanno tutte — la posta, l'umidita'
 * e le due della pioggia sono arrivate col catalogo — e questa tabella torna a
 * fare la cosa che sa fare: i nomi. Il disegno lo chiede chi disegna, allo
 * stesso catalogo da cui lo chiedono le pastiglie: due elenchi della stessa
 * barra con due facce diverse sarebbero la stessa cosa detta due volte. */
const NOMI_DELLE_VOCI = () => ({
  posta: t("Posta", "Mail"),
  rifiuti: t("Rifiuti", "Waste"),
  sicurezza: t("Sicurezza", "Security"),
  porte: t("Apri porte", "Openers"),
  varchi: t("Varchi", "Openings"),
  stampanti: t("Stampanti", "Printers"),
  aggiornamenti: t("Aggiornamenti", "Updates"),
  luci: t("Luci", "Lights"),
  tapparelle: t("Finestre", "Windows"),
  clima: t("Clima", "Climate"),
  prese: t("Prese", "Sockets"),
  media: t("Musica", "Media"),
  presenza: t("Presenza", "Presence"),
  temperatura: t("Temperatura", "Temperature"),
  umidita: t("Umidità", "Humidity"),
  pioggia: t("Pioggia adesso", "Rain now"),
  pioggiaOggi: t("Pioggia di oggi", "Rain today"),
});

/* Una casella per un sensore della barra: le due misure hanno la stessa forma
 * di quella della posta, e scriverla tre volte vorrebbe dire tre caselle che
 * col tempo diventano diverse. */
function campoDellaMisura(chiave, valore, etichetta, esempio) {
  return `<label class="ed-slot dm-casa-ed-campo"><span class="ed-slot-lbl">${esc(etichetta)}</span>
      <span class="ed-form-row"><input class="ed-input mono" data-dm-casa-misura="${esc(chiave)}" value="${esc(
        valore,
      )}" placeholder="${esc(esempio)}" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-casa-pick-misura="${esc(
        chiave,
      )}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>`;
}

/* L'ora dopo la quale la pastiglia dei rifiuti guarda a domani (#565).
 *
 * Un menu di ore e non una casella libera: la domanda ha ventiquattro risposte
 * possibili e nessuna da scrivere a mano, e una casella libera qui vorrebbe
 * dire accettare «alle 8 di sera» e poi doverlo interpretare. La prima voce e'
 * quella di sempre, ed e' quella di serie. */
function campoDellOraDelRitiro(scelta) {
  const ore = Array.from({ length: 24 }, (_, ora) => {
    const valore = String(ora);
    return `<option value="${valore}"${scelta === valore ? " selected" : ""}>${esc(
      `${String(ora).padStart(2, "0")}:00`,
    )}</option>`;
  }).join("");
  return `<label class="ed-slot dm-casa-ed-campo"><span class="ed-slot-lbl">${esc(
    t("Dopo quest'ora, il ritiro di domani", "After this hour, tomorrow's collection"),
  )}</span>
      <select class="ed-input" data-dm-casa-ritiro>
        <option value=""${scelta ? "" : " selected"}>${esc(
          t("Mai: resta il ritiro più vicino", "Never: keep the nearest collection"),
        )}</option>${ore}
      </select>
      <small>${esc(
        t(
          "Il bidone si mette fuori la sera prima. Scegli l'ora dopo la quale la pastiglia smette di annunciare il ritiro di oggi — ormai passato — e annuncia quello di domani. Se domani non passa nessuno, la pastiglia non compare.",
          "The bin goes out the evening before. Pick the hour after which the pill stops announcing today's collection — by then already done — and announces tomorrow's instead. If nobody comes tomorrow, the pill does not show up.",
        ),
      )}</small></label>`;
}

/* ── le pastiglie scelte a mano, nella scheda (#7) ───────────────────────── */

/* Una riga per pastiglia, chiusa quando e' gia' fatta.
 *
 * Si apre da se' quella che non ha ancora un'entita': e' quella appena
 * aggiunta, e trovarla chiusa vorrebbe dire premere «aggiungi» e vedere
 * comparire una riga vuota che non si capisce come si riempie.
 *
 * Il nome della riga e' quello che la pastiglia dira' in fascia, e sotto c'e'
 * l'entita': sono le due cose con cui uno riconosce la sua fra sei.
 */
function rigaDellaMiaMarkup(mia, index) {
  const entity = clean(mia?.entity);
  const nome = clean(mia?.nome);
  const quando = clean(mia?.quando);
  return `<details class="ed-row dm-casa-ed-mia" data-dm-casa-mia="${index}"${entity ? "" : " open"}>
    <summary class="dm-casa-ed-mia-testa">
      <span class="ed-row-main"><strong class="ed-row-new">${esc(
        nome || t("Pastiglia senza nome", "Unnamed pill"),
      )}</strong><small class="ed-row-old mono">${esc(
        entity || t("nessuna entità", "no entity"),
      )}</small></span>
      <button type="button" class="ed-del" data-dm-casa-mia-via aria-label="${esc(
        t("Elimina", "Remove"),
      )}">🗑️</button>
    </summary>
    <label class="ed-slot dm-casa-ed-campo"><span class="ed-slot-lbl">${esc(
      t("Entità da mostrare", "Entity to show"),
    )}</span>
      <span class="ed-form-row"><input class="ed-input mono" data-dm-casa-mia-campo="entity" value="${esc(
        entity,
      )}" placeholder="sensor.acqua_serbatoio" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-casa-mia-pick="entity" aria-label="${esc(
        t("Scegli entità", "Choose entity"),
      )}">🔍</button></span></label>
    <label class="ed-slot dm-casa-ed-campo"><span class="ed-slot-lbl">${esc(
      t("Nome sotto il valore", "Name under the value"),
    )}</span>
      <span class="ed-form-row"><input class="ed-input" data-dm-casa-mia-campo="nome" value="${esc(
        nome,
      )}" placeholder="${esc(t("lasciandolo vuoto, quello di Home Assistant", "leave empty for the Home Assistant one"))}"></span></label>
    <div class="ed-form-row dm-casa-ed-mia-faccia">
      <input class="ed-input ed-icon-input" data-dm-casa-mia-campo="icona" value="${esc(
        clean(mia?.icona),
      )}" placeholder="🌴 / mdi:palm-tree" aria-label="${esc(t("Segno", "Icon"))}">
      <input class="dm-casa-ed-tinta" type="color" data-dm-casa-mia-campo="tinta" value="${esc(
        clean(mia?.tinta) || TINTA_MIA,
      )}" aria-label="${esc(t("Colore", "Colour"))}" title="${esc(t("Colore", "Colour"))}">
    </div>
    <label class="ed-slot dm-casa-ed-campo"><span class="ed-slot-lbl">${esc(
      t("Si vede quando questa entità…", "Show it when this entity…"),
    )}</span>
      <span class="ed-form-row"><input class="ed-input mono" data-dm-casa-mia-campo="quando" value="${esc(
        quando,
      )}" placeholder="input_boolean.vacanze" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-casa-mia-pick="quando" aria-label="${esc(
        t("Scegli entità", "Choose entity"),
      )}">🔍</button></span></label>
    <label class="ed-slot dm-casa-ed-campo"><span class="ed-slot-lbl">${esc(
      t("…è in questo stato", "…is in this state"),
    )}</span>
      <span class="ed-form-row"><input class="ed-input mono" data-dm-casa-mia-campo="stato" value="${esc(
        clean(mia?.stato),
      )}" placeholder="${esc(STATO_DI_SERIE)}" autocomplete="off" spellcheck="false"></span>
      <small>${esc(
        t(
          "Lasciando vuota la prima casella la pastiglia si vede sempre. Indicandola, si vede solo mentre quell'entità sta nello stato scritto qui — «on» per un interruttore acceso, che è quello che vale se non scrivi niente.",
          "Leave the first box empty and the pill always shows. Name an entity and it only shows while that entity is in the state written here — «on» for a switch that is on, which is what applies if you write nothing.",
        ),
      )}</small></label>
  </details>`;
}

function mieMarkup(config) {
  const righe = config.mie.map((mia, index) => rigaDellaMiaMarkup(mia, index)).join("");
  return `<div class="ed-sec-title dm-casa-ed-sep">✨ ${esc(
    t("Le tue entità nella fascia", "Your own entities in the bar"),
  )}</div>
    <div class="ed-intro">${esc(
      t(
        "Oltre a quelle che la casa annuncia da sé, puoi metterne di tue: l'acqua del serbatoio, i giorni al prossimo tagliando, quanto manca a una consegna. Stanno accanto alle cose accese, prima delle misure, e ognuna può comparire solo quando serve — per esempio solo mentre la modalità vacanze è attiva.",
        "Besides the ones the house announces by itself, you can add your own: the water in the tank, the days to the next service, how long until a delivery. They sit next to what is on, before the measurements, and each one can show up only when it matters — for instance only while holiday mode is on.",
      ),
    )}</div>
    <div class="ed-list dm-casa-ed-mie">${
      righe ||
      `<div class="ed-empty">${esc(t("Nessuna entità aggiunta", "No entity added"))}</div>`
    }</div>
    ${
      config.mie.length >= QUANTE_MIE
        ? /* Il numero sta FUORI dalla frase: una chiave con un valore dentro
           * cambia col valore e non sta in nessun catalogo — e' lo stesso
           * motivo per cui «2 luci accese» e' diventato un numero e una
           * parola. */
          `<div class="ed-empty">${esc(
            t("Il massimo è", "The most you can have is"),
          )} ${QUANTE_MIE} — ${esc(
            t(
              "la fascia scorre, ma le prime pastiglie sono quelle che la casa annuncia da sé.",
              "the bar scrolls, but the first pills are the ones the house announces by itself.",
            ),
          )}</div>`
        : `<button type="button" class="ed-btn-add" data-dm-casa-mia-piu>＋ ${esc(
            t("Aggiungi un'entità", "Add an entity"),
          )}</button>`
    }`;
}

function pannelloMarkup() {
  const config = configurazione();
  const nomi = NOMI_DELLE_VOCI();
  const righe = VOCI_DELLA_BARRA.map((voce) => {
    const etichetta = nomi[voce.chiave] || voce.chiave;
    return `<label class="ed-row dm-casa-ed-riga">
      <span class="dm-casa-ed-ic" aria-hidden="true">${oggettoWidget(
        voce.chiave,
        "",
        `casa-ed-${voce.chiave}`,
      )}</span>
      <span class="ed-row-main"><strong class="ed-row-new">${esc(etichetta)}</strong></span>
      <input type="checkbox" data-dm-casa-voce="${esc(voce.chiave)}"${
        config.voci[voce.chiave] ? " checked" : ""
      }>
    </label>`;
  }).join("");
  return `<div class="ed-sec-title">🏠 ${esc(t("Barra sotto il meteo", "Bar under the weather"))}</div>
    <div class="ed-intro">${esc(
      t(
        "Una riga di pastiglie sotto il meteo, con quello che conta adesso: il ritiro di oggi o domani, quante luci sono rimaste accese, quante finestre sono aperte. Compare solo quello che ha qualcosa da dire — nessuna luce accesa, nessuna pastiglia — e toccando una pastiglia si apre la tessera che racconta il resto.",
        "A row of pills under the weather, with what matters right now: today's or tomorrow's collection, how many lights were left on, how many windows are open. Only what has something to say shows up — no lights on, no pill — and tapping a pill opens the tile that tells the rest.",
      ),
    )}</div>
    <div class="dm-casa-ed-list">${righe}</div>
    ${campoDellOraDelRitiro(config.rifiutiDalleOre)}
    <label class="ed-slot dm-casa-ed-campo"><span class="ed-slot-lbl">${esc(
      t("Sensore della cassetta della posta", "Mailbox contact sensor"),
    )}</span>
      <span class="ed-form-row"><input id="dm-casa-posta" class="ed-input mono" data-dm-casa-posta value="${esc(
        config.posta,
      )}" placeholder="binary_sensor.cassetta_posta" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-casa-pick aria-label="${esc(
        t("Scegli entità", "Choose entity"),
      )}">🔍</button></span>
      <small>${esc(
        t(
          "Un contatto sulla cassetta: quando il postino apre lo sportello la pastiglia della posta compare, si muove per farsi notare e resta lì finché qualcuno non la tocca. La posta arriva mentre non si guarda, quindi non basta un lampo di due secondi.",
          "A contact on the mailbox: when the postman opens the flap the mail pill appears, moves to be noticed and stays there until somebody taps it. Mail arrives while nobody is looking, so a two-second flash is no use.",
        ),
      )}</small></label>
    ${campoDellaMisura(
      "temperatura",
      config.temperatura,
      t("Sensore della temperatura", "Temperature sensor"),
      "sensor.temperatura_esterna",
    )}
    ${campoDellaMisura(
      "umidita",
      config.umidita,
      t("Sensore dell'umidità", "Humidity sensor"),
      "sensor.umidita_esterna",
    )}
    ${campoDellaMisura(
      "pioggia",
      config.pioggia,
      t("Intensità della pioggia", "Rain rate"),
      "sensor.stazione_rain_rate",
    )}
    ${campoDellaMisura(
      "pioggiaOggi",
      config.pioggiaOggi,
      t("Pioggia caduta oggi", "Rain fallen today"),
      "sensor.stazione_pioggia_giornaliera",
    )}
    <div class="ed-intro">${esc(
      t(
        "Quattro sensori scelti da te: quelli che leggi per decidere, non una media della casa. Il tipico è quello fuori, con cui ci si regola per i clima interni. L'unità la dice Home Assistant, e un sensore che non indichi è una pastiglia che non compare.",
        "Four sensors of your choosing: the ones you actually read to decide, not a house average. The typical one is outdoors, the one you go by for the indoor units. The unit comes from Home Assistant, and a sensor you do not name is a pill that does not show up.",
      ),
    )}</div>
    <div class="ed-intro">${esc(
      t(
        "I due della pioggia servono a chi ha una stazione meteo: quanto sta venendo giù adesso e quanti millimetri sono caduti oggi. Sono anche quelli che guarda l'irrigazione — se il terreno l'ha già bagnato la pioggia, la pagina Irrigazione lo dice e propone di saltare il giro — quindi si scrivono qui una volta sola.",
        "The two rain ones are for those with a weather station: how hard it is coming down now, and how many millimetres fell today. They are also the ones irrigation looks at — if the rain has already watered the ground, the Irrigation page says so and offers to skip the run — so you name them here once.",
      ),
    )}</div>
    ${mieMarkup(config)}
    <button type="button" class="ed-save-btn" data-dm-casa-salva>💾 ${esc(
      t("Salva la barra", "Save the bar"),
    )}</button>`;
}

/** Il pannello in fondo alla scheda Home dell'editor, quando e' quella aperta. */
export function ensurePannelloDellaBarra(body = doc?.getElementById?.("ed-body")) {
  if (!body) return false;
  let pannello = body.querySelector(":scope > [data-dm-casa-pannello]");
  if (schedaAperta() !== SCHEDA_HOME) {
    pannello?.remove();
    return false;
  }
  const firma = JSON.stringify(configurazione());
  if (pannello && pannello.dataset.dmFirma === firma) return true;
  if (!pannello) {
    pannello = doc.createElement("div");
    pannello.className = "dm-casa-ed";
    pannello.dataset.dmCasaPannello = "true";
  }
  pannello.dataset.dmFirma = firma;
  pannello.innerHTML = pannelloMarkup();
  /* Si aggiunge in fondo, ma non si PRETENDE il fondo: l'ultimo posto e' del
   * «Salva sezione», che a ogni passata torna a prenderselo. Chiederlo tutti e
   * due vorrebbe dire due moduli che si scambiano l'ultima riga per sempre. */
  if (pannello.parentElement !== body) body.append(pannello);
  return true;
}

/* Quello che c'e' scritto nel pannello adesso, tutto in una volta.
 *
 * Una lettura sola e non una per casella: la scheda si ridisegna appena
 * scritto, e leggerle una per una vorrebbe dire leggerne meta' da un documento
 * che non c'e' piu'. La leggono in tre — chi salva, chi aggiunge una pastiglia
 * e chi ne toglie una — perche' aggiungere e togliere ridisegnano il pannello:
 * senza passare di qui, quello che uno ha appena scritto e non ha ancora
 * salvato se ne andrebbe al primo «＋». */
function quelloCheDiceIlPannello(pannello) {
  const voci = {};
  for (const casella of pannello.querySelectorAll("[data-dm-casa-voce]"))
    voci[clean(casella.dataset.dmCasaVoce)] = casella.checked;
  const misure = {};
  for (const casella of pannello.querySelectorAll("[data-dm-casa-misura]"))
    misure[clean(casella.dataset.dmCasaMisura)] = clean(casella.value);
  const mie = [];
  for (const riga of pannello.querySelectorAll("[data-dm-casa-mia]")) {
    const mia = {};
    for (const casella of riga.querySelectorAll("[data-dm-casa-mia-campo]"))
      mia[clean(casella.dataset.dmCasaMiaCampo)] = clean(casella.value);
    mie.push(mia);
  }
  return {
    voci,
    posta: clean(pannello.querySelector("[data-dm-casa-posta]")?.value),
    rifiutiDalleOre: clean(pannello.querySelector("[data-dm-casa-ritiro]")?.value),
    mie,
    ...misure,
  };
}

/* Scrive la configurazione e ridisegna la scheda. Torna la cassetta di prima,
 * che e' l'unica cosa che chi chiama deve ancora guardare. */
function salvaLaBarra(detto) {
  const prima = configurazione();
  writeJsonIfChanged(CHIAVE_BARRA, normalizzaBarra(detto));
  /* Cassetta cambiata: la memoria di quella di prima non vuol dire piu'
   * niente, e tenerla vorrebbe dire annunciare come «posta arrivata» il primo
   * scatto del contatto nuovo. Si riparte dal primo sguardo. */
  if (clean(detto.posta) !== prima.posta) writeJsonIfChanged(CHIAVE_POSTA, {}, { sync: false });
  ensurePannelloDellaBarra();
}

function onClickPannello(event) {
  const pannello = event.target?.closest?.("[data-dm-casa-pannello]");
  if (!pannello) return;
  if (event.target.closest("[data-dm-casa-pick]")) {
    event.preventDefault();
    root.wzPickEntity?.(pannello.querySelector("[data-dm-casa-posta]"));
    return;
  }
  const scegliMisura = event.target.closest("[data-dm-casa-pick-misura]");
  if (scegliMisura) {
    event.preventDefault();
    const chiave = clean(scegliMisura.dataset.dmCasaPickMisura);
    root.wzPickEntity?.(
      pannello.querySelector(`[data-dm-casa-misura="${CSS.escape(chiave)}"]`),
    );
    return;
  }
  /* I due cercatori di una pastiglia scelta a mano: quello dell'entita' da
   * mostrare e quello della voce che decide se si vede. Sono nella stessa
   * riga, e la riga dice a quale casella tornare. */
  const scegliMia = event.target.closest("[data-dm-casa-mia-pick]");
  if (scegliMia) {
    event.preventDefault();
    const campo = clean(scegliMia.dataset.dmCasaMiaPick);
    root.wzPickEntity?.(
      scegliMia
        .closest("[data-dm-casa-mia]")
        ?.querySelector(`[data-dm-casa-mia-campo="${CSS.escape(campo)}"]`),
    );
    return;
  }
  if (event.target.closest("[data-dm-casa-mia-piu]")) {
    event.preventDefault();
    const detto = quelloCheDiceIlPannello(pannello);
    /* La riga nuova nasce vuota e con lei il colore di serie: e' una riga da
     * riempire, non una pastiglia gia' fatta. Resta vuota anche dopo il
     * ridisegno — `normalizzaLeMie` le righe senza entita' le tiene — ed e'
     * quello che la fa trovare aperta. */
    detto.mie.push({ tinta: TINTA_MIA });
    salvaLaBarra(detto);
    return;
  }
  const togliMia = event.target.closest("[data-dm-casa-mia-via]");
  if (togliMia) {
    /* Il tasto sta dentro il `<summary>`, che di suo apre e chiude: senza
     * fermarlo, togliere una riga aprirebbe anche quella che prende il suo
     * posto. */
    event.preventDefault();
    const riga = togliMia.closest("[data-dm-casa-mia]");
    const quale = Number(riga?.dataset.dmCasaMia);
    const detto = quelloCheDiceIlPannello(pannello);
    if (Number.isInteger(quale) && quale >= 0 && quale < detto.mie.length) {
      detto.mie.splice(quale, 1);
      salvaLaBarra(detto);
    }
    return;
  }
  if (!event.target.closest("[data-dm-casa-salva]")) return;
  event.preventDefault();
  salvaLaBarra(quelloCheDiceIlPannello(pannello));
  root.edToast?.(t("💾 Barra salvata", "💾 Bar saved"));
}

/* ── stile ──────────────────────────────────────────────────────────────── */

function stile() {
  return `
    /* La riga va a capo, non fuori pagina (#400).
       «Nella home in alto quando fa vedere le cose accese o attive va oltre
       pagina a destra e devi scorrere per vederle. Sarebbe carino che andasse
       a capo e utilizzasse X righe che servono per far vedere.»

       Era un nastro che scorreva di lato, senza andare a capo. Uno
       scorrimento orizzontale in cima a una pagina che scorre in verticale non
       lo trova nessuno — non c'era nemmeno la barra, nascosta apposta — e
       quello che stava oltre il bordo destro era, di fatto, quello che non
       esisteva. Il riepilogo di cosa e' acceso in casa e' la prima cosa che si
       guarda: nasconderne meta' e' peggio che tenerlo alto due righe.

       Le pastiglie adesso possono anche stringersi: il testo
       taglia gia' con i puntini, e cosi' ne sta di piu' per riga invece di
       andare a capo dopo la prima. */
    /* Una fascia sola, non sei etichette in fila.
       «La barra dei dispositivi sotto meteo non mi convince proprio.» Erano
       ovali sciolti sul fondo della pagina, sotto una card del meteo che e'
       un rettangolo bianco pieno: sembravano avanzi, non una parte.
       Adesso e' una fascia come quella — stesso bianco, stesso raggio, stessa
       ombra — e le voci ci stanno dentro come le pastiglie del meteo stanno
       dentro la sua. Due fasce una sopra l'altra, e si leggono come una cosa
       sola.

       ── Una riga sola, che scorre da sola ────────────────────────────────
       «La barra sotto al meteo deve essere su una riga: da smartphone, se non
       entra, la devi rendere scorrevole o che scorre lei automaticamente.»

       E' la marcia indietro sulla #400 — «va oltre pagina a destra e devi
       scorrere per vederle, sarebbe carino che andasse a capo» — e non e' un
       ripensamento a vuoto: l'obiezione di allora era che uno scorrimento
       orizzontale, in cima a una pagina che scorre in verticale, non lo trova
       nessuno, e quello che stava oltre il bordo era di fatto quello che non
       esisteva. Adesso quell'obiezione cade, perche' non c'e' piu' niente da
       trovare: se le pastiglie non entrano, la fascia deriva da sola avanti e
       indietro e te le porta davanti una per una.

       La deriva si ferma appena qualcuno la tocca — chi ha preso in mano la
       fascia comanda lui — e non parte affatto per chi ha chiesto meno
       animazioni. Il velo sul bordo dice che c'e' altro anche da ferma. */
    /* La corsia: gli avvisi e la fascia, sulla stessa riga. Gli avvisi non si
       stringono, perche' un avviso illeggibile non e' un
       avviso; la fascia prende quello che resta e dentro scorre da se'. Sotto
       i 560 pixel restano sulla stessa riga lo stesso.

       Li' vanno una sopra l'altra: e' stato provato, ed e' sbagliato. Due
       righe alte 115 pixel per dire quello che ne vuole 60, e soprattutto due
       cose che si leggono insieme — cosa chiede attenzione adesso, cosa sta
       facendo la casa — messe a distanza. Sul telefono l'avviso si stringe
       quel tanto che basta (il suo numero non si tocca, se ne accorcia la
       parolina sotto) e la fascia accanto prende quello che resta: una
       pastiglia intera, e le altre le porta la deriva, che e' il suo mestiere.
       Misurato a 360, 390, 414 e 430 pixel. */
    .dm-casa-fascia{
      display:flex;align-items:stretch;gap:10px;
      margin:0 0 18px;max-width:100%;min-width:0}
    .dm-casa-fascia:empty{display:none}
    .dm-casa-fascia > #dm-casa-riga{flex:0 1 auto;min-width:0;margin:0}
    @media (max-width:560px){
      .dm-casa-fascia > #dm-casa-riga{flex:1 1 0;min-width:0;max-width:none}}
    #dm-casa-riga{
      display:block;overflow:hidden;
      /* Stretta quanto quello che dice: una casa tranquilla ha due voci, e una
         fascia larga tutta la pagina con due voci dentro e' mezza fascia
         vuota. Cresce con quello che ha da dire, e al massimo arriva al bordo
         come la card del meteo. */
      width:fit-content;max-width:100%;
      margin:0 0 18px;padding:6px;
      border-radius:20px;
      border:1px solid var(--card-border,rgba(15,23,42,.07));
      background:var(--card-bg,#fff);
      box-shadow:0 6px 18px -12px rgba(15,23,42,.28)}
    #dm-casa-riga:not(:has([data-dm-casa])){display:none}
    /* Il nastro: le pastiglie in fila, larghe quanto vogliono. E' lui che si
       muove, e lo muove il foglio — nessun timer sposta niente. */
    .dm-casa-nastro{
      display:flex;flex-wrap:nowrap;align-items:stretch;gap:2px;width:max-content}
    /* Va avanti e torna, e si ferma un attimo ai due capi: alternate piu' la
       curva morbida. La strada e il tempo li ha misurati la sezione — il foglio
       non sa quanto sono larghe le pastiglie. */
    #dm-casa-riga[data-dm-deriva="true"] .dm-casa-nastro{
      animation:dm-casa-deriva var(--dm-casa-durata,12s) ease-in-out infinite alternate}
    /* La corsa sporge di un velo ai due capi, e il velo e' la sfumatura qui
       sotto: lo stesso numero, preso dalla stessa variabile. Dove il nastro si
       ferma, la pastiglia che si stava aspettando resta in chiaro invece che
       mezza sotto la sfumatura — era quello il «tagliata ai lati».
       La strada la conta la sezione col velo dentro, perche' la durata si
       calcola sulla distanza e la velocita' deve restare quella. */
    @keyframes dm-casa-deriva{
      from{translate:var(--dm-casa-velo,0px)}
      to{translate:calc(var(--dm-casa-velo,0px) - var(--dm-casa-strada,0px))}}
    /* Chi ci mette il dito o il puntatore sopra comanda lui: la fascia si ferma
       e si legge. Riprende quando lo si toglie. */
    #dm-casa-riga:hover .dm-casa-nastro,
    #dm-casa-riga:active .dm-casa-nastro,
    #dm-casa-riga:focus-within .dm-casa-nastro{animation-play-state:paused}
    /* Le sfumature ai due bordi dicono «continua»: si accendono solo quando
       c'e' davvero qualcosa fuori. */
    #dm-casa-riga[data-dm-deriva="true"]{
      mask-image:linear-gradient(to right,transparent 0,#000 var(--dm-casa-velo,0px),#000 calc(100% - var(--dm-casa-velo,0px)),transparent 100%);
      -webkit-mask-image:linear-gradient(to right,transparent 0,#000 var(--dm-casa-velo,0px),#000 calc(100% - var(--dm-casa-velo,0px)),transparent 100%)}
    @media (prefers-reduced-motion:reduce){
      /* Chi ha chiesto meno animazioni si trascina la fascia a mano: e' l'unico
         caso in cui torna a scorrere invece di derivare. E fermo il nastro, il
         velo se lo deve guadagnare lo scorrimento — il nastro si allarga di un
         velo per parte, e chi trascina porta la prima e l'ultima pastiglia
         fuori dalla sfumatura come fa la deriva. Senza, qui restavano tagliate
         davvero: a mano non si sporge. */
      #dm-casa-riga[data-dm-deriva="true"] .dm-casa-nastro{
        animation:none;padding-inline:var(--dm-casa-velo,0px)}
      #dm-casa-riga[data-dm-deriva="true"]{overflow-x:auto;scrollbar-width:none}
      #dm-casa-riga[data-dm-deriva="true"]::-webkit-scrollbar{display:none}}

    /* Ogni voce: il disegno nel suo riquadro tinto, la parola grossa e sotto
       la micro-etichetta maiuscola spaziata. E' la coppia con cui parla tutta
       la plancia — il numero grande e la parolina sotto, come sulle tessere e
       sul carico del MiniPC — e averla uguale per tutte e' quello che tiene
       insieme la fascia. */
    .dm-casa-pastiglia{
      --dm-casa-tinta:#64748b;
      display:inline-flex;align-items:center;gap:10px;flex:0 1 auto;min-width:0;
      padding:7px 14px 7px 8px;border-radius:15px;cursor:pointer;
      border:0;background:transparent;color:var(--text,#0f172a);font:inherit;
      text-align:left;max-width:min(70vw,300px);
      transition:background-color .18s ease,transform .18s ease}
    .dm-casa-pastiglia:hover{
      background:color-mix(in srgb,var(--dm-casa-tinta) 9%,transparent)}
    .dm-casa-pastiglia:active{transform:scale(.97)}
    .dm-casa-chip{
      display:grid;place-items:center;flex:0 0 auto;width:32px;height:32px;
      border-radius:11px;line-height:1;
      background:color-mix(in srgb,var(--dm-casa-tinta) 14%,transparent);
      color:var(--dm-casa-tinta)}
    .dm-casa-chip svg{width:19px;height:19px;display:block}
    .dm-casa-emoji{font-size:17px;line-height:1}
    .dm-casa-testo{display:flex;flex-direction:column;gap:1px;min-width:0}
    .dm-casa-testa{
      font-size:16px;font-weight:800;line-height:1.15;letter-spacing:-.015em;
      font-variant-numeric:tabular-nums;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-casa-coda{
      font-size:9.5px;font-weight:800;line-height:1.2;
      letter-spacing:.11em;text-transform:uppercase;
      color:var(--text-dim,#94a3b8);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

    /* La posta e l'antifurto che suona sono notizie, non descrizioni: si
       accendono di colore e la posta si muove finche' non la si tocca. */
    .dm-casa-pastiglia[data-avviso="true"]{
      --dm-casa-tinta:#dc2626;
      background:color-mix(in srgb,#dc2626 10%,transparent)}
    .dm-casa-pastiglia[data-avviso="true"] .dm-casa-testa{color:#b91c1c}
    .dm-casa-pastiglia[data-avviso="true"] .dm-casa-coda{color:#dc2626}
    .dm-casa-pastiglia[data-dm-casa="posta"]{
      --dm-casa-tinta:#2563eb;
      background:color-mix(in srgb,#2563eb 10%,transparent);
      animation:dmPostaChiama 2.4s ease-in-out infinite}
    .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-testa{color:#1d4ed8}
    .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-coda{color:#2563eb}
    .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-chip{
      animation:dmPostaSbatte 2.4s ease-in-out infinite}
    @keyframes dmPostaChiama{
      0%,72%,100%{box-shadow:0 0 0 0 rgba(37,99,235,0)}
      82%{box-shadow:0 0 0 6px rgba(37,99,235,.16)}
      92%{box-shadow:0 0 0 11px rgba(37,99,235,0)}}
    @keyframes dmPostaSbatte{
      0%,66%,100%{transform:translateY(0) rotate(0)}
      74%{transform:translateY(-3px) rotate(-11deg)}
      82%{transform:translateY(-3px) rotate(11deg)}
      90%{transform:translateY(0) rotate(0)}}
    @media (prefers-reduced-motion:reduce){
      .dm-casa-pastiglia[data-dm-casa="posta"],
      .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-chip{animation:none}}
    html[data-theme="dark"] #dm-casa-riga{
      box-shadow:none;border-color:var(--card-border,rgba(148,163,184,.16))}
    html[data-theme="dark"] .dm-casa-pastiglia[data-avviso="true"] .dm-casa-testa{color:#fca5a5}
    html[data-theme="dark"] .dm-casa-pastiglia[data-avviso="true"] .dm-casa-coda{color:#f87171}
    html[data-theme="dark"] .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-testa{color:#bfdbfe}
    html[data-theme="dark"] .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-coda{color:#93c5fd}
    /* L'elenco di cosa e' acceso: la finestra e' vestita con le classi del
       guscio — «modal-wrapper», «modal-card», «detail-row» — e qui si scrive
       solo quello che e' suo: la riga, com'e' adesso, e il tasto che spegne. */
    #dm-casa-popup .dm-casa-elenco{display:grid;gap:8px}
    #dm-casa-popup .dm-casa-voce{display:flex;align-items:center;gap:10px}
    #dm-casa-popup .dm-casa-voce .d-info{min-width:0;flex:1;overflow:hidden}
    /* Il nome per intero, anche a capo: «non entrano i nomi». Una riga sola
       con i puntini toglieva proprio la parte che distingue una lampada
       dall'altra, e qui il nome e' l'unica cosa che si legge. */
    #dm-casa-popup .dm-casa-voce .d-name{
      overflow-wrap:anywhere;font-size:14px;font-weight:800}
    /* Com'e' adesso: una pastiglia, non una riga di testo.
       Prende il colore della cosa che si sta guardando — lo stesso accento
       della tessera, che la finestra si mette addosso quando si apre — e il
       puntino davanti si vede prima della parola. Chi non risponde resta
       grigio: e' l'unico stato che non e' una notizia sulla casa. */
    #dm-casa-popup .dm-casa-stato{
      flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;
      padding:6px 12px;border-radius:999px;
      font-size:11px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;
      color:var(--dm-widget-accent,#0ea5e9);
      background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 13%,transparent);
      box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 24%,transparent)}
    #dm-casa-popup .dm-casa-stato i{
      width:7px;height:7px;border-radius:50%;background:currentColor;
      box-shadow:0 0 0 3px color-mix(in srgb,currentColor 20%,transparent)}
    #dm-casa-popup .dm-casa-stato[data-dm-muta="true"]{
      color:var(--text-dim,#64748b);
      background:color-mix(in srgb,var(--text-dim,#64748b) 12%,transparent);
      box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text-dim,#64748b) 20%,transparent)}
    /* La riga resta una riga anche sul telefono: il nome va a capo dentro il
       suo posto — puo' farlo, e' scritto qui sopra — e la pastiglia col tasto
       restano a destra, in mezzo. Mandandoli a capo si otteneva una riga col
       nome e sotto una fila vuota a sinistra: peggio di quello che si voleva
       evitare. */
    #dm-casa-popup .dm-casa-spegni{
      flex:0 0 auto;border:0;cursor:pointer;padding:9px 14px;border-radius:11px;
      font:inherit;font-size:11px;font-weight:900;letter-spacing:.06em;
      text-transform:uppercase;
      background:rgba(225,29,72,.14);color:#e11d48}
    #dm-casa-popup .dm-casa-spegni:active{transform:scale(.96)}
    html[data-theme="dark"] #dm-casa-popup .dm-casa-spegni{
      background:rgba(248,113,113,.18);color:#fca5a5}
    #ed-body .dm-casa-ed{display:block;margin-top:18px}
    #ed-body .dm-casa-ed-list{display:grid;gap:6px;margin-bottom:12px}
    #ed-body .dm-casa-ed-riga{display:flex!important;align-items:center;gap:10px;padding:8px 12px!important;cursor:pointer}
    #ed-body .dm-casa-ed-ic{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;flex:0 0 24px;font-size:17px}
    #ed-body .dm-casa-ed-ic .dm-oggetto{width:24px;height:24px;display:block}
    #ed-body .dm-casa-ed-campo{display:block;margin-bottom:12px}
    /* Le pastiglie scelte a mano (#7): una riga per pastiglia, chiusa finche'
       non la si apre. Il tasto che la toglie sta nella testa, dove sta in
       tutti gli altri elenchi della scheda. */
    #ed-body .dm-casa-ed-sep{margin-top:20px}
    #ed-body .dm-casa-ed-mie{display:grid;gap:8px;margin-bottom:12px}
    #ed-body .dm-casa-ed-mia{display:block!important;padding:0!important}
    #ed-body .dm-casa-ed-mia-testa{display:flex;align-items:center;gap:10px;
      padding:10px 12px;cursor:pointer;list-style:none}
    #ed-body .dm-casa-ed-mia-testa::-webkit-details-marker{display:none}
    #ed-body .dm-casa-ed-mia-testa .ed-row-main{flex:1 1 auto;min-width:0}
    #ed-body .dm-casa-ed-mia[open] .dm-casa-ed-mia-testa{
      border-bottom:1px solid var(--dm-editor-border,rgba(148,163,184,.28))}
    #ed-body .dm-casa-ed-mia > .dm-casa-ed-campo,
    #ed-body .dm-casa-ed-mia > .dm-casa-ed-mia-faccia{margin:12px 12px 0}
    #ed-body .dm-casa-ed-mia > :last-child{margin-bottom:12px}
    #ed-body .dm-casa-ed-mia-faccia{display:flex;align-items:center;gap:8px}
    #ed-body .dm-casa-ed-mia-faccia .ed-icon-input{flex:1 1 auto;min-width:0}
    /* La casella del colore e' un quadrato, non un campo di testo largo
       quanto la riga: quello che si sceglie li' e' una tinta sola. */
    #ed-body .dm-casa-ed-tinta{flex:0 0 44px;width:44px;height:38px;padding:2px;
      border:1px solid var(--dm-editor-border,rgba(148,163,184,.28));border-radius:10px;
      background:transparent;cursor:pointer}
  `;
}

export function installComeStaLaCasa() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle("dm-come-sta-la-casa", stile());
  doc.addEventListener("click", onClick);
  doc.addEventListener("click", onClickElenco);
  doc.addEventListener("click", onClickPannello);
  doc.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && state.elenco) chiudiLElenco();
  });
  onEditorRedraw("__dmComeStaLaCasa", () => ensurePannelloDellaBarra());
  return true;
}
