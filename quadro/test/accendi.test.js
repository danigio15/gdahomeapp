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
 *    aggiunge gli installatori: rifarla a ogni giro vorrebbe dire che chi
 *    reincolla la riga per aggiornare si ritrova fuori dal proprio quadro;
 *  - **che non riscriva il Caddyfile.** Il tramite il suo lo riscrive tutto a
 *    ogni giro. Se anche questo facesse lo stesso, l'ultimo lanciato
 *    cancellerebbe l'altro — e a spegnersi sarebbe quello che nessuno sta
 *    guardando.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { FOGLIETTO } from "../src/mi-aggiorno.js";
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
  /* La riga che conta di piu'. Da quella chiave si aggiungono gli
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
  /* Chi prova lascia la versione in `uscita/pronto` solo se le prove passano;
   * lo scambio prende solo quella. */
  const prepara = pezziScritti().find((uno) => uno.dove.includes("prepara.sh"));
  assert.ok(prepara, "non trovo prepara.sh");
  const prove = prepara.testo.indexOf("node --test");
  const pronta = prepara.testo.indexOf('mv "$nuovo" "$USCITA/pronto"');
  assert.ok(prove > 0 && pronta > 0, "non trovo le prove o la versione pronta");
  assert.ok(prove < pronta, "la lascia pronta prima di provarla");
  const scambia = pezziScritti().find((uno) => uno.dove.includes("scambia.sh"));
  assert.ok(scambia, "non trovo scambia.sh");
  assert.match(scambia.testo, /\[ -e "\$USCITA\/pronto" \] \|\| exit 0/);
});

test("il codice appena scaricato non gira da root: scarica e prova chi non ha privilegi", () => {
  /* Le prove di una versione nuova sono codice appena arrivato da fuori.
   * Giravano da root, dentro il giro degli aggiornamenti: adesso le fa
   * `quadro-prepara`, con un utente suo, e root copia e riavvia e basta. */
  const prepara = ACCENDI.slice(
    ACCENDI.indexOf("cat >/etc/systemd/system/quadro-prepara.service"),
    ACCENDI.indexOf("systemctl start quadro-prepara.service"),
  );
  assert.match(prepara, /User=\$AGGIORNATORE/);
  assert.match(prepara, /NoNewPrivileges=yes/);
  assert.match(prepara, /CapabilityBoundingSet=\n/);
  assert.match(prepara, /InaccessiblePaths=\$DATI \$CONFIGURAZIONE/, "chi prova legge le chiavi");
  assert.match(prepara, /LoadCredential=lettura:/);
  assert.match(ACCENDI, /AGGIORNATORE="quadro-aggiorna"/);
  /* Il giro da root non scarica e non prova: chiede a chi prepara. */
  const giro = pezziScritti().find((uno) => uno.dove.includes("aggiorna.sh"));
  assert.ok(giro, "non trovo aggiorna.sh");
  assert.doesNotMatch(giro.testo, /node --test|curl /);
  assert.match(giro.testo, /systemctl start quadro-prepara\.service/);
  /* E lo scambio copia senza seguire collegamenti, e i file diventano di root. */
  const scambia = pezziScritti().find((uno) => uno.dove.includes("scambia.sh"));
  assert.match(scambia.testo, /cp -R -P/);
  assert.match(scambia.testo, /find "\$arrivo" -type l/);
  assert.match(scambia.testo, /chown -R root:root "\$arrivo"/);
  /* Gli script di prima, che facevano tutto da root, se ne vanno. */
  assert.match(ACCENDI, /rm -f "\$DOVE\/sha\.sh" "\$DOVE\/scarica\.sh"/);
});

test("Node dal repository con la chiave, non da uno script dato a bash", () => {
  assert.doesNotMatch(ACCENDI, /deb\.nodesource\.com\/setup_/);
  assert.match(ACCENDI, /signed-by=\/etc\/apt\/keyrings\/nodesource\.gpg/);
});

test("il firewall apre SSH prima di accendersi, e non tocca quello di un altro", () => {
  const acceso = ACCENDI.indexOf("ufw --force enable");
  const ssh = ACCENDI.lastIndexOf('ufw allow "$porta_ssh/tcp"', acceso);
  assert.ok(ssh > 0 && acceso > ssh, "accende il firewall prima di aprire SSH");
  assert.match(ACCENDI, /sshd -T/, "la porta di SSH si legge, non si suppone");
  assert.match(ACCENDI, /SSH_CONNECTION/, "e quella da cui si e' collegati adesso");
  assert.match(ACCENDI, /altre_regole\(\)/);
  assert.match(ACCENDI, /FIREWALL="\$\{QUADRO_FIREWALL:-si\}"/);
  for (const porta of ["80/tcp", "443/tcp"])
    assert.match(ACCENDI, new RegExp(`ufw allow ${porta}`));
});

test("il quadro ascolta solo su questa macchina, e Caddy dice al browser di restare su HTTPS", () => {
  assert.match(ACCENDI, /printf 'QUADRO_ASCOLTO=%s\\n' "127\.0\.0\.1"/);
  const innesto = ACCENDI.slice(ACCENDI.indexOf("cat >/etc/caddy/conf.d/quadro.caddy"));
  assert.match(innesto, /header Strict-Transport-Security "max-age=31536000"/);
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
  const ponte = readFileSync(join(QUI, "..", "..", "ponte", "src", "rapporto.js"), "utf8");
  const scritto = /QUADRO_DI_DIFETTO = "https:\/\/([^"]+)"/.exec(ponte)?.[1];
  assert.ok(scritto, "non trovo l'indirizzo nel ponte");
  assert.match(
    ACCENDI,
    new RegExp(`NOME_DEL_QUADRO:-${scritto.replace(/\./g, "\\.")}\\}`),
    `lo script accende «${scritto}»? nel ponte c'e' quello`,
  );
});

test("il giro degli aggiornamenti non esce piu' zitto quando non ce la fa", () => {
  /* Era il guasto che somigliava di piu' allo stare bene: GitHub non risponde,
   * il giro esce, il quadro resta sull'ultima versione che aveva — e nessuno
   * lo sa. Adesso lo scrive in due posti, e questa prova li tiene tutti e due.
   *
   * Il foglietto e `/salute` devono chiamarlo allo stesso modo, se no il
   * quadro cercherebbe un file che il giro non scrive: e' la solita coppia che
   * si scrive in due posti e prima o poi diverge. */
  assert.match(ACCENDI, /non_ce_la_faccio\(\)/, "non c'e' nessuna via d'uscita che parli");
  assert.match(
    ACCENDI,
    /logger -t quadro "non riesco a sapere che versione/,
    "non lo dice al registro",
  );
  assert.match(
    ACCENDI,
    /FOGLIETTO="\$DATI\/non-mi-aggiorno"/,
    "il foglietto non sta nei dati del quadro",
  );
  assert.match(
    ACCENDI,
    new RegExp(`FOGLIETTO="\\$DATI/${FOGLIETTO}"`),
    "il nome del foglietto non e' quello che il quadro legge",
  );

  /* E quando ce la fa, il foglietto se ne va: un avviso che resta dopo che la
   * cosa si e' aggiustata e' peggio di nessun avviso. */
  assert.match(
    ACCENDI,
    /rm -f "\\?\$FOGLIETTO"/,
    "il foglietto non si toglie mai, e un avviso che resta quando la cosa e' passata e' peggio di nessun avviso",
  );

  /* La data e' quella del **primo** fallimento di fila. Riscrivendola a ogni
   * giro, l'ora non arriverebbe mai e `/salute` resterebbe zitta per sempre. */
  assert.match(ACCENDI, /head -1 "\\?\$FOGLIETTO"/, "la data del primo fallimento non si tiene");
});
