/* Il telecomando di una TV (#132).
 *
 * «Ho collegato le TV a Home Assistant, sarebbe possibile usarle anche qua per
 * spegnerle, accenderle ed usare il loro telecomando virtuale se disponibile?»
 *
 * Accendere e spegnere è uscito nella 1.6.8. Il telecomando è l'altra metà, e
 * ha un problema che il resto della scheda non ha: Home Assistant non dice
 * quali tasti una TV sa ricevere. `supported_features` dice il volume, la
 * sorgente, la pausa — le frecce no. Le frecce passano da
 * `remote.send_command`, e il nome di ogni tasto lo decide l'integrazione:
 * `KEY_UP` per Samsung, `DPAD_UP` per Android TV, `up` per Apple TV e Roku,
 * `CursorUp` per Philips. Un nome sbagliato non dà errore e non fa niente, che
 * da fuori è un tasto rotto.
 *
 * Quindi qui c'è l'elenco, integrazione per integrazione, dei tasti che
 * quell'integrazione documenta, e solo di quelli. Un'integrazione che non è
 * nell'elenco non ha telecomando: meglio nessuna freccia che frecce che non
 * fanno niente. LG webOS un'entità `remote` non ce l'ha: i tasti li prende il
 * suo `media_player`, con `webostv.button`.
 *
 * Il modulo è puro: niente DOM, niente Home Assistant.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** I tasti che il telecomando sa disegnare. */
export const TASTI_DEL_TELECOMANDO = Object.freeze([
  "su",
  "giu",
  "sinistra",
  "destra",
  "ok",
  "indietro",
  "home",
  "menu",
  "canale_meno",
  "canale_piu",
]);

/* I nomi dei tasti, integrazione per integrazione.
 *
 * `via` dice chi li riceve: `remote` è l'entità `remote.*` della TV, con
 * `remote.send_command`; `webostv` è il lettore stesso, con `webostv.button`.
 * Un tasto che un'integrazione non ha — i canali su Apple TV — qui non c'è, e
 * sulla scheda non si disegna. */
export const TELECOMANDI = Object.freeze({
  /* Samsung con l'integrazione locale. SmartThings un telecomando non lo
   * pubblica: accende, spegne e cambia sorgente, e quello la scheda lo fa già. */
  samsungtv: {
    nome: "Samsung Smart TV",
    via: "remote",
    tasti: {
      su: "KEY_UP",
      giu: "KEY_DOWN",
      sinistra: "KEY_LEFT",
      destra: "KEY_RIGHT",
      ok: "KEY_ENTER",
      indietro: "KEY_RETURN",
      home: "KEY_HOME",
      menu: "KEY_MENU",
      canale_meno: "KEY_CHDOWN",
      canale_piu: "KEY_CHUP",
    },
  },
  /* Android TV e Google TV: i Sony e i Philips recenti, TCL, Xiaomi, il
   * Chromecast con Google TV. */
  androidtv_remote: {
    nome: "Android TV Remote",
    via: "remote",
    tasti: {
      su: "DPAD_UP",
      giu: "DPAD_DOWN",
      sinistra: "DPAD_LEFT",
      destra: "DPAD_RIGHT",
      ok: "DPAD_CENTER",
      indietro: "BACK",
      home: "HOME",
      menu: "MENU",
      canale_meno: "CHANNEL_DOWN",
      canale_piu: "CHANNEL_UP",
    },
  },
  /* Apple TV: il tasto che torna indietro si chiama «menu», e i canali non ci
   * sono. */
  apple_tv: {
    nome: "Apple TV",
    via: "remote",
    tasti: {
      su: "up",
      giu: "down",
      sinistra: "left",
      destra: "right",
      ok: "select",
      indietro: "menu",
      home: "home",
    },
  },
  roku: {
    nome: "Roku",
    via: "remote",
    tasti: {
      su: "up",
      giu: "down",
      sinistra: "left",
      destra: "right",
      ok: "select",
      indietro: "back",
      home: "home",
      canale_meno: "channel_down",
      canale_piu: "channel_up",
    },
  },
  /* Sony Bravia: i nomi sono quelli che la TV stessa dà ai suoi tasti. */
  braviatv: {
    nome: "Sony Bravia TV",
    via: "remote",
    tasti: {
      su: "Up",
      giu: "Down",
      sinistra: "Left",
      destra: "Right",
      ok: "Confirm",
      indietro: "Return",
      home: "Home",
      menu: "Options",
      canale_meno: "ChannelDown",
      canale_piu: "ChannelUp",
    },
  },
  /* Philips, con JointSpace. */
  philips_js: {
    nome: "Philips TV",
    via: "remote",
    tasti: {
      su: "CursorUp",
      giu: "CursorDown",
      sinistra: "CursorLeft",
      destra: "CursorRight",
      ok: "Confirm",
      indietro: "Back",
      home: "Home",
      menu: "Options",
      canale_meno: "ChannelStepDown",
      canale_piu: "ChannelStepUp",
    },
  },
  /* LG webOS: niente entità `remote`, i tasti li prende il lettore. */
  webostv: {
    nome: "LG webOS TV",
    via: "webostv",
    tasti: {
      su: "UP",
      giu: "DOWN",
      sinistra: "LEFT",
      destra: "RIGHT",
      ok: "ENTER",
      indietro: "BACK",
      home: "HOME",
      menu: "MENU",
      canale_meno: "CHANNELDOWN",
      canale_piu: "CHANNELUP",
    },
  },
});

const MUTI = new Set(["", "unknown", "unavailable"]);

const risponde = (stato) => Boolean(stato) && !MUTI.has(pulito(stato.state).toLowerCase());

/** Se l'entità è un telecomando: un `remote.*`. */
export const eUnTelecomando = (entity) => /^remote\.[^.\s]+$/.test(pulito(entity));

/**
 * Il `remote.*` che porta lo stesso nome del lettore, se in casa c'è.
 *
 * Un'integrazione che pubblica la TV e il suo telecomando li chiama allo
 * stesso modo — `media_player.tv_salotto` e `remote.tv_salotto` — perché
 * nascono dallo stesso dispositivo.
 */
export function telecomandoGemello(entity, states = {}) {
  const oggetto = pulito(entity).split(".")[1] || "";
  if (!oggetto) return "";
  const gemello = `remote.${oggetto}`;
  return states?.[gemello] ? gemello : "";
}

/**
 * Le entità di cui serve sapere l'integrazione: i lettori, i telecomandi
 * scelti e quelli gemelli.
 *
 * Solo quelle: chiedere di tutta la casa per disegnare una croce sarebbe la
 * domanda più cara per la risposta più piccola.
 */
export function entitaDaRiconoscere(voci = [], states = {}) {
  const viste = new Set();
  for (const voce of Array.isArray(voci) ? voci : []) {
    const entity = pulito(voce?.entity);
    if (!entity) continue;
    viste.add(entity);
    if (eUnTelecomando(voce?.telecomando)) viste.add(pulito(voce.telecomando));
    const gemello = telecomandoGemello(entity, states);
    if (gemello) viste.add(gemello);
  }
  return [...viste];
}

/**
 * Il telecomando di un lettore, o `null`.
 *
 * `lettore` è `{ entity, telecomando, acceso }`: il `media_player`, il
 * `remote.*` scelto nella scheda (può mancare) e se la TV è accesa adesso.
 * `piattaforme` dice di che integrazione è ogni entità:
 * `{ "remote.tv_salotto": "samsungtv" }`.
 *
 * Da spenta il telecomando non c'è: premere un tasto che non arriva da
 * nessuna parte è peggio che non averlo, e per accenderla c'è già il tasto in
 * mezzo. Il telecomando gemello, trovato per nome e non scelto, vale solo se è
 * della stessa integrazione della TV: una cassa chiamata «salotto» non deve
 * prendersi le frecce del televisore che sta nella stessa stanza.
 */
export function telecomandoDelLettore(lettore = {}, states = {}, piattaforme = {}) {
  if (!lettore?.acceso) return null;
  const entity = pulito(lettore.entity);
  if (!entity) return null;
  const dellaTv = pulito(piattaforme?.[entity]);
  const scelto = eUnTelecomando(lettore.telecomando) ? pulito(lettore.telecomando) : "";
  const remoto = scelto || telecomandoGemello(entity, states);
  if (remoto && risponde(states?.[remoto])) {
    const suo = pulito(piattaforme?.[remoto]);
    const regola = TELECOMANDI[suo];
    if (regola?.via === "remote" && (scelto || suo === dellaTv))
      return { via: "remote", entity: remoto, piattaforma: suo, tasti: regola.tasti };
  }
  const regola = TELECOMANDI[dellaTv];
  if (regola && regola.via !== "remote")
    return { via: regola.via, entity, piattaforma: dellaTv, tasti: regola.tasti };
  return null;
}

/** Quali tasti ha quel telecomando, nell'ordine di `TASTI_DEL_TELECOMANDO`. */
export function tastiDelTelecomando(telecomando) {
  const tasti = telecomando?.tasti || {};
  return TASTI_DEL_TELECOMANDO.filter((tasto) => Boolean(tasti[tasto]));
}

/**
 * Il servizio da chiamare per un tasto, o `null` se quel telecomando non l'ha.
 *
 * Si manda il tasto e basta: niente ripetizioni, niente pressione lunga. Un
 * telecomando vero manda un tasto per ogni pressione, e chi scorre un elenco
 * preme tre volte.
 */
export function comandoDelTelecomando(telecomando, tasto) {
  const nome = telecomando?.tasti?.[tasto];
  const entity = pulito(telecomando?.entity);
  if (!nome || !entity) return null;
  if (telecomando.via === "remote")
    return {
      domain: "remote",
      service: "send_command",
      data: { entity_id: entity, command: nome },
    };
  if (telecomando.via === "webostv")
    return { domain: "webostv", service: "button", data: { entity_id: entity, button: nome } };
  return null;
}

/**
 * Cosa verrà fuori dal telecomando scelto, per dirlo nella scheda del Config:
 * `{ esito, piattaforma }`.
 *
 *  · `tv`          — la TV i tasti li prende da sé (LG webOS), non serve altro;
 *  · `pronto`      — il telecomando è di un'integrazione di cui si sanno i tasti;
 *  · `sconosciuto` — se ne sa l'integrazione, ma non i suoi tasti: non comparirà;
 *  · `attesa`      — di che integrazione sia non si sa ancora;
 *  · `non_remote`  — quella scritta non è un'entità `remote.*`;
 *  · `nessuno`     — non c'è niente di scelto.
 *
 * Chi sceglie un telecomando e non vede comparire niente deve sapere perché:
 * un tasto che non si disegna, e nessuno che dice il motivo, è un guasto.
 */
export function esitoDelTelecomando(lettore = {}, piattaforme = {}) {
  const dellaTv = pulito(piattaforme?.[pulito(lettore?.entity)]);
  if (TELECOMANDI[dellaTv] && TELECOMANDI[dellaTv].via !== "remote")
    return { esito: "tv", piattaforma: dellaTv };
  const scelto = pulito(lettore?.telecomando);
  if (!scelto) return { esito: "nessuno", piattaforma: "" };
  if (!eUnTelecomando(scelto)) return { esito: "non_remote", piattaforma: "" };
  if (!Object.prototype.hasOwnProperty.call(piattaforme || {}, scelto))
    return { esito: "attesa", piattaforma: "" };
  const suo = pulito(piattaforme[scelto]);
  if (TELECOMANDI[suo]?.via === "remote") return { esito: "pronto", piattaforma: suo };
  return { esito: "sconosciuto", piattaforma: suo };
}

/** I telecomandi che ci sono in casa, per proporli nella scheda. */
export function telecomandiInCasa(states = {}) {
  return Object.keys(states || {})
    .filter(eUnTelecomando)
    .sort((a, b) => a.localeCompare(b));
}
