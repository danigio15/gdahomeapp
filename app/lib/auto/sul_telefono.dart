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
