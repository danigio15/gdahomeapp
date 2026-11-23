/// «Collega WHOOP» contro il WHOOP finto: il consenso, il ritorno, lo
/// scambio dallo sportello (mai il secret nell'app), il rinnovo, la
/// lettura, lo scollegamento, e il lettore della Salute col WHOOP accanto.
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/ponte/il_link.dart';
import 'package:gdahome/salute/il_corpo.dart';
import 'package:gdahome/salute/whoop/collegamento_whoop.dart';
import 'package:gdahome/salute/whoop/lettore_con_whoop.dart';

import 'finti.dart';
import 'whoop_finto.dart';

class _Prova {
  _Prova({ConfigurazioneWhoop? configurazione, this.apre = true}) {
    whoop = CollegamentoWhoop(
      configurazione: configurazione ?? configurazioneFinta,
      cassaforte: cassaforte,
      rete: server.rete,
      apri: (dove) async {
        aperte.add(dove);
        return apre;
      },
      adesso: () => adesso,
    );
  }

  final server = ServerWhoopFinto();
  final cassaforte = CassaforteInMemoria();
  final aperte = <Uri>[];
  final bool apre;
  DateTime adesso = mattinaWhoop;
  late final CollegamentoWhoop whoop;

  /// Il giro intero: «Collega», il si' su WHOOP, il ritorno all'app.
  Future<EsitoWhoop> collegati({String? code}) async {
    expect(await whoop.collega(), isTrue);
    final state = aperte.last.queryParameters['state']!;
    return whoop.ritorno(
      Uri.parse(
        '$ritornoWhoop?code=${code ?? server.codiceBuono}&state=$state',
      ),
    );
  }
}

void main() {
  group('collegare', () {
    test('senza client id ne\' sportello non si offre', () async {
      final prova = _Prova(
        configurazione: const ConfigurazioneWhoop(clientId: ''),
      );
      expect(prova.whoop.siMostra, isFalse);
      expect(await prova.whoop.collega(), isFalse);
      expect(prova.aperte, isEmpty);
      expect(
        const ConfigurazioneWhoop(clientId: 'x').pronta,
        isFalse,
        reason: 'senza sportello serve il PKCE',
      );
      expect(const ConfigurazioneWhoop(clientId: 'x', pkce: true).pronta, true);
    });

    test('la pagina del consenso: client id, ritorno, scope, state', () async {
      final prova = _Prova();
      expect(await prova.whoop.collega(), isTrue);
      final pagina = prova.aperte.single;
      expect(pagina.replace(query: '').toString(), startsWith('https://'));
      expect(pagina.host, autorizzazioneWhoop.host);
      final q = pagina.queryParameters;
      expect(q['response_type'], 'code');
      expect(q['client_id'], 'client-delle-prove');
      expect(q['redirect_uri'], 'gdahome://whoop');
      expect(q['scope']!.split(' '), scopeWhoop);
      expect(q['scope'], contains('offline'));
      expect(q['state']!.length, greaterThanOrEqualTo(8));
      expect(q.containsKey('client_secret'), isFalse);
      /* Senza PKCE acceso, niente sfida. */
      expect(q.containsKey('code_challenge'), isFalse);
      /* Due «Collega» di fila: due state diversi. */
      await prova.whoop.collega();
      expect(prova.aperte.last.queryParameters['state'], isNot(q['state']));
    });

    test('il si\': token dallo sportello, solo nel portachiavi', () async {
      final prova = _Prova();
      expect(await prova.collegati(), EsitoWhoop.collegato);
      expect(prova.whoop.stato, StatoWhoop.collegato);
      final scambio = prova.server.a('/whoop/token').single;
      final campi = jsonDecode(scambio.body) as Map;
      expect(campi['grant_type'], 'authorization_code');
      expect(campi['code'], 'codice-buono');
      expect(campi['redirect_uri'], 'gdahome://whoop');
      /* Il secret l'aggiunge lo sportello: dall'app non esce mai. */
      expect(prova.server.tuttoQuelloCheEUscito, isNot(contains('secret')));
      final scritto = await prova.cassaforte.leggi(
        CollegamentoWhoop.chiaveToken,
      );
      expect(scritto, contains('accesso-2'));
      expect(scritto, contains('rinnovo-2'));
      /* Dal profilo solo l'identificativo: niente nome, niente email. */
      expect(scritto, contains('4242'));
      expect(scritto, isNot(contains('esempio.it')));
      expect(scritto, isNot(contains('Prova')));
      /* Lo state si usa una volta sola. */
      expect(
        await prova.cassaforte.leggi(CollegamentoWhoop.chiaveAttesa),
        isNull,
      );
    });

    test('il navigatore che non si apre: si dice', () async {
      final prova = _Prova(apre: false);
      expect(await prova.whoop.collega(), isFalse);
      expect(prova.whoop.collegato, isFalse);
    });

    test('un ritorno con lo state sbagliato non collega niente', () async {
      final prova = _Prova();
      await prova.whoop.collega();
      final esito = await prova.whoop.ritorno(
        Uri.parse('gdahome://whoop?code=codice-buono&state=di-qualcun-altro'),
      );
      expect(esito, EsitoWhoop.linkNonValido);
      expect(prova.server.a('/whoop/token'), isEmpty);
      expect(prova.whoop.collegato, isFalse);
    });

    test('un ritorno senza un «Collega» prima non collega niente', () async {
      final prova = _Prova();
      final esito = await prova.whoop.ritorno(
        Uri.parse('gdahome://whoop?code=codice-buono&state=12345678'),
      );
      expect(esito, EsitoWhoop.linkNonValido);
      expect(prova.server.richieste, isEmpty);
    });

    test('un ritorno dopo dieci minuti e\' scaduto', () async {
      final prova = _Prova();
      await prova.whoop.collega();
      prova.adesso = prova.adesso.add(const Duration(minutes: 11));
      final state = prova.aperte.last.queryParameters['state'];
      final esito = await prova.whoop.ritorno(
        Uri.parse('gdahome://whoop?code=codice-buono&state=$state'),
      );
      expect(esito, EsitoWhoop.linkNonValido);
      expect(prova.whoop.collegato, isFalse);
    });

    test('chi dice di no su WHOOP: annullato', () async {
      final prova = _Prova();
      await prova.whoop.collega();
      final state = prova.aperte.last.queryParameters['state'];
      final esito = await prova.whoop.ritorno(
        Uri.parse('gdahome://whoop?error=access_denied&state=$state'),
      );
      expect(esito, EsitoWhoop.annullato);
      expect(prova.server.richieste, isEmpty);
    });

    test('un code che WHOOP non accetta: rifiutato', () async {
      final prova = _Prova();
      expect(await prova.collegati(code: 'inventato'), EsitoWhoop.rifiutato);
      expect(prova.whoop.collegato, isFalse);
    });

    test('la rete giu\' durante lo scambio: non risponde', () async {
      final prova = _Prova();
      prova.server.giu = true;
      expect(await prova.collegati(), EsitoWhoop.nonRisponde);
      expect(prova.whoop.collegato, isFalse);
    });

    test(
      'lo sportello che frena o non e\' configurato: non risponde',
      () async {
        for (final stato in [429, 503]) {
          final prova = _Prova();
          prova.server.sportelloFerma = stato;
          expect(await prova.collegati(), EsitoWhoop.nonRisponde);
          expect(prova.whoop.collegato, isFalse);
        }
      },
    );

    test('col PKCE, lo scambio va diretto a WHOOP, senza secret', () async {
      final prova = _Prova(
        configurazione: const ConfigurazioneWhoop(
          clientId: 'client-delle-prove',
          pkce: true,
        ),
      );
      await prova.whoop.collega();
      final q = prova.aperte.last.queryParameters;
      expect(q['code_challenge_method'], 'S256');
      expect(q['code_challenge']!.length, 43);
      final esito = await prova.whoop.ritorno(
        Uri.parse('gdahome://whoop?code=codice-buono&state=${q['state']}'),
      );
      expect(esito, EsitoWhoop.collegato);
      final scambio = prova.server.richieste.firstWhere(
        (r) => r.url == tokenWhoop,
      );
      final campi = Uri.splitQueryString(scambio.body);
      expect(campi['client_id'], 'client-delle-prove');
      expect(campi['code_verifier']!.length, greaterThanOrEqualTo(43));
      expect(campi.containsKey('client_secret'), isFalse);
    });

    test('il link di ritorno arriva al WHOOP, non agli inviti', () {
      final letto = leggiIlLink(
        Uri.parse('gdahome://whoop?code=abc&state=xyz'),
      );
      expect(letto, isA<RitornoDaWhoop>());
      expect((letto as RitornoDaWhoop).link.queryParameters['code'], 'abc');
    });
  });

  group('leggere', () {
    test(
      'subito dopo il si\', i dati; poi al piu\' ogni quarto d\'ora',
      () async {
        final prova = _Prova();
        await prova.collegati();
        final dati = await prova.whoop.aggiorna(forza: true);
        expect(dati!.recupero!.percento, 78);
        expect(prova.whoop.ultimi, same(dati));
        final richiesteDopo = prova.server.a('/v2/recovery').length;
        prova.adesso = prova.adesso.add(const Duration(minutes: 5));
        await prova.whoop.aggiorna();
        expect(prova.server.a('/v2/recovery').length, richiesteDopo);
        prova.adesso = prova.adesso.add(const Duration(minutes: 11));
        await prova.whoop.aggiorna();
        expect(prova.server.a('/v2/recovery').length, richiesteDopo + 1);
        /* Col token nell'intestazione, mai nell'indirizzo. */
        final una = prova.server.a('/v2/recovery').last;
        expect(una.headers['authorization'], startsWith('Bearer '));
        expect(una.url.toString(), isNot(contains('accesso')));
      },
    );

    test('i dati restano nel portachiavi, e si ritrovano al riavvio', () async {
      final prova = _Prova();
      await prova.collegati();
      await prova.whoop.aggiorna(forza: true);
      final dopo = CollegamentoWhoop(
        configurazione: configurazioneFinta,
        cassaforte: prova.cassaforte,
        rete: prova.server.rete,
        adesso: () => prova.adesso,
      );
      await dopo.carica();
      expect(dopo.collegato, isTrue);
      expect(dopo.ultimi!.recupero!.percento, 78);
    });

    test('il token scaduto si rinnova dallo sportello', () async {
      final prova = _Prova();
      await prova.collegati();
      prova.adesso = prova.adesso.add(const Duration(hours: 2));
      await prova.whoop.aggiorna(forza: true);
      final rinnovi = [
        for (final r in prova.server.a('/whoop/token'))
          if ((jsonDecode(r.body) as Map)['grant_type'] == 'refresh_token') r,
      ];
      expect(rinnovi, hasLength(1));
      expect(jsonDecode(rinnovi.single.body)['refresh_token'], 'rinnovo-2');
      expect(
        await prova.cassaforte.leggi(CollegamentoWhoop.chiaveToken),
        contains('rinnovo-3'),
      );
      expect(prova.whoop.ultimi!.recupero, isNotNull);
    });

    test('un 401 dell\'API rinnova e riprova, una volta', () async {
      final prova = _Prova();
      await prova.collegati();
      prova.server.scadutoUnaVolta = true;
      final dati = await prova.whoop.aggiorna(forza: true);
      expect(dati!.recupero!.percento, 78);
      expect(prova.whoop.collegato, isTrue);
    });

    test(
      'il rinnovo rifiutato: il collegamento e\' perso, e si dice',
      () async {
        final prova = _Prova();
        await prova.collegati();
        await prova.whoop.aggiorna(forza: true);
        prova.server.rifiutaIlRinnovo = true;
        prova.adesso = prova.adesso.add(const Duration(hours: 2));
        expect(await prova.whoop.aggiorna(forza: true), isNull);
        expect(prova.whoop.stato, StatoWhoop.daRicollegare);
        expect(prova.whoop.ultimi, isNull);
        expect(
          await prova.cassaforte.leggi(CollegamentoWhoop.chiaveToken),
          isNull,
        );
        expect(
          await prova.cassaforte.leggi(CollegamentoWhoop.chiaveDati),
          isNull,
        );
      },
    );

    test('uno scope negato lascia vuota solo la sua parte', () async {
      final prova = _Prova();
      await prova.collegati();
      prova.server.negate.add('/v2/activity/workout');
      final dati = await prova.whoop.aggiorna(forza: true);
      expect(dati!.recupero, isNotNull);
      expect(dati.allenamenti, isEmpty);
    });

    test('WHOOP giu\': si tengono i dati di prima', () async {
      final prova = _Prova();
      await prova.collegati();
      final prima = await prova.whoop.aggiorna(forza: true);
      prova.server.giu = true;
      final dopo = await prova.whoop.aggiorna(forza: true);
      expect(dopo, same(prima));
      expect(prova.whoop.collegato, isTrue);
    });
  });

  group('scollegare', () {
    test('revoca su WHOOP e cancella tutto dal telefono', () async {
      final prova = _Prova();
      await prova.collegati();
      await prova.whoop.aggiorna(forza: true);
      await prova.whoop.scollega();
      expect(prova.server.revocato, isTrue);
      expect(prova.whoop.stato, StatoWhoop.scollegato);
      expect(prova.whoop.ultimi, isNull);
      for (final chiave in [
        CollegamentoWhoop.chiaveToken,
        CollegamentoWhoop.chiaveDati,
        CollegamentoWhoop.chiaveAttesa,
      ]) {
        expect(await prova.cassaforte.leggi(chiave), isNull, reason: chiave);
      }
    });

    test('anche se WHOOP non risponde', () async {
      final prova = _Prova();
      await prova.collegati();
      prova.server.giu = true;
      await prova.whoop.scollega();
      expect(prova.whoop.collegato, isFalse);
      expect(
        await prova.cassaforte.leggi(CollegamentoWhoop.chiaveToken),
        isNull,
      );
    });
  });

  group('il lettore della Salute col WHOOP', () {
    test('scollegato: solo il telefono, come prima', () async {
      final prova = _Prova();
      final telefono = LettoreFinto();
      final lettore = LettoreConWhoop(telefono, prova.whoop);
      final lette = await lettore.leggi(misureDiSerie, adesso: mattinaWhoop);
      expect(lette.keys, isNot(contains(MisuraDelCorpo.recupero)));
      expect(prova.server.richieste, isEmpty);
    });

    test('collegato: recupero e sforzo arrivano, e vanno a casa', () async {
      final prova = _Prova();
      await prova.collegati();
      final telefono = LettoreFinto();
      final lettore = LettoreConWhoop(telefono, prova.whoop);
      final lette = await lettore.leggi(misureDiSerie, adesso: mattinaWhoop);
      expect(lette[MisuraDelCorpo.recupero]!.valore, 78);
      expect(lette[MisuraDelCorpo.recupero]!.fonte, Fonte.whoop);
      expect(lette[MisuraDelCorpo.sforzo]!.valore, 12.4);
      /* I passi del telefono restano quelli. */
      expect(lette[MisuraDelCorpo.passi]!.valore, 7842);
    });

    test(
      'al telefono non si chiede il permesso di recupero e sforzo',
      () async {
        final prova = _Prova();
        final telefono = LettoreFinto();
        final lettore = LettoreConWhoop(telefono, prova.whoop);
        await lettore.chiediIlPermesso({
          MisuraDelCorpo.recupero,
          MisuraDelCorpo.sforzo,
          MisuraDelCorpo.hrv,
        });
        expect(telefono.chiesti.single, {MisuraDelCorpo.hrv});
      },
    );
  });
}
