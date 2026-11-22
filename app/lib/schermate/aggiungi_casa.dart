/// Aggiungere una casa.
///
/// **Un bottone.** Si inquadra il QR code che sta nella scheda del ponte,
/// dentro Home Assistant, e non si batte niente: ne' un indirizzo, ne' una
/// porta, ne' un gettone, e soprattutto non le credenziali di Home Assistant —
/// chi installa un'app di terzi e si sente chiedere le chiavi di casa fa
/// benissimo a chiuderla.
///
/// Dentro al QR code c'e' anche **dove sta quella casa**: a quale centralino
/// chiama, e su quali indirizzi la si trova sul Wi-Fi. E' il motivo per cui
/// inquadrando funziona sempre — sul divano e alla stazione — senza che
/// nessuno debba sapere niente di reti.
///
/// Le lettere restano, sotto, per chi non puo' inquadrare: un tablet senza
/// fotocamera, un permesso negato, una fotocamera rotta. Sono sedici e non si
/// battono volentieri, ed e' esattamente per questo che il bottone grande e'
/// l'altro.
library;

import 'dart:async';
import 'dart:ui' show ImageFilter;

import 'package:flutter/foundation.dart' show kIsWeb;

import '../casa/ingresso_qui/qui.dart';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;

import '../casa/archivio_delle_case.dart';
import '../casa/casa_conosciuta.dart';
import '../casa/questo_qui/qui.dart';
import '../parole.dart';
import '../ponte/abbinamento.dart';
import '../ponte/errori.dart';
import '../ponte/indirizzo.dart';
import '../ponte/invito.dart';
import '../versione.dart';
import '../vestito/marchio.dart';
import '../vestito/pezzi.dart';
import '../vestito/tema.dart' show temaScuro;
import 'benvenuto_villa.dart';
import 'collega_dal_link.dart';
import 'di_chi_e.dart';
import 'firma.dart';
import 'lettore.dart';

/// Come si abbina con quello che c'e' scritto in un invito: di serie
/// [abbinaConLInvito], nelle prove uno finto.
typedef AbbinaConLInvito = Future<Entrata> Function(
  Invito invito, {
  required String nome,
  required String sistema,
  required Map<String, String> modello,
  IndirizzoDelCentralino? centralinoDiRipiego,
});

/// [Abbinamento.conLInvito], con la forma di [AbbinaConLInvito].
Future<Entrata> abbinaConLInvito(
  Invito invito, {
  required String nome,
  required String sistema,
  required Map<String, String> modello,
  IndirizzoDelCentralino? centralinoDiRipiego,
}) => Abbinamento.conLInvito(
  invito,
  nome: nome,
  sistema: sistema,
  modello: modello,
  centralinoDiRipiego: centralinoDiRipiego,
);

class AggiungiCasa extends StatefulWidget {
  const AggiungiCasa({
    super.key,
    required this.archivio,
    required this.quandoFatto,
    this.centralino,
    this.inquadra = colLaFotocamera,
    this.invitoDaUnLink,
    this.soloCaseGiaNote = false,
    this.quandoRinuncia,
    this.abbina = abbinaConLInvito,
  });

  final ArchivioDelleCase archivio;
  final void Function(CasaConosciuta casa) quandoFatto;

  /// Il centralino a cui chiedere quando il QR code non ne dice uno suo.
  ///
  /// Arriva da fuori e non si va a prenderlo qui: `null` vuol dire davvero
  /// **nessuno**. Una schermata che si cerca da sola una costante globale non
  /// si puo' provare nei due casi che contano, ed erano proprio quelli da
  /// provare.
  final IndirizzoDelCentralino? centralino;

  /// Come si inquadra. Nelle prove non c'e' nessuna fotocamera, e quello che
  /// si vuole provare non e' lei: e' cosa fa questa schermata di quello che ha
  /// letto.
  final Inquadra inquadra;

  /// L'invito arrivato con un link (`ponte/il_link.dart`), al posto del QR.
  ///
  /// La schermata si apre col foglio «Collegare questa casa?», e abbina solo
  /// dopo il si': un link puo' arrivare da chiunque. Poi la strada e' la
  /// stessa del QR inquadrato.
  final Invito? invitoDaUnLink;

  /// Si puo' solo **ricollegare** una casa che c'e' gia'.
  ///
  /// E' il caso di Base con una casa nell'app: la seconda e' di Premium, e
  /// «Aggiungi» porta alla sua pagina. Ma il link del «Nuovo QR per questo
  /// telefono» della console riabbina quasi sempre la stessa casa, e quella
  /// Premium non la chiede: l'archivio la fonde con quella che c'e'
  /// (`ArchivioDelleCase.aggiungi`). Quale casa sia lo si sa solo dopo,
  /// dall'`Abbinato` (`casaAlCentralino`); se e' un'altra non la si scrive, e
  /// si dice perche'.
  final bool soloCaseGiaNote;

  /// Al «no» del foglio del link: chi ha aperto la schermata la chiude.
  final VoidCallback? quandoRinuncia;

  /// Come si abbina con un invito. Nelle prove non c'e' nessuna casa che
  /// risponda, e quello che si prova e' che l'invito arrivi qui intero.
  final AbbinaConLInvito abbina;

  @override
  State<AggiungiCasa> createState() => _AggiungiCasaState();
}

class _AggiungiCasaState extends State<AggiungiCasa> {
  final _nome = TextEditingController(text: 'Casa');
  final _dentro = TextEditingController();
  final _codice = TextEditingController();

  /* «Di chi e' questo telefono?» Il nome con cui la casa chiamera' questo
   * telefono fra i «Telefoni abbinati» («Galaxy S24 di …»). Facoltativo; chi
   * l'ha gia' scritto per un'altra casa lo ritrova. */
  final _proprietario = TextEditingController();
  bool _sto = false;
  bool _aMano = false;

  /// Il pannello coi passi, salito sopra la villa (il primo avvio sul
  /// telefono).
  bool _pannello = false;
  String? _male;

  IndirizzoDelCentralino? get _centralino => widget.centralino;

  /// `true` quando, scrivendo a mano, l'indirizzo non e' un di piu' ma l'unica
  /// strada: nessun centralino a cui chiedere, e nessun QR code che lo dica.
  bool get _serveLIndirizzo => _centralino == null;

  @override
  void initState() {
    super.initState();
    unawaited(_ritrovaIlProprietario());
    final dalLink = widget.invitoDaUnLink;
    if (dalLink != null) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => unawaited(_chiediSeCollegare(dalLink)),
      );
    }
  }

  Future<void> _ritrovaIlProprietario() async {
    final detto = await widget.archivio.proprietario();
    if (!mounted || detto.isEmpty || _proprietario.text.isNotEmpty) return;
    _proprietario.text = detto;
  }

  @override
  void dispose() {
    _nome.dispose();
    _dentro.dispose();
    _codice.dispose();
    _proprietario.dispose();
    super.dispose();
  }

  /* Come si chiama questo dispositivo e cos'e'.
   *
   * Si chiede una volta e si tiene: e' la riga che comparira' fra i «Telefoni
   * abbinati», ed e' l'unica cosa che distingue l'app dal browser quando la
   * stessa persona si abbina da tutti e due (vedi
   * `casa/questo_dispositivo.dart`). */
  late final QuestoDispositivo _questo = comEFatto();

  /* Marca e modello: «Galaxy S24 Ultra», non «Telefono Android». Si comincia
   * a chiederlo subito, e quando si abbina e' gia' pronto; se il telefono non
   * lo dice si va avanti col nome di prima. */
  late final Future<IlModello?> _ilModello = leggiIlModello();

  /* Nome e modello da mandare alla casa, aspettando il modello al piu' un
   * attimo: un abbinamento non si ferma per questo. */
  Future<({String nome, Map<String, String> modello})> _chiSono() async {
    IlModello? modello;
    try {
      modello = await _ilModello.timeout(const Duration(seconds: 2));
    } catch (_) {
      modello = null;
    }
    final diChi = proprietarioPulito(_proprietario.text);
    return (
      nome: nomeConIlModello(modello, _questo.nome),
      modello: {
        ...?modello?.perLaCasa(),
        'app': versioneDiQuestApp,
        if (diChi.isNotEmpty) 'proprietario': diChi,
      },
    );
  }

  /* ─── Inquadrare ───────────────────────────────────────────────────────── */

  Future<void> _inquadra() async {
    setState(() => _male = null);
    final letto = await widget.inquadra(context);
    if (!mounted) return;

    final String riga;
    switch (letto) {
      case UnQrCode(riga: final quella):
        riga = quella;
      case NienteDaLeggere():
        /* Si e' tornati indietro: non e' un errore, e non si dice niente. */
        return;
      case SiScriveAMano():
        /* La fotocamera non c'e'. Si aprono le lettere da sole: chi ha appena
         * visto fallire il bottone non deve andarselo a cercare. */
        setState(() => _aMano = true);
        return;
    }

    final Invito invito;
    try {
      invito = Invito.leggi(riga);
    } on InvitoIllegibile catch (errore) {
      setState(
        () => _male =
            '${errore.spiegazione} Inquadra quello che sta '
            'nella scheda «GdAHome», dentro Home Assistant.',
      );
      return;
    } on InvitoTroppoNuovo catch (errore) {
      setState(() => _male = errore.spiegazione);
      return;
    }

    await _conLInvito(invito);
  }

  /* L'invito letto, dal QR o da un link: da qui la strada e' una sola.
   *
   * Il nome che si e' battuto vale lo stesso: e' l'unica cosa che l'app non
   * puo' sapere da sola. */
  Future<void> _conLInvito(Invito invito) => _prova(() async {
    final chi = await _chiSono();
    return widget.abbina(
      invito,
      nome: chi.nome,
      sistema: _questo.sistema,
      modello: chi.modello,
      centralinoDiRipiego: _centralino,
    );
  });

  /* ─── Il link ──────────────────────────────────────────────────────────── */

  /* Prima si chiede, poi si abbina: un link non e' un QR inquadrato da chi
   * sta davanti alla console. Al primo avvio il pannello coi passi sale da
   * solo, perche' la rotella e un eventuale errore stanno li' dentro. */
  Future<void> _chiediSeCollegare(Invito invito) async {
    if (!mounted) return;
    final si = await chiediSeCollegare(
      context,
      invito,
      soloCaseGiaNote: widget.soloCaseGiaNote,
    );
    if (!mounted) return;
    if (!si) {
      widget.quandoRinuncia?.call();
      return;
    }
    if (widget.archivio.vuoto) setState(() => _pannello = true);
    await _conLInvito(invito);
  }

  /* ─── Scriverlo a mano ─────────────────────────────────────────────────── */

  Future<void> _abbinaAMano() async {
    final scritto = _dentro.text.trim();
    final inCasa = IndirizzoDelPonte.leggi(scritto);

    if (scritto.isNotEmpty && inCasa == null) {
      setState(
        () => _male = inLingua(
          it: 'L\'indirizzo di casa non si capisce.',
          en: 'I can\'t make sense of that home address.',
        ),
      );
      return;
    }
    if (codicePulito(_codice.text).isEmpty) {
      setState(
        () => _male = inLingua(
          it: 'Manca il codice: è scritto sotto il QR code.',
          en: 'The code is missing: it\'s written under the QR code.',
        ),
      );
      return;
    }
    if (inCasa == null && _centralino == null) {
      setState(() {
        _male = inLingua(
          it:
              'Serve l\'indirizzo di casa: questa versione dell\'app non ha '
              'un centralino a cui chiedere.',
          en:
              'A home address is needed: this build of the app has no relay '
              'to ask.',
        );
      });
      return;
    }

    await _prova(() async {
      /* Due strade, stessa risposta. Con un indirizzo si bussa dritti, ed e'
       * quello che si fa stando in casa; senza, si passa dal centralino, dove
       * la casa e' andata ad aspettare. */
      final chi = await _chiSono();
      final abbinato = inCasa != null
          ? await Abbinamento.chiedi(
              dove: inCasa,
              codice: _codice.text,
              nome: chi.nome,
              sistema: _questo.sistema,
              modello: chi.modello,
            )
          : await Abbinamento.colCodice(
              centralino: _centralino!,
              codice: _codice.text,
              nome: chi.nome,
              sistema: _questo.sistema,
              modello: chi.modello,
            );
      return Entrata(abbinato, daDentro: inCasa);
    }, inCasa: inCasa);
  }

  /* ─── Quello che succede in tutti e due i casi ─────────────────────────── */

  Future<void> _prova(
    Future<Entrata> Function() come, {
    IndirizzoDelPonte? inCasa,
  }) async {
    setState(() {
      _sto = true;
      _male = null;
    });

    try {
      final entrata = await come();
      final abbinato = entrata.abbinato;

      /* La casa dice su quali indirizzi la si trova sulla rete di casa. Si
       * tiene quello che risponde: sono i millesimi contro i decimi, cioe' la
       * differenza fra una luce che si accende quando la tocchi e una che ci
       * pensa su. */
      /* Base, con una casa gia' nell'app: il link poteva ricollegare solo
       * quella (vedi [AggiungiCasa.soloCaseGiaNote]). Un'altra non si
       * scrive. La casa intanto il telefono l'ha segnato fra i suoi, e il
       * posto si libera togliendolo dalla console. */
      if (widget.soloCaseGiaNote &&
          !widget.archivio.tutte.any(
            (una) =>
                una.casaAlCentralino != null &&
                una.casaAlCentralino!.isNotEmpty &&
                una.casaAlCentralino == abbinato.casaAlCentralino,
          )) {
        if (!mounted) return;
        setState(() {
          _sto = false;
          _male = inLingua(
            it:
                'Questa è un\'altra casa: con GdAHome Base nell\'app ne tieni '
                'una, e per aggiungerne un\'altra serve Premium.\n\nLa casa '
                'ha già segnato questo telefono: toglilo da «I tuoi '
                'telefoni» nella console di GdAHome, così il posto si libera.',
            en:
                'This is another home: with GdAHome Base the app keeps one, '
                'and adding another needs Premium.\n\nThat home has already '
                'listed this phone: remove it from “Your phones” in the '
                'GdAHome console to free the slot.',
          );
        });
        return;
      }

      final scoperto = await Abbinamento.qualeIndirizzo(abbinato.indirizzi);

      final casa = await widget.archivio.aggiungi(
        nome: _nome.text,
        segno: abbinato.segno,
        identificativo: abbinato.identificativo,
        chiave: abbinato.chiave,
        casaAlCentralino: abbinato.casaAlCentralino,
        centralino: abbinato.centralino ?? _centralino,
        inCasa: entrata.daDentro ?? scoperto,
        approdoIniziale: entrata.daDentro != null
            ? DaDove.daDentro
            : DaDove.dalCentralino,
        legata: abbinato.legata,
      );
      /* Di chi e' questo telefono, per la prossima casa e per non chiederlo
       * di nuovo: anche vuoto, che e' una risposta. */
      try {
        await widget.archivio.segnaIlProprietario(_proprietario.text);
      } catch (_) {
        /* Non scritto: lo si richiedera'. */
      }
      if (!mounted) return;
      widget.quandoFatto(casa);
    } on ErroreDelPonte catch (errore) {
      if (!mounted) return;
      setState(() {
        _sto = false;
        _male = _spiegato(errore, inCasa);
      });
    } on TroppeCase catch (errore) {
      if (!mounted) return;
      setState(() {
        _sto = false;
        _male = errore.spiegazione;
      });
    } catch (errore) {
      /* L'abbinamento e' andato, e non siamo riusciti a ricordarlo.
       *
       * A questo punto la casa **ci ha gia' fatto entrare**: ha consumato il
       * codice e ha segnato questo telefono fra i suoi. Quello che non e'
       * riuscito e' scriverselo qui, e allora alla prossima apertura l'app
       * chiede di abbinarsi da capo — e ogni giro brucia un altro posto fra i
       * telefoni di quella casa, senza che nessuno dica niente.
       *
       * Prima questo caso finiva fuori da tutti e due i `catch` di sopra:
       * l'errore saliva, la rotella restava a girare, e non c'era una riga
       * da nessuna parte. Adesso si legge, e si legge **cosa fare**.
       *
       * Nel browser la causa e' quasi sempre una sola, e vale la pena dirla:
       * quello che l'app salva lo cifra il browser, e il browser la cifratura
       * la da' solo a una pagina che considera sicura. Su una pagina segnata
       * «non sicuro» — un certificato che qualcosa in mezzo ha sostituito, un
       * indirizzo `http` — la cifratura non c'e', e non c'e' niente che l'app
       * possa fare per aggirarla. */
      if (!mounted) return;
      setState(() {
        _sto = false;
        _male = kIsWeb
            ? inLingua(
                it:
                    'La casa mi ha fatto entrare, ma questo browser non mi '
                    'lascia ricordarlo: riaprendo la pagina dovresti '
                    'abbinarti di nuovo.\n\nSuccede quando il browser non '
                    'considera sicura questa pagina — guarda se accanto '
                    'all\'indirizzo c\'è scritto «Non sicuro». Un antivirus '
                    'che controlla il traffico, un filtro, o un indirizzo che '
                    'non comincia per https bastano.\n\nIntanto togli questo '
                    'abbinamento da «Telefoni abbinati», nella pagina di '
                    'GdAHome in Home Assistant: il posto resta occupato.',
                en:
                    'Your home let me in, but this browser won\'t let me '
                    'remember it: you\'d have to pair again next time you '
                    'open the page.\n\nThis happens when the browser doesn\'t '
                    'consider this page secure — check whether it says “Not '
                    'secure” next to the address. An antivirus that inspects '
                    'traffic, a filter, or an address that doesn\'t start '
                    'with https are enough.\n\nIn the meantime remove this '
                    'pairing from “Paired phones”, on the GdAHome page in '
                    'Home Assistant: the slot stays taken.',
              )
            : inLingua(
                it:
                    'La casa mi ha fatto entrare, ma non riesco a ricordarlo '
                    'su questo telefono: riaprendo l\'app dovresti abbinarti '
                    'di nuovo.\n\nTogli questo abbinamento da «Telefoni '
                    'abbinati», nella pagina di GdAHome in Home Assistant, e '
                    'riprova.\n\n($errore)',
                en:
                    'Your home let me in, but I can\'t remember it on this '
                    'phone: you\'d have to pair again next time you open the '
                    'app.\n\nRemove this pairing from “Paired phones”, on the '
                    'GdAHome page in Home Assistant, and try again.'
                    '\n\n($errore)',
              );
      });
    }
  }

  /// Il messaggio che si legge davvero, che non e' sempre quello dell'errore.
  String _spiegato(ErroreDelPonte errore, IndirizzoDelPonte? inCasa) {
    if (errore is! PonteIrraggiungibile) return errore.spiegazione;

    /* L'errore che fa perdere piu' tempo di tutti: quell'indirizzo *sembra*
     * giusto — e' quello che Home Assistant stessa da' per l'accesso remoto —
     * e chi lo mette va a cercare il guasto dove non c'e'. */
    if (inCasa?.eLAccessoRemotoDiHomeAssistant ?? false) {
      return inLingua(
        it:
            'L\'accesso remoto di Home Assistant non arriva agli add-on: il '
            'suo tunnel finisce dentro Home Assistant, e GdAHome sta su una '
            'porta sua. Mettiti sul Wi-Fi di casa e scrivi l\'indirizzo che '
            'ha il tuo Home Assistant su quella rete.',
        en:
            'Home Assistant remote access doesn\'t reach add-ons: its tunnel '
            'ends inside Home Assistant, and GdAHome sits on a port of its '
            'own. Get on your home Wi-Fi and type the address your Home '
            'Assistant has on that network.',
      );
    }
    if (inCasa != null) {
      final detto = inLingua(
        it:
            'Non trovo GdAHome a quell\'indirizzo. Controlla che l\'add-on sia '
            'acceso e che il telefono sia sulla rete di casa.',
        en:
            'I can\'t find GdAHome at that address. Check that the add-on is '
            'running and that the phone is on your home network.',
      );
      return '$detto\n\n(${errore.spiegazione})';
    }
    final detto = inLingua(
      it:
          'Non trovo la casa. Controlla che l\'add-on sia acceso, e che il '
          'codice non sia scaduto: dura cinque minuti.',
      en:
          'I can\'t find your home. Check that the add-on is running, and that '
          'the code hasn\'t expired: it lasts five minutes.',
    );
    return '$detto\n\n(${errore.spiegazione})';
  }

  /* ─── Quello che si vede ───────────────────────────────────────────────── *
   *
   * «Rifai più bella questa schermata, che è la prima che vedono le persone
   * quando scaricano», e poi «riesci a fare ancora di meglio?». Era un foglio
   * bianco con un titolo e un bottone, e non diceva nemmeno cosa fa l'app.
   * Adesso ha due parti:
   *
   * - la **copertina** (solo alla prima casa): una notte blu col marchio, «La
   *   tua casa, in tasca.» e quattro vetrine che fanno vedere cosa si fa —
   *   le luci, il sole, il clima, il navigatore — come le mattonelle vere;
   * - la **scheda per collegarsi**, che sale sulla copertina: il titolo, i
   *   tre passi esatti in Home Assistant, il bottone, la promessa sulla
   *   password e le due caselle facoltative.
   *
   * Sul telefono stanno una sotto l'altra, e il bottone si vede senza
   * scorrere; su uno schermo largo, o basso e largo (il telefono in
   * orizzontale), una accanto all'altra. Le animazioni sono solo d'ingresso,
   * una volta: niente che giri per sempre. */

  @override
  Widget build(BuildContext context) {
    final primaCasa = widget.archivio.vuoto;
    final scuro = Theme.of(context).brightness == Brightness.dark;

    final corpo = Stack(
      children: [
        Positioned.fill(
          child: _Fondo(scuro: scuro, notte: primaCasa),
        ),
        LayoutBuilder(
          builder: (context, spazio) {
            final w = spazio.maxWidth, h = spazio.maxHeight;
            final largo = primaCasa && (w >= 860 || (w >= 700 && w > h));
            /* Al primo avvio la scheda sta sullo stesso cielo della
             * copertina: scura e di vetro anche col tema chiaro, perche'
             * la pagina e' una sola. */
            final scheda = primaCasa
                ? Theme(
                    data: temaScuro(),
                    child: Builder(
                      builder: (c) => _laScheda(c, primaCasa: true),
                    ),
                  )
                : _laScheda(context, primaCasa: false);
            if (largo) {
              final margine = w >= 1000 ? 40.0 : 20.0;
              final larghezzaScheda = ((w - margine * 2) * 0.48).clamp(
                340.0,
                470.0,
              );
              final basso = h < 560;
              /* Accanto, a tutta altezza: la villa col titolo a sinistra, la
               * scheda a destra (scorre da sola se lo schermo e' basso). */
              return SafeArea(
                child: Padding(
                  padding: EdgeInsets.all(margine),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const _Intestazione(),
                            const Expanded(child: ScenaVilla()),
                            _TitoloDelBenvenuto(grande: !basso, breve: basso),
                          ],
                        ),
                      ),
                      SizedBox(width: w >= 1000 ? 40 : 20),
                      SizedBox(
                        width: larghezzaScheda,
                        child: Center(
                          child: SingleChildScrollView(child: scheda),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }
            if (!primaCasa) {
              return SafeArea(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 480),
                      child: scheda,
                    ),
                  ),
                ),
              );
            }
            /* Al primo avvio sul telefono la pagina e' uno spettacolo e un
             * invito: la villa che si accende, il titolo, un bottone solo.
             * I passi per collegarsi salgono dopo, in un pannello di vetro
             * sopra la stessa scena: «sembrano due parti sciolte» — prima
             * copertina e scheda stavano una sopra l'altra, adesso una viene
             * dopo l'altra. */
            final sopra = MediaQuery.paddingOf(context).top;
            final fondo = MediaQuery.paddingOf(context).bottom;
            final alto = h >= 720;
            final nuda = Theme(
              data: temaScuro(),
              child: Builder(
                builder: (c) => _laScheda(c, primaCasa: true, cornice: false),
              ),
            );
            return Stack(
              children: [
                Positioned.fill(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(0, sopra, 0, fondo),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 560),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Padding(
                              padding: EdgeInsets.fromLTRB(24, 14, 24, 0),
                              child: _Intestazione(),
                            ),
                            const Expanded(child: ScenaVilla()),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 24,
                              ),
                              child: _TitoloDelBenvenuto(grande: alto),
                            ),
                            SizedBox(height: alto ? 26 : 14),
                            Padding(
                              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                              child: _BottoneLuce(
                                key: const Key('benvenuto-collega'),
                                testo: inLingua(
                                  it: 'Collega la tua casa',
                                  en: 'Connect your home',
                                ),
                                quandoTocca: () =>
                                    setState(() => _pannello = true),
                              ),
                            ),
                            TextButton(
                              key: const Key('benvenuto-ho-un-codice'),
                              onPressed: () => setState(() {
                                _pannello = true;
                                _aMano = true;
                              }),
                              child: Text.rich(
                                TextSpan(
                                  text: inLingua(
                                    it: 'Hai già un codice? ',
                                    en: 'Already have a code? ',
                                  ),
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.6),
                                  ),
                                  children: [
                                    TextSpan(
                                      text: inLingua(
                                        it: 'Inseriscilo',
                                        en: 'Enter it',
                                      ),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                /* Il velo: tocca fuori e il pannello scende. */
                Positioned.fill(
                  child: IgnorePointer(
                    ignoring: !_pannello,
                    child: AnimatedOpacity(
                      opacity: _pannello ? 1 : 0,
                      duration: const Duration(milliseconds: 320),
                      child: GestureDetector(
                        onTap: () => setState(() => _pannello = false),
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                          child: const ColoredBox(color: Color(0x8C03050F)),
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 420),
                    switchInCurve: Curves.easeOutCubic,
                    switchOutCurve: Curves.easeInCubic,
                    transitionBuilder: (figlio, anima) => SlideTransition(
                      position: Tween(
                        begin: const Offset(0, 1),
                        end: Offset.zero,
                      ).animate(anima),
                      child: figlio,
                    ),
                    child: _pannello
                        ? _PannelloDiVetro(
                            key: const Key('benvenuto-pannello'),
                            altezzaMassima: h * 0.9,
                            fondo: fondo,
                            child: nuda,
                          )
                        : const SizedBox(width: double.infinity),
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );

    return AnnotatedRegion<SystemUiOverlayStyle>(
      /* Sulla copertina notte l'ora e la batteria vanno in bianco. */
      value: primaCasa || scuro
          ? SystemUiOverlayStyle.light
          : SystemUiOverlayStyle.dark,
      child: PopScope(
        canPop: !_pannello,
        onPopInvokedWithResult: (fatto, _) {
          if (!fatto && _pannello) setState(() => _pannello = false);
        },
        child: Scaffold(
          appBar: primaCasa
              ? null
              : AppBar(
                  title: Text(
                    inLingua(it: 'Aggiungi una casa', en: 'Add a home'),
                  ),
                  backgroundColor: Colors.transparent,
                ),
          body: corpo,
        ),
      ),
    );
  }

  /// La scheda per collegarsi: i passi, il bottone, le caselle.
  Widget _laScheda(
    BuildContext context, {
    required bool primaCasa,
    bool cornice = true,
  }) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final scuro = Theme.of(context).brightness == Brightness.dark;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Entra(
          ritardo: 0.25,
          child: _Vetro(
            vetro: primaCasa,
            nudo: !cornice,
            decorazione: BoxDecoration(
              color: colori.surfaceContainerLowest.withValues(
                alpha: scuro ? 0.92 : 0.96,
              ),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: scuro
                    ? Colors.white.withValues(alpha: 0.06)
                    : Colors.white,
              ),
              boxShadow: [
                BoxShadow(
                  color: (scuro ? Colors.black : const Color(0xFF1E3A8A))
                      .withValues(alpha: scuro ? 0.40 : 0.08),
                  blurRadius: 40,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(22, 20, 22, 18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (primaCasa) ...[
                    Text(
                      inLingua(
                        it: 'Colleghiamo la casa',
                        en: 'Let\'s connect your home',
                      ),
                      style: testi.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.4,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      inLingua(
                        it: 'Tre passi, un minuto.',
                        en: 'Three steps, one minute.',
                      ),
                      style: testi.bodyMedium?.copyWith(
                        color: colori.onSurfaceVariant,
                      ),
                    ),
                  ] else
                    Text(
                      inLingua(it: 'Come si collega', en: 'How to connect'),
                      style: testi.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  const SizedBox(height: 14),
                  /* Due modi di dirlo, e quale dipende da **dove gira questa
                     copia dell'app**.

                     Chi ha il telefono in mano ha Home Assistant su un altro
                     schermo, e «apri GdAHome dalla barra laterale» e' il
                     consiglio giusto. Ma questa stessa app la serve anche
                     l'add-on, dentro Home Assistant, dalla console che ha un
                     tasto «Apri gdahome» — e li' quella frase chiudeva un
                     anello: la barra laterale riportava all'app, e il codice
                     non si generava mai. Qualcuno ha riavviato tre volte e poi
                     e' andato a chiederlo su Facebook.

                     Quindi da dentro l'ingress non si manda nessuno nella
                     barra laterale: si apre la console, con un tasto che ci
                     porta. */
                  if (dentroHomeAssistant) ...[
                    Text(
                      inLingua(
                        it:
                            'Il codice lo fabbrica la console di GdAHome, '
                            'qui in Home Assistant. Aprila, premi «Collega '
                            'l\'app», scegli per chi è, premi «Genera il QR '
                            'code» e riporta qui il codice.',
                        en:
                            'The code is made by the GdAHome console, here '
                            'in Home Assistant. Open it, press “Connect the '
                            'app”, choose who it is for, press “Generate the '
                            'QR code” and bring the code back here.',
                      ),
                      style: testi.bodyLarge?.copyWith(
                        color: colori.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton.icon(
                      onPressed: apriLaConsole,
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(52),
                      ),
                      icon: const Icon(Icons.qr_code_2),
                      label: Text(
                        inLingua(
                          it: 'Apri la console di GdAHome',
                          en: 'Open the GdAHome console',
                        ),
                      ),
                    ),
                  ] else ...[
                    _Passo(
                      numero: 1,
                      testo: inLingua(
                        it:
                            'In Home Assistant apri «Configura GdAHome» '
                            'dalla barra laterale',
                        en:
                            'In Home Assistant, open “Configura GdAHome” from '
                            'the sidebar',
                      ),
                    ),
                    _Passo(
                      numero: 2,
                      testo: inLingua(
                        it:
                            'Premi «Collega l\'app», scegli per chi è e premi '
                            '«Genera il QR code»',
                        en:
                            'Press “Connect the app”, choose who it is for and '
                            'press “Generate the QR code”',
                      ),
                    ),
                    _Passo(
                      numero: 3,
                      testo: inLingua(
                        it: 'Inquadralo con il tasto qui sotto',
                        en: 'Scan it with the button below',
                      ),
                      ultimo: true,
                    ),
                  ],
                  const SizedBox(height: 22),
                  _BottoneGrande(
                    quandoPremuto: _sto ? null : _inquadra,
                    occupato: _sto,
                    testo: inLingua(
                      it: 'Inquadra il QR code',
                      en: 'Scan the QR code',
                    ),
                  ),
                  const SizedBox(height: 14),
                  /* Il lucchetto **dentro** la frase, e non di fianco.
                   *
                   * Di fianco era una riga con due pezzi: su uno schermo
                   * stretto la frase andava a capo e si centrava per conto
                   * suo, e il lucchetto restava piantato all'estremita'
                   * sinistra, staccato da tutto. Messo dentro il testo va a
                   * capo con le parole, come farebbe una parola. */
                  Text.rich(
                    TextSpan(
                      children: [
                        WidgetSpan(
                          alignment: PlaceholderAlignment.middle,
                          child: Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: Icon(
                              Icons.lock_outline_rounded,
                              size: 14,
                              color: colori.onSurfaceVariant,
                            ),
                          ),
                        ),
                        TextSpan(
                          text: inLingua(
                            it:
                                'Non ti verrà mai chiesta la password di Home '
                                'Assistant.',
                            en:
                                'You will never be asked for your Home '
                                'Assistant password.',
                          ),
                        ),
                      ],
                    ),
                    textAlign: TextAlign.center,
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 22),
                  TextField(
                    controller: _nome,
                    enabled: !_sto,
                    textInputAction: TextInputAction.next,
                    decoration: InputDecoration(
                      labelText: inLingua(
                        it: 'Come si chiama',
                        en: 'What it\'s called',
                      ),
                      hintText: inLingua(
                        it: 'Casa, Dai miei, Al mare',
                        en: 'Home, Mum\'s, Beach house',
                      ),
                      prefixIcon: const Icon(Icons.cottage_outlined),
                    ),
                  ),
                  const SizedBox(height: 14),
                  CampoDelProprietario(
                    controller: _proprietario,
                    enabled: !_sto,
                  ),
                  if (_aMano) ..._leLettere(testi) else ..._ilRipiego(),
                  if (_male != null) ...[
                    const SizedBox(height: 16),
                    Scheda(
                      colore: colori.errorContainer,
                      padding: const EdgeInsets.all(14),
                      child: Text(
                        _male!,
                        style: testi.bodyMedium?.copyWith(
                          color: colori.onErrorContainer,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
        const Firma(),
      ],
    );
  }

  List<Widget> _ilRipiego() => [
    const SizedBox(height: 10),
    TextButton(
      onPressed: _sto ? null : () => setState(() => _aMano = true),
      child: Text(
        inLingua(
          it: 'Non puoi inquadrarlo? Inserisci il codice',
          en: 'Can\'t scan it? Enter the code',
        ),
      ),
    ),
  ];

  List<Widget> _leLettere(TextTheme testi) => [
    const SizedBox(height: 16),
    Scheda(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _codice,
            enabled: !_sto,
            autofocus: true,
            autocorrect: false,
            textAlign: TextAlign.center,
            textCapitalization: TextCapitalization.characters,
            textInputAction: TextInputAction.next,
            style: testi.titleLarge?.copyWith(
              letterSpacing: 3,
              fontFamily: 'monospace',
            ),
            decoration: InputDecoration(
              labelText: inLingua(
                it: 'Inserisci il codice mostrato',
                en: 'Enter the code shown',
              ),
              hintText: 'ABCD-2345-EFGH-6789',
              contentPadding: EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 20,
              ),
            ),
          ),
          /* La casella dell'indirizzo solo quando e' l'unica strada: senza
           * un centralino a cui chiedere, la casa non si trova da sola. Con
           * il centralino il codice basta, e una casella «facoltativa» in
           * piu' era solo una domanda in piu' («non serve»). */
          if (_serveLIndirizzo) ...[
            const SizedBox(height: 14),
            TextField(
              controller: _dentro,
              enabled: !_sto,
              autocorrect: false,
              keyboardType: TextInputType.url,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _sto ? null : _abbinaAMano(),
              decoration: InputDecoration(
                labelText: inLingua(
                  it: 'Indirizzo di Home Assistant in casa',
                  en: 'Home Assistant address at home',
                ),
                hintText: '192.168.1.50',
                helperText: inLingua(
                  it:
                      'Stando sul Wi-Fi di casa. Il resto lo dice la casa da '
                      'sola.',
                  en:
                      'While on your home Wi-Fi. Your home tells the app the '
                      'rest by itself.',
                ),
                helperMaxLines: 2,
              ),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _sto ? null : _abbinaAMano,
            child: _sto
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(inLingua(it: 'Abbina', en: 'Pair')),
          ),
        ],
      ),
    ),
  ];
}

/* ─── I pezzi della schermata ───────────────────────────────────────────── */

/// Il fondo: un cielo appena colorato, con due aloni — blu in alto, ambra in
/// basso, i colori del marchio — al posto del bianco piatto.
class _Fondo extends StatelessWidget {
  const _Fondo({required this.scuro, this.notte = false});

  final bool scuro;

  /// Il cielo della copertina su tutta la pagina (il primo avvio).
  final bool notte;

  @override
  Widget build(BuildContext context) {
    if (notte) {
      return const DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF0B1E4D), Color(0xFF0A1128), Color(0xFF140B33)],
            stops: [0, 0.55, 1],
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              top: -140,
              right: -110,
              child: _Alone(colore: Color(0xFF3B82F6), lato: 420, forza: 0.5),
            ),
            Positioned(
              top: 260,
              left: -160,
              child: _Alone(colore: Color(0xFFF59E0B), lato: 380, forza: 0.2),
            ),
            Positioned(
              bottom: -120,
              right: -120,
              child: _Alone(colore: Color(0xFF8B5CF6), lato: 460, forza: 0.32),
            ),
          ],
        ),
      );
    }
    final alone1 = scuro ? const Color(0xFF1D4ED8) : const Color(0xFF93C5FD);
    final alone2 = scuro ? const Color(0xFFB45309) : const Color(0xFFFCD34D);
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: scuro
              ? const [Color(0xFF0B1733), Color(0xFF080F1C), Color(0xFF0A1222)]
              : const [Color(0xFFEAF1FF), Color(0xFFF3F6FB), Color(0xFFFFF7E8)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -160,
            right: -120,
            child: _Alone(
              colore: alone1,
              lato: 460,
              forza: scuro ? 0.35 : 0.55,
            ),
          ),
          Positioned(
            bottom: -180,
            left: -140,
            child: _Alone(
              colore: alone2,
              lato: 480,
              forza: scuro ? 0.18 : 0.45,
            ),
          ),
        ],
      ),
    );
  }
}

class _Alone extends StatelessWidget {
  const _Alone({required this.colore, required this.lato, required this.forza});

  final Color colore;
  final double lato;
  final double forza;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: Container(
      width: lato,
      height: lato,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [
            colore.withValues(alpha: forza),
            colore.withValues(alpha: 0),
          ],
        ),
      ),
    ),
  );
}

/// Entra una volta, salendo appena e accendendosi. [ritardo] e' la frazione
/// dell'animazione in cui comincia: i pezzi arrivano uno dopo l'altro.
class _Entra extends StatelessWidget {
  const _Entra({required this.child, this.ritardo = 0});

  final Widget child;
  final double ritardo;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 900),
      curve: Interval(ritardo, 1, curve: Curves.easeOutCubic),
      child: child,
      builder: (context, t, figlio) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, (1 - t) * 18),
          child: figlio,
        ),
      ),
    );
  }
}

/// Un passo numerato, col filo che lo lega al passo dopo.
class _Passo extends StatelessWidget {
  const _Passo({
    required this.numero,
    required this.testo,
    this.ultimo = false,
  });

  final int numero;
  final String testo;
  final bool ultimo;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF3B82F6), Color(0xFF4338CA)],
                  ),
                ),
                child: Text(
                  '$numero',
                  style: testi.labelLarge?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (!ultimo)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: colori.primary.withValues(alpha: 0.18),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(top: 6, bottom: ultimo ? 0 : 12),
              child: Text(
                testo,
                style: testi.bodyLarge?.copyWith(fontWeight: FontWeight.w500),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Il bottone che conta: largo, col colore del marchio che sfuma.
class _BottoneGrande extends StatelessWidget {
  const _BottoneGrande({
    required this.quandoPremuto,
    required this.occupato,
    required this.testo,
  });

  final VoidCallback? quandoPremuto;
  final bool occupato;
  final String testo;

  @override
  Widget build(BuildContext context) {
    final forma = BorderRadius.circular(20);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: forma,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF3B82F6), Color(0xFF1D4ED8), Color(0xFF4338CA)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2563EB).withValues(alpha: 0.30),
            blurRadius: 24,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: FilledButton.icon(
        onPressed: quandoPremuto,
        style: FilledButton.styleFrom(
          backgroundColor: Colors.transparent,
          disabledBackgroundColor: Colors.transparent,
          foregroundColor: Colors.white,
          disabledForegroundColor: Colors.white.withValues(alpha: 0.8),
          shadowColor: Colors.transparent,
          minimumSize: const Size.fromHeight(60),
          shape: RoundedRectangleBorder(borderRadius: forma),
          textStyle: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontSize: 17, fontWeight: FontWeight.w700),
        ),
        icon: occupato
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : const Icon(Icons.qr_code_scanner_rounded),
        label: Text(testo),
      ),
    );
  }
}

/// La scheda: di vetro sul cielo del primo avvio (lo stesso colore sotto,
/// appena piu' chiaro e sfocato), altrimenti la scheda di sempre.
class _Vetro extends StatelessWidget {
  const _Vetro({
    required this.vetro,
    required this.decorazione,
    required this.child,
    this.nudo = false,
  });

  final bool vetro;

  /// Dentro il pannello che sale: il vetro e' gia' il pannello.
  final bool nudo;
  final BoxDecoration decorazione;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (nudo) return child;
    if (!vetro) return DecoratedBox(decoration: decorazione, child: child);
    final forma = BorderRadius.circular(28);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: forma,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.28),
            blurRadius: 40,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: forma,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: forma,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Colors.white.withValues(alpha: 0.10),
                  Colors.white.withValues(alpha: 0.04),
                ],
              ),
              border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

/// Il marchio e il nome, in cima al benvenuto.
class _Intestazione extends StatelessWidget {
  const _Intestazione();

  @override
  Widget build(BuildContext context) => _Entra(
    child: Row(
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF3B82F6).withValues(alpha: 0.55),
                blurRadius: 24,
              ),
            ],
          ),
          child: const Marchio(lato: 38),
        ),
        const SizedBox(width: 11),
        Text(
          'GdAHome',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.3,
          ),
        ),
      ],
    ),
  );
}

/// «La tua casa, finalmente viva.» — la seconda riga sfuma dall'oro al viola.
class _TitoloDelBenvenuto extends StatelessWidget {
  const _TitoloDelBenvenuto({required this.grande, this.breve = false});

  final bool grande;

  /// Su uno schermo basso (il telefono in orizzontale): senza la riga sotto,
  /// cosi' la villa ha piu' spazio.
  final bool breve;

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    final stile = (grande ? testi.displaySmall : testi.headlineLarge)?.copyWith(
      color: Colors.white,
      fontWeight: FontWeight.w800,
      height: 1.04,
      letterSpacing: -1.4,
    );
    return _Entra(
      ritardo: 0.3,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            inLingua(it: 'La tua casa,', en: 'Your home,'),
            style: stile,
          ),
          ShaderMask(
            blendMode: BlendMode.srcIn,
            shaderCallback: (r) => const LinearGradient(
              colors: [
                Color(0xFFFDE68A),
                Color(0xFFF59E0B),
                Color(0xFFFB7185),
                Color(0xFFA78BFA),
              ],
              stops: [0, 0.4, 0.75, 1],
            ).createShader(r),
            child: Text(
              inLingua(it: 'finalmente viva.', en: 'finally alive.'),
              style: stile,
            ),
          ),
          if (!breve) ...[
            SizedBox(height: grande ? 12 : 8),
            Text(
              inLingua(
                it:
                    'Luci, clima, energia, sicurezza e il tuo navigatore. '
                    'Tutto collegato, tutto in tasca.',
                en:
                    'Lights, climate, energy, security and your navigator. '
                    'All connected, all in your pocket.',
              ),
              style: testi.bodyLarge?.copyWith(
                color: Colors.white.withValues(alpha: 0.72),
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Il bottone grande del benvenuto: una striscia di luce, dal blu al viola.
class _BottoneLuce extends StatelessWidget {
  const _BottoneLuce({
    super.key,
    required this.testo,
    required this.quandoTocca,
  });

  final String testo;
  final VoidCallback quandoTocca;

  @override
  Widget build(BuildContext context) {
    final forma = BorderRadius.circular(20);
    return _Entra(
      ritardo: 0.45,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: forma,
          gradient: const LinearGradient(
            colors: [Color(0xFF3B82F6), Color(0xFF6366F1), Color(0xFFA855F7)],
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF6366F1).withValues(alpha: 0.4),
              blurRadius: 30,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            borderRadius: forma,
            onTap: quandoTocca,
            child: SizedBox(
              height: 58,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Flexible(
                    child: Text(
                      testo,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Icon(Icons.arrow_forward_rounded, color: Colors.white),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Il pannello di vetro che sale dal basso coi passi per collegarsi.
class _PannelloDiVetro extends StatelessWidget {
  const _PannelloDiVetro({
    super.key,
    required this.altezzaMassima,
    required this.fondo,
    required this.child,
  });

  final double altezzaMassima;
  final double fondo;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    const forma = BorderRadius.vertical(top: Radius.circular(30));
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: altezzaMassima),
      child: ClipRRect(
        borderRadius: forma,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: forma,
              gradient: const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xE01E2650), Color(0xF00C1028)],
              ),
              border: Border(
                top: BorderSide(color: Colors.white.withValues(alpha: 0.16)),
              ),
            ),
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(6, 12, 6, 12 + fondo),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 560),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Container(
                          width: 44,
                          height: 5,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.3),
                            borderRadius: BorderRadius.circular(9),
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      child,
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
