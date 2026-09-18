/* Lo script che accende il quadro, guardato senza accenderlo.
 *
 * Come quello del tramite, e per lo stesso motivo: vuole una macchina vuota,
 * root, systemd e un nome che punti a lei. Gira davanti a una persona che sta
 * guardando un riquadro nero, e se sbaglia lo fa li'.
 *
 * Quello che si prova qui e' quello che si puo' provare leggendo, ed e' piu' di
 * quanto sembri. Due cose contano piu' di tutte, e sono le due che farebbero
 * danno in silenzio:
 *
 *  - **che rilanciarlo non cambi la chiave della gestione.** Quella chiave
 *    apre i conti degli installatori: rifarla a ogni giro vorrebbe dire che chi
 *    reincolla la riga per aggiornare si ritrova fuori dal proprio quadro;
 *  - **che non riscriva il Caddyfile.** Il tramite il suo lo riscrive tutto a
 *    ogni giro. Se anche questo facesse lo stesso, l'ultimo lanciato
 *    cancellerebbe l'altro — e a spegnersi sarebbe quello che nessuno sta
 *    guardando.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const ACCENDI = readFileSync(join(QUI, "..", "accendi.sh"), "utf8");
const DEL_TRAMITE = readFileSync(join(QUI, "..", "..", "centralino", "accendi.sh"), "utf8");

/* I pezzi che lo script scrive col cuore chiuso — `<<'FINE'` — cioe' quelli che
 * finiscono sulla macchina esattamente come sono scritti qui. */
function pezziScritti() {
  const trovati = [];
  const cerca = /cat >"?([^"\s]+)"? <<'FINE'\n([\s\S]*?)\nFINE\n/g;
  let uno;
  while ((uno = cerca.exec(ACCENDI)) !== null) trovati.push({ dove: uno[1], testo: uno[2] });
  return trovati;
}

const inBash = (testo) => {
  const cartella = mkdtempSync(join(tmpdir(), "accendi-quadro-"));
  try {
    const dove = join(cartella, "prova.sh");
    writeFileSync(dove, testo);
    execFileSync("bash", ["-n", dove]);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
};

test("lo script principale e' bash valido", () => {
  inBash(ACCENDI);
});

test("e anche i pezzi che scrive sulla macchina", () => {
  /* Uno script che ne genera altri ha due strati di virgolette, e il secondo
   * non lo guarda nessuno finche' non si rompe in produzione. */
  const pezzi = pezziScritti();
  assert.ok(pezzi.length >= 2, `di pezzi col cuore chiuso ne ho trovati ${pezzi.length}`);
  for (const uno of pezzi) {
    if (!uno.testo.startsWith("#!/usr/bin/env bash")) continue;
    inBash(uno.testo);
  }
});

test("rilanciarlo non cambia la chiave della gestione", () => {
  /* La riga che conta di piu'. Da quella chiave si aprono i conti degli
   * installatori: cambiarla a sorpresa chiude fuori chi tiene il quadro, e con
   * lui tutti quelli che avrebbe dovuto iscrivere. */
  assert.match(
    ACCENDI,
    /CHIAVE_GESTORE="\$\(gia_scritto[^\n]*QUADRO_GESTORE\)/,
    "la chiave non si rilegge da quello che c'e' gia'",
  );
  const generazione = ACCENDI.slice(ACCENDI.indexOf('CHIAVE_GESTORE="$(gia_scritto'));
  const dentroIlSe = generazione.slice(
    generazione.indexOf('if [[ -z "$CHIAVE_GESTORE" ]]'),
    generazione.indexOf("\nfi\n"),
  );
  assert.match(dentroIlSe, /urandom/, "la chiave si genera fuori dal «se non c'e'»");
});

test("e non richiede il gettone che il tramite ha gia' su quella macchina", () => {
  /* E' la stessa repository: chiedere di nuovo un segreto che c'e' gia' vuol
   * dire, nella pratica, farselo cambiare da chi non ce l'ha sotto mano. */
  assert.match(ACCENDI, /gia_scritto "\$CASA_DEL_TRAMITE\/lettura" GETTONE_LETTURA/);
});

test("non riscrive il Caddyfile: ci mette un innesto", () => {
  /* Il tramite il suo Caddyfile lo riscrive tutto. Se anche questo lo
   * riscrivesse, l'ultimo lanciato spegnerebbe l'altro. */
  assert.ok(
    !/cat >\/etc\/caddy\/Caddyfile <</.test(ACCENDI),
    "questo script riscrive il Caddyfile del tramite",
  );
  assert.match(ACCENDI, /cat >\/etc\/caddy\/conf\.d\/quadro\.caddy/);
});

test("e il tramite legge gli innesti, se no al suo primo rilancio il quadro sparisce", () => {
  /* Le due meta' della stessa promessa, e questa sta nell'altro file: senza
   * quella riga la' dentro, questo innesto vive fino al prossimo giro del
   * tramite. */
  assert.match(DEL_TRAMITE, /import \/etc\/caddy\/conf\.d\/\*\.caddy/);
  assert.match(DEL_TRAMITE, /install -d -m 755 \/etc\/caddy\/conf\.d/);
});

test("si prova prima di scambiare, non dopo", () => {
  const scarica = pezziScritti().find((uno) => uno.dove.includes("scarica.sh"));
  assert.ok(scarica, "non trovo scarica.sh");
  const prove = scarica.testo.indexOf("node --test");
  const scambio = scarica.testo.indexOf('mv "$DOVE/quadro.nuovo"');
  assert.ok(prove > 0 && scambio > 0, "non trovo le prove o lo scambio");
  assert.ok(prove < scambio, "scambia prima di provare: una versione rotta prenderebbe il posto");
});

test("il servizio non gira da root, e scrive solo nei suoi dati", () => {
  const servizio = ACCENDI.slice(ACCENDI.indexOf("[Unit]"), ACCENDI.indexOf("[Install]"));
  assert.match(servizio, /User=\$UTENTE/);
  assert.match(servizio, /ProtectSystem=strict/);
  assert.match(servizio, /ReadWritePaths=\$DATI/);
  assert.ok(!/User=root/.test(servizio));
});

test("il servizio non ha il divieto che ammazza Node", () => {
  /* `MemoryDenyWriteExecute` vieterebbe alla memoria di essere scrivibile ed
   * eseguibile insieme. Node compila il JavaScript in istruzioni vere mentre
   * gira: col divieto non parte. */
  assert.ok(!/^MemoryDenyWriteExecute/m.test(ACCENDI));
});

test("i file coi segreti non li legge nessun altro", () => {
  for (const file of ["lettura", "ambiente"]) {
    assert.match(
      ACCENDI,
      new RegExp(`chmod 600 "\\$CONFIGURAZIONE/${file}"`),
      `${file} resta leggibile da chiunque`,
    );
  }
});

test("i gettoni non passano mai dalla riga di comando", () => {
  /* La riga di comando di un processo la legge chiunque sia sulla macchina, con
   * un `ps`. Il gettone va a curl in un file. */
  assert.ok(
    !/-H ["']Authorization: Bearer \$/.test(ACCENDI),
    "un gettone finisce fra gli argomenti di curl",
  );
  assert.match(ACCENDI, /--config <\(printf 'header = "Authorization: Bearer %s/);
});

test("la macchina segue un segno, non il ramo", () => {
  /* Su `main` si spinge dieci volte al giorno, e una macchina che lo seguisse
   * si riavvierebbe dieci volte al giorno. */
  assert.match(ACCENDI, /SEGNO="\$\{SEGNO_DEL_QUADRO:-tramite\}"/);
  assert.ok(!/:-main\}/.test(ACCENDI));
});

test("il nome si controlla prima di installare qualunque cosa", () => {
  /* Senza, Caddy non prende il certificato e si ferma a meta', lasciando una
   * macchina mezza fatta e un errore che parla di ACME invece che di DNS. */
  const controllo = ACCENDI.indexOf("non risolve");
  const installa = ACCENDI.indexOf("apt-get install");
  assert.ok(controllo > 0 && installa > 0);
  assert.ok(controllo < installa, "installa prima di aver controllato dove punta il nome");
});

test("l'indirizzo del quadro e' lo stesso che sta dentro l'add-on", () => {
  /* Il ponte non ha nessuna casella per l'indirizzo: ce l'ha scritto dentro.
   * Cambiarlo qui e non li' vuol dire un quadro che nessuna casa trova. */
  const ponte = readFileSync(join(QUI, "..", "..", "ponte", "src", "cartolina.js"), "utf8");
  const scritto = /QUADRO_DI_DIFETTO = "https:\/\/([^"]+)"/.exec(ponte)?.[1];
  assert.ok(scritto, "non trovo l'indirizzo nel ponte");
  assert.match(
    ACCENDI,
    new RegExp(`NOME_DEL_QUADRO:-${scritto.replace(/\./g, "\\.")}\\}`),
    `lo script accende «${scritto}»? nel ponte c'e' quello`,
  );
});
