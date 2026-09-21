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

import { MARCHIO, mettiInScena, oggetto, plancia, segno, t, telefono } from "./pezzi.js";

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
    <h1 class="titolo en" style="--t:.45s">${t("La tua casa,<br />in una schermata", "Your home,<br />in one screen")}</h1>
    ${telefono({ scala: 0.82, classe: "cr", stile: "--t:.85s", dentro: plancia({ accende: 3.6 }) })}
    <p class="sotto ap" style="--t:1.5s">${t("Luci, clima, energia, tapparelle, telecamere.<br /><b>Si tocca, e in casa succede.</b>", "Lights, climate, energy, blinds, cameras.<br /><b>Touch it, and it happens at home.</b>")}</p>
  </div>`,
);

/* ══ 2. Cosa c'è dentro ════════════════════════════════════════════════ */

scena(
  "cosa-c-e-dentro",
  6,
  () => `
  <div class="colonna">
    <h1 class="titolo piccolo en" style="--t:.15s">${t("Tutto quello che hai in casa,<br />già pronto", "Everything you have at home,<br />already there")}</h1>
    <div class="sezioni">
      ${sezione(0.5, "luci", t("Luci", "Lights"))}
      ${sezione(0.6, "clima", t("Clima", "Climate"))}
      ${sezione(0.7, "energia", t("Energia", "Energy"))}
      ${sezione(0.8, "sicurezza", t("Sicurezza", "Security"))}
      ${sezione(0.9, "telecamere", t("Telecamere", "Cameras"))}
      ${sezione(1.0, "tapparelle", t("Finestre", "Windows"))}
      ${sezione(1.1, "irrigazione", t("Irrigazione", "Irrigation"))}
      ${sezione(1.2, "macchine", t("Auto", "Cars"))}
    </div>
    <p class="sotto ap" style="--t:1.8s">${t("<b>Ventitré sezioni</b>, e le stanze di casa tua.", "<b>Twenty-three sections</b>, and the rooms of your own home.")}</p>
  </div>`,
);

/* ══ 3. Come si mette ══════════════════════════════════════════════════ */

scena(
  "come-si-mette",
  7,
  () => `
  <div class="colonna">
    <h1 class="titolo piccolo en" style="--t:.15s">${t("Si mette in due mosse", "Two moves to set it up")}</h1>
    ${voce(
      0.6,
      "#38bdf8",
      "1",
      t(
        'Un <b>add-on</b> nel negozio di Home&nbsp;Assistant<span class="quando">Si incolla un indirizzo, e compare</span>',
        'An <b>add-on</b> in the Home&nbsp;Assistant store<span class="quando">Paste one address, and it shows up</span>',
      ),
    )}
    ${voce(
      1.0,
      "#38bdf8",
      "2",
      t(
        'Un <b>QR code</b> da inquadrare col telefono<span class="quando">E la casa è nell\'app, anche da fuori</span>',
        'A <b>QR code</b> to scan with your phone<span class="quando">And your home is in the app, away too</span>',
      ),
    )}
    <p class="sotto ap" style="--t:1.9s">${t("Nessuna password di Home Assistant.<br />Nessuna porta aperta sul router. <b>Nessuna VPN.</b>", "No Home Assistant password.<br />No ports opened on your router. <b>No VPN.</b>")}</p>
  </div>`,
);

/* ══ 4. Tutto gratis ═══════════════════════════════════════════════════ */

scena(
  "tutto-gratis",
  7,
  () => `
  <div class="colonna">
    <p class="sotto ap" style="--t:.15s">${t("E la parte che di solito non c'è:", "And the part that usually isn't there:")}</p>
    <h1 class="enorme cr" style="--t:.45s">${t("TUTTO GRATIS", "ALL FREE")}</h1>
    ${spunta(0.95, t("L'add-on, la plancia e l'app", "The add-on, the dashboard and the app"))}
    ${spunta(1.15, t("La casa da fuori, senza abbonamenti", "Your home from away, no subscription"))}
    ${spunta(1.35, t("Tutte le case e tutti i telefoni che vuoi", "As many homes and phones as you like"))}
    <p class="sotto ap" style="--t:2.1s">${t("Nessun account da fare. <b>Nessun limite a pagamento.</b>", "No account to create. <b>No paywalled limits.</b>")}</p>
  </div>`,
);

/* ══ 5. Il sostegno ════════════════════════════════════════════════════ */

scena(
  "il-sostegno",
  7.5,
  () => `
  <div class="colonna">
    <h1 class="titolo en" style="--t:.15s">${t("Gratis non vuol dire<br />finito", "Free doesn't mean<br />finished")}</h1>
    <p class="sotto ap" style="--t:.8s">${t("Aiutanti, Zigbee, automazioni: <b>il piano c'è</b>.<br />E ogni sostegno è una sua riga che diventa vera.", "Helpers, Zigbee, automations: <b>the plan is there</b>.<br />And every sponsorship is one of its lines coming true.")}</p>
    <div class="vetro pastiglia cr" style="--t:1.5s;border-color:rgba(245,158,11,.45);color:#fcd34d">
      ${segno("cuore", 30, "#fb7185")} ${t("Sostieni il progetto su GitHub Sponsors", "Support the project on GitHub Sponsors")}
    </div>
    <p class="sotto ap" style="--t:2.3s">${t("<b>Chi può, sostiene. Chi non può, lo usa lo stesso</b><br />— e resta gratis per tutti e due.", "<b>Those who can, chip in. Those who can't, use it all the same</b><br />— and it stays free for both.")}</p>
  </div>`,
);

/* ══ 6. Da quando ══════════════════════════════════════════════════════ */

scena(
  "da-quando",
  7.5,
  () => `
  <div class="colonna">
    <h1 class="titolo piccolo en" style="--t:.15s">${t("Da quando si usa", "From when")}</h1>
    ${voce(
      0.55,
      "#4ade80",
      segno("spunta", 30, "#4ade80"),
      t(
        "<b>Da subito</b><span class=\"quando\">L'add-on, la plancia, e l'app dal browser</span>",
        '<b>Right now</b><span class="quando">The add-on, the dashboard, and the app in the browser</span>',
      ),
    )}
    ${voce(
      0.95,
      "#fbbf24",
      segno("calendario", 28, "#fbbf24"),
      t(
        '<b>Dal 30 settembre</b><span class="quando">L\'app per Android, su Google Play</span>',
        '<b>From 30 September</b><span class="quando">The Android app, on Google Play</span>',
      ),
    )}
    ${voce(
      1.35,
      "#38bdf8",
      segno("attrezzi", 28, "#38bdf8"),
      t(
        '<b>In fase di sviluppo</b><span class="quando">La versione per iOS</span>',
        '<b>In development</b><span class="quando">The iOS version</span>',
      ),
    )}
    <p class="sotto ap" style="--t:2.2s">${t("Serve una casa con <b>Home Assistant</b>.", "You need a home running <b>Home Assistant</b>.")}</p>
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
    <p class="sotto ap" style="--t:1.2s">${t("Gratis, e con il codice aperto.<br /><b>Sostienilo su GitHub Sponsors.</b>", "Free, and open source.<br /><b>Support it on GitHub Sponsors.</b>")}</p>
  </div>`,
);

mettiInScena(SCENE);
