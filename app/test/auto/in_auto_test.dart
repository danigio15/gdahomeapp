/// Il comando dell'auto eseguito senza aprire l'app.
///
/// Qui non c'è nessuna macchina attaccata e nessuna casa da chiamare: si prova
/// quello che si decide PRIMA di chiamare, che è la parte in cui si può fare
/// del male — eseguire un tasto che voleva qualcuno che guardasse, o eseguirlo
/// due volte.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/auto/in_auto.dart';
import 'package:gdahome/auto/la_foto.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';

const _ricetta = RicettaDellAzione(
  id: '0|Cancello',
  dominio: 'switch',
  servizio: 'toggle',
  entita: 'switch.cancello',
);

/// Un collegamento che non va da nessuna parte, e conta le chiusure.
class _FiloFinto extends Collegamento {
  _FiloFinto() : super(archivio: ArchivioDelleCase(CassaforteInMemoria()));
  var aperture = 0;
  var chiusure = 0;

  @override
  Future<void> apri({bool forza = false}) async => aperture += 1;

  @override
  Future<void> chiudi() async => chiusure += 1;
}

void main() {
  test('senza comando non si apre nessun filo', () async {
    /* Aprire il filo vuol dire trovare la casa, la stretta di mano e la
       cifratura: farlo per scoprire che non c'era niente da fare sarebbe
       lavoro e batteria per niente. */
    var aperto = false;
    final finita = await eseguiIlComandoDellAuto(
      prendiIlComando: () async => null,
      leRicette: () async => const [],
      apriLaCasa: () {
        aperto = true;
        throw StateError('non si doveva arrivare qui');
      },
    );
    expect(finita, ComeEFinitaInAuto.niente);
    expect(aperto, isFalse);
  });

  test('un tasto senza ricetta aspetta l\'app, e non si indovina', () async {
    /* Nessuna ricetta vuol dire «questo tasto vuole qualcuno che guardi» — una
       conferma da mostrare, un menu da far scegliere — e non «questo tasto è
       rotto». Eseguirlo a naso vorrebbe dire indovinare un servizio, e
       dall'altra parte c'è un cancello. */
    var aperto = false;
    final finita = await eseguiIlComandoDellAuto(
      prendiIlComando: () async => '2|Luci',
      leRicette: () async => const [_ricetta],
      apriLaCasa: () {
        aperto = true;
        throw StateError('non si doveva arrivare qui');
      },
    );
    expect(finita, ComeEFinitaInAuto.aspettaLApp);
    expect(aperto, isFalse);
  });

  test('l\'elenco cambiato non fa premere il tasto accanto', () async {
    /* Il segno porta il posto E il nome: se non torna, non si esegue. */
    for (final segno in <String>['1|Cancello', '0|Portone', '']) {
      final finita = await eseguiIlComandoDellAuto(
        prendiIlComando: () async => segno,
        leRicette: () async => const [_ricetta],
        apriLaCasa: () => throw StateError('non si doveva arrivare qui'),
      );
      expect(
        finita,
        segno.isEmpty
            ? ComeEFinitaInAuto.niente
            : ComeEFinitaInAuto.aspettaLApp,
        reason: segno,
      );
    }
  });

  test('la casa che non risponde non fa sparire il comando due volte', () async {
    /* Il filo che non si apre non è un guasto da mostrare: in macchina non c'è
       niente da guardare e nessuno da disturbare. E il comando è già stato
       tolto da chi l'ha letto, quindi non si ripete da solo. */
    var letture = 0;
    final finita = await eseguiIlComandoDellAuto(
      prendiIlComando: () async {
        letture += 1;
        return '0|Cancello';
      },
      leRicette: () async => const [_ricetta],
      apriLaCasa: () => throw StateError('la casa non c\'è'),
      premium: () async => true,
    );
    expect(finita, ComeEFinitaInAuto.senzaCasa);
    expect(letture, 1);
  });

  test('senza Premium il comando non apre il filo con la casa', () async {
    /* «Si è attivato Android Auto anche non avendo il Premium.» In auto la
       casa è Premium: un comando premuto in macchina con la casa Base non
       arriva a Home Assistant, e il filo non si apre nemmeno. */
    var aperto = false;
    final finita = await eseguiIlComandoDellAuto(
      prendiIlComando: () async => '0|Cancello',
      leRicette: () async => const [_ricetta],
      apriLaCasa: () {
        aperto = true;
        throw StateError('non si doveva arrivare qui');
      },
      premium: () async => false,
    );
    expect(finita, ComeEFinitaInAuto.senzaPremium);
    expect(aperto, isFalse);
  });

  test(
    'col filo dell\'app il comando passa di lì, e il filo resta aperto',
    () async {
      /* «Se clicco apri cancello non fa nulla, come se il comando non
       arrivasse.» Nella versione col navigatore in auto il filo con la casa
       e' gia' aperto nel motore dell'app: il comando lo usa, invece di
       aprirne un altro da capo in un secondo motore — e non lo chiude. */
      final dellApp = _FiloFinto();
      var nuovo = false;
      await eseguiIlComandoDellAuto(
        prendiIlComando: () async => '0|Cancello',
        leRicette: () async => const [_ricetta],
        premium: () async => true,
        laCasaDellApp: () => dellApp,
        apriLaCasa: () {
          nuovo = true;
          return _FiloFinto();
        },
      );
      expect(nuovo, isFalse, reason: 'nessun filo nuovo');
      expect(
        dellApp.aperture,
        1,
        reason: 'su un filo aperto apri non fa niente',
      );
      expect(dellApp.chiusure, 0, reason: 'il filo dell\'app non si chiude');
    },
  );

  test('un filo aperto apposta si chiude dopo', () async {
    final apposta = _FiloFinto();
    await eseguiIlComandoDellAuto(
      prendiIlComando: () async => '0|Cancello',
      leRicette: () async => const [_ricetta],
      premium: () async => true,
      apriLaCasa: () => apposta,
    );
    expect(apposta.chiusure, 1);
  });
}
