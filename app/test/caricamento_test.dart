/// L'attesa dell'app e' una sola (schermate/caricamento.dart).
///
/// All'avvio si vedevano tre attese diverse: una rotella sola, «Casa · da
/// fuori · Apro la plancia…», e il velo della plancia dentro la pagina. Qui
/// si tiene fermo che l'attesa e' quella di gdahome, che si muove con un
/// tempo solo anche quando cambia posto, che con «riduci animazioni» e'
/// calma ma viva (niente che si sposti, cresca o giri; luci che si accendono
/// sul posto), che parte dal colore della schermata d'avvio del sistema — e che
/// **non trattiene niente**: se ne va appena la cosa che aspetta e' pronta.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/parole.dart';
import 'package:gdahome/schermate/caricamento.dart';
import 'package:gdahome/vestito/marchio.dart';

Widget _dentro(
  Widget figlio, {
  Brightness luce = Brightness.light,
  bool fermo = false,
}) => MaterialApp(
  theme: ThemeData(brightness: luce),
  builder: (context, schermata) => MediaQuery(
    data: MediaQuery.of(context).copyWith(disableAnimations: fermo),
    child: schermata!,
  ),
  home: Scaffold(body: figlio),
);

/// Il marchio vero: il primo. Il secondo e' la sua riflessione.
Finder get _ilMarchio => find.byType(Marchio).first;

/// Quanto si vede il marchio: compare sotto le iniziali che gli arrivano
/// addosso.
double _marchio(WidgetTester tester) => tester
    .widget<Opacity>(
      find.ancestor(of: _ilMarchio, matching: find.byType(Opacity)).first,
    )
    .opacity;

/// Le iniziali G, d, A che si scrivono, se ci sono.
Finder get _leIniziali => find.byWidgetPredicate(
  (w) => w is CustomPaint && '${w.painter.runtimeType}' == '_Iniziali',
);

void main() {
  setUp(ripartiLAttesa);
  tearDown(() => laLingua = Lingua.italiano);

  testWidgets('l\'attesa dell\'app ha il marchio di GdAHome, il nome della '
      'casa e «Caricamento…»: niente «DASHBOARDMODERN», niente «da fuori»', (
    tester,
  ) async {
    await tester.pumpWidget(
      _dentro(
        const CaricamentoDellaPlancia(
          fase: FaseDelCaricamento.apro,
          nome: 'Casa Rossi',
        ),
      ),
    );
    await tester.pump();
    /* Il nome entra dopo il lampo, lettera per lettera; la riga cambia ai
     * due secondi e mezzo. */
    await tester.pump(const Duration(milliseconds: 2300));
    expect(find.text('DASHBOARDMODERN'), findsNothing);
    expect(find.byType(Marchio), findsWidgets);
    expect(find.text('Caricamento…'), findsOneWidget);
    expect(find.text('CASA ROSSI'), findsOneWidget);
    expect(find.textContaining('da fuori'), findsNothing);
    expect(find.textContaining('plancia…'), findsNothing);
  });

  testWidgets('il primo fotogramma è il fondo pieno della schermata d\'avvio; '
      'poi si scrivono le iniziali, e in un secondo e un quarto c\'è il '
      'marchio', (tester) async {
    await tester.pumpWidget(_dentro(const CaricamentoDellaPlancia()));
    expect(_marchio(tester), 0, reason: 'al tempo zero non c\'è niente');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(_leIniziali, findsOneWidget, reason: 'G, d, A si scrivono');
    expect(_marchio(tester), 0, reason: 'prima le iniziali, poi il marchio');
    await tester.pump(const Duration(milliseconds: 600));
    expect(_marchio(tester), inExclusiveRange(0, 1), reason: 'ci entrano');
    await tester.pump(const Duration(milliseconds: 200));
    expect(_marchio(tester), 1);
    expect(_leIniziali, findsNothing, reason: 'si sono fuse nel marchio');
  });

  testWidgets('il fondo è quello della schermata d\'avvio, chiaro e scuro', (
    tester,
  ) async {
    Color fondo() => tester
        .widgetList<ColoredBox>(
          find.descendant(
            of: find.byType(CaricamentoDellaPlancia),
            matching: find.byType(ColoredBox),
          ),
        )
        .first
        .color;
    await tester.pumpWidget(_dentro(const CaricamentoDellaPlancia()));
    expect(fondo(), fondoDelCaricamentoChiaro);
    await tester.pumpWidget(
      _dentro(const CaricamentoDellaPlancia(), luce: Brightness.dark),
    );
    /* Il tema dell'app cambia sfumando: si aspetta che arrivi. */
    await tester.pump(const Duration(seconds: 1));
    expect(fondo(), fondoDelCaricamentoScuro);
  });

  test('la schermata d\'avvio di Android e di iOS ha lo stesso fondo del '
      'primo fotogramma: niente lampi nel passaggio', () {
    String esa(Color c) => c
        .toARGB32()
        .toRadixString(16)
        .substring(2)
        .toUpperCase()
        .padLeft(6, '0');
    final colori = File('android/app/src/main/res/values/colors.xml')
        .readAsStringSync();
    expect(
      colori,
      contains(
        '<color name="fondo_chiaro">#${esa(fondoDelCaricamentoChiaro)}</color>',
      ),
    );
    expect(
      colori,
      contains(
        '<color name="fondo_scuro">#${esa(fondoDelCaricamentoScuro)}</color>',
      ),
    );
    final ios = File(
      'ios/Runner/Assets.xcassets/FondoAvvio.colorset/Contents.json',
    ).readAsStringSync();
    String componenti(Color c) {
      final e = esa(c);
      return '"blue" : "0x${e.substring(4)}", '
          '"green" : "0x${e.substring(2, 4)}", '
          '"red" : "0x${e.substring(0, 2)}"';
    }

    expect(ios, contains(componenti(fondoDelCaricamentoChiaro)));
    expect(ios, contains(componenti(fondoDelCaricamentoScuro)));
  });

  testWidgets('sta al centro della pagina, non dello schermo: quello che '
      'resta sotto (i tasti di Android) si toglie', (tester) async {
    await tester.pumpWidget(
      _dentro(const CaricamentoDellaPlancia(inFondo: 48)),
    );
    final schermo = tester.getSize(find.byType(CaricamentoDellaPlancia));
    final colonna = tester.getCenter(
      find.descendant(
        of: find.byType(CaricamentoDellaPlancia),
        matching: find.byType(Column),
      ),
    );
    final marchio = tester.getCenter(_ilMarchio);
    expect(colonna.dy, closeTo((schermo.height - 48) / 2, 1));
    expect(marchio.dx, closeTo(schermo.width / 2, 0.5));
  });

  testWidgets('sta in un telefono sdraiato e in un tablet a muro, senza '
      'uscire dai bordi', (tester) async {
    for (final lato in const [
      Size(844, 390),
      Size(1280, 800),
      Size(320, 568),
    ]) {
      tester.view.physicalSize = lato;
      tester.view.devicePixelRatio = 1;
      await tester.pumpWidget(
        _dentro(
          const CaricamentoDellaPlancia(nome: 'Casa di montagna dei Rossi'),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull, reason: '$lato');
      final colonna = tester.getRect(
        find.descendant(
          of: find.byType(CaricamentoDellaPlancia),
          matching: find.byType(Column),
        ),
      );
      expect(colonna.top, greaterThanOrEqualTo(0), reason: '$lato');
      expect(colonna.bottom, lessThanOrEqualTo(lato.height), reason: '$lato');
    }
    tester.view.reset();
  });

  testWidgets('se l\'attesa dura la riga cambia: «Mi collego a casa…», '
      '«Quasi pronto…», «Ancora un attimo…»', (tester) async {
    await tester.pumpWidget(_dentro(const CaricamentoDellaPlancia()));
    await tester.pump();
    expect(find.text('Caricamento…'), findsOneWidget);
    await tester.pump(const Duration(seconds: 3));
    expect(find.text('Mi collego a casa…'), findsOneWidget);
    await tester.pump(const Duration(seconds: 4));
    expect(find.text('Quasi pronto…'), findsOneWidget);
    await tester.pump(const Duration(seconds: 6));
    expect(find.text('Ancora un attimo…'), findsOneWidget);
  });

  test('le righe ci sono in tutte le lingue', () {
    for (final lingua in Lingua.values) {
      laLingua = lingua;
      final righe = {
        for (final t in const [0.0, 3.0, 7.0, 13.0]) rigaDelCaricamento(t),
      };
      expect(righe, hasLength(4), reason: lingua.name);
    }
    laLingua = Lingua.inglese;
    expect(rigaDelCaricamento(3), 'Connecting to your home…');
    expect(rigaDelCaricamento(7), 'Almost ready…');
  });

  testWidgets('cambiando fase l\'attesa non riparte da capo: il marchio resta '
      'acceso e la riga resta quella del tempo passato', (tester) async {
    await tester.pumpWidget(
      _dentro(const CaricamentoDellaPlancia(fase: FaseDelCaricamento.cerco)),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 3));
    expect(find.text('Mi collego a casa…'), findsOneWidget);
    /* Un'altra attesa, in un altro punto dell'albero: come quando dalla
     * plancia che si cerca si passa alla pagina che si apre. */
    await tester.pumpWidget(
      _dentro(
        const Center(
          child: CaricamentoDellaPlancia(fase: FaseDelCaricamento.apro),
        ),
      ),
    );
    expect(_marchio(tester), 1, reason: 'il marchio non rientra');
    expect(_leIniziali, findsNothing, reason: 'le iniziali non si riscrivono');
    expect(find.text('Mi collego a casa…'), findsOneWidget);
  });

  testWidgets('con «riduci animazioni» è calma ma viva: niente che si '
      'sposti, cresca o giri, ma i tre punti pulsano e la riga cambia', (
    tester,
  ) async {
    /* La prova del titolare: su Windows con «Effetti di animazione» spenti
     * Chrome chiede di ridurre le animazioni, e l'attesa ferma sembrava una
     * plancia bloccata. */
    await tester.pumpWidget(
      _dentro(const CaricamentoDellaPlancia(nome: 'Casa Rossi'), fermo: true),
    );
    await tester.pump();
    expect(_marchio(tester), 1, reason: 'c\'è già, intero');
    expect(
      _leIniziali,
      findsNothing,
      reason: 'niente iniziali che si scrivono',
    );
    expect(
      find.byWidgetPredicate(
        (w) => w is CustomPaint && '${w.painter.runtimeType}' == '_Orbita',
      ),
      findsNothing,
      reason: 'niente anello che gira, niente granelli in orbita',
    );
    double scalaDelMarchio() => tester
        .widget<Transform>(
          find.ancestor(of: _ilMarchio, matching: find.byType(Transform)).first,
        )
        .transform
        .getMaxScaleOnAxis();
    List<double> punti() => tester
        .widgetList<Opacity>(
          find.descendant(
            of: find.byWidgetPredicate(
              (w) => '${w.runtimeType}' == '_TrePunti',
            ),
            matching: find.byType(Opacity),
          ),
        )
        .map((o) => o.opacity)
        .toList();
    expect(punti(), hasLength(3), reason: 'tre punti al posto dell\'anello');
    final prima = punti();
    expect(
      SchedulerBinding.instance.transientCallbackCount,
      greaterThan(0),
      reason: 'il tempo scorre: non è una fotografia',
    );
    for (final dopo in const [300, 900, 1300]) {
      await tester.pump(Duration(milliseconds: dopo));
      expect(scalaDelMarchio(), 1, reason: 'il marchio non cresce né rimbalza');
    }
    expect(punti(), isNot(equals(prima)), reason: 'i punti pulsano');
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Mi collego a casa…'), findsOneWidget);
  });

  group('l\'uscita', () {
    Widget banco({required bool su, bool fermo = false}) => _dentro(
      Stack(
        fit: StackFit.expand,
        children: [
          const Center(child: Text('LA PLANCIA')),
          UscitaDelCaricamento(
            su: su,
            child: const CaricamentoDellaPlancia(nome: 'Casa Rossi'),
          ),
        ],
      ),
      fermo: fermo,
    );

    bool laPlanciaSiTocca(WidgetTester tester) => tester
        .hitTestOnBinding(tester.getCenter(find.text('LA PLANCIA')))
        .path
        .any((voce) => voce.target is RenderParagraph);

    testWidgets('non c\'è un tempo minimo: finito il caricamento a metà '
        'dell\'entrata, la plancia si tocca subito e l\'attesa sfuma via in '
        'un attimo', (tester) async {
      await tester.pumpWidget(banco(su: true));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(laPlanciaSiTocca(tester), isFalse, reason: 'l\'attesa copre');
      expect(_leIniziali, findsOneWidget, reason: 'le iniziali si scrivono');
      expect(_marchio(tester), 0, reason: 'il marchio non c\'è ancora');

      await tester.pumpWidget(banco(su: false));
      expect(
        laPlanciaSiTocca(tester),
        isTrue,
        reason: 'dal primo fotogramma i tocchi vanno alla plancia',
      );
      await tester.pump();
      await tester.pump(UscitaDelCaricamento.quantoDura * 2);
      await tester.pump();
      expect(find.byType(CaricamentoDellaPlancia), findsNothing);
      expect(SchedulerBinding.instance.transientCallbackCount, 0);
    });

    testWidgets('si apre in un cerchio, non sparisce di colpo', (tester) async {
      await tester.pumpWidget(banco(su: true));
      await tester.pump();
      ClipPath foro() => tester.widget<ClipPath>(
        find.descendant(
          of: find.byType(CaricamentoDellaPlancia),
          matching: find.byType(ClipPath),
        ),
      );
      expect(foro().clipBehavior, Clip.none, reason: 'nessun foro, ancora');
      await tester.pumpWidget(banco(su: false));
      await tester.pump();
      await tester.pump(UscitaDelCaricamento.quantoDura ~/ 2);
      expect(find.byType(CaricamentoDellaPlancia), findsOneWidget);
      expect(foro().clipBehavior, Clip.antiAlias, reason: 'il foro si apre');
    });

    testWidgets('con «riduci animazioni» sfuma, senza aprire il cerchio', (
      tester,
    ) async {
      await tester.pumpWidget(banco(su: true, fermo: true));
      await tester.pump();
      await tester.pumpWidget(banco(su: false, fermo: true));
      expect(laPlanciaSiTocca(tester), isTrue);
      await tester.pump();
      await tester.pump(UscitaDelCaricamento.quantoSfuma ~/ 2);
      expect(find.byType(CaricamentoDellaPlancia), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(CaricamentoDellaPlancia),
          matching: find.byType(ClipPath),
        ),
        findsNothing,
        reason: 'nessun foro: sfuma',
      );
      final sfuma = tester.widget<FadeTransition>(
        find.descendant(
          of: find.byType(UscitaDelCaricamento),
          matching: find.byType(FadeTransition),
        ),
      );
      expect(sfuma.opacity.value, inExclusiveRange(0, 1));
      await tester.pump(UscitaDelCaricamento.quantoSfuma);
      await tester.pump();
      expect(find.byType(CaricamentoDellaPlancia), findsNothing);
    });

    testWidgets('se torna su c\'è subito, senza rientrare', (tester) async {
      await tester.pumpWidget(banco(su: true));
      await tester.pump();
      await tester.pumpWidget(banco(su: false));
      await tester.pump(UscitaDelCaricamento.quantoDura * 2);
      await tester.pumpWidget(banco(su: true));
      expect(laPlanciaSiTocca(tester), isFalse);
      final sfuma = tester.widget<FadeTransition>(
        find.descendant(
          of: find.byType(UscitaDelCaricamento),
          matching: find.byType(FadeTransition),
        ),
      );
      expect(sfuma.opacity.value, 1);
    });
  });
}
