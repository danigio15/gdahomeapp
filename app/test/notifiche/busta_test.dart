/// La busta di una notifica: fatta dal ponte vero, aperta qui.
///
/// Il vettore qui sotto l'ha chiuso `ponte/src/spinta.js` con Node: se il
/// conto di Dart e quello di Node smettono di coincidere — l'etichetta,
/// l'HKDF, i dati autenticati — questa prova lo dice prima di un telefono.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/casa_conosciuta.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/notifiche/busta.dart';
import 'package:gdahome/notifiche/consegna.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/notifiche/notifiche.dart';

const _chiave =
    '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const _telefono = 'dm_0123456789abcdef';
const _busta =
    'ASQQsB6Nr1Tm/qZeDqYIYGSBHKCdLyaEhBIMQmII7i20kKRNnczUIiuNNwhlqh0RG8DgQIoPf8bF4dRfuA4mjX6BD5qz+lO5BaylLJX+hxzomcdvogSB4YqW56AQlWG2Iyi/WArydpGQp+BVFxUXULyKsM3QrBHDKtYoqujkNPcp8gjwr/HRI6FcMIxeD/Shtoe/5sBfvxxijBNzlb+M4kxagFEeH2l+m8FWw4LAPO5/RywHap6pTYXpMzQ7PDtTBtgoID/Gdl61BWc22tR/JA4Z+Ahwtq76Y3WnLuMaiBLjJ5cSRCzcVrvCQCoL657CbjitGbb6y00UYbqu+q3zY9IYJnjaQL6ekGjmy3HYKVHPW1mRx+LE8xevL4bt1vA+6cfVLgeTmJ9/rxXaj0PM7saJIRNobesQpF3WBDSDh8XB8HPhaJmZAdxg9DNyLekwmDulcHckKMiELYWUXvI5GiGUWw==';

const _casa = CasaConosciuta(
  id: 'casa-1',
  nome: 'Casa',
  segno: 'segno',
  identificativo: _telefono,
  chiave: _chiave,
);

void main() {
  test('la busta di Node si apre qui, con la chiave giusta', () async {
    final dentro = await apriLaSpinta(
      chiaveDelFilo: _chiave,
      telefono: _telefono,
      busta: _busta,
    );
    expect(dentro['titolo'], '🔔 Suona il campanello');
    expect(dentro['camera'], 'camera.ingresso');
    final notifica = NotificaArrivata.leggi(dentro)!;
    expect(notifica.chiamata, isTrue);
    expect(notifica.urgente, isTrue);
    expect(notifica.tasti.map((uno) => uno.id), ['apri', 'ignora']);
  });

  test('con un\'altra chiave, o per un altro telefono, non si apre', () async {
    await expectLater(
      apriLaSpinta(
        chiaveDelFilo: _chiave.replaceFirst('00', '01'),
        telefono: _telefono,
        busta: _busta,
      ),
      throwsA(isA<SpintaGuasta>()),
    );
    await expectLater(
      apriLaSpinta(
        chiaveDelFilo: _chiave,
        telefono: 'dm_fedcba9876543210',
        busta: _busta,
      ),
      throwsA(isA<SpintaGuasta>()),
    );
    final toccata = _busta.replaceRange(40, 41, _busta[40] == 'A' ? 'B' : 'A');
    await expectLater(
      apriLaSpinta(chiaveDelFilo: _chiave, telefono: _telefono, busta: toccata),
      throwsA(isA<SpintaGuasta>()),
    );
  });

  test('da Firebase alla notifica: la casa giusta, una volta sola', () async {
    final dati = {'g': '1', 'd': _telefono, 'b': _busta};
    final viste = NotificheViste(CassaforteInMemoria());
    final altra = CasaConosciuta(
      id: 'casa-2',
      nome: 'Al mare',
      segno: 's',
      identificativo: 'dm_aaaaaaaaaaaaaaaa',
      chiave: _chiave,
    );
    final prima = await apriQuellaArrivata(
      dati,
      [altra, _casa],
      viste: viste,
      adesso: DateTime.fromMillisecondsSinceEpoch(1760461930000),
    );
    expect(prima, isNotNull);
    expect(prima!.casa.id, 'casa-1');
    expect(prima.canale, CanaleDelleNotifiche.urgenti);
    expect(prima.tasti, hasLength(2));
    /* La stessa, consegnata due volte da Firebase o rigiocata: no. */
    expect(await apriQuellaArrivata(dati, [_casa], viste: viste), isNull);
    /* Di una casa che non c'e' piu': no. */
    expect(await apriQuellaArrivata(dati, [altra]), isNull);
    /* Non nostra: no. */
    expect(await apriQuellaArrivata({'altro': 'x'}, [_casa]), isNull);
  });

  test('arrivata tardi: si mostra, ma senza tasti', () async {
    final tardi = await apriQuellaArrivata(
      {'g': '1', 'd': _telefono, 'b': _busta},
      [_casa],
      adesso: DateTime.fromMillisecondsSinceEpoch(1760469126000 + 1),
    );
    expect(tardi!.scaduta, isTrue);
    expect(tardi.tasti, isEmpty);
  });

  test('il tocco si porta dietro la notifica, e la ritrova', () async {
    final aperta = await apriQuellaArrivata(
      {'g': '1', 'd': _telefono, 'b': _busta},
      [_casa],
      adesso: DateTime.fromMillisecondsSinceEpoch(1760461930000),
    );
    final tocco = ToccoDellaNotifica.daPortato(
      aperta!.daPortare,
      tasto: 'apri',
    )!;
    expect(tocco.casa, 'casa-1');
    expect(tocco.tasto, 'apri');
    expect(tocco.notifica.id, 'vettore-di-prova');
    expect(ToccoDellaNotifica.daPortato('non json'), isNull);
  });
}
