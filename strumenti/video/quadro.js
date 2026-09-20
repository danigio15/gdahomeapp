/* Il film del quadro, scena per scena.
 *
 * Racconta una cosa sola, e la racconta in due meta': **cosa vede** chi ha
 * montato l'impianto quando apre il quadro, e **cosa non vede**. La seconda
 * meta' non e' un di piu': e' la parte che decide se questo pezzo si puo' dare
 * in mano a qualcuno. Un installatore che tiene quaranta impianti non deve
 * poter guardare dentro quaranta case — quelle case sono di altri, e dentro ci
 * sono le telecamere, le presenze, gli orari di chi ci vive.
 *
 * Quello che si vede negli schermi sono **le fotografie della console vera**
 * (`quadro-vero.mjs`): la pagina di `quadro/console/`, con dentro una flotta
 * inventata. Qui non si ridisegna niente di quella pagina, e non si deve: il
 * giorno che la console cambia, cambiano le fotografie e il film e' gia'
 * aggiornato.
 *
 * Le due regole del palco valgono anche qui: niente animazioni infinite, e
 * quello che compare dopo parte nascosto (`opacity: 0` + `forwards`).
 */

import { computer, LINGUA, MARCHIO, mettiInScena, segno, t } from "./pezzi.js";

/* ── I tempi della voce ───────────────────────────────────────────────────
 *
 * Questo film e' parlato (`parlato.js`, `voce.mjs`), e il parlato decide due
 * cose che una volta stavano scritte qui: **quanto dura una scena** e **quando
 * arriva una didascalia**.
 *
 * Quanto dura: la scena aspetta la voce. Se il parlato di una scena dura
 * diciotto secondi, la scena dura diciotto secondi — quello che c'e' scritto
 * sotto, nella chiamata a `scena(...)`, resta il **minimo**, cioe' il tempo che
 * vuole quello che si vede anche quando nessuno parla.
 *
 * Quando arriva una didascalia: insieme alla frase che la dice. Le didascalie
 * di questo film sono la voce scritta — servono a chi lo guarda in silenzio —
 * e una che arriva tre secondi prima o dopo si legge come una cosa a parte.
 *
 * I tempi li misura `voce.mjs` e li lascia in `parlato-tempi.json`. Se quel
 * file non c'e' — qualcuno apre questa pagina a mano, o lo cancella — il film
 * si gira lo stesso con i numeri scritti qui sotto: muto, e con le didascalie
 * dove stavano prima.
 */
const TEMPI = await (async () => {
  try {
    const risposta = await fetch(new URL("parlato-tempi.json", import.meta.url));
    if (!risposta.ok) return {};
    return (await risposta.json())[LINGUA] ?? {};
  } catch {
    return {};
  }
})();

const SCENE = [];

/**
 * Una scena: un nome, quanto dura **almeno**, e cosa c'e' dentro.
 *
 * Al contenuto si passa `q`: `q(2, 5.4)` e' il secondo in cui comincia il
 * terzo pezzo di parlato di questa scena, e `5.4` e' dove stava la didascalia
 * quando il film era muto.
 */
const scena = (nome, durata, contenuto) => {
  const suo = TEMPI[nome];
  const q = (quale, difetto) => suo?.pezzi?.[quale] ?? difetto;
  SCENE.push({ nome, durata: suo?.durata ?? durata, contenuto: () => contenuto(q) });
};

/* Quanto e' larga la fotografia della console, in punti. E' la misura vera
   dello schermo che l'ha fatta (`quadro-vero.mjs`), e serve ai ritagli: un
   pezzo si prende in quelle coordinate la', non in quelle di qui. */
const LARGA = 1440;

/* ── I pezzi che tornano ──────────────────────────────────────────────── */

const cartello = (numero, titolo, sotto, quando = 0.15) => `
  <div class="cartello en" style="--t:${quando}s">
    <div class="numero">${numero}</div>
    <div>
      <h2>${titolo}</h2>
      ${sotto ? `<p class="sotto">${sotto}</p>` : ""}
    </div>
  </div>`;

/* Le righe in basso: ognuna arriva quando tocca a lei, e se ne va quando
   arriva la prossima. */
const didascalia = (righe) => `
  <div class="didascalia">
    ${righe
      .map(
        (riga) => `
      <div class="riga ap${riga.t2 !== undefined ? " via" : ""}"
           style="--t:${riga.t}s${riga.t2 !== undefined ? `;--t2:${riga.t2}s` : ""}">
        <p class="${riga.piccola ? "piccola" : ""}">${riga.testo}</p>
      </div>`,
      )
      .join("")}
  </div>`;

/* Lo schermo con dentro la console vera.
 *
 * Le proporzioni sono quelle della fotografia (1440×900) e non quelle che
 * verrebbero comode: una fotografia dentro una cornice di un'altra forma o si
 * stira o si taglia, e qui tagliare vuol dire perdere l'elenco delle case. */
const schermo = (foto, { largo = 740, classe = "cr", stile = "--t:.4s" } = {}) => {
  const alto = Math.round((largo / LARGA) * 900);
  const dentro = `<img src="${foto}.png" width="${largo}" height="${alto}"
                       style="display:block;width:100%;height:100%" alt="" />`;
  return `<div class="${classe}" style="${stile}">${computer({ largo, alto, dentro })}</div>`;
};

/* Un pezzo di console, guardato da vicino.
 *
 * `x`, `y`, `largo` e `alto` sono le coordinate **nella fotografia**, in punti
 * dello schermo che l'ha scattata. `scala` dice quanto lo si guarda da vicino:
 * sopra l'uno ingrandisce, e a 2× la fotografia ce la fa ancora perche' e'
 * stata scattata al doppio. */
const ritaglio = ({ foto, x, y, largo, alto, scala = 1, classe = "cr", stile = "--t:.4s" }) => `
  <div class="ritaglio ${classe}"
       style="${stile};width:${Math.round(largo * scala)}px;height:${Math.round(alto * scala)}px">
    <img src="${foto}.png" width="${Math.round(LARGA * scala)}"
         style="left:${-Math.round(x * scala)}px;top:${-Math.round(y * scala)}px" alt="" />
  </div>`;

const voce = (quando, tinta, bollo, testo) => `
  <div class="vetro voce en" style="--t:${quando}s">
    <div class="bollo" style="background:${tinta}26;border:1px solid ${tinta}66;color:${tinta}">${bollo}</div>
    <div>${testo}</div>
  </div>`;

const croce = (quando, testo) => voce(quando, "#fb7185", "✗", testo);
const spunta = (quando, testo) => voce(quando, "#4ade80", segno("spunta", 19, "#4ade80"), testo);

const firma = (quando = 0.1) => `
  <div class="firma ap" style="--t:${quando}s">
    <img src="${MARCHIO}" width="54" height="54" style="border-radius:15px" alt="" />gdahome
  </div>`;

/* ══ 1. L'apertura ═════════════════════════════════════════════════════════ */

scena(
  "apertura",
  7,
  (q) => `
  <div class="corpo incolonna">
    ${firma(0.1)}
    <h1 class="titolo cr" style="--t:.5s">${t("Hai installato quaranta impianti.<br />Come fai a sapere se ci sono problemi da gestire?", "Forty systems installed.<br />How do you know if there are problems to deal with?")}</h1>
    <div class="vetro pastiglia ap" style="--t:${q(1, 1.3)}s;border-color:rgba(14,165,233,.45);color:#7dd3fc">
      ${t("Cruscotto installatore · una pagina sola per tutti i tuoi impianti", "Installer dashboard · one page for all your systems")}
    </div>
  </div>
  ${didascalia([
    {
      t: q(1, 2.2),
      testo: t(
        "Il cruscotto è uno solo ed è ospitato da gdahome: <b>l'installatore non deve mantenere nessun server.</b>",
        "There is one dashboard, hosted by gdahome: <b>the installer runs no server of their own.</b>",
      ),
    },
  ])}`,
);

/* ══ 2. Il problema ════════════════════════════════════════════════════════ */

scena(
  "dopo-la-consegna",
  9,
  (q) => `
  ${cartello("1", t("Dopo la consegna", "After handover"), t("all'impianto non torna più nessuno", "nobody goes back to the system"))}
  <div class="corpo incolonna">
    <div class="voci" style="max-width:820px">
      ${croce(0.45, t("Il cliente cambia il Wi-Fi e l'impianto perde la connessione", "The customer changes the Wi-Fi and the system loses its connection"))}
      ${croce(0.75, t("Una presa Zigbee smette di rispondere e nessuno se ne accorge", "A Zigbee plug stops answering and nobody notices"))}
      ${croce(1.05, t("Home Assistant non viene aggiornato per sei mesi", "Home Assistant goes six months without an update"))}
      ${croce(1.35, t("Il backup non viene eseguito dal giorno dell'installazione", "The backup hasn't run since the day it was installed"))}
    </div>
  </div>
  ${didascalia([
    {
      t: q(1, 2.6),
      testo: t(
        "Te ne accorgi solo quando ti chiama il cliente.",
        "You find out when the customer calls.",
      ),
      t2: q(2, 5.2) - 0.3,
    },
    {
      t: q(2, 5.4),
      testo: t(
        "<b>Cioè quando il problema è già diventato un reclamo.</b>",
        "<b>That is, when the problem is already a complaint.</b>",
      ),
    },
  ])}`,
);

/* ══ 3. Una domanda sola ═══════════════════════════════════════════════════ */

scena(
  "una-domanda-sola",
  7.5,
  (q) => `
  ${cartello("2", t("Una domanda sola", "One question"), t("dieci controlli per ogni impianto, ogni giorno", "ten checks per system, every day"))}
  <div class="corpo incolonna">
    <h1 class="titolo medio en" style="--t:.35s">${t("Quell'impianto, adesso, ha problemi da gestire?", "That system, right now: is there a problem to deal with?")}</h1>
    <div class="stati" style="margin-top:14px">
      <div class="vetro stato cr" style="--t:${q(1, 1)}s;border-color:rgba(22,163,74,.5);color:#86efac">
        <span class="segno">●</span>${t("in ordine", "in order")}
      </div>
      <div class="vetro stato cr" style="--t:${q(1, 1.2) + 0.35}s;border-color:rgba(245,158,11,.5);color:#fcd34d">
        <span class="segno">▲</span>${t("da verificare", "to check")}
      </div>
      <div class="vetro stato cr" style="--t:${q(1, 1.4) + 0.7}s;border-color:rgba(225,29,72,.5);color:#fda4af">
        <span class="segno">■</span>${t("offline", "offline")}
      </div>
    </div>
  </div>
  ${didascalia([
    {
      t: q(1, 2.3),
      testo: t(
        "Ogni stato ha una forma, una parola e un colore: <b>mai il colore da solo.</b>",
        "Every state has a shape, a word and a colour: <b>never the colour alone.</b>",
      ),
      t2: q(2, 4.8) - 0.3,
    },
    {
      t: q(2, 5),
      testo: t(
        "<b>Lo stato offline viene prima di tutti:</b> di un impianto che non comunica non sappiamo nulla, nemmeno se ha problemi.",
        "<b>Offline comes before everything:</b> of a system that isn't reporting we know nothing — not even whether it has a problem.",
      ),
    },
  ])}`,
);

/* ══ 4. Come si collega un impianto ════════════════════════════════════════ */

scena(
  "come-entra-una-casa",
  10,
  (q) => `
  ${cartello("3", t("Come si collega un impianto", "How a system gets connected"), t("un codice che vale un giorno e un solo impianto", "a code that lasts one day, for one system"))}
  <div class="corpo">
    ${ritaglio({ foto: "quadro-abbina", x: 147, y: 288, largo: 566, alto: 410, scala: 0.82, stile: "--t:.45s" })}
    <div class="voci" style="max-width:600px">
      ${voce(q(0, 0.9), "#38bdf8", "1", t('Apri <b>Abbinamento</b> e premi <b>Genera codice</b><span class="quando">Il codice vale un giorno e un solo impianto</span>', 'Open <b>Pairing</b> and press <b>Generate code</b><span class="quando">The code lasts one day, for one system</span>'))}
      ${voce(q(1, 1.25), "#38bdf8", "2", t("In casa del cliente, il codice va nella <b>configurazione dell'add-on</b><span class=\"quando\">Nella casella «Il codice di chi ti ha fatto l'impianto»: può farlo anche il cliente</span>", "At the customer's home, the code goes into the <b>add-on's configuration</b><span class=\"quando\">In the field «The code of whoever installed your home»: the customer can do it</span>"))}
      ${voce(q(2, 1.6), "#38bdf8", "3", t('Entro un minuto l\'impianto compare nel cruscotto<span class="quando">Da quel momento il codice non funziona su nessun altro</span>', 'Within a minute the system shows up on the dashboard<span class="quando">From then on the code works for no other</span>'))}
    </div>
  </div>
  ${didascalia([
    {
      t: q(3, 2.8),
      testo: t(
        "Chi intercettasse il codice non potrebbe entrare in casa: <b>non apre nessun accesso</b>, permette solo di inviare dati di stato.",
        "Intercepting the code gets nobody into the home: <b>it opens no access</b>, it only allows status data to be sent.",
      ),
      piccola: true,
    },
  ])}`,
);

/* ══ 5. La schermata degli impianti ════════════════════════════════════════ */

scena(
  "l-elenco",
  9.5,
  (q) => `
  ${cartello("4", t("La schermata degli impianti", "The systems screen"), t("l'anello, le case da verificare, e tutte le altre", "the ring, the homes to check, and all the rest"))}
  <div class="corpo sovrapposti">
    ${schermo("quadro-elenco", { largo: 740, classe: "cr-cc via", stile: `--t:.4s;--t2:${q(1, 5) - 0.3}s` })}
    ${ritaglio({ foto: "quadro-elenco", x: 147, y: 455, largo: 1146, alto: 235, scala: 0.92, classe: "cr-cc via", stile: `--t:${q(1, 5.2)}s;--t2:${q(2, 9) - 0.3}s` })}
    ${ritaglio({ foto: "quadro-elenco", x: 147, y: 735, largo: 1146, alto: 165, scala: 0.92, classe: "cr-cc", stile: `--t:${q(2, 9.2)}s` })}
  </div>
  ${didascalia([
    {
      t: q(0, 1.6),
      testo: t(
        "Il cruscotto si apre sull'<b>anello</b>: tutti gli impianti in un cerchio, colorato in proporzione a quanti hanno problemi da gestire, e sotto i tre numeri.",
        "The dashboard opens on the <b>ring</b>: every system in one circle, coloured in proportion to how many have problems to deal with, with the three counts below.",
      ),
      t2: q(1, 5) - 0.3,
    },
    {
      t: q(1, 5.2),
      testo: t(
        "<b>Da verificare ora</b>: una carta per ogni casa che chiede qualcosa, con scritto cosa non va.",
        "<b>To check now</b>: one card per home that needs something, saying what's wrong.",
      ),
      t2: q(2, 9) - 0.3,
    },
    {
      t: q(2, 9.2),
      testo: t(
        "<b>Tutti gli impianti</b>, una mattonella per casa: lo stato, da quanto non comunica, e la linea degli ultimi quattordici giorni.",
        "<b>All systems</b>, one tile per home: its state, how long since it last reported, and the line of the last fourteen days.",
      ),
    },
  ])}`,
);

/* ══ 6. I dieci controlli ══════════════════════════════════════════════════ */

scena(
  "i-dieci-controlli",
  10,
  (q) => `
  ${cartello("5", t("I dieci controlli", "The ten checks"), t("a colpo d'occhio, dove intervenire", "at a glance, where to act"))}
  <div class="corpo incolonna">
    ${ritaglio({ foto: "quadro-controlli", x: 396, y: 235, largo: 648, alto: 525, scala: 0.95, stile: "--t:.4s" })}
  </div>
  ${didascalia([
    {
      t: q(1, 1.8),
      testo: t(
        "Ogni controllo porta il nome di ciò che verifica — <b>«I collegamenti»</b>, non «Sono tutti collegati».",
        "Each check is named after what it verifies — <b>«Connections»</b>, not «Everything is connected».",
      ),
      t2: q(2, 5.4) - 0.3,
    },
    {
      t: q(2, 5.6),
      testo: t(
        "✓ verde, ✗ rosso, oppure <b>◇ «non comunicato»</b>: il dato non è arrivato — che non è la stessa cosa di un guasto.",
        "✓ green, ✗ red, or <b>◇ «not reported»</b>: the data didn't arrive — which is not the same as a fault.",
      ),
    },
  ])}`,
);

/* ══ 7. La scheda di un impianto ═══════════════════════════════════════════ */

scena(
  "dentro-una-casa",
  10,
  (q) => `
  ${cartello("6", t("La scheda di un impianto", "One system's sheet"), t("si apre in un foglio, a capitoli", "opens in a sheet, chapter by chapter"))}
  <div class="corpo sovrapposti">
    ${ritaglio({ foto: "quadro-da-fare", x: 380, y: 72, largo: 680, alto: 270, scala: 1, classe: "cr-cc via", stile: `--t:.4s;--t2:${q(1, 5.4) - 0.3}s` })}
    ${ritaglio({ foto: "quadro-stato", x: 396, y: 230, largo: 648, alto: 330, scala: 1, classe: "cr-cc via", stile: `--t:${q(1, 5.6)}s;--t2:${q(2, 9) - 0.3}s` })}
    ${ritaglio({ foto: "quadro-dispositivi", x: 396, y: 243, largo: 648, alto: 88, scala: 1.2, classe: "cr-cc", stile: `--t:${q(2, 9.2)}s` })}
  </div>
  ${didascalia([
    {
      t: q(0, 1.6),
      testo: t(
        "In cima: cosa non va, la matricola, quando è stato abbinato, l'ultimo rapporto e i telefoni collegati.",
        "At the top: what's wrong, the serial, when it was paired, the last report and the connected phones.",
      ),
      t2: q(1, 5.4) - 0.3,
    },
    {
      t: q(1, 5.6),
      testo: t(
        "Poi i capitoli: <b>Da fare</b>, con i controlli e gli aggiornamenti; <b>Stato dell'impianto</b>: macchina, rete, add-on, gli ultimi quattordici giorni e i dispositivi; <b>Dettagli tecnici</b>: le versioni e il rapporto completo.",
        "Then the chapters: <b>To do</b>, with the checks and the updates; <b>System state</b>: machine, network, add-ons, the last fourteen days and the devices; <b>Technical details</b>: versions and the full report.",
      ),
      t2: q(2, 9) - 0.3,
    },
    {
      t: q(2, 9.2),
      testo: t(
        "E i dispositivi che non rispondono, <b>con i loro nomi</b>.",
        "And the devices that don't answer, <b>by name</b>.",
      ),
    },
  ])}`,
);

/* ══ 8. Tre dati che fanno la differenza ═══════════════════════════════════ */

scena(
  "tre-righe-che-contano",
  10,
  (q) => `
  ${cartello("7", t("Tre dati che fanno la differenza", "Three numbers that matter"), t("quelli che di solito nessuno controlla", "the ones nobody usually checks"))}
  <div class="corpo incolonna">
    ${ritaglio({ foto: "quadro-dettagli", x: 416, y: 415, largo: 410, alto: 135, scala: 1.4, stile: "--t:.4s" })}
    <div class="voci" style="max-width:880px">
      ${voce(q(0, 0.9), "#fcd34d", "1", t('<b>La vita del disco</b><span class="quando">Una memoria eMMC sopporta un numero limitato di scritture. Seguirne il consumo permette di sostituirla prima che si guasti</span>', '<b>Disk life</b><span class="quando">An eMMC memory takes a limited number of writes. Following how much is used lets you replace it before it fails</span>'))}
      ${voce(q(1, 1.25), "#fcd34d", "2", t('<b>La temperatura, con la soglia a 75°</b><span class="quando">Oltre questa temperatura l\'impianto non si guasta, ma rallenta, ed è difficile capirne il motivo</span>', '<b>Temperature, with the threshold at 75°</b><span class="quando">Above it the system doesn\'t break: it slows down, and nobody knows why</span>'))}
      ${voce(q(2, 1.6), "#fcd34d", "3", t('<b>Un add-on fermo non è un add-on spento</b><span class="quando">Il cruscotto segnala solo quelli con l\'avvio automatico: se sono fermi, si sono fermati da soli</span>', '<b>A stopped add-on isn\'t a switched-off add-on</b><span class="quando">The dashboard only flags the ones set to start automatically: if they are stopped, they stopped by themselves</span>'))}
    </div>
  </div>
  ${didascalia([
    {
      t: q(3, 3),
      testo: t(
        "Quando un dato non c'è — un NUC con un SSD non lo fornisce — <b>il cruscotto lo lascia vuoto</b>.",
        "When a number isn't there — a NUC with an SSD doesn't provide it — <b>the dashboard leaves it blank</b>.",
      ),
      piccola: true,
    },
  ])}`,
);

/* ══ 9. Gli aggiornamenti ══════════════════════════════════════════════════ */

scena(
  "gli-aggiornamenti",
  10,
  (q) => `
  ${cartello("8", t("Aggiornare da remoto", "Updating remotely"), t("una volta sola, non quaranta", "once, not forty times"))}
  <div class="corpo sovrapposti">
    ${schermo("quadro-aggiornamenti", { largo: 740, classe: "cr-cc via", stile: `--t:.4s;--t2:${q(1, 5.2) - 0.3}s` })}
    ${ritaglio({ foto: "quadro-aggiornamenti", x: 147, y: 262, largo: 1146, alto: 295, scala: 0.86, classe: "cr-cc", stile: `--t:${q(1, 5.4)}s` })}
  </div>
  ${didascalia([
    {
      t: q(0, 1.6),
      testo: t(
        "Quali impianti sono da aggiornare, <b>da quale versione a quale</b>, e il pulsante per farlo.",
        "Which systems need updating, <b>from which version to which</b>, and the button to do it.",
      ),
      t2: q(1, 5.2) - 0.3,
    },
    {
      t: q(1, 5.4),
      testo: t(
        "Il backup viene eseguito prima, sempre. Un impianto per volta: <b>per questo non c'è un «installa tutti»</b>. E ciò che non si installa in automatico non ha nessun pulsante.",
        "Backup runs first, always. One system at a time: <b>that's why there is no «install all»</b>. And what can't install itself gets no button.",
      ),
    },
  ])}`,
);

/* ══ 10. Leggere e intervenire ═════════════════════════════════════════════ */

scena(
  "vedere-e-toccare",
  9,
  (q) => `
  ${cartello("9", t("Leggere e intervenire", "Reading and acting"), t("sono due permessi distinti", "are two separate permissions"))}
  <div class="corpo incolonna">
    <div class="vetro foglio grande cr" style="--t:.4s"><span class="chiave">quadro</span>: <span class="numero">"…"</span>            <span class="nota">${t("# invia i dati di stato", "# send the status data")}</span>
<span class="chiave">quadro_manutenzione</span>: <span class="numero">false</span>   <span class="nota">${t("# e consenti la manutenzione da remoto", "# and allow remote maintenance")}</span></div>
    <div class="vetro pastiglia en" style="--t:${q(1, 1.3)}s;border-color:rgba(14,165,233,.4);color:#cfe1f7;max-width:900px">
      <span style="flex:0 0 auto;width:26px;height:26px;border-radius:8px;border:2px solid rgba(207,225,247,.5)"></span>
      ${t("«Lascia che chi ti ha fatto l'impianto aggiorni da lontano»", "«Let whoever installed your home update it from a distance»")}
    </div>
    <p class="occhiello ap" style="--t:${q(1, 1.3) + 0.7}s">${t("nelle opzioni dell'add-on · disattivato di serie", "in the add-on's options · off by default")}</p>
  </div>
  ${didascalia([
    {
      t: q(1, 2),
      testo: t(
        "Il secondo permesso non è compreso nel primo: <b>l'interruttore è nell'add-on, e lo attiva il cliente.</b>",
        "The second permission isn't included in the first: <b>the switch is in the add-on, and the customer turns it on.</b>",
      ),
      t2: q(2, 5.6) - 0.3,
    },
    {
      t: q(2, 5.8),
      testo: t(
        "Ogni comando inviato dal cruscotto resta scritto <b>per esteso</b> nel registro dell'add-on, che il cliente può leggere.",
        "Every command the dashboard sends stays written <b>in full</b> in the add-on's log, which the customer can read.",
      ),
      piccola: true,
    },
  ])}`,
);

/* ══ 11. Cosa il cruscotto non può fare ════════════════════════════════════ */

scena(
  "cosa-non-puo-fare",
  11,
  (q) => `
  ${cartello("10", t("Cosa il cruscotto non può fare", "What the dashboard cannot do"), t("il limite, prima di tutto il resto", "the limit, before all the rest"))}
  <div class="corpo incolonna">
    ${ritaglio({ foto: "quadro-da-fare", x: 396, y: 345, largo: 648, alto: 205, scala: 1.02, stile: "--t:.4s" })}
    <div class="voci" style="max-width:880px;margin-top:6px">
      ${croce(q(1, 1), t("<b>Non apre la plancia del cliente</b> — non esiste nessun comando per entrare in una casa, ed è una scelta precisa", "<b>It doesn't open the customer's dashboard</b> — there is no command into anyone's home, and that is deliberate"))}
      ${croce(q(2, 1.3), t("<b>Non vede entità, stanze o persone</b> — riceve soltanto numeri, versioni e nomi di processi", "<b>It sees no entities, rooms or people</b> — it only gets numbers, versions and process names"))}
      ${voce(q(3, 1.6), "#38bdf8", "3", t("<b>Può fare tre sole cose</b>, ognuna dove il cliente l'ha permessa<span class=\"quando\">Avviare un aggiornamento già in attesa, premere «Riavvia Home Assistant» e, con un terzo permesso a parte, aprire la «Configurazione» della plancia — senza vederla. Nient'altro</span>", '<b>It can do three things only</b>, each where the customer allowed it<span class="quando">Start an update already waiting, press «Restart Home Assistant» and, with a third separate permission, open the dashboard «Configuration» — without seeing it. Nothing else</span>'))}
    </div>
  </div>
  ${didascalia([
    {
      t: q(4, 3.2),
      testo: t(
        "<b>Come un elettricista che sostituisce un interruttore senza entrare nella vita di chi abita la casa.</b>",
        "<b>Like an electrician replacing a switch without stepping into the lives of the people who live there.</b>",
      ),
      t2: q(5, 7.2) - 0.3,
    },
    {
      t: q(5, 7.4),
      testo: t(
        "Per accedere a un impianto serve un abbinamento, e lo concede il cliente dal suo telefono: può revocarlo quando vuole.",
        "Getting into a system takes a pairing, and the customer grants it from their phone: they can revoke it whenever they like.",
      ),
      piccola: true,
    },
  ])}`,
);

/* ══ 12. Numeri, non nomi ══════════════════════════════════════════════ */

scena(
  "numeri-non-nomi",
  10,
  (q) => `
  ${cartello("11", t("Numeri, non nomi", "Numbers, not names"), t("i dati che ogni impianto invia, in tempo reale", "what a home sends, in real time"))}
  <div class="corpo">
    <div class="vetro foglio cr" style="--t:.4s">{
  <span class="chiave">"casa"</span>: <span class="numero">"casa_a3f19c74e05b…"</span>,
  <span class="chiave">"ponte"</span>: <span class="numero">"1.5.9"</span>,
  <span class="chiave">"ha"</span>: <span class="numero">"2026.9.1"</span>,
  <span class="chiave">"macchina"</span>: { <span class="chiave">"cpu"</span>: <span class="numero">21</span>, <span class="chiave">"disco"</span>: <span class="numero">61</span>,
                <span class="chiave">"temperatura"</span>: <span class="numero">58</span> },
  <span class="chiave">"batterie"</span>: { <span class="chiave">"piuBassa"</span>: <span class="numero">34</span> },
  <span class="chiave">"backup"</span>: { <span class="chiave">"giorniFa"</span>: <span class="numero">1</span> }
}</div>
    <div class="mai">
      <span class="ap" style="--t:1.2s">${t("nomi di stanze", "room names")}</span>
      <span class="ap" style="--t:1.3s">${t("nomi di persone", "people's names")}</span>
      <span class="ap" style="--t:1.4s">${t("stati dei sensori", "sensor states")}</span>
      <span class="ap" style="--t:1.5s">${t("l'SSID del Wi-Fi", "the Wi-Fi SSID")}</span>
      <span class="ap" style="--t:1.6s">${t("l'indirizzo pubblico", "the public address")}</span>
      <span class="ap" style="--t:1.7s">${t("la posizione", "location")}</span>
      <span class="ap" style="--t:1.8s">${t("le telecamere", "cameras")}</span>
      <span class="ap" style="--t:1.9s">${t("le richieste di assistenza", "support tickets")}</span>
    </div>
  </div>
  ${didascalia([
    {
      /* Prima la riga che spiega cosa resta fuori — la voce sta elencando
         proprio quello — e solo dopo la frase che riassume tutto. */
      t: q(1, 3),
      testo: t(
        "«Mosquitto broker» ed «eth0» sono nomi di prodotti, e possono uscire. Una rete chiamata «Casa Rossi» contiene il nome del cliente, <b>e resta fuori</b>.",
        "«Mosquitto broker» and «eth0» are product names. A network called «The Rossi House» is a person, <b>and stays out</b>.",
      ),
      piccola: true,
      t2: q(2, 6.4) - 0.3,
    },
    {
      t: q(2, 6.6),
      testo: t(
        "<b>Il cruscotto sa cosa c'è nell'impianto, non chi abita la casa.</b>",
        "<b>What's in the box, not who lives in it.</b>",
      ),
    },
  ])}`,
);

/* ══ 13. La chiusura ═══════════════════════════════════════════════════ */

scena(
  "chiusura",
  7.5,
  (q) => `
  <div class="corpo incolonna">
    <img class="cr" src="${MARCHIO}" width="120" height="120" style="--t:.1s;border-radius:28px" alt="" />
    <h1 class="titolo medio en" style="--t:.45s">${t("Cruscotto installatore", "The panel")}</h1>
    <div class="vetro ap" style="--t:.95s;padding:16px 26px;border-radius:14px;font-family:'DejaVu Sans Mono',monospace;font-size:22px;color:#e6f2ff;border-color:rgba(14,165,233,.4)">
      quadro.gdahome.org
    </div>
  </div>
  ${didascalia([
    {
      t: q(1, 1.6),
      testo: t(
        "All'installatore basta una chiave per aprire la pagina. <b>Nessun server, nessun dominio, niente da mantenere.</b>",
        "You hand over a key, and they open a page. <b>No server, no domain, nothing to keep running.</b>",
      ),
    },
  ])}`,
);

mettiInScena(SCENE);
