/// Quello che arriva dalla plancia e diventa il file che l'auto legge.
///
/// Il messaggio arriva da una pagina, e una pagina che si sbaglia non deve
/// poter fermare l'app ne' far comparire in macchina qualcosa che in casa non
/// c'e'. Quindi: si rilegge campo per campo, non si copia mai come viene, e
/// quando non c'e' niente da mostrare non si scrive.
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/auto/la_foto.dart';

Map<String, Object?> _letto(String? scritta) =>
    jsonDecode(scritta!) as Map<String, Object?>;

void main() {
  const piena =
      '{"quando":1700000000000,'
      '"fotovoltaico":[{"nome":"Casa","valore":"725 W"}],'
      '"persone":[{"nome":"Gio","inCasa":true}],'
      '"azioni":[{"id":"0|Buonanotte","nome":"Buonanotte","segno":"🌙"}]}';

  test('quello che arriva diventa il file, col nome della casa messo qui', () {
    /* La plancia sa di essere una plancia: non sa di quale delle case
       dell'app e'. Il nome lo mette chi scrive. */
    final foto = _letto(laFotoDaScrivere(piena, casa: 'Casa mia'));
    expect(foto['casa'], 'Casa mia');
    expect(foto['quando'], 1700000000000);
    expect(foto['fotovoltaico'], [
      {'nome': 'Casa', 'valore': '725 W'},
    ]);
    expect(foto['persone'], [
      {'nome': 'Gio', 'inCasa': true},
    ]);
    expect(foto['azioni'], [
      {
        'id': '0|Buonanotte',
        'nome': 'Buonanotte',
        'segno': '🌙',
        'subito': false,
      },
    ]);
  });

  test('un messaggio che non e\' una fotografia non si scrive', () {
    /* Non solleva: un null vuol dire «non scrivo», e l'auto continua a
       leggere quella di prima finche' non invecchia. */
    for (final detto in <String>[
      '',
      'ciao',
      '{',
      '[]',
      'null',
      '{"fotovoltaico":[],"persone":[],"azioni":[]}',
      '{"fotovoltaico":"tanto","persone":3}',
    ]) {
      expect(laFotoDaScrivere(detto, casa: 'Casa'), isNull, reason: detto);
    }
  });

  test('un messaggio enorme non si prova nemmeno a leggerlo', () {
    final lungo = '{"persone":[${'{"nome":"Gio"},' * 8000}{"nome":"Gio"}]}';
    expect(lungo.length, greaterThan(64 * 1024));
    expect(laFotoDaScrivere(lungo, casa: 'Casa'), isNull);
  });

  test('non si copia quello che non si e\' chiesto', () {
    /* Un campo in piu' mandato dalla pagina — per sbaglio o meno — non arriva
       in macchina: si rilegge campo per campo, e quello che non e' scritto qui
       resta fuori. */
    const con =
        '{"quando":1700000000000,"indirizzo":"Via Roma 1",'
        '"chiave":"segreta",'
        '"persone":[{"nome":"Gio","inCasa":true,"batteria":"12%"}]}';
    final scritta = laFotoDaScrivere(con, casa: 'Casa')!;
    expect(scritta.contains('Via Roma'), isFalse);
    expect(scritta.contains('segreta'), isFalse);
    expect(scritta.contains('12%'), isFalse);
    expect(_letto(scritta)['persone'], [
      {'nome': 'Gio', 'inCasa': true},
    ]);
  });

  test('ne entrano tre e sei, come dall\'altra parte', () {
    final misure = List.generate(
      9,
      (i) => '{"nome":"M$i","valore":"$i W"}',
    ).join(',');
    final azioni = List.generate(
      9,
      (i) => '{"id":"$i|A$i","nome":"A$i","segno":"💡"}',
    ).join(',');
    final foto = _letto(
      laFotoDaScrivere(
        '{"fotovoltaico":[$misure],"azioni":[$azioni]}',
        casa: 'Casa',
      ),
    );
    expect((foto['fotovoltaico']! as List).length, misureAlMassimo);
    expect((foto['azioni']! as List).length, azioniAlMassimo);
  });

  test('una riga a meta\' non entra, e non porta giu\' le altre', () {
    final foto = _letto(
      laFotoDaScrivere(
        '{"fotovoltaico":[{"nome":"","valore":"725 W"},'
        '{"nome":"Solare","valore":"485 W"}],'
        '"azioni":[{"id":"","nome":"Muta"},{"id":"1|Vera","nome":"Vera"}],'
        '"persone":[{"nome":""},{"nome":"Gio"}]}',
        casa: 'Casa',
      ),
    );
    expect(foto['fotovoltaico'], [
      {'nome': 'Solare', 'valore': '485 W'},
    ]);
    expect(foto['azioni'], [
      {'id': '1|Vera', 'nome': 'Vera', 'segno': '', 'subito': false},
    ]);
    /* Chi non dice se e' in casa non e' in casa: in macchina si legge «fuori»,
       che e' la risposta prudente delle due. */
    expect(foto['persone'], [
      {'nome': 'Gio', 'inCasa': false},
    ]);
  });

  test('un nome lunghissimo si taglia invece di passare intero', () {
    final foto = _letto(
      laFotoDaScrivere(
        '{"persone":[{"nome":"${'Giovanni ' * 40}","inCasa":true}]}',
        casa: 'Casa',
      ),
    );
    final nome = (foto['persone']! as List).first as Map<String, Object?>;
    expect((nome['nome']! as String).length, lessThanOrEqualTo(64));
  });

  test('senza un momento vale adesso, non «nuova per sempre»', () {
    /* Una fotografia senza data sembrerebbe appena scattata a ogni sguardo, e
       in macchina si leggerebbero per sempre i numeri di stamattina. */
    final prima = DateTime.now().millisecondsSinceEpoch;
    final foto = _letto(
      laFotoDaScrivere('{"persone":[{"nome":"Gio"}]}', casa: 'Casa'),
    );
    expect(foto['quando'] as int, greaterThanOrEqualTo(prima));
    /* E un momento che non e' un momento vale la stessa cosa. */
    final storto = _letto(
      laFotoDaScrivere(
        '{"quando":"ieri","persone":[{"nome":"Gio"}]}',
        casa: 'Casa',
      ),
    );
    expect(storto['quando'] as int, greaterThanOrEqualTo(prima));
  });

  group('il comando che torna dall\'auto', () {
    const adesso = 1790000000000;
    String scritto(String azione, int quando) =>
        jsonEncode({'azione': azione, 'quando': quando});

    test('un comando appena premuto si esegue', () {
      expect(
        ilComandoDellAuto(scritto('1|Cancello', adesso - 3000), adesso: adesso),
        '1|Cancello',
      );
    });

    test('un comando vecchio si butta invece di aprire il cancello', () {
      /* «Apri il cancello» premuto in macchina e' una cosa che si vuole
         ADESSO. Trovato un'ora dopo — il telefono in tasca, l'app mai
         riaperta — non e' piu' quello che uno voleva, ed eseguirlo vorrebbe
         dire aprire il cancello a casa vuota. */
      expect(
        ilComandoDellAuto(
          scritto('1|Cancello', adesso - quantoValeIlComandoMs - 1),
          adesso: adesso,
        ),
        isNull,
      );
      /* E uno scritto nel futuro non e' un comando: e' un orologio che e'
         andato avanti, o qualcosa che non torna. */
      expect(
        ilComandoDellAuto(
          scritto('1|Cancello', adesso + quantoValeIlComandoMs + 1),
          adesso: adesso,
        ),
        isNull,
      );
    });

    test('senza un momento non si esegue', () {
      /* Un comando che non dice quando e' stato premuto non si puo' far
         scadere, e uno che non scade prima o poi parte al momento sbagliato. */
      for (final detto in <String>[
        jsonEncode({'azione': '1|Cancello'}),
        jsonEncode({'azione': '1|Cancello', 'quando': 'ieri'}),
        jsonEncode({'azione': '1|Cancello', 'quando': 0}),
      ]) {
        expect(ilComandoDellAuto(detto, adesso: adesso), isNull, reason: detto);
      }
    });

    test('quello che non si capisce non si indovina', () {
      /* Dall\'altra parte c\'e\' un cancello. */
      for (final detto in <String>[
        '',
        'ciao',
        '{',
        '[]',
        'null',
        jsonEncode({'quando': adesso}),
        jsonEncode({'azione': '  ', 'quando': adesso}),
        'x' * 5000,
      ]) {
        expect(ilComandoDellAuto(detto, adesso: adesso), isNull, reason: detto);
      }
    });
  });

  group('le ricette dei tasti che partono da soli', () {
    const mandata =
        '{"persone":[{"nome":"Gio"}],'
        '"azioni":[{"id":"0|Cancello","nome":"Cancello","subito":true}],'
        '"ricette":[{"id":"0|Cancello","dominio":"switch","servizio":"toggle",'
        '"entita":"switch.cancello"}]}';

    test('le ricette non finiscono nel file che legge l\'auto', () {
      /* Là dentro ci vanno i nomi, e nomi e basta: un cruscotto in macchina
         non ha niente da farsene di «switch.cancello». A tenerle fuori è la
         rilettura campo per campo, non un ricordarsene. */
      final scritta = laFotoDaScrivere(mandata, casa: 'Casa')!;
      expect(scritta.contains('switch.cancello'), isFalse);
      expect(scritta.contains('ricette'), isFalse);
      expect(scritta.contains('Cancello'), isTrue);
    });

    test('col lucchetto acceso niente parte da solo', () {
      /* Chi l'ha messo ha detto che in casa non si entra senza che sia lui a
         tenere il telefono: un tasto premuto in macchina da uno schermo che
         non chiede niente sarebbe la porta di dietro di quella serratura. */
      final con = _letto(laFotoDaScrivere(mandata, casa: 'Casa'));
      expect((con['azioni']! as List).first, containsPair('subito', true));
      final senza = _letto(
        laFotoDaScrivere(mandata, casa: 'Casa', daSola: false),
      );
      expect((senza['azioni']! as List).first, containsPair('subito', false));
    });

    test('una ricetta a metà non si esegue a metà', () {
      /* Quello che arriva da una pagina non si copia come viene: qui dentro
         c'è il nome di un servizio che poi si chiama davvero. */
      for (final rotta in <String>[
        '{"ricette":[{"dominio":"switch","servizio":"toggle","entita":"switch.x"}]}',
        '{"ricette":[{"id":"0|X","servizio":"toggle","entita":"switch.x"}]}',
        '{"ricette":[{"id":"0|X","dominio":"switch","entita":"switch.x"}]}',
        '{"ricette":[{"id":"0|X","dominio":"switch","servizio":"toggle","entita":"senzapunto"}]}',
        '{"ricette":"tante"}',
        '{}',
      ]) {
        expect(leRicetteDaScrivere(rotta), isEmpty, reason: rotta);
      }
    });

    test('della ricetta passa solo quello che serve a chiamare', () {
      const con =
          '{"ricette":[{"id":"0|Modo","dominio":"select",'
          '"servizio":"select_option","entita":"select.modo",'
          '"dati":{"option":"Notte","altro":"non passa"}}]}';
      final ricette = leRicetteDaScrivere(con);
      expect(ricette.length, 1);
      expect(ricette.first.dati, {'option': 'Notte'});
      expect(leRicetteScritte(ricette).contains('non passa'), isFalse);
    });

    test('scritte e rilette dicono la stessa cosa', () {
      final ricette = leRicetteDaScrivere(mandata);
      final tornate = leRicetteDaScrivere(leRicetteScritte(ricette));
      expect(tornate.length, ricette.length);
      expect(tornate.first.id, '0|Cancello');
      expect(tornate.first.entita, 'switch.cancello');
      expect(tornate.first.servizio, 'toggle');
      expect(tornate.first.dominio, 'switch');
    });

    test('si trova per segno, e solo quello giusto', () {
      final ricette = leRicetteDaScrivere(mandata);
      expect(laRicettaDi('0|Cancello', ricette)?.entita, 'switch.cancello');
      /* Riordinate, o rinominate: non si esegue niente. */
      expect(laRicettaDi('1|Cancello', ricette), isNull);
      expect(laRicettaDi('0|Portone', ricette), isNull);
      expect(laRicettaDi('', ricette), isNull);
    });

    test('più di sei ricette non se ne scrivono', () {
      final tante = List.generate(
        9,
        (i) =>
            '{"id":"$i|A$i","dominio":"switch","servizio":"toggle",'
            '"entita":"switch.a$i"}',
      ).join(',');
      expect(
        leRicetteDaScrivere('{"ricette":[$tante]}').length,
        azioniAlMassimo,
      );
    });
  });
}
