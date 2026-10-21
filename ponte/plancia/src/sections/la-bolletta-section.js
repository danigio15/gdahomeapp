/* La linguetta «Bollette» dentro Energia (#295).
 *
 * «E' possibile creare una nuova scheda che riporta i dati reali delle
 * bollette arrivate.» I dati li porta l'integrazione del fornitore — l'ultima
 * bolletta, quanto resta da pagare, il totale, la potenza impegnata, la
 * scadenza dell'offerta — e qui si mettono in una linguetta loro, in fondo
 * alla fila di Energia, come le Batterie. La linguetta c'e' solo quando c'e'
 * almeno un sensore di bolletta: chi non ne ha non vede niente di nuovo.
 *
 * Quali sensori sono quali lo dice `core/le-bollette.js`, che li trova da solo
 * dai nomi; nelle impostazioni dell'Energia c'e' la scheda per sceglierli a
 * mano, e la scelta vince.
 */
import {
  CHIAVE_BOLLETTE,
  VOCI_DELLA_BOLLETTA,
  laBolletta,
  mesiAllaScadenza,
  normalizzaBollette,
  sensoriDellaBolletta,
} from "../core/le-bollette.js";
import { createEntityPickerField } from "../core/renderers.js";
import {
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  locale,
  nomeDellEntita,
  onEditorRedraw,
  planciaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  senzaCadere,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_BOLLETTE__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  firma: "",
  /* Le bollette lette dalla posta, come le dice il ponte
   * (`ponte/bollette/stato`), e quando le si e' chieste. */
  posta: null,
  postaAlle: 0,
  postaInVolo: false,
  firmaPosta: "",
});

export const BOLLETTE_VIEW_ID = "view-bollette";
const LINGUETTA = "bollette";

/* Le parole delle voci, scritte per esteso: i cataloghi le trovano solo cosi'. */
function nomeDellaVoce(chiave) {
  if (chiave === "daPagare") return t("Da pagare", "To pay");
  if (chiave === "stato") return t("Stato del pagamento", "Payment status");
  if (chiave === "ultima") return t("Ultima bolletta", "Latest bill");
  if (chiave === "totale") return t("Totale fatturato", "Total billed");
  if (chiave === "potenza") return t("Potenza impegnata", "Contracted power");
  if (chiave === "scadenza") return t("Scadenza dell'offerta", "Offer expiry");
  return t("Consumo del giorno", "Daily consumption");
}

const salvate = () => normalizzaBollette(readJson(CHIAVE_BOLLETTE, {}));

/* ── la linguetta e la sua vista ──────────────────────────────────────── */

const paginaEnergia = () => doc?.getElementById?.("page-energy") || null;
const filaDelleLinguette = () =>
  paginaEnergia()?.querySelector?.(".sub-tabs-container .sub-tabs-energy") || null;
const laLinguetta = () =>
  filaDelleLinguette()?.querySelector?.(`[data-dm-energia-vista="${LINGUETTA}"]`) || null;
const laVista = () => doc?.getElementById?.(BOLLETTE_VIEW_ID) || null;

function ensureVista() {
  let vista = laVista();
  if (vista) return vista;
  const sorelle = paginaEnergia()?.querySelectorAll?.(".flow-view");
  if (!sorelle?.length) return null;
  vista = doc.createElement("div");
  vista.id = BOLLETTE_VIEW_ID;
  vista.className = "flow-view";
  vista.innerHTML = `<div class="dm-bol" id="bollette-wrap"></div>`;
  sorelle[sorelle.length - 1].after(vista);
  return vista;
}

function apriLeBollette() {
  const linguetta = ensureLinguetta();
  const vista = ensureVista();
  if (!linguetta || !vista) return false;
  for (const nodo of paginaEnergia().querySelectorAll(".sub-tabs-container .sub-tab-btn"))
    nodo.classList.remove("active");
  for (const nodo of doc.querySelectorAll(".flow-view")) nodo.classList.remove("active");
  linguetta.classList.add("active");
  vista.classList.add("active");
  linguetta.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "instant" });
  state.firma = "";
  dipingi();
  return true;
}

function ensureLinguetta() {
  const fila = filaDelleLinguette();
  if (!fila) return null;
  let linguetta = laLinguetta();
  if (linguetta) return linguetta;
  linguetta = doc.createElement("button");
  linguetta.type = "button";
  linguetta.className = "sub-tab-btn";
  linguetta.dataset.dmEnergiaVista = LINGUETTA;
  linguetta.innerHTML = `🧾 ${esc(t("Bollette", "Bills"))}`;
  linguetta.addEventListener("click", () => {
    if (root.navigator?.vibrate) root.navigator.vibrate(5);
    apriLeBollette();
    root.scrollTo?.({ top: 0, behavior: "instant" });
  });
  fila.append(linguetta);
  return linguetta;
}

function accendiLaLinguetta(bolletta) {
  const linguetta = ensureLinguetta();
  const vista = ensureVista();
  if (!linguetta || !vista) return;
  if (linguetta.parentElement?.lastElementChild !== linguetta)
    linguetta.parentElement.append(linguetta);
  const serve = Boolean(bolletta) || Boolean(state.posta?.collegata);
  linguetta.hidden = !serve;
  if (serve) linguetta.style.removeProperty("display");
  else linguetta.style.setProperty("display", "none", "important");
  if (!serve && vista.classList.contains("active")) {
    vista.classList.remove("active");
    linguetta.classList.remove("active");
    doc.getElementById("view-ist")?.classList.add("active");
    [...(filaDelleLinguette()?.querySelectorAll(".sub-tab-btn") || [])]
      .find((nodo) => /'ist'/.test(nodo.getAttribute("onclick") || ""))
      ?.classList.add("active");
  }
}

/* ── il disegno ───────────────────────────────────────────────────────── */

const euro = (n) => (n === null || n === undefined ? "—" : `${formatNumber(n, 2)} €`);

function dataScritta(quando) {
  return new Date(quando).toLocaleDateString(locale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fraQuanto(mesi) {
  if (mesi === null) return "";
  if (mesi < 0) return t("scaduta", "expired");
  if (mesi < 1) return t("meno di un mese", "less than a month");
  if (mesi < 24)
    return `${t("fra", "in")} ${mesi} ${mesi === 1 ? t("mese", "month") : t("mesi", "months")}`;
  return `${t("fra", "in")} ${Math.floor(mesi / 12)} ${t("anni", "years")}`;
}

function casella(chiave, valore, sotto = "", attenzione = false) {
  return `<div class="dm-bol-dato"${attenzione ? ' data-attenzione="true"' : ""}>
      <span>${esc(nomeDellaVoce(chiave))}</span>
      <b>${valore}</b>
      ${sotto ? `<small>${esc(sotto)}</small>` : ""}
    </div>`;
}

/* La data corta di una bolletta: «ottobre 2026». */
const meseScritto = (quando) =>
  new Date(quando).toLocaleDateString(locale(), { month: "long", year: "numeric" });
const giornoCorto = (quando) =>
  new Date(quando).toLocaleDateString(locale(), { day: "numeric", month: "short" });

/* La testa con l'ultima bolletta arrivata per posta, per chi non ha sensori. */
function testaDallaPosta(ultima, adesso) {
  const scaduta = ultima.scadenza && ultima.scadenza < adesso && ultima.pagata !== true;
  const pastiglia =
    ultima.pagata === true
      ? `<span class="dm-bol-stato" data-pagata="true">✓ ${esc(t("Addebito sul conto", "Direct debit"))}</span>`
      : "";
  const sotto = [
    ultima.nomeFornitore,
    ultima.scadenza ? `${t("Scadenza", "Due")} ${dataScritta(ultima.scadenza)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<section class="dm-bol-testa" data-pagata="${ultima.pagata === true ? "true" : scaduta ? "false" : ""}">
      <div class="dm-bol-riga">
        <div class="dm-bol-cifra"><small>${esc(t("Ultima bolletta", "Latest bill"))}</small><strong>${esc(euro(ultima.importo))}</strong></div>
        ${pastiglia}
      </div>
      ${sotto ? `<span class="dm-bol-sotto">${esc(sotto)}</span>` : ""}
    </section>`;
}

/* Le bollette arrivate, la piu' recente in cima, con una barra che dice
 * quanto pesa ognuna rispetto alla piu' cara. */
function storicoDallaPosta(bollette) {
  const elenco = bollette.slice(0, 12);
  const massimo = Math.max(...elenco.map((b) => b.importo || 0), 1);
  const righe = elenco
    .map((b) => {
      const quando = b.emessa || b.data;
      const dettagli = [
        b.periodo?.dal && b.periodo?.al
          ? `${giornoCorto(b.periodo.dal)} – ${giornoCorto(b.periodo.al)}`
          : "",
        b.consumo?.valore != null
          ? `${formatNumber(b.consumo.valore, 0)} ${b.consumo.unita === "kwh" ? "kWh" : b.consumo.unita}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `<li class="dm-bol-voce">
          <span class="dm-bol-quando"><b>${esc(quando ? meseScritto(quando) : "—")}</b>${dettagli ? `<small>${esc(dettagli)}</small>` : ""}</span>
          <span class="dm-bol-barra" aria-hidden="true"><i style="--quota:${Math.round(((b.importo || 0) / massimo) * 100)}"></i></span>
          <em>${esc(euro(b.importo))}</em>
        </li>`;
    })
    .join("");
  return `<section class="dm-bol-storico">
      <h3>${esc(t("Le bollette arrivate", "Bills received"))}</h3>
      <ul>${righe}</ul>
    </section>`;
}

export function paginaDelleBollette(bolletta, adesso = Date.now(), posta = null) {
  const dallaPosta = Array.isArray(posta?.bollette) ? posta.bollette : [];
  if (!bolletta && !dallaPosta.length) {
    if (!posta?.collegata) return "";
    return `<section class="dm-bol-testa"><div class="dm-bol-cifra"><small>${esc(
      t("Bollette dalla posta", "Bills from email"),
    )}</small></div><span class="dm-bol-sotto">${esc(
      t(
        "La casella è collegata, ma non c'e' ancora nessuna bolletta: arrivano con la prossima mail del fornitore.",
        "The mailbox is connected, but there is no bill yet: they arrive with the supplier's next email.",
      ),
    )}</span></section>`;
  }
  if (!bolletta)
    return `${testaDallaPosta(dallaPosta[0], adesso)}${storicoDallaPosta(dallaPosta)}
      <p class="dm-bol-nota">${esc(
        t(
          "Lette dalle mail del fornitore nella casella collegata, in sola lettura.",
          "Read from the supplier's emails in the connected mailbox, read-only.",
        ),
      )}</p>`;
  const { voci, daPagare, pagata } = bolletta;
  const pastiglia =
    pagata === true
      ? `<span class="dm-bol-stato" data-pagata="true">✓ ${esc(t("Pagata", "Paid"))}</span>`
      : pagata === false
        ? `<span class="dm-bol-stato" data-pagata="false">${esc(t("Non pagata", "Unpaid"))}</span>`
        : "";
  const grande =
    daPagare !== null
      ? `<small>${esc(t("Da pagare", "To pay"))}</small><strong>${esc(euro(daPagare))}</strong>`
      : `<small>${esc(t("Ultima bolletta", "Latest bill"))}</small><strong>${esc(euro(voci.ultima?.valore))}</strong>`;
  const sottoGrande =
    daPagare !== null && voci.ultima
      ? `<span class="dm-bol-sotto">${esc(t("Ultima bolletta", "Latest bill"))}: ${esc(euro(voci.ultima.valore))}</span>`
      : "";
  const caselle = [];
  if (voci.totale) caselle.push(casella("totale", esc(euro(voci.totale.valore))));
  if (voci.potenza)
    caselle.push(
      casella(
        "potenza",
        `${esc(voci.potenza.valore === null ? "—" : formatNumber(voci.potenza.valore, Number.isInteger(voci.potenza.valore) ? 0 : 1))} <i>${esc(voci.potenza.unita || "kW")}</i>`,
      ),
    );
  if (voci.scadenza) {
    const mesi = mesiAllaScadenza(voci.scadenza.data, adesso);
    caselle.push(
      casella(
        "scadenza",
        esc(voci.scadenza.data === null ? "—" : dataScritta(voci.scadenza.data)),
        fraQuanto(mesi),
        mesi !== null && mesi < 2,
      ),
    );
  }
  if (voci.consumoGiorno)
    caselle.push(
      casella(
        "consumoGiorno",
        `${esc(voci.consumoGiorno.valore === null ? "—" : formatNumber(voci.consumoGiorno.valore, 2))} <i>${esc(voci.consumoGiorno.unita || "kWh")}</i>`,
      ),
    );
  return `<section class="dm-bol-testa" data-pagata="${pagata === null ? "" : String(pagata)}">
      <div class="dm-bol-riga">
        <div class="dm-bol-cifra">${grande}</div>
        ${pastiglia}
      </div>
      ${sottoGrande}
    </section>
    ${caselle.length ? `<div class="dm-bol-dati">${caselle.join("")}</div>` : ""}
    ${dallaPosta.length ? storicoDallaPosta(dallaPosta) : ""}
    <p class="dm-bol-nota">${esc(
      t(
        "I dati arrivano dall'integrazione del fornitore. I sensori si scelgono in Config → Energia → Impostazioni.",
        "The data comes from the supplier's integration. Pick the sensors in Config → Energy → Settings.",
      ),
    )}</p>`;
}

function siVede() {
  return Boolean(
    planciaVisibile() &&
    paginaEnergia()?.classList.contains("active") &&
    laVista()?.classList.contains("active"),
  );
}

function dipingi(bolletta = laBolletta(allStates() || {}, salvate())) {
  const dove = laVista()?.querySelector?.("#bollette-wrap");
  if (!dove || !siVede()) return;
  const markup = paginaDelleBollette(bolletta, Date.now(), state.posta);
  if (state.firma === markup && dove.firstElementChild) return;
  state.firma = markup;
  dove.innerHTML = markup;
}

/* ── la scheda nelle impostazioni dell'Energia ────────────────────────── */

function ensureScheda() {
  const editor = doc?.querySelector?.(
    '#ed-body[data-editor="energy"],#editor-modal [data-editor="energy"]',
  );
  const impostazioni = editor?.querySelector?.('[data-energy-panel="settings"]');
  if (!impostazioni) return;
  let scheda = impostazioni.querySelector("#dm-energia-bollette");
  if (scheda) return;
  scheda = doc.createElement("div");
  scheda.id = "dm-energia-bollette";
  scheda.className = "ed-form dm-bol-scheda";
  const states = allStates() || {};
  const scelte = salvate().voci;
  const trovati = sensoriDellaBolletta(states, {});
  scheda.innerHTML = `<div class="ed-sec-title">🧾 ${esc(t("Bollette", "Bills"))}</div>
    <div class="ed-hint">${esc(
      t(
        "I sensori dell'integrazione del fornitore. Vuoto vuol dire che li cerca la plancia.",
        "The supplier integration's sensors. Empty means the dashboard finds them.",
      ),
    )}</div>
    <div class="dm-bol-campi"></div>
    <button type="button" class="ed-save-btn" data-dm-bol-salva>💾 ${esc(t("Salva", "Save"))}</button>`;
  const campi = scheda.querySelector(".dm-bol-campi");
  for (const voce of VOCI_DELLA_BOLLETTA) {
    const riga = doc.createElement("label");
    riga.className = "dm-bol-campo";
    riga.innerHTML = `<span>${esc(nomeDellaVoce(voce.chiave))}</span>`;
    const trovato = trovati[voce.chiave];
    const { field } = createEntityPickerField(doc, {
      id: `ed-bolletta-${voce.chiave}`,
      value: scelte[voce.chiave] || "",
      placeholder: trovato ? nomeDellEntita(trovato, "", states) : "sensor.…",
      label: nomeDellaVoce(voce.chiave),
      locale: locale(),
      onPick: (input) => root.wzPickEntity?.(input),
    });
    riga.append(field);
    campi.append(riga);
  }
  scheda.querySelector("[data-dm-bol-salva]").addEventListener("click", () => {
    const voci = {};
    for (const voce of VOCI_DELLA_BOLLETTA) {
      const scritto = clean(doc.getElementById(`ed-bolletta-${voce.chiave}`)?.value);
      if (scritto) voci[voce.chiave] = scritto;
    }
    writeJsonIfChanged(CHIAVE_BOLLETTE, normalizzaBollette({ voci }));
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
    root.edToast?.(t("Bollette salvate", "Bills saved"));
    state.firma = "";
    schedule();
  });
  impostazioni.append(scheda);
}

/* ── la posta, dal ponte ──────────────────────────────────────────────── */

/* Quello che sa il ponte delle bollette dalla posta, al piu' ogni cinque
 * minuti: le bollette arrivano una volta al mese. Senza ponte — la plancia
 * dentro Home Assistant senza add-on — la risposta e' «non conosco», e la
 * posta resta semplicemente spenta. */
function chiediLaPosta(forza = false) {
  const ora = Date.now();
  if (state.postaInVolo || (!forza && ora - state.postaAlle < 5 * 60_000)) return;
  state.postaInVolo = true;
  state.postaAlle = ora;
  chiediAHomeAssistant({ type: "ponte/bollette/stato" }, 10_000)
    .then((detto) => {
      state.posta = detto && typeof detto === "object" ? detto : null;
      state.firma = "";
      schedule();
    })
    .catch((errore) => {
      if (/socket/i.test(String(errore?.message || errore))) state.postaAlle = 0;
    })
    .finally(() => {
      state.postaInVolo = false;
    });
}

/* Le parole dei no del ponte, per chi sta collegando la casella. */
function perche(codice) {
  if (codice === "accesso-rifiutato")
    return t(
      "Gmail ha rifiutato l'accesso: controlla l'indirizzo e la password per app.",
      "Gmail refused the login: check the address and the app password.",
    );
  if (codice === "email-non-valida")
    return t("L'indirizzo non è valido.", "The address is not valid.");
  if (codice === "password-non-valida")
    return t(
      "La password per app ha 16 lettere: copiala da Google.",
      "The app password has 16 letters: copy it from Google.",
    );
  if (codice === "nessuna-risposta")
    return t("Gmail non ha risposto. Riprova.", "Gmail did not answer. Try again.");
  if (/admin|amministra|forbidden|unauthorized/i.test(codice))
    return t("Serve un utente amministratore.", "An administrator is needed.");
  return t("La posta non si raggiunge. Riprova.", "The mailbox can't be reached. Try again.");
}

function quandoLetta(alle) {
  if (!alle) return "";
  const minuti = Math.round((Date.now() - alle) / 60_000);
  if (minuti < 2) return t("adesso", "just now");
  if (minuti < 90) return `${minuti} ${t("minuti fa", "minutes ago")}`;
  return `${Math.round(minuti / 60)} ${t("ore fa", "hours ago")}`;
}

function schedaPostaMarkup(posta) {
  const noti = Array.isArray(posta?.fornitoriNoti) ? posta.fornitoriNoti : [];
  if (posta?.collegata) {
    const quante = posta.bollette?.length || 0;
    return `<div class="ed-sec-title">📧 ${esc(t("Bollette dalla posta", "Bills from email"))}</div>
      <div class="dm-bol-collegata">
        <b>${esc(t("Collegata", "Connected"))}: ${esc(posta.indirizzo || "")}</b>
        <small>${esc(
          [
            `${quante} ${quante === 1 ? t("bolletta", "bill") : t("bollette", "bills")}`,
            posta.lettoIl ? `${t("letta", "read")} ${quandoLetta(posta.lettoIl)}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
        )}</small>
        ${posta.errore ? `<small class="dm-bol-errore">${esc(perche(posta.errore))}</small>` : ""}
      </div>
      <div class="dm-bol-tasti">
        <button type="button" class="ed-save-btn" data-dm-posta-aggiorna>🔄 ${esc(t("Leggi adesso", "Read now"))}</button>
        <button type="button" class="ed-save-btn dm-bol-scollega" data-dm-posta-scollega>${esc(t("Scollega", "Disconnect"))}</button>
      </div>`;
  }
  const scelte = noti
    .map(
      (f) =>
        `<label class="dm-bol-forn"><input type="checkbox" value="${esc(f.id)}"${
          f.id === "enel" ? " checked" : ""
        }> ${esc(f.nome)}</label>`,
    )
    .join("");
  return `<div class="ed-sec-title">📧 ${esc(t("Bollette dalla posta", "Bills from email"))}</div>
    <div class="ed-hint">${esc(
      t(
        "Il ponte legge solo le mail dei fornitori scelti, in sola lettura, ogni sei ore. Serve una password per app di Google: Account Google → Sicurezza → Verifica in due passaggi → Password per le app. La password resta cifrata in casa e non si vede più.",
        "The bridge reads only the chosen suppliers' emails, read-only, every six hours. It needs a Google app password: Google Account → Security → 2-Step Verification → App passwords. The password stays encrypted at home and is never shown again.",
      ),
    )}</div>
    <label class="dm-bol-campo"><span>${esc(t("Indirizzo Gmail", "Gmail address"))}</span>
      <input class="ed-input" type="email" autocomplete="off" spellcheck="false" data-dm-posta-email placeholder="nome@gmail.com"></label>
    <label class="dm-bol-campo"><span>${esc(t("Password per app", "App password"))}</span>
      <input class="ed-input" type="password" autocomplete="new-password" spellcheck="false" data-dm-posta-password placeholder="xxxx xxxx xxxx xxxx"></label>
    <div class="dm-bol-campo"><span>${esc(t("Fornitori", "Suppliers"))}</span><div class="dm-bol-fornitori">${scelte}</div></div>
    <small class="dm-bol-errore" data-dm-posta-errore hidden></small>
    <button type="button" class="ed-save-btn" data-dm-posta-collega>🔗 ${esc(t("Collega", "Connect"))}</button>`;
}

function ensureSchedaPosta() {
  const editor = doc?.querySelector?.(
    '#ed-body[data-editor="energy"],#editor-modal [data-editor="energy"]',
  );
  const impostazioni = editor?.querySelector?.('[data-energy-panel="settings"]');
  if (!impostazioni || !state.posta) return;
  let scheda = impostazioni.querySelector("#dm-energia-posta");
  if (!scheda) {
    scheda = doc.createElement("div");
    scheda.id = "dm-energia-posta";
    scheda.className = "ed-form dm-bol-scheda";
    impostazioni.append(scheda);
    scheda.addEventListener("click", clicNellaSchedaPosta);
  }
  /* Riscritta solo quando cambia lo stato: chi sta scrivendo l'indirizzo non
   * deve vederselo strappare via a ogni giro. */
  const markup = schedaPostaMarkup(state.posta);
  if (state.firmaPosta === markup && scheda.firstElementChild) return;
  state.firmaPosta = markup;
  scheda.innerHTML = markup;
}

function chiedi(tipo, dati, tasto) {
  const parola = tasto.textContent;
  tasto.disabled = true;
  tasto.textContent = t("Un momento…", "One moment…");
  const errore = doc.querySelector("[data-dm-posta-errore]");
  if (errore) errore.hidden = true;
  return chiediAHomeAssistant({ type: tipo, ...dati }, 60_000)
    .then((detto) => {
      state.posta = detto;
      state.firma = "";
      state.firmaPosta = "";
      schedule();
    })
    .catch((no) => {
      tasto.disabled = false;
      tasto.textContent = parola;
      const codice = String(no?.code || no?.message || no || "");
      if (errore) {
        errore.textContent = perche(codice);
        errore.hidden = false;
      } else root.edToast?.(perche(codice));
    });
}

function clicNellaSchedaPosta(event) {
  const collega = event.target.closest?.("[data-dm-posta-collega]");
  if (collega) {
    event.preventDefault();
    const scheda = collega.closest("#dm-energia-posta");
    const email = clean(scheda.querySelector("[data-dm-posta-email]")?.value);
    const campo = scheda.querySelector("[data-dm-posta-password]");
    const password = clean(campo?.value);
    const fornitori = [...scheda.querySelectorAll(".dm-bol-forn input:checked")].map(
      (i) => i.value,
    );
    /* La password non resta nel campo: parte, e il campo si svuota. */
    if (campo) campo.value = "";
    chiedi("ponte/bollette/collega", { email, password, fornitori }, collega);
    return;
  }
  const aggiorna = event.target.closest?.("[data-dm-posta-aggiorna]");
  if (aggiorna) {
    event.preventDefault();
    chiedi("ponte/bollette/aggiorna", {}, aggiorna);
    return;
  }
  const scollega = event.target.closest?.("[data-dm-posta-scollega]");
  if (scollega) {
    event.preventDefault();
    const sicuro = root.confirm?.(
      t(
        "Scollegare la casella? Il ponte dimentica indirizzo, password e bollette lette.",
        "Disconnect the mailbox? The bridge forgets the address, the password and the bills it read.",
      ),
    );
    if (sicuro) chiedi("ponte/bollette/scollega", {}, scollega);
  }
}

/* ── i giri ───────────────────────────────────────────────────────────── */

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      chiediLaPosta();
      const bolletta = laBolletta(allStates() || {}, salvate());
      accendiLaLinguetta(bolletta);
      dipingi(bolletta);
      ensureScheda();
      ensureSchedaPosta();
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] bollette", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

function installStyles() {
  const V = `#${BOLLETTE_VIEW_ID}`;
  installStyle(
    "dm-bollette-style",
    `
    ${V} .dm-bol{display:grid;gap:14px;padding:4px 0 24px}
    ${V} .dm-bol-testa{display:grid;gap:6px;padding:20px 22px;border-radius:22px;min-width:0;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${V} .dm-bol-testa[data-pagata="false"]{border-color:color-mix(in srgb,#f59e0b 45%,var(--card-border,#e2e8f0))}
    ${V} .dm-bol-riga{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;min-width:0}
    ${V} .dm-bol-cifra{display:grid;gap:2px;min-width:0}
    ${V} .dm-bol-cifra small{font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    ${V} .dm-bol-cifra strong{font-family:Oswald,Inter,sans-serif;font-size:44px;font-weight:700;line-height:1;color:var(--text,#0f172a)}
    ${V} .dm-bol-testa[data-pagata="false"] .dm-bol-cifra strong{color:#c2410c}
    ${V} .dm-bol-stato{flex:0 0 auto;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:900;white-space:nowrap;
      background:rgba(245,158,11,.16);color:#b45309}
    ${V} .dm-bol-stato[data-pagata="true"]{background:rgba(22,163,74,.14);color:#15803d}
    ${V} .dm-bol-sotto{font-size:13px;font-weight:750;color:var(--text-dim,#64748b)}
    ${V} .dm-bol-dati{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
    ${V} .dm-bol-dato{display:grid;gap:3px;align-content:start;padding:14px 16px;border-radius:18px;min-width:0;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
    ${V} .dm-bol-dato span{font-size:10px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    ${V} .dm-bol-dato b{font-family:Oswald,Inter,sans-serif;font-size:24px;font-weight:600;line-height:1.1;color:var(--text,#0f172a)}
    ${V} .dm-bol-dato b i{font-style:normal;font-size:14px;color:var(--text-dim,#64748b)}
    ${V} .dm-bol-dato small{font-size:12px;font-weight:750;color:var(--text-dim,#64748b)}
    ${V} .dm-bol-dato[data-attenzione="true"] small{color:#b45309}
    ${V} .dm-bol-nota{margin:0;font-size:12px;font-weight:650;color:var(--text-dim,#64748b)}
    html[data-theme="dark"] ${V} .dm-bol-testa[data-pagata="false"] .dm-bol-cifra strong{color:#fdba74}
    html[data-theme="dark"] ${V} .dm-bol-stato{background:rgba(245,158,11,.2);color:#fcd34d}
    html[data-theme="dark"] ${V} .dm-bol-stato[data-pagata="true"]{background:rgba(34,197,94,.18);color:#86efac}
    ${V} .dm-bol-storico{display:grid;gap:10px;padding:18px 20px;border-radius:22px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
    ${V} .dm-bol-storico h3{margin:0;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    ${V} .dm-bol-storico ul{list-style:none;margin:0;padding:0;display:grid;gap:2px}
    ${V} .dm-bol-voce{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(60px,1fr) auto;align-items:center;gap:14px;
      padding:10px 0;border-top:1px solid var(--card-border,#eef2f7)}
    ${V} .dm-bol-voce:first-child{border-top:0}
    ${V} .dm-bol-quando{display:grid;gap:2px;min-width:0}
    ${V} .dm-bol-quando b{font-size:14px;font-weight:850;color:var(--text,#0f172a);text-transform:capitalize}
    ${V} .dm-bol-quando small{font-size:12px;font-weight:700;color:var(--text-dim,#64748b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${V} .dm-bol-barra{display:block;height:8px;border-radius:4px;background:var(--surface-2,#f1f5f9);overflow:hidden}
    ${V} .dm-bol-barra i{display:block;height:100%;width:calc(var(--quota) * 1%);border-radius:4px;background:#0ea5e9}
    ${V} .dm-bol-voce em{font-style:normal;font-family:Oswald,Inter,sans-serif;font-size:18px;font-weight:600;color:var(--text,#0f172a);white-space:nowrap}
    .dm-bol-collegata{display:grid;gap:3px;margin:6px 0 10px}
    .dm-bol-collegata b{font-size:14px;font-weight:850}
    .dm-bol-collegata small,.dm-bol-errore{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
    .dm-bol-errore{color:#b45309}
    .dm-bol-tasti{display:flex;flex-wrap:wrap;gap:8px}
    .dm-bol-scollega{background:transparent!important;color:var(--text-dim,#64748b)!important;border:1px solid var(--card-border,#e2e8f0)!important}
    .dm-bol-fornitori{display:flex;flex-wrap:wrap;gap:6px 14px}
    .dm-bol-forn{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700}
    .dm-bol-campi{display:grid;gap:10px;margin:8px 0 12px}
    .dm-bol-campo{display:grid;gap:4px}
    .dm-bol-campo>span{font-size:12px;font-weight:800;color:var(--text-dim,#64748b)}
    @media(max-width:520px){
      ${V} .dm-bol-cifra strong{font-size:36px}
      ${V} .dm-bol-voce{grid-template-columns:minmax(0,1fr) auto;gap:4px 12px}
      ${V} .dm-bol-quando small{white-space:normal}
      ${V} .dm-bol-barra{grid-column:1 / -1;grid-row:2;height:6px}
    }
    `,
  );
}

export function installLaBolletta() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  for (const nome of ["render", "switchEnergyView"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmBollette) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmBollette = true;
    avvolta.__dmPrevious = precedente;
    root[nome] = avvolta;
  }
  onEditorRedraw("__dmBolletteSection", schedule);
  for (const evento of [
    "dashboardmodern:editor-rendered",
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  doc.addEventListener?.("visibilitychange", schedule);
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

senzaCadere(installLaBolletta);
