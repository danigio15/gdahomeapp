/* Le finestre dei widget del gruppo «proposti» (vedi `../finestre-dei-widget.js`).
 * Ogni finestra si registra con la chiave della sua tessera.
 *
 * Quattro tessere che aprivano la stessa finestra generica — «Le misure» a
 * caselle tutte uguali, coi nomi grezzi delle integrazioni («LEAPMOTOR B10
 * TIRE FR», «BOILER_OFFSET») — e adesso ne hanno una disegnata sul loro
 * mestiere, come nelle bozze approvate:
 *
 *   - Energia: quanto consuma la casa adesso, da dove arriva, le tre fonti, e
 *     i due numeri del giorno quando si possono contare davvero;
 *   - Temperatura: la media con la scala dalla piu' fredda alla piu' calda, e
 *     le stanze in fila dalla piu' calda;
 *   - Auto: l'anello della carica con l'autonomia, dove si trova, i
 *     chilometri, le quattro gomme attorno alla sagoma;
 *   - Solare termico: il pannello e il boiler con la differenza di gradi, una
 *     frase su cosa sta succedendo, e lo stato dei tasti dell'impianto.
 *
 * La regola di tutte: si mostra solo quello che la casa sa. Un numero che non
 * c'e' non si inventa — la sezione che lo conterrebbe non compare.
 */
import { registraFinestra } from "../finestre-dei-widget.js";
import { clean, esc, formatNumber, locale, t } from "../shared.js";
import { lEnergiaInParole, laPotenzaInParole } from "../../core/le-unita-della-corrente.js";
import { inKilowatt } from "../../core/il-tempo-della-ricarica.js";
import { roomGlyph } from "../../core/personalization-catalog.js";
import { disegnoDelCatalogo } from "../../core/catalogo-disegni.js";
import { AUTO_DALL_ALTO } from "../../core/auto-dallalto.js";
import { activeVehiclePhoto, resolveVehicleAsset } from "../ev-section.js";

const P = ":is(#dm-widget-popup,#dm-casa-popup,#dm-qa-popup)";

/** Un numero vero, o `null`: niente zeri inventati da un campo vuoto. */
function numero(valore) {
  if (valore === null || valore === undefined || valore === "") return null;
  const letto = Number(valore);
  return Number.isFinite(letto) ? letto : null;
}

/* Il numero e la sua unita' non si separano andando a capo: «146» da una
 * parte e «W» sotto, in una casella stretta, non si legge. */
const unito = (testo) => String(testo ?? "").replace(/ (?=\S+$)/, "\u00a0");
const watt = (valore) => unito(laPotenzaInParole(valore, { lingua: locale() }));
const kwh = (valore) => unito(lEnergiaInParole(valore, { lingua: locale() }));
const gradi = (valore) => `${formatNumber(valore, 1)}°`;
const titoletto = (testo) => `<h4 class="dm-w-titoletto">${esc(testo)}</h4>`;

/* Da quanto: «da 2 h», «da 35 min», «da 3 g». Corto apposta — sta sotto un
 * numero grande, in una casella larga mezzo telefono. */
function daQuanto(quando, adesso = Date.now()) {
  const inizio = numero(quando);
  if (inizio == null || inizio > adesso) return "";
  const minuti = Math.floor((adesso - inizio) / 60_000);
  if (minuti < 1) return t("da poco", "just now");
  const durata =
    minuti < 60
      ? `${minuti} min`
      : minuti < 48 * 60
        ? `${Math.floor(minuti / 60)} h`
        : `${Math.floor(minuti / 1440)} ${t("giorni", "days")}`;
  return `${t("Da", "For")} ${durata}`;
}

/* ── Energia ──────────────────────────────────────────────────────────── */

const COLORE_FONTE = Object.freeze({ solar: "#f59e0b", battery: "#16a34a", grid: "#6366f1" });

/**
 * Da dove arriva la corrente che la casa sta usando adesso, in percentuale.
 *
 * Il sole viene prima — e' gratis e se non si usa va in rete — poi la
 * batteria che si scarica, poi la rete per quello che manca. Si conta solo
 * quello che va IN CASA: il sole che carica la batteria o finisce in rete non
 * e' corrente che la casa sta usando. Senza il consumo di casa si ripiega
 * sulle tre fonti come stanno.
 */
export function daDoveArriva({ casa = null, sole = null, batteria = null, rete = null } = {}) {
  const presenti = [
    ["solar", sole],
    ["battery", batteria],
    ["grid", rete],
  ].filter(([, valore]) => valore != null);
  let resto = casa != null && casa > 0 ? casa : Number.POSITIVE_INFINITY;
  const quote = presenti.map(([fonte, valore]) => {
    const data = Math.min(Math.max(0, valore), resto);
    resto -= data;
    return [fonte, data];
  });
  const totale = quote.reduce((somma, [, valore]) => somma + valore, 0);
  if (!(totale > 0)) return [];
  return quote
    .filter(([, valore]) => valore > 0)
    .map(([fonte, valore]) => ({ fonte, quota: (valore / totale) * 100 }));
}

/** Quanto del sole di oggi e' rimasto in casa, o `null` se non si puo' dire. */
export function autoconsumoDiOggi(oggi = {}) {
  const prodotto = numero(oggi?.solar);
  const dato = numero(oggi?.gridExport);
  if (prodotto == null || dato == null || !(prodotto > 0)) return null;
  return Math.max(0, Math.min(100, ((prodotto - dato) / prodotto) * 100));
}

function nomeDellaFonte(fonte) {
  if (fonte === "solar") return t("Sole", "Sun");
  if (fonte === "battery") return t("Batteria", "Battery");
  return t("Rete", "Grid");
}

function disegnaEnergia(widget) {
  const righe = Array.isArray(widget?.rows) ? widget.rows : [];
  const di = (gruppo) => righe.find((riga) => riga?.group === gruppo) || null;
  const casa = numero(di("house")?.watts);
  const sole = numero(di("solar")?.watts);
  const rete = numero(di("grid")?.watts);
  const batteria = di("battery");
  const battW = numero(batteria?.watts);
  const soc = numero(batteria?.soc);
  const oggi = widget?.oggi || {};
  const casaOggi = numero(oggi.house ?? widget?.today);

  const quote = daDoveArriva({ casa, sole, batteria: battW, rete });
  const barra = quote.length
    ? `<div class="dm-f-energia-barra" role="img" aria-label="${esc(
        quote.map((q) => `${nomeDellaFonte(q.fonte)} ${Math.round(q.quota)}%`).join(", "),
      )}">${quote
        .map(
          (q) =>
            `<i style="width:${q.quota.toFixed(1)}%;background:${COLORE_FONTE[q.fonte]}"></i>`,
        )
        .join("")}</div>
      <div class="dm-f-energia-leg">${quote
        .map(
          (q) =>
            `<span><b style="background:${COLORE_FONTE[q.fonte]}"></b>${esc(
              nomeDellaFonte(q.fonte),
            )} ${Math.round(q.quota)}%</span>`,
        )
        .join("")}</div>`
    : "";
  const eroe =
    casa != null
      ? `<section class="dm-f-energia-eroe">
        <small>${esc(t("La casa adesso", "The house now"))}</small>
        <div class="dm-f-energia-riga">
          <span class="dm-f-num dm-f-energia-casa">${esc(watt(casa))}</span>
          ${
            casaOggi != null
              ? `<span class="dm-f-energia-oggi">${esc(t("oggi", "today"))} ${esc(kwh(casaOggi))}</span>`
              : ""
          }
        </div>
        ${barra}
      </section>`
      : "";

  const fonti = [];
  if (sole != null)
    fonti.push(`<div class="dm-f-energia-fonte" data-fonte="solar">
        <span class="dm-f-energia-ic" aria-hidden="true">☀️</span>
        <span class="dm-f-num">${esc(watt(sole))}</span>
        <span class="dm-f-energia-nome">${esc(t("Solare", "Solar"))}</span>
        ${
          numero(oggi.solar) != null
            ? `<span class="dm-f-energia-sotto">${esc(t("oggi", "today"))} ${esc(kwh(oggi.solar))}</span>`
            : ""
        }
      </div>`);
  if (rete != null) {
    const preso = numero(oggi.gridImport);
    const dato = numero(oggi.gridExport);
    const delGiorno = [
      preso != null
        ? `<span class="dm-f-giu" title="${esc(t("Prelevata oggi", "Imported today"))}">↓ ${esc(formatNumber(preso, 1))}</span>`
        : "",
      dato != null
        ? `<span class="dm-f-su" title="${esc(t("Immessa oggi", "Exported today"))}">↑ ${esc(formatNumber(dato, 1))}</span>`
        : "",
    ].filter(Boolean);
    const verso =
      rete > 10 ? t("Prelevata oggi", "Imported today") : rete < -10 ? t("Immessa oggi", "Exported today") : "";
    fonti.push(`<div class="dm-f-energia-fonte" data-fonte="grid">
        <span class="dm-f-energia-ic" aria-hidden="true">🔌</span>
        <span class="dm-f-num">${esc(watt(Math.abs(rete)))}</span>
        <span class="dm-f-energia-nome">${esc(t("Rete", "Grid"))}</span>
        ${
          delGiorno.length
            ? `<span class="dm-f-energia-sotto">${delGiorno.join(" · ")} kWh</span>`
            : verso
              ? `<span class="dm-f-energia-sotto">${esc(verso)}</span>`
              : ""
        }
      </div>`);
  }
  if (batteria) {
    const piena = soc == null ? null : Math.max(0, Math.min(100, Math.round(soc)));
    const come =
      battW == null
        ? ""
        : battW > 10
          ? `${t("scarica", "discharging")} ${watt(battW)}`
          : battW < -10
            ? `${t("in carica", "charging")} ${watt(-battW)}`
            : t("ferma", "idle");
    /* Il giorno della batteria, coi versi della rete: ↓ e' quello che e'
     * venuto in casa (la scarica), ↑ quello che ne e' uscito (la carica). */
    const scaricata = numero(oggi.batteryDischarged);
    const caricata = numero(oggi.batteryCharged);
    const verso = [
      scaricata != null
        ? `<span class="dm-f-giu" title="${esc(t("Scaricata oggi", "Discharged today"))}">↓ ${esc(formatNumber(scaricata, 1))}</span>`
        : "",
      caricata != null
        ? `<span class="dm-f-su" title="${esc(t("Caricata oggi", "Charged today"))}">↑ ${esc(formatNumber(caricata, 1))}</span>`
        : "",
    ].filter(Boolean);
    fonti.push(`<div class="dm-f-energia-fonte" data-fonte="battery">
        <div class="dm-f-energia-bat">
          <span class="dm-f-energia-ic" aria-hidden="true">🔋</span>
          ${piena != null ? `<span class="dm-f-anello" style="--p:${piena}" aria-hidden="true"></span>` : ""}
        </div>
        <span class="dm-f-num">${esc(piena != null ? `${piena}%` : watt(Math.abs(battW ?? 0)))}</span>
        <span class="dm-f-energia-nome">${esc(t("Batteria", "Battery"))}</span>
        ${come ? `<span class="dm-f-energia-sotto">${esc(come)}</span>` : ""}
        ${
          verso.length
            ? `<span class="dm-f-energia-sotto">${verso.join(" · ")} kWh</span>`
            : ""
        }
      </div>`);
  }

  /* I due numeri del giorno, solo se si possono contare: l'autoconsumo con la
   * produzione e l'immissione di oggi, la spesa col prelievo di oggi e un
   * prezzo che qualcuno ha scritto. */
  const delGiorno = [];
  const autoconsumo = autoconsumoDiOggi(oggi);
  if (autoconsumo != null)
    delGiorno.push(
      `<div><small>${esc(t("Autoconsumo", "Self-consumption"))}</small><span class="dm-f-num">${Math.round(autoconsumo)}%</span></div>`,
    );
  const prezzo = numero(widget?.prezzoKwh);
  const preso = numero(oggi.gridImport);
  if (prezzo != null && prezzo > 0 && preso != null)
    delGiorno.push(
      `<div><small>${esc(t("Spesa stimata", "Estimated cost"))}</small><span class="dm-f-num">${esc(
        formatNumber(preso * prezzo, 2),
      )} €</span></div>`,
    );

  return `<div class="dm-f dm-f-energia">
    ${eroe}
    ${
      fonti.length
        ? `${titoletto(t("Le fonti, adesso", "The sources, now"))}<div class="dm-f-energia-fonti">${fonti.join("")}</div>`
        : ""
    }
    ${
      delGiorno.length
        ? `${titoletto(t("Oggi", "Today"))}<div class="dm-f-energia-giorno">${delGiorno.join("")}</div>`
        : ""
    }
  </div>`;
}

const STILE_ENERGIA = `
${P} .dm-f{display:grid;gap:0;min-width:0}
${P} .dm-f-num{font-family:'Oswald','Inter',sans-serif;font-weight:600;font-variant-numeric:tabular-nums;
  color:var(--text,#0f172a);line-height:1.05}
${P} .dm-f-anello{--p:0;flex:0 0 auto;width:40px;height:40px;border-radius:50%;
  background:conic-gradient(#16a34a calc(var(--p)*1%),color-mix(in srgb,var(--text-dim,#94a3b8) 25%,transparent) 0);
  -webkit-mask:radial-gradient(circle,transparent 15px,#000 16px);mask:radial-gradient(circle,transparent 15px,#000 16px)}
${P} .dm-f-giu{color:#dc2626}
${P} .dm-f-su{color:#16a34a}
${P} .dm-f-energia-eroe{border-radius:22px;padding:16px;
  background:linear-gradient(155deg,color-mix(in srgb,var(--dm-widget-accent,#f97316) 9%,var(--card-bg,#fff)),
    color-mix(in srgb,var(--dm-widget-accent,#f97316) 16%,var(--card-bg,#fff)));
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#f97316) 30%,transparent)}
${P} .dm-f-energia-eroe small{display:block;font-size:10.5px;font-weight:900;letter-spacing:.12em;
  text-transform:uppercase;color:color-mix(in srgb,var(--dm-widget-accent,#f97316) 75%,var(--text,#0f172a))}
${P} .dm-f-energia-riga{display:flex;flex-wrap:wrap;align-items:flex-end;gap:4px 10px;margin-top:4px}
${P} .dm-f-energia-casa{font-size:44px}
${P} .dm-f-energia-oggi{font-size:13px;font-weight:750;margin-bottom:5px;
  color:color-mix(in srgb,var(--dm-widget-accent,#f97316) 75%,var(--text,#0f172a))}
${P} .dm-f-energia-barra{display:flex;height:12px;border-radius:999px;overflow:hidden;margin:14px 0 8px;
  background:color-mix(in srgb,var(--dm-widget-accent,#f97316) 14%,transparent)}
${P} .dm-f-energia-barra i{display:block;height:100%}
${P} .dm-f-energia-leg{display:flex;gap:6px 12px;flex-wrap:wrap;font-size:12px;font-weight:750;color:var(--text-dim,#475569)}
${P} .dm-f-energia-leg span{display:inline-flex;align-items:center;gap:6px}
${P} .dm-f-energia-leg b{width:9px;height:9px;border-radius:50%}
${P} .dm-f-energia-fonti{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px}
${P} .dm-f-energia-fonte{display:flex;flex-direction:column;min-width:0;border-radius:18px;padding:12px 11px;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);
  box-shadow:0 12px 24px -22px rgba(15,23,42,.6)}
${P} .dm-f-energia-ic{font-size:19px;line-height:1}
${P} .dm-f-energia-fonte .dm-f-num{font-size:23px;margin-top:8px;white-space:nowrap}
${P} .dm-f-energia-nome{margin-top:4px;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;
  color:var(--text-dim,#64748b)}
${P} .dm-f-energia-sotto{margin-top:3px;font-size:11.5px;font-weight:750;line-height:1.35;color:var(--text-dim,#64748b)}
${P} .dm-f-energia-bat{display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:40px}
${P} .dm-f-energia-fonte[data-fonte="battery"] .dm-f-num{margin-top:0}
${P} .dm-f-energia-giorno{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
${P} .dm-f-energia-giorno div{border-radius:16px;padding:11px 13px;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 8%,var(--card-bg,#fff));border:1px solid var(--card-border,#e2e8f0)}
${P} .dm-f-energia-giorno small{display:block;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;
  color:var(--text-dim,#64748b)}
${P} .dm-f-energia-giorno .dm-f-num{display:block;margin-top:3px;font-size:22px}
`;

/* ── Temperatura ──────────────────────────────────────────────────────── */

/* Il colore di una stanza, sulla scala del comfort e non sulla posizione in
 * classifica: 18° e' fresco anche se e' la stanza piu' calda di casa. Chi
 * legge in Fahrenheit ha numeri sopra i quaranta, e per il colore si
 * riportano in Celsius. */
export function coloreDeiGradi(valore, fahrenheit = false) {
  const c = fahrenheit ? ((valore - 32) * 5) / 9 : valore;
  if (c < 19) return "#38bdf8";
  if (c < 21) return "#22c55e";
  if (c < 24) return "#a3e635";
  if (c < 25) return "#f59e0b";
  return "#ef4444";
}

function disegnaTemperatura(widget) {
  const stanze = (Array.isArray(widget?.rows) ? widget.rows : [])
    .filter((riga) => numero(riga?.temperature) != null)
    .map((riga) => ({ ...riga, temperature: Number(riga.temperature) }))
    .sort((a, b) => b.temperature - a.temperature);
  if (!stanze.length) return `<p class="dm-w-empty">${esc(t("Nessuna lettura", "No reading"))}</p>`;
  const media = stanze.reduce((somma, riga) => somma + riga.temperature, 0) / stanze.length;
  const calda = stanze[0];
  const fredda = stanze[stanze.length - 1];
  const fahrenheit = media > 45;
  const ampiezza = calda.temperature - fredda.temperature;
  const scala =
    stanze.length > 1 && ampiezza > 0
      ? `<div class="dm-f-temperatura-scala">
          <i aria-hidden="true"></i>
          <span><b>${esc(gradi(fredda.temperature))} ${esc(fredda.name)}</b><b>${esc(
            gradi(calda.temperature),
          )} ${esc(calda.name)}</b></span>
        </div>`
      : "";
  const eroe = `<section class="dm-f-temperatura-eroe">
      <div><small>${esc(stanze.length > 1 ? t("In casa", "At home") : stanze[0].name)}</small>
        <span class="dm-f-num">${esc(gradi(media))}</span></div>
      ${scala}
    </section>`;
  const elenco = stanze
    .map((riga) => {
      const larga = ampiezza > 0 ? 10 + (90 * (riga.temperature - fredda.temperature)) / ampiezza : 60;
      const umidita = numero(riga.humidity);
      return `<div class="dm-f-temperatura-stanza">
        <span class="dm-f-temperatura-ic" aria-hidden="true">${esc(roomGlyph(riga.icon || riga.name))}</span>
        <span class="dm-f-temperatura-nome"><b>${esc(riga.name)}</b><i style="--w:${larga.toFixed(
          0,
        )}%;--c:${coloreDeiGradi(riga.temperature, fahrenheit)}"></i></span>
        <span class="dm-f-temperatura-val"><span class="dm-f-num">${esc(gradi(riga.temperature))}</span>${
          umidita != null
            ? `<span class="dm-f-temperatura-um"${umidita > 65 ? ' data-alta="true"' : ""}>💧 ${Math.round(umidita)}%</span>`
            : ""
        }</span>
      </div>`;
    })
    .join("");
  return `<div class="dm-f dm-f-temperatura">
    ${eroe}
    ${stanze.length > 1 ? titoletto(t("Dalla più calda", "Warmest first")) : ""}
    <div class="dm-f-temperatura-elenco">${elenco}</div>
  </div>`;
}

const STILE_TEMPERATURA = `
${P} .dm-f-temperatura-eroe{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;border-radius:22px;padding:15px 17px;
  background:linear-gradient(155deg,color-mix(in srgb,#f97316 7%,var(--card-bg,#fff)),
    color-mix(in srgb,var(--dm-widget-accent,#ef4444) 9%,var(--card-bg,#fff)));
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#ef4444) 22%,transparent)}
${P} .dm-f-temperatura-eroe small{display:block;font-size:10.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;
  color:color-mix(in srgb,var(--dm-widget-accent,#ef4444) 70%,var(--text,#0f172a))}
${P} .dm-f-temperatura-eroe .dm-f-num{font-size:44px}
${P} .dm-f-temperatura-scala{flex:1 1 150px;min-width:0}
${P} .dm-f-temperatura-scala i{display:block;height:10px;border-radius:999px;margin:4px 0 6px;
  background:linear-gradient(90deg,#38bdf8,#a3e635,#f59e0b,#ef4444)}
${P} .dm-f-temperatura-scala span{display:flex;justify-content:space-between;gap:10px;font-size:12px;font-weight:800;
  color:var(--text-dim,#475569)}
${P} .dm-f-temperatura-scala b{font-weight:800;min-width:0;overflow-wrap:anywhere}
${P} .dm-f-temperatura-scala b:last-child{text-align:right}
${P} .dm-f-temperatura-elenco{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:8px}
${P} .dm-f-temperatura-stanza{display:flex;align-items:center;gap:12px;min-width:0;padding:10px 12px;border-radius:18px;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
${P} .dm-f-temperatura-ic{flex:0 0 40px;width:40px;height:40px;border-radius:13px;display:grid;place-items:center;font-size:19px;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 9%,var(--card-bg,#fff));box-shadow:inset 0 0 0 1px var(--card-border,#eef2f7)}
${P} .dm-f-temperatura-nome{flex:1;min-width:0}
${P} .dm-f-temperatura-nome b{display:block;font-size:14px;font-weight:850;color:var(--text,#0f172a);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${P} .dm-f-temperatura-nome i{display:block;height:6px;border-radius:999px;margin-top:7px;position:relative;overflow:hidden;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 16%,transparent)}
${P} .dm-f-temperatura-nome i::after{content:"";position:absolute;inset:0 auto 0 0;width:var(--w);border-radius:999px;background:var(--c)}
${P} .dm-f-temperatura-val{flex:0 0 auto;text-align:right}
${P} .dm-f-temperatura-val .dm-f-num{display:block;font-size:22px;line-height:1}
${P} .dm-f-temperatura-um{display:block;margin-top:3px;font-size:11.5px;font-weight:800;color:#0284c7}
${P} .dm-f-temperatura-um[data-alta="true"]{color:#d97706}
`;

/* ── Auto ─────────────────────────────────────────────────────────────── */

/* Le parole di ogni casella dell'auto, per chi non ha un nome che si legge.
 * Il nome dell'entita' l'ha scritto l'integrazione — «LEAPMOTOR B10 ODOMETER»
 * — e in una finestra non ci va. */
const NOMI_EV = Object.freeze({
  "dm.ev_potenza_wallbox": () => t("Potenza", "Power"),
  "dm.ev_energia_wallbox_oggi": () => t("Oggi", "Today"),
  "dm.ev_energia_wallbox_mese": () => t("Questo mese", "This month"),
  "dm.ev_tensione_wallbox": () => t("Tensione", "Voltage"),
  "dm.ev_temperatura_wallbox": () => t("Temperatura", "Temperature"),
  "dm.ev_cavo_collegato": () => t("Cavo", "Cable"),
  "dm.ev_modalita_ricarica_evcc": () => t("Modalità", "Mode"),
  "dm.ev_energia_sessione": () => t("Questa ricarica", "This charge"),
  "dm.ev_percentuale_solare_sessione": () => t("Dal sole", "From the sun"),
  "dm.ev_temperatura_esterna": () => t("Fuori", "Outside"),
  "dm.ev_temperatura_olio": () => t("Olio", "Oil"),
  "dm.ev_batteria_servizio": () => t("Batteria 12 V", "12 V battery"),
  "dm.ev_ultimo_viaggio": () => t("Ultimo viaggio", "Last trip"),
  "dm.ev_carburante_totale": () => t("Carburante", "Fuel"),
  "dm.ev_allarme": () => t("Allarme", "Alarm"),
  "dm.ev_pneumatici": () => t("Pneumatici", "Tyres"),
  "dm.ev_portiere": () => t("Portiere", "Doors"),
  "dm.ev_finestrini": () => t("Finestrini", "Windows"),
  "dm.ev_bagagliaio": () => t("Bagagliaio", "Boot"),
  "dm.ev_cofano": () => t("Cofano", "Bonnet"),
  "dm.ev_motore": () => t("Motore", "Engine"),
  "dm.ev_km_dall_ultima_ricarica": () => t("Dall'ultima carica", "Since last charge"),
});

/* Le caselle che la finestra dice gia' altrove — nell'anello, nel chip della
 * ricarica, fra le gomme, in «Dov'e'» — e che in fondo sarebbero doppioni. */
const GIA_DETTE = new Set([
  "dm.ev_target_soc",
  "dm.ev_potenza_ricarica",
  "dm.ev_charge_power",
  "dm.ev_posizione",
  "dm.ev_odometro",
  "dm.ev_km_dall_ultima_ricarica",
]);

/* Le aperture: dette solo quando sono aperte. «Finestrino 0 %» e
 * «Portiere chiuse» sono la normalita', e in una finestra larga un palmo
 * spingono giu' quello che conta. */
const APERTURE = /^dm\.ev_(finestrini|portiere|bagagliaio|cofano)$/;
const PAROLE_APERTURE =
  /\b(windows?|finestrin\w*|doors?|portier\w*|trunk|boot|bagagliai\w*|hood|bonnet|cofano)\b/;
const CHIUSO = /^(off|false|closed|chiusa|chiuso|chiuse|locked|bloccat[aoe]|0)$/i;

function eChiusa(riga) {
  const grezzo = clean(riga?.stato);
  if (riga?.on === false) return true;
  if (grezzo && CHIUSO.test(grezzo)) return true;
  const valore = numero(riga?.raw);
  return valore != null && valore === 0;
}

/* Quale ruota dice una casella, dal riferimento o dal nome: «ant_sx»,
 * «tire_fl», «front left», «posteriore destro». Chi non si riconosce non va
 * attorno alla sagoma: una gomma messa al posto sbagliato e' peggio di una
 * gomma in elenco. */
const RUOTE = Object.freeze({
  "dm.ev_pneumatico_ant_sx": "fl",
  "dm.ev_pneumatico_ant_dx": "fr",
  "dm.ev_pneumatico_post_sx": "rl",
  "dm.ev_pneumatico_post_dx": "rr",
});

export function ruotaDellaRiga(riga) {
  const rif = clean(riga?.rif);
  if (RUOTE[rif]) return RUOTE[rif];
  const testo = ` ${`${rif} ${clean(riga?.entity)} ${clean(riga?.name)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")} `;
  if (!/ (tire|tires|tyre|tyres|pneumatic\w*|gomm\w*|wheel\w*|ruot\w*) /.test(testo)) return "";
  const corta = testo.match(/ (fl|fr|rl|rr|lf|rf|lr) /)?.[1];
  if (corta) return { lf: "fl", rf: "fr", lr: "rl" }[corta] || corta;
  const davanti = / (ant\w*|front|anteriore) /.test(testo);
  const dietro = / (post\w*|rear|back|posteriore) /.test(testo);
  const sinistra = / (sx|left|sinistr\w*) /.test(testo);
  const destra = / (dx|right|destr\w*) /.test(testo);
  if (davanti === dietro || sinistra === destra) return "";
  return `${davanti ? "f" : "r"}${sinistra ? "l" : "r"}`;
}

/* Il nome di una casella senza il nome dell'auto davanti: dentro la finestra
 * dell'auto, «Leapmotor B10 · Temperatura» dice due volte di chi e'. */
function nomeSenzaAuto(riga) {
  const parole = NOMI_EV[clean(riga?.rif)];
  if (parole) return parole();
  let nome = clean(riga?.name);
  const auto = clean(riga?.vettura);
  if (auto && nome.toLowerCase().startsWith(auto.toLowerCase()))
    nome = nome.slice(auto.length).replace(/^[\s·:–-]+/, "");
  return nome || clean(riga?.name);
}

function casella(nome, valore, sotto = "", disegno = "") {
  const testo = `<small>${esc(nome)}</small><span class="dm-f-num">${valore}</span>${
    sotto ? `<em>${esc(sotto)}</em>` : ""
  }`;
  /* Col disegno davanti, quando la casella ne ha uno: «metti un'icona vicino
   * alle cose, non lasciare solo testo». */
  return disegno
    ? `<div class="dm-f-ev-cas dm-f-ev-cas-ic"><span class="dm-f-ev-cas-dis" aria-hidden="true">${disegnoDelCatalogo(disegno, 30)}</span><span>${testo}</span></div>`
    : `<div class="dm-f-ev-cas">${testo}</div>`;
}

function disegnaUnAuto(vettura, righe, conNome) {
  const percentuale = numero(vettura.percentuale);
  const km = numero(vettura.km);
  const target = numero(vettura.target);
  const kw = vettura.inCarica ? inKilowatt(vettura.kw) : null;
  const chip = vettura.ricarica
    ? `<span class="dm-f-ev-chip" data-carica="${vettura.inCarica ? "true" : "false"}"><i aria-hidden="true"></i>${esc(
        [
          vettura.ricarica,
          kw != null && kw > 0 ? `${formatNumber(kw, 1)} kW` : "",
          /* «4H 40M» e' la scrittura della tessera, in maiuscolo come tutta
           * la sua didascalia; in mezzo a una frase si scrive piano. */
          clean(vettura.fine)
            .replace(/(\d)H\b/g, "$1\u00a0h")
            .replace(/(\d)M\b/g, "$1\u00a0min"),
        ]
          .filter(Boolean)
          .join(" · "),
      )}</span>`
    : "";
  const sottoKm = [
    km != null ? t("di autonomia", "of range") : "",
    target != null ? `${t("traguardo", "target")}\u00a0${Math.round(target)}%` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const anello =
    percentuale != null
      ? `<div class="dm-f-ev-anello" style="--p:${Math.round(percentuale)}" role="img" aria-label="${esc(
          `${vettura.carburante ? t("Carburante", "Fuel") : t("Carica", "Charge")} ${Math.round(percentuale)}%`,
        )}"><div><span class="dm-f-num">${Math.round(percentuale)}%</span><small>${esc(
          vettura.carburante ? t("Carburante", "Fuel") : t("Carica", "Charge"),
        )}</small></div></div>`
      : "";
  /* «Auto: deve uscire l'immagine collegata alla sezione.» In cima la foto
   * della vettura come la mostra la sezione Auto — quella «in carica» col
   * cavo attaccato — con sopra lo stato della ricarica e il nome; sotto, la
   * carica e i chilometri grandi, la barra fino al traguardo, e le misure
   * della ricarica con il loro disegno. Senza una foto resta l'anello di
   * prima: e' meglio di un'auto disegnata a rettangoli. */
  let foto = "";
  try {
    foto = resolveVehicleAsset(vettura.foto || (conNome ? "" : activeVehiclePhoto()));
  } catch (_errore) {
    foto = "";
  }
  const misure = [
    kw != null && kw > 0 ? ["power", `${formatNumber(kw, 1)} kW`, t("potenza ora", "power now")] : null,
    clean(vettura.fine)
      ? [
          "timer",
          clean(vettura.fine)
            .replace(/(\d)H\b/g, "$1\u00a0h")
            .replace(/(\d)M\b/g, "$1\u00a0min"),
          t("alla fine", "to go"),
        ]
      : null,
  ].filter(Boolean);
  const misureMarkup = misure.length
    ? `<div class="dm-f-ev-misure">${misure
        .map(
          ([disegno, valore, cosa]) =>
            `<span>${disegnoDelCatalogo(disegno, 28)}<span><b class="dm-f-num">${esc(valore)}</b><small>${esc(cosa)}</small></span></span>`,
        )
        .join("")}</div>`
    : "";
  const barra =
    percentuale != null
      ? `<span class="dm-f-ev-barra" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, Math.round(percentuale)))}%"></i>${
          target != null ? `<u style="left:${Math.max(0, Math.min(100, Math.round(target)))}%"></u>` : ""
        }</span>`
      : "";
  const eroe = foto
    ? `<section class="dm-f-ev-vetrina">
      <div class="dm-f-ev-foto"><img src="${esc(foto)}" alt="" loading="lazy" decoding="async">
        ${chip}${vettura.nome ? `<span class="dm-f-ev-targa">${esc(vettura.nome)}</span>` : ""}</div>
      <div class="dm-f-ev-numeri">
        <div class="dm-f-ev-riga">
          ${percentuale != null ? `<span class="dm-f-num dm-f-ev-pct">${Math.round(percentuale)}<small>%</small></span>` : "<span></span>"}
          ${km != null ? `<span class="dm-f-ev-km"><b class="dm-f-num">${esc(formatNumber(km, 0))} km</b><small>${esc(sottoKm)}</small></span>` : ""}
        </div>
        ${barra}
        ${misureMarkup}
      </div>
    </section>`
    : `<section class="dm-f-ev-eroe">
      ${anello}
      <div class="dm-f-ev-dx">
        ${vettura.nome ? `<b>${esc(vettura.nome)}</b>` : ""}
        ${km != null ? `<span class="dm-f-num">${esc(formatNumber(km, 0))} km</span>` : ""}
        ${sottoKm ? `<span class="dm-f-ev-sotto">${esc(sottoKm)}</span>` : ""}
        ${chip}
      </div>
    </section>`;

  const daRif = (rif) => righe.find((riga) => riga.rif === rif) || null;
  const posizione = daRif("dm.ev_posizione");
  const contachilometri = daRif("dm.ev_odometro");
  const dallaCarica = daRif("dm.ev_km_dall_ultima_ricarica");
  const dove = [];
  if (posizione) {
    const aCasa = /^home$/i.test(clean(posizione.stato));
    dove.push(
      casella(
        t("Posizione", "Location"),
        esc(posizione.value),
        daQuanto(posizione.daQuando),
        aCasa ? "home" : "globe",
      ),
    );
  }
  if (contachilometri)
    dove.push(
      casella(
        t("Contachilometri", "Odometer"),
        esc(contachilometri.value),
        dallaCarica ? `${dallaCarica.value} ${t("dall'ultima carica", "since the last charge")}` : "",
        "gauge",
      ),
    );
  else if (dallaCarica) dove.push(casella(nomeSenzaAuto(dallaCarica), esc(dallaCarica.value)));

  const ruote = {};
  for (const riga of righe) {
    if (numero(riga.raw) == null) continue;
    const quale = ruotaDellaRiga(riga);
    if (quale && !ruote[quale]) ruote[quale] = riga;
  }
  const gomma = (quale, nome) =>
    ruote[quale]
      ? `<span class="dm-f-ev-g">${esc(nome)}<span class="dm-f-num">${esc(ruote[quale].value)}</span></span>`
      : `<span class="dm-f-ev-g" aria-hidden="true"></span>`;
  const gomme = Object.keys(ruote).length
    ? `${titoletto(t("Le gomme", "The tyres"))}<div class="dm-f-ev-gomme">
        <div class="dm-f-ev-col">${gomma("fl", t("Ant. sx", "Front L"))}${gomma("rl", t("Post. sx", "Rear L"))}</div>
        <img class="dm-f-ev-dallalto" src="${AUTO_DALL_ALTO}" alt="" aria-hidden="true">
        <div class="dm-f-ev-col dm-f-ev-col-dx">${gomma("fr", t("Ant. dx", "Front R"))}${gomma("rr", t("Post. dx", "Rear R"))}</div>
      </div>`
    : "";

  const usate = new Set(Object.values(ruote));
  const altre = righe.filter((riga) => {
    if (usate.has(riga)) return false;
    const rif = clean(riga.rif);
    if (GIA_DETTE.has(rif)) return false;
    if (riga.ruolo === "motore" && riga.on !== true) return false;
    const eApertura =
      APERTURE.test(rif) ||
      (!rif.startsWith("dm.") && PAROLE_APERTURE.test(clean(riga.name).toLowerCase()));
    if (eApertura && eChiusa(riga)) return false;
    return Boolean(clean(riga.value));
  });
  const altreMarkup = altre.length
    ? `${titoletto(t("Le altre letture", "Other readings"))}<div class="dm-f-ev-due">${altre
        .map((riga) => casella(nomeSenzaAuto(riga), esc(riga.value)))
        .join("")}</div>`
    : "";

  return `<div class="dm-f-ev-auto"${conNome ? ` data-auto="${esc(vettura.nome)}"` : ""}>
    ${eroe}
    ${dove.length ? `${titoletto(t("Dov'è e quanto ha fatto", "Where it is and how far it went"))}<div class="dm-f-ev-due">${dove.join("")}</div>` : ""}
    ${gomme}
    ${altreMarkup}
  </div>`;
}

function disegnaEv(widget) {
  const righe = Array.isArray(widget?.rows) ? widget.rows : [];
  const vetture = Array.isArray(widget?.vetture) ? widget.vetture : [];
  const piu = vetture.length > 1;
  /* Le tre righe di testa sono gia' nell'anello e nel chip: qui restano le
   * caselle, divise per auto. Quelle della colonnina sono della casa. */
  const caselle = righe.filter((riga) => !["carica", "autonomia", "ricarica"].includes(riga?.ruolo));
  const dellAuto = (nome) =>
    caselle.filter((riga) => !riga.diCasa && (!piu || clean(riga.vettura) === clean(nome)));
  const auto = vetture.length
    ? vetture.map((vettura) => disegnaUnAuto(vettura, dellAuto(vettura.nome), piu)).join("")
    : "";
  const wallbox = caselle.filter((riga) => riga.diCasa && clean(riga.value));
  const wallboxMarkup = wallbox.length
    ? `${titoletto(t("La wallbox", "The wallbox"))}<div class="dm-f-ev-due">${wallbox
        .map((riga) => casella(nomeSenzaAuto(riga), esc(riga.value)))
        .join("")}</div>`
    : "";
  return `<div class="dm-f dm-f-ev">${auto}${wallboxMarkup}</div>`;
}

const STILE_EV = `
${P} .dm-f-ev-auto{display:grid;min-width:0}
${P} .dm-f-ev-auto + .dm-f-ev-auto{margin-top:18px}
${P} .dm-f-ev-eroe{display:flex;gap:16px;align-items:center;border-radius:24px;padding:16px;
  background:linear-gradient(160deg,color-mix(in srgb,var(--dm-widget-accent,#06b6d4) 8%,var(--card-bg,#fff)),
    color-mix(in srgb,#0ea5e9 12%,var(--card-bg,#fff)));
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#06b6d4) 28%,transparent)}
${P} .dm-f-ev-anello{--p:0;flex:0 0 108px;width:108px;height:108px;border-radius:50%;position:relative;display:grid;place-items:center;
  background:conic-gradient(#16a34a calc(var(--p)*1%),color-mix(in srgb,var(--text-dim,#94a3b8) 25%,transparent) 0)}
${P} .dm-f-ev-anello::after{content:"";position:absolute;inset:11px;border-radius:50%;
  background:color-mix(in srgb,var(--dm-widget-accent,#06b6d4) 5%,var(--card-bg,#fff))}
${P} .dm-f-ev-anello div{position:relative;z-index:1;text-align:center}
${P} .dm-f-ev-anello .dm-f-num{display:block;font-size:32px}
${P} .dm-f-ev-anello small{display:block;font-size:9.5px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim,#64748b)}
${P} .dm-f-ev-dx{display:flex;flex-direction:column;align-items:flex-start;min-width:0;gap:2px}
${P} .dm-f-ev-dx b{font-size:16px;font-weight:850;color:var(--text,#0f172a);overflow-wrap:anywhere}
${P} .dm-f-ev-dx .dm-f-num{font-size:30px}
${P} .dm-f-ev-sotto{font-size:12px;font-weight:750;line-height:1.4;color:var(--text-dim,#64748b)}
${P} .dm-f-ev-chip{display:inline-flex;align-items:center;gap:7px;margin-top:6px;padding:6px 11px;border-radius:999px;
  font-size:12px;font-weight:850;line-height:1.25;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 14%,transparent);color:var(--text-dim,#475569)}
${P} .dm-f-ev-chip i{flex:0 0 8px;width:8px;height:8px;border-radius:50%;background:currentColor}
${P} .dm-f-ev-chip[data-carica="true"]{background:color-mix(in srgb,#16a34a 16%,transparent);color:#15803d}
${P} .dm-f-ev-chip[data-carica="true"] i{background:#16a34a;box-shadow:0 0 0 4px rgba(22,163,74,.2)}
${P} .dm-f-ev-due{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr));gap:8px}
${P} .dm-f-ev-cas{display:flex;flex-direction:column;min-width:0;border-radius:18px;padding:12px 13px;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
${P} .dm-f-ev-cas small{font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim,#64748b)}
${P} .dm-f-ev-cas .dm-f-num{margin-top:4px;font-size:22px;overflow-wrap:anywhere}
${P} .dm-f-ev-cas em{margin-top:3px;font-style:normal;font-size:11.5px;font-weight:750;line-height:1.4;color:var(--text-dim,#64748b)}
${P} .dm-f-ev-gomme{display:grid;grid-template-columns:1fr 84px 1fr;align-items:center;gap:8px;border-radius:22px;padding:14px;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0)}
${P} .dm-f-ev-col{display:grid;gap:44px;min-width:0}
${P} .dm-f-ev-col-dx{text-align:right}
${P} .dm-f-ev-g{min-height:40px;font-size:12px;font-weight:800;color:var(--text-dim,#64748b)}
${P} .dm-f-ev-g .dm-f-num{display:block;font-size:20px}
${P} .dm-f-ev-cas-ic{flex-direction:row;align-items:center;gap:12px}
${P} .dm-f-ev-cas-ic>span:last-child{display:flex;flex-direction:column;min-width:0}
${P} .dm-f-ev-cas-dis{flex:0 0 auto;width:46px;height:46px;border-radius:14px;display:grid;place-items:center;
  background:color-mix(in srgb,#16a34a 9%,var(--card-bg,#fff))}
${P} .dm-f-ev-dallalto{display:block;width:72px;height:auto;margin:auto;filter:drop-shadow(0 8px 12px rgba(15,23,42,.22))}
${P} .dm-f-ev-vetrina{border-radius:24px;overflow:hidden;background:var(--card-bg,#fff);
  border:1px solid color-mix(in srgb,#16a34a 28%,transparent)}
${P} .dm-f-ev-foto{position:relative;height:190px;display:grid;place-items:center;overflow:hidden;
  background:radial-gradient(120% 100% at 50% 100%,color-mix(in srgb,var(--text-dim,#94a3b8) 18%,var(--card-bg,#fff)),var(--card-bg,#fff) 70%)}
${P} .dm-f-ev-foto img{max-width:92%;max-height:176px;object-fit:contain;filter:drop-shadow(0 14px 18px rgba(15,23,42,.18))}
${P} .dm-f-ev-foto .dm-f-ev-chip{position:absolute;left:12px;top:12px;margin:0}
${P} .dm-f-ev-targa{position:absolute;right:12px;top:12px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:850;
  background:rgba(15,23,42,.72);color:#fff;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${P} .dm-f-ev-numeri{padding:12px 16px 16px;background:linear-gradient(180deg,color-mix(in srgb,#16a34a 7%,var(--card-bg,#fff)),var(--card-bg,#fff))}
${P} .dm-f-ev-riga{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
${P} .dm-f-ev-pct{font-size:52px;line-height:.9;color:#15803d}
${P} .dm-f-ev-pct small{font-size:22px}
${P} .dm-f-ev-km{display:flex;flex-direction:column;align-items:flex-end;text-align:right;min-width:0}
${P} .dm-f-ev-km .dm-f-num{font-size:32px;line-height:1}
${P} .dm-f-ev-km small{font-size:12px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-ev-barra{position:relative;display:block;height:12px;border-radius:999px;margin:12px 0 4px;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 22%,transparent);overflow:visible}
${P} .dm-f-ev-barra i{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,#22c55e,#16a34a)}
${P} .dm-f-ev-barra u{position:absolute;top:-4px;bottom:-4px;width:3px;margin-left:-1px;border-radius:2px;background:#15803d}
${P} .dm-f-ev-misure{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,130px),1fr));gap:8px;margin-top:10px}
${P} .dm-f-ev-misure>span{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:16px;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0)}
${P} .dm-f-ev-misure>span>span{display:flex;flex-direction:column;min-width:0}
${P} .dm-f-ev-misure .dm-f-num{font-size:18px;white-space:nowrap}
${P} .dm-f-ev-misure small{font-size:11px;font-weight:750;color:var(--text-dim,#64748b)}
@media (max-width:360px){${P} .dm-f-ev-eroe{flex-direction:column;align-items:flex-start}}
`;

/* ── Solare termico ───────────────────────────────────────────────────── */

/* Le caselle dello stato, col nome del loro tasto nella pagina del solare e
 * nell'ordine in cui si guardano: prima il boiler, poi la pompa. */
const STATI_SOLARE = Object.freeze([
  { ref: "dm.boiler_interruttore_boiler", nome: () => t("Boiler", "Boiler"), ic: "🔌" },
  { ref: "dm.boiler_stato_pompa_solare", nome: () => t("Pompa solare", "Solar pump"), ic: "🔄", pompa: true },
  { ref: "dm.boiler_pompa_solare", nome: () => t("Pompa solare", "Solar pump"), ic: "🔄", pompa: true },
  { ref: "dm.boiler_sensore_pompa_solare", nome: () => t("Pompa solare", "Solar pump"), ic: "🔄", pompa: true },
  { ref: "dm.boiler_valvola_di_sicurezza", nome: () => t("Valvola di sicurezza", "Safety valve"), ic: "🛡️", valvola: true },
  { ref: "dm.boiler_chiave_solare", nome: () => t("Valvola solare", "Solar valve"), ic: "🗝️", valvola: true },
  { ref: "dm.boiler_centralina_solare_termico", nome: () => t("Centralina", "Controller"), ic: "🎛️" },
  { ref: "dm.boiler_interruttore_solare_termico", nome: () => t("Ctrl solare", "Solar control"), ic: "☀️" },
]);

/* Le misure dell'impianto che non stanno nello schema: la pressione, e le
 * due potenze col nome che hanno nella pagina. */
const MISURE_SOLARE = Object.freeze([
  { ref: "dm.boiler_pressione_acqua", nome: () => t("Pressione", "Pressure") },
  { ref: "dm.boiler_potenza_resistenza_boiler", nome: () => t("Resistenza", "Heater") },
  { ref: "dm.boiler_potenza", nome: () => t("Potenza boiler", "Boiler power") },
]);

/** Cosa sta succedendo fra pannello e boiler, in una frase, o `""`. */
export function fraseDelSolare(pannello, boiler, pompa) {
  if (pannello == null || boiler == null || pompa == null) return "";
  const piuFreddo = pannello < boiler;
  if (pompa && !piuFreddo)
    return t(
      "La pompa gira: il calore del pannello sta andando nel boiler.",
      "The pump is running: the panel's heat is going into the boiler.",
    );
  if (pompa)
    return t(
      "La pompa gira anche se il pannello è più freddo dell'acqua.",
      "The pump is running even though the panel is colder than the water.",
    );
  if (piuFreddo)
    return t(
      "Il pannello è più freddo dell'acqua: la pompa resta ferma finché il sole non lo scalda.",
      "The panel is colder than the water: the pump stays idle until the sun warms it.",
    );
  return t(
    "Il pannello è più caldo dell'acqua, ma la pompa è ferma.",
    "The panel is warmer than the water, but the pump is idle.",
  );
}

function disegnaSolare(widget) {
  const righe = Array.isArray(widget?.rows) ? widget.rows : [];
  const daRif = (ref) => righe.find((riga) => riga?.ref === ref) || null;
  const misura = (ref) => numero(daRif(ref)?.raw);
  const pannello = misura("dm.boiler_sonda_temperatura_1");
  const alto = misura("dm.boiler_sonda_temperatura_3");
  const basso = misura("dm.boiler_sonda_temperatura_2");
  const delBoiler = misura("dm.boiler_temperatura");
  const boiler = alto ?? delBoiler ?? basso;
  const pompaRiga = STATI_SOLARE.filter((voce) => voce.pompa)
    .map((voce) => daRif(voce.ref))
    .find(Boolean);
  const pompa = pompaRiga ? pompaRiga.on === true : null;
  const deltaLetto = misura("dm.boiler_delta_temperatura");
  const delta = deltaLetto ?? (pannello != null && boiler != null ? pannello - boiler : null);
  const segno = (valore) =>
    `${valore > 0 ? "+" : valore < 0 ? "−" : ""}${formatNumber(Math.abs(valore), 0)}°`;

  const nodoPannello =
    pannello != null
      ? `<div class="dm-f-solare-nodo"><span class="dm-f-solare-ic" aria-hidden="true">☀️</span>
          <small>${esc(t("Pannello", "Panel"))}</small><span class="dm-f-num">${esc(gradi(pannello))}</span>${
            boiler != null && pannello !== boiler
              ? `<em>${esc(pannello < boiler ? t("più freddo del boiler", "colder than the boiler") : t("più caldo del boiler", "warmer than the boiler"))}</em>`
              : ""
          }</div>`
      : "";
  const sottoBoiler =
    basso != null && boiler !== basso && alto != null
      ? `${t("in basso", "at the bottom")} ${gradi(basso)}`
      : "";
  const nodoBoiler =
    boiler != null
      ? `<div class="dm-f-solare-nodo"><span class="dm-f-solare-ic" aria-hidden="true">🛢️</span>
          <small>${esc(t("Boiler", "Boiler"))}</small><span class="dm-f-num">${esc(gradi(boiler))}</span>${
            sottoBoiler ? `<em>${esc(sottoBoiler)}</em>` : ""
          }</div>`
      : "";
  const filo =
    nodoPannello && nodoBoiler
      ? `<div class="dm-f-solare-filo" data-gira="${pompa === true}"><i aria-hidden="true"></i><b>${
          delta != null ? `${esc(segno(delta))}<br>` : ""
        }${pompa == null ? "" : esc(pompa ? t("pompa in funzione", "pump running") : t("pompa ferma", "pump idle"))}</b></div>`
      : "";
  const schema =
    nodoPannello || nodoBoiler
      ? `<section class="dm-f-solare-schema" data-due="${Boolean(nodoPannello && nodoBoiler)}">${nodoPannello}${filo}${nodoBoiler}</section>`
      : "";
  const frase = fraseDelSolare(pannello, boiler, pompa);

  const misure = MISURE_SOLARE.map((voce) => ({ voce, riga: daRif(voce.ref) }))
    .filter(({ riga }) => riga && clean(riga.value))
    .map(
      ({ voce, riga }) =>
        `<div class="dm-f-solare-cas"><small>${esc(voce.nome())}</small><span class="dm-f-num">${esc(riga.value)}</span></div>`,
    );
  /* Il boiler letto due volte — la sonda in alto e la sua temperatura — sono
   * due numeri veri: quello che non sta nello schema va fra le misure. */
  if (alto != null && delBoiler != null && daRif("dm.boiler_temperatura")?.entity !== daRif("dm.boiler_sonda_temperatura_3")?.entity)
    misure.unshift(
      `<div class="dm-f-solare-cas"><small>${esc(t("Temperatura del boiler", "Tank temperature"))}</small><span class="dm-f-num">${esc(gradi(delBoiler))}</span></div>`,
    );
  /* Senza lo schema la differenza non si vede da nessuna parte: allora e' una
   * misura come le altre. */
  if (!filo && deltaLetto != null)
    misure.push(
      `<div class="dm-f-solare-cas"><small>${esc(t("Differenza pannello–boiler", "Panel–boiler gap"))}</small><span class="dm-f-num">${esc(segno(deltaLetto))}</span></div>`,
    );

  const giaDetta = new Set();
  const stati = STATI_SOLARE.map((voce) => ({ voce, riga: daRif(voce.ref) }))
    .filter(({ voce, riga }) => {
      if (!riga || typeof riga.on !== "boolean") return false;
      const chiave = voce.pompa ? "pompa" : voce.ref;
      if (giaDetta.has(chiave)) return false;
      giaDetta.add(chiave);
      return true;
    })
    .map(({ voce, riga }) => {
      const parola = voce.pompa
        ? riga.on
          ? t("Gira", "Running")
          : t("Ferma", "Idle")
        : voce.valvola
          ? riga.on
            ? t("Aperta", "Open")
            : t("Chiusa", "Closed")
          : riga.on
            ? t("Acceso", "On")
            : t("Spento", "Off");
      return `<div class="dm-f-solare-st"${riga.on ? ' data-on="true"' : ""}>
        <span class="dm-f-solare-st-ic" aria-hidden="true">${voce.ic}</span>
        <b>${esc(voce.nome())}</b>
        <span class="dm-f-solare-st-s">${esc(parola)}</span>
      </div>`;
    });

  return `<div class="dm-f dm-f-solare">
    ${schema}
    ${frase ? `<p class="dm-f-solare-frase">${esc(frase)}</p>` : ""}
    ${misure.length ? `${titoletto(t("L'impianto", "The system"))}<div class="dm-f-solare-tre">${misure.join("")}</div>` : ""}
    ${stati.length ? `${titoletto(t("Lo stato", "The state"))}<div class="dm-f-solare-stati">${stati.join("")}</div>` : ""}
  </div>`;
}

const STILE_SOLARE = `
${P} .dm-f-solare-schema{display:grid;grid-template-columns:minmax(0,1fr) 58px minmax(0,1fr);align-items:center;gap:6px;
  border-radius:24px;padding:14px 12px;
  background:linear-gradient(170deg,color-mix(in srgb,#facc15 9%,var(--card-bg,#fff)),color-mix(in srgb,var(--dm-widget-accent,#f59e0b) 10%,var(--card-bg,#fff)));
  border:1px solid color-mix(in srgb,var(--dm-widget-accent,#f59e0b) 30%,transparent)}
${P} .dm-f-solare-schema[data-due="false"]{grid-template-columns:minmax(0,1fr)}
${P} .dm-f-solare-nodo{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0;border-radius:20px;padding:12px 8px;
  background:var(--card-bg,#fff);border:1px solid color-mix(in srgb,var(--dm-widget-accent,#f59e0b) 30%,transparent);
  box-shadow:0 12px 22px -20px rgba(180,83,9,.7)}
${P} .dm-f-solare-ic{font-size:28px;line-height:1}
${P} .dm-f-solare-nodo small{margin-top:4px;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;
  color:color-mix(in srgb,var(--dm-widget-accent,#f59e0b) 60%,var(--text,#0f172a))}
${P} .dm-f-solare-nodo .dm-f-num{margin-top:4px;font-size:29px}
${P} .dm-f-solare-nodo em{margin-top:3px;font-style:normal;font-size:11.5px;font-weight:750;line-height:1.35;color:var(--text-dim,#64748b)}
${P} .dm-f-solare-filo{display:grid;justify-items:center;gap:5px}
${P} .dm-f-solare-filo i{width:100%;height:6px;border-radius:999px;
  background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--text-dim,#94a3b8) 45%,transparent) 0 8px,transparent 8px 14px)}
${P} .dm-f-solare-filo[data-gira="true"] i{background:repeating-linear-gradient(90deg,var(--dm-widget-accent,#f59e0b) 0 8px,transparent 8px 14px)}
${P} .dm-f-solare-filo b{font-size:11px;font-weight:900;line-height:1.25;text-align:center;color:var(--text-dim,#64748b)}
${P} .dm-f-solare-frase{margin:12px 0 0;border-radius:16px;padding:11px 13px;font-size:13px;font-weight:750;line-height:1.4;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 12%,var(--card-bg,#fff));color:var(--text,#334155)}
${P} .dm-f-solare-tre{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px}
${P} .dm-f-solare-cas{display:flex;flex-direction:column;min-width:0;border-radius:18px;padding:12px 11px;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
${P} .dm-f-solare-cas small{font-size:10px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--text-dim,#64748b)}
${P} .dm-f-solare-cas .dm-f-num{margin-top:4px;font-size:21px;white-space:nowrap}
${P} .dm-f-solare-stati{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:8px}
${P} .dm-f-solare-st{display:flex;align-items:center;gap:11px;min-width:0;padding:10px 12px;border-radius:16px;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0)}
${P} .dm-f-solare-st-ic{flex:0 0 36px;width:36px;height:36px;border-radius:12px;display:grid;place-items:center;font-size:17px;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 10%,var(--card-bg,#fff))}
${P} .dm-f-solare-st b{flex:1;min-width:0;font-size:13.5px;font-weight:850;color:var(--text,#0f172a)}
${P} .dm-f-solare-st-s{flex:0 0 auto;padding:5px 9px;border-radius:999px;font-size:10.5px;font-weight:900;letter-spacing:.08em;
  text-transform:uppercase;background:color-mix(in srgb,var(--text-dim,#94a3b8) 14%,transparent);color:var(--text-dim,#64748b)}
${P} .dm-f-solare-st[data-on="true"] .dm-f-solare-st-s{background:color-mix(in srgb,#16a34a 16%,transparent);color:#15803d}
${P} .dm-f-solare-st[data-on="true"] .dm-f-solare-st-ic{background:color-mix(in srgb,#16a34a 16%,var(--card-bg,#fff))}
`;

registraFinestra("energia", { disegna: disegnaEnergia, stile: STILE_ENERGIA });
registraFinestra("temperatura", { disegna: disegnaTemperatura, stile: STILE_TEMPERATURA });
registraFinestra("ev", { disegna: disegnaEv, stile: STILE_EV });
registraFinestra("solare", { disegna: disegnaSolare, stile: STILE_SOLARE });

export const FINESTRE_PROPOSTI = Object.freeze(["energia", "temperatura", "ev", "solare"]);
