/// «Vengono comandati ma non cambiano stato», dal Galaxy Watch.
///
/// La fotografia al polso la riscriveva solo la plancia aperta sul telefono:
/// dopo un comando partito dall'orologio, col telefono in tasca, la riga
/// restava com'era. Adesso chi esegue il comando aspetta lo stato nuovo da
/// Home Assistant e corregge quella riga sola.
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/auto/in_auto.dart';
import 'package:gdahome/auto/la_foto.dart';
import 'package:gdahome/casa/stato_della_casa.dart';
import 'package:gdahome/ponte/filo.dart';

import '../ponte/ponte_finto.dart';

const _foto = '''
{"v":1,"dispositivi":[
  {"id":"light.cucina","nome":"Luce cucina","genere":"luce","acceso":false,"stato":"Spenta","polso":true},
  {"id":"switch.presa","nome":"Presa","genere":"presa","acceso":true,"stato":"Accesa"},
  {"id":"cover.cancello","nome":"Cancello","genere":"varco","acceso":true,"stato":"Aperto"}
],"persone":[]}
''';

Map<String, Object?> _riga(String foto, String id) =>
    ((jsonDecode(foto) as Map)['dispositivi'] as List)
        .cast<Map<String, Object?>>()
        .firstWhere((r) => r['id'] == id);

void main() {
  group('la riga nella fotografia', () {
    test('una luce accesa dal polso: accesa, e non più solo al polso', () {
      final nuova = laFotoColDispositivo(_foto, 'light.cucina', acceso: true)!;
      final riga = _riga(nuova, 'light.cucina');
      expect(riga['acceso'], isTrue);
      expect(riga['stato'], 'Accesa');
      expect(riga.containsKey('polso'), isFalse);
      /* Le altre righe restano com'erano. */
      expect(_riga(nuova, 'switch.presa')['stato'], 'Accesa');
    });

    test('una presa spenta: spenta, e solo al polso', () {
      final riga = _riga(
        laFotoColDispositivo(_foto, 'switch.presa', acceso: false)!,
        'switch.presa',
      );
      expect(riga['acceso'], isFalse);
      expect(riga['stato'], 'Spenta');
      expect(riga['polso'], isTrue);
    });

    test('un varco chiuso resta anche in auto', () {
      final riga = _riga(
        laFotoColDispositivo(_foto, 'cover.cancello', acceso: false)!,
        'cover.cancello',
      );
      expect(riga['stato'], 'Chiuso');
      expect(riga.containsKey('polso'), isFalse);
    });

    test('niente da cambiare: già così, o non c\'è', () {
      expect(
        laFotoColDispositivo(_foto, 'light.cucina', acceso: false),
        isNull,
      );
      expect(laFotoColDispositivo(_foto, 'light.altra', acceso: true), isNull);
      expect(
        laFotoColDispositivo('non è json', 'light.cucina', acceso: true),
        isNull,
      );
    });

    test('gli stati di Home Assistant che valgono «acceso»', () {
      expect(eAccesoPerLaFoto('on'), isTrue);
      expect(eAccesoPerLaFoto('open'), isTrue);
      expect(eAccesoPerLaFoto('off'), isFalse);
      expect(eAccesoPerLaFoto('closed'), isFalse);
      expect(eAccesoPerLaFoto('unavailable'), isFalse);
    });
  });

  group('lo stato nuovo, da Home Assistant', () {
    late PonteFinto ponte;
    late Filo filo;
    late StatoDellaCasa casa;

    setUp(() async {
      ponte = await PonteFinto.alza();
      ponte.entita = [
        PonteFinto.unaEntita('light.cucina', 'off', nome: 'Luce cucina'),
      ];
      filo = Filo.fisso(
        indirizzo: ponte.indirizzo,
        segno: segnoBuono,
        chi: chiBuono,
        chiave: chiaveBuona,
        attesaMassima: const Duration(milliseconds: 80),
        attesaDellaRisposta: const Duration(seconds: 3),
      );
      await filo.apri();
      casa = StatoDellaCasa(filo, respiro: Duration.zero);
      await casa.attacca();
    });

    tearDown(() async {
      await casa.stacca();
      await filo.chiudi();
      await ponte.spegni();
    });

    test('arriva dopo il comando, e si prende', () async {
      final id =
          ponte.arrivati.lastWhere(
                (uno) => uno['type'] == 'subscribe_events',
              )['id']
              as int;
      final atteso = statoNuovo(casa, 'light.cucina', 'off');
      ponte.cambia(
        id,
        'light.cucina',
        PonteFinto.unaEntita('light.cucina', 'on', nome: 'Luce cucina'),
      );
      expect(await atteso, 'on');
    });

    test('se non cambia, dopo poco si lascia stare', () async {
      expect(
        await statoNuovo(
          casa,
          'light.cucina',
          'off',
          fino: const Duration(milliseconds: 150),
        ),
        isNull,
      );
    });
  });
}
