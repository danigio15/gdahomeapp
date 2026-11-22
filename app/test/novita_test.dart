/// Le novità dell'app: il `CHANGELOG.md` letto a punti, e la scheda che le
/// dice la prima volta che si apre dopo un aggiornamento.
///
/// Le prove della scheda passano dall'app intera (il portone, la home) e non
/// dalla scheda da sola, perche' quello che conta e' **quando** compare: dopo
/// un aggiornamento si', a installazione nuova no, sotto il lucchetto no, con
/// l'app svegliata senza nessuno davanti no — e dopo «Ho capito» mai piu',
/// fino alla versione dopo.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/casa/il_lucchetto.dart';
import 'package:gdahome/casa/impostazioni.dart';
import 'package:gdahome/casa/la_finestra.dart';
import 'package:gdahome/casa/la_guardia.dart';
import 'package:gdahome/casa/novita.dart';
import 'package:gdahome/main.dart';
import 'package:gdahome/plancia/pannello.dart';
import 'package:gdahome/plancia/servitore_qui/qui.dart';
import 'package:gdahome/ponte/filo.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/impostazioni_app.dart';
import 'package:gdahome/schermate/novita.dart';
import 'package:gdahome/schermate/plancia_vera.dart';
import 'package:gdahome/versione.dart';

import 'ponte/ponte_finto.dart';

/// Un CHANGELOG inventato, scritto come quello vero.
const _changelog = '''
# Cosa cambia nell'app GdAHome

Le novità dell'app sul telefono, versione per versione.

**Dalla 1.19.19 l'app ha numero e note suoi**: l'add-on ha i suoi.

## 2.0.3

- **Il giardino**: una sezione nuova per l'irrigazione, con le zone e i
  tempi di ogni zona.
- **Le luci**: si accendono tutte insieme dal menu.
- **Navigatore**: la voce dice il nome della via `prima` di girare.

## 2.0.2

- **Il termostato**: la curva del giorno si tocca col dito.

## 2.0.1

- **La spesa**: un elenco condiviso con la famiglia.

## 1.9.10

- **Più vecchia**: questa non si conta.
''';

void main() {
  group('il CHANGELOG, a punti', () {
    test('ogni versione coi suoi punti, e il titolo in grassetto a parte', () {
      final note = leNoteDelChangelog(_changelog);
      expect(
        [for (final una in note) una.versione],
        ['2.0.3', '2.0.2', '2.0.1', '1.9.10'],
      );
      final prima = note.first.punti;
      expect(prima.length, 3);
      expect(prima[0].titolo, 'Il giardino');
      /* La riga che va a capo si rimette sulla sua. */
      expect(
        prima[0].frase,
        'una sezione nuova per l\'irrigazione, con le zone e i tempi di ogni '
        'zona.',
      );
      expect(
        prima[1],
        const UnaNovita(
          titolo: 'Le luci',
          frase: 'si accendono tutte insieme dal menu.',
        ),
      );
      /* I segni dentro la frase restano: li disegna chi la mostra. */
      expect(prima[2].frase, contains('`prima`'));
    });

    test('la premessa del file non e\' una novita\'', () {
      final tutto = leNoteDelChangelog(_changelog).expand((una) => una.punti);
      expect(tutto.any((punto) => punto.frase.contains('add-on')), isFalse);
      expect(
        tutto.any((punto) => punto.titolo.contains('Dalla 1.19.19')),
        isFalse,
      );
    });

    test('un punto senza grassetto, o col grassetto senza frase, si legge '
        'intero', () {
      final note = leNoteDelChangelog('''
## 1.0.1

- Sistemate due cose piccole.
- **Solo il titolo**
- **Coi due punti dentro:** la frase.

Un paragrafo che non e' un punto.
''');
      expect(note.single.punti, const [
        UnaNovita(titolo: '', frase: 'Sistemate due cose piccole.'),
        UnaNovita(titolo: '', frase: '**Solo il titolo**'),
        UnaNovita(titolo: 'Coi due punti dentro', frase: 'la frase.'),
        UnaNovita(titolo: '', frase: 'Un paragrafo che non e\' un punto.'),
      ]);
    });

    test(
      'una versione senza punti non c\'e\', e un altro titolo la chiude',
      () {
        final note = leNoteDelChangelog('''
## 1.0.2

## 1.0.1

- **Uno**: il primo.

### Dietro le quinte

- questo non e' della 1.0.1
''');
        expect(note.single.versione, '1.0.1');
        expect(note.single.punti.single.titolo, 'Uno');
      },
    );

    test('a capo di Windows, e un testo vuoto', () {
      expect(leNoteDelChangelog(''), isEmpty);
      final note = leNoteDelChangelog(
        '## 1.0.1\r\n\r\n- **Uno**: il\r\n  primo.\r\n',
      );
      expect(note.single.punti.single.frase, 'il primo.');
    });

    test('le versioni si confrontano per numeri, non per lettere', () {
      expect(confrontaLeVersioni('1.19.9', '1.19.10'), lessThan(0));
      expect(confrontaLeVersioni('1.20.0', '1.19.25'), greaterThan(0));
      expect(confrontaLeVersioni('1.19.25', '1.19.25'), 0);
      expect(confrontaLeVersioni('1.19', '1.19.0'), 0);
    });

    test('il CHANGELOG vero, quello nel pacchetto, ha le note di questa '
        'versione, a punti col titolo', () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final note = leNoteDelChangelog(await leggiLeNoteDellApp());
      final queste = note.firstWhere(
        (una) => una.versione == versioneDiQuestApp,
        orElse: () => fail('nel CHANGELOG manca la $versioneDiQuestApp'),
      );
      expect(queste.punti, isNotEmpty);
      for (final punto in queste.punti) {
        expect(punto.titolo, isNotEmpty, reason: '$punto');
        expect(punto.frase, isNotEmpty, reason: '$punto');
      }
    });
  });

  group('cosa mostrare aprendo', () {
    final note = leNoteDelChangelog(_changelog);

    test('dopo un aggiornamento: le note di adesso', () {
      final cosa = cosaMostrareAllApertura(
        vista: '2.0.2',
        adesso: '2.0.3',
        note: note,
      );
      expect(cosa?.note.versione, '2.0.3');
      expect(cosa?.saltate, 0);
    });

    test('saltandone qualcuna: la piu\' nuova, e quante ne mancano', () {
      final cosa = cosaMostrareAllApertura(
        vista: '1.9.10',
        adesso: '2.0.3',
        note: note,
      );
      expect(cosa?.note.versione, '2.0.3');
      expect(cosa?.saltate, 2);
    });

    test(
      'da prima della scheda (nessuna versione scritta): le note di adesso',
      () {
        final cosa = cosaMostrareAllApertura(
          vista: null,
          adesso: '2.0.3',
          note: note,
        );
        expect(cosa?.note.versione, '2.0.3');
      },
    );

    test('la stessa versione, una piu\' vecchia, o una senza note: niente', () {
      expect(
        cosaMostrareAllApertura(vista: '2.0.3', adesso: '2.0.3', note: note),
        isNull,
      );
      expect(
        cosaMostrareAllApertura(vista: '2.0.3', adesso: '2.0.2', note: note),
        isNull,
      );
      expect(
        cosaMostrareAllApertura(vista: '2.0.3', adesso: '2.0.4', note: note),
        isNull,
      );
    });

    test('la pagina non annuncia una versione non ancora uscita', () {
      expect(
        [for (final una in leNoteFinoA('2.0.2', note)) una.versione],
        ['2.0.2', '2.0.1', '1.9.10'],
      );
    });
  });

  group('la scheda, nell\'app', () {
    setUp(() {
      TestWidgetsFlutterBinding.ensureInitialized().defaultBinaryMessenger
          .setMockMethodCallHandler(canaleDellaFinestra, (_) async => null);
    });

    tearDown(() {
      TestWidgetsFlutterBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canaleDellaFinestra, null);
    });

    testWidgets(
      'dopo un aggiornamento compare, e dopo «Ho capito» non ricompare',
      (tester) async {
        _telefono(tester);
        tester.binding.handleAppLifecycleStateChanged(
          AppLifecycleState.resumed,
        );
        final dispensa = DispensaInMemoria('{"novita_viste":"1.0.0"}');
        final impostazioni = await _impostazioni(dispensa);
        final collegamento = await _unaCasa(tester);

        await tester.pumpWidget(_lApp(collegamento, impostazioni));
        await _unPo(tester);

        expect(find.byKey(const Key('novita-foglio')), findsOneWidget);
        expect(
          find.text('Novità della versione\u00A0$versioneDiQuestApp'),
          findsOneWidget,
        );
        /* Dalla 1.0.0 ce ne sono di mezzo: il link c'e'. */
        expect(find.byKey(const Key('novita-precedenti')), findsOneWidget);

        await tester.tap(find.byKey(const Key('novita-ho-capito')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('novita-foglio')), findsNothing);
        expect(impostazioni.novitaViste, versioneDiQuestApp);
        /* Ed e' scritta nella dispensa, non solo in memoria. */
        expect(
          await dispensa.leggi(),
          contains('"novita_viste":"$versioneDiQuestApp"'),
        );

        /* L'app riaperta: le stesse impostazioni lette dal disco. */
        await tester.pumpWidget(const SizedBox());
        /* Il portone che se ne va chiude il suo filo: se ne apre un altro,
         * come fa l'app riaprendosi. */
        await tester.runAsync(() => collegamento.chiudi());
        final riaperta = await _impostazioni(dispensa);
        final ancora = await _unaCasa(tester);
        await tester.pumpWidget(_lApp(ancora, riaperta));
        await _unPo(tester);
        expect(find.text('Non trovo la casa'), findsOneWidget);
        expect(find.byKey(const Key('novita-foglio')), findsNothing);

        await _chiudi(tester, ancora);
      },
    );

    testWidgets(
      'a installazione nuova non compare: si segna la versione e basta',
      (tester) async {
        tester.binding.handleAppLifecycleStateChanged(
          AppLifecycleState.resumed,
        );
        final impostazioni = await _impostazioni(DispensaInMemoria());
        await tester.pumpWidget(
          AppDiCasa(
            cassaforte: CassaforteInMemoria(),
            impostazioni: impostazioni,
          ),
        );
        await _unPo(tester);
        /* Il benvenuto, e nessuna scheda sopra. */
        expect(find.text('Colleghiamo la casa'), findsOneWidget);
        expect(find.byKey(const Key('novita-foglio')), findsNothing);
        expect(impostazioni.novitaViste, versioneDiQuestApp);
      },
    );

    testWidgets('con l\'app svegliata senza nessuno davanti aspetta, e compare '
        'quando torna davanti', (tester) async {
      _telefono(tester);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      final impostazioni = await _impostazioni(
        DispensaInMemoria('{"novita_viste":"1.0.0"}'),
      );
      final collegamento = await _unaCasa(tester);

      await tester.pumpWidget(_lApp(collegamento, impostazioni));
      await _unPo(tester);
      expect(find.byKey(const Key('novita-foglio')), findsNothing);
      expect(impostazioni.novitaViste, '1.0.0');

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await _unPo(tester);
      expect(find.byKey(const Key('novita-foglio')), findsOneWidget);

      await _chiudi(tester, collegamento);
    });

    testWidgets('sotto il lucchetto no: aspetta che il velo scenda', (
      tester,
    ) async {
      _telefono(tester);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      final guardia = _GuardiaFinta();
      final impostazioni = await _impostazioni(
        DispensaInMemoria('{"novita_viste":"1.0.0"}'),
      );
      await impostazioni.metti(
        lucchetto: const IlLucchetto(allAvvio: true, alRitorno: true),
      );
      final collegamento = await _unaCasa(tester);

      await tester.pumpWidget(
        _lApp(collegamento, impostazioni, guardia: guardia),
      );
      await _unPo(tester);
      expect(guardia.chieste, 1);
      expect(find.byKey(const Key('novita-foglio')), findsNothing);

      guardia.risposta.complete(ComeEAndata.si);
      await _unPo(tester);
      expect(find.byKey(const Key('novita-foglio')), findsOneWidget);

      await _chiudi(tester, collegamento);
    });

    testWidgets('su un tablet e\' una finestra in mezzo, non un foglio', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(2048, 1536);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      final impostazioni = await _impostazioni(
        DispensaInMemoria('{"novita_viste":"1.0.0"}'),
      );
      final collegamento = await _unaCasa(tester);

      await tester.pumpWidget(_lApp(collegamento, impostazioni));
      await _unPo(tester);
      expect(find.byKey(const Key('novita-finestra')), findsOneWidget);
      expect(find.byKey(const Key('novita-foglio')), findsNothing);

      /* «Versioni precedenti» chiude la scheda e apre la pagina. */
      await tester.tap(find.byKey(const Key('novita-precedenti')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('novita-finestra')), findsNothing);
      expect(find.byType(PaginaDelleNovita), findsOneWidget);
      expect(impostazioni.novitaViste, versioneDiQuestApp);

      await _chiudi(tester, collegamento);
    });
  });

  group('la voce in Impostazioni app', () {
    testWidgets('«Novità» porta alla pagina con le note, dalla piu\' nuova', (
      tester,
    ) async {
      final impostazioni = await _impostazioni(DispensaInMemoria());
      final novita = LeNovitaDellApp(
        impostazioni: impostazioni,
        adesso: '2.0.2',
        note: () async => _changelog,
      );
      await tester.pumpWidget(
        MaterialApp(
          home: SchermataDelleImpostazioniDellApp(
            impostazioni: impostazioni,
            guardia: const NessunaGuardia(),
            novita: novita,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Novità'), findsOneWidget);
      await tester.tap(find.byKey(const Key('impostazioni-novita')));
      await tester.pumpAndSettle();

      expect(find.byType(PaginaDelleNovita), findsOneWidget);
      /* La 2.0.3 non e' ancora uscita: non si annuncia. */
      expect(find.text('Versione 2.0.3'), findsNothing);
      expect(find.text('Versione 2.0.2'), findsOneWidget);
      expect(find.text('Versione 2.0.1'), findsOneWidget);
      expect(find.text('Questa'), findsOneWidget);
      expect(find.text('Il termostato'), findsOneWidget);
      /* Aprire la pagina non e' «Ho capito»: la scheda, se c'era, resta da
       * vedere. */
      expect(impostazioni.novitaViste, isNull);
    });
  });
}

/// Lo schermo di un telefono: la scheda sale dal basso (su uno schermo
/// largo e' una finestra in mezzo).
void _telefono(WidgetTester tester) {
  tester.view.physicalSize = const Size(780, 1688);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
}

Future<Impostazioni> _impostazioni(Dispensa dispensa) async {
  final impostazioni = Impostazioni(
    sulTelefono: true,
    android: true,
    dispensa: dispensa,
  );
  await impostazioni.carica();
  return impostazioni;
}

/// Una casa abbinata che non risponde: la home c'e', e dice che la cerca.
/// Basta per la scheda, che si apre sopra la home qualunque cosa dica.
Future<Collegamento> _unaCasa(WidgetTester tester) async {
  late Collegamento collegamento;
  await tester.runAsync(() async {
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();
    await archivio.aggiungi(
      nome: 'Casa',
      segno: 'x',
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: IndirizzoDelPonte.leggi('192.168.99.99')!,
    );
    collegamento = Collegamento(
      archivio: archivio,
      sonda: Sonda(
        bussa: (_) async => false,
        attesa: const Duration(milliseconds: 50),
      ),
    );
    await collegamento.apri();
  });
  return collegamento;
}

Widget _lApp(
  Collegamento collegamento,
  Impostazioni impostazioni, {
  LaGuardia guardia = const NessunaGuardia(),
}) {
  final velo = ValueNotifier<Widget?>(null);
  return MaterialApp(
    builder: (context, schermata) =>
        SopraTutto(velo: velo, child: schermata ?? const SizedBox.shrink()),
    home: Portone(
      collegamento: collegamento,
      plancia: _PlanciaFinta(),
      impostazioni: impostazioni,
      guardia: guardia,
    ),
  );
}

/// Qualche giro: la home che si disegna, e il secondo che la scheda aspetta.
///
/// Ogni giro lascia anche passare un attimo di tempo vero: il `CHANGELOG.md`
/// si legge dal pacchetto, e una lettura vera nel tempo finto non finisce.
Future<void> _unPo(WidgetTester tester) async {
  for (var giro = 0; giro < 10; giro += 1) {
    await tester.pump(const Duration(milliseconds: 300));
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 20)),
    );
  }
  await tester.pump();
}

Future<void> _chiudi(WidgetTester tester, Collegamento collegamento) async {
  await tester.pumpWidget(const SizedBox());
  await tester.runAsync(() => collegamento.chiudi());
}

/// Una guardia che risponde quando glielo si dice.
class _GuardiaFinta implements LaGuardia {
  final risposta = Completer<ComeEAndata>();
  int chieste = 0;

  @override
  Future<CosaSaFareIlTelefono> cosaSaFare() async => const CosaSaFareIlTelefono(
    sa: {ComeRiconosce.volto},
    ceUnaGuardiaDelSistema: true,
  );

  @override
  Future<ComeEAndata> chiedi({required String perche}) {
    chieste += 1;
    return risposta.future;
  }
}

/// La plancia, nelle prove: niente WebView, una scritta.
class _PlanciaFinta extends FabbricaDellaPlancia {
  @override
  Future<ServitoreDiQuestoSistema?> servitore(
    Filo? Function() filo, {
    String lingua = 'it',
  }) async => _ServitoreFinto();

  @override
  Widget riquadro(
    Uri pagina, {
    required Key chiave,
    required VoidCallback quandoCaricata,
    required void Function(String perche) quandoFallisce,
    bool ibrido = false,
    ({double alto, double basso}) margini = (alto: 0, basso: 0),
    void Function(String pagina)? quandoCambiaPagina,
    void Function()? quandoChiedeIlMenu,
    VoidCallback? quandoSiVede,
    VoidCallback? quandoHaIlVelo,
    void Function(String foto)? quandoFotografaLaCasa,
    void Function(String persona)? quandoApreLaPersona,
  }) => Center(key: chiave, child: const Text('LA PLANCIA'));
}

class _ServitoreFinto implements ServitoreDiQuestoSistema {
  @override
  Uri paginaDi(PannelloDellaPlancia pannello, {String casa = ''}) =>
      Uri.parse('http://127.0.0.1:1${pannello.percorsoDellaPagina('it')}');

  @override
  Uri indirizzoDi(String percorso, {Map<String, String> domande = const {}}) =>
      Uri.parse('http://127.0.0.1:1$percorso');

  @override
  Future<void> spegni() async {}

  @override
  Future<bool> rimettiInPiedi() async => false;

  @override
  set leggera(bool valore) {}

  @override
  set margini(({double alto, double basso}) quanto) {}
}
