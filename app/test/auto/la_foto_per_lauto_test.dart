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

    test('un elenco di ricette senza fine si ferma dove deve', () {
      /* Il tetto era sei, come i tasti, e aveva ragione finche' le ricette
         erano solo dei tasti. Adesso nello stesso elenco viaggiano anche
         quelle dei dispositivi — sei piu' sei — e un tetto da sei le tagliava
         via tutte: in macchina si premeva un cancello e non succedeva niente,
         perche' la sua ricetta era la settima. */
      final tante = List.generate(
        30,
        (i) =>
            '{"id":"$i|A$i","dominio":"switch","servizio":"toggle",'
            '"entita":"switch.a$i"}',
      ).join(',');
      expect(
        leRicetteDaScrivere('{"ricette":[$tante]}').length,
        ricetteAlMassimo,
      );
    });
  });

  /* ── I dispositivi ────────────────────────────────────────────────────
   *
   * Sono la ragione per cui questa fotografia esiste: in macchina un'app di
   * categoria IOT deve far vedere com'e' messo un dispositivo e lasciarlo
   * girare con un tocco. Qui si prova che arrivano dall'altra parte come sono
   * partiti, e che chi si sbaglia non fa comparire in auto qualcosa che in
   * casa non c'e'.
   */

  const conDispositivi =
      '{"quando":1700000000000,'
      '"dispositivi":[{"id":"cover.cancello","nome":"Cancello","genere":"porta","acceso":false,"stato":"Chiuso"}]}';

  test('i dispositivi arrivano nel file, campo per campo', () {
    final foto = _letto(laFotoDaScrivere(conDispositivi, casa: 'Casa mia'));
    expect(foto['dispositivi'], [
      {
        'id': 'cover.cancello',
        'nome': 'Cancello',
        'genere': 'porta',
        'acceso': false,
        'stato': 'Chiuso',
      },
    ]);
  });

  test('coi soli dispositivi la fotografia si scrive lo stesso', () {
    /* Prima serviva almeno un numero, una persona o un tasto: una casa fatta
       di soli varchi e luci non avrebbe avuto niente in macchina, proprio
       mentre quella e' l'unica cosa che l'auto vuole. */
    expect(laFotoDaScrivere(conDispositivi, casa: 'Casa mia'), isNotNull);
    expect(laFotoDaScrivere('{"quando":1}', casa: 'Casa mia'), isNull);
  });

  test(
    'una riga senza nome o senza identificativo non diventa una tessera',
    () {
      final foto = _letto(
        laFotoDaScrivere(
          '{"dispositivi":['
          '{"id":"light.a"},'
          '{"nome":"Senza id"},'
          '{"id":"light.b","nome":"Buona"}]}',
          casa: 'C',
        ),
      );
      expect(foto['dispositivi'], [
        {
          'id': 'light.b',
          'nome': 'Buona',
          'genere': '',
          'acceso': false,
          'stato': '',
        },
      ]);
    },
  );

  test('sei e non di piu', () {
    final tante = List.generate(
      9,
      (i) => '{"id":"light.n$i","nome":"N$i"}',
    ).join(',');
    final foto = _letto(
      laFotoDaScrivere('{"dispositivi":[$tante]}', casa: 'C'),
    );
    expect((foto['dispositivi'] as List).length, dispositiviAlMassimo);
  });

  test('«acceso» e un si o un no, non quello che arriva', () {
    final foto = _letto(
      laFotoDaScrivere(
        '{"dispositivi":[{"id":"light.a","nome":"A","acceso":"si"}]}',
        casa: 'C',
      ),
    );
    expect((foto['dispositivi'] as List).first, containsPair('acceso', false));
  });

  test('le ricette adesso sono di due specie, e ci stanno tutte', () {
    /* Sei tasti piu' sei dispositivi: col tetto vecchio da sei, le ricette dei
       dispositivi venivano tagliate via tutte — e in macchina si premeva un
       cancello e non succedeva niente. */
    final righe = <String>[
      for (var i = 0; i < 6; i++)
        '{"id":"$i|Tasto $i","dominio":"script","servizio":"turn_on","entita":"script.t$i"}',
      for (var i = 0; i < 6; i++)
        '{"id":"light.d$i","dominio":"light","servizio":"toggle","entita":"light.d$i"}',
    ];
    final ricette = leRicetteDaScrivere('{"ricette":[${righe.join(',')}]}');
    expect(ricette.length, ricetteAlMassimo);
    expect(ricette.length, 12);
    expect(ricette.last.entita, 'light.d5');
  });
}
