#!/usr/bin/env node
/* Le licenze sulla macchina del quadro: la chiave privata e le credenziali
 * dei negozi, scritte in `/etc/quadro/ambiente` nella forma che vuole systemd.
 *
 * Si lancia da root, sulla macchina del quadro, dove questa cartella sta in
 * `/opt/quadro/quadro`:
 *
 *   node le-licenze.mjs                       com'e' messo: cosa c'e', cosa manca
 *   node le-licenze.mjs chiave                fa la coppia, se non c'e', e dice la pubblica
 *   node le-licenze.mjs google <file.json>    il service account di Google Play
 *   node le-licenze.mjs apple <file.p8> <key id> <issuer id>
 *
 * **Non stampa mai un segreto.** Della chiave dice solo la pubblica, che e'
 * fatta per girare: e' quella da scrivere nell'add-on e nell'app
 * (`docs/ACCENDERE-GLI-ACQUISTI.md`). Delle credenziali dice solo di chi sono.
 *
 * **E non cambia niente che ci sia gia'.** Una chiave delle licenze gia'
 * scritta ha firmato i gettoni in giro: rifarla toglierebbe Premium a tutti
 * quelli che hanno pagato. Se c'e', la si rilegge e se ne ridice la pubblica —
 * e' anche il modo di ritrovarla. Le credenziali dei negozi si sostituiscono
 * solo chiedendolo (`--sostituisci`), per quando scadono.
 *
 * Perche' uno strumento e non tre righe da scrivere a mano: il service
 * account e' un JSON con dentro dei «\n», e systemd un «\n» fuori dagli
 * apici singoli se lo mangia. La chiave di Google arriverebbe storta, e il
 * quadro risponderebbe 503 a ogni acquisto senza dire perche'.
 *
 * Dopo, il quadro si riavvia (`systemctl restart quadro`) e nel suo registro
 * si guarda che dica «le licenze sono accese».
 */

import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chiavePrivataDa, laPubblicaDi } from "./src/licenze.js";
import { Negozi } from "./src/negozi.js";

const AMBIENTE_DI_SERIE = "/etc/quadro/ambiente";

const COSA_FA = `Le licenze sulla macchina del quadro.

  node le-licenze.mjs                       com'e' messo: cosa c'e', cosa manca
  node le-licenze.mjs chiave                fa la coppia, se non c'e', e dice la pubblica
  node le-licenze.mjs google <file.json>    il service account di Google Play
  node le-licenze.mjs apple <file.p8> <key id> <issuer id>

  --sostituisci   per google e apple: cambia le credenziali che ci sono gia'
  --ambiente F    un altro file al posto di ${AMBIENTE_DI_SERIE}
`;

class No extends Error {}

/* ─── Il file dell'ambiente ─────────────────────────────────────────────── */

/* Il valore di una riga `NOME=valore`, come lo legge systemd: fra apici
 * singoli tutto e' com'e' scritto, fuori la barra rovescia toglie se stessa.
 * Basta per le righe che scrive questo strumento e per quelle di accendi.sh. */
function ilValore(scritto) {
  let fuori = "";
  for (let i = 0; i < scritto.length; i += 1) {
    const c = scritto[i];
    if (c === "'") {
      const fine = scritto.indexOf("'", i + 1);
      if (fine < 0) return fuori + scritto.slice(i + 1);
      fuori += scritto.slice(i + 1, fine);
      i = fine;
    } else if (c === "\\" && i + 1 < scritto.length) {
      fuori += scritto[i + 1];
      i += 1;
    } else {
      fuori += c;
    }
  }
  return fuori.trim();
}

function leggi(file) {
  if (!existsSync(file)) {
    throw new No(
      `Non trovo ${file}: su questa macchina il quadro non e' installato, o lo e' altrove.\n` +
        "Si installa con quadro/accendi.sh, e poi si torna qui.",
    );
  }
  const righe = readFileSync(file, "utf8").split("\n");
  if (righe.at(-1) === "") righe.pop();
  return righe;
}

const valoreDi = (righe, nome) => {
  const riga = righe.find((una) => una.startsWith(`${nome}=`));
  return riga === undefined ? null : ilValore(riga.slice(nome.length + 1));
};

/* Scrive le righe nuove al posto delle vecchie con lo stesso nome, o in
 * fondo. Prima in un file accanto e poi al suo posto: un file a meta' qui
 * vorrebbe dire un quadro che non riparte. */
function scrivi(file, righe, nuove) {
  const fatte = [...righe];
  for (const [nome, valore] of nuove) {
    const riga = `${nome}=${valore}`;
    const dove = fatte.findIndex((una) => una.startsWith(`${nome}=`));
    if (dove >= 0) fatte[dove] = riga;
    else fatte.push(riga);
  }
  const accanto = `${file}.nuovo`;
  writeFileSync(accanto, `${fatte.join("\n")}\n`, { mode: 0o600 });
  chmodSync(accanto, 0o600);
  renameSync(accanto, file);
}

/* Fra apici singoli systemd non tocca niente: ne' le barre, ne' i «\n». */
function fraApici(valore) {
  if (valore.includes("'") || /[\r\n]/.test(valore)) {
    throw new No("dentro ci sono apici o righe a capo: cosi' systemd non lo legge intero");
  }
  return `'${valore}'`;
}

/* ─── La chiave delle licenze ───────────────────────────────────────────── */

function laChiave(file) {
  const righe = leggi(file);
  const gia = valoreDi(righe, "QUADRO_LICENZE_CHIAVE");
  if (gia !== null && gia !== "") {
    const privata = chiavePrivataDa(gia);
    if (!privata) {
      throw new No(
        "In " +
          file +
          " c'e' gia' una QUADRO_LICENZE_CHIAVE, ma non e' una chiave Ed25519 buona.\n" +
          "Non la tocco: se ha firmato dei gettoni, cambiarla toglie Premium a chi ha pagato.\n" +
          "Guarda la riga a mano.",
      );
    }
    return [
      "La chiave delle licenze c'era gia': non l'ho cambiata.",
      "",
      `La pubblica: ${laPubblicaDi(privata)}`,
    ];
  }
  const d = generateKeyPairSync("ed25519").privateKey.export({ format: "jwk" }).d;
  scrivi(file, righe, [["QUADRO_LICENZE_CHIAVE", d]]);
  return [
    `Fatta la chiave delle licenze: la privata e' in ${file}, e solo li'.`,
    "",
    `La pubblica: ${laPubblicaDi(chiavePrivataDa(d))}`,
    "",
    "La pubblica e' quella da mandare: va nell'add-on e nell'app. La privata non",
    "si copia da nessuna parte. Adesso riavvia il quadro:",
    "",
    "  systemctl restart quadro",
  ];
}

/* ─── Google Play ───────────────────────────────────────────────────────── */

function google(file, [percorso], sostituisci) {
  if (!percorso) throw new No("Manca il file: node le-licenze.mjs google <file.json>");
  const righe = leggi(file);
  if (valoreDi(righe, "QUADRO_GOOGLE_SERVICE_ACCOUNT") && !sostituisci) {
    throw new No("Il service account di Google c'e' gia'. Per cambiarlo: aggiungi --sostituisci.");
  }
  let conto;
  try {
    conto = JSON.parse(readFileSync(percorso, "utf8"));
  } catch (_errore) {
    throw new No(`${percorso} non si legge come JSON: e' il file scaricato da Google Cloud?`);
  }
  if (conto?.type !== "service_account" || !conto.client_email || !conto.private_key) {
    throw new No(
      `${percorso} non e' la chiave di un service account (ci vogliono type, client_email e private_key).`,
    );
  }
  try {
    createPrivateKey(conto.private_key);
  } catch (_errore) {
    throw new No(`La private_key di ${percorso} non e' una chiave che si legge.`);
  }
  const valore = JSON.stringify(conto);
  /* Riletta come la rilegge il quadro: se non la prende lui, non si scrive. */
  if (!new Negozi({ ambiente: { QUADRO_GOOGLE_SERVICE_ACCOUNT: valore } }).configurato("android")) {
    throw new No("Il quadro non riesce a usare questo service account.");
  }
  scrivi(file, righe, [["QUADRO_GOOGLE_SERVICE_ACCOUNT", fraApici(valore)]]);
  return [
    `Google Play: scritto il service account ${conto.client_email}.`,
    `Il file ${percorso} adesso cancellalo: shred -u ${percorso}`,
    "",
    "Poi riavvia il quadro:",
    "",
    "  systemctl restart quadro",
  ];
}

/* ─── App Store ─────────────────────────────────────────────────────────── */

function apple(file, [percorso, kid, iss], sostituisci) {
  if (!percorso || !kid || !iss) {
    throw new No("Ci vogliono tre cose: node le-licenze.mjs apple <file.p8> <key id> <issuer id>");
  }
  if (!/^[A-Z0-9]{10}$/.test(kid)) {
    throw new No(`«${kid}» non sembra un Key ID di Apple: sono dieci lettere e cifre maiuscole.`);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(iss)) {
    throw new No(
      `«${iss}» non sembra un Issuer ID di Apple: e' fatto cosi', 57246542-96fe-1a63-e053-0824d011072a.`,
    );
  }
  const righe = leggi(file);
  if (valoreDi(righe, "QUADRO_APPLE_CHIAVE") && !sostituisci) {
    throw new No("La chiave di Apple c'e' gia'. Per cambiarla: aggiungi --sostituisci.");
  }
  let pem;
  try {
    pem = readFileSync(percorso, "utf8").trim();
    const chiave = createPrivateKey(pem);
    if (chiave.asymmetricKeyType !== "ec") throw new Error("non e' EC");
  } catch (_errore) {
    throw new No(`${percorso} non e' una chiave .p8 di Apple che si legge.`);
  }
  /* Su una riga: i ritorni a capo diventano «\n» scritti, e il quadro li
   * rimette a posto (`negozi.js`). */
  const suUnaRiga = pem.replace(/\r?\n/g, "\\n");
  const ambiente = {
    QUADRO_APPLE_CHIAVE: suUnaRiga,
    QUADRO_APPLE_KEY_ID: kid,
    QUADRO_APPLE_ISSUER: iss,
  };
  if (!new Negozi({ ambiente }).configurato("ios")) {
    throw new No("Il quadro non riesce a usare questa chiave di Apple.");
  }
  scrivi(file, righe, [
    ["QUADRO_APPLE_CHIAVE", fraApici(suUnaRiga)],
    ["QUADRO_APPLE_KEY_ID", kid],
    ["QUADRO_APPLE_ISSUER", iss.toLowerCase()],
  ]);
  return [
    `App Store: scritta la chiave ${kid}.`,
    `Il file ${percorso} adesso cancellalo: shred -u ${percorso}`,
    "",
    "Poi riavvia il quadro:",
    "",
    "  systemctl restart quadro",
  ];
}

/* ─── Com'e' messo ──────────────────────────────────────────────────────── */

function comeEMesso(file) {
  const righe = leggi(file);
  const detto = [];
  const d = valoreDi(righe, "QUADRO_LICENZE_CHIAVE");
  const privata = d ? chiavePrivataDa(d) : null;
  detto.push(
    privata
      ? `chiave delle licenze   c'e'   la pubblica: ${laPubblicaDi(privata)}`
      : d
        ? "chiave delle licenze   STORTA  la riga c'e' ma non e' una chiave buona"
        : "chiave delle licenze   manca  node le-licenze.mjs chiave",
  );
  const conto = valoreDi(righe, "QUADRO_GOOGLE_SERVICE_ACCOUNT");
  let email = null;
  try {
    email = conto ? JSON.parse(conto).client_email : null;
  } catch (_errore) {
    email = null;
  }
  const googleBuono =
    conto &&
    new Negozi({ ambiente: { QUADRO_GOOGLE_SERVICE_ACCOUNT: conto } }).configurato("android");
  detto.push(
    googleBuono
      ? `Google Play            c'e'   ${email}`
      : conto
        ? "Google Play            STORTO la riga c'e' ma il quadro non la legge"
        : "Google Play            manca  node le-licenze.mjs google <file.json>",
  );
  const kid = valoreDi(righe, "QUADRO_APPLE_KEY_ID");
  const appleBuono = new Negozi({
    ambiente: {
      QUADRO_APPLE_CHIAVE: valoreDi(righe, "QUADRO_APPLE_CHIAVE") ?? "",
      QUADRO_APPLE_KEY_ID: kid ?? "",
      QUADRO_APPLE_ISSUER: valoreDi(righe, "QUADRO_APPLE_ISSUER") ?? "",
    },
  }).configurato("ios");
  detto.push(
    appleBuono
      ? `App Store              c'e'   chiave ${kid}`
      : valoreDi(righe, "QUADRO_APPLE_CHIAVE")
        ? "App Store              STORTO le righe ci sono ma il quadro non le legge"
        : "App Store              manca  node le-licenze.mjs apple <file.p8> <key id> <issuer id>",
  );
  detto.push(
    "",
    "Quello che il quadro sta usando adesso lo dice il suo registro:",
    '  journalctl -u quadro -b --no-pager | grep -iE "licenze|ricevute"',
  );
  return detto;
}

/* ─── Si comincia ───────────────────────────────────────────────────────── */

export function lanciaLeLicenze(argomenti) {
  const args = [...argomenti];
  let file = AMBIENTE_DI_SERIE;
  const dove = args.indexOf("--ambiente");
  if (dove >= 0) {
    file = args[dove + 1];
    args.splice(dove, 2);
  }
  const sostituisci = args.includes("--sostituisci");
  const resto = args.filter((uno) => uno !== "--sostituisci");
  const [cosa, ...dopo] = resto;
  if (cosa === "--aiuto" || cosa === "-h" || cosa === "--help") return COSA_FA.split("\n");
  if (cosa === undefined) return comeEMesso(file);
  if (cosa === "chiave") return laChiave(file);
  if (cosa === "google") return google(file, dopo, sostituisci);
  if (cosa === "apple") return apple(file, dopo, sostituisci);
  throw new No(`Non conosco «${cosa}».\n\n${COSA_FA}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(lanciaLeLicenze(process.argv.slice(2)).join("\n"));
  } catch (errore) {
    if (errore?.code === "EACCES" || errore?.code === "EPERM") {
      console.error("Qui non posso scrivere: va lanciato da root (sudo -i, e poi di nuovo).");
    } else if (errore instanceof No) {
      console.error(errore.message);
    } else {
      throw errore;
    }
    process.exitCode = 1;
  }
}
