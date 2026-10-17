/// Le case doppie: «escono piu' case associate, e ogni volta mi dice che
/// manca Premium all'improvviso».
///
/// Tre cose si provano davvero: che l'archivio aperto da tre parti insieme
/// non si moltiplichi, che un archivio gia' doppio si ripari da solo tenendo
/// il gettone piu' nuovo, e che riabbinare la stessa casa la aggiorni invece
/// di farne un'altra. E, dall'altra parte, che la licenza con due copie dica
/// Premium.
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/casa_conosciuta.dart';
import 'package:gdahome/casa/case_doppie.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/licenza/licenza.dart';

import '../licenza/gettoni_di_prova.dart';

/// Una cassaforte che risponde quando glielo si dice: cosi' tre aperture
/// stanno davvero aspettando tutte e tre insieme, come all'avvio con l'auto.
class _CassaforteLenta implements Cassaforte {
  final _dentro = CassaforteInMemoria();
  final _aspettano = <Completer<void>>[];
  int letture = 0;

  void rispondi() {
    for (final uno in _aspettano) {
      uno.complete();
    }
    _aspettano.clear();
  }

  @override
  Future<String?> leggi(String chiave) async {
    letture += 1;
    final uno = Completer<void>();
    _aspettano.add(uno);
    await uno.future;
    return _dentro.leggi(chiave);
  }

  @override
  Future<void> scrivi(String chiave, String valore) =>
      _dentro.scrivi(chiave, valore);

  @override
  Future<void> cancella(String chiave) => _dentro.cancella(chiave);
}

Map<String, Object?> _casa(
  String id, {
  String nome = 'Casa',
  String segno = 'segno-uno',
  String identificativo = 'dm_uno',
  String? gettone,
  String? casaAlCentralino = casaDiProva,
  bool legata = false,
}) => {
  'id': id,
  'nome': nome,
  'segno': segno,
  'identificativo': identificativo,
  'chiave': 'ab' * 32,
  'casa_al_centralino': ?casaAlCentralino,
  'gettone': ?gettone,
  if (legata) 'legata': true,
};

void main() {
  test('aperto da tre parti insieme, l\'archivio non si moltiplica', () async {
    final cassaforte = _CassaforteLenta();
    await cassaforte.scrivi(
      'le_case',
      jsonEncode({
        'case': [_casa('a')],
        'attiva': 'a',
      }),
    );
    final archivio = ArchivioDelleCase(cassaforte);
    final tre = [archivio.apri(), archivio.apri(), archivio.apri()];
    await Future<void>.delayed(Duration.zero);
    cassaforte.rispondi();
    await Future.wait(tre);
    expect(archivio.tutte.length, 1);
    expect(cassaforte.letture, 1);
    /* E una lettura dopo rilegge, ma non aggiunge. */
    final dopo = archivio.apri();
    await Future<void>.delayed(Duration.zero);
    cassaforte.rispondi();
    await dopo;
    expect(archivio.tutte.length, 1);
  });

  test(
    'un archivio con tre copie della stessa casa si ripara, col gettone nuovo',
    () async {
      final vecchio = await firmaUnGettone(
        emesso: DateTime.now().subtract(const Duration(days: 9)),
        fino: DateTime.now().subtract(const Duration(days: 1)),
      );
      final nuovo = await firmaUnGettone();
      final cassaforte = CassaforteInMemoria();
      await cassaforte.scrivi(
        'le_case',
        jsonEncode({
          'case': [
            _casa('a', gettone: nuovo),
            _casa('a', gettone: vecchio, legata: true),
            _casa('a', gettone: vecchio),
          ],
          'attiva': 'a',
        }),
      );
      final archivio = ArchivioDelleCase(cassaforte);
      await archivio.apri();
      expect(archivio.tutte.length, 1);
      expect(archivio.attiva!.gettone, nuovo);
      expect(archivio.attiva!.legata, isTrue);
      /* Riscritto subito: la prossima apertura trova una casa sola. */
      final scritto = jsonDecode((await cassaforte.leggi('le_case'))!) as Map;
      expect((scritto['case'] as List).length, 1);
    },
  );

  test(
    'il gettone piu\' nuovo vince anche se sta sull\'ultima copia',
    () async {
      final vecchio = await firmaUnGettone(
        emesso: DateTime.now().subtract(const Duration(days: 3)),
      );
      final nuovo = await firmaUnGettone();
      final fuse = fondiLeCopie([
        CasaConosciuta.daJson(_casa('a', gettone: vecchio))!,
        CasaConosciuta.daJson(_casa('a', gettone: nuovo))!,
      ]);
      expect(fuse.case_.single.gettone, nuovo);
    },
  );

  test(
    'la stessa casa abbinata due volte resta una, con le chiavi nuove',
    () async {
      final cassaforte = CassaforteInMemoria();
      await cassaforte.scrivi(
        'le_case',
        jsonEncode({
          'case': [
            {..._casa('a', nome: 'Casa mia'), 'plancia': 'cucina'},
            _casa('b', segno: 'segno-due', identificativo: 'dm_due'),
          ],
          'attiva': 'b',
        }),
      );
      final archivio = ArchivioDelleCase(cassaforte);
      await archivio.apri();
      final una = archivio.tutte.single;
      expect(una.id, 'a');
      expect(una.nome, 'Casa mia');
      expect(una.plancia, 'cucina');
      expect(una.segno, 'segno-due');
      expect(una.identificativo, 'dm_due');
      /* Il telefono di prima si fa staccare alla prossima connessione. */
      expect(una.vecchioIdentificativo, 'dm_uno');
      expect(una.vecchioSegno, 'segno-uno');
      expect(archivio.attiva!.id, 'a');
    },
  );

  test('riabbinare la stessa casa la aggiorna, non ne fa un\'altra', () async {
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();
    final gettone = await firmaUnGettone();
    final prima = await archivio.aggiungi(
      nome: 'Casa mia',
      segno: 'segno-uno',
      identificativo: 'dm_uno',
      chiave: 'ab' * 32,
      casaAlCentralino: casaDiProva,
    );
    await archivio.segnaIlGettone(prima.id, gettone);
    await archivio.segnaIlLegame(prima.id);
    await archivio.segnaLaPlancia(prima.id, 'cucina');

    final dopo = await archivio.aggiungi(
      nome: 'Casa',
      segno: 'segno-due',
      identificativo: 'dm_due',
      chiave: 'cd' * 32,
      casaAlCentralino: casaDiProva,
    );
    expect(archivio.tutte.length, 1);
    expect(dopo.id, prima.id);
    expect(dopo.nome, 'Casa mia');
    expect(dopo.plancia, 'cucina');
    expect(dopo.gettone, gettone);
    expect(dopo.segno, 'segno-due');
    expect(dopo.identificativo, 'dm_due');
    expect(dopo.legata, isFalse);
    expect(dopo.vecchioIdentificativo, 'dm_uno');
    expect(dopo.vecchioSegno, 'segno-uno');

    await archivio.segnaIlVecchioStaccato(dopo.id);
    expect(archivio.attiva!.haUnVecchioDaStaccare, isFalse);

    /* Un'altra casa resta un'altra casa. */
    await archivio.aggiungi(
      nome: 'Al mare',
      segno: 'segno-tre',
      identificativo: 'dm_tre',
      casaAlCentralino: 'casa_altra',
    );
    expect(archivio.tutte.length, 2);
  });

  test('la licenza, con due copie della stessa casa, dice Premium', () async {
    final vecchio = await firmaUnGettone(
      emesso: DateTime.now().subtract(const Duration(days: 9)),
      fino: DateTime.now().subtract(const Duration(days: 1)),
    );
    final nuovo = await firmaUnGettone();
    final licenza = GestoreLicenza(chiave: chiaveDiProva);
    await licenza.conosci([
      CasaConosciuta.daJson(_casa('a', gettone: nuovo))!,
      CasaConosciuta.daJson(_casa('a', gettone: vecchio))!,
    ]);
    licenza.inUso('a');
    expect(licenza.premium, isTrue);
  });
}
