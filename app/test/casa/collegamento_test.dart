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

  test('senza case non c\'è niente da aprire', () async {
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
    /* Le entita' si leggono quando servono, non all'apertura. */
    expect(collegamento.stato!.pieno, isFalse);
    await collegamento.serveLaCasa();
    expect(collegamento.stato!.quante, 1);
    expect(collegamento.stato!['light.cucina']!.accesa, isTrue);
    await ponte.spegni();
  });

  test(
    'fuori casa si entra dall\'altro indirizzo, e la casa è la stessa',
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

  test('in casa non si passa più dalla strada lunga: se la fa dire', () async {
    /* «Compare fuori casa quando in realtà sono in wifi e sono in casa.»
     *
     * L'indirizzo di casa il telefono lo sentiva dire una volta sola, dentro
     * il QR code, e non lo rinfrescava mai piu': chi abbina stando fuori non
     * ne sente nessuno, e chi l'ha abbinata in casa se lo tiene anche dopo
     * che il router, a un riavvio, gliene ha dato un altro. Poi si torna a
     * casa e si continua a fare il giro lungo — funziona, e si sente.
     *
     * Qui: due ponti, che sono la stessa casa vista da due strade. Quello di
     * casa sta su un indirizzo che l'app non conosce — quello che ha in
     * archivio non risponde piu', com'e' dopo un riavvio del router — e la
     * strada lunga risponde, come risponde sempre. */
    final inCasa = await PonteFinto.alza();
    final laStradaLunga = await PonteFinto.alza();
    laStradaLunga.indirizziDiCasa = [inCasa.indirizzo];
    final vecchio = IndirizzoDelPonte.leggi('192.168.99.99')!;
    final casa = await archivio.aggiungi(
      nome: 'Casa',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: vecchio,
      daFuoriCasa: laStradaLunga.indirizzo,
    );

    /* La strada lunga risponde, ma con calma: e' la differenza vera fra un
     * giro per il mondo e due metri di Wi-Fi, ed e' quello che fa vincere la
     * strada corta appena si sa che c'e'. */
    collegamento = Collegamento(
      archivio: archivio,
      sonda: Sonda(
        attesa: const Duration(milliseconds: 400),
        vantaggio: const Duration(milliseconds: 40),
        bussa: (dove) async {
          if (dove == laStradaLunga.indirizzo.salute) {
            await Future<void>.delayed(const Duration(milliseconds: 150));
            return true;
          }
          return dove == inCasa.indirizzo.salute;
        },
      ),
    );
    await collegamento.apri();
    expect(
      collegamento.daDove,
      DaDove.daFuori,
      reason: 'l\'indirizzo che aveva non risponde più',
    );

    /* Adesso: la domanda sul filo, la bussata all'indirizzo che la casa ha
     * detto, e il filo riaperto da dentro. */
    await _finoA(
      () =>
          collegamento.daDove == DaDove.daDentro &&
          collegamento.comeVa == ComeVa.aperta,
    );
    expect(
      archivio.quella(casa.id)!.inCasa?.toString(),
      inCasa.indirizzo.toString(),
      reason: 'l\'indirizzo nuovo se lo tiene',
    );
    expect(collegamento.dentro, isTrue);
    await inCasa.spegni();
    await laStradaLunga.spegni();
  });

  test('un ponte che non sa dire dove sta non cambia niente', () async {
    /* Un add-on di prima quel comando non lo conosce: si resta dove si e', e
     * quello che si sapeva non si cancella. */
    final ponte = await PonteFinto.alza();
    ponte.indirizziDiCasa = null;
    final casa = await archivio.aggiungi(
      nome: 'Casa',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      daFuoriCasa: ponte.indirizzo,
    );

    collegamento = Collegamento(
      archivio: archivio,
      sonda: sondaChe({ponte.indirizzo}),
    );
    await collegamento.apri();
    await Future<void>.delayed(const Duration(milliseconds: 120));

    expect(collegamento.daDove, DaDove.daFuori);
    expect(archivio.quella(casa.id)!.inCasa, isNull);
    await ponte.spegni();
  });

  test(
    'dove si è entrati si ricorda, per provarlo per primo la volta dopo',
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
      await collegamento.serveLaCasa();
      expect(collegamento.casa!.nome, 'Casa mia');
      expect(collegamento.stato!.quante, 1);
      expect(mia.prese.length, 1);

      await collegamento.cambiaCasa(casaLoro.id);
      await collegamento.serveLaCasa();
      expect(collegamento.casa!.nome, 'Dai miei');
      expect(collegamento.stato!.quante, 2);
      expect(collegamento.stato!['light.salotto'], isNotNull);
      expect(
        collegamento.stato!['light.cucina'],
        isNull,
        reason: 'la casa di prima è sparita',
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

  test('a riposo il filo si chiude, e al risveglio torna', () async {
    /* Con l'app non davanti — il telefono in tasca, la scheda del browser
     * dietro le altre — la casa continuava a mandare i suoi eventi, e da
     * fuori ognuno e' una richiesta che il centralino fa pagare. Ore di
     * eventi che nessuno guardava. Adesso il filo si chiude, e torna appena
     * si torna a guardare. */
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
    expect(collegamento.dentro, isTrue);
    expect(ponte.prese, hasLength(1));

    await collegamento.riposa();
    expect(collegamento.aRiposo, isTrue);
    expect(collegamento.dentro, isFalse);
    /* Il ponte se ne accorge: la presa non c'e' piu', e con lei il filo che
     * teneva aperto con Home Assistant. */
    await _finoA(() => ponte.prese.isEmpty);

    /* E non riprova da solo: aspetta che qualcuno torni a guardare. Se
     * riprovasse, il risparmio sarebbe finto. */
    await Future<void>.delayed(const Duration(milliseconds: 300));
    expect(ponte.prese, isEmpty);

    collegamento.sveglia();
    await _finoA(() => collegamento.dentro, entro: const Duration(seconds: 5));
    expect(collegamento.aRiposo, isFalse);
    expect(ponte.prese, hasLength(1));
    await ponte.spegni();
  });

  test('quando il filo torna su da solo, l\'app se ne accorge', () async {
    /* Il difetto si vedeva solo dalla seconda volta in poi: la prima ci
     * pensa l'apertura, e dalla seconda nessuno rimetteva lo stato a posto.
     * L'app restava a «sto cercando la casa» su un filo che intanto
     * funzionava — la plancia dentro il riquadro andava, e la riga sopra
     * diceva di no. */
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

    /* La casa chiude il filo: si dice che si sta ricollegando. */
    for (final presa in [...ponte.prese]) {
      await presa.chiudi();
    }
    await _finoA(() => collegamento.comeVa == ComeVa.inCammino);
    expect(collegamento.comeVa, ComeVa.inCammino);

    /* E quando il filo si rialza da solo, si torna aperti. */
    await _finoA(
      () => collegamento.comeVa == ComeVa.aperta,
      entro: const Duration(seconds: 10),
    );
    expect(collegamento.dentro, isTrue);

    await collegamento.chiudi();
    await ponte.spegni();
  });

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
     * ed e' un QR code da inquadrare. */
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
    expect(collegamento.perche, contains('va riabbinata'));
    expect(
      bussate,
      isEmpty,
      reason: 'non si bussa con una chiave che non c\'è',
    );
    await ponte.spegni();
  });

  test('la plancia scelta si ricorda, e si ricorda per casa', () async {
    final ponte = await PonteFinto.alza();
    ponte.unaPlanciaInPiu('Casa al mare');
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

    /* Chi non ha mai scelto niente apre la prima: e' la risposta di sempre,
     * e chi ha aggiornato l'app non si accorge di niente. */
    expect(collegamento.plance, hasLength(2));
    expect(collegamento.planciaScelta, 'primary');
    expect(collegamento.pannello!.piuDiUna, isTrue);

    await collegamento.cambiaPlancia('casa-al-mare');
    expect(collegamento.planciaScelta, 'casa-al-mare');
    expect(collegamento.pannello!.titolo, 'Casa al mare');
    /* Ricordata **nella casa**, non fra le impostazioni dell'app: chi ha una
     * plancia al mare e una in citta' non vuole che cambiando casa gli resti
     * quella di prima. */
    final id = collegamento.casa!.id;
    expect(archivio.quella(id)!.plancia, 'casa-al-mare');

    /* E si riapre su quella. */
    await collegamento.chiudi();
    collegamento = Collegamento(
      archivio: archivio,
      sonda: sondaChe({ponte.indirizzo}),
    );
    await collegamento.apri();
    await _finoA(() => collegamento.pannelloLetto);
    expect(collegamento.planciaScelta, 'casa-al-mare');

    /* Tornare alla prima non lascia niente scritto: se no, il giorno che
     * quella plancia non c'e' piu' si chiederebbe per sempre una cosa che
     * non esiste. */
    await collegamento.cambiaPlancia('primary');
    expect(collegamento.planciaScelta, 'primary');
    expect(archivio.quella(id)!.plancia, isNull);

    await ponte.spegni();
  });

  test('una plancia tolta da un altro telefono non blocca l\'app', () async {
    final ponte = await PonteFinto.alza();
    ponte.unaPlanciaInPiu('Casa al mare');
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
    await collegamento.cambiaPlancia('casa-al-mare');
    final id = collegamento.casa!.id;
    expect(archivio.quella(id)!.plancia, 'casa-al-mare');

    /* Adesso quella plancia non c'e' piu'. Si riapre l'app. */
    ponte.plance.removeWhere((una) => una['profilo'] == 'casa-al-mare');
    await collegamento.chiudi();
    collegamento = Collegamento(
      archivio: archivio,
      sonda: sondaChe({ponte.indirizzo}),
    );
    await collegamento.apri();
    await _finoA(() => collegamento.pannelloLetto);

    /* Si apre la prima, e non una schermata vuota. */
    expect(collegamento.pannello, isNotNull);
    expect(collegamento.planciaScelta, 'primary');
    expect(collegamento.plance, hasLength(1));

    await ponte.spegni();
  });
  test('togliere il permesso vale subito, senza riaprire l\'app', () async {
    /* Il cancello si e' visto valere «solo alla prossima apertura da zero»,
       * e non bastava: l'app chiedeva la plancia una volta e poi la teneva,
       * anche quando il filo cadeva e tornava — che e' quello che fa un
       * add-on quando si aggiorna. Chi perdeva il permesso continuava a
       * vedere la plancia. */
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
    await _finoA(() => collegamento.pannelloLetto);
    expect(collegamento.pannello, isNotNull, reason: 'prima la vedeva');

    /* Adesso quella plancia non e' piu' sua. */
    ponte.nientePerTe = true;
    await ponte.buttaGiu();
    await _finoA(() => collegamento.nessunaPlanciaPerMe);

    expect(collegamento.pannello, isNull, reason: 'e non la vede più');
    await ponte.spegni();
  });

  test(
    'se non ci sono plance per questa utenza, il collegamento lo dice',
    () async {
      /* La casa e' aperta, le entita' ci sono, e la plancia no: non perche'
       * manchi, ma perche' e' di un altro. Sono due cose diverse e la
       * schermata le dice in due modi diversi, percio' il collegamento le
       * tiene separate. */
      final ponte = await PonteFinto.alza();
      await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: ponte.indirizzo,
      );
      ponte.nientePerTe = true;

      collegamento = Collegamento(
        archivio: archivio,
        sonda: sondaChe({ponte.indirizzo}),
      );
      await collegamento.apri();
      await collegamento.rileggiLaPlancia();

      expect(collegamento.comeVa, ComeVa.aperta, reason: 'la casa è aperta');
      expect(collegamento.pannello, isNull);
      expect(collegamento.nessunaPlanciaPerMe, isTrue);
      await ponte.spegni();
    },
  );
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
  throw StateError('l\'attesa è scaduta');
}
