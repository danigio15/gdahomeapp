/* La pressione disegnata: il manometro con la sua forcella e la linea delle
 * ultime ventiquattr'ore.
 *
 * La usano due finestre — il solare termico e Acqua e gas — e le finestre non
 * si importano fra loro: ogni gruppo registra le sue e non tocca le altre.
 * Qui c'e' solo il disegno, senza registrare niente. Le regole di stile
 * (`.dm-f-solare-pr`, `.dm-f-solare-linea`, ...) stanno nel foglio del solare,
 * che e' un foglio solo per tutte le finestre. */

import { clean, disegnoDiCasa, esc, formatNumber, t } from "../shared.js";
import { puntiDi } from "../storico-condiviso-section.js";

function numero(valore) {
  if (valore === null || valore === undefined || valore === "") return null;
  const letto = Number(valore);
  return Number.isFinite(letto) ? letto : null;
}

const unito = (testo) => String(testo ?? "").replace(/ (?=\S+$)/, "\u00a0");

/* La pressione «nella norma» di un circuito solare chiuso: sotto un bar e
 * mezzo il circuito ha perso liquido (o il vaso d'espansione si e' scaricato),
 * sopra i quattro si avvicina alla valvola di sicurezza, che di solito apre a
 * sei. Il quadrante va da zero a sei, come quello del manometro vero. */
export const PRESSIONE_NORMA = Object.freeze({ min: 1.5, max: 4, fondo: 6 });

/** Com'e' la pressione: `"bassa"`, `"norma"`, `"alta"`, o `""` se non c'e'. */
export function comeStaLaPressione(bar, norma = PRESSIONE_NORMA) {
  const valore = numero(bar);
  if (valore == null) return "";
  if (valore < norma.min) return "bassa";
  if (valore > norma.max) return "alta";
  return "norma";
}

/* Il manometro disegnato: l'arco di 240 gradi da zero al fondo scala, la
 * fascia verde della norma, le due rosa fuori, e la lancetta sul valore. */
function manometro(bar, norma = PRESSIONE_NORMA) {
  const fondo = Math.max(norma.fondo, Math.ceil(Number(bar) || 0));
  const angolo = (valore) => -210 + (240 * Math.max(0, Math.min(fondo, valore))) / fondo;
  const punto = (gradi, raggio) => {
    const r = (gradi * Math.PI) / 180;
    return [32 + raggio * Math.cos(r), 32 + raggio * Math.sin(r)].map((n) => n.toFixed(2));
  };
  const arco = (da, a, colore) => {
    const [x1, y1] = punto(angolo(da), 22);
    const [x2, y2] = punto(angolo(a), 22);
    const grande = angolo(a) - angolo(da) > 180 ? 1 : 0;
    return `<path d="M${x1} ${y1}A22 22 0 ${grande} 1 ${x2} ${y2}" fill="none" stroke="${colore}" stroke-width="6"/>`;
  };
  const [lx, ly] = punto(angolo(Number(bar) || 0), 17);
  return `<svg class="dm-f-solare-manometro" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="var(--card-bg,#fff)" stroke="color-mix(in srgb,var(--text-dim,#94a3b8) 45%,transparent)" stroke-width="3.5"/>${arco(
    0,
    norma.min,
    "#fca5a5",
  )}${arco(norma.min, norma.max, "#86efac")}${arco(norma.max, fondo, "#fca5a5")}<path d="M32 32L${lx} ${ly}" stroke="var(--text,#0f172a)" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="32" r="4.5" fill="var(--text,#0f172a)"/></svg>`;
}

/* La linea delle ultime ventiquattr'ore, con la fascia della norma dietro.
 *
 * «Pressione: mostra un grafico, qualcosa di più bello oltre a un dato così
 * statico.» Un numero solo non dice se la pressione e' ferma o se sta
 * calando da ieri, che e' la cosa che fa chiamare il tecnico. Lo storico
 * arriva da Recorder (`storico-condiviso-section.js`, lo stesso padrone del
 * grafico delle temperature): finche' non c'e' — o se la casa Recorder non
 * ce l'ha — la linea non compare e resta il manometro. */
function lineaDellaPressione(punti, norma = PRESSIONE_NORMA) {
  if (!Array.isArray(punti) || punti.length < 2) return "";
  const valori = punti.map((punto) => punto.valore);
  const basso = Math.min(...valori, norma.min) - 0.2;
  const alto = Math.max(...valori, norma.max) + 0.2;
  const inizio = punti[0].quando;
  const fine = punti[punti.length - 1].quando;
  const durata = Math.max(1, fine - inizio);
  const x = (quando) => ((200 * (quando - inizio)) / durata).toFixed(1);
  const y = (valore) => (4 + (40 * (alto - valore)) / (alto - basso)).toFixed(1);
  /* A gradini: Recorder scrive quando lo stato cambia, e fra due letture la
   * pressione e' rimasta quella di prima. */
  let tratto = `M${x(punti[0].quando)} ${y(punti[0].valore)}`;
  for (let i = 1; i < punti.length; i += 1)
    tratto += `H${x(punti[i].quando)}V${y(punti[i].valore)}`;
  const ultimo = punti[punti.length - 1];
  return `<div class="dm-f-solare-linea"><svg viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="${y(
    norma.max,
  )}" width="200" height="${(Number(y(norma.min)) - Number(y(norma.max))).toFixed(1)}" fill="color-mix(in srgb,#16a34a 12%,transparent)"/><path d="${tratto}" fill="none" stroke="var(--dm-widget-accent,#ea580c)" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${x(
    ultimo.quando,
  )}" cy="${y(ultimo.valore)}" r="3" fill="var(--dm-widget-accent,#ea580c)" vector-effect="non-scaling-stroke"/></svg><span class="dm-f-solare-asse"><small>${esc(
    t("24 h fa", "24 h ago"),
  )}</small><small>${esc(t("adesso", "now"))}</small></span></div>`;
}

/* La casella della pressione: il manometro, il numero, se e' nella norma, e
 * sotto la sua giornata. */
/* La usa anche Acqua e gas, con la forcella che quella pagina si e' data. */
export function casellaDellaPressione(riga, storia, norma = PRESSIONE_NORMA) {
  const bar = numero(riga?.raw);
  if (bar == null) return "";
  const come = comeStaLaPressione(bar, norma);
  const cifre = (valore) => formatNumber(valore, Number.isInteger(valore) ? 0 : 1);
  const fascia = `(${cifre(norma.min)}–${cifre(norma.max)})`;
  const parola =
    come === "bassa"
      ? t("bassa", "low")
      : come === "alta"
        ? t("alta", "high")
        : t("nella norma", "normal");
  return `<div class="dm-f-solare-gr dm-f-solare-pressione" data-come="${come}">
      <small class="dm-f-solare-gr-tit"><i aria-hidden="true">${disegnoDiCasa("gauge", { misura: 22 })}</i>${esc(t("Pressione", "Pressure"))}</small>
      <div class="dm-f-solare-pr">${manometro(bar, norma)}<div><span class="dm-f-num">${esc(unito(clean(riga.value) || `${formatNumber(bar, 1)} bar`))}</span><em><i aria-hidden="true"></i>${esc(
        parola,
      )} ${esc(fascia)}</em></div></div>
      ${lineaDellaPressione(storia, norma)}
    </div>`;
}

/* Le ventiquattr'ore della pressione, se lo storico le ha gia' date. Non si
 * aspetta: la finestra si apre col manometro, e quando la risposta arriva la
 * Home ridisegna (`quandoArrivaLoStorico`). */
export function storiaDellaPressione(riga) {
  const entita = clean(riga?.entity);
  if (!entita) return null;
  const vivo = numero(riga?.raw);
  try {
    return puntiDi(
      entita,
      24,
      vivo != null ? { adesso: { quando: Date.now(), valore: vivo } } : {},
    );
  } catch (_errore) {
    return null;
  }
}
