/// L'avvio di GdAHome Muro: il foglietto fa entrare il pannello nella casa, e
/// come e' andata resta scritto accanto (`abbinamento.esito`), dove l'add-on
/// lo legge dopo il riavvio.
///
/// Prima un errore qui si perdeva in silenzio: il pannello partiva chiedendo
/// il codice e nessuno sapeva perche'. Queste prove tengono fermo che l'esito
/// si scriva sempre, e che il foglietto sparisca solo a casa entrata.
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/muro/avvio_muro.dart';

/// Un portachiavi che non scrive: come un Keystore rotto.
class _CassaforteRotta implements Cassaforte {
  @override
  Future<String?> leggi(String chiave) async => null;

  @override
  Future<void> scrivi(String chiave, String valore) async =>
      throw StateError('keystore rotto');

  @override
  Future<void> cancella(String chiave) async {}
}

void main() {
  late Directory cartella;

  setUp(() async {
    cartella = await Directory.systemTemp.createTemp('muro-');
  });

  tearDown(() async {
    if (await cartella.exists()) await cartella.delete(recursive: true);
  });

  File quello(String nome) => File('${cartella.path}/$nome');

  Future<void> scriviIlFoglietto() => quello(nomeDelFoglietto).writeAsString(
    jsonEncode({
      'v': 1,
      'dispositivo': 'dm_a1b2c3d4e5f60718',
      'segno': 'abcdef0123456789',
      'chiave': '0123456789abcdef',
      'plancia': 'soggiorno',
      'case': {
        'indirizzi': ['192.168.1.10:8098'],
      },
    }),
  );

  test('un foglietto buono mette la casa, scrive OK e si toglie', () async {
    await scriviIlFoglietto();
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await provvediDalFoglietto(archivio: archivio, cartella: cartella);

    expect(archivio.tutte, hasLength(1));
    expect(archivio.tutte.single.identificativo, 'dm_a1b2c3d4e5f60718');
    expect(archivio.tutte.single.plancia, 'soggiorno');
    expect(await quello(nomeDelFoglietto).exists(), isFalse);
    expect(
      await quello(nomeDellEsito).readAsString(),
      startsWith('OK dm_a1b2c3d4e5f60718'),
    );
  });

  test('un riabbinamento sostituisce la casa di prima', () async {
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();
    await archivio.aggiungi(
      nome: 'Casa',
      segno: 'segnovecchio0000',
      identificativo: 'dm_a1b2c3d4e5f60718',
      chiave: 'chiavevecchia000',
    );
    await scriviIlFoglietto();
    await provvediDalFoglietto(archivio: archivio, cartella: cartella);

    expect(archivio.tutte, hasLength(1));
    expect(archivio.tutte.single.segno, 'abcdef0123456789');
    expect(archivio.tutte.single.chiave, '0123456789abcdef');
    expect(await quello(nomeDelFoglietto).exists(), isFalse);
  });

  test('se il portachiavi non scrive, lo dice e tiene il foglietto', () async {
    await scriviIlFoglietto();
    final archivio = ArchivioDelleCase(_CassaforteRotta());
    await provvediDalFoglietto(archivio: archivio, cartella: cartella);

    expect(await quello(nomeDelFoglietto).exists(), isTrue);
    final esito = await quello(nomeDellEsito).readAsString();
    expect(esito, startsWith('ERRORE casa:'));
    expect(esito, contains('keystore rotto'));
  });

  test('un foglietto rovinato si mette da parte, non sparisce', () async {
    await quello(nomeDelFoglietto).writeAsString('{"dispositivo": ');
    await provvediDalFoglietto(
      archivio: ArchivioDelleCase(CassaforteInMemoria()),
      cartella: cartella,
    );

    expect(await quello(nomeDelFoglietto).exists(), isFalse);
    expect(await quello(nomeDelRovinato).exists(), isTrue);
    expect(
      await quello(nomeDellEsito).readAsString(),
      startsWith('ERRORE foglietto'),
    );
  });

  test('senza foglietto non fa niente e non scrive esiti', () async {
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await provvediDalFoglietto(archivio: archivio, cartella: cartella);

    expect(archivio.tutte, isEmpty);
    expect(await quello(nomeDellEsito).exists(), isFalse);
  });
}
