/// Le prove della console: la coda di tutte le case, vista dall'app.
///
/// Quello che conta qui sono due cose che, sbagliate, non si vedono subito:
///
/// - in una casa qualunque la console **non c'e'**, e non e' un comando
///   sconosciuto: e' una porta che esiste e che li' non si apre;
/// - guardando un filo dall'altra parte, «mio» si specchia. Nella chat il
///   fumetto a destra e' della casa; nella console e' della console, e
///   scambiarli vorrebbe dire leggere le proprie risposte come domande.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/console.dart';
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

  test('in una casa qualunque la console non c\'è', () async {
    final console = LaConsole(filo);
    expect(await console.cE(), isFalse);
    /* E chiederla lo stesso non finisce in una schermata vuota: il ponte dice
     * cos'e', e la schermata lo racconta. */
    await expectLater(
      console.coda(),
      throwsA(
        isA<ComandoRifiutato>().having(
          (uno) => uno.codice,
          'codice',
          'forbidden',
        ),
      ),
    );
  });

  test('la coda si apre, si legge un filo, si risponde, si butta', () async {
    ponte.laConsole = true;
    ponte.unaCasaChiedeAiuto(
      'casa_0123456789abcdef0123456789abcdef',
      'Le telecamere non partono.',
      nome: 'Giovanni',
    );
    final console = LaConsole(filo);
    expect(await console.cE(), isTrue);

    final coda = await console.coda();
    expect(coda, hasLength(1));
    expect(coda.single.comeSiChiama, 'Giovanni');
    expect(coda.single.nonLetti, 1);
    expect(coda.single.ultimo, 'Le telecamere non partono.');
    /* Le tre note arrivano insieme alle parole, e sono la meta' delle domande
     * che chi risponde farebbe per prime. */
    expect(coda.single.note, 'plancia 1.4.19 ponte 0.19.0 · it');
    expect(coda.single.ultimoIl, isNotNull);

    final linea = coda.single.id;
    final primo = await console.apri(linea);
    expect(primo.single.testo, 'Le telecamere non partono.');
    /* Il messaggio della casa qui **non** e' il mio: e' la domanda, e sta a
     * sinistra. */
    expect(primo.single.dallaCasa, isFalse);
    expect(primo.single.il, isNotNull);

    await console.rispondi(linea, 'Che modello sono?');
    final dopo = await console.apri(linea);
    expect(dopo, hasLength(2));
    expect(dopo.last.testo, 'Che modello sono?');
    expect(dopo.last.dallaCasa, isTrue, reason: 'la risposta è mia');

    /* Aperta vuol dire letta: il conto torna a zero. */
    expect((await console.coda()).single.nonLetti, 0);

    expect(await console.butta(linea), isTrue);
    expect(await console.coda(), isEmpty);
  });

  test('una linea senza nome si chiama col principio del suo segno', () async {
    ponte.laConsole = true;
    ponte.unaCasaChiedeAiuto(
      'casa_0123456789abcdef0123456789abcdef',
      'Buongiorno.',
    );
    final coda = await LaConsole(filo).coda();
    expect(coda.single.comeSiChiama, 'casa_01234567…');
  });
}
