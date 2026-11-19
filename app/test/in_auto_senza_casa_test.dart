/// In auto si guida solo con Premium: Android Auto e CarPlay non sono di
/// Base, e nemmeno di chi una casa non l'ha ancora abbinata. Prima senza
/// casa si guidava base; adesso vale sempre il Premium della casa.
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
  testWidgets('senza casa niente guida in auto; con una casa Base nemmeno', (
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

      seguiLaCasaPerLaProva(chi, collegamento);
      /* Lette, e non ce n'è nessuna: in auto niente, come con Base. */
      await collegamento.apri();
      expect(premiumPerGdanav.value, isFalse);

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
      expect(premiumPerGdanav.value, isFalse);
    });
  });
}
