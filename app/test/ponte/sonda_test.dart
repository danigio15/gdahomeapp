/// Le prove della sonda.
///
/// La sonda e' il pezzo che fa funzionare l'app fuori casa senza che l'utente
/// tocchi niente. Le prove qui non toccano la rete: la bussata e' sostituita,
/// e quello che si guarda e' **come si sceglie**, non come si bussa.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/casa_conosciuta.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/sonda.dart';

final inRete = IndirizzoDelPonte.leggi('192.168.1.50')!;
final daFuori = IndirizzoDelPonte.leggi('https://casa.esempio.it')!;

CasaConosciuta casaCon({
  IndirizzoDelPonte? dentro,
  IndirizzoDelPonte? fuori,
  DaDove? ultimo,
}) => CasaConosciuta(
  id: 'x',
  nome: 'Casa',
  segno: 's',
  inCasa: dentro,
  daFuoriCasa: fuori,
  ultimoApprodo: ultimo,
);

/// Una bussata che risponde solo a certi indirizzi, e ci mette il tempo che
/// le si dice.
Sonda sondaChe(
  Map<IndirizzoDelPonte, bool> chi, {
  Map<IndirizzoDelPonte, Duration> lenti = const {},
  List<IndirizzoDelPonte>? bussate,
}) => Sonda(
  attesa: const Duration(milliseconds: 200),
  bussa: (dove) async {
    bussate?.add(dove);
    final quanto = lenti[dove];
    if (quanto != null) await Future<void>.delayed(quanto);
    return chi[dove] ?? false;
  },
);

void main() {
  test('in casa si entra dall\'indirizzo di rete locale', () async {
    final sonda = sondaChe({inRete: true, daFuori: false});
    final approdo = await sonda.dove(casaCon(dentro: inRete, fuori: daFuori));

    expect(approdo.da, DaDove.daDentro);
    expect(approdo.dove, inRete);
  });

  test('fuori casa si entra dall\'indirizzo pubblico, stessa casa', () async {
    final sonda = sondaChe({inRete: false, daFuori: true});
    final approdo = await sonda.dove(casaCon(dentro: inRete, fuori: daFuori));

    expect(approdo.da, DaDove.daFuori);
    expect(approdo.dove, daFuori);
  });

  test(
    'si chiedono tutti e due insieme: il lento non fa aspettare il pronto',
    () async {
      /* Se andassero in fila, l'indirizzo di rete locale che non risponde
     * costerebbe l'attesa intera prima di provare quello di fuori — e la
     * costerebbe a ogni apertura dell'app mentre si e' fuori. */
      final sonda = sondaChe(
        {inRete: false, daFuori: true},
        lenti: {inRete: const Duration(milliseconds: 150)},
      );

      final inizio = DateTime.now();
      final approdo = await sonda.dove(casaCon(dentro: inRete, fuori: daFuori));
      final quanto = DateTime.now().difference(inizio);

      expect(approdo.da, DaDove.daFuori);
      expect(
        quanto.inMilliseconds,
        lessThan(120),
        reason: 'non ha aspettato il lento',
      );
    },
  );

  test('si prova per primo quello che ha funzionato l\'ultima volta', () async {
    final bussate = <IndirizzoDelPonte>[];
    final sonda = sondaChe(
      {inRete: true, daFuori: true},
      lenti: {inRete: const Duration(milliseconds: 40)},
      bussate: bussate,
    );

    final approdo = await sonda.dove(
      casaCon(dentro: inRete, fuori: daFuori, ultimo: DaDove.daFuori),
    );

    expect(approdo.da, DaDove.daFuori);
    expect(
      bussate.first,
      daFuori,
      reason: 'il primo a cui si bussa e\' l\'ultimo che funzionava',
    );
  });

  test(
    'un indirizzo che non risponde entro l\'attesa vale come assente',
    () async {
      final sonda = sondaChe(
        {inRete: true, daFuori: true},
        lenti: {inRete: const Duration(seconds: 5)},
      );

      final approdo = await sonda.dove(casaCon(dentro: inRete, fuori: daFuori));
      expect(approdo.da, DaDove.daFuori);
    },
  );

  test('se non risponde nessuno lo dice, e dice anche perche\'', () async {
    final sonda = sondaChe({inRete: false, daFuori: false});
    await expectLater(
      sonda.dove(casaCon(dentro: inRete, fuori: daFuori)),
      throwsA(
        isA<PonteIrraggiungibile>().having(
          (e) => e.spiegazione,
          'spiegazione',
          contains('ne\' in casa ne\' da fuori'),
        ),
      ),
    );
  });

  test('a chi ha solo l\'indirizzo di casa si dice cosa gli manca', () async {
    final sonda = sondaChe({inRete: false});
    await expectLater(
      sonda.dove(casaCon(dentro: inRete)),
      throwsA(
        isA<PonteIrraggiungibile>().having(
          (e) => e.spiegazione,
          'spiegazione',
          contains('indirizzo pubblico'),
        ),
      ),
    );
  });

  test('una casa senza nessun indirizzo lo dice subito', () async {
    final sonda = sondaChe({});
    await expectLater(
      sonda.dove(casaCon()),
      throwsA(isA<PonteIrraggiungibile>()),
    );
  });

  test('a chi ha messo l\'accesso remoto di Home Assistant si dice la verita\'', () async {
    /* E' l'errore che fa perdere piu' tempo di tutti: quell'indirizzo *sembra*
     * giusto — e' quello che Home Assistant stessa da' — e chi lo mette va a
     * cercare il guasto nella rete, nel router, nel telefono. Il guasto non
     * c'e': quel tunnel arriva a Home Assistant e si ferma li'. */
    final nabuCasa = IndirizzoDelPonte.leggi('https://abc123.ui.nabu.casa')!;
    expect(nabuCasa.eLAccessoRemotoDiHomeAssistant, isTrue);
    expect(inRete.eLAccessoRemotoDiHomeAssistant, isFalse);
    expect(daFuori.eLAccessoRemotoDiHomeAssistant, isFalse);

    final sonda = sondaChe({inRete: false, nabuCasa: false});
    await expectLater(
      sonda.dove(casaCon(dentro: inRete, fuori: nabuCasa)),
      throwsA(
        isA<PonteIrraggiungibile>().having(
          (e) => e.spiegazione,
          'spiegazione',
          allOf(contains('non arriva agli add-on'), contains('VPN')),
        ),
      ),
    );
  });

  test(
    'una bussata che esplode vale come «non risponde», non come guasto',
    () async {
      final sonda = Sonda(
        attesa: const Duration(milliseconds: 200),
        bussa: (dove) async {
          if (dove == inRete) throw StateError('la rete non c\'e\'');
          return true;
        },
      );
      final approdo = await sonda.dove(casaCon(dentro: inRete, fuori: daFuori));
      expect(approdo.da, DaDove.daFuori);
    },
  );
}
