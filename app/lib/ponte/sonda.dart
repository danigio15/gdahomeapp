/// Da dove si entra, adesso.
///
/// Una casa ha fino a tre strade per la stessa istanza: l'indirizzo di rete
/// locale, il centralino, e — per chi se l'e' messo a mano — un indirizzo
/// pubblico. Quale funziona dipende da dove sta il telefono in questo momento,
/// e cambia mentre l'app e' aperta: si esce dal portone e la prima smette di
/// rispondere a meta' frase.
///
/// La sonda risolve la domanda nel modo piu' stupido che funziona: **le chiede
/// tutte insieme e tiene la prima che risponde**. Non prova a indovinare
/// guardando il nome del Wi-Fi, non chiede permessi di rete che poi vanno
/// spiegati al negozio, e non sbaglia quando qualcuno ha una VPN sempre accesa
/// o due reti che si chiamano uguale.
///
/// Con una regola sola in piu': **il centralino parte in ritardo**. Non e' un
/// dettaglio di prestazioni, e' la differenza fra una luce che si accende
/// quando la tocchi e una che ci mette mezzo secondo. Il centralino risponde
/// sempre — sta su internet, e' fatto per rispondere — quindi senza ritardo
/// vincerebbe anche dal divano, e ogni comando farebbe il giro del mondo per
/// arrivare a tre metri.
library;

import 'dart:async';

import '../casa/casa_conosciuta.dart';
import 'abbinamento.dart';
import 'errori.dart';
import 'indirizzo.dart';

/// Quanto si aspetta una risposta prima di considerare morta una strada.
///
/// Corto apposta: un indirizzo di rete locale, quando c'e', risponde in
/// millesimi. Quando non c'e' — perche' si e' fuori — o rifiuta subito, o non
/// risponde affatto, e in quel caso si aspetta questo e poi si tira via.
const Duration attesaDellaSonda = Duration(seconds: 4);

/// Quanto vantaggio si da' alle strade dirette prima di chiamare il centralino.
///
/// Molto piu' di quanto serve a una risposta sulla rete di casa — che arriva
/// in pochi millesimi — e poco abbastanza da non farsi notare da chi e' fuori,
/// che quel ritardo lo paga una volta per collegamento e non per comando.
const Duration vantaggioDelleStradeDirette = Duration(milliseconds: 400);

typedef Bussata = Future<bool> Function(Uri salute);

Future<bool> _bussataVera(Uri salute) => Abbinamento.cePonte(salute);

class Sonda {
  const Sonda({
    Bussata? bussa,
    this.attesa = attesaDellaSonda,
    this.vantaggio = vantaggioDelleStradeDirette,
  }) : _bussa = bussa ?? _bussataVera;

  final Bussata _bussa;
  final Duration attesa;
  final Duration vantaggio;

  /// Trova da dove si entra in questa casa.
  ///
  /// Solleva [PonteIrraggiungibile] quando non risponde nessuna: e' una cosa
  /// diversa da «segno rifiutato», e la schermata la racconta in un altro
  /// modo.
  Future<Approdo> dove(CasaConosciuta casa) async {
    final candidati = casa.approdi();
    if (candidati.isEmpty) {
      throw PonteIrraggiungibile(_perche(casa));
    }

    /* Tutti insieme, e vince il primo che risponde. In serie si pagherebbe
     * l'attesa intera del primo ogni volta che si e' dall'altra parte. */
    final vincitore = Completer<Approdo>();
    var quantiHannoDettoNo = 0;

    void haDettoNo() {
      quantiHannoDettoNo += 1;
      if (quantiHannoDettoNo < candidati.length) return;
      if (!vincitore.isCompleted) {
        vincitore.completeError(PonteIrraggiungibile(_perche(casa)));
      }
    }

    for (final candidato in candidati) {
      /* Il ritardo si salta quando non c'e' niente da aspettare: una casa che
       * ha solo il centralino non deve pagare mezzo secondo per niente. */
      final aspetta =
          candidato.da == DaDove.dalCentralino &&
              candidati.any((altro) => altro.da != DaDove.dalCentralino)
          ? vantaggio
          : Duration.zero;

      unawaited(
        Future<void>.delayed(aspetta).then((_) async {
          if (vincitore.isCompleted) {
            /* Una strada diretta ha gia' vinto: il centralino non si disturba
             * nemmeno. */
            haDettoNo();
            return;
          }
          if (await _risponde(candidato.salute)) {
            if (!vincitore.isCompleted) vincitore.complete(candidato);
            return;
          }
          haDettoNo();
        }),
      );
    }
    return vincitore.future;
  }

  Future<bool> _risponde(Uri salute) async {
    try {
      return await _bussa(salute).timeout(attesa, onTimeout: () => false);
    } catch (_) {
      return false;
    }
  }

  /// Il perche' cambia con quello che la casa ha: dire «controlla la rete» a
  /// chi non ha nessuna strada di fuori non serve a niente.
  static String _perche(CasaConosciuta casa) {
    if (casa.daRiabbinare) {
      return 'Questa casa e\' stata abbinata con una versione vecchia dell\'app: '
          'va riabbinata: e\' un quadretto da inquadrare.';
    }
    /* Questo prima degli altri: e' l'errore che fa perdere piu' tempo, perche'
     * l'indirizzo *sembra* giusto — e' quello che Home Assistant stessa da'
     * per l'accesso remoto — e chi lo mette va a cercare il guasto dove non
     * c'e'. */
    if (casa.daFuoriCasa?.eLAccessoRemotoDiHomeAssistant ?? false) {
      return 'L\'accesso remoto di Home Assistant non arriva agli add-on: il suo '
          'tunnel finisce dentro Home Assistant, e il ponte sta su una porta '
          'sua. Non e\' una cosa che si possa configurare — e non serve: il '
          'ponte chiama fuori da solo, basta dirgli un centralino nella sua '
          'scheda in Home Assistant.';
    }
    if (casa.approdi().isEmpty) {
      return 'Non so piu\' dove sia «${casa.nome}»: riabbinala.';
    }
    if (casa.soloInCasa) {
      return 'Non trovo «${casa.nome}». Questa casa si raggiunge solo dalla sua '
          'rete: nella scheda del ponte, in Home Assistant, non e\' stato '
          'messo nessun centralino.';
    }
    return 'Non trovo «${casa.nome}», ne\' in casa ne\' da fuori.';
  }
}
