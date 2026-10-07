/// La scheda che si apre toccando un comando rapido: nome, icona, conferma,
/// «Salva» e «Togli». E quella per crearne uno, fino a «Aggiungi in auto».
///
/// Col tema vero dell'app: e' il tema che vuole i tasti pieni larghi quanto
/// lo schermo, e senza il tema la prova non vedeva il guaio. «Salva» stava in
/// fila accanto a «Togli», in una riga non trovava posto e non si disegnava:
/// l'icona scelta non si salvava mai. E con la barra dei tre tasti di Android,
/// che l'app ha sopra di se' (disegna fino al bordo dello schermo): il fondo
/// delle schede ci finiva sotto.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/auto/i_comandi.dart';
import 'package:gdahome/auto/la_foto.dart';
import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/schermate/comandi_in_auto.dart';
import 'package:gdahome/vestito/tema.dart';

/// La barra dei tre tasti di Android, in punti.
const double _barra = 48;

ComandoRapido _script(String nome, String entita, {bool conferma = false}) =>
    ComandoRapido(
      id: 'q|$nome|$entita',
      nome: nome,
      genere: GenereDelComando.scena,
      conferma: conferma,
      provenienza: 'Azione rapida',
      ricetta: RicettaDellAzione(
        id: 'q|$nome|$entita',
        dominio: 'script',
        servizio: 'turn_on',
        entita: entita,
      ),
    );

void main() {
  /// La pagina dei comandi su un telefono con la barra di Android in fondo.
  /// Torna l'elenco di quello che la pagina ha scritto, in ordine.
  Future<List<IComandiScelti>> laPagina(
    WidgetTester tester, {
    Size schermo = const Size(412, 800),
    double scritte = 1,
    List<Entita> entita = const [],
  }) async {
    tester.view.physicalSize = schermo * 3;
    tester.view.devicePixelRatio = 3;
    tester.view.padding = const FakeViewPadding(top: 72, bottom: _barra * 3);
    tester.view.viewPadding = const FakeViewPadding(
      top: 72,
      bottom: _barra * 3,
    );
    tester.platformDispatcher.textScaleFactorTestValue = scritte;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final scritti = <IComandiScelti>[];
    await tester.pumpWidget(
      MaterialApp(
        theme: temaScuro(),
        home: ComandiInAuto(
          leggi: () async => IComandiScelti(
            comandi: [
              _script(
                'Cancello Automatico',
                'script.apri_cancello',
                conferma: true,
              ),
              _script('prova', 'script.prova'),
            ],
          ),
          scrivi: (s) async {
            scritti.add(s);
            return true;
          },
          azioni: () async => const AzioniDellaPlancia([]),
          entita: entita,
        ),
      ),
    );
    await tester.pumpAndSettle();
    return scritti;
  }

  Future<void> apriLaScheda(WidgetTester tester) async {
    /* Sullo schermo piccolo, con le scritte grandi, la riga e' piu' giu'. */
    final riga = find.widgetWithText(ListTile, 'Cancello Automatico');
    await tester.ensureVisible(riga);
    await tester.pumpAndSettle();
    await tester.tap(riga);
    await tester.pumpAndSettle();
  }

  Future<void> scegliLIcona(WidgetTester tester, String quale) async {
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text(quale).last);
    await tester.pumpAndSettle();
  }

  testWidgets('«Salva» c\'è, sta sopra la barra di Android e salva l\'icona', (
    tester,
  ) async {
    final scritti = await laPagina(tester);
    await apriLaScheda(tester);
    expect(tester.takeException(), isNull);

    final salva = find.widgetWithText(FilledButton, 'Salva');
    final togli = find.widgetWithText(TextButton, 'Togli');
    expect(salva, findsOneWidget);
    expect(tester.getRect(salva).bottom, lessThanOrEqualTo(800 - _barra));
    expect(tester.getRect(togli).bottom, lessThanOrEqualTo(800 - _barra));

    await scegliLIcona(tester, 'Cancello / varco');
    await tester.tap(salva);
    await tester.pumpAndSettle();

    final cancello = scritti.last.comandi.first;
    expect(cancello.icona, 'varco');
    expect(cancello.nome, 'Cancello Automatico');
    expect(cancello.conferma, isTrue);
    /* E la riga lo mostra col disegno nuovo, come l'auto. */
    expect(cancello.iconaInAuto, 'varco');
  });

  testWidgets('con le scritte grandi la scheda scorre e «Salva» si raggiunge', (
    tester,
  ) async {
    /* Le lettere della prova sono quadrati, piu' larghi di quelle vere: con
     * 1,3 qui la scheda e' gia' piu' alta dello schermo. */
    final scritti = await laPagina(
      tester,
      schermo: const Size(360, 520),
      scritte: 1.3,
    );
    await apriLaScheda(tester);
    expect(tester.takeException(), isNull);
    final scorre = find
        .ancestor(
          of: find.byType(DropdownButtonFormField<String>),
          matching: find.byType(Scrollable),
        )
        .first;
    expect(
      tester.state<ScrollableState>(scorre).position.maxScrollExtent,
      greaterThan(0),
    );

    await scegliLIcona(tester, 'Luce');
    final salva = find.widgetWithText(FilledButton, 'Salva');
    await tester.ensureVisible(salva);
    await tester.pumpAndSettle();
    expect(tester.getRect(salva).bottom, lessThanOrEqualTo(520 - _barra));
    await tester.tap(salva);
    await tester.pumpAndSettle();

    expect(scritti.last.comandi.first.icona, 'luce');
  });

  testWidgets('«Togli» toglie il comando', (tester) async {
    final scritti = await laPagina(tester);
    await apriLaScheda(tester);
    await tester.tap(find.widgetWithText(TextButton, 'Togli'));
    await tester.pumpAndSettle();

    expect(scritti.last.comandi.map((c) => c.nome), ['prova']);
  });

  testWidgets('«Aggiungi in auto», in fondo alla scheda, sta sopra la barra', (
    tester,
  ) async {
    final scritti = await laPagina(
      tester,
      schermo: const Size(360, 560),
      scritte: 1.6,
      entita: const [
        Entita(
          id: 'cover.garage',
          stato: 'closed',
          attributi: {'friendly_name': 'Garage', 'device_class': 'garage'},
        ),
      ],
    );
    await tester.tap(find.text('Crea un comando'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ListTile, 'Garage'));
    await tester.pumpAndSettle();

    final aggiungi = find.widgetWithText(FilledButton, 'Aggiungi in auto');
    await tester.scrollUntilVisible(
      aggiungi,
      200,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.drag(find.byType(Scrollable).last, const Offset(0, -2000));
    await tester.pumpAndSettle();
    expect(tester.getRect(aggiungi).bottom, lessThanOrEqualTo(560 - _barra));
    await tester.tap(aggiungi);
    await tester.pumpAndSettle();

    expect(scritti.last.comandi.map((c) => c.nome), [
      'Cancello Automatico',
      'prova',
      'Garage',
    ]);
  });
}
