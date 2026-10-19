import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/notifiche/consegna.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/campanello.dart';
import 'package:gdahome/schermate/notifiche.dart';
import 'package:gdahome/vestito/tema.dart';

import '../ponte/ponte_finto.dart';

/// Il movimento davanti alle telecamere.
///
/// «Quali»: le telecamere spuntate e la finestra chiusa — trascinandola giu',
/// o toccando fuori — e la riga diceva ancora «Tutte le telecamere». Le
/// spunte valevano solo con «Fatto».
///
/// «Guarda»: apriva un foglio col titolo e l'ora, e niente telecamera. Adesso
/// apre la telecamera, dal vivo, anche in Base.
const _ingresso = 'camera.ds_2cd2143g2_i11111111_101';
const _balcone = 'camera.ds_2cd2143g2_i22222222_101';

Entita _una(String id, String nome, {String? classe}) => Entita(
  id: id,
  stato: 'off',
  attributi: {'friendly_name': nome, 'device_class': ?classe},
);

final _entita = [
  _una('binary_sensor.ds_i22222222_motion', 'Balcone Motion', classe: 'motion'),
  _una(_ingresso, 'Ingresso'),
  _una('binary_sensor.ds_i11111111_line', 'Ingresso Line', classe: 'motion'),
  _una(_balcone, 'Balcone'),
  _una('switch.lavatrice', 'Lavatrice'),
];

NotificaArrivata _movimento({String? camera = _balcone}) => NotificaArrivata(
  id: 'm1',
  tipo: 'movimento',
  categoria: 'sicurezza',
  urgenza: 'normale',
  titolo: '📷 Movimento · Balcone',
  testo: '21:59 · casa vuota',
  quando: DateTime(2026, 10, 17, 21, 59),
  scade: DateTime(2100),
  camera: camera,
  tasti: const [
    TastoDellaNotifica('guarda', 'Guarda', apre: true),
    TastoDellaNotifica('inserisci', 'Inserisci antifurto'),
  ],
);

void main() {
  group('«Quali» del movimento', () {
    testWidgets('prima le telecamere, poi i sensori', (tester) async {
      final ordine = entitaPerQuali('movimento', _entita);
      expect(ordine.map((una) => una.id), [
        _balcone,
        _ingresso,
        'binary_sensor.ds_i22222222_motion',
        'binary_sensor.ds_i11111111_line',
      ]);
    });

    for (final (come, chiudi)
        in <(String, Future<void> Function(WidgetTester))>[
          ('con «Fatto»', (t) => t.tap(find.byKey(const Key('quali-fatto')))),
          ('toccando fuori', (t) => t.tapAt(const Offset(200, 20))),
          (
            'col tasto indietro',
            (t) async {
              final navigatore = t.state<NavigatorState>(
                find.byType(Navigator).last,
              );
              navigatore.maybePop();
            },
          ),
        ]) {
      testWidgets('le spunte restano chiudendo $come', (tester) async {
        SceltaDellaVoce? salvata;
        await tester.pumpWidget(
          MaterialApp(
            /* Il tema vero: e' lui che faceva sparire «Fatto». */
            theme: temaChiaro(),
            home: Scaffold(
              body: FoglioDellaVoce(
                evento: 'movimento',
                scelta: const SceltaDellaVoce(),
                stileGenerale: 'semplici',
                entita: _entita,
                cambia: (nuova) => salvata = nuova,
              ),
            ),
          ),
        );
        expect(find.text('Tutte le telecamere'), findsOneWidget);
        await tester.tap(find.byKey(const Key('voce-quali')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('quali-$_ingresso')));
        await tester.tap(find.byKey(const Key('quali-$_balcone')));
        await tester.pump();
        await chiudi(tester);
        await tester.pumpAndSettle();
        expect(salvata?.quali, [_balcone, _ingresso]);
        expect(find.text('Balcone, Ingresso'), findsOneWidget);
        expect(find.text('Tutte le telecamere'), findsNothing);
      });
    }
  });

  group('«Guarda»', () {
    test('apre la telecamera se la notifica ne porta una', () {
      expect(
        apreLaTelecamera(
          ToccoDellaNotifica(
            casa: 'c',
            notifica: _movimento(),
            tasto: 'guarda',
          ),
        ),
        isTrue,
      );
      /* Il tocco sulla notifica del movimento no: apre la pagina della
       * notifica, con la foto del momento e «Guarda dal vivo». */
      expect(
        apreLaTelecamera(ToccoDellaNotifica(casa: 'c', notifica: _movimento())),
        isFalse,
      );
      /* Senza telecamera (non vicina, o non per questa utenza): il foglio. */
      expect(
        apreLaTelecamera(
          ToccoDellaNotifica(
            casa: 'c',
            notifica: _movimento(camera: null),
            tasto: 'guarda',
          ),
        ),
        isFalse,
      );
      /* «Inserisci» non apre niente: va alla casa. */
      expect(
        apreLaTelecamera(
          ToccoDellaNotifica(
            casa: 'c',
            notifica: _movimento(),
            tasto: 'inserisci',
          ),
        ),
        isFalse,
      );
    });

    testWidgets('la telecamera chiede la foto alla casa, e la mostra', (
      tester,
    ) async {
      late PonteFinto ponte;
      late Collegamento collegamento;
      final foto = File('test/notifiche/porta-di-prova.jpg').readAsBytesSync();
      await tester.runAsync(() async {
        ponte = await PonteFinto.alza();
        ponte.file['/api/camera_proxy/$_balcone'] = ('image/jpeg', foto);
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
          ),
        ),
      );
      for (var giro = 0; giro < 20; giro += 1) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 50)),
        );
        await tester.pump();
        if (find.byKey(const Key('telecamera-foto')).evaluate().isNotEmpty) {
          break;
        }
      }
      expect(find.byKey(const Key('telecamera-foto')), findsOneWidget);
      expect(find.text('DAL VIVO'), findsOneWidget);
      expect(find.text('Inserisci antifurto'), findsOneWidget);
      expect(find.text('Guarda'), findsNothing);
      expect(
        ponte.commissioni.any(
          (una) => una['percorso'] == '/api/camera_proxy/$_balcone',
        ),
        isTrue,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.runAsync(() async {
        await collegamento.chiudi();
        await ponte.spegni();
      });
    });
  });
}
