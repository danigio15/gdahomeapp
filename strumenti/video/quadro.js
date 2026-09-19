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

/* ══ 1. L'apertura ═════════════════════════════════════════════════════ */

scena(
  "apertura",
  7,
  (q) => `
  <div class="corpo incolonna">
    ${firma(0.1)}
    <h1 class="titolo cr" style="--t:.5s">${t(
      "Quaranta case installate.<br />Adesso come stanno?",
      "Forty homes installed.<br />How are they doing right now?",
    )}</h1>
    <div class="vetro pastiglia ap" style="--t:${q(1, 1.3)}s;border-color:rgba(14,165,233,.45);color:#7dd3fc">
      ${t("Il quadro · il cruscotto di chi monta gli impianti", "The panel · a dashboard for whoever installs them")}
    </div>
  </div>
  ${didascalia([
    {
      t: q(1, 2.2),
      testo: t(
        "Un solo quadro, su una macchina di gdahome. <b>Chi installa non accende niente.</b>",
        "One panel, on a gdahome machine. <b>Installers run nothing of their own.</b>",
      ),
    },
  ])}`,
);

/* ══ 2. Il problema ════════════════════════════════════════════════════ */

scena(
  "dopo-la-consegna",
  9,
  (q) => `
  ${cartello("1", t("Dopo la consegna", "After handover"), t("non ci torni più", "you never go back"))}
  <div class="corpo incolonna">
    <div class="voci" style="max-width:820px">
      ${croce(0.45, t("Il Wi-Fi di casa cambia, e l'impianto resta fuori", "The home Wi-Fi changes, and the system is left outside"))}
      ${croce(0.75, t("Una presa Zigbee sparisce, e nessuno se ne accorge", "A Zigbee plug disappears, and nobody notices"))}
      ${croce(1.05, t("Home Assistant resta fermo a sei mesi fa", "Home Assistant is still six months behind"))}
      ${croce(1.35, t("Il backup non gira dal giorno dell'installazione", "The backup hasn't run since the day it was installed"))}
    </div>
  </div>
  ${didascalia([
    {
      t: q(1, 2.6),
      testo: t("Te ne accorgi quando squilla il telefono.", "You find out when the phone rings."),
      t2: q(2, 5.2) - 0.3,
    },
    {
      t: q(2, 5.4),
      testo: t(
        "<b>Cioè quando il cliente è già arrabbiato.</b>",
        "<b>That is, when the customer is already angry.</b>",
      ),
    },
  ])}`,
);

/* ══ 3. Una domanda sola ═══════════════════════════════════════════════ */

scena(
  "una-domanda-sola",
  7.5,
  (q) => `
  ${cartello("2", t("Una domanda sola", "One question"), t("dieci controlli per casa, tutti i giorni", "ten checks per home, every day"))}
  <div class="corpo incolonna">
    <h1 class="titolo medio en" style="--t:.35s">${t(
      "Quell'impianto, adesso, come sta?",
      "That system, right now — how is it?",
    )}</h1>
    <div class="stati" style="margin-top:14px">
      <div class="vetro stato cr" style="--t:${q(1, 1)}s;border-color:rgba(22,163,74,.5);color:#86efac">
        <span class="segno">●</span>${t("a posto", "all good")}
      </div>
      <div class="vetro stato cr" style="--t:${q(1, 1.2) + 0.35}s;border-color:rgba(245,158,11,.5);color:#fcd34d">
        <span class="segno">▲</span>${t("da guardare", "worth a look")}
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
        "Una forma, una parola e un colore — <b>mai il colore da solo.</b>",
        "A shape, a word and a colour — <b>never the colour alone.</b>",
      ),
      t2: q(2, 4.8) - 0.3,
    },
    {
      t: q(2, 5),
      testo: t(
        "<b>Offline batte tutto:</b> di una casa che non parla non si sa niente, nemmeno che sta bene.",
        "<b>Offline beats everything:</b> a home that isn't talking tells you nothing — not even that it's fine.",
      ),
    },
  ])}`,
);

/* ══ 4. Come entra una casa ════════════════════════════════════════════ */

scena(
  "come-entra-una-casa",
  10,
  (q) => `
  ${cartello("3", t("Come entra una casa", "How a home gets in"), t("un codice che vive un giorno", "a code that lives one day"))}
  <div class="corpo">
    ${ritaglio({ foto: "quadro-abbina", x: 100, y: 222, largo: 650, alto: 436, scala: 0.78, stile: "--t:.45s" })}
    <div class="voci" style="max-width:580px">
      ${voce(q(0, 0.9), "#38bdf8", "1", t('Apri la pagina con la tua chiave, e premi <b>Abbina</b><span class="quando">Niente server da tenere su, niente dominio</span>', 'Open the page with your key and press <b>Pair</b><span class="quando">No server to keep up, no domain</span>'))}
      ${voce(q(1, 1.25), "#38bdf8", "2", t('Il codice si incolla nella <b>casella dell\'add-on</b><span class="quando">In casa del cliente, e lo fa anche lui: vive un giorno</span>', "The code goes in the <b>add-on's field</b><span class=\"quando\">At the customer's home — it lives a day, so they can do it</span>"))}
      ${voce(q(2, 1.6), "#38bdf8", "3", t('Il primo rapporto lega il codice a quella casa<span class="quando">E da lì in poi non serve a nessun\'altra</span>', 'The first report binds the code to that home<span class="quando">And from then on it\'s no use to any other</span>'))}
    </div>
  </div>
  ${didascalia([
    {
      t: q(3, 2.8),
      testo: t(
        "Chi intercettasse quel codice non aprirebbe niente: <b>non è una porta</b>, è il permesso di depositare righe di numeri.",
        "Intercepting that code opens nothing: <b>it isn't a door</b>, it's permission to drop off rows of numbers.",
      ),
      piccola: true,
    },
  ])}`,
);

/* ══ 5. L'elenco ═══════════════════════════════════════════════════════ */

scena(
  "l-elenco",
  9.5,
  (q) => `
  ${cartello("4", t("L'elenco", "The list"), t("quante case ti chiedono qualcosa adesso", "how many homes need you right now"))}
  <div class="corpo sovrapposti">
    ${schermo("quadro-elenco", { largo: 740, classe: "cr via", stile: `--t:.4s;--t2:${q(1, 5) - 0.3}s` })}
    ${ritaglio({
      foto: "quadro-elenco",
      x: 100,
      y: 362,
      largo: 420,
      alto: 170,
      scala: 1.55,
      classe: "cr-cc",
      stile: `--t:${q(1, 5.2)}s`,
    })}
  </div>
  ${didascalia([
    {
      t: q(0, 1.6),
      testo: t(
        "Si apre sul numero che conta: <b>quante case ti chiedono qualcosa adesso.</b>",
        "It opens on the number that matters: <b>how many homes need something now.</b>",
      ),
      t2: q(1, 5) - 0.3,
    },
    {
      t: q(1, 5.2),
      testo: t(
        "Ogni riga è una casa: lo stato, da quanto non parla, le spie accese, <b>e la striscia dei quattordici giorni</b>.",
        "Each row is a home: its state, how long it's been quiet, the warnings, <b>and the fourteen-day strip</b>.",
      ),
    },
  ])}`,
);

/* ══ 6. I dieci controlli ══════════════════════════════════════════════ */

scena(
  "i-dieci-controlli",
  10,
  (q) => `
  ${cartello("5", t("I dieci controlli", "The ten checks"), t("uno sguardo, e sai cosa ti tocca", "one look, and you know what's yours to do"))}
  <div class="corpo incolonna">
    ${ritaglio({ foto: "quadro-controlli", x: 530, y: 76, largo: 812, alto: 488, scala: 1, stile: "--t:.4s" })}
  </div>
  ${didascalia([
    {
      t: q(1, 1.8),
      testo: t(
        "Ognuno è un nome e basta — <b>«I collegamenti»</b>, non «Sono collegati tutti».",
        "Each one is just a name — <b>«Connections»</b>, not «Everything is connected».",
      ),
      t2: q(2, 5.4) - 0.3,
    },
    {
      t: q(2, 5.6),
      testo: t(
        "✓ verde, ✗ rosso, <b>◇ questa casa non lo dice</b> — che non è la stessa cosa di «va male».",
        "✓ green, ✗ red, <b>◇ this home doesn't say</b> — which is not the same as «it's broken».",
      ),
    },
  ])}`,
);

/* ══ 7. Dentro una casa ════════════════════════════════════════════════ */

scena(
  "dentro-una-casa",
  10,
  (q) => `
  ${cartello("6", t("Dentro una casa", "Inside one home"), t("la macchina, la rete, gli add-on, la salute", "the machine, the network, the add-ons, the health"))}
  <div class="corpo sovrapposti">
    ${schermo("quadro-come-sta", { largo: 740, classe: "cr via", stile: `--t:.4s;--t2:${q(1, 5.4) - 0.3}s` })}
    ${ritaglio({
      foto: "quadro-dispositivi",
      x: 536,
      y: 140,
      largo: 802,
      alto: 92,
      scala: 1.42,
      classe: "cr-cc",
      stile: `--t:${q(1, 5.6)}s`,
    })}
  </div>
  ${didascalia([
    {
      t: q(0, 1.6),
      testo: t(
        "La scheda, la CPU, la memoria, il disco e quanto resta, la temperatura <b>con la tacca a 75°</b>.",
        "The board, CPU, memory, disk and what's left, the temperature <b>with the mark at 75°</b>.",
      ),
      t2: q(1, 5.4) - 0.3,
    },
    {
      t: q(1, 5.6),
      testo: t(
        "La rete scheda per scheda, gli add-on uno per uno, e i dispositivi che non rispondono <b>con i loro nomi</b>.",
        "The network card by card, the add-ons one by one, and the devices that don't answer <b>by name</b>.",
      ),
    },
  ])}`,
);

/* ══ 8. Le tre righe che la macchina risponde da sola ══════════════════ */

scena(
  "tre-righe-che-contano",
  10,
  (q) => `
  ${cartello("7", t("Tre righe che contano", "Three lines that matter"), t("quelle che nessuno guarda", "the ones nobody looks at"))}
  <div class="corpo incolonna">
    ${ritaglio({ foto: "quadro-come-sta", x: 534, y: 232, largo: 540, alto: 84, scala: 1.6, stile: "--t:.4s" })}
    <div class="voci" style="max-width:880px">
      ${voce(q(0, 0.9), "#fcd34d", "1", t('<b>La vita del disco</b><span class="quando">Una eMMC ha un numero di scritture, e poi finisce. Vederla salire vuol dire cambiarla quando decidi tu</span>', '<b>Disk life used</b><span class="quando">An eMMC has a number of writes, then it\'s done. Watching it climb means replacing it when you choose</span>'))}
      ${voce(q(1, 1.25), "#fcd34d", "2", t('<b>La tacca a 75°</b><span class="quando">Sopra, la casa non si rompe: diventa lenta, e nessuno capisce perché</span>', '<b>The mark at 75°</b><span class="quando">Above it the home doesn\'t break: it gets slow, and nobody knows why</span>'))}
      ${voce(q(2, 1.6), "#fcd34d", "3", t('<b>Un add-on fermo non è un add-on spento</b><span class="quando">Conta solo chi parte all\'avvio ed è giù: quello si è fermato da solo</span>', '<b>A stopped add-on isn\'t a switched-off add-on</b><span class="quando">Only ones set to start on boot count: that one stopped by itself</span>'))}
    </div>
  </div>
  ${didascalia([
    {
      t: q(3, 3),
      testo: t(
        "Dove un numero non c'è — un NUC con un SSD — <b>non si inventa</b>.",
        "Where a number isn't there — a NUC with an SSD — <b>nothing is made up</b>.",
      ),
      piccola: true,
    },
  ])}`,
);

/* ══ 9. Gli aggiornamenti ══════════════════════════════════════════════ */

scena(
  "gli-aggiornamenti",
  10,
  (q) => `
  ${cartello("8", t("Aggiornare da lontano", "Updating from afar"), t("un gesto invece di quaranta", "one gesture instead of forty"))}
  <div class="corpo sovrapposti">
    ${schermo("quadro-aggiornamenti", { largo: 740, classe: "cr via", stile: `--t:.4s;--t2:${q(1, 5.2) - 0.3}s` })}
    ${ritaglio({
      foto: "quadro-controlli",
      x: 530,
      y: 636,
      largo: 812,
      alto: 190,
      scala: 1.32,
      classe: "cr-cc",
      stile: `--t:${q(1, 5.4)}s`,
    })}
  </div>
  ${didascalia([
    {
      t: q(0, 1.6),
      testo: t(
        "Chi è indietro, <b>da quale versione a quale</b>, e il tasto per farlo.",
        "Who's behind, <b>from which version to which</b>, and the button to do it.",
      ),
      t2: q(1, 5.2) - 0.3,
    },
    {
      t: q(1, 5.4),
      testo: t(
        "Il backup viene prima, sempre. Uno per volta. <b>E quello che non si installa da sé non ha un tasto.</b>",
        "Backup comes first, always. One at a time. <b>And what can't install itself gets no button.</b>",
      ),
    },
  ])}`,
);

/* ══ 10. Vedere e toccare ══════════════════════════════════════════════ */

scena(
  "vedere-e-toccare",
  9,
  (q) => `
  ${cartello("9", t("Vedere e toccare", "Seeing and touching"), t("sono due permessi", "are two permissions"))}
  <div class="corpo incolonna">
    <div class="vetro foglio grande cr" style="--t:.4s"><span class="chiave">quadro</span>: <span class="numero">"…"</span>            <span class="nota">${t("# manda il rapporto", "# send the report")}</span>
<span class="chiave">quadro_manutenzione</span>: <span class="numero">false</span>   <span class="nota">${t("# e lasciati aggiornare", "# and let it update you")}</span></div>
    <div class="vetro pastiglia en" style="--t:${q(1, 1.3)}s;border-color:rgba(14,165,233,.4);color:#cfe1f7;max-width:900px">
      <span style="flex:0 0 auto;width:26px;height:26px;border-radius:8px;border:2px solid rgba(207,225,247,.5)"></span>
      ${t(
        "«Lascia che chi ti ha fatto l'impianto aggiorni da lontano»",
        "«Let whoever installed your home update it from a distance»",
      )}
    </div>
    <p class="occhiello ap" style="--t:${q(1, 1.3) + 0.7}s">${t(
      "nelle opzioni dell'add-on · spento di serie",
      "in the add-on's options · off out of the box",
    )}</p>
  </div>
  ${didascalia([
    {
      t: q(1, 2),
      testo: t(
        "Il secondo non si dà da sé insieme al primo: <b>l'interruttore è in casa, e lo accende chi ci abita.</b>",
        "The second doesn't come free with the first: <b>the switch is in the home, and whoever lives there turns it on.</b>",
      ),
      t2: q(2, 5.6) - 0.3,
    },
    {
      t: q(2, 5.8),
      testo: t(
        "E quello che il quadro ha chiesto a quella casa si legge <b>parola per parola</b>, nella console dell'add-on.",
        "And whatever the panel asked that home is readable <b>word for word</b>, in the add-on's console.",
      ),
      piccola: true,
    },
  ])}`,
);

/* ══ 11. Quando una casa tace ══════════════════════════════════════════ */

scena(
  "quando-una-casa-tace",
  9.5,
  (q) => `
  ${cartello("10", t("Quando una casa tace", "When a home goes quiet"), t("un messaggio dove lo leggi", "a message where you'll read it"))}
  <div class="corpo incolonna">
    <div class="voci" style="max-width:900px">
      ${voce(0.45, "#38bdf8", segno("orologio", 19, "#38bdf8"), t('<b>Due ore, non tre quarti d\'ora</b><span class="quando">Un riavvio, un aggiornamento e un router che si riaccende ci stanno dentro</span>', '<b>Two hours, not forty-five minutes</b><span class="quando">A reboot, an update and a router coming back all fit inside that</span>'))}
      ${voce(0.8, "#38bdf8", "1", t('<b>Una volta sola</b><span class="quando">Una casa offline da tre giorni è una notizia, non una al giorno</span>', '<b>Once, and once only</b><span class="quando">A home quiet for three days is news, not news every day</span>'))}
      ${voce(1.15, "#38bdf8", segno("mondo", 19, "#38bdf8"), t('<b>Se tacciono in tanti insieme</b><span class="quando">Otto su dodici non sono otto guasti: è un guasto, e si dice una volta</span>', "<b>If many go quiet together</b><span class=\"quando\">Eight out of twelve aren't eight faults: it's one fault, said once</span>"))}
      ${voce(1.5, "#38bdf8", segno("ponte", 19, "#38bdf8"), t('<b>Se siamo stati via noi</b><span class="quando">Se il quadro è stato fermo tre ore, quel silenzio è il nostro: quel giro non dice niente</span>', '<b>If we were the ones away</b><span class="quando">If the panel was down for three hours, that silence is ours: that round says nothing</span>'))}
    </div>
  </div>
  ${didascalia([
    {
      t: q(1, 3),
      testo: t(
        "La parte difficile non è accorgersene: <b>è tacere.</b> Un avviso che squilla a ogni riavvio si silenzia in una settimana.",
        "The hard part isn't noticing: <b>it's staying quiet.</b> An alert that fires on every reboot gets muted within a week.",
      ),
      piccola: true,
    },
  ])}`,
);

/* ══ 12. Cosa non può fare ═════════════════════════════════════════════ */

scena(
  "cosa-non-puo-fare",
  11,
  (q) => `
  ${cartello("11", t("Cosa non può fare", "What it cannot do"), t("la parte che viene prima di tutte", "the part that comes before all the rest"))}
  <div class="corpo incolonna">
    ${ritaglio({ foto: "quadro-elenco", x: 548, y: 424, largo: 782, alto: 100, scala: 1.14, stile: "--t:.4s" })}
    <div class="voci" style="max-width:880px;margin-top:6px">
      ${croce(q(1, 1), t("<b>Non apre la plancia</b> — non c'è nessun tasto che porti dentro una casa, e non è un tasto dimenticato", "<b>It doesn't open the dashboard</b> — there's no button into anyone's home, and it isn't a forgotten one"))}
      ${croce(q(2, 1.3), t("<b>Non vede entità, stanze né persone</b> — riceve numeri, versioni e nomi di processi, e si ferma lì", "<b>It sees no entities, rooms or people</b> — it gets numbers, versions and process names, and stops there"))}
      ${croce(q(3, 1.6), t("<b>Non tocca niente oltre il suo verbo</b> — e solo dove quella casa ha aperto la manutenzione", "<b>It touches nothing beyond its one verb</b> — and only where that home opened maintenance"))}
    </div>
  </div>
  ${didascalia([
    {
      t: q(4, 3.2),
      testo: t(
        "<b>Un elettricista sostituisce un interruttore senza leggere la posta di chi ci abita.</b>",
        "<b>An electrician replaces a switch without reading the residents' mail.</b>",
      ),
      t2: q(5, 7.2) - 0.3,
    },
    {
      t: q(5, 7.4),
      testo: t(
        "Per entrare in una casa serve un abbinamento, e quello lo dà chi ci abita — col suo telefono, e lo toglie quando vuole.",
        "Getting into a home takes a pairing, and that's given by whoever lives there — with their phone, revoked whenever they like.",
      ),
      piccola: true,
    },
  ])}`,
);

/* ══ 13. Numeri, non nomi ══════════════════════════════════════════════ */

scena(
  "numeri-non-nomi",
  10,
  (q) => `
  ${cartello("12", t("Numeri, non nomi", "Numbers, not names"), t("quello che una casa manda, ogni quarto d'ora", "what a home sends, every fifteen minutes"))}
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
      <span class="ap" style="--t:1.9s">${t("le segnalazioni", "support tickets")}</span>
    </div>
  </div>
  ${didascalia([
    {
      /* Prima la riga che spiega cosa resta fuori — la voce sta elencando
         proprio quello — e solo dopo la frase che riassume tutto. */
      t: q(1, 3),
      testo: t(
        "«Mosquitto broker» ed «eth0» sono nomi di prodotti. Una rete che si chiama «Casa Rossi» è una persona, <b>e resta fuori</b>.",
        "«Mosquitto broker» and «eth0» are product names. A network called «The Rossi House» is a person, <b>and stays out</b>.",
      ),
      piccola: true,
      t2: q(2, 6.4) - 0.3,
    },
    {
      t: q(2, 6.6),
      testo: t(
        "<b>Cosa c'è nella scatola, non chi ci abita.</b>",
        "<b>What's in the box, not who lives in it.</b>",
      ),
    },
  ])}`,
);

/* ══ 14. La chiusura ═══════════════════════════════════════════════════ */

scena(
  "chiusura",
  7.5,
  (q) => `
  <div class="corpo incolonna">
    <img class="cr" src="${MARCHIO}" width="120" height="120" style="--t:.1s;border-radius:28px" alt="" />
    <h1 class="titolo medio en" style="--t:.45s">${t("Il quadro", "The panel")}</h1>
    <div class="vetro ap" style="--t:.95s;padding:16px 26px;border-radius:14px;font-family:'DejaVu Sans Mono',monospace;font-size:22px;color:#e6f2ff;border-color:rgba(14,165,233,.4)">
      quadro.gdahome.org
    </div>
  </div>
  ${didascalia([
    {
      t: q(1, 1.6),
      testo: t(
        "Gli si dà una chiave, e apre una pagina. <b>Niente server, niente dominio, niente da tenere su.</b>",
        "You hand over a key, and they open a page. <b>No server, no domain, nothing to keep running.</b>",
      ),
    },
  ])}`,
);

mettiInScena(SCENE);
