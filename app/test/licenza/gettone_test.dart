/// Le prove del gettone: le regole di verifica di `docs/LICENZE.md`, con la
/// coppia di prova del contratto.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/licenza/chiave.dart';
import 'package:gdahome/licenza/gettone.dart';

import 'gettoni_di_prova.dart';

void main() {
  test('con la chiave vuota nessun gettone vale', () async {
    final gettone = await firmaUnGettone();
    expect(await leggiIlGettone(gettone, chiave: ''), isNull);
    /* Con la chiave dell'app — vuota oggi, una vera il giorno che si accende,
     * mai quella di prova dei documenti — un gettone firmato con la coppia di
     * prova non vale. */
    expect(chiavePubblicaLicenze, isNot(chiaveDiProva));
    expect(await leggiIlGettone(gettone), isNull);
  });

  test('un gettone del quadro si legge, e vale per la sua casa', () async {
    final scade = DateTime.now().add(const Duration(days: 40));
    final letto = await leggiIlGettone(
      await firmaUnGettone(scade: scade, origine: 'regalo'),
      chiave: chiaveDiProva,
    );
    expect(letto, isNotNull);
    expect(letto!.app, 'gdahome');
    expect(letto.soggetto, casaDiProva);
    expect(letto.origine, 'regalo');
    expect(letto.scade!.millisecondsSinceEpoch, scade.millisecondsSinceEpoch);
    expect(letto.vale(soggetto: casaDiProva), isTrue);
  });

  test(
    'un abbonamento nei giorni del margine vale, e dice fino a quando è pagato',
    () async {
      /* Il periodo pagato è finito ieri e il rinnovo non è ancora arrivato:
       * il quadro dà il gettone fino a tre giorni dopo, e in `pagato` la fine
       * vera. Si verifica `scade` come sempre: `pagato` serve a scriverla. */
      final adesso = DateTime.now();
      final pagato = adesso.subtract(const Duration(days: 1));
      final letto = await leggiIlGettone(
        await firmaUnGettone(
          scade: pagato.add(const Duration(days: 3)),
          pagato: pagato,
        ),
        chiave: chiaveDiProva,
      );
      expect(letto, isNotNull);
      expect(letto!.vale(soggetto: casaDiProva), isTrue);
      expect(
        letto.pagato!.millisecondsSinceEpoch,
        pagato.millisecondsSinceEpoch,
      );

      /* Un regalo il campo non ce l'ha. */
      final regalo = await leggiIlGettone(
        await firmaUnGettone(origine: 'regalo'),
        chiave: chiaveDiProva,
      );
      expect(regalo!.pagato, isNull);
    },
  );

  test('firmato da un altro non vale', () async {
    final gettone = await firmaUnGettone(privata: privataSbagliata);
    expect(await leggiIlGettone(gettone, chiave: chiaveDiProva), isNull);
  });

  test('ritoccato dopo la firma non vale', () async {
    final gettone = await firmaUnGettone();
    final altro = await firmaUnGettone(
      sog: 'casa_ffffffffffffffffffffffffffffffff',
    );
    /* Il payload di un altro con la firma di questo. */
    final misto = '${altro.split('.').first}.${gettone.split('.').last}';
    expect(await leggiIlGettone(misto, chiave: chiaveDiProva), isNull);
  });

  test('roba che non è un gettone non rompe niente', () async {
    for (final storto in ['', 'x', 'a.b.c', '!!!.???', 'abc.']) {
      expect(await leggiIlGettone(storto, chiave: chiaveDiProva), isNull);
    }
    expect(await leggiIlGettone(null, chiave: chiaveDiProva), isNull);
  });

  test('una versione che non si conosce non vale', () async {
    final gettone = await firmaUnGettone(v: 2);
    expect(await leggiIlGettone(gettone, chiave: chiaveDiProva), isNull);
  });

  test('un gettone che promette più di 8 giorni non vale', () async {
    final adesso = DateTime.now();
    final gettone = await firmaUnGettone(
      emesso: adesso,
      fino: adesso.add(const Duration(days: 30)),
    );
    expect(await leggiIlGettone(gettone, chiave: chiaveDiProva), isNull);
  });

  test(
    'passato «fino» il gettone non vale più, anche se la licenza sì',
    () async {
      final adesso = DateTime.now();
      final letto = await leggiIlGettone(
        await firmaUnGettone(
          emesso: adesso.subtract(const Duration(days: 8)),
          fino: adesso.subtract(const Duration(minutes: 1)),
        ),
        chiave: chiaveDiProva,
      );
      expect(letto, isNotNull);
      expect(letto!.vale(soggetto: casaDiProva), isFalse);
    },
  );

  test('una licenza scaduta non vale, una per sempre sì', () async {
    final adesso = DateTime.now();
    final scaduta = await leggiIlGettone(
      await firmaUnGettone(scade: adesso.subtract(const Duration(hours: 1))),
      chiave: chiaveDiProva,
    );
    expect(scaduta!.vale(soggetto: casaDiProva), isFalse);
    final perSempre = await leggiIlGettone(
      await firmaUnGettone(perSempre: true),
      chiave: chiaveDiProva,
    );
    expect(perSempre!.scade, isNull);
    expect(perSempre.vale(soggetto: casaDiProva), isTrue);
    /* E il tempo si guarda ogni volta: fra otto giorni lo stesso non vale. */
    expect(
      perSempre.vale(
        soggetto: casaDiProva,
        adesso: adesso.add(const Duration(days: 8)),
      ),
      isFalse,
    );
  });

  test('il gettone di un\'altra casa non vale per questa', () async {
    final letto = await leggiIlGettone(
      await firmaUnGettone(),
      chiave: chiaveDiProva,
    );
    expect(
      letto!.vale(soggetto: 'casa_ffffffffffffffffffffffffffffffff'),
      isFalse,
    );
    /* Senza soggetto atteso basta che sia di una casa, non di un telefono. */
    expect(letto.vale(), isTrue);
    final diUnTelefono = await leggiIlGettone(
      await firmaUnGettone(sog: 'tel_0123456789abcdef0123456789abcdef'),
      chiave: chiaveDiProva,
    );
    expect(diUnTelefono!.vale(), isFalse);
  });

  test('gdahome vale anche per gdanav, gdanav non vale per gdahome', () async {
    final diGdahome = await leggiIlGettone(
      await firmaUnGettone(),
      chiave: chiaveDiProva,
    );
    expect(diGdahome!.vale(soggetto: casaDiProva, app: 'gdanav'), isTrue);
    final diGdanav = await leggiIlGettone(
      await firmaUnGettone(app: 'gdanav'),
      chiave: chiaveDiProva,
    );
    expect(diGdanav!.vale(soggetto: casaDiProva), isFalse);
    expect(diGdanav.vale(soggetto: casaDiProva, app: 'gdanav'), isTrue);
  });
}
