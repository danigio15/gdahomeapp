/// Il foglietto del pannello a muro: si legge, o si rifiuta se e' rovinato.
///
/// GdAHome Muro al primo avvio legge il foglietto che l'add-on ha scritto sul
/// pannello (`installatore-pannelli.js`, `/data/local/gdahome/abbinamento.json`)
/// e ci entra nella casa. Queste prove tengono fermo il patto fra i due: la
/// stessa forma che l'add-on scrive, l'app la legge; e un foglietto a meta' non
/// fa partire un abbinamento sbagliato, torna `null`.
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/muro/foglietto_del_muro.dart';

void main() {
  /// Il foglietto buono, come lo scrive l'add-on.
  String foglietto({
    String dispositivo = 'dm_a1b2c3d4e5f60718',
    String segno = 'abcdef0123456789',
    String chiave = '0123456789abcdef',
    List<Object>? indirizzi,
    String? plancia = 'soggiorno',
    String? utente = 'u1',
  }) {
    return jsonEncode({
      'v': 1,
      'dispositivo': dispositivo,
      'segno': segno,
      'chiave': chiave,
      'plancia': plancia,
      'utente': utente,
      'case': {
        'centralino': 'centralino.gdahome.org',
        'indirizzi': indirizzi ?? ['192.168.1.10:8098', '192.168.1.11'],
      },
    });
  }

  test('legge un foglietto buono e ne cava tutto', () {
    final f = FogliettoDelMuro.daJson(foglietto())!;
    expect(f.dispositivo, 'dm_a1b2c3d4e5f60718');
    expect(f.segno, 'abcdef0123456789');
    expect(f.chiave, '0123456789abcdef');
    expect(f.indirizzi, ['192.168.1.10:8098', '192.168.1.11']);
    expect(f.plancia, 'soggiorno');
    expect(f.utente, 'u1');
    expect(f.centralino, 'centralino.gdahome.org');
  });

  test(
    'la casa conosciuta prende il primo indirizzo come quello di dentro casa',
    () {
      final f = FogliettoDelMuro.daJson(foglietto())!;
      final casa = f.casaConosciuta(id: 'c1', nome: 'Casa Rossi');
      expect(casa.id, 'c1');
      expect(casa.nome, 'Casa Rossi');
      expect(casa.segno, 'abcdef0123456789');
      expect(casa.identificativo, 'dm_a1b2c3d4e5f60718');
      expect(casa.chiave, '0123456789abcdef');
      expect(casa.plancia, 'soggiorno');
      expect(casa.inCasa?.casa, '192.168.1.10');
      expect(casa.inCasa?.porta, 8098);
    },
  );

  test('un indirizzo senza porta prende quella di sempre', () {
    final f = FogliettoDelMuro.daJson(foglietto(indirizzi: ['10.0.0.5']))!;
    final casa = f.casaConosciuta(id: 'c1');
    expect(casa.inCasa?.casa, '10.0.0.5');
    expect(casa.inCasa?.porta, 8098);
  });

  test('accetta gli indirizzi come oggetti, non solo stringhe', () {
    final f = FogliettoDelMuro.daJson(
      foglietto(
        indirizzi: [
          {'casa': '192.168.1.20', 'porta': 8098},
        ],
      ),
    )!;
    expect(f.indirizzi, ['192.168.1.20:8098']);
  });

  group('un foglietto che non va torna null, non lancia', () {
    test('vuoto o non JSON', () {
      expect(FogliettoDelMuro.daJson(null), isNull);
      expect(FogliettoDelMuro.daJson(''), isNull);
      expect(FogliettoDelMuro.daJson('non json'), isNull);
      expect(FogliettoDelMuro.daJson('[1,2,3]'), isNull);
    });
    test('senza segno, chiave o dispositivo', () {
      expect(FogliettoDelMuro.daJson(foglietto(segno: '')), isNull);
      expect(FogliettoDelMuro.daJson(foglietto(chiave: '')), isNull);
      expect(FogliettoDelMuro.daJson(foglietto(dispositivo: '')), isNull);
    });
    test('senza nessun indirizzo', () {
      expect(FogliettoDelMuro.daJson(foglietto(indirizzi: [])), isNull);
    });
  });

  test('plancia e utente vuoti diventano null', () {
    final f = FogliettoDelMuro.daJson(foglietto(plancia: '', utente: ''))!;
    expect(f.plancia, isNull);
    expect(f.utente, isNull);
  });
}
