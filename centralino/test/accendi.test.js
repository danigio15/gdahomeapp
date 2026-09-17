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

test("installare non deve buttare fuori chi sta installando", () => {
  /* Ubuntu 24.04, dopo ogni installazione, passa `needrestart` e riavvia i
   * servizi collegati alle librerie aggiornate. Fra quelli c'e' **ssh**: chi
   * stava lanciando lo script da ssh si trova buttato fuori a meta', nel punto
   * peggiore, e non sa nemmeno dove era arrivato. E' successo davvero. */
  const sospende = ACCENDI.indexOf("NEEDRESTART_SUSPEND=1");
  const primoApt = ACCENDI.indexOf("apt-get update");
  assert.ok(sospende >= 0, "non sospende needrestart: riavviera' ssh e tagliera' il filo");
  assert.ok(sospende < primoApt, "lo sospende dopo aver gia' installato qualcosa");
});

test("il servizio non ha il divieto che ammazza Node", () => {
  /* `MemoryDenyWriteExecute` vieta alla memoria di essere scrivibile ed
   * eseguibile insieme. Su quasi tutti i servizi e' una buona idea; su Node no,
   * perche' Node compila il JavaScript in istruzioni vere mentre gira e quelle
   * istruzioni le scrive in memoria che poi esegue. Con quel divieto muore con
   * un segnale e senza un messaggio che spieghi niente. E' successo davvero. */
  assert.doesNotMatch(ACCENDI, /^MemoryDenyWriteExecute=yes$/m);

  /* E i socket interni e la lista delle interfacce servono: senza `AF_UNIX` e
   * `AF_NETLINK`, Node non parte. */
  const famiglie = /^RestrictAddressFamilies=(.+)$/m.exec(ACCENDI);
  assert.ok(famiglie, "non trovo le famiglie di socket ammesse");
  for (const quale of ["AF_INET", "AF_INET6", "AF_UNIX", "AF_NETLINK"]) {
    assert.ok(famiglie[1].includes(quale), `manca ${quale}`);
  }
});

test("nei pezzi scritti col cuore aperto non ci sono controaccenti", () => {
  /* `cat <<FINE` senza virgolette lascia viva la shell dentro il testo: un
   * controaccento esegue un comando, e `$(...)` pure. Tre parole messe fra
   * controaccenti dentro un commento — «AF_UNIX», «AF_NETLINK» — sono finite
   * in pasto alla shell e hanno stampato «command not found» in mezzo
   * all'installazione. Era innocuo per un pelo: in quel punto girava da root.
   *
   * Dove serve la sostituzione la si scrive apposta, con `$VARIABILE`. I
   * controaccenti no, mai. */
  const aperti = /cat >"?[^"\s]+"? <<FINE\n([\s\S]*?)\nFINE\n/g;
  let uno;
  let quanti = 0;
  while ((uno = aperti.exec(ACCENDI)) !== null) {
    quanti += 1;
    const testo = uno[1];
    const controaccenti = [...testo.matchAll(/(^|[^\\])`/g)];
    assert.equal(
      controaccenti.length,
      0,
      `un controaccento non protetto in un heredoc aperto: ${controaccenti[0]?.[0]}`,
    );
    assert.doesNotMatch(testo, /(^|[^\\])\$\(/, "una sostituzione di comando in un heredoc aperto");
  }
  assert.ok(quanti >= 2, "mi aspettavo almeno due heredoc col cuore aperto");
});

test("rilanciarlo non cambia la chiave della console", () => {
  /* Prima la chiave si rigenerava a ogni giro, in una riga senza `if`. Chi
   * reincollava la riga per aggiungere un pezzo — ed e' quello che lo script
   * promette di poter fare, due righe sopra — si ritrovava la chat chiusa con
   * una chiave che non aveva mai visto, e nessun messaggio che lo dicesse.
   *
   * Quindi: la si genera solo se non c'e'. */
  const genera = ACCENDI.indexOf("head -c 48 /dev/urandom");
  assert.ok(genera >= 0, "non genera nessuna chiave");
  const prima = ACCENDI.slice(0, genera);
  assert.match(
    prima,
    /CHIAVE_CONSOLE="\$\(gia_scritto [^)]*\)"/,
    "non guarda se la chiave c'e' gia': la rifa' e la porta via",
  );
  assert.match(
    ACCENDI,
    /if \[\[ -z "\$CHIAVE_CONSOLE" \]\]; then\n\s+CHIAVE_CONSOLE="\$\(head -c 48/,
    "genera la chiave senza prima chiedersi se ce n'e' una",
  );
});

test("e non chiede di nuovo i gettoni che sono gia' sulla macchina", () => {
  /* Richiedere un segreto che c'e' gia' vuol dire, nella pratica, cambiarlo:
   * chi non ce l'ha sotto mano tira avanti, e quello di prima smette di
   * valere. */
  for (const [quale, chiave, dove] of [
    ["GETTONE_LETTURA", "GETTONE_LETTURA", "lettura"],
    ["GETTONE_SEGNALAZIONI", "GITHUB_SEGNALAZIONI", "ambiente"],
    ["REPO_SEGNALAZIONI", "GITHUB_REPO", "ambiente"],
    ["REPO_ALLEGATI", "GITHUB_REPO_ALLEGATI", "ambiente"],
  ]) {
    const atteso = `${quale}="\${${quale}:-$(gia_scritto "$CONFIGURAZIONE/${dove}" ${chiave})}"`;
    assert.ok(
      ACCENDI.includes(atteso),
      `«${quale}» non si rilegge da «${dove}»: lo richiede, e cosi' lo cambia`,
    );
  }
});

test("il sito viaggia con tutto il resto, e ha il suo nome davanti", () => {
  const scarica = pezziScritti().find((uno) => uno.dove.endsWith("scarica.sh"));
  assert.match(
    scarica.testo,
    /cp -a "\$radice\/sito" "\$DOVE\/sito\.nuovo"/,
    "non porta dentro il sito",
  );
  assert.match(scarica.testo, /mv "\$DOVE\/sito\.nuovo" "\$DOVE\/sito"/, "non scambia il sito");

  /* Una versione che non ha la cartella del sito non deve svuotare un nome
   * pubblico: se non c'e', resta quello di prima. */
  assert.match(scarica.testo, /if \[ -d "\$radice\/sito" \]; then/);
  assert.doesNotMatch(scarica.testo, /mkdir -p "\$DOVE\/sito\.nuovo"/);

  /* E davanti ci sta Caddy, col nome nudo e col `www` che manda la'. */
  assert.match(ACCENDI, /^\$NOME_DEL_SITO \{$/m);
  assert.match(ACCENDI, /root \* \$DOVE\/sito/);
  assert.match(ACCENDI, /^www\.\$NOME_DEL_SITO \{$/m);
  assert.match(ACCENDI, /redir https:\/\/\$NOME_DEL_SITO\{uri\} permanent/);
});

test("i nomi che Caddy serve sono quelli che si controllano prima", () => {
  /* Un nome servito ma non controllato e' un certificato che non arriva, e
   * venti minuti persi a capire perche'. */
  const controllati = /^for nome in (.+); do$/m.exec(ACCENDI);
  assert.ok(controllati, "non trovo il giro che controlla i nomi");
  for (const quale of [
    "$NOME_DEL_TRAMITE",
    "$NOME_DELL_APP",
    "$NOME_DEL_SITO",
    "www.$NOME_DEL_SITO",
  ]) {
    assert.ok(controllati[1].includes(`"${quale}"`), `«${quale}» non si controlla prima`);
  }
});

test("la macchina dice al tramite come si chiamano il sito e l'app", () => {
  /* La soglia — quello che trova chi apre l'indirizzo nudo — manda al sito e
   * all'app, e quei due nomi il centralino da solo non li sa: glieli dice la
   * macchina. Se non arrivano, la pagina c'e' comunque ma non manda da nessuna
   * parte, ed e' proprio il buco che doveva chiudere. */
  for (const chiave of ["NOME_DEL_SITO", "NOME_DELL_APP"]) {
    assert.match(
      ACCENDI,
      new RegExp(`printf '${chiave}=%s\\\\n' "\\$${chiave}"`),
      `«${chiave}» non arriva al servizio`,
    );
  }
});

test("l'app si serve da un indirizzo solo, e il nome corto ci rimanda", () => {
  /* E' la prova di una cosa che non si vede guardando Caddy: **il browser
   * tiene l'abbinamento per indirizzo**. Il segno che apre casa lo tiene il
   * deposito del browser, e quel deposito e' di quel nome li'.
   *
   * Finche' due nomi servivano gli stessi file, chi arrivava dal bottone della
   * console e chi arrivava dal preferito erano due app diverse per il browser:
   * ognuna chiedeva di abbinarsi, e ogni abbinamento bruciava uno degli otto
   * posti dei telefoni. Sembrava un problema dell'app, ed era una riga di
   * Caddy.
   *
   * Quindi: un posto solo che serve i file — quello sotto il tramite, l'unico
   * che la console sa fabbricare — e il nome corto che ci rimanda, senza
   * perdere il pezzo di strada che segue. */
  const corto = new RegExp("^\\$NOME_DELL_APP \\{$([\\s\\S]*?)^\\}$", "m").exec(ACCENDI);
  assert.ok(corto, "non trovo il blocco del nome corto");
  assert.match(
    corto[1],
    /redir https:\/\/\$NOME_DEL_TRAMITE\/app\{uri\} permanent/,
    "il nome corto non rimanda all'indirizzo che conta",
  );
  /* E non serve niente per conto suo: se servisse ancora i file, sarebbe
   * un secondo deposito e il guaio tornerebbe identico. */
  assert.doesNotMatch(corto[1], /file_server/, "il nome corto serve ancora una copia dell'app");
  assert.doesNotMatch(corto[1], /root \*/, "il nome corto ha ancora una cartella sua");
});

test("l'app si apre anche dall'indirizzo del tramite, sotto /app/", () => {
  /* Il link per il browser lo fabbrica la console dell'add-on, e lo ricava
   * dall'unica cosa che sa del centralino: il nome che ha in configurazione,
   * con «/app/» in fondo. Sulla nuvola quel posto c'e'; qui l'app stava solo
   * sul nome corto, e quel bottone portava a «qui non c'e' niente». */
  const blocco = /^\$NOME_DEL_TRAMITE \{$([\s\S]*?)^\}$/m.exec(ACCENDI);
  assert.ok(blocco, "non trovo il blocco del tramite");
  assert.match(blocco[1], /handle \/app\/\* \{/, "il tramite non serve l'app");
  assert.match(blocco[1], /^\t\troot \* \$DOVE$/m, "l'app non viene dalla cartella giusta");
  assert.match(
    blocco[1],
    /try_files \{path\} \/app\/index\.html/,
    "chi ricarica una schermata interna trova un 404",
  );
  /* `/app` scritto a mano, senza la barra, e' lo stesso posto. */
  assert.match(blocco[1], /handle \/app \{/, "«/app» senza barra non porta da nessuna parte");
  /* E tutto il resto resta del tramite, dentro un «handle» suo: i fili, le
   * segnalazioni e la console non devono finire davanti o dietro ai file a
   * seconda dell'ordine in cui Caddy mette le cose. */
  assert.match(
    blocco[1],
    /handle \{\n\t\treverse_proxy 127\.0\.0\.1:\$PORTA\n\t\}/,
    "il tramite non e' dentro un handle suo",
  );
});

/* ─── `tramite-gettone`, fatto girare per davvero ──────────────────────────
 *
 * Gli altri pezzi scritti dallo script si guardano e basta: vogliono root,
 * systemd, e una macchina. Questo no — questo si puo' **far girare**, e allora
 * si fa girare, perche' e' quello che tocca l'unico file di segreti della
 * macchina e riavvia il servizio.
 *
 * Il banco gli mette intorno tre bugie e nient'altro: un `curl` che risponde
 * quello che gli si dice, un `systemctl` che scrive su un foglio invece di
 * riavviare, un `journalctl` che racconta. E una liberta' sola, questa:
 * `AMBIENTE=/etc/tramite/ambiente` diventa un file nella cartella della prova
 * — se un giorno quella riga cambiasse forma, la prova lo dice invece di
 * provare qualcos'altro.
 *
 * Quello che tiene ferme queste prove, in ordine di quanto costa sbagliarlo:
 *
 *  1. **il gettone non passa mai dagli argomenti di `curl`**. Il `curl` finto
 *     muore se lo vede, ed e' la stessa regola che al livello di sopra guarda
 *     il sorgente: `ps` la legge chiunque sia sulla macchina;
 *  2. **il gettone non si stampa**, nemmeno un pezzo;
 *  3. **un gettone che GitHub rifiuta non si scrive**: quello di prima,
 *     qualunque sia, funziona meglio di uno che non va;
 *  4. il file resta a 600.
 */

function ilGettone() {
  const pezzo = pezziScritti().find((uno) => uno.dove.endsWith("tramite-gettone"));
  assert.ok(pezzo, "lo script `tramite-gettone` non c'e' piu'");
  const riga = "AMBIENTE=/etc/tramite/ambiente";
  assert.ok(
    pezzo.testo.includes(`\n${riga}\n`),
    "«tramite-gettone» non tiene piu' il file dei segreti in una riga sua: questa prova va rifatta",
  );
  return pezzo.testo.replace(`\n${riga}\n`, '\nAMBIENTE="${AMBIENTE_DI_PROVA:?}"\n');
}

/* Un gettone a grana fine ha questa forma: `github_pat_` e altri 82. */
const MEZZO = `${"A".repeat(22)}_${"B".repeat(59)}`;
const INTERO = `github_pat_${MEZZO}`;

const AMBIENTE_DI_PROVA = [
  "CENTRALINO_PORTA=8099",
  "CHIAVE_CONSOLE=unachiavequalunquelunga",
  `GITHUB_SEGNALAZIONI=${INTERO}`,
  "GITHUB_REPO=danigio15/gdahomeapp",
  "GITHUB_REPO_ALLEGATI=danigio15/gdahome-allegati",
  "",
].join("\n");

function unBanco() {
  const cartella = mkdtempSync(join(tmpdir(), "gettone-"));
  const bin = join(cartella, "bin");
  execFileSync("mkdir", ["-p", bin]);

  const dove = join(cartella, "tramite-gettone");
  writeFileSync(dove, ilGettone(), { mode: 0o700 });
  writeFileSync(join(cartella, "ambiente"), AMBIENTE_DI_PROVA, { mode: 0o600 });

  writeFileSync(join(bin, "systemctl"), '#!/bin/sh\necho "$*" >>"$RACCONTO"\n', { mode: 0o755 });
  writeFileSync(
    join(bin, "journalctl"),
    '#!/bin/sh\necho "set 17 tramite[1]: le segnalazioni finiscono su danigio15/gdahomeapp"\n',
    { mode: 0o755 },
  );
  /* Il `curl` finto. Se il gettone gli arriva fra gli argomenti, muore: e'
   * quello che non deve succedere mai. */
  writeFileSync(
    join(bin, "curl"),
    [
      "#!/bin/sh",
      'for a in "$@"; do',
      '  case "$a" in *Bearer*) echo "IL GETTONE ERA FRA GLI ARGOMENTI" >&2; exit 9;; esac',
      "done",
      'case " $* " in',
      '  *"/issues?"*) printf "%s" "${RISPOSTA:-200}" ;;',
      '  *) [ "${PUO_SCRIVERE:-si}" = si ] && echo \'{"push": true}\' || echo \'{"push": false}\' ;;',
      "esac",
    ].join("\n"),
    { mode: 0o755 },
  );

  const ambiente = join(cartella, "ambiente");
  const racconto = join(cartella, "racconto");
  return {
    cartella,
    ambiente,
    gettoneNelFile: () =>
      (readFileSync(ambiente, "utf8").match(/^GITHUB_SEGNALAZIONI=(.*)$/m) || [])[1],
    haRiavviato: () => {
      try {
        return readFileSync(racconto, "utf8").includes("restart tramite");
      } catch (_errore) {
        return false;
      }
    },
    modoDelFile: () => execFileSync("stat", ["-c", "%a", ambiente], { encoding: "utf8" }).trim(),
    lancia: (detti = [], { dentro = "", ...ambienti } = {}) =>
      execFileSync(dove, detti, {
        encoding: "utf8",
        input: dentro,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          AMBIENTE_DI_PROVA: ambiente,
          RACCONTO: racconto,
          ...ambienti,
        },
      }),
    via: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

test("`tramite-gettone` dice come sta, e non dice il gettone", () => {
  const banco = unBanco();
  try {
    const detto = banco.lancia();
    assert.match(detto, /danigio15\/gdahomeapp/, "non dice dove vanno le segnalazioni");
    assert.match(detto, /93 caratteri, comincia con github_pat_/);
    assert.match(detto, /GitHub lo accetta/);
    /* E la cosa che conta: il gettone non c'e' dentro, nemmeno un pezzo. */
    assert.ok(!detto.includes(INTERO), "ha stampato il gettone");
    assert.ok(!detto.includes(MEZZO), "ha stampato un pezzo del gettone");
    assert.ok(!detto.includes("A".repeat(12)), "ha stampato un pezzo del gettone");
  } finally {
    banco.via();
  }
});

test("e quando GitHub lo rifiuta dice **perche'**, dove si puo' fare qualcosa", () => {
  const banco = unBanco();
  try {
    for (const [risposta, cosa] of [
      ["401", /scaduto|revocato/],
      ["403", /Issues deve essere/],
      ["404", /Repository access/],
      ["000", /non ci arriva adesso/],
    ]) {
      const detto = banco.lancia([], { RISPOSTA: risposta });
      assert.match(detto, /GitHub NON lo accetta/, risposta);
      assert.match(detto, cosa, risposta);
    }
  } finally {
    banco.via();
  }
});

test("un gettone nuovo si prova **prima** di metterlo", () => {
  const banco = unBanco();
  try {
    const nuovo = `github_pat_${"C".repeat(22)}_${"D".repeat(59)}`;
    const detto = banco.lancia(["--metti"], { dentro: `${nuovo}\n` });
    assert.match(detto, /GitHub lo accetta, ed e' sulla macchina/);
    assert.equal(banco.gettoneNelFile(), nuovo);
    assert.ok(banco.haRiavviato(), "non ha riavviato il tramite");
    assert.equal(banco.modoDelFile(), "600", "il file dei segreti non e' piu' chiuso");
  } finally {
    banco.via();
  }
});

test("e se GitHub lo rifiuta, quello di prima resta dov'e'", () => {
  /* La riga che conta di tutto lo script. Un gettone scaduto incollato sopra
   * uno che funziona sarebbe le segnalazioni spente senza che nessuno lo
   * sappia — e lo si scoprirebbe il giorno in cui qualcuno chiede aiuto. */
  const banco = unBanco();
  try {
    assert.throws(() =>
      banco.lancia(["--metti"], { dentro: "github_pat_unoqualunque\n", RISPOSTA: "401" }),
    );
    assert.equal(banco.gettoneNelFile(), INTERO, "ha scritto un gettone che non va");
    assert.ok(!banco.haRiavviato(), "ha riavviato il tramite per niente");
  } finally {
    banco.via();
  }
});

test("senza rete lo mette comunque: non poter chiedere non e' un no", () => {
  const banco = unBanco();
  try {
    const nuovo = `github_pat_${"E".repeat(22)}_${"F".repeat(59)}`;
    const detto = banco.lancia(["--metti"], { dentro: `${nuovo}\n`, RISPOSTA: "000" });
    assert.match(detto, /senza averlo potuto provare/);
    assert.equal(banco.gettoneNelFile(), nuovo);
  } finally {
    banco.via();
  }
});

test("un gettone incollato male si raddrizza invece di essere rifiutato", () => {
  const banco = unBanco();
  try {
    /* Spazi, a capo e virgolette intorno: un token incollato da un telefono. */
    const conSporco = `  "${"G".repeat(22)}_${"H".repeat(59)}"  `;
    const detto = banco.lancia(["--metti"], { dentro: `${conSporco}\n` });
    assert.match(detto, /era senza «github_pat_» davanti: rimesso/);
    assert.equal(banco.gettoneNelFile(), `github_pat_${"G".repeat(22)}_${"H".repeat(59)}`);
  } finally {
    banco.via();
  }
});

test("e niente incollato non cambia niente", () => {
  const banco = unBanco();
  try {
    assert.throws(() => banco.lancia(["--metti"], { dentro: "\n" }));
    assert.equal(banco.gettoneNelFile(), INTERO);
    assert.ok(!banco.haRiavviato());
  } finally {
    banco.via();
  }
});

test("`--togli` spegne le segnalazioni, e il resto del tramite lavora", () => {
  const banco = unBanco();
  try {
    banco.lancia(["--togli"]);
    assert.equal(banco.gettoneNelFile(), "");
    assert.ok(banco.haRiavviato());
    assert.match(banco.lancia(), /gettone: non c'e'/);
  } finally {
    banco.via();
  }
});

test("il gettone non si scrive dalla riga di comando, e lo dice", () => {
  /* `ps` la legge chiunque sia sulla macchina. Un comando che accettasse il
   * gettone come argomento sarebbe un comando che invita a farlo. */
  const banco = unBanco();
  try {
    assert.throws(
      () => banco.lancia([INTERO]),
      (male) => /la riga di comando la legge chiunque/.test(String(male.stderr)),
    );
    assert.equal(banco.gettoneNelFile(), INTERO, "l'ha pure scritto");
  } finally {
    banco.via();
  }
});
