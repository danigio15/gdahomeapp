import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/notifiche/consegna.dart';
import 'package:gdahome/notifiche/il_filmato.dart';
import 'package:gdahome/notifiche/le_immagini.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/campanello.dart';
import 'package:gdahome/schermate/notifiche.dart';
import 'package:gdahome/vestito/tema.dart';

import '../ponte/ponte_finto.dart';

/// Il mini video del movimento: cinque secondi prima e cinque dopo.
///
/// «Per le telecamere si riesce a fare un mini video, tipo 5 secondi prima
/// del rilevamento e 5 secondi dopo?» Per tutte le telecamere, con
/// un'opzione nella voce Movimento, spenta di serie. Toccando «Guarda» si
/// parte dal video; da li' la foto del momento e il dal vivo.
const _balcone = 'camera.balcone';
const _id = '1792270740000-a1b2c3d4e5f6';
final _chiave = base64Url.encode(List.filled(32, 7)).replaceAll('=', '');

NotificaArrivata _movimento({bool conFilm = true}) => NotificaArrivata(
  id: 'mv-1',
  tipo: 'movimento',
  categoria: 'sicurezza',
  urgenza: 'normale',
  titolo: '📷 Movimento · Balcone',
  testo: '21:59 · casa vuota',
  quando: DateTime(2026, 10, 17, 21, 59),
  scade: DateTime(2100),
  camera: _balcone,
  film: conFilm ? (id: _id, chiave: _chiave) : null,
  tasti: const [TastoDellaNotifica('guarda', 'Guarda', apre: true)],
);

Map<String, dynamic> _video(List<int> jpeg) => {
  'camera': _balcone,
  'quando': 1792270740000,
  'fotogrammi': [
    for (var t = -5000; t <= 5000; t += 500)
      {'t': t, 'jpeg': base64.encode(jpeg)},
  ],
};

void main() {
  group('la notifica porta il video', () {
    Map<String, dynamic> grezza(Object? film) => {
      'v': 1,
      'id': 'mv-1',
      'titolo': 'Movimento',
      'tipo': 'movimento',
      'camera': _balcone,
      'film': film,
    };

    test('numero e chiave buoni: c\'e\'', () {
      final letta = NotificaArrivata.leggi(
        grezza({'id': _id, 'chiave': _chiave}),
      )!;
      expect(letta.film, (id: _id, chiave: _chiave));
    });

    test('qualunque altra cosa: non c\'e\'', () {
      for (final storto in [
        null,
        _id,
        {'id': _id},
        {'id': '../../config', 'chiave': _chiave},
        {'id': _id, 'chiave': 'corta'},
        {'id': _id, 'chiave': '$_chiave/'},
      ]) {
        expect(NotificaArrivata.leggi(grezza(storto))!.film, isNull);
      }
    });
  });

  group('l\'opzione nella voce Movimento', () {
    test('e\' spenta di serie, e va al ponte come `video`', () {
      expect(const SceltaDellaVoce().video, isFalse);
      expect(SceltaDellaVoce.leggi({}).video, isFalse);
      final accesa = const SceltaDellaVoce().con(video: true);
      expect(accesa.inJson()['video'], isTrue);
      expect(SceltaDellaVoce.leggi(accesa.inJson()), accesa);
      expect(accesa == const SceltaDellaVoce(), isFalse);
    });

    testWidgets('si accende dal foglio della voce', (tester) async {
      SceltaDellaVoce? salvata;
      await tester.pumpWidget(
        MaterialApp(
          theme: temaChiaro(),
          home: Scaffold(
            body: FoglioDellaVoce(
              evento: 'movimento',
              scelta: const SceltaDellaVoce(),
              stileGenerale: 'semplici',
              entita: const [],
              cambia: (nuova) => salvata = nuova,
            ),
          ),
        ),
      );
      final riga = find.byKey(const Key('voce-video'));
      await tester.scrollUntilVisible(riga, 200);
      expect(find.text('Mini video del movimento'), findsOneWidget);
      expect(tester.widget<SwitchListTile>(riga).value, isFalse);
      await tester.tap(riga);
      await tester.pump();
      expect(salvata?.video, isTrue);
    });

    testWidgets('in Base ha il lucchetto, e spiega Premium', (tester) async {
      var spiegato = 0;
      SceltaDellaVoce? salvata;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FoglioDellaVoce(
              evento: 'movimento',
              scelta: const SceltaDellaVoce(video: true),
              stileGenerale: 'semplici',
              premium: false,
              spiegaIlPremium: () => spiegato += 1,
              cambia: (nuova) => salvata = nuova,
            ),
          ),
        ),
      );
      final riga = find.byKey(const Key('voce-video'));
      await tester.scrollUntilVisible(riga, 200);
      expect(tester.widget<SwitchListTile>(riga).value, isFalse);
      await tester.tap(riga);
      await tester.pump();
      expect(spiegato, 1);
      expect(salvata, isNull);
    });

    testWidgets('le altre voci non ce l\'hanno', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FoglioDellaVoce(
              evento: 'antifurto',
              scelta: const SceltaDellaVoce(),
              stileGenerale: 'semplici',
              cambia: (_) {},
            ),
          ),
        ),
      );
      expect(find.byKey(const Key('voce-video')), findsNothing);
    });
  });

  test('il video arriva com\'e\' sul filo, e si apre', () {
    final testo = jsonEncode({
      'id': 4,
      'type': 'result',
      'success': true,
      'result': _video([1, 2, 3]),
    });
    final filmato = FilmatoDelMovimento.daTesto(testo)!;
    expect(filmato.camera, _balcone);
    expect(filmato.fotogrammi, hasLength(21));
    expect(filmato.dal, -5000);
    expect(filmato.al, 5000);
    expect(filmato.fotogrammi.first.jpeg, [1, 2, 3]);
    expect(FilmatoDelMovimento.daTesto('{"result":{"nonCe":true}}'), isNull);
    expect(FilmatoDelMovimento.daTesto('non json'), isNull);
  });

  group('«Guarda» col video', () {
    late PonteFinto ponte;
    late Collegamento collegamento;
    final foto = File('test/notifiche/porta-di-prova.jpg').readAsBytesSync();

    Future<void> alza(
      WidgetTester tester, {
      bool colVideo = true,
      bool colMomento = false,
      bool filoChiuso = false,
      bool vuoto = false,
    }) async {
      final cartella = Directory.systemTemp.createTempSync('momento-');
      await tester.runAsync(() async {
        if (colMomento) {
          await tieniLImmagine('mv-1', foto, cartella: cartella);
        }
        ponte = await PonteFinto.alza();
        ponte.file['/api/camera_proxy/$_balcone'] = ('image/jpeg', foto);
        if (colVideo) {
          ponte.filmati[_id] = (chiave: _chiave, video: _video(foto));
        }
        if (vuoto) ponte.filmatiVuoti.add(_id);
        final archivio = ArchivioDelleCase(CassaforteInMemoria());
        await archivio.apri();
        await archivio.aggiungi(
          nome: 'Casa',
          segno: segnoBuono,
          identificativo: chiBuono,
          chiave: chiaveBuona,
          inCasa: ponte.indirizzo,
        );
        collegamento = Collegamento(
          archivio: archivio,
          sonda: Sonda(bussa: (dove) async => dove == ponte.indirizzo.salute),
        );
        await collegamento.apri();
        /* L'app aperta toccando la notifica sulla schermata bloccata: il filo
         * con la casa non c'e' ancora. */
        if (filoChiuso) await collegamento.chiudi();
      });
      await tester.pumpWidget(
        MaterialApp(
          home: SchermataDellaTelecamera(
            tocco: ToccoDellaNotifica(
              casa: collegamento.casa!.id,
              notifica: _movimento(),
              tasto: 'guarda',
            ),
            collegamento: collegamento,
            cartellaDelleImmagini: cartella,
          ),
        ),
      );
    }

    Future<void> aspetta(WidgetTester tester, Finder cosa) async {
      for (var giro = 0; giro < 40; giro += 1) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 50)),
        );
        await tester.pump();
        if (cosa.evaluate().isNotEmpty) break;
      }
    }

    Future<void> giu(WidgetTester tester) async {
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.runAsync(() async {
        await collegamento.chiudi();
        await ponte.spegni();
      });
    }

    testWidgets('parte dal video, col numero e la chiave della notifica', (
      tester,
    ) async {
      await alza(tester);
      expect(find.byKey(const Key('telecamera-video-attesa')), findsOneWidget);
      await aspetta(tester, find.byKey(const Key('telecamera-video')));
      expect(find.byKey(const Key('telecamera-video')), findsOneWidget);
      expect(find.text('VIDEO DELLE 21:59'), findsOneWidget);
      expect(find.byKey(const Key('filmato-movimento')), findsOneWidget);
      final chiesta = ponte.chieste.firstWhere(
        (una) => una['type'] == 'ponte/notifiche/filmato',
      );
      expect(chiesta['film'], {'id': _id, 'chiave': _chiave});
      expect(find.byKey(const Key('telecamera-al-vivo')), findsOneWidget);

      await tester.tap(find.byKey(const Key('telecamera-al-vivo')));
      await aspetta(tester, find.text('DAL VIVO'));
      expect(find.text('DAL VIVO'), findsOneWidget);
      expect(find.byKey(const Key('telecamera-video')), findsNothing);
      await tester.tap(find.byKey(const Key('telecamera-al-video')));
      await tester.pump();
      expect(find.byKey(const Key('telecamera-video')), findsOneWidget);
      await giu(tester);
    });

    testWidgets(
      '«Non c\'è il video»: col filo che si apre dopo, il video arriva',
      (tester) async {
        /* Il tester: notifica toccata dalla schermata bloccata, app che parte
       * da zero, e la pagina diceva «non c'è più» di un video che c'era. */
        await alza(tester, filoChiuso: true);
        expect(
          find.byKey(const Key('telecamera-video-attesa')),
          findsOneWidget,
        );
        await tester.runAsync(() async {
          await Future<void>.delayed(const Duration(milliseconds: 1500));
          await collegamento.apri();
        });
        for (var giro = 0; giro < 80; giro += 1) {
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 100)),
          );
          await tester.pump(const Duration(milliseconds: 100));
          if (find.byKey(const Key('telecamera-video')).evaluate().isNotEmpty) {
            break;
          }
        }
        expect(find.byKey(const Key('telecamera-video')), findsOneWidget);
        expect(find.byKey(const Key('telecamera-senza-video')), findsNothing);
        await giu(tester);
      },
    );

    testWidgets('se la casa il video non lo da\', si guarda dal vivo', (
      tester,
    ) async {
      await alza(tester, colVideo: false);
      await aspetta(tester, find.byKey(const Key('telecamera-senza-video')));
      expect(find.byKey(const Key('telecamera-senza-video')), findsOneWidget);
      expect(find.byKey(const Key('telecamera-al-video')), findsNothing);
      await aspetta(tester, find.byKey(const Key('telecamera-foto')));
      expect(find.text('DAL VIVO'), findsOneWidget);
      await giu(tester);
    });

    /* «Il video di questo movimento non c'è più», sei minuti dopo: il video
     * non c'era mai stato. La casa adesso lo dice, e la pagina pure. */
    testWidgets('un video rimasto vuoto si dice per quello che e\'', (
      tester,
    ) async {
      await alza(tester, colVideo: false, colMomento: true, vuoto: true);
      await aspetta(tester, find.byKey(const Key('telecamera-senza-video')));
      expect(find.textContaining('non ha mandato immagini'), findsOneWidget);
      expect(find.textContaining('tre giorni'), findsNothing);
      await giu(tester);
    });

    testWidgets('senza video ma con la foto del momento, resta la foto', (
      tester,
    ) async {
      await alza(tester, colVideo: false, colMomento: true);
      await aspetta(tester, find.byKey(const Key('telecamera-senza-video')));
      await aspetta(tester, find.byKey(const Key('telecamera-foto')));
      expect(find.byKey(const Key('telecamera-senza-video')), findsOneWidget);
      expect(find.text('ALLE 21:59'), findsOneWidget);
      expect(find.text('DAL VIVO'), findsNothing);
      expect(
        ponte.commissioni.any(
          (una) => una['percorso'] == '/api/camera_proxy/$_balcone',
        ),
        isFalse,
      );
      await giu(tester);
    });
  });

  testWidgets('il lettore va avanti da solo, e un tocco lo ferma', (
    tester,
  ) async {
    final filmato = FilmatoDelMovimento.daMappa(
      _video(File('test/notifiche/porta-di-prova.jpg').readAsBytesSync()),
    )!;
    await tester.pumpWidget(MaterialApp(home: LettoreDelFilmato(filmato)));
    expect(find.text('-5 s'), findsOneWidget);
    for (var i = 0; i < 2; i += 1) {
      await tester.pump(const Duration(milliseconds: 510));
    }
    expect(find.text('-4 s'), findsOneWidget);
    await tester.tap(find.byType(LettoreDelFilmato));
    await tester.pump();
    final fermo = tester.widget<Text>(find.byKey(const Key('filmato-tempo')));
    await tester.pump(const Duration(seconds: 3));
    expect(
      tester.widget<Text>(find.byKey(const Key('filmato-tempo'))).data,
      fermo.data,
    );
    expect(find.byIcon(Icons.play_arrow_rounded), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  group('quando la casa non risponde', () {
    test(
      'non si dice «non c\'è»: si dice che la casa non ha risposto',
      () async {
        final archivio = ArchivioDelleCase(CassaforteInMemoria());
        await archivio.apri();
        final collegamento = Collegamento(
          archivio: archivio,
          sonda: Sonda(bussa: (_) async => false),
        );
        final risposta = await ilFilmatoDi(
          collegamento,
          (id: _id, chiave: _chiave),
          attesa: const Duration(milliseconds: 300),
          fraUnaProvaELAltra: const Duration(milliseconds: 50),
        );
        expect(risposta.esito, EsitoDelFilmato.nonRisponde);
        expect(risposta.filmato, isNull);
      },
    );
  });
}
