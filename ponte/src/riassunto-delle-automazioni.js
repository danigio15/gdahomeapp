/* Il riassunto di un'automazione di Home Assistant, in una riga.
 *
 * «Avanzata: usa template, scelte o blueprint» non fa capire niente: e' quello
 * che la plancia diceva di ogni automazione che non sa riscrivere. Ma anche
 * una complessa si racconta: quando parte (il primo innesco, «e altri 2» se
 * ce ne sono di piu'), e quante condizioni e azioni ha; e se viene da un
 * blueprint, quale. «Quando si apre Porta ingresso · 1 condizione · 3
 * azioni», «Alle 07:15 · 2 azioni», «Da blueprint Luce col movimento».
 *
 * E' puro: legge la configurazione com'e' salvata in Home Assistant (le chiavi
 * nuove `triggers`/`conditions`/`actions` e le vecchie al singolare) e chiede
 * i nomi a chi lo chiama. Non indovina niente che non sia scritto.
 *
 * Mai la lingua di Home Assistant: la prima azione si dice col suo verbo
 * («imposta Termostato soggiorno a 21°», «inserisci Antifurto (notte)») e
 * uno stato con la sua parola («Quando Antifurto scatta»), con le stesse
 * parole della plancia (`plancia/src/core/parole-dei-servizi.js`). Un nome
 * che manca si dice dall'id, senza punti e trattini bassi.
 */

import {
  diventaInParole,
  inParole,
  nomeDaId,
  servizioInParole,
} from "../plancia/src/core/parole-dei-servizi.js";

const elenco = (valore) => (Array.isArray(valore) ? valore : valore ? [valore] : []);

const primo = (valore) => elenco(valore)[0];

/* Come si chiama un'entita' (o la prima di un elenco). */
function nomeDelle(entita, nomeDi) {
  const ids = elenco(entita).map(String).filter(Boolean);
  if (!ids.length) return "";
  const uno = nomeDi(ids[0]) || nomeDaId(ids[0]);
  return ids.length > 1 ? `${uno} +${ids.length - 1}` : uno;
}

const DOMINIO = (id) => String(id || "").split(".")[0];

/* Lo spostamento di alba e tramonto, «-00:15:00» o un numero di secondi o
 * {minutes: 15}: in minuti col segno, o 0. */
function minutiDiSpostamento(offset) {
  if (offset === undefined || offset === null || offset === "") return 0;
  if (typeof offset === "number") return Math.round(offset / 60);
  if (typeof offset === "object")
    return (
      (Number(offset.hours) || 0) * 60 +
      (Number(offset.minutes) || 0) +
      Math.round((Number(offset.seconds) || 0) / 60)
    );
  const m = /^(-)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(offset).trim());
  if (!m) return 0;
  const minuti = Number(m[2]) * 60 + Number(m[3]);
  return m[1] ? -minuti : minuti;
}

const orario = (valore) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(valore || ""));
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : String(valore || "");
};

/* Il primo innesco, in parole. `{it, en}`. */
function innesco(t, { nomeDi, classeDi }) {
  const tipo = String(t?.trigger || t?.platform || "");
  const chi = nomeDelle(t?.entity_id, nomeDi);
  const classe = classeDi(primo(t?.entity_id));
  switch (tipo) {
    case "state": {
      const verso = t?.to === undefined || t?.to === null ? null : String(t.to);
      const apertura = ["door", "window", "opening", "garage_door"].includes(classe);
      const movimento = ["motion", "occupancy", "presence"].includes(classe);
      if (verso === "on" && apertura)
        return { it: `Quando si apre ${chi}`, en: `When ${chi} opens` };
      if (verso === "off" && apertura)
        return { it: `Quando si chiude ${chi}`, en: `When ${chi} closes` };
      if (verso === "on" && movimento)
        return { it: `Quando c'è movimento in ${chi}`, en: `When there's motion in ${chi}` };
      if (verso === "off" && movimento)
        return { it: `Quando non c'è più movimento in ${chi}`, en: `When motion stops in ${chi}` };
      if (DOMINIO(primo(t?.entity_id)) === "person" && verso === "home")
        return { it: `Quando ${chi} arriva a casa`, en: `When ${chi} gets home` };
      if (DOMINIO(primo(t?.entity_id)) === "person" && verso === "not_home")
        return { it: `Quando ${chi} esce di casa`, en: `When ${chi} leaves home` };
      if (verso === "on") return { it: `Quando si accende ${chi}`, en: `When ${chi} turns on` };
      if (verso === "off") return { it: `Quando si spegne ${chi}`, en: `When ${chi} turns off` };
      if (verso) {
        /* «Quando Antifurto scatta», non «diventa «triggered»». */
        const detto = diventaInParole(chi, verso);
        return { it: `Quando ${detto.it}`, en: `When ${detto.en}` };
      }
      return { it: `Quando cambia ${chi}`, en: `When ${chi} changes` };
    }
    case "numeric_state": {
      if (t?.above !== undefined && t?.below !== undefined)
        return {
          it: `Quando ${chi} sta fra ${t.above} e ${t.below}`,
          en: `When ${chi} is between ${t.above} and ${t.below}`,
        };
      if (t?.above !== undefined)
        return { it: `Quando ${chi} supera ${t.above}`, en: `When ${chi} goes above ${t.above}` };
      if (t?.below !== undefined)
        return {
          it: `Quando ${chi} scende sotto ${t.below}`,
          en: `When ${chi} drops below ${t.below}`,
        };
      return { it: `Quando cambia ${chi}`, en: `When ${chi} changes` };
    }
    case "time": {
      const ore = elenco(t?.at).map((x) =>
        /^[a-z_]+\./.test(String(x)) ? nomeDi(String(x)) || String(x) : orario(x),
      );
      return { it: `Alle ${ore.join(", ")}`, en: `At ${ore.join(", ")}` };
    }
    case "time_pattern": {
      if (t?.minutes && String(t.minutes).startsWith("/"))
        return {
          it: `Ogni ${String(t.minutes).slice(1)} minuti`,
          en: `Every ${String(t.minutes).slice(1)} minutes`,
        };
      if (t?.hours && String(t.hours).startsWith("/"))
        return {
          it: `Ogni ${String(t.hours).slice(1)} ore`,
          en: `Every ${String(t.hours).slice(1)} hours`,
        };
      return { it: "A intervalli regolari", en: "At regular intervals" };
    }
    case "sun": {
      const tramonto = String(t?.event) === "sunset";
      const m = minutiDiSpostamento(t?.offset);
      const base = tramonto
        ? { it: "Al tramonto", en: "At sunset" }
        : { it: "All'alba", en: "At sunrise" };
      if (!m) return base;
      const quanto = `${Math.abs(m)} min`;
      return m < 0
        ? {
            it: `${quanto} prima ${tramonto ? "del tramonto" : "dell'alba"}`,
            en: `${quanto} before ${tramonto ? "sunset" : "sunrise"}`,
          }
        : {
            it: `${quanto} dopo ${tramonto ? "il tramonto" : "l'alba"}`,
            en: `${quanto} after ${tramonto ? "sunset" : "sunrise"}`,
          };
    }
    case "zone": {
      const dove = nomeDelle(t?.zone, nomeDi);
      return String(t?.event) === "leave"
        ? { it: `Quando ${chi} esce da ${dove}`, en: `When ${chi} leaves ${dove}` }
        : { it: `Quando ${chi} entra in ${dove}`, en: `When ${chi} enters ${dove}` };
    }
    case "homeassistant":
      return String(t?.event) === "shutdown"
        ? { it: "Quando Home Assistant si spegne", en: "When Home Assistant shuts down" }
        : { it: "All'avvio di Home Assistant", en: "When Home Assistant starts" };
    case "event":
      return {
        it: `Quando arriva l'evento ${t?.event_type || ""}`.trim(),
        en: `On the event ${t?.event_type || ""}`.trim(),
      };
    case "template":
      return { it: "Quando una condizione diventa vera", en: "When a condition becomes true" };
    case "device":
      return chi
        ? { it: `Da un dispositivo (${chi})`, en: `From a device (${chi})` }
        : { it: "Da un dispositivo", en: "From a device" };
    case "webhook":
      return { it: "Da un webhook", en: "From a webhook" };
    case "mqtt":
      return { it: "Da un messaggio MQTT", en: "From an MQTT message" };
    case "tag":
      return { it: "Da un tag NFC", en: "From an NFC tag" };
    case "calendar":
      return {
        it: `Da un evento di ${chi || "calendario"}`,
        en: `From a ${chi || "calendar"} event`,
      };
    case "conversation":
      return { it: "Da una frase all'assistente", en: "From an assistant sentence" };
    default:
      return { it: "Quando succede qualcosa", en: "When something happens" };
  }
}

/* «Luce col movimento» da «homeassistant/motion_light.yaml». */
function nomeDelBlueprint(percorso) {
  const base = String(percorso || "")
    .split("/")
    .pop()
    .replace(/\.ya?ml$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
}

const conta = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

/* Un'azione in parole, `{it, en}`, o `null` se non si sa dire in breve. */
function azione(a, { nomeDi }) {
  if (!a || typeof a !== "object") return null;
  const servizio = a.action ?? a.service;
  if (typeof servizio === "string" && servizio.includes(".")) {
    const entita = [
      ...elenco(a.target?.entity_id),
      ...elenco(a.entity_id),
      ...elenco(a.data?.entity_id),
    ].filter((x) => typeof x === "string");
    const chi = nomeDelle(entita, nomeDi);
    return servizioInParole(servizio, { chi, dati: a.data || a.service_data || {} });
  }
  if (a.scene) return servizioInParole("scene.turn_on", { chi: nomeDelle(a.scene, nomeDi) });
  if (a.event) {
    const evento = inParole(a.event);
    return { it: `manda l'evento ${evento}`, en: `fires the ${evento} event` };
  }
  if (a.choose) {
    const casi = elenco(a.choose).length;
    return {
      it: `sceglie fra ${conta(casi, "caso", "casi")}`,
      en: `chooses among ${conta(casi, "case", "cases")}`,
    };
  }
  if (a.if) return { it: "fa una cosa o l'altra", en: "does one thing or another" };
  if (a.repeat) return { it: "ripete delle azioni", en: "repeats some actions" };
  return null;
}

/* La prima azione che si sa dire (un'attesa non dice cosa fa). */
function primaAzione(azioni, aiuti) {
  for (const a of azioni) {
    const detta = azione(a, aiuti);
    if (detta) return detta;
  }
  return null;
}

/**
 * La riga di un'automazione, `{it, en}`, o `null` senza configurazione.
 * `nomeDi(entita)` → nome leggibile; `classeDi(entita)` → device_class.
 */
export function riassuntoDellAutomazione(config, { nomeDi = () => "", classeDi = () => "" } = {}) {
  if (!config || typeof config !== "object") return null;
  if (config.use_blueprint) {
    const nome = nomeDelBlueprint(config.use_blueprint.path);
    return nome
      ? { it: `Da blueprint «${nome}»`, en: `From blueprint "${nome}"` }
      : { it: "Da un blueprint", en: "From a blueprint" };
  }
  const inneschi = elenco(config.triggers ?? config.trigger);
  const condizioni = elenco(config.conditions ?? config.condition);
  const azioni = elenco(config.actions ?? config.action);
  const pezziIt = [];
  const pezziEn = [];
  if (inneschi.length) {
    const quando = innesco(inneschi[0], { nomeDi, classeDi });
    const altri = inneschi.length - 1;
    pezziIt.push(altri ? `${quando.it} (e ${conta(altri, "altro", "altri")})` : quando.it);
    pezziEn.push(altri ? `${quando.en} (and ${altri} more)` : quando.en);
  } else {
    pezziIt.push("Si avvia a mano");
    pezziEn.push("Started by hand");
  }
  if (condizioni.length) {
    pezziIt.push(conta(condizioni.length, "condizione", "condizioni"));
    pezziEn.push(conta(condizioni.length, "condition", "conditions"));
  }
  const detta = primaAzione(azioni, { nomeDi });
  if (detta) {
    const altre = azioni.length - 1;
    pezziIt.push(
      altre
        ? `${detta.it} e ${altre === 1 ? "un'altra azione" : `altre ${altre} azioni`}`
        : detta.it,
    );
    pezziEn.push(
      altre
        ? `${detta.en} and ${altre === 1 ? "1 more action" : `${altre} more actions`}`
        : detta.en,
    );
  } else if (azioni.length) {
    pezziIt.push(conta(azioni.length, "azione", "azioni"));
    pezziEn.push(conta(azioni.length, "action", "actions"));
  }
  return { it: pezziIt.join(" · "), en: pezziEn.join(" · ") };
}
