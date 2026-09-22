/// Le prove del giro alla rete Zigbee, viste dall'app (#54).
///
/// Contro un ponte finto ma **vero**: si alza un server, si apre un filo, e le
/// domande passano di li'. Quello che si prova non e' che la classe componga
/// bene una mappa — quello lo si vede leggendolo — ma che quattro comandi
/// arrivino con la forma che il ponte vero si aspetta, e che quello che torna
/// diventi quello che la schermata disegna.
///
/// La riga che conta di piu' e' `_andataBene`: il ponte a un ordine che non
/// puo' eseguire non risponde «no». Risponde «si'» con dentro `fatto: false` e
/// il motivo, ed e' il caso in cui un tasto premuto non fa niente **e non lo
/// dice**. Qui sotto ci sono tre prove per quello solo.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/zigbee.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/filo.dart';

import '../ponte/ponte_finto.dart';

void main() {
  late PonteFinto ponte;
  late Filo filo;
  late Zigbee zigbee;

  setUp(() async {
    ponte = await PonteFinto.alza();
    filo = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
    );
    await filo.apri();
    zigbee = Zigbee(filo);
  });

  tearDown(() async {
    await filo.chiudi();
    await ponte.spegni();
  });

  /* Che la domanda sia **arrivata**: il vuoto che torna da un ponte che non
   * risponde affatto ha la stessa faccia del vuoto di una casa senza Zigbee. */
  void laDomandaCEArrivata(String quale) {
    expect(
      ponte.chieste.any((detto) => detto['type'] == quale),
      isTrue,
      reason: 'il ponte non ha nemmeno sentito $quale',
    );
  }

  test('in una casa senza Zigbee non c\'è nessuna rete', () async {
    final stato = await zigbee.stato();
    laDomandaCEArrivata('ponte/zigbee/stato');
    expect(stato.rete, LaRete.nessuna);
    expect(stato.rete.siApre, isFalse);
    expect(stato.aperta, isFalse);
    expect(stato.entrati, isEmpty);
  });

  test('con ZHA la rete si riconosce, e si sa come si chiama', () async {
    ponte.laReteZigbee = 'zha';
    final stato = await zigbee.stato();
    expect(stato.rete, LaRete.zha);
    expect(stato.rete.nome, 'ZHA');
    expect(stato.rete.siApre, isTrue);
  });

  test('con Zigbee2MQTT pure, ed è un\'altra rete', () async {
    ponte.laReteZigbee = 'zigbee2mqtt';
    final stato = await zigbee.stato();
    expect(stato.rete, LaRete.z2m);
    expect(stato.rete.nome, 'Zigbee2MQTT');
  });

  test('una rete che non conosciamo vale come nessuna', () async {
    /* Un ponte più nuovo di questa app: meglio «non so aprire niente» che una
     * schermata che offre un tasto per una cosa che non sa fare. */
    ponte.laReteZigbee = 'thread';
    expect((await zigbee.stato()).rete, LaRete.nessuna);
  });

  test('aprire la rete la apre, e il conto alla rovescia è il suo', () async {
    ponte.laReteZigbee = 'zha';
    final stato = await zigbee.apri();
    laDomandaCEArrivata('ponte/zigbee/apri');
    expect(stato.aperta, isTrue);
    expect(stato.rete, LaRete.zha);
    expect(stato.restano, greaterThan(0));
    /* E non è entrato nessuno: l'elenco lo svuota il ponte a ogni apertura, e
     * chi guarda non deve vedersi proporre il dispositivo di ieri. */
    expect(stato.entrati, isEmpty);
  });

  test('per quanto si apre lo può dire chi la apre', () async {
    ponte.laReteZigbee = 'zha';
    final stato = await zigbee.apri(secondi: 60);
    expect(stato.restano, 60);
  });

  test('richiuderla la richiude', () async {
    ponte.laReteZigbee = 'zha';
    await zigbee.apri();
    final stato = await zigbee.chiudi();
    laDomandaCEArrivata('ponte/zigbee/chiudi');
    expect(stato.aperta, isFalse);
    expect(stato.restano, 0);
  });

  /* ─── «sì, ma no» ──────────────────────────────────────────────────────── */

  test('aprire dove non c\'è niente da aprire lo dice, invece di tacere', () {
    /* Senza questo controllo il tasto premuto su una casa senza Zigbee non
     * faceva niente e non lo diceva: il ponte risponde «sì» con dentro
     * `fatto: false`, e una risposta riuscita con dentro un no è la cosa più
     * facile da leggere come un sì. */
    expect(
      () => zigbee.apri(),
      throwsA(
        isA<ComandoRifiutato>().having(
          (male) => male.spiegazione,
          'il motivo',
          contains('Zigbee'),
        ),
      ),
    );
  });

  test('e richiuderla dove non c\'è pure', () {
    expect(() => zigbee.chiudi(), throwsA(isA<ComandoRifiutato>()));
  });

  test('un nome vuoto lo rifiuta il ponte, e si sente', () async {
    ponte.laReteZigbee = 'zha';
    expect(
      () => zigbee.rinomina('abc', '   '),
      throwsA(isA<ComandoRifiutato>()),
    );
  });

  /* ─── il nome ──────────────────────────────────────────────────────────── */

  test('il nome arriva al registro, non solo alla risposta', () async {
    ponte.laReteZigbee = 'zha';
    final suo = await zigbee.rinomina('dev-1', 'Lampadario cucina');
    laDomandaCEArrivata('ponte/zigbee/rinomina');
    /* Che la risposta dica il nome nuovo conta poco: conta che il ponte
     * l'abbia scritto dove lo leggono tutti. */
    expect(ponte.rinominatiInZigbee['dev-1'], 'Lampadario cucina');
    expect(suo.id, 'dev-1');
    expect(suo.nome, 'Lampadario cucina');
  });

  test(
    'marca e modello tornano insieme, per far dire «ah, è quello»',
    () async {
      ponte.laReteZigbee = 'zha';
      final suo = await zigbee.rinomina('dev-1', 'Lampadario');
      expect(suo.comeSiRiconosce, 'IKEA · TRADFRI bulb E27');
    },
  );

  test('quello che manca non lascia un separatore appeso', () {
    const nudo = DispositivoEntrato(
      id: 'x',
      nome: 'X',
      marca: 'IKEA',
      modello: '',
      tramite: '',
    );
    expect(nudo.comeSiRiconosce, 'IKEA');
  });

  /* ─── chi è entrato ────────────────────────────────────────────────────── */

  test('chi è entrato arriva dentro lo stato, con quello che si sa', () async {
    ponte.laReteZigbee = 'zigbee2mqtt';
    await zigbee.apri();
    ponte.entratiInZigbee.add({
      'id': 'dev-9',
      'nome': 'TS0121',
      'marca': 'TuYa',
      'modello': 'TS0121',
      'tramite': 'mqtt',
    });
    final stato = await zigbee.stato();
    expect(stato.entrati, hasLength(1));
    expect(stato.entrati.first.id, 'dev-9');
    expect(stato.entrati.first.nome, 'TS0121');
    expect(stato.entrati.first.tramite, 'mqtt');
  });

  test('una riga storta nell\'elenco non porta giù le altre', () async {
    ponte.laReteZigbee = 'zha';
    await zigbee.apri();
    ponte.entratiInZigbee.addAll([
      {'id': 'dev-1', 'nome': 'Uno'},
      {'nome': 'senza identificativo'},
    ]);
    final stato = await zigbee.stato();
    /* Tutte e due si leggono: quella senza `id` resta con l'identificativo
     * vuoto, e a buttarla via è il passo dopo, non chi legge. Qui non si
     * perde niente in silenzio. */
    expect(stato.entrati, hasLength(2));
    expect(stato.entrati.first.id, 'dev-1');
    expect(stato.entrati.last.id, '');
  });

  /* ─── cosa si consegna alla plancia ────────────────────────────────────── */

  test('il dispositivo porta con sé le sue entità', () async {
    ponte.laReteZigbee = 'zha';
    await zigbee.apri();
    ponte.entratiInZigbee.add({
      'id': 'dev-1',
      'nome': 'TS0121',
      'entita': [
        {'entity': 'switch.ts0121', 'classe': 'outlet', 'categoria': ''},
        {
          'entity': 'sensor.ts0121_rssi',
          'classe': 'signal_strength',
          'categoria': 'diagnostic',
        },
      ],
    });
    final suo = (await zigbee.stato()).entrati.first;
    expect(suo.entita, hasLength(2));
    expect(suo.entita.first.entity, 'switch.ts0121');
    expect(suo.entita.first.classe, 'outlet');
    expect(suo.entita.last.categoria, 'diagnostic');
  });

  test('e le consegna alla plancia tutte, non solo la prima', () {
    /* Quale delle sei dica cos'è l'oggetto lo sa la plancia, che le sue
     * sezioni le conosce: da qui si passano tutte, e si sceglie di là. */
    const suo = DispositivoEntrato(
      id: 'dev-1',
      nome: 'Presa lavatrice',
      marca: 'TuYa',
      modello: 'TS0121',
      tramite: 'zha',
      entita: [
        UnEntita(entity: 'switch.ts0121', classe: 'outlet', categoria: ''),
        UnEntita(entity: 'sensor.ts0121_w', classe: 'power', categoria: ''),
      ],
    );
    final detto = suo.perLaPlancia;
    expect(detto['nome'], 'Presa lavatrice');
    expect(detto['entity'], 'switch.ts0121');
    expect(detto['entita'], hasLength(2));
  });

  test('un dispositivo senza entità non ha niente da consegnare', () {
    const nudo = DispositivoEntrato(
      id: 'x',
      nome: 'X',
      marca: '',
      modello: '',
      tramite: '',
    );
    expect(nudo.entita, isEmpty);
    expect(nudo.perLaPlancia['entity'], '');
  });

  test('col filo giù non si solleva: non c\'è nessuna rete, e basta', () async {
    await filo.chiudi();
    final stato = await zigbee.stato();
    expect(stato.rete, LaRete.nessuna);
  });

  test('lo stato chiesto in fila arriva finché si ascolta', () async {
    ponte.laReteZigbee = 'zha';
    await zigbee.apri();
    final visti = <StatoDellaRete>[];
    final ascolto = zigbee
        .mentreAspetti(ogni: const Duration(milliseconds: 20))
        .listen(visti.add);
    /* Il primo arriva subito e non dopo il primo giro: chi apre la schermata
     * deve vedere qualcosa mentre la apre, non un buco che si riempie dopo. */
    await Future<void>.delayed(const Duration(milliseconds: 5));
    expect(visti, hasLength(1));
    await Future<void>.delayed(const Duration(milliseconds: 70));
    expect(visti.length, greaterThan(1));
    await ascolto.cancel();
    final quanti = visti.length;
    await Future<void>.delayed(const Duration(milliseconds: 60));
    /* E smettendo di ascoltare smette di chiedere: un giro al secondo che
     * sopravvive a chi lo guardava è un giro al secondo per sempre. */
    expect(visti, hasLength(quanti));
  });
}
