/// Fuori casa senza Premium: la plancia dice perche' non si entra, e col
/// tasto giusto. Una casa Base propone Premium; una con l'add-on vecchio
/// chiede prima di aggiornarlo, perche' li' Premium non si puo' comprare.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/casa/impostazioni.dart';
import 'package:gdahome/licenza/licenza.dart';
import 'package:gdahome/plancia/servitore_qui/qui.dart';
import 'package:gdahome/ponte/filo.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/plancia_vera.dart';
import 'package:gdahome/vestito/tema.dart';

import 'licenza/gettoni_di_prova.dart';
import 'ponte/ponte_finto.dart';

/// La plancia vera qui non serve: un servitore che non si accende.
class _SenzaPlancia extends FabbricaDellaPlancia {
  @override
  Future<ServitoreDiQuestoSistema?> servitore(
    Filo? Function() filo, {
    String lingua = 'it',
  }) async => null;
}

void main() {
  /// Una casa con le strade di fuori, da un telefono che non ne raggiunge
  /// nessuna: si e' fuori casa.
  Future<Collegamento> fuoriCasa(
    WidgetTester tester, {
    required bool addonVecchio,
  }) async {
    late Collegamento collegamento;
    await tester.runAsync(() async {
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      final casa = await archivio.aggiungi(
        nome: 'Casa al lago',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        casaAlCentralino: casaDiProva,
        centralino: IndirizzoDelCentralino.leggi('wss://centralino.esempio.it'),
        inCasa: IndirizzoDelPonte.leggi('192.168.1.50'),
      );
      if (addonVecchio) {
        await archivio.segnaSenzaLicenze(casa.id);
      } else {
        await archivio.segnaIlGettone(casa.id, '');
      }
      collegamento = Collegamento(
        archivio: archivio,
        sonda: Sonda(
          attesa: const Duration(milliseconds: 100),
          bussa: (_) async => false,
        ),
        licenza: GestoreLicenza(chiave: chiaveDiProva),
      );
      await collegamento.apri();
    });
    addTearDown(() => tester.runAsync(collegamento.chiudi));
    return collegamento;
  }

  Future<void> mostra(WidgetTester tester, Collegamento collegamento) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        theme: temaChiaro(),
        home: Scaffold(
          body: PlanciaVera(
            collegamento: collegamento,
            fabbrica: _SenzaPlancia(),
            impostazioni: Impostazioni(
              sulTelefono: true,
              android: false,
              dispensa: DispensaInMemoria(),
            ),
            vaiAlleCase: () {},
          ),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('con la casa Base, fuori casa si propone Premium', (
    tester,
  ) async {
    final collegamento = await fuoriCasa(tester, addonVecchio: false);
    expect(collegamento.fuoriCasaSenzaPremium, isTrue);
    await mostra(tester, collegamento);
    expect(find.text('Scopri gdahome Premium'), findsOneWidget);
    expect(find.text('Aggiorna l\'add-on gdahome'), findsNothing);
  });

  testWidgets('con l\'add-on vecchio, fuori casa si chiede di aggiornarlo', (
    tester,
  ) async {
    final collegamento = await fuoriCasa(tester, addonVecchio: true);
    expect(collegamento.fuoriCasaSenzaPremium, isTrue);
    expect(
      collegamento.licenza.comeSta(collegamento.casa),
      ComeStaLaLicenza.casaSenzaLicenze,
    );
    await mostra(tester, collegamento);
    expect(find.text('Aggiorna l\'add-on gdahome'), findsOneWidget);
    expect(find.textContaining('è una versione vecchia'), findsOneWidget);
  });
}
