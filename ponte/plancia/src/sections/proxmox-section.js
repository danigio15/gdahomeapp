/* Il server Proxmox nella pagina MiniPC.
 *
 * «O lo aggiungi come macchina e mi fai vedere tutti i dati, o lo aggiungi
 * come nodi e mi fai vedere tutti i dati» — e «più cose per il nodo
 * principale, anche aggiornamenti da fare».
 *
 * Sopra le fasce delle macchine, una scheda per nodo: come sta, CPU, memoria,
 * disco e swap, da quando e' acceso, quante VM e quanti container girano, gli
 * aggiornamenti da fare coi loro pacchetti, i dischi con la salute, la
 * temperatura e la vita che resta, gli storage pieni quanto. Sotto, una
 * scheda per ogni VM e container coi suoi numeri. Le fasce delle macchine non
 * ripetono quello che sta qui: un container non compare due volte, e le righe
 * morte di un'integrazione di prima spariscono.
 *
 * Riconoscere e' del registro di Home Assistant (`core/proxmox.js`): niente
 * da configurare. I tasti — riavvia, spegni, avvia — ci sono solo dove
 * l'integrazione li offre e solo per chi amministra la plancia; spegnere
 * chiede prima conferma.
 */
import {
  DOMINIO_PROXMOX,
  eProxmox,
  entitaRaccontate,
  quantita,
  serverProxmox,
} from "../core/proxmox.js";
import { disegnoDelCatalogo } from "../core/catalogo-disegni.js";
import {
  EVENTO_CATALOGO,
  dispositiviDelCatalogo,
  entitaDelDispositivo,
} from "./appliance-integration-section.js";
import { piattaformeConosciute } from "./di-chi-e-unentita-section.js";
import { puoConfigurare } from "./la-config-e-di-chi-la-amministra-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  locale,
  paginaVisibile,
  quandoSiCambiaPagina,
  root,
  senzaCadere,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_PROXMOX__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "", aperti: new Set() });

const PAGINA = "page-server";
const DOVE_ID = "dm-proxmox";

/** Il server letto adesso. Le entita' dei dispositivi si chiedono la prima
 * volta e arrivano dopo: il catalogo lo annuncia e si ridisegna. */
export function proxmoxInPlancia(states = allStates()) {
  const dispositivi = dispositiviDelCatalogo().filter(eProxmox);
  const entita = {};
  for (const d of dispositivi) entita[clean(d.id)] = entitaDelDispositivo(d.id) || [];
  return serverProxmox({ dispositivi, entita, states });
}

/** Quello che le fasce delle macchine non devono ripetere: le entita' dei
 * dispositivi di Proxmox, e quelle dell'integrazione rimaste senza
 * dispositivo (le righe morte di un'installazione di prima). */
export function eDelProxmox(entity, server = proxmoxInPlancia()) {
  if (!server.nodi.length) return false;
  const id = clean(entity);
  if (entitaRaccontate(server).has(id)) return true;
  return clean(piattaformeConosciute()?.[id]) === DOMINIO_PROXMOX;
}

/* ── le parole ────────────────────────────────────────────────────────── */

const lingua = () => locale() || "it";

function daQuanto(iso) {
  const quando = Date.parse(iso);
  if (!Number.isFinite(quando)) return "";
  const minuti = Math.max(0, Math.floor((Date.now() - quando) / 60_000));
  const giorni = Math.floor(minuti / 1440);
  const ore = Math.floor((minuti % 1440) / 60);
  if (giorni > 0) return `${giorni} ${t("g", "d")} ${ore} h`;
  if (ore > 0) return `${ore} h ${minuti % 60} min`;
  return `${minuti} min`;
}

const perc = (v) =>
  v == null ? "—" : `${v.toLocaleString(lingua(), { maximumFractionDigits: 1 })}%`;

function parolaDelloStato(stato, nodo = false) {
  if (stato === "su") return nodo ? t("Online", "Online") : t("Acceso", "Running");
  if (stato === "giu") return nodo ? t("Offline", "Offline") : t("Fermo", "Stopped");
  return t("Non risponde", "Not answering");
}

/* ── i pezzi ──────────────────────────────────────────────────────────── */

/* Una barra col suo numero: verde, poi ambra sopra il 75, rossa sopra il 90. */
function barra(nome, valore, sotto = "") {
  const livello =
    valore == null ? "muto" : valore >= 90 ? "alto" : valore >= 75 ? "medio" : "basso";
  return `<div class="dm-px-barra" data-livello="${livello}" style="--q:${valore ?? 0}%">
    <div class="dm-px-barra-testa"><span>${esc(nome)}</span><b>${esc(perc(valore))}</b></div>
    <i aria-hidden="true"></i>
    ${sotto ? `<small>${esc(sotto)}</small>` : ""}
  </div>`;
}

function cifra(nome, valore, classe = "") {
  return `<div class="dm-px-cifra ${classe}"><b>${esc(valore)}</b><span>${esc(nome)}</span></div>`;
}

function tasto(entity, testo, { pericolo = false, conferma = "" } = {}) {
  return `<button type="button" class="dm-px-tasto${pericolo ? " dm-px-pericolo" : ""}" data-dm-px-premi="${esc(entity)}"${
    conferma ? ` data-dm-px-conferma="${esc(conferma)}"` : ""
  }>${esc(testo)}</button>`;
}

function aggiornamentiMarkup(n) {
  const a = n.aggiornamenti;
  if (a.ci == null && a.quanti == null) return "";
  if (!a.ci)
    return `<div class="dm-px-agg" data-ci="false"><span class="dm-px-agg-ic" aria-hidden="true">✓</span><div><strong>${esc(
      t("Tutto aggiornato", "Up to date"),
    )}</strong><small>${esc(t("Nessun pacchetto da aggiornare", "No packages to update"))}</small></div></div>`;
  const quanti = a.quanti ?? a.pacchetti.length;
  const titolo = quanti
    ? quanti === 1
      ? t("1 aggiornamento da fare", "1 update to install")
      : t(`${quanti} aggiornamenti da fare`, `${quanti} updates to install`)
    : t("Aggiornamenti da fare", "Updates to install");
  const aperto = state.aperti.has(n.id);
  return `<div class="dm-px-agg" data-ci="true">
      <span class="dm-px-agg-ic" aria-hidden="true">↑</span>
      <div><strong>${esc(titolo)}</strong><small>${esc(
        t(
          "Da installare dal pannello di Proxmox (Aggiornamenti)",
          "Install them from the Proxmox panel (Updates)",
        ),
      )}</small></div>
      ${
        a.pacchetti.length
          ? `<button type="button" class="dm-px-tasto" data-dm-px-elenco="${esc(n.id)}" aria-expanded="${aperto}">${esc(
              aperto ? t("Nascondi", "Hide") : t("Vedi i pacchetti", "Show packages"),
            )}</button>`
          : ""
      }
      ${
        aperto && a.pacchetti.length
          ? `<ul class="dm-px-pacchetti">${a.pacchetti.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`
          : ""
      }
    </div>`;
}

function dischiMarkup(n) {
  if (!n.dischi.length) return "";
  return `<div class="dm-px-parte"><h4>${esc(t("Dischi", "Disks"))}</h4><ul class="dm-px-dischi">${n.dischi
    .map(
      (d) => `<li data-sano="${d.sano === false ? "no" : d.sano ? "si" : "boh"}">
        <span class="dm-px-disco-ic" aria-hidden="true">${disegnoDelCatalogo("server", 18)}</span>
        <div><strong>${esc(d.nome)}</strong><small>${esc(d.modello)}</small></div>
        <span class="dm-px-pill">${esc(
          d.sano === false ? t("Problema", "Problem") : d.sano ? t("Sano", "Healthy") : "—",
        )}</span>
        <span class="dm-px-disco-numeri">${[
          d.temperatura != null ? `${Math.round(d.temperatura)} °C` : "",
          d.vita != null ? `${t("vita", "life")} ${Math.round(d.vita)}%` : "",
          d.ore != null ? `${Math.round(d.ore).toLocaleString(lingua())} h` : "",
        ]
          .filter(Boolean)
          .map((x) => `<span>${esc(x)}</span>`)
          .join("")}</span>
      </li>`,
    )
    .join("")}</ul></div>`;
}

function storageMarkup(n) {
  if (!n.storage.length) return "";
  return `<div class="dm-px-parte"><h4>${esc(t("Storage", "Storage"))}</h4><div class="dm-px-storage">${n.storage
    .map((s) =>
      barra(
        s.nome,
        s.perc,
        [quantita(s.usato, lingua()), quantita(s.totale, lingua())].filter(Boolean).join(" / "),
      ),
    )
    .join("")}</div></div>`;
}

function nodoMarkup(n, admin) {
  const memoria = [quantita(n.memoria.usata, lingua()), quantita(n.memoria.totale, lingua())]
    .filter(Boolean)
    .join(" / ");
  const disco = [quantita(n.disco.usato, lingua()), quantita(n.disco.totale, lingua())]
    .filter(Boolean)
    .join(" / ");
  const tasti = admin
    ? [
        n.tasti.reboot &&
          tasto(n.tasti.reboot, t("Riavvia il nodo", "Reboot node"), {
            conferma: t(
              `Riavviare il nodo ${n.nome}? Si fermano tutte le VM e i container.`,
              `Reboot node ${n.nome}? All VMs and containers stop.`,
            ),
          }),
        n.tasti.shutdown &&
          tasto(n.tasti.shutdown, t("Spegni il nodo", "Shut down node"), {
            pericolo: true,
            conferma: t(
              `Spegnere il nodo ${n.nome}? Per riaccenderlo serve andarci di persona.`,
              `Shut down node ${n.nome}? You will have to power it on in person.`,
            ),
          }),
      ]
        .filter(Boolean)
        .join("")
    : "";
  return `<article class="dm-px-nodo" data-stato="${esc(n.stato || "muto")}">
      <div class="dm-px-nodo-testa">
        <span class="dm-px-nodo-ic" aria-hidden="true">${disegnoDelCatalogo("server", 26)}</span>
        <div><small>Proxmox VE · ${esc(t("Nodo", "Node"))}</small><strong>${esc(n.nome || "Proxmox")}</strong>${
          n.processore ? `<span>${esc(n.processore)}</span>` : ""
        }</div>
        <b class="dm-px-pill dm-px-stato">${esc(parolaDelloStato(n.stato, true))}</b>
      </div>
      <div class="dm-px-cifre">
        ${n.avvio ? cifra(t("Acceso da", "Up for"), daQuanto(n.avvio)) : ""}
        ${n.vmAccese != null ? cifra(t("VM accese", "VMs running"), String(n.vmAccese)) : ""}
        ${n.ctAccesi != null ? cifra(t("Container accesi", "Containers running"), String(n.ctAccesi)) : ""}
        ${n.aggiornamenti.quanti != null ? cifra(t("Aggiornamenti", "Updates"), String(n.aggiornamenti.quanti), n.aggiornamenti.quanti > 0 ? "dm-px-avviso" : "") : ""}
      </div>
      <div class="dm-px-barre">
        ${barra(t("CPU", "CPU"), n.cpu)}
        ${barra(t("Memoria", "Memory"), n.memoria.perc, memoria)}
        ${barra(t("Disco", "Disk"), n.disco.perc, disco)}
        ${n.swap != null ? barra(t("Swap", "Swap"), n.swap) : ""}
      </div>
      ${aggiornamentiMarkup(n)}
      ${dischiMarkup(n)}
      ${storageMarkup(n)}
      ${tasti ? `<div class="dm-px-tasti">${tasti}</div>` : ""}
    </article>`;
}

function guestMarkup(g, admin) {
  const rete = [
    g.reteIn?.valore != null ? `↓ ${quantita(g.reteIn, lingua())}` : "",
    g.reteOut?.valore != null ? `↑ ${quantita(g.reteOut, lingua())}` : "",
  ]
    .filter(Boolean)
    .join("  ");
  const tasti = admin
    ? g.stato === "su"
      ? [
          g.tasti.reboot && tasto(g.tasti.reboot, t("Riavvia", "Reboot")),
          g.tasti.shutdown &&
            tasto(g.tasti.shutdown, t("Spegni", "Shut down"), {
              pericolo: true,
              conferma: t(`Spegnere ${g.nome}?`, `Shut down ${g.nome}?`),
            }),
        ]
      : [g.tasti.start && tasto(g.tasti.start, t("Avvia", "Start"))]
    : [];
  const elenco = tasti.filter(Boolean).join("");
  return `<article class="dm-px-guest" data-stato="${esc(g.stato || "muto")}" data-problema="${g.problema}">
      <div class="dm-px-guest-testa">
        <span class="dm-px-sigla">${esc(g.tipo === "qemu" ? "VM" : "LXC")}${g.vmid ? ` ${esc(g.vmid)}` : ""}</span>
        <strong>${esc(g.nome)}</strong>
        <b class="dm-px-pill dm-px-stato">${esc(
          g.problema && g.dettaglio ? g.dettaglio : parolaDelloStato(g.stato),
        )}</b>
      </div>
      ${
        g.stato === "su"
          ? `<div class="dm-px-mini">
              ${barra(t("CPU", "CPU"), g.cpu)}
              ${barra(t("Memoria", "Memory"), g.memoria.perc, quantita(g.memoria.usata, lingua()))}
              ${g.disco.perc != null ? barra(t("Disco", "Disk"), g.disco.perc, quantita(g.disco.usato, lingua())) : ""}
            </div>
            <div class="dm-px-piede">${g.avvio ? `<span>⏱ ${esc(daQuanto(g.avvio))}</span>` : ""}${
              rete ? `<span>${esc(rete)}</span>` : ""
            }</div>`
          : ""
      }
      ${elenco ? `<div class="dm-px-tasti">${elenco}</div>` : ""}
    </article>`;
}

export function proxmoxMarkup(server, { admin = false } = {}) {
  if (!server?.nodi?.length) return "";
  return server.nodi
    .map((n) => {
      const accesi = n.guest.filter((g) => g.stato === "su").length;
      return `<section class="dm-px" data-dm-px-nodo="${esc(n.nome)}">
        ${n.id ? nodoMarkup(n, admin) : ""}
        ${
          n.guest.length
            ? `<div class="dm-px-sotto"><strong>${esc(t("VM e container", "VMs and containers"))}</strong><span>${esc(
                t(
                  `${accesi} accesi su ${n.guest.length}`,
                  `${accesi} running of ${n.guest.length}`,
                ),
              )}</span></div>
              <div class="dm-px-guests">${n.guest.map((g) => guestMarkup(g, admin)).join("")}</div>`
            : ""
        }
      </section>`;
    })
    .join("");
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function ensureDove() {
  const pagina = doc?.getElementById(PAGINA);
  if (!pagina) return null;
  let dove = pagina.querySelector(`#${DOVE_ID}`);
  if (!dove) {
    dove = doc.createElement("div");
    dove.id = DOVE_ID;
    dove.className = "dm-px-wrap";
  }
  /* Sopra le fasce delle macchine: il server prima di quello che ci gira. */
  const fasce = pagina.querySelector("#dm-macchine-fasce");
  if (fasce && dove.nextElementSibling !== fasce) fasce.before(dove);
  else if (!fasce && !dove.parentElement) pagina.append(dove);
  return dove;
}

function dipingi() {
  if (!paginaVisibile(PAGINA)) return;
  const dove = ensureDove();
  if (!dove) return;
  const server = proxmoxInPlancia();
  const admin = (() => {
    try {
      return puoConfigurare();
    } catch (_e) {
      return false;
    }
  })();
  const minuto = Math.floor(Date.now() / 60_000);
  const firma = JSON.stringify([server, admin, minuto, [...state.aperti], t("Acceso", "Running")]);
  if (firma === state.firma) return;
  state.firma = firma;
  dove.innerHTML = proxmoxMarkup(server, { admin });
  dove.hidden = !server.nodi.length;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      dipingi();
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] proxmox", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

export function renderProxmox() {
  state.firma = "";
  schedule();
}

function chiama(dominio, servizio, dati) {
  try {
    if (typeof root.dmCallHaService === "function")
      return root.dmCallHaService(dominio, servizio, dati);
    if (typeof root.cdCallServiceJson === "function")
      return root.cdCallServiceJson(dominio, servizio, dati);
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] proxmox", errore);
  }
  return null;
}

function alClic(evento) {
  const elenco = evento.target?.closest?.("[data-dm-px-elenco]");
  if (elenco) {
    const id = clean(elenco.dataset.dmPxElenco);
    if (state.aperti.has(id)) state.aperti.delete(id);
    else state.aperti.add(id);
    renderProxmox();
    return;
  }
  const premi = evento.target?.closest?.("[data-dm-px-premi]");
  if (!premi) return;
  evento.preventDefault();
  /* Solo chi amministra: il tasto non c'e' per gli altri, e anche se ci
   * fosse non partirebbe. */
  if (!puoConfigurare()) return;
  const domanda = clean(premi.dataset.dmPxConferma);
  if (domanda && typeof root.confirm === "function" && !root.confirm(domanda)) return;
  chiama("button", "press", { entity_id: clean(premi.dataset.dmPxPremi) });
  root.setTimeout?.(renderProxmox, 1500);
}

function installaLoStile() {
  const P = `#${PAGINA}`;
  installStyle(
    "dm-proxmox-style",
    `
    ${P} .dm-px-wrap{display:grid;gap:18px;padding:14px 0 4px}
    ${P} .dm-px{display:grid;gap:12px}
    ${P} .dm-px-nodo,${P} .dm-px-guest{--px:#94a3b8;box-sizing:border-box;min-width:0;border-radius:22px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-sculpted,0 6px 18px rgba(15,23,42,.07))}
    ${P} [data-stato="su"]{--px:#16a34a}
    ${P} [data-stato="giu"]{--px:#dc2626}
    ${P} .dm-px-nodo{display:grid;gap:14px;padding:18px;position:relative;overflow:hidden;
      background:radial-gradient(120% 120% at 0% 0%,color-mix(in srgb,#e57000 10%,transparent),transparent 55%),var(--card-bg,#fff)}
    ${P} .dm-px-nodo::before{content:"";position:absolute;inset:0 0 auto 0;height:4px;background:linear-gradient(90deg,#e57000,#f59e0b)}
    ${P} .dm-px-nodo-testa{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:12px}
    ${P} .dm-px-nodo-ic{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;
      background:color-mix(in srgb,#e57000 14%,transparent)}
    ${P} .dm-px-nodo-ic svg{width:26px;height:26px}
    ${P} .dm-px-nodo-testa>div{display:grid;gap:1px;min-width:0}
    ${P} .dm-px-nodo-testa>div>small{font-size:10.5px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:var(--text-dim,#64748b)}
    ${P} .dm-px-nodo-testa>div>strong{font-family:'Oswald',system-ui,sans-serif;font-size:26px;font-weight:700;line-height:1.05;color:var(--text,#0f172a)}
    ${P} .dm-px-nodo-testa>div>span{font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-px-pill{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:10.5px;font-weight:900;
      letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;color:color-mix(in srgb,var(--px) 80%,var(--text,#0f172a));
      background:color-mix(in srgb,var(--px) 14%,transparent)}
    ${P} .dm-px-cifre{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}
    ${P} .dm-px-cifra{display:grid;gap:2px;padding:10px 12px;border-radius:14px;background:var(--surface-2,#f8fafc);
      border:1px solid var(--card-border,#eef2f7)}
    ${P} .dm-px-cifra b{font-family:'Oswald',system-ui,sans-serif;font-size:22px;font-weight:700;line-height:1.05;color:var(--text,#0f172a)}
    ${P} .dm-px-cifra span{font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    ${P} .dm-px-cifra.dm-px-avviso{background:color-mix(in srgb,#f59e0b 14%,transparent);border-color:color-mix(in srgb,#f59e0b 40%,transparent)}
    ${P} .dm-px-barre{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px 16px}
    ${P} .dm-px-barra{--c:#16a34a;display:grid;gap:4px;min-width:0}
    ${P} .dm-px-barra[data-livello="medio"]{--c:#f59e0b}
    ${P} .dm-px-barra[data-livello="alto"]{--c:#dc2626}
    ${P} .dm-px-barra[data-livello="muto"]{--c:#94a3b8}
    ${P} .dm-px-barra-testa{display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:900;letter-spacing:.04em;
      text-transform:uppercase;color:var(--text-dim,#64748b)}
    ${P} .dm-px-barra-testa b{font-size:13px;letter-spacing:0;color:var(--text,#0f172a);font-variant-numeric:tabular-nums}
    ${P} .dm-px-barra i{display:block;height:7px;border-radius:4px;
      background:linear-gradient(90deg,var(--c) var(--q),color-mix(in srgb,var(--text,#0f172a) 8%,transparent) var(--q))}
    ${P} .dm-px-barra small{font-size:11px;font-weight:700;color:var(--text-dim,#64748b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-px-agg{display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:10px;padding:12px 14px;border-radius:16px;
      background:color-mix(in srgb,#16a34a 9%,transparent);border:1px solid color-mix(in srgb,#16a34a 28%,transparent)}
    ${P} .dm-px-agg[data-ci="true"]{background:color-mix(in srgb,#f59e0b 11%,transparent);border-color:color-mix(in srgb,#f59e0b 40%,transparent)}
    ${P} .dm-px-agg-ic{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;font-weight:900;color:#fff;background:#16a34a}
    ${P} .dm-px-agg[data-ci="true"] .dm-px-agg-ic{background:#f59e0b}
    ${P} .dm-px-agg div{display:grid;gap:1px;min-width:0}
    ${P} .dm-px-agg strong{font-size:14px;font-weight:900;color:var(--text,#0f172a)}
    ${P} .dm-px-agg small{font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}
    ${P} .dm-px-pacchetti{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:5px;margin:2px 0 0;padding:0;list-style:none;max-height:220px;overflow:auto}
    ${P} .dm-px-pacchetti li{padding:3px 8px;border-radius:8px;font-family:ui-monospace,Menlo,monospace;font-size:11px;font-weight:700;
      color:var(--text,#0f172a);background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0)}
    ${P} .dm-px-parte{display:grid;gap:8px}
    ${P} .dm-px-parte h4{margin:0;font-size:11px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:var(--text-dim,#64748b)}
    ${P} .dm-px-dischi{display:grid;gap:6px;margin:0;padding:0;list-style:none}
    ${P} .dm-px-dischi li{--px:#16a34a;display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:4px 10px;
      padding:8px 10px;border-radius:14px;background:var(--surface-2,#f8fafc);border:1px solid var(--card-border,#eef2f7)}
    ${P} .dm-px-dischi li[data-sano="no"]{--px:#dc2626;background:color-mix(in srgb,#dc2626 8%,transparent)}
    ${P} .dm-px-dischi li[data-sano="boh"]{--px:#94a3b8}
    ${P} .dm-px-disco-ic{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:color-mix(in srgb,var(--px) 14%,transparent)}
    ${P} .dm-px-disco-ic svg{width:18px;height:18px}
    ${P} .dm-px-dischi li div{display:grid;min-width:0}
    ${P} .dm-px-dischi strong{font-size:13px;font-weight:800;color:var(--text,#0f172a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-px-dischi small{font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-px-disco-numeri{grid-column:2/-1;display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11.5px;font-weight:800;color:var(--text,#0f172a);font-variant-numeric:tabular-nums}
    ${P} .dm-px-storage{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px 16px}
    ${P} .dm-px-tasti{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}
    ${P} .dm-px-tasto{padding:7px 14px;border-radius:999px;border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      color:var(--text,#0f172a);font:inherit;font-size:11.5px;font-weight:900;cursor:pointer;white-space:nowrap}
    ${P} .dm-px-tasto:hover{border-color:var(--primary-color,#0ea5e9)}
    ${P} .dm-px-pericolo{color:#dc2626}
    ${P} .dm-px-pericolo:hover{border-color:#dc2626}
    ${P} .dm-px-sotto{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;margin-top:4px;padding:0 4px}
    ${P} .dm-px-sotto strong{font-size:14px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;color:var(--text,#0f172a)}
    ${P} .dm-px-sotto span{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
    ${P} .dm-px-guests{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:10px}
    ${P} .dm-px-guest{display:grid;align-content:start;gap:10px;padding:14px;border-radius:18px;
      border-color:color-mix(in srgb,var(--px) 35%,var(--card-border,#e2e8f0));
      background:color-mix(in srgb,var(--px) 6%,var(--card-bg,#fff))}
    ${P} .dm-px-guest[data-problema="true"]{--px:#f59e0b}
    ${P} .dm-px-guest-testa{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px}
    ${P} .dm-px-sigla{padding:3px 7px;border-radius:7px;font-size:10px;font-weight:900;letter-spacing:.04em;color:#fff;background:#e57000}
    ${P} .dm-px-guest strong{font-size:14px;font-weight:900;color:var(--text,#0f172a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-px-mini{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:10px 16px}
    ${P} .dm-px-piede{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11.5px;font-weight:800;color:var(--text-dim,#64748b);font-variant-numeric:tabular-nums}
    @media(max-width:520px){
      ${P} .dm-px-nodo{padding:14px}
      ${P} .dm-px-nodo-testa>div>strong{font-size:22px}
      ${P} .dm-px-agg{grid-template-columns:36px minmax(0,1fr)}
      ${P} .dm-px-agg .dm-px-tasto{grid-column:1/-1;justify-self:start}
    }
    `,
  );
}

export function installProxmox() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installaLoStile();
  doc.addEventListener("click", alClic);
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmProxmox) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmProxmox = true;
    avvolta.__dmPrevious = precedente;
    root[nome] = avvolta;
  }
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  root.addEventListener?.(EVENTO_CATALOGO, renderProxmox);
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

senzaCadere(installProxmox);
