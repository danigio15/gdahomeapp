/// L'avvio di GdAHome Muro: legge il foglietto e si mette nella casa.
///
/// GdAHome Muro e' l'app GdAHome che gira sul pannello (il Sonoff NSPanel con
/// GdAHome OS). Non si abbina inquadrando un QR: l'add-on l'ha gia' fatta
/// entrare nella casa installandola, e ha lasciato il foglietto nella cartella
/// dell'app (`installatore-pannelli.js`). Al primo avvio lo si legge e si mette
/// la casa nell'archivio, come se ci si fosse appena abbinati; da li' in poi e'
/// un telefono come gli altri, e l'app parte sulla plancia a muro.
///
/// **Come e' andata lo si scrive**, accanto al foglietto, in
/// [nomeDellEsito]: «OK», o «ERRORE» col perche'. L'add-on lo legge dopo il
/// riavvio e lo dice nella console. Prima un errore qui si perdeva in silenzio,
/// e il pannello partiva chiedendo il codice senza che nessuno sapesse perche'.
///
/// Il foglietto si toglie solo quando la casa e' entrata. Se qualcosa va
/// storto resta li', e l'app riprova al prossimo avvio; uno che non si legge
/// proprio si mette da parte ([nomeDelRovinato]) invece di sparire, cosi' si
/// puo' guardare cosa c'era scritto.
library;

import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../casa/archivio_delle_case.dart';
import '../casa/cassaforte.dart';
import 'foglietto_del_muro.dart';

/// Il nome del foglietto nella cartella dell'app (`getApplicationSupportDirectory`,
/// su Android `files/`), dove l'add-on lo scrive intestandolo all'app.
const nomeDelFoglietto = 'abbinamento.json';

/// Come e' andata, accanto al foglietto: lo legge l'add-on.
const nomeDellEsito = 'abbinamento.esito';

/// Un foglietto che non si legge, messo da parte.
const nomeDelRovinato = 'abbinamento.rovinato';

/// Mette la casa del foglietto nell'archivio, se c'e' un foglietto e la casa
/// non c'e' gia'. Da chiamare prima di avviare l'app. Non lancia: un foglietto
/// che non si legge lascia partire l'app com'e', e lo scrive nell'esito.
Future<void> provvediDalFoglietto({
  ArchivioDelleCase? archivio,
  Directory? cartella,
}) async {
  Directory? dir;
  var fase = 'cartella';
  try {
    dir = cartella ?? await getApplicationSupportDirectory();
    final file = File('${dir.path}/$nomeDelFoglietto');
    fase = 'lettura';
    if (!await file.exists()) return;
    final testo = await file.readAsString();
    fase = 'foglietto';
    final foglietto = FogliettoDelMuro.daJson(testo);
    if (foglietto == null) {
      /* Rovinato: lo si mette da parte, non serve riprovarci a ogni avvio. */
      await _sposta(file, '${dir.path}/$nomeDelRovinato');
      await _esito(dir, 'ERRORE foglietto non valido');
      return;
    }

    fase = 'archivio';
    final arch = archivio ?? ArchivioDelleCase(const CassaforteDelSistema());
    if (!arch.aperto) await arch.apri();
    /* Gia' dentro con lo stesso segno: il pannello e' gia' avviato una
     * volta. Con un segno diverso e' un riabbinamento — l'add-on ha rifatto
     * le chiavi dello stesso pannello — e la casa di prima si sostituisce:
     * col segno vecchio la casa non lo farebbe piu' entrare. */
    final prima = arch.tutte
        .where((c) => c.identificativo == foglietto.dispositivo)
        .toList();
    final gia = prima.any((c) => c.segno == foglietto.segno);
    if (!gia) {
      fase = 'sostituzione';
      for (final vecchia in prima) {
        await arch.togli(vecchia.id);
      }
      fase = 'casa';
      final casa = foglietto.casaConosciuta(id: '', nome: 'Casa');
      final messa = await arch.aggiungi(
        nome: casa.nome,
        segno: casa.segno,
        identificativo: casa.identificativo,
        chiave: casa.chiave,
        casaAlCentralino: casa.casaAlCentralino,
        inCasa: casa.inCasa,
      );
      if (foglietto.plancia != null && foglietto.plancia!.isNotEmpty) {
        fase = 'plancia';
        await arch.segnaLaPlancia(messa.id, foglietto.plancia!);
      }
    }
    await _esito(dir, 'OK ${foglietto.dispositivo}');
    await _togli(file);
  } catch (errore) {
    /* Qualunque cosa vada storta, l'app parte lo stesso: al massimo senza
     * casa. Ma lo si dice — nel registro e nell'esito — e il foglietto resta
     * per il prossimo avvio. */
    final perche = '$fase: $errore'.replaceAll('\n', ' ');
    debugPrint('GdAHome Muro: abbinamento non riuscito ($perche)');
    if (dir != null) await _esito(dir, 'ERRORE $perche');
  }
}

Future<void> _esito(Directory dir, String testo) async {
  try {
    await File('${dir.path}/$nomeDellEsito').writeAsString('$testo\n');
  } catch (_) {
    /* Senza esito l'add-on se ne accorge lo stesso: la casa non vede il
     * pannello collegarsi. */
  }
  debugPrint('GdAHome Muro: abbinamento $testo');
}

Future<void> _sposta(File file, String dove) async {
  try {
    await file.rename(dove);
  } catch (_) {
    await _togli(file);
  }
}

Future<void> _togli(File file) async {
  try {
    await file.delete();
  } catch (_) {
    /* Pazienza: la prossima volta si vede che la casa c'e' gia' e si toglie. */
  }
}
