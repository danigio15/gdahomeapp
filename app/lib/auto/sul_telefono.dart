/// La fotografia per l'auto, sul telefono: un file nella cartella privata.
///
/// `getApplicationSupportDirectory()` su Android e' `context.getFilesDir()` —
/// e' il codice del plugin, non una somiglianza di nomi — che e' esattamente
/// dove il Kotlin dell'auto va a leggere (`auto/LaFotoDellaCasa.kt`). I due
/// capi devono restare lo stesso file, e il nome sta scritto una volta in
/// `la_foto.dart`.
///
/// Sull'iPhone la legge CarPlay (`ios/Runner/LaCasaInCarPlay.swift`): la
/// domotica da sola in CarPlay non ci entra — le categorie sono chiuse — ma
/// gdahome ci entra come navigatore, e la casa sta dietro il tasto con la
/// casetta, come su Android Auto. `getApplicationSupportDirectory()`
/// sull'iPhone e' `Library/Application Support`, e Swift guarda li'.
library;

import 'dart:async' show unawaited;
import 'dart:io';

import 'package:flutter/services.dart' show MethodChannel;
import 'package:path_provider/path_provider.dart';

import 'i_comandi.dart';
import 'la_foto.dart';
import 'la_licenza.dart';

/// Scrive la fotografia, se c'e' da scriverla. Torna `true` se l'ha scritta.
///
/// Prima in un file accanto e poi si rinomina: l'auto legge quando le pare —
/// e' un altro processo — e senza questo passaggio un giorno le capiterebbe di
/// leggerne meta'. Il rinomina, sullo stesso disco, e' una cosa sola.
Future<bool> lasciaLaFotoAllAuto(
  String detto, {
  required String casa,
  bool daSola = true,
}) async {
  final scritta = laFotoDaScrivere(detto, casa: casa, daSola: daSola);
  if (scritta == null) return false;
  try {
    final cartella = await getApplicationSupportDirectory();
    final mezzo = File('${cartella.path}/$nomeDelFile.mezzo');
    await mezzo.writeAsString(scritta, flush: true);
    await mezzo.rename('${cartella.path}/$nomeDelFile');
    /* Le ricette vanno in un file loro, e non in quello dell'auto: la' dentro
     * ci vanno i nomi, e nomi e basta. Col lucchetto acceso non se ne scrive
     * nessuna — niente parte da solo, e una ricetta che nessuno eseguira' e'
     * solo un elenco di entita' in piu' sul disco. */
    await _leRicette(cartella, daSola ? leRicetteDaScrivere(detto) : const []);
    _diciloAllOrologio();
    return true;
  } catch (_) {
    /* Il disco pieno, un permesso, la cartella che non c'e': in macchina si
     * vedra' quella di prima, o la schermata che dice che non e' arrivata
     * niente. Non e' un motivo per disturbare chi sta usando l'app. */
    return false;
  }
}

/// Il comando che l'auto ha lasciato, se ce n'e' uno da eseguire adesso.
///
/// Si toglie il file PRIMA di tornare, e si torna quello che c'era dentro: se
/// l'app muore mentre lo esegue, al riavvio non lo trova piu' e non lo rifa'.
/// Un cancello aperto due volte e' meglio di un cancello aperto ogni volta che
/// l'app si riapre — e con questo ordine non succede ne' l'uno ne' l'altro.
///
/// Anche un comando scaduto si toglie: resterebbe li' a farsi ritrovare a ogni
/// apertura, e ogni volta verrebbe buttato via di nuovo.
Future<String?> prendiIlComandoDellAuto() async {
  try {
    final cartella = await getApplicationSupportDirectory();
    final file = File('${cartella.path}/$nomeDelComando');
    if (!await file.exists()) return null;
    final detto = await file.readAsString();
    await file.delete();
    return ilComandoDellAuto(
      detto,
      adesso: DateTime.now().millisecondsSinceEpoch,
    );
  } catch (_) {
    /* Non c'era, non si e' letto, non si e' tolto: non si preme niente. In
     * macchina si e' gia' visto che il comando parte quando l'app e' in linea,
     * e questa volta non lo era. */
    return null;
  }
}

Future<void> _leRicette(
  Directory cartella,
  List<RicettaDellAzione> ricette,
) async {
  final file = File('${cartella.path}/$nomeDelleRicette');
  try {
    if (ricette.isEmpty) {
      if (await file.exists()) await file.delete();
      return;
    }
    final mezzo = File('${file.path}.mezzo');
    await mezzo.writeAsString(leRicetteScritte(ricette), flush: true);
    await mezzo.rename(file.path);
  } catch (_) {
    /* Senza ricette i tasti aspettano l'app, che e' quello che facevano
     * prima: non e' un motivo per non scrivere la fotografia. */
  }
}

/// Le ricette scritte, per chi deve eseguire un comando: quelle della
/// plancia e quelle dei comandi rapidi scelti per il navigatore.
Future<List<RicettaDellAzione>> leRicetteDellAuto() async {
  final dellaPlancia = await _quelleDellaPlancia();
  return [...dellaPlancia, ...(await leggiIComandi()).ricette];
}

Future<List<RicettaDellAzione>> _quelleDellaPlancia() async {
  try {
    final cartella = await getApplicationSupportDirectory();
    final file = File('${cartella.path}/$nomeDelleRicette');
    if (!await file.exists()) return const [];
    return leRicetteDaScrivere(await file.readAsString());
  } catch (_) {
    return const [];
  }
}

/// I comandi rapidi scelti per l'auto; `null` se non si e' mai scelto
/// niente (e allora si propongono i primi, vedi `iPrimiComandi`).
Future<IComandiScelti?> leggiIComandiSeCi() async {
  try {
    final cartella = await getApplicationSupportDirectory();
    final file = File('${cartella.path}/$nomeDeiComandi');
    if (!await file.exists()) return null;
    return IComandiScelti.leggi(await file.readAsString());
  } catch (_) {
    return null;
  }
}

Future<IComandiScelti> leggiIComandi() async =>
    await leggiIComandiSeCi() ?? const IComandiScelti();

/// Scrive i comandi scelti, dove li trova anche il servizio dell'auto. Come
/// la fotografia: prima un file a parte, poi al suo posto, perche' l'auto
/// non legga mai un file a meta'.
Future<bool> scriviIComandi(IComandiScelti scelti) async {
  try {
    final cartella = await getApplicationSupportDirectory();
    final mezzo = File('${cartella.path}/$nomeDeiComandi.mezzo');
    await mezzo.writeAsString(scelti.comeSiScrive, flush: true);
    await mezzo.rename('${cartella.path}/$nomeDeiComandi');
    _diciloAllOrologio();
    return true;
  } catch (_) {
    return false;
  }
}

/// Dice all'auto se la casa e' Premium, e fino a quando (`la_licenza.dart`).
///
/// Come la fotografia: prima un file a parte e poi al suo posto, perche'
/// l'auto non legga mai un biglietto a meta' — che varrebbe «no» proprio a chi
/// ha pagato. Se non si riesce a scrivere resta quello di prima, che scade da
/// solo.
Future<bool> diciLaLicenzaAllAuto({
  required bool premium,
  DateTime? fino,
}) async {
  try {
    final cartella = await getApplicationSupportDirectory();
    final mezzo = File('${cartella.path}/$nomeDellaLicenza.mezzo');
    await mezzo.writeAsString(
      laLicenzaScritta(premium: premium, fino: fino),
      flush: true,
    );
    await mezzo.rename('${cartella.path}/$nomeDellaLicenza');
    _diciloAllOrologio();
    return true;
  } catch (_) {
    return false;
  }
}

/// Se il biglietto lasciato all'auto dice Premium adesso: lo legge il motore
/// senza schermo prima di eseguire un comando premuto in macchina.
Future<bool> laLicenzaDellAuto() async {
  try {
    final cartella = await getApplicationSupportDirectory();
    final file = File('${cartella.path}/$nomeDellaLicenza');
    if (!await file.exists()) return false;
    return laLicenzaVale(
      await file.readAsString(),
      adesso: DateTime.now().millisecondsSinceEpoch,
    );
  } catch (_) {
    return false;
  }
}

/// Le azioni rapide della plancia che partono da sole, dall'ultima
/// fotografia lasciata all'auto.
Future<List<ComandoRapido>> leAzioniRapide() async {
  try {
    final cartella = await getApplicationSupportDirectory();
    final foto = File('${cartella.path}/$nomeDelFile');
    if (!await foto.exists()) return const [];
    return leAzioniDellaPlancia(
      await foto.readAsString(),
      await _quelleDellaPlancia(),
    );
  } catch (_) {
    return const [];
  }
}

/// Dove si dice all'orologio che i file dell'auto sono cambiati.
///
/// L'orologio — Apple Watch e Wear OS — legge gli stessi tre file dell'auto
/// (la fotografia, i comandi scelti, il biglietto di Premium), ma non dal
/// disco: glieli porta il telefono, che li rilegge quando qui gli si dice che
/// sono cambiati (`ios/Runner/LOrologio.swift`,
/// `android/.../orologio/IlTramiteDellOrologio.kt`). Lo stesso nome nei tre
/// posti; vedi `docs/OROLOGIO.md`.
const String canaleDellOrologio = 'gdahome/orologio';

/// Un colpetto e basta: non si aspetta e non solleva. Senza orologio — o
/// nelle prove, dove il canale non c'e' — non succede niente.
void _diciloAllOrologio() {
  try {
    unawaited(
      const MethodChannel(canaleDellOrologio)
          .invokeMethod<void>('aggiorna')
          .catchError((Object _) {}),
    );
  } catch (_) {}
}
