/// Le prove del collegamento: il pezzo che tiene insieme tutto.
///
/// Qui ci sono **due case finte accese insieme**, che e' l'unico modo di
/// provare davvero il cambio di istanza: che il filo della prima venga buttato
/// giu', che quello della seconda si apra, e che ognuna resti col suo segno.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/sonda.dart';

import '../ponte/ponte_finto.dart';

void main() {
  late CassaforteInMemoria cassaforte;
  late ArchivioDelleCase archivio;
  late Collegamento collegamento;

  setUp(() async {
    cassaforte = CassaforteInMemoria();
    archivio = ArchivioDelleCase(cassaforte);
    await archivio.apri();
  });

  tearDown(() async => collegamento.chiudi());

  /// Una sonda che risponde «si'» solo agli indirizzi che le si dicono.
  Sonda sondaChe(Set<IndirizzoDelPonte> vivi, {List<Uri>? bussate}) => Sonda(
    attesa: const Duration(milliseconds: 200),
    vantaggio: const Duration(milliseconds: 40),
    bussa: (dove) async {
      bussate?.add(dove);
      return vivi.any((uno) => uno.salute == dove);
    },
  );

  test('senza case non c\'e\' niente da aprire', () async {
    collegamento = Collegamento(archivio: archivio, sonda: sondaChe({}));
    await collegamento.apri();
    expect(collegamento.comeVa, ComeVa.nessunaCasa);
    expect(collegamento.casa, isNull);
  });

  test('la casa attiva si apre, e lo stato arriva', () async {
    final ponte = await PonteFinto.alza();
    await archivio.aggiungi(
      nome: 'Casa',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: ponte.indirizzo,
    );
    ponte.entita = [PonteFinto.unaEntita('light.cucina', 'on', nome: 'Cucina')];

    collegamento = Collegamento(
      archivio: archivio,
      sonda: sondaChe({ponte.indirizzo}),
    );
    await collegamento.apri();

    expect(collegamento.comeVa, ComeVa.aperta);
    expect(collegamento.dentro, isTrue);
    expect(collegamento.daDove, DaDove.daDentro);
    expect(collegamento.stato!.quante, 1);
    expect(collegamento.stato!['light.cucina']!.accesa, isTrue);
    await ponte.spegni();
  });

  test(
    'fuori casa si entra dall\'altro indirizzo, e la casa e\' la stessa',
    () async {
      /* Il ponte finto sta su un indirizzo solo; qui si finge che quello sia
     * l'indirizzo pubblico e che quello di rete locale non risponda — cioe'
     * esattamente la situazione di chi e' in ufficio. */
      final ponte = await PonteFinto.alza();
      final finto = IndirizzoDelPonte.leggi('192.168.99.99')!;
      await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: finto,
        daFuoriCasa: ponte.indirizzo,
      );

      collegamento = Collegamento(
        archivio: archivio,
        sonda: sondaChe({ponte.indirizzo}),
      );
      await collegamento.apri();

      expect(collegamento.comeVa, ComeVa.aperta);
      expect(collegamento.daDove, DaDove.daFuori);
      expect(collegamento.filo!.approdoAdesso!.filo, ponte.indirizzo.filo);
      await ponte.spegni();
    },
  );

  test(
    'dove si e\' entrati si ricorda, per provarlo per primo la volta dopo',
    () async {
      final ponte = await PonteFinto.alza();
      final finto = IndirizzoDelPonte.leggi('192.168.99.99')!;
      final casa = await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: finto,
        daFuoriCasa: ponte.indirizzo,
      );

      collegamento = Collegamento(
        archivio: archivio,
        sonda: sondaChe({ponte.indirizzo}),
      );
      await collegamento.apri();

      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(archivio.quella(casa.id)!.ultimoApprodo, DaDove.daFuori);
      await ponte.spegni();
    },
  );

  test(
    'si passa da una casa all\'altra: il primo filo cade, il secondo si apre',
    () async {
      final mia = await PonteFinto.alza();
      final loro = await PonteFinto.alza();
      mia.entita = [
        PonteFinto.unaEntita('light.cucina', 'on', nome: 'Cucina mia'),
      ];
      loro.entita = [
        PonteFinto.unaEntita('light.salotto', 'off', nome: 'Salotto loro'),
        PonteFinto.unaEntita('light.bagno', 'off', nome: 'Bagno loro'),
      ];

      final casaMia = await archivio.aggiungi(
        nome: 'Casa mia',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: mia.indirizzo,
      );
      final casaLoro = await archivio.aggiungi(
        nome: 'Dai miei',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: loro.indirizzo,
      );

      collegamento = Collegamento(
        archivio: archivio,
        sonda: sondaChe({mia.indirizzo, loro.indirizzo}),
      );

      await collegamento.cambiaCasa(casaMia.id);
      expect(collegamento.casa!.nome, 'Casa mia');
      expect(collegamento.stato!.quante, 1);
      expect(mia.prese.length, 1);

      await collegamento.cambiaCasa(casaLoro.id);
      expect(collegamento.casa!.nome, 'Dai miei');
      expect(collegamento.stato!.quante, 2);
      expect(collegamento.stato!['light.salotto'], isNotNull);
      expect(
        collegamento.stato!['light.cucina'],
        isNull,
        reason: 'la casa di prima e\' sparita',
      );

      /* Il filo della prima casa deve essere caduto: due fili aperti insieme
     * vorrebbero dire due sottoscrizioni vive e due case che arrivano
     * mescolate. */
      await _finoA(() => mia.prese.isEmpty);
      expect(archivio.attiva!.id, casaLoro.id);

      await mia.spegni();
      await loro.spegni();
    },
  );

  test('un segno rifiutato lo dice, e non finge di riprovare', () async {
    final ponte = await PonteFinto.alza();
    ponte.accettaIlSegno = false;
    await archivio.aggiungi(
      nome: 'Casa',
      segno: 'un segno vecchio',
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: ponte.indirizzo,
    );

    collegamento = Collegamento(
      archivio: archivio,
      sonda: sondaChe({ponte.indirizzo}),
    );
    await collegamento.apri();

    expect(collegamento.comeVa, ComeVa.segnoScaduto);
    expect(collegamento.perche, isNotNull);
    await ponte.spegni();
  });

  test(
    'una casa che non risponde lo dice, ma i tentativi vanno avanti',
    () async {
      final finto = IndirizzoDelPonte.leggi('192.168.99.99')!;
      await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: finto,
      );

      collegamento = Collegamento(archivio: archivio, sonda: sondaChe({}));
      await collegamento.apri();

      expect(collegamento.comeVa, ComeVa.irraggiungibile);
      expect(collegamento.perche, contains('solo dalla sua rete'));
    },
  );

  test('dimenticare la casa aperta apre quella che resta', () async {
    final uno = await PonteFinto.alza();
    final due = await PonteFinto.alza();
    final prima = await archivio.aggiungi(
      nome: 'Prima',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: uno.indirizzo,
    );
    final seconda = await archivio.aggiungi(
      nome: 'Seconda',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: due.indirizzo,
    );

    collegamento = Collegamento(
      archivio: archivio,
      sonda: sondaChe({uno.indirizzo, due.indirizzo}),
    );
    await collegamento.cambiaCasa(seconda.id);
    expect(collegamento.casa!.id, seconda.id);

    await collegamento.dimentica(seconda.id);
    expect(archivio.tutte.length, 1);
    expect(collegamento.casa!.id, prima.id);
    expect(collegamento.comeVa, ComeVa.aperta);

    await uno.spegni();
    await due.spegni();
  });

  test(
    'una casa senza nessuna strada si fa riabbinare, e non si bussa a vuoto',
    () async {
      /* Non e' «nessuna casa»: la casa nell'elenco c'e', e sparirebbe dallo
     * schermo senza spiegazioni. E non e' nemmeno «non raggiungibile», che
     * vorrebbe dire «riprova fra un po'»: qui non c'e' niente da riprovare,
     * non si sa piu' dove sia. L'unica cosa vera da dire e' che va riabbinata,
     * ed e' un quadretto da inquadrare. */
      await archivio.aggiungi(
        nome: 'Orfana',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
      );
      final bussate = <Uri>[];
      collegamento = Collegamento(
        archivio: archivio,
        sonda: sondaChe({}, bussate: bussate),
      );

      await collegamento.apri();

      expect(collegamento.comeVa, ComeVa.segnoScaduto);
      expect(collegamento.perche, contains('riabbinala'));
      expect(bussate, isEmpty);
    },
  );

  test('dove sta la plancia arriva dopo la casa', () async {
    final ponte = await PonteFinto.alza();
    await archivio.aggiungi(
      nome: 'Casa',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: ponte.indirizzo,
    );
    collegamento = Collegamento(
      archivio: archivio,
      sonda: sondaChe({ponte.indirizzo}),
    );

    await collegamento.apri();
    expect(collegamento.comeVa, ComeVa.aperta);
    await _finoA(() => collegamento.pannelloLetto);

    expect(collegamento.pannello, isNotNull);
    expect(collegamento.pannello!.base, '/dashboardmodern_static/ponte1234');
    expect(collegamento.pannello!.profilo, 'primary');
    expect(
      ponte.arrivati.where((m) => m['type'] == 'ponte/plancia'),
      hasLength(1),
    );

    /* Rileggerla — dopo un aggiornamento del ponte — chiede di nuovo, e
     * vede l'impronta nuova. */
    ponte.planciaDelPonte = PonteFinto.planciaNelPonte(
      base: '/dashboardmodern_static/def456',
    );
    await collegamento.rileggiLaPlancia();
    expect(collegamento.pannello!.base, '/dashboardmodern_static/def456');
    await ponte.spegni();
  });

  test('una casa senza plancia lo dice, e resta aperta', () async {
    final ponte = await PonteFinto.alza();
    ponte.planciaDelPonte = null;
    ponte.pannelli = null;
    await archivio.aggiungi(
      nome: 'Casa',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: ponte.indirizzo,
    );
    collegamento = Collegamento(
      archivio: archivio,
      sonda: sondaChe({ponte.indirizzo}),
    );

    await collegamento.apri();
    await _finoA(() => collegamento.pannelloLetto);

    expect(collegamento.comeVa, ComeVa.aperta);
    expect(collegamento.pannello, isNull);
    expect(collegamento.stato, isNotNull);
    await ponte.spegni();
  });

  test('una casa abbinata prima delle chiavi si fa riabbinare', () async {
    /* Il ponte adesso vuole la stretta di mano cifrata: una casa abbinata
     * prima non parla piu' con nessuno, e nasconderlo vorrebbe dire una
     * rotella che gira per sempre. */
    final ponte = await PonteFinto.alza();
    await archivio.aggiungi(
      nome: 'Vecchia',
      segno: segnoBuono,
      inCasa: ponte.indirizzo,
    );
    final bussate = <Uri>[];
    collegamento = Collegamento(
      archivio: archivio,
      sonda: sondaChe({ponte.indirizzo}, bussate: bussate),
    );

    await collegamento.apri();

    expect(collegamento.comeVa, ComeVa.segnoScaduto);
    expect(collegamento.perche, contains('riabbinala'));
    expect(
      bussate,
      isEmpty,
      reason: 'non si bussa con una chiave che non c\'e\'',
    );
    await ponte.spegni();
  });
}

Future<void> _finoA(
  bool Function() condizione, {
  Duration entro = const Duration(seconds: 3),
}) async {
  final fine = DateTime.now().add(entro);
  while (DateTime.now().isBefore(fine)) {
    if (condizione()) return;
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
  throw StateError('l\'attesa e\' scaduta');
}
