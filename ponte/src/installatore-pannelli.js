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
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { scappa } from "./adb.js";

/* Dove tenere le copie di sicurezza: la cartella condivisa di Home Assistant,
 * che l'utente vede e puo' portare via. */
export const CARTELLA_DELLE_COPIE = "/share/gdahome-os";

/* I pezzi di GdAHome OS, per modello. */
function animazione(modello) {
  return modello === "120" ? "bootanimation-120.zip" : "bootanimation-86.zip";
}

/* Le app che non si toccano MAI: senza, Android o GdAHome non funzionano.
 * Lo stesso elenco di `gdahome-os.sh` (KEEP_RE), gia' provato sui pannelli. */
export const DA_TENERE =
  "^(android|com\\.android\\.(systemui|settings|phone|shell|packageinstaller|defcontainer|externalstorage|keychain|certinstaller|location\\.fused|server\\.telecom|bluetooth|nfc|proxyhandler|vpndialogs|statementservice|storagemanager|documentsui|captiveportallogin|provision|se|mtp|inputmethod\\..*|providers\\..*|webview|wallpaperbackup|backupconfirm|sharedstoragebackup|pacprocessor|carrierconfig|managedprovisioning|cts\\..*)|com\\.google\\.android\\.webview|com\\.gdahome\\..*)$";
/* Il software Sonoff / eWeLink, riconosciuto dal nome (SONOFF_RE). */
export const DI_SONOFF = "sonoff|ewelink|itead|coolkit|smatek|nspanel";
/* Le app Android inutili a muro: si tolgono per avere memoria (SUPERFLUE_RE). */
export const SUPERFLUE =
  "^com\\.android\\.(browser|calendar|contacts|dialer|mms|email|exchange|gallery3d|gallery|music|musicfx|camera2?|deskclock|calculator2|soundrecorder|quicksearchbox|launcher3?|wallpaper\\.livepicker|wallpapercropper|dreams\\..*|printspooler|bips|egg|htmlviewer|bookmarkprovider|galaxy4|noisefield|phasebeam|magicsmoke|musicvis|stk|calllogbackup|cellbroadcastreceiver|emergency|smspush|onetimeinitializer|apps\\.tag|printservice\\.recommendation|traceur|companiondevicemanager|wallpaper|webview\\.shell)$";

/* Lo script che gira sul pannello, da root. Toglie il software Sonoff e le
 * app superflue — quelle di /system spostate in /system/gdahome-removed,
 * quelle di /data salvate in /data/gdahome-removed e disinstallate, ognuna
 * scritta nel suo manifesto — poi mette GdAHome OS, il ponte Zigbee e
 * l'animazione d'avvio (tenendo l'originale), e fissa l'ADB di rete.
 * Scrive «TOLTA <app>» per ognuna e finisce con GDA_OK, o GDA_ERR <perche'>. */
export function scriptDiSistema() {
  return [
    "TMP=/data/local/tmp",
    "R=/system/gdahome-removed",
    "D=/data/gdahome-removed",
    `TENERE='${DA_TENERE}'`,
    `SONOFF='${DI_SONOFF}'`,
    `SUPERFLUE='${SUPERFLUE}'`,
    "mount -o rw,remount /system 2>/dev/null || mount -o rw,remount / 2>/dev/null",
    'touch /system/.gdatest 2>/dev/null && rm -f /system/.gdatest || { echo "GDA_ERR /system non si puo\' scrivere"; exit 1; }',
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
    "  else continue; fi",
    '  case "$apk" in',
    "    /data/*)",
    '      cp "$apk" $D/$pkg.apk && pm uninstall "$pkg" >/dev/null 2>&1 && echo "$pkg" >> $D/manifest.txt && echo "TOLTA $pkg ($perche)" ;;',
    "    *)",
    '      cartella=$(dirname "$apk"); sopra=$(basename "$cartella")',
    '      if [ "$sopra" = app ] || [ "$sopra" = priv-app ]; then via="$apk"; else via="$cartella"; fi',
    '      grep -q "^$pkg|" $R/manifest.txt 2>/dev/null && continue',
    '      mv "$via" $R/$pkg.removed && echo "$pkg|$via" >> $R/manifest.txt && echo "TOLTA $pkg ($perche)" ;;',
    "  esac",
    "done < $TMP/gda-app.txt",
    "rm -f $TMP/gda-app.txt",
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
    "sync",
    "mount -o ro,remount /system 2>/dev/null || mount -o ro,remount / 2>/dev/null || true",
    "rm -f $TMP/GdAHome-OS.apk $TMP/bootanimation.zip $TMP/gdaserial",
    "echo GDA_OK",
  ].join("\n");
}

/* Lo script del ripristino: rimette quello che l'installazione ha tolto, da
 * /system e da /data, l'animazione e il build.prop di prima. */
export function scriptDelRipristino() {
  return [
    "R=/system/gdahome-removed",
    "D=/data/gdahome-removed",
    "mount -o rw,remount /system 2>/dev/null || mount -o rw,remount / 2>/dev/null",
    "if [ -d $R ]; then",
    '  [ -f $R/manifest.txt ] && while IFS="|" read -r pkg via; do [ -e $R/$pkg.removed ] && mv $R/$pkg.removed "$via" && echo "RIMESSA $pkg"; done < $R/manifest.txt',
    "  if [ -f $R/bootanimation.zip.orig ]; then mv $R/bootanimation.zip.orig /system/media/bootanimation.zip; else rm -f /system/media/bootanimation.zip; fi",
    "  [ -f $R/build.prop.orig ] && cp -p $R/build.prop.orig /system/build.prop",
    "  rm -rf $R",
    "fi",
    "rm -rf /system/app/GdAHomeOS /system/bin/gdaserial",
    "sync; mount -o ro,remount /system 2>/dev/null || mount -o ro,remount / 2>/dev/null || true",
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
  } = {}) {
    this.adb = adb;
    this.pezzi = cartellaDeiPezzi;
    this.copie = cartellaDelleCopie;
    this.abbinaPannello = abbinaPannello;
    this.dispositivi = dispositivi;
    /* Come si scrive una partizione sul disco: iniettabile per le prove. */
    this.scriviCopia = scriviCopia;
    this.muroPackage = muroPackage;
  }

  _pezzo(nome) {
    return join(this.pezzi, nome);
  }

  _ceIlPezzo(nome) {
    return existsSync(this._pezzo(nome));
  }

  /* Installazione completa. `avanti({passo, dettaglio, percento})` avvisa la
   * console a ogni passo. Torna { errore?, passoRotto?, os, app, modello, … }. */
  async installa({ indirizzo, planciaId, utente, nome, avanti }) {
    try {
      /* 0. I pezzi ci sono? Meglio accorgersene prima di toccare il pannello. */
      const osApk = "GdAHome-OS.apk";
      const muroApk = "GdAHome-Muro.apk";
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
      const modello = schermo === "480x480" ? "86" : schermo ? "120" : "";
      const android = await this.adb.getprop(indirizzo, "ro.build.version.release").catch(() => "");
      avanti({
        passo: 0,
        dettaglio: `NSPanel Pro ${modello || "?"} · Android ${android} · root ok`,
      });

      // 2. Copia di sicurezza
      avanti({ passo: 1, dettaglio: "Leggo le partizioni…" });
      const copia = await this._copiaDiSicurezza(
        indirizzo,
        nome || indirizzo,
        (fatte, tutte, quale) =>
          avanti({
            passo: 1,
            dettaglio: `${quale} (${fatte}/${tutte})`,
            percento: Math.round((fatte / tutte) * 100),
          }),
      );
      if (copia.errore) return { errore: copia.errore, passoRotto: 1 };

      // 3. Installazione
      avanti({ passo: 2, dettaglio: "Copio i file sul pannello…" });
      const inst = await this._installaOs(indirizzo, modello, osApk, muroApk);
      if (inst.errore) return { errore: inst.errore, passoRotto: 2 };

      // 4. Abbinamento
      avanti({ passo: 3, dettaglio: "Faccio entrare il pannello nella casa…" });
      const abb = await this._abbina(indirizzo, { nome, utente, planciaId });
      if (abb.errore) return { errore: abb.errore, passoRotto: 3 };

      // 5. Riavvio
      avanti({ passo: 4, dettaglio: "" });
      await this._riavvia(indirizzo);
      await this.adb.stacca(indirizzo);

      return {
        os: inst.os,
        app: inst.versioni?.muro?.nome || abb.app,
        versioni: inst.versioni || null,
        modello,
        schermo,
        dispositivo: abb.dispositivo,
      };
    } catch (errore) {
      return { errore: scusa(errore) };
    }
  }

  async _schermo(indirizzo) {
    const detto = await this.adb.shell(indirizzo, "wm size", { root: false }).catch(() => "");
    const m = /(\d+)x(\d+)/.exec(String(detto).replace(/.*:/, ""));
    return m ? `${m[1]}x${m[2]}` : "";
  }

  /* Copia ogni partizione in /share/gdahome-os/<pannello>/, col suo md5. */
  async _copiaDiSicurezza(indirizzo, nome, avanti) {
    const dir = join(this.copie, cartellaSicura(nome) + "-" + Date.now());
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
        .filter((p) => !/^(userdata|cache)$/.test(p));
    } catch (_e) {
      return { errore: "Non riesco a elencare le partizioni." };
    }
    if (!nomi.length) return { errore: "Nessuna partizione da copiare." };
    if (!this.scriviCopia)
      return { errore: "Questo add-on non puo' scrivere la copia di sicurezza." };

    for (let i = 0; i < nomi.length; i += 1) {
      const p = nomi[i];
      avanti(i, nomi.length, p);
      try {
        const flusso = this.adb.shellBinaria(
          indirizzo,
          `dd if=${scappa(`${byName}/${p}`)} bs=4194304 2>/dev/null`,
        );
        await this.scriviCopia(join(dir, `${p}.img`), flusso);
      } catch (_e) {
        return { errore: `Copia di ${p} non riuscita.` };
      }
    }
    avanti(nomi.length, nomi.length, "");
    return { dir };
  }

  /* Installa GdAHome OS: l'app GdAHome Muro, GdAHome OS come app di sistema,
   * il ponte Zigbee e l'animazione d'avvio, e **toglie il software Sonoff** e
   * le app inutili a muro, mettendole da parte perche' «Rimetti Sonoff» le
   * possa rimettere. E' l'installazione di `gdahome-os.sh install` (repository
   * di GdAHome OS), fatta tutta dall'add-on. */
  async _installaOs(indirizzo, modello, osApk, muroApk) {
    const tmp = "/data/local/tmp";
    try {
      /* Prima l'app GdAHome Muro (l'interfaccia): se qualcosa va storto dopo,
       * il pannello ce l'ha gia'. */
      await this.adb.install(indirizzo, this._pezzo(muroApk), { permessi: true });
      /* La WebView, se c'e' il pezzo e serve. */
      if (this._ceIlPezzo("webview.apk"))
        await this.adb.install(indirizzo, this._pezzo("webview.apk")).catch(() => {});
      /* I pezzi di sistema. */
      await this.adb.push(indirizzo, this._pezzo(osApk), `${tmp}/GdAHome-OS.apk`);
      const anim = animazione(modello);
      if (this._ceIlPezzo(anim))
        await this.adb.push(indirizzo, this._pezzo(anim), `${tmp}/bootanimation.zip`);
      const serial = "gdaserial-arm64-v8a";
      if (this._ceIlPezzo(serial))
        await this.adb.push(indirizzo, this._pezzo(serial), `${tmp}/gdaserial`).catch(() => {});

      /* Lo script va sul pannello come file e si lancia da li': un comando di
       * cento righe passato a `su -c` attraverso `adb exec-out` e' fragile. */
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
      "settings put global window_animation_scale 0.5",
      "settings put global transition_animation_scale 0.5",
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
  async _abbina(indirizzo, { nome, utente, planciaId }) {
    if (!this.abbinaPannello) return { errore: "Questo add-on non sa abbinare i pannelli." };
    let abb;
    try {
      abb = await this.abbinaPannello({ nome, utente, plancia: planciaId, sistema: "muro" });
    } catch (errore) {
      return { errore: scusa(errore) };
    }
    if (!abb?.dispositivo || !abb?.segno)
      return { errore: "L'abbinamento non ha dato un gettone." };
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
    try {
      /* L'uid dell'app, da dumpsys: "userId=10234". */
      const detto = await this.adb.shell(indirizzo, `dumpsys package ${pkg} | grep -m1 userId=`, {
        root: true,
      });
      const uid = (/userId=(\d+)/.exec(detto) || [])[1];
      if (!uid) return { errore: "L'app GdAHome Muro non risulta installata." };
      await this.adb.shell(indirizzo, `mkdir -p ${dir}`, { root: true });
      await this.adb.shell(
        indirizzo,
        `cat > ${dir}/abbinamento.json <<'GDAJSON'\n${foglietto}\nGDAJSON`,
        { root: true },
      );
      await this.adb.shell(
        indirizzo,
        `chown ${uid}:${uid} ${dir}/abbinamento.json; chmod 600 ${dir}/abbinamento.json; restorecon ${dir}/abbinamento.json 2>/dev/null || chcon u:object_r:app_data_file:s0:c512,c768 ${dir}/abbinamento.json 2>/dev/null || true`,
        { root: true },
      );
    } catch (errore) {
      return { errore: scusa(errore) };
    }
    return { dispositivo: abb.dispositivo, app: abb.app || "" };
  }

  async _riavvia(indirizzo) {
    await this.adb
      .shell(indirizzo, "svc power reboot || reboot", { root: true, attesa: 15_000 })
      .catch(() => {});
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
   * poi GdAHome OS, che la riapre da solo. */
  async aggiorna({ indirizzo, avanti = () => {} }) {
    try {
      if (!(await this.adb.connetti(indirizzo))) return { errore: "Il pannello non risponde." };
      const prima = await this.versioniSulPannello(indirizzo);
      const quali = this.daAggiornare(prima);
      avanti({ passo: 0 });
      if (quali.includes("muro") && this._ceIlPezzo("GdAHome-Muro.apk")) {
        await this.adb.install(indirizzo, this._pezzo("GdAHome-Muro.apk"), { permessi: true });
        for (const r of [
          `dumpsys deviceidle whitelist +${this.muroPackage}`,
          `appops set ${this.muroPackage} RUN_IN_BACKGROUND allow`,
        ])
          await this.adb.shell(indirizzo, r, { root: true }).catch(() => {});
      }
      avanti({ passo: 1 });
      if (quali.includes("os") && this._ceIlPezzo("GdAHome-OS.apk"))
        await this.adb.install(indirizzo, this._pezzo("GdAHome-OS.apk"));
      const dopo = await this.versioniSulPannello(indirizzo);
      await this.adb.stacca(indirizzo);
      return {
        app: dopo.muro?.nome || "",
        os: dopo.os?.nome || "",
        versioni: dopo,
        aggiornati: quali,
      };
    } catch (errore) {
      return { errore: scusa(errore) };
    }
  }

  async analisi({ indirizzo }) {
    if (!(await this.adb.connetti(indirizzo))) throw perUtente("Il pannello non risponde.");
    const righe = [];
    const chiedi = async (titolo, comando, root = true) => {
      const detto = await this.adb
        .shell(indirizzo, comando, { root })
        .catch((e) => `? ${e.message}`);
      righe.push(`== ${titolo} ==\n${detto}`);
    };
    await chiedi("Dispositivo", "getprop | grep -iE 'product.model|build.version|hardware'", true);
    await chiedi(
      "GPIO",
      "ls /sys/class/gpio 2>/dev/null; cat /sys/kernel/debug/gpio 2>/dev/null | head -n 80",
    );
    await chiedi("Retroilluminazione", "ls /sys/class/backlight 2>/dev/null");
    await chiedi("Termico", "ls /sys/class/thermal 2>/dev/null");
    await chiedi("Porte seriali", "ls -l /dev/ttyS* /dev/ttyUSB* 2>/dev/null");
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
  return "Qualcosa non ha funzionato sul pannello. Riprova.";
}
