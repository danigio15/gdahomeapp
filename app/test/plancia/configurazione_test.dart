/// Le prove della configurazione della plancia: quello che c'e' scritto
/// nell'archivio condiviso di DashboardModern si legge tutto, e si legge
/// giusto.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/configurazione.dart';

import 'casa_demo.dart';

void main() {
  final demo = CasaDemo.leggi();
  final config = demo.configurazione;

  test('la risposta di config/get si legge, con la sua revisione', () {
    expect(config.cE, isTrue);
    expect(config.revisione, 12);
    expect(config.profilo, 'primary');
    expect(config.configurata, isTrue);
  });

  test('una plancia che non c\'e\' non e\' configurata', () {
    expect(ConfigurazioneDellaPlancia.vuota.configurata, isFalse);
    expect(ConfigurazioneDellaPlancia.dallaRisposta(null).cE, isFalse);
    expect(
      ConfigurazioneDellaPlancia.daiValori({'cd_sections': '{"home":true}'})
          .configurata,
      isFalse,
    );
  });

  test('le stanze, in ordine, con le loro sonde', () {
    final stanze = config.stanze;
    expect(stanze.map((s) => s.nome), [
      'Soggiorno',
      'Cucina',
      'Camera',
      'Cameretta',
      'Bagno',
      'Studio',
      'Garage',
    ]);
    expect(stanze.first.temperatura, 'sensor.soggiorno_temperatura');
    expect(stanze.first.umidita, 'sensor.soggiorno_umidita');
    expect(stanze.first.piano, 'Piano terra');
    expect(config.stanza('room-bagno')?.nome, 'Bagno');
    expect(config.stanza('Bagno')?.id, 'room-bagno');
  });

  test('le luci raggruppate per stanza, nell\'ordine delle stanze', () {
    final gruppi = config.gruppiDiLuci();
    expect(gruppi.map((g) => g.stanza), [
      'Soggiorno',
      'Cucina',
      'Camera',
      'Cameretta',
      'Bagno',
      'Studio',
      'Garage',
    ]);
    expect(gruppi.first.entita, [
      'light.soggiorno_faretti',
      'light.soggiorno_strip',
    ]);
    expect(gruppi.first.nome('light.soggiorno_strip'), 'Strip TV');
    /* Una presa configurata fra le luci e' una luce: e' cosi' che la plancia
     * la tratta. */
    expect(gruppi.last.entita, ['switch.esterno_giardino']);
  });

  test('senza la forma legacy le luci si leggono dalla copia canonica', () {
    final solo = ConfigurazioneDellaPlancia.daiValori({
      'dm_dashboard_state':
          '{"schema_version":4,"sections":{"rooms":[{"id":"room-a","name":"Sala"}],'
          '"lights":[{"id":"l1","name":"Lampada","entity":"light.sala","room_id":"room-a"},'
          '{"id":"l2","name":"Ingresso","entity":"light.ingresso"}]}}',
    });
    final gruppi = solo.gruppiDiLuci();
    expect(gruppi.map((g) => g.stanza), ['Sala', 'Altre zone']);
    expect(gruppi.first.nome('light.sala'), 'Lampada');
  });

  test('clima, finestre, elettrodomestici, telecamere, auto', () {
    expect(config.unitaClima.length, 5);
    expect(config.unitaClima.map((u) => u.tipo).toSet(), {'clima', 'termo'});
    expect(config.coperture.map((c) => c.entita), [
      'cover.soggiorno',
      'cover.cucina',
      'cover.camera',
      'cover.cameretta',
    ]);
    expect(config.coperture.first.contatto, 'binary_sensor.finestra_soggiorno');
    expect(config.elettrodomestici.map((e) => e.nome), [
      'Lavatrice',
      'Lavastoviglie',
      'Asciugatrice',
      'Forno',
      'Frigorifero',
      'Robot aspirapolvere',
    ]);
    expect(config.elettrodomestici.first.sogliaAvvio, 8);
    expect(config.telecamere.map((t) => t.nome), ['Ingresso', 'Giardino']);
    expect(config.vetture.single.marca, 'Tesla');
  });

  test('gli impianti: il primo e quello della dependance', () {
    final impianti = config.impianti;
    expect(impianti.length, 2);
    expect(impianti.first.casa['power'], 'sensor.casa_potenza');
    expect(impianti.last.nome, 'Dependance');
    expect(impianti.last.configurato, isTrue);
    expect(config.unaTesseraPerImpianto, isFalse);
  });

  test('le caselle dell\'editor risolvono i riferimenti', () {
    expect(config.entita('dm.home_meteo'), 'weather.casa');
    expect(
      config.entita('dm.security_centrale_allarme'),
      'alarm_control_panel.casa',
    );
    expect(config.entita('dm.non_esiste'), isNull);
  });

  test('piscina, irrigazione, robot, prese', () {
    expect(config.piscina?.vasche.length, 1);
    expect(config.irrigazione?.zone.map((z) => z.nome), [
      'Prato fronte',
      'Prato retro',
      'Siepe',
      'Orto',
    ]);
    expect(config.irrigazione?.zone[1].minuti, 20);
    expect(config.robot.single.entita, 'vacuum.robot');
    expect(config.prese.map((p) => p.etichetta), [
      'TV salotto',
      'Firestick',
      'Modem',
      'Presa camera',
    ]);
    expect(config.soloLettura, {'switch.presa_modem'});
    expect(config.siComanda('switch.presa_modem'), isFalse);
    expect(config.siComanda('switch.presa_tv'), isTrue);
  });

  test('le persone, con i loro sensori e il colore', () {
    final persone = config.persone;
    expect(persone.map((p) => p.nome), ['Giovanni', 'Laura', 'Marco']);
    expect(persone[1].distanza, 'sensor.laura_distanza');
    expect(persone[1].viaggio, 'sensor.laura_tempo_rientro');
    expect(persone[1].colore, '#ec4899');
    expect(persone[1].conLaFaccia, isTrue);
  });

  test('le azioni rapide, gli avvisi, le porte, i lettori, l\'UPS', () {
    expect(config.azioniRapide.map((a) => a.nome), [
      'Luci',
      'Clima',
      'Antifurto',
      'Lavatrice',
      'Cancello',
      'Irrigazione',
    ]);
    expect(config.azioniRapide[4].tipo, 'script');
    expect(config.azioniRapide[4].entita, 'script.apri_cancello');
    expect(config.avvisi.map((a) => a.nome), [
      'Finestra cucina',
      'Porta ingresso',
    ]);
    expect(config.avvisi.first.entita, ['binary_sensor.finestra_cucina']);
    expect(config.porte.map((p) => p.nome), ['Portone', 'Garage']);
    expect(config.lettori.map((l) => l.nome), ['Salone', 'Cucina', 'Camera']);
    expect(config.ups.single.nome, 'UPS rack');
    expect(config.ups.single.entita.length, 8);
  });

  test(
    'le preferenze dei widget e l\'ordine dei blocchi, quando non ci sono',
    () {
      expect(config.widget.nascoste, isEmpty);
      expect(config.widget.ordine, isEmpty);
      expect(config.widget.dentro('light.qualunque'), isTrue);
      expect(config.ordineDeiBlocchi, [
        'persone',
        'widget',
        'azioni',
        'dispositivi',
      ]);
      expect(config.titolo, '');
      expect(config.visibilita['luci'], isTrue);
    },
  );

  test('le preferenze dei widget, quando ci sono', () {
    final con = ConfigurazioneDellaPlancia.daiValori({
      'cd_widgets': '{"hidden":["todo","calendario","piscina"],"order":["clima","calendario"],"excluded":["light.x"],"sorgenti":{"clima":"climate.camera"}}',
      'cd_home_blocchi': '["azioni","widget","boh","widget"]',
      'cd_branding': '{"title":"Casa al mare"}',
    });
    expect(con.widget.nascoste, {'piscina', 'agenda'});
    expect(con.widget.ordine, ['clima', 'agenda']);
    expect(con.widget.dentro('light.x'), isFalse);
    expect(con.widget.sorgenti['clima'], 'climate.camera');
    expect(con.ordineDeiBlocchi, [
      'azioni',
      'widget',
      'persone',
      'dispositivi',
    ]);
    expect(con.titolo, 'Casa al mare');
  });
}
