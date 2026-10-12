/// La prova da fuori: una casa che l'app crede Base, ma che intanto puo'
/// essere diventata Premium.
///
/// «Licenza: Premium per sempre · regalo» nella console della casa, e nel
/// browser, fuori casa, «Fuori casa serve gdahome Premium». Il browser aveva
/// abbinato la casa quando era Base e si era tenuto il suo gettone vuoto:
/// l'app bussava solo alle strade di casa, da fuori non rispondevano, e la
/// licenza — che si chiede alla casa, sul filo — non si richiedeva mai.
///
/// Adesso una casa creduta Base si prova anche da fuori, una volta, **solo
/// per chiederle la licenza**: se e' Premium si entra e il gettone nuovo si
/// ricorda; se e' Base davvero la plancia non si vede nemmeno per un attimo,
/// anche col centralino che lascia passare tutti (`MODO_LICENZE=spento`).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/licenza/licenza.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/presa.dart';
import 'package:gdahome/ponte/sonda.dart';

import '../ponte/ponte_finto.dart';
import 'gettoni_di_prova.dart';

void main() {
  late ArchivioDelleCase archivio;
  late PonteFinto ponte;
  Collegamento? collegamento;

  final centralino = IndirizzoDelCentralino.leggi(
    'wss://centralino.esempio.it',
  )!;
  final inCasaLontana = IndirizzoDelPonte.leggi('192.168.1.50')!;

  setUp(() async {
    archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();
    ponte = await PonteFinto.alza();
  });

  tearDown(() async {
    await collegamento?.chiudi();
    collegamento = null;
    await ponte.spegni();
  });

  /// Le strade aperte, per indirizzo: si vede se si e' passati dal
  /// centralino.
  late List<String> aperte;

  /// Un collegamento in cui il centralino porta a questo ponte finto — come
  /// fa quello vero, col modo `spento` o con la casa Premium — e in cui di
  /// strade di casa risponde solo [inCasa], se c'e'.
  Collegamento unCollegamento({
    IndirizzoDelPonte? inCasa,
    Duration ogniQuantoSiRiprovaDaFuori = const Duration(minutes: 10),
  }) {
    aperte = [];
    final nuovo = Collegamento(
      archivio: archivio,
      licenza: GestoreLicenza(chiave: chiaveDiProva),
      ogniQuantoSiRiprovaDaFuori: ogniQuantoSiRiprovaDaFuori,
      apriLaPresa: (dove) {
        aperte.add(dove.host);
        return PresaSuWebSocket.apri(
          dove.host == centralino.salute.host ? ponte.indirizzo.filo : dove,
        );
      },
      sonda: Sonda(
        attesa: const Duration(milliseconds: 200),
        vantaggio: const Duration(milliseconds: 40),
        bussa: (dove) async =>
            dove == centralino.salute ||
            (inCasa != null && dove == inCasa.salute),
      ),
    );
    collegamento = nuovo;
    return nuovo;
  }

  Future<String> unaCasaCredutaBase({IndirizzoDelPonte? inCasa}) async {
    final casa = await archivio.aggiungi(
      nome: 'Casa',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      casaAlCentralino: casaDiProva,
      centralino: centralino,
      inCasa: inCasa ?? inCasaLontana,
    );
    /* L'ultima volta la casa ha detto di non avere un gettone: e' Base, per
     * quanto ne sa l'app. */
    await archivio.segnaIlGettone(casa.id, '');
    return casa.id;
  }

  /// Quello che si e' visto, a ogni cambiamento: come andava, e se a chi lo
  /// chiedeva — la plancia, la console — si dava un filo dentro.
  List<(ComeVa, bool)> guarda(Collegamento collegamento) {
    final visti = <(ComeVa, bool)>[];
    collegamento.cambiamenti.listen((_) {
      visti.add((collegamento.comeVa, collegamento.filo?.dentro ?? false));
    });
    return visti;
  }

  /// Quello che la casa si e' sentita chiedere, oltre alla licenza e al
  /// colpetto.
  Iterable<Object?> altroChiesto() => ponte.arrivati
      .map((uno) => uno['type'])
      .where((tipo) => tipo != 'ponte/licenza/stato' && tipo != 'ping');

  test('creduta Base ma Premium davvero: da fuori si entra, e il gettone '
      'nuovo si ricorda', () async {
    final gettone = await firmaUnGettone(origine: 'regalo', perSempre: true);
    ponte.licenza = {
      'gettoni': {'gdahome': gettone},
    };
    final id = await unaCasaCredutaBase();
    final collegamento = unCollegamento();
    final visti = guarda(collegamento);
    expect(
      collegamento.licenza.stradeDaFuoriPer(archivio.quella(id)!),
      isFalse,
      reason: 'prima di provare, per l\'app la casa e\' Base',
    );

    await collegamento.apri();

    expect(collegamento.comeVa, ComeVa.aperta);
    expect(collegamento.fuoriCasaSenzaPremium, isFalse);
    expect(collegamento.daDove, DaDove.dalCentralino);
    expect(aperte, [centralino.salute.host]);
    expect(archivio.quella(id)!.gettone, gettone);
    expect(collegamento.licenza.premium, isTrue);
    expect(collegamento.licenza.stradeDaFuoriPer(archivio.quella(id)!), isTrue);
    /* La licenza e' stata la prima cosa chiesta, prima della plancia. */
    expect(ponte.arrivati.first['type'], 'ponte/licenza/stato');
    /* E il filo non si e' dato a nessuno finche' la casa non l'ha detta. */
    final primaAperta = visti.indexWhere((uno) => uno.$1 == ComeVa.aperta);
    expect(primaAperta, isNonNegative);
    expect(
      visti.take(primaAperta).where((uno) => uno.$2),
      isEmpty,
      reason: 'il filo si dava prima del verdetto: $visti',
    );
  });

  test('creduta Base e Base davvero, col centralino che lascia passare: la '
      'pagina Premium, e la plancia non si vede mai', () async {
    ponte.licenza = {'gettoni': <String, String>{}};
    final id = await unaCasaCredutaBase();
    final collegamento = unCollegamento();
    final visti = guarda(collegamento);

    await collegamento.apri();

    expect(collegamento.comeVa, ComeVa.irraggiungibile);
    expect(collegamento.fuoriCasaSenzaPremium, isTrue);
    expect(collegamento.dentro, isFalse);
    expect(collegamento.stato, isNull);
    expect(archivio.quella(id)!.gettone, '');
    expect(collegamento.licenza.premium, isFalse);
    /* Si e' entrati una volta sola, per la licenza, e non si e' chiesto
     * altro: niente plancia, niente entita'. */
    expect(ponte.collegamenti, 1);
    expect(ponte.arrivati.map((uno) => uno['type']), ['ponte/licenza/stato']);
    expect(
      visti.where((uno) => uno.$1 == ComeVa.aperta || uno.$2),
      isEmpty,
      reason: 'la plancia di una casa Base si e\' vista da fuori: $visti',
    );

    /* Riaperta subito, il centralino non si riprova. */
    await collegamento.apri(forza: true);
    expect(collegamento.fuoriCasaSenzaPremium, isTrue);
    expect(ponte.collegamenti, 1);

    /* «Controlla di nuovo» invece si': e' chi guarda a chiederlo. La casa
     * risponde, e dice ancora Base. */
    expect(await collegamento.ricontrollaLaLicenza(), isTrue);
    expect(ponte.collegamenti, 2);
    expect(collegamento.fuoriCasaSenzaPremium, isTrue);
    expect(altroChiesto(), isEmpty);
  });

  test('creduta Base, col centralino che impone: il 4402 dice Premium come '
      'prima', () async {
    ponte
      ..chiudeSubitoDicendo = 'premium-richiesto'
      ..chiudeSubitoColNumero = 4402;
    await unaCasaCredutaBase();
    final collegamento = unCollegamento();
    await collegamento.apri();
    expect(collegamento.comeVa, ComeVa.irraggiungibile);
    expect(collegamento.fuoriCasaSenzaPremium, isTrue);
    expect(ponte.collegamenti, 1);
  });

  test('mai chiesto: da fuori si entra come prima, senza prova', () async {
    ponte.licenza = {
      'gettoni': {'gdahome': await firmaUnGettone()},
    };
    final casa = await archivio.aggiungi(
      nome: 'Casa',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      casaAlCentralino: casaDiProva,
      centralino: centralino,
      inCasa: inCasaLontana,
    );
    final collegamento = unCollegamento();
    expect(
      collegamento.licenza.comeSta(archivio.quella(casa.id)),
      ComeStaLaLicenza.maiChiesto,
    );
    await collegamento.apri();
    expect(collegamento.comeVa, ComeVa.aperta);
    expect(collegamento.daDove, DaDove.dalCentralino);
    await _finoA(() => collegamento.licenza.premium);
    expect(collegamento.licenza.premium, isTrue);
  });

  test('in casa, una casa Base si apre come sempre', () async {
    ponte.licenza = {'gettoni': <String, String>{}};
    final id = await unaCasaCredutaBase(inCasa: ponte.indirizzo);
    final collegamento = unCollegamento(inCasa: ponte.indirizzo);
    await collegamento.apri();
    expect(collegamento.comeVa, ComeVa.aperta);
    expect(collegamento.daDove, DaDove.daDentro);
    expect(collegamento.fuoriCasaSenzaPremium, isFalse);
    expect(collegamento.dentro, isTrue);
    expect(aperte, isNot(contains(centralino.salute.host)));
    expect(collegamento.licenza.premiumDi(archivio.quella(id)), isFalse);
  });

  test('passato il tempo, la casa creduta Base si riprova', () async {
    ponte.licenza = {'gettoni': <String, String>{}};
    await unaCasaCredutaBase();
    final collegamento = unCollegamento(
      ogniQuantoSiRiprovaDaFuori: Duration.zero,
    );
    await collegamento.apri();
    expect(collegamento.fuoriCasaSenzaPremium, isTrue);
    expect(ponte.collegamenti, 1);

    /* Nel frattempo e' diventata Premium: al giro dopo si entra. */
    final gettone = await firmaUnGettone(origine: 'regalo', perSempre: true);
    ponte.licenza = {
      'gettoni': {'gdahome': gettone},
    };
    await collegamento.apri(forza: true);
    expect(collegamento.comeVa, ComeVa.aperta);
    expect(collegamento.fuoriCasaSenzaPremium, isFalse);
    expect(collegamento.licenza.premium, isTrue);
  });
}

Future<void> _finoA(bool Function() finche) async {
  for (var i = 0; i < 100 && !finche(); i += 1) {
    await Future<void>.delayed(const Duration(milliseconds: 20));
  }
}
