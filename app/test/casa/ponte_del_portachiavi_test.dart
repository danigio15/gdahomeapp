/// Le prove del ponte del portachiavi: la copia sul disco che segue ogni
/// scrittura, e il portachiavi vuoto che si rifa' dalla copia, cioe' la
/// prima apertura dopo il cambio di team che firma l'app.
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/copia_del_portachiavi/su_disco.dart';
import 'package:gdahome/casa/ponte_del_portachiavi.dart';

void main() {
  late Directory cartella;

  setUp(() async {
    cartella = await Directory.systemTemp.createTemp('ponte');
    PortachiaviColPonte.scordaIRipristini();
    /* Il portachiavi finto del pacchetto: in memoria, e uno solo per tutte
     * le istanze. Vuoto, come dopo il cambio di team. */
    FlutterSecureStorage.setMockInitialValues({});
  });

  tearDown(() => cartella.delete(recursive: true));

  File copiaDi(String nome) =>
      File('${cartella.path}/${CopiaSuDisco.nomeDelFile(nome)}');

  Future<Map<String, Object?>> lettaLaCopia(String nome) async =>
      jsonDecode(await copiaDi(nome).readAsString()) as Map<String, Object?>;

  PortachiaviColPonte ponte([String nome = 'casa', bool acceso = true]) =>
      PortachiaviColPonte(nome: nome, cartella: cartella.path, acceso: acceso);

  test(
    'quello che si scrive nel portachiavi finisce anche nella copia',
    () async {
      final portachiavi = ponte();
      await portachiavi.write(key: 'le_case', value: '{"case":[1]}');
      expect(await lettaLaCopia('casa'), {'le_case': '{"case":[1]}'});

      /* Tutta la copia si rifa' a ogni scrittura: anche le cancellazioni ci
     * arrivano, e togliere l'ultima casa svuota la copia. */
      await portachiavi.write(key: 'altro', value: 'x');
      await portachiavi.delete(key: 'le_case');
      expect(await lettaLaCopia('casa'), {'altro': 'x'});
      await portachiavi.deleteAll();
      expect(await lettaLaCopia('casa'), isEmpty);
    },
  );

  test(
    'un portachiavi vuoto si riempie dalla copia: il cambio di team',
    () async {
      await copiaDi('casa')
          .writeAsString(jsonEncode({'le_case': '{"case":[1]}'}));
      final portachiavi = ponte();
      expect(await portachiavi.read(key: 'le_case'), '{"case":[1]}');
      /* Rimesso nel portachiavi, non solo letto dalla copia: da qui in poi la
     * copia non serve piu'. */
      FlutterSecureStorage.setMockInitialValues({});
      expect(
        await portachiavi.read(key: 'le_case'),
        isNull,
        reason: 'il ripristino si prova una volta per avvio',
      );
    },
  );

  test(
    'un portachiavi pieno non guarda la copia, nemmeno se diversa',
    () async {
      FlutterSecureStorage.setMockInitialValues({'le_case': 'nuovo'});
      await copiaDi('casa').writeAsString(jsonEncode({'le_case': 'vecchio'}));
      expect(await ponte().read(key: 'le_case'), 'nuovo');
      /* E la copia si rimette al passo col portachiavi, che e' la verita'. */
      expect(await lettaLaCopia('casa'), {'le_case': 'nuovo'});
    },
  );

  test(
    'chi aveva gia\' i segni prima del ponte ha la copia dalla prima lettura',
    () async {
      FlutterSecureStorage.setMockInitialValues({'le_case': '{"case":[1]}'});
      expect(copiaDi('casa').existsSync(), isFalse);
      expect(await ponte().read(key: 'le_case'), '{"case":[1]}');
      /* Senza aspettare una scrittura, che potrebbe non arrivare mai: i
       * segni della casa si scrivono all'abbinamento e poi quasi piu'. */
      expect(await lettaLaCopia('casa'), {'le_case': '{"case":[1]}'});
    },
  );

  test('senza copia, un portachiavi vuoto e\' una prima apertura', () async {
    expect(await ponte().read(key: 'le_case'), isNull);
    expect(await ponte().containsKey(key: 'le_case'), isFalse);
    expect(
      copiaDi('casa').existsSync(),
      isFalse,
      reason: 'una lettura non scrive niente',
    );
  });

  test('una copia storta vale come nessuna copia', () async {
    await copiaDi('casa').writeAsString('{non e\' JSON');
    expect(await ponte().read(key: 'le_case'), isNull);
    await copiaDi('casa').writeAsString(jsonEncode({'le_case': 7, 'ok': 'si'}));
    PortachiaviColPonte.scordaIRipristini();
    /* Le voci che non sono testo si saltano, le altre si rimettono. */
    expect(await ponte().readAll(), {'ok': 'si'});
  });

  test(
    'una scrittura su un portachiavi vuoto prima lo rifa\' dalla copia',
    () async {
      await copiaDi('casa')
          .writeAsString(jsonEncode({'le_case': '[1]', 'altro': 'x'}));
      final portachiavi = ponte();
      await portachiavi.write(key: 'le_case', value: '[2]');
      expect(await portachiavi.readAll(), {'le_case': '[2]', 'altro': 'x'});
      expect(await lettaLaCopia('casa'), {'le_case': '[2]', 'altro': 'x'});
    },
  );

  test('spento, non scrive niente sul disco e non legge la copia', () async {
    await copiaDi('gdanav').writeAsString(jsonEncode({'veicolo': 'v'}));
    final portachiavi = ponte('gdanav', false);
    expect(await portachiavi.read(key: 'veicolo'), isNull);
    await portachiavi.write(key: 'veicolo', value: 'w');
    expect(await lettaLaCopia('gdanav'), {
      'veicolo': 'v',
    }, reason: 'la copia e\' rimasta quella di prima');
  });

  test('ogni scomparto ha il suo file', () async {
    await ponte('casa').write(key: 'le_case', value: '[1]');
    await ponte('gdanav').write(key: 'veicolo', value: 'v');
    expect(copiaDi('casa').existsSync(), isTrue);
    expect(copiaDi('gdanav').existsSync(), isTrue);
  });

  test('il file si chiama per scomparto, e la casa ha il suo ponte', () {
    expect(CopiaSuDisco.nomeDelFile('casa'), 'portachiavi-ponte-casa.json');
    /* Il portachiavi della casa e' col ponte, e le regole del portachiavi
     * restano le sue: il segno resta su questo telefono. */
    final dellaCasa = CassaforteDelSistema.portachiavi;
    expect(dellaCasa, isA<PortachiaviColPonte>());
    expect(dellaCasa.nome, 'casa');
    expect(dellaCasa.acceso, isNull, reason: 'acceso solo sull\'iPhone');
    expect(
      dellaCasa.iOptions.toMap()['accessibility'],
      'first_unlock_this_device',
    );
  });
}
