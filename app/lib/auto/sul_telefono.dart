/// La fotografia per l'auto, sul telefono: un file nella cartella privata.
///
/// `getApplicationSupportDirectory()` su Android e' `context.getFilesDir()` —
/// e' il codice del plugin, non una somiglianza di nomi — che e' esattamente
/// dove il Kotlin dell'auto va a leggere (`auto/LaFotoDellaCasa.kt`). I due
/// capi devono restare lo stesso file, e il nome sta scritto una volta in
/// `la_foto.dart`.
///
/// Sull'iPhone questa funzione gira e scrive, e nessuno legge: CarPlay le
/// categorie le tiene chiuse — audio, comunicazione, navigazione, parcheggi,
/// ricarica, cibo, carburante, lavoro alla guida — e la domotica non e' fra
/// quelle. Scrivere un file in piu' sul telefono non fa male a nessuno, e il
/// giorno che Apple aprisse una categoria la fotografia e' gia' li'.
library;

import 'dart:io';

import 'package:path_provider/path_provider.dart';

import 'la_foto.dart';

/// Scrive la fotografia, se c'e' da scriverla. Torna `true` se l'ha scritta.
///
/// Prima in un file accanto e poi si rinomina: l'auto legge quando le pare —
/// e' un altro processo — e senza questo passaggio un giorno le capiterebbe di
/// leggerne meta'. Il rinomina, sullo stesso disco, e' una cosa sola.
Future<bool> lasciaLaFotoAllAuto(String detto, {required String casa}) async {
  final scritta = laFotoDaScrivere(detto, casa: casa);
  if (scritta == null) return false;
  try {
    final cartella = await getApplicationSupportDirectory();
    final mezzo = File('${cartella.path}/$nomeDelFile.mezzo');
    await mezzo.writeAsString(scritta, flush: true);
    await mezzo.rename('${cartella.path}/$nomeDelFile');
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
