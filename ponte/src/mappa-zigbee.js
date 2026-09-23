/* La mappa della rete Zigbee: chi parla con chi, disegnata.
 *
 * «Crea inoltre la possibilita' di mostrare la mappa di collegamento dei
 * dispositivi.»
 *
 * ─── Perche' il disegno lo fa il ponte ───────────────────────────────────
 *
 * Perche' e' un disegno solo. La mappa si guarda dall'app, che e' Flutter, e
 * si guarderebbe volentieri anche dalla plancia, che e' una pagina web: due
 * posti, due linguaggi, e la stessa geometria scritta due volte. Due copie
 * della stessa geometria sono due mappe che il giorno che una cambia dicono
 * cose diverse — ed e' successo abbastanza volte in questa casa da non
 * volerlo rifare.
 *
 * Qui invece esce un SVG, che e' una figura e basta: l'app la mostra con
 * `flutter_svg`, una pagina la mette in un `<img>`, e chi guarda vede la
 * stessa identica cosa. Escono anche i nodi e i fili in chiaro, perche' una
 * figura non si puo' interrogare: chi vuole scrivere «questo qui e' il
 * ripetitore del garage» legge quelli.
 *
 * Questo file non prende la rete e non tocca niente: entrano le righe
 * dell'elenco, esce la figura. Si prova senza una casa e senza un telefono.
 *
 * ─── Come si dispone ─────────────────────────────────────────────────────
 *
 * A cerchi concentrici, e non a caso: una rete Zigbee **ha** questa forma.
 * Al centro il coordinatore, che e' l'antenna; intorno i router, che vanno a
 * corrente e fanno da ponte; fuori i terminali, che stanno a batteria e
 * parlano con un router solo.
 *
 * Un terminale si mette all'angolo del router con cui parla — cosi' il filo
 * e' corto e si vede a colpo d'occhio quale ramo regge quale pezzo di casa —
 * e se parla con piu' d'uno, a quello che sente meglio.
 *
 * ─── E chi non parla con nessuno ─────────────────────────────────────────
 *
 * Sta in fondo, in una riga a parte, e c'e' scritto perche'. Disegnarlo
 * attaccato a qualcuno sarebbe inventare un collegamento che nessuno ha
 * visto: chi apre questa mappa la apre proprio perche' qualcosa non va, ed e'
 * l'ultimo posto dove ci si puo' permettere di indovinare.
 */

import { COORDINATORE, ROUTER } from "./zigbee.js";

/* La tela. Novecento di larghezza perche' su un telefono si scala a larghezza
 * schermo e le scritte restano leggibili. */
export const LATO = 900;

/* In fondo, una fascia per chi non parla con nessuno. C'e' solo quando serve:
 * una rete tutta collegata non deve portarsi dietro un'area vuota.
 *
 * Senza questa fascia i terminali del ramo che punta in basso finivano
 * esattamente sopra quella riga — visto rendendo la mappa, non leggendola. */
const FASCIA_DEI_SOLI = 180;

/* I due cerchi. Il primo largo abbastanza da non incollare i router
 * all'antenna, il secondo da lasciare aria alle scritte dei terminali. */
const RAGGIO_ROUTER = 185;
const RAGGIO_TERMINALI = 305;

/* Quanto si sposta un terminale dentro o fuori rispetto ai suoi fratelli.
 *
 * Due terminali sullo stesso ripetitore, alla stessa distanza e a un ventaglio
 * di poco piu' di un quinto di radiante, stanno a novanta pixel l'uno
 * dall'altro — e una scritta di diciotto lettere e' larga centotrenta. Si
 * accavallavano. Mettendoli a due distanze diverse le scritte passano una
 * sopra l'altra invece che una dentro l'altra. */
const SFALSA = 42;

/* Quanto spazio vuole una scritta ai bordi prima di uscire dalla tela. */
const MARGINE_DELLA_SCRITTA = 110;

/* Quanto e' buono un collegamento. L'LQI va da 0 a 255: sotto i 50 e' un filo
 * che si spezza appena qualcuno accende il microonde, sopra i 150 e' solido.
 * I tre scalini servono a far vedere i rami deboli senza leggere un numero. */
export const DEBOLE = 50;
export const BUONO = 150;

/* Quanto testo ci sta su una riga sotto un pallino senza finire sul vicino, e
 * quante righe si concedono.
 *
 * Due righe e non una: con una sola, «Termostato cucina» diventava «Termostato
 * cuc…» — e un nome tagliato in una mappa che serve a riconoscere le cose e'
 * un nome che non serve. Andando a capo il nome ci sta intero ed e' largo la
 * meta', che e' proprio quello che serviva perche' due vicini non si tocchino.
 *
 * Oltre le due righe si taglia davvero: chi chiama un sensore con nove parole
 * ha un problema che una mappa non risolve. */
const RIGA_AL_PIU = 16;
const RIGHE_AL_PIU = 2;

const pulito = (valore) => String(valore ?? "").trim();

/* Gli apostrofi e le virgolette dentro un SVG: un nome con dentro `&` o `<`
 * romperebbe il documento, e i nomi li scrive chi abita. */
function esc(testo) {
  return pulito(testo)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/* Il nome spezzato in righe corte, sugli spazi.
 *
 * Una parola piu' lunga di una riga si taglia — non si spezza a meta': «Ter-
 * mostato» si legge peggio di «Termosta…». */
export function aCapo(nome) {
  const parole = pulito(nome).split(/\s+/).filter(Boolean);
  const righe = [];
  for (const parola of parole) {
    const ultima = righe[righe.length - 1];
    if (ultima !== undefined && `${ultima} ${parola}`.length <= RIGA_AL_PIU)
      righe[righe.length - 1] = `${ultima} ${parola}`;
    else righe.push(parola.length > RIGA_AL_PIU ? `${parola.slice(0, RIGA_AL_PIU - 1)}…` : parola);
    if (righe.length > RIGHE_AL_PIU) break;
  }
  if (righe.length > RIGHE_AL_PIU) {
    righe.length = RIGHE_AL_PIU;
    righe[RIGHE_AL_PIU - 1] = `${righe[RIGHE_AL_PIU - 1]}…`;
  }
  return righe.length ? righe : [""];
}

/* I colori, in due vesti. Non `currentColor`: `flutter_svg` lo risolve solo
 * se chi lo mostra glielo dice, e una mappa che esce nera su nero e' una
 * mappa che non si vede. */
const VESTI = {
  chiara: {
    fondo: "#f8fafc",
    filo: "#94a3b8",
    scritta: "#0f172a",
    sotto: "#64748b",
    coordinatore: "#7c3aed",
    router: "#0ea5e9",
    terminale: "#22c55e",
    solo: "#f97316",
    bordo: "#ffffff",
  },
  scura: {
    fondo: "#0b1220",
    filo: "#475569",
    scritta: "#e2e8f0",
    sotto: "#94a3b8",
    coordinatore: "#a78bfa",
    router: "#38bdf8",
    terminale: "#4ade80",
    solo: "#fb923c",
    bordo: "#0b1220",
  },
};

/** Il colore di un nodo, dal suo mestiere. */
function tinta(nodo, veste) {
  if (nodo.solo) return veste.solo;
  if (nodo.tipo === COORDINATORE) return veste.coordinatore;
  if (nodo.tipo === ROUTER) return veste.router;
  return veste.terminale;
}

/** Quanto e' grosso un pallino: l'antenna si vede da lontano. */
function quantoGrosso(nodo) {
  if (nodo.tipo === COORDINATORE) return 26;
  if (nodo.tipo === ROUTER) return 17;
  return 12;
}

/* ── I fili ────────────────────────────────────────────────────────────── */

/**
 * I collegamenti, una volta sola per coppia.
 *
 * In una rete Zigbee A vede B e B vede A, con due misure che non sono
 * uguali — la radio non e' simmetrica. Disegnarli tutti e due vorrebbe dire
 * due righe sovrapposte per ogni coppia: si tiene la coppia una volta sola,
 * con la misura **peggiore** delle due. La peggiore e non la media perche' un
 * filo vale quanto il suo verso piu' debole: se A sente B benissimo ma B non
 * sente A, quel ramo non regge.
 */
export function iFili(righe = []) {
  const ceLa = new Set(righe.map((una) => pulito(una.id)).filter(Boolean));
  const insieme = new Map();
  for (const riga of righe) {
    const da = pulito(riga?.id);
    if (!da) continue;
    for (const vicino of Array.isArray(riga?.vicini) ? riga.vicini : []) {
      const a = pulito(vicino?.id);
      /* Un vicino che nell'elenco non c'e' non si disegna: sarebbe un pallino
       * senza nome, e in una mappa un pallino senza nome non dice niente. */
      if (!a || a === da || !ceLa.has(a)) continue;
      const chiave = [da, a].sort().join("~");
      const quanto = Number.isFinite(vicino?.qualita) ? vicino.qualita : null;
      const gia = insieme.get(chiave);
      if (!gia)
        insieme.set(chiave, { da: [da, a].sort()[0], a: [da, a].sort()[1], qualita: quanto });
      else if (quanto !== null && (gia.qualita === null || quanto < gia.qualita))
        gia.qualita = quanto;
    }
  }
  return [...insieme.values()];
}

/* ── Dove va ognuno ────────────────────────────────────────────────────── */

/**
 * I nodi, col posto assegnato.
 *
 * Torna anche chi non ha nessun collegamento: quelli non stanno su nessun
 * cerchio — stanno in fondo, in fila — e chi disegna li riconosce da `solo`.
 */
export function iNodi(righe = [], fili = iFili(righe)) {
  const vicinato = new Map();
  for (const filo of fili) {
    if (!vicinato.has(filo.da)) vicinato.set(filo.da, []);
    if (!vicinato.has(filo.a)) vicinato.set(filo.a, []);
    vicinato.get(filo.da).push({ id: filo.a, qualita: filo.qualita });
    vicinato.get(filo.a).push({ id: filo.da, qualita: filo.qualita });
  }

  const soloDiQualcuno = righe.filter((riga) => !vicinato.has(pulito(riga.id)));
  /* L'altezza della tela e il centro dei cerchi dipendono da quanti sono
   * quelli senza collegamenti: se non ce n'e' nessuno, la fascia non c'e' e i
   * cerchi stanno in mezzo alla tela. */
  const banda = soloDiQualcuno.length ? FASCIA_DEI_SOLI : 0;
  /* I cerchi stanno in un quadrato tutto loro, e la fascia viene DOPO, sotto.
   * Prima la fascia si mangiava l'altezza del quadrato e sotto restava mezza
   * tela vuota — visto rendendo, non leggendo. */
  const alta = LATO + banda;
  const centroX = LATO / 2;
  const centroY = LATO / 2;

  const nodi = righe.map((riga) => ({
    id: pulito(riga.id),
    nome: pulito(riga.nome) || pulito(riga.id),
    tipo: riga.tipo,
    potenza: riga.potenza,
    solo: !vicinato.has(pulito(riga.id)),
    x: centroX,
    y: centroY,
  }));
  const per = new Map(nodi.map((nodo) => [nodo.id, nodo]));

  const attaccati = nodi.filter((nodo) => !nodo.solo);
  const antenna = attaccati.find((nodo) => nodo.tipo === COORDINATORE);
  const router = attaccati.filter((nodo) => nodo.tipo === ROUTER);
  const terminali = attaccati.filter((nodo) => nodo.tipo !== COORDINATORE && nodo.tipo !== ROUTER);

  if (antenna) {
    antenna.x = centroX;
    antenna.y = centroY;
  }

  /* I router sul primo cerchio, a distanza uguale. Si parte da sopra perche'
   * una mappa che comincia da sinistra sembra storta. */
  const angoli = new Map();
  router.forEach((nodo, quale) => {
    const angolo = -Math.PI / 2 + (2 * Math.PI * quale) / Math.max(1, router.length);
    angoli.set(nodo.id, angolo);
    nodo.x = centroX + RAGGIO_ROUTER * Math.cos(angolo);
    nodo.y = centroY + RAGGIO_ROUTER * Math.sin(angolo);
  });

  /* E i terminali fuori, ognuno vicino a chi lo regge. Chi ne ha piu' d'uno
   * va da quello che sente meglio: e' il ramo su cui sta davvero. */
  const quanti = new Map();
  for (const nodo of terminali) {
    const suoi = (vicinato.get(nodo.id) || [])
      .filter((uno) => angoli.has(uno.id))
      .sort((una, altra) => (altra.qualita ?? -1) - (una.qualita ?? -1));
    const padre = suoi[0]?.id;
    const base = padre !== undefined ? angoli.get(padre) : -Math.PI / 2;
    /* Piu' terminali sullo stesso router si aprono a ventaglio, invece di
     * finire uno sopra l'altro. */
    const gia = quanti.get(padre ?? "~") ?? 0;
    quanti.set(padre ?? "~", gia + 1);
    /* Il ventaglio parte da mezzo passo e non da zero: col primo terminale
     * esattamente all'angolo del suo ripetitore, i due finivano alla stessa
     * altezza e le due scritte una sopra l'altra — «Presa salotto» e
     * «Telecomando salotto» erano illeggibili. */
    const apertura = 0.4 * (gia % 2 === 0 ? 1 : -1) * (Math.floor(gia / 2) + 0.5);
    const angolo = base + apertura;
    /* Uno dentro e uno fuori, a turno: e' quello che tiene le scritte
     * separate quando un ripetitore ne regge quattro. */
    const raggio = RAGGIO_TERMINALI + (gia % 2 === 0 ? 0 : SFALSA);
    nodo.x = centroX + raggio * Math.cos(angolo);
    nodo.y = centroY + raggio * Math.sin(angolo);
  }

  /* Chi non parla con nessuno: in fondo, in fila, dove non finge di essere
   * attaccato a niente. */
  const soli = nodi.filter((nodo) => nodo.solo);
  soli.forEach((nodo, quale) => {
    const perRiga = Math.max(1, Math.min(soli.length, 4));
    const colonna = quale % perRiga;
    const riga = Math.floor(quale / perRiga);
    const largo = LATO / (perRiga + 1);
    nodo.x = largo * (colonna + 1);
    nodo.y = LATO + 76 + riga * 64;
  });

  return { nodi, per, fili, alta, banda, centroX, centroY };
}

/* ── Il disegno ────────────────────────────────────────────────────────── */

function ilFilo(filo, per, veste) {
  const da = per.get(filo.da);
  const a = per.get(filo.a);
  if (!da || !a) return "";
  const quanto = filo.qualita;
  const grosso = quanto === null ? 1.4 : quanto < DEBOLE ? 1.2 : quanto < BUONO ? 2.2 : 3.4;
  const velo = quanto === null ? 0.35 : quanto < DEBOLE ? 0.4 : quanto < BUONO ? 0.6 : 0.85;
  /* Il tratteggio dice «debole» anche a chi non distingue gli spessori, e si
   * vede anche stampato in bianco e nero. */
  const tratto = quanto !== null && quanto < DEBOLE ? ' stroke-dasharray="6 5"' : "";
  return `<line x1="${da.x.toFixed(1)}" y1="${da.y.toFixed(1)}" x2="${a.x.toFixed(1)}" y2="${a.y.toFixed(1)}" stroke="${veste.filo}" stroke-width="${grosso}" stroke-opacity="${velo}" stroke-linecap="round"${tratto}/>`;
}

function ilNodo(nodo, veste) {
  const raggio = quantoGrosso(nodo);
  const colore = tinta(nodo, veste);
  /* Vicino a un bordo la scritta si ancora dalla parte giusta, invece di
   * finire mezza fuori dalla tela: e' quello che succedeva a «Telecomando
   * salotto» sul bordo destro. */
  const ancora =
    nodo.x < MARGINE_DELLA_SCRITTA
      ? "start"
      : nodo.x > LATO - MARGINE_DELLA_SCRITTA
        ? "end"
        : "middle";
  const doveScrive =
    ancora === "start" ? 8 : ancora === "end" ? LATO - 8 : Number(nodo.x.toFixed(1));
  /* La batteria si dice con un segno e non con un colore: i colori dicono gia'
   * il mestiere, e due cose sullo stesso canale non si leggono piu'. */
  /* La batteria si dice con un segno accanto al nome e non sotto: sotto
   * finiva addosso alla scritta del vicino, e con un pallino in meno da
   * guardare la riga si legge meglio. */
  const segno = nodo.potenza === "batteria" ? "🔋 " : "";
  const righe = aCapo(nodo.nome);
  const scritte = righe
    .map(
      (riga, quale) =>
        `<text x="${doveScrive}" y="${(nodo.y + raggio + 17 + quale * 16).toFixed(1)}" text-anchor="${ancora}" font-size="13" font-weight="700" fill="${veste.scritta}">${quale === 0 ? segno : ""}${esc(riga)}</text>`,
    )
    .join("");
  return `<g>
      <circle cx="${nodo.x.toFixed(1)}" cy="${nodo.y.toFixed(1)}" r="${raggio}" fill="${colore}" stroke="${veste.bordo}" stroke-width="3"/>
      ${scritte}
    </g>`;
}

/**
 * La mappa, come figura.
 *
 * `scuro` perche' l'app ha due vesti e una mappa nera su nero non si vede.
 * Chi la chiede sa in che veste sta: qui non si indovina.
 */
export function laMappaDisegnata(righe = [], { scuro = false } = {}) {
  const veste = scuro ? VESTI.scura : VESTI.chiara;
  const fili = iFili(righe);
  const { nodi, per, alta, banda } = iNodi(righe, fili);
  const soli = nodi.filter((nodo) => nodo.solo);

  const legenda = [
    [veste.coordinatore, "Antenna"],
    [veste.router, "Ripetitore"],
    [veste.terminale, "A batteria o in fondo"],
    ...(soli.length ? [[veste.solo, "Nessun collegamento visto"]] : []),
  ]
    .map(
      ([colore, scritta], quale) =>
        `<circle cx="28" cy="${30 + quale * 26}" r="8" fill="${colore}"/><text x="46" y="${35 + quale * 26}" font-size="13" fill="${veste.sotto}">${esc(scritta)}</text>`,
    )
    .join("");

  /* La fascia di chi non parla con nessuno: una riga di stacco e una frase.
   * Sta sotto tutto, e i cerchi le stanno sopra senza toccarla. */
  /* La riga di stacco e la frase stanno DENTRO la fascia, sotto il quadrato
   * dei cerchi: prima la frase cadeva sopra l'ultimo ramo. */
  const laFascia = soli.length
    ? `<line x1="40" y1="${LATO + 6}" x2="${LATO - 40}" y2="${LATO + 6}" stroke="${veste.filo}" stroke-width="1" stroke-opacity=".4"/>
       <text x="${LATO / 2}" y="${LATO + 32}" text-anchor="middle" font-size="13" fill="${veste.sotto}">Di questi la rete non ha visto nessun collegamento</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LATO} ${alta}" width="${LATO}" height="${alta}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
  <rect width="${LATO}" height="${alta}" fill="${veste.fondo}"/>
  <g>${fili.map((filo) => ilFilo(filo, per, veste)).join("")}</g>
  ${laFascia}
  <g>${nodi.map((nodo) => ilNodo(nodo, veste)).join("")}</g>
  <g>${legenda}</g>
</svg>`;
}
