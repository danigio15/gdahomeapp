/* Il film corto: quello che va su Facebook e su TikTok.
 *
 * Dice sei cose e basta, perche' un video sui social si guarda in piedi
 * all'autobus: cos'e', cosa ci fai, come si mette, **che e' gratis**, che per
 * restare gratis ha bisogno di una mano, e da quando c'e'.
 *
 * Le scene sono **colonne**, non coordinate: i blocchi si mettono in fila e si
 * dispongono da soli con lo spazio che trovano. E' l'unico modo perche' lo
 * stesso film stia bene in un quadrato e in un palco in piedi, senza scriverlo
 * due volte.
 */

import { MARCHIO, mettiInScena, oggetto, plancia, segno, telefono } from "./pezzi.js";

/* Quanto e' alto il palco, e quanta aria lasciare sopra e sotto, lo dice
   l'indirizzo: chi filma lo compone per Facebook o per TikTok. */
const misure = new URLSearchParams(location.search);
const dimmi = (nome, difetto) => misure.get(nome) ?? difetto;
const radice = document.documentElement.style;
radice.setProperty("--alto", `${dimmi("alto", 1080)}px`);
radice.setProperty("--su", `${dimmi("su", 72)}px`);
radice.setProperty("--giu", `${dimmi("giu", 72)}px`);
radice.setProperty("--aria", `${dimmi("aria", 30)}px`);
radice.setProperty("--zoom", dimmi("zoom", 1));

const SCENE = [];
const scena = (nome, durata, contenuto) => SCENE.push({ nome, durata, contenuto });

/* ── I pezzi che tornano ──────────────────────────────────────────────── */

const firma = (t = 0.1) => `
  <div class="firma ap" style="--t:${t}s">
    <img src="${MARCHIO}" width="62" height="62" style="border-radius:17px" alt="" />gdahome
  </div>`;

const voce = (t, tinta, bollo, testo) => `
  <div class="vetro voce-grande en" style="--t:${t}s">
    <div class="bollo" style="background:${tinta}26;border:1px solid ${tinta}66;color:${tinta}">${bollo}</div>
    <div>${testo}</div>
  </div>`;

const spunta = (t, testo) => voce(t, "#4ade80", segno("spunta", 30, "#4ade80"), testo);

const sezione = (t, disegno, nome) => `
  <div class="vetro ap" style="--t:${t}s">${oggetto(disegno, 42)}<span>${nome}</span></div>`;

/* ══ 1. Il gancio ══════════════════════════════════════════════════════ */

scena(
  "il-gancio",
  7,
  () => `
  <div class="colonna">
    ${firma(0.1)}
    <h1 class="titolo en" style="--t:.45s">La tua casa,<br />in una schermata</h1>
    ${telefono({ scala: 0.82, classe: "cr", stile: "--t:.85s", dentro: plancia({ accende: 3.6 }) })}
    <p class="sotto ap" style="--t:1.5s">Luci, clima, energia, tapparelle, telecamere.<br /><b>Si tocca, e in casa succede.</b></p>
  </div>`,
);

/* ══ 2. Cosa c'è dentro ════════════════════════════════════════════════ */

scena(
  "cosa-c-e-dentro",
  6,
  () => `
  <div class="colonna">
    <h1 class="titolo piccolo en" style="--t:.15s">Tutto quello che hai in casa,<br />già pronto</h1>
    <div class="sezioni">
      ${sezione(0.5, "luci", "Luci")}
      ${sezione(0.6, "clima", "Clima")}
      ${sezione(0.7, "energia", "Energia")}
      ${sezione(0.8, "sicurezza", "Sicurezza")}
      ${sezione(0.9, "telecamere", "Telecamere")}
      ${sezione(1.0, "tapparelle", "Finestre")}
      ${sezione(1.1, "irrigazione", "Irrigazione")}
      ${sezione(1.2, "macchine", "Auto")}
    </div>
    <p class="sotto ap" style="--t:1.8s"><b>Ventitré sezioni</b>, e le stanze di casa tua.</p>
  </div>`,
);

/* ══ 3. Come si mette ══════════════════════════════════════════════════ */

scena(
  "come-si-mette",
  7,
  () => `
  <div class="colonna">
    <h1 class="titolo piccolo en" style="--t:.15s">Si mette in due mosse</h1>
    ${voce(0.6, "#38bdf8", "1", 'Un <b>add-on</b> nel negozio di Home&nbsp;Assistant<span class="quando">Si incolla un indirizzo, e compare</span>')}
    ${voce(1.0, "#38bdf8", "2", 'Un <b>QR code</b> da inquadrare col telefono<span class="quando">E la casa è nell\'app, anche da fuori</span>')}
    <p class="sotto ap" style="--t:1.9s">Nessuna password di Home Assistant.<br />Nessuna porta aperta sul router. <b>Nessuna VPN.</b></p>
  </div>`,
);

/* ══ 4. Tutto gratis ═══════════════════════════════════════════════════ */

scena(
  "tutto-gratis",
  7,
  () => `
  <div class="colonna">
    <p class="sotto ap" style="--t:.15s">E la parte che di solito non c'è:</p>
    <h1 class="enorme cr" style="--t:.45s">TUTTO GRATIS</h1>
    ${spunta(0.95, "L'add-on, la plancia e l'app")}
    ${spunta(1.15, "La casa da fuori, senza abbonamenti")}
    ${spunta(1.35, "Tutte le case e tutti i telefoni che vuoi")}
    <p class="sotto ap" style="--t:2.1s">Nessun account da fare. <b>Nessun limite a pagamento.</b></p>
  </div>`,
);

/* ══ 5. Il sostegno ════════════════════════════════════════════════════ */

scena(
  "il-sostegno",
  7.5,
  () => `
  <div class="colonna">
    <h1 class="titolo en" style="--t:.15s">E deve restare<br />gratis</h1>
    <p class="sotto ap" style="--t:.8s">Ma gratis non vuol dire che si mantenga da solo:<br />dietro c'è tempo, prove e assistenza.</p>
    <div class="vetro pastiglia cr" style="--t:1.5s;border-color:rgba(245,158,11,.45);color:#fcd34d">
      ${segno("cuore", 30, "#fb7185")} Sostieni il progetto su GitHub Sponsors
    </div>
    <p class="sotto ap" style="--t:2.3s"><b>Chi può, sostiene. Chi non può, lo usa lo stesso</b><br />— e resta gratis per tutti e due.</p>
  </div>`,
);

/* ══ 6. Da quando ══════════════════════════════════════════════════════ */

scena(
  "da-quando",
  7.5,
  () => `
  <div class="colonna">
    <h1 class="titolo piccolo en" style="--t:.15s">Da quando si usa</h1>
    ${voce(0.55, "#4ade80", segno("spunta", 30, "#4ade80"), "<b>Da subito</b><span class=\"quando\">L'add-on, la plancia, e l'app dal browser</span>")}
    ${voce(0.95, "#fbbf24", segno("calendario", 28, "#fbbf24"), '<b>Dal 30 settembre</b><span class="quando">L\'app per Android, negli store</span>')}
    ${voce(1.35, "#38bdf8", segno("attrezzi", 28, "#38bdf8"), '<b>In fase di sviluppo</b><span class="quando">La versione per iOS</span>')}
    <p class="sotto ap" style="--t:2.2s">Serve una casa con <b>Home Assistant</b>.</p>
  </div>`,
);

/* ══ 7. Chiusura ═══════════════════════════════════════════════════════ */

scena(
  "chiusura",
  5.5,
  () => `
  <div class="colonna">
    <img class="cr" src="${MARCHIO}" width="150" height="150" style="--t:.1s;border-radius:34px" alt="" />
    <h1 class="titolo en" style="--t:.4s">gdahome</h1>
    <div class="vetro ap" style="--t:.8s;padding:20px 30px;font-family:'DejaVu Sans Mono',monospace;font-size:27px;color:#e6f2ff;border-color:rgba(14,165,233,.4)">
      github.com/danigio15/gdahomeapp
    </div>
    <p class="sotto ap" style="--t:1.2s">Gratis, e con il codice aperto.<br /><b>Sostienilo su GitHub Sponsors.</b></p>
  </div>`,
);

mettiInScena(SCENE);
