/// «Se la casa non è associata ancora non può avviarsi il navigatore
/// direttamente su Android Auto.» Senza una casa abbinata in auto si guida
/// base; da quando c'è una casa vale il suo abbonamento.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/licenza/licenza.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/navigatore_qui/sul_telefono.dart';

import 'licenza/gettoni_di_prova.dart';
import 'ponte/ponte_finto.dart';

void main() {
  testWidgets('senza casa si guida base; abbinata una casa, decide lei', (
    tester,
  ) async {
    await tester.runAsync(() async {
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      final collegamento = Collegamento(
        archivio: archivio,
        sonda: Sonda(
          attesa: const Duration(milliseconds: 50),
          bussa: (_) async => false,
        ),
        licenza: GestoreLicenza(chiave: chiaveDiProva),
      );
      const chi = #prova;
      addTearDown(() async {
        lasciaLaCasaPerLaProva(chi);
        await collegamento.chiudi();
      });

      /* Prima di leggere le case non si sa: niente guida regalata. */
      seguiLaCasaPerLaProva(chi, collegamento);
      expect(guidaInAutoSenzaCasa.value, isFalse);

      /* Lette, e non ce n'è nessuna: si guida base. */
      await collegamento.apri();
      expect(guidaInAutoSenzaCasa.value, isTrue);
      expect(
        collegamento.licenza.premium,
        isFalse,
        reason: 'base, non Premium',
      );

      /* Una casa abbinata, Base: in auto vale il suo abbonamento. */
      final casa = await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: IndirizzoDelPonte.leggi('192.168.1.50'),
      );
      await archivio.segnaIlGettone(casa.id, '');
      await collegamento.apri();
      expect(guidaInAutoSenzaCasa.value, isFalse);
    });
  });
}
