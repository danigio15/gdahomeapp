/* Il pannello «I piani della casa», nella scheda Stanze del Config (#17).
 *
 * «Mi interessa gestire in maniera puntuale i piani nella dashboard. Anche
 *  perche' posso creare bagno primo piano e bagno secondo piano e le entita'
 *  poi devono funzionare divise, non e' la stessa stanza.»
 *
 * I piani c'erano gia', ed erano tre righe in fondo alla scheda: un elenco
 * piatto con il «＋» e il cestino. Non si ordinavano — e l'ordine e' quello con
 * cui si sale le scale, quindi decide la pagina Stanze, le scene delle luci e
 * le tapparelle — non si rinominavano, non avevano un segno (la mappa per
 * tenerlo c'era da sempre e nessuna casella la riempiva), e il cestino toglieva
 * il piano alle sue stanze senza dire quante fossero.
 *
 * ── Perche' in cima e non in fondo ────────────────────────────────────────
 *
 * Un piano e' il contenitore, una stanza e' quello che ci va dentro: si
 * costruisce prima il contenitore. In fondo alla scheda l'elenco dei piani
 * arrivava dopo il modulo «aggiungi stanza», cioe' dopo che avevi gia' dovuto
 * scegliere un piano in una tendina che magari era vuota.
 *
 * E le stanze, sotto, si raggruppano sotto il loro piano invece di portarsi
 * ognuna il suo cartellino: cosi' la scheda racconta la stessa cosa della
 * pagina Stanze, ed e' li' che ci si accorge che il primo piano ha una stanza
 * sola perche' le altre sono rimaste senza.
 *
 * ── L'avviso dei nomi uguali ──────────────────────────────────────────────
 *
 * Due stanze che si chiamano uguale sono legittime — il bagno di sotto e
 * quello di sopra — ma un'entita' assegnata col solo NOME non puo' piu' sapere
 * a quale delle due andare, e da adesso non va a nessuna (vedi
 * `belongsToRoom`). Prima andava alla prima, in silenzio. Il posto dove dirlo
 * e' questo, che e' anche il posto dove si rimedia.
 *
 * Qui non si decide niente: le regole stanno in `core/i-piani-della-casa.js`,
 * che si prova senza un documento. Qui si legge il deposito, si disegna e si
 * ascolta.
 */

import {
  CHIAVE_PIANI,
  CHIAVE_SEGNI_DEI_PIANI,
  NOME_GIA_PRESO,
  NOME_VUOTO,
  TROPPI_PIANI,
  aggiungiIlPiano,
  cancellaIlPiano,
  iPianiDellaCasa,
  ordinaLeStanzePerPiano,
  rinominaIlPiano,
  segnaIlPiano,
  spostaIlPiano,
  stanzeSenzaPiano,
  stessoOrdine,
} from "../core/i-piani-della-casa.js";
import { nomiRipetuti } from "../core/room-overview.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  section,
  t,
  tieniIlBloccoNellaScheda,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_I_PIANI__";
/* `errore` sta nello STATO e non solo nel documento.
 *
 * Scritto a mano dentro l'output, il primo ridisegno se lo portava via — e il
 * ridisegno lo scatena proprio chi scrive, perche' il pannello si rifa' quando
 * il corpo della scheda cambia figli. Chi preme «aggiungi» con un nome gia'
 * preso non vedeva niente e concludeva che il tasto non funzionasse. */
const state = (root[KEY] ||= {
  installed: false,
  chiedeDiCancellare: "",
  rinomina: "",
  segnoAperto: "",
  errore: "",
});

/* I segni fra cui si sceglie.
 *
 * Non sono il catalogo delle icone della plancia, ed e' voluto: quello e' un
 * catalogo di STANZE — divani, letti, fornelli — e sceglierci dentro il segno
 * di un piano vuol dire scorrere duecento disegni per trovare una scala. Qui
 * ce ne stanno otto, quelli che un piano puo' davvero essere, e si scelgono
 * con un tocco sopra la riga invece che in una finestra sopra la finestra. */
export const SEGNI_DEI_PIANI = Object.freeze([
  "🏢",
  "🏠",
  "🪜",
  "🛗",
  "🛏️",
  "🏚️",
  "🚗",
  "🌳",
]);

const ID_PANNELLO = "dm-piani-pannello";

/* ── quello che c'e' nel deposito ────────────────────────────────────────── */

function leStanze() {
  try {
    const sue = root.getStanze?.();
    if (Array.isArray(sue)) return sue;
  } catch (_errore) {}
  const dal = section("rooms", null);
  return Array.isArray(dal) ? dal : readJson("cd_stanze", []);
}

const iPiani = () => readJson(CHIAVE_PIANI, []);
const iSegni = () => {
  const mappa = readJson(CHIAVE_SEGNI_DEI_PIANI, {});
  return mappa && typeof mappa === "object" && !Array.isArray(mappa) ? mappa : {};
};

/* Salvare un piano puo' voler dire salvare tre cose insieme — i piani, le
 * stanze e i segni — perche' una rinomina le tocca tutte e tre. Salvarne due e
 * dimenticare la terza lascerebbe delle stanze su un piano che non esiste. */
function salva({ piani, stanze, segni }) {
  let cambiato = false;
  if (piani) cambiato = writeJsonIfChanged(CHIAVE_PIANI, piani, { sync: false }) || cambiato;
  if (stanze) cambiato = writeJsonIfChanged("cd_stanze", stanze, { sync: false }) || cambiato;
  if (segni)
    cambiato = writeJsonIfChanged(CHIAVE_SEGNI_DEI_PIANI, segni, { sync: false }) || cambiato;
  if (!cambiato) return false;
  root.cdMarkDirty?.();
  root.cdSyncPush?.();
  return true;
}

/* Ridisegnare la scheda la fa il guscio, che e' il suo padrone: si chiede a
 * lui invece di rimettere le mani nel documento. */
function rifaiLaScheda() {
  try {
    root.editorSwitch?.("stanze");
  } catch (_errore) {}
  try {
    root.buildTempCards?.();
  } catch (_errore) {}
}

/* ── il disegno ──────────────────────────────────────────────────────────── */

function quante(numero) {
  return numero === 1 ? t("1 stanza", "1 room") : `${numero} ${t("stanze", "rooms")}`;
}

/**
 * Il pannello, come markup.
 *
 * Non legge niente: entrano i piani gia' montati, le stanze rimaste senza e
 * cosa si sta chiedendo in questo momento; esce il disegno.
 *
 * `chiede` e' il nome del piano di cui si sta chiedendo conferma prima di
 * cancellarlo. La domanda sta DENTRO la riga e non in una finestra del
 * browser: e' la stessa regola del resto della plancia — «rinomina senza il
 * popup del browser» — e per di piu' qui la scheda e' gia' dentro una finestra.
 */
export function pannelloDeiPiani(
  piani,
  senza = [],
  { chiede = "", rinomina = "", segnoAperto = "", errore = "" } = {},
) {
  const tutte = piani.reduce((totale, piano) => totale + piano.stanze.length, 0) + senza.length;
  const righe = piani
    .map((piano, indice) => {
      const nomi = piano.stanze.map((stanza) => clean(stanza?.name)).filter(Boolean);
      if (chiede === piano.nome)
        return `
        <div class="dm-piano" data-dm-piano="${esc(piano.nome)}" data-chiede="si">
          <div class="dm-piano-icona">🗑️</div>
          <div class="dm-piano-domanda">
            <b>${esc(t("Elimino", "Delete"))} «${esc(piano.nome)}»?</b>
            <span>${
              /* Il numero davanti e la frase intera dietro: «Le sue» piu' il
               * conto piu' «restano senza piano» sono tre pezzi incollati, e
               * si incollano in quell'ordine solo in italiano. */
              piano.stanze.length
                ? esc(`${quante(piano.stanze.length)} ${t("restano senza piano: non vengono cancellate.", "are left with no floor: they are not deleted.")}`)
                : esc(t("Non ha stanze dentro.", "It has no rooms in it."))
            }</span>
          </div>
          <div class="dm-piano-tasti">
            <button type="button" data-dm-piano-annulla>${esc(t("Annulla", "Cancel"))}</button>
            <button type="button" class="dm-piano-rosso" data-dm-piano-cancella>${esc(t("Elimina", "Delete"))}</button>
          </div>
        </div>`;
      const titolo =
        rinomina === piano.nome
          ? `<input class="ed-input dm-piano-campo" value="${esc(piano.nome)}" data-dm-piano-nuovo-nome aria-label="${esc(t("Nome del piano", "Floor name"))}">`
          : `<div class="dm-piano-nome">${esc(piano.nome)}</div>
             <div class="dm-piano-stanze">${esc(quante(piano.stanze.length))}${nomi.length ? ` · ${esc(nomi.join(" · "))}` : ""}</div>`;
      const striscia =
        segnoAperto === piano.nome
          ? `<div class="dm-piano-segni">${SEGNI_DEI_PIANI.map(
              (voce) =>
                `<button type="button" data-dm-piano-scegli="${esc(voce)}"${voce === piano.segno ? ' aria-pressed="true"' : ""}>${esc(voce)}</button>`,
            ).join("")}</div>`
          : "";
      return `
      <div class="dm-piano" data-dm-piano="${esc(piano.nome)}">
        <div class="dm-piano-sposta">
          <button type="button" data-dm-piano-su ${indice === 0 ? "disabled" : ""} title="${esc(t("Più in alto", "Move up"))}" aria-label="${esc(t("Più in alto", "Move up"))}">▲</button>
          <button type="button" data-dm-piano-giu ${indice === piani.length - 1 ? "disabled" : ""} title="${esc(t("Più in basso", "Move down"))}" aria-label="${esc(t("Più in basso", "Move down"))}">▼</button>
        </div>
        <button type="button" class="dm-piano-icona" data-dm-piano-segno title="${esc(t("Cambia icona", "Change icon"))}">${esc(piano.segno)}</button>
        <div class="dm-piano-testa">${titolo}</div>
        <div class="dm-piano-tasti">
          <button type="button" data-dm-piano-rinomina title="${esc(t("Rinomina", "Rename"))}" aria-label="${esc(t("Rinomina", "Rename"))}">${rinomina === piano.nome ? "💾" : "✏️"}</button>
          <button type="button" data-dm-piano-chiedi title="${esc(t("Elimina", "Delete"))}" aria-label="${esc(t("Elimina", "Delete"))}">🗑️</button>
        </div>
        ${striscia}
      </div>`;
    })
    .join("");

  /* Le stanze rimaste senza piano hanno una riga loro, tratteggiata e senza
   * cestino: non e' un piano, e' quello che resta da sistemare. Compare solo
   * quando c'e' qualcosa dentro — una riga vuota che dice «zero» e' rumore. */
  const rimaste = senza.length
    ? `<div class="dm-piano" data-senza="si">
        <div class="dm-piano-sposta"></div>
        <div class="dm-piano-icona dm-piano-nessuno">—</div>
        <div class="dm-piano-testa">
          <div class="dm-piano-nome">${esc(t("Senza piano", "No floor"))}</div>
          <div class="dm-piano-stanze">${esc(quante(senza.length))} · ${esc(
            senza.map((stanza) => clean(stanza?.name)).filter(Boolean).join(" · "),
          )}</div>
        </div>
        <div class="dm-piano-tasti"></div>
      </div>`
    : "";

  return `
    <div class="dm-piani-testata">
      <div class="dm-piani-titolo">🏢 ${esc(t("I piani della casa", "The floors of the house"))}</div>
      <div class="dm-piani-conto">${esc(
        piani.length === 1 ? t("1 piano", "1 floor") : `${piani.length} ${t("piani", "floors")}`,
      )} · ${esc(quante(tutte))}</div>
    </div>
    ${righe || `<div class="dm-piani-vuoto">${esc(t("Nessun piano. Aggiungine uno qui sotto: serve solo se la casa ne ha più di uno.", "No floors yet. Add one below: you only need them if the house has more than one."))}</div>`}
    ${rimaste}
    <div class="dm-piano-nuovo">
      <input class="ed-input" data-dm-piano-nome placeholder="${esc(t("Nome piano (es. Mansarda)", "Floor name (e.g. Attic)"))}">
      <button type="button" class="ed-btn-add" data-dm-piano-aggiungi>＋ ${esc(t("Aggiungi piano", "Add floor"))}</button>
    </div>
    <output class="dm-piani-errore" data-dm-piano-errore>${esc(errore)}</output>
    <div class="dm-piani-nota">${esc(
      t(
        "L’ordine dei piani è quello che vedi qui: vale per la pagina Stanze, per le scene delle luci e per le tapparelle. Rinominare un piano si porta dietro le sue stanze; eliminarlo le lascia senza piano, e te lo chiede prima.",
        "The order of the floors is the one you see here: it applies to the Rooms page, to the light scenes and to the shutters. Renaming a floor carries its rooms along; deleting one leaves them with no floor, and asks you first.",
      ),
    )}</div>`;
}

/** Il titolo di un gruppo di stanze, nell'elenco sotto il pannello. */
function titoloDelGruppo(segno, nome) {
  const riga = doc.createElement("div");
  riga.className = "dm-piano-titolo-lista";
  riga.dataset.dmPianoTitolo = nome || "";
  riga.textContent = nome ? `${segno} ${nome}` : `— ${t("Senza piano", "No floor")}`;
  return riga;
}

/* Le righe delle stanze della scheda, in ordine: sono le `.ed-row` che stanno
 * PRIMA del modulo «aggiungi stanza», e sono nello stesso ordine dell'elenco
 * salvato — e' il guscio a stamparle cosi'. Le righe dei piani del vecchio
 * elenco stanno dopo il modulo, quindi restano fuori da sole. */
function righeDelleStanze(corpo) {
  const campo = corpo.querySelector("#ed-room-name");
  if (!campo) return [];
  return [...corpo.querySelectorAll(".ed-row")].filter(
    (riga) =>
      !riga.contains(campo) &&
      Boolean(riga.querySelector(".ed-del")) &&
      Boolean(riga.compareDocumentPosition(campo) & 4),
  );
}

/**
 * I titoli dei piani si infilano fra le righe. Le righe non si muovono.
 *
 * E' la parte che mi e' costata un giro. Raggruppare voleva dire spostare le
 * righe nel documento, e le frecce ▲▼ di ogni stanza il guscio le numera dalla
 * POSIZIONE NEL DOCUMENTO: spostandole, la matita apriva la stanza sbagliata e
 * la freccia ne muoveva un'altra. Due padroni per lo stesso ordine.
 *
 * Allora l'ordine e' uno solo, ed e' quello salvato: le stanze stanno
 * nell'elenco gia' divise per piano (vedi `ordinaLeStanzePerPiano`), e qui
 * basta mettere un titolo dove il piano cambia. Chi legge vede dei gruppi, e
 * il guscio vede l'elenco che ha stampato lui.
 */
function intitolaIGruppi(corpo, stanze, piani, ripetuti) {
  const righe = righeDelleStanze(corpo);
  if (!righe.length) return false;
  const segni = new Map(piani.map((piano) => [piano.nome, piano.segno]));
  /* Con un piano solo — o con nessuno — non si intitola niente: un titolo
   * sopra tutte le stanze della casa dice quello che si sa gia'. */
  const gruppi = new Set(stanze.map((stanza) => clean(stanza?.floor)));
  const intitolare = gruppi.size > 1;
  let ultimo = null;
  righe.forEach((riga, posizione) => {
    const stanza = stanze[posizione];
    riga.previousElementSibling?.classList?.contains("dm-piano-titolo-lista") &&
      riga.previousElementSibling.remove();
    if (intitolare && stanza) {
      const piano = clean(stanza.floor);
      if (piano !== ultimo) {
        ultimo = piano;
        riga.before(titoloDelGruppo(segni.get(piano) || "", piano));
      }
    }
    /* Il cartellino del piano sulla riga non serve piu': lo dice il titolo. */
    if (intitolare) riga.querySelector(".ed-row-old")?.remove();
    /* Il nome si legge dalla STANZA, non dalla riga.
     *
     * Dalla riga non si poteva: questa passata arriva prima che il guscio
     * abbia finito di scrivere il nome dentro la riga, e la casella era
     * ancora vuota — l'avviso non compariva mai, mentre il titolo del piano
     * qui sopra, che il nome non lo legge, compariva sempre. Il dato invece
     * c'e' da subito, ed e' anche quello giusto: il testo della riga lo
     * decorano in tre.
     *
     * E l'avviso si appende ACCANTO al nome, non dentro: chi decora la riga
     * riscrive il nodo del nome per intero (`label.textContent = name`), e un
     * avviso messo li' dentro spariva un istante dopo essere comparso senza
     * che niente avvisasse di rifarlo. Il riquadro che lo contiene invece non
     * lo tocca nessuno.
     *
     * Due stanze con lo stesso nome sono legittime, ma un'entita' assegnata
     * col solo nome non puo' piu' sapere a quale andare — e da adesso non va
     * a nessuna delle due invece di andare alla prima in silenzio. Questo e'
     * il posto dove dirlo, ed e' anche il posto dove si rimedia. */
    const dove = riga.querySelector(".ed-row-main") || riga;
    dove.querySelector(".dm-piano-doppio")?.remove();
    if (!stanza || !ripetuti.has(clean(stanza.name).toLowerCase())) return;
    const avviso = doc.createElement("span");
    avviso.className = "dm-piano-doppio";
    avviso.textContent = `⚠️ ${t("stesso nome di un'altra stanza", "same name as another room")}`;
    dove.append(avviso);
  });
  return true;
}

/* Il vecchio elenco dei piani, in fondo alla scheda: quello che faceva lo fa il
 * pannello in cima, e tenerli tutti e due vorrebbe dire due posti dove
 * aggiungere un piano e uno solo dove ordinarlo. */
function togliIlVecchioElenco(corpo) {
  const intro = [...corpo.querySelectorAll(".ed-intro")].find((nodo) =>
    nodo.querySelector("b")?.textContent?.trim().startsWith("piani"),
  );
  if (!intro) return false;
  let nodo = intro.nextElementSibling;
  while (nodo) {
    const dopo = nodo.nextElementSibling;
    const suo =
      nodo.querySelector?.("#ed-floor-name") ||
      nodo.querySelector?.('[onclick^="edFloorDel"]') ||
      nodo.querySelector?.('[onclick^="edFloorAdd"]');
    if (!suo) break;
    nodo.remove();
    nodo = dopo;
  }
  intro.remove();
  return true;
}

export function disegnaIPiani() {
  const corpo = doc?.getElementById("ed-body");
  /* Solo sulla scheda Stanze: il corpo e' lo stesso nodo per tutte le
   * linguette, e la riconosce il modulo che ci sta dentro. */
  if (!corpo || !corpo.querySelector("#ed-room-name")) return false;

  const stanze = leStanze();
  /* L'elenco salvato si tiene in ordine di piano. Non e' un vezzo: e' l'unico
   * modo di avere dei gruppi a schermo senza spostare le righe sotto i piedi
   * alle frecce del guscio, che contano dal documento. Si salva solo quando
   * cambia davvero, e il riordino e' idempotente: due giri non fanno due
   * scritture. */
  const messe = ordinaLeStanzePerPiano(stanze, iPiani());
  if (!stessoOrdine(stanze, messe)) {
    salva({ stanze: messe });
    rifaiLaScheda();
    return true;
  }
  const piani = iPianiDellaCasa(iPiani(), stanze, iSegni());
  const senza = stanzeSenzaPiano(stanze);
  const ripetuti = nomiRipetuti(stanze);

  let pannello = doc.getElementById(ID_PANNELLO);
  if (!pannello) {
    pannello = doc.createElement("div");
    pannello.id = ID_PANNELLO;
    pannello.className = "dm-piani";
  }
  const markup = pannelloDeiPiani(piani, senza, {
    chiede: state.chiedeDiCancellare,
    rinomina: state.rinomina,
    segnoAperto: state.segnoAperto,
    errore: state.errore,
  });
  if (pannello.innerHTML !== markup) pannello.innerHTML = markup;
  /* Sempre subito dopo la riga che spiega la scheda: il piano e' il
   * contenitore, la stanza e' quello che ci va dentro. */
  const intro = corpo.querySelector(".ed-intro");
  if (intro && pannello.previousElementSibling !== intro) intro.after(pannello);
  else if (!intro && !pannello.isConnected) corpo.prepend(pannello);

  intitolaIGruppi(corpo, stanze, piani, ripetuti);
  togliIlVecchioElenco(corpo);

  if (state.rinomina) {
    const campo = pannello.querySelector("[data-dm-piano-nuovo-nome]");
    if (campo && doc.activeElement !== campo) {
      campo.focus();
      campo.select?.();
    }
  }
  return true;
}

/* ── i tocchi ────────────────────────────────────────────────────────────── */

function dillo(messaggio) {
  state.errore = messaggio;
  disegnaIPiani();
}

const PERCHE_NO = {
  [NOME_VUOTO]: () => t("Scrivi il nome del piano.", "Type the floor name."),
  [NOME_GIA_PRESO]: () => t("Un piano si chiama già così.", "A floor is already called that."),
  [TROPPI_PIANI]: () => t("Hai già tutti i piani che si possono avere.", "You already have every floor you can have."),
};

function esito(risposta, dopo) {
  if (risposta?.errore) {
    dillo((PERCHE_NO[risposta.errore] || (() => ""))());
    return false;
  }
  state.errore = "";
  salva(risposta);
  dopo?.();
  return true;
}

function nomeDellaRiga(bersaglio) {
  return clean(bersaglio.closest("[data-dm-piano]")?.dataset.dmPiano);
}

function alTocco(evento) {
  const bersaglio = evento.target?.closest?.("button");
  if (!bersaglio || !bersaglio.closest(`#${ID_PANNELLO}`)) return;
  const nome = nomeDellaRiga(bersaglio);
  const stanze = leStanze();

  if (bersaglio.hasAttribute("data-dm-piano-su") || bersaglio.hasAttribute("data-dm-piano-giu")) {
    evento.preventDefault();
    const verso = bersaglio.hasAttribute("data-dm-piano-su") ? -1 : 1;
    /* Un piano che esiste solo addosso a una stanza non sta nell'elenco
     * salvato, e senza un posto non si puo' spostare: si dichiara al primo
     * tocco, che e' anche quello che uno si aspetta premendo la freccia. */
    const dichiarati = iPianiDellaCasa(iPiani(), stanze, iSegni()).map((piano) => piano.nome);
    salva({ piani: spostaIlPiano(dichiarati, nome, verso) });
    rifaiLaScheda();
    return;
  }

  if (bersaglio.hasAttribute("data-dm-piano-chiedi")) {
    evento.preventDefault();
    state.chiedeDiCancellare = nome;
    state.rinomina = "";
    disegnaIPiani();
    return;
  }

  if (bersaglio.hasAttribute("data-dm-piano-annulla")) {
    evento.preventDefault();
    state.chiedeDiCancellare = "";
    disegnaIPiani();
    return;
  }

  if (bersaglio.hasAttribute("data-dm-piano-cancella")) {
    evento.preventDefault();
    state.chiedeDiCancellare = "";
    salva(cancellaIlPiano(iPiani(), stanze, iSegni(), nome));
    rifaiLaScheda();
    return;
  }

  if (bersaglio.hasAttribute("data-dm-piano-rinomina")) {
    evento.preventDefault();
    if (state.rinomina !== nome) {
      state.rinomina = nome;
      state.chiedeDiCancellare = "";
      disegnaIPiani();
      return;
    }
    const campo = bersaglio.closest("[data-dm-piano]")?.querySelector("[data-dm-piano-nuovo-nome]");
    const nuovo = clean(campo?.value);
    if (esito(rinominaIlPiano(iPiani(), stanze, iSegni(), nome, nuovo))) {
      state.rinomina = "";
      rifaiLaScheda();
    }
    return;
  }

  if (bersaglio.hasAttribute("data-dm-piano-segno")) {
    evento.preventDefault();
    /* Un secondo tocco richiude: la striscia e' un cassetto, non una finestra
     * che va chiusa con la sua crocetta. */
    state.segnoAperto = state.segnoAperto === nome ? "" : nome;
    disegnaIPiani();
    return;
  }

  if (bersaglio.hasAttribute("data-dm-piano-scegli")) {
    evento.preventDefault();
    salva({ segni: segnaIlPiano(iSegni(), nome, bersaglio.dataset.dmPianoScegli) });
    state.segnoAperto = "";
    disegnaIPiani();
    return;
  }

  if (bersaglio.hasAttribute("data-dm-piano-aggiungi")) {
    evento.preventDefault();
    const campo = doc.querySelector(`#${ID_PANNELLO} [data-dm-piano-nome]`);
    if (esito(aggiungiIlPiano(iPiani(), clean(campo?.value)))) {
      if (campo) campo.value = "";
      rifaiLaScheda();
    }
  }
}

/* Il tasto invio nelle due caselle fa quello che fa il tasto accanto: chi
 * scrive un nome e preme invio si aspetta che il nome sia scritto. */
function allaTastiera(evento) {
  if (evento.key !== "Enter") return;
  const campo = evento.target;
  if (!campo?.closest?.(`#${ID_PANNELLO}`)) return;
  if (campo.hasAttribute("data-dm-piano-nome")) {
    evento.preventDefault();
    doc.querySelector(`#${ID_PANNELLO} [data-dm-piano-aggiungi]`)?.click();
    return;
  }
  if (campo.hasAttribute("data-dm-piano-nuovo-nome")) {
    evento.preventDefault();
    campo.closest("[data-dm-piano]")?.querySelector("[data-dm-piano-rinomina]")?.click();
  }
}

function foglio() {
  installStyle(
    "dm-i-piani-style",
    `
      .dm-piani{margin:6px 0 18px!important;padding:15px 16px!important;border-radius:20px!important;background:var(--card-background-color,#fff)!important;border:1px solid var(--divider-color,#e2e8f0)!important;display:grid!important;gap:10px!important}
      .dm-piani-testata{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;flex-wrap:wrap!important}
      .dm-piani-titolo{font-size:14px!important;font-weight:900!important;color:var(--primary-text-color,#0f172a)!important}
      .dm-piani-conto{font-size:11px!important;font-weight:800!important;color:var(--secondary-text-color,#64748b)!important;background:var(--secondary-background-color,#eef2f7)!important;padding:5px 10px!important;border-radius:999px!important}
      .dm-piani-vuoto{font-size:12px!important;line-height:1.5!important;color:var(--secondary-text-color,#64748b)!important;padding:8px 2px!important}
      .dm-piano{display:grid!important;grid-template-columns:32px 46px minmax(0,1fr) auto!important;align-items:center!important;gap:10px!important;padding:9px 11px!important;border-radius:14px!important;background:var(--secondary-background-color,#f6f8fb)!important;border:1px solid transparent!important}
      .dm-piano[data-senza="si"]{background:transparent!important;border:1px dashed var(--divider-color,#dbe4ee)!important}
      .dm-piano[data-chiede="si"]{grid-template-columns:46px minmax(0,1fr) auto!important;background:color-mix(in srgb,var(--error-color,#ef4444) 9%,transparent)!important}
      .dm-piano-sposta{display:grid!important;gap:2px!important}
      .dm-piano-sposta button{border:0!important;background:transparent!important;cursor:pointer!important;font-size:10px!important;line-height:1!important;color:var(--secondary-text-color,#64748b)!important;padding:2px!important}
      .dm-piano-sposta button[disabled]{opacity:.28!important;cursor:default!important}
      .dm-piano-icona{display:grid!important;place-items:center!important;width:42px!important;height:42px!important;border-radius:13px!important;background:var(--card-background-color,#fff)!important;border:1px solid var(--divider-color,#e2e8f0)!important;font-size:21px!important;cursor:pointer!important;padding:0!important}
      .dm-piano-nessuno{opacity:.45!important;cursor:default!important}
      .dm-piano-testa{min-width:0!important}
      .dm-piano-nome{font-size:13.5px!important;font-weight:900!important;color:var(--primary-text-color,#0f172a)!important}
      .dm-piano-stanze{font-size:11px!important;font-weight:700!important;color:var(--secondary-text-color,#64748b)!important;margin-top:2px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .dm-piano-campo{width:100%!important}
      .dm-piano-domanda{min-width:0!important;font-size:12.5px!important;line-height:1.45!important;color:var(--primary-text-color,#0f172a)!important}
      .dm-piano-domanda span{display:block!important;font-size:11px!important;font-weight:700!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-piano-tasti{display:flex!important;gap:5px!important}
      .dm-piano-tasti button{border:1px solid var(--divider-color,#e2e8f0)!important;min-width:32px!important;height:32px!important;padding:0 9px!important;border-radius:10px!important;background:var(--card-background-color,#fff)!important;cursor:pointer!important;font-size:13px!important;font-weight:800!important;color:var(--primary-text-color,#0f172a)!important}
      .dm-piano-rosso{background:var(--error-color,#ef4444)!important;border-color:transparent!important;color:#fff!important}
      .dm-piano-segni{grid-column:1/-1!important;display:flex!important;flex-wrap:wrap!important;gap:6px!important;padding-top:4px!important}
      .dm-piano-segni button{border:1px solid var(--divider-color,#e2e8f0)!important;width:38px!important;height:38px!important;border-radius:11px!important;background:var(--card-background-color,#fff)!important;cursor:pointer!important;font-size:19px!important;padding:0!important}
      .dm-piano-segni button[aria-pressed="true"]{border-color:var(--primary-color,#0ea5e9)!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--primary-color,#0ea5e9) 28%,transparent)!important}
      .dm-piano-nuovo{display:flex!important;gap:8px!important;align-items:center!important}
      .dm-piano-nuovo .ed-input{flex:1 1 auto!important;min-width:0!important}
      .dm-piano-nuovo .ed-btn-add{flex:0 0 auto!important}
      .dm-piani-errore:empty{display:none!important}
      .dm-piani-errore{font-size:11.5px!important;font-weight:800!important;color:var(--error-color,#dc2626)!important}
      .dm-piani-nota{font-size:11px!important;line-height:1.5!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-piano-titolo-lista{display:flex!important;align-items:center!important;gap:8px!important;margin:16px 0 6px!important;font-size:12px!important;font-weight:900!important;letter-spacing:.04em!important;text-transform:uppercase!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-piano-titolo-lista::after{content:""!important;flex:1!important;height:1px!important;background:var(--divider-color,#e2e8f0)!important}
      .dm-piano-doppio{display:inline-flex!important;align-items:center!important;gap:4px!important;margin-left:7px!important;padding:2px 7px!important;border-radius:999px!important;background:color-mix(in srgb,var(--warning-color,#f59e0b) 22%,transparent)!important;color:#92400e!important;font-size:10px!important;font-weight:900!important;vertical-align:middle!important;white-space:nowrap!important}
      @media (max-width:620px){
        .dm-piano{grid-template-columns:28px 40px minmax(0,1fr)!important;gap:8px!important;row-gap:8px!important}
        .dm-piano[data-chiede="si"]{grid-template-columns:40px minmax(0,1fr)!important}
        .dm-piano-icona{width:38px!important;height:38px!important;font-size:19px!important}
        .dm-piano-tasti{grid-column:1/-1!important;justify-content:flex-end!important}
        .dm-piano-nuovo{flex-wrap:wrap!important}
        .dm-piano-nuovo .ed-input{flex:1 1 100%!important}
        .dm-piano-nuovo .ed-btn-add{flex:1 1 auto!important}
        .dm-piano-doppio{display:flex!important;margin:4px 0 0!important;white-space:normal!important}
      }
    `,
  );
}

export function installIPianiSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  foglio();
  doc.addEventListener("click", alTocco, true);
  doc.addEventListener("keydown", allaTastiera, true);
  tieniIlBloccoNellaScheda("__dmIPiani", disegnaIPiani);
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installIPianiSection, { once: true });
else installIPianiSection();
