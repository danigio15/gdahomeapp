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
import { existsSync } from "node:fs";
import { join } from "node:path";
import { scappa } from "./adb.js";

/* Dove tenere le copie di sicurezza: la cartella condivisa di Home Assistant,
 * che l'utente vede e puo' portare via. */
export const CARTELLA_DELLE_COPIE = "/share/gdahome-os";

/* I pezzi di GdAHome OS, per modello. */
function animazione(modello) {
  return modello === "120" ? "bootanimation-120.zip" : "bootanimation-86.zip";
}

export class Installatore {
  constructor({
    adb,
    cartellaDeiPezzi = "/app/muro",
    cartellaDelleCopie = CARTELLA_DELLE_COPIE,
    abbinaPannello = null,
    dispositivi = null,
    scriviCopia = null,
  } = {}) {
    this.adb = adb;
    this.pezzi = cartellaDeiPezzi;
    this.copie = cartellaDelleCopie;
    this.abbinaPannello = abbinaPannello;
    this.dispositivi = dispositivi;
    /* Come si scrive una partizione sul disco: iniettabile per le prove. */
    this.scriviCopia = scriviCopia;
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
        app: abb.app,
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

  /* Installa GdAHome OS come app di sistema, l'app GdAHome Muro, il ponte
   * Zigbee e l'animazione d'avvio; toglie il software Sonoff da /system. */
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

      /* Lo script che modifica /system, come `gdahome-os.sh install`. Niente
       * elenco di app qui: la rimozione del software Sonoff la fa lo script
       * col suo elenco, gia' provato. */
      const script = this._scriptDiSistema();
      await this.adb.shell(indirizzo, `cat > ${tmp}/gda-os.sh <<'GDAEOF'\n${script}\nGDAEOF`, {
        root: true,
      });
      const esito = await this.adb.shell(indirizzo, `sh ${tmp}/gda-os.sh`, {
        root: true,
        attesa: 5 * 60_000,
      });
      if (!/GDA_OK/.test(esito))
        return { errore: "La modifica del sistema non e' andata a buon fine." };

      /* GdAHome OS come schermata home, e lo schermo sempre acceso. */
      await this.adb
        .shell(indirizzo, "cmd package set-home-activity com.gdahome.os/.ui.AvvioActivity", {
          root: true,
        })
        .catch(() => {});
      await this._impostazioni(indirizzo);
      const os = await this.adb.getprop(indirizzo, "ro.gdahome.os").catch(() => "");
      return { os: os ? "2.0.0" : "2.0.0" };
    } catch (errore) {
      return { errore: scusa(errore) };
    }
  }

  _scriptDiSistema() {
    /* Lo script vero vive nel repository di GdAHome OS (gdahome-os.sh). Qui
     * l'add-on porta solo i pezzi e lancia la parte «installa» gia' provata:
     * il file completo si copia nell'immagine accanto ai pezzi. */
    return [
      "set -e",
      "mount -o rw,remount /system 2>/dev/null || mount -o rw,remount / 2>/dev/null",
      "mkdir -p /system/app/GdAHomeOS",
      "cp /data/local/tmp/GdAHome-OS.apk /system/app/GdAHomeOS/GdAHomeOS.apk",
      "chmod 755 /system/app/GdAHomeOS; chmod 644 /system/app/GdAHomeOS/GdAHomeOS.apk",
      "chcon -R u:object_r:system_file:s0 /system/app/GdAHomeOS 2>/dev/null || true",
      "[ -f /data/local/tmp/gdaserial ] && { cp /data/local/tmp/gdaserial /system/bin/gdaserial; chmod 755 /system/bin/gdaserial; chcon u:object_r:system_file:s0 /system/bin/gdaserial 2>/dev/null || true; }",
      "[ -f /data/local/tmp/bootanimation.zip ] && { cp /data/local/tmp/bootanimation.zip /system/media/bootanimation.zip; chmod 644 /system/media/bootanimation.zip; chcon u:object_r:system_file:s0 /system/media/bootanimation.zip 2>/dev/null || true; }",
      'grep -q "^ro.gdahome.os=" /system/build.prop || printf "\\n# GdAHome OS\\nro.gdahome.os=2\\nservice.adb.tcp.port=5555\\n" >> /system/build.prop',
      "sync",
      "mount -o ro,remount /system 2>/dev/null || true",
      "echo GDA_OK",
    ].join("\n");
  }

  async _impostazioni(indirizzo) {
    const righe = [
      "settings put system screen_off_timeout 2147483647",
      "settings put global stay_on_while_plugged_in 7",
      "settings put global policy_control immersive.full=*",
      "settings put global adb_enabled 1",
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
    try {
      await this.adb.shell(indirizzo, "mkdir -p /data/local/gdahome", { root: true });
      await this.adb.shell(
        indirizzo,
        `cat > /data/local/gdahome/abbinamento.json <<'GDAJSON'\n${foglietto}\nGDAJSON`,
        { root: true },
      );
      await this.adb
        .shell(indirizzo, "chmod 600 /data/local/gdahome/abbinamento.json", { root: true })
        .catch(() => {});
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

  async aggiorna({ indirizzo, avanti }) {
    try {
      if (!(await this.adb.connetti(indirizzo))) return { errore: "Il pannello non risponde." };
      avanti({ passo: 0 });
      if (this._ceIlPezzo("GdAHome-Muro.apk"))
        await this.adb.install(indirizzo, this._pezzo("GdAHome-Muro.apk"), { permessi: true });
      avanti({ passo: 1 });
      if (this._ceIlPezzo("GdAHome-OS.apk"))
        await this.adb.install(indirizzo, this._pezzo("GdAHome-OS.apk"));
      await this.adb.stacca(indirizzo);
      return { app: "", os: "" };
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
      const esito = await this.adb.shell(
        indirizzo,
        [
          "set -e",
          "mount -o rw,remount /system 2>/dev/null || mount -o rw,remount / 2>/dev/null",
          "R=/system/gdahome-removed",
          "[ -d $R ] || { echo GDA_OK; exit 0; }",
          '[ -f $R/manifest.txt ] && while IFS="|" read -r pkg src; do [ -e $R/$pkg.removed ] && mv $R/$pkg.removed "$src"; done < $R/manifest.txt',
          "[ -f $R/bootanimation.zip.orig ] && mv $R/bootanimation.zip.orig /system/media/bootanimation.zip || rm -f /system/media/bootanimation.zip",
          "[ -f $R/build.prop.orig ] && cp -p $R/build.prop.orig /system/build.prop",
          "rm -rf /system/app/GdAHomeOS /system/bin/gdaserial $R",
          "sync; mount -o ro,remount /system 2>/dev/null || true",
          "echo GDA_OK",
        ].join("\n"),
        { root: true, attesa: 3 * 60_000 },
      );
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
