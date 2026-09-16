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

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

import '../casa/archivio_delle_case.dart';
import '../casa/casa_conosciuta.dart';
import '../casa/questo_qui/qui.dart';
import '../parole.dart';
import '../ponte/abbinamento.dart';
import '../ponte/errori.dart';
import '../ponte/indirizzo.dart';
import '../ponte/invito.dart';
import '../vestito/marchio.dart';
import '../vestito/pezzi.dart';
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
  bool _sto = false;
  bool _aMano = false;
  String? _male;

  IndirizzoDelCentralino? get _centralino => widget.centralino;

  /// `true` quando, scrivendo a mano, l'indirizzo non e' un di piu' ma l'unica
  /// strada: nessun centralino a cui chiedere, e nessun QR code che lo dica.
  bool get _serveLIndirizzo => _centralino == null;

  @override
  void dispose() {
    _nome.dispose();
    _dentro.dispose();
    _codice.dispose();
    super.dispose();
  }

  /* Come si chiama questo dispositivo e cos'e'.
   *
   * Si chiede una volta e si tiene: e' la riga che comparira' fra i «Telefoni
   * abbinati», ed e' l'unica cosa che distingue l'app dal browser quando la
   * stessa persona si abbina da tutti e due (vedi
   * `casa/questo_dispositivo.dart`). */
  late final QuestoDispositivo _questo = comEFatto();

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
            'nella scheda «gdahome», dentro Home Assistant.',
      );
      return;
    } on InvitoTroppoNuovo catch (errore) {
      setState(() => _male = errore.spiegazione);
      return;
    }

    /* Il nome che si e' battuto vale lo stesso: e' l'unica cosa che l'app non
     * puo' sapere da sola. */
    await _prova(
      () => Abbinamento.conLInvito(
        invito,
        nome: _questo.nome,
        sistema: _questo.sistema,
        centralinoDiRipiego: _centralino,
      ),
    );
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
      final abbinato = inCasa != null
          ? await Abbinamento.chiedi(
              dove: inCasa,
              codice: _codice.text,
              nome: _questo.nome,
              sistema: _questo.sistema,
            )
          : await Abbinamento.colCodice(
              centralino: _centralino!,
              codice: _codice.text,
              nome: _questo.nome,
              sistema: _questo.sistema,
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
      );
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
                    'gdahome in Home Assistant: il posto resta occupato.',
                en:
                    'Your home let me in, but this browser won\'t let me '
                    'remember it: you\'d have to pair again next time you '
                    'open the page.\n\nThis happens when the browser doesn\'t '
                    'consider this page secure — check whether it says “Not '
                    'secure” next to the address. An antivirus that inspects '
                    'traffic, a filter, or an address that doesn\'t start '
                    'with https are enough.\n\nIn the meantime remove this '
                    'pairing from “Paired phones”, on the gdahome page in '
                    'Home Assistant: the slot stays taken.',
              )
            : inLingua(
                it:
                    'La casa mi ha fatto entrare, ma non riesco a ricordarlo '
                    'su questo telefono: riaprendo l\'app dovresti abbinarti '
                    'di nuovo.\n\nTogli questo abbinamento da «Telefoni '
                    'abbinati», nella pagina di gdahome in Home Assistant, e '
                    'riprova.\n\n($errore)',
                en:
                    'Your home let me in, but I can\'t remember it on this '
                    'phone: you\'d have to pair again next time you open the '
                    'app.\n\nRemove this pairing from “Paired phones”, on the '
                    'gdahome page in Home Assistant, and try again.'
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
            'suo tunnel finisce dentro Home Assistant, e gdahome sta su una '
            'porta sua. Mettiti sul Wi-Fi di casa e scrivi l\'indirizzo che '
            'ha il tuo Home Assistant su quella rete.',
        en:
            'Home Assistant remote access doesn\'t reach add-ons: its tunnel '
            'ends inside Home Assistant, and gdahome sits on a port of its '
            'own. Get on your home Wi-Fi and type the address your Home '
            'Assistant has on that network.',
      );
    }
    if (inCasa != null) {
      final detto = inLingua(
        it:
            'Non trovo gdahome a quell\'indirizzo. Controlla che l\'add-on sia '
            'acceso e che il telefono sia sulla rete di casa.',
        en:
            'I can\'t find gdahome at that address. Check that the add-on is '
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

  /* ─── Quello che si vede ───────────────────────────────────────────────── */

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final primaCasa = widget.archivio.vuoto;

    return Scaffold(
      appBar: primaCasa
          ? null
          : AppBar(
              title: Text(inLingua(it: 'Aggiungi una casa', en: 'Add a home')),
            ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (primaCasa) ...[
                    const Center(child: Marchio(lato: 84)),
                    const SizedBox(height: 22),
                    Text(
                      inLingua(
                        it: 'Colleghiamo la casa',
                        en: 'Let\'s connect your home',
                      ),
                      textAlign: TextAlign.center,
                      style: testi.headlineMedium,
                    ),
                    const SizedBox(height: 10),
                  ],
                  Text(
                    inLingua(
                      it:
                          'In Home Assistant apri «gdahome» dalla barra '
                          'laterale e premi «Genera QR code». Poi inquadralo.',
                      en:
                          'In Home Assistant open “gdahome” from the sidebar '
                          'and press “Generate the QR code”. Then scan it.',
                    ),
                    textAlign: TextAlign.center,
                    style: testi.bodyLarge?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 28),
                  FilledButton.icon(
                    onPressed: _sto ? null : _inquadra,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(58),
                    ),
                    icon: _sto
                        ? SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: colori.onPrimary,
                            ),
                          )
                        : const Icon(Icons.qr_code_scanner_rounded),
                    label: Text(
                      inLingua(
                        it: 'Inquadra il QR code',
                        en: 'Scan the QR code',
                      ),
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
                  const SizedBox(height: 24),
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
                    ),
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
                  const Firma(),
                ],
              ),
            ),
          ),
        ),
      ),
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
