/// «Quando premo sul cestino coerenzia il messaggio, e se elimino la casa
/// deve scomparire subito: ora devo cliccare su indietro, altrimenti la vedo
/// sempre li'. In qualsiasi maschera togli l'indirizzo sotto
/// (tramite.gdahome.org).»
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/casa/il_lucchetto.dart';
import 'package:gdahome/casa/impostazioni.dart';
import 'package:gdahome/casa/la_guardia.dart';
import 'package:gdahome/schermate/le_case.dart';
import 'package:gdahome/vestito/tema.dart';

class _Guardia implements LaGuardia {
  @override
  Future<CosaSaFareIlTelefono> cosaSaFare() async =>
      const CosaSaFareIlTelefono(sa: {}, ceUnaGuardiaDelSistema: false);

  @override
  Future<ComeEAndata> chiedi({required String perche}) async => ComeEAndata.si;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  testWidgets(
    'eliminata, la casa sparisce subito; e il centralino non si legge',
    (tester) async {
      late Collegamento collegamento;
      late Impostazioni impostazioni;
      await tester.runAsync(() async {
        final archivio = ArchivioDelleCase(CassaforteInMemoria());
        await archivio.apri();
        await archivio.aggiungi(nome: 'Casa al mare', segno: 'a' * 64);
        await archivio.aggiungi(nome: 'Casa in citta', segno: 'b' * 64);
        collegamento = Collegamento(archivio: archivio);
        impostazioni = Impostazioni(
          sulTelefono: true,
          android: true,
          dispensa: DispensaInMemoria(),
        );
        await impostazioni.carica();
      });
      await tester.pumpWidget(
        MaterialApp(
          theme: temaChiaro(),
          home: LeCase(
            collegamento: collegamento,
            aggiungiUnaCasa: () {},
            impostazioni: impostazioni,
            guardia: _Guardia(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Casa al mare'), findsOneWidget);
      expect(find.textContaining('gdahome.org'), findsNothing);
      expect(find.textContaining('tramite'), findsNothing);

      await tester.tap(find.byTooltip('Elimina').first);
      await tester.pumpAndSettle();
      expect(find.text('Eliminare «Casa al mare»?'), findsOneWidget);
      expect(find.text('Annulla'), findsOneWidget);

      await tester.tap(find.widgetWithText(FilledButton, 'Elimina'));
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 50)),
      );
      await tester.pumpAndSettle();
      expect(find.text('Casa al mare'), findsNothing);
      expect(find.text('Casa in citta'), findsOneWidget);
    },
  );
}
