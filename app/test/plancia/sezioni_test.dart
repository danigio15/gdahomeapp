/// Le prove di quello che le pagine della plancia decidono: com'e' fatta una
/// luce, che famiglia ha un'unita' del clima, il giudizio di comfort, come
/// sta una finestra, quali pagine compaiono nel menu.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/configurazione.dart';
import 'package:gdahome/plancia/luci.dart';
import 'package:gdahome/schermate/menu.dart';
import 'package:gdahome/schermate/plancia/clima.dart';
import 'package:gdahome/schermate/plancia/finestre.dart';
import 'package:gdahome/schermate/plancia/temperatura.dart';

import 'casa_demo.dart';

void main() {
  final demo = CasaDemo.leggi();
  final config = demo.configurazione;

  test(
    'una luce e\' quello che dichiara: dimmer, RGB, bianco, interruttore',
    () {
      final faretti = vistaDellaLuce(
        'light.soggiorno_faretti',
        demo.stato('light.soggiorno_faretti'),
        nome: 'Faretti soggiorno',
      );
      expect(faretti.tipo, 'DIMMER');
      expect(faretti.accesa, isTrue);
      expect(faretti.luminosita, 75);
      expect(faretti.stato, 'ACCESA · 75%');

      final strip = vistaDellaLuce(
        'light.soggiorno_strip',
        demo.stato('light.soggiorno_strip'),
      );
      expect(strip.tipo, 'RGB');
      expect(strip.colorata, isTrue);
      expect(strip.bianca, isTrue);
      expect(strip.rgb, [186, 92, 240]);
      expect(strip.kelvin, 3200);
      expect(strip.effetti, ['Arcobaleno', 'Fuoco', 'Respiro', 'Festa']);
      expect(strip.luminosita, 86);

      final led = vistaDellaLuce(
        'light.cucina_led',
        demo.stato('light.cucina_led'),
      );
      expect(led.tipo, 'BIANCO');
      expect(led.luminosita, 100);

      final camera = vistaDellaLuce(
        'light.camera_plafoniera',
        demo.stato('light.camera_plafoniera'),
      );
      expect(camera.accesa, isFalse);
      expect(camera.luminosita, isNull);
      expect(camera.stato, 'SPENTA');

      final giardino = vistaDellaLuce(
        'switch.esterno_giardino',
        demo.stato('switch.esterno_giardino'),
        nome: 'Giardino',
      );
      expect(giardino.tipo, 'SWITCH');
      expect(giardino.regolabile, isFalse);

      final ignota = vistaDellaLuce('light.non_esiste', null);
      expect(ignota.disponibile, isFalse);
      expect(ignota.stato, 'NON DISPONIBILE');
      expect(
        luminositaInPercento(1),
        1,
        reason: 'accesa non e\' mai allo zero',
      );
    },
  );

  test('le famiglie del clima e i nomi delle modalita\'', () {
    expect(famiglieDellUnita('clima'), ['freddo']);
    expect(famiglieDellUnita('termo'), ['caldo']);
    expect(famiglieDellUnita('pompa'), ['freddo', 'caldo']);
    expect(nomeDelModo('fan_only'), 'Ventola');
    expect(nomeDellaVentola('high'), 'Alta');
  });

  test('il giudizio di comfort: sotto i 18 freddo, sopra i 26 caldo', () {
    expect(giudizioDiComfort(16.4)?.$1, 'Freddo');
    expect(giudizioDiComfort(22.4)?.$1, 'Comfort');
    expect(giudizioDiComfort(26.8)?.$1, 'Caldo');
    expect(giudizioDiComfort(null), isNull);
  });

  test('come sta una finestra: posizione, anta, solo sensore', () {
    final coperture = config.coperture;
    final soggiorno = vistaDellaFinestra(coperture[0], demo.stato);
    expect(soggiorno.posizione, 100);
    expect(soggiorno.aperta, isTrue);
    expect(
      soggiorno.antaAperta,
      isFalse,
      reason: 'il contatto del soggiorno dice chiuso',
    );
    expect(soggiorno.regolabile, isTrue);

    final cucina = vistaDellaFinestra(coperture[1], demo.stato);
    expect(cucina.posizione, 60);
    expect(cucina.antaAperta, isTrue);

    final camera = vistaDellaFinestra(coperture[2], demo.stato);
    expect(camera.aperta, isFalse);
    expect(camera.antaAperta, isNull, reason: 'nessun contatto');

    final soloSensore = ConfigurazioneDellaPlancia.daiValori({
      'cd_tapparelle': '[{"id":"f1","name":"Persiana","contact":"binary_sensor.finestra_cucina"}]',
    }).coperture.single;
    final persiana = vistaDellaFinestra(soloSensore, demo.stato);
    expect(persiana.copertura.soloFinestra, isTrue);
    expect(persiana.aperta, isTrue);
    expect(persiana.posizione, isNull);
    expect(persiana.regolabile, isFalse);
  });

  test('nel menu compaiono solo le pagine che la casa ha', () {
    expect(sezioniDellaPlancia(config), [
      Sezione.plancia,
      Sezione.stanze,
      Sezione.luci,
      Sezione.clima,
      Sezione.temperatura,
      Sezione.finestre,
      Sezione.agenda,
    ]);
    expect(sezioniDellaPlancia(null), [Sezione.plancia]);
    expect(sezioniDellaPlancia(ConfigurazioneDellaPlancia.vuota), [
      Sezione.plancia,
    ]);
    final soloLuci = ConfigurazioneDellaPlancia.daiValori({
      'cd_luci': '{"light.a":"A"}',
    });
    expect(sezioniDellaPlancia(soloLuci), [Sezione.plancia, Sezione.luci]);
  });
}
