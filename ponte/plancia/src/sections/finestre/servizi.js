/* Le finestre dei widget del gruppo «servizi» (vedi `../finestre-dei-widget.js`).
 *
 * Aria, piante, acquario, animali, agenda, rifiuti, allerte e stampanti: le
 * tessere che non comandano un impianto ma raccontano una cosa di casa. Ogni
 * finestra apre col numero che conta in grande, poi l'elenco intero ordinato
 * da chi ha bisogno di qualcosa, e i comandi dove ci sono davvero.
 *
 * Il colore e' quello della sezione, non quello del giudizio: un'aria scarsa
 * non tinge di arancio tutta la finestra come se fosse un allarme. Il colore
 * del giudizio resta sulle barrette e sulle pastiglie, dove dice qualcosa.
 *
 * Quello che una casa non ha non si inventa: senza il dato la riga non c'e'.
 */
import { registraFinestra, tastoServizio } from "../finestre-dei-widget.js";
import {
  clean,
  disegnoDiCasa,
  esc,
  formatNumber,
  locale,
  nomeDellEntita,
  siComanda,
  stanzaDiHomeAssistant,
  t,
} from "../shared.js";
import { GRADI, parolaDelGrado, valoreScritto } from "../../core/aria-model.js";
import {
  agendaPerGiorno,
  chiaveDelGiorno,
  etichettaDelGiorno,
  inCorso,
  orarioDi,
  prossimiEventi,
  scadenzeDelleListe,
  voceConScadenza,
} from "../../core/calendario-model.js";
import { TINTE_DELLE_CARTUCCE, COLORE_SENZA_TINTA } from "../../core/stampanti-model.js";
import { disegnoDelBidone } from "../../core/disegni-rifiuti.js";
import { disegnoDelCatalogo } from "../../core/catalogo-disegni.js";
import { pressioneDellAzione } from "../../core/animali-model.js";
import { IGNOTO } from "../../core/allerte-model.js";

/* I colori delle sezioni, quelli delle bozze approvate. */
const COLORI = Object.freeze({
  aria: "#0d9488",
  piante: "#16a34a",
  acquario: "#0284c7",
  animali: "#ea580c",
  agenda: "#4f46e5",
  rifiuti: "#16a34a",
  allerte: "#d97706",
  stampanti: "#0284c7",
});

export const FINESTRE_SERVIZI = Object.freeze(Object.keys(COLORI));

const P = ":is(#dm-widget-popup,#dm-casa-popup,#dm-qa-popup)";
const GIORNO_MS = 86400000;

/* ── i pezzi comuni ──────────────────────────────────────────────────── */

const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/* La pastiglia: verde, ambra, rossa, o nel colore della sezione. */
function pastiglia(tono, testo) {
  return `<span class="dm-f-sv-pill" data-tono="${esc(tono)}"><i aria-hidden="true"></i>${esc(testo)}</span>`;
}

/* La barretta di un livello, larga quanto il livello. */
function barretta(quota, colore = "") {
  const quanto = Math.max(0, Math.min(100, Math.round(Number(quota) || 0)));
  return `<span class="dm-f-sv-barra" aria-hidden="true" style="--w:${quanto}%${
    colore ? `;--c:${esc(colore)}` : ""
  }"></span>`;
}

const titoletto = (testo) => `<h4 class="dm-f-sv-tit">${esc(testo)}</h4>`;

/* Il giorno della settimana, scritto per intero o in breve, nella lingua di casa. */
function giornoDellaSettimana(istante, forma = "long") {
  try {
    const parola = new Date(istante).toLocaleDateString(locale() || undefined, { weekday: forma });
    return parola.charAt(0).toUpperCase() + parola.slice(1);
  } catch (_errore) {
    return "";
  }
}

function giornoEMese(istante) {
  try {
    return new Date(istante).toLocaleDateString(locale() || undefined, {
      weekday: "short",
      day: "numeric",
    });
  } catch (_errore) {
    return "";
  }
}

/* Mezzanotte di oggi, piu' `giorni`: il giorno di calendario, non 24 ore. */
function giornoDaOggi(giorni, adesso = Date.now()) {
  const oggi = new Date(adesso);
  return new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + giorni).getTime();
}

/* «Fra 3 giorni», «fra 1 giorno»: il numero fuori dal testo. */
function fraGiorni(giorni) {
  if (giorni === 0) return t("oggi", "today");
  if (giorni === 1) return t("domani", "tomorrow");
  return `${t("fra", "in")} ${giorni} ${t("giorni", "days")}`;
}

/* Quanto tempo fa, in parole: minuti, ore o giorni. */
function quantoFa(istante, adesso = Date.now()) {
  const minuti = Math.max(0, Math.round((adesso - istante) / 60000));
  if (minuti < 1) return t("adesso", "just now");
  if (minuti < 60) return `${minuti} ${t("min fa", "min ago")}`;
  const ore = Math.round(minuti / 60);
  if (ore < 48) return `${ore} ${ore === 1 ? t("ora fa", "hour ago") : t("ore fa", "hours ago")}`;
  const giorni = Math.round(ore / 24);
  return `${giorni} ${t("giorni fa", "days ago")}`;
}

/* Il tasto che accende e spegne un'entita', col servizio del suo dominio. */
function comandoAccendiSpegni(entity) {
  const dominio = clean(entity).split(".")[0];
  const proprio = ["light", "switch", "fan", "input_boolean", "humidifier", "siren"].includes(
    dominio,
  );
  return {
    domain: proprio ? dominio : "homeassistant",
    service: "toggle",
    data: { entity_id: clean(entity) },
  };
}

/* ── l'aria ──────────────────────────────────────────────────────────── */

const COLORE_DEL_GRADO = Object.freeze({
  buona: "#22c55e",
  discreta: "#a3e635",
  scarsa: "#f59e0b",
  cattiva: "#f97316",
});

const TONO_DEL_GRADO = Object.freeze({
  buona: "ok",
  discreta: "occhio",
  scarsa: "occhio",
  cattiva: "rosso",
});

/* La sostanza con un nome che si capisce: «PM2.5» da solo non lo sa nessuno. */
function nomeDellaSostanza(lettura) {
  switch (lettura?.classe) {
    case "pm25":
      return t("Polveri fini PM2.5", "Fine dust PM2.5");
    case "pm10":
      return t("Polveri PM10", "Dust PM10");
    case "pm1":
      return t("Polveri finissime PM1", "Ultrafine dust PM1");
    case "volatile_organic_compounds":
    case "volatile_organic_compounds_parts":
      return t("Composti volatili (cottura, detersivi)", "Volatile compounds (cooking, cleaners)");
    default:
      return clean(lettura?.misura);
  }
}

/* Cosa dire in cima, sopra il numero: il giudizio in parole che chiedono. */
function richiestaDelGrado(grado) {
  switch (grado) {
    case "cattiva":
      return t("Da cambiare subito", "Change it now");
    case "scarsa":
      return t("Da cambiare", "Needs changing");
    case "discreta":
      return t("Discreta", "Fair");
    default:
      return t("Aria buona", "Good air");
  }
}

/* Il consiglio, solo dove la risposta e' ovvia. */
function consiglioDellAria(lettura) {
  if (!lettura || (lettura.grado !== "scarsa" && lettura.grado !== "cattiva")) return "";
  const stessaUnita =
    clean(lettura.unita).toLowerCase() === clean(lettura.unitaDiRiferimento).toLowerCase();
  if (lettura.classe === "carbon_dioxide") {
    const sotto = Number(lettura.soglie?.[0]);
    const quanto =
      stessaUnita && Number.isFinite(sotto)
        ? ` ${t("Torna sotto", "It drops below")} ${formatNumber(sotto, 0)} ${lettura.unita}.`
        : "";
    return `🪟 ${t("Apri una finestra per qualche minuto.", "Open a window for a few minutes.")}${quanto}`;
  }
  if (String(lettura.classe).startsWith("volatile"))
    return `🪟 ${t("Arieggia: cottura e detersivi li fanno salire.", "Air the room: cooking and cleaners push them up.")}`;
  if (String(lettura.classe).startsWith("pm"))
    return `🚪 ${t("Se fuori l'aria è peggio, tieni chiuse le finestre.", "If the air outside is worse, keep the windows shut.")}`;
  return "";
}

/* La scala dei quattro gradini, con l'indicatore dove sta la lettura. */
function scalaDellAria(lettura) {
  const soglie = (lettura?.soglie || []).map(Number);
  if (soglie.length !== 3 || soglie.some((s) => !Number.isFinite(s) || s <= 0)) return "";
  /* I gradini non sono larghi quanto i numeri: «buona» si prende il 40%, gli
   * altri il loro pezzo, e l'ultimo tratto arriva a una volta e mezza il
   * terzo confine. Cosi' le tacche non si pestano. */
  const punti = [0, soglie[0], soglie[1], soglie[2], soglie[2] * 1.5];
  const posti = [0, 40, 55, 75, 100];
  const dove = (valore) => {
    if (!(valore > 0)) return 0;
    for (let i = 1; i < punti.length; i += 1)
      if (valore <= punti[i])
        return (
          posti[i - 1] +
          ((valore - punti[i - 1]) / (punti[i] - punti[i - 1])) * (posti[i] - posti[i - 1])
        );
    return 100;
  };
  const [uno, due, tre] = soglie.map((s) => dove(s).toFixed(1));
  const x = Math.max(2, Math.min(98, dove(Number(lettura.confronto) || 0)));
  /* Le tacche coi numeri solo se il sensore parla nell'unita' della scala:
   * accanto a un valore in µg/m³, dei confini in mg/m³ confonderebbero. */
  const stessaUnita =
    clean(lettura.unita).toLowerCase() === clean(lettura.unitaDiRiferimento).toLowerCase();
  const tacca = (valore, posto, coda = "") =>
    `<span style="left:${posto}%">${esc(formatNumber(valore, valore < 10 ? 1 : 0))}${coda ? ` ${esc(coda)}` : ""}</span>`;
  return `<div class="dm-f-aria-scala" aria-hidden="true"
      style="--s1:${uno}%;--s2:${due}%;--s3:${tre}%;--x:${x.toFixed(1)}%"><b></b></div>
    <div class="dm-f-aria-tacche" aria-hidden="true">
      <span class="dm-f-aria-buona">${esc(parolaDelGrado("buona", locale()))}</span>
      ${
        stessaUnita
          ? `${tacca(soglie[0], uno)}${tacca(soglie[1], due)}${tacca(soglie[2], tre)}`
          : `<span class="dm-f-aria-cattiva">${esc(parolaDelGrado("cattiva", locale()))}</span>`
      }
    </div>`;
}

function finestraAria(widget) {
  const letture = (widget.rows || []).map((riga) => riga.lettura).filter(Boolean);
  const copertina = widget.copertina || widget.peggiore || letture[0];
  if (!copertina) return "";
  const stanzaDi = (lettura) => clean(stanzaDiHomeAssistant(lettura.entity));
  const dove = stanzaDi(copertina) || clean(copertina.name);
  const numeroGrande = valoreScritto(copertina, locale());
  const consiglio = consiglioDellAria(widget.peggiore || copertina);
  const eroe = `<section class="dm-f-sv-eroe dm-f-aria-eroe">
      <small>${esc([richiestaDelGrado(widget.grado || copertina.grado), dove].filter(Boolean).join(" · "))}</small>
      <div class="dm-f-aria-su">
        <span class="dm-f-sv-num dm-f-sv-grande">${esc(numeroGrande)}</span>
        <span class="dm-f-aria-u">${esc(
          [
            copertina.unita,
            copertina.classe === "carbon_dioxide" ? "CO₂" : nomeDellaSostanza(copertina),
          ]
            .filter(Boolean)
            .join(" · "),
        )}</span>
      </div>
      ${scalaDellAria(copertina)}
      ${consiglio ? `<p class="dm-f-aria-consiglio">${esc(consiglio)}</p>` : ""}
    </section>`;

  /* Stanza per stanza, dalla peggiore. Chi non ha una stanza in Home
   * Assistant finisce in un gruppo suo, e la sua riga porta il nome del
   * sensore: e' l'unico modo di sapere dov'e'. */
  const gruppi = new Map();
  for (const lettura of letture) {
    const stanza = stanzaDi(lettura);
    if (!gruppi.has(stanza)) gruppi.set(stanza, []);
    gruppi.get(stanza).push(lettura);
  }
  const peso = (lettura) => GRADI.indexOf(lettura.grado);
  const ordinati = [...gruppi.entries()]
    .map(([stanza, elenco]) => ({
      stanza,
      elenco: [...elenco].sort((a, b) => peso(b) - peso(a)),
      peggio: elenco.reduce((massimo, voce) => Math.max(massimo, peso(voce)), 0),
    }))
    .sort((a, b) => b.peggio - a.peggio || (a.stanza ? 0 : 1) - (b.stanza ? 0 : 1));
  const stanze = ordinati
    .map(({ stanza, elenco, peggio }) => {
      const grado = GRADI[peggio] || "buona";
      const misure = elenco
        .map(
          (lettura) => `<div class="dm-f-aria-mis" data-grado="${esc(lettura.grado)}">
            <span class="dm-f-aria-n">${esc(nomeDellaSostanza(lettura))}${
              stanza ? "" : `<small>${esc(lettura.name)}</small>`
            }</span>
            <span class="dm-f-aria-v"><span class="dm-f-sv-num">${esc(
              valoreScritto(lettura, locale()),
            )}</span> <small>${esc(lettura.unita)}</small></span>
            ${barretta(lettura.quanto, COLORE_DEL_GRADO[lettura.grado])}
          </div>`,
        )
        .join("");
      return `<article class="dm-f-sv-scheda dm-f-aria-stanza">
          <h5>${esc(stanza || t("Senza stanza", "No room"))}${pastiglia(
            TONO_DEL_GRADO[grado],
            parolaDelGrado(grado, locale()),
          )}</h5>
          ${misure}
        </article>`;
    })
    .join("");
  return `<div class="dm-f-sv dm-f-aria">${eroe}${titoletto(
    t("Stanza per stanza", "Room by room"),
  )}<div class="dm-f-sv-griglia">${stanze}</div></div>`;
}

function sottotitoloAria(widget) {
  const letture = (widget.rows || []).filter((riga) => riga.lettura);
  const stanze = new Set(
    letture.map((riga) => clean(stanzaDiHomeAssistant(riga.entity))).filter(Boolean),
  );
  const misure = `${letture.length} ${letture.length === 1 ? t("misura", "reading") : t("misure", "readings")}`;
  if (!stanze.size) return misure;
  return `${stanze.size} ${stanze.size === 1 ? t("stanza", "room") : t("stanze", "rooms")} · ${misure}`;
}

/* ── le piante ───────────────────────────────────────────────────────── */

/* Dalla piu' asciutta: prima chi ha sete, poi l'umidita' che sale; chi non
 * risponde in fondo. */
function quantoBagnata(pianta) {
  const { umidita } = pianta.lettura;
  if (umidita === null || umidita === undefined) return Infinity;
  return (pianta.stato === "asciutta" ? -1000 : 0) + umidita;
}

function terraMarkup(lettura) {
  const umidita = numero(lettura.umidita);
  const minimo = Math.max(0, Math.min(100, numero(lettura.minimo) ?? 25));
  const massimo = Math.max(minimo, Math.min(100, numero(lettura.massimo) ?? 70));
  return `<span class="dm-f-piante-terra" aria-hidden="true" style="--min:${minimo}%;--max:${massimo}%">${
    umidita === null ? "" : `<i style="--x:${Math.max(1, Math.min(99, umidita)).toFixed(0)}%"></i>`
  }</span>`;
}

function parolaDellaTerra(pianta) {
  if (pianta.stato === "muta") return ["", t("Non risponde", "Not answering")];
  if (pianta.terra === "low") return ["asciutta", t("asciutta", "dry")];
  if (pianta.terra === "high") return ["zuppa", t("zuppa", "soaked")];
  return ["giusta", t("giusta", "just right")];
}

function pioggiaInParole(pioggia) {
  if (!pioggia) return "";
  if (pioggia.fra === null || pioggia.fra === undefined) return t("pioggia oggi", "rain today");
  if (pioggia.fra <= 0) return t("piove adesso", "raining now");
  return `${t("pioggia fra", "rain in")} ${pioggia.fra} ${t("ore", "hours")}`;
}

function finestraPiante(widget) {
  const come = widget.come;
  if (!come?.piante?.length) return "";
  const adesso = Date.now();
  const glifo = (pianta, misura) =>
    disegnoDiCasa(pianta.lettura.icon, { misura, ripiego: "plant" });
  let eroe = "";
  const sete = come.daInnaffiare || [];
  if (sete.length) {
    const [prima] = sete;
    const acqua = prima.ultimaAcqua
      ? ` · ${t("ultima acqua", "last watered")} ${quantoFa(prima.ultimaAcqua, adesso)}`
      : "";
    eroe = `<section class="dm-f-sv-eroe dm-f-piante-eroe">
        <span class="dm-f-piante-vaso" aria-hidden="true">${glifo(prima, 48)}</span>
        <div>
          <small>${esc(t("Da innaffiare oggi", "Water today"))}${
            sete.length > 1 ? ` · +${sete.length - 1}` : ""
          }</small>
          <b>${esc(prima.lettura.name)}</b>
          <p><span class="dm-f-sv-num">${esc(formatNumber(prima.lettura.umidita, 0))}%</span> ${esc(
            t("di umidità", "moisture"),
          )}${esc(acqua)}</p>
        </div>
      </section>
      <p class="dm-f-sv-nota">💧 ${esc(
        t(
          "Quando la innaffi la plancia se ne accorge da sola: la terra risale e la pianta torna in fondo alla lista.",
          "When you water it the dashboard notices by itself: the soil comes back up and the plant goes back to the bottom of the list.",
        ),
      )}</p>`;
  } else if (come.aspettano?.length) {
    const [prima] = come.aspettano;
    eroe = `<section class="dm-f-sv-eroe dm-f-piante-eroe">
        <span class="dm-f-piante-vaso" aria-hidden="true">${glifo(prima, 48)}</span>
        <div>
          <small>${esc(t("Aspetta la pioggia", "Waiting for the rain"))}</small>
          <b>${esc(prima.lettura.name)}</b>
          <p>${esc(pioggiaInParole(prima.pioggia || come.pioggia))}</p>
        </div>
      </section>`;
  } else if (come.prossima) {
    const prossima = come.prossima;
    eroe = `<section class="dm-f-sv-eroe dm-f-piante-eroe">
        <span class="dm-f-piante-vaso" aria-hidden="true">${glifo(prossima, 48)}</span>
        <div>
          <small>${esc(t("Tutte a posto", "All fine"))}</small>
          <b>${esc(prossima.lettura.name)}</b>
          <p>${esc(t("la prossima da innaffiare", "the next to water"))} · ${esc(fraGiorni(Math.max(0, Math.round(prossima.giorni))))}</p>
        </div>
      </section>`;
  }
  const ordinate = [...come.piante].sort((a, b) => quantoBagnata(a) - quantoBagnata(b));
  const righe = ordinate
    .map((pianta) => {
      const { lettura } = pianta;
      const [tono, parola] = parolaDellaTerra(pianta);
      const sotto = [];
      if (lettura.fuori) {
        sotto.push(t("fuori", "outdoors"));
        const pioggia = pioggiaInParole(pianta.pioggia || come.pioggia);
        if (pioggia) sotto.push(pioggia);
      }
      if (lettura.minimo !== 25 || lettura.massimo !== 70)
        sotto.push(
          `${t("vuole fra", "likes between")} ${lettura.minimo} ${t("e", "and")} ${lettura.massimo}%`,
        );
      if (lettura.gradi !== null && lettura.gradi !== undefined)
        sotto.push(`${t("terra", "soil")} ${formatNumber(lettura.gradi, 1)}°`);
      return `<div class="dm-f-sv-riga" data-stato="${esc(pianta.stato)}">
          <span class="dm-f-sv-ic" aria-hidden="true">${glifo(pianta, 22)}</span>
          <span class="dm-f-sv-nome"><b>${esc(lettura.name)}</b>${
            sotto.length ? `<em>${esc(sotto.join(" · "))}</em>` : ""
          }${terraMarkup(lettura)}</span>
          <span class="dm-f-sv-val">${
            lettura.umidita === null
              ? ""
              : `<span class="dm-f-sv-num">${esc(formatNumber(lettura.umidita, 0))}%</span>`
          }<em data-tono="${esc(tono)}">${esc(parola)}</em></span>
        </div>`;
    })
    .join("");
  const legenda = `<div class="dm-f-piante-leg" aria-hidden="true">
      <span><b data-t="asciutta"></b>${esc(t("asciutta", "dry"))}</span>
      <span><b data-t="giusta"></b>${esc(t("giusta", "just right"))}</span>
      <span><b data-t="zuppa"></b>${esc(t("zuppa", "soaked"))}</span>
    </div>`;
  return `<div class="dm-f-sv dm-f-piante">${eroe}${titoletto(
    t("Tutte, dalla più asciutta", "All of them, driest first"),
  )}${legenda}<div class="dm-f-sv-elenco">${righe}</div></div>`;
}

function sottotitoloPiante(widget) {
  const come = widget.come;
  if (!come?.piante?.length) return "";
  const tutte = come.piante.length;
  const sete = come.daInnaffiare?.length || 0;
  const pezzi = [`${tutte} ${tutte === 1 ? t("pianta", "plant") : t("piante", "plants")}`];
  if (sete)
    pezzi.push(
      `${sete} ${sete === 1 ? t("ha sete", "is thirsty") : t("hanno sete", "are thirsty")}`,
    );
  return pezzi.join(" · ");
}

/* ── l'acquario ──────────────────────────────────────────────────────── */

const forcellaScritta = (minimo, massimo, unita = "") =>
  `${formatNumber(minimo, minimo % 1 ? 1 : 0)}–${formatNumber(massimo, massimo % 1 ? 1 : 0)}${unita}`;

function parolaDellaForcella(lettura, verdetto) {
  if (lettura.muto) return ["", t("Non risponde", "Not answering")];
  if (lettura.minimo === null || lettura.massimo === null) return ["", ""];
  const quale = forcellaScritta(lettura.minimo, lettura.massimo);
  if (verdetto === "low") return ["rosso", `${t("basso", "low")} (${quale})`];
  if (verdetto === "high") return ["rosso", `${t("alto", "high")} (${quale})`];
  return ["ok", `${t("giusto", "right")} (${quale})`];
}

function nomeDellaMisura(lettura) {
  if (lettura.genere === "ph") return "pH";
  return clean(lettura.name);
}

function valoreDellaMisura(lettura) {
  if (lettura.valore === null || lettura.valore === undefined) return "—";
  const cifre = Math.abs(lettura.valore) >= 100 ? 0 : 1;
  return `${formatNumber(lettura.valore, cifre)}${lettura.unita ? ` ${lettura.unita}` : ""}`;
}

function vascaMarkup(vasca, piuVasche) {
  const { come, testa, tipo } = vasca;
  const caldo = come.misure.find(
    (voce) => voce.lettura.genere === "temperatura" && !voce.lettura.muto,
  );
  const tonoTesta =
    come.stato === "fuori"
      ? "rosso"
      : come.stato === "bene"
        ? "ok"
        : come.stato === "mute"
          ? ""
          : "occhio";
  const parolaTesta =
    come.stato === "bene" ? t("Tutto regolare", "All normal") : testa?.grande || "";
  let eroe = "";
  if (caldo) {
    const { lettura } = caldo;
    const ha = lettura.minimo !== null && lettura.massimo !== null;
    let forcella = "";
    if (ha) {
      const ampiezza = lettura.massimo - lettura.minimo;
      const basso = lettura.minimo - ampiezza * 0.75;
      const alto = lettura.massimo + ampiezza * 0.75;
      const x = Math.max(2, Math.min(98, ((lettura.valore - basso) / (alto - basso)) * 100));
      forcella = `<div class="dm-f-acquario-forc" aria-hidden="true" style="--x:${x.toFixed(1)}%"><b></b></div>
        <div class="dm-f-acquario-tacche" aria-hidden="true">
          <span>${esc(formatNumber(basso, 0))}°</span>
          <span>${esc(t("giusta", "right"))} ${esc(forcellaScritta(lettura.minimo, lettura.massimo, "°"))}</span>
          <span>${esc(formatNumber(alto, 0))}°</span>
        </div>`;
    }
    eroe = `<section class="dm-f-sv-eroe dm-f-acquario-eroe" data-tipo="${esc(tipo)}">
        <small>${esc(
          tipo === "terrario"
            ? t("Il terrario adesso", "The terrarium now")
            : t("L'acqua adesso", "The water now"),
        )}</small>
        <div class="dm-f-acquario-su">
          <span class="dm-f-sv-num dm-f-sv-grande">${esc(formatNumber(lettura.valore, 1))}°</span>
          ${parolaTesta ? pastiglia(tonoTesta, parolaTesta) : ""}
        </div>
        ${forcella}
      </section>`;
  } else if (parolaTesta) {
    eroe = `<section class="dm-f-sv-eroe dm-f-acquario-eroe" data-tipo="${esc(tipo)}">
        <small>${esc(tipo === "terrario" ? t("Il terrario adesso", "The terrarium now") : t("L'acqua adesso", "The water now"))}</small>
        <div class="dm-f-acquario-su">${pastiglia(tonoTesta, parolaTesta)}</div>
        ${testa?.nomi && come.stato !== "bene" ? `<p>${esc(testa.nomi)}</p>` : ""}
      </section>`;
  }

  const caselle = [
    ...come.misure
      .filter((voce) => voce !== caldo)
      .map(({ lettura, verdetto }) => {
        const [tono, parola] = parolaDellaForcella(lettura, verdetto);
        return `<div class="dm-f-acquario-cas">
            <small${lettura.genere === "ph" ? ' data-sigla="true"' : ""}>${esc(nomeDellaMisura(lettura))}</small>
            <span class="dm-f-sv-num">${esc(valoreDellaMisura(lettura))}</span>
            ${parola ? `<em data-tono="${esc(tono)}">${esc(parola)}</em>` : ""}
          </div>`;
      }),
    ...come.livelli.map(({ lettura, basso, giorni }) => {
      const [tono, parola] = lettura.muto
        ? ["", t("Non risponde", "Not answering")]
        : basso
          ? ["rosso", t("da rabboccare", "to top up")]
          : giorni !== null && giorni !== undefined
            ? ["ok", `${t("rabbocco", "top-up")} ${fraGiorni(Math.max(0, Math.round(giorni)))}`]
            : ["ok", t("nella norma", "in range")];
      return `<div class="dm-f-acquario-cas">
          <small>${esc(clean(lettura.name))}</small>
          <span class="dm-f-sv-num">${esc(lettura.binario ? (basso ? "↓" : "✓") : valoreDellaMisura(lettura))}</span>
          <em data-tono="${esc(tono)}">${esc(parola)}</em>
        </div>`;
    }),
  ].join("");

  const tasti = come.comandi
    .map((lettura) => {
      const acceso = lettura.acceso === true;
      const icona = disegnoDiCasa(lettura.icon, { misura: 22, ripiego: "toggle" });
      const corpo = `<span class="dm-f-sv-tic" aria-hidden="true">${icona}</span>
        <span class="dm-f-sv-tt"><b>${esc(clean(lettura.name))}</b><em>${esc(
          lettura.muto
            ? t("Non risponde", "Not answering")
            : acceso
              ? t("Accesa", "On")
              : t("Spenta", "Off"),
        )}</em></span>`;
      if (lettura.muto || !siComanda(lettura.entity))
        return `<div class="dm-f-sv-tasto" data-on="${acceso}" data-fermo="true">${corpo}</div>`;
      return tastoServizio(comandoAccendiSpegni(lettura.entity), {
        classe: "dm-f-sv-tasto",
        testo: corpo,
        attributi: `data-on="${acceso}" aria-pressed="${acceso}" aria-label="${esc(clean(lettura.name))}"`,
      });
    })
    .join("");

  const cambio = come.cambio;
  let manutenzione = "";
  if (cambio && cambio.giorni !== null && cambio.giorni !== undefined) {
    const quando =
      cambio.giorni === 0
        ? t("oggi", "today")
        : cambio.giorni === 1
          ? t("ieri", "yesterday")
          : `${cambio.giorni} ${t("giorni fa", "days ago")}`;
    const prossimo =
      cambio.fra === null || cambio.fra === undefined
        ? ""
        : cambio.fra <= 0
          ? ` · ${t("da rifare adesso", "due now")}`
          : ` · ${t("il prossimo", "next one")} ${fraGiorni(cambio.fra)}`;
    manutenzione = `<p class="dm-f-sv-nota" data-tono="${cambio.scaduto ? "occhio" : ""}">${
      tipo === "terrario" ? "🧽" : "🪣"
    } ${esc(
      tipo === "terrario" ? t("Pulizia", "Cleaning") : t("Cambio d'acqua", "Water change"),
    )}: ${esc(quando)}${esc(prossimo)}</p>`;
  }

  const nome = piuVasche
    ? `<h5 class="dm-f-acquario-nome">${esc(
        [come.vasca, come.litri ? `${formatNumber(come.litri, 0)} L` : ""]
          .filter(Boolean)
          .join(" · "),
      )}</h5>`
    : "";
  return `<section class="dm-f-acquario-vasca">${nome}${eroe}${
    caselle
      ? `${titoletto(tipo === "terrario" ? t("Le misure", "Readings") : t("I valori dell'acqua", "Water values"))}<div class="dm-f-acquario-due">${caselle}</div>`
      : ""
  }${tasti ? `${titoletto(t("Comandi", "Controls"))}<div class="dm-f-sv-tasti">${tasti}</div>` : ""}${manutenzione}</section>`;
}

function finestraAcquario(widget) {
  const elenco = widget.elenco || [];
  if (!elenco.length) return "";
  return `<div class="dm-f-sv dm-f-acquario">${elenco
    .map((vasca) => vascaMarkup(vasca, elenco.length > 1))
    .join("")}</div>`;
}

function sottotitoloAcquario(widget) {
  const elenco = widget.elenco || [];
  if (elenco.length === 1) {
    const { come } = elenco[0];
    return [clean(come.vasca), come.litri ? `${formatNumber(come.litri, 0)} L` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  if (!elenco.length) return "";
  const guardare = elenco.filter((vasca) => !["bene", "mute"].includes(vasca.come.stato)).length;
  return [
    `${elenco.length} ${t("vasche", "tanks")}`,
    guardare ? `${guardare} ${t("da guardare", "to check")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/* ── gli animali ─────────────────────────────────────────────────────── */

/* L'avviso detto come una cosa da fare. */
function fraseDellAvviso(avviso) {
  switch (avviso?.chiave) {
    case "cibo_scarso":
      return `🥣 ${t("Crocchette quasi finite: riempi il distributore.", "Kibble almost gone: refill the feeder.")}`;
    case "acqua_scarsa":
      return `💧 ${t("Acqua quasi finita: riempi la fontanella.", "Water almost gone: refill the fountain.")}`;
    case "filtro_finito":
      return `🔁 ${t("Il filtro dell'acqua va cambiato.", "The water filter needs changing.")}`;
    case "lettiera_piena":
      return `🗑️ ${t("Il cassetto della lettiera è pieno: svuotalo.", "The litter drawer is full: empty it.")}`;
    case "sabbia_scarsa":
      return `🪣 ${t("La sabbia sta finendo: aggiungine.", "Litter is running out: top it up.")}`;
    case "lettiera_da_pulire":
      return `🧹 ${t("La lettiera va pulita.", "The litter box needs cleaning.")}`;
    case "collare_scarico":
      return `🔋 ${t("Il collare è quasi scarico: mettilo in carica.", "The collar is almost flat: charge it.")}`;
    default:
      return clean(avviso?.testo);
  }
}

const COLORE_DEL_LIVELLO = Object.freeze({
  cibo_livello: "#f59e0b",
  acqua_livello: "#0ea5e9",
  lettiera_sabbia: "#a8a29e",
  lettiera_riempimento: "#a8a29e",
  acqua_filtro: "#14b8a6",
  collare_batteria: "#22c55e",
});

/* Le letture che stanno sotto il nome invece che in una casella. */
const SOTTO_IL_NOME = new Set([
  "cibo_ultima",
  "lettiera_ultima",
  "lettiera_visite",
  "porta",
  "collare_posizione",
]);

/* Prima quello che si mangia e si beve, poi la lettiera, poi il resto. */
const ORDINE_DEI_LIVELLI = Object.freeze([
  "cibo_livello",
  "acqua_livello",
  "lettiera_sabbia",
  "lettiera_riempimento",
  "acqua_filtro",
  "collare_batteria",
  "peso",
]);

function sottoIlNome(scheda) {
  const pezzi = [];
  const di = (chiave) => scheda.letture.find((voce) => voce.chiave === chiave);
  const pasto = di("cibo_ultima");
  if (pasto?.minuti !== null && pasto?.minuti !== undefined)
    pezzi.push(`${t("ultimo pasto", "last meal")} ${clean(pasto.testo)}`);
  const visite = di("lettiera_visite");
  if (visite?.valore !== null && visite?.valore !== undefined)
    pezzi.push(
      `${Math.round(visite.valore)} ${t("visite alla lettiera oggi", "litter box visits today")}`,
    );
  const pulita = di("lettiera_ultima");
  if (pulita?.minuti !== null && pulita?.minuti !== undefined)
    pezzi.push(`${t("lettiera pulita", "litter cleaned")} ${clean(pulita.testo)}`);
  if (scheda.dentro === true) pezzi.push(t("in casa", "at home"));
  else if (scheda.dentro === false) pezzi.push(t("fuori", "outdoors"));
  return pezzi.join(" · ");
}

function etichettaDelLivello(voce) {
  if (voce.chiave === "cibo_livello") return t("Crocchette", "Kibble");
  if (voce.chiave === "collare_batteria") return t("Collare", "Collar");
  if (voce.chiave === "lettiera_sabbia") return t("Sabbia", "Litter");
  return clean(voce.etichetta);
}

function tastoDellAnimale(azione, forte) {
  const premi = pressioneDellAzione(azione.entita);
  if (!premi) return "";
  let titolo = clean(azione.testo);
  let sotto = "";
  if (azione.chiave === "cibo_eroga") {
    titolo = t("Una porzione", "One portion");
    sotto = t("adesso", "now");
  } else if (azione.chiave === "lettiera_pulisci") {
    titolo = t("Pulisci", "Clean");
    sotto = t("la lettiera", "the litter box");
  }
  const corpo = `<span class="dm-f-sv-tic" aria-hidden="true">${esc(azione.glifo || "▶️")}</span>
    <span class="dm-f-sv-tt"><b>${esc(titolo)}</b>${sotto ? `<em>${esc(sotto)}</em>` : ""}</span>`;
  if (!siComanda(azione.entita))
    return `<div class="dm-f-sv-tasto" data-fermo="true">${corpo}</div>`;
  return tastoServizio(
    { domain: premi.dominio, service: premi.servizio, data: premi.dati },
    {
      classe: `dm-f-sv-tasto${forte ? " dm-f-animali-forte" : ""}`,
      testo: corpo,
      attributi: `aria-label="${esc(clean(azione.testo))}"`,
    },
  );
}

function schedaAnimale(scheda) {
  const chiede = scheda.avvisi.length > 0;
  const volto = scheda.foto
    ? `<img src="${esc(scheda.foto)}" alt="" loading="lazy" decoding="async">`
    : disegnoDelCatalogo(scheda.disegno, 30) || disegnoDelCatalogo("pet", 30);
  const sotto = sottoIlNome(scheda);
  const avviso = chiede
    ? scheda.avvisi.find((voce) => voce.gravita === "urgente") || scheda.avvisi[0]
    : null;
  const altri = chiede ? scheda.avvisi.filter((voce) => voce !== avviso) : [];
  const posto = (voce) => {
    const indice = ORDINE_DEI_LIVELLI.indexOf(voce.chiave);
    return indice < 0 ? ORDINE_DEI_LIVELLI.length : indice;
  };
  const livelli = scheda.letture
    .filter((voce) => !SOTTO_IL_NOME.has(voce.chiave))
    .sort((a, b) => posto(a) - posto(b))
    .map((voce) => {
      const quota = voce.quota && voce.valore !== null && voce.unita === "%";
      const basso = scheda.avvisi.some((a) => a.campo === voce.chiave);
      const numerico =
        !voce.giorni && voce.minuti === null && voce.valore !== null && voce.valore !== undefined;
      const valore = quota
        ? `${Math.round(voce.valore)}%`
        : numerico
          ? `${formatNumber(voce.valore, Number.isInteger(voce.valore) ? 0 : 1)}${voce.unita ? ` ${voce.unita}` : ""}`
          : clean(voce.testo);
      return `<div class="dm-f-animali-liv"${basso ? ' data-basso="true"' : ""}>
          <small>${esc(etichettaDelLivello(voce))}</small>
          <span class="dm-f-sv-num">${esc(valore)}</span>
          ${quota ? barretta(voce.valore, basso ? "#f59e0b" : COLORE_DEL_LIVELLO[voce.chiave] || "") : ""}
          ${voce.chiave === "collare_batteria" ? `<em>${esc(t("batteria", "battery"))}</em>` : ""}
        </div>`;
    })
    .join("");
  const gruppoDellAvviso = avviso ? clean(avviso.campo).split("_")[0] : "";
  const azioni = scheda.azioni.filter((azione) => azione.modo === "premi");
  const forte =
    azioni.find((azione) => gruppoDellAvviso && azione.chiave.startsWith(gruppoDellAvviso)) ||
    (chiede ? azioni[0] : null);
  const tasti = azioni.map((azione) => tastoDellAnimale(azione, azione === forte)).join("");
  return `<article class="dm-f-animali-bestia"${chiede ? ' data-chiede="true"' : ""}>
      <div class="dm-f-animali-capo">
        <span class="dm-f-animali-volto" aria-hidden="true">${volto}</span>
        <span class="dm-f-animali-chi"><b>${esc(scheda.nome)}</b>${sotto ? `<em>${esc(sotto)}</em>` : ""}</span>
        ${chiede ? "" : pastiglia("ok", t("Tutto a posto", "All good"))}
      </div>
      ${avviso ? `<p class="dm-f-animali-avv" data-gravita="${esc(avviso.gravita)}">${esc(fraseDellAvviso(avviso))}</p>` : ""}
      ${altri.map((voce) => `<p class="dm-f-animali-avv" data-gravita="${esc(voce.gravita)}">${esc(fraseDellAvviso(voce))}</p>`).join("")}
      ${livelli ? `<div class="dm-f-animali-livelli">${livelli}</div>` : ""}
      ${tasti ? `<div class="dm-f-sv-tasti">${tasti}</div>` : ""}
    </article>`;
}

function finestraAnimali(widget) {
  const schede = widget.schede || [];
  if (!schede.length) return "";
  return `<div class="dm-f-sv dm-f-animali"><div class="dm-f-sv-griglia dm-f-animali-schede">${schede
    .map(schedaAnimale)
    .join("")}</div></div>`;
}

function sottotitoloAnimali(widget) {
  return (widget.schede || [])
    .map((scheda) => clean(scheda.nome))
    .filter(Boolean)
    .join(" · ");
}

/* ── l'agenda ────────────────────────────────────────────────────────── */

const paroleDelCalendario = () => ({
  oggi: t("Oggi", "Today"),
  domani: t("Domani", "Tomorrow"),
  tuttoIlGiorno: t("Tutto il giorno", "All day"),
  daFare: t("Da fare", "To-do"),
  inRitardo: t("In ritardo", "Overdue"),
});

/* «Fra 2 ore e 10 min»: quanto manca a un impegno che non e' ancora cominciato. */
function fraQuanto(inizio, adesso) {
  const minuti = Math.max(0, Math.round((inizio - adesso) / 60000));
  if (minuti < 60) return `${t("fra", "in")} ${minuti} min`;
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  if (ore < 24)
    return `${t("fra", "in")} ${ore} ${ore === 1 ? t("ora", "hour") : t("ore", "hours")}${
      resto ? ` ${t("e", "and")} ${resto} min` : ""
    }`;
  return "";
}

const MOSTRATE_PER_LISTA = 12;

function eroeDellAgenda(widget, adesso, lingua, parole) {
  const [prossimo] = prossimiEventi(widget.eventi || [], adesso, 1);
  if (!prossimo) return "";
  const ora = inCorso(prossimo, adesso);
  const oggi = chiaveDelGiorno(adesso);
  const giorno = chiaveDelGiorno(prossimo.inizio);
  const quando = prossimo.tuttoIlGiorno ? parole.tuttoIlGiorno : orarioDi(prossimo.inizio, lingua);
  let fra = "";
  if (ora) fra = t("adesso", "now");
  else if (giorno === oggi && !prossimo.tuttoIlGiorno) fra = fraQuanto(prossimo.inizio, adesso);
  else fra = etichettaDelGiorno(giorno, adesso, parole, lingua);
  const sotto = [
    clean(prossimo.location) ? `📍 ${clean(prossimo.location)}` : "",
    !prossimo.tuttoIlGiorno && prossimo.fine > prossimo.inizio
      ? `${t("fino alle", "until")} ${orarioDi(prossimo.fine, lingua)}`
      : "",
  ].filter(Boolean);
  return `<section class="dm-f-sv-eroe dm-f-agenda-eroe"${ora ? ' data-adesso="true"' : ""}>
      <small>${esc(ora ? t("Adesso", "Now") : t("Il prossimo", "Next up"))}</small>
      <div class="dm-f-agenda-quando">
        <span class="dm-f-sv-num">${esc(quando)}</span>
        ${fra ? `<span class="dm-f-agenda-fra">${esc(fra)}</span>` : ""}
      </div>
      <b class="dm-f-agenda-cosa">${esc(clean(prossimo.summary) || t("Senza titolo", "Untitled"))}</b>
      ${sotto.length ? `<em>${esc(sotto.join(" · "))}</em>` : ""}
    </section>`;
}

function settimanaDellAgenda(eventi, scadenze, adesso) {
  const conto = new Map();
  const oggi = chiaveDelGiorno(adesso);
  for (const voce of [...eventi, ...scadenze]) {
    const giorno =
      voce.inizio < adesso && voce.tipo !== "scadenza" ? oggi : chiaveDelGiorno(voce.inizio);
    conto.set(giorno, (conto.get(giorno) || 0) + 1);
  }
  const giorni = Array.from({ length: 7 }, (_, indice) => {
    const istante = giornoDaOggi(indice, adesso);
    const chiave = chiaveDelGiorno(istante);
    const quanti = Math.min(3, conto.get(chiave) || 0);
    return `<div class="dm-f-sv-giorno"${indice === 0 ? ' data-oggi="true"' : ""}>
        <small>${esc(giornoDellaSettimana(istante, "short").replace(/\.$/, "").toUpperCase())}</small>
        <span class="dm-f-sv-num">${new Date(istante).getDate()}</span>
        <i>${"<b></b>".repeat(quanti)}</i>
      </div>`;
  });
  return `<div class="dm-f-sv-settimana" aria-hidden="true">${giorni.join("")}</div>`;
}

function rigaDellAgenda(riga, adesso, lingua, parole) {
  if (riga.tipo === "scadenza")
    return `<li class="dm-f-agenda-ev" data-scadenza="true">
        <span class="dm-f-agenda-ora">${esc(riga.tuttoIlGiorno ? parole.daFare : orarioDi(riga.inizio, lingua))}</span>
        <span class="dm-f-agenda-che">
          <button type="button" class="dm-todo-check" data-dm-todo-check
            data-dm-todo-list="${esc(riga.listaId)}" data-dm-todo-uid="${esc(riga.uid)}"
            data-dm-todo-summary="${esc(riga.summary)}"
            aria-label="${esc(t("Segna fatta:", "Mark done:"))} ${esc(riga.summary)}"></button>
          <span><b>${esc(riga.summary || t("Senza titolo", "Untitled"))}</b><em>${esc(riga.lista)}</em></span>
        </span>
      </li>`;
  const ora = inCorso(riga, adesso);
  const sotto = [
    clean(riga.location),
    !riga.tuttoIlGiorno && riga.fine > riga.inizio
      ? `${t("fino alle", "until")} ${orarioDi(riga.fine, lingua)}`
      : "",
  ].filter(Boolean);
  return `<li class="dm-f-agenda-ev"${ora ? ' data-adesso="true"' : ""}>
      <span class="dm-f-agenda-ora"${riga.tuttoIlGiorno ? ' data-giorno="true"' : ""}>${esc(
        riga.tuttoIlGiorno ? parole.tuttoIlGiorno : orarioDi(riga.inizio, lingua),
      )}</span>
      <span class="dm-f-agenda-che"><span><b>${esc(clean(riga.summary) || t("Senza titolo", "Untitled"))}</b>${
        sotto.length ? `<em>${esc(sotto.join(" · "))}</em>` : ""
      }</span>${ora ? pastiglia("sez", t("Adesso", "Now")) : ""}</span>
    </li>`;
}

function nomeDellaLista(list) {
  return nomeDellEntita(list?.entity, list?.name) || t("Lista", "List");
}

function cosaDaFare(list, item) {
  const fatta = item.status === "completed";
  const dati = `data-dm-todo-list="${esc(list.id)}" data-dm-todo-uid="${esc(item.uid)}" data-dm-todo-summary="${esc(item.summary)}"`;
  return `<li class="dm-todo-item dm-f-agenda-voce${fatta ? " is-done" : ""}">
      <div class="dm-f-agenda-scorri">
        <div class="dm-f-agenda-riga">
          <button type="button" class="dm-todo-check" data-dm-todo-check ${dati}
            aria-label="${esc(t("Segna fatta:", "Mark done:"))} ${esc(item.summary)}"${fatta ? " disabled" : ""}></button>
          <span class="dm-todo-text">${esc(item.summary)}</span>
        </div>
        <button type="button" class="dm-todo-del" data-dm-todo-del ${dati}
          title="${esc(t("Togli dalla lista", "Remove from the list"))}"
          aria-label="${esc(t("Togli dalla lista", "Remove from the list"))}: ${esc(item.summary)}">🗑️</button>
      </div>
    </li>`;
}

function listaDaFare({ list, items }, bozze) {
  const nome = nomeDellaLista(list);
  const senzaData = (items || []).filter((item) => !voceConScadenza(item));
  const mostrate = senzaData
    .filter((item) => item.status !== "completed" || item.localDone)
    .slice(0, MOSTRATE_PER_LISTA);
  const aperte = senzaData.filter((item) => item.status !== "completed").length;
  const altre = aperte - mostrate.filter((item) => item.status !== "completed").length;
  let corpo;
  if (items === null || items === undefined)
    corpo = `<p class="dm-f-sv-vuoto">${esc(t("Caricamento…", "Loading…"))}</p>`;
  else if (!mostrate.length)
    corpo = `<p class="dm-f-sv-vuoto">✨ ${esc(t("Tutto fatto", "All done"))}</p>`;
  else
    corpo = `<ul class="dm-todo-items dm-f-agenda-voci">${mostrate.map((item) => cosaDaFare(list, item)).join("")}</ul>${
      altre > 0
        ? `<p class="dm-f-sv-vuoto">+${altre} ${esc(t("altre voci", "more items"))}</p>`
        : ""
    }`;
  return `<section class="dm-f-agenda-lista">
      <h4 class="dm-f-sv-tit dm-w-block-title">${esc(t("Da fare", "To-do"))} · ${esc(nome)}</h4>
      ${corpo}
      <div class="dm-todo-add dm-f-agenda-nuovo">
        <input type="text" class="dm-todo-new" data-dm-todo-new="${esc(list.id)}"
          value="${esc(bozze?.[list.id] || "")}" maxlength="200"
          placeholder="${esc(t("Aggiungi a", "Add to"))} ${esc(nome)}…"
          aria-label="${esc(t("Aggiungi a", "Add to"))} ${esc(nome)}">
        <button type="button" class="dm-todo-plus" data-dm-todo-add="${esc(list.id)}"
          title="${esc(t("Aggiungi", "Add"))}" aria-label="${esc(t("Aggiungi", "Add"))}">＋</button>
      </div>
    </section>`;
}

function finestraAgenda(widget) {
  const adesso = Date.now();
  const lingua = locale();
  const parole = paroleDelCalendario();
  const eventi = widget.eventi || [];
  const scadenze = scadenzeDelleListe(widget.blocks || []);
  const conCalendario = Boolean(widget.calendario) || scadenze.length > 0;
  let impegni = "";
  if (conCalendario) {
    const { ritardo, giorni } = agendaPerGiorno(eventi, scadenze, adesso);
    const limite = chiaveDelGiorno(giornoDaOggi(6, adesso));
    const dentro = giorni.filter(({ giorno }) => giorno <= limite);
    const dopo = giorni
      .filter(({ giorno }) => giorno > limite)
      .reduce((somma, { eventi: elenco }) => somma + elenco.length, 0);
    const blocchi = [
      ritardo.length
        ? `<div class="dm-f-agenda-giorno" data-ritardo="true"><h5>⚠️ ${esc(parole.inRitardo)}</h5><ul>${ritardo
            .map((riga) => rigaDellAgenda(riga, adesso, lingua, parole))
            .join("")}</ul></div>`
        : "",
      ...dentro.map(
        ({ giorno, eventi: elenco }) =>
          `<div class="dm-f-agenda-giorno"><h5>${esc(
            etichettaDelGiorno(giorno, adesso, parole, lingua),
          )}</h5><ul>${elenco.map((riga) => rigaDellAgenda(riga, adesso, lingua, parole)).join("")}</ul></div>`,
      ),
    ].join("");
    impegni = `${eroeDellAgenda(widget, adesso, lingua, parole)}
      ${titoletto(t("Questa settimana", "This week"))}
      ${settimanaDellAgenda(eventi, scadenze, adesso)}
      ${
        blocchi ||
        `<p class="dm-f-sv-vuoto">${esc(
          widget.inArrivo
            ? t("Caricamento…", "Loading…")
            : t("✨ Niente in programma", "✨ Nothing scheduled"),
        )}</p>`
      }
      ${dopo ? `<p class="dm-f-sv-vuoto">+${dopo} ${esc(t("più avanti", "later on"))}</p>` : ""}`;
  }
  const liste = (widget.cose?.blocks || [])
    .map((blocco) => listaDaFare(blocco, widget.bozze))
    .join("");
  return `<div class="dm-f-sv dm-f-agenda">${impegni}${liste}</div>`;
}

function sottotitoloAgenda(widget) {
  const adesso = Date.now();
  const oggi = chiaveDelGiorno(adesso);
  const pezzi = [];
  if (widget.calendario) {
    const diOggi = (widget.eventi || []).filter(
      (evento) =>
        evento.fine > adesso && (evento.inizio < adesso || chiaveDelGiorno(evento.inizio) === oggi),
    ).length;
    pezzi.push(
      `${diOggi} ${diOggi === 1 ? t("impegno oggi", "appointment today") : t("impegni oggi", "appointments today")}`,
    );
  }
  if (widget.cose) pezzi.push(`${widget.daFare || 0} ${t("da fare", "to do")}`);
  return pezzi.join(" · ");
}

/* ── i rifiuti ───────────────────────────────────────────────────────── */

function quandoDelRitiro(riga, adesso) {
  if (riga.giorni === null || riga.giorni === undefined) return [clean(riga.value), ""];
  if (riga.giorni === 0) return [t("Oggi", "Today"), giornoEMese(adesso)];
  if (riga.giorni === 1) return [t("Domani", "Tomorrow"), giornoEMese(giornoDaOggi(1, adesso))];
  const istante = giornoDaOggi(riga.giorni, adesso);
  if (riga.giorni < 7) return [giornoDellaSettimana(istante), fraGiorni(riga.giorni)];
  return [giornoEMese(istante), fraGiorni(riga.giorni)];
}

function finestraRifiuti(widget) {
  const adesso = Date.now();
  const righe = [...(widget.rows || [])].sort((a, b) => {
    if (a.giorni === null || a.giorni === undefined) return 1;
    if (b.giorni === null || b.giorni === undefined) return -1;
    return a.giorni - b.giorni;
  });
  if (!righe.length) return "";
  const future = righe.filter((riga) => riga.giorni !== null && riga.giorni >= 0);
  const prima = future[0] || null;
  let eroe = "";
  if (prima) {
    const stessoGiorno = future.filter((riga) => riga.giorni === prima.giorni && riga !== prima);
    const etichetta =
      prima.giorni === 0
        ? t("Oggi ritirano", "Collected today")
        : prima.giorni === 1
          ? t("Stasera fuori", "Out tonight")
          : t("Il prossimo ritiro", "Next collection");
    const istante = giornoDaOggi(prima.giorni, adesso);
    const quando =
      prima.giorni === 0
        ? t("ritiro oggi", "collection today")
        : prima.giorni === 1
          ? `${t("ritiro domani mattina", "collection tomorrow morning")}, ${giornoEMese(istante)}`
          : `${giornoDellaSettimana(istante)} · ${fraGiorni(prima.giorni)}`;
    const bidone =
      prima.materiale && !(prima.dalCalendario && prima.materiale === "altro")
        ? disegnoDelBidone(prima.materiale, prima.colore, 92)
        : "";
    eroe = `<section class="dm-f-sv-eroe dm-f-rifiuti-eroe">
        ${bidone ? `<span class="dm-f-rifiuti-bidone" aria-hidden="true">${bidone}</span>` : ""}
        <div>
          <small>${esc(etichetta)}</small>
          <b class="dm-f-rifiuti-cosa">${esc(prima.name)}</b>
          <em>${esc(quando)}</em>
          ${
            stessoGiorno.length
              ? `<em>${esc(t("e anche", "and also"))}: ${esc(stessoGiorno.map((riga) => riga.name).join(", "))}</em>`
              : ""
          }
        </div>
      </section>`;
  }
  const settimana = Array.from({ length: 7 }, (_, indice) => {
    const istante = giornoDaOggi(indice, adesso);
    const quel = righe.filter((riga) => riga.giorni === indice).slice(0, 2);
    return `<div class="dm-f-sv-giorno dm-f-rifiuti-giorno"${indice === 0 ? ' data-oggi="true"' : ""}>
        <small>${esc(giornoDellaSettimana(istante, "short").replace(/\.$/, "").toUpperCase())}</small>
        <span class="dm-f-sv-num">${new Date(istante).getDate()}</span>
        <span class="dm-f-rifiuti-colori">${quel
          .map(
            (riga) =>
              `<i style="--c:${esc(riga.colore || "#94a3b8")}" title="${esc(riga.name)}"></i>`,
          )
          .join("")}</span>
      </div>`;
  }).join("");
  const elenco = righe
    .map((riga) => {
      const [grande, piccolo] = quandoDelRitiro(riga, adesso);
      return `<div class="dm-f-sv-riga dm-f-rifiuti-riga">
          <span class="dm-f-sv-ic dm-f-rifiuti-ic" aria-hidden="true" style="--c:${esc(riga.colore || "#94a3b8")}">${
            riga.disegno || esc(riga.glyph || "♻️")
          }</span>
          <span class="dm-f-sv-nome"><b>${esc(riga.name)}</b></span>
          <span class="dm-f-sv-val"><span class="dm-f-sv-num">${esc(grande)}</span>${
            piccolo ? `<em>${esc(piccolo)}</em>` : ""
          }</span>
        </div>`;
    })
    .join("");
  return `<div class="dm-f-sv dm-f-rifiuti">${eroe}${titoletto(
    t("I prossimi sette giorni", "The next seven days"),
  )}<div class="dm-f-sv-settimana" aria-hidden="true">${settimana}</div>${titoletto(
    t("In ordine", "In order"),
  )}<div class="dm-f-sv-elenco">${elenco}</div></div>`;
}

function sottotitoloRifiuti(widget) {
  const righe = widget.rows || [];
  if (!righe.length) return "";
  return `${righe.length} ${righe.length === 1 ? t("ritiro", "collection") : t("ritiri", "collections")} · ${t(
    "prossimo",
    "next",
  )} ${clean(widget.value).toLowerCase()}`;
}

/* ── le allerte ──────────────────────────────────────────────────────── */

const PESO_DEL_LIVELLO = Object.freeze({ quiete: 0, nota: 1, attenzione: 2, allarme: 3 });

/* La parola del livello di un avviso: i colori della protezione civile. */
function parolaDellAvviso(livello) {
  if (livello === "allarme") return t("Allerta rossa", "Red alert");
  if (livello === "attenzione") return t("Allerta arancione", "Orange alert");
  return t("Allerta gialla", "Yellow alert");
}

function quandoScritto(istante, adesso) {
  const giorno = chiaveDelGiorno(istante);
  const parole = paroleDelCalendario();
  return `${etichettaDelGiorno(giorno, adesso, parole, locale()).toLowerCase()} ${orarioDi(istante, locale())}`;
}

function avvisoGrande(riga, adesso) {
  const lettura = riga.lettura || {};
  const meteo = lettura.chiave === "meteo";
  const titolo = meteo ? parolaDellAvviso(riga.livello) : clean(riga.name);
  const sotto = meteo
    ? [clean(riga.name), clean(riga.zona) || clean(lettura.evento)].filter(Boolean).join(" · ")
    : clean(riga.value);
  const testo = clean(riga.testo) || clean(lettura.testo);
  const quando = [
    riga.dal ? `🕛 ${t("da", "from")} ${quandoScritto(riga.dal, adesso)}` : "",
    riga.al ? `⏳ ${t("fino a", "until")} ${quandoScritto(riga.al, adesso)}` : "",
  ].filter(Boolean);
  return `<section class="dm-f-allerte-avviso" data-livello="${esc(riga.livello)}">
      <div class="dm-f-allerte-capo">
        <span class="dm-f-allerte-seg" aria-hidden="true">${riga.glyph || "⚠️"}</span>
        <div><b>${esc(titolo)}</b>${sotto ? `<em>${esc(sotto)}</em>` : ""}</div>
      </div>
      ${testo ? `<p>${esc(testo)}</p>` : ""}
      ${quando.length ? `<div class="dm-f-allerte-quando">${quando.map((pezzo) => `<span>${esc(pezzo)}</span>`).join("")}</div>` : ""}
    </section>`;
}

/* Il numero che conta di una fonte: quanto e' lontano, o quanto e' forte. */
function numeroDellaFonte(riga) {
  const lettura = riga.lettura || {};
  const km = numero(lettura.distanza);
  if (km !== null) {
    const scritto = `${formatNumber(km, km < 10 ? 1 : 0)} km`;
    if (lettura.chiave === "fulmini") return [scritto, t("il più vicino", "the closest")];
    return [scritto, t("da casa", "from home")];
  }
  return ["", ""];
}

function finestraAllerte(widget) {
  const adesso = Date.now();
  const righe = (widget.rows || []).filter((riga) => riga.lettura);
  if (!righe.length) return "";
  const avviso = (riga) =>
    (riga.lettura.chiave === "meteo" && PESO_DEL_LIVELLO[riga.livello] >= 1) ||
    PESO_DEL_LIVELLO[riga.livello] >= 2;
  const peso = (riga) => PESO_DEL_LIVELLO[riga.livello] ?? -1;
  const avvisi = righe.filter(avviso).sort((a, b) => peso(b) - peso(a));
  const occhio = righe.filter((riga) => !avviso(riga) && riga.livello === "nota");
  const mute = righe.filter((riga) => riga.livello === IGNOTO);
  const quiete = righe.filter((riga) => riga.livello === "quiete");
  const rigaFonte = (riga) => {
    const [grande, piccolo] = numeroDellaFonte(riga);
    return `<div class="dm-f-sv-riga" data-livello="${esc(riga.livello)}">
        <span class="dm-f-sv-ic" aria-hidden="true">${riga.glyph || "•"}</span>
        <span class="dm-f-sv-nome"><b>${esc(riga.name)}</b><em>${esc(
          /* La distanza sta gia' a destra, in grande: sotto il nome non si ripete. */
          grande && riga.lettura.chiave === "fulmini"
            ? clean(riga.value).split(" · ")[0]
            : riga.value,
        )}</em></span>
        ${grande ? `<span class="dm-f-sv-val"><span class="dm-f-sv-num">${esc(grande)}</span><em>${esc(piccolo)}</em></span>` : ""}
      </div>`;
  };
  return `<div class="dm-f-sv dm-f-allerte">
      ${avvisi.map((riga) => avvisoGrande(riga, adesso)).join("")}
      ${
        !avvisi.length && !occhio.length
          ? `<section class="dm-f-sv-eroe dm-f-allerte-calma"><small>${esc(
              t("Adesso", "Now"),
            )}</small><b>${esc(mute.length ? t("Niente da segnalare", "Nothing to report") : t("Tutto tranquillo", "All quiet"))}</b></section>`
          : ""
      }
      ${occhio.length ? `${titoletto(t("Da tenere d'occhio", "Worth watching"))}<div class="dm-f-sv-elenco">${occhio.map(rigaFonte).join("")}</div>` : ""}
      ${mute.length ? `${titoletto(t("Non rispondono", "Not answering"))}<div class="dm-f-sv-elenco">${mute.map(rigaFonte).join("")}</div>` : ""}
      ${
        quiete.length
          ? `${titoletto(t("Tranquille", "Quiet"))}<div class="dm-f-allerte-calme">${quiete
              .map(
                (riga) => `<div class="dm-f-allerte-calma-voce">
                  <span aria-hidden="true">${riga.glyph || "•"}</span>
                  <span><b>${esc(riga.name)}</b><em>${esc(riga.value)}</em></span>
                </div>`,
              )
              .join("")}</div>`
          : ""
      }
    </div>`;
}

function sottotitoloAllerte(widget) {
  const righe = (widget.rows || []).filter((riga) => riga.lettura);
  if (!righe.length) return "";
  const eAvviso = (riga) =>
    (riga.lettura.chiave === "meteo" && PESO_DEL_LIVELLO[riga.livello] >= 1) ||
    PESO_DEL_LIVELLO[riga.livello] >= 2;
  const avvisi = righe.filter(eAvviso).length;
  const occhio = righe.filter((riga) => !eAvviso(riga) && riga.livello === "nota").length;
  const pezzi = [];
  if (avvisi)
    pezzi.push(`${avvisi} ${avvisi === 1 ? t("avviso", "warning") : t("avvisi", "warnings")}`);
  if (occhio > 0) pezzi.push(`${occhio} ${t("da tenere d'occhio", "to watch")}`);
  if (!pezzi.length)
    pezzi.push(
      `${righe.length} ${righe.length === 1 ? t("fonte", "source") : t("fonti", "sources")}`,
    );
  return pezzi.join(" · ");
}

/* ── le stampanti ────────────────────────────────────────────────────── */

const COLORE_DELLA_TINTA = Object.freeze(
  Object.fromEntries(TINTE_DELLE_CARTUCCE.map(({ tinta, colore }) => [tinta, colore])),
);

function nomeDellaTinta(cartuccia) {
  switch (cartuccia.tinta) {
    case "nero":
      return t("Nero", "Black");
    case "ciano":
      return t("Ciano", "Cyan");
    case "magenta":
      return "Magenta";
    case "giallo":
      return t("Giallo", "Yellow");
    case "colore":
      return t("Colore", "Colour");
    case "foto":
      return t("Foto", "Photo");
    default:
      return clean(cartuccia.nome);
  }
}

function statoDellaStampante(lettura) {
  if (lettura.stampa) return ["stampa", `● ${t("sta stampando", "printing")}`];
  if (lettura.ferma)
    return ["ferma", [t("ferma", "stopped"), clean(lettura.motivo)].filter(Boolean).join(" · ")];
  if (lettura.muta) return ["", t("non risponde", "not answering")];
  if (lettura.stato === "spenta") return ["", t("spenta", "off")];
  return ["", t("pronta", "ready")];
}

function schedaStampante(lettura) {
  const cartucce = (lettura.cartucce || []).filter((voce) => voce.quanta !== null);
  const sgoccioli = cartucce.filter((voce) => voce.agliSgoccioli);
  const chiede = Boolean(lettura.ferma || sgoccioli.length);
  const [tono, stato] = statoDellaStampante(lettura);
  const pill = lettura.ferma
    ? pastiglia("rosso", t("Ferma", "Stopped"))
    : sgoccioli.length
      ? pastiglia("occhio", `${nomeDellaTinta(sgoccioli[0])} ${sgoccioli[0].quanta}%`)
      : "";
  const serbatoi = cartucce
    .map(
      (voce) => `<div class="dm-f-stampanti-c"${voce.agliSgoccioli ? ' data-basso="true"' : ""}>
          <span class="dm-f-stampanti-tubo" data-tinta="${esc(voce.tinta)}" style="--h:${voce.quanta}%;--c:${esc(
            COLORE_DELLA_TINTA[voce.tinta] || COLORE_SENZA_TINTA,
          )}"></span>
          <span class="dm-f-sv-num">${voce.quanta}%</span>
          <small>${esc(nomeDellaTinta(voce))}</small>
        </div>`,
    )
    .join("");
  const consiglio = sgoccioli.length
    ? `<p class="dm-f-stampanti-consiglio">${esc(
        sgoccioli.length === 1
          ? `${t("Ne resta poco:", "Little left:")} ${nomeDellaTinta(sgoccioli[0])} ${sgoccioli[0].quanta}% — ${t(
              "conviene ordinare il ricambio.",
              "time to order a refill.",
            )}`
          : `${t("Agli sgoccioli:", "Almost out:")} ${sgoccioli.map(nomeDellaTinta).join(", ")} — ${t(
              "conviene ordinare il ricambio.",
              "time to order a refill.",
            )}`,
      )}</p>`
    : "";
  const pagine = numero(lettura.pagine);
  const sotto = [stato, pagine !== null ? `${formatNumber(pagine, 0)} ${t("pagine", "pages")}` : ""]
    .filter(Boolean)
    .join(" · ");
  return `<article class="dm-f-stampanti-st"${chiede ? ' data-chiede="true"' : ""}>
      <div class="dm-f-stampanti-capo">
        <span class="dm-f-stampanti-fac" aria-hidden="true">${disegnoDelCatalogo("printer", 26) || "🖨️"}</span>
        <span class="dm-f-stampanti-chi"><b>${esc(lettura.nome)}</b><em data-tono="${esc(tono)}">${esc(sotto)}</em></span>
        ${pill}
      </div>
      ${
        /* Una cartuccia sola: il consiglio le sta accanto, non sotto. */
        serbatoi && cartucce.length === 1 && consiglio
          ? `<div class="dm-f-stampanti-cart" data-una="true">${serbatoi}${consiglio}</div>`
          : `${serbatoi ? `<div class="dm-f-stampanti-cart">${serbatoi}</div>` : ""}${consiglio}`
      }
    </article>`;
}

function finestraStampanti(widget) {
  const letture = widget.letture || [];
  if (!letture.length) return "";
  const peso = (lettura) =>
    lettura.ferma ? 0 : lettura.piuScarica?.agliSgoccioli ? 1 : lettura.stampa ? 2 : 3;
  const ordinate = letture
    .map((lettura, indice) => ({ lettura, indice }))
    .sort((a, b) => peso(a.lettura) - peso(b.lettura) || a.indice - b.indice)
    .map((voce) => voce.lettura);
  return `<div class="dm-f-sv dm-f-stampanti"><div class="dm-f-sv-griglia">${ordinate
    .map(schedaStampante)
    .join("")}</div></div>`;
}

function sottotitoloStampanti(widget) {
  const letture = widget.letture || [];
  if (!letture.length) return "";
  const pezzi = [
    `${letture.length} ${letture.length === 1 ? t("stampante", "printer") : t("stampanti", "printers")}`,
  ];
  const ferme = letture.filter((lettura) => lettura.ferma).length;
  const ricaricare = letture.filter((lettura) => lettura.piuScarica?.agliSgoccioli).length;
  if (ferme) pezzi.push(`${ferme} ${ferme === 1 ? t("ferma", "stopped") : t("ferme", "stopped")}`);
  if (ricaricare) pezzi.push(`${ricaricare} ${t("da ricaricare", "to refill")}`);
  return pezzi.join(" · ");
}

/* ── lo stile ────────────────────────────────────────────────────────── */

const STILE = `
${Object.entries(COLORI)
  .map(
    ([chiave, colore]) =>
      `${P} [data-dm-widget-detail="${chiave}"]{--dm-widget-accent:${colore}!important;--dm-f-a:${colore}}`,
  )
  .join("\n")}
${P} .dm-f-sv{--dm-f-a:var(--dm-widget-accent,#0d9488);
  --sv-card:var(--card-bg,#fff);--sv-bordo:var(--card-border,#eef2f7);
  --sv-testo:var(--text,#0f172a);--sv-fioco:var(--text-dim,#64748b);
  --sv-tinta:color-mix(in srgb,var(--dm-f-a) 11%,var(--sv-card));
  --sv-tinta2:color-mix(in srgb,var(--dm-f-a) 38%,var(--sv-card));
  --sv-fondo:color-mix(in srgb,var(--sv-fioco) 10%,var(--sv-card));
  display:grid;gap:10px;min-width:0;color:var(--sv-testo)}
${P} .dm-f-sv *{box-sizing:border-box}
${P} .dm-f-sv-num{font-family:'Oswald',system-ui,sans-serif;font-weight:600;font-variant-numeric:tabular-nums;line-height:1}
${P} .dm-f-sv-tit{margin:8px 2px 0;font-size:10.5px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--sv-fioco)}
${P} .dm-f-sv-eroe{border-radius:24px;padding:18px;border:1px solid var(--sv-tinta2);min-width:0;
  background:linear-gradient(155deg,var(--sv-card),var(--sv-tinta))}
${P} .dm-f-sv-eroe small{display:block;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--dm-f-a)}
${P} .dm-f-sv-eroe p{margin:6px 0 0;font-size:13.5px;font-weight:750;color:var(--sv-fioco);line-height:1.4}
${P} .dm-f-sv-grande{font-size:46px;display:block}
${P} .dm-f-sv-nota{margin:0;border-radius:16px;padding:11px 13px;background:var(--sv-fondo);font-size:13px;font-weight:750;line-height:1.4;color:var(--sv-testo)}
${P} .dm-f-sv-nota[data-tono="occhio"]{background:color-mix(in srgb,#f59e0b 16%,var(--sv-card));color:#b45309}
${P} .dm-f-sv-vuoto{margin:2px 4px;font-size:13px;font-weight:700;color:var(--sv-fioco)}
${P} .dm-f-sv-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:11.5px;font-weight:850;
  white-space:nowrap;background:var(--sv-fondo);color:var(--sv-fioco);font-family:inherit;letter-spacing:0;text-transform:none}
${P} .dm-f-sv-pill i{width:7px;height:7px;border-radius:50%;background:currentColor}
${P} .dm-f-sv-pill[data-tono="ok"]{background:color-mix(in srgb,#22c55e 18%,var(--sv-card));color:#15803d}
${P} .dm-f-sv-pill[data-tono="occhio"]{background:color-mix(in srgb,#f59e0b 20%,var(--sv-card));color:#b45309}
${P} .dm-f-sv-pill[data-tono="rosso"]{background:color-mix(in srgb,#ef4444 18%,var(--sv-card));color:#b91c1c}
${P} .dm-f-sv-pill[data-tono="sez"]{background:var(--sv-tinta);color:var(--dm-f-a)}
${P} .dm-f-sv-barra{display:block;position:relative;height:6px;border-radius:999px;overflow:hidden;
  background:color-mix(in srgb,var(--sv-fioco) 16%,transparent)}
${P} .dm-f-sv-barra::after{content:"";position:absolute;inset:0 auto 0 0;width:var(--w);border-radius:999px;background:var(--c,var(--dm-f-a))}
${P} .dm-f-sv-griglia{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));align-items:start}
${P} .dm-f-sv-elenco{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))}
${P} .dm-f-sv-scheda{border-radius:20px;background:var(--sv-card);border:1px solid var(--sv-bordo);padding:12px 13px;min-width:0;
  box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
${P} .dm-f-sv-riga{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:18px;min-width:0;
  background:var(--sv-card);border:1px solid var(--sv-bordo);box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
${P} .dm-f-sv-ic{flex:0 0 40px;width:40px;height:40px;border-radius:13px;display:grid;place-items:center;font-size:19px;
  background:var(--sv-fondo)}
${P} .dm-f-sv-ic svg{width:24px;height:24px}
${P} .dm-f-sv-nome{flex:1;min-width:0}
${P} .dm-f-sv-nome b{display:block;font-size:14px;font-weight:850;overflow-wrap:anywhere}
${P} .dm-f-sv-nome em,${P} .dm-f-sv-val em{display:block;font-style:normal;font-size:12px;font-weight:700;color:var(--sv-fioco);margin-top:2px}
${P} .dm-f-sv-val{flex:0 0 auto;text-align:right;max-width:45%}
${P} .dm-f-sv-val .dm-f-sv-num{display:block;font-size:22px}
${P} .dm-f-sv-val em[data-tono="asciutta"]{color:#b45309}
${P} .dm-f-sv-val em[data-tono="giusta"]{color:#15803d}
${P} .dm-f-sv-val em[data-tono="zuppa"]{color:#0369a1}
${P} .dm-f-sv-tasti{display:grid;gap:9px;grid-template-columns:repeat(auto-fill,minmax(min(100%,128px),1fr))}
${P} .dm-f-sv-tasto{display:flex;align-items:center;gap:11px;padding:13px 12px;border-radius:20px;min-width:0;text-align:left;
  font:inherit;color:var(--sv-testo);background:var(--sv-card);border:1px solid var(--sv-bordo);cursor:pointer;
  box-shadow:0 12px 24px -22px rgba(15,23,42,.6);transition:background .2s,border-color .2s,transform .12s}
${P} .dm-f-sv-tasto:active{transform:scale(.97)}
${P} .dm-f-sv-tasto[data-fermo="true"]{cursor:default;opacity:.7}
${P} .dm-f-sv-tasto[data-on="true"]{background:var(--sv-tinta);border-color:var(--sv-tinta2)}
${P} .dm-f-sv-tasto[data-on="true"] em{color:var(--dm-f-a)}
${P} .dm-f-sv-tasto[data-dm-w-armato="true"]{background:#fef3c7;border-color:#fcd34d;font-weight:850}
${P} .dm-f-sv-tasto[data-dm-w-in-corso="true"]{opacity:.65}
${P} .dm-f-sv-tic{flex:0 0 40px;width:40px;height:40px;border-radius:14px;display:grid;place-items:center;font-size:20px;background:var(--sv-fondo)}
${P} .dm-f-sv-tic svg{width:24px;height:24px}
${P} .dm-f-sv-tasto[data-on="true"] .dm-f-sv-tic{background:var(--sv-card)}
${P} .dm-f-sv-tt{min-width:0}
${P} .dm-f-sv-tt b{display:block;font-size:13.5px;font-weight:850;overflow-wrap:anywhere}
${P} .dm-f-sv-tt em{display:block;font-style:normal;font-size:11.5px;font-weight:750;color:var(--sv-fioco)}
${P} .dm-f-sv-settimana{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}
${P} .dm-f-sv-giorno{border-radius:14px;padding:8px 0 7px;text-align:center;background:var(--sv-card);border:1px solid var(--sv-bordo);min-width:0}
${P} .dm-f-sv-giorno small{display:block;font-size:9.5px;font-weight:900;letter-spacing:.04em;color:var(--sv-fioco);overflow:hidden;text-overflow:clip;white-space:nowrap}
${P} .dm-f-sv-giorno .dm-f-sv-num{display:block;font-size:19px;margin-top:2px}
${P} .dm-f-sv-giorno i{display:flex;justify-content:center;gap:3px;height:6px;margin-top:4px}
${P} .dm-f-sv-giorno i b{width:5px;height:5px;border-radius:50%;background:var(--dm-f-a)}
${P} .dm-f-sv-giorno[data-oggi="true"]{background:var(--dm-f-a);border-color:var(--dm-f-a);color:#fff}
${P} .dm-f-sv-giorno[data-oggi="true"] small{color:rgba(255,255,255,.8)}
${P} .dm-f-sv-giorno[data-oggi="true"] i b{background:#fff}

${P} .dm-f-aria-su{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-top:4px}
${P} .dm-f-aria-u{font-size:15px;font-weight:850;color:var(--sv-fioco);margin-bottom:6px}
${P} .dm-f-aria-scala{position:relative;margin:16px 0 6px;height:12px;border-radius:999px;
  background:linear-gradient(90deg,#22c55e 0 var(--s1),#a3e635 var(--s1) var(--s2),#f59e0b var(--s2) var(--s3),#f97316 var(--s3))}
${P} .dm-f-aria-scala b{position:absolute;top:-5px;left:var(--x);width:6px;height:22px;margin-left:-3px;border-radius:4px;
  background:var(--sv-testo);box-shadow:0 0 0 3px var(--sv-card)}
${P} .dm-f-aria-tacche{position:relative;height:16px;font-size:11px;font-weight:800;color:var(--sv-fioco)}
${P} .dm-f-aria-tacche span{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap}
${P} .dm-f-aria-tacche .dm-f-aria-buona{left:0;transform:none}
${P} .dm-f-aria-tacche .dm-f-aria-cattiva{right:0;transform:none}
${P} .dm-f-aria-consiglio{display:block;margin:14px 0 0!important;padding:11px 13px;border-radius:16px;background:var(--sv-card);
  border:1px solid var(--sv-tinta2);font-size:13px!important;font-weight:800!important;color:var(--sv-testo)!important}
${P} .dm-f-aria-stanza h5{margin:0 0 6px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:14.5px;font-weight:850}
${P} .dm-f-aria-mis{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:2px 10px;padding:7px 0;
  border-top:1px solid color-mix(in srgb,var(--sv-fioco) 14%,transparent)}
${P} .dm-f-aria-mis:first-of-type{border-top:0}
${P} .dm-f-aria-n{font-size:13px;font-weight:750;min-width:0;overflow-wrap:anywhere}
${P} .dm-f-aria-n small{display:block;font-size:11px;font-weight:700;color:var(--sv-fioco)}
${P} .dm-f-aria-v{text-align:right;white-space:nowrap}
${P} .dm-f-aria-v .dm-f-sv-num{font-size:17px}
${P} .dm-f-aria-v small{font-size:11px;font-weight:800;color:var(--sv-fioco)}
${P} .dm-f-aria-mis .dm-f-sv-barra{grid-column:1/-1;margin-top:3px}

${P} .dm-f-piante-eroe{display:flex;gap:14px;align-items:center}
${P} .dm-f-piante-eroe > div{flex:1;min-width:0}
${P} .dm-f-piante-eroe b{display:block;font-size:20px;font-weight:850;margin-top:3px;overflow-wrap:anywhere}
${P} .dm-f-piante-eroe p .dm-f-sv-num{font-size:22px;color:var(--sv-testo)}
${P} .dm-f-piante-vaso{flex:0 0 84px;height:84px;border-radius:24px;display:grid;place-items:center;font-size:44px;
  background:var(--sv-card);border:1px solid var(--sv-tinta2)}
${P} .dm-f-piante-terra{display:block;position:relative;height:8px;border-radius:999px;margin-top:9px;
  background:linear-gradient(90deg,#fde68a 0 var(--min),#bbf7d0 var(--min) var(--max),#bae6fd var(--max))}
${P} .dm-f-piante-terra i{position:absolute;top:-4px;left:var(--x);width:6px;height:16px;margin-left:-3px;border-radius:4px;
  background:var(--sv-testo);box-shadow:0 0 0 2px var(--sv-card)}
${P} .dm-f-piante-leg{display:flex;gap:14px;flex-wrap:wrap;margin:0 4px;font-size:12px;font-weight:750;color:var(--sv-fioco)}
${P} .dm-f-piante-leg span{display:inline-flex;align-items:center;gap:6px}
${P} .dm-f-piante-leg b{width:10px;height:10px;border-radius:3px}
${P} .dm-f-piante-leg b[data-t="asciutta"]{background:#fde68a}
${P} .dm-f-piante-leg b[data-t="giusta"]{background:#bbf7d0}
${P} .dm-f-piante-leg b[data-t="zuppa"]{background:#bae6fd}
${P} .dm-f-piante .dm-f-sv-riga[data-stato="asciutta"]{border-color:color-mix(in srgb,#f59e0b 45%,var(--sv-bordo))}

${P} .dm-f-acquario-vasca{display:grid;gap:10px;min-width:0}
${P} .dm-f-acquario-nome{margin:6px 2px 0;font-size:15px;font-weight:850}
${P} .dm-f-acquario-eroe{position:relative;overflow:hidden;
  background:linear-gradient(170deg,var(--sv-card),var(--sv-tinta) 60%,color-mix(in srgb,var(--dm-f-a) 20%,var(--sv-card)))}
${P} .dm-f-acquario-eroe[data-tipo="acquario"]::after{content:"🐠";position:absolute;right:18px;top:16px;font-size:38px;opacity:.9}
${P} .dm-f-acquario-eroe[data-tipo="terrario"]::after{content:"🦎";position:absolute;right:18px;top:16px;font-size:38px;opacity:.9}
${P} .dm-f-acquario-su{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-top:4px;padding-right:52px}
${P} .dm-f-acquario-su .dm-f-sv-pill{margin-bottom:8px}
${P} .dm-f-acquario-forc{position:relative;height:10px;border-radius:999px;margin:14px 0 4px;
  background:linear-gradient(90deg,#bae6fd 0 30%,#86efac 30% 70%,#fed7aa 70%)}
${P} .dm-f-acquario-forc b{position:absolute;top:-4px;left:var(--x);width:6px;height:18px;margin-left:-3px;border-radius:4px;
  background:var(--sv-testo);box-shadow:0 0 0 2px var(--sv-card)}
${P} .dm-f-acquario-tacche{display:flex;justify-content:space-between;gap:6px;font-size:11px;font-weight:800;color:var(--sv-fioco)}
${P} .dm-f-acquario-due{display:grid;gap:9px;grid-template-columns:repeat(auto-fill,minmax(min(100%,140px),1fr))}
${P} .dm-f-acquario-cas{border-radius:18px;padding:12px 13px;background:var(--sv-card);border:1px solid var(--sv-bordo);min-width:0;
  box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
${P} .dm-f-acquario-cas small{display:block;font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--sv-fioco);overflow-wrap:anywhere}
${P} .dm-f-acquario-cas small[data-sigla="true"]{text-transform:none;letter-spacing:.02em;font-size:12px}
${P} .dm-f-acquario-cas .dm-f-sv-num{display:block;font-size:24px;margin-top:4px}
${P} .dm-f-acquario-cas em{display:block;margin-top:3px;font-style:normal;font-size:11.5px;font-weight:750;color:var(--sv-fioco)}
${P} .dm-f-acquario-cas em[data-tono="ok"]{color:#15803d}
${P} .dm-f-acquario-cas em[data-tono="rosso"]{color:#b91c1c}

${P} .dm-f-animali-bestia{border-radius:24px;border:1px solid var(--sv-bordo);background:var(--sv-card);padding:14px;min-width:0;
  box-shadow:0 14px 26px -24px rgba(15,23,42,.6);display:grid;gap:10px}
${P} .dm-f-animali-bestia[data-chiede="true"]{border-color:var(--sv-tinta2);background:linear-gradient(160deg,var(--sv-card),var(--sv-tinta))}
${P} .dm-f-animali-capo{display:flex;align-items:center;gap:12px;min-width:0}
${P} .dm-f-animali-volto{flex:0 0 52px;width:52px;height:52px;border-radius:17px;display:grid;place-items:center;overflow:hidden;
  background:var(--sv-card);box-shadow:inset 0 0 0 1px var(--sv-tinta2)}
${P} .dm-f-animali-volto img{width:100%;height:100%;object-fit:cover}
${P} .dm-f-animali-chi{flex:1;min-width:0}
${P} .dm-f-animali-chi b{display:block;font-size:18px;font-weight:850}
${P} .dm-f-animali-chi em{display:block;font-style:normal;font-size:12px;font-weight:750;color:var(--sv-fioco)}
${P} .dm-f-animali-avv{margin:0;padding:10px 12px;border-radius:14px;font-size:13px;font-weight:800;
  background:color-mix(in srgb,#f59e0b 18%,var(--sv-card));color:#92400e}
${P} .dm-f-animali-avv[data-gravita="urgente"]{background:color-mix(in srgb,#ef4444 15%,var(--sv-card));color:#991b1b}
${P} .dm-f-animali-livelli{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));align-items:start}
${P} .dm-f-animali-liv{border-radius:16px;padding:10px;background:var(--sv-card);border:1px solid var(--sv-bordo);min-width:0}
${P} .dm-f-animali-liv small{display:block;font-size:9.5px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:var(--sv-fioco);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${P} .dm-f-animali-liv .dm-f-sv-num{display:block;font-size:21px;margin:3px 0 6px;overflow-wrap:anywhere}
${P} .dm-f-animali-liv[data-basso="true"] .dm-f-sv-num{color:#b45309}
${P} .dm-f-animali-liv em{display:block;font-style:normal;font-size:11px;font-weight:750;color:var(--sv-fioco);margin-top:5px}
${P} .dm-f-animali-forte{background:var(--dm-f-a)!important;border-color:var(--dm-f-a)!important;color:#fff!important}
${P} .dm-f-animali-forte em{color:rgba(255,255,255,.85)!important}
${P} .dm-f-animali-forte .dm-f-sv-tic{background:rgba(255,255,255,.2)}

${P} .dm-f-agenda-quando{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:4px}
${P} .dm-f-agenda-quando .dm-f-sv-num{font-size:44px}
${P} .dm-f-agenda-fra{font-size:13px;font-weight:850;color:var(--dm-f-a)}
${P} .dm-f-agenda-cosa{display:block;font-size:20px;font-weight:850;margin-top:6px;overflow-wrap:anywhere}
${P} .dm-f-agenda-eroe em{display:block;font-style:normal;font-size:12.5px;font-weight:750;color:var(--sv-fioco);margin-top:2px}
${P} .dm-f-agenda-giorno h5{margin:6px 4px 0;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--sv-fioco)}
${P} .dm-f-agenda-giorno[data-ritardo="true"] h5{color:#b45309}
${P} .dm-f-agenda-giorno ul{list-style:none;margin:0;padding:0}
${P} .dm-f-agenda-ev{display:grid;grid-template-columns:62px minmax(0,1fr);gap:10px;padding:10px 4px;align-items:start;
  border-top:1px solid color-mix(in srgb,var(--sv-fioco) 14%,transparent)}
${P} .dm-f-agenda-ev:first-child{border-top:0}
${P} .dm-f-agenda-ora{font-family:'Oswald',system-ui,sans-serif;font-weight:600;font-size:17px;color:var(--dm-f-a);line-height:1.2}
${P} .dm-f-agenda-ora[data-giorno="true"],${P} .dm-f-agenda-ev[data-scadenza="true"] .dm-f-agenda-ora{font-family:inherit;font-size:12px;font-weight:850}
${P} .dm-f-agenda-che{display:flex;align-items:flex-start;gap:10px;min-width:0}
${P} .dm-f-agenda-che > span{flex:1;min-width:0}
${P} .dm-f-agenda-che b{display:block;font-size:14px;font-weight:850;overflow-wrap:anywhere}
${P} .dm-f-agenda-che em{display:block;font-style:normal;font-size:12px;font-weight:700;color:var(--sv-fioco)}
${P} .dm-f-agenda-che .dm-todo-check{flex:0 0 auto}
${P} .dm-f-agenda-lista{display:grid;gap:4px;min-width:0}
${P} .dm-f-agenda-lista .dm-w-block-title{display:block;padding:0;background:none;border:0}
${P} .dm-f-agenda-voci{gap:0!important;padding:0!important}
${P} .dm-f-agenda-voce{display:block!important;border-top:1px solid color-mix(in srgb,var(--sv-fioco) 14%,transparent)}
${P} .dm-f-agenda-voce:first-child{border-top:0}
${P} .dm-f-agenda-scorri{display:flex;align-items:center;gap:8px;min-width:0}
${P} .dm-f-agenda-riga{flex:1 0 auto;min-width:0;display:flex;align-items:center;gap:12px;padding:10px 4px}
${P} .dm-f-agenda-riga .dm-todo-text{font-size:14.5px;font-weight:750}
${P} .dm-f-agenda-voce .dm-todo-check{width:24px;height:24px;flex:0 0 24px;margin:0}
/* Sul telefono il cestino si scopre scorrendo la riga col dito: sempre in vista
   era rumore in una lista della spesa. */
@media (hover:none){
  ${P} .dm-f-agenda-scorri{overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;gap:0}
  ${P} .dm-f-agenda-scorri::-webkit-scrollbar{display:none}
  ${P} .dm-f-agenda-riga{flex:0 0 100%;scroll-snap-align:start}
  ${P} .dm-f-agenda-voce .dm-todo-del{flex:0 0 64px;align-self:stretch;height:auto;width:64px;border-radius:14px;opacity:1!important;
    scroll-snap-align:end;background:color-mix(in srgb,#ef4444 16%,var(--sv-card))}
}
${P} .dm-f-agenda-nuovo{margin-top:6px}

${P} .dm-f-rifiuti-eroe{display:flex;gap:16px;align-items:center}
${P} .dm-f-rifiuti-eroe > div{flex:1;min-width:0}
${P} .dm-f-rifiuti-bidone{flex:0 0 92px;display:grid;place-items:center}
${P} .dm-f-rifiuti-bidone svg{width:92px;height:92px}
${P} .dm-f-rifiuti-cosa{display:block;font-family:'Oswald',system-ui,sans-serif;font-weight:600;font-size:30px;line-height:1.05;
  text-transform:uppercase;margin-top:4px;overflow-wrap:anywhere}
${P} .dm-f-rifiuti-eroe em{display:block;font-style:normal;font-size:13px;font-weight:800;color:var(--sv-fioco);margin-top:4px}
${P} .dm-f-rifiuti-giorno{min-height:72px}
${P} .dm-f-rifiuti-colori{display:grid;justify-items:center;gap:3px;margin-top:4px}
${P} .dm-f-rifiuti-colori i{display:block;width:20px;height:20px;border-radius:7px;background:var(--c)}
${P} .dm-f-rifiuti-giorno[data-oggi="true"]{background:var(--sv-tinta);border-color:var(--sv-tinta2);color:var(--sv-testo)}
${P} .dm-f-rifiuti-giorno[data-oggi="true"] small{color:var(--sv-fioco)}
${P} .dm-f-rifiuti-ic{background:color-mix(in srgb,var(--c) 22%,var(--sv-card));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 45%,transparent)}
${P} .dm-f-rifiuti-riga .dm-f-sv-val .dm-f-sv-num{font-size:19px}

${P} .dm-f-allerte-avviso{border-radius:24px;padding:16px;min-width:0;border:1px solid #fcd34d;
  background:linear-gradient(160deg,color-mix(in srgb,#fef3c7 50%,var(--sv-card)),color-mix(in srgb,#fde68a 55%,var(--sv-card)))}
${P} .dm-f-allerte-avviso[data-livello="attenzione"]{border-color:#fdba74;background:linear-gradient(160deg,color-mix(in srgb,#ffedd5 55%,var(--sv-card)),color-mix(in srgb,#fed7aa 60%,var(--sv-card)))}
${P} .dm-f-allerte-avviso[data-livello="allarme"]{border-color:#fca5a5;background:linear-gradient(160deg,color-mix(in srgb,#fee2e2 55%,var(--sv-card)),color-mix(in srgb,#fecaca 60%,var(--sv-card)))}
${P} .dm-f-allerte-capo{display:flex;align-items:center;gap:12px;min-width:0}
${P} .dm-f-allerte-capo > div{flex:1;min-width:0}
${P} .dm-f-allerte-seg{flex:0 0 52px;width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font-size:26px;background:#facc15}
${P} .dm-f-allerte-seg svg{width:28px;height:28px}
${P} .dm-f-allerte-avviso[data-livello="attenzione"] .dm-f-allerte-seg{background:#fb923c}
${P} .dm-f-allerte-avviso[data-livello="allarme"] .dm-f-allerte-seg{background:#f87171}
${P} .dm-f-allerte-capo b{display:block;font-family:'Oswald',system-ui,sans-serif;font-weight:600;font-size:26px;text-transform:uppercase;line-height:1.05;color:#92400e;overflow-wrap:anywhere}
${P} .dm-f-allerte-avviso[data-livello="allarme"] .dm-f-allerte-capo b{color:#991b1b}
${P} .dm-f-allerte-capo em{display:block;font-style:normal;font-size:12px;font-weight:800;color:#a16207;margin-top:2px}
${P} .dm-f-allerte-avviso p{margin:12px 0 0;font-size:13.5px;font-weight:650;line-height:1.5;color:var(--sv-testo)}
${P} .dm-f-allerte-quando{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
${P} .dm-f-allerte-quando span{padding:6px 10px;border-radius:999px;background:var(--sv-card);font-size:12px;font-weight:800;color:#92400e;border:1px solid #fde68a}
${P} .dm-f-allerte-calma b{display:block;font-size:20px;font-weight:850;margin-top:4px}
${P} .dm-f-allerte .dm-f-sv-riga[data-livello="nota"] .dm-f-sv-ic{background:color-mix(in srgb,#f59e0b 16%,var(--sv-card))}
${P} .dm-f-allerte .dm-f-sv-ic svg,${P} .dm-f-allerte-calma-voce svg{width:22px;height:22px}
${P} .dm-f-allerte-calme{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(min(100%,150px),1fr))}
${P} .dm-f-allerte-calma-voce{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:16px;background:var(--sv-fondo);min-width:0}
${P} .dm-f-allerte-calma-voce > span:last-child{min-width:0}
${P} .dm-f-allerte-calma-voce b{display:block;font-size:12.5px;font-weight:850}
${P} .dm-f-allerte-calma-voce em{display:block;font-style:normal;font-size:11px;font-weight:700;color:var(--sv-fioco);overflow-wrap:anywhere}

${P} .dm-f-stampanti-st{border-radius:24px;border:1px solid var(--sv-bordo);background:var(--sv-card);padding:14px;min-width:0;
  box-shadow:0 14px 26px -24px rgba(15,23,42,.6)}
${P} .dm-f-stampanti-st[data-chiede="true"]{border-color:#fde68a;background:linear-gradient(160deg,var(--sv-card),color-mix(in srgb,#fef3c7 60%,var(--sv-card)))}
${P} .dm-f-stampanti-capo{display:flex;align-items:center;gap:12px;min-width:0}
${P} .dm-f-stampanti-fac{flex:0 0 50px;width:50px;height:50px;border-radius:16px;display:grid;place-items:center;font-size:26px;background:var(--sv-tinta)}
${P} .dm-f-stampanti-chi{flex:1;min-width:0}
${P} .dm-f-stampanti-chi b{display:block;font-size:17px;font-weight:850;overflow-wrap:anywhere}
${P} .dm-f-stampanti-chi em{display:block;font-style:normal;font-size:12px;font-weight:750;color:var(--sv-fioco)}
${P} .dm-f-stampanti-chi em[data-tono="stampa"]{color:var(--dm-f-a)}
${P} .dm-f-stampanti-chi em[data-tono="ferma"]{color:#b91c1c}
${P} .dm-f-stampanti-cart{display:flex;gap:10px;margin-top:14px;height:120px}
${P} .dm-f-stampanti-c{flex:1;max-width:72px;height:100%;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0}
${P} .dm-f-stampanti-tubo{display:block;width:100%;max-width:56px;flex:1;border-radius:12px;position:relative;overflow:hidden;
  background:var(--sv-fondo);box-shadow:inset 0 0 0 1px var(--sv-bordo)}
${P} .dm-f-stampanti-tubo::after{content:"";position:absolute;left:0;right:0;bottom:0;height:var(--h);background:var(--c)}
${P} .dm-f-stampanti-c .dm-f-sv-num{font-size:16px}
${P} .dm-f-stampanti-c[data-basso="true"] .dm-f-sv-num{color:#b45309}
${P} .dm-f-stampanti-c small{font-size:10px;font-weight:900;letter-spacing:.06em;color:var(--sv-fioco);text-transform:uppercase;
  max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${P} .dm-f-stampanti-consiglio{margin:12px 0 0;padding:10px 12px;border-radius:14px;font-size:13px;font-weight:800;
  background:color-mix(in srgb,#f59e0b 18%,var(--sv-card));color:#92400e}
${P} .dm-f-stampanti-cart[data-una="true"]{height:104px;align-items:center}
${P} .dm-f-stampanti-cart[data-una="true"] .dm-f-stampanti-c{flex:0 0 64px}
${P} .dm-f-stampanti-cart[data-una="true"] .dm-f-stampanti-consiglio{flex:1;margin:0;align-self:center}
html[data-theme="dark"] ${P} .dm-f-stampanti-tubo[data-tinta="nero"]{--c:#cbd5e1!important}
html[data-theme="dark"] ${P} .dm-f-allerte-capo b,html[data-theme="dark"] ${P} .dm-f-allerte-capo em,
html[data-theme="dark"] ${P} .dm-f-allerte-quando span,html[data-theme="dark"] ${P} .dm-f-stampanti-consiglio,
html[data-theme="dark"] ${P} .dm-f-animali-avv{color:#fde68a}
`;

const FINESTRE = [
  ["aria", finestraAria, sottotitoloAria],
  ["piante", finestraPiante, sottotitoloPiante],
  ["acquario", finestraAcquario, sottotitoloAcquario],
  ["animali", finestraAnimali, sottotitoloAnimali],
  ["agenda", finestraAgenda, sottotitoloAgenda],
  ["rifiuti", finestraRifiuti, sottotitoloRifiuti],
  ["allerte", finestraAllerte, sottotitoloAllerte],
  ["stampanti", finestraStampanti, sottotitoloStampanti],
];

/* Lo stile sta tutto sulla prima: il foglio e' uno solo per tutte le finestre. */
FINESTRE.forEach(([chiave, disegna, sottotitolo], indice) =>
  registraFinestra(chiave, { disegna, sottotitolo, stile: indice === 0 ? STILE : "" }),
);
