/* Porta il capitolo 27 del manuale dentro la plancia, come guida del Config.
 *
 *     node strumenti/guida-dal-manuale.mjs           riscrive i testi
 *     node strumenti/guida-dal-manuale.mjs --guarda  dice solo se sono indietro
 *
 * Il manuale d'uso (`docs/MANUALE.md`) spiega nel capitolo 27 come si
 * configura ogni scheda dell'editor della plancia. La guida che si apre dentro
 * il Config («📖 Come si configura questa scheda», vedi
 * `ponte/plancia/src/sections/guida-del-config-section.js`) dice le stesse
 * cose, e per non scriverle due volte le prende da lì: questo script legge il
 * capitolo e scrive `ponte/plancia/src/core/guida-del-config-testi.js`.
 *
 * Cosa si aspetta dal manuale, scheda per scheda:
 *
 *     ### 27.N Nome della scheda (famiglia)
 *     <!-- scheda: sez1 -->            ← la linguetta del Config
 *     **A cosa serve.** Una o due frasi.
 *     **Cosa trovi** … un elenco puntato
 *     **Come si configura** … uno o più elenchi numerati, con un titoletto in
 *         grassetto davanti a ogni procedura se sono più d'una
 *     **Consigli** … un elenco puntato (facoltativo)
 *
 * Le etichette fra «virgolette basse» restano tali e quali: sono quelle che
 * «Mostrami» va a cercare sullo schermo.
 *
 * Dopo averlo fatto girare, come per ogni cambio della plancia:
 *
 *     node strumenti/impacchetta-la-plancia.mjs
 *     node strumenti/sigilla-la-plancia.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANUALE = join(RADICE, "docs", "MANUALE.md");
const USCITA = join(RADICE, "ponte", "plancia", "src", "core", "guida-del-config-testi.js");

const esc = (testo) =>
  String(testo)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/* Il poco di Markdown che si usa nel capitolo, in HTML sicuro: prima si
 * protegge tutto, poi si rimettono grassetto, codice e collegamenti (di cui si
 * tiene solo il testo: dentro il Config un collegamento al manuale porta
 * fuori dalla casa). */
export function inLinea(testo) {
  return esc(testo)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/* Il testo semplice di un passo, per cercare le etichette sullo schermo. */
const semplice = (testo) =>
  String(testo)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();

/* Gli elementi di un elenco, con le righe che continuano quello di prima. */
function elementi(righe, numerato) {
  const fuori = [];
  const inizio = numerato ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*]\s+(.*)$/;
  for (const riga of righe) {
    const trovato = inizio.exec(riga);
    if (trovato && !/^\s{4,}/.test(riga)) fuori.push(trovato[1].trim());
    else if (fuori.length && riga.trim())
      fuori[fuori.length - 1] += ` ${riga.trim().replace(/^[-*]\s+/, "– ")}`;
  }
  return fuori;
}

/** Un capitolo, sezione per sezione: il 27 (le schede del Config, segnate
 * `<!-- scheda: … -->`) o il 28 (i passi della Casa 3D, `<!-- passo3d: … -->`). */
export function leGuide(manuale, { capitolo: numero = "27", segno = "scheda" } = {}) {
  const capitolo = manuale.split(new RegExp(`^## ${numero}\\. `, "m"))[1];
  if (!capitolo) throw new Error(`nel manuale non c'e' il capitolo ${numero}`);
  const finito = capitolo.split(/^## \d+\. /m)[0];
  const guide = {};
  for (const intero of finito.split(new RegExp(`^### ${numero}\\.\\d+ `, "m")).slice(1)) {
    /* La sezione finisce al titolo dopo, anche se non e' numerato («Usare la
     * casa in 3D»): quello che c'e' sotto non e' piu' di questa scheda. */
    const pezzo = intero.split(/^### /m)[0];
    const righe = pezzo.split("\n");
    const titolo = righe[0].replace(/\s*\([^)]*\)\s*$/, "").trim();
    const scheda = new RegExp(`<!--\\s*${segno}:\\s*([\\w-]+)\\s*-->`).exec(pezzo)?.[1];
    /* Senza linguetta (la 27.0, che spiega la guida stessa) non c'e' niente
     * da portare nel Config. */
    if (!scheda) continue;
    /* I blocchi, divisi dalle intestazioni in grassetto. */
    const blocchi = { scopo: [], campi: [], passi: [], consigli: [] };
    let dove = null;
    for (const riga of righe.slice(1)) {
      const testa =
        /^\*\*(A cosa serve\.?|Cosa trovi|Come si configura|Consigli)\*\*\.?\s*(?:[—–-]\s*)?(.*)$/.exec(
          riga.trim(),
        );
      if (testa) {
        dove = {
          "A cosa serve.": "scopo",
          "A cosa serve": "scopo",
          "Cosa trovi": "campi",
          "Come si configura": "passi",
          Consigli: "consigli",
        }[testa[1]];
        if (testa[2] && dove === "scopo") blocchi.scopo.push(testa[2]);
        continue;
      }
      if (/^<p|^<img|^###/.test(riga.trim())) continue;
      if (dove) blocchi[dove].push(riga);
    }
    /* I passi: gli elenchi numerati, con il titoletto della procedura davanti
     * al primo passo di ognuna. */
    const passi = [];
    let titoletto = "";
    let gruppo = [];
    const chiudiGruppo = () => {
      elementi(gruppo, true).forEach((uno, i) => {
        const davanti = i === 0 && titoletto ? `${titoletto}: ` : "";
        passi.push({
          testo: semplice(davanti + uno),
          html: (davanti ? `<b>${inLinea(titoletto)}</b>: ` : "") + inLinea(uno),
        });
      });
      gruppo = [];
    };
    for (const riga of blocchi.passi) {
      const tit = /^\*\*([^*]+)\*\*\s*$/.exec(riga.trim());
      if (tit) {
        chiudiGruppo();
        titoletto = tit[1].replace(/[.:]$/, "");
        continue;
      }
      gruppo.push(riga);
    }
    chiudiGruppo();
    guide[scheda] = {
      titolo,
      scopo: inLinea(blocchi.scopo.join(" ").replace(/\s+/g, " ").trim()),
      campi: elementi(blocchi.campi, false).map(inLinea),
      passi,
      consigli: elementi(blocchi.consigli, false).map(inLinea),
    };
  }
  return guide;
}

/** Le guide del Config (capitolo 27) e della Casa 3D (capitolo 28). */
export function tutteLeGuide(manuale) {
  return {
    guide: leGuide(manuale),
    guide3d: leGuide(manuale, { capitolo: "28", segno: "passo3d" }),
  };
}

export function ilFile({ guide, guide3d }) {
  return `/* GENERATO da strumenti/guida-dal-manuale.mjs dai capitoli 27 e 28 di
 * docs/MANUALE.md: non si scrive a mano. Si cambia il manuale e si rifà
 * girare lo script. Vedi core/guida-del-config.js. */

/* Le schede dell'editor del Config, per linguetta (capitolo 27). */
export const GUIDE = Object.freeze(${JSON.stringify(guide, null, 2)});

/* I passi di «Crea la tua casa», la procedura della Casa 3D (capitolo 28). */
export const GUIDE_3D = Object.freeze(${JSON.stringify(guide3d, null, 2)});
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const tutte = tutteLeGuide(readFileSync(MANUALE, "utf8"));
  const nuovo = ilFile(tutte);
  let vecchio = "";
  try {
    vecchio = readFileSync(USCITA, "utf8");
  } catch (_errore) {
    /* La prima volta non c'e'. */
  }
  if (process.argv.includes("--guarda")) {
    if (vecchio !== nuovo) {
      process.stderr.write(
        "La guida del Config e' indietro rispetto al manuale: node strumenti/guida-dal-manuale.mjs\n",
      );
      process.exit(1);
    }
    process.stdout.write("La guida del Config e' allineata al manuale.\n");
  } else {
    writeFileSync(USCITA, nuovo);
    process.stdout.write(
      `Scritte ${Object.keys(tutte.guide).length} guide del Config e ${Object.keys(tutte.guide3d).length} della Casa 3D in ${USCITA}\n`,
    );
  }
}
