/// Le prove di gdahome Premium nell'app: chi lo e', cosa si apre, e cosa
/// la casa dice sul filo.
///
/// La regola che tiene tutto: **con la chiave vuota non cambia niente**.
/// Le altre si provano iniettando la chiave di prova del contratto.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/casa_conosciuta.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/licenza/licenza.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/menu.dart';

import '../ponte/ponte_finto.dart';
import 'gettoni_di_prova.dart';

CasaConosciuta unaCasa(
  String id, {
  String? gettone,
  String? casaAlCentralino = casaDiProva,
}) => CasaConosciuta(
  id: id,
  nome: id,
  segno: 'segno',
  casaAlCentralino: casaAlCentralino,
  gettone: gettone,
);

void main() {
  group('il gestore, senza filo', () {
    test('con la chiave vuota tutto è Premium, come prima', () async {
      final licenza = GestoreLicenza(chiave: '');
      await licenza.conosci([unaCasa('a', gettone: ''), unaCasa('b')]);
      licenza.inUso('a');
      expect(licenza.controlliAccesi, isFalse);
      expect(licenza.siVende, isFalse);
      expect(licenza.premium, isTrue);
      expect(licenza.almenoUnaPremium, isTrue);
      expect(licenza.siPuoAggiungereUnaCasa, isTrue);
      expect(licenza.stradeDaFuoriPer(unaCasa('a', gettone: '')), isTrue);
      expect(licenza.premiumQui.value, isTrue);
      expect(
        licenza.comeSta(unaCasa('a', gettone: '')),
        ComeStaLaLicenza.senzaControlli,
      );
    });

    test('prima dell\'iPhone, dove non contano non si chiude niente', () async {
      /* La chiave c'e', ma questo telefono non e' l'app per iPhone: niente
       * lucchetti, niente negozio, e Base non vuol dire niente. */
      final licenza = GestoreLicenza(chiave: chiaveDiProva, qui: false);
      await licenza.conosci([unaCasa('a', gettone: '')]);
      licenza.inUso('a');
      expect(licenza.controlliAccesi, isFalse);
      expect(licenza.siVende, isFalse);
      expect(licenza.premium, isTrue);
      expect(licenza.premiumQui.value, isTrue);
      expect(licenza.stradeDaFuoriPer(unaCasa('a', gettone: '')), isTrue);
      expect(
        licenza.comeSta(unaCasa('a', gettone: '')),
        ComeStaLaLicenza.senzaControlli,
      );
    });

    test('contano sempre, o solo nell\'app per iPhone', () {
      addTearDown(() => debugDefaultTargetPlatformOverride = null);
      expect(contanoQui(false), isTrue);
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      expect(contanoQui(true), isTrue);
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      expect(contanoQui(true), isFalse);
      /* Di serie la chiave e' vuota: in questa app oggi non contano. */
      expect(licenzeInQuestaApp, isFalse);
    });

    test('una casa che le licenze non le sa tenere resta aperta', () async {
      /* Il suo add-on e' di prima, o le ha spente: li' Premium non si puo'
       * comprare, e un lucchetto senza una chiave da comprare non si mette. */
      final licenza = GestoreLicenza(chiave: chiaveDiProva);
      final senza = unaCasa('a').con(senzaLicenze: true);
      final base = unaCasa('b', gettone: '');
      await licenza.conosci([senza, base]);
      licenza.inUso('a');
      expect(licenza.comeSta(senza), ComeStaLaLicenza.casaSenzaLicenze);
      expect(licenza.premium, isTrue);
      expect(licenza.stradeDaFuoriPer(senza), isTrue);
      /* Le altre restano quello che sono. */
      expect(licenza.premiumDi(base), isFalse);
      expect(licenza.stradeDaFuoriPer(base), isFalse);
    });

    test(
      'con una ricevuta da portare, da fuori si passa anche da Base',
      () async {
        /* Chi compra fuori casa deve poterla portare subito: la strada si apre
       * per quello, e il Premium lo dice poi la casa. */
        final licenza = GestoreLicenza(chiave: chiaveDiProva);
        final base = unaCasa('a', gettone: '');
        await licenza.conosci([base]);
        licenza.inUso('a');
        expect(licenza.stradeDaFuoriPer(base), isFalse);
        var avvisi = 0;
        licenza.addListener(() => avvisi += 1);
        licenza.ricevutaDaPortare = true;
        expect(avvisi, greaterThan(0));
        expect(licenza.stradeDaFuoriPer(base), isTrue);
        expect(licenza.premium, isFalse);
        licenza.ricevutaDaPortare = false;
        expect(licenza.stradeDaFuoriPer(base), isFalse);
        /* E Base forzata a mano resta chiusa: e' per vedere i lucchetti. */
        licenza
          ..forza = false
          ..ricevutaDaPortare = true;
        expect(licenza.stradeDaFuoriPer(base), isFalse);
      },
    );

    test('con la chiave, una casa senza gettone è Base', () async {
      final licenza = GestoreLicenza(chiave: chiaveDiProva);
      await licenza.conosci([unaCasa('a', gettone: '')]);
      licenza.inUso('a');
      expect(licenza.controlliAccesi, isTrue);
      expect(licenza.premium, isFalse);
      expect(licenza.premiumQui.value, isFalse);
      expect(licenza.almenoUnaPremium, isFalse);
      /* La prima casa si aggiunge sempre; la seconda no. */
      expect(licenza.siPuoAggiungereUnaCasa, isFalse);
      expect(licenza.stradeDaFuoriPer(unaCasa('a', gettone: '')), isFalse);
      expect(licenza.comeSta(unaCasa('a', gettone: '')), ComeStaLaLicenza.base);
    });

    test('con un gettone buono la casa è Premium, e lo sa gdanav', () async {
      final licenza = GestoreLicenza(chiave: chiaveDiProva);
      final gettone = await firmaUnGettone(origine: 'installatore');
      await licenza.conosci([
        unaCasa('a', gettone: gettone),
        unaCasa('b', gettone: ''),
      ]);
      licenza.inUso('b');
      expect(licenza.premium, isFalse);
      expect(licenza.almenoUnaPremium, isTrue);
      expect(licenza.siPuoAggiungereUnaCasa, isTrue);
      licenza.inUso('a');
      expect(licenza.premium, isTrue);
      expect(licenza.premiumQui.value, isTrue);
      expect(licenza.gettoneDi(licenza.casaInUso)!.origine, 'installatore');
    });

    test('il gettone di un\'altra casa non fa Premium questa', () async {
      final licenza = GestoreLicenza(chiave: chiaveDiProva);
      await licenza.conosci([
        unaCasa(
          'a',
          gettone: await firmaUnGettone(),
          casaAlCentralino: 'casa_ffffffffffffffffffffffffffffffff',
        ),
      ]);
      licenza.inUso('a');
      expect(licenza.premium, isFalse);
    });

    test('mai chiesto: da fuori si prova, poi decide la casa', () async {
      final licenza = GestoreLicenza(chiave: chiaveDiProva);
      final nuova = unaCasa('a');
      await licenza.conosci([nuova]);
      licenza.inUso('a');
      expect(licenza.premium, isFalse);
      expect(licenza.comeSta(nuova), ComeStaLaLicenza.maiChiesto);
      expect(licenza.stradeDaFuoriPer(nuova), isTrue);
    });

    test('il gettone scade da solo, ad app aperta', () async {
      var adesso = DateTime.now();
      final licenza = GestoreLicenza(
        chiave: chiaveDiProva,
        orologio: () => adesso,
      );
      await licenza.conosci([unaCasa('a', gettone: await firmaUnGettone())]);
      licenza.inUso('a');
      expect(licenza.premium, isTrue);
      adesso = adesso.add(const Duration(days: 8));
      expect(licenza.premium, isFalse);
      licenza.dispose();
    });

    test('forzato: vince sulla chiave, in tutti e due i sensi', () async {
      final licenza = GestoreLicenza(chiave: '', forza: false);
      await licenza.conosci([unaCasa('a', gettone: '')]);
      licenza.inUso('a');
      /* Senza chiave, ma coi lucchetti: e' il modo di vederli. */
      expect(licenza.controlliAccesi, isTrue);
      expect(licenza.siVende, isTrue);
      expect(licenza.premium, isFalse);
      expect(licenza.stradeDaFuoriPer(unaCasa('a')), isFalse);
      licenza.forza = true;
      expect(licenza.controlliAccesi, isFalse);
      expect(licenza.premium, isTrue);
      expect(licenza.premiumQui.value, isTrue);
    });

    test('la voce «gdahome Premium» c\'è solo quando si vende', () {
      expect(vociDellaBarra(), isNot(contains(Sezione.premium)));
      expect(vociDellaBarra(conPremium: true), contains(Sezione.premium));
      expect(Sezione.premium.titolo, 'gdahome Premium');
    });

    test('il codice regalo si scrive come si vuole', () {
      expect(codicePulito('gda abcd efgh jkmn'), 'GDA-ABCD-EFGH-JKMN');
      expect(codicePulito('ABCDEFGHJKMN'), 'GDA-ABCD-EFGH-JKMN');
      expect(codiceBenFatto('GDA-ABCD-EFGH-JKMN'), isTrue);
      /* La I e la O non ci sono: si confondono con 1 e 0. */
      expect(codiceBenFatto('GDA-ABCD-EFGH-IJKO'), isFalse);
      expect(codiceBenFatto('GDA-ABC'), isFalse);
    });
  });

  group('l\'archivio', () {
    test('un archivio di prima delle licenze si apre uguale', () async {
      final cassaforte = CassaforteInMemoria();
      await cassaforte.scrivi(
        'le_case',
        jsonEncode({
          'case': [
            {
              'id': 'uno',
              'nome': 'Casa',
              'segno': 'segno',
              'identificativo': 'dm_x',
              'chiave': 'k',
              'in_casa': 'http://192.168.1.50:8765',
            },
          ],
          'attiva': 'uno',
        }),
      );
      final archivio = ArchivioDelleCase(cassaforte);
      await archivio.apri();
      expect(archivio.attiva!.nome, 'Casa');
      /* Mai chiesto, che e' la verita'. */
      expect(archivio.attiva!.gettone, isNull);
    });

    test(
      'il gettone si ricorda per casa, e resta dopo la riapertura',
      () async {
        final cassaforte = CassaforteInMemoria();
        final archivio = ArchivioDelleCase(cassaforte);
        await archivio.apri();
        final casa = await archivio.aggiungi(nome: 'Casa', segno: 'segno');
        await archivio.segnaIlGettone(casa.id, 'abc.def');
        final riaperto = ArchivioDelleCase(cassaforte);
        await riaperto.apri();
        expect(riaperto.attiva!.gettone, 'abc.def');
        /* Vuoto e' diverso da mai chiesto. */
        await riaperto.segnaIlGettone(casa.id, '');
        final ancora = ArchivioDelleCase(cassaforte);
        await ancora.apri();
        expect(ancora.attiva!.gettone, '');
      },
    );

    test(
      '«senza licenze» si ricorda, e la prima risposta vera lo toglie',
      () async {
        final cassaforte = CassaforteInMemoria();
        final archivio = ArchivioDelleCase(cassaforte);
        await archivio.apri();
        final casa = await archivio.aggiungi(nome: 'Casa', segno: 'segno');
        await archivio.segnaIlGettone(casa.id, 'abc.def');
        await archivio.segnaSenzaLicenze(casa.id);
        final riaperto = ArchivioDelleCase(cassaforte);
        await riaperto.apri();
        expect(riaperto.attiva!.senzaLicenze, isTrue);
        /* Il gettone di prima non lo rinnova piu' nessuno: mai chiesto. */
        expect(riaperto.attiva!.gettone, isNull);
        /* L'add-on si aggiorna e risponde, anche senza gettone: le licenze
       * adesso le sa tenere. */
        await riaperto.segnaIlGettone(casa.id, '');
        final ancora = ArchivioDelleCase(cassaforte);
        await ancora.apri();
        expect(ancora.attiva!.senzaLicenze, isFalse);
        expect(ancora.attiva!.gettone, '');
      },
    );
  });

  group('sul filo', () {
    late ArchivioDelleCase archivio;
    late Collegamento collegamento;
    late PonteFinto ponte;

    setUp(() async {
      archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      ponte = await PonteFinto.alza();
    });

    tearDown(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });

    Sonda sondaChe(Set<IndirizzoDelPonte> vivi, {List<Uri>? bussate}) => Sonda(
      attesa: const Duration(milliseconds: 200),
      vantaggio: const Duration(milliseconds: 40),
      bussa: (dove) async {
        bussate?.add(dove);
        return vivi.any((uno) => uno.salute == dove);
      },
    );

    Future<void> aspetta(bool Function() finche) async {
      for (var i = 0; i < 100 && !finche(); i += 1) {
        await Future<void>.delayed(const Duration(milliseconds: 20));
      }
    }

    test('con la chiave vuota non si chiede niente alla casa', () async {
      ponte.licenza = {'gettoni': <String, String>{}};
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
        licenza: GestoreLicenza(chiave: ''),
      );
      await collegamento.apri();
      await Future<void>.delayed(const Duration(milliseconds: 200));
      expect(
        ponte.chieste.where((una) => una['type'] == 'ponte/licenza/stato'),
        isEmpty,
      );
      expect(collegamento.licenza.premium, isTrue);
    });

    test('prima dell\'iPhone, sull\'Android alla casa non si chiede', () async {
      ponte.licenza = {'gettoni': <String, String>{}};
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
        licenza: GestoreLicenza(chiave: chiaveDiProva, qui: false),
      );
      await collegamento.apri();
      await Future<void>.delayed(const Duration(milliseconds: 200));
      expect(
        ponte.chieste.where((una) => una['type'] == 'ponte/licenza/stato'),
        isEmpty,
      );
      expect(collegamento.licenza.premium, isTrue);
    });

    for (final (come, risponde) in [
      ('un add-on di prima delle licenze', null),
      (
        'un add-on con le licenze spente',
        <String, dynamic>{'attive': false, 'gettoni': <String, String>{}},
      ),
    ]) {
      test('$come: si ricorda, e la casa non si chiude', () async {
        ponte.licenza = risponde;
        final casa = await archivio.aggiungi(
          nome: 'Casa',
          segno: segnoBuono,
          identificativo: chiBuono,
          chiave: chiaveBuona,
          inCasa: ponte.indirizzo,
        );
        collegamento = Collegamento(
          archivio: archivio,
          sonda: sondaChe({ponte.indirizzo}),
          licenza: GestoreLicenza(chiave: chiaveDiProva),
        );
        await collegamento.apri();
        await aspetta(() => archivio.quella(casa.id)!.senzaLicenze);
        expect(archivio.quella(casa.id)!.senzaLicenze, isTrue);
        expect(collegamento.licenza.premium, isTrue);
        expect(
          collegamento.licenza.comeSta(archivio.quella(casa.id)),
          ComeStaLaLicenza.casaSenzaLicenze,
        );
      });
    }

    test('una ricevuta comprata fuori casa, con Base, apre la strada del '
        'centralino', () async {
      final centralino = IndirizzoDelCentralino.leggi(
        'wss://centralino.esempio.it',
      )!;
      final casa = await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        casaAlCentralino: casaDiProva,
        centralino: centralino,
        inCasa: IndirizzoDelPonte.leggi('192.168.1.50')!,
      );
      await archivio.segnaIlGettone(casa.id, '');
      collegamento = Collegamento(
        archivio: archivio,
        sonda: sondaChe({}),
        licenza: GestoreLicenza(chiave: chiaveDiProva),
        /* Il centralino di prova non risponde: si aspetta poco. */
        attesaPerLaRicevuta: const Duration(milliseconds: 300),
      );
      await collegamento.apri();
      expect(collegamento.fuoriCasaSenzaPremium, isTrue);
      /* La ricevuta arriva mentre la casa non c'e': non si perde — resta al
       * negozio e si riprova — e intanto si bussa da fuori per portarla. */
      await expectLater(
        collegamento.mandaLaRicevuta(
          piattaforma: 'ios',
          prodotto: 'gdahome_premium_mensile',
          ricevuta: '2000000123456789',
        ),
        throwsA(
          isA<LicenzaRifiutata>().having(
            (no) => no.definitiva,
            'definitiva',
            false,
          ),
        ),
      );
      expect(collegamento.licenza.ricevutaDaPortare, isTrue);
      await aspetta(() => !collegamento.fuoriCasaSenzaPremium);
      expect(collegamento.fuoriCasaSenzaPremium, isFalse);
    });

    test('a ogni collegamento si chiede, e il gettone resta', () async {
      final gettone = await firmaUnGettone();
      ponte.licenza = {
        'gdahome': {'attiva': true, 'scade': null, 'origine': 'negozio'},
        'gettoni': {'gdahome': gettone},
      };
      final casa = await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        casaAlCentralino: casaDiProva,
        inCasa: ponte.indirizzo,
      );
      collegamento = Collegamento(
        archivio: archivio,
        sonda: sondaChe({ponte.indirizzo}),
        licenza: GestoreLicenza(chiave: chiaveDiProva),
      );
      await collegamento.apri();
      await aspetta(() => collegamento.licenza.premium);
      expect(collegamento.licenza.premium, isTrue);
      expect(archivio.quella(casa.id)!.gettone, gettone);
      expect(collegamento.licenza.premiumQui.value, isTrue);
    });

    test('senza Premium, da fuori non si bussa al centralino', () async {
      final bussate = <Uri>[];
      final centralino = IndirizzoDelCentralino.leggi(
        'wss://centralino.esempio.it',
      )!;
      final inCasa = IndirizzoDelPonte.leggi('192.168.1.50')!;
      final casa = await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        casaAlCentralino: casaDiProva,
        centralino: centralino,
        inCasa: inCasa,
      );
      /* Si sa gia' che non e' Premium: chiesto l'ultima volta, niente. */
      await archivio.segnaIlGettone(casa.id, '');
      collegamento = Collegamento(
        archivio: archivio,
        /* Nessuno risponde: si e' fuori casa. */
        sonda: sondaChe({}, bussate: bussate),
        licenza: GestoreLicenza(chiave: chiaveDiProva),
      );
      await collegamento.apri();
      expect(collegamento.comeVa, ComeVa.irraggiungibile);
      expect(collegamento.fuoriCasaSenzaPremium, isTrue);
      expect(collegamento.perche, contains('Premium'));
      expect(bussate, isNotEmpty);
      expect(
        bussate.every((una) => una.host == '192.168.1.50'),
        isTrue,
        reason: 'si è bussato altrove: $bussate',
      );
    });

    test('le plance oltre la principale non si aprono senza Premium', () async {
      ponte.licenza = {'gettoni': <String, String>{}};
      ponte.unaPlanciaInPiu('Al mare', profilo: 'mare');
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
        licenza: GestoreLicenza(chiave: chiaveDiProva),
      );
      await collegamento.apri();
      await aspetta(
        () => archivio.attiva?.gettone != null && collegamento.pannelloLetto,
      );
      final mare = collegamento.plance.firstWhere((p) => p.profilo == 'mare');
      expect(collegamento.siPuoAprire(mare), isFalse);
      await collegamento.cambiaPlancia('mare');
      expect(collegamento.planciaScelta, isNot('mare'));
    });

    test(
      'un codice regalo fa la casa Premium, uno sbagliato lo dice',
      () async {
        ponte.licenza = {'gettoni': <String, String>{}};
        ponte.codiciRegalo = {'GDA-ABCD-EFGH-JKMN': await firmaUnGettone()};
        await archivio.aggiungi(
          nome: 'Casa',
          segno: segnoBuono,
          identificativo: chiBuono,
          chiave: chiaveBuona,
          casaAlCentralino: casaDiProva,
          inCasa: ponte.indirizzo,
        );
        collegamento = Collegamento(
          archivio: archivio,
          sonda: sondaChe({ponte.indirizzo}),
          licenza: GestoreLicenza(chiave: chiaveDiProva),
        );
        await collegamento.apri();
        await aspetta(() => archivio.attiva?.gettone != null);
        expect(collegamento.licenza.premium, isFalse);
        await expectLater(
          collegamento.riscatta('GDA-ZZZZ-ZZZZ-ZZZZ'),
          throwsA(
            isA<LicenzaRifiutata>().having(
              (no) => no.spiegazione,
              'spiegazione',
              contains('non esiste'),
            ),
          ),
        );
        await collegamento.riscatta('gda-abcd-efgh-jkmn');
        expect(collegamento.licenza.premium, isTrue);
        expect(
          ponte.chieste.any(
            (una) =>
                una['type'] == 'ponte/licenza/riscatta' &&
                una['codice'] == 'GDA-ABCD-EFGH-JKMN',
          ),
          isTrue,
        );
      },
    );

    test('la ricevuta del negozio va alla casa com\'è scritto', () async {
      ponte.licenza = {
        'gettoni': {'gdahome': await firmaUnGettone()},
      };
      await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        casaAlCentralino: casaDiProva,
        inCasa: ponte.indirizzo,
      );
      collegamento = Collegamento(
        archivio: archivio,
        sonda: sondaChe({ponte.indirizzo}),
        licenza: GestoreLicenza(chiave: chiaveDiProva),
      );
      await collegamento.apri();
      await collegamento.mandaLaRicevuta(
        piattaforma: 'android',
        prodotto: 'gdahome_premium',
        ricevuta: 'token-di-acquisto',
      );
      final mandata = ponte.chieste.firstWhere(
        (una) => una['type'] == 'ponte/licenza/negozio',
      );
      expect(mandata['app'], 'gdahome');
      expect(mandata['piattaforma'], 'android');
      expect(mandata['prodotto'], 'gdahome_premium');
      expect(mandata['ricevuta'], 'token-di-acquisto');
      expect(collegamento.licenza.premium, isTrue);
    });

    test('un ponte di prima non sa delle licenze, e non è un errore', () async {
      ponte.licenza = null;
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
        licenza: GestoreLicenza(chiave: chiaveDiProva),
      );
      await collegamento.apri();
      await Future<void>.delayed(const Duration(milliseconds: 200));
      expect(collegamento.comeVa, ComeVa.aperta);
      expect(archivio.attiva!.gettone, isNull);
    });
  });
}
