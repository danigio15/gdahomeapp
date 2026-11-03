/* Il programma del clima, dentro la sua finestra.
 *
 * Dal campo: «quando apri qui ti scegli gli orari delle fasce e le
 * temperature». La finestra di un termostato sapeva accenderlo, spegnerlo e
 * cambiargli i gradi adesso; per dirgli «la mattina 21°, il pomeriggio 18°,
 * la sera 20,5°» bisognava andare nelle Automazioni e costruire un
 * cronotermostato a due temperature. Qui sotto i comandi c'e' «🗓️ Programma»:
 * la giornata come una barra di 24 ore con le fasce colorate dai loro gradi,
 * il prossimo cambio, e le fasce da aggiungere, spostare e togliere — feriali
 * e festivi.
 *
 * Il programma e' un cronotermostato vero di Home Assistant (`tipo: "crono"`
 * col campo `programma`, `core/automazioni.js`): si salva passando dal ponte
 * come le altre automazioni, lo esegue Home Assistant, e compare nelle
 * Automazioni col nome «Programma <stanza>». Uno per termostato: se ce n'e'
 * gia' uno — anche un cronotermostato di prima, a due temperature — si apre
 * quello, e salvando diventa a fasce.
 *
 * Modificarlo e' Premium, come le Automazioni: senza, il programma si vede ma
 * non si tocca, e un riquadro dice dove si prende.
 */
import {
  FASCE_DEL_PROGRAMMA,
  PROGRAMMA_DI_SERIE,
  cronoProssimo,
  cronoPulito,
  giornataDelProgramma,
  nuovoId,
} from "../core/automazioni.js";
import {
  DOVE_SI_COMPRA,
  alternaInCasa,
  automazioniDiCasa,
  chiediAllaCasa,
  quandoCambiaLaCasa,
  statoDelleAutomazioni,
} from "./automazioni-section.js";
import { climateUnits } from "./climate-thermal-section.js";
import {
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  locale,
  root,
  scriviSeCambia,
  senzaCadere,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_PROGRAMMA_DEL_CLIMA__";
const state = (root[KEY] ||= {
  installed: false,
  entita: "",
  aperto: false,
  giorno: "feriali",
  bozza: null,
  salvando: false,
  errore: "",
  salvato: false,
});

const GRADI_FUORI = 17;
const GRADI_NUOVA = 20;

/* ── il modello della finestra (puro) ─────────────────────────────────── */

/** L'automazione che fa da programma a `entita`: prima quella a fasce, poi un cronotermostato qualunque. */
export function programmaDelTermostato(elenco, entita) {
  const suoi = (Array.isArray(elenco) ? elenco : []).filter(
    (v) => v?.modello?.tipo === "crono" && v.modello.crono?.termostati?.includes(entita),
  );
  return suoi.find((v) => v.modello.crono.programma) || suoi[0] || null;
}

/* Un cronotermostato di prima diventa programma: le sue fasce con i gradi
 * «in casa», e fuori i suoi gradi di fuori. Cosi' aprendolo qui non cambia
 * niente finche' non si tocca. */
export function bozzaDalCrono(crono, entita) {
  const c = cronoPulito(crono || { termostati: [entita], programma: PROGRAMMA_DI_SERIE, fuori: GRADI_FUORI });
  const programma = c.programma || {
    feriali: c.feriali.map(([da, a]) => ({ da, a, gradi: c.inCasa })),
    festivi: c.festivi.map(([da, a]) => ({ da, a, gradi: c.inCasa })),
  };
  return {
    ...c,
    termostati: c.termostati.length ? c.termostati : [entita],
    programma: {
      feriali: programma.feriali.map((f) => ({ ...f })),
      festivi: programma.festivi.map((f) => ({ ...f })),
    },
  };
}

/** Una fascia nuova dopo l'ultima: due ore, o quello che resta del giorno. */
export function fasciaNuova(giornata) {
  const ultima = giornata[giornata.length - 1];
  let da = ultima ? ultima.a : 390;
  if (da >= 1410) {
    /* Il giorno e' finito: si cerca il primo buco. */
    const piene = new Array(48).fill(false);
    for (const f of giornata) for (let i = f.da / 30; i < f.a / 30; i += 1) piene[i] = true;
    const buco = piene.indexOf(false);
    if (buco < 0) return null;
    da = buco * 30;
  }
  return { da, a: Math.min(1440, da + 120), gradi: GRADI_NUOVA };
}

/* Il colore di una fascia dai suoi gradi: dall'azzurro dei 16° all'arancio
 * dei 23°, dove sta quasi tutto quello che si chiede a un termostato. Si
 * mescola in OKLab: in mezzo resta un colore caldo-freddo, non un verde. */
export function coloreDeiGradi(gradi) {
  const p = Math.max(0, Math.min(1, (Number(gradi) - 16) / 7));
  return `color-mix(in oklab, #f97316 ${Math.round(p * 100)}%, #38bdf8)`;
}

export const oraDetta = (minuti) =>
  `${String(Math.floor(minuti / 60)).padStart(2, "0")}:${String(minuti % 60).padStart(2, "0")}`;
const gradiDetti = (g) => `${Number(g).toLocaleString(locale(), { maximumFractionDigits: 1 })}°`;

/* ── la finestra ──────────────────────────────────────────────────────── */

const casa = () => statoDelleAutomazioni();
const premium = () => casa().premium === true;
const puoScrivere = () => casa().ponte?.puoScrivere === true;

function voceDi(entita) {
  return programmaDelTermostato(automazioniDiCasa(), entita);
}

function nomeDellaStanza() {
  const unita = climateUnits().find((u) => u.entity === state.entita);
  return clean(unita?.room) || clean(unita?.name) || state.entita;
}

function laBozza() {
  if (state.bozza && state.bozza.__entita === state.entita) return state.bozza;
  const voce = voceDi(state.entita);
  state.bozza = { ...bozzaDalCrono(voce?.modello?.crono, state.entita), __entita: state.entita };
  return state.bozza;
}

function barraMarkup(giornata, fuori) {
  const pezzi = giornata
    .map(
      (f) =>
        `<i style="left:${(f.da / 1440) * 100}%;width:${((f.a - f.da) / 1440) * 100}%;--g:${coloreDeiGradi(f.gradi)}" title="${esc(`${oraDetta(f.da)}–${oraDetta(f.a)} · ${gradiDetti(f.gradi)}`)}"><b>${esc(gradiDetti(f.gradi))}</b></i>`,
    )
    .join("");
  return `<div class="dm-prg-barra" style="--fuori:${coloreDeiGradi(fuori)}">${pezzi}</div><div class="dm-prg-ore"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>`;
}

function orarioMarkup(i, chi, valore, minimo, massimo) {
  const opzioni = [];
  for (let m = minimo; m <= massimo; m += 30)
    opzioni.push(`<option value="${m}"${m === valore ? " selected" : ""}>${oraDetta(m)}</option>`);
  return `<select class="dm-prg-ora" data-dm-prg-ora="${i}:${chi}" aria-label="${esc(chi === "da" ? t("Dalle", "From") : t("Alle", "To"))}">${opzioni.join("")}</select>`;
}

function fasceMarkup(giornata) {
  if (!giornata.length)
    return `<p class="dm-prg-vuoto">${esc(t("Nessuna fascia: tutto il giorno vale la temperatura fuori dalle fasce.", "No slots: the outside-slot temperature applies all day."))}</p>`;
  return giornata
    .map(
      (f, i) => `<div class="dm-prg-fascia" style="--g:${coloreDeiGradi(f.gradi)}">
  <span class="dm-prg-orari">${orarioMarkup(i, "da", f.da, 0, 1410)}<span>–</span>${orarioMarkup(i, "a", f.a, 30, 1440)}</span>
  <span class="dm-prg-gradi"><button type="button" data-dm-prg-gradi="${i}:-0.5" aria-label="−">−</button><b>${esc(gradiDetti(f.gradi))}</b><button type="button" data-dm-prg-gradi="${i}:0.5" aria-label="+">+</button></span>
  <button type="button" class="dm-prg-via" data-dm-prg-via="${i}" aria-label="${esc(t("Togli la fascia", "Remove the slot"))}">🗑</button>
</div>`,
    )
    .join("");
}

function prossimoDetto(crono) {
  const p = cronoProssimo(crono, Date.now());
  if (!p) return "";
  const quando = new Date(p.alle);
  const oggi = new Date();
  const ora = oraDetta(quando.getHours() * 60 + quando.getMinutes());
  const gradi = gradiDetti(p.voluto);
  const stessoGiorno = quando.toDateString() === oggi.toDateString();
  return stessoGiorno
    ? t(`alle ${ora} → ${gradi}`, `at ${ora} → ${gradi}`)
    : t(`domani alle ${ora} → ${gradi}`, `tomorrow at ${ora} → ${gradi}`);
}

function statoDetto(voce, bozza) {
  if (casa().assente)
    return t("serve l'add-on GdAHome", "needs the GdAHome add-on");
  if (!voce) return t("non c'è ancora", "not set yet");
  if (voce.attiva === false) return t("sospeso", "paused");
  return prossimoDetto(bozza) || t("attivo", "active");
}

export function programmaMarkup() {
  const voce = voceDi(state.entita);
  const b = laBozza();
  const giornata = b.programma[state.giorno];
  const sbloccato = premium() && !casa().assente;
  const testa = `<button type="button" class="dm-prg-testa" data-dm-prg-apri aria-expanded="${state.aperto}"><span class="dm-prg-tit">🗓️ ${esc(t("Programma", "Schedule"))}</span><span class="dm-prg-stato">${esc(statoDetto(voce, b))}</span><span class="dm-prg-freccia" aria-hidden="true">▾</span></button>`;
  if (!state.aperto) return testa;
  const giorni = `<div class="dm-prg-giorni" role="tablist">${[
    ["feriali", t("Lun – Ven", "Mon – Fri")],
    ["festivi", t("Sab – Dom", "Sat – Sun")],
  ]
    .map(
      ([g, nome]) =>
        `<button type="button" role="tab" aria-selected="${state.giorno === g}" data-dm-prg-giorno="${g}">${esc(nome)}</button>`,
    )
    .join("")}</div>`;
  const corpo = `${giorni}
${barraMarkup(giornata, b.fuori)}
<div class="dm-prg-fasce">${fasceMarkup(giornata)}</div>
<div class="dm-prg-azioni">${
    giornata.length < FASCE_DEL_PROGRAMMA && fasciaNuova(giornata)
      ? `<button type="button" class="dm-prg-pill" data-dm-prg-aggiungi>＋ ${esc(t("Aggiungi fascia", "Add slot"))}</button>`
      : ""
  }${
    state.giorno === "festivi"
      ? `<button type="button" class="dm-prg-pill" data-dm-prg-copia>⧉ ${esc(t("Copia da Lun – Ven", "Copy from Mon – Fri"))}</button>`
      : ""
  }</div>
<div class="dm-prg-fuori"><span>${esc(t("Fuori dalle fasce", "Outside the slots"))}</span><span class="dm-prg-gradi"><button type="button" data-dm-prg-fuori="-0.5" aria-label="−">−</button><b>${esc(gradiDetti(b.fuori))}</b><button type="button" data-dm-prg-fuori="0.5" aria-label="+">+</button></span></div>
${
  voce
    ? `<div class="dm-prg-fuori"><span>${esc(t("Programma attivo", "Schedule active"))}</span><button type="button" class="dm-prg-int" role="switch" aria-checked="${voce.attiva !== false}" data-dm-prg-attivo aria-label="${esc(t("Programma attivo", "Schedule active"))}"><i></i></button></div>`
    : ""
}
${state.errore ? `<p class="dm-prg-errore">${esc(state.errore)}</p>` : ""}
${
  sbloccato && !puoScrivere() && casa().ponte
    ? `<p class="dm-prg-nota">${esc(t("Solo chi amministra Home Assistant può salvarlo.", "Only a Home Assistant administrator can save it."))}</p>`
    : ""
}
<button type="button" class="dm-prg-salva" data-dm-prg-salva${state.salvando || (casa().ponte && !puoScrivere()) ? " disabled" : ""}>${esc(
    state.salvando
      ? t("Salvo…", "Saving…")
      : state.salvato
        ? t("✓ Salvato in Home Assistant", "✓ Saved in Home Assistant")
        : t("💾 Salva il programma", "💾 Save the schedule"),
  )}</button>`;
  if (sbloccato) return `${testa}<div class="dm-prg-corpo">${corpo}</div>`;
  return `${testa}<div class="dm-prg-velato"><div class="dm-prg-corpo" aria-hidden="true" inert>${corpo}</div><div class="dm-prg-velo">${
    casa().assente
      ? `<p>${esc(t("Il programma lo esegue Home Assistant: serve l'add-on GdAHome.", "Home Assistant runs the schedule: it needs the GdAHome add-on."))}</p>`
      : `<span class="dm-prg-prem">✨ PREMIUM</span><p>${esc(
          t(
            "Scegli le fasce e le loro temperature, feriali e festivi: il programma orario è con Premium.",
            "Pick the slots and their temperatures, weekdays and weekends: the time schedule comes with Premium.",
          ),
        )}</p><small>${esc(DOVE_SI_COMPRA())}</small>`
  }</div></div>`;
}

function ospite() {
  const finestra = doc?.querySelector?.("#clima-popup-overlay .clima-popup");
  if (!finestra) return null;
  let nodo = finestra.querySelector("[data-dm-prg]");
  if (!nodo) {
    nodo = doc.createElement("section");
    nodo.setAttribute("data-dm-prg", "");
    nodo.className = "dm-prg";
    const potenza = finestra.querySelector(".clima-power-row");
    if (potenza) potenza.after(nodo);
    else finestra.append(nodo);
  }
  return nodo;
}

export function disegna() {
  if (!state.entita) return false;
  const nodo = ospite();
  if (!nodo) return false;
  nodo.dataset.dmPrg = state.entita;
  scriviSeCambia(nodo, programmaMarkup());
  return true;
}

function apri(entita) {
  const chi = clean(entita);
  if (!/^climate\./.test(chi)) {
    doc?.querySelector?.("#clima-popup-overlay [data-dm-prg]")?.remove();
    state.entita = "";
    return;
  }
  if (chi !== state.entita) {
    state.entita = chi;
    state.bozza = null;
    state.aperto = false;
    state.giorno = "feriali";
    state.errore = "";
    state.salvato = false;
  }
  disegna();
  void chiediAllaCasa();
}

/* ── i tocchi ─────────────────────────────────────────────────────────── */

function cambia(fai) {
  const b = laBozza();
  fai(b);
  b.programma[state.giorno] = giornataDelProgramma(b.programma[state.giorno]);
  state.salvato = false;
  state.errore = "";
  disegna();
}

async function salva() {
  if (state.salvando || !premium()) return;
  const b = laBozza();
  const voce = voceDi(state.entita);
  const stanza = nomeDellaStanza();
  const crono = cronoPulito({ ...b, termostati: b.termostati.length ? b.termostati : [state.entita] });
  const automazione = {
    id: voce?.modello?.id || voce?.id || nuovoId(),
    nome: voce?.nome || t(`Programma ${stanza}`, `Schedule ${stanza}`).slice(0, 60),
    attiva: voce ? voce.attiva !== false : true,
    tipo: "crono",
    crono,
  };
  state.salvando = true;
  state.errore = "";
  disegna();
  try {
    await chiediAHomeAssistant(
      { type: "ponte/automazioni/salva", automazione, automazione_id: voce?.id || "" },
      25000,
    );
    state.salvato = true;
    root.edToast?.(t("💾 Programma salvato in Home Assistant", "💾 Schedule saved in Home Assistant"));
    void chiediAllaCasa({ forza: true });
    root.setTimeout?.(() => void chiediAllaCasa({ forza: true }), 2500);
  } catch (errore) {
    const no = clean(errore?.message) || "?";
    state.errore = t(
      `Home Assistant non l'ha salvato: ${no}`,
      `Home Assistant did not save it: ${no}`,
    );
  } finally {
    state.salvando = false;
    disegna();
  }
}

function suClick(evento) {
  const bersaglio = evento.target?.closest?.("[data-dm-prg] button");
  if (!bersaglio) return;
  const d = bersaglio.dataset;
  evento.stopPropagation();
  if (d.dmPrgApri !== undefined) {
    state.aperto = !state.aperto;
    disegna();
    return;
  }
  if (d.dmPrgGiorno) {
    state.giorno = d.dmPrgGiorno === "festivi" ? "festivi" : "feriali";
    disegna();
    return;
  }
  if (!premium()) return;
  if (d.dmPrgAggiungi !== undefined)
    return cambia((b) => {
      const nuova = fasciaNuova(b.programma[state.giorno]);
      if (nuova) b.programma[state.giorno].push(nuova);
    });
  if (d.dmPrgCopia !== undefined)
    return cambia((b) => {
      b.programma.festivi = b.programma.feriali.map((f) => ({ ...f }));
    });
  if (d.dmPrgVia !== undefined)
    return cambia((b) => {
      b.programma[state.giorno].splice(Number(d.dmPrgVia), 1);
    });
  if (d.dmPrgGradi) {
    const [i, passo] = d.dmPrgGradi.split(":").map(Number);
    return cambia((b) => {
      const f = b.programma[state.giorno][i];
      if (f) f.gradi = Math.max(5, Math.min(30, f.gradi + passo));
    });
  }
  if (d.dmPrgFuori)
    return cambia((b) => {
      b.fuori = Math.max(5, Math.min(30, b.fuori + Number(d.dmPrgFuori)));
    });
  if (d.dmPrgAttivo !== undefined) {
    const voce = voceDi(state.entita);
    if (voce) alternaInCasa(voce);
    root.setTimeout?.(disegna, 50);
    return;
  }
  if (d.dmPrgSalva !== undefined) void salva();
}

function suCambio(evento) {
  const scelta = evento.target?.closest?.("[data-dm-prg] select[data-dm-prg-ora]");
  if (!scelta || !premium()) return;
  const [i, chi] = scelta.dataset.dmPrgOra.split(":");
  const valore = Number(scelta.value);
  cambia((b) => {
    const f = b.programma[state.giorno][Number(i)];
    if (!f) return;
    f[chi === "a" ? "a" : "da"] = valore;
    /* Un orario che scavalca l'altro lo spinge: la fascia resta almeno
     * mezz'ora. */
    if (f.a <= f.da) {
      if (chi === "a") f.da = Math.max(0, f.a - 30);
      else f.a = Math.min(1440, f.da + 30);
    }
  });
}

/* ── l'aspetto ────────────────────────────────────────────────────────── */

/* Col programma aperto la finestra e' piu' alta dello schermo del telefono:
 * si ancora in alto e scorre dentro di se', lasciando libero il fondo dove
 * sta la barra delle sezioni — il tasto Salva non ci finisce mai sotto. */
const STILE = `
#clima-popup-overlay.show:has(.dm-prg-corpo){align-items:flex-start}
#clima-popup-overlay.show .clima-popup:has(.dm-prg-corpo){max-height:calc(100dvh - 150px);overflow-y:auto;overscroll-behavior:contain;margin-top:8px}
.clima-popup .dm-prg{margin:14px 0 4px;border-radius:16px;background:rgba(148,163,184,.10);border:1px solid var(--card-border,rgba(148,163,184,.25));overflow:hidden}
.dm-prg-testa{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;padding:12px 14px;cursor:pointer;color:var(--text,inherit)}
.dm-prg-tit{font-weight:800;font-size:14px}
.dm-prg-stato{flex:1;text-align:right;font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
.dm-prg-freccia{transition:transform .2s;color:var(--text-dim,#64748b)}
.dm-prg-testa[aria-expanded="true"] .dm-prg-freccia{transform:rotate(180deg)}
.dm-prg-corpo{padding:0 14px 14px;display:flex;flex-direction:column;gap:10px}
.dm-prg-giorni{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;border-radius:12px;background:rgba(148,163,184,.14)}
.dm-prg-giorni button{all:unset;text-align:center;padding:8px 0;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;color:var(--text-dim,#64748b)}
.dm-prg-giorni button[aria-selected="true"]{background:var(--card-bg,#fff);color:var(--text,#0f172a);box-shadow:0 1px 4px rgba(15,23,42,.12)}
.dm-prg-barra{position:relative;height:34px;border-radius:10px;background:color-mix(in srgb,var(--fuori) 22%,transparent);overflow:hidden}
.dm-prg-barra i{position:absolute;top:0;bottom:0;background:var(--g);display:flex;align-items:center;justify-content:center;border-left:1px solid rgba(255,255,255,.55)}
.dm-prg-barra i b{font-size:10px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.45);white-space:nowrap;overflow:hidden}
.dm-prg-ore{display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:var(--text-dim,#64748b);margin-top:-6px}
.dm-prg-fasce{display:flex;flex-direction:column;gap:6px}
.dm-prg-fascia{display:flex;align-items:center;gap:4px;padding:6px 6px;border-radius:12px;background:var(--card-bg,rgba(255,255,255,.6));border-left:4px solid var(--g)}
.dm-prg-orari{display:flex;align-items:center;gap:3px;flex:1 1 auto;min-width:0}
.dm-prg-ora{font:inherit;font-size:12px;font-weight:700;padding:5px 2px;width:66px;flex:0 0 66px;border-radius:8px;border:1px solid var(--card-border,rgba(148,163,184,.4));background:transparent;color:var(--text,inherit);min-width:0}
.dm-prg-gradi{display:flex;align-items:center;gap:4px}
.dm-prg-gradi b{min-width:38px;text-align:center;font-size:14px;font-weight:800;color:var(--text,inherit)}
.dm-prg-gradi button,.dm-prg-via{all:unset;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;cursor:pointer;font-weight:800;background:rgba(148,163,184,.18);color:var(--text,inherit)}
.dm-prg-via{background:transparent;font-size:14px}
.dm-prg-azioni{display:flex;flex-wrap:wrap;gap:6px}
.dm-prg-pill{all:unset;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:800;cursor:pointer;background:rgba(14,165,233,.14);color:#0284c7}
.dm-prg-fuori{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;font-weight:700;color:var(--text,inherit)}
.dm-prg-int{all:unset;width:44px;height:26px;border-radius:999px;background:rgba(148,163,184,.4);position:relative;cursor:pointer}
.dm-prg-int i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s}
.dm-prg-int[aria-checked="true"]{background:#22c55e}
.dm-prg-int[aria-checked="true"] i{left:21px}
.dm-prg-salva{all:unset;text-align:center;padding:11px 0;border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;background:linear-gradient(135deg,#f97316,#ef4444);color:#fff}
.dm-prg-salva[disabled]{opacity:.55;cursor:default}
.dm-prg-vuoto,.dm-prg-nota{margin:0;font-size:12px;color:var(--text-dim,#64748b)}
.dm-prg-errore{margin:0;font-size:12px;font-weight:700;color:#dc2626}
.dm-prg-velato{position:relative}
.dm-prg-velato>.dm-prg-corpo{filter:blur(2px);opacity:.55;pointer-events:none}
.dm-prg-velo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:16px;text-align:center;background:color-mix(in srgb,var(--card-bg,#fff) 70%,transparent)}
.dm-prg-velo p{margin:0;font-size:13px;font-weight:700;color:var(--text,#0f172a)}
.dm-prg-velo small{font-size:11px;color:var(--text-dim,#64748b)}
.dm-prg-prem{font-size:10px;font-weight:900;letter-spacing:.12em;padding:4px 10px;border-radius:999px;background:linear-gradient(135deg,#f59e0b,#ec4899);color:#fff}
`;

/* ── l'aggancio ───────────────────────────────────────────────────────── */

function avvolgi() {
  const originale = root.apriClimaPopup;
  if (typeof originale !== "function" || originale.__dmProgramma) return false;
  function avvolto(entity, ...resto) {
    const esito = originale.call(this, entity, ...resto);
    root.queueMicrotask?.(() => apri(entity));
    return esito;
  }
  Object.assign(avvolto, originale);
  avvolto.__dmProgramma = true;
  avvolto.__dmPrevious = originale;
  root.apriClimaPopup = avvolto;
  return true;
}

export function installProgrammaDelClima() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle("dm-programma-del-clima-style", STILE);
  doc.addEventListener("click", suClick, true);
  doc.addEventListener("change", suCambio, true);
  quandoCambiaLaCasa(() => {
    const velo = doc.getElementById("clima-popup-overlay");
    if (velo?.classList?.contains("show") && state.entita) disegna();
  });
  avvolgi();
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"])
    root.addEventListener?.(evento, avvolgi);
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installProgrammaDelClima, { once: true });
} else {
  senzaCadere(installProgrammaDelClima);
}
