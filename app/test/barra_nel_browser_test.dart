/// Che nel browser la barra si apra davvero, e che sulla plancia non ci sia
/// piu' niente di nostro.
///
/// Nel browser la plancia e' un `iframe`, e un `iframe` si mangia i tocchi di
/// tutto quello che gli sta sopra: a barra aperta le sue voci si vedevano e non
/// si premevano. Il perche' — e il come — sta in
/// `schermate/da_parte_qui/qui.dart`.
///
/// Qui non si prova la pagina: le prove girano su una macchina virtuale, e li'
/// nessuna pagina c'e'. Si prova **quando** la barra chiede alla plancia di
/// farsi da parte — che e' l'unica cosa che si puo' sbagliare, perche' il pezzo
/// che tocca la pagina sono due righe di stile.
///
/// E si prova che sul bordo sinistro non ci sia piu' nessun gesto nostro: e'
/// per quello che la fascia invisibile che c'era se n'e' andata. Stava sopra la
/// plancia, e sulla Configurazione la plancia sul bordo sinistro ha le sue
/// sezioni: si toccava una sezione e si apriva il menu.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/da_parte.dart';
import 'package:gdahome/schermate/menu.dart';

/// Una plancia che non tocca nessuna pagina e tiene il conto di quello che le
/// si chiede.
class _DaParteFinta extends LaPlanciaDaParte {
  /// Ogni volta che la plancia si sposta o torna, in ordine.
  final List<bool> spostata = [];

  @override
  void siFaDaParte(bool si) => spostata.add(si);
}

Widget _conLaBarra({
  required GlobalKey<BarraDelleSezioniState> chiave,
  required _DaParteFinta daParte,
  required bool sopraLaPlancia,
  void Function(Sezione dove)? vai,
}) => MaterialApp(
  home: Scaffold(
    body: Stack(
      children: [
        BarraDelleSezioni(
          key: chiave,
          sezioni: vociDellaBarra(),
          aperta: Sezione.plancia,
          vai: vai ?? (_) {},
          vaiAlleCase: () {},
          sopraLaPlancia: sopraLaPlancia,
          daParte: daParte,
        ),
      ],
    ),
  ),
);

void main() {
  group('sul bordo della plancia non c\'è più niente di nostro', () {
    testWidgets('toccare il bordo sinistro non apre la barra', (prova) async {
      prova.view.physicalSize = const Size(400, 800);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      final chiave = GlobalKey<BarraDelleSezioniState>();
      await prova.pumpWidget(
        _conLaBarra(
          chiave: chiave,
          daParte: _DaParteFinta(),
          sopraLaPlancia: true,
        ),
      );

      /* Dove stava la fascia: due punti dal bordo, a meta' altezza. E' la
       * stessa striscia dove la Configurazione della plancia tiene le sue
       * sezioni, larga quarantasei punti. */
      await prova.tapAt(const Offset(2, 400));
      await prova.pumpAndSettle();

      expect(chiave.currentState!.aperta, isFalse);
    });

    testWidgets('e non c\'è nessuna pillola disegnata', (prova) async {
      prova.view.physicalSize = const Size(400, 800);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      await prova.pumpWidget(
        _conLaBarra(
          chiave: GlobalKey<BarraDelleSezioniState>(),
          daParte: _DaParteFinta(),
          sopraLaPlancia: true,
        ),
      );

      expect(
        find.byWidgetPredicate(
          (quale) =>
              quale is Semantics &&
              quale.properties.label == nomeDelTastoDellaBarra,
        ),
        findsNothing,
        reason: 'il ☰ sta nella barra del titolo, non sopra la plancia',
      );
    });
  });

  group('la plancia si fa da parte', () {
    testWidgets('mentre la barra la copre, e torna quando si chiude', (
      prova,
    ) async {
      prova.view.physicalSize = const Size(400, 800);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      final daParte = _DaParteFinta();
      final chiave = GlobalKey<BarraDelleSezioniState>();
      await prova.pumpWidget(
        _conLaBarra(chiave: chiave, daParte: daParte, sopraLaPlancia: true),
      );
      expect(daParte.spostata, isEmpty, reason: 'a barra chiusa non si tocca');

      chiave.currentState!.apri();
      /* Due colpi: il primo mette in moto l'animazione, il secondo la fa
       * correre. Con uno solo la barra e' ancora a zero e non copre niente. */
      await prova.pump();
      await prova.pump(const Duration(milliseconds: 100));
      expect(daParte.spostata, [true]);

      chiave.currentState!.chiudi();
      await prova.pumpAndSettle();
      expect(daParte.spostata, [true, false]);
    });

    testWidgets('e non si sposta due volte mentre la barra scorre', (
      prova,
    ) async {
      prova.view.physicalSize = const Size(400, 800);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      final daParte = _DaParteFinta();
      final chiave = GlobalKey<BarraDelleSezioniState>();
      await prova.pumpWidget(
        _conLaBarra(chiave: chiave, daParte: daParte, sopraLaPlancia: true),
      );

      chiave.currentState!.apri();
      await prova.pumpAndSettle();

      expect(daParte.spostata, [true]);
    });

    testWidgets('dove la barra resta non copre niente, e non si sposta', (
      prova,
    ) async {
      prova.view.physicalSize = const Size(1200, 900);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      final daParte = _DaParteFinta();
      final chiave = GlobalKey<BarraDelleSezioniState>();
      await prova.pumpWidget(
        _conLaBarra(chiave: chiave, daParte: daParte, sopraLaPlancia: true),
      );

      chiave.currentState!.apri();
      await prova.pumpAndSettle();

      expect(daParte.spostata, isEmpty);
    });

    testWidgets('quando la barra se ne va, rimette tutto a posto', (
      prova,
    ) async {
      prova.view.physicalSize = const Size(400, 800);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);
      final daParte = _DaParteFinta();
      final chiave = GlobalKey<BarraDelleSezioniState>();
      await prova.pumpWidget(
        _conLaBarra(chiave: chiave, daParte: daParte, sopraLaPlancia: true),
      );
      chiave.currentState!.apri();
      /* Due colpi: il primo mette in moto l'animazione, il secondo la fa
       * correre. Con uno solo la barra e' ancora a zero e non copre niente. */
      await prova.pump();
      await prova.pump(const Duration(milliseconds: 100));

      await prova.pumpWidget(const MaterialApp(home: SizedBox()));

      expect(
        daParte.spostata.last,
        isFalse,
        reason: 'la plancia riprende i tocchi',
      );
    });
  });

  group('la barra non decide se un tocco serve', () {
    testWidgets('anche la voce già segnata arriva a chi la ascolta', (
      prova,
    ) async {
      prova.view.physicalSize = const Size(400, 800);
      prova.view.devicePixelRatio = 1;
      addTearDown(prova.view.reset);

      /* «Plancia» premuta stando — per quel che ne sa il menu — sulla
       * plancia. La barra si teneva quel tocco: `dove != aperta`, e allora
       * chi ascolta non sapeva niente.
       *
       * Due gesti ci passavano. Uscire dalla Configurazione quando il menu
       * s'era scollato dalla pagina — la plancia riparte, dice «sono sulla
       * mia Home», e un momento dopo la Config si riapre: il menu segnato
       * sulla Plancia, lo schermo sulla Config, e «Plancia» che non faceva
       * niente. E la ricarica, che sta scritta nella home dell'app e non era
       * mai partita: dentro un riquadro non c'e' da tirare giu' per
       * aggiornare, e quel tocco e' il gesto piu' vicino.
       *
       * Se un tocco serve o no lo decide chi sa dov'e' la pagina, non la
       * barra. */
      final premute = <Sezione>[];
      final chiave = GlobalKey<BarraDelleSezioniState>();
      await prova.pumpWidget(
        _conLaBarra(
          chiave: chiave,
          daParte: _DaParteFinta(),
          sopraLaPlancia: true,
          vai: premute.add,
        ),
      );
      chiave.currentState!.apri();
      await prova.pumpAndSettle();

      await prova.tap(find.text(vociDellaBarra().first.titolo.toUpperCase()));
      await prova.pump();

      expect(premute, [Sezione.plancia]);
    });
  });
}
