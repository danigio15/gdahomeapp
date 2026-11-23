/// La pagina Salute col WHOOP, per le prove e le fotografie: un iPhone con
/// l'app WHOOP che scrive in Salute, e l'account WHOOP collegato o no. Tutto
/// inventato.
library;

import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/salute/il_corpo.dart';
import 'package:gdahome/salute/postino_della_salute.dart';
import 'package:gdahome/salute/whoop/collegamento_whoop.dart';
import 'package:gdahome/salute/whoop/lettore_con_whoop.dart';

import 'finti.dart';
import 'whoop_finto.dart';

/// Quello che l'app WHOOP ha scritto in Salute stanotte, e i passi
/// dell'iPhone.
final dalWhoopInSalute = <MisuraDelCorpo, Lettura>{
  MisuraDelCorpo.passi: Lettura(2318, mattinaWhoop),
  MisuraDelCorpo.battito: Lettura(
    66,
    mattinaWhoop.subtract(const Duration(minutes: 12)),
    fonte: Fonte.whoop,
  ),
  MisuraDelCorpo.battitoRiposo: Lettura(
    55,
    DateTime.parse('2026-11-03T06:30:00Z').toLocal(),
    fonte: Fonte.whoop,
  ),
  MisuraDelCorpo.hrv: Lettura(
    46,
    DateTime.parse('2026-11-03T06:30:00Z').toLocal(),
    fonte: Fonte.whoop,
  ),
  MisuraDelCorpo.respiro: Lettura(
    14.2,
    DateTime.parse('2026-11-03T06:30:00Z').toLocal(),
    fonte: Fonte.whoop,
  ),
  MisuraDelCorpo.sonno: Lettura(
    431,
    DateTime.parse('2026-11-03T06:35:00Z').toLocal(),
    fonte: Fonte.whoop,
  ),
  MisuraDelCorpo.calorie: Lettura(212, mattinaWhoop),
  MisuraDelCorpo.calorieRiposo: Lettura(610, mattinaWhoop),
  MisuraDelCorpo.distanza: Lettura(1.74, mattinaWhoop),
  MisuraDelCorpo.piani: Lettura(4, mattinaWhoop),
  MisuraDelCorpo.esercizio: Lettura(12, mattinaWhoop),
  MisuraDelCorpo.inPiedi: Lettura(3, mattinaWhoop),
  MisuraDelCorpo.peso: Lettura(72.5, DateTime(2026, 10, 30, 7, 10)),
  MisuraDelCorpo.sistolica: Lettura(118, DateTime(2026, 11, 1, 20)),
  MisuraDelCorpo.diastolica: Lettura(76, DateTime(2026, 11, 1, 20)),
};

class ScenaWhoop {
  ScenaWhoop._(this.collegamento, this.postino, this.whoop, this.server);

  final Collegamento collegamento;
  final PostinoDellaSalute postino;
  final CollegamentoWhoop whoop;
  final ServerWhoopFinto server;

  /// Da chiamare dentro `tester.runAsync`.
  static Future<ScenaWhoop> prepara({
    required bool collegato,
    Map<MisuraDelCorpo, Lettura>? dalTelefono,
  }) async {
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();
    await archivio.segnaIlProprietario('Alex');
    final collegamento = Collegamento(archivio: archivio);
    final server = ServerWhoopFinto();
    final cassaforte = CassaforteInMemoria();
    if (collegato) {
      await cassaforte.scrivi(
        CollegamentoWhoop.chiaveToken,
        TokenWhoop(
          accesso: server.accesso,
          rinnovo: server.rinnovo,
          scade: mattinaWhoop.add(const Duration(hours: 1)),
          utente: '4242',
        ).comeSiScrive,
      );
    }
    final whoop = CollegamentoWhoop(
      configurazione: configurazioneFinta,
      cassaforte: cassaforte,
      rete: server.rete,
      apri: (_) async => true,
      adesso: () => mattinaWhoop,
    );
    final postino = PostinoDellaSalute(
      lettore: LettoreConWhoop(
        LettoreFinto(lette: dalTelefono ?? dalWhoopInSalute),
        whoop,
      ),
      dispensa: DispensaInMemoria(),
      adesso: () => mattinaWhoop,
    );
    await postino.accendi(
      FiloFinto(),
      const ScelteDellaSalute(persona: 'Alex'),
    );
    return ScenaWhoop._(collegamento, postino, whoop, server);
  }
}
