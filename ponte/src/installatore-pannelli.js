/* Il lavoro grezzo su un pannello: salvare, installare, abbinare, ripristinare.
 *
 * `pannelli.js` decide COSA fare e segue i passi; qui c'e' il COME, via ADB
 * (`adb.js`). E' l'oggetto che nelle prove si sostituisce con un finto: cosi'
 * l'orchestrazione si prova senza un pannello e senza i veri file di GdAHome OS.
 *
 * I pezzi da mettere sul pannello — l'APK di GdAHome OS, l'app GdAHome Muro,
 * il ponte Zigbee, le animazioni d'avvio — stanno in `cartellaDeiPezzi`.
 * Quelli di GdAHome OS arrivano nell'immagine dell'add-on; l'app GdAHome Muro,
 * che e' privata, la mette il centralino in `/data/muro`. Se un pezzo manca,
 * il passo si ferma con un errore chiaro invece di lasciare il pannello a meta'.
 *
 * L'abbinamento alla casa non si fa qui: `abbinaPannello` (iniettato) crea il
 * dispositivo e il suo gettone come per un telefono, e l'installatore scrive
 * sul pannello il foglietto che GdAHome Muro legge al primo avvio. Cosi' il
 * segreto della casa passa dalla stessa porta cifrata di sempre, non da una
 * scorciatoia.
 */
import { createHash } from "node:crypto";
import { createGzip } from "node:zlib";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  statfsSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { scappa } from "./adb.js";

/* Dove tenere le copie di sicurezza: la cartella condivisa di Home Assistant,
 * che l'utente vede e puo' portare via. */
export const CARTELLA_DELLE_COPIE = "/share/gdahome-os";

/* I pezzi di GdAHome OS, per modello. */
function animazione(modello) {
  return modello === "120" ? "bootanimation-120.zip" : "bootanimation-86.zip";
}

/* Le partizioni che si salvano prima di installare: le sole che
 * l'installazione modifica — quella di sistema e `oem`, dove Sonoff tiene la
 * sua animazione d'avvio e alcune app (256 MB quasi vuoti: compressa e' poco). */
/* Il foglietto dell'abbinamento e l'esito che GdAHome Muro scrive accanto
 * (`app/lib/muro/avvio_muro.dart`), nella cartella `files` dell'app. */
const FOGLIETTO = "abbinamento.json";
const ESITO = "abbinamento.esito";
const ROVINATO = "abbinamento.rovinato";

/* Che pannello e'. Tre famiglie, due strade:
 *  - «nspanel», il Sonoff NSPanel Pro: GdAHome OS **completo**, nel sistema
 *    (root), con la copia di sicurezza prima;
 *  - «shelly», lo Shelly Wall Display, e «android», qualunque altro display
 *    Android con l'ADB di rete: GdAHome **leggero**. Due app installate come
 *    app qualunque, GdAHome OS come schermata home; il sistema non si tocca,
 *    non serve root, non serve copia, e si torna com'era con un tasto.
 * L'NSPanel si riconosce dalle sue due misure di schermo — il suo
 * ro.product.model e' «px30_evb», quello della scheda — o dal nome. */
export function famigliaDelPannello({
  produttore = "",
  marca = "",
  modello = "",
  pacchetti = "",
  gdahomeOs = "",
} = {}) {
  const tutto = `${produttore} ${marca} ${modello}`.toLowerCase();
  if (/shelly/.test(tutto)) return "shelly";
  /* L'NSPanel si riconosce dal suo software — le app Sonoff/eWeLink — o da
   * GdAHome OS completo gia' installato (`ro.gdahome.os` nel build.prop).
   * Non dallo schermo: 480x480 ce l'hanno anche lo Shelly da 4" e tanti
   * display cinesi. */
  if (String(gdahomeOs).trim()) return "nspanel";
  if (/sonoff|nspanel|ewelink|coolkit/i.test(`${tutto} ${pacchetti}`)) return "nspanel";
  return "android";
}
/* La strada non la decide la marca, la decide il pannello: con root e il
 * sistema scrivibile GdAHome OS va **nel sistema** (completo), come sull'NSPanel;
 * senza, si fa tutto quello che Android permette senza root (leggero). */
export const percorsoDelPannello = ({ root, scrivibile }) =>
  root && scrivibile ? "completo" : "leggero";

/* Come si chiama, da mostrare: «Shelly Wall Display», «Lenovo M10». */
export function nomeDelModello({ produttore = "", marca = "", modello = "" } = {}) {
  const pulito = (t) => String(t || "").trim();
  const m = pulito(modello);
  const chi = pulito(marca) || pulito(produttore);
  if (!m) return chi;
  if (!chi || m.toLowerCase().includes(chi.toLowerCase())) return m;
  return `${chi.charAt(0).toUpperCase()}${chi.slice(1)} ${m}`;
}

export const DA_SALVARE = /^(system|oem)(_[ab])?$/i;
/* Dove sta, sul pannello, la fotografia delle partizioni prima che arrivi a
 * Home Assistant (`_fotoSulPannello`). */
export const FOTO = "/data/local/tmp/gdahome-copia";

/* L'app del pannello, una per processore: quella a 64 bit (gli NSPanel, e
 * quasi tutti i display) e quella a 32 bit per chi ha solo quelli. Una sola
 * con dentro tutti e due pesava il doppio, e ogni MB e' tempo sul Wi-Fi di un
 * pannello. */
export const MURO = "GdAHome-Muro.apk";
export const MURO_ARM = "GdAHome-Muro-arm.apk";

/* Le app che non si toccano MAI: senza, Android o GdAHome non funzionano.
 * Lo stesso elenco di `gdahome-os.sh` (KEEP_RE), gia' provato sui pannelli. */
export const DA_TENERE =
  "^(android|com\\.android\\.(systemui|settings|phone|shell|packageinstaller|defcontainer|externalstorage|keychain|certinstaller|location\\.fused|server\\.telecom|bluetooth|nfc|proxyhandler|vpndialogs|statementservice|storagemanager|documentsui|captiveportallogin|provision|se|mtp|inputmethod\\..*|providers\\..*|webview|wallpaperbackup|backupconfirm|sharedstoragebackup|pacprocessor|carrierconfig|managedprovisioning|cts\\..*)|com\\.google\\.android\\.webview|com\\.gdahome\\..*)$";
/* Il software Sonoff / eWeLink, riconosciuto dal nome (SONOFF_RE). */
export const DI_SONOFF = "sonoff|ewelink|itead|coolkit|smatek|nspanel";
/* Le app Android inutili a muro: si tolgono per avere memoria (SUPERFLUE_RE). */
export const SUPERFLUE =
  "^com\\.android\\.(browser|calendar|contacts|dialer|mms|email|exchange|gallery3d|gallery|music|musicfx|camera2?|deskclock|calculator2|soundrecorder|quicksearchbox|launcher3?|wallpaper\\.livepicker|wallpapercropper|dreams\\..*|printspooler|bips|egg|htmlviewer|bookmarkprovider|galaxy4|noisefield|phasebeam|magicsmoke|musicvis|stk|calllogbackup|cellbroadcastreceiver|emergency|smspush|onetimeinitializer|apps\\.tag|printservice\\.recommendation|traceur|companiondevicemanager|wallpaper|webview\\.shell)$";

/* Le righe che aprono in scrittura /system e /oem. /oem e' la partizione di
 * Sonoff: li' stanno la sua animazione d'avvio — che Android 8.1 cerca PRIMA
 * di quella di /system, e quindi vince sulla nostra — e alcune sue app. */
const APRI_IN_SCRITTURA = [
  "mount -o rw,remount /system 2>/dev/null || mount -o rw,remount / 2>/dev/null",
  'touch /system/.gdatest 2>/dev/null && rm -f /system/.gdatest || { echo "GDA_ERR /system non si puo\' scrivere"; exit 1; }',
  "OEM=0; if [ -d /oem ] && mount -o rw,remount /oem 2>/dev/null && touch /oem/.gdatest 2>/dev/null; then rm -f /oem/.gdatest; OEM=1; fi",
];
const CHIUDI_IN_SCRITTURA = [
  "sync",
  "[ $OEM = 1 ] && mount -o ro,remount /oem 2>/dev/null",
  "mount -o ro,remount /system 2>/dev/null || mount -o ro,remount / 2>/dev/null || true",
];

/* Il cuore della pulizia: toglie le app Sonoff e superflue — quelle di
 * /system e /oem spostate in /system/gdahome-removed, quelle di /data salvate
 * in /data/gdahome-removed e disinstallate, ognuna scritta nel suo manifesto —
 * e mette da parte l'animazione Sonoff di /oem. Si puo' rifare quante volte si
 * vuole: quello che e' gia' tolto non si tocca. */
function righeDellaPulizia() {
  return [
    "mkdir -p $R $D",
    "[ -f $R/build.prop.orig ] || cp -p /system/build.prop $R/build.prop.orig",
    /* Il launcher di adesso: su un NSPanel e' quello di Sonoff. */
    "CASA=$(cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME 2>/dev/null | tail -n1 | cut -d/ -f1)",
    "pm list packages -f | sed 's/^package://' > $TMP/gda-app.txt",
    "while IFS= read -r riga; do",
    "  pkg=$(echo \"$riga\" | sed 's/.*=//')",
    "  apk=$(echo \"$riga\" | sed 's/=[^=]*$//')",
    '  [ -n "$pkg" ] || continue',
    '  echo "$pkg" | grep -Eq "$TENERE" && continue',
    '  minuscolo=$(echo "$pkg" | tr A-Z a-z)',
    '  if echo "$minuscolo" | grep -Eq "$SONOFF"; then perche=Sonoff',
    '  elif [ "$pkg" = "$CASA" ] && [ "$pkg" != com.gdahome.os ]; then perche=Sonoff',
    '  elif echo "$pkg" | grep -Eq "$SUPERFLUE"; then perche=superflua',
    /* Tutto quello che qualcuno ha aggiunto (un'app in /data che non e' di
     * Android ne' di GdAHome, come l'app di Home Assistant): sul pannello gira
     * solo GdAHome. Si salva in $D e si toglie, come le altre. */
    '  elif case "$apk" in /data/*) true ;; *) false ;; esac && ! echo "$pkg" | grep -Eqi "webview"; then perche=aggiunta',
    "  else continue; fi",
    '  case "$apk" in',
    "    /data/*)",
    '      cp "$apk" $D/$pkg.apk && pm uninstall "$pkg" >/dev/null 2>&1 && echo "$pkg" >> $D/manifest.txt && echo "TOLTA $pkg ($perche)" ;;',
    "    *)",
    '      case "$apk" in /oem/*) [ $OEM = 1 ] || { echo "RESTA $pkg (/oem non si scrive)"; continue; } ;; esac',
    '      cartella=$(dirname "$apk"); sopra=$(basename "$cartella")',
    '      if [ "$sopra" = app ] || [ "$sopra" = priv-app ]; then via="$apk"; else via="$cartella"; fi',
    '      grep -q "^$pkg|" $R/manifest.txt 2>/dev/null && continue',
    '      mv "$via" $R/$pkg.removed && echo "$pkg|$via" >> $R/manifest.txt && echo "TOLTA $pkg ($perche)" ;;',
    "  esac",
    "done < $TMP/gda-app.txt",
    "rm -f $TMP/gda-app.txt",
    /* L'animazione Sonoff di /oem: finche' c'e', Android mostra quella. */
    "if [ -f /oem/media/bootanimation.zip ]; then",
    '  if [ $OEM = 1 ] && mv /oem/media/bootanimation.zip $R/oem-bootanimation.zip.orig; then echo "TOLTA animazione Sonoff (/oem)"; else echo "RESTA animazione Sonoff (/oem non si scrive)"; fi',
    "fi",
  ];
}

/* La velocita'. Un PX30 lascia il processore e la scheda video al minimo
 * finche' non c'e' lavoro, e ci mette qualche decimo a salire: il primo tocco
 * e il primo scorrimento lo pagano, ed e' lo «scatto» che si sente. Qui:
 *  - il processore non scende sotto due terzi della sua frequenza;
 *  - la scheda video sta alla sua frequenza piena (governatore `performance`);
 * scritto subito, e scritto in `/system/etc/init/gdahome.rc`, che `init`
 * rilegge a ogni accensione — senza, al riavvio tornerebbe tutto com'era.
 * I percorsi si cercano sul pannello, non si indovinano. Il ripristino toglie
 * il file. Stampa «VELOCE cpu <min> gpu <governatore> <dove>». */
function righeDellaVelocita() {
  return [
    "RC=/system/etc/init/gdahome.rc",
    "CPU=''; for p in /sys/devices/system/cpu/cpufreq/policy0 /sys/devices/system/cpu/cpu0/cpufreq; do [ -f $p/scaling_available_frequencies ] && { CPU=$p; break; }; done",
    "MIN=''",
    'if [ -n "$CPU" ]; then',
    "  set -- $(tr ' ' '\\n' < $CPU/scaling_available_frequencies | grep -E '^[0-9]+$' | sort -n)",
    "  n=$#; k=$(( (n * 2 + 2) / 3 )); [ $k -lt 1 ] && k=1",
    '  i=0; for f in "$@"; do i=$((i + 1)); [ $i -eq $k ] && MIN=$f; done',
    "fi",
    "GPU=''; for d in /sys/class/devfreq/*; do case \"$(basename $d)\" in *gpu*) GPU=$d ;; esac; done",
    "GOV=''; [ -n \"$GPU\" ] && grep -qw performance $GPU/available_governors 2>/dev/null && GOV=performance",
    "{",
    "  echo '# GdAHome OS: il pannello sempre pronto (installatore-pannelli.js)'",
    "  echo 'on property:sys.boot_completed=1'",
    '  [ -n "$MIN" ] && echo "    write $CPU/scaling_min_freq $MIN"',
    '  [ -n "$GOV" ] && echo "    write $GPU/governor $GOV"',
    "} > $RC",
    "chmod 644 $RC; chcon u:object_r:system_file:s0 $RC 2>/dev/null || true",
    '[ -n "$MIN" ] && echo $MIN > $CPU/scaling_min_freq 2>/dev/null',
    '[ -n "$GOV" ] && echo $GOV > $GPU/governor 2>/dev/null',
    /* La WebView: rasterizzazione sulla scheda video anche dove il driver e'
     * nella lista nera di Chromium. La legge solo dove Android lo permette
     * (un sistema di debug); altrove non fa niente. */
    "echo '_ --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy' > /data/local/tmp/webview-command-line; chmod 644 /data/local/tmp/webview-command-line",
    'echo "VELOCE cpu ${MIN:-?} gpu ${GOV:-?} ${GPU:-}"',
  ];
}

const INTESTAZIONE = () => [
  "TMP=/data/local/tmp",
  "R=/system/gdahome-removed",
  "D=/data/gdahome-removed",
  `TENERE='${DA_TENERE}'`,
  `SONOFF='${DI_SONOFF}'`,
  `SUPERFLUE='${SUPERFLUE}'`,
];

/* Lo script che gira sul pannello, da root. La pulizia qui sopra, poi
 * GdAHome OS, il ponte Zigbee e l'animazione d'avvio (tenendo l'originale), e
 * l'ADB di rete fisso. Scrive «TOLTA <app>» per ognuna e finisce con GDA_OK,
 * o GDA_ERR <perche'>. */
export function scriptDiSistema() {
  return [
    ...INTESTAZIONE(),
    ...APRI_IN_SCRITTURA,
    ...righeDellaPulizia(),
    "mkdir -p /system/app/GdAHomeOS",
    'cp $TMP/GdAHome-OS.apk /system/app/GdAHomeOS/GdAHomeOS.apk || { echo "GDA_ERR GdAHome OS non si copia in /system"; exit 1; }',
    "chmod 755 /system/app/GdAHomeOS; chmod 644 /system/app/GdAHomeOS/GdAHomeOS.apk",
    "chcon -R u:object_r:system_file:s0 /system/app/GdAHomeOS 2>/dev/null || true",
    "if [ -f $TMP/gdaserial ]; then cp $TMP/gdaserial /system/bin/gdaserial; chmod 755 /system/bin/gdaserial; chcon u:object_r:system_file:s0 /system/bin/gdaserial 2>/dev/null || true; fi",
    "if [ -f $TMP/bootanimation.zip ]; then",
    "  [ -f /system/media/bootanimation.zip ] && [ ! -f $R/bootanimation.zip.orig ] && mv /system/media/bootanimation.zip $R/bootanimation.zip.orig",
    "  mkdir -p /system/media; cp $TMP/bootanimation.zip /system/media/bootanimation.zip; chmod 644 /system/media/bootanimation.zip",
    "  chcon u:object_r:system_file:s0 /system/media/bootanimation.zip 2>/dev/null || true",
    "fi",
    /* L'ADB di rete per sempre: senza le app Sonoff nessuno lo riaccenderebbe. */
    'grep -q "^ro.gdahome.os=" /system/build.prop || printf "\\n# GdAHome OS\\nro.gdahome.os=2\\npersist.sys.gdahome=1\\nservice.adb.tcp.port=5555\\n" >> /system/build.prop',
    "setprop persist.adb.tcp.port 5555",
    ...righeDellaVelocita(),
    ...CHIUDI_IN_SCRITTURA,
    "rm -f $TMP/GdAHome-OS.apk $TMP/bootanimation.zip $TMP/gdaserial",
    "echo GDA_OK",
  ].join("\n");
}

/* Il ritocco: la pulizia e la velocita', su un pannello gia' GdAHome. Serve ai pannelli
 * installati prima che si sapesse di /oem — l'animazione Sonoff restava li' —
 * e gira a ogni aggiornamento: se non c'e' niente da togliere, non fa niente.
 * Quando cambia cosa toglie, si alza RITOCCO e i pannelli lo rifanno. */
/* 1: /oem. 2: la velocita' (processore, scheda video, WebView). 3: la
 * pulizia totale (le app aggiunte, come quella di Home Assistant). */
export const RITOCCO = 3;
export function scriptDelRitocco() {
  return [
    ...INTESTAZIONE(),
    ...APRI_IN_SCRITTURA,
    ...righeDellaPulizia(),
    ...righeDellaVelocita(),
    ...CHIUDI_IN_SCRITTURA,
    "echo GDA_OK",
  ].join("\n");
}

/* Lo script del ripristino: rimette quello che l'installazione ha tolto, da
 * /system e da /data, l'animazione e il build.prop di prima. */
export function scriptDelRipristino() {
  return [
    "R=/system/gdahome-removed",
    "D=/data/gdahome-removed",
    ...APRI_IN_SCRITTURA,
    "if [ -d $R ]; then",
    '  [ -f $R/manifest.txt ] && while IFS="|" read -r pkg via; do [ -e $R/$pkg.removed ] && mv $R/$pkg.removed "$via" && echo "RIMESSA $pkg"; done < $R/manifest.txt',
    "  if [ -f $R/bootanimation.zip.orig ]; then mv $R/bootanimation.zip.orig /system/media/bootanimation.zip; else rm -f /system/media/bootanimation.zip; fi",
    "  [ -f $R/oem-bootanimation.zip.orig ] && mkdir -p /oem/media && mv $R/oem-bootanimation.zip.orig /oem/media/bootanimation.zip && echo RIMESSA animazione Sonoff",
    "  [ -f $R/build.prop.orig ] && cp -p $R/build.prop.orig /system/build.prop",
    "  rm -rf $R",
    "fi",
    "rm -rf /system/app/GdAHomeOS /system/bin/gdaserial /system/etc/init/gdahome.rc",
    "rm -f /data/local/tmp/webview-command-line",
    `rm -rf ${FOTO}`,
    ...CHIUDI_IN_SCRITTURA,
    '[ -f $D/manifest.txt ] && while read -r pkg; do [ -f $D/$pkg.apk ] && pm install -r $D/$pkg.apk >/dev/null 2>&1 && echo "RIMESSA $pkg"; done < $D/manifest.txt',
    "rm -rf $D",
    "echo GDA_OK",
  ].join("\n");
}

export class Installatore {
  constructor({
    adb,
    cartellaDeiPezzi = "/app/muro",
    cartellaDelleCopie = CARTELLA_DELLE_COPIE,
    abbinaPannello = null,
    dispositivi = null,
    scriviCopia = null,
    muroPackage = "com.gdahome.muro",
    attesaDelRiavvio = undefined,
    attesaDellAbbinamento = undefined,
    passoDellaBarra = 2_000,
    indirizzoDiCasa = null,
    copiaDiretta = null,
  } = {}) {
    this.adb = adb;
    this.pezzi = cartellaDeiPezzi;
    this.copie = cartellaDelleCopie;
    this.abbinaPannello = abbinaPannello;
    this.dispositivi = dispositivi;
    /* Come si scrive una partizione sul disco: in streaming da adb, o un
     * finto nelle prove. Prima non c'era nessuno: «Questo add-on non puo'
     * scrivere la copia di sicurezza». */
    this.scriviCopia =
      scriviCopia ||
      ((indirizzo, comando, dove, opzioni) =>
        this.adb.copiaInFile(indirizzo, comando, dove, opzioni));
    this.muroPackage = muroPackage;
    /* Quanto aspettare il pannello dopo il riavvio: corto nelle prove. */
    this.attesaDelRiavvio = attesaDelRiavvio;
    /* Quanto aspettare che il pannello entri nella casa: corto nelle prove. */
    this.attesaDellAbbinamento = attesaDellAbbinamento;
    /* Ogni quanto la barra di una copia guarda quanto e' arrivato. */
    this.passoDellaBarra = passoDellaBarra;
    /* L'indirizzo dell'add-on sulla rete di casa, per la copia diretta. */
    this.indirizzoDiCasa = indirizzoDiCasa;
    this.copiaDiretta =
      copiaDiretta ||
      ((indirizzo, comando, dove, opzioni) =>
        typeof this.adb.copiaDiretta === "function"
          ? this.adb.copiaDiretta(indirizzo, comando, dove, opzioni)
          : Promise.reject(Object.assign(new Error("niente copia diretta"), { causa: "diretta" })));
  }

  _pezzo(nome) {
    return join(this.pezzi, nome);
  }

  _ceIlPezzo(nome) {
    return existsSync(this._pezzo(nome));
  }

  /* Quale app del pannello, per il suo processore: quella a 32 bit solo se il
   * pannello non sa fare i 64 e l'add-on ce l'ha; nel dubbio i 64, che e'
   * quello di tutti i pannelli visti finora. */
  async _muroPerIlPannello(indirizzo) {
    const abi =
      typeof this.adb.getprop === "function"
        ? String(
            (await this.adb.getprop(indirizzo, "ro.product.cpu.abilist").catch(() => "")) || "",
          )
        : "";
    if (abi.trim() && !/arm64-v8a/.test(abi) && this._ceIlPezzo(MURO_ARM)) return MURO_ARM;
    return MURO;
  }

  /* Installazione completa. `avanti({passo, dettaglio, percento})` avvisa la
   * console a ogni passo. Torna { errore?, passoRotto?, os, app, modello, … }. */
  async installa({
    indirizzo,
    planciaId,
    utente,
    nome,
    avanti: dillo,
    fotoDiPrima = null,
    copiaDiPrima = "",
  }) {
    /* Il passo a cui si e' arrivati: un errore inatteso si segna li', non
     * sempre sulla «Verifica». */
    let passo = 0;
    const avanti = (cosa) => {
      passo = cosa.passo ?? passo;
      dillo(cosa);
    };
    try {
      /* 0. I pezzi ci sono? Meglio accorgersene prima di toccare il pannello. */
      const osApk = "GdAHome-OS.apk";
      const muroApk = await this._muroPerIlPannello(indirizzo);
      if (!this._ceIlPezzo(osApk))
        return { errore: "Manca GdAHome OS in questo add-on: aggiornalo.", passoRotto: 2 };
      if (!this._ceIlPezzo(muroApk))
        return {
          errore: "L'app GdAHome Muro non e' ancora arrivata: serve una casa Premium collegata.",
          passoRotto: 2,
        };

      // 1. Verifica
      avanti({ passo: 0, dettaglio: "" });
      if (!(await this.adb.connetti(indirizzo)))
        return { errore: "Il pannello non risponde piu'.", passoRotto: 0 };
      if ((await this.adb.root(indirizzo)) !== "0")
        return { errore: "Il pannello non e' sbloccato (root).", passoRotto: 0 };
      const schermo = (await this._schermo(indirizzo)) || "";
      /* Un NSPanel e' un 86 o un 120; un altro display con root va per la
       * stessa strada, ma senza il nome e senza l'animazione d'avvio del
       * Sonoff, che ha le misure di quei due schermi. */
      const famiglia = (await this.riconosci(indirizzo).catch(() => null))?.famiglia || "nspanel";
      const modello =
        famiglia !== "nspanel" ? "" : schermo === "480x480" ? "86" : schermo ? "120" : "";
      const android = await this.adb.getprop(indirizzo, "ro.build.version.release").catch(() => "");
      avanti({
        passo: 0,
        dettaglio: `NSPanel Pro ${modello || "?"} · Android ${android} · root ok`,
      });

      // 2. Copia di sicurezza: prima la fotografia sul pannello, che e'
      // svelta; se non c'e' posto, la copia di sempre verso Home Assistant.
      //
      // Un nuovo tentativo dopo un errore riusa la copia del tentativo di
      // prima: e' quella del sistema com'era, mentre adesso potrebbe essere
      // gia' cambiato a meta'. E non la si rifa' per niente.
      avanti({ passo: 1, dettaglio: "Leggo le partizioni…" });
      const riusata = fotoDiPrima && (await this._fotoCe(indirizzo, fotoDiPrima));
      if (riusata)
        avanti({
          passo: 1,
          dettaglio: "gia' fatta sul pannello, al tentativo di prima",
          percento: 100,
        });
      else if (copiaDiPrima && existsSync(copiaDiPrima))
        avanti({
          passo: 1,
          dettaglio: `gia' su Home Assistant, dal tentativo di prima (${basename(copiaDiPrima)})`,
          percento: 100,
        });
      const foto =
        riusata || (copiaDiPrima && existsSync(copiaDiPrima))
          ? { gia: true }
          : await this._fotoSulPannello(indirizzo, (dettaglio, percento) =>
              avanti({ passo: 1, dettaglio, percento }),
            );
      const copia = foto.gia
        ? {}
        : foto.foto
          ? { foto: foto.foto }
          : await this._copiaDiSicurezza(
              indirizzo,
              nome || indirizzo,
              (fatte, tutte, quale, percento) =>
                avanti({
                  passo: 1,
                  dettaglio: quale
                    ? `${quale} (${fatte + 1}/${tutte})`
                    : `fatta: ${tutte} partizioni`,
                  percento: percento ?? Math.round((fatte / tutte) * 100),
                }),
            );
      if (copia.errore) return { errore: copia.errore, passoRotto: 1 };
      /* La fotografia sul pannello va su Home Assistant dopo, in sottofondo:
       * lo dice ogni uscita da qui in poi, anche un errore. */
      const daPortare = copia.foto ? { copiaDaPortare: copia.foto } : {};

      /* Ogni passo dice la fase in cui e', con la sua barra: «Installazione»
       * ferma su «Copio i file sul pannello…» non diceva se andava avanti. */
      const fase = (n) => {
        passo = n;
        return (testo, percento) => avanti({ passo: n, dettaglio: testo, percento });
      };

      // 3. Installazione
      const inst = await this._installaOs(indirizzo, modello, osApk, muroApk, fase(2));
      if (inst.errore) return { errore: inst.errore, passoRotto: 2, ...daPortare };
      fase(2)(`Fatto: tolte ${inst.tolte ?? 0} app Sonoff e superflue`, 100);

      // 4. Abbinamento
      const abb = await this._abbina(indirizzo, { nome, utente, planciaId }, fase(3));
      if (abb.errore) return { errore: abb.errore, passoRotto: 3, ...daPortare };
      fase(3)("Fatto: il foglietto e' sul pannello, entra nella casa al riavvio", 100);

      // 5. Riavvio, e GdAHome OS che parte davvero
      fase(4)("Il pannello si riavvia…", 5);
      await this._riavvia(indirizzo);
      const dopo = await this._dopoIlRiavvio(indirizzo, {
        ...this.attesaDelRiavvio,
        dice: fase(4),
      });
      if (dopo.errore) return { errore: dopo.errore, passoRotto: 4, ...daPortare };

      /* E il pannello e' entrato davvero nella casa? GdAHome OS ha aperto
       * GdAHome Muro, che legge il foglietto e si collega. Se non succede, il
       * sistema resta installato — non si butta via niente — ma lo si dice,
       * e il giro degli aggiornamenti riprova l'abbinamento da solo. */
      fase(4)("GdAHome OS e' partito: aspetto che il pannello entri nella casa…", 92);
      const entrato = await this._controllaLAbbinamento(indirizzo, {
        dispositivo: abb.dispositivo,
        dal: abb.dal,
        ...this.attesaDellAbbinamento,
        dice: fase(4),
      });
      if (entrato.abbinato) fase(4)("Fatto: GdAHome OS e' attivo e il pannello e' nella casa", 100);
      await this.adb.stacca(indirizzo);

      return {
        abbinato: entrato.abbinato,
        abbinatoIl: abb.dal,
        ...(entrato.abbinato ? {} : { avviso: entrato.errore, passoRotto: 3 }),
        ritocco: RITOCCO,
        os: inst.os,
        app: inst.versioni?.muro?.nome || abb.app,
        versioni: inst.versioni || null,
        modello,
        schermo,
        dispositivo: abb.dispositivo,
        ...daPortare,
      };
    } catch (errore) {
      return { errore: scusa(errore), passoRotto: passo };
    }
  }

  /* Che pannello c'e' a questo indirizzo: famiglia, strada, nome, schermo,
   * Android, root. Senza root si puo' fare tutto questo. */
  async riconosci(indirizzo) {
    const leggi = (nome) => this.adb.getprop(indirizzo, nome).catch(() => "");
    const produttore = await leggi("ro.product.manufacturer");
    const marca = await leggi("ro.product.brand");
    const modello = await leggi("ro.product.model");
    const android = await leggi("ro.build.version.release");
    const schermo = (await this._schermo(indirizzo)) || "";
    const gdahomeOs = await leggi("ro.gdahome.os");
    const pacchetti = String(
      await this.adb
        .shell(indirizzo, "pm list packages | grep -iE 'ewelink|sonoff|coolkit' | head -n 3", {
          root: false,
        })
        .catch(() => ""),
    );
    const famiglia = famigliaDelPannello({ produttore, marca, modello, pacchetti, gdahomeOs });
    const root = (await this.adb.root?.(indirizzo).catch(() => "")) === "0";
    const scrivibile = root && (await this._sistemaScrivibile(indirizzo));
    return {
      famiglia,
      root,
      scrivibile,
      percorso: percorsoDelPannello({ root, scrivibile }),
      /* L'NSPanel per nome, non per la sua scheda («Rockchip px30_evb»). */
      nome:
        famiglia === "shelly"
          ? "Shelly Wall Display"
          : famiglia === "nspanel"
            ? `NSPanel Pro ${schermo === "480x480" ? "86" : "120"}`
            : nomeDelModello({ produttore, marca, modello }),
      schermo,
      android,
    };
  }

  /* /system si puo' scrivere? No con dm-verity (il sistema montato da un
   * /dev/block/dm-…): li' GdAHome OS nel sistema non ci va. */
  async _sistemaScrivibile(indirizzo) {
    const detto = await this.adb
      .shell(indirizzo, "mount | grep -E ' /system | / ' | head -n1", { root: true })
      .catch(() => "");
    /* Come la verifica di sempre (`pannelli.js`, gia' provata sui pannelli):
     * scrivibile e' tutto quello che non e' dm-verity. */
    return !/\/dev\/block\/dm-/.test(String(detto));
  }

  /* Le app da spegnere su un pannello senza root: il launcher del produttore
   * — la sua interfaccia, il «secondo sistema» — e le app inutili a muro.
   * Mai quelle di base di Android (DA_TENERE), mai la WebView ne' i servizi
   * Google, mai GdAHome. Sullo Shelly la sua app resta accesa: e' lei che
   * comanda i rele' e legge i sensori, e senza root nessun altro puo'. */
  async _daSpegnere(indirizzo, { famiglia, casaDiPrima }) {
    const elenco = String(
      await this.adb.shell(indirizzo, "pm list packages -e", { root: false }).catch(() => ""),
    )
      .split("\n")
      .map((r) => r.replace(/^package:/, "").trim())
      .filter(Boolean);
    const tenere = new RegExp(DA_TENERE);
    const superflue = new RegExp(SUPERFLUE);
    const casa = String(casaDiPrima || "").split("/")[0];
    /* Le app aggiunte da qualcuno (`-3`): si spengono anche quelle. */
    const aggiunte = new Set(
      String(
        await this.adb.shell(indirizzo, "pm list packages -3 -e", { root: false }).catch(() => ""),
      )
        .split("\n")
        .map((r) => r.replace(/^package:/, "").trim())
        .filter(Boolean),
    );
    return elenco.filter((pkg) => {
      if (tenere.test(pkg) || /^com\.gdahome\./.test(pkg)) return false;
      if (/^com\.google\.android\.(gms|gsf)$|webview/i.test(pkg)) return false;
      if (famiglia === "shelly" && /shelly/i.test(pkg)) return false;
      return pkg === casa || superflue.test(pkg) || aggiunte.has(pkg);
    });
  }

  /* La copia del software di un pannello senza root: gli APK delle app che si
   * spengono, su Home Assistant (/share/gdahome-os/<pannello>-<data>/app/),
   * con un elenco. Se un giorno una non si riaccende, si reinstalla da qui. */
  async _copiaDelleApp(indirizzo, nome, quali, dice = () => {}) {
    const dir = join(this.copie, `${cartellaSicura(nome)}-${dataPerCartella(new Date())}`, "app");
    mkdirSync(dir, { recursive: true });
    const elenco = [];
    for (let k = 0; k < quali.length; k += 1) {
      const pkg = quali[k];
      dice(`Copio ${pkg} (${k + 1}/${quali.length})…`, Math.round((k / quali.length) * 100));
      const percorsi = String(
        await this.adb.shell(indirizzo, `pm path ${pkg}`, { root: false }).catch(() => ""),
      )
        .split("\n")
        .map((r) => r.replace(/^package:/, "").trim())
        .filter((r) => r.endsWith(".apk"));
      const sua = join(dir, pkg);
      mkdirSync(sua, { recursive: true });
      const presi = [];
      for (const remoto of percorsi) {
        const locale = join(sua, remoto.split("/").pop());
        try {
          await this.adb.pull(indirizzo, remoto, locale);
          presi.push(remoto.split("/").pop());
        } catch (_e) {
          /* Un APK che senza root non si legge: l'app resta spenta, e si
           * riaccende lo stesso. */
        }
      }
      elenco.push({ pkg, apk: presi });
    }
    writeFileSync(join(dir, "app.json"), `${JSON.stringify(elenco, null, 2)}\n`);
    return { dir, elenco };
  }

  /* GdAHome leggero: per lo Shelly Wall Display e per ogni display Android.
   *
   * Niente root, niente partizioni, niente copia di sicurezza: si installano
   * GdAHome Muro e GdAHome OS come app qualunque, GdAHome OS diventa la
   * schermata home, lo schermo resta acceso, e il pannello entra nella casa.
   * Le app del produttore restano tutte: sullo Shelly i rele' e i sensori li
   * tiene la sua app, e resta li'. Tornare com'era (`togliGdAHome`) vuol dire
   * rimettere la home di prima e togliere le due app.
   *
   * Passi: 0 verifica, 1 installazione, 2 abbinamento, 3 avvio. */
  async installaLeggero({ indirizzo, planciaId, utente, nome, avanti }) {
    const fase = (passo) => (testo, percento) => avanti({ passo, dettaglio: testo, percento });
    try {
      const muroApk = await this._muroPerIlPannello(indirizzo);
      for (const p of ["GdAHome-OS.apk", muroApk])
        if (!this._ceIlPezzo(p))
          return {
            errore: "Mancano i pezzi di GdAHome in questo add-on: aggiornalo.",
            passoRotto: 2,
          };
      /* La copia va su Home Assistant: senza dove scriverla, non si comincia. */
      try {
        mkdirSync(this.copie, { recursive: true });
      } catch (errore) {
        return {
          errore: `Non riesco a creare la cartella della copia (${this.copie}): ${errore.code || errore.message}.`,
          passoRotto: 1,
        };
      }

      // 0. Verifica
      fase(0)("Mi collego al pannello…", 10);
      if (!(await this.adb.connetti(indirizzo)))
        return { errore: "Il pannello non risponde piu'.", passoRotto: 0 };
      const chi = await this.riconosci(indirizzo);
      if (Number.parseInt(chi.android, 10) < 8)
        return {
          errore: `Serve Android 8 o piu' nuovo: questo ha Android ${chi.android}.`,
          passoRotto: 0,
        };
      fase(0)(`${chi.nome || "Pannello Android"} · Android ${chi.android}`, 100);

      // 1. La copia del software del produttore
      /* La home di prima, per tornarci: l'ultima riga di resolve-activity. */
      const casaDiPrima =
        String(
          await this.adb
            .shell(
              indirizzo,
              "cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME",
              { root: false },
            )
            .catch(() => ""),
        )
          .trim()
          .split("\n")
          .pop()
          ?.trim() || "";
      const spente = await this._daSpegnere(indirizzo, { famiglia: chi.famiglia, casaDiPrima });
      const copia = await this._copiaDelleApp(indirizzo, nome || indirizzo, spente, fase(1));
      fase(1)(`Fatto: copiate ${spente.length} app del produttore su Home Assistant`, 100);

      // 2. Installazione
      await this._installaConLaBarra(indirizzo, muroApk, {
        nome: "l'app GdAHome Muro",
        permessi: true,
        dice: (t, pc) => fase(2)(t, Math.round((pc ?? 0) * 0.45)),
      });
      await this._installaConLaBarra(indirizzo, "GdAHome-OS.apk", {
        nome: "GdAHome OS",
        dice: (t, pc) => fase(2)(t, 45 + Math.round((pc ?? 0) * 0.45)),
      });
      fase(2)("GdAHome OS diventa la schermata home, lo schermo resta acceso…", 92);
      await this._impostazioniLeggere(indirizzo);
      /* Il software del produttore si spegne solo adesso, con GdAHome gia'
       * home: il pannello non resta mai senza una schermata. */
      for (const pkg of spente)
        await this.adb
          .shell(indirizzo, `pm disable-user --user 0 ${pkg}`, { root: false })
          .catch(() => {});
      fase(2)(`Fatto: GdAHome e' installato, ${spente.length} app del produttore spente`, 100);

      // 3. Abbinamento
      const abb = await this._abbina(indirizzo, { nome, utente, planciaId, viaApp: true }, fase(3));
      if (abb.errore)
        return { errore: abb.errore, passoRotto: 3, casaDiPrima, spente, copia: copia.dir };
      fase(3)("Fatto: il foglietto e' arrivato all'app", 100);

      // 4. Avvio
      fase(4)("Apro GdAHome…", 30);
      await this._riapriIlMuro(indirizzo);
      await this.adb
        .shell(indirizzo, "am start -n com.gdahome.os/.ui.AvvioActivity", { root: false })
        .catch(() => {});
      const entrato = await this._controllaLAbbinamento(indirizzo, {
        dispositivo: abb.dispositivo,
        dal: abb.dal,
        ...this.attesaDellAbbinamento,
        dice: fase(4),
      });
      if (entrato.abbinato) fase(4)("Fatto: GdAHome e' sul pannello, nella casa", 100);
      const versioni = await this.versioniSulPannello(indirizzo);
      await this.adb.stacca(indirizzo);
      return {
        os: versioni.os?.nome || "",
        app: versioni.muro?.nome || abb.app,
        versioni,
        modello: "",
        nomeDelModello: chi.nome,
        famiglia: chi.famiglia,
        percorso: "leggero",
        schermo: chi.schermo,
        casaDiPrima,
        spente,
        copia: copia.dir,
        dispositivo: abb.dispositivo,
        abbinato: entrato.abbinato,
        abbinatoIl: abb.dal,
        ritocco: RITOCCO,
        ...(entrato.abbinato ? {} : { avviso: entrato.errore, passoRotto: 3 }),
      };
    } catch (errore) {
      return { errore: scusa(errore) };
    }
  }

  /* Le impostazioni del muro che si possono dare senza root: la home, lo
   * schermo sempre acceso (lo spegne e lo riaccende la plancia), niente
   * salvaschermo, animazioni corte, e le due app mai fermate dal risparmio. */
  async _impostazioniLeggere(indirizzo) {
    const righe = [
      "cmd package set-home-activity com.gdahome.os/.ui.AvvioActivity",
      "settings put system screen_off_timeout 2147483647",
      "settings put global stay_on_while_plugged_in 7",
      "settings put secure screensaver_enabled 0",
      "settings put global window_animation_scale 0",
      "settings put global transition_animation_scale 0",
      "settings put global animator_duration_scale 0.5",
      "dumpsys deviceidle whitelist +com.gdahome.os",
      `dumpsys deviceidle whitelist +${this.muroPackage}`,
      "appops set com.gdahome.os WRITE_SETTINGS allow",
      `appops set ${this.muroPackage} RUN_IN_BACKGROUND allow`,
    ];
    for (const r of righe) await this.adb.shell(indirizzo, r, { root: false }).catch(() => {});
  }

  /* Togliere GdAHome leggero: la home di prima, lo schermo che si spegne da
   * solo, e le due app tolte. Il pannello torna com'era: niente da
   * ripristinare, perche' niente era stato tolto. */
  async togliGdAHome({ indirizzo, casaDiPrima = "", spente = [], copia = "", avanti = () => {} }) {
    try {
      if (!(await this.adb.connetti(indirizzo))) return { errore: "Il pannello non risponde." };
      /* 1. Il software del produttore torna acceso: se un'app non c'e' piu',
       * la si reinstalla dalla copia su Home Assistant. */
      avanti({ passo: 0, dettaglio: "Riaccendo il software del produttore…" });
      const nonTornate = [];
      for (const pkg of spente) {
        if (!/^[\w.]+$/.test(pkg)) continue;
        const ce = String(
          await this.adb.shell(indirizzo, `pm path ${pkg}`, { root: false }).catch(() => ""),
        ).includes("package:");
        if (!ce) {
          const apk = join(copia, pkg);
          const elenco = existsSync(apk) ? readdirSync(apk).filter((f) => f.endsWith(".apk")) : [];
          if (elenco.length === 1)
            await this.adb.install(indirizzo, join(apk, elenco[0])).catch(() => {});
          else if (elenco.length > 1)
            await this.adb
              .comando?.([
                "-s",
                this.adb._dev?.(indirizzo) ?? indirizzo,
                "install-multiple",
                "-r",
                ...elenco.map((f) => join(apk, f)),
              ])
              .catch(() => {});
        }
        const detto = await this.adb
          .shell(indirizzo, `pm enable ${pkg}`, { root: false })
          .catch(() => "");
        if (!/enabled/.test(String(detto))) nonTornate.push(pkg);
      }
      if (/^[\w.]+\/[\w.$]+$/.test(casaDiPrima))
        await this.adb
          .shell(indirizzo, `cmd package set-home-activity ${casaDiPrima}`, { root: false })
          .catch(() => {});
      for (const r of [
        "settings put system screen_off_timeout 60000",
        "settings put global window_animation_scale 1",
        "settings put global transition_animation_scale 1",
        "settings put global animator_duration_scale 1",
      ])
        await this.adb.shell(indirizzo, r, { root: false }).catch(() => {});
      if (nonTornate.length)
        return {
          errore: `Non si sono riaccese: ${nonTornate.join(", ")}. GdAHome resta, cosi' il pannello non rimane senza schermata: riprova.`,
        };
      /* 2. Solo adesso, col produttore tornato, si tolgono le app di GdAHome. */
      avanti({ passo: 1, dettaglio: "Tolgo le app di GdAHome…" });
      for (const pkg of [this.muroPackage, "com.gdahome.os"])
        await this.adb.shell(indirizzo, `pm uninstall ${pkg}`, { root: false }).catch(() => {});
      await this.adb.stacca(indirizzo);
      return { fatto: true };
    } catch (errore) {
      return { errore: scusa(errore) };
    }
  }

  async _schermo(indirizzo) {
    const detto = await this.adb.shell(indirizzo, "wm size", { root: false }).catch(() => "");
    const m = /(\d+)x(\d+)/.exec(String(detto).replace(/.*:/, ""));
    return m ? `${m[1]}x${m[2]}` : "";
  }

  /* Le partizioni da salvare (`DA_SALVARE`) e quanto pesano: { byName, nomi,
   * misure, totale } o { errore }. */
  async _lePartizioni(indirizzo) {
    let byName = "";
    try {
      byName = (
        await this.adb.shell(
          indirizzo,
          'for d in /dev/block/by-name /dev/block/platform/*/by-name /dev/block/platform/*/*/by-name; do [ -d "$d" ] && { echo "$d"; break; }; done; true',
          { root: true },
        )
      ).trim();
    } catch (_e) {
      /* niente */
    }
    if (!byName) return { errore: "Non trovo le partizioni del pannello." };
    let nomi = [];
    try {
      nomi = (await this.adb.shell(indirizzo, `ls ${scappa(byName)}`, { root: true }))
        .split(/\s+/)
        .filter(Boolean)
        /* Solo quella che l'installazione modifica: `system` (o system_a /
         * system_b). Le altre non si toccano, e copiarle riempiva la
         * cartella di Home Assistant di giga che non servono a niente. */
        .filter((p) => DA_SALVARE.test(p));
    } catch (_e) {
      return { errore: "Non riesco a elencare le partizioni." };
    }
    if (!nomi.length) return { errore: "Non trovo la partizione di sistema del pannello." };

    /* Quanto pesa, partizione per partizione. */
    const misure = {};
    let totale = 0;
    for (const p of nomi) {
      /* blockdev, e se non c'e' la misura dal kernel (settori da 512 byte). */
      const via = scappa(`${byName}/${p}`);
      const detto = await this.adb
        .shell(
          indirizzo,
          `blockdev --getsize64 ${via} 2>/dev/null || echo $(( $(cat /sys/class/block/$(basename $(readlink -f ${via}))/size) * 512 ))`,
          { root: true },
        )
        .catch(() => "");
      const n = Number(String(detto).trim());
      misure[p] = Number.isFinite(n) && n > 0 ? n : 0;
      totale += misure[p];
    }
    return { byName, nomi, misure, totale };
  }

  /* La copia di sicurezza: ogni partizione del pannello (tranne i dati
   * dell'utente e la cache) in /share/gdahome-os/<pannello>-<data>/, nella
   * cartella condivisa di Home Assistant, dove chi ci abita la vede e la puo'
   * portare via. Ogni partizione arriva in streaming (`copiaInFile`), e vale
   * solo se byte e md5 tornano con quelli letti sul pannello. Prima di
   * cominciare si guarda che su Home Assistant ci sia posto.
   *
   * Con `foto` la copia parte dai file che `_fotoSulPannello` ha gia' fatto
   * sul pannello (`<cartella>/<partizione>.img`), non dalle partizioni: e'
   * il viaggio in sottofondo, a GdAHome OS gia' installato. */
  async _copiaDiSicurezza(indirizzo, nome, avanti, { foto = null } = {}) {
    /* Una copia nuova riprova la diretta, anche se l'ultima volta non e' andata. */
    this._senzaDiretta?.delete(indirizzo);
    const parti = foto
      ? {
          nomi: Object.keys(foto.partizioni || {}),
          misure: { ...foto.partizioni },
          totale: Object.values(foto.partizioni || {}).reduce((a, b) => a + (Number(b) || 0), 0),
        }
      : await this._lePartizioni(indirizzo);
    if (parti.errore) return parti;
    const { byName, nomi, misure, totale } = parti;
    if (!nomi.length) return { errore: "La copia sul pannello non dice quali partizioni ha." };
    const quando = foto?.quando ? new Date(foto.quando) : new Date();

    /* Il posto su Home Assistant, con un margine. */
    const dir = join(this.copie, `${cartellaSicura(nome)}-${dataPerCartella(quando)}`);
    try {
      mkdirSync(dir, { recursive: true });
    } catch (errore) {
      return {
        errore: `Non riesco a creare la cartella della copia (${this.copie}): ${errore.code || errore.message}.`,
      };
    }
    const liberi = this.spazioLibero(this.copie);
    if (liberi != null && totale && liberi < totale * 1.05 + 200 * 1024 ** 2) {
      rmSync(dir, { recursive: true, force: true });
      return {
        errore: `Non c'e' posto per la copia di sicurezza su Home Assistant: servono ${inGB(totale)} GB, liberi ${inGB(liberi)} GB.`,
      };
    }

    const righe = [];
    let copiati = 0;
    for (let i = 0; i < nomi.length; i += 1) {
      const p = nomi[i];
      /* La barra segue i byte copiati in tutto, non le partizioni: una di
       * pochi KB e una di un giga non pesano uguale. */
      const percento = (fattiOra) =>
        totale ? Math.round(((copiati + fattiOra) / totale) * 100) : undefined;
      avanti(
        i,
        nomi.length,
        misure[p] ? `${p} · ${mostraByte(misure[p])} · calcolo l'impronta sul pannello…` : p,
        percento(0),
      );
      try {
        const sorgente = scappa(foto ? `${foto.cartella}/${p}.img` : `${byName}/${p}`);
        /* L'impronta sul pannello: la copia deve tornare con questa. */
        const atteso = String(
          await this.adb.shell(indirizzo, `md5sum ${sorgente}`, {
            root: true,
            attesa: 15 * 60_000,
          }),
        )
          .trim()
          .split(/\s+/)[0];
        const partito = Date.now();
        const esito = await this._copiaUnaPartizione(indirizzo, {
          sorgente,
          /* Compressa: lo spazio vuoto dell'immagine non occupa posto. */
          dove: join(dir, `${p}.img.gz`),
          misura: misure[p],
          atteso: /^[0-9a-f]{32}$/.test(atteso) ? atteso : "",
          avanzamento: (byte, modo = "") => {
            const secondi = Math.max(1, (Date.now() - partito) / 1000);
            const alSecondo = byte / secondi;
            const velocita = `${(alSecondo / 1024 ** 2).toFixed(1).replace(".", ",")} MB/s`;
            /* Quanto manca a tutta la copia, alla velocita' di adesso. */
            const restano = Math.max(0, totale - copiati - byte);
            const minuti = alSecondo > 0 ? Math.ceil(restano / alSecondo / 60) : 0;
            const manca = minuti > 0 ? ` · mancano ~${minuti} min` : "";
            avanti(
              i,
              nomi.length,
              `${p} · ${mostraByte(byte)} di ${mostraByte(misure[p] || byte)} · ${velocita}${modo ? ` ${modo}` : ""}${manca}`,
              percento(byte),
            );
          },
        });
        if (esito.errore) {
          /* Una copia a meta' non serve a niente: non resta su /share. */
          rmSync(dir, { recursive: true, force: true });
          return { errore: `Copia di ${p}: ${esito.errore}` };
        }
        copiati += misure[p] || 0;
        righe.push(`${esito.md5}  ${p}.img`);
      } catch (errore) {
        rmSync(dir, { recursive: true, force: true });
        return { errore: `Copia di ${p} non riuscita: ${errore.message || errore}.` };
      }
    }
    /* Le impronte sono quelle delle immagini com'erano sul pannello: si
     * verificano dopo averle scompattate (`gunzip -k system.img.gz`). */
    writeFileSync(join(dir, "MD5SUMS"), `${righe.join("\n")}\n`);
    writeFileSync(
      join(dir, "info.json"),
      `${JSON.stringify({ pannello: nome, indirizzo, quando: quando.toISOString(), partizioni: misure, compressa: "gzip" }, null, 2)}\n`,
    );
    avanti(nomi.length, nomi.length, "");
    return { dir };
  }

  /* La fotografia sul pannello: le partizioni da salvare copiate in file su
   * /data del pannello stesso, da memoria a memoria. Ci mette un minuto o
   * due, contro la mezz'ora del Wi-Fi di un pannello lento (l'86 fa 0,5
   * MB/s): chi installa non aspetta la rete. Il paracadute c'e' gia' prima
   * di toccare il sistema, e verso Home Assistant ci va dopo, in sottofondo
   * (`portaLaCopia`). Torna { foto }, { nonCiSta } se sul pannello non c'e'
   * posto, o { errore }. */
  /* La fotografia di un tentativo di prima e' ancora sul pannello, intera? */
  async _fotoCe(indirizzo, foto) {
    const nomi = Object.keys(foto?.partizioni || {});
    if (!foto?.cartella || !nomi.length) return false;
    for (const p of nomi) {
      const n = Number(
        String(
          await this.adb
            .shell(indirizzo, `stat -c %s ${foto.cartella}/${p}.img 2>/dev/null`, { root: true })
            .catch(() => ""),
        ).trim(),
      );
      if (n !== Number(foto.partizioni[p])) return false;
    }
    return true;
  }

  async _fotoSulPannello(indirizzo, avanti = () => {}) {
    try {
      return await this._fotografa(indirizzo, avanti);
    } catch (errore) {
      /* Qualunque inciampo qui non ferma l'installazione: si torna alla
       * copia per la rete, che c'era prima. */
      console.error(`[pannelli] fotografia sul pannello ${indirizzo}:`, errore);
      await this.adb.shell(indirizzo, `rm -rf ${FOTO}`, { root: true }).catch(() => {});
      return { nonCiSta: true, perche: errore?.message || String(errore) };
    }
  }

  async _fotografa(indirizzo, avanti) {
    const parti = await this._lePartizioni(indirizzo);
    if (parti.errore) return parti;
    const { byName, nomi, misure, totale } = parti;
    if (!totale || nomi.some((p) => !misure[p])) return { nonCiSta: true };
    const liberi = await this._liberiSulPannello(indirizzo);
    if (liberi == null || liberi < totale + 300 * 1024 ** 2) return { nonCiSta: true, liberi };
    const cartella = FOTO;
    await this.adb.shell(indirizzo, `rm -rf ${cartella}; mkdir -p ${cartella}`, { root: true });
    const partito = Date.now();
    let fatti = 0;
    for (let i = 0; i < nomi.length; i += 1) {
      const p = nomi[i];
      const file = `${cartella}/${p}.img`;
      const dice = (byte) => {
        const secondi = Math.max(1, (Date.now() - partito) / 1000);
        const alSecondo = (fatti + byte) / secondi;
        const restano = Math.max(0, totale - fatti - byte);
        const s = alSecondo > 0 ? Math.ceil(restano / alSecondo) : 0;
        const manca = s > 0 ? ` · ${s < 90 ? `~${s} s` : `~${Math.ceil(s / 60)} min`}` : "";
        avanti(
          `${p} · ${mostraByte(byte)} di ${mostraByte(misure[p])} sul pannello${manca} (${i + 1}/${nomi.length})`,
          Math.round(((fatti + byte) / totale) * 100),
        );
      };
      dice(0);
      let fermo = false;
      const guarda = (async () => {
        while (!fermo) {
          await dorme(this.passoDellaBarra);
          if (fermo) break;
          const n = Number(
            String(
              await this.adb
                .shell(indirizzo, `stat -c %s ${file} 2>/dev/null`, { root: true })
                .catch(() => ""),
            ).trim(),
          );
          if (!fermo && Number.isFinite(n) && n > 0) dice(Math.min(n, misure[p]));
        }
      })();
      let misurato = NaN;
      try {
        const detto = await this.adb.shell(
          indirizzo,
          `dd if=${scappa(`${byName}/${p}`)} of=${file} bs=4194304 2>/dev/null; sync; stat -c %s ${file} 2>/dev/null`,
          { root: true, attesa: 20 * 60_000 },
        );
        misurato = Number(String(detto).trim().split(/\s+/).pop());
      } catch (_e) {
        /* Si vede qui sotto: la misura non torna. */
      } finally {
        fermo = true;
        await guarda;
      }
      if (misurato !== misure[p]) {
        await this.adb.shell(indirizzo, `rm -rf ${cartella}`, { root: true }).catch(() => {});
        return { errore: `la copia di ${p} sul pannello non e' completa.` };
      }
      fatti += misure[p];
    }
    return { foto: { cartella, partizioni: misure, quando: new Date().toISOString() } };
  }

  /* Ferma la copia in viaggio: si chiude chi legge la fotografia sul
   * pannello, e la copia finisce lì (non arrivata). Serve quando sul
   * pannello c'e' da lavorare: la linea e' una sola. */
  async fermaLaCopia(indirizzo) {
    /* Solo chi la legge (`dd if=…`), non chi la scrive; e la parentesi
     * quadra fa si' che il comando non trovi se stesso. */
    const chi = `if=${FOTO.replace(/a$/, "[a]")}`;
    await this.adb.shell(indirizzo, `pkill -f '${chi}' 2>/dev/null; true`, {
      root: true,
      attesa: 15_000,
    });
  }

  /* Il viaggio in sottofondo: la fotografia sul pannello va su Home
   * Assistant (compressa, con le sue impronte, come la copia di sempre), e
   * poi si toglie dal pannello. `avanti(detto, percento)`. Torna { dir }, o
   * { errore } — con `persa` se sul pannello la fotografia non c'e' piu'. */
  async portaLaCopia({ indirizzo, nome, foto, avanti = () => {} }) {
    try {
      if (!(await this.adb.connetti(indirizzo))) return { errore: "Il pannello non risponde." };
      const ci = String(
        await this.adb
          .shell(
            indirizzo,
            Object.keys(foto.partizioni || {})
              .map((p) => `[ -f ${foto.cartella}/${p}.img ] || echo MANCA`)
              .join("; ") + "; echo FINE",
            { root: true },
          )
          .catch(() => ""),
      );
      if (!/FINE/.test(ci)) return { errore: "Il pannello non risponde." };
      if (/MANCA/.test(ci)) return { errore: "La copia sul pannello non c'e' piu'.", persa: true };
      const copia = await this._copiaDiSicurezza(
        indirizzo,
        nome || indirizzo,
        (_fatte, _tutte, quale, percento) => avanti(quale, percento),
        { foto },
      );
      if (copia.errore) return copia;
      await this.adb.shell(indirizzo, `rm -rf ${foto.cartella}`, { root: true }).catch(() => {});
      return { dir: copia.dir };
    } catch (errore) {
      return { errore: scusa(errore) };
    }
  }

  /* Una partizione, con le sue prove. Prima in streaming, due volte: dopo i
   * dati il pannello manda 1 MB di zeri, cosi' se `exec-out` perde la fine
   * (succede, su Android 8: «STSN incompleta, 257514 byte su 262144») perde
   * gli zeri e non i dati; si tengono esattamente `misura` byte. Se non torna
   * ancora, il piano B: la partizione in un file sul pannello, scaricata con
   * `adb pull`, che conta i byte uno per uno. Torna { md5 } o { errore }. */
  async _copiaUnaPartizione(indirizzo, { sorgente, dove, misura, atteso, avanzamento = null }) {
    /* Senza ne' la misura ne' l'impronta del pannello non si saprebbe se la
     * copia e' buona: una copia vuota passerebbe per buona. Meglio fermarsi
     * prima di toccare il pannello che avere un paracadute vuoto. */
    if (!misura && !atteso)
      return {
        errore: "non riesco a misurare la partizione sul pannello (ne' dimensione ne' impronta).",
      };
    const buona = ({ byte, md5 }) =>
      byte > 0 && (!misura || byte === misura) && (!atteso || md5 === atteso);
    let ultimo = null;

    /* Prima la copia diretta (connessione di rete, non adb): e' la veloce.
     * Se il pannello non riesce a collegarsi — niente `nc`, o la rete non
     * lascia — lo si ricorda **per quel pannello e per quella copia**, e non
     * la si riprova sulle partizioni dopo. Prima lo si ricordava per tutti i
     * pannelli e per sempre: un inciampo solo, e ogni copia dopo andava col
     * vecchio adb a 0,4 MB/s. */
    const verso = this.indirizzoDiCasa?.() || "";
    this._senzaDiretta ??= new Set();
    const nc =
      misura && verso && !this._senzaDiretta.has(indirizzo)
        ? await this._ncDelPannello(indirizzo)
        : "";
    if (nc) {
      /* Se il pannello sa comprimere, comprime lui: sul filo passa molto meno
       * (vedi `copiaDiretta`). Senza coda di zeri: sulla connessione diretta
       * non si perde niente per strada, e la misura la dice lo scompattato. */
      const gz = await this._gzipDelPannello(indirizzo);
      const diretta = await this.copiaDiretta(
        indirizzo,
        gz
          ? `dd if=${sorgente} bs=4194304 2>/dev/null | ${gz} -1`
          : `{ dd if=${sorgente} bs=4194304; dd if=/dev/zero bs=1048576 count=1; } 2>/dev/null`,
        dove,
        {
          verso,
          nc,
          limite: misura,
          avanzamento:
            avanzamento && ((b) => avanzamento(b, gz ? "diretta, compressa" : "diretta")),
          comprimi: !gz,
          compressoDalPannello: Boolean(gz),
        },
      ).catch((e) => ({ errore: e.message || String(e), causa: e.causa }));
      if (!diretta.errore && buona(diretta)) return { md5: diretta.md5 };
      if (diretta.causa === "diretta") this._senzaDiretta.add(indirizzo);
      ultimo = diretta;
    }
    for (let tentativo = 0; tentativo < 2; tentativo += 1) {
      const comando = misura
        ? `{ dd if=${sorgente} bs=4194304; dd if=/dev/zero bs=1048576 count=1; } 2>/dev/null`
        : `dd if=${sorgente} bs=4194304 2>/dev/null`;
      ultimo = await this.scriviCopia(indirizzo, comando, dove, {
        limite: misura || 0,
        comprimi: true,
        avanzamento: avanzamento && ((b) => avanzamento(b, "via adb")),
      }).catch((e) => ({ errore: e.message || String(e) }));
      if (!ultimo.errore && buona(ultimo)) return { md5: ultimo.md5 };
    }

    /* Il piano B, se sul pannello c'e' posto per la partizione intera. */
    const liberi = await this._liberiSulPannello(indirizzo);
    if (misura && liberi != null && liberi > misura + 200 * 1024 ** 2) {
      const tmp = "/data/local/tmp/gda-copia.img";
      try {
        await this.adb.shell(
          indirizzo,
          `dd if=${sorgente} of=${tmp} bs=4194304 2>/dev/null && chmod 644 ${tmp}`,
          { root: true, attesa: 30 * 60_000 },
        );
        /* Si scarica com'e', si misura, poi si comprime e il grezzo va via. */
        const grezzo = `${dove}.grezzo`;
        await this.adb.pull(indirizzo, tmp, grezzo);
        const copia = await impronta(grezzo);
        await comprimiIlFile(grezzo, dove);
        rmSync(grezzo, { force: true });
        if (buona(copia)) return { md5: copia.md5 };
        ultimo = copia;
      } catch (errore) {
        ultimo = { errore: errore.message || String(errore) };
      } finally {
        await this.adb.shell(indirizzo, `rm -f ${tmp}`, { root: true }).catch(() => {});
      }
    }
    if (ultimo?.errore) return { errore: `non riuscita (${ultimo.errore}).` };
    if (misura && ultimo && ultimo.byte !== misura)
      return { errore: `e' incompleta (${ultimo.byte} byte su ${misura}).` };
    return { errore: "non torna con l'originale (md5 diverso)." };
  }

  /* Il `nc` del pannello, chiesto una volta per pannello. Si ricorda solo
   * quando c'e': un «niente» puo' essere un pannello occupato che non ha
   * risposto, e ricordato voleva dire niente copia diretta per sempre. */
  async _ncDelPannello(indirizzo) {
    this._nc ??= new Map();
    if (this._nc.has(indirizzo)) return this._nc.get(indirizzo);
    const nc =
      typeof this.adb.ncSulPannello === "function"
        ? await this.adb.ncSulPannello(indirizzo).catch(() => "")
        : "";
    if (nc) this._nc.set(indirizzo, nc);
    return nc;
  }

  /* Il `gzip` del pannello (o quello di toybox), o "" se non c'e'. Chiesto
   * una volta per pannello, ricordato solo se c'e'. */
  async _gzipDelPannello(indirizzo) {
    this._gz ??= new Map();
    if (this._gz.has(indirizzo)) return this._gz.get(indirizzo);
    const detto = String(
      await this.adb
        .shell(
          indirizzo,
          "command -v gzip 2>/dev/null || { toybox gzip --help >/dev/null 2>&1 && echo 'toybox gzip'; }",
          { root: true, attesa: 10_000 },
        )
        .catch(() => ""),
    )
      .trim()
      .split("\n")
      .pop()
      .trim();
    const gz = /(^|\/)gzip$|^toybox gzip$/.test(detto) ? detto : "";
    if (gz) this._gz.set(indirizzo, gz);
    return gz;
  }

  /* I byte liberi in /data sul pannello, o null. */
  async _liberiSulPannello(indirizzo) {
    const detto = await this.adb
      .shell(indirizzo, "df -k /data | tail -n1", { root: true })
      .catch(() => "");
    const numeri = String(detto)
      .trim()
      .split(/\s+/)
      .filter((c) => /^\d+$/.test(c))
      .map(Number);
    /* blocchi, usati, liberi: il terzo numero, in KB. */
    return numeri.length >= 3 ? numeri[2] * 1024 : null;
  }

  /* I byte liberi dove vanno le copie, o null se non si sa. */
  spazioLibero(dove) {
    /* La cartella delle copie nasce alla prima copia: prima si misura quella
     * esistente piu' vicina (/share). Prima diceva «non misurato». */
    let qui = dove;
    for (let i = 0; i < 8 && qui; i += 1) {
      try {
        const s = statfsSync(qui);
        return Number(s.bavail) * Number(s.bsize);
      } catch (_e) {
        const su = dirname(qui);
        if (su === qui) break;
        qui = su;
      }
    }
    return null;
  }

  /* Installa GdAHome OS: l'app GdAHome Muro, GdAHome OS come app di sistema,
   * il ponte Zigbee e l'animazione d'avvio, e **toglie il software Sonoff** e
   * le app inutili a muro, mettendole da parte perche' «Rimetti Sonoff» le
   * possa rimettere. E' l'installazione di `gdahome-os.sh install` (repository
   * di GdAHome OS), fatta tutta dall'add-on. */
  async _installaOs(indirizzo, modello, osApk, muroApk, dice = () => {}) {
    const tmp = "/data/local/tmp";
    /* Le fasi, nell'ordine: la barra avanza di una a ogni fase. */
    const fasi = 6;
    const a = (k, testo) => dice(`${testo} (${k}/${fasi})`, Math.round(((k - 1) / fasi) * 100));
    try {
      /* Prima l'app GdAHome Muro (l'interfaccia): se qualcosa va storto dopo,
       * il pannello ce l'ha gia'. */
      /* Come negli aggiornamenti: per la strada diretta e con la barra. Con
       * `adb install` sul Wi-Fi lento dell'86 si restava minuti fermi su
       * «Installo l'app GdAHome Muro…», senza sapere se andava avanti. */
      const dentro = (k) => (testo, percento) =>
        dice(
          `${testo} (${k}/${fasi})`,
          Math.round(((k - 1 + Math.min(100, percento ?? 0) / 100) / fasi) * 100),
        );
      a(1, "Installo l'app GdAHome Muro…");
      await this._installaConLaBarra(indirizzo, muroApk, {
        nome: "l'app GdAHome Muro",
        permessi: true,
        dice: dentro(1),
      });
      /* La WebView, se c'e' il pezzo e serve. */
      if (this._ceIlPezzo("webview.apk"))
        await this.adb.install(indirizzo, this._pezzo("webview.apk")).catch(() => {});
      /* I pezzi di sistema. */
      a(2, "Copio GdAHome OS sul pannello…");
      await this._portaSu(indirizzo, osApk, `${tmp}/GdAHome-OS.apk`, "GdAHome OS", dentro(2));
      const anim = modello ? animazione(modello) : "";
      a(3, "Copio l'animazione d'avvio…");
      if (anim && this._ceIlPezzo(anim))
        await this._portaSu(
          indirizzo,
          anim,
          `${tmp}/bootanimation.zip`,
          "l'animazione d'avvio",
          dentro(3),
        );
      const serial = "gdaserial-arm64-v8a";
      a(4, "Copio il ponte Zigbee…");
      if (this._ceIlPezzo(serial))
        await this.adb.push(indirizzo, this._pezzo(serial), `${tmp}/gdaserial`).catch(() => {});

      /* Lo script va sul pannello come file e si lancia da li': un comando di
       * cento righe passato a `su -c` attraverso `adb exec-out` e' fragile. */
      a(5, "Tolgo il software Sonoff e metto GdAHome OS nel sistema…");
      await this._mandaLoScript(indirizzo, `${tmp}/gda-os.sh`, scriptDiSistema());
      const esito = await this.adb.shell(indirizzo, `sh ${tmp}/gda-os.sh`, {
        root: true,
        attesa: 5 * 60_000,
      });
      if (!/GDA_OK/.test(esito)) {
        const perche = (/GDA_ERR (.*)/.exec(esito) || [])[1];
        return {
          errore: perche
            ? `La modifica del sistema non e' andata: ${perche}.`
            : "La modifica del sistema non e' andata a buon fine.",
        };
      }
      const tolte = (esito.match(/^TOLTA /gm) || []).length;

      /* GdAHome OS come schermata home, e il sistema da pannello a muro. */
      a(6, `Sistemo il pannello per il muro (tolte ${tolte} app)…`);
      await this.adb
        .shell(indirizzo, "cmd package set-home-activity com.gdahome.os/.ui.AvvioActivity", {
          root: true,
        })
        .catch(() => {});
      await this._impostazioni(indirizzo);
      const pezzi = this.versioniDeiPezzi();
      return { os: pezzi?.os?.nome || "2.0.0", versioni: pezzi, tolte };
    } catch (errore) {
      return { errore: scusa(errore) };
    }
  }

  /* Scrive un file di testo sul pannello: dal disco dell'add-on con `adb
   * push`, poi lo si intesta a root. */
  async _mandaLoScript(indirizzo, dove, testo) {
    const locale = join(mkdtempSync(join(tmpdir(), "gda-")), "script.sh");
    writeFileSync(locale, `${testo}\n`);
    try {
      await this.adb.push(indirizzo, locale, dove);
    } finally {
      rmSync(dirname(locale), { recursive: true, force: true });
    }
  }

  /* Il pannello da muro: sempre acceso (lo schermo lo gestisce GdAHome),
   * leggero, senza scansioni in sottofondo, e GdAHome OS e GdAHome Muro mai
   * fermati dal risparmio energetico. Come `alleggerisci` di gdahome-os.sh. */
  async _impostazioni(indirizzo) {
    const righe = [
      "settings put system screen_off_timeout 2147483647",
      "settings put global stay_on_while_plugged_in 7",
      "settings put secure screensaver_enabled 0",
      "settings put global policy_control immersive.full=*",
      /* Una sola app a tutto schermo: le transizioni fra finestre non
       * servono, e su questo chip costano fotogrammi. Le animazioni dentro
       * le app (animator) restano, piu' corte. */
      "settings put global window_animation_scale 0",
      "settings put global transition_animation_scale 0",
      "settings put global animator_duration_scale 0.5",
      "settings put global wifi_scan_always_enabled 0",
      "settings put global ble_scan_always_enabled 0",
      "settings put global wifi_sleep_policy 2",
      "settings put secure location_mode 0",
      "settings put global package_verifier_enable 0",
      "settings put global device_name GdAHome",
      "settings put global adb_enabled 1",
      "appops set com.gdahome.os WRITE_SETTINGS allow",
      "dumpsys deviceidle whitelist +com.gdahome.os",
      `dumpsys deviceidle whitelist +${this.muroPackage}`,
      `appops set ${this.muroPackage} RUN_IN_BACKGROUND allow`,
      `pm grant ${this.muroPackage} android.permission.RECORD_AUDIO`,
    ];
    for (const r of righe) await this.adb.shell(indirizzo, r, { root: true }).catch(() => {});
  }

  /* Fa entrare il pannello nella casa come un telefono abbinato, e scrive sul
   * pannello il foglietto che GdAHome Muro legge al primo avvio. */
  async _abbina(
    indirizzo,
    { nome, utente, planciaId, sostituisce = "", viaApp = false },
    dice = () => {},
  ) {
    if (!this.abbinaPannello) return { errore: "Questo add-on non sa abbinare i pannelli." };
    dice("Creo il pannello nella casa, come un telefono abbinato… (1/2)", 0);
    let abb;
    try {
      /* `sostituisce`: un pannello che si riabbina riprende il suo posto, non
       * ne occupa un altro (`dispositivi.abbina`). */
      abb = await this.abbinaPannello({
        nome,
        utente,
        plancia: planciaId,
        sistema: "muro",
        sostituisce,
      });
    } catch (errore) {
      return { errore: scusa(errore) };
    }
    if (!abb?.dispositivo || !abb?.segno)
      return { errore: "L'abbinamento non ha dato un gettone." };
    /* Da quando si guarda se il pannello si e' collegato
     * (`_controllaLAbbinamento`): dopo l'abbinamento, che da solo segna il
     * dispositivo «visto adesso» quando riprende un posto. */
    const dal = Date.now();
    /* Il foglietto: dove entrare (la rete di casa), per chi, con quale gettone
     * e quale plancia. GdAHome Muro lo legge e si collega come un telefono. */
    const foglietto = JSON.stringify({
      v: 1,
      dispositivo: abb.dispositivo,
      segno: abb.segno,
      chiave: abb.chiave || "",
      utente: utente || "",
      plancia: planciaId || "",
      case: abb.case || null,
    });
    /* Il foglietto va nella cartella dell'app GdAHome Muro, non in una cartella
     * di root: l'app gira come utente normale e una cartella di root non la
     * leggerebbe. Lo si scrive li' come root, poi lo si intesta all'utente
     * dell'app (il suo uid) e gli si rimette l'etichetta SELinux della cartella,
     * cosi' l'app lo legge come un suo file qualunque (`avvio_muro.dart`). */
    const pkg = this.muroPackage;
    const dir = `/data/data/${pkg}/files`;
    /* Senza root (GdAHome leggero) la cartella dell'app non si raggiunge: il
     * foglietto lo consegna l'app stessa, con un messaggio che solo l'ADB puo'
     * mandarle (`IlFoglietto.kt`, protetto da DUMP, un permesso che le app
     * non hanno). In base64: nel comando non ci sono virgolette da sbagliare. */
    if (viaApp) {
      try {
        dice("Mando il foglietto all'app GdAHome Muro… (2/2)", 50);
        const detto = await this.adb.shell(
          indirizzo,
          `am broadcast -f 0x20 -n ${pkg}/com.gdahome.gdahome.IlFoglietto -a com.gdahome.FOGLIETTO --es foglietto ${Buffer.from(foglietto).toString("base64")}`,
          { root: false },
        );
        if (!/result=-1\b/.test(String(detto)))
          return {
            errore:
              "L'app GdAHome Muro non ha preso il foglietto: aggiorna l'add-on, l'app sul pannello e' di prima.",
          };
      } catch (errore) {
        return { errore: scusa(errore) };
      }
      return { dispositivo: abb.dispositivo, app: abb.app || "", dal };
    }
    try {
      /* L'uid dell'app, da dumpsys: "userId=10234". */
      const detto = await this.adb.shell(indirizzo, `dumpsys package ${pkg} | grep -m1 userId=`, {
        root: true,
      });
      const uid = (/userId=(\d+)/.exec(detto) || [])[1];
      if (!uid) return { errore: "L'app GdAHome Muro non risulta installata." };
      /* Il foglietto va sul pannello come file (con `adb push`), non come
       * testo su piu' righe dentro `su -c`: e' fragile. Poi da root lo si
       * mette nella cartella dell'app, e **cartella e file** si intestano
       * all'app: una cartella `files` creata da root resterebbe di root, e
       * l'app non ci potrebbe piu' scrivere niente. */
      dice("Mando al pannello il foglietto per entrare in casa… (2/2)", 50);
      await this._mandaLoScript(indirizzo, "/data/local/tmp/gda-abbinamento.json", foglietto);
      const base = `/data/data/${pkg}`;
      const esito = await this.adb.shell(
        indirizzo,
        [
          `mkdir -p ${dir}`,
          /* L'esito di prima non vale piu': quello nuovo lo scrive l'app. */
          `rm -f ${dir}/${ESITO} ${dir}/${ROVINATO}`,
          `cp /data/local/tmp/gda-abbinamento.json ${dir}/abbinamento.json`,
          `rm -f /data/local/tmp/gda-abbinamento.json`,
          `chown ${uid}:${uid} ${dir} ${dir}/abbinamento.json`,
          `chmod 771 ${dir}; chmod 600 ${dir}/abbinamento.json`,
          `restorecon -R ${base} 2>/dev/null || chcon -R u:object_r:app_data_file:s0:c512,c768 ${dir} 2>/dev/null`,
          `[ -s ${dir}/abbinamento.json ] && echo GDA_OK`,
        ].join("; "),
        { root: true },
      );
      if (!/GDA_OK/.test(esito))
        return { errore: "Il foglietto dell'abbinamento non e' arrivato sul pannello." };
    } catch (errore) {
      return { errore: scusa(errore) };
    }
    return { dispositivo: abb.dispositivo, app: abb.app || "", dal };
  }

  /* Il pannello e' entrato davvero nella casa? Prima si diceva «fatto» appena
   * il foglietto era sul pannello, e se GdAHome Muro non riusciva a leggerlo
   * il pannello chiedeva il codice senza che nessuno lo sapesse. Adesso si
   * guarda la casa — il dispositivo del pannello si e' fatto vedere dopo
   * l'abbinamento — e l'esito che GdAHome Muro scrive accanto al foglietto
   * (`avvio_muro.dart`): «OK», o «ERRORE <perche'>». Se dopo un po' l'app non
   * ha ancora letto niente, la si apre. */
  async _controllaLAbbinamento(
    indirizzo,
    { dispositivo, dal = 0, attesa = 90_000, pausa = 3_000, dice = () => {} } = {},
  ) {
    const dir = `/data/data/${this.muroPackage}/files`;
    const partito = Date.now();
    let riaperta = false;
    let letto = "";
    for (;;) {
      if (this._collegato(dispositivo, dal)) return { abbinato: true };
      letto = await this.adb
        .shell(
          indirizzo,
          `cat ${dir}/${ESITO} 2>/dev/null; [ -f ${dir}/${FOGLIETTO} ] && echo GDA_FOGLIETTO`,
          { root: true },
        )
        .catch(() => "");
      const male = (/^ERRORE (.*)$/m.exec(letto) || [])[1];
      if (male)
        return {
          abbinato: false,
          errore: `GdAHome Muro non e' riuscito a entrare nella casa: ${male.trim()}.`,
        };
      const ok = /^OK\b/m.test(letto);
      /* Senza la casa da guardare (sul banco) basta l'esito dell'app. */
      if (ok && this._collegato(dispositivo, dal) === null) return { abbinato: true };
      const passati = Date.now() - partito;
      if (passati >= attesa) break;
      /* Il foglietto e' ancora li' e nessun esito: l'app non e' partita. */
      if (!riaperta && !ok && passati >= Math.min(20_000, attesa / 3)) {
        riaperta = true;
        await this._riapriIlMuro(indirizzo);
      }
      const secondi = Math.round(passati / 1000);
      dice(
        ok
          ? `GdAHome Muro ha letto il foglietto: aspetto che si colleghi alla casa… ${secondi} s`
          : `Aspetto che GdAHome Muro entri nella casa… ${secondi} s`,
        Math.min(95, 10 + Math.round((passati / attesa) * 85)),
      );
      await dorme(pausa);
    }
    if (/^OK\b/m.test(letto))
      return {
        abbinato: false,
        errore:
          "GdAHome Muro ha letto il foglietto ma non si collega alla casa: controlla che il pannello raggiunga Home Assistant sulla rete di casa.",
      };
    if (/GDA_FOGLIETTO/.test(letto))
      return {
        abbinato: false,
        errore: "GdAHome Muro non ha letto il foglietto dell'abbinamento: non si e' aperto.",
      };
    return { abbinato: false, errore: "Il pannello non si e' collegato alla casa." };
  }

  /* Il dispositivo del pannello si e' fatto vedere dalla casa dopo `dal`?
   * `null` se non si puo' sapere (nessuna casa da guardare). */
  _collegato(dispositivo, dal = 0) {
    if (!dispositivo || typeof this.dispositivi?.elenco !== "function") return null;
    const uno = this.dispositivi.elenco().find((d) => d.id === dispositivo);
    return Boolean(uno && Number(uno.vistoIl) > dal);
  }

  /* Chiude e riapre GdAHome Muro, che al riavvio legge il foglietto. */
  async _riapriIlMuro(indirizzo) {
    /* Senza root: l'utente dell'ADB puo' fermare e aprire un'app, e su un
     * display senza root `su` non c'e'. */
    for (const r of [
      `am force-stop ${this.muroPackage}`,
      `monkey -p ${this.muroPackage} -c android.intent.category.LAUNCHER 1`,
    ])
      await this.adb.shell(indirizzo, r, { root: false }).catch(() => {});
  }

  async _riavvia(indirizzo) {
    await this.adb
      .shell(indirizzo, "svc power reboot || reboot", { root: true, attesa: 15_000 })
      .catch(() => {});
  }

  /* Dopo il riavvio: si aspetta che il pannello torni e finisca di partire,
   * poi si fa quello che prima del riavvio non si poteva — GdAHome OS diventa
   * un'app solo al riavvio, quindi solo adesso Android accetta la schermata
   * home, i permessi e il risparmio energetico per lui — e si guarda che sia
   * davvero li'. Come `gdahome-os.sh install` dopo `aspetta_avvio`. */
  async _dopoIlRiavvio(indirizzo, { attesa = 5 * 60_000, pausa = 5_000, dice = () => {} } = {}) {
    const partito = Date.now();
    const fino = partito + attesa;
    /* Il tempo che passa, nella riga: un pannello che si riavvia sta un paio
     * di minuti senza dire niente, e senza un segno sembra fermo. */
    const quanto = () => {
      const secondi = Math.round((Date.now() - partito) / 1000);
      /* La barra arriva all'80% verso i due minuti, poi ci resta. */
      dice(
        `Aspetto che il pannello torni… ${secondi} s`,
        Math.min(80, 10 + Math.round((secondi / 120) * 70)),
      );
    };
    quanto();
    /* Il pannello ci mette un po' a spegnersi: non lo si prende mentre va giu'. */
    for (const fine = Date.now() + Math.min(20_000, attesa / 4); Date.now() < fine;) {
      await dorme(Math.min(2_000, Math.max(10, fine - Date.now())));
      quanto();
    }
    let pronto = false;
    while (Date.now() < fino) {
      const ok = await this.adb.connetti(indirizzo).catch(() => false);
      if (ok) {
        const avviato = await this.adb
          .shell(indirizzo, "getprop sys.boot_completed", { root: false })
          .catch(() => "");
        if (String(avviato).trim() === "1") {
          pronto = true;
          break;
        }
      }
      quanto();
      await dorme(pausa);
    }
    if (!pronto)
      return {
        errore:
          "Il pannello non e' tornato dopo il riavvio. Aspetta qualche minuto: se non si accende con GdAHome, usa «Rimetti Sonoff» o la copia di sicurezza.",
      };
    dice("Il pannello e' tornato: imposto GdAHome OS come schermata home…", 90);
    for (const r of [
      "cmd package set-home-activity com.gdahome.os/.ui.AvvioActivity",
      "appops set com.gdahome.os WRITE_SETTINGS allow",
      "dumpsys deviceidle whitelist +com.gdahome.os",
      "am start -n com.gdahome.os/.ui.AvvioActivity",
    ])
      await this.adb.shell(indirizzo, r, { root: true }).catch(() => {});
    const dove = await this.adb
      .shell(indirizzo, "pm path com.gdahome.os", { root: false })
      .catch(() => "");
    if (!/GdAHomeOS/.test(dove))
      return { errore: "Dopo il riavvio GdAHome OS non risulta installato nel sistema." };
    return { fatto: true };
  }

  riavvia({ indirizzo }) {
    return this._riavvia(indirizzo).then(() => ({ fatto: true }));
  }

  /* Le versioni dei pezzi che l'add-on ha con se', scritte dalla CI accanto
   * agli APK (`versioni.json`): { os: {codice, nome}, muro: {codice, nome} }.
   * Null se il file non c'e' (un add-on costruito a mano). */
  versioniDeiPezzi() {
    try {
      const v = JSON.parse(readFileSync(this._pezzo("versioni.json"), "utf8"));
      return { os: v["com.gdahome.os"] || null, muro: v[this.muroPackage] || null };
    } catch (_e) {
      return null;
    }
  }

  /* Le versioni installate sul pannello, da `dumpsys package`. Un pezzo che
   * non c'e' torna null. */
  async versioniSulPannello(indirizzo) {
    const leggi = async (pkg) => {
      const detto = await this.adb
        .shell(indirizzo, `dumpsys package ${pkg} | grep -m2 -E 'versionCode=|versionName='`, {
          root: false,
        })
        .catch(() => "");
      const codice = Number((/versionCode=(\d+)/.exec(detto) || [])[1]);
      const nome = (/versionName=(\S+)/.exec(detto) || [])[1] || "";
      return Number.isFinite(codice) && codice > 0 ? { codice, nome } : null;
    };
    return { os: await leggi("com.gdahome.os"), muro: await leggi(this.muroPackage) };
  }

  /* Cosa c'e' da aggiornare: ogni pezzo dell'add-on piu' nuovo di quello sul
   * pannello (o che sul pannello manca). Mai indietro: un numero piu' basso
   * non si installa. */
  daAggiornare(sulPannello, pezzi = this.versioniDeiPezzi()) {
    if (!pezzi) return [];
    const quali = [];
    for (const chi of ["muro", "os"]) {
      const nuovo = pezzi[chi];
      const ce = sulPannello?.[chi];
      if (nuovo && (!ce || nuovo.codice > ce.codice)) quali.push(chi);
    }
    return quali;
  }

  /* Aggiorna quello che e' indietro, installando sopra: la firma e' la
   * stessa, quindi restano dati, abbinamento e impostazioni. Prima l'app,
   * poi GdAHome OS, che la riapre da solo. Poi il ritocco (`scriptDelRitocco`:
   * quello che un'installazione di prima aveva lasciato di Sonoff), e se il
   * pannello non e' mai entrato nella casa (`abbina`) lo si riabbina: nuovo
   * foglietto, GdAHome Muro riaperto, e si guarda che entri davvero.
   * Passi: 0 app, 1 GdAHome OS, 2 ritocco, 3 abbinamento. */
  async aggiorna({ indirizzo, avanti = () => {}, abbina = null, percorso = "completo" }) {
    try {
      if (!(await this.adb.connetti(indirizzo))) return { errore: "Il pannello non risponde." };
      const prima = await this.versioniSulPannello(indirizzo);
      const quali = this.daAggiornare(prima);
      /* Ogni passo con la sua barra: «App GdAHome Muro» ferma su un cerchio
       * che gira per minuti non diceva se andava avanti. */
      const fase = (passo) => (testo, percento) => avanti({ passo, dettaglio: testo, percento });
      avanti({ passo: 0 });
      const muroApk = await this._muroPerIlPannello(indirizzo);
      if (quali.includes("muro") && this._ceIlPezzo(muroApk)) {
        await this._installaConLaBarra(indirizzo, muroApk, {
          nome: "l'app GdAHome Muro",
          permessi: true,
          dice: fase(0),
        });
        for (const r of [
          `dumpsys deviceidle whitelist +${this.muroPackage}`,
          `appops set ${this.muroPackage} RUN_IN_BACKGROUND allow`,
        ])
          await this.adb.shell(indirizzo, r, { root: true }).catch(() => {});
      } else fase(0)("Gia' all'ultima versione", 100);
      avanti({ passo: 1 });
      if (quali.includes("os") && this._ceIlPezzo("GdAHome-OS.apk"))
        await this._installaConLaBarra(indirizzo, "GdAHome-OS.apk", {
          nome: "GdAHome OS",
          dice: fase(1),
        });
      else fase(1)("Gia' all'ultima versione", 100);

      /* Il ritocco e' del sistema: su un pannello leggero non c'e' niente da
       * ritoccare, e senza root non si potrebbe. Li' si rimettono le sue
       * impostazioni (home, schermo acceso), che un utente puo' aver cambiato. */
      const ritocco =
        percorso === "leggero"
          ? await this._impostazioniLeggere(indirizzo).then(() => ({ fatto: true, tolte: [] }))
          : await this._colTempo(fase(2), "Tolgo quello che resta di Sonoff…", 30_000, () =>
              this._ritocca(indirizzo),
            );
      fase(2)(
        ritocco.fatto
          ? `Fatto${ritocco.tolte?.length ? `: tolte ${ritocco.tolte.length} cose di Sonoff` : ""}`
          : "Non riuscita: si riprova al prossimo giro",
        100,
      );

      let abbinato = null;
      let avviso = "";
      let dispositivo = "";
      let abbinatoIl = 0;
      if (abbina) {
        const fase = (testo, percento) => avanti({ passo: 3, dettaglio: testo, percento });
        const abb = await this._abbina(
          indirizzo,
          {
            nome: abbina.nome,
            utente: abbina.utente,
            planciaId: abbina.planciaId,
            sostituisce: abbina.dispositivo || "",
            viaApp: percorso === "leggero",
          },
          fase,
        );
        if (abb.errore) {
          abbinato = false;
          avviso = abb.errore;
        } else {
          dispositivo = abb.dispositivo;
          abbinatoIl = abb.dal;
          /* GdAHome Muro e' gia' aperto: lo si riapre, cosi' legge il foglietto. */
          await this._riapriIlMuro(indirizzo);
          if (percorso === "leggero")
            await this.adb
              .shell(indirizzo, "am start -n com.gdahome.os/.ui.AvvioActivity", { root: false })
              .catch(() => {});
          const entrato = await this._controllaLAbbinamento(indirizzo, {
            dispositivo: abb.dispositivo,
            dal: abb.dal,
            ...this.attesaDellAbbinamento,
            dice: fase,
          });
          abbinato = entrato.abbinato;
          avviso = entrato.abbinato ? "" : entrato.errore;
        }
      }

      const dopo = await this.versioniSulPannello(indirizzo);
      await this.adb.stacca(indirizzo);
      return {
        app: dopo.muro?.nome || "",
        os: dopo.os?.nome || "",
        versioni: dopo,
        aggiornati: quali,
        ritocco: ritocco.fatto ? RITOCCO : 0,
        tolte: ritocco.tolte || [],
        ...(abbina ? { abbinato, dispositivo, abbinatoIl } : {}),
        ...(avviso ? { avviso } : {}),
      };
    } catch (errore) {
      return { errore: scusa(errore) };
    }
  }

  /* Installa un pezzo con la sua barra vera. Prima lo copia sul pannello —
   * e intanto guarda quanti byte sono arrivati, cosi' la barra dice MB,
   * velocita' e quanto manca, non un tempo inventato — poi lo installa da li'
   * con `pm install`. `adb install` faceva tutto in un colpo e non diceva
   * niente fino alla fine: su un pannello lento, minuti di cerchio che gira. */
  async _installaConLaBarra(indirizzo, pezzo, { nome, permessi = false, dice = () => {} }) {
    const locale = this._pezzo(pezzo);
    const misura = statSync(locale).size || 1;
    const remoto = `/data/local/tmp/gda-${pezzo}`;
    const partito = Date.now();
    dice(`Copio ${nome} sul pannello (${mostraByte(misura)})…`, 0);
    /* Prima la strada diretta (rete, non adb), come la copia di sicurezza ma
     * nel verso opposto: a 0,8 MB/s un'app da 100 MB erano due minuti. */
    if (await this._mandaDiretto(indirizzo, locale, remoto, misura, nome, dice, partito)) {
      return this._installaDaQui(indirizzo, remoto, { nome, permessi, dice });
    }
    let finito = false;
    const copia = this.adb.push(indirizzo, locale, remoto).finally(() => {
      finito = true;
    });
    /* Quanto e' arrivato: la misura del file sul pannello, ogni due secondi. */
    const guarda = (async () => {
      while (!finito) {
        await dorme(this.passoDellaBarra);
        if (finito) break;
        const detto = await this.adb
          .shell(indirizzo, `stat -c %s ${remoto} 2>/dev/null`, { root: false, attesa: 10_000 })
          .catch(() => "");
        const byte = Math.min(misura, Number(String(detto).trim()) || 0);
        if (!byte || finito) continue;
        const secondi = Math.max(1, (Date.now() - partito) / 1000);
        const alSecondo = byte / secondi;
        const minuti = Math.ceil((misura - byte) / alSecondo / 60);
        dice(
          `Copio ${nome}: ${mostraByte(byte)} di ${mostraByte(misura)} · ${(alSecondo / 1024 ** 2)
            .toFixed(1)
            .replace(".", ",")} MB/s via adb${minuti > 0 ? ` · mancano ~${minuti} min` : ""}`,
          Math.round((byte / misura) * 85),
        );
      }
    })();
    try {
      await copia;
    } finally {
      finito = true;
      await guarda;
    }
    return this._installaDaQui(indirizzo, remoto, { nome, permessi, dice });
  }

  /* Manda un pezzo per la strada diretta e guarda che sul pannello sia
   * arrivato intero. `true` se e' andata; `false` se non si puo' (niente
   * `nc`, niente indirizzo di casa, il pannello non si collega), e allora si
   * va con adb. Come la copia, se non va la si lascia stare per quel pannello. */
  async _mandaDiretto(indirizzo, locale, remoto, misura, nome, dice, partito) {
    const verso = this.indirizzoDiCasa?.() || "";
    this._senzaDiretta ??= new Set();
    if (!verso || typeof this.adb.mandaDiretto !== "function") return false;
    if (this._senzaDiretta.has(indirizzo)) return false;
    const nc = await this._ncDelPannello(indirizzo);
    if (!nc) return false;
    try {
      await this.adb.mandaDiretto(indirizzo, locale, remoto, {
        verso,
        nc,
        avanzamento: (byte) => {
          const secondi = Math.max(1, (Date.now() - partito) / 1000);
          const alSecondo = byte / secondi;
          const minuti = Math.ceil((misura - byte) / alSecondo / 60);
          dice(
            `Copio ${nome}: ${mostraByte(byte)} di ${mostraByte(misura)} · ${(alSecondo / 1024 ** 2)
              .toFixed(1)
              .replace(".", ",")} MB/s diretta${minuti > 0 ? ` · mancano ~${minuti} min` : ""}`,
            Math.round((byte / misura) * 85),
          );
        },
      });
      /* Intero sul pannello? `nc` finisce di scrivere da se': si guarda. */
      for (let k = 0; k < 20; k += 1) {
        const detto = await this.adb
          .shell(indirizzo, `stat -c %s ${remoto} 2>/dev/null`, { root: false, attesa: 10_000 })
          .catch(() => "");
        if (Number(String(detto).trim()) === misura) return true;
        await dorme(this.passoDellaBarra / 2);
      }
      return false;
    } catch (errore) {
      if (errore?.causa === "diretta") this._senzaDiretta.add(indirizzo);
      return false;
    }
  }

  /* Un pezzo sul pannello, dove serve: per la strada diretta con la barra,
   * o con `adb push` se quella non va. */
  async _portaSu(indirizzo, pezzo, remoto, nome, dice = () => {}) {
    const locale = this._pezzo(pezzo);
    const misura = statSync(locale).size || 1;
    if (await this._mandaDiretto(indirizzo, locale, remoto, misura, nome, dice, Date.now())) return;
    await this.adb.push(indirizzo, locale, remoto);
  }

  /* Installa da /data/local/tmp quello che c'e' gia' sul pannello. */
  async _installaDaQui(indirizzo, remoto, { nome, permessi = false, dice = () => {} }) {
    dice(`Installo ${nome}…`, 90);
    const esito = await this.adb.shell(
      indirizzo,
      `pm install -r ${permessi ? "-g " : ""}${remoto}; rm -f ${remoto}`,
      { root: false, attesa: 5 * 60_000 },
    );
    if (!/Success/.test(esito)) {
      const perche =
        (/Failure \[([^\]]+)\]/.exec(esito) || [])[1] || String(esito).trim().split("\n")[0];
      throw new Error(`${nome} non si installa${perche ? ` (${perche})` : ""}.`);
    }
    dice(`Fatto: ${nome} aggiornata`, 100);
  }

  /* Un lavoro che non dice quanto gli manca: la barra va col tempo che passa,
   * verso il novanta per cento di quanto ci si aspetta, coi secondi scritti.
   * Si ferma quando il lavoro finisce. */
  async _colTempo(dice, testo, atteso, lavoro) {
    const partito = Date.now();
    const tic = () => {
      const passati = Date.now() - partito;
      dice(
        `${testo} ${Math.round(passati / 1000)} s`,
        Math.min(90, Math.round((passati / atteso) * 90)),
      );
    };
    tic();
    const orologio = setInterval(tic, 1000);
    try {
      return await lavoro();
    } finally {
      clearInterval(orologio);
    }
  }

  /* Il ritocco sul pannello: torna { fatto, tolte: [ "com.sonoff…", … ] }.
   * Non e' un errore se non riesce: il pannello funziona lo stesso, e si
   * riprova al prossimo giro. */
  async _ritocca(indirizzo) {
    try {
      const dove = "/data/local/tmp/gda-ritocco.sh";
      await this._mandaLoScript(indirizzo, dove, scriptDelRitocco());
      const esito = await this.adb.shell(indirizzo, `sh ${dove}; rm -f ${dove}`, {
        root: true,
        attesa: 3 * 60_000,
      });
      const tolte = [...String(esito).matchAll(/^TOLTA (.*)$/gm)].map((m) => m[1].trim());
      return { fatto: /GDA_OK/.test(esito), tolte };
    } catch (_e) {
      return { fatto: false, tolte: [] };
    }
  }

  /* L'analisi del pannello: quello che serve per capire perche' va lento o
   * cosa non va, in un testo solo da copiare. Ogni domanda ha il suo limite
   * di tempo: una che non risponde non ferma le altre. */
  async analisi({ indirizzo }) {
    if (!(await this.adb.connetti(indirizzo))) throw perUtente("Il pannello non risponde.");
    const pkg = this.muroPackage;
    const righe = [];
    const chiedi = async (titolo, comando, root = true) => {
      const detto = await this.adb
        .shell(indirizzo, comando, { root, attesa: 20_000 })
        .catch((e) => `? ${e.message}`);
      righe.push(`== ${titolo} ==\n${String(detto).trim() || "(niente)"}`);
    };
    /* Prima di tutto, mentre chi ha chiesto l'analisi usa il pannello: dove
     * va il processore, filo per filo, in otto secondi. `dumpsys cpuinfo`
     * dice «GdAHome Muro 44%», ma non se e' Flutter che ridisegna la plancia
     * (raster), la casa che arriva (ui, il Dart) o Android (main): sono tre
     * strade diverse per renderlo piu' svelto. Lo stesso per la WebView. */
    await chiedi("Fili al lavoro (8 secondi)", filiAlLavoro(pkg, 8), true);
    await chiedi(
      "Dispositivo",
      "getprop ro.product.model; getprop ro.build.version.release; getprop ro.board.platform; getprop ro.hardware; uptime",
    );
    await chiedi(
      "Processore",
      "grep -E 'Hardware|processor' /proc/cpuinfo | sort | uniq -c; for c in /sys/devices/system/cpu/cpu[0-9]*; do echo \"$(basename $c) $(cat $c/cpufreq/scaling_cur_freq 2>/dev/null)/$(cat $c/cpufreq/cpuinfo_max_freq 2>/dev/null) $(cat $c/cpufreq/scaling_governor 2>/dev/null)\"; done",
    );
    await chiedi(
      "Memoria",
      "grep -E 'MemTotal|MemFree|MemAvailable|Cached|SwapTotal|SwapFree' /proc/meminfo",
    );
    await chiedi(
      "Temperatura",
      'for z in /sys/class/thermal/thermal_zone*; do echo "$(cat $z/type 2>/dev/null) $(cat $z/temp 2>/dev/null)"; done',
    );
    /* `top` di Android 8.1 non prende le opzioni di quello di Linux: chi usa
     * il processore lo dice `dumpsys cpuinfo`. */
    await chiedi("Chi usa il processore", "dumpsys cpuinfo | head -n 16");
    await chiedi(
      "Scheda video",
      "dumpsys SurfaceFlinger 2>/dev/null | grep -iE 'GLES|Vendor|Renderer' | head -n 5; getprop ro.hardware.egl; getprop debug.hwui.renderer",
    );
    await chiedi(
      "Disegno di GdAHome Muro",
      `dumpsys gfxinfo ${pkg} 2>/dev/null | grep -E 'Total frames|Janky|percentile|Number' | head -n 14`,
    );
    await chiedi(
      "Memoria di GdAHome Muro",
      `dumpsys meminfo ${pkg} 2>/dev/null | grep -E 'TOTAL|Native Heap|Graphics|GL mtrack' | head -n 6`,
    );
    await chiedi(
      "App",
      `dumpsys package ${pkg} | grep -m2 -E 'versionName|versionCode'; dumpsys package com.gdahome.os | grep -m2 -E 'versionName|versionCode'; dumpsys package com.google.android.webview | grep -m1 versionName; dumpsys package com.android.webview | grep -m1 versionName`,
    );
    await chiedi(
      "Sensori",
      "dumpsys sensorservice 2>/dev/null | grep -iE -A2 'proximity|light' | head -n 30",
    );
    await chiedi("Sullo schermo", "dumpsys window | grep -m1 mCurrentFocus");
    await chiedi(
      "Rete",
      "ip -4 addr show wlan0 2>/dev/null | grep inet; dumpsys wifi 2>/dev/null | grep -m1 -E 'mWifiInfo'; ip route | head -n 3",
    );
    /* Quanto ci mette il pannello a raggiungere Home Assistant: un comando
     * luce che tarda puo' essere la rete (Wi-Fi debole, pacchetti persi) o il
     * pannello. Il ping lo separa. */
    const casa = this.indirizzoDiCasa?.() || "";
    if (casa)
      await chiedi("Rete verso Home Assistant", `ping -c 5 -i 0.3 -W 1 ${casa} | tail -n 3`, false);
    await chiedi(
      "Abbinamento",
      `ls -la /data/data/${pkg}/files/ 2>/dev/null; cat /data/data/${pkg}/files/${ESITO} 2>/dev/null`,
    );
    await chiedi(
      "Animazione d'avvio",
      "ls -la /oem/media /system/media 2>/dev/null; ls /system/gdahome-removed 2>/dev/null",
    );
    await chiedi(
      "Registro di GdAHome Muro",
      "logcat -d -t 400 2>/dev/null | grep -iE 'flutter|gdahome|chromium.*(error|crash)' | tail -n 40",
    );
    await this.adb.stacca(indirizzo);
    return righe.join("\n\n");
  }

  async sonoff({ indirizzo, avanti }) {
    try {
      if (!(await this.adb.connetti(indirizzo))) return { errore: "Il pannello non risponde." };
      avanti({ passo: 0 });
      /* Come l'installazione: lo script va sul pannello come file. Ora rimette
       * anche le app Sonoff che stavano in /data, salvate prima di toglierle. */
      await this._mandaLoScript(
        indirizzo,
        "/data/local/tmp/gda-ripristino.sh",
        scriptDelRipristino(),
      );
      const esito = await this.adb.shell(indirizzo, "sh /data/local/tmp/gda-ripristino.sh", {
        root: true,
        attesa: 3 * 60_000,
      });
      /* GdAHome OS esce, e lo schermo torna a spegnersi da solo. */
      for (const r of [
        "pm uninstall com.gdahome.os",
        "settings put system screen_off_timeout 60000",
        "settings delete global policy_control",
        "settings put global window_animation_scale 1",
        "settings put global transition_animation_scale 1",
        "settings put global animator_duration_scale 1",
      ])
        await this.adb.shell(indirizzo, r, { root: true }).catch(() => {});
      if (!/GDA_OK/.test(esito)) return { errore: "Il ripristino non e' andato a buon fine." };
      avanti({ passo: 1 });
      await this._riavvia(indirizzo);
      await this.adb.stacca(indirizzo);
      return { fatto: true };
    } catch (errore) {
      return { errore: scusa(errore) };
    }
  }
}

/* Lo script dei fili: per GdAHome Muro e per la WebView (il suo processo
 * «sandboxed»), quanto ha lavorato ogni filo in `secondi`, in percento di un
 * nucleo, i piu' occupati in cima. Dai tempi di /proc (utime+stime, in
 * centesimi di secondo), letti due volte. */
export function filiAlLavoro(pkg, secondi = 8) {
  const pid = `$(pidof ${pkg}) $(pgrep -f sandboxed_process 2>/dev/null)`;
  /* Senza awk, che su Android 8 puo' mancare: i campi di /proc/…/stat dopo il
   * nome (che puo' avere spazi), con `set --`. */
  return [
    `T=/data/local/tmp/gda-fili`,
    `cpu(){ set -- $(sed 's/^.*) //' $1 2>/dev/null); echo $(( \${12:-0} + \${13:-0} )); }`,
    `: > $T; for p in ${pid}; do for t in /proc/$p/task/*; do echo "$p/\${t##*/} $(cpu $t/stat)" >> $T; done; done`,
    `sleep ${secondi}`,
    `for p in ${pid}; do echo "-- $(tr '\\0' ' ' < /proc/$p/cmdline 2>/dev/null | cut -c1-60)"; for t in /proc/$p/task/*; do a=$(cpu $t/stat); b=$(grep "^$p/\${t##*/} " $T | cut -d' ' -f2); d=$(( a - \${b:-$a} )); [ $d -gt 0 ] && echo "$(( d * 100 / ${secondi * 100} ))% $(cat $t/comm 2>/dev/null)"; done | sort -rn | head -n 10; done`,
    `rm -f $T`,
  ].join("\n");
}

/* «2026-11-27_1542»: si legge, e si ordina da se'. */
function dataPerCartella(d) {
  const due = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}_${due(d.getHours())}${due(d.getMinutes())}`;
}

const dorme = (ms) => new Promise((fatto) => setTimeout(fatto, ms));

/* «256 KB», «48 MB», «1,4 GB». */
function mostraByte(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/* Comprime un file in un altro, a pezzi. */
function comprimiIlFile(da, a) {
  return new Promise((risolvi, rifiuta) => {
    const fuori = createWriteStream(a);
    fuori.on("finish", risolvi).on("error", rifiuta);
    createReadStream(da)
      .on("error", rifiuta)
      .pipe(createGzip({ level: 6 }))
      .pipe(fuori);
  });
}

/* Byte e md5 di un file su disco, letto a pezzi. */
function impronta(file) {
  return new Promise((risolvi, rifiuta) => {
    const h = createHash("md5");
    let byte = 0;
    createReadStream(file)
      .on("data", (p) => {
        byte += p.length;
        h.update(p);
      })
      .on("error", rifiuta)
      .on("end", () => risolvi({ byte, md5: h.digest("hex") }));
  });
}

function inGB(byte) {
  return (byte / 1024 ** 3).toFixed(1).replace(".", ",");
}

function cartellaSicura(nome) {
  return (
    String(nome || "pannello")
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pannello"
  );
}

function perUtente(messaggio) {
  const e = new Error(messaggio);
  e.perUtente = true;
  return e;
}

function scusa(errore) {
  if (errore?.perUtente) return errore.message;
  if (errore?.causa === "non_raggiungibile") return "Il pannello non risponde.";
  if (errore?.causa === "non_autorizzato")
    return "Il pannello chiede di autorizzare questo add-on: tocca «Consenti» sullo schermo.";
  if (errore?.causa === "spazio") return "Spazio insufficiente sul pannello.";
  /* Il perche' vero, in breve: senza, «Qualcosa non ha funzionato» non
   * dice dove guardare. Intero nel registro dell'add-on. */
  console.error("[pannelli]", errore);
  const breve = String(errore?.message || errore || "")
    .split("\n")[0]
    .trim()
    .slice(0, 160);
  return breve
    ? `Qualcosa non ha funzionato sul pannello (${breve}). Riprova.`
    : "Qualcosa non ha funzionato sul pannello. Riprova.";
}
