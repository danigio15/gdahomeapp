/// Le prove del navigatore: gdanav dentro l'app.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/menu.dart';
import 'package:gdahome/schermate/navigatore_qui/qui.dart';
import 'package:gdanav_app/gdanav_app.dart';

void main() {
  /* Chi usa gdahome solo per la casa non deve accendere gdanav: niente GPS,
   * niente colonnine, niente portachiavi di gdanav. La sezione sta nella
   * fila delle sezioni fin dall'avvio, ma finche' non la si apre non fa
   * niente. */
  testWidgets('finche\' non si apre, gdanav resta spento', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: IlNavigatore(
          visibile: false,
          navigatore: GlobalKey<NavigatorState>(),
        ),
      ),
    );
    expect(find.byType(GdanavDentro), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('nella barra: tre gruppi, e gdanav è la tessera in testa', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final chiave = GlobalKey<BarraDelleSezioniState>();
    var aperto = 0;
    var impostazioni = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Stack(
            children: [
              BarraDelleSezioni(
                key: chiave,
                sezioni: vociDellaBarra(chiAmministra: true),
                aperta: Sezione.plancia,
                vai: (_) {},
                vaiAlleCase: () {},
                tessera: laTesseraDelNavigatore(
                  scelta: false,
                  apri: () => aperto++,
                  impostazioni: () => impostazioni++,
                ),
              ),
            ],
          ),
        ),
      ),
    );
    chiave.currentState!.apri();
    await tester.pumpAndSettle();
    /* Una volta sola: la voce non si ripete fra le righe, c'e' gia' la
     * tessera (che si scrive allo stesso modo). */
    expect(find.text('GDANAV'), findsOneWidget);
    expect(find.text('CASA'), findsOneWidget);
    expect(find.text('AIUTO'), findsOneWidget);
    /* L'aiuto in fondo, le avanzate sopra. */
    expect(
      tester.getTopLeft(find.text('AIUTO')).dy,
      greaterThan(tester.getTopLeft(find.text('AVANZATE')).dy),
    );
    expect(find.text('Tocca per navigare'), findsOneWidget);

    await tester.tap(find.text('GDANAV'));
    expect(aperto, 1);
    await tester.tap(find.byTooltip('Impostazioni del navigatore'));
    expect(impostazioni, 1);
  });

  /* I viaggi pianificati stanno nel navigatore: «Pianifica i viaggi», sotto
   * la tessera, porta li'. Senza chi lo apre, la riga non c'e'. */
  testWidgets('sotto la tessera, «Pianifica i viaggi»', (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    var pianifica = 0;
    var aperto = 0;
    Future<void> barra({VoidCallback? quando}) async {
      final chiave = GlobalKey<BarraDelleSezioniState>();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: BarraDelleSezioni(
              key: chiave,
              sezioni: vociDellaBarra(chiAmministra: true),
              aperta: Sezione.plancia,
              vai: (_) {},
              vaiAlleCase: () {},
              tessera: laTesseraDelNavigatore(
                scelta: false,
                apri: () => aperto++,
                impostazioni: () {},
                pianifica: quando,
              ),
            ),
          ),
        ),
      );
      chiave.currentState!.apri();
      await tester.pumpAndSettle();
    }

    await barra();
    expect(find.text('Pianifica i viaggi'), findsNothing);

    await barra(quando: () => pianifica++);
    expect(find.text('Pianifica i viaggi'), findsOneWidget);
    expect(find.text('Viaggi programmati, col traffico'), findsOneWidget);
    /* Sotto la tessera, e il suo tocco e' suo: non apre la mappa. */
    expect(
      tester.getTopLeft(find.text('Pianifica i viaggi')).dy,
      greaterThan(tester.getTopLeft(find.text('GDANAV')).dy),
    );
    await tester.tap(find.text('Pianifica i viaggi'));
    expect(pianifica, 1);
    expect(aperto, 0);
  });
}
