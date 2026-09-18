#!/usr/bin/env node
/* Fotografare la plancia **vera**.
 *
 * Non una ricostruzione: la pagina di DashboardModern che sta in
 * `ponte/plancia/`, quella che l'add-on serve davvero, aperta in un Chromium e
 * fotografata. Dietro non c'e' una casa: c'e' `casa-finta.js`, che le risponde
 * come le risponderebbe Home Assistant.
 *
 * La pagina si serve come la serve il ponte — `conLePremesse()`, lo stesso
 * codice — cambiando una cosa sola: al posto del WebSocket verso la casa ci va
 * la casa finta. Cosi' quello che si fotografa e' la plancia come la vede chi
 * ce l'ha installata, e non una pagina preparata per la fotografia.
 *
 *   node strumenti/video/plancia-vera.mjs
 *   node strumenti/video/plancia-vera.mjs --lingua en
 *
 * Le fotografie finiscono in `plancia-<schermo>.png`, una per schermo, e in
 * inglese con `-en` in fondo: le copertine in inglese vogliono una plancia in
 * inglese, se no si legge «SICUREZZA» sotto un titolo che dice «All free».
 *
 * La lingua non la si finge: la plancia ha **una pagina per lingua**
 * (`dashboard.html`, `dashboard-en.html`) e a sceglierla e' la stessa funzione
 * del ponte, `paginaDellaLingua()`.
 */

import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { vestiDiGdahome } from "../../ponte/src/marchio.js";
import { conLePremesse, ilWebSocket, paginaDellaLingua } from "../../ponte/src/premesse.js";

/* Dove il ponte monta la plancia per il browser. */
const BASE = "/dashboardmodern_static";
const FUORI_DALL_IMPRONTA = new Set(["avatars", "brands"]);

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, "..", "..");
const PLANCIA = path.join(RADICE, "ponte", "plancia");

/* I tre schermi, alle misure **vere**: un telefono, un tablet e un computer.
 *
 * Non le misure che avranno nella copertina — li' sono francobolli. La plancia
 * e' responsiva: disegnata in 292 pixel di larghezza si dispone come si
 * disporrebbe su un orologio, con l'intestazione che si mangia mezzo schermo.
 * Si fotografa grande e la si guarda da lontano, come si fa con gli schermi
 * nelle copertine. */
const SCHERMI = {
  telefono: { largo: 390, alto: 844 },
  tablet: { largo: 820, alto: 1180 },
  computer: { largo: 1440, alto: 900 },
};

/* In che lingua si fotografa, e come si chiama quello che ne esce. */
const LINGUA = process.argv.includes("--lingua")
  ? process.argv[process.argv.indexOf("--lingua") + 1]
  : "it";
const conLaLingua = (nome) => (LINGUA === "it" ? nome : `${nome}-${LINGUA}`);

/* Il sottotitolo sotto il nome di casa: e' quello che si legge in cima alla
   plancia, quindi segue la lingua della plancia. */
const SOTTOTITOLO = LINGUA === "en" ? "Your home as one screen" : "La casa in una plancia";

async function apriPlaywright() {
  const dentro = (roba) => roba?.chromium ?? roba?.default?.chromium;
  try {
    const vicino = await import("playwright");
    if (dentro(vicino)) return dentro(vicino);
  } catch {
    /* si guarda fra i globali */
  }
  const globale = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  return dentro(await import(pathToFileURL(path.join(globale, "playwright", "index.js")).href));
}

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/* La pagina, servita come la serve il ponte ma con la casa finta al posto
   della casa. La riga che cambia e' una: il WebSocket. */
async function laPagina() {
  /* Quale delle pagine della plancia: la sceglie il ponte, con la sua regola. */
  const quale = paginaDellaLingua(await readdir(path.join(PLANCIA, "legacy")), LINGUA);
  const crudo = await readFile(path.join(PLANCIA, "legacy", quale));
  /* Vestita di gdahome, come la serve l'add-on: il logo, il velo d'avvio, il
     titolo. Senza, in cima alla plancia si legge il nome di prima — ed e' la
     prima cosa che si vede in una copertina. */
  const pagina = vestiDiGdahome(`legacy/${quale}`, crudo, "text/html").corpo.toString("utf8");
  const dove = "ws://127.0.0.1/non-ci-va-nessuno";
  const conLeSue = conLePremesse(pagina, {
    base: `${BASE}/finta/legacy/`,
    lingua: LINGUA,
    doveIlWebSocket: dove,
  });
  /* Si sostituisce **tutta** la funzione che il ponte scrive, chiedendogliela
     con lo stesso argomento: tagliarla con un'espressione regolare fino al
     primo punto e virgola la spezzava a meta' — dentro ce ne sono — e quello
     che restava era codice rotto con un `return` fuori da ogni funzione. */
  const suo = `window.__DASHBOARDMODERN_BRIDGE_WS__=${ilWebSocket(dove)};`;
  if (!conLeSue.includes(suo))
    throw new Error("le premesse del ponte sono cambiate: guarda ilWebSocket()");
  /* La casa finta si carica **prima** del preludio, che e' il primo codice
     della plancia a girare: quando lui guarda se c'e' un ponte, deve trovarlo
     gia' li'. */
  return conLeSue
    .replace(suo, "window.__DASHBOARDMODERN_BRIDGE_WS__=window.CasaFinta;")
    .replace("<base ", '<script src="/strumenti/video/casa-finta.js"></script><base ');
}

function servitore(pagina) {
  const server = createServer(async (domanda, risposta) => {
    const dove = new URL(domanda.url, "http://x").pathname;
    if (dove === "/plancia-vera") {
      risposta.writeHead(200, { "content-type": TIPI[".html"] });
      risposta.end(pagina);
      return;
    }
    /* `/dashboardmodern_static/<impronta>/<resto>` sono i file della plancia;
       `avatars/` e `brands/` stanno fuori dall'impronta, come nel ponte. */
    let file;
    if (dove.startsWith(`${BASE}/`)) {
      const pezzi = decodeURIComponent(dove)
        .slice(BASE.length + 1)
        .split("/");
      const resto = FUORI_DALL_IMPRONTA.has(pezzi[0]) ? pezzi : pezzi.slice(1);
      file = path.join(PLANCIA, ...resto);
    } else {
      file = path.join(RADICE, decodeURIComponent(dove));
    }
    if (!file.startsWith(RADICE)) {
      risposta.writeHead(403).end();
      return;
    }
    try {
      const crudo = await readFile(file);
      const tipo = TIPI[path.extname(file)] || "application/octet-stream";
      /* I file della plancia si servono vestiti, come li serve il ponte. */
      const dentro = file.startsWith(PLANCIA + path.sep)
        ? vestiDiGdahome(path.relative(PLANCIA, file).split(path.sep).join("/"), crudo, tipo)
        : { corpo: crudo, tipo };
      risposta.writeHead(200, { "content-type": dentro.tipo });
      risposta.end(dentro.corpo);
    } catch {
      /* Un file che manca si dice: in una pagina fatta di mille moduli, un
         404 zitto e' una cosa che non si vede e non si spiega. */
      if (!dove.endsWith("/favicon.ico")) console.log(`   404 ${dove}`);
      risposta.writeHead(404).end();
    }
  });
  return new Promise((pronto) => server.listen(0, "127.0.0.1", () => pronto(server)));
}

/* Il velo d'avvio se ne va quando la plancia e' pronta: e' lei a dire quando
   si puo' fotografare. */
function aspettaCheSiaPronta(pagina) {
  return pagina
    .waitForFunction(
      () => {
        const velo = document.getElementById("cd-boot-overlay");
        return !velo || velo.style.opacity === "0" || !velo.isConnected;
      },
      null,
      { timeout: 45000 },
    )
    .then(() => true)
    .catch(() => false);
}

/* La plancia si configura da sola, col suo tasto.
 *
 * E' il 🪄 che sta nella Config — `edAutoRileva` — quello che chi installa la
 * plancia preme il primo giorno: guarda le entita' della casa e le mette nei
 * posti giusti. Qui lo si preme per conto suo, cosi' quello che si fotografa
 * e' una plancia configurata **come la configurerebbe lei**, non una
 * configurazione scritta da noi per far bella figura nella fotografia.
 *
 * Alla fine la plancia si ricarica da sola: la configurazione se la ritrova
 * perche' la casa finta la tiene in `localStorage`. */
async function siConfiguraDaSola(pagina) {
  /* Se c'e' bisogno di configurarla lo dice **lei**: quando non e' configurata
     mette in mezzo alla pagina «La dashboard è quasi pronta» con il suo tasto.
     Guardare invece la busta non funzionava — la plancia ne salva una sua
     appena parte, e a quel punto sembrava gia' configurata quando non lo era:
     su uno schermo da computer e' andata cosi', e nella copertina c'e' finita
     una plancia vuota. */
  /* Il tasto compare un attimo dopo il velo, e su uno schermo grande un attimo
     piu' tardi che su uno piccolo: guardare una volta sola faceva passare per
     configurate due plance su tre. Si guarda per otto secondi. */
  const daFare = await pagina
    .waitForFunction(
      () =>
        [...document.querySelectorAll("button,a")].some((nodo) =>
          /configura la dashboard|set up the dashboard/i.test(nodo.textContent || ""),
        ),
      null,
      { timeout: 8000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!daFare) return true;

  /* Il 🪄 scrive dentro l'editor — `#ed-rileva-out` — e quell'elemento esiste
     solo a editor aperto. L'editor si apre dal tasto che la plancia stessa
     mette in mezzo alla pagina quando non e' ancora configurata: «Configura la
     dashboard». E' la strada di chi ha appena installato, ed e' la ragione per
     cui il primo tentativo non concludeva niente: si apriva la scheda Config,
     che e' un'altra cosa. */
  const passi = [];
  const apre = await pagina
    .evaluate(() => {
      const chi = [...document.querySelectorAll("button,a")].find((nodo) =>
        /configura la dashboard|set up the dashboard/i.test(nodo.textContent || ""),
      );
      if (!chi) return false;
      chi.click();
      return true;
    })
    .catch(() => false);
  passi.push(`editor:${apre}`);

  const acceso = await pagina
    .waitForFunction(
      () => typeof window.edAutoRileva === "function" && document.getElementById("ed-rileva-out"),
      null,
      { timeout: 25000 },
    )
    .then(() => true)
    .catch(() => false);
  passi.push(`rileva:${acceso}`);
  if (!acceso) {
    console.log(`   la plancia non si e' configurata (${passi.join(" ")})`);
    return false;
  }

  await pagina.evaluate(() => window.edAutoRileva());
  const tasto = await pagina.waitForSelector(".dm-ad-apply", { timeout: 40000 }).catch(() => null);
  passi.push(`applica:${Boolean(tasto)}`);
  if (!tasto) {
    console.log(`   la plancia non si e' configurata (${passi.join(" ")})`);
    return false;
  }
  await tasto.click();
  /* Applicare ricarica la pagina: si aspetta che torni su. */
  await pagina.waitForTimeout(4000);
  await aspettaCheSiaPronta(pagina);
  await pagina.waitForTimeout(1500);
  console.log(`   si e' configurata da sola (${passi.join(" ")})`);
  return true;
}

/* Il meteo, collegato a mano.
 *
 * Il 🪄 non lo rileva: i suoi posti — `dm.home_meteo`, e i tre numeri accanto —
 * vogliono un'entita' `weather.` e i sensori di fuori, e il rilevatore su
 * quelli non si sbilancia. Nella plancia vera li collega chi la configura, in
 * un minuto; qui si scrivono nella busta della casa finta, che e' lo stesso
 * posto dove li scriverebbe lei, e si ricarica.
 *
 * Senza, accanto al nome della casa resta una striscia vuota — ed e' meta'
 * dell'intestazione. */
async function collegaIlMeteo(pagina) {
  const POSTI = {
    "dm.home_meteo": "weather.casa",
    "dm.home_meteo_temperatura": "sensor.temperatura_esterna",
    "dm.home_meteo_percepita": "sensor.temperatura_esterna",
    "dm.home_meteo_umidita": "sensor.umidita_esterna",
    "dm.home_meteo_vento": "sensor.vento",
  };
  const fatto = await pagina.evaluate((posti) => {
    try {
      const chiave = "casa-finta-busta";
      const busta = JSON.parse(window.localStorage.getItem(chiave) || "null") || { values: {} };
      /* Si parte da quello che la plancia ha **adesso**, non da quello che c'e'
         nella busta: i posti che il 🪄 ha appena riempito stanno li'. Partendo
         dalla busta si riscriveva sopra al suo lavoro, e nella fotografia
         sparivano la sicurezza e l'antifurto. */
      const vivi = JSON.parse(window.localStorage.getItem("cd_entity_overrides") || "{}");
      const slot = Object.assign({}, vivi, JSON.parse(busta.values.cd_entity_overrides || "{}"));
      if (Object.keys(posti).every((quale) => slot[quale])) return false;
      Object.assign(slot, posti);
      window.localStorage.setItem("cd_entity_overrides", JSON.stringify(slot));
      busta.values.cd_entity_overrides = JSON.stringify(slot);
      busta.revision = (busta.revision || 0) + 1;
      busta.keys_revision = (busta.keys_revision || 0) + 1;
      busta.updated_at = Date.now();
      window.localStorage.setItem(chiave, JSON.stringify(busta));
      return true;
    } catch (_errore) {
      return false;
    }
  }, POSTI);
  if (!fatto) return false;
  await pagina.reload({ waitUntil: "load" });
  await aspettaCheSiaPronta(pagina);
  await pagina.waitForTimeout(2000);
  console.log("   il meteo e' collegato");
  return true;
}

async function main() {
  if (!existsSync(path.join(PLANCIA, "legacy", "dashboard.html"))) {
    throw new Error("la plancia non c'e' in ponte/plancia/: `strumenti/porta-la-plancia.mjs`");
  }
  await mkdir(path.join(QUI, "provini"), { recursive: true });
  const chromium = await apriPlaywright();
  const server = await servitore(await laPagina());
  const porta = server.address().port;
  /* Il browser: quello che Playwright si e' scaricato, o quello che gli si
   * indica. `CHROME_EXECUTABLE` e' la stessa variabile con cui il collaudo
   * trova il suo (`collaudo/guarda.mjs`): su una macchina dove i browser di
   * Playwright stanno altrove — un container con la cartella condivisa — senza
   * questa riga il programma si ferma dicendo «npx playwright install» su un
   * browser che c'e'. */
  const browser = await chromium.launch({
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
    args: ["--force-color-profile=srgb"],
  });

  for (const [nome, misura] of Object.entries(SCHERMI)) {
    const pagina = await browser.newPage({
      viewport: { width: misura.largo, height: misura.alto },
      deviceScaleFactor: 2,
    });
    /* Il nome in cima alla plancia.
     *
     * DashboardModern di suo si chiama «Smart Home», e chi la installa se la
     * rinomina dalla Config (`cd_branding`). In una copertina di gdahome il
     * nome di un altro sarebbe la prima cosa che si legge, quindi la casa
     * finta parte con quello gia' messo — come la casa di chiunque dopo il
     * primo giorno. */
    await pagina.addInitScript(
      ({ sottotitolo, lingua }) => {
        window.__CASA_FINTA_LINGUA__ = lingua;
        window.__CASA_FINTA_BUSTA__ = {
          revision: 1,
          updated_at: Date.now(),
          keys_revision: 1,
          writer_generation: 1,
          reset: false,
          values: {
            cd_branding: JSON.stringify({ title: "gdahome", subtitle: sottotitolo }),
            /* Le persone, con la faccia composta.
             *
             * Il 🪄 le entita' le trova, ma un **ritratto** non si rileva: e'
             * una fila di scelte che nella plancia vera fa chi la configura, una
             * persona per volta. Qui se ne mettono tre,
             * perche' una casa senza facce in copertina sembra una casa vuota.
             * Le facce le disegna il compositore della plancia, quello vero. */
            cd_people: JSON.stringify([
              {
                name: "Daniele",
                entity: "person.daniele",
                battery: "sensor.batteria_daniele",
                avatar: {
                  face: {
                    persona: "uomo",
                    capelli: "lisci",
                    coloreCapelli: "castano",
                    barba: "corta",
                    coloreBarba: "naturale",
                    occhi: "marrone",
                    carnagione: "chiara2",
                    vestito: "casual",
                    coloreVestito: "blu",
                    occhiali: "nessuno",
                    collana: "nessuna",
                  },
                },
              },
              {
                name: "Giulia",
                entity: "person.giulia",
                battery: "sensor.batteria_giulia",
                avatar: {
                  face: {
                    persona: "donna",
                    capelli: "lisci",
                    coloreCapelli: "castano",
                    barba: "nessuna",
                    occhi: "verde",
                    carnagione: "chiara",
                    vestito: "camicia",
                    coloreVestito: "verde",
                    occhiali: "nessuno",
                    collana: "catenina",
                  },
                },
              },
              {
                name: "Marco",
                entity: "person.marco",
                battery: "sensor.batteria_marco",
                avatar: {
                  face: {
                    persona: "ragazzo",
                    capelli: "ricci",
                    coloreCapelli: "castano",
                    barba: "nessuna",
                    occhi: "azzurro",
                    carnagione: "media",
                    vestito: "polo",
                    coloreVestito: "rosso",
                    occhiali: "tondi",
                    collana: "nessuna",
                  },
                },
              },
            ]),
          },
        };
      },
      { sottotitolo: SOTTOTITOLO, lingua: LINGUA },
    );

    const lamenti = [];
    pagina.on("pageerror", (guaio) => lamenti.push(String(guaio).slice(0, 160)));
    pagina.on("console", (riga) => {
      if (riga.type() === "error") lamenti.push(riga.text().slice(0, 160));
    });

    await pagina.goto(`http://127.0.0.1:${porta}/plancia-vera`, { waitUntil: "load" });
    await aspettaCheSiaPronta(pagina);
    await siConfiguraDaSola(pagina);
    await collegaIlMeteo(pagina);
    const pronta = await aspettaCheSiaPronta(pagina);
    await pagina.waitForTimeout(2500);
    /* Prima di scattare si ferma quello che si muove.
     *
     * La plancia ha in cima una striscia che scorre da sola — «1 varco aperto
     * · 3 luci accese · …» — e in una fotografia una striscia ferma a meta'
     * corsa sembra un pezzo tagliato via, non una cosa che scorre. Quelle
     * animazioni si annullano, e l'elemento torna dov'e' disegnato; le altre,
     * che hanno una fine, si portano alla fine — che e' lo stato in cui la
     * pagina vuole farsi vedere. */
    await pagina.evaluate(() => {
      for (const animazione of document.getAnimations()) {
        try {
          const tempi = animazione.effect?.getComputedTiming?.() || {};
          if (Number.isFinite(tempi.activeDuration)) animazione.finish();
          else animazione.cancel();
        } catch (_errore) {
          /* un'animazione che non si lascia fermare si lascia dov'e' */
        }
      }
      for (const nodo of document.querySelectorAll("*")) {
        if (nodo.scrollLeft) nodo.scrollLeft = 0;
      }
    });
    await pagina.waitForTimeout(600);

    const dove = path.join(QUI, `${conLaLingua(`plancia-${nome}`)}.png`);
    await pagina.screenshot({ path: dove });
    const chiesto = await pagina.evaluate(() => window.__CASA_FINTA_CHIESTO__ || []);
    if (process.env.SBIRCIA) {
      console.log(
        "   ",
        await pagina.evaluate(() => {
          const leggi = (chiave) => {
            try {
              return JSON.parse(window.localStorage.getItem(chiave) || "null");
            } catch (_errore) {
              return null;
            }
          };
          const slot = leggi("cd_entity_overrides") || {};
          return JSON.stringify({
            meteo: Object.keys(slot).filter((quale) => /meteo|weather/i.test(quale)),
            conMeteo: Object.entries(slot)
              .filter(([, valore]) => String(valore).startsWith("weather."))
              .map(([quale]) => quale),
            persone: (leggi("cd_people") || []).length,
            faccia: Boolean((leggi("cd_people") || [])[0]?.avatar?.face),
          });
        }),
      );
    }
    console.log(
      `📷 ${nome.padEnd(9)} ${misura.largo}×${misura.alto}  ${pronta ? "pronta" : "NON pronta"}  ${dove}`,
    );
    if (chiesto.length) console.log(`   ha chiesto: ${[...new Set(chiesto)].join(", ")}`);
    if (lamenti.length)
      console.log(`   si lamenta: ${[...new Set(lamenti)].slice(0, 4).join(" | ")}`);
    await pagina.close();
  }

  await browser.close();
  server.close();
}

main().catch((guaio) => {
  console.error("✖", guaio.message);
  process.exit(1);
});
