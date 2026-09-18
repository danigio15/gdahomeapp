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

import 'package:flutter/foundation.dart' show kIsWeb;

import '../casa/casa_conosciuta.dart';
import '../parole.dart';
import 'abbinamento.dart';
import 'errori.dart';
import 'indirizzo.dart';

/// Quanto si aspetta una risposta prima di considerare morta una strada.
///
/// Corto apposta: un indirizzo di rete locale, quando c'e', risponde in
/// millesimi. Quando non c'e' — perche' si e' fuori — o rifiuta subito, o non
/// risponde affatto, e in quel caso si aspetta questo e poi si tira via.
const Duration attesaDellaSonda = Duration(seconds: 4);

/// Se da qui in chiaro non si puo' bussare.
///
/// Vero in un caso solo: l'app aperta da browser su una pagina `https`. Li' il
/// browser rifiuta qualunque chiamata in chiaro — regola del contenuto misto —
/// e bussare comunque marca la pagina «non sicura» finche' resta aperta, col
/// lucchetto sbarrato. Chi la guarda pensa al certificato, e il certificato
/// non c'entra niente: e' l'indirizzo di casa `http://192.168.…` che l'app
/// stava provando accanto agli altri.
///
/// `Uri.base`, nel browser, e' l'indirizzo della pagina. Fuori dal browser e'
/// la cartella di lavoro, e per questo la domanda comincia da `kIsWeb`.
bool get inChiaroNonSiPuo => kIsWeb && Uri.base.isScheme('https');

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

  /// Come si bussa. La stessa di questa sonda, per chi deve bussare altrove:
  /// il collegamento la usa per provare un indirizzo di casa **imparato
  /// dopo** l'abbinamento, e dev'essere la stessa o nelle prove si andrebbe a
  /// bussare sul serio.
  Bussata get bussa => _bussa;

  /// Trova da dove si entra in questa casa.
  ///
  /// Solleva [PonteIrraggiungibile] quando non risponde nessuna: e' una cosa
  /// diversa da «segno rifiutato», e la schermata la racconta in un altro
  /// modo.
  Future<Approdo> dove(CasaConosciuta casa) async {
    final candidati = casa.approdi(soloSicuri: inChiaroNonSiPuo);
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
      if (vincitore.isCompleted) return;
      /* Nessuno ha risposto. Se c'e' il centralino, lo si prova lo stesso.
       *
       * Questa bussata serve a **scegliere** la strada, non a vietarla: un
       * telefono appena riacceso, con la radio ancora fredda o la rete del
       * cellulare che si sveglia, puo' non ricevere in tempo una risposta che
       * arriverebbe un secondo dopo — e arrendersi li' vuol dire dire «non
       * trovo la casa» a chi la casa ce l'ha accesa. Provando, o si entra, o
       * il no lo dice chi lo sa davvero: il centralino risponde «questa casa
       * adesso non e' collegata», che e' una frase su cui si puo' fare
       * qualcosa. */
      final dalCentralino = candidati
          .where((uno) => uno.da == DaDove.dalCentralino)
          .firstOrNull;
      if (dalCentralino != null) {
        vincitore.complete(dalCentralino);
        return;
      }
      vincitore.completeError(PonteIrraggiungibile(_perche(casa)));
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
      return inLingua(
        it:
            'Questa casa è stata abbinata con una versione vecchia '
            'dell\'app: va riabbinata inquadrando un QR code nuovo.',
        en:
            'This home was paired with an old version of the app: it needs '
            'pairing again with a new QR code.',
      );
    }
    /* Questo prima degli altri: e' l'errore che fa perdere piu' tempo, perche'
     * l'indirizzo *sembra* giusto — e' quello che Home Assistant stessa da'
     * per l'accesso remoto — e chi lo mette va a cercare il guasto dove non
     * c'e'. */
    if (casa.daFuoriCasa?.eLAccessoRemotoDiHomeAssistant ?? false) {
      return inLingua(
        it:
            'L\'accesso remoto di Home Assistant non arriva agli add-on: il '
            'suo tunnel finisce dentro Home Assistant, e gdahome sta su una '
            'porta sua. Non è una cosa che si possa configurare — e non '
            'serve: gdahome chiama fuori da solo, e il centralino ce l\'ha '
            'già scritto dentro.',
        en:
            'Home Assistant remote access doesn\'t reach add-ons: its tunnel '
            'ends inside Home Assistant, and gdahome sits on a port of its '
            'own. This isn\'t something you can configure — and there\'s no '
            'need: gdahome calls out by itself, and the relay is already '
            'written inside it.',
      );
    }
    if (casa.approdi().isEmpty) {
      return inLingua(
        it: 'Non so più dove sia «${casa.nome}»: riabbinala.',
        en: 'I no longer know where “${casa.nome}” is: pair it again.',
      );
    }
    /* Le strade ci sono, ma da questa pagina non si possono prendere: sono
     * tutte in chiaro, e il browser da un indirizzo `https` non le lascia
     * chiamare. Va detto per quello che è, o si va a cercare il guasto nella
     * rete di casa — o nel certificato, che è dove lo cerca chi vede il
     * lucchetto sbarrato. */
    if (inChiaroNonSiPuo && casa.approdi(soloSicuri: true).isEmpty) {
      return inLingua(
        it:
            'Da questa pagina non posso chiamare «${casa.nome}»: il suo '
            'indirizzo non è cifrato, e un browser aperto su https non lascia '
            'passare le chiamate in chiaro. Apri gdahome dall\'app sul '
            'telefono, oppure dall\'indirizzo della tua Home Assistant. Non '
            'è un problema del certificato di questo sito.',
        en:
            'I can\'t call “${casa.nome}” from this page: its address isn\'t '
            'encrypted, and a browser opened over https won\'t let plain '
            'requests through. Open gdahome from the phone app, or from your '
            'Home Assistant address. This is not a problem with this site\'s '
            'certificate.',
      );
    }
    if (casa.soloInCasa) {
      return inLingua(
        it:
            'Non trovo «${casa.nome}». Questa casa si raggiunge solo dalla '
            'sua rete: nella scheda di gdahome, in Home Assistant, «da fuori '
            'casa» è spento, e senza un centralino da fuori non si entra.',
        en:
            'I can\'t find “${casa.nome}”. This home can only be reached on '
            'its own network: on the gdahome page, in Home Assistant, “da '
            'fuori casa” is off, and without a relay there is no way in from '
            'away.',
      );
    }
    return inLingua(
      it: 'Non trovo «${casa.nome}», né in casa né da fuori.',
      en: 'I can\'t find “${casa.nome}”, neither at home nor from away.',
    );
  }
}
