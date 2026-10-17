/// Le notifiche elaborate: le scelte del telefono, la scheda e la foto che
/// arrivano nella busta, la foto cifrata e la scheda disegnata.
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/notifiche/foto_di_passaggio.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/notifiche/scheda.dart';
import 'package:gdahome/schermate/notifiche.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'schede_di_prova.dart';

final _filo = List.filled(32, 'ab').join();
const _telefono = 'dm_0123456789abcdef';

/* Fatta da Node come la fa il ponte (`ponte/src/spinta.js`, la stessa chiave
 * delle notifiche, coi dati autenticati della foto): se il conto in Dart
 * cambia di un byte, questa non si apre piu'. */
const _bustaDiNode =
    'AQABAgMEBQYHCAkKC9AoptcR9MA9pR4BCMFwjmxdm7n/7IUNYAJUmTqbGNN8Ip3Zw38yFvBbnzN29IpkuQ8=';
const _dentro = 'dW5hIGZvdG8gZmludGEsIGJ5dGUgcXVhbHVucXVlIMO/';

void main() {
  group('le scelte del telefono', () {
    test('di serie semplici, e «come tutte» segue lo stile generale', () {
      const imp = ImpostazioniDelleNotifiche();
      expect(imp.stile, 'semplici');
      expect(imp.elaborata('elettrodomestici'), isFalse);
      final elaborate = imp.con(stile: 'elaborate');
      expect(elaborate.elaborata('elettrodomestici'), isTrue);
      expect(
        elaborate.elaborata('arrivi'),
        isFalse,
        reason: 'gli arrivi non hanno una versione elaborata',
      );
      final una = elaborate.conScelta(
        'movimento',
        const SceltaDellaVoce(stile: 'semplice'),
      );
      expect(una.elaborata('movimento'), isFalse);
      expect(una.elaborata('antifurto'), isTrue);
    });

    test('vanno e tornano dal ponte uguali', () {
      final imp = const ImpostazioniDelleNotifiche().con(
        stile: 'elaborate',
        su: {
          'elettrodomestici': const SceltaDellaVoce(
            stile: 'elaborata',
            quali: ['switch.lavatrice'],
            soglia: 0.1,
            suono: 'suo',
            dalle: '08:00',
            alle: '22:00',
            come: 'riepilogo',
            dentro: ['durata', 'costo'],
          ),
          'movimento': const SceltaDellaVoce(quando: 'notte'),
        },
      );
      final andata = jsonDecode(jsonEncode(imp.inJson()));
      final tornata = ImpostazioniDelleNotifiche.leggi(andata);
      expect(tornata.stile, 'elaborate');
      expect(tornata.su, imp.su);
      expect((andata['su'] as Map)['elettrodomestici']['orari'], {
        'dalle': '08:00',
        'alle': '22:00',
      });
    });

    test('quello che non si capisce resta com\'era di serie', () {
      final letta = ImpostazioniDelleNotifiche.leggi({
        'stile': 'barocche',
        'su': {
          'movimento': {
            'stile': 'boh',
            'quali': ['non-una-entita', 'camera.ingresso', 3],
            'soglia': -1,
            'suono': 'forte',
            'orari': {'dalle': '25:00', 'alle': '07:00'},
            'come': 'domani',
            'dentro': ['costo', 'segreto'],
            'quando': 'mai',
          },
          7: {'stile': 'elaborata'},
        },
      });
      expect(letta.stile, 'semplici');
      final scelta = letta.sceltaDi('movimento');
      expect(scelta.stile, 'come-tutte');
      expect(scelta.quali, ['camera.ingresso']);
      expect(scelta.soglia, isNull);
      expect(scelta.suono, 'normale');
      expect(scelta.haGliOrari, isFalse);
      expect(scelta.come, 'subito');
      expect(scelta.dentro, ['costo']);
      expect(scelta.quando, 'casa-vuota-o-notte');
      expect(letta.su.keys, ['movimento']);
    });
  });

  group('la notifica arrivata', () {
    Map<String, dynamic> grezza([Map<String, dynamic> altro = const {}]) => {
      'v': 1,
      'id': 'n1',
      'titolo': 'Lavatrice finita · 0,05 €',
      'testo': '1 h 52 min · ☀️ 72% dal sole',
      'quando': 0,
      'scade': 1,
      ...altro,
    };

    test('porta la scheda e l\'identificativo della foto', () {
      final letta = NotificaArrivata.leggi(
        grezza({
          'scheda': schedeDiProva['ciclo'],
          'foto': {'id': '0123456789abcdef0123456789abcdef', 't': 'image/jpeg'},
        }),
      )!;
      expect(letta.scheda?['t'], 'ciclo');
      expect(letta.foto, '0123456789abcdef0123456789abcdef');
      expect(letta.elaborata, isTrue);
    });

    test('una semplice non ha ne\' scheda ne\' foto', () {
      final letta = NotificaArrivata.leggi(grezza())!;
      expect(letta.elaborata, isFalse);
    });

    test('una foto con un identificativo strano non si chiede a nessuno', () {
      final letta = NotificaArrivata.leggi(
        grezza({
          'foto': {'id': '../../segreti'},
          'scheda': {'v': 2, 't': 'ciclo'},
        }),
      )!;
      expect(letta.foto, isNull);
      expect(letta.scheda, isNull, reason: 'una scheda di un\'altra versione');
    });
  });

  group('la foto di passaggio', () {
    test('si apre la busta fatta da Node, col conto del ponte', () async {
      final aperta = await apriLaFoto(
        chiaveDelFilo: _filo,
        telefono: _telefono,
        busta: base64.decode(_bustaDiNode),
      );
      expect(aperta, base64.decode(_dentro));
    });

    test('per un altro telefono, o toccata, non si apre', () async {
      final busta = base64.decode(_bustaDiNode);
      expect(
        await apriLaFoto(
          chiaveDelFilo: _filo,
          telefono: 'dm_ffffffffffffffff',
          busta: busta,
        ),
        isNull,
      );
      final toccata = [...busta]..[20] ^= 1;
      expect(
        await apriLaFoto(
          chiaveDelFilo: _filo,
          telefono: _telefono,
          busta: toccata,
        ),
        isNull,
      );
    });

    test(
      'si prende dal centralino, e un 404 e\' una notifica senza foto',
      () async {
        final chieste = <Uri>[];
        final cliente = MockClient((domanda) async {
          chieste.add(domanda.url);
          if (domanda.url.path.endsWith('/c0ffee00c0ffee00c0ffee00c0ffee00')) {
            return http.Response.bytes(base64.decode(_bustaDiNode), 200);
          }
          return http.Response('{"errore":"non c\'e\'"}', 404);
        });
        final presa = await prendiLaFoto(
          dove: Uri.parse(
            'https://centralino.example/foto/c0ffee00c0ffee00c0ffee00c0ffee00',
          ),
          chiaveDelFilo: _filo,
          telefono: _telefono,
          cliente: cliente,
        );
        expect(presa, base64.decode(_dentro));
        final mancata = await prendiLaFoto(
          dove: Uri.parse('https://centralino.example/foto/${'0' * 32}'),
          chiaveDelFilo: _filo,
          telefono: _telefono,
          cliente: cliente,
        );
        expect(mancata, isNull);
        expect(chieste, hasLength(2));
      },
    );
  });

  group('il foglio di una voce', () {
    const scelta = SceltaDellaVoce(
      quali: ['switch.lavatrice', 'switch.lavastoviglie'],
    );
    Widget foglio({
      List<Entita> entita = const [],
      Future<List<Entita>> Function()? chiedi,
    }) => MaterialApp(
      home: Scaffold(
        body: FoglioDellaVoce(
          evento: 'elettrodomestici',
          scelta: scelta,
          stileGenerale: 'elaborate',
          entita: entita,
          chiediLeEntita: chiedi,
          cambia: (_) {},
        ),
      ),
    );
    Entita una(String id, String nome) =>
        Entita(id: id, stato: 'off', attributi: {'friendly_name': nome});

    testWidgets('«Quali» dice i nomi, non gli identificativi', (tester) async {
      await tester.pumpWidget(
        foglio(
          entita: [
            una('switch.lavatrice', 'Lavatrice'),
            una('switch.lavastoviglie', 'Lavastoviglie'),
          ],
        ),
      );
      expect(find.text('Lavatrice, Lavastoviglie'), findsOneWidget);
      expect(find.textContaining('switch.'), findsNothing);
    });

    testWidgets(
      'se la plancia non le ha ancora, i nomi si chiedono alla casa',
      (tester) async {
        await tester.pumpWidget(
          foglio(
            chiedi: () async => [
              una('switch.lavatrice', 'Lavatrice di sotto'),
              una('switch.lavastoviglie', 'Lavastoviglie'),
            ],
          ),
        );
        await tester.pump();
        expect(find.text('Lavatrice di sotto, Lavastoviglie'), findsOneWidget);
      },
    );

    testWidgets('e se la casa non risponde, un nome dall\'identificativo', (
      tester,
    ) async {
      await tester.pumpWidget(
        foglio(chiedi: () async => throw StateError('la casa non risponde')),
      );
      await tester.pump();
      expect(find.text('Lavatrice, Lavastoviglie'), findsOneWidget);
      expect(nomeDallId('switch.lavatrice_2'), 'Lavatrice 2');
    });
  });

  group('la scheda disegnata', () {
    setUpAll(() async {
      final carica = FontLoader('Inter');
      final file = File('assets/carattere/Inter-700.ttf');
      carica.addFont(file.readAsBytes().then((b) => b.buffer.asByteData()));
      await carica.load();
    });

    testWidgets('ogni scheda diventa un PNG due a uno, con l\'icona', (
      tester,
    ) async {
      for (final MapEntry(key: nome, value: scheda) in schedeDiProva.entries) {
        final disegno = (await tester.runAsync(
          () => disegnaLaNotifica(
            scheda: scheda,
            attesa: const Duration(seconds: 30),
          ),
        ))!;
        expect(disegno.grande, isNotNull, reason: nome);
        final png = disegno.grande!;
        expect(png.sublist(1, 4), utf8.encode('PNG'), reason: nome);
        // Larghezza e altezza stanno nell'intestazione IHDR.
        final dati = png.buffer.asByteData();
        expect(dati.getUint32(16), 1080, reason: nome);
        expect(dati.getUint32(20), 540, reason: nome);
        expect(disegno.icona, isNotNull, reason: nome);
      }
    });

    testWidgets('con la foto, la foto; senza niente da disegnare, niente', (
      tester,
    ) async {
      final conFoto = (await tester.runAsync(
        () => disegnaLaNotifica(
          scheda: schedeDiProva['movimento'],
          foto: fotoDiProva(),
          attesa: const Duration(seconds: 30),
        ),
      ))!;
      expect(conFoto.grande, isNotNull);
      expect(conFoto.icona, isNotNull);
      final niente = (await tester.runAsync(
        () => disegnaLaNotifica(scheda: {'v': 1, 't': 'chissa'}),
      ))!;
      expect(niente.vuoto, isTrue);
      final rotta = (await tester.runAsync(
        () => disegnaLaNotifica(
          scheda: {'v': 1, 't': 'ciclo', 'w': 'non una lista', 'eur': 'x'},
          attesa: const Duration(seconds: 30),
        ),
      ))!;
      expect(
        rotta.grande,
        isNotNull,
        reason: 'i numeri che mancano si saltano, la scheda si disegna',
      );
      final fotoRotta = (await tester.runAsync(
        () => disegnaLaNotifica(foto: utf8.encode('non e\' una foto')),
      ))!;
      expect(fotoRotta.vuoto, isTrue, reason: 'mai un errore, al piu\' niente');
    });

    test('i numeri si dicono all\'italiana', () {
      expect(euroDellaScheda(0.05), '0,05 €');
      expect(durataDellaScheda(112), '1 h 52 min');
      expect(durataDellaScheda(60), '1 h');
      expect(durataDellaScheda(9), '9 min');
    });
  });
}
