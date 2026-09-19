#!/usr/bin/env node
/* Il quadro vero, fotografato.
 *
 *   node strumenti/video/quadro-vero.mjs
 *
 * Ne escono le quattro fotografie che il film del quadro monta dentro lo
 * schermo del computer: l'elenco delle case, la scheda di una casa aperta,
 * la schermata degli aggiornamenti e quella dell'abbinamento.
 *
 * **Non sono ricostruzioni.** E' `quadro/console/index.html` — la pagina che
 * un installatore apre davvero — servita dal quadro vero, che qui si accende
 * su una porta a caso con i suoi archivi in una cartella temporanea. Un
 * cruscotto disegnato a mano per il video sarebbe l'unica cosa del filmato che
 * non viene da qui dentro, e il giorno che la pagina cambia resterebbe indietro
 * senza che nessuno se ne accorga.
 *
 * Quello che e' finto e' **la flotta**: quattordici case inventate
 * (`flotta-finta.js`) che depositano un rapporto come lo deposita una casa
 * vera — `POST /rapporto`, con la chiave che le e' stata data e la sua
 * matricola in testa. Il quadro non sa che sono finte, e infatti le giudica
 * lui: gli stati, i dieci controlli e le pastiglie che si vedono nelle
 * fotografie li calcola `quadro/src/controlli.js`, non questo file.
 *
 * L'unica cosa che si scrive da dietro e' **il passato**: da quanti giorni una
 * casa e' installata e quanti rapporti ha mandato ogni giorno. Non c'e' altro
 * modo — per averlo davvero ci vorrebbero quattordici giorni — e senza, la
 * striscia dei quattordici giorni sarebbe vuota in tutte e quattordici le
 * case.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { alzaIlQuadro } from "../../quadro/src/index.js";
import { FLOTTA, INVITI, INSTALLATORE } from "./flotta-finta.js";

const QUI = path.dirname(fileURLToPath(import.meta.url));
const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore-del-video";
const GIORNO = 24 * 60 * 60 * 1000;

/* Lo schermo: le stesse proporzioni della cornice del computer in `pezzi.js`
   (700×438). Una fotografia dentro una cornice di un'altra forma o si stira o
   si taglia, e tagliare qui vuol dire perdere l'elenco delle case. */
const SCHERMO = { width: 1440, height: 900 };

const detto = (...cose) => console.log(...cose);

/* Playwright sta di fianco al progetto o fra i globali: la stessa ricerca di
   `rendi.mjs`, perche' chi ha uno ha anche l'altro. */
async function apriPlaywright() {
  const dentro = (roba) => roba?.chromium ?? roba?.default?.chromium;
  try {
    const vicino = await import("playwright");
    if (dentro(vicino)) return dentro(vicino);
  } catch {
    /* niente di fianco al progetto: si guarda fra i globali */
  }
  const globale = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  const dove = path.join(globale, "playwright", "index.js");
  if (!existsSync(dove)) {
    throw new Error("Playwright non c'e': `npm i -D playwright`, oppure `npm i -g playwright`.");
  }
  const lontano = dentro(await import(pathToFileURL(dove).href));
  if (!lontano) throw new Error("Playwright c'e' ma non da' chromium: versione strana?");
  return lontano;
}

/* ── La flotta, depositata ─────────────────────────────────────────────── */

/** Il giorno di un momento, come lo scrive il quadro nei suoi archivi. */
const ilGiorno = (quando) => new Date(quando).toISOString().slice(0, 10);

/**
 * Il passato di una casa: da quando e' installata, e quanti rapporti ha
 * mandato ogni giorno.
 *
 * Si scrive **sui dati del quadro**, non attraverso una sua via: una via per
 * riscrivere il passato non esiste, e non deve esistere. Qui si puo' perche'
 * questo programma e' il quadro: lo ha acceso lui, e la cartella e' sua.
 */
function scriviIlPassato(quadro, una, come, ora) {
  const dentro = quadro.case.quella(una.matricola);
  if (!dentro) throw new Error(`la casa ${una.matricola} non e' entrata`);
  dentro.da = ora - come.da * GIORNO;
  dentro.vistaIl = ora - come.taceDa * 60 * 1000;
  dentro.giorni = {};
  /* Quanti ne manda una casa in un giorno intero: uno ogni quindici minuti. */
  const alGiorno = Math.round(GIORNO / (come.rapporto.ogni * 60 * 1000));
  for (let i = 0; i < 14; i += 1) {
    const quando = ora - i * GIORNO;
    if (quando < dentro.da) continue;
    /* Il giorno in corso e' cominciato stamattina: chiedergli ventiquattro ore
       di rapporti lo farebbe uscire a meta' anche in una casa perfetta. */
    const passato = i === 0 ? (ora - Date.parse(`${ilGiorno(ora)}T00:00:00Z`)) / GIORNO : 1;
    const buco = come.buchi.find((uno) => uno.giorniFa === i);
    const quanto = Math.max(0, passato - (buco?.quanto ?? 0));
    dentro.giorni[ilGiorno(quando)] = Math.round(alGiorno * quanto);
  }
  /* Una casa offline non ha mandato niente da quando tace: i giorni in mezzo
     restano come li ha scritti il buco, e l'ultimo rapporto e' vecchio. */
  quadro.case.archivio.salva();
}

/** Accende il quadro, ci mette dentro un installatore e la sua flotta. */
async function ilQuadroConLaFlotta() {
  const cartella = await mkdtemp(path.join(tmpdir(), "quadro-del-video-"));
  const quadro = await alzaIlQuadro({
    porta: 0,
    cartella,
    livello: "errore",
    chiaveDelGestore: CHIAVE_DEL_GESTORE,
  });
  const dove = `http://127.0.0.1:${quadro.porta}`;

  const iscritto = await (
    await fetch(`${dove}/gestore/installatori`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${CHIAVE_DEL_GESTORE}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(INSTALLATORE),
    })
  ).json();
  const sua = iscritto.chiave;
  if (!sua) throw new Error(`l'installatore non e' entrato: ${JSON.stringify(iscritto)}`);

  const console_ = (via, opzioni = {}) =>
    fetch(`${dove}/console${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${sua}`,
        "content-type": "application/json",
        ...(opzioni.headers || {}),
      },
    });

  const ora = Date.now();
  for (const una of FLOTTA) {
    /* Come entra una casa vera: un codice che vive un giorno, incollato nella
       casella dell'add-on. Il primo rapporto lo lega a quella matricola. */
    const { codice } = await (await console_("/inviti", { method: "POST" })).json();
    const presa = await fetch(`${dove}/rapporto`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${codice}`,
        "content-type": "application/json",
        "x-casa": una.matricola,
      },
      body: JSON.stringify({
        ...una.rapporto,
        quando: new Date(ora - una.taceDa * 60 * 1000).toISOString(),
      }),
    });
    if (!presa.ok) throw new Error(`${una.nome}: il rapporto non e' stato preso (${presa.status})`);
    await console_(`/casa/${una.matricola}`, {
      method: "PUT",
      body: JSON.stringify({ nome: una.nome }),
    });
    scriviIlPassato(quadro, una, una, ora);
  }

  /* I codici fatti e non ancora incollati: si vedono nella pagina «Abbina». */
  for (const per of INVITI) {
    await console_("/inviti", { method: "POST", body: JSON.stringify({ per }) });
  }

  detto(
    `   · ${FLOTTA.length} case, ${INVITI.length} codici in attesa, soglia ${INSTALLATORE.soglia}`,
  );
  return { quadro, dove, sua, cartella };
}

/* ── Le fotografie ─────────────────────────────────────────────────────── */

async function fotografa() {
  detto("🔌 il quadro si accende, con la flotta finta dentro");
  const { quadro, dove, sua, cartella } = await ilQuadroConLaFlotta();
  const chromium = await apriPlaywright();
  const browser = await chromium.launch();

  try {
    const pagina = await browser.newPage({ viewport: SCHERMO, deviceScaleFactor: 2 });
    /* La chiave sta nel browser, come per chi apre il quadro tutti i giorni:
       cosi' la pagina si apre gia' dentro e non sulla richiesta della chiave. */
    await pagina.addInitScript((chiave) => {
      localStorage.setItem("gdahome.quadro.chiave", chiave);
    }, sua);
    await pagina.goto(`${dove}/console/`, { waitUntil: "networkidle" });
    await pagina.waitForSelector(".fila", { timeout: 15000 });
    await pagina.evaluate(() => document.fonts.ready);

    const scatta = async (nome) => {
      await pagina.screenshot({ path: path.join(QUI, `${nome}.png`) });
      detto(`   · ${nome}.png`);
    };

    /* 1. L'elenco, con aperta la casa che ha addosso qualcosa da guardare:
          una casa tutta verde non fa vedere a cosa serve il quadro. */
    await pagina.getByRole("button", { name: /Bianchi/ }).click();
    await pagina.waitForTimeout(200);
    await scatta("quadro-elenco");

    /* 2. I dieci controlli, che sono la risposta alla domanda del quadro.
          Stanno nel primo capitolo, sotto l'intestazione della casa. */
    await pagina.evaluate(() => {
      const controlli = [...document.querySelectorAll("h3")].find((uno) =>
        uno.textContent.trim().startsWith("I controlli"),
      );
      controlli?.closest("section")?.scrollIntoView({ block: "start" });
      window.scrollBy(0, -80);
    });
    await pagina.waitForTimeout(200);
    await scatta("quadro-controlli");

    /* 3. La stessa casa, piu' giu': la macchina, la rete, gli add-on. */
    await pagina.evaluate(() => {
      const capitolo = [...document.querySelectorAll("h2")].find((uno) =>
        uno.textContent.includes("Come sta"),
      );
      capitolo?.scrollIntoView({ block: "start" });
      /* Un filo piu' su: la testata sta ferma in cima, e un titolo che le
         finisce sotto in una fotografia sembra tagliato via. */
      window.scrollBy(0, -80);
    });
    await pagina.waitForTimeout(200);
    await scatta("quadro-come-sta");

    /* 4. I dispositivi che non rispondono, **coi loro nomi**. E' la riga in
          cui il quadro concede di piu', ed e' una scelta: quattro cifre di
          impronta chiedevano a chi ripara di uscire di casa e scoprire sul
          posto cos'era «#7c2a». */
    await pagina.evaluate(() => {
      const quelli = [...document.querySelectorAll("h3")].find((uno) =>
        uno.textContent.includes("dispositivi non collegati"),
      );
      quelli?.closest("section")?.scrollIntoView({ block: "start" });
      window.scrollBy(0, -80);
    });
    await pagina.waitForTimeout(200);
    await scatta("quadro-dispositivi");

    /* 5. La flotta: chi e' indietro, raggruppato per quello che c'e' da
          installare invece che per dove sta. */
    await pagina.getByRole("button", { name: /^Aggiornamenti/ }).click();
    await pagina.waitForTimeout(300);
    await scatta("quadro-aggiornamenti");

    /* 6. L'abbinamento: un codice che vive un giorno. */
    await pagina.getByRole("button", { name: /^Abbina/ }).click();
    await pagina.waitForTimeout(300);
    await scatta("quadro-abbina");
  } finally {
    await browser.close();
    await quadro.spegni();
    await rm(cartella, { recursive: true, force: true });
  }
}

await fotografa();
detto("✔ fatte");
