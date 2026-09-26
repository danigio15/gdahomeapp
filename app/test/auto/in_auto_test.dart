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

const _ricetta = RicettaDellAzione(
  id: '0|Cancello',
  dominio: 'switch',
  servizio: 'toggle',
  entita: 'switch.cancello',
);

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
    );
    expect(finita, ComeEFinitaInAuto.senzaCasa);
    expect(letture, 1);
  });
}
