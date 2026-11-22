/// Il link `gdahome://collega?invito=…`, visto dall'app (`ponte/il_link.dart`).
///
/// Chi guarda la console dallo stesso telefono che vuole collegare preme
/// «Apri GdAHome su questo telefono», e l'app si apre con l'invito del QR.
/// Quello che si guarda qui:
///
///  - prima di abbinare si chiede «Collegare questa casa?», e al «no» non
///    succede niente: un link puo' arrivare da chiunque;
///  - al si' parte la stessa strada del QR inquadrato, con lo stesso invito;
///  - con Base e una casa gia' nell'app si puo' ricollegare quella, e
///    un'altra no;
///  - un link storto si dice, e non apre niente;
///  - col lucchetto su il link aspetta che chi tiene il telefono si faccia
///    riconoscere.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/casa/il_lucchetto.dart';
import 'package:gdahome/casa/impostazioni.dart';
import 'package:gdahome/casa/la_finestra.dart';
import 'package:gdahome/casa/la_guardia.dart';
import 'package:gdahome/main.dart';
import 'package:gdahome/ponte/abbinamento.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/invito.dart';
import 'package:gdahome/schermate/aggiungi_casa.dart';
import 'package:gdahome/schermate/collega_dal_link.dart';
import 'package:gdahome/schermate/riconoscimento.dart';

const _riga = 'gdahome|1|ABCD2345EFGH6789||192.168.1.50:8098';
const _link =
    'gdahome://collega?invito=gdahome%7C1%7CABCD2345EFGH6789%7C%7C'
    '192.168.1.50%3A8098';

/// Un abbinamento finto: si segna l'invito che gli arriva, e risponde come
/// una casa che si chiama [casa] al centralino.
class _AbbinaFinto {
  _AbbinaFinto({this.casa = 'casa_prova_1'});

  final String casa;
  final arrivati = <Invito>[];

  Future<Entrata> call(
    Invito invito, {
    required String nome,
    required String sistema,
    required Map<String, String> modello,
    IndirizzoDelCentralino? centralinoDiRipiego,
  }) async {
    arrivati.add(invito);
    return Entrata(
      Abbinato(
        segno: 'segno-nuovo',
        chiave: 'chiave-nuova',
        identificativo: 'dm_nuovo',
        nomeDelDispositivo: 'Telefono di prova',
        casaAlCentralino: casa,
      ),
    );
  }
}

/// Una guardia che risponde quando glielo si dice.
class _GuardiaFinta implements LaGuardia {
  Completer<ComeEAndata> risposta = Completer();

  @override
  Future<CosaSaFareIlTelefono> cosaSaFare() async => const CosaSaFareIlTelefono(
    sa: {ComeRiconosce.volto},
    ceUnaGuardiaDelSistema: true,
  );

  @override
  Future<ComeEAndata> chiedi({required String perche}) => risposta.future;
}

void main() {
  Future<ArchivioDelleCase> unArchivio({String? conLaCasa}) async {
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();
    if (conLaCasa != null) {
      await archivio.aggiungi(
        nome: 'Casa al mare',
        segno: 'segno-vecchio',
        identificativo: 'dm_vecchio',
        casaAlCentralino: conLaCasa,
      );
    }
    return archivio;
  }

  /* Qualche giro: l'abbinamento chiede il modello del telefono, e lo aspetta
   * al piu' due secondi. */
  Future<void> lascialoFare(WidgetTester tester) async {
    for (var giro = 0; giro < 8; giro += 1) {
      await tester.pump(const Duration(milliseconds: 500));
    }
  }

  testWidgets('prima si chiede, poi si abbina con l\'invito del link', (
    tester,
  ) async {
    final archivio = await unArchivio();
    final abbina = _AbbinaFinto();
    final fatte = <String>[];
    await tester.pumpWidget(
      MaterialApp(
        home: AggiungiCasa(
          archivio: archivio,
          invitoDaUnLink: Invito.leggi(_riga),
          abbina: abbina.call,
          quandoFatto: (casa) => fatte.add(casa.nome),
        ),
      ),
    );
    await tester.pumpAndSettle();

    /* Il foglio, col codice da riconoscere: niente e' partito. */
    expect(find.text('Collegare questa casa?'), findsOneWidget);
    expect(find.text('ABCD-2345-EFGH-6789'), findsOneWidget);
    expect(find.text('In casa: 192.168.1.50'), findsOneWidget);
    expect(abbina.arrivati, isEmpty);

    await tester.tap(find.byKey(const Key('collega-dal-link-si')));
    await lascialoFare(tester);

    expect(abbina.arrivati, hasLength(1));
    expect(abbina.arrivati.single.codice, 'ABCD2345EFGH6789');
    expect(abbina.arrivati.single.indirizzi, [
      IndirizzoDelPonte.leggi('192.168.1.50:8098'),
    ]);
    expect(archivio.tutte.single.casaAlCentralino, 'casa_prova_1');
    expect(fatte, hasLength(1));
  });

  testWidgets('al «no» non si abbina niente, e la pagina si chiude', (
    tester,
  ) async {
    final archivio = await unArchivio();
    final abbina = _AbbinaFinto();
    var rinunciato = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: AggiungiCasa(
          archivio: archivio,
          invitoDaUnLink: Invito.leggi(_riga),
          abbina: abbina.call,
          quandoRinuncia: () => rinunciato += 1,
          quandoFatto: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('collega-dal-link-no')));
    await tester.pumpAndSettle();

    expect(rinunciato, 1);
    expect(abbina.arrivati, isEmpty);
    expect(archivio.vuoto, isTrue);
  });

  testWidgets('con Base la stessa casa si ricollega, senza Premium', (
    tester,
  ) async {
    final archivio = await unArchivio(conLaCasa: 'casa_prova_1');
    final abbina = _AbbinaFinto(casa: 'casa_prova_1');
    final fatte = <String>[];
    await tester.pumpWidget(
      MaterialApp(
        home: AggiungiCasa(
          archivio: archivio,
          invitoDaUnLink: Invito.leggi(_riga),
          soloCaseGiaNote: true,
          abbina: abbina.call,
          quandoFatto: (casa) => fatte.add(casa.nome),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('serve Premium'), findsOneWidget);
    await tester.tap(find.byKey(const Key('collega-dal-link-si')));
    await lascialoFare(tester);

    /* Fusa con quella di prima: il nome resta, le chiavi sono nuove. */
    expect(fatte, ['Casa al mare']);
    expect(archivio.tutte, hasLength(1));
    expect(archivio.tutte.single.segno, 'segno-nuovo');
    expect(archivio.tutte.single.vecchioIdentificativo, 'dm_vecchio');
  });

  testWidgets('con Base un\'altra casa non si scrive, e si dice perché', (
    tester,
  ) async {
    final archivio = await unArchivio(conLaCasa: 'casa_prova_1');
    final abbina = _AbbinaFinto(casa: 'casa_prova_2');
    final fatte = <String>[];
    await tester.pumpWidget(
      MaterialApp(
        home: AggiungiCasa(
          archivio: archivio,
          invitoDaUnLink: Invito.leggi(_riga),
          soloCaseGiaNote: true,
          abbina: abbina.call,
          quandoFatto: (casa) => fatte.add(casa.nome),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('collega-dal-link-si')));
    await lascialoFare(tester);

    expect(abbina.arrivati, hasLength(1));
    expect(fatte, isEmpty);
    expect(archivio.tutte.single.casaAlCentralino, 'casa_prova_1');
    expect(find.textContaining('Questa è un\'altra casa'), findsOneWidget);
  });

  group('dall\'app intera', () {
    late Impostazioni impostazioni;

    setUp(() async {
      impostazioni = Impostazioni(
        sulTelefono: true,
        android: true,
        dispensa: DispensaInMemoria(),
      );
      await impostazioni.carica();
      TestWidgetsFlutterBinding.ensureInitialized().defaultBinaryMessenger
          .setMockMethodCallHandler(canaleDellaFinestra, (_) async => null);
    });

    tearDown(() {
      TestWidgetsFlutterBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canaleDellaFinestra, null);
    });

    Widget lApp(Stream<Uri> link, LaGuardia guardia) {
      final velo = ValueNotifier<Widget?>(null);
      return MaterialApp(
        builder: (context, schermata) =>
            SopraTutto(velo: velo, child: schermata ?? const SizedBox.shrink()),
        home: Portone(
          cassaforte: CassaforteInMemoria(),
          impostazioni: impostazioni,
          guardia: guardia,
          link: link,
        ),
      );
    }

    Future<void> giri(WidgetTester tester, [int quanti = 20]) async {
      for (var giro = 0; giro < quanti; giro += 1) {
        await tester.pump(const Duration(milliseconds: 40));
      }
    }

    testWidgets('il link con cui l\'app si apre porta al foglio', (
      tester,
    ) async {
      final guardia = _GuardiaFinta()..risposta.complete(ComeEAndata.si);
      final link = StreamController<Uri>();
      link.add(Uri.parse(_link));
      await tester.pumpWidget(lApp(link.stream, guardia));
      await giri(tester);

      expect(find.byType(FoglioDelCollega), findsOneWidget);
      expect(find.text('ABCD-2345-EFGH-6789'), findsOneWidget);
      await link.close();
    });

    testWidgets('un secondo link prende il posto del primo', (tester) async {
      final guardia = _GuardiaFinta()..risposta.complete(ComeEAndata.si);
      final link = StreamController<Uri>();
      link.add(Uri.parse(_link));
      await tester.pumpWidget(lApp(link.stream, guardia));
      await giri(tester);
      expect(find.text('ABCD-2345-EFGH-6789'), findsOneWidget);

      /* Un QR nuovo nella console, e di nuovo il bottone. */
      link.add(
        Uri.parse(
          'gdahome://collega?invito=gdahome%7C1%7CWXYZ2345EFGH6789%7C%7C',
        ),
      );
      await giri(tester);
      expect(find.byType(FoglioDelCollega), findsOneWidget);
      expect(find.text('ABCD-2345-EFGH-6789'), findsNothing);
      expect(find.text('WXYZ-2345-EFGH-6789'), findsOneWidget);

      /* Al «no» si torna al benvenuto, senza pagine rimaste sotto. */
      await tester.tap(find.byKey(const Key('collega-dal-link-no')));
      await giri(tester);
      expect(find.byType(FoglioDelCollega), findsNothing);
      expect(find.byType(AggiungiCasa), findsOneWidget);
      expect(
        tester.state<NavigatorState>(find.byType(Navigator)).canPop(),
        isFalse,
      );
      await link.close();
    });

    testWidgets('un link storto si dice, e non apre niente', (tester) async {
      final guardia = _GuardiaFinta()..risposta.complete(ComeEAndata.si);
      final link = StreamController<Uri>();
      await tester.pumpWidget(lApp(link.stream, guardia));
      await giri(tester);

      link.add(Uri.parse('gdahome://collega?invito=qualcosa'));
      await giri(tester);
      expect(find.byType(FoglioDelCollega), findsNothing);
      expect(find.byType(SnackBar), findsOneWidget);
      expect(find.textContaining('non è un codice di GdAHome'), findsOneWidget);
      await link.close();
    });

    testWidgets('col lucchetto su il link aspetta il volto', (tester) async {
      await impostazioni.metti(
        lucchetto: const IlLucchetto(allAvvio: true, alRitorno: true),
      );
      final guardia = _GuardiaFinta();
      final link = StreamController<Uri>();
      link.add(Uri.parse(_link));
      await tester.pumpWidget(lApp(link.stream, guardia));
      await giri(tester);

      expect(find.byType(IlVeloDelRiconoscimento), findsOneWidget);
      expect(find.byType(FoglioDelCollega), findsNothing);

      guardia.risposta.complete(ComeEAndata.si);
      await giri(tester);
      expect(find.byType(IlVeloDelRiconoscimento), findsNothing);
      expect(find.byType(FoglioDelCollega), findsOneWidget);
      await link.close();
    });
  });
}
