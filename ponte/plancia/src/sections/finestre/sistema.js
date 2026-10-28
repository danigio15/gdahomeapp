/* Le finestre dei widget del gruppo «sistema» (vedi `../finestre-dei-widget.js`).
 *
 * Elettrodomestici, Cottura, MiniPC, Server e rete, In evidenza, le sezioni
 * proprie, Segnalazioni e Assistenza: otto finestre disegnate sul mestiere di
 * ciascuna. La regola e' la stessa per tutte: in grande la cosa che si viene a
 * sapere, i comandi a portata di pollice, niente nomi grezzi, niente doppioni,
 * e quello che la casa non sa non si inventa — la parte resta fuori.
 *
 * Ogni finestra si registra con la chiave della sua tessera; le sezioni
 * proprie (`mia-<id>`) usano tutte «sezionimie», che la Home chiede per loro.
 */
import { registraFinestra, tastoServizio } from "../finestre-dei-widget.js";
import { clean, esc, iconGlyphHtml, t } from "../shared.js";
import { applianceArtwork } from "../../core/appliance-artwork.js";
import { formatPowerLabel } from "../../core/appliance-card-view-model.js";
import { minutiESecondi, orologio } from "../../core/la-cottura.js";
import { disegnoDelCatalogo } from "../../core/catalogo-disegni.js";

/* Il prefisso di ogni regola: le finestre vivono in tre contenitori. */
const P = ":is(#dm-widget-popup,#dm-casa-popup,#dm-qa-popup)";

/* ── le parole del tempo ─────────────────────────────────────────────── */

const UN_MINUTO = 60000;

/** «7 min», «2 h», «3 giorni»: una durata detta corta. */
export function durataCorta(ms) {
  const minuti = Math.max(1, Math.round((Number(ms) || 0) / UN_MINUTO));
  if (minuti < 60) return `${minuti} min`;
  const ore = Math.round(minuti / 60);
  if (ore < 24) return `${ore} h`;
  const giorni = Math.round(ore / 24);
  return giorni === 1 ? `1 ${t("giorno", "day")}` : `${giorni} ${t("giorni", "days")}`;
}

/** Quanto manca, in minuti o ore: «7 min», «1 h 20». */
function restaCorto(secondi) {
  const minuti = Math.max(1, Math.ceil((Number(secondi) || 0) / 60));
  if (minuti < 60) return `${minuti} min`;
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  return resto ? `${ore} h ${resto}` : `${ore} h`;
}

/** «oggi 06:31», «ieri 21:10», o la data: l'ultima volta di qualcosa. */
function quandoEra(ms, adesso = Date.now()) {
  const data = new Date(ms);
  if (!Number.isFinite(data.getTime())) return "";
  const giorno = (valore) => new Date(valore).toDateString();
  const ora = orologio(ms);
  if (giorno(ms) === giorno(adesso)) return `${t("oggi", "today")} ${ora}`;
  if (giorno(ms) === giorno(adesso - 86400000)) return `${t("ieri", "yesterday")} ${ora}`;
  return `${data.toLocaleDateString([], { day: "numeric", month: "short" })} ${ora}`;
}

/** Il numero di una lettura e la sua unita', separati: «215» e «Mb/s». */
function numeroEUnita(valore) {
  const testo = clean(valore);
  const trovato = testo.match(/^(-?[\d.,]+)\s*(.*)$/);
  return trovato ? { numero: trovato[1], unita: trovato[2] } : { numero: testo, unita: "" };
}

/** Un nome che non sia un entity_id: «serbatoio_tetto_level» → «Serbatoio tetto level». */
export function nomePulito(nome, entity = "") {
  const testo = clean(nome);
  const grezzo =
    !testo ||
    testo === clean(entity) ||
    /^[a-z_]+\.[a-z0-9_]+$/i.test(testo) ||
    /^[A-Z0-9]+(_[A-Z0-9]+)+$/.test(testo);
  if (!grezzo) return testo;
  const base = (testo || clean(entity)).split(".").pop().replace(/_+/g, " ").trim().toLowerCase();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : testo;
}

const leva = (entity, accesa, etichetta) =>
  `<button type="button" class="dm-f-leva" data-dm-w-light="${esc(entity)}" data-on="${accesa}" role="switch" aria-checked="${accesa}" aria-label="${esc(etichetta)}"><i aria-hidden="true"></i></button>`;

/* ── Elettrodomestici ────────────────────────────────────────────────── */

function cartaDellApparecchio(riga, adesso) {
  const sopra = [riga.programma, riga.gradi].filter(Boolean).join(" · ");
  const fase = riga.fase ? `<span class="dm-f-el-fase">${esc(riga.fase)}</span>` : "";
  const fine = riga.prontaAlle || (riga.restano != null ? adesso + riga.restano * 1000 : null);
  const resta =
    riga.restano != null
      ? `<span class="dm-f-el-resta"><b class="dm-f-num">${esc(restaCorto(riga.restano))}</b><small>${esc(
          riga.cucina ? t("pronta alle", "ready at") : t("finisce", "ends"),
        )} ${esc(orologio(fine))}</small></span>`
      : riga.watts != null
        ? `<span class="dm-f-el-resta"><b class="dm-f-num">${esc(formatPowerLabel(riga.watts))}</b></span>`
        : "";
  const corsa =
    riga.fatto != null
      ? `<div class="dm-f-corsa"><i style="width:${Math.round(Math.max(0, Math.min(1, riga.fatto)) * 100)}%"></i></div>`
      : "";
  const sinistra = [riga.stanza, riga.giri].filter(Boolean).join(" · ");
  const destra = riga.cucina
    ? `<button type="button" class="dm-f-el-link" data-dm-w-sezione="cottura">${esc(t("Cottura", "Cooking"))} <span aria-hidden="true">→</span></button>`
    : riga.restano != null && riga.watts != null && riga.watts >= 1
      ? `<b>${esc(formatPowerLabel(riga.watts))}</b>`
      : "";
  const piede =
    sinistra || destra
      ? `<div class="dm-f-el-piede"><span>${esc(sinistra)}</span>${destra}</div>`
      : "";
  return `<article class="dm-f-el-mac" data-dm-f-apparecchio="${esc(riga.id)}">
    <div class="dm-f-el-su">
      <span class="dm-f-el-ic" aria-hidden="true">${applianceArtwork(riga.type, 30) || esc(riga.glifo || "🔌")}</span>
      <span class="dm-f-el-nome"><b data-dm-no-i18n>${esc(riga.name)}</b>${
        sopra || fase ? `<em><span data-dm-no-i18n>${esc(sopra)}</span>${fase}</em>` : ""
      }</span>
      ${resta}
    </div>
    ${corsa}${piede}
  </article>`;
}

function parolaDelFermo(riga, adesso) {
  if (riga.ultimoAvvio) return quandoEra(riga.ultimoAvvio, adesso);
  if (riga.dentro) return `${t("dentro", "inside")} ${riga.dentro}`;
  if (riga.mode === "standby") return t("in attesa", "on standby");
  if (riga.mode === "unavailable") return t("non risponde", "not answering");
  return t("spento", "off");
}

function finestraElettrodomestici(widget) {
  const adesso = Date.now();
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  const accesi = righe
    .filter((riga) => riga.mode === "running")
    .sort((a, b) => (a.restano ?? Infinity) - (b.restano ?? Infinity));
  const fermi = righe.filter((riga) => riga.mode !== "running");
  const watt = accesi.reduce((somma, riga) => somma + (Number(riga.watts) || 0), 0);
  const primo = accesi.find((riga) => riga.restano != null);
  const frasi = [];
  if (watt >= 1) frasi.push(`${t("insieme", "together")} ${formatPowerLabel(watt)}`);
  if (primo)
    frasi.push(`${primo.name} · ${t("finisce fra", "done in")} ${restaCorto(primo.restano)}`);
  const eroe = `<div class="dm-f-el-eroe">
    <span class="dm-f-num">${accesi.length}</span>
    <div><b>${esc(accesi.length ? t("al lavoro adesso", "working now") : t("tutti fermi", "all idle"))}</b>${frasi
      .map((frase) => `<span data-dm-no-i18n>${esc(frase)}</span>`)
      .join("")}</div>
  </div>`;
  const inFunzione = accesi.length
    ? `<h4 class="dm-f-tit">${esc(t("In funzione", "Running"))}</h4>${accesi
        .map((riga) => cartaDellApparecchio(riga, adesso))
        .join("")}`
    : "";
  const fermiMarkup = fermi.length
    ? `<h4 class="dm-f-tit">${esc(t("Fermi", "Idle"))}</h4><div class="dm-f-el-fermi">${fermi
        .map(
          (riga) => `<div class="dm-f-el-fermo" data-dm-f-apparecchio="${esc(riga.id)}">
            <span class="dm-f-el-ic" aria-hidden="true">${applianceArtwork(riga.type, 26) || esc(riga.glifo || "🔌")}</span>
            <b data-dm-no-i18n>${esc(riga.name)}</b><em>${esc(parolaDelFermo(riga, adesso))}</em>
          </div>`,
        )
        .join("")}</div>`
    : "";
  return `<div class="dm-f dm-f-elettrodomestici">${eroe}${inFunzione}${fermiMarkup}</div>`;
}

const STILE_COMUNE = `
${P} .dm-f{display:grid;gap:10px;min-width:0}
${P} .dm-f-num{font-family:Oswald,var(--dm-font-num,system-ui),sans-serif;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:.01em}
${P} .dm-f-tit{margin:8px 2px 0;font-size:10.5px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim,#64748b)}
${P} .dm-f-scheda{border-radius:20px;padding:13px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);min-width:0}
${P} .dm-f-leva{flex:0 0 auto;width:54px;height:32px;border-radius:999px;border:0;padding:0;background:#cbd5e1;position:relative;cursor:pointer;transition:background .2s}
${P} .dm-f-leva i{position:absolute;left:4px;top:4px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2);transition:left .2s}
${P} .dm-f-leva[data-on="true"]{background:#16a34a}
${P} .dm-f-leva[data-on="true"] i{left:26px}
${P} .dm-f-porta{width:100%;margin-top:4px;padding:14px;border:0;border-radius:18px;font:inherit;font-weight:850;font-size:15px;cursor:pointer;
  color:var(--dm-widget-accent,#0ea5e9);background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 12%,var(--card-bg,#fff))}
${P} .dm-f-porta.dm-f-pieno{color:#fff;background:var(--dm-widget-accent,#0ea5e9)}
${P} .dm-f-vuota{margin:6px 4px;font-size:14px;font-weight:700;color:var(--text-dim,#64748b);text-align:center}
`;

const STILE_ELETTRODOMESTICI = `
${P} .dm-f-el-eroe{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:24px;
  background:linear-gradient(155deg,color-mix(in srgb,var(--dm-widget-accent,#06b6d4) 10%,var(--card-bg,#fff)),color-mix(in srgb,var(--dm-widget-accent,#06b6d4) 16%,var(--card-bg,#fff)));
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#06b6d4) 30%,transparent)}
${P} .dm-f-el-eroe>.dm-f-num{font-size:50px;line-height:1;color:var(--dm-widget-accent,#0e7490)}
${P} .dm-f-el-eroe b{display:block;font-size:16px;font-weight:850;color:var(--text,#0f172a)}
${P} .dm-f-el-eroe span{display:block;font-size:12.5px;font-weight:750;color:var(--text-dim,#475569)}
${P} .dm-f-el-mac{border-radius:22px;padding:14px;background:var(--card-bg,#fff);border:1px solid color-mix(in srgb,var(--dm-widget-accent,#06b6d4) 22%,transparent);
  box-shadow:0 14px 26px -24px color-mix(in srgb,var(--dm-widget-accent,#06b6d4) 90%,transparent);min-width:0}
${P} .dm-f-el-su{display:flex;align-items:center;gap:12px;min-width:0}
${P} .dm-f-el-ic{flex:0 0 auto;width:46px;height:46px;border-radius:15px;display:grid;place-items:center;font-size:24px;
  background:color-mix(in srgb,var(--dm-widget-accent,#06b6d4) 12%,var(--card-bg,#fff));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dm-widget-accent,#06b6d4) 30%,transparent)}
${P} .dm-f-el-ic svg{width:30px;height:30px}
${P} .dm-f-el-mac,${P} .dm-f-el-fermo{cursor:pointer}
${P} .dm-f-el-nome{flex:1;min-width:0}
${P} .dm-f-el-nome b{display:block;font-size:15.5px;font-weight:850;color:var(--text,#0f172a);overflow-wrap:anywhere}
${P} .dm-f-el-nome em{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;font-style:normal;font-size:12px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-el-fase{display:inline-flex;padding:3px 8px;border-radius:999px;background:#dcfce7;color:#15803d;font-size:10.5px;font-weight:850}
${P} .dm-f-el-resta{flex:0 0 auto;text-align:right;padding-left:4px}
${P} .dm-f-el-resta b{display:block;font-size:26px;line-height:1;color:var(--text,#0f172a)}
${P} .dm-f-el-resta small{display:block;margin-top:3px;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim,#64748b);white-space:nowrap}
${P} .dm-f-corsa{height:8px;border-radius:999px;background:color-mix(in srgb,var(--text-dim,#64748b) 18%,transparent);margin:12px 0 7px;overflow:hidden}
${P} .dm-f-corsa i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--dm-widget-accent,#06b6d4) 60%,#fff),var(--dm-widget-accent,#0891b2))}
${P} .dm-f-el-piede{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;font-size:12px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-el-corsa+.dm-f-el-piede,${P} .dm-f-corsa+.dm-f-el-piede{margin-top:0}
${P} .dm-f-el-piede b{color:var(--text,#0f172a)}
${P} .dm-f-el-link{border:0;background:none;padding:4px 0;font:inherit;font-weight:800;color:var(--dm-widget-accent,#0e7490);cursor:pointer}
${P} .dm-f-el-fermi{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px}
${P} .dm-f-el-fermo{border-radius:18px;padding:12px 8px 10px;text-align:center;background:color-mix(in srgb,var(--text-dim,#64748b) 6%,var(--card-bg,#fff));
  border:1px solid var(--card-border,#eef2f7);display:grid;justify-items:center;gap:3px;min-width:0}
${P} .dm-f-el-fermo .dm-f-el-ic{width:38px;height:38px;border-radius:12px;filter:grayscale(.35)}
${P} .dm-f-el-fermo b{font-size:12.5px;font-weight:850;color:var(--text,#0f172a);overflow-wrap:anywhere}
${P} .dm-f-el-fermo em{font-style:normal;font-size:11px;font-weight:700;color:var(--text-dim,#94a3b8)}
`;

/* ── Cottura ─────────────────────────────────────────────────────────── */

function tastoCottura(cucina, chiave, classe, segno, parola) {
  const comando = cucina.comandi?.[chiave];
  if (!comando) return "";
  return tastoServizio(comando, {
    classe,
    testo: `<span aria-hidden="true">${segno}</span>${esc(parola)}`,
    attributi: `data-dm-f-comando="${esc(chiave)}"`,
  });
}

function finestraCottura(widget) {
  const cucina = widget.cucina || {};
  const cassetto =
    cucina.cassetto == null
      ? ""
      : `<span class="dm-f-cot-chip" data-aperto="${cucina.cassetto}">${esc(
          cucina.cassetto
            ? cucina.tipo === "air-fryer"
              ? t("Cassetto aperto", "Drawer open")
              : t("Porta aperta", "Door open")
            : cucina.tipo === "air-fryer"
              ? t("Cassetto chiuso", "Drawer closed")
              : t("Porta chiusa", "Door closed"),
        )}</span>`;
  const pronta = cucina.fase === "pronta";
  let anello = "";
  if (pronta)
    anello = `<div class="dm-f-cot-anello" style="--p:100"><div><span class="dm-f-num">✓</span><small>${esc(cucina.parola)}</small></div></div>`;
  else if (cucina.rimasti != null) {
    const fatto = cucina.frazione == null ? 0 : Math.round((1 - cucina.frazione) * 100);
    const sotto =
      cucina.totali != null
        ? `${t("di", "of")} ${Math.round(cucina.totali / 60)} min`
        : t("rimangono", "left");
    anello = `<div class="dm-f-cot-anello" style="--p:${fatto}" role="timer"><div><span class="dm-f-num">${esc(
      minutiESecondi(cucina.rimasti),
    )}</span><small>${esc(sotto)}</small></div></div>`;
  }
  const righe = [];
  if (cucina.prontaAlle)
    righe.push(
      `${cucina.femminile ? t("pronta alle", "ready at") : t("pronto alle", "ready at")} <b>${esc(orologio(cucina.prontaAlle))}</b>`,
    );
  if (cucina.avviataAlle)
    righe.push(
      `${esc(cucina.femminile ? t("avviata alle", "started at") : t("avviato alle", "started at"))} ${esc(orologio(cucina.avviataAlle))}`,
    );
  if (pronta && cucina.finitaAlle)
    righe.push(`${esc(t("fine alle", "done at"))} ${esc(orologio(cucina.finitaAlle))}`);
  const eroe = `<div class="dm-f-cot-eroe">${anello}
    <div class="dm-f-cot-dx"><b data-dm-no-i18n>${esc(cucina.programma || cucina.parola || "")}</b>${righe
      .map((riga) => `<span class="dm-f-cot-q">${riga}</span>`)
      .join("")}${cassetto}</div>
  </div>`;
  const gradi = cucina.gradi
    ? `<h4 class="dm-f-tit">${esc(t("Temperatura", "Temperature"))}</h4>
      <div class="dm-f-cot-gradi"><b>🌡️ ${esc(t("Gradi", "Degrees"))}</b><div class="dm-f-cot-ctl">${tastoCottura(
        cucina,
        "meno_caldo",
        "dm-f-cot-tondo",
        "−",
        "",
      )}<span class="dm-f-num">${esc(String(Math.round(cucina.gradi.valore)))}${esc(
        clean(cucina.gradi.unita).replace(/C$/, "") || "°",
      )}</span>${tastoCottura(cucina, "piu_caldo", "dm-f-cot-tondo", "+", "")}</div></div>`
    : "";
  const tasti = [
    tastoCottura(cucina, "pausa", "dm-f-cot-tasto", "⏸", t("Pausa", "Pause")),
    tastoCottura(cucina, "riprendi", "dm-f-cot-tasto", "▶", t("Riprendi", "Resume")),
    tastoCottura(cucina, "piu_un_minuto", "dm-f-cot-tasto", "⏱", t("+1 min", "+1 min")),
    tastoCottura(cucina, "stop", "dm-f-cot-tasto dm-f-cot-forte", "⏹", t("Stop", "Stop")),
  ].filter(Boolean);
  const altri = (cucina.altri || []).length
    ? `<h4 class="dm-f-tit">${esc(t("Gli altri in cucina", "The rest of the kitchen"))}</h4>
      <div class="dm-f-cot-altri">${cucina.altri
        .map((altro) => {
          const sotto = [
            clean(altro.parola).toLowerCase(),
            altro.gradi ? `${Math.round(altro.gradi.valore)} ${altro.gradi.unita}` : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return `<div><span aria-hidden="true">${esc(altro.glifo)}</span><span><b data-dm-no-i18n>${esc(altro.nome)}</b><em>${esc(sotto)}</em></span></div>`;
        })
        .join("")}</div>`
    : "";
  return `<div class="dm-f dm-f-cottura" data-fase="${esc(cucina.fase || "")}">${eroe}${gradi}${
    tasti.length
      ? `<div class="dm-f-cot-tasti" style="--n:${tasti.length}">${tasti.join("")}</div>`
      : ""
  }${altri}</div>`;
}

const STILE_COTTURA = `
${P} .dm-f-cot-eroe{display:flex;gap:16px;align-items:center;padding:18px;border-radius:26px;
  background:linear-gradient(160deg,color-mix(in srgb,var(--dm-widget-accent,#0891b2) 8%,var(--card-bg,#fff)),color-mix(in srgb,var(--dm-widget-accent,#0891b2) 15%,var(--card-bg,#fff)));
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#0891b2) 28%,transparent)}
${P} .dm-f-cot-anello{flex:0 0 118px;width:118px;height:118px;border-radius:50%;display:grid;place-items:center;position:relative;
  background:conic-gradient(var(--dm-widget-accent,#0891b2) calc(var(--p)*1%),color-mix(in srgb,var(--text-dim,#64748b) 18%,transparent) 0)}
${P} .dm-f-cot-anello::after{content:"";position:absolute;inset:11px;border-radius:50%;background:var(--card-bg,#fff)}
${P} .dm-f-cot-anello>div{position:relative;z-index:1;text-align:center}
${P} .dm-f-cot-anello .dm-f-num{font-size:34px;line-height:1;color:var(--text,#0f172a)}
${P} .dm-f-cot-anello small{display:block;margin-top:2px;font-size:10.5px;font-weight:850;color:var(--text-dim,#64748b)}
${P} .dm-f-cot-dx{min-width:0}
${P} .dm-f-cot-dx>b{display:block;font-size:19px;font-weight:850;color:var(--text,#0f172a);overflow-wrap:anywhere}
${P} .dm-f-cot-q{display:block;font-size:13px;font-weight:750;color:var(--text-dim,#475569);margin-top:3px}
${P} .dm-f-cot-q b{color:var(--text,#0f172a)}
${P} .dm-f-cot-chip{display:inline-flex;align-items:center;gap:6px;margin-top:9px;padding:6px 11px;border-radius:999px;font-size:12px;font-weight:850;
  background:var(--card-bg,#fff);border:1px solid color-mix(in srgb,var(--dm-widget-accent,#0891b2) 30%,transparent);color:var(--dm-widget-accent,#0e7490)}
${P} .dm-f-cot-chip::before{content:"✓"}
${P} .dm-f-cot-chip[data-aperto="true"]{color:#b45309;border-color:#fcd34d}
${P} .dm-f-cot-chip[data-aperto="true"]::before{content:"!"}
${P} .dm-f-cot-gradi{display:flex;align-items:center;justify-content:space-between;gap:10px;border-radius:20px;padding:10px 12px 10px 16px;
  background:color-mix(in srgb,var(--text-dim,#64748b) 6%,var(--card-bg,#fff));border:1px solid var(--card-border,#eef2f7)}
${P} .dm-f-cot-gradi>b{font-size:13.5px;font-weight:850;color:var(--text,#0f172a)}
${P} .dm-f-cot-ctl{display:flex;align-items:center;gap:10px}
${P} .dm-f-cot-ctl .dm-f-num{font-size:30px;min-width:70px;text-align:center;color:var(--text,#0f172a)}
${P} .dm-f-cot-tondo{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;padding:0;cursor:pointer;font:inherit;font-size:22px;font-weight:700;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);color:var(--dm-widget-accent,#0e7490)}
${P} .dm-f-cot-tasti{display:grid;grid-template-columns:repeat(var(--n,3),1fr);gap:9px}
${P} .dm-f-cot-tasto{border-radius:20px;padding:13px 6px;text-align:center;font:inherit;font-weight:850;font-size:14px;cursor:pointer;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);color:var(--text,#0f172a)}
${P} .dm-f-cot-tasto span{display:block;font-size:20px;margin-bottom:3px}
${P} .dm-f-cot-forte{background:var(--dm-widget-accent,#0e7490);border-color:var(--dm-widget-accent,#0e7490);color:#fff}
${P} .dm-f-cot-altri{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
${P} .dm-f-cot-altri>div{display:flex;align-items:center;gap:9px;border-radius:16px;padding:10px 12px;font-size:13px;font-weight:800;
  background:color-mix(in srgb,var(--text-dim,#64748b) 6%,var(--card-bg,#fff));border:1px solid var(--card-border,#eef2f7);color:var(--text,#0f172a);min-width:0}
${P} .dm-f-cot-altri b{display:block;font-weight:800}
${P} .dm-f-cot-altri em{display:block;font-style:normal;font-size:11px;color:var(--text-dim,#94a3b8);font-weight:700}
`;

/* ── MiniPC ──────────────────────────────────────────────────────────── */

function fraseDelCarico(cpu) {
  if (cpu < 50) return t("Lavora tranquillo", "Taking it easy");
  if (cpu < 85) return t("Sta lavorando", "Working");
  return t("È sotto sforzo", "Under heavy load");
}

function finestraMinipc(widget) {
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  const di = (chiave) => righe.find((riga) => riga.chiave === chiave);
  const cpu = di("cpu");
  const temperatura = di("temperatura");
  const potenza = di("potenza");
  const internet = di("internet");
  const accanto = [
    temperatura ? `🌡️ ${clean(temperatura.value)}` : "",
    potenza ? `⚡ ${clean(potenza.value)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const pastiglia = internet
    ? `<span class="dm-f-pc-net" data-on="${Boolean(internet.on)}"><i></i>${esc(
        internet.on ? t("Internet attivo", "Internet up") : t("Internet assente", "Internet down"),
      )}</span>`
    : "";
  const percentuale = (riga) =>
    riga && Number.isFinite(Number(riga.raw)) && /%$/.test(clean(riga.value));
  const carico = percentuale(cpu) ? Number(cpu.raw) : null;
  const eroe = `<div class="dm-f-pc-eroe">${
    carico != null
      ? `<div class="dm-f-pc-anello" style="--p:${Math.round(Math.max(0, Math.min(100, carico)))}"><div><span class="dm-f-num">${esc(
          clean(cpu.value),
        )}</span><small>CPU</small></div></div>`
      : ""
  }<div class="dm-f-pc-dx">${carico != null ? `<b>${esc(fraseDelCarico(carico))}</b>` : ""}${
    accanto ? `<span>${esc(accanto)}</span>` : ""
  }${pastiglia}</div></div>`;
  const quote = ["ram", "disco"]
    .map(di)
    .filter(percentuale)
    .map((riga) => {
      const pieno = Math.max(0, Math.min(100, Number(riga.raw)));
      const tono = pieno >= 92 ? "rosso" : pieno >= 80 ? "caldo" : "";
      return `<div class="dm-f-pc-quota" data-tono="${tono}"><b>${esc(riga.name)}</b><i style="--w:${pieno}%"></i><span class="dm-f-num">${esc(
        clean(riga.value),
      )}</span></div>`;
    });
  const rete = ["scarica", "invia", "ping"]
    .map((chiave) => [chiave, di(chiave)])
    .filter(([, riga]) => riga)
    .map(([chiave, riga]) => {
      const { numero, unita } = numeroEUnita(riga.value);
      const nome =
        chiave === "scarica"
          ? `⬇ ${t("Scarica", "Download")}`
          : chiave === "invia"
            ? `⬆ ${t("Invia", "Upload")}`
            : "Ping";
      return `<div class="dm-f-pc-cas"><small>${esc(nome)}</small><span class="dm-f-num">${esc(numero)}</span><em>${esc(unita)}</em></div>`;
    });
  return `<div class="dm-f dm-f-minipc">${eroe}${
    quote.length
      ? `<h4 class="dm-f-tit">${esc(t("Quanto è pieno", "How full"))}</h4>${quote.join("")}`
      : ""
  }${rete.length ? `<h4 class="dm-f-tit">${esc(t("La rete", "Network"))}</h4><div class="dm-f-pc-tre">${rete.join("")}</div>` : ""}</div>`;
}

const STILE_MINIPC = `
${P} .dm-f-pc-eroe{display:flex;gap:16px;align-items:center;padding:18px;border-radius:26px;
  background:linear-gradient(160deg,color-mix(in srgb,var(--dm-widget-accent,#334155) 5%,var(--card-bg,#fff)),color-mix(in srgb,var(--dm-widget-accent,#334155) 10%,var(--card-bg,#fff)));
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#334155) 20%,transparent)}
${P} .dm-f-pc-anello{flex:0 0 108px;width:108px;height:108px;border-radius:50%;display:grid;place-items:center;position:relative;
  background:conic-gradient(var(--dm-widget-accent,#334155) calc(var(--p)*1%),color-mix(in srgb,var(--text-dim,#64748b) 18%,transparent) 0)}
${P} .dm-f-pc-anello::after{content:"";position:absolute;inset:11px;border-radius:50%;background:var(--card-bg,#fff)}
${P} .dm-f-pc-anello>div{position:relative;z-index:1;text-align:center}
${P} .dm-f-pc-anello .dm-f-num{font-size:32px;line-height:1;color:var(--text,#0f172a)}
${P} .dm-f-pc-anello small{display:block;font-size:10px;font-weight:900;letter-spacing:.1em;color:var(--text-dim,#64748b)}
${P} .dm-f-pc-dx{min-width:0}
${P} .dm-f-pc-dx b{display:block;font-size:18px;font-weight:850;color:var(--text,#0f172a)}
${P} .dm-f-pc-dx>span{display:block;font-size:12.5px;font-weight:750;color:var(--text-dim,#64748b);margin-top:3px}
${P} .dm-f-pc-dx .dm-f-pc-net{display:inline-flex;align-items:center;gap:6px;margin-top:9px;padding:6px 11px;border-radius:999px;font-size:12px;font-weight:850;background:#dcfce7;color:#15803d}
${P} .dm-f-pc-net i{width:8px;height:8px;border-radius:50%;background:currentColor}
${P} .dm-f-pc-dx .dm-f-pc-net[data-on="false"]{background:#fee2e2;color:#b91c1c}
${P} .dm-f-pc-quota{display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:18px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#eef2f7)}
${P} .dm-f-pc-quota b{width:58px;font-size:13px;font-weight:850;color:var(--text,#0f172a)}
${P} .dm-f-pc-quota i{flex:1;height:9px;border-radius:999px;background:color-mix(in srgb,var(--text-dim,#64748b) 16%,transparent);position:relative;overflow:hidden}
${P} .dm-f-pc-quota i::after{content:"";position:absolute;inset:0 auto 0 0;width:var(--w);border-radius:999px;background:var(--dm-widget-accent,#475569)}
${P} .dm-f-pc-quota[data-tono="caldo"] i::after{background:#f59e0b}
${P} .dm-f-pc-quota[data-tono="rosso"] i::after{background:#dc2626}
${P} .dm-f-pc-quota .dm-f-num{width:52px;text-align:right;font-size:20px;color:var(--text,#0f172a)}
${P} .dm-f-pc-tre{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}
${P} .dm-f-pc-cas{border-radius:18px;padding:12px 11px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#eef2f7);min-width:0}
${P} .dm-f-pc-cas small{display:block;font-size:10px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--text-dim,#64748b);white-space:nowrap}
${P} .dm-f-pc-cas .dm-f-num{display:block;font-size:22px;margin-top:4px;color:var(--text,#0f172a)}
${P} .dm-f-pc-cas em{font-style:normal;font-size:11px;font-weight:750;color:var(--text-dim,#94a3b8)}
`;

/* ── Server e rete ───────────────────────────────────────────────────── */

const segnoDellaMacchina = (riga, misura) =>
  disegnoDelCatalogo(riga.glyph, misura) ||
  (/^[a-z-]+$/.test(clean(riga.glyph)) ? "" : esc(clean(riga.glyph)));

function tastoAvvia(riga) {
  const comandi = riga.comandi;
  if (comandi?.tipo === "switch" && comandi.entity)
    return tastoServizio(
      { domain: "switch", service: "turn_on", data: { entity_id: comandi.entity } },
      { classe: "dm-f-mac-avvia", testo: esc(t("Avvia", "Start")) },
    );
  if (comandi?.tipo === "button" && comandi.avvia)
    return tastoServizio(
      { domain: "button", service: "press", data: { entity_id: comandi.avvia } },
      { classe: "dm-f-mac-avvia", testo: esc(t("Avvia", "Start")) },
    );
  return "";
}

function finestraMacchine(widget) {
  const adesso = Date.now();
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  const giu = righe.filter((riga) => riga.stato !== "su");
  const su = righe.filter((riga) => riga.stato === "su");
  const eroe = giu.length
    ? `<div class="dm-f-mac-eroe" data-giu="true">
        <div class="dm-f-mac-riga"><span class="dm-f-num">${giu.length}</span><div><b>${esc(
          giu.length === 1
            ? t("non risponde", "not answering")
            : t("non rispondono", "not answering"),
        )}</b>${su.length ? `<span>${esc(t("in piedi:", "up:"))} ${su.length}</span>` : ""}</div></div>
        ${giu
          .map((riga) => {
            const da = riga.da ? `${t("da", "for")} ${durataCorta(adesso - riga.da)}` : "";
            const parola =
              riga.stato === "giu"
                ? riga.famiglia === "rete"
                  ? t("Assente", "Down")
                  : t("Ferma", "Stopped")
                : t("Non risponde", "Not answering");
            const tasto = tastoAvvia(riga);
            return `<div class="dm-f-mac-giu">
              <span class="dm-f-mac-ic" aria-hidden="true">${segnoDellaMacchina(riga, 22)}</span>
              <span class="dm-f-mac-n"><b data-dm-no-i18n>${esc(riga.name)}</b><em>${esc(parola)}${da ? ` ${esc(da)}` : ""}</em>${
                tasto
                  ? ""
                  : `<small>${esc(t("Nessun comando: va riacceso a mano", "No controls: restart it by hand"))}</small>`
              }</span>${tasto}
            </div>`;
          })
          .join("")}
      </div>`
    : `<div class="dm-f-mac-eroe"><div class="dm-f-mac-riga"><span class="dm-f-num">${su.length}</span><div><b>${esc(
        t("tutto in piedi", "all up"),
      )}</b></div></div></div>`;
  const gruppi = new Map();
  for (const riga of su) {
    const chiave = `${riga.famiglia}|${riga.integrazione || ""}`;
    if (!gruppi.has(chiave)) gruppi.set(chiave, []);
    gruppi.get(chiave).push(riga);
  }
  const elenco = [...gruppi.entries()]
    .sort(([a], [b]) => (a.startsWith("macchine") ? 0 : 1) - (b.startsWith("macchine") ? 0 : 1))
    .map(([chiave, membri]) => {
      const [famiglia, integrazione] = chiave.split("|");
      const nome = famiglia === "rete" ? t("Rete", "Network") : t("Server", "Servers");
      const conto =
        famiglia === "rete"
          ? `${membri.length} ${t("connessi", "connected")}`
          : `${membri.length} ${t("accesi", "running")}`;
      return `<h4 class="dm-f-tit dm-f-mac-testa"><span>${esc(nome)}${
        integrazione ? ` · <span data-dm-no-i18n>${esc(integrazione)}</span>` : ""
      }</span><em>${esc(conto)}</em></h4>
        <div class="dm-f-mac-gruppo">${membri
          .map(
            (riga) =>
              `<div class="dm-f-mac-r"><i aria-hidden="true"></i><b data-dm-no-i18n>${esc(riga.name)}</b><span aria-hidden="true">${segnoDellaMacchina(riga, 18)}</span></div>`,
          )
          .join("")}</div>`;
    })
    .join("");
  return `<div class="dm-f dm-f-macchine">${eroe}${elenco}</div>`;
}

const STILE_MACCHINE = `
${P} .dm-f-macchine{--dm-f-indaco:#4f46e5}
${P} .dm-f-mac-eroe{border-radius:24px;padding:16px 18px;background:linear-gradient(155deg,color-mix(in srgb,var(--dm-f-indaco) 5%,var(--card-bg,#fff)),color-mix(in srgb,var(--dm-f-indaco) 10%,var(--card-bg,#fff)));
  border:1px solid color-mix(in srgb,var(--dm-f-indaco) 22%,transparent)}
${P} .dm-f-mac-eroe[data-giu="true"]{background:linear-gradient(155deg,color-mix(in srgb,#dc2626 4%,var(--card-bg,#fff)),color-mix(in srgb,#dc2626 8%,var(--card-bg,#fff)));border-color:#fecaca}
${P} .dm-f-mac-riga{display:flex;align-items:center;gap:12px}
${P} .dm-f-mac-riga .dm-f-num{font-size:48px;line-height:1;color:var(--dm-f-indaco)}
${P} .dm-f-mac-eroe[data-giu="true"] .dm-f-mac-riga .dm-f-num{color:#dc2626}
${P} .dm-f-mac-riga b{display:block;font-size:16px;font-weight:850;color:var(--text,#0f172a)}
${P} .dm-f-mac-riga span{font-size:12.5px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-mac-giu{display:flex;align-items:center;gap:12px;padding:12px;border-radius:18px;background:var(--card-bg,#fff);border:1px solid #fecaca;margin-top:10px}
${P} .dm-f-mac-ic{flex:0 0 auto;width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-size:20px;background:#fef2f2;color:#b91c1c}
${P} .dm-f-mac-n{flex:1;min-width:0}
${P} .dm-f-mac-n b{display:block;font-size:14.5px;font-weight:850;color:var(--text,#0f172a);overflow-wrap:anywhere}
${P} .dm-f-mac-n em{font-style:normal;font-size:12px;font-weight:750;color:#b91c1c}
${P} .dm-f-mac-n small{display:block;font-size:11.5px;font-weight:750;color:var(--text-dim,#64748b);margin-top:2px}
${P} .dm-f-mac-avvia{flex:0 0 auto;padding:10px 16px;border:0;border-radius:14px;background:var(--dm-f-indaco);color:#fff;font:inherit;font-size:13px;font-weight:850;cursor:pointer}
${P} .dm-f-mac-testa{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
${P} .dm-f-mac-testa em{font-style:normal;font-size:11.5px;font-weight:800;letter-spacing:.02em;text-transform:none;color:#15803d}
${P} .dm-f-mac-gruppo{border-radius:20px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#eef2f7);padding:4px 14px}
${P} .dm-f-mac-r{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--text-dim,#64748b) 12%,transparent)}
${P} .dm-f-mac-r:last-child{border-bottom:0}
${P} .dm-f-mac-r>i{flex:0 0 auto;width:9px;height:9px;border-radius:50%;background:#16a34a;box-shadow:0 0 0 4px rgba(22,163,74,.15)}
${P} .dm-f-mac-r b{flex:1;min-width:0;font-size:14px;font-weight:800;color:var(--text,#0f172a);overflow-wrap:anywhere}
${P} .dm-f-mac-r span{color:var(--dm-f-indaco);display:grid;place-items:center}
`;

/* ── In evidenza e le sezioni proprie ────────────────────────────────── */

const COMANDABILI = new Set(["switch", "input_boolean", "light", "fan", "valve", "siren"]);
const APERTURE = new Set(["door", "window", "garage_door", "opening", "gate"]);
const MISURE = Object.freeze({
  temperature: ["temperatura", "temperature"],
  humidity: ["umidità", "humidity"],
  power: ["potenza", "power"],
  energy: ["energia", "energy"],
  battery: ["batteria", "battery"],
  pressure: ["pressione", "pressure"],
  illuminance: ["luce", "light"],
  moisture: ["umidità", "moisture"],
  volume: ["volume", "volume"],
  water: ["acqua", "water"],
  carbon_dioxide: ["CO₂", "CO₂"],
});

const eUnaValvola = (riga) =>
  clean(riga.entity).startsWith("valve.") ||
  /valvol|valve|rubinett/i.test(`${clean(riga.name)} ${clean(riga.entity)}`);

/** Come leggere una voce: comando, apertura, percentuale, numero, parola. */
function genereDellaVoce(riga, states) {
  const entity = clean(riga.entity);
  const dominio = entity.split(".")[0];
  const stato = states?.[entity];
  const classe = clean(stato?.attributes?.device_class);
  if (COMANDABILI.has(dominio) && typeof riga.on === "boolean") return "comando";
  if (dominio === "binary_sensor" && APERTURE.has(classe) && typeof riga.on === "boolean")
    return "apertura";
  if (riga.raw != null && clean(riga.unit) === "%") return "percentuale";
  if (riga.raw != null) return "numero";
  return "parola";
}

function parolaDelComando(riga) {
  if (eUnaValvola(riga)) return riga.on ? t("Aperta", "Open") : t("Chiusa", "Closed");
  return riga.on ? t("Acceso", "On") : t("Spento", "Off");
}

function daQuando(states, entity) {
  const stato = states?.[clean(entity)];
  const quando = Date.parse(stato?.last_changed || stato?.last_updated || "");
  return Number.isFinite(quando) ? quando : null;
}

function iconaDellaVoce(riga, states, ripiego = "") {
  const scelta = clean(riga.glyph);
  if (scelta && scelta !== clean(ripiego))
    return iconGlyphHtml(scelta, { size: 22, fallback: "•" });
  const classe = clean(states?.[clean(riga.entity)]?.attributes?.device_class);
  if (eUnaValvola(riga)) return "🚰";
  const proprie = {
    temperature: "🌡️",
    humidity: "💧",
    moisture: "💧",
    power: "⚡",
    energy: "⚡",
    battery: "🔋",
    door: "🚪",
    gate: "🚪",
    window: "🪟",
    garage_door: "🚗",
    opening: "🚪",
  };
  if (proprie[classe]) return proprie[classe];
  return iconGlyphHtml(scelta || "•", { size: 22, fallback: "•" });
}

function cartaDelComando(riga, states, ripiego, adesso = Date.now()) {
  const da = daQuando(states, riga.entity);
  const nome = nomePulito(riga.name, riga.entity);
  return `<div class="dm-f-ev-cmd" data-on="${Boolean(riga.on)}">
    <span class="dm-f-ev-cmd-ic" aria-hidden="true">${iconaDellaVoce(riga, states, ripiego)}</span>
    <span class="dm-f-ev-cmd-n"><b data-dm-no-i18n>${esc(nome)}</b><em>${esc(parolaDelComando(riga))}${
      da ? ` ${esc(t("da", "for"))} ${esc(durataCorta(adesso - da))}` : ""
    }</em></span>
    ${leva(riga.entity, Boolean(riga.on), nome)}
  </div>`;
}

function cartaDellaLettura(riga, states, ripiego, adesso) {
  const genere = genereDellaVoce(riga, states);
  const da = daQuando(states, riga.entity);
  const classe = clean(states?.[clean(riga.entity)]?.attributes?.device_class);
  let quando = "";
  if (da && genere === "apertura") quando = `${t("dalle", "since")} ${orologio(da)}`;
  else if (da) quando = `${durataCorta(adesso - da)} ${t("fa", "ago")}`;
  /* La percentuale sta attaccata al numero: «72%», non «72 %». */
  let valore = `<span class="dm-f-num dm-f-ev-val">${esc(clean(riga.value).replace(/\s+%$/, "%"))}</span>`;
  if (genere === "apertura")
    valore = `<span class="dm-f-num dm-f-ev-stato" data-aperto="${riga.on}">${esc(
      riga.on ? t("Aperto", "Open") : t("Chiuso", "Closed"),
    )}</span>`;
  else if (genere === "parola")
    valore = `<span class="dm-f-num dm-f-ev-stato" data-dm-no-i18n>${esc(clean(riga.value))}</span>`;
  const misura = MISURE[classe] ? t(MISURE[classe][0], MISURE[classe][1]) : "";
  const barra =
    genere === "percentuale"
      ? `<div class="dm-f-ev-barra"><i style="width:${Math.round(Math.max(0, Math.min(100, Number(riga.raw))))}%"></i></div>`
      : "";
  return `<div class="dm-f-ev-voce" data-genere="${genere}">
    <div class="dm-f-ev-su"><span aria-hidden="true">${iconaDellaVoce(riga, states, ripiego)}</span>${
      quando ? `<small>${esc(quando)}</small>` : ""
    }</div>
    ${valore}<b data-dm-no-i18n>${esc(nomePulito(riga.name, riga.entity))}</b>${
      misura && genere !== "percentuale" ? `<em>${esc(misura)}</em>` : ""
    }${barra}
  </div>`;
}

function finestraEvidenza(widget, states) {
  const adesso = Date.now();
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  const comandi = righe.filter((riga) => genereDellaVoce(riga, states) === "comando");
  const letture = righe.filter((riga) => genereDellaVoce(riga, states) !== "comando");
  /* Niente tasto verso il Config: la finestra mostra le voci, e senza voci
   * lo dice e basta. */
  if (!righe.length)
    return `<div class="dm-f dm-f-evidenza"><p class="dm-f-vuota">${esc(t("Nessuna voce", "No entries"))}</p></div>`;
  return `<div class="dm-f dm-f-evidenza">${comandi
    .map((riga) => cartaDelComando(riga, states, "", adesso))
    .join("")}${
    letture.length
      ? `${comandi.length ? `<h4 class="dm-f-tit">${esc(t("Le letture", "Readings"))}</h4>` : ""}<div class="dm-f-ev-griglia">${letture
          .map((riga) => cartaDellaLettura(riga, states, "", adesso))
          .join("")}</div>`
      : ""
  }</div>`;
}

function finestraSezioneMia(widget, states) {
  const ripiego = clean(widget.icon);
  const righe = Array.isArray(widget.rows) ? widget.rows : [];
  const generi = righe.map((riga) => [riga, genereDellaVoce(riga, states)]);
  const livello = generi.find(([, genere]) => genere === "percentuale")?.[0] || null;
  const comandi = generi.filter(([, genere]) => genere === "comando").map(([riga]) => riga);
  const letture = generi
    .filter(([riga, genere]) => genere !== "comando" && riga !== livello)
    .map(([riga]) => riga);
  const frase = comandi
    .map((riga) => `${nomePulito(riga.name, riga.entity)} ${parolaDelComando(riga).toLowerCase()}`)
    .join(" · ");
  const eroe = livello
    ? `<div class="dm-f-mia-eroe">
        <div class="dm-f-mia-vasca" aria-hidden="true"><i style="height:${Math.round(Math.max(0, Math.min(100, Number(livello.raw))))}%"></i></div>
        <div><small data-dm-no-i18n>${esc(nomePulito(livello.name, livello.entity))}</small><span class="dm-f-num">${esc(
          clean(livello.value).replace(/\s+%$/, "%"),
        )}</span>${frase ? `<em data-dm-no-i18n>${esc(frase)}</em>` : ""}</div>
      </div>`
    : "";
  const leve = comandi.length
    ? `<h4 class="dm-f-tit">${esc(t("I comandi", "Controls"))}</h4><div class="dm-f-mia-leve">${comandi
        .map((riga) => {
          const nome = nomePulito(riga.name, riga.entity);
          return `<div class="dm-f-mia-leva" data-on="${Boolean(riga.on)}">
            <div class="dm-f-mia-su"><span aria-hidden="true">${iconaDellaVoce(riga, states, ripiego)}</span>${leva(
              riga.entity,
              Boolean(riga.on),
              nome,
            )}</div>
            <b data-dm-no-i18n>${esc(nome)}</b><span class="dm-f-num">${esc(parolaDelComando(riga))}</span>
          </div>`;
        })
        .join("")}</div>`
    : "";
  const elenco = letture.length
    ? `<h4 class="dm-f-tit">${esc(t("Le letture", "Readings"))}</h4>${letture
        .map((riga) => {
          const genere = genereDellaVoce(riga, states);
          const valore =
            genere === "apertura"
              ? riga.on
                ? t("Aperto", "Open")
                : t("Chiuso", "Closed")
              : clean(riga.value);
          return `<div class="dm-f-mia-riga"><span aria-hidden="true">${iconaDellaVoce(riga, states, ripiego)}</span><b data-dm-no-i18n>${esc(
            nomePulito(riga.name, riga.entity),
          )}</b><span class="dm-f-num">${esc(valore)}</span></div>`;
        })
        .join("")}`
    : "";
  return `<div class="dm-f dm-f-sezionimie">${eroe}${leve}${elenco}</div>`;
}

const STILE_EVIDENZE = `
${P} .dm-f-ev-cmd{display:flex;align-items:center;gap:13px;padding:14px;border-radius:22px;
  background:linear-gradient(155deg,color-mix(in srgb,var(--dm-widget-accent,#eab308) 7%,var(--card-bg,#fff)),color-mix(in srgb,var(--dm-widget-accent,#eab308) 14%,var(--card-bg,#fff)));
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#eab308) 35%,transparent)}
${P} .dm-f-ev-cmd-ic{flex:0 0 auto;width:48px;height:48px;border-radius:16px;display:grid;place-items:center;font-size:24px;background:var(--card-bg,#fff);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dm-widget-accent,#eab308) 35%,transparent)}
${P} .dm-f-ev-cmd-n{flex:1;min-width:0}
${P} .dm-f-ev-cmd-n b{display:block;font-size:16px;font-weight:850;color:var(--text,#0f172a);overflow-wrap:anywhere}
${P} .dm-f-ev-cmd-n em{font-style:normal;font-size:12px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-ev-cmd[data-on="true"] em{color:#15803d}
${P} .dm-f-ev-griglia{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:9px}
${P} .dm-f-ev-voce{border-radius:20px;padding:13px 13px 12px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#eef2f7);
  box-shadow:0 12px 24px -22px rgba(15,23,42,.6);min-width:0}
${P} .dm-f-ev-su{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:20px}
${P} .dm-f-ev-su small{font-size:10.5px;font-weight:800;color:var(--text-dim,#94a3b8);white-space:nowrap}
${P} .dm-f-ev-val{display:block;font-size:26px;line-height:1.1;margin-top:8px;color:var(--text,#0f172a);overflow-wrap:anywhere}
${P} .dm-f-ev-stato{display:block;font-size:22px;margin-top:8px;color:var(--text,#0f172a)}
${P} .dm-f-ev-stato[data-aperto="true"]{color:#b45309}
${P} .dm-f-ev-voce>b{display:block;font-size:13px;font-weight:850;margin-top:2px;color:var(--text,#0f172a);overflow-wrap:anywhere}
${P} .dm-f-ev-voce>em{display:block;font-style:normal;font-size:11.5px;font-weight:750;color:var(--text-dim,#64748b);margin-top:3px}
${P} .dm-f-ev-barra{height:6px;border-radius:999px;background:color-mix(in srgb,var(--text-dim,#64748b) 16%,transparent);margin-top:8px;overflow:hidden}
${P} .dm-f-ev-barra i{display:block;height:100%;border-radius:999px;background:var(--dm-widget-accent,#eab308)}
${P} .dm-f-mia-eroe{display:flex;align-items:center;gap:16px;padding:16px 18px;border-radius:24px;
  background:linear-gradient(155deg,color-mix(in srgb,var(--dm-widget-accent,#f59e0b) 7%,var(--card-bg,#fff)),color-mix(in srgb,var(--dm-widget-accent,#f59e0b) 14%,var(--card-bg,#fff)));
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#f59e0b) 30%,transparent)}
${P} .dm-f-mia-vasca{flex:0 0 70px;height:92px;border-radius:14px 14px 18px 18px;border:3px solid color-mix(in srgb,var(--dm-widget-accent,#f59e0b) 55%,transparent);
  background:var(--card-bg,#fff);position:relative;overflow:hidden}
${P} .dm-f-mia-vasca i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,#7dd3fc,#0ea5e9)}
${P} .dm-f-mia-eroe small{display:block;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:color-mix(in srgb,var(--dm-widget-accent,#f59e0b) 70%,#000)}
${P} .dm-f-mia-eroe .dm-f-num{display:block;font-size:44px;line-height:1;margin-top:2px;color:var(--text,#0f172a)}
${P} .dm-f-mia-eroe em{display:block;margin-top:4px;font-style:normal;font-size:12.5px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-mia-leve{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:9px}
${P} .dm-f-mia-leva{border-radius:22px;padding:14px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#eef2f7);box-shadow:0 12px 24px -22px rgba(15,23,42,.6);min-width:0}
${P} .dm-f-mia-leva[data-on="true"]{background:linear-gradient(160deg,#f0fdf4,#dcfce7);border-color:#bbf7d0}
${P} .dm-f-mia-su{display:flex;justify-content:space-between;align-items:center;font-size:22px}
${P} .dm-f-mia-leva b{display:block;font-size:14px;font-weight:850;margin-top:12px;color:var(--text,#0f172a);overflow-wrap:anywhere}
${P} .dm-f-mia-leva .dm-f-num{font-size:22px;color:var(--text-dim,#64748b)}
${P} .dm-f-mia-leva[data-on="true"] .dm-f-num,${P} .dm-f-mia-leva[data-on="true"] b{color:#15803d}
${P} .dm-f-mia-riga{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#eef2f7)}
${P} .dm-f-mia-riga>span:first-child{font-size:20px}
${P} .dm-f-mia-riga b{flex:1;min-width:0;font-size:14px;font-weight:850;color:var(--text,#0f172a);overflow-wrap:anywhere}
${P} .dm-f-mia-riga .dm-f-num{font-size:22px;color:var(--text,#0f172a);white-space:nowrap}
`;

/* ── Segnalazioni ────────────────────────────────────────────────────── */

const iniziali = (nome) =>
  clean(nome)
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((pezzo) => pezzo.charAt(0).toUpperCase())
    .join("") || "#";

function finestraSegnalazioni(widget) {
  const conto = widget.conto || {};
  const generi = [
    ["bug", "🐞", t("Difetti", "Bugs"), "var(--dm-widget-accent,#0369a1)"],
    ["feature", "✨", t("Idee", "Ideas"), "#38bdf8"],
    ["assistenza", "💬", t("Aiuto", "Help"), "#a5b4fc"],
  ].filter(([id]) => Number(conto[id]) > 0);
  const oggi = Number(conto.oggi) || 0;
  const eroe = `<div class="dm-f-seg-eroe">
    <div class="dm-f-seg-riga"><span class="dm-f-num">${Number(conto.quante) || 0}</span><div><b>${esc(
      t("da lavorare", "to work on"),
    )}</b><span>${esc(oggi ? `${t("Oggi arrivate:", "In today:")} ${oggi}` : t("Oggi non è arrivato niente", "Nothing came in today"))}</span></div></div>
    ${
      generi.length
        ? `<div class="dm-f-seg-barra">${generi
            .map(
              ([id, , , colore]) =>
                `<i style="flex:${Number(conto[id])};background:${colore}"></i>`,
            )
            .join("")}</div>
          <div class="dm-f-seg-leg">${generi
            .map(
              ([id, icona, nome, colore]) =>
                `<span><i style="background:${colore}"></i>${icona} ${esc(nome)} <b>${Number(conto[id])}</b></span>`,
            )
            .join("")}</div>`
        : ""
    }
  </div>`;
  const conversazioni = Array.isArray(conto.conversazioni) ? conto.conversazioni : [];
  const MOSTRATE = 3;
  const attesa = conversazioni.length
    ? `<h4 class="dm-f-tit">${esc(t("Ti stanno aspettando", "Waiting for you"))}</h4>${conversazioni
        .slice(-MOSTRATE)
        .reverse()
        .map((voce) => {
          const numero = Number(voce?.number) || 0;
          const stato =
            voce?.stato === "in-carico"
              ? t("in lavorazione", "in progress")
              : voce?.stato === "inviato"
                ? t("mai aperta", "never opened")
                : "";
          const sotto = [numero ? `#${numero}` : "", clean(voce?.autore), stato]
            .filter(Boolean)
            .join(" · ");
          return `<div class="dm-f-seg-att">
            <span class="dm-f-seg-av" aria-hidden="true">${esc(iniziali(voce?.autore))}</span>
            <span class="dm-f-seg-n"><b data-dm-no-i18n>${esc(clean(voce?.title) || `#${numero}`)}</b><em>${esc(sotto)}</em></span>
            <span class="dm-f-seg-badge" title="${esc(t("Messaggi nuovi", "New messages"))}">${Number(voce?.messages) || 1}</span>
          </div>`;
        })
        .join("")}${
        conversazioni.length > MOSTRATE
          ? `<p class="dm-f-seg-altre">${esc(t("e altre:", "and more:"))} ${conversazioni.length - MOSTRATE}</p>`
          : ""
      }`
    : "";
  const vecchie = Number(conto.vecchie) || 0;
  const ferme = vecchie
    ? `<div class="dm-f-seg-ferme"><span aria-hidden="true">⏳</span><span>${esc(
        t("Ferme da oltre un mese:", "Stuck for over a month:"),
      )} <b>${vecchie}</b>${
        conto.piuVecchia
          ? ` · ${esc(t("la più vecchia è la", "the oldest is"))} #${Number(conto.piuVecchia)}`
          : ""
      }</span></div>`
    : "";
  const due = `<div class="dm-f-seg-due">
    <div><small>${esc(t("Mai aperte", "Never opened"))}</small><span class="dm-f-num">${Number(conto.nuove) || 0}</span></div>
    <div><small>${esc(t("In lavorazione", "In progress"))}</small><span class="dm-f-num">${Number(conto.inLavorazione) || 0}</span></div>
  </div>`;
  return `<div class="dm-f dm-f-segnalazioni">${eroe}${attesa}${ferme}${due}
    <button type="button" class="dm-f-porta dm-f-pieno" data-dm-apri-cruscotto>${esc(
      t("Apri il cruscotto", "Open the console"),
    )} <span aria-hidden="true">→</span></button></div>`;
}

const STILE_SEGNALAZIONI = `
${P} .dm-f-seg-eroe{border-radius:24px;padding:16px 18px;
  background:linear-gradient(155deg,color-mix(in srgb,var(--dm-widget-accent,#0369a1) 6%,var(--card-bg,#fff)),color-mix(in srgb,var(--dm-widget-accent,#0369a1) 13%,var(--card-bg,#fff)));
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#0369a1) 28%,transparent)}
${P} .dm-f-seg-riga{display:flex;align-items:flex-end;gap:12px}
${P} .dm-f-seg-riga .dm-f-num{font-size:50px;line-height:1;color:var(--dm-widget-accent,#0369a1)}
${P} .dm-f-seg-riga b{display:block;font-size:16px;font-weight:850;color:var(--text,#0f172a)}
${P} .dm-f-seg-riga span{display:block;font-size:12.5px;font-weight:750;color:var(--text-dim,#475569);margin-bottom:5px}
${P} .dm-f-seg-barra{display:flex;height:12px;border-radius:999px;overflow:hidden;margin:14px 0 8px;gap:2px}
${P} .dm-f-seg-barra i{display:block}
${P} .dm-f-seg-leg{display:flex;gap:6px 12px;flex-wrap:wrap;font-size:12px;font-weight:800;color:var(--text-dim,#475569)}
${P} .dm-f-seg-leg span{display:inline-flex;align-items:center;gap:6px}
${P} .dm-f-seg-leg i{width:9px;height:9px;border-radius:50%}
${P} .dm-f-seg-leg b{color:var(--text,#0f172a)}
${P} .dm-f-seg-att{display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:18px;background:var(--card-bg,#fff);
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#0369a1) 18%,transparent);box-shadow:0 12px 24px -22px color-mix(in srgb,var(--dm-widget-accent,#0369a1) 90%,transparent)}
${P} .dm-f-seg-av{flex:0 0 auto;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:900;color:#fff;background:var(--dm-widget-accent,#0ea5e9)}
${P} .dm-f-seg-n{flex:1;min-width:0}
${P} .dm-f-seg-n b{display:block;font-size:14px;font-weight:850;line-height:1.25;color:var(--text,#0f172a);overflow-wrap:anywhere}
${P} .dm-f-seg-n em{font-style:normal;font-size:11.5px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-seg-badge{flex:0 0 auto;min-width:26px;height:26px;padding:0 8px;border-radius:999px;display:grid;place-items:center;background:var(--dm-widget-accent,#0369a1);color:#fff;font-size:12px;font-weight:900}
${P} .dm-f-seg-altre{margin:0 4px;font-size:12px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-seg-ferme{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:16px;background:#fffbeb;border:1px solid #fde68a;font-size:13px;font-weight:800;color:#92400e}
${P} .dm-f-seg-due{display:grid;grid-template-columns:1fr 1fr;gap:9px}
${P} .dm-f-seg-due>div{border-radius:16px;padding:11px 13px;background:color-mix(in srgb,var(--text-dim,#64748b) 6%,var(--card-bg,#fff));border:1px solid var(--card-border,#eef2f7)}
${P} .dm-f-seg-due small{display:block;font-size:10.5px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim,#64748b)}
${P} .dm-f-seg-due .dm-f-num{font-size:22px;color:var(--text,#0f172a)}
`;

/* ── Assistenza ──────────────────────────────────────────────────────── */

/* Quante risposte nuove lo dice il sottotitolo della finestra (`sottotitolo`
 * nel modello): qui niente casella per un numero solo. */
function finestraAssistenza(widget) {
  const scritto = Number(widget.scrittoIl) || 0;
  const testo = clean(widget.testo) || clean(widget.anteprima);
  const domanda = widget.domanda && clean(widget.domanda.testo) ? widget.domanda : null;
  const chi = `<div class="dm-f-chat-chi">
    <span class="dm-f-chat-av" aria-hidden="true">💬</span>
    <span><b>${esc(t("Assistenza", "Support"))}</b>${
      scritto
        ? `<em>${esc(t("ha risposto alle", "replied at"))} ${esc(orologio(scritto))}</em>`
        : ""
    }</span>
  </div>`;
  const mia = domanda
    ? `<div class="dm-f-chat-mia" data-dm-no-i18n>${esc(clean(domanda.testo))}${
        domanda.scrittoIl ? `<small>${esc(quandoEra(domanda.scrittoIl))}</small>` : ""
      }</div>`
    : "";
  const bolla = testo
    ? `<div class="dm-f-chat-bolla" data-dm-no-i18n>${esc(testo)}${
        scritto ? `<small>${esc(orologio(scritto))}</small>` : ""
      }</div>`
    : "";
  return `<div class="dm-f dm-f-assistenza">${chi}${mia}${bolla}
    <div class="dm-f-chat-rispondi">
      <input id="dm-w-chat-risposta" type="text" maxlength="4000" autocomplete="off" placeholder="${esc(
        t("Scrivi una risposta…", "Write a reply…"),
      )}" aria-label="${esc(t("Scrivi una risposta…", "Write a reply…"))}">
      <button type="button" data-dm-chat-rispondi aria-label="${esc(t("Invia", "Send"))}">➤</button>
    </div>
    <button type="button" class="dm-f-porta" data-dm-apri-chat>${esc(
      t("Apri tutta la conversazione", "Open the whole conversation"),
    )} <span aria-hidden="true">→</span></button></div>`;
}

const STILE_ASSISTENZA = `
${P} .dm-f-chat-chi{display:flex;align-items:center;gap:11px;margin:2px 2px 4px}
${P} .dm-f-chat-av{flex:0 0 auto;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:20px;
  background:color-mix(in srgb,var(--dm-widget-accent,#22c55e) 12%,var(--card-bg,#fff));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dm-widget-accent,#22c55e) 35%,transparent)}
${P} .dm-f-chat-chi b{display:block;font-size:14px;font-weight:850;color:var(--text,#0f172a)}
${P} .dm-f-chat-chi em{font-style:normal;font-size:12px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-chat-bolla{max-width:88%;padding:12px 14px;border-radius:20px 20px 20px 6px;font-size:14.5px;line-height:1.45;font-weight:500;white-space:pre-wrap;overflow-wrap:anywhere;
  color:var(--text,#0f172a);background:color-mix(in srgb,var(--dm-widget-accent,#22c55e) 8%,var(--card-bg,#fff));border:1px solid color-mix(in srgb,var(--dm-widget-accent,#22c55e) 30%,transparent)}
${P} .dm-f-chat-bolla small,${P} .dm-f-chat-mia small{display:block;margin-top:6px;font-size:11px;font-weight:800;color:var(--text-dim,#64748b)}
${P} .dm-f-chat-mia{margin-left:auto;max-width:80%;padding:10px 13px;border-radius:20px 20px 6px 20px;font-size:13px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere;
  background:color-mix(in srgb,var(--text-dim,#64748b) 10%,var(--card-bg,#fff));color:var(--text-dim,#475569)}
${P} .dm-f-chat-rispondi{display:flex;gap:8px;margin-top:6px}
${P} .dm-f-chat-rispondi input{flex:1;min-width:0;padding:14px 15px;border-radius:18px;font:inherit;font-size:14px;
  background:color-mix(in srgb,var(--text-dim,#64748b) 5%,var(--card-bg,#fff));border:1px solid var(--card-border,#e2e8f0);color:var(--text,#0f172a)}
${P} .dm-f-chat-rispondi button{flex:0 0 50px;border:0;border-radius:18px;background:var(--dm-widget-accent,#15803d);color:#fff;font-size:20px;cursor:pointer}
`;

/* ── la registrazione ────────────────────────────────────────────────── */

export const FINESTRE_SISTEMA = Object.freeze([
  "elettrodomestici",
  "cottura",
  "minipc",
  "macchine",
  "evidenza",
  "sezionimie",
  "segnalazioni",
  "assistenza",
]);

registraFinestra("elettrodomestici", {
  disegna: finestraElettrodomestici,
  stile: STILE_COMUNE + STILE_ELETTRODOMESTICI,
});
registraFinestra("cottura", { disegna: finestraCottura, stile: STILE_COTTURA });
registraFinestra("minipc", { disegna: finestraMinipc, stile: STILE_MINIPC });
registraFinestra("macchine", { disegna: finestraMacchine, stile: STILE_MACCHINE });
registraFinestra("evidenza", { disegna: finestraEvidenza, stile: STILE_EVIDENZE });
registraFinestra("sezionimie", { disegna: finestraSezioneMia });
registraFinestra("segnalazioni", { disegna: finestraSegnalazioni, stile: STILE_SEGNALAZIONI });
registraFinestra("assistenza", { disegna: finestraAssistenza, stile: STILE_ASSISTENZA });
