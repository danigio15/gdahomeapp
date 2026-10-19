import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/notifiche/consegna.dart';
import 'package:gdahome/notifiche/le_immagini.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/schermate/la_notifica.dart';
import 'package:gdahome/vestito/tema.dart';

/// Un PNG da un punto: abbastanza per Image.memory.
final _png = Uint8List.fromList([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, //
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0xF8, 0xCF, 0xC0, 0xF0,
  0x1F, 0x00, 0x05, 0x00, 0x01, 0xFF, 0x56, 0xC7, 0x2F, 0x0D, 0x00, 0x00,
  0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
]);

void main() {
  late Directory cartella;
  setUp(() => cartella = Directory.systemTemp.createTempSync('immagini-'));
  tearDown(() => cartella.deleteSync(recursive: true));

  group('le immagini delle notifiche', () {
    test('si tiene e si riprende col numero della notifica', () async {
      await tieniLImmagine('AbC_12-xyz', _png, cartella: cartella);
      expect(await prendiLImmagine('AbC_12-xyz', cartella: cartella), _png);
      expect(await prendiLImmagine('altra1234', cartella: cartella), isNull);
    });

    test('un numero strano non diventa un nome di file', () async {
      await tieniLImmagine('../fuori', _png, cartella: cartella);
      expect(cartella.listSync(), isEmpty);
      expect(await prendiLImmagine('../fuori', cartella: cartella), isNull);
    });

    test('se ne tengono al piu\' quaranta, e non piu\' vecchie di due '
        'giorni', () async {
      for (var i = 0; i < immaginiTenute + 5; i += 1) {
        await tieniLImmagine('foto$i', _png, cartella: cartella);
      }
      expect(cartella.listSync().length, immaginiTenute);
      final vecchia = File('${cartella.path}/foto0.img')
        ..writeAsBytesSync(_png);
      vecchia.setLastModifiedSync(
        DateTime.now().subtract(const Duration(days: 3)),
      );
      await tieniLImmagine('nuova', _png, cartella: cartella);
      expect(vecchia.existsSync(), isFalse);
    });
  });

  testWidgets('la pagina mostra la foto del momento, tenuta sul telefono', (
    tester,
  ) async {
    await tester.runAsync(
      () => tieniLImmagine('movimento1', _png, cartella: cartella),
    );
    final notifica = NotificaArrivata.leggi({
      'v': 1,
      'id': 'movimento1',
      'tipo': 'movimento',
      'cat': 'movimento',
      'titolo': '📷 Movimento · Ingresso',
      'testo': '18:22 · casa vuota',
      'quando': DateTime(2026, 10, 19, 18, 22).millisecondsSinceEpoch,
      'scade': DateTime(2026, 10, 19, 20, 22).millisecondsSinceEpoch,
      'camera': 'camera.ingresso',
      'azioni': const [],
    })!;
    await tester.pumpWidget(
      MaterialApp(
        theme: temaChiaro(),
        home: SchermataDellaNotifica(
          nomeDellaCasa: 'Casa di prova',
          adesso: DateTime(2026, 10, 19, 18, 30),
          cartellaDelleImmagini: cartella,
          tocco: ToccoDellaNotifica(casa: 'c', notifica: notifica),
          etichettaDelPosto: 'Guarda dal vivo',
          vaiAlPosto: (_) async {},
        ),
      ),
    );
    for (var giro = 0; giro < 20; giro += 1) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 20)),
      );
      await tester.pump();
      if (find.byKey(const Key('notifica-immagine')).evaluate().isNotEmpty) {
        break;
      }
    }
    expect(find.text('Movimento · Ingresso'), findsOneWidget);
    expect(find.text('18:22 · casa vuota'), findsOneWidget);
    expect(find.byKey(const Key('notifica-immagine')), findsOneWidget);
    /* E' la foto di allora, non una di adesso. */
    expect(find.text('Adesso, dal vivo'), findsNothing);
    expect(find.text('Guarda dal vivo'), findsOneWidget);
  });
}
