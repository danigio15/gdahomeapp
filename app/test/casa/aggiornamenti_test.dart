/// Le prove degli aggiornamenti visti dall'app.
///
/// Quello che conta qui sono tre cose che, sbagliate, si vedono tardi e male:
///
/// - un ponte piu' vecchio dell'app quei comandi non li conosce, e deve
///   arrivare come «non conosco» e non come una schermata vuota: la
///   differenza e' fra «aggiorna l'add-on» e «qui non funziona niente»;
/// - «stacca» viaggia con la riga. E' l'unico modo che ha l'app di dire
///   **prima** che il filo sta per cadere: senza, l'app si sconnette un
///   istante dopo il tocco e sembra rotta lei;
/// - quello che il ponte non dice non si inventa: una percentuale che non c'e'
///   e' `-1`, cioe' «non si sa», e non uno zero che sembra un'installazione
///   ferma.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/aggiornamenti.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/filo.dart';

import '../ponte/ponte_finto.dart';

void main() {
  late PonteFinto ponte;
  late Filo filo;

  setUp(() async {
    ponte = await PonteFinto.alza();
    filo = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
    );
    await filo.apri();
  });

  tearDown(() async {
    await filo.chiudi();
    await ponte.spegni();
  });

  test('una casa a posto risponde che non c\'è niente da fare', () async {
    expect(await GliAggiornamenti(filo).elenco(), isEmpty);
  });

  test('l\'elenco arriva com\'è, e «stacca» viaggia con la riga', () async {
    ponte.aggiornamenti.addAll([
      {
        'entita': 'update.dashboardmodern_update',
        'nome': 'DashboardModern',
        'da': '1.4.30',
        'a': '1.4.31',
        'nostra': true,
        'installabile': true,
        'inCorso': false,
        'quanto': -1,
        'stacca': false,
        'note': 'https://example.invalid/note',
        'dettagli': 'Le finestre non restano più offuscate.',
      },
      {
        'entita': 'update.gdahome_update',
        'nome': 'gdahome',
        'da': '0.20.0',
        'a': '0.21.0',
        'installabile': true,
        'stacca': true,
      },
    ]);

    final fila = await GliAggiornamenti(filo).elenco();
    expect(fila, hasLength(2));
    expect(fila.first.nome, 'DashboardModern');
    expect(fila.first.versioni, '1.4.30 → 1.4.31');
    expect(fila.first.dettagli, 'Le finestre non restano più offuscate.');
    expect(fila.first.stacca, isFalse);

    /* Quello di gdahome porta giu' il filo, e l'app lo sa prima di premere. */
    expect(fila.last.stacca, isTrue);
    /* Quello che il ponte non ha detto non si inventa: nessuna percentuale
     * vuol dire «non si sa», e si disegna una striscia che non promette
     * niente invece di una barra ferma a zero. */
    expect(fila.last.quanto, -1);
    expect(fila.last.inCorso, isFalse);
  });

  test(
    'installare parte, e da lì in poi quella riga risulta in corso',
    () async {
      ponte.aggiornamenti.add({
        'entita': 'update.gdahome_update',
        'nome': 'gdahome',
        'a': '0.21.0',
        'installabile': true,
        'stacca': true,
      });

      final esito = await GliAggiornamenti(filo)
          .installa('update.gdahome_update');
      expect(esito.gia, isFalse);
      expect(esito.stacca, isTrue);
      expect(ponte.installati, ['update.gdahome_update']);

      final dopo = await GliAggiornamenti(filo).elenco();
      expect(dopo.single.inCorso, isTrue);
    },
  );

  test('un aggiornamento che non c\'è più si dice, e non si finge', () async {
    await expectLater(
      GliAggiornamenti(filo).installa('update.sparito'),
      throwsA(
        isA<ComandoRifiutato>().having(
          (uno) => uno.codice,
          'codice',
          'not_found',
        ),
      ),
    );
  });

  test('il riavvio si chiede al ponte, e basta quello', () async {
    await GliAggiornamenti(filo).riavvia();
    expect(ponte.riavviata, isTrue);
  });

  test(
    'un ponte più vecchio dell\'app lo dice, e l\'app lo sa spiegare',
    () async {
      /* Non e' un guasto: e' un add-on di prima. L'app ha gia' la frase giusta
     * per «unknown_command» — «gdahome in casa e' piu' vecchio dell'app» — e
     * quello che conta e' che l'errore arrivi fin li' con quel codice. */
      ponte.sagliAggiornamenti = false;
      await expectLater(
        GliAggiornamenti(filo).elenco(),
        throwsA(
          isA<ComandoRifiutato>().having(
            (uno) => uno.codice,
            'codice',
            'unknown_command',
          ),
        ),
      );
    },
  );
}
