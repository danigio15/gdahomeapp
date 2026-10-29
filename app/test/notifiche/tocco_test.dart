import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/notifiche/consegna.dart';
import 'package:gdahome/notifiche/dove_apre.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/schermate/campanello.dart';
import 'package:gdahome/schermate/la_notifica.dart';
import 'package:gdahome/vestito/tema.dart';

/// Il tocco su una notifica: «queste cose che escono in basso non mi
/// piacciono proprio». Va dove sta la cosa; dove un posto non c'e', la
/// pagina della notifica, a schermo intero.
NotificaArrivata _una(
  String tipo, {
  String titolo = 'Titolo',
  String testo = '',
  String? camera,
  String? entita,
  ({String sezione, String? entita})? apri,
  List<TastoDellaNotifica> tasti = const [],
  bool chiamata = false,
}) => NotificaArrivata(
  id: 'n-$tipo',
  tipo: tipo,
  categoria: 'sicurezza',
  urgenza: 'normale',
  titolo: titolo,
  testo: testo,
  quando: DateTime(2026, 10, 18, 21, 59),
  scade: DateTime(2100),
  camera: camera,
  entita: entita,
  apri: apri,
  tasti: tasti,
  chiamata: chiamata,
);

void main() {
  group('dove porta', () {
    test('ogni tipo al suo posto', () {
      DoveApre di(String tipo, {String? camera}) =>
          doveApre(_una(tipo, camera: camera));
      expect(di('inserimenti').posto, PostoDellaNotifica.plancia);
      expect(di('inserimenti').linguette, ['security']);
      expect(di('antifurto').linguette, ['security']);
      expect(di('uscito').linguette, ['security']);
      expect(di('aperture').linguette.first, 'varchi');
      expect(di('elettrodomestici').linguette, ['appliances-main']);
      expect(di('blackout').linguette, ['energy']);
      expect(di('arrivi').linguette, ['persone']);
      expect(di('pioggia').linguette.first, 'meteo');
      expect(di('ha_notify').linguette, ['home']);
      expect(di('viaggi').posto, PostoDellaNotifica.navigatore);
      expect(di('aggiorna_app').posto, PostoDellaNotifica.negozio);
      expect(di('riepilogo').posto, PostoDellaNotifica.giornata);
      expect(
        di('movimento', camera: 'camera.balcone').posto,
        PostoDellaNotifica.telecamera,
      );
      /* Senza telecamera (non vicina, o non per questa utenza): Sicurezza. */
      expect(di('movimento').linguette, ['security']);
      /* Nessun posto suo: la pagina della notifica. */
      expect(di('frigo').posto, PostoDellaNotifica.pagina);
      expect(di('suggerimenti').posto, PostoDellaNotifica.pagina);
      expect(di('prova').posto, PostoDellaNotifica.pagina);
    });

    test('vale quello che dice la casa', () {
      final dove = doveApre(
        _una(
          'personalizzata',
          apri: (sezione: 'energia', entita: 'sensor.ups'),
        ),
      );
      expect(dove.linguette, ['energy']);
      expect(dove.entita, 'sensor.ups');
    });

    test('il campo «apri» si legge dalla busta, e solo se e\' pulito', () {
      Map<String, dynamic> grezza(Object? apri) => {
        'v': 1,
        'id': 'x',
        'titolo': 'T',
        'tipo': 'aperture',
        'apri': apri,
      };
      expect(
        NotificaArrivata.leggi(
          grezza({'sezione': 'varchi', 'entita': 'binary_sensor.porta'}),
        )!.apri,
        (sezione: 'varchi', entita: 'binary_sensor.porta'),
      );
      expect(
        NotificaArrivata.leggi(
          grezza({'sezione': 'varchi', 'entita': 'javascript:alert(1)'}),
        )!.apri,
        (sezione: 'varchi', entita: null),
      );
      expect(NotificaArrivata.leggi(grezza({'sezione': 'X Y'}))!.apri, isNull);
      expect(NotificaArrivata.leggi(grezza(null))!.apri, isNull);
    });
  });

  group('il tocco', () {
    late Collegamento collegamento;
    setUp(() {
      collegamento = Collegamento(
        archivio: ArchivioDelleCase(CassaforteInMemoria()),
      );
    });

    Future<void> tocca(
      WidgetTester tester,
      ToccoDellaNotifica tocco, {
      VaiAllaNotifica? vaiA,
    }) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: temaChiaro(),
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () => apriLaNotifica(
                  context,
                  tocco: tocco,
                  collegamento: collegamento,
                  vaiA: vaiA,
                ),
                child: const Text('tocca'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('tocca'));
      await tester.pumpAndSettle();
    }

    testWidgets('l\'antifurto apre la sua pagina, e «Apri Sicurezza» la '
        'plancia', (tester) async {
      final chieste = <DoveApre>[];
      await tocca(
        tester,
        ToccoDellaNotifica(
          casa: 'c',
          notifica: _una(
            'inserimenti',
            titolo: '🌙 Antifurto · Inserito notte',
          ),
        ),
        vaiA: (dove) async {
          chieste.add(dove);
          return true;
        },
      );
      /* «Quando si clicca sulla notifica venga aperta l'app con la stessa
       * notifica»: prima la notifica, poi — se si vuole — il suo posto. */
      expect(find.byType(SchermataDellaNotifica), findsOneWidget);
      expect(find.text('Antifurto · Inserito notte'), findsOneWidget);
      expect(chieste, isEmpty);
      expect(find.text('Apri Sicurezza'), findsOneWidget);
      await tester.tap(find.byKey(const Key('notifica-vai')));
      await tester.pumpAndSettle();
      expect(chieste.single.linguette, ['security']);
      expect(find.byType(SchermataDellaNotifica), findsNothing);
      expect(find.byType(BottomSheet), findsNothing);
    });

    testWidgets('senza la plancia, la pagina della notifica senza il tasto', (
      tester,
    ) async {
      await tocca(
        tester,
        ToccoDellaNotifica(
          casa: 'c',
          notifica: _una(
            'inserimenti',
            titolo: '🌙 Antifurto · Inserito notte',
            testo: 'Casa dellorto',
          ),
        ),
      );
      expect(find.byType(SchermataDellaNotifica), findsOneWidget);
      expect(find.byType(BottomSheet), findsNothing);
      expect(find.byKey(const Key('notifica-vai')), findsNothing);
      expect(find.byType(BackButton), findsOneWidget);
    });

    testWidgets('il frigo, che un posto non ce l\'ha: la pagina e basta', (
      tester,
    ) async {
      var chiesto = false;
      await tocca(
        tester,
        ToccoDellaNotifica(
          casa: 'c',
          notifica: _una(
            'frigo',
            titolo: '🧊 Freezer · troppo caldo',
            testo: '-9 °C da 20 minuti',
          ),
        ),
        vaiA: (_) async => chiesto = true,
      );
      expect(chiesto, isFalse);
      expect(find.byType(SchermataDellaNotifica), findsOneWidget);
      expect(find.text('-9 °C da 20 minuti'), findsOneWidget);
      expect(find.byKey(const Key('notifica-vai')), findsNothing);
    });

    testWidgets('il movimento: la sua pagina, e «Guarda dal vivo» la '
        'telecamera', (tester) async {
      await tocca(
        tester,
        ToccoDellaNotifica(
          casa: 'c',
          notifica: _una('movimento', camera: 'camera.balcone'),
        ),
        vaiA: (_) async => fail('la telecamera non passa dalla plancia'),
      );
      expect(find.byType(SchermataDellaNotifica), findsOneWidget);
      expect(find.byType(SchermataDellaTelecamera), findsNothing);
      await tester.tap(find.text('Guarda dal vivo'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byType(SchermataDellaTelecamera), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    });
  });

  group('la pagina della notifica', () {
    test('quando, detto bene', () {
      final adesso = DateTime(2026, 10, 18, 23);
      expect(
        quandoDetto(DateTime(2026, 10, 18, 21, 59), adesso),
        'Oggi alle 21:59',
      );
      expect(
        quandoDetto(DateTime(2026, 10, 17, 7, 5), adesso),
        'Ieri alle 7:05',
      );
      expect(
        quandoDetto(DateTime(2026, 10, 14, 18, 30), adesso),
        '14 ott alle 18:30',
      );
    });

    test('il testo che dice solo la casa non si ripete', () {
      expect(diceSoloLaCasa('Casa dellorto', "Casa dell'Orto"), isTrue);
      expect(diceSoloLaCasa('Ingresso', 'Casa di prova'), isFalse);
      expect(
        titoloSenzaEmoji('🌙 Antifurto · Inserito notte'),
        'Antifurto · Inserito notte',
      );
    });

    testWidgets('titolo, quando e casa, e i tasti veri', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: temaChiaro(),
          home: SchermataDellaNotifica(
            nomeDellaCasa: 'Casa di prova',
            adesso: DateTime(2026, 10, 18, 22),
            tocco: ToccoDellaNotifica(
              casa: 'c',
              notifica: _una(
                'inserimenti',
                titolo: '🌙 Antifurto · Inserito notte',
                testo: 'Casa di prova',
                tasti: const [
                  TastoDellaNotifica('guarda', 'Guarda', apre: true),
                  TastoDellaNotifica('disinserisci', 'Disinserisci'),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('Antifurto · Inserito notte'), findsOneWidget);
      expect(find.text('Oggi alle 21:59 · Casa di prova'), findsOneWidget);
      /* Il testo era il nome della casa: c'e' gia' sotto il titolo. */
      expect(find.text('Casa di prova'), findsNothing);
      expect(
        find.byKey(const Key('notifica-tasto-disinserisci')),
        findsOneWidget,
      );
      /* «Guarda» qui non serve: si e' gia' dove si guarda. */
      expect(find.byKey(const Key('notifica-tasto-guarda')), findsNothing);
    });
  });
}
