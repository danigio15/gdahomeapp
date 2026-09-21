/* «Dove lo metto?» — il foglietto che accoglie un dispositivo appena entrato
 * (#54, passo 4).
 *
 * I primi tre passi li fa l'app: apre la rete, aspetta, e chiede un nome.
 * Il quarto no, ed e' una scelta: le sezioni della plancia non hanno tutte la
 * stessa forma — le luci sono una mappa con le stanze in una mappa a parte, le
 * prese un elenco di righe, il clima un elenco che porta anche di che tipo e' —
 * e scriverle dall'app vorrebbe dire scriverle due volte. A scrivere e' la
 * plancia, con le sue regole: se un domani la sezione Luci cambia forma, cambia
 * qui dentro e basta.
 *
 * Per la stessa ragione qui non c'e' il marchio di gdahome: questa e' la
 * plancia, e la plancia porta il logo dell'installatore.
 *
 * ── Chi lo apre ─────────────────────────────────────────────────────────
 *
 * L'app, che la plancia se la tiene dentro una cornice: chiama
 * `gdahomeDoveLoMetto({...})` e il foglietto sale. Dentro Home Assistant, dove
 * la cornice e' un'altra, arriva come messaggio — con lo stesso marchio che
 * usa gia' il guscio per parlare col suo ospite, e solo dal suo ospite.
 *
 * Quello che arriva da fuori e' DATO, mai comando: un identificativo e un
 * nome, scritti a schermo passando dalla stessa scappatoia di tutto il resto
 * (`esc`). Non si esegue niente di quello che c'e' scritto dentro.
 *
 * Le regole — in che sezione va, cosa ci finira' scritto — stanno in
 * `core/dove-lo-metto.js`, che si prova senza un browser. Qui c'e' il
 * foglietto e il salvataggio.
 */

import {
  LE_SEZIONI,
  comeLoScrivo,
  cosaAltroPorta,
  laSezioneGiusta,
  laVoceDaScrivere,
  sezione as laSezione,
  vuoleLaStanza,
} from "../core/dove-lo-metto.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  roomLabel,
  roomOptionsMarkup,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_DOVE_LO_METTO__";
const state = (root[KEY] ||= { installed: false, voce: null, scelta: "" });

const ID = "dm-dove-lo-metto";

/* Il marchio con cui il guscio parla col suo ospite. Sta scritto anche in
 * `legacy/host.js`, che e' l'altro lato: sono due programmi diversi, e come
 * `__DASHBOARDMODERN_HOSTED__` si cambia in due posti. */
const DALL_OSPITE = "dashboardmodern-host";

/* Come si chiama una sezione, nella lingua che si parla. Il nucleo le due
 * meta' le porta — e le prende, dove c'e', dalla scheda del Config che quella
 * sezione la configura — ma quale delle due si legge lo sa solo qui. */
const nomeDellaSezione = (voce) => t(voce?.it, voce?.en);

/** Come si chiamano i campi, a schermo. Il nucleo non sa che lingua si parla. */
function nomeDelCampo(campo) {
  if (campo === "entity") return t("Entità", "Entity");
  if (campo === "nome") return t("Nome", "Name");
  if (campo === "stanza") return t("Stanza", "Room");
  return t("Icona", "Icon");
}

/* E perche' quella sezione: le parole della proposta. Una frase che spiega vale
 * piu' di una proposta accettata al buio.
 *
 * Le parole stanno qui e non nel nucleo, che non sa che lingua si parla: di la'
 * il motivo e' una parola sola — «lampadina», «occupancy» — e qui diventa la
 * riga che si legge. */
const COSA_E = Object.freeze({
  lampadina: () => t("è una lampadina", "it is a light"),
  presa: () => t("è una presa", "it is a socket"),
  clima: () => t("è un climatizzatore", "it is a climate unit"),
  copertura: () => t("è una copertura", "it is a cover"),
  shutter: () => t("è una tapparella", "it is a shutter"),
  blind: () => t("è una tenda", "it is a blind"),
  curtain: () => t("è una tenda", "it is a curtain"),
  awning: () => t("è una tenda da sole", "it is an awning"),
  shade: () => t("è una tenda", "it is a shade"),
  serratura: () => t("è una serratura", "it is a lock"),
  door: () => t("è un sensore di porta", "it is a door sensor"),
  window: () => t("è un sensore di finestra", "it is a window sensor"),
  garage_door: () => t("è un sensore del garage", "it is a garage sensor"),
  garage: () => t("è un sensore del garage", "it is a garage sensor"),
  opening: () => t("è un sensore di apertura", "it is an opening sensor"),
  motion: () => t("rileva il movimento", "it detects motion"),
  occupancy: () => t("dice se la stanza è occupata", "it tells whether the room is busy"),
  presence: () => t("dice se c'è qualcuno", "it tells whether someone is there"),
  temperature: () => t("misura la temperatura", "it measures temperature"),
  humidity: () => t("misura l'umidità", "it measures humidity"),
});

function perche(motivo) {
  const dillo = COSA_E[motivo];
  return `${t("Te la propongo io:", "My suggestion:")} ${dillo ? dillo() : t("è quello che sembra", "it is what it looks like")}`;
}

/*
 * «Questo dispositivo porta dentro anche...»: cosa succede alle altre.
 *
 * Su una rete Zigbee entra un dispositivo, e un dispositivo porta cinque o sei
 * entita'. Una sola finisce in sezione, e chi guarda deve sapere che fine
 * fanno le altre — se restano dov'erano di proposito, o se ce n'e' una che
 * meriterebbe un posto suo e va aggiunta a mano.
 *
 * Ogni caso e' una frase intera, col numero dentro: la plancia le traduce
 * anche cosi' — il catalogo di ogni lingua ha la sua frase con lo stesso
 * `${}` dentro — e una frase intera e' l'unica che un'altra lingua puo'
 * rigirare come le serve. Incollare «porta dentro anche altre» + il numero +
 * «entita'» vuol dire tre pezzi che in tedesco vanno in un altro ordine e in
 * arabo dall'altra parte.
 */
function quantAltroPorta({ quante = 0, daMettere = [] } = {}) {
  if (daMettere.length === 1)
    return quante === 1
      ? t(
          "Questo dispositivo porta dentro un'altra entità, e ha un posto suo: la aggiungi dalla sua scheda.",
          "This device brings in one more entity, and it has a place of its own: add it from its own tab.",
        )
      : t(
          `Questo dispositivo porta dentro altre ${quante} entità, e una ha un posto suo: la aggiungi dalla sua scheda.`,
          `This device brings in ${quante} more entities, and one has a place of its own: add it from its own tab.`,
        );
  if (daMettere.length)
    /* Quante siano quelle da mettere non si scrive: sarebbe un secondo numero
     * nella stessa frase, e i cataloghi rimettono i numeri al posto loro
     * nell'ordine in cui li trovano — due, e una lingua che li giri li scambia
     * in silenzio. «Alcune» dice quello che serve sapere. */
    return t(
      `Questo dispositivo porta dentro altre ${quante} entità, e alcune hanno un posto loro: le aggiungi dalle loro schede.`,
      `This device brings in ${quante} more entities, and some have a place of their own: add them from their own tabs.`,
    );
  return quante === 1
    ? t(
        "Questo dispositivo porta dentro un'altra entità: è quello che racconta di sé — batteria, segnale — e sta bene dov'è.",
        "This device brings in one more entity: it is what the device says about itself — battery, signal — and it is fine where it is.",
      )
    : t(
        `Questo dispositivo porta dentro altre ${quante} entità: sono quelle che racconta di sé — batteria, segnale — e stanno bene dove sono.`,
        `This device brings in ${quante} more entities: they are what the device says about itself — battery, signal — and they are fine where they are.`,
      );
}

/**
 * Il foglietto, come markup.
 *
 * Non legge niente: entrano il dispositivo, la sezione scelta e le stanze;
 * esce il disegno. E' la parte che si prova senza aprire una plancia.
 */
export function ilFoglietto(voce = {}, scelta = "", { stanze = "" } = {}) {
  const proposta = laSezioneGiusta(voce);
  const quale = clean(scelta) || proposta?.chiave || "";
  const suo = laSezione(quale);
  const stanza = clean(voce.stanza);
  /* La sezione che vuole una stanza non si puo' salvare senza: una sonda
   * senza stanza non ha dove andare, e il tasto lo dice invece di scrivere a
   * vuoto e far credere che sia fatta. */
  const manca = Boolean(suo) && vuoleLaStanza(quale) && !clean(voce.stanza_id);
  /* E quello che il dispositivo porta dentro oltre a quello che decide: una
   * presa smart entra in casa con cinque entita', e metterne una in una
   * sezione non vuol dire che le altre siano sparite. */
  const altro = cosaAltroPorta(voce, proposta?.entity || clean(voce.entity));
  const righe = comeLoScrivo(quale, voce)
    .map(
      (riga) =>
        `<div class="dm-dove-riga"><span>${esc(nomeDelCampo(riga.campo))}</span><b${riga.campo === "entity" ? ' class="dm-dove-id"' : ""}>${esc(riga.valore)}</b></div>`,
    )
    .join("");

  /* Le altre sezioni: tutte tranne quella che si sta guardando. «Oppure» con
   * dentro anche quella scelta direbbe «oppure quella li'». */
  const altre = LE_SEZIONI.filter((una) => una.chiave !== quale)
    .map(
      (una) =>
        `<button type="button" class="dm-dove-altra" data-dm-dove-sezione="${esc(una.chiave)}">
          <span aria-hidden="true">${esc(una.icona)}</span><span>${esc(nomeDellaSezione(una))}</span>
        </button>`,
    )
    .join("");

  const testa = suo
    ? `<div class="dm-dove-proposta">
        <div class="dm-dove-scelta">
          <span class="dm-dove-segno" aria-hidden="true">${esc(suo.icona)}</span>
          <div>
            <div class="dm-dove-nome">${esc(nomeDellaSezione(suo))}</div>
            <div class="dm-dove-perche">${esc(
              proposta && proposta.chiave === quale
                ? perche(proposta.perche)
                : t("L’hai scelta tu", "Your choice"),
            )}</div>
          </div>
          <span class="dm-dove-spunta" aria-hidden="true">✓</span>
        </div>
        <div class="dm-dove-anteprima">
          <span class="dm-dove-eti">${esc(t("Riempio io così", "This is what I will write"))}</span>
          ${righe}
        </div>
      </div>`
    : `<div class="dm-dove-vuoto">${esc(
        t(
          "Non so dove metterlo: scegli tu qui sotto. Un dispositivo che non ha una sezione sua sta bene fra le tue entità.",
          "I do not know where this goes: pick below. A device with no section of its own belongs with your own entities.",
        ),
      )}</div>`;

  return `
    <div class="dm-dove-velo" data-dm-dove-chiudi></div>
    <section class="dm-dove-foglio" role="dialog" aria-modal="true" aria-labelledby="dm-dove-titolo">
      <div class="dm-dove-maniglia" aria-hidden="true"></div>
      <header class="dm-dove-testa">
        <h2 id="dm-dove-titolo">${esc(t("Dove lo metto?", "Where does it go?"))}</h2>
        <p>${esc(clean(voce.nome) || clean(voce.entity))}${stanza ? ` · ${esc(stanza)}` : ""}</p>
      </header>
      ${testa}
      <label class="dm-dove-stanza">
        <span>${esc(t("Stanza", "Room"))}</span>
        <select data-dm-dove-stanza>${stanze}</select>
      </label>
      <div class="dm-dove-eti dm-dove-oppure">${esc(t("Oppure", "Or"))}</div>
      <div class="dm-dove-altre">${altre}</div>
      ${altro.quante ? `<p class="dm-dove-porta">${esc(quantAltroPorta(altro))}</p>` : ""}
      ${/* E che si puo' cambiare idea. Qui prima c'era scritto perche' a
          * scrivere e' la plancia e non l'app: e' vero, ed e' il motivo per cui
          * questo foglietto esiste, ma a chi lo legge non serve — sa gia' che
          * qualcosa sta per essere scritto, e quello che vuole sapere e' se e'
          * definitivo. Non lo e'. */ ""}
      <p class="dm-dove-nota">${esc(
        t(
          "Niente di definitivo: nome, stanza e icona si cambiano quando vuoi dall'editor della sezione.",
          "Nothing here is final: name, room and icon can be changed whenever you like from the section's editor.",
        ),
      )}</p>
      <div class="dm-dove-tasti">
        <button type="button" class="dm-dove-dopo" data-dm-dove-chiudi>${esc(t("Più tardi", "Later"))}</button>
        <button type="button" class="dm-dove-ok" data-dm-dove-salva ${suo && !manca ? "" : "disabled"}>${esc(
          !suo
            ? t("Scegli una sezione", "Pick a section")
            : manca
              ? t("Scegli una stanza", "Pick a room")
              : t(`Mettilo in ${nomeDellaSezione(suo)}`, `Put it in ${nomeDellaSezione(suo)}`),
        )}</button>
      </div>
    </section>`;
}

/* ── il giro ─────────────────────────────────────────────────────────────── */

function disegna() {
  if (!doc || !state.voce) return false;
  let dove = doc.getElementById(ID);
  if (!dove) {
    dove = doc.createElement("div");
    dove.id = ID;
    dove.className = "dm-dove";
    doc.body.append(dove);
  }
  const scelto = clean(state.voce.stanza_id);
  dove.innerHTML = ilFoglietto(state.voce, state.scelta, {
    stanze: roomOptionsMarkup(scelto, t("— Nessuna stanza —", "— No room —")),
  });
  return true;
}

function chiudi() {
  doc?.getElementById(ID)?.remove();
  state.voce = null;
  state.scelta = "";
}

/**
 * Apre il foglietto per un dispositivo appena entrato.
 *
 * `voce` e' quello che sa l'app: l'entita', il nome che le e' stato dato e la
 * stanza, quando c'e'. Tutto testo, e tutto trattato come testo.
 */
export function apriIlPopupDelDispositivo(voce = {}) {
  if (!doc) return false;
  const entita = clean(voce.entity || voce.entita || voce.entity_id);
  if (!entita) return false;
  state.voce = {
    entity: entita,
    nome: clean(voce.nome || voce.name),
    device_class: clean(voce.device_class || voce.classe),
    classe: clean(voce.device_class || voce.classe),
    /* Tutte le entita' del dispositivo, quando l'app le manda: da una rete
     * Zigbee entra un dispositivo, non un'entita', e quale delle sei decide
     * lo sa il nucleo. */
    entities: Array.isArray(voce.entities || voce.entita) ? voce.entities || voce.entita : [],
    stanza_id: clean(voce.stanza_id || voce.room_id),
    stanza: clean(voce.stanza) || roomLabel(clean(voce.stanza_id || voce.room_id)),
  };
  state.scelta = "";
  return disegna();
}

/** Scrive davvero, e chiude. */
function salva() {
  const voce = state.voce;
  if (!voce) return false;
  const proposta = laSezioneGiusta(voce);
  const quale = clean(state.scelta) || proposta?.chiave || "";
  const suo = laSezione(quale);
  if (!suo) return false;
  if (vuoleLaStanza(quale) && !clean(voce.stanza_id)) return false;
  /* Si scrive l'entita' che ha DECISO, non il primo id del dispositivo: su una
   * presa smart sono due cose diverse, e mettere in sezione il wattmetro al
   * posto dell'interruttore vuol dire una riga che non si accende. */
  const scritta = { ...voce, entity: clean(proposta?.entity) || voce.entity };
  /* Si rilegge quello che c'e' adesso, non quello che c'era all'apertura: fra
   * l'una e l'altra ci puo' essere stato un salvataggio dell'editor, e
   * riscriverci sopra vorrebbe dire buttarlo. */
  const dentro = Object.fromEntries(suo.chiavi.map((chiave) => [chiave, readJson(chiave, null)]));
  const scritto = laVoceDaScrivere(quale, scritta, dentro);
  if (!scritto) return false;
  let cambiato = false;
  for (const [chiave, valore] of Object.entries(scritto))
    cambiato = writeJsonIfChanged(chiave, valore, { sync: false }) || cambiato;
  if (cambiato) {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
  /* E la plancia si rifa': un dispositivo messo in una sezione e che non si
   * vede finche' non si ricarica e' un dispositivo che sembra non essere
   * stato messo. */
  try {
    root.render?.();
  } catch (_errore) {}
  chiudi();
  return true;
}

function alTocco(evento) {
  const bersaglio = evento.target;
  if (!bersaglio?.closest?.(`#${ID}`)) return;
  if (bersaglio.closest("[data-dm-dove-chiudi]")) {
    evento.preventDefault();
    chiudi();
    return;
  }
  const altra = bersaglio.closest("[data-dm-dove-sezione]");
  if (altra) {
    evento.preventDefault();
    state.scelta = clean(altra.dataset.dmDoveSezione);
    disegna();
    return;
  }
  if (bersaglio.closest("[data-dm-dove-salva]")) {
    evento.preventDefault();
    salva();
  }
}

function alCambio(evento) {
  const campo = evento.target;
  if (!campo?.matches?.("[data-dm-dove-stanza]") || !state.voce) return;
  state.voce.stanza_id = clean(campo.value);
  state.voce.stanza = roomLabel(state.voce.stanza_id);
  disegna();
}

/* Il tasto «indietro» del telefono, e l'Escape: un foglietto che si apre da
 * solo e non si chiude col gesto di sempre e' un foglietto in cui uno resta
 * chiuso dentro. */
function allaTastiera(evento) {
  if (evento.key === "Escape" && state.voce) chiudi();
}

function ilMessaggioDellOspite(evento) {
  /* Solo dal proprio ospite: un messaggio che arriva da un'altra finestra non
   * apre niente. E' la stessa regola con cui il guscio gli parla. */
  if (evento.source !== root.parent || evento.source === root) return;
  const detto = evento.data;
  if (!detto || typeof detto !== "object") return;
  if (detto.source !== DALL_OSPITE || detto.action !== "dove-lo-metto") return;
  apriIlPopupDelDispositivo(detto.dispositivo || {});
}

function foglio() {
  installStyle(
    "dm-dove-lo-metto-style",
    `
      #${ID}{position:fixed!important;inset:0!important;z-index:100080!important}
      .dm-dove-velo{position:absolute!important;inset:0!important;background:rgba(15,23,42,.52)!important}
      .dm-dove-foglio{position:absolute!important;left:0!important;right:0!important;bottom:0!important;max-height:88vh!important;overflow:auto!important;background:var(--card-background-color,#fff)!important;border-radius:30px 30px 0 0!important;padding:12px 18px 22px!important;display:grid!important;gap:13px!important;box-shadow:0 -18px 50px rgba(15,23,42,.30)!important}
      .dm-dove-maniglia{width:44px!important;height:5px!important;border-radius:3px!important;background:var(--divider-color,#cbd5e1)!important;justify-self:center!important}
      .dm-dove-testa h2{margin:0!important;font-size:20px!important;font-weight:900!important;letter-spacing:.6px!important;text-transform:uppercase!important;color:var(--primary-text-color,#0f172a)!important}
      .dm-dove-testa p{margin:4px 0 0!important;font-size:13px!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-dove-proposta{border:2px solid var(--primary-color,#0ea5e9)!important;border-radius:22px!important;padding:16px!important;display:grid!important;gap:13px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 7%,transparent)!important}
      .dm-dove-scelta{display:grid!important;grid-template-columns:30px minmax(0,1fr) 26px!important;align-items:center!important;gap:12px!important}
      .dm-dove-segno{font-size:23px!important}
      .dm-dove-nome{font-size:16px!important;font-weight:900!important;color:var(--primary-text-color,#0f172a)!important}
      .dm-dove-perche{font-size:12px!important;font-weight:700!important;color:var(--primary-color,#0369a1)!important;margin-top:2px!important}
      .dm-dove-spunta{display:grid!important;place-items:center!important;width:26px!important;height:26px!important;border-radius:50%!important;background:var(--primary-color,#0ea5e9)!important;color:#fff!important;font-size:14px!important;font-weight:900!important}
      .dm-dove-anteprima{background:var(--card-background-color,#fff)!important;border:1px solid var(--divider-color,#bae6fd)!important;border-radius:15px!important;padding:13px 14px!important;display:grid!important;gap:9px!important}
      .dm-dove-riga{display:grid!important;grid-template-columns:70px minmax(0,1fr)!important;gap:10px!important;font-size:12.5px!important}
      .dm-dove-riga span{font-weight:800!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-dove-riga b{font-weight:700!important;color:var(--primary-text-color,#0f172a)!important;overflow:hidden!important;text-overflow:ellipsis!important}
      .dm-dove-id{font-family:ui-monospace,monospace!important;font-size:11.5px!important;white-space:nowrap!important}
      .dm-dove-vuoto{font-size:13px!important;line-height:1.55!important;color:var(--secondary-text-color,#64748b)!important;border:1px dashed var(--divider-color,#dbe4ee)!important;border-radius:18px!important;padding:14px 16px!important}
      .dm-dove-stanza{display:grid!important;gap:6px!important}
      .dm-dove-stanza span{font-size:10.5px!important;font-weight:800!important;letter-spacing:2px!important;text-transform:uppercase!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-dove-stanza select{width:100%!important;height:46px!important;border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:15px!important;background:var(--card-background-color,#fff)!important;color:var(--primary-text-color,#0f172a)!important;font:inherit!important;padding:0 12px!important}
      .dm-dove-eti{font-size:10.5px!important;font-weight:800!important;letter-spacing:2px!important;text-transform:uppercase!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-dove-oppure{padding-left:4px!important}
      .dm-dove-altre{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(88px,1fr))!important;gap:10px!important}
      .dm-dove-altra{border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:18px!important;background:var(--card-background-color,#fff)!important;padding:14px 6px!important;display:grid!important;justify-items:center!important;gap:7px!important;cursor:pointer!important;font:inherit!important}
      .dm-dove-altra span:first-child{font-size:22px!important}
      .dm-dove-altra span:last-child{font-size:12px!important;font-weight:800!important;color:var(--primary-text-color,#334155)!important}
      .dm-dove-porta{margin:0!important;font-size:12px!important;line-height:1.55!important;color:var(--secondary-text-color,#64748b)!important;background:var(--secondary-background-color,#f1f5f9)!important;border-radius:14px!important;padding:11px 13px!important}
      .dm-dove-nota{margin:0!important;font-size:12px!important;line-height:1.55!important;color:var(--secondary-text-color,#64748b)!important;padding:0 4px!important}
      .dm-dove-tasti{display:flex!important;gap:10px!important}
      .dm-dove-dopo{width:116px!important;flex-shrink:0!important;height:54px!important;border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:17px!important;background:var(--card-background-color,#fff)!important;color:var(--secondary-text-color,#475569)!important;font-size:14.5px!important;font-weight:800!important;cursor:pointer!important}
      .dm-dove-ok{flex-grow:1!important;height:54px!important;border:0!important;border-radius:17px!important;background:var(--primary-color,#0ea5e9)!important;color:#fff!important;font-size:16px!important;font-weight:800!important;cursor:pointer!important}
      .dm-dove-ok[disabled]{opacity:.45!important;cursor:default!important}
    `,
  );
}

export function installDoveLoMettoSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  foglio();
  doc.addEventListener("click", alTocco, true);
  doc.addEventListener("change", alCambio, true);
  doc.addEventListener("keydown", allaTastiera, true);
  root.addEventListener?.("message", ilMessaggioDellOspite);
  /* La porta dell'app: la plancia la tiene dentro una cornice e la chiama da
   * li'. Il nome e' quello del prodotto perche' e' l'app a scriverlo. */
  root.gdahomeDoveLoMetto = apriIlPopupDelDispositivo;
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installDoveLoMettoSection, { once: true });
else installDoveLoMettoSection();
