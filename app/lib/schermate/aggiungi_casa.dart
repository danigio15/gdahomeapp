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

import 'package:flutter/foundation.dart' show kIsWeb;

import '../casa/ingresso_qui/qui.dart';

import 'package:flutter/material.dart';

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
import 'di_chi_e.dart';
import 'firma.dart';
import 'lettore.dart';

class AggiungiCasa extends StatefulWidget {
  const AggiungiCasa({
    super.key,
    required this.archivio,
    required this.quandoFatto,
    this.centralino,
    this.inquadra = colLaFotocamera,
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
  String? _male;

  IndirizzoDelCentralino? get _centralino => widget.centralino;

  /// `true` quando, scrivendo a mano, l'indirizzo non e' un di piu' ma l'unica
  /// strada: nessun centralino a cui chiedere, e nessun QR code che lo dica.
  bool get _serveLIndirizzo => _centralino == null;

  @override
  void initState() {
    super.initState();
    unawaited(_ritrovaIlProprietario());
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

    /* Il nome che si e' battuto vale lo stesso: e' l'unica cosa che l'app non
     * puo' sapere da sola. */
    await _prova(() async {
      final chi = await _chiSono();
      return Abbinamento.conLInvito(
        invito,
        nome: chi.nome,
        sistema: _questo.sistema,
        modello: chi.modello,
        centralinoDiRipiego: _centralino,
      );
    });
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
   * quando scaricano»: era un foglio bianco con un titolo e un bottone, e non
   * diceva nemmeno cosa fa l'app. Adesso ha due parti:
   *
   * - la **presentazione** (solo alla prima casa): il marchio che si accende,
   *   cosa si fa con GdAHome in quattro mattonelle, e il titolo;
   * - la **scheda per collegarsi**: i tre passi numerati, il bottone, la
   *   promessa sulla password e le due caselle facoltative.
   *
   * Sul telefono stanno una sotto l'altra; su uno schermo largo (il tablet in
   * orizzontale) una accanto all'altra, invece di una colonna stretta in
   * mezzo a due mari di vuoto. Le animazioni sono solo d'ingresso, una volta:
   * niente che giri per sempre su una schermata che si guarda a lungo. */

  @override
  Widget build(BuildContext context) {
    final primaCasa = widget.archivio.vuoto;
    final scuro = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: primaCasa
          ? null
          : AppBar(
              title: Text(inLingua(it: 'Aggiungi una casa', en: 'Add a home')),
              backgroundColor: Colors.transparent,
            ),
      body: Stack(
        children: [
          Positioned.fill(child: _Fondo(scuro: scuro)),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, spazio) {
                /* Affiancate sullo schermo largo, e anche su quello basso e
                 * largo (il telefono in orizzontale): una sotto l'altra il
                 * bottone finirebbe sotto il bordo. */
                final w = spazio.maxWidth, h = spazio.maxHeight;
                final largo = primaCasa && (w >= 860 || (w >= 700 && w > h));
                final margine = w >= 1000 ? 48.0 : 24.0;
                final larghezzaScheda = ((w - margine * 2) * 0.52).clamp(
                  340.0,
                  470.0,
                );
                final scheda = _laScheda(context);
                if (largo) {
                  return Center(
                    child: SingleChildScrollView(
                      padding: EdgeInsets.symmetric(
                        horizontal: margine,
                        vertical: 24,
                      ),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 1120),
                        child: Row(
                          /* Sullo schermo basso la scheda e' piu' alta della
                           * finestra: centrata, la presentazione finiva in
                           * fondo. Li' sta in alto, accanto ai passi. */
                          crossAxisAlignment: h < 560
                              ? CrossAxisAlignment.start
                              : CrossAxisAlignment.center,
                          children: [
                            Expanded(
                              child: _Presentazione(
                                aSinistra: true,
                                compatta: h < 560,
                              ),
                            ),
                            SizedBox(width: w >= 1000 ? 56 : 28),
                            SizedBox(width: larghezzaScheda, child: scheda),
                          ],
                        ),
                      ),
                    ),
                  );
                }
                return Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 480),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (primaCasa) ...[
                            const _Presentazione(aSinistra: false),
                            const SizedBox(height: 20),
                          ],
                          scheda,
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  /// La scheda per collegarsi: i passi, il bottone, le caselle.
  Widget _laScheda(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final scuro = Theme.of(context).brightness == Brightness.dark;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Entra(
          ritardo: 0.25,
          child: DecoratedBox(
            decoration: BoxDecoration(
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
          /* Qui la casella dell'indirizzo si vede sempre.
           *
           * Non e' una contraddizione con quello che c'e' scritto in cima:
           * quello che non deve spaventare nessuno e' la **prima** schermata,
           * e quella adesso e' un bottone solo. Chi e' arrivato fin qui sta
           * gia' battendo sedici lettere a mano, e una casella in piu' —
           * facoltativa, e detto — non lo spaventa: gli serve. */
          const SizedBox(height: 14),
          TextField(
            controller: _dentro,
            enabled: !_sto,
            autocorrect: false,
            keyboardType: TextInputType.url,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _sto ? null : _abbinaAMano(),
            decoration: InputDecoration(
              labelText: _serveLIndirizzo
                  ? inLingua(
                      it: 'Indirizzo di Home Assistant in casa',
                      en: 'Home Assistant address at home',
                    )
                  : inLingua(
                      it: 'Indirizzo di casa (facoltativo)',
                      en: 'Home address (optional)',
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
  const _Fondo({required this.scuro});

  final bool scuro;

  @override
  Widget build(BuildContext context) {
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

/// La presentazione: il marchio acceso, il benvenuto, cosa si fa.
class _Presentazione extends StatelessWidget {
  const _Presentazione({required this.aSinistra, this.compatta = false});

  /// Sullo schermo largo sta a sinistra della scheda, allineata a sinistra.
  final bool aSinistra;

  /// Su uno schermo basso (il telefono in orizzontale) solo marchio, saluto
  /// e titolo: il resto non ci starebbe, e il titolo finiva sotto il bordo.
  final bool compatta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final scuro = Theme.of(context).brightness == Brightness.dark;
    final allinea = aSinistra
        ? CrossAxisAlignment.start
        : CrossAxisAlignment.center;
    final testo = aSinistra ? TextAlign.start : TextAlign.center;
    final logo = compatta ? 64.0 : (aSinistra ? 120.0 : 88.0);
    final alone = compatta ? 104.0 : (aSinistra ? 190.0 : 136.0);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: allinea,
      children: [
        _Entra(
          child: SizedBox(
            width: alone,
            height: alone,
            child: Stack(
              alignment: Alignment.center,
              children: [
                /* L'alone: il marchio si accende, non si appoggia. */
                _Alone(
                  colore: const Color(0xFF3B82F6),
                  lato: alone,
                  forza: scuro ? 0.55 : 0.40,
                ),
                Positioned(
                  bottom: 6,
                  child: _Alone(
                    colore: const Color(0xFFF59E0B),
                    lato: logo,
                    forza: scuro ? 0.30 : 0.28,
                  ),
                ),
                Marchio(lato: logo),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        _Entra(
          ritardo: 0.1,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            decoration: BoxDecoration(
              color: colori.primary.withValues(alpha: scuro ? 0.16 : 0.10),
              borderRadius: BorderRadius.circular(100),
            ),
            child: Text(
              inLingua(it: 'Benvenuto in GdAHome', en: 'Welcome to GdAHome'),
              style: testi.labelLarge?.copyWith(
                color: colori.primary,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        _Entra(
          ritardo: 0.15,
          child: Text(
            inLingua(it: 'Colleghiamo la casa', en: 'Let\'s connect your home'),
            textAlign: testo,
            style:
                (aSinistra && !compatta
                        ? testi.displaySmall
                        : testi.headlineLarge)
                    ?.copyWith(
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.8,
                    ),
          ),
        ),
        if (!compatta) ...[
          const SizedBox(height: 12),
          _Entra(
            ritardo: 0.2,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Text(
                inLingua(
                  it:
                      'Luci, clima, energia, telecamere e il navigatore per '
                      "l'auto: tutta la tua casa in un'app sola.",
                  en:
                      'Lights, climate, energy, cameras and the car navigator: '
                      'your whole home in one app.',
                ),
                textAlign: testo,
                style: testi.bodyLarge?.copyWith(
                  color: colori.onSurfaceVariant,
                  height: 1.45,
                ),
              ),
            ),
          ),
          const SizedBox(height: 18),
          _Entra(
            ritardo: 0.25,
            child: Wrap(
              alignment: aSinistra ? WrapAlignment.start : WrapAlignment.center,
              spacing: 10,
              runSpacing: 10,
              children: [
                _Vantaggio(
                  icona: Icons.lightbulb_rounded,
                  colore: const Color(0xFFF59E0B),
                  testo: inLingua(
                    it: 'Luci e dispositivi',
                    en: 'Lights & devices',
                  ),
                ),
                _Vantaggio(
                  icona: Icons.bolt_rounded,
                  colore: const Color(0xFF16A34A),
                  testo: inLingua(it: 'Energia', en: 'Energy'),
                ),
                _Vantaggio(
                  icona: Icons.thermostat_rounded,
                  colore: const Color(0xFFE11D48),
                  testo: inLingua(it: 'Clima', en: 'Climate'),
                ),
                _Vantaggio(
                  icona: Icons.navigation_rounded,
                  colore: const Color(0xFF2563EB),
                  testo: inLingua(it: 'Navigatore', en: 'Navigator'),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// Una mattonella di cosa si fa con l'app.
class _Vantaggio extends StatelessWidget {
  const _Vantaggio({
    required this.icona,
    required this.colore,
    required this.testo,
  });

  final IconData icona;
  final Color colore;
  final String testo;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final scuro = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.fromLTRB(6, 6, 12, 6),
      decoration: BoxDecoration(
        color: colori.surfaceContainerLowest.withValues(
          alpha: scuro ? 0.7 : 0.85,
        ),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(
          color: scuro ? Colors.white.withValues(alpha: 0.06) : Colors.white,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: colore.withValues(alpha: scuro ? 0.22 : 0.14),
              shape: BoxShape.circle,
            ),
            child: Icon(icona, size: 15, color: colore),
          ),
          const SizedBox(width: 8),
          Text(
            testo,
            style: Theme.of(context).textTheme.labelLarge
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
        ],
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
