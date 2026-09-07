/// Da dove si entra, adesso.
///
/// Una casa ha due indirizzi per la stessa istanza: quello di rete locale e
/// quello di fuori. Quale dei due funziona dipende da dove sta il telefono in
/// questo momento, e cambia mentre l'app e' aperta — si esce dal portone e il
/// primo smette di rispondere a meta' frase.
///
/// La sonda risolve la domanda nel modo piu' stupido che funziona: **li chiede
/// tutti e due insieme e tiene il primo che risponde**. Non prova a indovinare
/// guardando il nome del Wi-Fi, non chiede permessi di rete che poi vanno
/// spiegati al negozio, e non sbaglia quando qualcuno ha una VPN sempre accesa
/// o due reti che si chiamano uguale.
///
/// Il costo e' una richiesta in piu' verso un indirizzo che spesso non
/// risponde. Il guadagno e' che non c'e' niente da configurare e niente da
/// spiegare.
library;

import 'dart:async';

import '../casa/casa_conosciuta.dart';
import 'abbinamento.dart';
import 'errori.dart';
import 'indirizzo.dart';

/// Quanto si aspetta una risposta prima di considerare morto un indirizzo.
///
/// Corto apposta: un indirizzo di rete locale, quando c'e', risponde in
/// millesimi. Quando non c'e' — perche' si e' fuori — o rifiuta subito, o non
/// risponde affatto, e in quel caso si aspetta questo e poi si tira via.
const Duration attesaDellaSonda = Duration(seconds: 4);

typedef Bussata = Future<bool> Function(IndirizzoDelPonte dove);

Future<bool> _bussataVera(IndirizzoDelPonte dove) => Abbinamento.cePonte(dove);

class Approdo {
  const Approdo(this.da, this.dove);
  final DaDove da;
  final IndirizzoDelPonte dove;

  @override
  String toString() =>
      '$dove (${da == DaDove.daDentro ? 'da dentro' : 'da fuori'})';
}

class Sonda {
  const Sonda({Bussata? bussa, this.attesa = attesaDellaSonda})
    : _bussa = bussa ?? _bussataVera;

  final Bussata _bussa;
  final Duration attesa;

  /// Trova da dove si entra in questa casa.
  ///
  /// Solleva [PonteIrraggiungibile] quando non risponde nessuno dei due: e'
  /// una cosa diversa da «segno rifiutato», e la schermata la racconta in un
  /// altro modo.
  Future<Approdo> dove(CasaConosciuta casa) async {
    final candidati = casa.approdi();
    if (candidati.isEmpty) {
      throw const PonteIrraggiungibile('questa casa non ha nessun indirizzo');
    }
    if (candidati.length == 1) {
      final solo = candidati.first;
      if (await _risponde(solo.dove)) return Approdo(solo.da, solo.dove);
      throw PonteIrraggiungibile(_perche(casa));
    }

    /* Tutti insieme, e vince il primo che risponde. In serie si pagherebbe
     * l'attesa intera del primo ogni volta che si e' dall'altra parte. */
    final vincitore = Completer<Approdo>();
    var quantiHannoDettoNo = 0;
    for (final candidato in candidati) {
      unawaited(
        _risponde(candidato.dove).then((ha) {
          if (vincitore.isCompleted) return;
          if (ha) {
            vincitore.complete(Approdo(candidato.da, candidato.dove));
            return;
          }
          quantiHannoDettoNo += 1;
          if (quantiHannoDettoNo == candidati.length) {
            vincitore.completeError(PonteIrraggiungibile(_perche(casa)));
          }
        }),
      );
    }
    return vincitore.future;
  }

  Future<bool> _risponde(IndirizzoDelPonte dove) async {
    try {
      return await _bussa(dove).timeout(attesa, onTimeout: () => false);
    } catch (_) {
      return false;
    }
  }

  /// Il perche' cambia con quello che la casa ha: dire «controlla la rete» a
  /// chi non ha mai messo un indirizzo di fuori non serve a niente.
  static String _perche(CasaConosciuta casa) {
    /* Questo prima di tutti gli altri: e' l'errore che fa perdere piu' tempo,
     * perche' l'indirizzo *sembra* giusto — e' quello che Home Assistant
     * stessa da' per l'accesso remoto — e chi lo mette va a cercare il guasto
     * dove non c'e'. */
    if (casa.daFuoriCasa?.eLAccessoRemotoDiHomeAssistant ?? false) {
      return 'L\'accesso remoto di Home Assistant non arriva agli add-on: il suo '
          'tunnel finisce dentro Home Assistant, e il ponte sta su una porta '
          'sua. Non e\' una cosa che si possa configurare. Da fuori serve una '
          'VPN, oppure un proxy inverso davanti alla porta del ponte.';
    }
    if (casa.soloInCasa) {
      return 'Non trovo «${casa.nome}». Questa casa ha solo l\'indirizzo di rete '
          'locale: da fuori serve aggiungere anche l\'indirizzo pubblico.';
    }
    return 'Non trovo «${casa.nome}», ne\' in casa ne\' da fuori.';
  }
}
