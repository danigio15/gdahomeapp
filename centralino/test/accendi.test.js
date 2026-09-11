/* Lo script che accende il tramite, guardato senza accenderlo.
 *
 * E' l'unico pezzo del progetto che non si puo' provare davvero da qui: vuole
 * una macchina vuota, root, systemd e due nomi che puntino a lei. Gira una
 * volta sola, su una macchina che in quel momento non ha niente sopra, e se
 * sbaglia lo fa davanti a una persona che sta guardando un riquadro nero e non
 * sa cosa farsene dell'errore.
 *
 * Allora si prova quello che si puo' provare, ed e' piu' di quanto sembri:
 *
 *  - che i pezzi che lo script **scrive sulla macchina** siano bash valido.
 *    Uno script che ne genera altri ha due strati di virgolette, e il secondo
 *    strato non lo guarda nessuno finche' non si rompe in produzione;
 *  - che le prove girino **prima** dello scambio. Al contrario, una versione
 *    rotta avrebbe gia' preso il posto di una che funzionava;
 *  - che il servizio non giri da root e non possa scrivere dove non deve;
 *  - che i gettoni non finiscano dove si possono rileggere.
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

/* I pezzi che lo script scrive con il cuore chiuso — `<<'FINE'` — cioe' quelli
 * che finiscono sulla macchina esattamente come sono scritti qui. */
function pezziScritti() {
  const trovati = [];
  const cerca = /cat >"?([^"\s]+)"? <<'FINE'\n([\s\S]*?)\nFINE\n/g;
  let uno;
  while ((uno = cerca.exec(ACCENDI)) !== null) trovati.push({ dove: uno[1], testo: uno[2] });
  return trovati;
}

test("lo script principale e' bash valido", () => {
  const cartella = mkdtempSync(join(tmpdir(), "accendi-"));
  try {
    const dove = join(cartella, "accendi.sh");
    writeFileSync(dove, ACCENDI);
    execFileSync("bash", ["-n", dove]);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("e anche i pezzi che scrive sulla macchina", () => {
  const pezzi = pezziScritti().filter(
    (uno) => uno.dove.endsWith(".sh") || uno.dove.includes("/bin/"),
  );
  assert.ok(pezzi.length >= 4, "mi aspettavo almeno quattro script generati");

  const cartella = mkdtempSync(join(tmpdir(), "accendi-"));
  try {
    for (const { dove, testo } of pezzi) {
      const file = join(cartella, `${dove.replace(/[^A-Za-z0-9]+/g, "_")}.sh`);
      writeFileSync(file, testo);
      try {
        execFileSync("bash", ["-n", file]);
      } catch (errore) {
        assert.fail(`«${dove}» non e' bash valido: ${errore.stderr || errore.message}`);
      }
    }
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("si prova prima di scambiare, non dopo", () => {
  const scarica = pezziScritti().find((uno) => uno.dove.endsWith("scarica.sh"));
  assert.ok(scarica, "non trovo lo script che scarica");
  const prova = scarica.testo.indexOf("node --test");
  const scambio = scarica.testo.indexOf('mv "$DOVE/centralino.nuovo"');
  assert.ok(prova >= 0, "lo script non prova niente");
  assert.ok(scambio >= 0, "lo script non scambia niente");
  assert.ok(
    prova < scambio,
    "le prove girano dopo lo scambio: una versione rotta avrebbe gia' preso il posto",
  );
});

test("lo scambio tocca solo quello che cambia, non gli script di fianco", () => {
  const scarica = pezziScritti().find((uno) => uno.dove.endsWith("scarica.sh"));
  /* Se spostasse la cartella intera si porterebbe via anche se stesso, e il
   * secondo aggiornamento non troverebbe piu' niente da eseguire. */
  assert.doesNotMatch(
    scarica.testo,
    /mv "\$DOVE" /,
    "sposta la cartella intera: si porta via anche gli script",
  );
});

test("il servizio non gira da root, e scrive solo nei suoi dati", () => {
  assert.match(ACCENDI, /^User=\$UTENTE$/m);
  assert.match(ACCENDI, /^ProtectSystem=strict$/m);
  assert.match(ACCENDI, /^ReadWritePaths=\$DATI$/m);
  assert.match(ACCENDI, /^NoNewPrivileges=yes$/m);
  /* E riparte da solo: e' tutto il senso di una macchina propria. */
  assert.match(ACCENDI, /^Restart=always$/m);
  assert.match(ACCENDI, /WantedBy=multi-user\.target/);
});

test("i file coi segreti non li legge nessun altro", () => {
  for (const quale of ["lettura", "ambiente", "quale"]) {
    assert.match(
      ACCENDI,
      new RegExp(`chmod 600 "\\$CONFIGURAZIONE/${quale}"`),
      `«${quale}» non e' chiuso a 600`,
    );
  }
});

test("i gettoni non passano mai dalla riga di comando", () => {
  /* `ps` la legge chiunque sia sulla macchina — anche l'utente del servizio,
   * che sta li' di fianco — e questi script girano da root. */
  for (const { dove, testo } of pezziScritti()) {
    const righe = testo.split("\n").filter((una) => !una.trim().startsWith("#"));
    for (const riga of righe) {
      assert.ok(
        !/-H\s+["']Authorization: Bearer \$/.test(riga),
        `«${dove}» mette il gettone fra gli argomenti: ${riga.trim()}`,
      );
    }
  }
});

test("la macchina segue un segno, non il ramo", () => {
  /* Su `main` si spinge dieci volte al giorno. Una macchina che seguisse main
   * si riavvierebbe dieci volte al giorno, a volte su un commit scritto a
   * meta'. */
  const segno = /SEGNO="\$\{SEGNO_DEL_TRAMITE:-([^}]+)\}"/.exec(ACCENDI);
  assert.ok(segno, "non trovo quale segno segue la macchina");
  assert.notEqual(segno[1], "main");
});

test("i due nomi si controllano prima di installare qualunque cosa", () => {
  /* Un record che punta altrove e' il difetto piu' comune, e senza questo
   * controllo lo si scopre venti minuti dopo, quando il certificato non
   * arriva e non si capisce perche'. */
  const dnsQui = ACCENDI.indexOf("dove_punta()");
  const primoApt = ACCENDI.indexOf("apt-get install");
  assert.ok(dnsQui >= 0 && primoApt >= 0);
  assert.ok(dnsQui < primoApt, "installa prima di guardare dove puntano i nomi");
});
