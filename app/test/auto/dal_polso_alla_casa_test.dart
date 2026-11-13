/// Dal polso alla casa: la catena intera, un anello dopo l'altro.
///
/// «Dall'orologio i comandi non partono.» Due correzioni di fila non l'hanno
/// sistemato, perche' ognuna guardava un anello solo e dava per buoni gli
/// altri. Qui si rifa' tutta la strada, coi pezzi veri:
///
///  1. **la fotografia** e' quella che la plancia manda davvero: una casa
///     configurata come la configura chi la abita, fotografata dal codice
///     della sezione (`la-foto-va-in-auto-section.js`). Sta in
///     `dati/la_foto_dalla_plancia.json`, e che sia quella vera lo tiene fermo
///     una prova della plancia (`la-foto-arriva-al-polso.test.js`);
///  2. **i file** li scrive `lasciaLaFotoAllAuto`, in una cartella vera;
///  3. **al polso** arriva quello che il telefono ci porta (`LOrologio.swift`,
///     `IlTramiteDellOrologio.kt`): qui rifatto riga per riga, perche' Swift e
///     Kotlin in una prova non girano;
///  4. **il tocco** resta scritto com'e' scritto dal telefono
///     (`LaCasaInCarPlay.lascia`, `lasciaIlComando`);
///  5. **chi esegue** e' `eseguiIlComandoDellAuto`, col filo vero verso una
///     casa finta che si comporta come Home Assistant: un servizio delle luci
///     gira solo le luci, e a chi glielo chiede su un interruttore risponde
///     «fatto» senza fare niente.
///
/// I nomi sono inventati: non c'e' la casa di nessuno.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/auto/i_comandi.dart';
import 'package:gdahome/auto/in_auto.dart';
import 'package:gdahome/auto/la_foto.dart';
import 'package:gdahome/auto/sul_telefono.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/licenza/licenza.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/sonda.dart';

import '../licenza/gettoni_di_prova.dart';
import '../ponte/ponte_finto.dart';

/// La casa finta che fa quello che fa Home Assistant quando gli arriva un
/// servizio: lo esegue sulle entita' **del dominio del servizio**, dice lo
/// stato nuovo a chi si e' abbonato, e risponde che e' andata bene comunque.
///
/// E' la parte che conta: `light.toggle` su `switch.giardino` per Home
/// Assistant non e' un errore — scrive nel registro che l'entita' «manca» e
/// risponde di si'. `homeassistant.toggle` invece lo gira al dominio giusto.
class CasaFinta {
  CasaFinta(this.ponte);

  final PonteFinto ponte;

  /// I servizi arrivati, come «light.toggle light.sala».
  final chiamati = <String>[];

  /// Quanto ci mette un dispositivo a dire lo stato nuovo, dopo che Home
  /// Assistant ha accettato il comando: una lampadina Zigbee, una presa nel
  /// cloud. Zero vuol dire subito, **prima** del si' al servizio: e' quello
  /// che fa Home Assistant con una luce che risponde.
  Duration ritardoDelloStato = Duration.zero;

  /// Cosa cambia una scena, quando la si accende.
  final Map<String, Map<String, String>> scene = {};

  var _accesa = false;

  void accendi() {
    _accesa = true;
    ponte.quandoArriva = _arrivato;
  }

  void spegni() {
    _accesa = false;
    ponte.quandoArriva = null;
  }

  String? statoDi(String id) {
    for (final una in ponte.entita) {
      if (una['entity_id'] == id) return una['state'] as String?;
    }
    return null;
  }

  void _arrivato(Map<String, dynamic> detto) {
    if (detto['type'] != 'call_service') return;
    final dominio = '${detto['domain']}';
    final servizio = '${detto['service']}';
    final bersaglio = detto['target'];
    final su = bersaglio is Map ? '${bersaglio['entity_id']}' : '';
    chiamati.add('$dominio.$servizio $su');
    for (final id in su.split(',').map((uno) => uno.trim())) {
      final suo = id.split('.').first;
      if (dominio != suo && dominio != 'homeassistant') continue;
      if (suo == 'scene' && servizio == 'turn_on') {
        for (final MapEntry(:key, :value) in (scene[id] ?? {}).entries) {
          _traPoco(key, value);
        }
        continue;
      }
      final prima = statoDi(id);
      /* Quello che non c'e' o non si raggiunge non si gira. */
      if (prima == null || prima == 'unavailable') continue;
      final dopo = switch (servizio) {
        'toggle' => prima == 'on' ? 'off' : 'on',
        'turn_on' => 'on',
        'turn_off' => 'off',
        'unlock' => 'unlocked',
        'lock' => 'locked',
        _ => prima,
      };
      if (dopo != prima) _traPoco(id, dopo);
    }
  }

  void _traPoco(String id, String stato) {
    if (ritardoDelloStato == Duration.zero) return _cambia(id, stato);
    Timer(ritardoDelloStato, () {
      if (_accesa) _cambia(id, stato);
    });
  }

  void _cambia(String id, String stato) {
    if (statoDi(id) == stato) return;
    final nuova = PonteFinto.unaEntita(
      id,
      stato,
      cambiataIl: DateTime.now().toUtc().toIso8601String(),
    );
    ponte.entita = [
      for (final una in ponte.entita) una['entity_id'] == id ? nuova : una,
    ];
    /* A chi si e' abbonato, nella forma in cui si e' abbonato. */
    for (final detto in List.of(ponte.arrivati)) {
      final numero = detto['id'];
      if (numero is! int) continue;
      if (detto['type'] == 'subscribe_events') {
        ponte.cambia(numero, id, nuova);
      } else if (detto['type'] == 'subscribe_entities') {
        final chieste = detto['entity_ids'];
        if (chieste is List && !chieste.contains(id)) continue;
        ponte.evento(numero, {
          'c': {
            id: {
              '+': {
                's': stato,
                'lc': DateTime.now().microsecondsSinceEpoch / 1000000,
              },
            },
          },
        });
      }
    }
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  /* I fili verso la casa finta sono veri: senza questo, sotto il binding
   * delle prove ogni richiesta torna 400. */
  HttpOverrides.global = null;

  const cartellaDelSistema = MethodChannel('plugins.flutter.io/path_provider');
  const orologio = MethodChannel(canaleDellOrologio);
  final messaggero =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  late Directory cartella;
  late PonteFinto ponte;
  late CasaFinta casa;
  late ArchivioDelleCase archivio;
  final aperti = <Collegamento>[];

  /// Quante volte si e' detto all'orologio «la fotografia e' cambiata».
  var dettoAllOrologio = 0;

  /// Il messaggio della plancia: vedi in cima.
  final dallaPlancia = File('test/auto/dati/la_foto_dalla_plancia.json')
      .readAsStringSync();

  File file(String nome) => File('${cartella.path}/$nome');

  setUp(() async {
    cartella = await Directory.systemTemp.createTemp('gdahome-polso-');
    dettoAllOrologio = 0;
    messaggero.setMockMethodCallHandler(
      cartellaDelSistema,
      (_) async => cartella.path,
    );
    messaggero.setMockMethodCallHandler(orologio, (chiamata) async {
      if (chiamata.method == 'aggiorna') dettoAllOrologio += 1;
      return null;
    });

    ponte = await PonteFinto.alza();
    ponte.entita = [
      PonteFinto.unaEntita('light.sala', 'off', nome: 'Sala'),
      PonteFinto.unaEntita('light.cucina', 'on', nome: 'Cucina'),
      PonteFinto.unaEntita('light.studio', 'unavailable', nome: 'Studio'),
      PonteFinto.unaEntita('switch.luce_esterna', 'off', nome: 'Luce esterna'),
      PonteFinto.unaEntita('switch.presa_tv', 'on', nome: 'Presa TV'),
      PonteFinto.unaEntita('switch.cancello', 'off', nome: 'Cancello'),
      PonteFinto.unaEntita('lock.portone', 'locked', nome: 'Portone'),
    ];
    casa = CasaFinta(ponte)..accendi();

    archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();
    await archivio.aggiungi(
      nome: 'Casa di prova',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: ponte.indirizzo,
    );
    /* In auto e al polso la casa e' Premium: il biglietto lo scrive il codice
     * vero, dove lo legge chi esegue. */
    expect(await diciLaLicenzaAllAuto(premium: true), isTrue);
    await pumpEventQueue();
    dettoAllOrologio = 0;
  });

  tearDown(() async {
    /* Prima i seguiti dei comandi: stanno ancora usando i fili e i file. */
    await ilSeguitoDeiComandi();
    casa.spegni();
    for (final uno in aperti) {
      await uno.chiudi().catchError((Object _) {});
    }
    aperti.clear();
    await ponte.spegni();
    messaggero.setMockMethodCallHandler(cartellaDelSistema, null);
    messaggero.setMockMethodCallHandler(orologio, null);
    await cartella.delete(recursive: true);
  });

  /// Un filo nuovo verso la casa finta.
  Collegamento unFilo([ArchivioDelleCase? conLArchivio]) {
    final nuovo = Collegamento(
      archivio: conLArchivio ?? archivio,
      licenza: GestoreLicenza(chiave: chiaveDiProva),
      sonda: Sonda(
        attesa: const Duration(milliseconds: 200),
        vantaggio: const Duration(milliseconds: 40),
        bussa: (dove) async => dove == ponte.indirizzo.salute,
      ),
      comeSiPresenta: () async => const {},
    );
    aperti.add(nuovo);
    return nuovo;
  }

  /// Quello che il telefono porta al polso, dai file: i dispositivi come
  /// sono, e le azioni con `subito` vero anche quando lo e' solo
  /// `subitoAlPolso` (`LOrologio.fotografia`, `leAzioni` in
  /// `LaFotoDellaCasa.kt`).
  Future<
    ({
      Map<String, String> dispositivi,
      Map<String, ({String id, bool subito})> azioni,
    })
  >
  alPolso() async {
    final foto = jsonDecode(
      await file(nomeDelFile).readAsString(),
    ) as Map<String, dynamic>;
    return (
      dispositivi: {
        for (final uno in (foto['dispositivi'] as List).cast<Map>())
          '${uno['nome']}': '${uno['id']}',
      },
      azioni: {
        for (final una in (foto['azioni'] as List).cast<Map>())
          '${una['nome']}': (
            id: '${una['id']}',
            subito: una['subito'] == true || una['subitoAlPolso'] == true,
          ),
      },
    );
  }

  /// Il tocco, come lo lascia scritto il telefono quando arriva dal polso
  /// (`LaCasaInCarPlay.lascia(dalPolso: true)`, `lasciaIlComando`), o
  /// dall'auto.
  Future<void> tocca(String id, {bool dalPolso = true}) => file(nomeDelComando)
      .writeAsString(
        jsonEncode({
          'azione': id,
          'quando': DateTime.now().millisecondsSinceEpoch,
          if (dalPolso) 'polso': true,
        }),
      );

  /// Il Dart svegliato dal telefono ad app chiusa: un filo aperto apposta
  /// (`inAuto`, il motore senza schermo di Android).
  Future<ComeEFinitaInAuto> aSchermoSpento() =>
      eseguiIlComandoDellAuto(apriLaCasa: unFilo);

  /// La riga di [id] nella fotografia che il telefono porta al polso.
  Future<Map<String, dynamic>> laRiga(String id) async =>
      ((jsonDecode(await file(nomeDelFile).readAsString())
                  as Map<String, dynamic>)['dispositivi']
              as List)
          .cast<Map<String, dynamic>>()
          .firstWhere((uno) => uno['id'] == id);

  group('con la fotografia appena arrivata dalla plancia', () {
    test('una luce dell\'elenco dispositivi si accende dal polso', () async {
      expect(
        await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova'),
        isTrue,
      );
      expect(dettoAllOrologio, 1, reason: 'la fotografia va anche al polso');
      final polso = await alPolso();
      /* «Sala» e' spenta: in auto non entra, al polso si'. */
      expect(polso.dispositivi['Sala'], 'light.sala');

      await tocca(polso.dispositivi['Sala']!);
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      expect(casa.chiamati, ['light.toggle light.sala']);
      expect(casa.statoDi('light.sala'), 'on');
    });

    test('ogni dispositivo che al polso si vede si comanda, col servizio '
        'del suo dominio', () async {
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      final polso = await alPolso();
      expect(polso.dispositivi.keys, [
        'Cucina',
        'Presa TV',
        'Sala',
        'Luce esterna',
        'Studio',
      ]);
      for (final id in polso.dispositivi.values) {
        await tocca(id);
        expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto, reason: id);
      }
      expect(casa.chiamati, [
        'light.toggle light.cucina',
        'switch.toggle switch.presa_tv',
        'light.toggle light.sala',
        'switch.toggle switch.luce_esterna',
        'light.toggle light.studio',
      ]);
    });

    test('un\'azione che accende una luce la accende davvero, anche se la '
        'luce e\' un interruttore', () async {
      /* «Luce esterna» e' un gruppo di luci dell'editor, con dentro
       * `switch.luce_esterna`: il giardino sta su un rele'. La plancia gli da'
       * la ricetta `light.toggle`, e Home Assistant a `light.toggle` su un
       * interruttore risponde di si' senza fare niente: al polso «Fatto», e
       * il giardino resta buio. */
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      final polso = await alPolso();
      final azione = polso.azioni['Luce esterna']!;
      expect(azione.subito, isTrue);

      await tocca(azione.id);
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      expect(
        casa.statoDi('switch.luce_esterna'),
        'on',
        reason: 'chiamato: ${casa.chiamati}',
      );
    });

    test('un gruppo di sole luci resta un servizio delle luci', () async {
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      final azione = (await alPolso()).azioni['Zona giorno']!;
      await tocca(azione.id);
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      expect(casa.chiamati, ['light.toggle light.sala,light.cucina']);
      expect(casa.statoDi('light.sala'), 'on');
      expect(casa.statoDi('light.cucina'), 'off');
    });

    test(
      'quello che vuole qualcuno che guardi lo dice prima, e non parte',
      () async {
        await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
        final polso = await alPolso();
        for (final nome in ['Tutte le luci', 'Buonanotte', 'Portone']) {
          final azione = polso.azioni[nome]!;
          expect(azione.subito, isFalse, reason: nome);
          await tocca(azione.id);
          expect(
            await aSchermoSpento(),
            ComeEFinitaInAuto.aspettaLApp,
            reason: nome,
          );
        }
        expect(casa.chiamati, isEmpty);
      },
    );

    test('col lucchetto dell\'app: dal polso parte, dall\'auto no', () async {
      await lasciaLaFotoAllAuto(
        dallaPlancia,
        casa: 'Casa di prova',
        daSola: false,
      );
      final polso = await alPolso();
      expect(polso.azioni['Cancello']!.subito, isTrue);
      final inAuto =
          (jsonDecode(await file(nomeDelFile).readAsString())
                  as Map<String, dynamic>)['azioni']
              as List;
      expect(
        inAuto.every((una) => (una as Map)['subito'] == false),
        isTrue,
        reason: 'in macchina col lucchetto niente parte da solo',
      );

      await tocca(polso.azioni['Cancello']!.id);
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      await tocca(polso.dispositivi['Sala']!);
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      expect(casa.chiamati, [
        'switch.toggle switch.cancello',
        'light.toggle light.sala',
      ]);

      /* Lo stesso tasto premuto in macchina: col lucchetto aspetta l'app. */
      await tocca(polso.azioni['Cancello']!.id, dalPolso: false);
      expect(await aSchermoSpento(), ComeEFinitaInAuto.aspettaLApp);
      expect(casa.chiamati.length, 2);
    });
  });

  group('aggiornata l\'app, prima che la plancia rimandi la fotografia', () {
    /* Quello che resta sul telefono di chi aggiorna dalla 1.18.21: la
     * fotografia senza `subitoAlPolso`, le ricette nel solo file dell'auto (e
     * nemmeno li', col lucchetto), nessun file per il polso. La plancia li
     * riscrive solo quando torna sotto gli occhi di qualcuno: chi aggiorna e
     * prova subito dall'orologio trova questi. */
    Future<void> comeLiLasciavaLaVersioneDiPrima({required bool daSola}) async {
      final foto = jsonDecode(
        laFotoDaScrivere(dallaPlancia, casa: 'Casa di prova', daSola: daSola)!,
      ) as Map<String, dynamic>;
      for (final una in (foto['azioni'] as List).cast<Map>()) {
        una.remove('subitoAlPolso');
      }
      await file(nomeDelFile).writeAsString(jsonEncode(foto));
      if (daSola) {
        await file(nomeDelleRicette)
            .writeAsString(leRicetteScritte(leRicetteDaScrivere(dallaPlancia)));
      }
    }

    test('senza lucchetto il polso comanda con le ricette di prima', () async {
      await comeLiLasciavaLaVersioneDiPrima(daSola: true);
      final polso = await alPolso();
      expect(polso.azioni['Cancello']!.subito, isTrue);

      /* Con la 1.18.21 partiva. Con la 1.18.22 il comando dal polso cerca
       * solo nel file nuovo, che non c'e' ancora: «Questo si fa dal
       * telefono: apri GdAHome», per ogni luce. */
      await tocca(polso.dispositivi['Sala']!);
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      expect(casa.statoDi('light.sala'), 'on');
    });

    test('col lucchetto il polso dice di aprire l\'app, e aperta la plancia '
        'parte', () async {
      /* Qui sul telefono non c'e' niente da cui ripartire: col lucchetto la
       * versione di prima le ricette le toglieva. Finche' la plancia non
       * rimanda la fotografia, al polso si legge «Parte quando apri GdAHome
       * sul telefono» sotto le azioni, e «Questo si fa dal telefono: apri
       * GdAHome» toccando una luce: sono le due frasi della segnalazione. */
      await comeLiLasciavaLaVersioneDiPrima(daSola: false);
      var polso = await alPolso();
      expect(polso.azioni['Luce esterna']!.subito, isFalse);
      await tocca(polso.dispositivi['Sala']!);
      expect(await aSchermoSpento(), ComeEFinitaInAuto.aspettaLApp);

      /* Aperta GdAHome, la plancia rimanda la fotografia. */
      await lasciaLaFotoAllAuto(
        dallaPlancia,
        casa: 'Casa di prova',
        daSola: false,
      );
      polso = await alPolso();
      expect(polso.azioni['Luce esterna']!.subito, isTrue);
      await tocca(polso.dispositivi['Sala']!);
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      expect(casa.statoDi('light.sala'), 'on');
    });
  });

  group('lo stato di adesso', () {
    test('dopo il comando la riga al polso dice com\'e\' adesso, e la '
        'risposta non aspetta per niente', () async {
      /* «Vengono comandati ma non cambiano stato.» Lo stato nuovo lo dice
       * Home Assistant, ma solo a chi si e' abbonato: chi esegue il comando
       * lo stato della casa non l'ha mai chiesto, e aspettava quattro
       * secondi una notizia che non poteva arrivargli. */
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      dettoAllOrologio = 0;
      await tocca('light.sala');
      final cronometro = Stopwatch()..start();
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      expect(
        cronometro.elapsed,
        lessThan(const Duration(seconds: 3)),
        reason: 'il telefono aspetta nove secondi in tutto, il polso venti',
      );
      final sala =
          ((jsonDecode(await file(nomeDelFile).readAsString())
                      as Map<String, dynamic>)['dispositivi']
                  as List)
              .cast<Map>()
              .firstWhere((uno) => uno['id'] == 'light.sala');
      expect(sala['acceso'], isTrue);
      expect(sala['stato'], 'Accesa');
      expect(dettoAllOrologio, 1, reason: 'e l\'orologio lo viene a sapere');
    });

    test('una serratura chiusa si apre: il servizio si decide con lo stato '
        'vero', () async {
      /* «Apri o chiudi» di una serratura, fra i comandi rapidi: il servizio
       * si decide premendo (`secondo_lo_stato`). Senza lo stato in mano una
       * serratura chiusa riceveva «chiudi»: «Fatto», e la porta resta
       * chiusa. */
      const portone = ComandoRapido(
        id: 'm|lock.portone|$secondoLoStato',
        nome: 'Portone',
        genere: GenereDelComando.serratura,
        conferma: true,
        ricetta: RicettaDellAzione(
          id: 'm|lock.portone|$secondoLoStato',
          dominio: 'lock',
          servizio: secondoLoStato,
          entita: 'lock.portone',
        ),
      );
      expect(
        await scriviIComandi(const IComandiScelti(comandi: [portone])),
        isTrue,
      );
      await tocca(portone.id);
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      expect(casa.chiamati, ['lock.unlock lock.portone']);
      expect(casa.statoDi('lock.portone'), 'unlocked');
    });
    test('con un ponte di prima, che lo stato di una sola entita\' non lo '
        'sa dare, la serratura si apre lo stesso', () async {
      ponte.conosceGliAbbonamentiStretti = false;
      const portone = RicettaDellAzione(
        id: 'm|lock.portone|$secondoLoStato',
        dominio: 'lock',
        servizio: secondoLoStato,
        entita: 'lock.portone',
      );
      expect(
        await eseguiIlComandoDellAuto(
          prendiIlComando: () async => portone.id,
          leRicette: () async => const [portone],
          apriLaCasa: unFilo,
        ),
        ComeEFinitaInAuto.fatto,
      );
      expect(casa.chiamati, ['lock.unlock lock.portone']);

      /* E una luce parte senza chiedere tutta la casa, e senza aspettare
       * uno stato che nessuno puo' dirle. */
      await ilSeguitoDeiComandi();
      ponte.arrivati.clear();
      casa.chiamati.clear();
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      await tocca('light.sala');
      final cronometro = Stopwatch()..start();
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      expect(cronometro.elapsed, lessThan(const Duration(seconds: 3)));
      expect(casa.chiamati, ['light.toggle light.sala']);
      expect(
        ponte.arrivati.map((uno) => uno['type']),
        isNot(contains('get_states')),
      );
    });
  });

  group('i comandi scelti sul telefono', () {
    test(
      'un gruppo di luci fatto di interruttori si accende anche da li\'',
      () async {
        /* I comandi in cima all'orologio (e dietro la casetta in macchina) si
       * scelgono fra le azioni rapide della plancia, lette dalla sua
       * configurazione: anche li' il gruppo nasce `light.toggle`. */
        final scelti = leAzioniDellaConfigurazione({
          'cd_quick_actions': [
            {
              'type': 'luci_group',
              'name': 'Luce esterna',
              'icon': '💡',
              'lights': ['switch.luce_esterna'],
            },
          ],
        }).comandi;
        expect(scelti.single.ricetta.dominio, 'light');
        expect(await scriviIComandi(IComandiScelti(comandi: scelti)), isTrue);
        await tocca(scelti.single.id);
        expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
        expect(casa.chiamati, ['homeassistant.toggle switch.luce_esterna']);
        expect(casa.statoDi('switch.luce_esterna'), 'on');
      },
    );

    test('il dominio con cui si chiama e\' quello delle entita\'', () {
      String chiama(String dominio, String servizio, String entita) =>
          RicettaDellAzione(
            id: 'x',
            dominio: dominio,
            servizio: servizio,
            entita: entita,
          ).dominioDaChiamare;
      expect(chiama('light', 'toggle', 'light.a'), 'light');
      expect(chiama('light', 'toggle', 'light.a,light.b'), 'light');
      expect(chiama('light', 'toggle', 'switch.a'), 'homeassistant');
      expect(chiama('light', 'toggle', 'light.a, switch.b'), 'homeassistant');
      expect(chiama('switch', 'turn_off', 'switch.a'), 'switch');
      /* Uno script e una scena restano com'erano: e' quello che fa il tasto
       * in Home. */
      expect(chiama('script', 'turn_on', 'script.notte'), 'script');
      expect(chiama('scene', 'turn_on', 'light.a'), 'scene');
      /* E quello che non e' un «accendi, spegni, gira» non si tocca. */
      expect(chiama('lock', 'unlock', 'lock.portone'), 'lock');
      expect(chiama('select', 'select_option', 'select.a'), 'select');
      expect(chiama('button', 'press', 'button.a'), 'button');
    });
  });

  group('due fotografie una dietro l\'altra', () {
    test('resta l\'ultima, intera, con le sue ricette', () async {
      /* La pagina appena aperta manda quello che sa — i tasti, e ancora
       * nessun dispositivo — e un attimo dopo, arrivata la configurazione, la
       * fotografia intera. Le due scritture insieme sullo stesso file di
       * passaggio ne facevano uno coi pezzi di tutt'e due: un JSON che non si
       * legge, e al polso niente. */
      final tutta = jsonDecode(dallaPlancia) as Map<String, dynamic>;
      final appenaAperta = jsonEncode({
        ...tutta,
        'dispositivi': const <Object>[],
        'ricette': [
          for (final una in (tutta['ricette'] as List).cast<Map>())
            if ('${una['id']}'.contains('|')) una,
        ],
      });
      for (var giro = 0; giro < 20; giro += 1) {
        final esiti = await Future.wait([
          lasciaLaFotoAllAuto(appenaAperta, casa: 'Casa di prova'),
          lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova'),
        ]);
        expect(esiti, [true, true], reason: 'giro $giro');
        final polso = await alPolso();
        expect(polso.dispositivi.length, 5, reason: 'giro $giro');
        final ricette = await leRicetteDelPolso();
        for (final id in polso.dispositivi.values) {
          expect(
            laRicettaDi(id, ricette),
            isNotNull,
            reason: '$id, giro $giro',
          );
        }
      }
    });
  });

  group('col filo dell\'app', () {
    test('rimasto morto in tasca, il comando arriva lo stesso, e una volta '
        'sola', () async {
      /* Il telefono in tasca non chiude niente: il sistema gli sospende la
       * rete, e la presa resta li', «aperta» e morta (`Filo.sveglia`). Il
       * comando dal polso arriva proprio allora, e il filo dell'app dice
       * ancora di essere dentro. */
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      final dellApp = unFilo();
      await dellApp.apri();
      expect(dellApp.dentro, isTrue);
      ponte.sorde.addAll(ponte.prese);

      await tocca('light.sala');
      expect(
        await eseguiIlComandoDellAuto(laCasaDellApp: () => dellApp),
        ComeEFinitaInAuto.fatto,
      );
      expect(casa.statoDi('light.sala'), 'on');
      expect(
        casa.chiamati.where((uno) => uno.startsWith('light.toggle')),
        hasLength(1),
      );
      expect(dellApp.dentro, isTrue, reason: 'il filo dell\'app resta suo');
    }, timeout: const Timeout(Duration(seconds: 60)));

    test('vivo, non si tocca', () async {
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      final dellApp = unFilo();
      await dellApp.apri();
      final prima = ponte.collegamenti;

      await tocca('light.sala');
      expect(
        await eseguiIlComandoDellAuto(laCasaDellApp: () => dellApp),
        ComeEFinitaInAuto.fatto,
      );
      expect(casa.statoDi('light.sala'), 'on');
      expect(ponte.collegamenti, prima, reason: 'nessun filo nuovo');
      expect(dellApp.dentro, isTrue);
    });
  });

  group('lo stato arriva al polso', () {
    test('da fuori casa, dove gli eventi arrivano a mucchi', () async {
      /* Passando dal centralino il ponte tiene gli eventi un secondo e li
       * manda insieme (`ponte/src/ponte.js`, `FINESTRA_DEL_MUCCHIO`): lo
       * stato di adesso, che e' un evento, arriva un secondo dopo il si'. */
      ponte.finestraDegliEventi = const Duration(seconds: 1);
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      await tocca('light.sala');
      final cronometro = Stopwatch()..start();
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      /* Il comando non aspetta quel secondo: prima lo aspettava a ogni
       * tocco, e con un secondo di attesa contro un secondo di finestra lo
       * stato arrivava a tempo scaduto una volta si' e una no. */
      expect(cronometro.elapsed, lessThan(const Duration(milliseconds: 900)));
      await ilSeguitoDeiComandi();
      expect(casa.statoDi('light.sala'), 'on');
      expect((await laRiga('light.sala'))['acceso'], isTrue);
    });

    test('in casa ma entrati dalla strada lunga: il filo si rifa\' da dentro '
        'mentre il comando e\' in viaggio', () async {
      /* Il telefono che si sveglia in tasca: il Wi-Fi risponde un soffio dopo
       * il giro lungo, si entra da fuori, e appena dentro il collegamento
       * impara la strada di casa e **rifa' il filo** (`_imparaLaStradaDiCasa`).
       * Il comando dal polso arriva proprio in quel momento. */
      final diFuori = ArchivioDelleCase(CassaforteInMemoria());
      await diFuori.apri();
      await diFuori.aggiungi(
        nome: 'Casa di prova',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: IndirizzoDelPonte.leggi('192.168.99.99')!,
        daFuoriCasa: ponte.indirizzo,
      );
      ponte.indirizziDiCasa = [ponte.indirizzo];
      /* La casa e' Premium, e lo dice: da fuori ci si entra per davvero. */
      ponte.licenza = {
        'gettoni': {
          'gdahome': await firmaUnGettone(origine: 'regalo', perSempre: true),
        },
      };
      /* E la luce ci mette un attimo a dirsi accesa: lo stato nuovo arriva
       * dopo la conferma, quando il filo si starebbe gia' rifacendo. */
      casa.ritardoDelloStato = const Duration(milliseconds: 400);
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      await tocca('light.sala');
      expect(
        await eseguiIlComandoDellAuto(apriLaCasa: () => unFilo(diFuori)),
        ComeEFinitaInAuto.fatto,
      );
      await ilSeguitoDeiComandi();
      expect(
        casa.chiamati.where((uno) => uno.startsWith('light.toggle')),
        hasLength(1),
      );
      expect(casa.statoDi('light.sala'), 'on');
      expect((await laRiga('light.sala'))['acceso'], isTrue);
    });

    test('la conferma parte appena Home Assistant accetta, e lo stato arriva '
        'dopo per conto suo', () async {
      /* «Premo e dopo un po' da' il tap di feedback.» Una lampadina che ci
       * mette un secondo e mezzo a dire di essersi accesa: la conferma al
       * polso non la aspetta. */
      casa.ritardoDelloStato = const Duration(milliseconds: 1500);
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      await pumpEventQueue();
      dettoAllOrologio = 0;
      await tocca('light.sala');
      final cronometro = Stopwatch()..start();
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      expect(cronometro.elapsed, lessThan(const Duration(seconds: 1)));
      expect((await laRiga('light.sala'))['acceso'], isFalse);

      await ilSeguitoDeiComandi();
      expect((await laRiga('light.sala'))['acceso'], isTrue);
      expect((await laRiga('light.sala'))['stato'], 'Accesa');
      await pumpEventQueue();
      expect(dettoAllOrologio, 1, reason: 'e il polso lo viene a sapere');
    });

    test('un gruppo di luci aggiorna le righe delle sue luci', () async {
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      final azione = (await alPolso()).azioni['Zona giorno']!;
      await tocca(azione.id);
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      await ilSeguitoDeiComandi();
      expect((await laRiga('light.sala'))['acceso'], isTrue);
      expect((await laRiga('light.cucina'))['acceso'], isFalse);
      expect((await laRiga('light.cucina'))['stato'], 'Spenta');
    });
    test('una scena aggiorna le righe di quello che cambia', () async {
      /* Una scena non ha una riga sua: spegne e accende altre cose. Dopo
       * averla accesa si guardano i dispositivi che al polso hanno una riga,
       * e si corregge quello che si e' mosso. */
      ponte.entita = [
        ...ponte.entita,
        PonteFinto.unaEntita('scene.cinema', '2026-11-11T20:00:00+00:00'),
      ];
      casa.scene['scene.cinema'] = {
        'light.cucina': 'off',
        'switch.presa_tv': 'off',
        'light.sala': 'on',
      };
      casa.ritardoDelloStato = const Duration(milliseconds: 200);
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      const cinema = RicettaDellAzione(
        id: '6|Cinema',
        dominio: 'scene',
        servizio: 'turn_on',
        entita: 'scene.cinema',
      );
      expect(
        await eseguiIlComandoDellAuto(
          prendiIlComando: () async => cinema.id,
          leRicette: () async => const [cinema],
          apriLaCasa: unFilo,
        ),
        ComeEFinitaInAuto.fatto,
      );
      await ilSeguitoDeiComandi();
      expect(casa.chiamati, ['scene.turn_on scene.cinema']);
      expect((await laRiga('light.cucina'))['acceso'], isFalse);
      expect((await laRiga('switch.presa_tv'))['acceso'], isFalse);
      expect((await laRiga('light.sala'))['acceso'], isTrue);
      /* Quello che la scena non ha toccato resta com'era. */
      expect((await laRiga('switch.luce_esterna'))['acceso'], isFalse);
    });

    test('quello che Home Assistant non raggiunge non si aspetta, e la riga '
        'resta vera', () async {
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      await tocca('light.studio');
      final cronometro = Stopwatch()..start();
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      await ilSeguitoDeiComandi();
      expect(cronometro.elapsed, lessThan(const Duration(seconds: 2)));
      expect((await laRiga('light.studio'))['acceso'], isFalse);
    });

    test('una riga che era gia\' sbagliata torna giusta', () async {
      /* La fotografia dice «Sala spenta», ma intanto qualcuno l'ha accesa
       * dal muro. Dal polso la si tocca: si spegne — e la riga, che diceva
       * gia' «Spenta», resta giusta; «Cucina», toccata, si spegne e lo dice. */
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      ponte.entita = [
        for (final una in ponte.entita)
          una['entity_id'] == 'light.sala'
              ? PonteFinto.unaEntita('light.sala', 'on', nome: 'Sala')
              : una,
      ];
      /* Lenta: lo stato nuovo arriva dopo che il tempo e' scaduto. Si scrive
       * com'e' per Home Assistant in quel momento, non «il contrario di
       * prima». */
      casa.ritardoDelloStato = const Duration(milliseconds: 300);
      await tocca('light.sala');
      expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
      await ilSeguitoDeiComandi();
      expect(casa.statoDi('light.sala'), 'off');
      expect((await laRiga('light.sala'))['acceso'], isFalse);
    });
  });
  group('la riga al polso dice com\'e\' la casa adesso', () {
    /* «Il comando arriva, la luce si accende, ma sull'orologio il tasto
     * resta spento.» Le volte prima si era sistemato chi esegue il comando;
     * qui si guarda la riga, che e' quello che si vede al polso. */

    test(
      'una luce rimappata nella plancia: la riga si accende lo stesso',
      () async {
        /* La tessera scrive l'entita' come l'ha configurata chi abita la casa
       * (`light.vecchia`), la ricetta quella vera dopo `resolveEntity`
       * (`light.sala`). Il comando gira quella vera, e lo stato nuovo arriva
       * per quella vera: la riga col nome di prima non si trovava, e al
       * polso restava «Spenta» per sempre. */
        final tutta = jsonDecode(dallaPlancia) as Map<String, dynamic>;
        final rimappata = jsonEncode({
          ...tutta,
          'dispositivi': [
            {
              'id': 'light.vecchia',
              'nome': 'Lampada',
              'genere': 'luce',
              'acceso': false,
              'stato': 'Spenta',
              'polso': true,
            },
          ],
          'ricette': [
            {
              'id': 'light.vecchia',
              'dominio': 'light',
              'servizio': 'toggle',
              'entita': 'light.sala',
              'dati': <String, Object?>{},
            },
          ],
        });
        expect(
          await lasciaLaFotoAllAuto(rimappata, casa: 'Casa di prova'),
          isTrue,
        );
        await tocca('light.vecchia');
        expect(await aSchermoSpento(), ComeEFinitaInAuto.fatto);
        await ilSeguitoDeiComandi();
        expect(casa.statoDi('light.sala'), 'on');
        final riga = await laRiga('light.vecchia');
        expect(riga['acceso'], isTrue);
        expect(riga['stato'], 'Accesa');
      },
    );

    test('una luce accesa dal muro mentre si guarda l\'orologio', () async {
      /* Nessun comando: la casa cambia da se'. Col telefono in tasca la
       * plancia non guarda, e nessuno riscriveva la riga. */
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      expect((await laRiga('light.sala'))['acceso'], isFalse);
      expect((await laRiga('switch.presa_tv'))['acceso'], isTrue);
      ponte.entita = [
        for (final una in ponte.entita)
          switch (una['entity_id']) {
            'light.sala' => PonteFinto.unaEntita('light.sala', 'on'),
            'switch.presa_tv' => PonteFinto.unaEntita('switch.presa_tv', 'off'),
            _ => una,
          },
      ];
      dettoAllOrologio = 0;
      expect(
        await guardaLaCasaPerIlPolso(apriLaCasa: unFilo),
        ComeEFinitaInAuto.fatto,
      );
      expect((await laRiga('light.sala'))['acceso'], isTrue);
      expect((await laRiga('light.sala'))['stato'], 'Accesa');
      expect((await laRiga('switch.presa_tv'))['acceso'], isFalse);
      /* Quello che Home Assistant non raggiunge resta com'era. */
      expect((await laRiga('light.studio'))['acceso'], isFalse);
      expect((await laRiga('light.studio'))['stato'], 'Spenta');
      await pumpEventQueue();
      expect(dettoAllOrologio, 1, reason: 'e l\'orologio lo viene a sapere');
      expect(casa.chiamati, isEmpty, reason: 'guardare non comanda niente');
      /* E il filo aperto per guardare si richiude. */
      await Future<void>.delayed(const Duration(milliseconds: 200));
      expect(ponte.prese, isEmpty);
    });

    test('una luce lenta: il comando dice fatto prima, e chi guarda dopo la '
        'trova accesa', () async {
      /* Una lampadina che dice di essersi accesa dopo che il telefono ha
       * gia' smesso di aspettarla (il seguito finito, o il telefono fermato
       * dal sistema): e' l'orologio che richiede, e la riga si corregge. */
      casa.ritardoDelloStato = const Duration(milliseconds: 600);
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      await tocca('light.sala');
      expect(
        await eseguiIlComandoDellAuto(
          apriLaCasa: unFilo,
          /* Il telefono che non scrive piu' niente dopo la risposta. */
          aggiornaLaFoto: (_) async {},
        ),
        ComeEFinitaInAuto.fatto,
      );
      await ilSeguitoDeiComandi();
      expect((await laRiga('light.sala'))['acceso'], isFalse);
      await Future<void>.delayed(const Duration(milliseconds: 700));
      expect(
        await guardaLaCasaPerIlPolso(apriLaCasa: unFilo),
        ComeEFinitaInAuto.fatto,
      );
      expect((await laRiga('light.sala'))['acceso'], isTrue);
    });

    test('col filo dell\'app: si guarda su quello, e resta aperto', () async {
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      final dellApp = unFilo();
      await dellApp.apri();
      final prima = ponte.collegamenti;
      ponte.entita = [
        for (final una in ponte.entita)
          una['entity_id'] == 'light.sala'
              ? PonteFinto.unaEntita('light.sala', 'on')
              : una,
      ];
      expect(
        await guardaLaCasaPerIlPolso(laCasaDellApp: () => dellApp),
        ComeEFinitaInAuto.fatto,
      );
      expect((await laRiga('light.sala'))['acceso'], isTrue);
      expect(ponte.collegamenti, prima, reason: 'nessun filo nuovo');
      expect(dellApp.dentro, isTrue);
    });

    test('senza Premium non si apre niente', () async {
      await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
      expect(
        await guardaLaCasaPerIlPolso(
          apriLaCasa: unFilo,
          premium: () async => false,
        ),
        ComeEFinitaInAuto.senzaPremium,
      );
      expect(aperti, isEmpty);
    });

    test(
      'il colpetto con «stato» guarda, e non esegue il comando lasciato',
      () async {
        /* E' la stessa strada del comando (`IlPonteDellAuto.kt`,
       * `LaCasaInCarPlay.swift`): la parola accanto decide. */
        await lasciaLaFotoAllAuto(dallaPlancia, casa: 'Casa di prova');
        ponte.entita = [
          for (final una in ponte.entita)
            una['entity_id'] == 'light.sala'
                ? PonteFinto.unaEntita('light.sala', 'on')
                : una,
        ];
        final dellApp = unFilo();
        ascoltaIlColpetto(laCasaDellApp: () => dellApp);
        final risposta = await messaggero.handlePlatformMessage(
          canaleDellAuto,
          const StandardMethodCodec().encodeMethodCall(
            const MethodCall('guarda', guardaLoStato),
          ),
          null,
        );
        expect(
          const StandardMethodCodec().decodeEnvelope(risposta!),
          ComeEFinitaInAuto.fatto.name,
        );
        expect((await laRiga('light.sala'))['acceso'], isTrue);
        expect(casa.chiamati, isEmpty);
        const MethodChannel(canaleDellAuto).setMethodCallHandler(null);
      },
    );
  });
}
