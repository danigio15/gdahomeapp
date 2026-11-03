/// «In Salute il battito c'e' — 73, il 1° novembre — ma l'app non lo vede.»
/// Le finestre dell'ultimo valore, l'ultima notte, la data accanto, e la casa
/// che dice di no.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/salute/il_corpo.dart';
import 'package:gdahome/salute/postino_della_salute.dart';

import 'finti.dart';

void main() {
  group("l'ultimo valore", () {
    test('il battito si cerca per un mese, non per due giorni', () {
      expect(
        finestraDellUltimo(MisuraDelCorpo.battito),
        const Duration(days: 30),
      );
      expect(
        finestraDellUltimo(MisuraDelCorpo.ossigeno),
        const Duration(days: 30),
      );
      expect(
        finestraDellUltimo(MisuraDelCorpo.battitoRiposo),
        const Duration(days: 30),
      );
      expect(finestraDellUltimo(MisuraDelCorpo.passi), isNull);
      expect(finestraDellUltimo(MisuraDelCorpo.sonno), isNull);
    });

    test('nessuna finestra va oltre quello che il ponte accetta', () {
      for (final misura in MisuraDelCorpo.values) {
        final finestra = finestraDellUltimo(misura);
        if (finestra == null) continue;
        expect(
          finestra <= limiteDelPonte,
          isTrue,
          reason: '${misura.name}: oltre i 45 giorni il ponte la butta',
        );
      }
    });

    test('si cerca a scalini: un giorno, una settimana, la finestra', () {
      expect(scaliniFinoA(const Duration(days: 30)), const [
        Duration(days: 1),
        Duration(days: 7),
        Duration(days: 30),
      ]);
      expect(scaliniFinoA(const Duration(days: 5)), const [
        Duration(days: 1),
        Duration(days: 5),
      ]);
    });

    test("l'ultimo e' il piu' recente per fine", () {
      final ultimo = lUltimo([
        Campione(70, DateTime(2026, 11, 1, 8), DateTime(2026, 11, 1, 8)),
        Campione(73, DateTime(2026, 11, 1, 22), DateTime(2026, 11, 1, 22)),
        Campione(68, DateTime(2026, 10, 30, 9), DateTime(2026, 10, 30, 9)),
      ])!;
      expect(ultimo.valore, 73);
      expect(ultimo.quando, DateTime(2026, 11, 1, 22));
    });
  });

  group("l'ultima notte", () {
    final adesso = DateTime(2026, 11, 3, 20);

    test("stanotte l'orologio era a caricare: vale quella prima", () {
      final tratti = [
        Campione(0, DateTime(2026, 11, 1, 23), DateTime(2026, 11, 2, 6, 30)),
        Campione(0, DateTime(2026, 10, 31, 23), DateTime(2026, 11, 1, 7)),
      ];
      final sonno = ilSonnoDiStanotte(tratti, adesso)!;
      expect(sonno.valore, 7 * 60 + 30);
      expect(sonno.quando, DateTime(2026, 11, 2, 6, 30));
    });

    test("il pisolino della sera non e' «l'ultima notte»", () {
      final tratti = [
        Campione(
          0,
          DateTime(2026, 11, 2, 23, 30),
          DateTime(2026, 11, 3, 7, 30),
        ),
        Campione(
          0,
          DateTime(2026, 11, 3, 17, 30),
          DateTime(2026, 11, 3, 18, 30),
        ),
      ];
      final sonno = ilSonnoDiStanotte(tratti, adesso)!;
      expect(sonno.valore, 8 * 60);
      expect(sonno.quando, DateTime(2026, 11, 3, 7, 30));
    });

    test("la notte coi risvegli resta una notte sola", () {
      final tratti = [
        Campione(0, DateTime(2026, 11, 2, 23), DateTime(2026, 11, 3, 2)),
        /* Sveglio un'ora e mezza, poi di nuovo a dormire. */
        Campione(0, DateTime(2026, 11, 3, 3, 30), DateTime(2026, 11, 3, 7)),
        /* Il pisolino dopo pranzo. */
        Campione(0, DateTime(2026, 11, 3, 14), DateTime(2026, 11, 3, 14, 40)),
      ];
      final sonno = ilSonnoDiStanotte(tratti, adesso)!;
      expect(sonno.valore, 3 * 60 + 3 * 60 + 30);
      expect(sonno.quando, DateTime(2026, 11, 3, 7));
    });

    test('chi lavora di notte dorme di giorno: vale il sonno lungo', () {
      final tratti = [
        Campione(0, DateTime(2026, 11, 3, 8), DateTime(2026, 11, 3, 15)),
      ];
      final sonno = ilSonnoDiStanotte(tratti, adesso)!;
      expect(sonno.valore, 7 * 60);
    });

    test('oltre tre giorni non e\' piu\' «l\'ultima notte»', () {
      final tratti = [
        Campione(0, DateTime(2026, 10, 29, 23), DateTime(2026, 10, 30, 7)),
      ];
      expect(ilSonnoDiStanotte(tratti, adesso), isNull);
    });
  });

  group('la data accanto', () {
    final adesso = DateTime(2026, 11, 3, 20);

    test('oggi niente, ieri «ieri», prima il giorno', () {
      expect(quandoSeNonOggi(DateTime(2026, 11, 3, 7), adesso), isNull);
      expect(quandoSeNonOggi(DateTime(2026, 11, 2, 23), adesso), 'ieri');
      expect(quandoSeNonOggi(DateTime(2026, 11, 1, 22), adesso), '1 nov');
      expect(quandoSeNonOggi(DateTime(2026, 10, 15), adesso), '15 ott');
    });
  });

  group('una misura che non arriva', () {
    test("su iPhone si dice dove guardare, con quanti giorni", () {
      final testo = nessunValore(MisuraDelCorpo.battito, iPhone: true);
      expect(testo, contains('30 giorni'));
      expect(testo, contains('Impostazioni › Salute'));
      expect(
        nessunValore(MisuraDelCorpo.peso, iPhone: false),
        contains('Health Connect'),
      );
    });
  });

  group('la casa che dice di no', () {
    late PostinoDellaSalute postino;

    setUp(() {
      postino = PostinoDellaSalute(
        lettore: LettoreFinto(),
        dispensa: DispensaInMemoria(),
        adesso: () => LettoreFinto.adesso,
      );
    });

    test('senza Premium: resta acceso, ma il perche\' si sa', () async {
      final filo = FiloFinto(rifiuta: 'premium-richiesto');
      final ok = await postino.accendi(
        filo,
        const ScelteDellaSalute(persona: 'Marco'),
      );
      expect(ok, isTrue);
      expect(postino.scelte.acceso, isTrue);
      expect(postino.ultimoGuasto, GuastoDellaSalute.premiumRichiesto);
      expect(postino.letto, isTrue);
      expect(postino.ultimoGuasto!.spiegazione, contains('Premium'));
    });

    test('un telefono non intestato va riabbinato', () async {
      final filo = FiloFinto(rifiuta: 'unauthorized');
      await postino.accendi(filo, const ScelteDellaSalute());
      expect(postino.ultimoGuasto, GuastoDellaSalute.telefonoNonIntestato);
      expect(postino.ultimoGuasto!.spiegazione, contains('Abbinalo'));
    });

    test('la casa che non risponde, poi risponde', () async {
      final filo = FiloFinto(cade: true);
      await postino.accendi(filo, const ScelteDellaSalute());
      expect(postino.ultimoGuasto, GuastoDellaSalute.casaNonRisponde);
      filo.cade = false;
      final quante = await postino.manda(filo, subito: true);
      expect(quante, isNotNull);
      expect(postino.ultimoGuasto, isNull);
    });

    test('spegnendo, il guasto si dimentica', () async {
      final filo = FiloFinto(rifiuta: 'premium-richiesto');
      await postino.accendi(filo, const ScelteDellaSalute());
      await postino.spegni(filo);
      expect(postino.ultimoGuasto, isNull);
      expect(postino.letto, isFalse);
    });
  });
}
