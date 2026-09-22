/// Le prove delle segnalazioni: quello che l'app chiede al ponte e quello
/// che ne ricava.
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/segnalazioni.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/filo.dart';

import '../ponte/ponte_finto.dart';

void main() {
  late PonteFinto ponte;
  late Filo filo;

  setUp(() async {
    ponte = await PonteFinto.alza();
    filo = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
    );
    await filo.apri();
  });

  tearDown(() async {
    await filo.chiudi();
    await ponte.spegni();
  });

  test('si apre una segnalazione, la si rilegge, si risponde', () async {
    final mie = Segnalazioni(filo);
    final vuoto = await mie.elenco();
    expect(vuoto.spedibili, isTrue);
    expect(vuoto.segnalazioni, isEmpty);

    final aperta = await mie.crea(
      tipo: TipoDiSegnalazione.idea,
      titolo: 'Una tessera per la piscina',
      corpo: 'Sarebbe bello vederla in home.',
      diagnostica: const {'app': '10·3693d43', 'sistema': 'android'},
    );
    expect(aperta.numero, 7);
    expect(aperta.tipo, TipoDiSegnalazione.idea);
    expect(aperta.aperta, isTrue);
    expect(aperta.apertaIl, isNotNull);
    expect(aperta.messaggi.single.dallaCasa, isTrue);
    expect(aperta.messaggi.single.testo, 'Sarebbe bello vederla in home.');
    final mandata = ponte.arrivati.lastWhere(
      (uno) => uno['type'] == 'ponte/segnalazioni/crea',
    );
    expect(mandata['tipo'], 'idea');
    expect(mandata['diagnostica'], {'app': '10·3693d43', 'sistema': 'android'});

    final elenco = await mie.elenco();
    expect(elenco.segnalazioni.single.titolo, 'Una tessera per la piscina');
    expect(elenco.segnalazioni.single.quantiMessaggi, 1);
    expect(elenco.segnalazioni.single.messaggi, isEmpty, reason: 'la riga');

    ponte.rispondeIlManutentore(7, 'Buona idea.');
    final riletta = await mie.leggi(7);
    expect(riletta.messaggi, hasLength(2));
    expect(riletta.messaggi.last.dallaCasa, isFalse);

    final risposta = await mie.rispondi(7, 'Grazie!');
    expect(risposta.messaggi, hasLength(3));
    expect(risposta.messaggi.last.testo, 'Grazie!');
  });

  test(
    'un allegato va al ponte in base64, e torna nel filo come messaggio',
    () async {
      final mie = Segnalazioni(filo);
      final aperta = await mie.crea(
        tipo: TipoDiSegnalazione.problema,
        titolo: 'La luce',
        corpo: 'Non va.',
      );
      final foto = Allegato(
        nome: 'cucina.jpg',
        tipo: 'image/jpeg',
        byte: Uint8List.fromList([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
      );
      expect(foto.foto, isTrue);
      expect(foto.peso, '7 B');

      final conFoto = await mie.allega(aperta.numero, foto);
      expect(conFoto.messaggi.last.testo, '📷 cucina.jpg (7 B)');
      expect(conFoto.messaggi.last.dallaCasa, isTrue);

      final arrivato = ponte.allegati.single;
      expect(arrivato['nome'], 'cucina.jpg');
      expect(arrivato['tipo'], 'image/jpeg');
      expect(arrivato['byte'], 7);
      final mandato = ponte.arrivati.lastWhere(
        (uno) => uno['type'] == 'ponte/segnalazioni/allega',
      );
      expect(base64.decode(mandato['byte'] as String), foto.byte);

      /* Un video, e il suo disegno. Alla chat non si allega niente: quella
       * passa parole, e una prova va dove resta scritta accanto al difetto
       * che mostra. */
      final clip = Allegato(
        nome: 'clip.mp4',
        tipo: 'video/mp4',
        byte: Uint8List(4),
      );
      expect(clip.foto, isFalse);
      final conClip = await mie.allega(aperta.numero, clip);
      expect(conClip.messaggi.last.testo, '🎬 clip.mp4 (4 B)');
    },
  );

  test('i pesi si leggono, e i no sugli allegati diventano frasi', () {
    expect(pesoLeggibile(512), '512 B');
    expect(pesoLeggibile(200 * 1024), '200 KB');
    expect(pesoLeggibile(3 * 1024 * 1024 + 300 * 1024), '3.3 MB');
    expect(
      spiegaLErrore(const ComandoRifiutato('x', codice: 'troppo_grande')),
      contains('10 MB'),
    );
    expect(
      spiegaLErrore(const ComandoRifiutato('x', codice: 'tipo_non_ammesso')),
      contains('solo foto e video'),
    );
    expect(
      spiegaLErrore(
        const ComandoRifiutato('GitHub ha risposto 403', codice: 'github'),
      ),
      contains('Contents: Read and write'),
    );
  });

  test('la chat: niente, poi un filo solo', () async {
    final mie = Segnalazioni(filo);
    expect((await mie.chat()).filo, isNull);
    final prima = await mie.chatta(
      'Buongiorno',
      diagnostica: const {'app': '10'},
    );
    expect(prima.chat, isTrue);
    expect(prima.messaggi.single.testo, 'Buongiorno');
    ponte.rispondeIlManutentore(prima.numero, 'Dimmi pure.');
    final seconda = await mie.chatta('Come si fa a…');
    expect(seconda.numero, prima.numero);
    expect(seconda.messaggi.map((uno) => uno.testo), [
      'Buongiorno',
      'Dimmi pure.',
      'Come si fa a…',
    ]);
    final riletta = await mie.chat();
    expect(riletta.filo!.messaggi, hasLength(3));
    /* Nessun guasto: il ponte finto risponde, e allora non c'e' niente da
     * dire accanto alle parole. */
    expect(riletta.guaio, isEmpty);
  });

  test('i no del ponte diventano frasi', () async {
    ponte.conIlCentralino = false;
    final mie = Segnalazioni(filo);
    expect((await mie.elenco()).spedibili, isFalse);
    Object? errore;
    try {
      await mie.crea(
        tipo: TipoDiSegnalazione.problema,
        titolo: 't',
        corpo: 'c',
      );
    } catch (e) {
      errore = e;
    }
    expect(errore, isA<ComandoRifiutato>());
    expect(spiegaLErrore(errore!), contains('nessun centralino'));
    expect(
      spiegaLErrore(const ComandoRifiutato('x', codice: 'troppe')),
      contains('Troppe'),
    );
    expect(
      spiegaLErrore(const ComandoRifiutato('x', codice: 'unknown_command')),
      contains('aggiorna l\'add-on'),
    );
    expect(spiegaLErrore(const ComandoRifiutato('boh')), 'boh');
  });

  /* Il rifiuto di Home Assistant non e' il ponte che e' vecchio.
   *
   * Dal campo, con l'add-on aggiornato: la schermata Zigbee diceva in cima
   * «gdahome in casa e' piu' vecchio dell'app: aggiorna l'add-on», e tre
   * centimetri sotto mostrava la scheda ZHA piena — «e' la rete che c'e' in
   * questa casa». Le due cose non potevano essere vere insieme.
   *
   * La catena: premendo «Apri la rete» il ponte manda a Home Assistant
   * `zha/permit`; se Home Assistant quel comando sul filo non ce l'ha
   * risponde `unknown_command`, e il ponte lo rilanciava tale e quale.
   * `unknown_command` vuol dire «chi ha ricevuto questa domanda non la
   * conosce», e rilanciandolo si cambiava chi l'aveva ricevuta: era Home
   * Assistant, non il ponte.
   *
   * Adesso il ponte manda un codice suo, e qui si tiene fermo che l'app lo
   * conosca e che non mandi ad aggiornare niente. */
  test('un rifiuto di Home Assistant non manda ad aggiornare l\'add-on', () {
    final detto = spiegaLErrore(
      const ComandoRifiutato('x', codice: 'zigbee_non_accettato'),
    );
    expect(detto, contains('Home Assistant'));
    expect(detto, contains('ZHA'));
    expect(detto, isNot(contains('aggiorna l\'add-on')));
    /* E resta diverso da quello che il ponte dice di se stesso: due codici
     * che dicono la stessa frase sarebbero un codice solo. */
    expect(
      detto,
      isNot(spiegaLErrore(const ComandoRifiutato('x', codice: 'unknown_command'))),
    );
  });
}
