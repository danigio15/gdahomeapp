/// Che nel browser la barra si apra davvero.
///
/// Nel browser la plancia e' un `iframe`, e un `iframe` si mangia i tocchi di
/// tutto quello che gli sta sopra: la maniglia si vedeva e non si apriva, e a
/// barra aperta le sue voci non si premevano. Il perche' — e il come — sta in
/// `schermate/maniglia_qui/qui.dart`.
///
/// Qui non si prova la pagina: le prove girano su una macchina virtuale, e li'
/// nessuna pagina c'e'. Si prova **quando** la barra chiede di rivelare la
/// maniglia e quando chiede alla plancia di farsi da parte — che e' l'unica
/// cosa che si puo' sbagliare, perche' il pezzo che tocca la pagina sono tre
/// righe di stile.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/maniglia.dart';
import 'package:gdahome/schermate/menu.dart';

/// Una fascia che non tocca nessuna pagina e tiene il conto di quello che le
/// si chiede.
class _FasciaFinta extends LaFasciaDelGesto {
  int messa = 0;
  int tolta = 0;

  /// Ogni volta che la plancia si sposta o torna, in ordine.
  final List<bool> spostata = [];

  double? larga;
  double? alta;
  double? dalBordo;

  @override
  void metti({
    required double larga,
    required double alta,
    required double dalBordo,
  }) {
    messa += 1;
    this.larga = larga;
    this.alta = alta;
    this.dalBordo = dalBordo;
  }

  @override
  void togli() => tolta += 1;

  @override
  void laPlanciaSiFaDaParte(bool si) => spostata.add(si);
}

/// La maniglia disegnata: si cerca dal nome che ha per chi non vede, che e'
/// l'unica cosa che la distingue.
final laManiglia = find.byWidgetPredicate(
  (quale) => quale is Semantics && quale.properties.label == nomeDellaManiglia,
);

Widget _conLaBarra({
  required GlobalKey<BarraDelleSezioniState> chiave,
  required _FasciaFinta fascia,
  required bool sopraLaPlancia,
}) => MaterialApp(
  home: Scaffold(
    body: Stack(
      children: [
        BarraDelleSezioni(
          key: chiave,
          sezioni: vociDellaBarra(),
          aperta: Sezione.plancia,
          vai: (_) {},
          vaiAlleCase: () {},
          sopraLaPlancia: sopraLaPlancia,
          fascia: fascia,
        ),
      ],
    ),
  ),
);

void main() {
  group('la fascia dei gesti', () {
    testWidgets('sopra la plancia si mette, e sta dov\'e\' la maniglia', (
      prova,
    ) async {
      prova.view.physicalSize = const Size(400, 800);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      final fascia = _FasciaFinta();
      await prova.pumpWidget(
        _conLaBarra(
          chiave: GlobalKey<BarraDelleSezioniState>(),
          fascia: fascia,
          sopraLaPlancia: true,
        ),
      );

      expect(fascia.messa, 1);
      /* Le misure non si scrivono a mano: si confrontano con la maniglia
       * disegnata. E' tutto il punto — il dito deve trovare il gesto dove
       * vede la pillola, e due numeri tenuti a mano prima o poi divergono. */
      final dovE = prova.getRect(laManiglia);
      expect(fascia.larga, dovE.width);
      expect(fascia.alta, dovE.height);
      expect(fascia.dalBordo, dovE.left);
    });

    testWidgets('non si mette una seconda volta a ogni ridisegno', (
      prova,
    ) async {
      prova.view.physicalSize = const Size(400, 800);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      final fascia = _FasciaFinta();
      final chiave = GlobalKey<BarraDelleSezioniState>();
      await prova.pumpWidget(
        _conLaBarra(chiave: chiave, fascia: fascia, sopraLaPlancia: true),
      );
      await prova.pumpWidget(
        _conLaBarra(chiave: chiave, fascia: fascia, sopraLaPlancia: true),
      );

      expect(fascia.messa, 1);
      expect(fascia.tolta, 0);
    });

    testWidgets('sulle altre sezioni non si mette: li\' i tocchi arrivano', (
      prova,
    ) async {
      prova.view.physicalSize = const Size(400, 800);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      final fascia = _FasciaFinta();
      await prova.pumpWidget(
        _conLaBarra(
          chiave: GlobalKey<BarraDelleSezioniState>(),
          fascia: fascia,
          sopraLaPlancia: false,
        ),
      );

      expect(fascia.messa, 0);
    });

    testWidgets('passando a un\'altra sezione si toglie', (prova) async {
      prova.view.physicalSize = const Size(400, 800);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      final fascia = _FasciaFinta();
      final chiave = GlobalKey<BarraDelleSezioniState>();
      await prova.pumpWidget(
        _conLaBarra(chiave: chiave, fascia: fascia, sopraLaPlancia: true),
      );
      await prova.pumpWidget(
        _conLaBarra(chiave: chiave, fascia: fascia, sopraLaPlancia: false),
      );

      expect(fascia.tolta, 1);
    });

    testWidgets('dove la barra resta non c\'e\' maniglia, e non si mette', (
      prova,
    ) async {
      prova.view.physicalSize = const Size(1200, 900);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      final fascia = _FasciaFinta();
      await prova.pumpWidget(
        _conLaBarra(
          chiave: GlobalKey<BarraDelleSezioniState>(),
          fascia: fascia,
          sopraLaPlancia: true,
        ),
      );

      expect(laManiglia, findsNothing);
      expect(fascia.messa, 0);
    });
  });

  group('la plancia si fa da parte', () {
    testWidgets('mentre la barra la copre, e torna quando si chiude', (
      prova,
    ) async {
      prova.view.physicalSize = const Size(400, 800);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      final fascia = _FasciaFinta();
      final chiave = GlobalKey<BarraDelleSezioniState>();
      await prova.pumpWidget(
        _conLaBarra(chiave: chiave, fascia: fascia, sopraLaPlancia: true),
      );
      expect(fascia.spostata, isEmpty, reason: 'a barra chiusa non si tocca');

      chiave.currentState!.apri();
      /* Due colpi: il primo mette in moto l'animazione, il secondo la fa
       * correre. Con uno solo la barra e' ancora a zero e non copre niente. */
      await prova.pump();
      await prova.pump(const Duration(milliseconds: 100));
      expect(fascia.spostata, [true]);

      chiave.currentState!.chiudi();
      await prova.pumpAndSettle();
      expect(fascia.spostata, [true, false]);
    });

    testWidgets('e non si sposta due volte mentre la barra scorre', (
      prova,
    ) async {
      prova.view.physicalSize = const Size(400, 800);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      final fascia = _FasciaFinta();
      final chiave = GlobalKey<BarraDelleSezioniState>();
      await prova.pumpWidget(
        _conLaBarra(chiave: chiave, fascia: fascia, sopraLaPlancia: true),
      );

      chiave.currentState!.apri();
      await prova.pumpAndSettle();

      expect(fascia.spostata, [true]);
    });

    testWidgets('dove la barra resta non copre niente, e non si sposta', (
      prova,
    ) async {
      prova.view.physicalSize = const Size(1200, 900);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      final fascia = _FasciaFinta();
      final chiave = GlobalKey<BarraDelleSezioniState>();
      await prova.pumpWidget(
        _conLaBarra(chiave: chiave, fascia: fascia, sopraLaPlancia: true),
      );

      chiave.currentState!.apri();
      await prova.pumpAndSettle();

      expect(fascia.spostata, isEmpty);
    });

    testWidgets('quando la barra se ne va, rimette tutto a posto', (
      prova,
    ) async {
      prova.view.physicalSize = const Size(400, 800);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      final fascia = _FasciaFinta();
      final chiave = GlobalKey<BarraDelleSezioniState>();
      await prova.pumpWidget(
        _conLaBarra(chiave: chiave, fascia: fascia, sopraLaPlancia: true),
      );
      chiave.currentState!.apri();
      /* Due colpi: il primo mette in moto l'animazione, il secondo la fa
       * correre. Con uno solo la barra e' ancora a zero e non copre niente. */
      await prova.pump();
      await prova.pump(const Duration(milliseconds: 100));

      await prova.pumpWidget(const MaterialApp(home: SizedBox()));

      expect(
        fascia.spostata.last,
        isFalse,
        reason: 'la plancia riprende i tocchi',
      );
      expect(fascia.tolta, 1, reason: 'e la fascia non resta nella pagina');
    });
  });
}
