/// La salute ad app chiusa: «i dati arrivano solo quando apro l'app».
///
/// Qui senza telefono: la sveglia che arriva dal canale, il quarto d'ora,
/// il telefono bloccato, e quello che va alla casa — mai un messaggio vuoto,
/// mai sensori cancellati da una lettura andata storta in tasca.
library;

import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/salute/ad_app_chiusa.dart';
import 'package:gdahome/salute/il_corpo.dart';
import 'package:gdahome/salute/postino_della_salute.dart';

import 'finti.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late LettoreFinto lettore;
  late DateTime adesso;
  late PostinoDellaSalute postino;

  setUp(() {
    lettore = LettoreFinto();
    adesso = LettoreFinto.adesso;
    postino = PostinoDellaSalute(
      lettore: lettore,
      dispensa: DispensaInMemoria(),
      adesso: () => adesso,
    );
  });

  /* Una casa che non si deve nemmeno cercare: se la si chiede, la prova
   * fallisce. */
  Collegamento nessunaCasaDaCercare() =>
      throw StateError('il filo non andava aperto');

  group('le scelte', () {
    test('acceso di serie, anche per chi aveva gia\' acceso la Salute', () {
      expect(const ScelteDellaSalute().adAppChiusa, isTrue);
      final diPrima = ScelteDellaSalute.daQuelloCheCEra(
        '{"acceso":true,"persona":"Marco","misure":["passi"]}',
      );
      expect(diPrima.adAppChiusa, isTrue);
      expect(diPrima.chiestoDaChiusa, isFalse);
    });

    test('si rileggono come si sono scritte', () {
      final scelte = ScelteDellaSalute(
        acceso: true,
        adAppChiusa: false,
        ultimoDaChiusa: true,
        chiestoDaChiusa: true,
        ultimoInvio: DateTime(2026, 11, 4, 8, 15),
      );
      final riletta = ScelteDellaSalute.daQuelloCheCEra(scelte.comeSiScrive);
      expect(riletta.adAppChiusa, isFalse);
      expect(riletta.ultimoDaChiusa, isTrue);
      expect(riletta.chiestoDaChiusa, isTrue);
    });

    test('sull\'iPhone si osservano pochi tipi, e bastano', () {
      expect(daOsservareSuIPhone(misureDiSerie), {
        'HKQuantityTypeIdentifierStepCount',
        'HKQuantityTypeIdentifierHeartRate',
        'HKQuantityTypeIdentifierBodyMass',
        'HKQuantityTypeIdentifierBloodPressureSystolic',
        'HKCategoryTypeIdentifierSleepAnalysis',
        'HKQuantityTypeIdentifierActiveEnergyBurned',
      });
      expect(daOsservareSuIPhone({MisuraDelCorpo.passi}), {
        'HKQuantityTypeIdentifierStepCount',
      });
    });

    test('si osserva solo con la salute e l\'invio ad app chiusa accesi', () {
      expect(cosaOsservare(const ScelteDellaSalute()), isNull);
      expect(
        cosaOsservare(
          const ScelteDellaSalute(acceso: true, adAppChiusa: false),
        ),
        isNull,
      );
      expect(
        cosaOsservare(
          const ScelteDellaSalute(acceso: true, misure: {MisuraDelCorpo.sonno}),
        ),
        ['HKCategoryTypeIdentifierSleepAnalysis'],
      );
    });
  });

  group('la sveglia', () {
    test('spenta: non legge, non apre il filo', () async {
      final come = await svegliaDellaSalute(
        postino: postino,
        laCasa: nessunaCasaDaCercare,
      );
      expect(come, ComeEAndataDaChiusa.spenta);
      expect(lettore.letture, 0);
    });

    test('con l\'invio ad app chiusa spento, niente', () async {
      await postino.accendi(FiloFinto(), const ScelteDellaSalute());
      await postino.cambiaAdAppChiusa(false);
      adesso = adesso.add(const Duration(hours: 1));
      final letture = lettore.letture;
      final come = await svegliaDellaSalute(
        postino: postino,
        laCasa: nessunaCasaDaCercare,
      );
      expect(come, ComeEAndataDaChiusa.spenta);
      expect(lettore.letture, letture);
    });

    test('dentro il quarto d\'ora: niente filo, niente centralino', () async {
      await postino.accendi(FiloFinto(), const ScelteDellaSalute());
      adesso = adesso.add(const Duration(minutes: 10));
      final come = await svegliaDellaSalute(
        postino: postino,
        laCasa: nessunaCasaDaCercare,
      );
      expect(come, ComeEAndataDaChiusa.presto);
    });

    test('telefono bloccato: si aspetta, senza aprire il filo', () async {
      await postino.accendi(FiloFinto(), const ScelteDellaSalute());
      adesso = adesso.add(const Duration(hours: 1));
      final letture = lettore.letture;
      final come = await svegliaDellaSalute(
        postino: postino,
        laCasa: nessunaCasaDaCercare,
        leggibile: false,
      );
      expect(come, ComeEAndataDaChiusa.bloccato);
      expect(lettore.letture, letture);
    });

    test(
      'una casa che non c\'e\': risponde lo stesso, e chiude il suo filo',
      () async {
        await postino.accendi(FiloFinto(), const ScelteDellaSalute());
        adesso = adesso.add(const Duration(hours: 1));
        final archivio = ArchivioDelleCase(CassaforteInMemoria());
        final collegamento = Collegamento(archivio: archivio);
        final come = await svegliaDellaSalute(
          postino: postino,
          laCasa: () => collegamento,
          condiviso: false,
        );
        expect(come, ComeEAndataDaChiusa.senzaCasa);
      },
    );

    test('un guasto qualunque: risponde lo stesso, «senza casa»', () async {
      await postino.accendi(FiloFinto(), const ScelteDellaSalute());
      adesso = adesso.add(const Duration(hours: 1));
      final come = await svegliaDellaSalute(
        postino: postino,
        laCasa: () => throw StateError('il portachiavi non risponde'),
      );
      expect(come, ComeEAndataDaChiusa.senzaCasa);
    });
  });

  group('quello che va alla casa ad app chiusa', () {
    test('le misure lette, senza cancellare le altre, e si segna', () async {
      final filo = FiloFinto();
      await postino.accendi(filo, const ScelteDellaSalute(persona: 'Marco'));
      adesso = adesso.add(const Duration(minutes: 16));
      final come = await postino.mandaDaChiusa(filo);
      expect(come, ComeEAndataDaChiusa.mandata);
      final mandato = filo.mandati.last;
      expect(mandato['type'], 'ponte/salute/misure');
      expect(mandato['persona'], 'Marco');
      expect(mandato['aggiungi'], isTrue);
      expect((mandato['misure'] as Map), isNotEmpty);
      expect(postino.scelte.ultimoInvio, adesso);
      expect(postino.scelte.ultimoDaChiusa, isTrue);
      /* E l'invio ad app aperta lo rimette «con l'app aperta». */
      adesso = adesso.add(const Duration(minutes: 16));
      await postino.forseManda(filo);
      expect(postino.scelte.ultimoDaChiusa, isFalse);
      expect(filo.mandati.last.containsKey('aggiungi'), isFalse);
    });

    test('niente di letto: niente messaggio vuoto', () async {
      final filo = FiloFinto();
      await postino.accendi(filo, const ScelteDellaSalute());
      final vuoto = PostinoDellaSalute(
        lettore: LettoreFinto(lette: const {}),
        dispensa: DispensaInMemoria(),
        adesso: () => adesso,
      );
      await vuoto.accendi(FiloFinto(), const ScelteDellaSalute());
      adesso = adesso.add(const Duration(hours: 1));
      final filoVuoto = FiloFinto();
      expect(await vuoto.mandaDaChiusa(filoVuoto), ComeEAndataDaChiusa.vuota);
      expect(filoVuoto.mandati, isEmpty);
    });

    test(
      'niente permessi chiesti: non c\'e\' nessuno a cui chiederli',
      () async {
        final filo = FiloFinto();
        await postino.accendi(filo, const ScelteDellaSalute());
        final chiesti = lettore.chiesti.length;
        final chiestiDaChiusa = lettore.chiestiDaChiusa;
        adesso = adesso.add(const Duration(hours: 1));
        await postino.mandaDaChiusa(filo);
        expect(lettore.chiesti.length, chiesti);
        expect(lettore.chiestiDaChiusa, chiestiDaChiusa);
      },
    );

    test('la casa senza Premium: non si legge niente', () async {
      final filo = FiloFinto();
      await postino.accendi(filo, const ScelteDellaSalute());
      postino.sbloccata = () => false;
      adesso = adesso.add(const Duration(hours: 1));
      final letture = lettore.letture;
      expect(await postino.mandaDaChiusa(filo), ComeEAndataDaChiusa.spenta);
      expect(lettore.letture, letture);
    });

    test('il permesso ad app chiusa (Android) si chiede una volta sola, '
        'con l\'app davanti', () async {
      final filo = FiloFinto();
      await postino.accendi(filo, const ScelteDellaSalute());
      expect(lettore.chiestiDaChiusa, 1);
      adesso = adesso.add(const Duration(minutes: 16));
      await postino.forseManda(filo);
      expect(lettore.chiestiDaChiusa, 1);
      expect(postino.scelte.chiestoDaChiusa, isTrue);
    });
  });

  group('l\'app partita da sola', () {
    test(
      'il giro del quarto d\'ora non manda se nessuno e\' davanti',
      () async {
        final filo = FiloFinto();
        await postino.accendi(filo, const ScelteDellaSalute());
        postino.davanti = () async => false;
        adesso = adesso.add(const Duration(hours: 1));
        final letture = lettore.letture;
        await postino.forseManda(filo);
        expect(lettore.letture, letture);
        expect(filo.mandati, hasLength(1));
      },
    );

    test(
      'una lettura andata a vuoto non cancella i sensori della casa',
      () async {
        final vuoto = PostinoDellaSalute(
          lettore: LettoreFinto(lette: const {}),
          dispensa: DispensaInMemoria(),
          adesso: () => adesso,
        );
        final filo = FiloFinto();
        await vuoto.accendi(filo, const ScelteDellaSalute());
        expect(filo.mandati, isEmpty);
      },
    );
  });

  group('il canale con la parte nativa', () {
    const canale = MethodChannel(canaleDellaSveglia);
    late List<MethodCall> detti;

    setUp(() {
      detti = [];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canale, (chiamata) async {
            detti.add(chiamata);
            return null;
          });
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canale, null);
    });

    Future<String?> svegliaDalTelefono({bool leggibile = true}) async {
      final risposta = Completer<ByteData?>();
      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(
            canaleDellaSveglia,
            const StandardMethodCodec().encodeMethodCall(
              MethodCall('sveglia', {'leggibile': leggibile}),
            ),
            risposta.complete,
          );
      final dati = await risposta.future;
      return dati == null
          ? null
          : const StandardMethodCodec().decodeEnvelope(dati) as String?;
    }

    test('«pronto», e i tipi da osservare seguono le scelte', () async {
      final sveglia = SvegliaDellaSalute(
        postino: postino,
        laCasa: nessunaCasaDaCercare,
      )..accendi();
      await pumpEventQueue();
      expect(detti.map((c) => c.method), containsAll(['pronto', 'spegni']));

      detti.clear();
      await postino.accendi(
        FiloFinto(),
        const ScelteDellaSalute(misure: {MisuraDelCorpo.passi}),
      );
      await pumpEventQueue();
      final osserva = detti.lastWhere((c) => c.method == 'osserva');
      expect((osserva.arguments as Map)['tipi'], [
        'HKQuantityTypeIdentifierStepCount',
      ]);

      detti.clear();
      await postino.cambiaAdAppChiusa(false);
      await pumpEventQueue();
      expect(detti.map((c) => c.method), ['spegni']);
      sveglia.spegni();
    });

    test('la sveglia del telefono ha sempre una risposta', () async {
      SvegliaDellaSalute(
        postino: postino,
        laCasa: nessunaCasaDaCercare,
      ).accendi();
      await pumpEventQueue();
      /* Spenta. */
      expect(await svegliaDalTelefono(), 'spenta');
      /* Accesa, telefono bloccato. */
      await postino.accendi(FiloFinto(), const ScelteDellaSalute());
      adesso = adesso.add(const Duration(hours: 1));
      expect(await svegliaDalTelefono(leggibile: false), 'bloccato');
      /* Accesa, sbloccato, e la casa che non si apre: risponde lo stesso. */
      expect(await svegliaDalTelefono(), 'senzaCasa');
    });
  });
}
