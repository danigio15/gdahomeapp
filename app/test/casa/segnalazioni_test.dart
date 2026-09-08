/// Le prove delle segnalazioni: quello che l'app chiede al ponte e quello
/// che ne ricava.
library;

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

  test('la chat: niente, poi un filo solo', () async {
    final mie = Segnalazioni(filo);
    expect(await mie.chat(), isNull);
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
    expect((await mie.chat())!.messaggi, hasLength(3));
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
      contains('aggiornalo'),
    );
    expect(spiegaLErrore(const ComandoRifiutato('boh')), 'boh');
  });
}
