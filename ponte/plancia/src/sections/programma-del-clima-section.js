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
  cronoVoluto,
  giornataDelProgramma,
  nuovoId,
  orologioNelFuso,
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
  allStates,
  chiamaServizio,
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
  /* Da dove viene la bozza (la firma del programma di Home Assistant che
   * l'ha fatta), se chi guarda l'ha toccata, e quello appena salvato che
   * l'elenco della casa non dice ancora. */
  bozzaDa: "",
  toccata: false,
  appenaSalvato: null,
  esito: "",
  /* Un programma che non si legge piu' (toccato in Home Assistant) o
   * un'automazione di un altro che comanda lo stesso termostato: si va avanti
   * solo se chi guarda lo sceglie — «rifallo da qui» o «crea comunque». */
  scelta: "",
  /* Si e' provato a chiudere con le modifiche non salvate: lo si e' detto. */
  avvisoChiusura: false,
  riprova: null,
});

const GRADI_FUORI = 17;
const GRADI_NUOVA = 20;

/* ── il modello della finestra (puro) ─────────────────────────────────── */

/** Le automazioni che fanno da programma a `entita`: prima quelle a fasce, poi i cronotermostati. */
export function programmiDelTermostato(elenco, entita) {
  const suoi = (Array.isArray(elenco) ? elenco : []).filter(
    (v) => v?.modello?.tipo === "crono" && v.modello.crono?.termostati?.includes(entita),
  );
  return [
    ...suoi.filter((v) => v.modello.crono.programma),
    ...suoi.filter((v) => !v.modello.crono.programma),
  ];
}

/**
 * Le automazioni che programmano `entita` ma la plancia non le sa leggere
 * come programma: un programma nostro toccato a mano in Home Assistant, o
 * uno scritto da chi abita che ne imposta gradi o modo a un orario. «Due
 * programmi si contendono il termostato senza che nessuno lo dica»: la
 * finestra le conta, e non fa finta che non ci siano.
 *
 * Solo quelle: «esco di casa → spegni», «alle 23 spegni gli split», un
 * termostato in una condizione lo toccano ma non sono un altro programma —
 * non bloccano la finestra e nessuno invita a toglierle
 * (`automazioniCheLoToccano`).
 */
export function automazioniCheLoComandano(elenco, entita) {
  return (Array.isArray(elenco) ? elenco : []).filter(
    (v) =>
      !(v?.modello?.tipo === "crono") &&
      ((v?.programma === true && Array.isArray(v?.climi) && v.climi.includes(entita)) ||
        (Array.isArray(v?.climiAOrario) && v.climiAOrario.includes(entita))),
  );
}

/** Le altre automazioni che toccano `entita` senza programmarlo: si dicono
 * con una nota, e basta. */
export function automazioniCheLoToccano(elenco, entita) {
  const programmano = new Set(automazioniCheLoComandano(elenco, entita));
  return (Array.isArray(elenco) ? elenco : []).filter(
    (v) =>
      !programmano.has(v) &&
      !(v?.modello?.tipo === "crono" && v.modello.crono?.termostati?.includes(entita)) &&
      Array.isArray(v?.climi) &&
      v.climi.includes(entita),
  );
}

/** «Anche un'altra automazione tocca questo termostato», senza chiedere
 * niente: spegnerlo quando esci non e' un programma. */
export function toccanoDetto(quanti) {
  if (!(quanti > 0)) return "";
  return quanti === 1
    ? t(
        "Anche un'altra automazione tocca questo termostato (per esempio lo spegne): il programma decide i gradi, lei fa la sua parte.",
        "Another automation also touches this thermostat (for example it turns it off): the schedule sets the temperature, it does its own part.",
      )
    : t(
        `Anche altre ${quanti} automazioni toccano questo termostato (per esempio lo spengono): il programma decide i gradi, loro fanno la loro parte.`,
        `${quanti} other automations also touch this thermostat (for example they turn it off): the schedule sets the temperature, they do their own part.`,
      );
}

/** Il programma della plancia per `entita` che non si legge piu', se c'e'. */
export function programmaIlleggibile(elenco, entita) {
  return automazioniCheLoComandano(elenco, entita).find((v) => v.programma === true) || null;
}

/** «C'e' un altro programma», «ci sono altri 2 programmi». */
export function altriDetti(quanti) {
  if (!(quanti > 0)) return "";
  return quanti === 1
    ? t(
        "C'è un altro programma per questo termostato fra le Automazioni: cambia i gradi anche lui. Toglilo lì.",
        "There is another schedule for this thermostat in Automations: it changes the temperature too. Remove it there.",
      )
    : t(
        `Ci sono altri ${quanti} programmi per questo termostato fra le Automazioni: cambiano i gradi anche loro. Toglili lì.`,
        `There are ${quanti} other schedules for this thermostat in Automations: they change the temperature too. Remove them there.`,
      );
}

/* Il programma illeggibile che il salvataggio sostituisce, detto per nome. */
function sostituitoDetto(nome) {
  return t(
    `Salvando, «${nome}» in Home Assistant viene sostituito da questo.`,
    `Saving replaces «${nome}» in Home Assistant with this one.`,
  );
}

/**
 * Cosa dire dopo il salvataggio: solo quello che e' successo davvero. «Il
 * termostato e' stato aggiornato» se Home Assistant ha ricaricato il
 * programma e lo ha fatto scattare; se non l'ha ancora ricaricato si dice
 * quello; con una finestra aperta il termostato resta spento, e si dice
 * quello invece di «adesso vale 20,5°». `adesso` e' l'ora di casa
 * (`orologioNelFuso`).
 */
export function esitoDelSalvataggio({ fatto, crono, attiva, adesso, stati = {} }) {
  if (!attiva)
    return t(
      "Salvato in Home Assistant. Il programma è sospeso: i gradi non cambiano.",
      "Saved in Home Assistant. The schedule is paused: the temperature does not change.",
    );
  if (fatto?.confermata === false)
    return t(
      "Salvato in Home Assistant, che non l'ha ancora ricaricato: i gradi cambiano al prossimo cambio di fascia. Riapri tra poco per vederlo.",
      "Saved in Home Assistant, which has not reloaded it yet: the temperature changes at the next slot change. Reopen shortly to see it.",
    );
  const voluto = cronoVoluto(crono, { adesso, stati });
  if (voluto === "spento")
    return t(
      "Salvato in Home Assistant. C'è una finestra aperta: il termostato resta spento finché non si chiude, poi segue il programma.",
      "Saved in Home Assistant. A window is open: the thermostat stays off until it closes, then follows the schedule.",
    );
  const gradi = gradiDetti(voluto);
  return fatto?.applicato === true
    ? t(
        `Salvato in Home Assistant. Adesso vale ${gradi}: il termostato è stato aggiornato.`,
        `Saved in Home Assistant. ${gradi} applies now: the thermostat has been updated.`,
      )
    : t(
        `Salvato in Home Assistant. Adesso vale ${gradi}: il termostato si aggiorna al prossimo cambio di fascia.`,
        `Saved in Home Assistant. ${gradi} applies now: the thermostat updates at the next slot change.`,
      );
}

/** L'automazione che fa da programma a `entita`: prima quella a fasce, poi un cronotermostato qualunque. */
export function programmaDelTermostato(elenco, entita) {
  return programmiDelTermostato(elenco, entita)[0] || null;
}

/** La firma di un programma: cambia quando cambia quello che Home Assistant ha. */
export function firmaDelProgramma(voce) {
  if (!voce) return "nessuno";
  const c = cronoPulito(voce.modello?.crono || {});
  return JSON.stringify([
    voce.id || voce.modello?.id || "",
    c.fuori,
    c.programma || [c.feriali, c.festivi, c.inCasa],
  ]);
}

/**
 * Da dove si prende la bozza adesso. «Se ricarichi la pagina ti cambia
 * l'orario»: la finestra si apriva prima che la casa avesse risposto, la
 * bozza nasceva dal programma di serie e restava quella anche dopo, quando
 * il programma vero arrivava. Adesso una bozza non toccata segue sempre
 * quello che Home Assistant dice; una toccata resta di chi la sta scrivendo;
 * e quella appena salvata vale finche' l'elenco non la conferma.
 */
export function bozzaDaTenere({
  bozzaDa,
  toccata,
  appenaSalvato,
  firma,
  adesso = Date.now(),
  elencoIl = 0,
}) {
  if (toccata) return "tieni";
  if (appenaSalvato && appenaSalvato.firma !== firma) {
    /* Finche' non arriva un elenco chiesto DOPO il salvataggio, l'elenco che
     * c'e' e' quello di prima: non dice niente (una rilettura persa perche'
     * la casa era occupata riportava in vista il programma vecchio). Dieci
     * minuti senza nessun elenco nuovo, e si torna a credere alla casa. */
    if (!(elencoIl > appenaSalvato.il) && adesso - appenaSalvato.il < 600000) return "tieni";
    if (adesso - appenaSalvato.il < 60000) return "tieni";
  }
  return bozzaDa === firma ? "tieni" : "rifai";
}

/* Un cronotermostato di prima diventa programma: le sue fasce con i gradi
 * «in casa», e fuori i suoi gradi di fuori. Cosi' aprendolo qui non cambia
 * niente finche' non si tocca. */
export function bozzaDalCrono(crono, entita) {
  const c = cronoPulito(
    crono || { termostati: [entita], programma: PROGRAMMA_DI_SERIE, fuori: GRADI_FUORI },
  );
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

/* Il fuso di Home Assistant: dal suo `hass`, se la plancia ci sta dentro, o
 * da quello che dice il ponte. */
const fusoDiCasa = () =>
  clean(root.__HASS__?.config?.time_zone) ||
  clean(root.hass?.config?.time_zone) ||
  clean(casa().ponte?.fuso);
const oraDiCasa = () => orologioNelFuso(Date.now(), fusoDiCasa());

/* ── la finestra ──────────────────────────────────────────────────────── */

const casa = () => statoDelleAutomazioni();
const premium = () => casa().premium === true;
const puoScrivere = () => casa().ponte?.puoScrivere === true;

function voceDi(entita) {
  return programmaDelTermostato(automazioniDiCasa(), entita);
}

/* La casa ha gia' risposto con le sue automazioni? Prima no: si aspetta,
 * invece di mostrare (e lasciar salvare) il programma di serie. */
const casaHaRisposto = () => Boolean(casa().ponte) || casa().assente === true;

function nomeDellaStanza() {
  const unita = climateUnits().find((u) => u.entity === state.entita);
  return clean(unita?.room) || clean(unita?.name) || state.entita;
}

function laBozza() {
  const voce = voceDi(state.entita);
  const firma = firmaDelProgramma(voce);
  if (state.appenaSalvato && state.appenaSalvato.firma === firma) state.appenaSalvato = null;
  if (
    state.bozza &&
    state.bozza.__entita === state.entita &&
    bozzaDaTenere({
      bozzaDa: state.bozzaDa,
      toccata: state.toccata,
      appenaSalvato: state.appenaSalvato,
      firma,
      elencoIl: casa().elencoIl || 0,
    }) === "tieni"
  )
    return state.bozza;
  state.bozza = { ...bozzaDalCrono(voce?.modello?.crono, state.entita), __entita: state.entita };
  state.bozzaDa = firma;
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
  const adesso = oraDiCasa();
  const p = cronoProssimo(crono, adesso);
  if (!p) return "";
  const quando = new Date(p.alle);
  const oggi = new Date(adesso);
  const ora = oraDetta(quando.getHours() * 60 + quando.getMinutes());
  const gradi = gradiDetti(p.voluto);
  const stessoGiorno = quando.toDateString() === oggi.toDateString();
  return stessoGiorno
    ? t(`alle ${ora} → ${gradi}`, `at ${ora} → ${gradi}`)
    : t(`domani alle ${ora} → ${gradi}`, `tomorrow at ${ora} → ${gradi}`);
}

function statoDetto(voce, bozza) {
  if (casa().assente) return t("serve l'add-on GdAHome", "needs the GdAHome add-on");
  if (!voce) return t("non c'è ancora", "not set yet");
  if (voce.attiva === false) return t("sospeso", "paused");
  return prossimoDetto(bozza) || t("attivo", "active");
}

export function programmaMarkup() {
  if (!casaHaRisposto()) {
    /* La lettura e' andata male (scadenza, filo caduto): lo si dice, con
     * «Riprova» — e intanto si riprova da soli. */
    const guasto = clean(casa().erroreLettura);
    const testa = `<button type="button" class="dm-prg-testa" data-dm-prg-apri aria-expanded="${state.aperto}"><span class="dm-prg-tit">🗓️ ${esc(t("Programma", "Schedule"))}</span><span class="dm-prg-stato">${esc(guasto ? t("non letto", "not read") : t("leggo…", "reading…"))}</span><span class="dm-prg-freccia" aria-hidden="true">▾</span></button>`;
    if (!state.aperto) return testa;
    return guasto
      ? `${testa}<div class="dm-prg-corpo"><p class="dm-prg-errore" role="alert">${esc(
          t(
            `Non riesco a leggere il programma da Home Assistant (${guasto}). Riprovo da solo fra qualche secondo.`,
            `I can't read the schedule from Home Assistant (${guasto}). I'll try again in a few seconds.`,
          ),
        )}</p><button type="button" class="dm-prg-pill" data-dm-prg-riprova>↻ ${esc(t("Riprova", "Try again"))}</button></div>`
      : `${testa}<div class="dm-prg-corpo"><p class="dm-prg-nota">${esc(t("Leggo il programma da Home Assistant…", "Reading the schedule from Home Assistant…"))}</p></div>`;
  }
  const voce = voceDi(state.entita);
  const elenco = automazioniDiCasa();
  const comandano = automazioniCheLoComandano(elenco, state.entita);
  const toccano = automazioniCheLoToccano(elenco, state.entita).length;
  const illeggibile = voce ? null : programmaIlleggibile(elenco, state.entita);
  const altri =
    programmiDelTermostato(elenco, state.entita).length -
    (voce ? 1 : 0) +
    comandano.length -
    (illeggibile ? 1 : 0);
  /* Senza un programma che si legge, ma con qualcuno che comanda gia' questo
   * termostato: non si mostra il programma di serie come se fosse il suo. */
  /* Appena salvato («Crea comunque», «Rifallo da qui»), finche' l'elenco
   * della casa non lo dice anche lui: si resta sul programma salvato, col
   * suo esito — non si torna all'avviso di prima. */
  const blocco =
    !voce && !state.appenaSalvato && (illeggibile || comandano.length) && !state.scelta;
  if (blocco) {
    const testa = `<button type="button" class="dm-prg-testa" data-dm-prg-apri aria-expanded="${state.aperto}"><span class="dm-prg-tit">🗓️ ${esc(t("Programma", "Schedule"))}</span><span class="dm-prg-stato">${esc(illeggibile ? t("da rifare", "to redo") : t("c'è già chi lo comanda", "already controlled"))}</span><span class="dm-prg-freccia" aria-hidden="true">▾</span></button>`;
    const nome = clean((illeggibile || comandano[0])?.nome) || "?";
    const testo = illeggibile
      ? t(
          `Il programma «${nome}» di questo termostato è stato cambiato in Home Assistant e qui non si legge più. Per non perderne un pezzo senza dirlo, la plancia non te lo mostra: puoi rifarlo da qui (sostituisce quello di Home Assistant) o lasciarlo com'è e modificarlo lì.`,
          `The schedule «${nome}» for this thermostat was changed in Home Assistant and can't be read here any more. So as not to lose part of it silently, the dashboard doesn't show it: you can redo it from here (it replaces the one in Home Assistant) or leave it and edit it there.`,
        )
      : t(
          `Fra le Automazioni c'è «${nome}» che cambia già i gradi di questo termostato. Un programma nuovo si metterebbe a litigare con lei: toglila prima in Home Assistant, o crea comunque il programma sapendolo.`,
          `In Automations «${nome}» already changes this thermostat's temperature. A new schedule would fight with it: remove it in Home Assistant first, or create the schedule anyway knowing that.`,
        );
    const tasto =
      premium() && !casa().assente
        ? `<button type="button" class="dm-prg-pill" data-dm-prg-scelta="${illeggibile ? "rifai" : "nuovo"}">${esc(illeggibile ? t("Rifallo da qui", "Redo it here") : t("Crea comunque un programma", "Create a schedule anyway"))}</button>`
        : "";
    if (!state.aperto) return testa;
    return `${testa}<div class="dm-prg-corpo"><p class="dm-prg-errore" role="alert">${esc(testo)}</p>${altri > 0 ? `<p class="dm-prg-nota">${esc(altriDetti(altri))}</p>` : ""}${tasto}</div>`;
  }
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
${altri > 0 ? `<p class="dm-prg-nota">${esc(altriDetti(altri))}</p>` : ""}
${toccano > 0 ? `<p class="dm-prg-nota dm-prg-tocca">${esc(toccanoDetto(toccano))}</p>` : ""}
${
  !voce && illeggibile && state.scelta === "rifai"
    ? `<p class="dm-prg-nota">${esc(sostituitoDetto(clean(illeggibile.nome)))}</p>`
    : ""
}
${state.avvisoChiusura ? `<p class="dm-prg-errore" role="alert">${esc(t("Hai modifiche non salvate al programma: salvale, oppure chiudi di nuovo per scartarle.", "You have unsaved changes to the schedule: save them, or close again to discard them."))}</p>` : ""}
${state.errore ? `<p class="dm-prg-errore" role="alert">${esc(state.errore)}</p>` : ""}
${state.esito ? `<p class="dm-prg-esito${state.esitoInAttesa ? " dm-prg-esito-attesa" : ""}" role="status">${esc(state.esito)}</p>` : ""}
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
  if (!casaHaRisposto() && clean(casa().erroreLettura) && !state.riprova)
    state.riprova = root.setTimeout?.(() => {
      state.riprova = null;
      /* Solo l'elenco: le proposte e il Premium non c'entrano col programma. */
      void chiediAllaCasa({ forza: true, soloElenco: true });
    }, 5000);
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
    state.bozzaDa = "";
    state.toccata = false;
    state.appenaSalvato = null;
    state.aperto = false;
    state.giorno = "feriali";
    state.errore = "";
    state.esito = "";
    state.esitoInAttesa = false;
    state.salvato = false;
    state.scelta = "";
  } else if (state.toccata) {
    /* Riaperta la finestra dello stesso termostato: le modifiche non salvate
     * della volta prima non ci sono piu' — come dice il messaggio. */
    scartaLeModifiche();
  }
  state.avvisoChiusura = false;
  disegna();
  void chiediAllaCasa();
}

function scartaLeModifiche() {
  state.bozza = null;
  state.bozzaDa = "";
  state.toccata = false;
  state.errore = "";
  state.avvisoChiusura = false;
}

/* ── i tocchi ─────────────────────────────────────────────────────────── */

function cambia(fai) {
  if (!casaHaRisposto()) return;
  const b = laBozza();
  fai(b);
  b.programma[state.giorno] = giornataDelProgramma(b.programma[state.giorno]);
  state.toccata = true;
  state.salvato = false;
  state.errore = "";
  state.esito = "";
  state.esitoInAttesa = false;
  state.avvisoChiusura = false;
  disegna();
}

async function salva() {
  if (state.salvando || !premium() || !casaHaRisposto()) return;
  const b = laBozza();
  const voce = voceDi(state.entita);
  /* «Rifallo da qui»: si salva sopra quello che non si legge piu', con lo
   * stesso id — mai un secondo programma accanto. */
  const sopra =
    !voce && state.scelta === "rifai" ? programmaIlleggibile(automazioniDiCasa(), state.entita) : null;
  const appena = !voce && state.appenaSalvato?.entita === state.entita ? state.appenaSalvato : null;
  const stanza = nomeDellaStanza();
  const crono = cronoPulito({
    ...b,
    termostati: b.termostati.length ? b.termostati : [state.entita],
  });
  const automazione = {
    /* Risalvando prima che l'elenco della casa lo dica, si riusa l'id
     * appena salvato: mai un secondo programma accanto. */
    id: voce?.modello?.id || voce?.id || sopra?.id || appena?.id || nuovoId(),
    nome:
      voce?.nome || sopra?.nome || t(`Programma ${stanza}`, `Schedule ${stanza}`).slice(0, 60),
    attiva: voce ? voce.attiva !== false : sopra ? sopra.attiva !== false : true,
    tipo: "crono",
    crono,
  };
  state.salvando = true;
  state.errore = "";
  state.avvisoChiusura = false;
  disegna();
  try {
    const fatto = await chiediAHomeAssistant(
      {
        type: "ponte/automazioni/salva",
        automazione,
        automazione_id: voce?.id || sopra?.id || appena?.id || "",
        ...(sopra ? { sovrascrivi: true } : {}),
      },
      25000,
    );
    state.salvato = true;
    /* Quello salvato resta in vista finche' l'elenco della casa non lo dice
     * anche lui: niente piu' «torna quello di prima» per un attimo. */
    const salvato = { ...b, ...crono };
    state.bozza = { ...salvato, __entita: state.entita };
    state.toccata = false;
    state.appenaSalvato = {
      firma: firmaDelProgramma({ id: fatto?.id || automazione.id, modello: { crono } }),
      il: Date.now(),
      id: fatto?.id || automazione.id,
      entita: state.entita,
    };
    state.bozzaDa = state.appenaSalvato.firma;
    state.scelta = "";
    /* «Salvato, ma Home Assistant non l'ha ancora ricaricato» non e' un
     * successo pieno: si dice in ambra, non nel verde del «fatto». */
    state.esitoInAttesa = fatto?.confermata === false;
    state.esito = esitoDelSalvataggio({
      fatto,
      crono,
      attiva: automazione.attiva,
      adesso: oraDiCasa(),
      stati: allStates(),
    });
    root.edToast?.(
      t("💾 Programma salvato in Home Assistant", "💾 Schedule saved in Home Assistant"),
    );
    void chiediAllaCasa({ forza: true });
    /* Se Home Assistant non l'aveva ancora ricaricato, si torna a chiedere
     * un po' piu' in la'. */
    for (const dopo of fatto?.confermata === false ? [2500, 8000, 30000] : [2500])
      root.setTimeout?.(() => void chiediAllaCasa({ forza: true }), dopo);
  } catch (errore) {
    const no = clean(errore?.message) || "?";
    state.esito = "";
    state.esitoInAttesa = false;
    state.errore =
      clean(errore?.code) === "unauthorized"
        ? t(
            "Non salvato: il programma lo salva solo chi amministra Home Assistant. Le modifiche restano qui finché non chiudi la finestra.",
            "Not saved: only a Home Assistant administrator can save the schedule. Your changes stay here until you close the window.",
          )
        : t(
            `Non salvato: ${no}. Le modifiche restano qui: riprova.`,
            `Not saved: ${no}. Your changes stay here: try again.`,
          );
  } finally {
    state.salvando = false;
    disegna();
  }
}

/* La finestra scorre fino alla testa del Programma, se serve: solo dentro
 * di se', la pagina sotto resta dov'e'. */
function mostraIlProgramma() {
  const finestra = doc?.querySelector?.("#clima-popup-overlay .clima-popup");
  const nodo = finestra?.querySelector?.("[data-dm-prg]");
  if (!finestra || !nodo) return;
  const vai = () => {
    const sopra = nodo.getBoundingClientRect().top - finestra.getBoundingClientRect().top;
    const sotto = nodo.getBoundingClientRect().bottom - finestra.getBoundingClientRect().bottom;
    if (sotto <= 0 && sopra >= 0) return;
    const quanto = Math.max(0, finestra.scrollTop + sopra - 12);
    if (typeof finestra.scrollTo === "function") finestra.scrollTo({ top: quanto, behavior: "smooth" });
    else finestra.scrollTop = quanto;
  };
  (root.requestAnimationFrame || ((f) => root.setTimeout?.(f, 0)))(vai);
}

/* Quanto della parte bassa dello schermo prende la barra delle sezioni,
 * se in questo momento si vede: la finestra si ferma sopra. Sul computer la
 * barra sta fuori dallo schermo, e allora non toglie niente. */
function lasciaLaBarra() {
  const velo = doc?.getElementById?.("clima-popup-overlay");
  if (!velo?.style) return;
  const barra = doc.querySelector?.("nav.tabs.bottom-nav-bar");
  const alto = root.innerHeight || 0;
  let prende = 0;
  if (barra && alto && root.getComputedStyle?.(barra)?.display !== "none") {
    const r = barra.getBoundingClientRect();
    if (r.height > 0 && r.top < alto && r.bottom > 0) prende = Math.round(alto - r.top);
  }
  const valore = `${Math.max(0, prende)}px`;
  if (velo.style.getPropertyValue("--dm-clima-barra") !== valore)
    velo.style.setProperty("--dm-clima-barra", valore);
}

function suClick(evento) {
  const bersaglio = evento.target?.closest?.("[data-dm-prg] button");
  if (!bersaglio) return;
  const d = bersaglio.dataset;
  evento.stopPropagation();
  if (d.dmPrgApri !== undefined) {
    state.aperto = !state.aperto;
    disegna();
    /* Aperto, si porta in vista: sul telefono il Programma sta in fondo
     * alla finestra, e si aprirebbe sotto il bordo. */
    if (state.aperto) mostraIlProgramma();
    return;
  }
  if (d.dmPrgGiorno) {
    state.giorno = d.dmPrgGiorno === "festivi" ? "festivi" : "feriali";
    disegna();
    return;
  }
  if (d.dmPrgRiprova !== undefined) {
    void chiediAllaCasa({ forza: true, soloElenco: true });
    return;
  }
  if (!premium()) return;
  if (d.dmPrgScelta) {
    state.scelta = d.dmPrgScelta === "rifai" ? "rifai" : "nuovo";
    disegna();
    return;
  }
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
    if (voce) {
      const accesa = voce.attiva === false;
      alternaInCasa(voce, accesa);
      /* Riacceso, decide subito: i gradi della fascia di adesso, senza
       * aspettare il prossimo cambio. */
      if (accesa && voce.entity_id)
        root.setTimeout?.(
          () =>
            chiamaServizio({
              domain: "automation",
              service: "trigger",
              data: { entity_id: voce.entity_id, skip_condition: true },
            }),
          600,
        );
    }
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

/* La finestra del termostato sta sopra a tutto e scorre dentro di se'.
 *
 * Dal campo (1.18.9.2, telefono): «non c'è lo scroll, non vedo le cose
 * sotto». Il velo della finestra stava sotto la barra delle sezioni (9000
 * contro 9900) e la finestra era alta l'88% dello schermo, centrata: su un
 * telefono basso — o nell'app, dove lo schermo della plancia e' piu' corto —
 * il suo fondo, col Programma chiuso, finiva dietro la barra, e non c'era
 * niente da scorrere perche' la finestra non era piu' alta di se stessa.
 * Adesso il velo sta sopra la barra e sopra le finestre della Home (9999),
 * da cui il termostato si puo' aprire, e sotto il report del clima (10050),
 * che si apre da qui; la finestra si ferma sopra la barra, se la barra si
 * vede (la misura `lasciaLaBarra`), non supera lo schermo che si vede
 * davvero (dvh, con le fasce del sistema e quella che la plancia si tiene in
 * cima) e quello che non ci sta si scorre dentro, senza trascinare la pagina
 * sotto. */
const STILE = `
#clima-popup-overlay{z-index:10000;--dm-clima-su:max(10px,env(safe-area-inset-top),var(--dm-cima-libera,0px));--dm-clima-giu:max(10px,env(safe-area-inset-bottom),calc(var(--dm-clima-barra,0px) + 8px))}
#clima-popup-overlay.show{padding:var(--dm-clima-su) 10px var(--dm-clima-giu);overscroll-behavior:contain}
#clima-popup-overlay .clima-popup{max-height:calc(100vh - 20px);max-height:calc(100dvh - var(--dm-clima-su) - var(--dm-clima-giu));overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y}
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
.dm-prg-errore{margin:0;padding:8px 10px;border-radius:10px;font-size:12px;font-weight:700;color:#dc2626;background:rgba(220,38,38,.10)}
.dm-prg-esito{margin:0;padding:8px 10px;border-radius:10px;font-size:12px;font-weight:700;color:#15803d;background:rgba(34,197,94,.12)}
.dm-prg-esito.dm-prg-esito-attesa{color:#d97706;background:rgba(245,158,11,.14);box-shadow:inset 3px 0 0 #f59e0b}
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
    lasciaLaBarra();
    root.queueMicrotask?.(() => apri(entity));
    return esito;
  }
  Object.assign(avvolto, originale);
  avvolto.__dmProgramma = true;
  avvolto.__dmPrevious = originale;
  root.apriClimaPopup = avvolto;
  return true;
}

/* Chiudere con le modifiche non salvate: la prima volta si avvisa e la
 * finestra resta aperta; la seconda si chiude e le modifiche si scartano. */
function avvolgiLaChiusura() {
  const originale = root.chiudiClimaPopup;
  if (typeof originale !== "function" || originale.__dmProgramma) return false;
  function avvolto(...argomenti) {
    /* Il guscio chiama la chiusura anche per un tocco dentro la finestra, e la
     * ignora se il tocco non e' sul velo: qui uguale. */
    const evento = argomenti[0];
    const chiude =
      !evento?.target || evento.target === doc?.getElementById?.("clima-popup-overlay");
    if (!chiude) return originale.apply(this, argomenti);
    if (state.toccata && state.entita && !state.avvisoChiusura) {
      state.avvisoChiusura = true;
      state.aperto = true;
      disegna();
      return undefined;
    }
    if (state.toccata) scartaLeModifiche();
    state.avvisoChiusura = false;
    /* Chiusa la finestra, nessuno aspetta piu' la rilettura. */
    if (state.riprova) root.clearTimeout?.(state.riprova);
    state.riprova = null;
    return originale.apply(this, argomenti);
  }
  Object.assign(avvolto, originale);
  avvolto.__dmProgramma = true;
  avvolto.__dmPrevious = originale;
  root.chiudiClimaPopup = avvolto;
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
  avvolgiLaChiusura();
  /* Il telefono girato, o la tastiera: la barra si sposta, si rimisura. */
  root.addEventListener?.("resize", () => {
    if (doc.getElementById("clima-popup-overlay")?.classList?.contains("show")) lasciaLaBarra();
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"]) {
    root.addEventListener?.(evento, avvolgi);
    root.addEventListener?.(evento, avvolgiLaChiusura);
  }
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installProgrammaDelClima, { once: true });
} else {
  senzaCadere(installProgrammaDelClima);
}
