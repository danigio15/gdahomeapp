/// L'avvio di GdAHome Muro: legge il foglietto e si mette nella casa.
///
/// GdAHome Muro e' l'app GdAHome che gira sul pannello (il Sonoff NSPanel con
/// GdAHome OS). Non si abbina inquadrando un QR: l'add-on l'ha gia' fatta
/// entrare nella casa installandola, e ha lasciato il foglietto nella cartella
/// dell'app (`installatore-pannelli.js`). Al primo avvio lo si legge e si mette
/// la casa nell'archivio, come se ci si fosse appena abbinati; da li' in poi e'
/// un telefono come gli altri, e l'app parte sulla plancia a muro.
///
/// Il foglietto si legge una volta sola: fatto entrare il pannello, lo si
/// cancella. Se non c'e' (un pannello gia' avviato, o un telefono qualunque con
/// questa app) non si fa niente e l'app parte normale.
library;

import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../casa/archivio_delle_case.dart';
import '../casa/cassaforte.dart';
import 'foglietto_del_muro.dart';

/// Il nome del foglietto nella cartella dell'app (`getApplicationSupportDirectory`,
/// su Android `files/`), dove l'add-on lo scrive intestandolo all'app.
const nomeDelFoglietto = 'abbinamento.json';

/// Mette la casa del foglietto nell'archivio, se c'e' un foglietto e la casa
/// non c'e' gia'. Da chiamare prima di avviare l'app. Non lancia: un foglietto
/// che non si legge lascia partire l'app com'e'.
Future<void> provvediDalFoglietto({
  ArchivioDelleCase? archivio,
  Directory? cartella,
}) async {
  try {
    final dir = cartella ?? await getApplicationSupportDirectory();
    final file = File('${dir.path}/$nomeDelFoglietto');
    if (!await file.exists()) return;
    final foglietto = FogliettoDelMuro.daJson(await file.readAsString());
    if (foglietto == null) {
      /* Rovinato: lo si toglie, non serve riprovarci a ogni avvio. */
      await _togli(file);
      return;
    }

    final arch = archivio ?? ArchivioDelleCase(const CassaforteDelSistema());
    if (!arch.aperto) await arch.apri();
    /* Gia' dentro: il pannello e' gia' avviato una volta. Si toglie il
     * foglietto e si va avanti. */
    final gia = arch.tutte.any(
      (c) => c.identificativo == foglietto.dispositivo,
    );
    if (!gia) {
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
        await arch.segnaLaPlancia(messa.id, foglietto.plancia!);
      }
    }
    await _togli(file);
  } catch (_) {
    /* Qualunque cosa vada storta nel leggere il foglietto, l'app parte lo
     * stesso: al massimo senza casa, e si abbina a mano come un telefono. */
  }
}

Future<void> _togli(File file) async {
  try {
    await file.delete();
  } catch (_) {
    /* Pazienza: la prossima volta si vede che la casa c'e' gia' e si toglie. */
  }
}
