/// Le prove della sonda: da dove si entra, adesso.
///
/// Sembrano prove su un dettaglio di rete. Sono prove su **quanto ci mette
/// l'app ad aprirsi**, che e' la prima cosa che si nota e l'ultima che si
/// riesce a spiegare: se qui si sbaglia, l'app «ci mette», e nessuno capisce
/// perche'.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/casa_conosciuta.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/sonda.dart';

final inRete = IndirizzoDelPonte.leggi('192.168.1.50')!;
final daFuori = IndirizzoDelPonte.leggi('https://casa.esempio.it')!;
final ilCentralino = IndirizzoDelCentralino.leggi(
  'wss://centralino.esempio.it',
)!;

const idAlCentralino = 'casa_00112233445566778899aabbccddeeff';

CasaConosciuta casaCon({
  IndirizzoDelPonte? dentro,
  IndirizzoDelPonte? fuori,
  IndirizzoDelCentralino? centralino,
  DaDove? ultimo,
}) => CasaConosciuta(
  id: 'x',
  nome: 'Casa',
  segno: 's',
  identificativo: 'dm_prova',
  chiave: 'c' * 64,
  casaAlCentralino: centralino == null ? null : idAlCentralino,
  centralino: centralino,
  inCasa: dentro,
  daFuoriCasa: fuori,
  ultimoApprodo: ultimo,
);

/// Una bussata che risponde solo a certi posti, e ci mette il tempo che le si
/// dice. Si scrivono gli indirizzi; la sonda bussa al loro `/salute`.
Sonda sondaChe(
  Map<Object, bool> chi, {
  Map<Object, Duration> lenti = const {},
  List<Uri>? bussate,
  Duration? vantaggio,
}) {
  Uri salute(Object dove) => switch (dove) {
    IndirizzoDelPonte ponte => ponte.salute,
    IndirizzoDelCentralino centralino => centralino.salute,
    _ => throw ArgumentError('non è un posto'),
  };
  final risposte = {
    for (final voce in chi.entries) salute(voce.key): voce.value,
  };
  final attese = {
    for (final voce in lenti.entries) salute(voce.key): voce.value,
  };

  return Sonda(
    attesa: const Duration(milliseconds: 200),
    vantaggio: vantaggio ?? const Duration(milliseconds: 60),
    bussa: (dove) async {
      bussate?.add(dove);
      final quanto = attese[dove];
      if (quanto != null) await Future<void>.delayed(quanto);
      return risposte[dove] ?? false;
    },
  );
}

void main() {
  leProveDelChiaro();
  test('in casa si entra dall\'indirizzo di rete locale', () async {
    final sonda = sondaChe({inRete: true, daFuori: false});
    final approdo = await sonda.dove(casaCon(dentro: inRete, fuori: daFuori));

    expect(approdo.da, DaDove.daDentro);
    expect(approdo.filo, inRete.filo);
  });

  test('fuori casa si entra dall\'indirizzo pubblico, stessa casa', () async {
    final sonda = sondaChe({inRete: false, daFuori: true});
    final approdo = await sonda.dove(casaCon(dentro: inRete, fuori: daFuori));

    expect(approdo.da, DaDove.daFuori);
    expect(approdo.filo, daFuori.filo);
  });

  test(
    'si chiedono tutti insieme: il lento non fa aspettare il pronto',
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
    final bussate = <Uri>[];
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
      daFuori.salute,
      reason: 'il primo a cui si bussa è l\'ultimo che funzionava',
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

  /* ─── Il centralino ─────────────────────────────────────────────────────── */

  group('il centralino', () {
    test(
      'da fuori si entra di lì, senza che nessuno abbia configurato niente',
      () async {
        final sonda = sondaChe({inRete: false, ilCentralino: true});
        final approdo = await sonda.dove(
          casaCon(dentro: inRete, centralino: ilCentralino),
        );

        expect(approdo.da, DaDove.dalCentralino);
        expect(
          approdo.filo,
          Uri.parse('wss://centralino.esempio.it/telefono/$idAlCentralino'),
        );
      },
    );

    test('in casa perde, anche se risponde per primo', () async {
      /* La prova che conta. Il centralino risponde sempre e in fretta: senza
       * il vantaggio alle strade dirette vincerebbe anche dal divano, e ogni
       * comando farebbe il giro del mondo per arrivare a tre metri. */
      final sonda = sondaChe(
        {inRete: true, ilCentralino: true},
        lenti: {inRete: const Duration(milliseconds: 25)},
      );
      final approdo = await sonda.dove(
        casaCon(dentro: inRete, centralino: ilCentralino),
      );

      expect(approdo.da, DaDove.daDentro);
    });

    test('a una strada diretta che tace non si resta appesi', () async {
      final sonda = sondaChe({inRete: false, ilCentralino: true});
      final approdo = await sonda.dove(
        casaCon(dentro: inRete, centralino: ilCentralino),
      );
      expect(approdo.da, DaDove.dalCentralino);
    });

    test('quando è l\'unica strada non aspetta nessun vantaggio', () async {
      final bussate = <Uri>[];
      final sonda = sondaChe(
        {ilCentralino: true},
        bussate: bussate,
        vantaggio: const Duration(seconds: 5),
      );

      final inizio = DateTime.now();
      final approdo = await sonda.dove(casaCon(centralino: ilCentralino));
      final quanto = DateTime.now().difference(inizio);

      expect(approdo.da, DaDove.dalCentralino);
      expect(quanto.inMilliseconds, lessThan(200));
      expect(bussate, [ilCentralino.salute]);
    });

    test('quando tace anche il centralino, lo si prova lo stesso', () async {
      /* La bussata serve a scegliere la strada, non a vietarla: un telefono
       * appena riacceso puo' non ricevere in tempo una risposta che
       * arriverebbe un secondo dopo. Provando, o si entra, o il no lo dice
       * chi lo sa — e il centralino sa dire «questa casa non e' collegata». */
      final sonda = sondaChe({inRete: false, ilCentralino: false});
      final approdo = await sonda.dove(
        casaCon(dentro: inRete, centralino: ilCentralino),
      );
      expect(approdo.da, DaDove.dalCentralino);
    });
  });

  /* ─── Quando non si trova ───────────────────────────────────────────────── */

  test('se non risponde nessuno lo dice, e dice anche perché', () async {
    final sonda = sondaChe({inRete: false, daFuori: false});
    await expectLater(
      sonda.dove(casaCon(dentro: inRete, fuori: daFuori)),
      throwsA(
        isA<PonteIrraggiungibile>().having(
          (e) => e.spiegazione,
          'spiegazione',
          contains('né in casa né da fuori'),
        ),
      ),
    );
  });

  test('a chi ha solo l\'indirizzo di casa si dice cosa gli manca', () async {
    /* «Metti un indirizzo pubblico» sarebbe la risposta sbagliata: adesso non
     * serve piu' a nessuno. Quello che manca e' un centralino nella scheda del
     * ponte, e va detto dove sta. */
    final sonda = sondaChe({inRete: false});
    await expectLater(
      sonda.dove(casaCon(dentro: inRete)),
      throwsA(
        isA<PonteIrraggiungibile>().having(
          (e) => e.spiegazione,
          'spiegazione',
          allOf(contains('solo dalla sua rete'), contains('centralino')),
        ),
      ),
    );
  });

  test('una casa senza nessuna strada lo dice subito', () async {
    final sonda = sondaChe({});
    await expectLater(
      sonda.dove(casaCon()),
      throwsA(isA<PonteIrraggiungibile>()),
    );
  });

  test('una casa abbinata prima delle chiavi si fa riabbinare', () async {
    const vecchia = CasaConosciuta(id: 'x', nome: 'Casa', segno: 's');
    expect(vecchia.daRiabbinare, isTrue);
    await expectLater(
      sondaChe({}).dove(vecchia),
      throwsA(
        isA<PonteIrraggiungibile>().having(
          (e) => e.spiegazione,
          'spiegazione',
          contains('riabbinata'),
        ),
      ),
    );
  });

  test('a chi ha messo l\'accesso remoto di Home Assistant si dice la verità', () async {
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
          allOf(contains('non arriva agli add-on'), contains('centralino')),
        ),
      ),
    );
  });

  test(
    'una bussata che esplode vale come «non risponde», non come guasto',
    () async {
      final sonda = Sonda(
        attesa: const Duration(milliseconds: 200),
        vantaggio: const Duration(milliseconds: 20),
        bussa: (dove) async {
          if (dove == inRete.salute) throw StateError('la rete non c\'è');
          return true;
        },
      );
      final approdo = await sonda.dove(casaCon(dentro: inRete, fuori: daFuori));
      expect(approdo.da, DaDove.daFuori);
    },
  );
}

/// Da una pagina cifrata non si bussa in chiaro.
///
/// «Il problema è il certificato, anche a me esce non sicuro» — e il
/// certificato era sano: Let's Encrypt, nomi giusti, scadenza lontana. Quello
/// che il browser diceva, nel suo pannello, era un'altra cosa: «questa pagina
/// include altre risorse che non sono sicure».
///
/// Erano le nostre. L'app aperta su `https://tramite.gdahome.org/app/` bussa a
/// tutti gli approdi insieme, e fra quelli c'è l'indirizzo di casa —
/// `http://192.168.…`, che hanno quasi tutti. Quella chiamata il browser non
/// la lascia passare (contenuto misto) e per tutta risposta marca la pagina
/// «non sicura» finché resta aperta, col lucchetto sbarrato.
///
/// Non era un tentativo andato male: era un tentativo **che non si poteva
/// fare**, e che si pagava col lucchetto. Sul telefono e sul computer non
/// cambia niente: quella regola è del browser.
void leProveDelChiaro() {
  group('da una pagina https si bussa solo dove si può', () {
    test('un indirizzo di casa in chiaro non è un approdo sicuro', () {
      final dentro = Approdo.diretto(DaDove.daDentro, inRete);
      expect(dentro.sicuro, isFalse);
      expect(dentro.filo.scheme, 'ws');
    });

    test('quello da fuori in https, e il centralino, lo sono', () {
      expect(Approdo.diretto(DaDove.daFuori, daFuori).sicuro, isTrue);
      expect(
        Approdo.dalCentralino(ilCentralino, idAlCentralino).sicuro,
        isTrue,
      );
    });

    test('chiedendo solo i sicuri, quello in chiaro resta fuori', () {
      final casa = casaCon(
        dentro: inRete,
        fuori: daFuori,
        centralino: ilCentralino,
      );
      expect(casa.approdi().length, 3, reason: 'sul telefono si provano tutti');
      final sicuri = casa.approdi(soloSicuri: true);
      expect(sicuri.length, 2);
      expect(
        sicuri.every((uno) => uno.da != DaDove.daDentro),
        isTrue,
        reason: 'è quello che il browser blocca, e che marca la pagina',
      );
    });

    test('una casa che si raggiunge solo in chiaro non ha strade sicure', () {
      final casa = casaCon(dentro: inRete);
      expect(casa.approdi(), hasLength(1));
      expect(casa.approdi(soloSicuri: true), isEmpty);
    });

    test('fuori dal browser la domanda non si pone', () {
      /* `inChiaroNonSiPuo` comincia da `kIsWeb`: nelle prove — che girano
       * sulla macchina virtuale di Dart, non in un browser — è falso, e gli
       * approdi si provano tutti. Se un domani qualcuno filtrasse sempre,
       * l'app sul telefono non troverebbe più la casa sotto il proprio
       * Wi-Fi. */
      expect(inChiaroNonSiPuo, isFalse);
    });
  });
}
