/// Dopo un aggiornamento dell'add-on, la casa si ritrova da sola.
///
/// «Quando aggiorno l'add-on puntualmente devo cancellare la casa sull'app e
/// ricollegarmi.» E a schermo: «Casa · non raggiungibile», e sotto «Fuori
/// casa serve gdahome Premium» — con la casa Premium.
///
/// Un aggiornamento, per l'app, e' una casa che per qualche minuto non c'e':
/// il centralino dice «casa non collegata» finche' l'add-on nuovo non si
/// riattacca. L'add-on nuovo e' la stessa casa (lo provano le prove del
/// ponte, `dopo-l-aggiornamento.test.js`): stesso identificativo, stessa
/// chiave del filo, stesso gettone. Quello che si rompeva era qui:
///
///  - una casa che l'app credeva Base si provava da fuori **una volta
///    sola**, e se quella bussata cadeva nei minuti dell'aggiornamento la
///    pagina Premium restava, il filo bussava solo alle strade di casa, e il
///    tetto dei dieci minuti era gia' speso — anche tirando giu' per
///    aggiornare. Riabbinare toglieva il gettone, e con lui tutto questo;
///  - «non ti trovo» diventava «serve Premium» anche per una casa che
///    l'app aveva visto Premium da poco;
///  - un gettone nuovo, mentre si scriveva nel portachiavi, lasciava un
///    attimo in cui la casa sembrava Base: chi bussava in quell'attimo — un
///    filo che cade, come cade quando l'add-on si riavvia — bussava solo in
///    casa.
library;

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/licenza/licenza.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/presa.dart';
import 'package:gdahome/ponte/sonda.dart';

import '../ponte/ponte_finto.dart';
import 'gettoni_di_prova.dart';

/// Una cassaforte lenta a scrivere, come un portachiavi vero che ci mette il
/// suo: e' in quell'attesa che si guarda.
class CassaforteLenta implements Cassaforte {
  final _dentro = CassaforteInMemoria();
  Completer<void>? cancello;

  @override
  Future<String?> leggi(String chiave) => _dentro.leggi(chiave);

  @override
  Future<void> scrivi(String chiave, String valore) async {
    final aspetta = cancello;
    if (aspetta != null) await aspetta.future;
    await _dentro.scrivi(chiave, valore);
  }

  @override
  Future<void> cancella(String chiave) => _dentro.cancella(chiave);
}

void main() {
  late ArchivioDelleCase archivio;
  late PonteFinto ponte;
  Collegamento? collegamento;

  final centralino = IndirizzoDelCentralino.leggi(
    'wss://centralino.esempio.it',
  )!;
  /* Fuori casa: la strada di casa non risponde. */
  final inCasaLontana = IndirizzoDelPonte.leggi('192.168.1.50')!;

  setUp(() async {
    archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();
    ponte = await PonteFinto.alza();
  });

  tearDown(() async {
    await collegamento?.chiudi();
    collegamento = null;
    await ponte.spegni();
  });

  /// L'add-on che si aggiorna: il centralino c'e', la casa no.
  void laCasaSiAggiorna() {
    ponte.chiudeSubitoDicendo = 'casa non collegata';
    unawaited(ponte.buttaGiu());
  }

  /// L'add-on nuovo si riattacca al centralino.
  void laCasaETornata() => ponte.chiudeSubitoDicendo = null;

  Collegamento unCollegamento({GestoreLicenza? licenza}) {
    final nuovo = Collegamento(
      archivio: archivio,
      licenza: licenza ?? GestoreLicenza(chiave: chiaveDiProva),
      apriLaPresa: (dove) => PresaSuWebSocket.apri(
        dove.host == centralino.salute.host ? ponte.indirizzo.filo : dove,
      ),
      sonda: Sonda(
        attesa: const Duration(milliseconds: 200),
        vantaggio: const Duration(milliseconds: 40),
        bussa: (dove) async => dove == centralino.salute,
      ),
    );
    collegamento = nuovo;
    return nuovo;
  }

  Future<String> unaCasa({String? gettone}) async {
    final casa = await archivio.aggiungi(
      nome: 'Casa',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      casaAlCentralino: casaDiProva,
      centralino: centralino,
      inCasa: inCasaLontana,
    );
    if (gettone != null) await archivio.segnaIlGettone(casa.id, gettone);
    return casa.id;
  }

  /// Quello che si e' visto a schermo, a ogni cambiamento.
  List<String> guarda(Collegamento collegamento) {
    final visti = <String>[];
    collegamento.cambiamenti.listen((_) {
      visti.add(
        '${collegamento.comeVa.name}'
        '${collegamento.fuoriCasaSenzaPremium ? ' premium' : ''}'
        '${collegamento.siRiconnette ? ' riconnessione' : ''}',
      );
    });
    return visti;
  }

  test('creduta Base, aperta mentre l\'add-on si aggiorna: appena torna si '
      'entra da sola, senza riabbinare', () async {
    final gettone = await firmaUnGettone(origine: 'regalo', perSempre: true);
    ponte.licenza = {
      'gettoni': {'gdahome': gettone},
    };
    final id = await unaCasa(gettone: '');
    final collegamento = unCollegamento();

    laCasaSiAggiorna();
    await collegamento.apri();
    expect(collegamento.comeVa, ComeVa.irraggiungibile);

    laCasaETornata();
    await _finoA(() => collegamento.comeVa == ComeVa.aperta);
    expect(
      collegamento.comeVa,
      ComeVa.aperta,
      reason: 'la casa e\' tornata, e l\'app restava sulla pagina Premium',
    );
    expect(collegamento.fuoriCasaSenzaPremium, isFalse);
    expect(collegamento.daDove, DaDove.dalCentralino);
    expect(archivio.quella(id)!.gettone, gettone);
    expect(collegamento.licenza.premium, isTrue);
  });

  test('creduta Base: tirando giu\' per aggiornare subito dopo, si riprova da '
      'fuori — una bussata andata a vuoto non spende i dieci minuti', () async {
    final gettone = await firmaUnGettone(origine: 'regalo', perSempre: true);
    ponte.licenza = {
      'gettoni': {'gdahome': gettone},
    };
    await unaCasa(gettone: '');
    final collegamento = unCollegamento();

    laCasaSiAggiorna();
    await collegamento.apri();
    expect(collegamento.comeVa, ComeVa.irraggiungibile);

    laCasaETornata();
    await collegamento.apri(forza: true);
    await _finoA(() => collegamento.comeVa == ComeVa.aperta);
    expect(collegamento.comeVa, ComeVa.aperta);
    expect(collegamento.licenza.premium, isTrue);
  });

  test('Premium e l\'add-on si aggiorna mentre si e\' fuori: mai la pagina '
      'Premium, «riconnessione» finche\' non torna', () async {
    final gettone = await firmaUnGettone(origine: 'regalo', perSempre: true);
    ponte.licenza = {
      'gettoni': {'gdahome': gettone},
    };
    await unaCasa(gettone: gettone);
    final collegamento = unCollegamento();
    final visti = guarda(collegamento);
    await collegamento.apri();
    expect(collegamento.comeVa, ComeVa.aperta);

    /* L'app va in tasca, l'add-on si aggiorna, l'app torna davanti. */
    await collegamento.riposa();
    laCasaSiAggiorna();
    collegamento.sveglia();
    await _finoA(() => collegamento.comeVa == ComeVa.irraggiungibile);
    expect(collegamento.comeVa, ComeVa.irraggiungibile);
    expect(collegamento.siRiconnette, isTrue);
    expect(collegamento.fuoriCasaSenzaPremium, isFalse);

    laCasaETornata();
    await _finoA(() => collegamento.comeVa == ComeVa.aperta);
    expect(collegamento.comeVa, ComeVa.aperta);
    expect(collegamento.siRiconnette, isFalse);
    expect(
      visti.where((uno) => uno.contains('premium')),
      isEmpty,
      reason: 'la pagina Premium si e\' vista: $visti',
    );
  });

  test('Premium fino a poco fa, poi un gettone vuoto: la casa che non risponde '
      'e\' «riconnessione», non «serve Premium»', () async {
    final gettone = await firmaUnGettone(origine: 'regalo', perSempre: true);
    final id = await unaCasa();
    final licenza = GestoreLicenza(chiave: chiaveDiProva);
    await licenza.conosci(archivio.tutte);
    /* La casa l'ha detta Premium, e poi — una volta — senza gettone. */
    await licenza.ricordaLaRisposta(
      {
        'gettoni': {'gdahome': gettone},
      },
      archivio.quella(id)!,
      archivio,
    );
    await licenza.ricordaLaRisposta(
      {'gettoni': <String, String>{}},
      archivio.quella(id)!,
      archivio,
    );
    expect(archivio.quella(id)!.gettone, '');
    expect(licenza.premiumDiRecente(archivio.quella(id)!), isTrue);

    ponte.licenza = {
      'gettoni': {'gdahome': gettone},
    };
    final collegamento = unCollegamento(licenza: licenza);
    laCasaSiAggiorna();
    await collegamento.apri();
    expect(collegamento.comeVa, ComeVa.irraggiungibile);
    expect(collegamento.fuoriCasaSenzaPremium, isFalse);
    expect(collegamento.siRiconnette, isTrue);

    /* E ricordato resta anche riaprendo l'app: sta nell'archivio. */
    expect(archivio.quella(id)!.gettonePremium, gettone);

    laCasaETornata();
    await _finoA(() => collegamento.comeVa == ComeVa.aperta);
    expect(collegamento.comeVa, ComeVa.aperta);
    expect(archivio.quella(id)!.gettone, gettone);
  });

  test('mai stata Premium, e la casa non risponde: la pagina Premium come '
      'prima', () async {
    ponte.licenza = {'gettoni': <String, String>{}};
    await unaCasa(gettone: '');
    final collegamento = unCollegamento();
    laCasaSiAggiorna();
    await collegamento.apri();
    expect(collegamento.comeVa, ComeVa.irraggiungibile);
    expect(collegamento.fuoriCasaSenzaPremium, isTrue);
    expect(collegamento.siRiconnette, isFalse);
  });

  test(
    'Base davvero: quando torna lo dice, e il filo non si da\' a nessuno',
    () async {
      ponte.licenza = {'gettoni': <String, String>{}};
      final id = await unaCasa(gettone: '');
      final collegamento = unCollegamento();
      final dati = <bool>[];
      collegamento.cambiamenti.listen(
        (_) => dati.add(collegamento.filo?.dentro ?? false),
      );
      laCasaSiAggiorna();
      await collegamento.apri();
      laCasaETornata();
      /* Si riprova da fuori, la casa risponde Base: pagina Premium. */
      await _finoA(() => ponte.chieste.isNotEmpty);
      await _finoA(() => collegamento.fuoriCasaSenzaPremium);
      expect(collegamento.fuoriCasaSenzaPremium, isTrue);
      expect(collegamento.comeVa, isNot(ComeVa.aperta));
      expect(archivio.quella(id)!.gettone, '');
      expect(
        dati,
        isNot(contains(true)),
        reason: 'il filo si e\' dato da fuori',
      );
      expect(ponte.arrivati.map((uno) => uno['type']).toSet(), {
        'ponte/licenza/stato',
      });
    },
  );

  test(
    'un gettone nuovo non lascia un attimo in cui la casa sembra Base',
    () async {
      final cassaforte = CassaforteLenta();
      archivio = ArchivioDelleCase(cassaforte);
      await archivio.apri();
      final vecchio = await firmaUnGettone(
        origine: 'regalo',
        perSempre: true,
        emesso: DateTime.now().subtract(const Duration(hours: 6)),
      );
      final id = await unaCasa(gettone: vecchio);
      final licenza = GestoreLicenza(chiave: chiaveDiProva);
      await licenza.conosci(archivio.tutte);
      expect(licenza.stradeDaFuoriPer(archivio.quella(id)!), isTrue);

      /* Il gettone rinnovato dall'add-on appena riacceso, mentre il
     * portachiavi ci mette il suo a scriverlo. */
      final nuovo = await firmaUnGettone(origine: 'regalo', perSempre: true);
      cassaforte.cancello = Completer<void>();
      final scrive = licenza.ricordaLaRisposta(
        {
          'gettoni': {'gdahome': nuovo},
        },
        archivio.quella(id)!,
        archivio,
      );
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(
        licenza.stradeDaFuoriPer(archivio.quella(id)!),
        isTrue,
        reason: 'mentre si scriveva il gettone nuovo, la casa sembrava Base',
      );
      cassaforte.cancello!.complete();
      await scrive;
      expect(archivio.quella(id)!.gettone, nuovo);
      expect(licenza.premiumDi(archivio.quella(id)), isTrue);
    },
  );

  test('un portachiavi che non scrive non lascia la casa a meta\'', () async {
    final cassaforte = _CassaforteCheNonScrive();
    archivio = ArchivioDelleCase(cassaforte);
    await archivio.apri();
    final id = await unaCasa();
    cassaforte.rotta = true;
    final licenza = GestoreLicenza(chiave: chiaveDiProva);
    await licenza.conosci(archivio.tutte);
    final gettone = await firmaUnGettone(origine: 'regalo', perSempre: true);
    await licenza.ricordaLaRisposta(
      {
        'gettoni': {'gdahome': gettone},
      },
      archivio.quella(id)!,
      archivio,
    );
    expect(licenza.premiumDi(archivio.quella(id)), isTrue);
    expect(licenza.stradeDaFuoriPer(archivio.quella(id)!), isTrue);
  });
}

class _CassaforteCheNonScrive implements Cassaforte {
  final _dentro = CassaforteInMemoria();
  bool rotta = false;

  @override
  Future<String?> leggi(String chiave) => _dentro.leggi(chiave);

  @override
  Future<void> scrivi(String chiave, String valore) async {
    if (rotta) throw StateError('il portachiavi non scrive');
    await _dentro.scrivi(chiave, valore);
  }

  @override
  Future<void> cancella(String chiave) => _dentro.cancella(chiave);
}

Future<void> _finoA(bool Function() finche) async {
  for (var i = 0; i < 400 && !finche(); i += 1) {
    await Future<void>.delayed(const Duration(milliseconds: 25));
  }
}
