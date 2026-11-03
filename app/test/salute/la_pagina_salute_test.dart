/// La pagina Salute dice la data delle misure vecchie, cosa fare per quelle
/// che non arrivano, e perche' la casa non le accetta.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/salute/il_corpo.dart';
import 'package:gdahome/salute/postino_della_salute.dart';
import 'package:gdahome/schermate/salute.dart';

import 'finti.dart';
import 'scene.dart';

Future<void> _laPagina(
  WidgetTester tester, {
  required Map<MisuraDelCorpo, Lettura> lette,
  String? rifiuta,
}) async {
  tester.view.physicalSize = const Size(390 * 3, 2400 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  late Collegamento collegamento;
  late PostinoDellaSalute postino;
  await tester.runAsync(() async {
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();
    await archivio.segnaIlProprietario('Marco');
    collegamento = Collegamento(archivio: archivio);
    postino = PostinoDellaSalute(
      lettore: LettoreFinto(lette: lette),
      dispensa: DispensaInMemoria(),
      adesso: () => seraDel3Novembre,
    );
    await postino.accendi(
      FiloFinto(rifiuta: rifiuta),
      const ScelteDellaSalute(persona: 'Marco', misure: tutteLeScelte),
    );
  });
  await tester.pumpWidget(
    MaterialApp(
      home: SchermataDellaSalute(collegamento: collegamento, postino: postino),
    ),
  );
  await tester.runAsync(
    () => Future<void>.delayed(const Duration(milliseconds: 200)),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('le misure vecchie portano il loro giorno', (tester) async {
    await _laPagina(tester, lette: tutteDiMarco);
    expect(find.text("l'ultimo · 73 bpm · 1 nov"), findsOneWidget);
    expect(find.text("l'ultima pesata · 81,4 kg · 28 ott"), findsOneWidget);
    expect(find.text('quelli di oggi · 1.949'), findsOneWidget);
    expect(find.byKey(const Key('salute-guasto')), findsNothing);
    expect(find.textContaining('Salute non ne ha'), findsNothing);
  });

  testWidgets('una misura che non arriva dice dove guardare', (tester) async {
    await _laPagina(tester, lette: senzaBilancia);
    expect(find.byKey(const Key('salute-manca-peso')), findsOneWidget);
    expect(find.byKey(const Key('salute-manca-battito')), findsNothing);
    expect(
      find.textContaining('Impostazioni › Salute › Accesso ai dati'),
      findsNWidgets(4),
    );
  });

  testWidgets('la casa senza Premium: si dice, e non si finge', (tester) async {
    await _laPagina(tester, lette: tutteDiMarco, rifiuta: 'premium-richiesto');
    expect(find.byKey(const Key('salute-guasto')), findsOneWidget);
    expect(find.textContaining('GdAHome Premium'), findsOneWidget);
    expect(
      find.text('Acceso, ma la casa non accetta le misure.'),
      findsOneWidget,
    );
  });
}
