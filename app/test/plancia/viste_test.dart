/// Le prove delle viste: cosa un apparecchio sa fare, non cosa sembra.
///
/// Il punto di tutto questo file e' `supported_features`: una maschera di bit
/// che dice quali tasti hanno senso. Un tasto che non corrisponde a un bit e'
/// un tasto che non fa niente, e premerlo senza veder succedere nulla e'
/// peggio che non trovarlo.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/configurazione.dart';
import 'package:gdahome/plancia/viste.dart';

import 'casa_demo.dart';

void main() {
  final demo = CasaDemo.leggi();
  final config = demo.configurazione;

  group('chi suona', () {
    test('legge titolo, artista, volume e cosa sa fare', () {
      final lettore = config.lettori.first;
      final vista = vistaDelLettore(lettore, demo.stato(lettore.entita));
      expect(vista.suona, isTrue);
      expect(vista.cosaSuona, 'Nuvole bianche — Ludovico Einaudi');
      expect(vista.volume, isNotNull);
      expect(vista.puoPausa, isTrue);
    });

    test('senza bit non ci sono tasti', () {
      final spoglio = vistaDelLettore(
        config.lettori.first,
        entita('media_player.x', 'playing'),
      );
      expect(spoglio.puoPausa, isFalse);
      expect(spoglio.puoAvanti, isFalse);
      expect(spoglio.puoVolume, isFalse);
      expect(spoglio.suona, isTrue);
    });

    test('senza niente in riproduzione parla lo stato', () {
      final fermo = vistaDelLettore(
        config.lettori.first,
        entita('media_player.x', 'off'),
      );
      expect(fermo.cosaSuona, isEmpty);
      expect(fermo.parola, 'Spento');
      expect(fermo.spento, isTrue);
    });
  });

  group('chi pulisce', () {
    test('la batteria del sensore vince su quella dell\'attributo', () {
      final uno = config.robot.first;
      final vista = vistaDelRobot(
        uno,
        entita(
          uno.entita,
          'cleaning',
          attributi: const {'battery_level': 50, 'supported_features': 8192},
        ),
        entita('sensor.batteria', '63'),
      );
      expect(vista.batteria, 63);
      expect(vista.alLavoro, isTrue);
      expect(vista.parola, 'Sta pulendo');
      expect(vista.puoPartire, isTrue);
      expect(vista.puoTornare, isFalse);
    });

    test('alla base e sotto il cento sta caricando', () {
      final uno = config.robot.first;
      final vista = vistaDelRobot(
        uno,
        entita(uno.entita, 'docked', attributi: const {'battery_level': 80}),
        null,
      );
      expect(vista.allaBase, isTrue);
      expect(vista.inCarica, isTrue);
      expect(vista.alLavoro, isFalse);
    });

    test('uno stato che non conosciamo non diventa un altro', () {
      final uno = config.robot.first;
      final vista = vistaDelRobot(uno, entita(uno.entita, 'boh'), null);
      expect(vista.stato, 'unknown');
      expect(vista.parola, 'Sconosciuto');
    });
  });

  group('la centrale', () {
    test('i tasti sono quelli che la centrale dichiara', () {
      /* Casa (1) + Fuori (2) + Notte (4) = 7. */
      final tre = modiAccettati(
        entita(
          'alarm_control_panel.x',
          'disarmed',
          attributi: const {'supported_features': 7},
        ),
      );
      expect(tre.map((m) => m.modo), ['home', 'away', 'night', 'disarm']);

      /* Ring: niente Notte. Un tasto che non c'e' non si preme per sbaglio. */
      final ring = modiAccettati(
        entita(
          'alarm_control_panel.ring',
          'armed_away',
          attributi: const {'supported_features': 2},
        ),
      );
      expect(ring.map((m) => m.modo), ['away', 'disarm']);
    });

    test('chi non dichiara niente tiene i due di sempre', () {
      final muta = modiAccettati(entita('alarm_control_panel.x', 'disarmed'));
      expect(muta.map((m) => m.modo), ['away', 'night', 'disarm']);
    });

    test('acceso e\' il tasto che corrisponde allo stato', () {
      final modi = modiAccettati(
        entita(
          'alarm_control_panel.x',
          'armed_home',
          attributi: const {'supported_features': 7},
        ),
      );
      expect(modoAcceso('armed_home', modi), 'home');
      expect(modoAcceso('disarmed', modi), 'disarm');
      /* In `armed_home` su una centrale che non ha quel tasto si accende
       * Fuori, che e' il piu' vicino, invece di lasciare la fila spenta. */
      final senzaCasa = modiAccettati(
        entita(
          'alarm_control_panel.y',
          'armed_home',
          attributi: const {'supported_features': 2},
        ),
      );
      expect(modoAcceso('armed_home', senzaCasa), 'away');
    });

    test('il codice si chiede solo quando esiste davvero', () {
      final senza = entita('alarm_control_panel.x', 'disarmed');
      expect(serveIlCodice(senza, 'alarm_disarm'), isFalse);
      expect(serveIlCodice(senza, 'alarm_arm_away'), isFalse);

      final soloPerSbloccare = entita(
        'alarm_control_panel.y',
        'armed_away',
        attributi: const {'code_format': 'number', 'code_arm_required': false},
      );
      expect(serveIlCodice(soloPerSbloccare, 'alarm_disarm'), isTrue);
      expect(serveIlCodice(soloPerSbloccare, 'alarm_arm_away'), isFalse);
      expect(codiceDiSoleCifre(soloPerSbloccare), isTrue);

      final sempre = entita(
        'alarm_control_panel.z',
        'disarmed',
        attributi: const {'code_format': 'text'},
      );
      expect(serveIlCodice(sempre, 'alarm_arm_night'), isTrue);
      expect(codiceDiSoleCifre(sempre), isFalse);
    });

    test('come sta, detto in italiano', () {
      expect(parolaDellAllarme('armed_away'), 'Inserito');
      expect(parolaDellAllarme('triggered'), 'Allarme!');
      expect(parolaDellAllarme(null), 'Sconosciuto');
    });
  });

  group('le porte', () {
    test('una serratura si dice chiusa, un cancello aperto', () {
      final porte = config.porte;
      final serratura = vistaDellaPorta(
        porte.first,
        demo.stato(porte.first.entita),
      );
      expect(serratura.dominio, 'lock');
      expect(serratura.siApreESiChiude, isTrue);
      expect(serratura.parola, anyOf('Chiusa', 'Aperta'));
    });

    test('un pulsante non ha un «chiuso» da chiedergli', () {
      final finta = ConfigurazioneDellaPlancia.daiValori({
        'cd_security_doors':
            '[{"id":"c","name":"Cancello","entity":"switch.cancello"}]',
      }).porte.single;
      final vista = vistaDellaPorta(finta, entita('switch.cancello', 'off'));
      expect(vista.siApreESiChiude, isFalse);
      expect(vista.aperta, isFalse);
      expect(vista.parola, 'Chiusa');
    });
  });
}
