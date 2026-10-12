/// Le prove del legame fra la chiave e le due righe in chiaro (`lega: 1`).
///
/// Le righe della stretta di mano viaggiano in chiaro, e chi sta in mezzo le
/// puo' riscrivere: un `da_casa` girato tiene aperto con gdahome Base un filo
/// che l'app dovrebbe chiudere. Col legame le due righe entrano nella chiave,
/// e chi le tocca fa si' che la prima busta non si apra.
///
/// Si prova anche la parte che non deve rompere niente: con un ponte di prima
/// — che il legame non lo ripete — si entra come sempre. E quella che lo
/// difende: una casa che l'ha ripetuto una volta lo deve ripetere sempre.
library;

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/ponte/cifra.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/filo.dart';
import 'package:gdahome/ponte/presa.dart';
import 'package:gdahome/ponte/stretta.dart';

import 'ponte_finto.dart';

void main() {
  late PonteFinto ponte;

  setUp(() async => ponte = await PonteFinto.alza());
  tearDown(() async => ponte.spegni());

  Future<PresaCifrata> stringi({bool pretendi = false}) async => stringiLaMano(
    await PresaSuWebSocket.apri(ponte.indirizzo.filo),
    chi: chiBuono,
    chiaveDelFilo: chiaveBuona,
    pretendiIlLegame: pretendi,
  );

  /* La prima cosa che la casa dice dentro il cifrato, o l'errore con cui il
   * filo si chiude se non si apre. */
  Future<Object> laPrimaBusta(PresaCifrata cifrata) {
    final esito = Completer<Object>();
    cifrata.messaggi.listen(
      (byte) {
        if (!esito.isCompleted) esito.complete(byte);
      },
      onError: (Object errore) {
        if (!esito.isCompleted) esito.complete(errore);
      },
    );
    return esito.future.timeout(const Duration(seconds: 5));
  }

  Filo unFilo({bool legameGiaVisto = false, void Function()? quandoLega}) =>
      Filo.fisso(
        indirizzo: ponte.indirizzo,
        segno: segnoBuono,
        chi: chiBuono,
        chiave: chiaveBuona,
        attesaMassima: const Duration(milliseconds: 80),
        attesaDellaRisposta: const Duration(seconds: 3),
        legameGiaVisto: legameGiaVisto,
        quandoLega: quandoLega,
      );

  group('la stretta di mano', () {
    test('l\'app chiede il legame, la casa lo ripete, e si parla', () async {
      final cifrata = await stringi();
      expect(ponte.strette.single['lega'], versioneDelLegame);
      expect(cifrata.legata, isTrue);
      expect(await laPrimaBusta(cifrata), isNot(isA<ErroreDelPonte>()));
      expect(cifrata.legataEProvata, isTrue);
      await cifrata.chiudi();
    });

    test('con un ponte di prima si entra come sempre, senza legame', () async {
      ponte.conosceIlLegame = false;
      final cifrata = await stringi();
      expect(cifrata.legata, isFalse);
      expect(await laPrimaBusta(cifrata), isNot(isA<ErroreDelPonte>()));
      expect(cifrata.legataEProvata, isFalse);
      await cifrata.chiudi();
    });

    test(
      'un da_casa girato per strada fa si\' che la prima busta non si apra',
      () async {
        ponte.perStradaIlPronto = (pronto) =>
            pronto.replaceFirst(RegExp(r'}$'), ',"da_casa":true}');
        final cifrata = await stringi();
        expect(cifrata.daCasa, isTrue, reason: 'il ritocco e\' arrivato');
        final esito = await laPrimaBusta(cifrata);
        expect(esito, isA<FiloCaduto>());
        expect((esito as FiloCaduto).spiegazione, contains('toccato'));
        expect(cifrata.legataEProvata, isFalse);
      },
    );

    test('un gzip tolto per strada, lo stesso', () async {
      ponte.perStradaIlPronto = (pronto) =>
          pronto.replaceFirst('"gzip":true,', '');
      final cifrata = await stringi();
      expect(await laPrimaBusta(cifrata), isA<FiloCaduto>());
    });

    test(
      'senza legame lo stesso ritocco passava: e\' il buco che si chiude',
      () async {
        ponte
          ..conosceIlLegame = false
          ..perStradaIlPronto = (pronto) =>
              pronto.replaceFirst(RegExp(r'}$'), ',"da_casa":true}');
        final cifrata = await stringi();
        expect(cifrata.daCasa, isTrue);
        expect(await laPrimaBusta(cifrata), isNot(isA<ErroreDelPonte>()));
        await cifrata.chiudi();
      },
    );

    test(
      'a una casa che lega, una risposta senza legame non si accetta',
      () async {
        /* E' chi toglie il `lega` dalla prima riga per tornare alla chiave di
       * prima: la casa allora non lo ripete, come una casa di prima. */
        ponte.conosceIlLegame = false;
        await expectLater(
          stringi(pretendi: true),
          throwsA(isA<LegameMancato>()),
        );
      },
    );
  });

  group('il filo se lo ricorda', () {
    test('la prima volta che la casa lega, lo si scrive', () async {
      var scritto = 0;
      final filo = unFilo(quandoLega: () => scritto += 1);
      await filo.apri();
      expect(filo.legameVisto, isTrue);
      expect(scritto, 1);

      /* Ricollegandosi non lo si riscrive. */
      await ponte.buttaGiu();
      await _finche(() => ponte.collegamenti >= 2 && filo.dentro);
      expect(scritto, 1);
      await filo.chiudi();
    });

    test('con un ponte di prima non si scrive niente, e si entra', () async {
      ponte.conosceIlLegame = false;
      var scritto = 0;
      final filo = unFilo(quandoLega: () => scritto += 1);
      await filo.apri();
      expect(filo.legameVisto, isFalse);
      expect(scritto, 0);
      await filo.chiudi();
    });

    test(
      'una casa che ha gia\' legato e poi non lega piu\' non si apre',
      () async {
        ponte.conosceIlLegame = false;
        final filo = unFilo(legameGiaVisto: true);
        await expectLater(filo.apri(), throwsA(isA<LegameMancato>()));
        await filo.chiudi();
      },
    );

    test('e vale anche dentro la stessa vita del filo', () async {
      final filo = unFilo();
      await filo.apri();
      expect(filo.legameVisto, isTrue);

      /* Chi sta in mezzo toglie il legame: la casa risponde come una di
       * prima, e il filo non rientra. */
      ponte.conosceIlLegame = false;
      final prima = ponte.collegamenti;
      await ponte.buttaGiu();
      await _finche(() => ponte.collegamenti > prima + 1);
      expect(filo.dentro, isFalse);
      expect(
        filo.ultimeCadute.any((una) => una.contains('meno sicuro')),
        isTrue,
        reason: '${filo.ultimeCadute}',
      );
      await filo.chiudi();
    });

    test(
      'un legame aggiunto per strada a una casa di prima non resta',
      () async {
        /* Il legame si ricorda solo dopo una busta aperta: chi lo aggiunge per
       * strada alla risposta di una casa di prima fa fallire quel giro, ma
       * non chiude fuori la casa per sempre. */
        ponte
          ..conosceIlLegame = false
          ..perStradaIlPronto = (pronto) =>
              pronto.replaceFirst(RegExp(r'}$'), ',"lega":1}');
        var scritto = 0;
        final filo = unFilo(quandoLega: () => scritto += 1);
        await expectLater(
          filo.apri(entro: const Duration(milliseconds: 600)),
          throwsA(isA<ErroreDelPonte>()),
        );
        expect(filo.legameVisto, isFalse);
        expect(scritto, 0);

        /* Chi stava in mezzo se ne va: si rientra. */
        ponte.perStradaIlPronto = null;
        await _finche(() => filo.dentro);
        expect(filo.legameVisto, isFalse);
        await filo.chiudi();
      },
    );
  });

  group('e l\'archivio se lo ricorda fra un\'apertura e l\'altra', () {
    /* Il filo di una casa dell'archivio, come lo fa il collegamento: parte
     * da quello che l'archivio sa, e quando la casa lega lo scrive li'. */
    Filo ilFiloDi(ArchivioDelleCase archivio, String id) {
      final casa = archivio.quella(id)!;
      return unFilo(
        legameGiaVisto: casa.legata,
        quandoLega: () => archivio.segnaIlLegame(id),
      );
    }

    Future<(CassaforteInMemoria, String)> unaCasaCheHaLegato() async {
      final cassaforte = CassaforteInMemoria();
      final archivio = ArchivioDelleCase(cassaforte);
      await archivio.apri();
      final casa = await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: ponte.indirizzo,
      );
      expect(casa.legata, isFalse, reason: 'appena abbinata non ha legato');
      final filo = ilFiloDi(archivio, casa.id);
      await filo.apri();
      await _finche(() => archivio.quella(casa.id)!.legata);
      await filo.chiudi();
      return (cassaforte, casa.id);
    }

    test('dopo una stretta legata, il legame e\' scritto', () async {
      final (cassaforte, id) = await unaCasaCheHaLegato();

      /* L'app si riapre: un archivio nuovo, sulla stessa cassaforte. */
      final riaperto = ArchivioDelleCase(cassaforte);
      await riaperto.apri();
      expect(riaperto.quella(id)!.legata, isTrue);

      /* Ricollegandosi con la casa che lega ancora, non si riscrive. */
      final prima = cassaforte.scritture;
      final filo = ilFiloDi(riaperto, id);
      await filo.apri();
      expect(filo.legameVisto, isTrue);
      await filo.chiudi();
      expect(cassaforte.scritture, prima);
    });

    test(
      'riaperta l\'app, chi toglie il legame per strada non entra',
      () async {
        final (cassaforte, id) = await unaCasaCheHaLegato();
        final riaperto = ArchivioDelleCase(cassaforte);
        await riaperto.apri();

        /* Chi sta in mezzo toglie il `lega` alla prima stretta dopo
         * l'apertura, e ritocca le righe in chiaro: la casa risponde come
         * una di prima, e il filo non la accetta. */
        ponte
          ..conosceIlLegame = false
          ..perStradaIlPronto = (pronto) =>
              pronto.replaceFirst(RegExp(r'}$'), ',"da_casa":true}');
        final filo = ilFiloDi(riaperto, id);
        await expectLater(filo.apri(), throwsA(isA<LegameMancato>()));
        expect(filo.dentro, isFalse);
        await filo.chiudi();
      },
    );

    test('una casa mai vista legare si apre anche senza legame', () async {
      ponte.conosceIlLegame = false;
      final cassaforte = CassaforteInMemoria();
      final archivio = ArchivioDelleCase(cassaforte);
      await archivio.apri();
      final casa = await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: ponte.indirizzo,
      );
      final filo = ilFiloDi(archivio, casa.id);
      await filo.apri();
      expect(filo.dentro, isTrue);
      await filo.chiudi();
      expect(archivio.quella(casa.id)!.legata, isFalse);
    });

    test('togliere la casa si porta via anche il legame', () async {
      final (cassaforte, id) = await unaCasaCheHaLegato();
      final archivio = ArchivioDelleCase(cassaforte);
      await archivio.apri();
      await archivio.togli(id);

      /* Riabbinata, e' una casa nuova: col ponte di prima si entra. */
      ponte.conosceIlLegame = false;
      final nuova = await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: ponte.indirizzo,
      );
      expect(nuova.legata, isFalse);
      final riaperto = ArchivioDelleCase(cassaforte);
      await riaperto.apri();
      expect(riaperto.quella(id), isNull);
      final filo = ilFiloDi(riaperto, nuova.id);
      await filo.apri();
      expect(filo.dentro, isTrue);
      await filo.chiudi();
    });
  });
}

Future<void> _finche(
  bool Function() condizione, {
  Duration entro = const Duration(seconds: 5),
}) async {
  final fine = DateTime.now().add(entro);
  while (!condizione()) {
    if (DateTime.now().isAfter(fine)) fail('l\'attesa e\' scaduta');
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
}
