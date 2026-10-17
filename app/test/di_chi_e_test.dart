/// «Di chi è questo telefono?»: il foglio per chi si era abbinato prima, e la
/// casella nell'abbinamento.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/schermate/aggiungi_casa.dart';
import 'package:gdahome/schermate/di_chi_e.dart';

Widget _conUnTasto(void Function(String?) risposta) => MaterialApp(
  home: Builder(
    builder: (context) => Scaffold(
      body: Center(
        child: TextButton(
          onPressed: () async => risposta(await chiediDiChiE(context)),
          child: const Text('apri'),
        ),
      ),
    ),
  ),
);

void main() {
  testWidgets('si scrive il nome e si salva, ripulito', (tester) async {
    String? detto = 'non chiamato';
    await tester.pumpWidget(_conUnTasto((nome) => detto = nome));
    await tester.tap(find.text('apri'));
    await tester.pumpAndSettle();

    expect(find.text('Di chi è questo telefono?'), findsWidgets);
    await tester.enterText(find.byType(TextField), '  Persona   1 ');
    await tester.tap(find.text('Salva'));
    await tester.pumpAndSettle();
    expect(detto, 'Persona 1');
  });

  testWidgets('«Più tardi» non risponde niente', (tester) async {
    String? detto = 'non chiamato';
    await tester.pumpWidget(_conUnTasto((nome) => detto = nome));
    await tester.tap(find.text('apri'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Più tardi'));
    await tester.pumpAndSettle();
    expect(detto, isNull);
  });

  testWidgets(
    'nell\'abbinamento la casella ritrova il nome già detto per un\'altra casa',
    (tester) async {
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      await archivio.segnaIlProprietario('Persona 1');
      await tester.pumpWidget(
        MaterialApp(
          home: AggiungiCasa(archivio: archivio, quandoFatto: (_) {}),
        ),
      );
      await tester.pumpAndSettle();
      final casella = tester.widget<TextField>(
        find.widgetWithText(TextField, 'Di chi è questo telefono?'),
      );
      expect(casella.controller!.text, 'Persona 1');
    },
  );
}
