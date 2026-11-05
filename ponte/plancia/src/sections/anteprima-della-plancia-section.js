/* L'anteprima della plancia, nel Config (#379).
 *
 * «Il drag e drop non deve essere sulla plancia: ti avevo detto di creare
 * un'anteprima nel Config dove si fa questa cosa. Nella plancia non voglio
 * vedere alcuna matita con modifica.»
 *
 * Nella scheda di una sezione del Config (l'Energia, la Sicurezza…) c'e' la
 * sezione vera, coi dati veri, dentro una cornice larga quanto il telefono o
 * quanto il computer. Dentro si spostano i riquadri, gli elementi degli
 * elenchi e i pezzi dei disegni, con la stessa modalita' che prima stava sulla
 * plancia (`disposizione-section.js`, `disegni-che-si-spostano-section.js`);
 * sopra la cornice la barra: «N modifiche · Annulla · Ripristina · Salva».
 * Niente si scrive finche' non si preme Salva, e dopo Salva la plancia e'
 * cosi'.
 *
 * Perche' una cornice, e non la pagina messa dentro il Config: perche' una
 * pagina si dispone secondo lo schermo — le sue regole per lo schermo stretto,
 * il disegno del telefono e quello del computer — e solo una cornice larga
 * 390 punti e' uno schermo da telefono anche su un computer. Dentro gira
 * questa stessa plancia, e la cornice porta scritto quale pagina e quale
 * schermo (`data-dm-anteprima`): il guscio la rende un'anteprima prima di
 * ogni altra cosa (`legacy/storage-namespace.js`) — legge la configurazione
 * vera e gli stati veri, ma quello che scrive resta in memoria e i comandi
 * alla casa non partono. Cosa si salva lo scrive la plancia di fuori
 * (`dmScriviDallAnteprima`), con la sua sincronia.
 *
 * Funziona allo stesso modo nei tre posti in cui la plancia vive: dentro Home
 * Assistant il documento e' `about:srcdoc` e la cornice si costruisce col
 * guscio letto dal suo indirizzo; nell'app e nel sito la cornice ricarica lo
 * stesso indirizzo della plancia.
 *
 * Questo modulo ha due meta': quella del Config (il pannello, la barra, la
 * cornice) e quella dentro la cornice (la pagina giusta, la modifica sempre
 * accesa, il conto delle modifiche detto a chi ospita).
 */
import {
  DISPOSITIVI,
  dispositivoDiPartenza,
  documentoDellAnteprima,
  guscioPerLaLingua,
  paginaDellaScheda,
  scalaPer,
  schermoDi,
  segnoDellaCornice,
} from "../core/anteprima-della-plancia.js";
import { ridisegnaIDisegni } from "./disegni-che-si-spostano-section.js";
import { azioneDellaModifica, entraInModifica, quanteModifiche } from "./disposizione-section.js";
import {
  SCRITTE_DALL_ANTEPRIMA,
  doc,
  esc,
  installStyle,
  root,
  senzaCadere,
  t,
  tieniIlBloccoNellaScheda,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ANTEPRIMA_DELLA_PLANCIA__";
const state = (root[KEY] ||= {
  installed: false,
  pagina: "",
  dispositivo: "",
  cornice: null,
  aperta: new Set(),
  n: 0,
  pronta: false,
});

/* ════════════════════════════════════════════════════════════════════════
 * Dentro la cornice
 * ════════════════════════════════════════════════════════════════════════ */

function nellAnteprima() {
  return root.__DASHBOARDMODERN_ANTEPRIMA__ || null;
}

function diA(chi, messaggio) {
  try {
    root.parent?.postMessage?.({ source: "dm-anteprima", ...messaggio }, "*");
  } catch (_errore) {}
  return chi;
}

/* La plancia attorno alla pagina non c'entra: la barra delle sezioni, la
 * testata, l'assistente, la procedura del primo avvio. */
const STILE_DENTRO = `
html[data-dm-anteprima] nav.tabs,
html[data-dm-anteprima] body>header,
html[data-dm-anteprima] #setup-wizard,
html[data-dm-anteprima] #dm-assist-tasto,
html[data-dm-anteprima] #bottomNavHandle,
html[data-dm-anteprima] .dm-nav-fab{display:none!important}
html[data-dm-anteprima] body{padding-bottom:0!important}
`;

function paginaDellAnteprima() {
  const quale = nellAnteprima()?.pagina || "";
  return quale ? doc.getElementById(`page-${quale}`) : null;
}

function inModifica() {
  return doc.documentElement.hasAttribute("data-dm-modifica");
}

/* La pagina davanti, e la modifica accesa. Si riprova finche' la plancia non
 * e' partita: il runtime, le sezioni, il permesso di configurare arrivano in
 * momenti diversi. */
function mettiInModifica(tentativi = 0) {
  const quale = nellAnteprima()?.pagina || "";
  const pagina = paginaDellAnteprima();
  const voce = doc.querySelector(`.tab[data-tab="${quale}"]`);
  const pronta = Boolean(pagina && (voce || typeof root.switchTab === "function"));
  if (pronta) {
    doc.getElementById("setup-wizard")?.remove();
    /* Si apre come la apre chi tocca la sua voce nella barra (che qui non
     * si vede, ma c'e'). */
    if (!pagina.classList.contains("active")) {
      try {
        if (voce) voce.click();
        else root.switchTab(quale);
      } catch (_errore) {}
    }
    if (pagina.classList.contains("active") && !inModifica()) entraInModifica(pagina);
    if (inModifica()) {
      if (!state.pronta) {
        state.pronta = true;
        diA(null, { tipo: "pronta", pagina: quale });
      }
      diA(null, { tipo: "conta", n: quanteModifiche() });
      return;
    }
  }
  if (tentativi < 300) root.setTimeout?.(() => mettiInModifica(tentativi + 1), 200);
}

function installaDentro() {
  const anteprima = nellAnteprima();
  doc.documentElement.setAttribute("data-dm-anteprima", anteprima.dispositivo || "");
  installStyle("dm-anteprima-dentro", STILE_DENTRO);
  root.dmAnteprima = {
    azione(nome) {
      azioneDellaModifica(nome);
      diA(null, { tipo: "conta", n: quanteModifiche() });
    },
    conta: () => quanteModifiche(),
    pronta: () => state.pronta,
    /* La modifica si chiude con Salva, Annulla ed Esc, e qui deve restare
     * accesa: chi la chiude chiama questo (`disposizione-section.js`). */
    riprendi: () => root.setTimeout?.(() => mettiInModifica(), 0),
  };
  mettiInModifica();
}

/* ════════════════════════════════════════════════════════════════════════
 * Nel Config
 * ════════════════════════════════════════════════════════════════════════ */

function schedaAttiva() {
  return String(doc.querySelector(".ed-tab.active")?.dataset?.tab || "");
}

function etichettaDelDispositivo(dispositivo) {
  return dispositivo === "telefono" ? t("📱 Telefono", "📱 Phone") : t("🖥️ Computer", "🖥️ Computer");
}

function contoScritto(n) {
  if (!state.pronta) return t("Preparo l'anteprima…", "Getting the preview ready…");
  if (n === 0) return t("Trascina riquadri, elementi e pezzi dei disegni", "Drag boxes, items and drawing pieces");
  return n === 1 ? t("1 modifica", "1 change") : t(`${n} modifiche`, `${n} changes`);
}

function pannelloMarkup(pagina) {
  const aperta = state.aperta.has(pagina);
  const dispositivo = state.dispositivo || dispositivoDiPartenza(root.innerWidth);
  return `<div class="dm-ant-testa">
      <div class="dm-ant-titolo"><b>${esc(t("✋ Sposta e nascondi", "✋ Move and hide"))}</b>
        <small>${esc(
          t(
            "Questa è la sezione com'è sulla plancia. Trascina i riquadri, gli elementi e i pezzi dei disegni dove li vuoi, nascondi con l'occhio, poi Salva: la plancia sarà così. Il telefono e il computer hanno ognuno la sua.",
            "This is the section as it looks on the dashboard. Drag boxes, items and drawing pieces where you want them, hide with the eye, then Save: the dashboard will look like this. Phone and computer each have their own.",
          ),
        )}</small></div>
      <div class="dm-ant-schermi" role="group" aria-label="${esc(t("Schermo", "Screen"))}">${DISPOSITIVI.map(
        (d) =>
          `<button type="button" data-dm-ant-dispositivo="${d}" aria-pressed="${aperta && d === dispositivo}">${esc(
            etichettaDelDispositivo(d),
          )}</button>`,
      ).join("")}</div>
    </div>
    ${
      aperta
        ? `<div class="dm-ant-schermo" data-dm-ant-schermo></div>
    <div class="dm-ant-barra" role="toolbar" aria-label="${esc(t("Modifiche dell'anteprima", "Preview changes"))}">
      <span class="dm-ant-conta" aria-live="polite"></span>
      <button type="button" data-dm-ant-azione="annulla">${esc(t("Annulla", "Cancel"))}</button>
      <button type="button" data-dm-ant-azione="ripristina">${esc(t("Ripristina", "Reset"))}</button>
      <button type="button" class="dm-ant-salva" data-dm-ant-azione="salva">${esc(t("Salva", "Save"))}</button>
    </div>`
        : `<button type="button" class="dm-ant-apri" data-dm-ant-apri>${esc(
            t("▶ Apri l'anteprima", "▶ Open the preview"),
          )}</button>`
    }`;
}

function rifaiLaBarra(pannello = doc.querySelector("[data-dm-anteprima-pannello]")) {
  if (!pannello) return;
  const n = state.n;
  const conta = pannello.querySelector(".dm-ant-conta");
  if (conta) conta.textContent = contoScritto(n);
  for (const tasto of pannello.querySelectorAll("[data-dm-ant-azione]")) {
    const azione = tasto.getAttribute("data-dm-ant-azione");
    tasto.disabled = !state.pronta || ((azione === "salva" || azione === "annulla") && n === 0);
  }
  const salva = pannello.querySelector(".dm-ant-salva");
  if (salva) salva.textContent = n ? `${t("Salva", "Save")} · ${n}` : t("Salva", "Save");
}

function dimensiona(pannello = doc.querySelector("[data-dm-anteprima-pannello]")) {
  const schermo = pannello?.querySelector?.("[data-dm-ant-schermo]");
  const cornice = state.cornice;
  if (!schermo || !cornice) return;
  const { larghezza, altezza } = schermoDi(state.dispositivo);
  const colonna = pannello.getBoundingClientRect().width - 2;
  /* Lo schermo intero davanti: l'altezza della finestra, meno la testa del
   * Config e la barra dell'anteprima. */
  const alto = Math.max(380, (root.innerHeight || 0) - ((root.innerWidth || 0) <= 560 ? 270 : 250));
  const scala = scalaPer(colonna, state.dispositivo, alto);
  schermo.style.width = `${Math.round(larghezza * scala)}px`;
  schermo.style.height = `${Math.round(altezza * scala)}px`;
  cornice.style.width = `${larghezza}px`;
  cornice.style.height = `${altezza}px`;
  cornice.style.transform = scala === 1 ? "" : `scale(${scala})`;
  schermo.setAttribute("data-dm-ant-scala", String(Math.round(scala * 1000) / 1000));
}

async function caricaLaCornice(cornice) {
  /* Dentro Home Assistant la plancia e' `about:srcdoc`: non ha un indirizzo
   * da ricaricare, si costruisce col guscio letto dal suo posto (come fa
   * `legacy/host.js`). Fuori, la cornice ricarica lo stesso indirizzo. */
  if (root.location?.protocol === "about:") {
    const lingua = root.__DASHBOARDMODERN_LOCALE__ || doc.documentElement.lang || "";
    const base = doc.baseURI;
    const risposta = await root.fetch(new URL(guscioPerLaLingua(lingua), base).href, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!risposta.ok) throw new Error(`anteprima: ${risposta.status}`);
    cornice.srcdoc = documentoDellAnteprima(await risposta.text(), { base, lingua });
    return;
  }
  cornice.src = String(root.location.href).split("#")[0];
}

function apriLaCornice(pannello, pagina, dispositivo) {
  const schermo = pannello.querySelector("[data-dm-ant-schermo]");
  if (!schermo) return;
  state.pagina = pagina;
  state.dispositivo = dispositivo;
  state.n = 0;
  state.pronta = false;
  const cornice = doc.createElement("iframe");
  cornice.className = "dm-ant-cornice";
  cornice.setAttribute("data-dm-anteprima", segnoDellaCornice(pagina, dispositivo));
  cornice.setAttribute("title", t("Anteprima della sezione", "Section preview"));
  cornice.setAttribute("allow", "fullscreen");
  schermo.replaceChildren(cornice);
  state.cornice = cornice;
  dimensiona(pannello);
  rifaiLaBarra(pannello);
  caricaLaCornice(cornice).catch((errore) => {
    console.warn("[DashboardModern] anteprima", errore);
    const conta = pannello.querySelector(".dm-ant-conta");
    if (conta) conta.textContent = t("L'anteprima non si apre.", "The preview does not open.");
  });
}

function disegnaIlPannello() {
  const corpo = doc.getElementById("ed-body");
  const pagina = paginaDellaScheda(schedaAttiva());
  if (!corpo || !pagina) return;
  const gia = corpo.querySelector(":scope > [data-dm-anteprima-pannello]");
  if (gia?.getAttribute("data-dm-anteprima-pannello") === pagina) return;
  gia?.remove();
  const pannello = doc.createElement("section");
  pannello.className = "dm-ant";
  pannello.setAttribute("data-dm-anteprima-pannello", pagina);
  pannello.innerHTML = pannelloMarkup(pagina);
  corpo.prepend(pannello);
  state.cornice = null;
  if (state.aperta.has(pagina)) apriLaCornice(pannello, pagina, state.dispositivo || dispositivoDiPartenza(root.innerWidth));
}

function rifaiIlPannello(pannello, dispositivo) {
  const pagina = pannello.getAttribute("data-dm-anteprima-pannello");
  state.aperta.add(pagina);
  state.dispositivo = dispositivo;
  pannello.innerHTML = pannelloMarkup(pagina);
  apriLaCornice(pannello, pagina, dispositivo);
}

function nonSalvate() {
  return state.n > 0 && state.cornice?.isConnected;
}

function lasciareSenzaSalvare() {
  if (!nonSalvate()) return true;
  const si = root.confirm?.(
    t(
      "Nell'anteprima ci sono modifiche non salvate. Uscire senza salvarle?",
      "The preview has unsaved changes. Leave without saving them?",
    ),
  );
  if (si) state.n = 0;
  return Boolean(si);
}

function onClick(event) {
  const bersaglio = event.target;
  const pannello = bersaglio?.closest?.("[data-dm-anteprima-pannello]");
  if (pannello) {
    if (bersaglio.closest("[data-dm-ant-apri]")) {
      rifaiIlPannello(pannello, state.dispositivo || dispositivoDiPartenza(root.innerWidth));
      return;
    }
    const dispositivo = bersaglio.closest("[data-dm-ant-dispositivo]")?.getAttribute("data-dm-ant-dispositivo");
    if (dispositivo) {
      const gia = state.cornice?.isConnected && dispositivo === state.dispositivo;
      if (!gia && lasciareSenzaSalvare()) rifaiIlPannello(pannello, dispositivo);
      return;
    }
    const azione = bersaglio.closest("[data-dm-ant-azione]")?.getAttribute("data-dm-ant-azione");
    if (azione) {
      try {
        state.cornice?.contentWindow?.dmAnteprima?.azione?.(azione);
      } catch (_errore) {}
      return;
    }
    return;
  }
  /* Si lascia la scheda, il Config o la sezione con delle modifiche aperte:
   * prima si chiede. */
  const uscita = bersaglio?.closest?.(".ed-tab, .ed-head-close, nav.tabs .tab[data-tab]");
  if (!uscita || uscita.classList.contains("active")) return;
  if (!lasciareSenzaSalvare()) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }
}

function onMessaggio(event) {
  const cornice = state.cornice;
  if (!cornice || event.source !== cornice.contentWindow) return;
  const dato = event.data;
  if (dato?.source !== "dm-anteprima") return;
  if (dato.tipo === "pronta") state.pronta = true;
  if (dato.tipo === "conta" || dato.tipo === "pronta") {
    if (dato.tipo === "conta") state.n = Math.max(0, Number(dato.n) || 0);
    rifaiLaBarra();
  }
}

/** Quello che l'anteprima salva, scritto per davvero: la casella, la
 * sincronia col ponte, e la plancia di fuori rimessa come dice adesso. */
function scriviDallAnteprima(chiave, valore) {
  if (!SCRITTE_DALL_ANTEPRIMA.includes(chiave)) return false;
  writeJsonIfChanged(chiave, valore);
  root.queueMicrotask?.(() => {
    try {
      root.dmDisposizione?.applicaLaDisposizione?.();
      ridisegnaIDisegni();
      if (chiave === "cd_navbar_order") root.cdApplyNavOrder?.();
      root.dispatchEvent?.(new root.CustomEvent("dashboardmodern:anteprima-salvata", { detail: { chiave } }));
    } catch (_errore) {}
  });
  return true;
}

const STILE_FUORI = `
.dm-ant{margin:0 0 16px;padding:14px;border-radius:18px;border:1px solid color-mix(in srgb,var(--text,#0f172a) 12%,transparent);
  background:color-mix(in srgb,var(--card-bg,#fff) 92%,var(--accent,#2563eb) 8%)}
.dm-ant-testa{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;justify-content:space-between}
.dm-ant-titolo{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1 1 260px}
.dm-ant-titolo b{font-size:15px}
.dm-ant-titolo small{font-size:12.5px;line-height:1.4;opacity:.8}
.dm-ant-schermi{display:inline-flex;gap:6px;flex:0 0 auto}
.dm-ant button{min-height:40px;padding:0 14px;border-radius:12px;border:1px solid color-mix(in srgb,var(--text,#0f172a) 14%,transparent);
  background:var(--card-bg,#fff);color:var(--text,#0f172a);font:600 13.5px/1 inherit;cursor:pointer;white-space:nowrap}
.dm-ant button[aria-pressed="true"],.dm-ant .dm-ant-salva:not([disabled]),.dm-ant .dm-ant-apri{background:var(--accent,#2563eb);border-color:transparent;color:#fff}
.dm-ant button[disabled]{opacity:.45;cursor:default}
.dm-ant-apri{margin-top:12px;width:100%}
/* La barra sotto lo schermo, e attaccata al fondo di quello che si vede: con
 * uno schermo piu' alto della finestra (il telefono) Salva resta a portata. */
.dm-ant-barra{position:sticky;bottom:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px -14px -14px;
  padding:10px 14px;border-radius:0 0 18px 18px;background:color-mix(in srgb,var(--card-bg,#fff) 94%,var(--accent,#2563eb) 6%);
  border-top:1px solid color-mix(in srgb,var(--text,#0f172a) 10%,transparent)}
.dm-ant-conta{flex:1 1 200px;font:600 13.5px/1.3 inherit}
/* Sul telefono la barra sta in due righe basse: il conto, e i tre tasti in
 * fila uguali. Lo schermo dell'anteprima resta tutto sopra di lei. */
@media (max-width:560px){
  .dm-ant{padding:10px}
  .dm-ant-barra{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:10px -10px -10px;padding:8px 10px;
    border-radius:0 0 18px 18px}
  .dm-ant-conta{grid-column:1/-1;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dm-ant .dm-ant-barra button{min-width:0;width:100%;min-height:38px;padding:0 6px;font-size:13px;overflow:hidden;text-overflow:ellipsis}
  .dm-ant-schermi button{min-height:36px;padding:0 10px}
}
.dm-ant-schermo{position:relative;margin:14px auto 0;overflow:hidden;border-radius:22px;background:#0b1020;
  box-shadow:0 0 0 6px color-mix(in srgb,var(--text,#0f172a) 10%,transparent),0 18px 40px -22px rgba(15,23,42,.6)}
.dm-ant-cornice{position:absolute;left:0;top:0;border:0;transform-origin:0 0;background:var(--card-bg,#0f172a)}
`;

function installaFuori() {
  installStyle("dm-anteprima-fuori", STILE_FUORI);
  root.dmScriviDallAnteprima = scriviDallAnteprima;
  doc.addEventListener("click", onClick, true);
  root.addEventListener?.("message", onMessaggio);
  root.addEventListener?.("resize", () => dimensiona());
  tieniIlBloccoNellaScheda("dm-anteprima-della-plancia", disegnaIlPannello);
}

export function installAnteprimaDellaPlancia() {
  if (!doc?.body || state.installed) return;
  state.installed = true;
  if (nellAnteprima()) installaDentro();
  else installaFuori();
}

/* Per le prove. */
root.dmAnteprimaDellaPlancia = {
  stato: () => ({ pagina: state.pagina, dispositivo: state.dispositivo, n: state.n, pronta: state.pronta }),
};

senzaCadere(installAnteprimaDellaPlancia);
