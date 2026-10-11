/* Le finestre dei widget del gruppo «impianti» (vedi `../finestre-dei-widget.js`).
 *
 * Scaldabagno, caldaia, UPS, accumulo, acqua e gas, piscina, irrigazione e
 * ventilazione: le macchine di casa. Ognuna apriva la finestra generica — il
 * verdetto che contava le righe, «Le misure» a caselle tutte uguali, «Lo
 * stato» a pillole — e ognuna ci perdeva la cosa per cui la si apre: quanto
 * manca all'acqua calda, se la caldaia sta cedendo calore, quanto regge l'UPS
 * se va via la luce, quale zona sta bagnando.
 *
 * Qui ogni finestra parte da quella domanda: in cima la risposta in grande,
 * subito sotto i comandi, e poi quello che resta da tenere d'occhio. I dati
 * vengono dal modello della tessera; quello che la casa non ha non compare —
 * niente numeri d'esempio.
 */
import { registraFinestra, tastoServizio } from "../finestre-dei-widget.js";
import { clean, esc, formatNumber, root, section, siComanda, t } from "../shared.js";
import { quantoTempoInParole } from "../../core/da-quanto.js";
import { importRateEntity, resolveRate } from "../../core/energy-calculations.js";

const P = ":is(#dm-widget-popup,#dm-casa-popup,#dm-qa-popup)";

/* ── i pezzi comuni ───────────────────────────────────────────────────── */

/* Un numero vero o `null`: una casella vuota non e' uno zero. */
const num = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const letto = Number(String(valore).replace(",", "."));
  return Number.isFinite(letto) ? letto : null;
};

const tra = (valore, minimo, massimo) => Math.max(minimo, Math.min(massimo, valore));

const gradi = (valore, cifre = 1) => `${formatNumber(valore, cifre)}°`;

/* I decimali che dicono qualcosa: «55°», non «55,0°». */
const gradiUtili = (valore) =>
  gradi(valore, Number.isInteger(Math.round(valore * 10) / 10) ? 0 : 1);

const percento = (valore) => `${formatNumber(Math.round(valore), 0)}%`;

/** I watt come si leggono: «640 W», «1,18 kW». */
function watt(valore) {
  const assoluto = Math.abs(valore);
  if (assoluto >= 1000) return `${formatNumber(assoluto / 1000, 2)} kW`;
  return `${formatNumber(assoluto, 0)} W`;
}

/** Da quanto, in parole: «47 minuti», «3 giorni». */
function daQuanto(istante) {
  if (!Number.isFinite(istante)) return "";
  return quantoTempoInParole((Date.now() - istante) / 60000);
}

/* L'entita' vera dietro una casella mappata a mano (`dm.qualcosa`). */
function vera(riferimento) {
  const chiave = clean(riferimento);
  if (!chiave) return "";
  try {
    return clean(root.resolveEntity?.(chiave)) || chiave;
  } catch (_error) {
    return chiave;
  }
}

/* Il prezzo del chilowattora, solo se la casa l'ha detto: senza, il costo non
 * si scrive (un «circa 0,58 €» col prezzo di qualcun altro e' un numero finto). */
function prezzoDelKwh(states) {
  let sorgente = importRateEntity(section("energy", {}));
  if (sorgente) sorgente = vera(sorgente);
  else {
    sorgente = root.cdCfg?.("cd_costo_kwh");
    if (sorgente === undefined || sorgente === null || sorgente === "") {
      try {
        sorgente = root.localStorage?.getItem?.("cd_costo_kwh");
      } catch (_error) {
        sorgente = null;
      }
    }
  }
  return resolveRate(sorgente, states || {}, null);
}

const euro = (valore) => `${formatNumber(valore, 2)} €`;

/* Il guscio di ogni finestra: la classe comune del gruppo e quella sua. */
function guscio(chiave, corpo, stile = "") {
  return `<div class="dm-f-imp dm-f-${chiave}"${stile ? ` style="${esc(stile)}"` : ""}>${corpo}</div>`;
}

const titoletto = (testo) => `<h4 class="dm-w-titoletto dm-f-imp-tit">${esc(testo)}</h4>`;

/* L'interruttore grande: lo stesso gestore delle luci (`data-dm-w-light`)
 * chiama il toggle giusto per qualunque dominio. */
function leva(entity, acceso, nome) {
  return `<button type="button" class="dm-f-imp-leva" data-dm-w-light="${esc(entity)}" data-on="${acceso === true}" aria-label="${esc(nome)}"><i></i></button>`;
}

/* Una scheda di comando: l'icona, cosa fa, e a destra il suo comando. */
function schedaComando({ icona, titolo, sotto = "", acceso = false, comando = "", chiave = "" }) {
  return `<div class="dm-f-imp-comando"${chiave ? ` data-dm-f-comando="${esc(chiave)}"` : ""} data-on="${acceso === true}">
    <span class="dm-f-imp-ic" aria-hidden="true">${icona}</span>
    <span class="dm-f-imp-tx"><b>${esc(titolo)}</b>${sotto ? `<small>${esc(sotto)}</small>` : ""}</span>
    ${comando}
  </div>`;
}

/* Una casella: l'etichetta, il numero, e sotto il giudizio. */
function casella({ etichetta, valore, sotto = "", tono = "", extra = "", chiave = "" }) {
  return `<div class="dm-f-imp-cas"${chiave ? ` data-dm-f-casella="${esc(chiave)}"` : ""}>
    <small>${esc(etichetta)}</small>
    <span class="dm-f-imp-num">${esc(valore)}</span>
    ${extra}
    ${sotto ? `<em${tono ? ` data-tono="${tono}"` : ""}>${esc(sotto)}</em>` : ""}
  </div>`;
}

const griglia = (caselle, quante = "due") =>
  caselle.filter(Boolean).length
    ? `<div class="dm-f-imp-griglia" data-dm-f-griglia="${quante}">${caselle.filter(Boolean).join("")}</div>`
    : "";

/* L'anello di una percentuale, con dentro il numero. */
function anello(valore, etichetta, colore = "") {
  const quota = tra(Math.round(valore), 0, 100);
  return `<div class="dm-f-imp-anello" style="--p:${quota}${colore ? `;--c:${colore}` : ""}" role="img" aria-label="${esc(`${etichetta} ${quota}%`)}">
    <div><span class="dm-f-imp-num">${esc(percento(quota))}</span><small>${esc(etichetta)}</small></div>
  </div>`;
}

/* Il nome di una macchina quando ce n'e' piu' d'una: con una sola sarebbe
 * un'etichetta su una cosa sola. */
const nomeSePiuDiUna = (nome, piuDiUna) =>
  piuDiUna && clean(nome) ? `<h3 class="dm-f-imp-nome">${esc(nome)}</h3>` : "";

/* ── lo scaldabagno ───────────────────────────────────────────────────── */

/* Il comando dell'obiettivo, dal dominio dell'entita' che lo tiene. */
function comandoDellObiettivo(entity, valore) {
  const dominio = clean(entity).split(".")[0];
  if (dominio === "water_heater" || dominio === "climate")
    return {
      domain: dominio,
      service: "set_temperature",
      data: { entity_id: entity, temperature: valore },
    };
  if (dominio === "number" || dominio === "input_number")
    return { domain: dominio, service: "set_value", data: { entity_id: entity, value: valore } };
  return null;
}

/* I tasti − e + dell'obiettivo, col passo e i limiti che l'entita' dichiara. */
function passiDellObiettivo(lettura, states) {
  const entity = clean(lettura.obiettivoEntita);
  if (!entity || lettura.obiettivo == null || !siComanda(entity)) return "";
  if (!comandoDellObiettivo(entity, 0)) return "";
  const attributi = states?.[entity]?.attributes || {};
  const passo = num(attributi.target_temp_step) ?? num(attributi.step) ?? 1;
  const minimo = num(attributi.min_temp) ?? num(attributi.min) ?? -Infinity;
  const massimo = num(attributi.max_temp) ?? num(attributi.max) ?? Infinity;
  const tasto = (verso, segno, nome) => {
    const nuovo = Math.round(((lettura.obiettivo + verso * passo) / passo) * 1000) / 1000;
    const arrotondato = Math.round(Math.round(nuovo / passo) * passo * 100) / 100;
    const fuori = arrotondato < minimo || arrotondato > massimo;
    return tastoServizio(comandoDellObiettivo(entity, arrotondato), {
      classe: "dm-f-imp-passo",
      testo: segno,
      attributi: `aria-label="${esc(nome)}" data-dm-f-obiettivo="${verso > 0 ? "su" : "giu"}"${fuori ? " disabled" : ""}`,
    });
  };
  return `<span class="dm-f-imp-passi">${tasto(-1, "−", t("Abbassa l'obiettivo", "Lower the target"))}<b class="dm-f-imp-num">${esc(gradiUtili(lettura.obiettivo))}</b>${tasto(1, "+", t("Alza l'obiettivo", "Raise the target"))}</span>`;
}

function unoScaldabagno(lettura, piuDiUno, states, prezzo) {
  const temperatura = num(lettura.temperatura);
  const obiettivo = num(lettura.obiettivo);
  const potenza = num(lettura.potenza);
  const acceso = lettura.acceso === true;
  const stato = lettura.stato;

  /* L'eroe: il serbatoio che si riempie fino alla linea dell'obiettivo, e
   * accanto l'acqua di adesso con quanto manca. */
  const quota = num(lettura.quota);
  const serbatoio =
    quota == null
      ? ""
      : `<div class="dm-f-scaldabagno-serbatoio" aria-hidden="true"><i style="height:${Math.round(quota * 86)}%"></i><b></b><em>${esc(gradiUtili(obiettivo))}</em></div>`;
  const righe = [];
  if (stato === "scalda" && obiettivo != null && temperatura != null)
    righe.push(
      `<b>${esc(gradi(Math.max(0, obiettivo - temperatura)))}</b> ${esc(t("sotto l'obiettivo di", "below the target of"))} ${esc(gradiUtili(obiettivo))}`,
    );
  else if (stato === "pronto" && obiettivo != null)
    righe.push(`${esc(t("Obiettivo", "Target"))} ${esc(gradiUtili(obiettivo))}`);
  if (Number.isFinite(lettura.da) && (acceso || lettura.acceso === false))
    righe.push(
      esc(
        `${acceso ? t("scalda da", "heating for") : t("spento da", "off for")} ${daQuanto(lettura.da)}`,
      ),
    );
  const chip =
    stato === "scalda"
      ? `${t("Scalda", "Heating")}${potenza != null && potenza > 0 ? ` · ${watt(potenza)}` : ""}`
      : stato === "pronto"
        ? t("Acqua pronta", "Water ready")
        : stato === "spento"
          ? t("Spento", "Off")
          : "";
  const eroe = `<section class="dm-f-imp-eroe dm-f-scaldabagno-eroe" data-stato="${esc(stato)}">
    ${serbatoio}
    <div class="dm-f-imp-dx">
      <small class="dm-f-imp-etic">${esc(t("L'acqua adesso", "Water now"))}</small>
      <span class="dm-f-imp-num dm-f-imp-grande">${esc(
        temperatura != null ? gradi(temperatura) : acceso ? t("Acceso", "On") : t("Spento", "Off"),
      )}</span>
      ${righe.length ? `<div class="dm-f-imp-fianco">${righe.join("<br>")}</div>` : ""}
      ${chip ? `<span class="dm-f-imp-chip" data-on="${stato === "scalda"}"><i></i>${esc(chip)}</span>` : ""}
    </div>
  </section>`;

  /* I comandi subito sotto: la resistenza, e l'obiettivo coi suoi tasti. */
  const comandi = [];
  const interruttore = clean(lettura.comandabile);
  if (interruttore)
    comandi.push(
      schedaComando({
        chiave: "resistenza",
        icona: "🔌",
        titolo: acceso
          ? t("Resistenza accesa", "Heating element on")
          : t("Resistenza spenta", "Heating element off"),
        sotto:
          acceso && obiettivo != null
            ? `${t("si spegne da sola a", "switches itself off at")} ${gradiUtili(obiettivo)}`
            : acceso
              ? t("tocca per spegnere", "tap to turn off")
              : t("tocca per accendere", "tap to turn on"),
        acceso,
        comando: siComanda(vera(interruttore))
          ? leva(vera(interruttore), acceso, t("Resistenza", "Heating element"))
          : "",
      }),
    );
  if (obiettivo != null) {
    const passi = passiDellObiettivo(lettura, states);
    comandi.push(
      schedaComando({
        chiave: "obiettivo",
        icona: "🎯",
        titolo: t("Obiettivo", "Target"),
        sotto: t("temperatura dell'acqua", "water temperature"),
        comando:
          passi || `<b class="dm-f-imp-num dm-f-imp-valore">${esc(gradiUtili(obiettivo))}</b>`,
      }),
    );
  }

  /* Oggi: il consumo, e il costo solo se la casa ha un prezzo. */
  const energia = num(lettura.energia);
  const oggi = griglia([
    energia == null
      ? ""
      : casella({
          chiave: "consumato",
          etichetta: t("Consumato", "Energy used"),
          valore: `${formatNumber(energia, 1)} kWh`,
          sotto: prezzo == null ? "" : `${t("circa", "roughly")} ${euro(energia * prezzo)}`,
        }),
    potenza == null || stato === "scalda"
      ? ""
      : casella({ chiave: "potenza", etichetta: t("Adesso", "Now"), valore: watt(potenza) }),
  ]);

  return `${nomeSePiuDiUna(lettura.name, piuDiUno)}${eroe}
    ${comandi.length ? `${titoletto(t("Comandi", "Controls"))}<div class="dm-f-imp-pila">${comandi.join("")}</div>` : ""}
    ${oggi ? `${titoletto(t("Oggi", "Today"))}${oggi}` : ""}`;
}

function disegnaScaldabagno(widget, states) {
  const unita = Array.isArray(widget?.unita) ? widget.unita : [];
  const prezzo = prezzoDelKwh(states);
  return guscio(
    "scaldabagno",
    unita.map((lettura) => unoScaldabagno(lettura, unita.length > 1, states, prezzo)).join(""),
  );
}

/* ── la caldaia ───────────────────────────────────────────────────────── */

/* Il salto fra mandata e ritorno, detto: e' la ragione per cui si guarda. */
function fraseDelSalto(salto) {
  if (salto < 5)
    return t(
      "Il salto è piccolo: l'acqua gira ma cede poco calore.",
      "The drop is small: the water is flowing but giving off little heat.",
    );
  if (salto > 25)
    return t(
      "Il salto è grande: l'impianto sta chiedendo molto calore.",
      "The drop is large: the system is asking for a lot of heat.",
    );
  return t(
    "L'impianto sta prendendo calore: il salto è quello giusto.",
    "The system is taking the heat: the drop is right.",
  );
}

function unaCaldaia(lettura, piuDiUna) {
  const accesa = lettura.inFunzione === true;
  const modulazione = num(lettura.modulazione);
  const titolo =
    lettura.inFunzione === true
      ? lettura.uscita === "boiler"
        ? t("Accesa, scalda l'acqua", "On, heating the water")
        : t("Accesa, scalda la casa", "On, heating the house")
      : lettura.inFunzione === false
        ? lettura.interruttoreAcceso === true
          ? t("Accesa, a riposo", "On, resting")
          : t("Spenta", "Off")
        : lettura.interruttoreAcceso === true
          ? t("Accesa", "On")
          : lettura.interruttoreAcceso === false
            ? t("Spenta", "Off")
            : "";
  const mandata = num(lettura.mandata);
  const ritorno = num(lettura.ritorno);
  const salto = num(lettura.salto);
  const nodo = (etichetta, valore) =>
    `<div class="dm-f-caldaia-nodo"><small class="dm-f-imp-etic">${esc(etichetta)}</small><span class="dm-f-imp-num">${esc(valore == null ? "—" : gradi(valore))}</span></div>`;
  const giro =
    mandata == null && ritorno == null
      ? ""
      : `<div class="dm-f-caldaia-giro">
          ${nodo(t("Mandata", "Flow"), mandata)}
          <div class="dm-f-caldaia-freccia">${
            salto == null
              ? '<i aria-hidden="true">⇄</i>'
              : `<i aria-hidden="true">⇄</i>${esc(t("cede", "gives off"))}<br>${esc(gradi(salto))}`
          }</div>
          ${nodo(t("Ritorno", "Return"), ritorno)}
        </div>`;
  const frase =
    accesa && salto != null ? `<p class="dm-f-imp-frase">${esc(fraseDelSalto(salto))}</p>` : "";
  const eroe =
    titolo || giro
      ? `<section class="dm-f-imp-eroe dm-f-caldaia-eroe">
          ${
            titolo
              ? `<div class="dm-f-caldaia-testa"><span class="dm-f-caldaia-fiamma" data-on="${accesa}" aria-hidden="true">🔥</span><div>
              <small class="dm-f-imp-etic">${esc(t("Adesso", "Now"))}</small>
              <b class="dm-f-imp-titolo">${esc(titolo)}</b>
              ${accesa && modulazione != null ? `<div class="dm-f-imp-fianco">${esc(`${t("fiamma al", "flame at")} ${percento(modulazione)}`)}</div>` : ""}
            </div></div>`
              : ""
          }
          ${giro}
          ${frase}
        </section>`
      : "";

  const interruttore = vera(lettura.interruttore);
  const accesoComando = lettura.interruttoreAcceso === true;
  const comandi = interruttore
    ? schedaComando({
        chiave: "riscaldamento",
        icona: "♨️",
        titolo: accesoComando
          ? t("Riscaldamento acceso", "Heating on")
          : t("Riscaldamento spento", "Heating off"),
        sotto: siComanda(interruttore)
          ? accesoComando
            ? t("tocca per spegnere", "tap to turn off")
            : t("tocca per accendere", "tap to turn on")
          : "",
        acceso: accesoComando,
        comando: siComanda(interruttore)
          ? leva(interruttore, accesoComando, t("Caldaia", "Boiler"))
          : "",
      })
    : "";

  /* Da tenere d'occhio: la pressione col manometro a fasce, e l'acqua calda. */
  const pressione = num(lettura.pressione);
  const giudizio =
    pressione == null ? "" : pressione < 1 ? "bassa" : pressione > 2.5 ? "alta" : "buona";
  const manometro =
    pressione == null
      ? ""
      : `<div class="dm-f-caldaia-manometro" aria-hidden="true"><b style="left:${Math.round((tra(pressione, 0, 3) / 3) * 1000) / 10}%"></b></div>`;
  const acquaCalda = num(lettura.acquaCalda);
  const occhio = griglia([
    pressione == null
      ? ""
      : casella({
          chiave: "pressione",
          etichetta: t("Pressione", "Pressure"),
          valore: `${formatNumber(pressione, 1)} bar`,
          extra: manometro,
          sotto:
            giudizio === "bassa"
              ? t("bassa: rabbocca", "low: top it up")
              : giudizio === "alta"
                ? t("alta", "too high")
                : t("nella norma", "in range"),
          tono: giudizio === "bassa" ? "male" : giudizio === "alta" ? "occhio" : "bene",
        }),
    acquaCalda == null
      ? ""
      : casella({
          chiave: "acqua-calda",
          etichetta: t("Acqua calda", "Hot water"),
          valore: gradi(acquaCalda),
          sotto: acquaCalda >= 40 ? t("pronta per la doccia", "ready for a shower") : "",
        }),
  ]);
  return `${nomeSePiuDiUna(lettura.name, piuDiUna)}${eroe}
    ${comandi ? `${titoletto(t("Comandi", "Controls"))}${comandi}` : ""}
    ${occhio ? `${titoletto(t("Da tenere d'occhio", "Keep an eye on"))}${occhio}` : ""}`;
}

function disegnaCaldaia(widget) {
  const letture = Array.isArray(widget?.letture)
    ? widget.letture
    : widget?.lettura
      ? [widget.lettura]
      : [];
  return guscio(
    "caldaia",
    letture.map((lettura) => unaCaldaia(lettura, letture.length > 1)).join(""),
  );
}

/* ── l'UPS ────────────────────────────────────────────────────────────── */

function unUps({ nome, lettura = {}, da = null }, piuDiUno) {
  const aBatteria = lettura.rete === false;
  const batteria = num(lettura.batteria);
  const autonomia = num(lettura.autonomia);
  const chip =
    lettura.rete === true
      ? t("Corrente presente", "Power on")
      : aBatteria
        ? t("Va a batteria", "On battery")
        : t("Non risponde", "Not answering");
  const tono = lettura.rete === true ? "bene" : aBatteria ? "male" : "muto";
  const eroe = `<section class="dm-f-imp-eroe dm-f-ups-eroe" data-tono="${tono}">
    ${batteria == null ? "" : anello(batteria, t("Batteria", "Battery"), aBatteria ? "#dc2626" : "#16a34a")}
    <div class="dm-f-imp-dx">
      <span class="dm-f-imp-chip" data-tono="${tono}"><i></i>${esc(chip)}</span>
      ${
        autonomia == null
          ? ""
          : `<div class="dm-f-ups-regge">${esc(
              aBatteria
                ? t("Regge ancora", "It will last another")
                : t("Se va via la luce, regge", "If the power goes, it lasts"),
            )}</div><span class="dm-f-imp-num dm-f-ups-autonomia">${esc(`${formatNumber(autonomia, 0)} min`)}</span>`
      }
      ${
        Number.isFinite(da) && lettura.rete != null
          ? `<div class="dm-f-imp-fianco">${esc(
              `${aBatteria ? t("a batteria da", "on battery for") : t("in rete da", "on mains for")} ${daQuanto(da)}`,
            )}</div>`
          : ""
      }
    </div>
  </section>`;

  const carico = num(lettura.carico);
  const potenza = num(lettura.potenza);
  const margine =
    carico == null
      ? ""
      : `${percento(carico)} ${
          carico < 60
            ? t("di quello che può reggere: c'è margine", "of what it can take: plenty of headroom")
            : carico < 85
              ? t("di quello che può reggere: sta salendo", "of what it can take: getting up there")
              : t("di quello che può reggere: è al limite", "of what it can take: at the limit")
        }`;
  const quanto =
    carico == null && potenza == null
      ? ""
      : `${titoletto(t("Quanto gli chiedi", "How much you ask of it"))}
        <div class="dm-f-imp-cas dm-f-ups-carico" data-dm-f-casella="carico">
          <div class="dm-f-imp-riga"><small>${esc(t("Carico", "Load"))}</small><span class="dm-f-imp-num">${esc(
            potenza != null ? watt(potenza) : percento(carico),
          )}</span></div>
          ${carico == null ? "" : `<div class="dm-f-imp-barra" data-alto="${carico >= 85}"><i style="width:${tra(carico, 0, 100)}%"></i></div>`}
          ${margine ? `<em>${esc(margine)}</em>` : ""}
        </div>`;

  const tensione = num(lettura.tensione);
  const temperatura = num(lettura.temperatura);
  const scatola = griglia([
    tensione == null
      ? ""
      : casella({
          chiave: "tensione",
          etichetta: t("Tensione di rete", "Mains voltage"),
          valore: `${formatNumber(tensione, 0)} V`,
          sotto: aBatteria
            ? ""
            : tensione >= 207 && tensione <= 253
              ? t("regolare", "normal")
              : t("fuori norma", "out of range"),
          tono: tensione >= 207 && tensione <= 253 ? "bene" : "occhio",
        }),
    temperatura == null
      ? ""
      : casella({
          chiave: "temperatura",
          etichetta: t("Temperatura", "Temperature"),
          valore: gradi(temperatura),
          sotto: temperatura < 40 ? t("nella norma", "in range") : t("calda", "hot"),
          tono: temperatura < 40 ? "bene" : "occhio",
        }),
  ]);
  return `${nomeSePiuDiUna(nome, piuDiUno)}${eroe}${quanto}
    ${scatola ? `${titoletto(t("La scatola", "The unit"))}${scatola}` : ""}`;
}

function disegnaUps(widget) {
  const gruppi = Array.isArray(widget?.gruppi)
    ? widget.gruppi
    : widget?.lettura
      ? [{ nome: "", lettura: widget.lettura, da: widget.da }]
      : [];
  return guscio("ups", gruppi.map((gruppo) => unUps(gruppo, gruppi.length > 1)).join(""));
}

/* ── l'accumulo ───────────────────────────────────────────────────────── */

/* Quanto manca, a cinque minuti per volta: «5 h 15», «40 min». */
function tempoCorto(minuti) {
  if (minuti == null || !Number.isFinite(minuti)) return "";
  if (minuti < 60) return `${Math.max(1, Math.round(minuti))} min`;
  if (minuti >= 48 * 60) return `${Math.round(minuti / (24 * 60))} ${t("giorni", "days")}`;
  const arrotondati = Math.round(minuti / 5) * 5;
  const ore = Math.floor(arrotondati / 60);
  const resto = arrotondati % 60;
  return resto ? `${ore} h ${String(resto).padStart(2, "0")}` : `${ore} h`;
}

function unPacco(pacco) {
  const soc = num(pacco.soc);
  const pillole = [];
  if (pacco.muto)
    pillole.push(`<span data-tono="muto">${esc(t("Non risponde", "Not answering"))}</span>`);
  else {
    const potenza = num(pacco.potenza);
    if (potenza != null && pacco.verso !== "riposo")
      pillole.push(
        `<span>⚡ ${esc(
          `${watt(potenza)} ${pacco.verso === "carica" ? t("in carica", "charging") : t("in scarica", "discharging")}`,
        )}</span>`,
      );
    const temperatura = num(pacco.temperatura) ?? num(pacco.mos);
    if (temperatura != null) pillole.push(`<span>🌡️ ${esc(gradiUtili(temperatura))}</span>`);
    if (num(pacco.soh) != null)
      pillole.push(`<span>💚 ${esc(`${t("salute", "health")} ${percento(pacco.soh)}`)}</span>`);
    if (num(pacco.delta) != null)
      pillole.push(
        `<span${pacco.sbilanciato ? ' data-tono="male"' : ""}>${esc(
          `${t("celle", "cells")} Δ ${formatNumber(pacco.delta, 0)} mV`,
        )}</span>`,
      );
    if (num(pacco.cicli) != null)
      pillole.push(
        `<span>${esc(`${formatNumber(pacco.cicli, 0)} ${t("cicli", "cycles")}`)}</span>`,
      );
  }
  return `<article class="dm-f-accumulo-pacco" data-dm-f-pacco="${esc(pacco.entity)}" data-stato="${
    pacco.muto ? "muto" : pacco.sbilanciato ? "attenzione" : "bene"
  }">
    <div class="dm-f-accumulo-su"><span aria-hidden="true">🔋</span><b>${esc(pacco.name)}</b><span class="dm-f-imp-num">${esc(
      soc == null ? "—" : percento(soc),
    )}</span></div>
    ${soc == null ? "" : `<div class="dm-f-imp-barra dm-f-accumulo-barra"><i style="width:${tra(soc, 0, 100)}%"></i></div>`}
    ${pillole.length ? `<div class="dm-f-imp-pillole">${pillole.join("")}</div>` : ""}
  </article>`;
}

function avvisoDelPacco(pacco) {
  const dove =
    pacco.minima && pacco.massima
      ? `${t("Cella più bassa", "Lowest cell")} ${pacco.minima.numero}, ${t("più alta", "highest")} ${pacco.massima.numero}: Δ ${formatNumber(pacco.delta, 0)} mV. `
      : `Δ ${formatNumber(pacco.delta, 0)} mV. `;
  return `<div class="dm-f-imp-avviso" data-dm-f-avviso><span aria-hidden="true">⚠️</span><div>
    <b>${esc(`${pacco.name}: ${t("celle sbilanciate", "cells out of balance")}`)}</b>
    ${esc(dove)} ${esc(
      t(
        "Il BMS dovrebbe pareggiarle a fine carica: se resta così controlla il bilanciatore.",
        "The BMS should even them out at the end of the charge: if it stays like this, check the balancer.",
      ),
    )}
  </div></div>`;
}

function disegnaAccumulo(widget) {
  const vista = widget?.vista;
  if (!vista) return guscio("accumulo", "");
  const { come = {}, pacchi = [] } = vista;
  const soc = num(come.soc);
  const muti = come.stato === "muti";
  const verso = come.verso;
  const potenza = num(come.potenza);
  const daDove =
    come.daDove === "solare"
      ? `☀️ ${t("dal fotovoltaico", "from solar")}`
      : come.daDove === "rete"
        ? `🔌 ${t("dalla rete", "from the grid")}`
        : come.daDove === "casa"
          ? `🏠 ${t("verso la casa", "to the house")}`
          : "";
  const fine = tempoCorto(num(come.minuti));
  const energia =
    num(come.energiaKwh) != null && num(come.capacitaKwh) != null
      ? `${formatNumber(come.energiaKwh, 1)} / ${formatNumber(come.capacitaKwh, 1)} kWh`
      : "";
  const righe = [
    daDove ? esc(daDove) : "",
    fine && (verso === "carica" || verso === "scarica")
      ? `${esc(verso === "carica" ? t("piena fra", "full in") : t("vuota fra", "empty in"))} <b>${esc(fine)}</b>`
      : "",
    energia ? esc(energia) : "",
  ].filter(Boolean);
  const eroe = `<section class="dm-f-imp-eroe dm-f-accumulo-eroe">
    ${soc == null ? "" : anello(soc, t("Carica", "Charge"), "#16a34a")}
    <div class="dm-f-imp-dx">
      <small class="dm-f-imp-etic">${esc(
        muti
          ? t("Nessun pacco risponde", "No pack answering")
          : verso === "carica"
            ? t("Si sta caricando", "Charging")
            : verso === "scarica"
              ? t("Si sta scaricando", "Discharging")
              : t("A riposo", "Idle"),
      )}</small>
      ${
        !muti && potenza != null && (verso === "carica" || verso === "scarica")
          ? `<span class="dm-f-imp-num dm-f-accumulo-potenza">${esc(watt(potenza))}</span>`
          : ""
      }
      ${righe.length ? `<div class="dm-f-imp-fianco">${righe.join("<br>")}</div>` : ""}
    </div>
  </section>`;
  const avvisi = (come.sbilanciati || []).map(avvisoDelPacco).join("");
  const tinta = clean(widget.tintaDellaSezione);
  return guscio(
    "accumulo",
    `${eroe}${avvisi}${titoletto(t("I pacchi", "The packs"))}<div class="dm-f-imp-pila">${pacchi
      .map(unPacco)
      .join("")}</div>`,
    /* I colori dell'Energia anche quando la tessera e' rossa: il rosso sta
     * solo nel riquadro dell'avviso. */
    widget.alert && tinta ? `--dm-widget-accent:${tinta}` : "",
  );
}

/* ── l'acqua e il gas ─────────────────────────────────────────────────── */

/* Un volume detto come si pensa: litri sotto il metro cubo, metri cubi sopra. */
function litri(valore) {
  if (Math.abs(valore) < 1000) return `${formatNumber(Math.round(valore), 0)} L`;
  const metri = valore / 1000;
  return `${formatNumber(metri, Number.isInteger(Math.round(metri * 10) / 10) ? 0 : 1)} m³`;
}

function metriCubi(valore) {
  const tondo = Math.round(valore * 10) / 10;
  return `${formatNumber(valore, Number.isInteger(tondo) || Math.abs(valore) >= 100 ? 0 : 1)} m³`;
}

/* La lettura di un contatore com'e', con le cifre che ha. */
function letturaDelContatore(lettura) {
  const decimali = Math.min(3, (String(lettura.valore).split(".")[1] || "").length);
  return `${formatNumber(lettura.valore, decimali)}${lettura.unita ? ` ${lettura.unita}` : ""}`;
}

/* La media al giorno del mese scorso: un confronto vero, dai secchielli che
 * il Recorder ha gia' dato. */
function mediaDelMeseScorso(totale) {
  if (totale == null) return null;
  const oggi = new Date();
  const giorni = new Date(oggi.getFullYear(), oggi.getMonth(), 0).getDate();
  return totale / giorni;
}

function rigaDellaPerdita(come) {
  if (come.perdita) {
    const perdita = come.perdita;
    const testo =
      perdita.tipo === "contatore"
        ? t("Mai ferma in 24 ore: forse una perdita", "Never still in 24 hours: maybe a leak")
        : `${t("Possibile perdita: scorre da", "Possible leak: flowing for")} ${quantoTempoInParole((perdita.ore || 0) * 60)}`;
    return `<div class="dm-f-contatori-perdita" data-tono="male" data-dm-f-perdita="si"><span aria-hidden="true">🚨</span>${esc(testo)}</div>`;
  }
  /* «Nessuna perdita» solo quando si sa: serve la storia della portata. */
  const portate = (come.portate || []).filter((voce) => voce.scorre !== undefined);
  if (!portate.length) return "";
  const ferma = portate.find((voce) => voce.scorre === null || voce.scorre === false);
  const da =
    ferma && Number.isFinite(ferma.lettura?.da) && !ferma.lettura?.valore ? ferma.lettura.da : null;
  const testo = da
    ? `${t("Nessuna perdita", "No leak")} · ${t("acqua ferma da", "water still for")} ${daQuanto(da)}`
    : t("Nessuna perdita", "No leak");
  return `<div class="dm-f-contatori-perdita" data-tono="bene" data-dm-f-perdita="no"><span aria-hidden="true">✅</span>${esc(testo)}</div>`;
}

function disegnaContatori(widget) {
  const vista = widget?.vista;
  if (!vista) return guscio("contatori", "");
  const { come = {}, letture = [] } = vista;
  const { acqua, gas } = come;
  const contatore = (genere) =>
    letture.find((lettura) => lettura.genere === genere && !lettura.muto) || null;

  /* L'eroe: l'acqua di oggi con ieri e la media; senza storico, la lettura
   * del contatore — un numero vero invece di un trattino. */
  let eroe = "";
  const principale = acqua ? "acqua" : gas ? "gas" : "";
  if (principale) {
    const dati = principale === "acqua" ? acqua : gas;
    const forma = principale === "acqua" ? litri : metriCubi;
    const oggi = num(dati.oggi);
    const lettura = contatore(principale);
    const confronti = [];
    if (num(dati.ieri) != null) confronti.push(`${t("ieri", "yesterday")} ${forma(dati.ieri)}`);
    const media = mediaDelMeseScorso(num(dati.meseScorso));
    if (media != null) confronti.push(`${t("media", "average")} ${forma(media)}`);
    if (oggi != null || lettura)
      eroe = `<section class="dm-f-imp-eroe dm-f-contatori-eroe">
        <small class="dm-f-imp-etic">${esc(
          oggi != null
            ? principale === "acqua"
              ? t("Acqua oggi", "Water today")
              : t("Gas oggi", "Gas today")
            : principale === "acqua"
              ? t("Contatore acqua", "Water meter")
              : t("Contatore gas", "Gas meter"),
        )}</small>
        <div class="dm-f-imp-riga-eroe"><span class="dm-f-imp-num dm-f-imp-grande" data-dm-f-oggi>${esc(
          oggi != null ? forma(oggi) : letturaDelContatore(lettura),
        )}</span>${
          confronti.length && oggi != null
            ? `<span class="dm-f-imp-fianco">${confronti.map(esc).join("<br>")}</span>`
            : ""
        }</div>
        ${oggi == null ? `<div class="dm-f-imp-fianco">${esc(t("lo storico dei consumi non è ancora arrivato", "the usage history has not arrived yet"))}</div>` : ""}
      </section>`;
  }

  /* Adesso: il gas di oggi quando l'eroe e' l'acqua, la pressione col suo
   * giudizio, la portata, il sale. */
  const caselle = [];
  if (principale === "acqua" && gas && num(gas.oggi) != null)
    caselle.push(
      casella({
        chiave: "gas",
        etichetta: t("Gas oggi", "Gas today"),
        valore: metriCubi(gas.oggi),
        sotto:
          num(gas.costoOggi) != null
            ? `≈ ${euro(gas.costoOggi)}`
            : num(gas.kwhOggi) != null
              ? `${formatNumber(gas.kwhOggi, 1)} kWh`
              : "",
      }),
    );
  for (const voce of come.pressioni || []) {
    if (num(voce.bar) == null) continue;
    caselle.push(
      casella({
        chiave: "pressione",
        etichetta: t("Pressione", "Pressure"),
        valore: `${formatNumber(voce.bar, 1)} bar`,
        sotto:
          voce.verdetto === "low"
            ? t("bassa", "too low")
            : voce.verdetto === "high"
              ? t("alta", "too high")
              : t("regolare", "normal"),
        tono: voce.verdetto === "low" || voce.verdetto === "high" ? "occhio" : "bene",
      }),
    );
  }
  for (const voce of come.portate || []) {
    const lettura = voce.lettura || {};
    if (lettura.muto) continue;
    const valore = num(lettura.litriAlMinuto);
    caselle.push(
      casella({
        chiave: "portata",
        etichetta: t("Portata", "Flow"),
        valore:
          valore != null
            ? `${formatNumber(valore, valore < 10 && !Number.isInteger(Math.round(valore * 10) / 10) ? 1 : 0)} L/min`
            : `${formatNumber(lettura.valore, 1)}${lettura.unita ? ` ${lettura.unita}` : ""}`,
        sotto:
          (valore ?? num(lettura.valore)) === 0
            ? t("rubinetti chiusi", "taps closed")
            : t("scorre", "flowing"),
      }),
    );
  }
  for (const voce of come.sali || []) {
    if (voce.lettura?.muto) continue;
    const giorni = num(voce.giorni);
    const livello = num(voce.livello);
    if (giorni == null && livello == null) continue;
    caselle.push(
      casella({
        chiave: "sale",
        etichetta: t("Sale", "Salt"),
        valore:
          giorni != null ? `${formatNumber(giorni, 0)} ${t("giorni", "days")}` : percento(livello),
        sotto: voce.basso ? t("da ricomprare", "time to buy more") : "",
        tono: voce.basso ? "occhio" : "",
      }),
    );
  }

  /* In fondo, in piccolo, le letture dei contatori. */
  const contatori = letture
    .filter((lettura) => (lettura.genere === "acqua" || lettura.genere === "gas") && !lettura.muto)
    .map(
      (lettura) =>
        `<span>${esc(lettura.name || (lettura.genere === "gas" ? t("Gas", "Gas") : t("Acqua", "Water")))} <b>${esc(
          letturaDelContatore(lettura),
        )}</b></span>`,
    );
  return guscio(
    "contatori",
    `${eroe}${rigaDellaPerdita(come)}
    ${caselle.length ? `${titoletto(t("Adesso", "Now"))}${griglia(caselle, "tre")}` : ""}
    ${contatori.length ? `<div class="dm-f-contatori-letture">${contatori.join("")}</div>` : ""}`,
  );
}

/* ── la piscina ───────────────────────────────────────────────────────── */

const COMANDI_DELLA_VASCA = Object.freeze({
  pumpEnt: { icona: "🔄", nome: () => t("Filtrazione", "Filtration"), femminile: true },
  heatEnt: { icona: "♨️", nome: () => t("Riscaldamento", "Heating"), femminile: false },
  lightEnt: { icona: "💡", nome: () => t("Luce", "Light"), femminile: true },
});

/* Una misura della chimica come barra: la fascia giusta in verde, il segno
 * dov'e' adesso, il numero accanto. */
function barraChimica({ chiave, nome, valore, minimo, massimo, scalaDa, scalaA, cifre }) {
  const da = Math.min(scalaDa, valore);
  const a = Math.max(scalaA, valore);
  const posto = (numero) => Math.round(((numero - da) / (a - da)) * 1000) / 10;
  return `<div class="dm-f-piscina-chimica" data-dm-f-chimica="${chiave}" data-bene="${valore >= minimo && valore <= massimo}">
    <b>${esc(nome)}<em>${esc(`${formatNumber(minimo, cifre)}–${formatNumber(massimo, cifre)}`)}</em></b>
    <span class="dm-f-piscina-fascia"><u style="left:${posto(minimo)}%;right:${100 - posto(massimo)}%"></u><s style="left:${posto(valore)}%"></s></span>
    <span class="dm-f-imp-num">${esc(formatNumber(valore, 1))}</span>
  </div>`;
}

function unaVasca(vasca, piuDiUna) {
  const phMin = num(vasca.phMin) ?? 7.2;
  const phMax = num(vasca.phMax) ?? 7.6;
  const clMin = num(vasca.clMin) ?? 1;
  const clMax = num(vasca.clMax) ?? 3;
  const ph = num(vasca.ph);
  const cloro = num(vasca.cloro);
  const acqua = num(vasca.acqua);
  const phBene = ph == null ? null : ph >= phMin && ph <= phMax;
  const cloroBene = cloro == null ? null : cloro >= clMin && cloro <= clMax;
  let giudizio = "";
  if (phBene === false || cloroBene === false) {
    const cosa = [
      phBene === false ? t("pH da correggere", "pH needs correcting") : "",
      cloroBene === false ? t("cloro da correggere", "chlorine needs correcting") : "",
    ].filter(Boolean);
    giudizio = `<div class="dm-f-piscina-giudizio" data-tono="occhio">⚠ ${cosa.map(esc).join("<br>")}</div>`;
  } else if (phBene && cloroBene)
    giudizio = `<div class="dm-f-piscina-giudizio" data-tono="bene">✓ ${esc(t("acqua in ordine", "water in good shape"))}<br><span>${esc(t("pH e cloro giusti", "pH and chlorine right"))}</span></div>`;
  const chimica = [
    ph == null
      ? ""
      : barraChimica({
          chiave: "ph",
          nome: "pH",
          valore: ph,
          minimo: phMin,
          massimo: phMax,
          scalaDa: 6.6,
          scalaA: 8.2,
          cifre: 1,
        }),
    cloro == null
      ? ""
      : barraChimica({
          chiave: "cloro",
          nome: t("Cloro", "Chlorine"),
          valore: cloro,
          minimo: clMin,
          massimo: clMax,
          scalaDa: 0,
          scalaA: 5,
          cifre: 0,
        }),
  ].filter(Boolean);
  const eroe =
    acqua == null && !chimica.length
      ? ""
      : `<section class="dm-f-imp-eroe dm-f-piscina-eroe">
        ${
          acqua == null
            ? giudizio
            : `<div class="dm-f-piscina-acqua"><div><small class="dm-f-imp-etic">${esc(t("L'acqua", "The water"))}</small><span class="dm-f-imp-num dm-f-imp-grande">${esc(gradi(acqua))}</span></div>${giudizio}</div>`
        }
        ${chimica.length ? `<div class="dm-f-piscina-chimiche">${chimica.join("")}</div>` : ""}
      </section>`;
  const tasti = (vasca.comandi || []).map((comando) => {
    const voce = COMANDI_DELLA_VASCA[comando.chiave];
    if (!voce) return "";
    const acceso = comando.on === true;
    const parola = voce.femminile
      ? acceso
        ? t("Accesa", "On")
        : t("Spenta", "Off")
      : acceso
        ? t("Acceso", "On")
        : t("Spento", "Off");
    const dentro = `<span class="dm-f-imp-tasto-ic" aria-hidden="true">${voce.icona}</span><b>${esc(voce.nome())}</b><span>${esc(parola)}</span>`;
    return comando.comando
      ? `<button type="button" class="dm-f-imp-tasto" data-dm-w-light="${esc(comando.entity)}" data-on="${acceso}" aria-label="${esc(voce.nome())}">${dentro}</button>`
      : `<div class="dm-f-imp-tasto" data-on="${acceso}">${dentro}</div>`;
  });
  return `${nomeSePiuDiUna(vasca.nome, piuDiUna)}${eroe}
    ${tasti.filter(Boolean).length ? `${titoletto(t("Comandi", "Controls"))}<div class="dm-f-imp-tasti">${tasti.join("")}</div>` : ""}`;
}

function disegnaPiscina(widget) {
  const vasche = Array.isArray(widget?.vasche) ? widget.vasche : [];
  return guscio("piscina", vasche.map((vasca) => unaVasca(vasca, vasche.length > 1)).join(""));
}

/* ── l'irrigazione ────────────────────────────────────────────────────── */

/* Il comando che ferma le zone che stanno bagnando: le valvole si chiudono,
 * gli interruttori si spengono. */
function comandoDelFermo(zone) {
  const entita = zone.map((zona) => zona.entity);
  const domini = new Set(entita.map((entity) => entity.split(".")[0]));
  if (domini.size === 1) {
    const [dominio] = domini;
    if (dominio === "valve")
      return { domain: "valve", service: "close_valve", data: { entity_id: entita } };
    return { domain: dominio, service: "turn_off", data: { entity_id: entita } };
  }
  return { domain: "homeassistant", service: "turn_off", data: { entity_id: entita } };
}

function disegnaIrrigazione(widget) {
  const zone = Array.isArray(widget?.zone) ? widget.zone : [];
  const bagnano = zone.filter((zona) => zona.on === true);
  let eroe = "";
  if (bagnano.length) {
    const dalla = bagnano
      .map((zona) => zona.da)
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];
    const ferma = bagnano.every((zona) => zona.comando)
      ? tastoServizio(comandoDelFermo(bagnano), {
          classe: "dm-f-irrigazione-ferma",
          testo: `<span aria-hidden="true">■</span> ${esc(t("Ferma l'irrigazione", "Stop watering"))}`,
          attributi: 'data-dm-f-ferma="irrigazione"',
        })
      : "";
    eroe = `<section class="dm-f-imp-eroe dm-f-irrigazione-eroe" data-on="true">
      <div class="dm-f-irrigazione-ora"><span class="dm-f-irrigazione-goccia" aria-hidden="true">💦</span><div>
        <small class="dm-f-imp-etic">${esc(t("Sta bagnando", "Watering"))}</small>
        <b class="dm-f-imp-titolo">${esc(bagnano.map((zona) => zona.name).join(", "))}</b>
        ${Number.isFinite(dalla) ? `<div class="dm-f-imp-fianco">${esc(`${t("da", "running for")} ${daQuanto(dalla)}`)}</div>` : ""}
      </div></div>
      ${ferma}
    </section>`;
  } else if (zone.length)
    eroe = `<section class="dm-f-imp-eroe dm-f-irrigazione-eroe" data-on="false">
      <div class="dm-f-irrigazione-ora"><span class="dm-f-irrigazione-goccia" aria-hidden="true">🌱</span><div>
        <small class="dm-f-imp-etic">${esc(t("Adesso", "Now"))}</small>
        <b class="dm-f-imp-titolo">${esc(t("Nessuna zona sta bagnando", "No zone is watering"))}</b>
      </div></div>
    </section>`;

  /* Le zone, quella attiva in cima: si toccano per avviarle o fermarle. */
  const ordinate = [...bagnano, ...zone.filter((zona) => zona.on !== true)];
  const schede = ordinate.map((zona) => {
    const dentro = `<span class="dm-f-imp-tasto-ic" aria-hidden="true">🌱</span><b>${esc(zona.name)}</b><span>${esc(
      zona.on ? t("Sta bagnando", "Watering") : t("Ferma", "Idle"),
    )}</span>`;
    return zona.comando
      ? `<button type="button" class="dm-f-imp-tasto dm-f-irrigazione-zona" data-dm-w-light="${esc(zona.entity)}" data-on="${zona.on === true}" aria-label="${esc(zona.name)}">${dentro}</button>`
      : `<div class="dm-f-imp-tasto dm-f-irrigazione-zona" data-on="${zona.on === true}">${dentro}</div>`;
  });
  const titoloZone = zone.some((zona) => zona.comando)
    ? t("Le zone · tocca per avviare", "Zones · tap to start")
    : t("Le zone", "Zones");

  /* Il terreno su una scala secco / giusto / bagnato. */
  const umidita = num(widget?.umidita);
  const secco = num(widget?.soilMin) ?? 30;
  const bagnato = num(widget?.soilMax) ?? 70;
  const terreno =
    umidita == null
      ? ""
      : `${titoletto(t("Il terreno", "The soil"))}
        <div class="dm-f-imp-cas dm-f-irrigazione-terreno" data-dm-f-casella="terreno">
          <div class="dm-f-imp-riga"><small>${esc(t("Umidità", "Moisture"))}</small><span class="dm-f-imp-num">${esc(percento(umidita))}</span></div>
          <div class="dm-f-irrigazione-scala" style="--secco:${tra(secco, 0, 100)}%;--bagnato:${tra(bagnato, 0, 100)}%"><i style="left:${tra(umidita, 0, 100)}%"></i></div>
          <div class="dm-f-irrigazione-parole"><span>${esc(t("secco", "dry"))}</span><span>${esc(t("giusto", "about right"))}</span><span>${esc(t("bagnato", "wet"))}</span></div>
        </div>`;
  return guscio(
    "irrigazione",
    `${eroe}${schede.length ? `${titoletto(titoloZone)}<div class="dm-f-imp-tasti" data-dm-f-zone>${schede.join("")}</div>` : ""}${terreno}`,
  );
}

/* ── la ventilazione ──────────────────────────────────────────────────── */

const PAROLE_DELLA_VELOCITA = Object.freeze([
  [/^(low|min|minimum|ridott|bass|1$|level_?1|eco|quiet|silent)/i, "🌙", () => t("Ridotta", "Low")],
  [/^(medium|mid|normal|normale|media|2$|level_?2)/i, "🌀", () => t("Normale", "Normal")],
  [/^(high|max|maximum|alta|3$|level_?3)/i, "💨", () => t("Alta", "High")],
  [/^(boost|turbo|party|intensiv)/i, "🚀", () => t("Massima", "Boost")],
  [/^(auto|automatic|smart)/i, "🅰️", () => t("Automatica", "Automatic")],
  [/^(away|assente|vacation|holiday|fuori)/i, "🧳", () => t("Fuori casa", "Away")],
  [/^(sleep|night|notte)/i, "😴", () => t("Notte", "Night")],
  [/^(off|spento|stop)/i, "⏻", () => t("Spenta", "Off")],
]);

function parolaDellaVelocita(modo) {
  const voce = PAROLE_DELLA_VELOCITA.find(([forma]) => forma.test(clean(modo)));
  if (voce) return { icona: voce[1], nome: voce[2]() };
  const testo = clean(modo).replace(/_/g, " ");
  return { icona: "🌀", nome: testo.charAt(0).toUpperCase() + testo.slice(1) };
}

/* I tasti della velocita', da quello che l'entita' dichiara di saper fare. */
function selettoreDellaVelocita(clima, states) {
  const entity = vera(clima);
  if (!entity || !siComanda(entity)) return "";
  const stato = states?.[entity];
  if (!stato) return "";
  const attributi = stato.attributes || {};
  const dominio = entity.split(".")[0];
  let voci = [];
  if (dominio === "climate" && Array.isArray(attributi.fan_modes))
    voci = attributi.fan_modes.map((modo) => ({
      modo,
      acceso: clean(attributi.fan_mode) === clean(modo),
      comando: {
        domain: "climate",
        service: "set_fan_mode",
        data: { entity_id: entity, fan_mode: modo },
      },
    }));
  else if (
    dominio === "fan" &&
    Array.isArray(attributi.preset_modes) &&
    attributi.preset_modes.length
  )
    voci = attributi.preset_modes.map((modo) => ({
      modo,
      acceso: clean(attributi.preset_mode) === clean(modo),
      comando: {
        domain: "fan",
        service: "set_preset_mode",
        data: { entity_id: entity, preset_mode: modo },
      },
    }));
  else if (dominio === "fan" && attributi.percentage !== undefined) {
    const adesso = num(attributi.percentage);
    voci = [
      ["low", 33],
      ["medium", 66],
      ["high", 100],
    ].map(([modo, quota]) => ({
      modo,
      acceso: adesso != null && Math.abs(adesso - quota) < 17,
      comando: {
        domain: "fan",
        service: "set_percentage",
        data: { entity_id: entity, percentage: quota },
      },
    }));
  } else if (
    (dominio === "select" || dominio === "input_select") &&
    Array.isArray(attributi.options)
  )
    voci = attributi.options.map((modo) => ({
      modo,
      acceso: clean(stato.state) === clean(modo),
      comando: {
        domain: dominio,
        service: "select_option",
        data: { entity_id: entity, option: modo },
      },
    }));
  voci = voci.slice(0, 5);
  if (voci.length < 2) return "";
  return `${titoletto(t("Velocità", "Speed"))}<div class="dm-f-vmc-velocita" style="--quante:${voci.length}">${voci
    .map((voce) => {
      const parola = parolaDellaVelocita(voce.modo);
      return tastoServizio(voce.comando, {
        classe: "dm-f-vmc-modo",
        testo: `<em aria-hidden="true">${parola.icona}</em>${esc(parola.nome)}`,
        attributi: `data-on="${voce.acceso}" data-dm-f-velocita="${esc(voce.modo)}" aria-pressed="${voce.acceso}"`,
      });
    })
    .join("")}</div>`;
}

function unaVmc(lettura, piuDiUna, states) {
  const temperatura = (chiave) => {
    const voce = lettura.temperature?.[chiave];
    return voce && !voce.muto ? num(voce.valore) : null;
  };
  const esterna = temperatura("esterna");
  const immissione = temperatura("immissione");
  const ripresa = temperatura("ripresa");
  const espulsione = temperatura("espulsione");
  const recupero = num(lettura.recupero);
  let testa = "";
  if (lettura.bypassAperto)
    testa = `<small class="dm-f-imp-etic">${esc(t("Bypass aperto", "Bypass open"))}</small>
      <div class="dm-f-imp-fianco">${esc(
        t(
          "L'aria nuova entra senza passare dallo scambiatore.",
          "Fresh air comes in without going through the heat exchanger.",
        ),
      )}</div>`;
  else if (recupero != null)
    testa = `<small class="dm-f-imp-etic">${esc(t("Calore recuperato", "Heat recovered"))}</small>
      <div class="dm-f-imp-riga-eroe"><span class="dm-f-imp-num dm-f-imp-grande">${esc(percento(recupero))}</span><span class="dm-f-imp-fianco">${esc(
        t(
          "del calore dell'aria che esce torna in casa con l'aria nuova",
          "of the heat in the outgoing air comes back in with the fresh air",
        ),
      )}</span></div>`;
  else if (immissione != null)
    testa = `<small class="dm-f-imp-etic">${esc(t("Aria in casa", "Air into the house"))}</small>
      <span class="dm-f-imp-num dm-f-imp-grande">${esc(gradi(immissione))}</span>`;
  const cella = (chiave, etichetta, valore, casa = false) =>
    `<div class="dm-f-vmc-t"${casa ? ' data-casa="true"' : ""} data-dm-f-temperatura="${chiave}"><small class="dm-f-imp-etic">${esc(etichetta)}</small><span class="dm-f-imp-num">${esc(
      valore == null ? "—" : gradi(valore),
    )}</span></div>`;
  const quante = [esterna, immissione, ripresa, espulsione].filter(
    (valore) => valore != null,
  ).length;
  const flussi =
    quante >= 2
      ? `<div class="dm-f-vmc-flussi">
          ${cella("esterna", t("Fuori", "Outdoors"), esterna)}<div class="dm-f-vmc-f" aria-hidden="true">→</div>${cella("immissione", t("Entra", "Air in"), immissione, true)}
          ${cella("espulsione", t("Esce", "Air out"), espulsione)}<div class="dm-f-vmc-f" aria-hidden="true">←</div>${cella("ripresa", t("Casa", "Indoors"), ripresa, true)}
        </div>`
      : "";
  const eroe =
    testa || flussi
      ? `<section class="dm-f-imp-eroe dm-f-vmc-eroe">${testa}${flussi}</section>`
      : "";

  /* Come sta: i filtri, il bypass, la stagione, le ventole. */
  const pillole = [];
  const filtri = lettura.interruttori?.filtri;
  if (filtri && !filtri.muto)
    pillole.push(
      filtri.acceso
        ? `<span data-tono="male">🧽 ${esc(t("Filtri da cambiare", "Filters need changing"))}</span>`
        : `<span data-tono="bene">🧽 ${esc(t("Filtri a posto", "Filters fine"))}</span>`,
    );
  const bypass = lettura.interruttori?.bypass;
  if (bypass && !bypass.muto)
    pillole.push(
      `<span>🔀 ${esc(bypass.acceso ? t("Bypass aperto", "Bypass open") : t("Bypass chiuso", "Bypass closed"))}</span>`,
    );
  const estate = lettura.interruttori?.estate;
  if (estate && !estate.muto)
    pillole.push(
      estate.acceso
        ? `<span>☀️ ${esc(t("Estate", "Summer"))}</span>`
        : `<span>❄️ ${esc(t("Inverno", "Winter"))}</span>`,
    );
  const nomiDeiNumeri = {
    ventola_immissione: t("Immissione", "Supply"),
    ventola_espulsione: t("Espulsione", "Exhaust"),
    livello_immissione: t("Immissione", "Supply"),
    livello_ripresa: t("Ripresa", "Return"),
  };
  for (const voce of Object.values(lettura.numeri || {})) {
    if (!voce || voce.muto || voce.valore == null) continue;
    pillole.push(
      `<span>${voce.glifo} ${esc(
        `${nomiDeiNumeri[voce.chiave] || ""} ${formatNumber(voce.valore, Number.isInteger(voce.valore) ? 0 : 1)}${voce.unita ? ` ${voce.unita}` : ""}`.trim(),
      )}</span>`,
    );
  }
  return `${nomeSePiuDiUna(lettura.nome, piuDiUna)}${eroe}${selettoreDellaVelocita(lettura.clima, states)}
    ${pillole.length ? `${titoletto(t("Come sta", "How it is doing"))}<div class="dm-f-imp-pillole dm-f-vmc-pillole">${pillole.join("")}</div>` : ""}`;
}

function disegnaVmc(widget, states) {
  const letture = Array.isArray(widget?.letture) ? widget.letture : [];
  return guscio(
    "vmc",
    letture.map((lettura) => unaVmc(lettura, letture.length > 1, states)).join(""),
  );
}

/* ── lo stile ─────────────────────────────────────────────────────────── */

/* Un foglio solo per il gruppo: le finestre si somigliano apposta — l'eroe
 * tinto del colore della sezione, le schede dei comandi, le caselle — e
 * ognuna aggiunge il suo pezzo (il serbatoio, il giro, i flussi). */
const STILE = `
${P} .dm-f-imp{display:grid;gap:9px;min-width:0;--imp-a:var(--dm-widget-accent,#0ea5e9);
  --imp-tinta:color-mix(in srgb,var(--imp-a) 9%,var(--card-bg,#fff));
  --imp-bordo:color-mix(in srgb,var(--imp-a) 30%,transparent)}
${P} .dm-f-imp .dm-f-imp-tit{margin:12px 2px 0}
${P} .dm-f-imp-nome{margin:14px 2px 0;font-family:'Oswald',system-ui,sans-serif;font-weight:500;font-size:18px;
  letter-spacing:.02em;text-transform:none;color:var(--imp-a)}
${P} .dm-f-imp-nome:first-child{margin-top:0}
${P} .dm-f-imp-num{font-family:'Oswald',system-ui,sans-serif;font-weight:500;font-variant-numeric:tabular-nums;
  color:var(--text,#0f172a);line-height:1.05}
${P} .dm-f-imp-eroe{display:flex;flex-wrap:wrap;gap:14px 16px;align-items:center;min-width:0;border-radius:22px;padding:16px;
  background:linear-gradient(155deg,color-mix(in srgb,var(--imp-a) 12%,var(--card-bg,#fff)),color-mix(in srgb,var(--imp-a) 4%,var(--card-bg,#fff)));
  border:1px solid var(--imp-bordo)}
${P} .dm-f-imp-eroe>*{min-width:0}
${P} .dm-f-imp-dx{flex:1 1 150px;min-width:0}
${P} .dm-f-imp-etic{display:block;font-size:10.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--imp-a)}
${P} .dm-f-imp-grande{display:block;font-size:46px;margin-top:2px}
${P} .dm-f-imp-titolo{display:block;font-size:19px;font-weight:850;line-height:1.2;color:var(--text,#0f172a);margin-top:2px}
${P} .dm-f-imp-fianco{font-size:13px;font-weight:700;line-height:1.4;color:var(--text-dim,#64748b);margin-top:5px}
${P} .dm-f-imp-fianco b{color:var(--text,#0f172a)}
${P} .dm-f-imp-riga-eroe{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;width:100%}
${P} .dm-f-imp-riga-eroe .dm-f-imp-fianco{margin:0 0 6px;flex:1 1 140px}
${P} .dm-f-imp-frase{margin:0;width:100%;font-size:13.5px;font-weight:700;line-height:1.4;color:var(--text,#334155)}
${P} .dm-f-imp-chip{display:inline-flex;align-items:center;gap:7px;margin-top:9px;padding:6px 11px;border-radius:999px;
  font-size:12px;font-weight:850;background:var(--card-bg,#fff);color:var(--imp-a);border:1px solid var(--imp-bordo)}
${P} .dm-f-imp-chip i{width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.5}
${P} .dm-f-imp-chip[data-on="true"] i,${P} .dm-f-imp-chip[data-tono] i{opacity:1;box-shadow:0 0 0 4px color-mix(in srgb,currentColor 22%,transparent)}
${P} .dm-f-imp-chip[data-tono="bene"]{color:#15803d;background:color-mix(in srgb,#16a34a 12%,var(--card-bg,#fff));border-color:color-mix(in srgb,#16a34a 30%,transparent)}
${P} .dm-f-imp-chip[data-tono="male"]{color:#b91c1c;background:color-mix(in srgb,#dc2626 12%,var(--card-bg,#fff));border-color:color-mix(in srgb,#dc2626 30%,transparent)}
${P} .dm-f-imp-chip[data-tono="muto"]{color:var(--text-dim,#64748b)}
${P} .dm-f-imp-pila{display:grid;gap:9px}
${P} .dm-f-imp-comando{display:flex;align-items:center;gap:12px;min-width:0;padding:13px 14px;border-radius:20px;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);box-shadow:0 12px 24px -22px rgba(15,23,42,.6)}
${P} .dm-f-imp-comando[data-on="true"]{background:var(--imp-tinta);border-color:var(--imp-bordo)}
${P} .dm-f-imp-ic{flex:0 0 44px;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:21px;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 10%,var(--card-bg,#fff));box-shadow:inset 0 0 0 1px var(--card-border,#e2e8f0)}
${P} .dm-f-imp-tx{flex:1;min-width:0}
${P} .dm-f-imp-tx b{display:block;font-size:14.5px;font-weight:850;color:var(--text,#0f172a);line-height:1.25}
${P} .dm-f-imp-tx small{display:block;font-size:12px;font-weight:700;color:var(--text-dim,#64748b);margin-top:2px;line-height:1.3}
${P} .dm-f-imp-leva{flex:0 0 52px;width:52px;height:30px;position:relative;border:0;border-radius:999px;cursor:pointer;padding:0;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 34%,transparent);transition:background .25s ease}
${P} .dm-f-imp-leva i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;
  box-shadow:0 2px 6px rgba(15,23,42,.25);transition:transform .25s cubic-bezier(.16,1,.3,1)}
${P} .dm-f-imp-leva[data-on="true"]{background:var(--imp-a)}
${P} .dm-f-imp-leva[data-on="true"] i{transform:translateX(22px)}
${P} .dm-f-imp-passi{display:flex;align-items:center;gap:6px;flex:none}
${P} .dm-f-imp-passi .dm-f-imp-num,${P} .dm-f-imp-valore{font-size:23px;min-width:44px;text-align:center}
${P} .dm-f-imp-passo{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;padding:0;cursor:pointer;
  font:inherit;font-size:20px;font-weight:900;color:var(--imp-a);background:var(--card-bg,#fff);border:1px solid var(--imp-bordo)}
${P} .dm-f-imp-passo:disabled{opacity:.35;cursor:default}
${P} .dm-f-imp-griglia{display:grid;grid-template-columns:repeat(auto-fit,minmax(138px,1fr));gap:9px}
${P} .dm-f-imp-griglia[data-dm-f-griglia="tre"]{grid-template-columns:repeat(auto-fit,minmax(94px,1fr))}
${P} .dm-f-imp-cas{display:block;min-width:0;border-radius:18px;padding:12px 13px;background:var(--card-bg,#fff);
  border:1px solid var(--card-border,#e2e8f0);box-shadow:0 10px 22px -22px rgba(15,23,42,.6)}
${P} .dm-f-imp-cas small{display:block;font-size:10px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--text-dim,#64748b)}
${P} .dm-f-imp-cas>.dm-f-imp-num{display:block;font-size:21px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${P} .dm-f-imp-cas em{display:block;font-style:normal;font-size:11.5px;font-weight:750;color:var(--text-dim,#64748b);margin-top:3px;line-height:1.3}
${P} .dm-f-imp-cas em[data-tono="bene"]{color:#15803d}
${P} .dm-f-imp-cas em[data-tono="occhio"]{color:#b45309}
${P} .dm-f-imp-cas em[data-tono="male"]{color:#b91c1c}
${P} .dm-f-imp-riga{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
${P} .dm-f-imp-riga .dm-f-imp-num{font-size:21px}
${P} .dm-f-imp-barra{height:10px;border-radius:999px;background:color-mix(in srgb,var(--text-dim,#94a3b8) 22%,transparent);overflow:hidden;margin:8px 0 4px}
${P} .dm-f-imp-barra i{display:block;height:100%;border-radius:999px;background:var(--imp-a)}
${P} .dm-f-imp-barra[data-alto="true"] i{background:#dc2626}
${P} .dm-f-imp-anello{--p:50;flex:0 0 auto;width:104px;height:104px;border-radius:50%;display:grid;place-items:center;position:relative;
  background:conic-gradient(var(--c,var(--imp-a)) calc(var(--p)*1%),color-mix(in srgb,var(--text-dim,#94a3b8) 25%,transparent) 0)}
${P} .dm-f-imp-anello::after{content:"";position:absolute;inset:10px;border-radius:50%;background:var(--card-bg,#fff)}
${P} .dm-f-imp-anello>div{position:relative;z-index:1;text-align:center}
${P} .dm-f-imp-anello .dm-f-imp-num{display:block;font-size:27px}
${P} .dm-f-imp-anello small{font-size:9px;font-weight:900;letter-spacing:.1em;color:var(--text-dim,#64748b);text-transform:uppercase}
${P} .dm-f-imp-tasti{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}
${P} .dm-f-imp-tasti[data-dm-f-zone]{grid-template-columns:repeat(auto-fill,minmax(138px,1fr))}
${P} .dm-f-imp-tasto{display:block;min-width:0;border-radius:20px;padding:14px 4px 12px;text-align:center;font:inherit;color:inherit;
  background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);box-shadow:0 12px 24px -22px rgba(15,23,42,.6)}
${P} button.dm-f-imp-tasto{cursor:pointer}
${P} .dm-f-imp-tasto-ic{display:block;font-size:24px;line-height:1.1}
${P} .dm-f-imp-tasto b{display:block;font-size:12.5px;font-weight:850;letter-spacing:-.01em;margin-top:6px;color:var(--text,#0f172a);overflow-wrap:break-word;hyphens:auto}
${P} .dm-f-imp-tasto>span:last-child{display:block;font-size:10.5px;font-weight:800;color:var(--text-dim,#64748b);margin-top:2px;text-transform:uppercase;letter-spacing:.06em}
${P} .dm-f-imp-tasto[data-on="true"]{background:var(--imp-tinta);border-color:var(--imp-bordo)}
${P} .dm-f-imp-tasto[data-on="true"]>span:last-child{color:var(--imp-a)}
${P} .dm-f-imp-pillole{display:flex;gap:6px;flex-wrap:wrap}
${P} .dm-f-imp-pillole span{font-size:11.5px;font-weight:800;color:var(--text,#334155);border-radius:999px;padding:5px 10px;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 9%,var(--card-bg,#fff));border:1px solid var(--card-border,#e2e8f0)}
${P} .dm-f-imp-pillole span[data-tono="male"]{background:color-mix(in srgb,#dc2626 10%,var(--card-bg,#fff));border-color:color-mix(in srgb,#dc2626 32%,transparent);color:#b91c1c}
${P} .dm-f-imp-pillole span[data-tono="bene"]{background:color-mix(in srgb,#16a34a 10%,var(--card-bg,#fff));border-color:color-mix(in srgb,#16a34a 30%,transparent);color:#15803d}
${P} .dm-f-imp-pillole span[data-tono="muto"]{color:var(--text-dim,#64748b)}
${P} .dm-f-imp-avviso{display:flex;gap:11px;align-items:flex-start;border-radius:18px;padding:12px 13px;
  background:color-mix(in srgb,#dc2626 9%,var(--card-bg,#fff));border:1px solid color-mix(in srgb,#dc2626 30%,transparent);
  color:color-mix(in srgb,#991b1b 80%,var(--text,#0f172a));font-size:13px;font-weight:700;line-height:1.4}
${P} .dm-f-imp-avviso>span{font-size:19px;line-height:1.2}
${P} .dm-f-imp-avviso b{display:block;font-size:14px;font-weight:850;color:#b91c1c}

/* Lo scaldabagno: il serbatoio che si riempie fino alla linea dell'obiettivo. */
${P} .dm-f-scaldabagno-serbatoio{flex:0 0 70px;height:126px;border-radius:28px;border:2px solid color-mix(in srgb,#f59e0b 60%,transparent);
  background:var(--card-bg,#fff);position:relative;overflow:hidden}
${P} .dm-f-scaldabagno-serbatoio i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,#fbbf24,#ea580c)}
${P} .dm-f-scaldabagno-serbatoio b{position:absolute;left:-2px;right:-2px;top:14%;border-top:2px dashed #b45309}
${P} .dm-f-scaldabagno-serbatoio em{position:absolute;left:0;right:0;top:calc(14% + 4px);text-align:center;font-style:normal;font-size:10px;font-weight:900;color:#b45309}

/* La caldaia: mandata e ritorno come due nodi, col salto in mezzo. */
${P} .dm-f-caldaia-testa{display:flex;align-items:center;gap:14px;width:100%}
${P} .dm-f-caldaia-fiamma{flex:0 0 60px;width:60px;height:60px;border-radius:19px;display:grid;place-items:center;font-size:30px;
  background:var(--card-bg,#fff);border:1px solid var(--imp-bordo);filter:grayscale(1);opacity:.55}
${P} .dm-f-caldaia-fiamma[data-on="true"]{filter:none;opacity:1;box-shadow:0 0 0 6px color-mix(in srgb,#f59e0b 20%,transparent)}
${P} .dm-f-caldaia-giro{display:grid;grid-template-columns:minmax(0,1fr) 56px minmax(0,1fr);align-items:center;gap:6px;width:100%}
${P} .dm-f-caldaia-nodo{text-align:center;border-radius:17px;padding:10px 6px;background:var(--card-bg,#fff);border:1px solid var(--imp-bordo)}
${P} .dm-f-caldaia-nodo .dm-f-imp-num{display:block;font-size:26px;margin-top:3px}
${P} .dm-f-caldaia-freccia{text-align:center;font-size:11px;font-weight:900;color:var(--imp-a);line-height:1.25}
${P} .dm-f-caldaia-freccia i{display:block;font-style:normal;font-size:19px}
${P} .dm-f-caldaia-manometro{position:relative;height:10px;margin:10px 0 2px;border-radius:999px;
  background:linear-gradient(90deg,#fecaca 0 33%,#bbf7d0 33% 83%,#fde68a 83% 100%)}
${P} .dm-f-caldaia-manometro b{position:absolute;top:-5px;width:4px;height:20px;margin-left:-2px;border-radius:3px;background:var(--text,#0f172a)}

/* L'UPS: quanto regge se va via la luce. */
${P} .dm-f-ups-regge{margin-top:10px;font-size:12px;font-weight:800;color:var(--text-dim,#64748b)}
${P} .dm-f-ups-autonomia{display:block;font-size:34px}
${P} .dm-f-ups-eroe[data-tono="male"] .dm-f-ups-autonomia{color:#dc2626}

/* L'accumulo: una scheda per pacco. */
${P} .dm-f-accumulo-potenza{display:block;font-size:32px;margin-top:2px}
${P} .dm-f-accumulo-pacco{border-radius:20px;padding:13px 14px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);
  box-shadow:0 12px 24px -22px rgba(15,23,42,.6);min-width:0}
${P} .dm-f-accumulo-su{display:flex;align-items:center;gap:10px}
${P} .dm-f-accumulo-su b{flex:1;min-width:0;font-size:14.5px;font-weight:850;color:var(--text,#0f172a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${P} .dm-f-accumulo-su .dm-f-imp-num{font-size:23px}
${P} .dm-f-accumulo-barra i{background:#16a34a}
${P} .dm-f-accumulo-pacco[data-stato="muto"]{opacity:.7}

/* L'acqua e il gas. */
${P} .dm-f-contatori-perdita{display:flex;align-items:center;gap:10px;border-radius:16px;padding:10px 12px;font-size:13px;font-weight:750;
  background:color-mix(in srgb,#16a34a 9%,var(--card-bg,#fff));border:1px solid color-mix(in srgb,#16a34a 28%,transparent);color:#166534}
${P} .dm-f-contatori-perdita[data-tono="male"]{background:color-mix(in srgb,#dc2626 9%,var(--card-bg,#fff));border-color:color-mix(in srgb,#dc2626 30%,transparent);color:#b91c1c}
${P} .dm-f-contatori-perdita>span{font-size:17px}
${P} .dm-f-contatori-letture{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 14px;padding:10px 13px;border-radius:16px;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 8%,var(--card-bg,#fff));border:1px solid var(--card-border,#e2e8f0);
  font-size:12px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-contatori-letture b{color:var(--text,#0f172a);font-family:'Oswald',system-ui,sans-serif;font-weight:500;font-size:14px}

/* La piscina: la chimica come barre con la fascia giusta. */
${P} .dm-f-piscina-acqua{display:flex;align-items:center;gap:14px;width:100%}
${P} .dm-f-piscina-giudizio{margin-left:auto;text-align:right;font-size:13px;font-weight:850;line-height:1.35}
${P} .dm-f-piscina-giudizio[data-tono="bene"]{color:#15803d}
${P} .dm-f-piscina-giudizio[data-tono="occhio"]{color:#b45309}
${P} .dm-f-piscina-giudizio span{color:var(--text-dim,#64748b);font-weight:750}
${P} .dm-f-piscina-chimiche{display:grid;gap:10px;width:100%}
${P} .dm-f-piscina-chimica{display:grid;grid-template-columns:62px minmax(0,1fr) 52px;align-items:center;gap:10px}
${P} .dm-f-piscina-chimica b{font-size:12.5px;font-weight:850;color:var(--text,#334155)}
${P} .dm-f-piscina-chimica b em{display:block;font-style:normal;font-size:10.5px;font-weight:750;color:var(--text-dim,#64748b)}
${P} .dm-f-piscina-chimica .dm-f-imp-num{font-size:20px;text-align:right}
${P} .dm-f-piscina-chimica[data-bene="false"] .dm-f-imp-num{color:#b45309}
${P} .dm-f-piscina-fascia{position:relative;height:10px;border-radius:999px;background:color-mix(in srgb,var(--text-dim,#94a3b8) 22%,transparent)}
${P} .dm-f-piscina-fascia u{position:absolute;top:0;bottom:0;border-radius:999px;background:#86efac;text-decoration:none}
${P} .dm-f-piscina-fascia s{position:absolute;top:-4px;width:6px;height:18px;border-radius:3px;margin-left:-3px;background:var(--text,#0f172a)}

/* L'irrigazione: la zona che bagna e il tasto per fermarla. */
${P} .dm-f-irrigazione-ora{display:flex;align-items:center;gap:14px;width:100%}
${P} .dm-f-irrigazione-goccia{flex:0 0 60px;width:60px;height:60px;border-radius:19px;display:grid;place-items:center;font-size:28px;
  background:var(--card-bg,#fff);border:1px solid var(--imp-bordo)}
${P} .dm-f-irrigazione-eroe[data-on="true"] .dm-f-irrigazione-goccia{box-shadow:0 0 0 6px color-mix(in srgb,var(--imp-a) 16%,transparent)}
${P} .dm-f-irrigazione-ferma{width:100%;padding:13px;border-radius:16px;cursor:pointer;font:inherit;font-weight:850;font-size:14px;
  color:var(--imp-a);background:var(--card-bg,#fff);border:1px solid var(--imp-bordo)}
${P} .dm-f-irrigazione-scala{position:relative;height:12px;margin:10px 0 6px;border-radius:999px;
  background:linear-gradient(90deg,#fde68a 0 var(--secco),#bbf7d0 var(--secco) var(--bagnato),#bfdbfe var(--bagnato))}
${P} .dm-f-irrigazione-scala i{position:absolute;top:-4px;width:5px;height:20px;margin-left:-2.5px;border-radius:3px;background:var(--text,#0f172a)}
${P} .dm-f-irrigazione-parole{display:flex;justify-content:space-between;font-size:11.5px;font-weight:800;color:var(--text-dim,#64748b)}

/* La ventilazione: due flussi incrociati e la velocita' a tasti. */
${P} .dm-f-vmc-flussi{display:grid;grid-template-columns:minmax(0,1fr) 40px minmax(0,1fr);gap:6px;align-items:center;width:100%}
${P} .dm-f-vmc-t{border-radius:15px;padding:8px 6px;text-align:center;background:var(--card-bg,#fff);border:1px solid var(--imp-bordo)}
${P} .dm-f-vmc-t[data-casa="true"]{background:var(--imp-tinta)}
${P} .dm-f-vmc-t small{font-size:9.5px}
${P} .dm-f-vmc-t .dm-f-imp-num{display:block;font-size:21px}
${P} .dm-f-vmc-f{text-align:center;font-size:18px;font-weight:900;color:var(--imp-a)}
${P} .dm-f-vmc-velocita{display:grid;grid-template-columns:repeat(var(--quante,3),minmax(0,1fr));gap:6px;padding:5px;border-radius:18px;
  background:color-mix(in srgb,var(--text-dim,#94a3b8) 12%,var(--card-bg,#fff))}
${P} .dm-f-vmc-modo{padding:11px 4px;border:0;border-radius:14px;cursor:pointer;font:inherit;font-size:12.5px;font-weight:850;
  color:var(--text-dim,#475569);background:transparent;min-width:0;overflow-wrap:anywhere}
${P} .dm-f-vmc-modo em{display:block;font-style:normal;font-size:16px}
${P} .dm-f-vmc-modo[data-on="true"]{background:var(--card-bg,#fff);color:var(--imp-a);box-shadow:0 6px 16px -10px rgba(15,23,42,.5)}
`;

/* ── le registrazioni ─────────────────────────────────────────────────── */

export const FINESTRE_IMPIANTI = Object.freeze([
  "scaldabagno",
  "caldaia",
  "ups",
  "accumulo",
  "contatori",
  "piscina",
  "irrigazione",
  "vmc",
]);

/* Il foglio va con la prima: un foglio solo per tutto il gruppo. */
registraFinestra("scaldabagno", { disegna: disegnaScaldabagno, stile: STILE });
registraFinestra("caldaia", { disegna: disegnaCaldaia });
registraFinestra("ups", { disegna: disegnaUps });
registraFinestra("accumulo", { disegna: disegnaAccumulo });
registraFinestra("contatori", { disegna: disegnaContatori });
registraFinestra("piscina", { disegna: disegnaPiscina });
registraFinestra("irrigazione", { disegna: disegnaIrrigazione });
registraFinestra("vmc", { disegna: disegnaVmc });
