#!/usr/bin/env node
/*
 * GdAHome Muro, l'app del pannello: toglie da questa cartella quello che sul
 * muro non serve, prima di costruirla.
 *
 *   node strumenti/app-del-muro.mjs        (dalla cartella app/, in CI)
 *
 * L'app del pannello e' la stessa del telefono (`lib/main_muro.dart`), ma un
 * pannello non guida, non legge QR code e non conta i passi: il navigatore
 * (gdanav, con le sue mappe, i suoi dati e Android Auto), il lettore di QR
 * code e la salute erano piu' di meta' del pacchetto, e sul Wi-Fi di un
 * pannello ogni MB e' tempo di installazione e di aggiornamento.
 *
 * Il codice che li usa ha gia' una seconda faccia, quella della webapp
 * (`sul_web.dart`), con la stessa firma e niente dentro: qui la si sceglie
 * sempre, e si tolgono le dipendenze. La parte Android fa lo stesso da sola
 * (`android/app/build.gradle.kts`, `src/muro`).
 *
 * Modifica i file della cartella: si lancia solo su una copia usa e getta
 * (la macchina della CI), mai nella cartella di lavoro.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const APP = process.argv[2] || process.cwd();
const qui = (p) => join(APP, p);

/* Le dipendenze che il pannello non porta. */
export const VIA = ["gdanav_app", "mobile_scanner", "health"];

/* Toglie dal pubspec le dipendenze in `VIA`: la riga del nome e quelle sotto,
 * piu' rientrate (il `git:` di gdanav, coi suoi commenti). */
export function senzaDipendenze(testo, via = VIA) {
  const righe = testo.split("\n");
  const fuori = [];
  for (let i = 0; i < righe.length; i += 1) {
    const m = /^ {2}([a-z_][a-z0-9_]*):/.exec(righe[i]);
    if (m && via.includes(m[1])) {
      while (i + 1 < righe.length && /^ {3,}\S/.test(righe[i + 1])) i += 1;
      continue;
    }
    fuori.push(righe[i]);
  }
  return fuori.join("\n");
}

/* Un'esportazione «sul web o sul telefono» che sceglie sempre il web. */
export function sempreIlWeb(testo) {
  return testo.replace(
    /export\s+'([^']*sul_web\.dart)'\s+if\s*\(dart\.library\.io\)\s*'[^']*'/g,
    "export '$1'",
  );
}

/* Il lettore di QR code senza fotocamera: sul pannello non si inquadra
 * niente, e chi apre il lettore scrive a mano. Resta la stessa firma
 * (`Letto`, `colLaFotocamera`, `LettoreDiQrCode`). */
export function lettoreSenzaFotocamera(testo) {
  const inizio = testo.indexOf("class LettoreDiQrCode extends StatefulWidget");
  if (inizio < 0) throw new Error("lettore.dart: non trovo LettoreDiQrCode");
  const sopra = testo
    .slice(0, inizio)
    .replace(/^import 'package:mobile_scanner\/[^']*';\n/m, "")
    /* Le parole servivano al mirino e all'errore, che qui non ci sono. */
    .replace(/^import '\.\.\/parole\.dart';\n/m, "");
  return `${sopra}/// Sul pannello a muro la fotocamera non c'e': si scrive a mano.
class LettoreDiQrCode extends StatelessWidget {
  const LettoreDiQrCode({super.key});

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (context.mounted) Navigator.of(context).pop(const SiScriveAMano());
    });
    return const SizedBox.shrink();
  }
}
`;
}

function cambia(percorso, come) {
  const dove = qui(percorso);
  const prima = readFileSync(dove, "utf8");
  const dopo = come(prima);
  if (dopo === prima) throw new Error(`${percorso}: niente da cambiare`);
  writeFileSync(dove, dopo);
}

function togli(percorso) {
  if (existsSync(qui(percorso))) rmSync(qui(percorso));
}

export function preparaIlMuro() {
  cambia("pubspec.yaml", (t) => senzaDipendenze(t));
  /* Il navigatore e la salute: la faccia del web, e quella del telefono via. */
  cambia("lib/schermate/navigatore_qui/qui.dart", sempreIlWeb);
  for (const f of ["sul_telefono.dart", "la_vettura.dart", "le_persone.dart"])
    togli(`lib/schermate/navigatore_qui/${f}`);
  cambia("lib/salute/lettore.dart", sempreIlWeb);
  togli("lib/salute/lettore_qui/sul_telefono.dart");
  /* Il lettore di QR code. */
  cambia("lib/schermate/lettore.dart", lettoreSenzaFotocamera);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  preparaIlMuro();
  console.log(`App del pannello: tolti ${VIA.join(", ")}.`);
}
