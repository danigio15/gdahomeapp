/* La finestra del widget Meteo (vedi `../finestre-dei-widget.js`).
 *
 * Dal campo: «sarebbe bello mettere anche un widget delle previsioni del
 * meteo, senza aprire il radar». La finestra dice quello che si cerca
 * passando: com'e' adesso, se arriva la pioggia, le prossime ore e i prossimi
 * giorni. Il radar e la stazione restano nella pagina Meteo, a un tocco da
 * «Apri sezione».
 *
 * I numeri arrivano gia' fatti dal modello della tessera (`meteoModel`), che
 * li prende dalla sezione Meteo: qui non si chiede niente a Home Assistant.
 * Quello che non c'e' non si inventa: senza previsioni le due file non
 * compaiono, e la finestra dice solo com'e' adesso.
 */
import { registraFinestra } from "../finestre-dei-widget.js";
import { clean, esc, formatNumber, locale, t } from "../shared.js";
import { segnoDelTempo } from "../../core/la-card-del-meteo.js";

const P = ":is(#dm-widget-popup,#dm-casa-popup,#dm-qa-popup)";

const finito = (valore) => Number.isFinite(valore);
const gradi = (valore) => (finito(valore) ? `${Math.round(valore)}°` : "—");

function ora(quando) {
  try {
    return new Date(quando).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  } catch (_errore) {
    return "";
  }
}

function giorno(quando) {
  try {
    const nome = new Date(quando).toLocaleDateString(locale(), { weekday: "short" });
    return nome.charAt(0).toLocaleUpperCase(locale()) + nome.slice(1).replace(/\.$/, "");
  } catch (_errore) {
    return "";
  }
}

function adesso(w) {
  const m = w.misure || {};
  const sotto = [
    finito(m.percepita?.valore)
      ? `${esc(t("Percepita", "Feels like"))} <b>${esc(formatNumber(m.percepita.valore, 1))}°</b>`
      : "",
    finito(w.oggi?.bassa) ? `${esc(t("Min", "Min"))} <b>${gradi(w.oggi.bassa)}</b>` : "",
    finito(w.oggi?.alta) ? `${esc(t("Max", "Max"))} <b>${gradi(w.oggi.alta)}</b>` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const pastiglie = [
    finito(m.umidita?.valore) ? ["💧", t("Umidità", "Humidity"), `${Math.round(m.umidita.valore)}%`] : null,
    finito(m.vento?.valore)
      ? ["💨", t("Vento", "Wind"), `${Math.round(m.vento.valore)} ${clean(m.vento.unita)}`]
      : null,
    finito(m.pressione?.valore)
      ? ["⏲️", t("Pressione", "Pressure"), `${Math.round(m.pressione.valore)} ${clean(m.pressione.unita)}`]
      : null,
  ].filter(Boolean);
  const frase = w.frase
    ? `<p class="dm-f-mt-frase" data-stato="${esc(clean(w.frase.stato))}"><span aria-hidden="true">${esc(
        clean(w.frase.segno),
      )}</span><span><b>${esc(clean(w.frase.titolo))}</b>${
        clean(w.frase.sotto) ? `<small>${esc(clean(w.frase.sotto))}</small>` : ""
      }</span></p>`
    : "";
  return `<section class="dm-f-mt-eroe">
      <div class="dm-f-mt-su">
        <span class="dm-f-mt-segno" aria-hidden="true">${segnoDelTempo(w.condizione)}</span>
        <div>
          <div class="dm-f-mt-gradi">${esc(clean(w.value))}</div>
          <div class="dm-f-mt-cielo">${esc(clean(w.cielo))}</div>
        </div>
      </div>
      ${sotto ? `<div class="dm-f-mt-sotto">${sotto}</div>` : ""}
      ${frase}
      ${
        pastiglie.length
          ? `<div class="dm-f-mt-pills">${pastiglie
              .map(
                ([segno, nome, valore]) =>
                  `<span class="dm-f-mt-pill"><span aria-hidden="true">${segno}</span>${esc(nome)} <b>${esc(valore)}</b></span>`,
              )
              .join("")}</div>`
          : ""
      }
    </section>`;
}

function prossimeOre(w) {
  const ore = Array.isArray(w.ore) ? w.ore : [];
  if (!ore.length) return "";
  return `<h4 class="dm-w-titoletto">${esc(t("Prossime ore", "Next hours"))}</h4>
    <div class="dm-f-mt-ore" data-dm-f-mt-ore>${ore
      .map((voce, indice) => {
        const pioggia = finito(voce.probabilita) ? Math.round(voce.probabilita) : null;
        return `<div class="dm-f-mt-ora${indice === 0 ? " adesso" : ""}">
          <span class="dm-f-mt-h">${esc(indice === 0 ? t("Ora", "Now") : ora(voce.quando))}</span>
          <span class="dm-f-mt-ic" aria-hidden="true">${segnoDelTempo(voce.condizione)}</span>
          <b>${gradi(voce.temperatura)}</b>
          <small${pioggia !== null && pioggia >= 50 ? ' data-bagnata="true"' : ""}>${
            pioggia === null ? "&nbsp;" : `☔ ${pioggia}%`
          }</small>
        </div>`;
      })
      .join("")}</div>`;
}

function prossimiGiorni(w) {
  const giorni = Array.isArray(w.giorni) ? w.giorni : [];
  if (!giorni.length) return "";
  const bassi = giorni.map((g) => g.bassa ?? g.temperatura).filter(finito);
  const alti = giorni.map((g) => g.temperatura ?? g.bassa).filter(finito);
  const basso = Math.min(...bassi, ...alti);
  const sopra = Math.max(...bassi, ...alti);
  const larga = sopra - basso || 1;
  return `<h4 class="dm-w-titoletto">${esc(t("Prossimi giorni", "Next days"))}</h4>
    <div class="dm-f-mt-giorni" data-dm-f-mt-giorni>${giorni
      .map((voce) => {
        const min = voce.bassa ?? voce.temperatura;
        const max = voce.temperatura ?? voce.bassa;
        const da = finito(min) ? ((min - basso) / larga) * 100 : 0;
        const a = finito(max) ? ((max - basso) / larga) * 100 : 100;
        const pioggia = finito(voce.probabilita) ? Math.round(voce.probabilita) : null;
        return `<div class="dm-f-mt-giorno">
          <span class="dm-f-mt-g">${esc(giorno(voce.quando))}</span>
          <span class="dm-f-mt-ic" aria-hidden="true">${segnoDelTempo(voce.condizione)}</span>
          <small class="dm-f-mt-pp">${pioggia ? `☔ ${pioggia}%` : ""}</small>
          <span class="dm-f-mt-min">${gradi(min)}</span>
          <span class="dm-f-mt-barra" aria-hidden="true"><i style="left:${da.toFixed(1)}%;right:${(100 - a).toFixed(1)}%"></i></span>
          <span class="dm-f-mt-max">${gradi(max)}</span>
        </div>`;
      })
      .join("")}</div>`;
}

function finestraMeteo(w) {
  return `<div class="dm-f-mt">${adesso(w)}${prossimeOre(w)}${prossimiGiorni(w)}</div>`;
}

function sottotitoloMeteo(w) {
  return [clean(w.cielo), w.oggi && finito(w.oggi.alta) ? `${gradi(w.oggi.alta)} / ${gradi(w.oggi.bassa)}` : ""]
    .filter(Boolean)
    .join(" · ");
}

const STILE = `
${P} .dm-f-mt{--mt:#0284c7;display:grid;gap:12px}
${P} .dm-f-mt-eroe{display:grid;gap:10px;padding:16px;border-radius:18px;
  background:linear-gradient(150deg,color-mix(in srgb,var(--mt) 16%,var(--card-bg,#fff)),var(--card-bg,#fff) 70%);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--mt) 22%,transparent)}
${P} .dm-f-mt-su{display:flex;align-items:center;gap:14px}
${P} .dm-f-mt-segno{font-size:54px;line-height:1}
${P} .dm-f-mt-gradi{font-family:Oswald,Inter,system-ui,sans-serif;font-size:44px;font-weight:600;line-height:1;color:var(--text,#0f172a)}
${P} .dm-f-mt-cielo{margin-top:4px;font-size:13px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim,#64748b)}
${P} .dm-f-mt-sotto{font-size:14px;color:var(--text-dim,#64748b)}
${P} .dm-f-mt-sotto b{color:var(--text,#0f172a)}
${P} .dm-f-mt-frase{display:flex;align-items:center;gap:10px;margin:0;padding:10px 12px;border-radius:12px;
  background:color-mix(in srgb,var(--mt) 10%,transparent);font-size:14px}
${P} .dm-f-mt-frase>span:first-child{font-size:22px}
${P} .dm-f-mt-frase small{display:block;color:var(--text-dim,#64748b);font-size:12px;margin-top:2px}
${P} .dm-f-mt-pills{display:flex;flex-wrap:wrap;gap:6px}
${P} .dm-f-mt-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:13px;
  color:var(--text-dim,#64748b);background:color-mix(in srgb,var(--text,#0f172a) 5%,transparent)}
${P} .dm-f-mt-pill b{color:var(--text,#0f172a)}
${P} .dm-f-mt-ore{display:grid;grid-auto-flow:column;grid-auto-columns:64px;gap:6px;overflow-x:auto;padding-bottom:4px;scroll-snap-type:x mandatory}
${P} .dm-f-mt-ora{display:grid;justify-items:center;gap:4px;padding:10px 4px;border-radius:14px;scroll-snap-align:start;
  background:color-mix(in srgb,var(--text,#0f172a) 4%,transparent)}
${P} .dm-f-mt-ora.adesso{background:color-mix(in srgb,var(--mt) 16%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--mt) 35%,transparent)}
${P} .dm-f-mt-h{font-size:12px;font-weight:800;color:var(--text-dim,#64748b)}
${P} .dm-f-mt-ic{font-size:22px;line-height:1}
${P} .dm-f-mt-ora b{font-size:16px;color:var(--text,#0f172a)}
${P} .dm-f-mt-ora small{font-size:11px;font-weight:800;color:var(--text-dim,#64748b)}
${P} .dm-f-mt-ora small[data-bagnata="true"]{color:var(--mt)}
${P} .dm-f-mt-giorni{display:grid;gap:4px}
${P} .dm-f-mt-giorno{display:grid;grid-template-columns:48px 28px 52px 34px minmax(40px,1fr) 34px;align-items:center;gap:8px;
  padding:8px 10px;border-radius:12px;background:color-mix(in srgb,var(--text,#0f172a) 4%,transparent);font-size:14px}
${P} .dm-f-mt-g{font-weight:900;color:var(--text,#0f172a)}
${P} .dm-f-mt-pp{font-size:11px;font-weight:800;color:var(--mt)}
${P} .dm-f-mt-min{text-align:right;color:var(--text-dim,#64748b);font-weight:700}
${P} .dm-f-mt-max{font-weight:900;color:var(--text,#0f172a)}
${P} .dm-f-mt-barra{position:relative;height:6px;border-radius:999px;background:color-mix(in srgb,var(--text,#0f172a) 9%,transparent)}
${P} .dm-f-mt-barra i{position:absolute;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,#38bdf8,#f59e0b)}
html[data-theme="dark"] ${P} .dm-f-mt-frase{background:color-mix(in srgb,var(--mt) 22%,transparent)}
`;

registraFinestra("meteo", { disegna: finestraMeteo, sottotitolo: sottotitoloMeteo, stile: STILE });
