/// La salute ad app chiusa, dopo la revisione: quello che costava senza
/// servire, e quello che si segnava senza essere successo.
///
/// - una sveglia senza niente da mandare non apre il filo;
/// - anche le sveglie andate male hanno un freno (il quarto d'ora, e sei ore
///   dopo un «no» della casa);
/// - un permesso si segna «chiesto» solo se la domanda si e' vista;
/// - `inactive` non vuol dire «qualcuno davanti» se non lo dice il telefono;
/// - su Android senza il permesso di leggere ad app chiusa il giro non parte;
/// - un motore accanto all'app non riscrive l'archivio delle case con una
///   copia vecchia.
library;

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart' show AppLifecycleState;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/main.dart' show statoDavanti;
import 'package:gdahome/ponte/indirizzo.dart';
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

  var aperture = 0;
  Never laCasaNonSiCerca() {
    aperture++;
    throw StateError('il filo non andava aperto');
  }

  group('prima si legge, poi si cerca la casa', () {
    test('Salute vuota: niente filo, niente centralino', () async {
      aperture = 0;
      final vuoto = PostinoDellaSalute(
        lettore: LettoreFinto(lette: const {}),
        dispensa: DispensaInMemoria(),
        adesso: () => adesso,
      );
      await vuoto.accendi(FiloFinto(), const ScelteDellaSalute());
      adesso = adesso.add(const Duration(hours: 1));
      final come = await svegliaDellaSalute(
        postino: vuoto,
        laCasa: laCasaNonSiCerca,
      );
      expect(come, ComeEAndataDaChiusa.vuota);
      expect(aperture, 0);
    });

    test('con qualcosa da mandare, la casa si cerca', () async {
      aperture = 0;
      await postino.accendi(FiloFinto(), const ScelteDellaSalute());
      adesso = adesso.add(const Duration(hours: 1));
      final come = await svegliaDellaSalute(
        postino: postino,
        laCasa: laCasaNonSiCerca,
      );
      expect(come, ComeEAndataDaChiusa.senzaCasa);
      expect(aperture, 1);
    });
  });

  group('il freno anche quando va male', () {
    test('una sveglia vuota frena la prossima per un quarto d\'ora', () async {
      final vuoto = PostinoDellaSalute(
        lettore: LettoreFinto(lette: const {}),
        dispensa: DispensaInMemoria(),
        adesso: () => adesso,
      );
      await vuoto.accendi(FiloFinto(), const ScelteDellaSalute());
      adesso = adesso.add(const Duration(hours: 1));
      expect(
        await svegliaDellaSalute(postino: vuoto, laCasa: laCasaNonSiCerca),
        ComeEAndataDaChiusa.vuota,
      );
      adesso = adesso.add(const Duration(minutes: 5));
      expect(
        await svegliaDellaSalute(postino: vuoto, laCasa: laCasaNonSiCerca),
        ComeEAndataDaChiusa.presto,
      );
      adesso = adesso.add(const Duration(minutes: 11));
      expect(
        await svegliaDellaSalute(postino: vuoto, laCasa: laCasaNonSiCerca),
        ComeEAndataDaChiusa.vuota,
      );
    });

    test('una casa che non risponde frena la prossima', () async {
      await postino.accendi(FiloFinto(), const ScelteDellaSalute());
      adesso = adesso.add(const Duration(hours: 1));
      expect(
        await svegliaDellaSalute(postino: postino, laCasa: laCasaNonSiCerca),
        ComeEAndataDaChiusa.senzaCasa,
      );
      aperture = 0;
      adesso = adesso.add(const Duration(minutes: 5));
      expect(
        await svegliaDellaSalute(postino: postino, laCasa: laCasaNonSiCerca),
        ComeEAndataDaChiusa.presto,
      );
      expect(aperture, 0);
    });

    test('dopo un «no» della casa si aspettano sei ore', () async {
      await postino.accendi(FiloFinto(), const ScelteDellaSalute());
      adesso = adesso.add(const Duration(hours: 1));
      final no = FiloFinto(rifiuta: 'premium-richiesto');
      expect(await postino.mandaDaChiusa(no), ComeEAndataDaChiusa.rifiutata);
      expect(postino.scelte.rifiutataDaChiusa, isTrue);
      adesso = adesso.add(const Duration(hours: 1));
      expect(
        await svegliaDellaSalute(postino: postino, laCasa: laCasaNonSiCerca),
        ComeEAndataDaChiusa.presto,
      );
      adesso = adesso.add(const Duration(hours: 6));
      final si = FiloFinto();
      expect(await postino.mandaDaChiusa(si), ComeEAndataDaChiusa.mandata);
      expect(postino.scelte.rifiutataDaChiusa, isFalse);
    });

    test('un invio ad app aperta andato bene toglie il «no»', () async {
      final filo = FiloFinto();
      await postino.accendi(filo, const ScelteDellaSalute());
      adesso = adesso.add(const Duration(hours: 1));
      await postino.mandaDaChiusa(FiloFinto(rifiuta: 'premium-richiesto'));
      expect(postino.scelte.rifiutataDaChiusa, isTrue);
      adesso = adesso.add(const Duration(minutes: 16));
      await postino.forseManda(filo);
      expect(postino.scelte.rifiutataDaChiusa, isFalse);
    });

    test('il tentativo si scrive e si rilegge', () {
      final scelte = ScelteDellaSalute(
        acceso: true,
        tentatoDaChiusa: DateTime(2026, 11, 4, 9, 30),
        rifiutataDaChiusa: true,
      );
      final rilette = ScelteDellaSalute.daQuelloCheCEra(scelte.comeSiScrive);
      expect(rilette.tentatoDaChiusa, DateTime(2026, 11, 4, 9, 30));
      expect(rilette.rifiutataDaChiusa, isTrue);
      expect(
        rilette.prossimaSvegliaUtile(
          quartoDOra: ogniQuanto,
          dopoUnNo: dopoUnNo,
        ),
        DateTime(2026, 11, 4, 15, 30),
      );
    });
  });

  group('un permesso si segna solo se la domanda si e\' vista', () {
    test('senza nessuno davanti non si chiede e non si segna', () async {
      postino.siPuoChiedere = () => false;
      await postino.accendi(FiloFinto(), const ScelteDellaSalute());
      expect(lettore.chiestiDaChiusa, 0);
      expect(postino.scelte.chiestoDaChiusa, isFalse);
      /* L'app torna davanti: adesso si chiede, una volta. */
      postino.siPuoChiedere = () => true;
      adesso = adesso.add(const Duration(minutes: 16));
      await postino.forseManda(FiloFinto());
      expect(lettore.chiestiDaChiusa, 1);
      expect(postino.scelte.chiestoDaChiusa, isTrue);
    });

    test('le misure nuove restano da chiedere finche\' non si vede', () async {
      final scritto = ScelteDellaSalute(
        acceso: true,
        misure: const {MisuraDelCorpo.passi, MisuraDelCorpo.distanza},
        viste: const {MisuraDelCorpo.passi},
        chiestoDaChiusa: true,
      ).comeSiScrive;
      final conNuove = PostinoDellaSalute(
        lettore: lettore,
        dispensa: DispensaInMemoria(scritto),
        adesso: () => adesso,
      )..siPuoChiedere = () => false;
      await conNuove.forseManda(FiloFinto());
      expect(lettore.chiesti, isEmpty);
      expect(conNuove.scelte.daChiedere, contains(MisuraDelCorpo.distanza));
      conNuove.siPuoChiedere = () => true;
      adesso = adesso.add(const Duration(minutes: 16));
      await conNuove.forseManda(FiloFinto());
      expect(lettore.chiesti, hasLength(1));
      expect(lettore.chiesti.single, contains(MisuraDelCorpo.distanza));
      expect(conNuove.scelte.daChiedere, isEmpty);
    });
  });

  group('chi c\'e\' davanti', () {
    Future<bool> telefonoNo() async => false;
    Future<bool> telefonoSi() async => true;

    test('resumed si\', paused/hidden/detached no, ovunque', () async {
      for (final android in [true, false]) {
        expect(
          await statoDavanti(
            AppLifecycleState.resumed,
            android: android,
            chiediAlTelefono: telefonoNo,
          ),
          isTrue,
        );
        for (final via in [
          AppLifecycleState.paused,
          AppLifecycleState.hidden,
          AppLifecycleState.detached,
        ]) {
          expect(
            await statoDavanti(
              via,
              android: android,
              chiediAlTelefono: telefonoSi,
            ),
            isFalse,
          );
        }
      }
    });

    test('sull\'iPhone inactive lo decide il telefono', () async {
      expect(
        await statoDavanti(
          AppLifecycleState.inactive,
          android: false,
          chiediAlTelefono: telefonoNo,
        ),
        isFalse,
      );
      expect(
        await statoDavanti(
          AppLifecycleState.inactive,
          android: false,
          chiediAlTelefono: telefonoSi,
        ),
        isTrue,
      );
      expect(
        await statoDavanti(null, android: false, chiediAlTelefono: telefonoNo),
        isFalse,
      );
    });

    test('su Android senza stato (Android Auto) nessuno e\' davanti', () async {
      expect(
        await statoDavanti(null, android: true, chiediAlTelefono: telefonoSi),
        isFalse,
      );
      expect(
        await statoDavanti(
          AppLifecycleState.inactive,
          android: true,
          chiediAlTelefono: telefonoNo,
        ),
        isTrue,
      );
    });
  });

  group('su Android il giro parte solo col permesso', () {
    test('senza permesso di leggere ad app chiusa non si osserva', () {
      const scelte = ScelteDellaSalute(acceso: true);
      expect(cosaOsservare(scelte, puoLeggere: false), isNull);
      expect(cosaOsservare(scelte), isNotNull);
    });

    test('la parte nativa sente «spegni», non «osserva»', () async {
      const canale = MethodChannel(canaleDellaSveglia);
      final detti = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canale, (chiamata) async {
            detti.add(chiamata);
            return null;
          });
      addTearDown(
        () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(canale, null),
      );
      lettore.daChiusa = false;
      final sveglia = SvegliaDellaSalute(
        postino: postino,
        laCasa: laCasaNonSiCerca,
      )..accendi();
      await postino.accendi(FiloFinto(), const ScelteDellaSalute());
      await pumpEventQueue();
      expect(detti.where((c) => c.method == 'osserva'), isEmpty);
      /* Il permesso arriva: al prossimo cambiamento si osserva. */
      lettore.daChiusa = true;
      await postino.cambiaAdAppChiusa(true);
      await pumpEventQueue();
      expect(detti.map((c) => c.method), contains('osserva'));
      sveglia.spegni();
    });
  });

  group('l\'archivio delle case, da un motore accanto all\'app', () {
    Future<String> unaCasa(ArchivioDelleCase archivio, String nome) async {
      final casa = await archivio.aggiungi(
        nome: nome,
        segno: 'segno-$nome',
        casaAlCentralino: 'casa_$nome',
      );
      return casa.id;
    }

    test('una casa tolta dall\'app non torna in vita', () async {
      final cassaforte = CassaforteInMemoria();
      final dellApp = ArchivioDelleCase(cassaforte);
      await dellApp.apri();
      final id = await unaCasa(dellApp, 'mare');
      final accanto = ArchivioDelleCase(
        cassaforte,
        rileggePrimaDiScrivere: true,
      );
      await accanto.apri();
      /* L'app la toglie mentre il motore accanto gira. */
      await dellApp.togli(id);
      await accanto.segnaLApprodo(id, DaDove.dalCentralino);
      final dopo = ArchivioDelleCase(cassaforte);
      await dopo.apri();
      expect(dopo.quella(id), isNull);
    });

    test('una casa aggiunta dall\'app non si perde', () async {
      final cassaforte = CassaforteInMemoria();
      final dellApp = ArchivioDelleCase(cassaforte);
      await dellApp.apri();
      final prima = await unaCasa(dellApp, 'citta');
      final accanto = ArchivioDelleCase(
        cassaforte,
        rileggePrimaDiScrivere: true,
      );
      await accanto.apri();
      final nuova = await unaCasa(dellApp, 'montagna');
      await accanto.segnaIlGettone(prima, 'gettone-nuovo');
      final dopo = ArchivioDelleCase(cassaforte);
      await dopo.apri();
      expect(dopo.quella(nuova), isNotNull);
      expect(dopo.quella(prima)?.gettone, 'gettone-nuovo');
    });
  });
}
