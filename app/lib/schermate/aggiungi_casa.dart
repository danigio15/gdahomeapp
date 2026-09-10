/// Aggiungere una casa.
///
/// **Un bottone.** Si inquadra il quadretto che sta nella scheda del ponte,
/// dentro Home Assistant, e non si batte niente: ne' un indirizzo, ne' una
/// porta, ne' un gettone, e soprattutto non le credenziali di Home Assistant —
/// chi installa un'app di terzi e si sente chiedere le chiavi di casa fa
/// benissimo a chiuderla.
///
/// Dentro al quadretto c'e' anche **dove sta quella casa**: a quale centralino
/// chiama, e su quali indirizzi la si trova sul Wi-Fi. E' il motivo per cui
/// inquadrando funziona sempre — sul divano e alla stazione — senza che
/// nessuno debba sapere niente di reti.
///
/// Le lettere restano, sotto, per chi non puo' inquadrare: un tablet senza
/// fotocamera, un permesso negato, una fotocamera rotta. Sono sedici e non si
/// battono volentieri, ed e' esattamente per questo che il bottone grande e'
/// l'altro.
library;

import 'dart:io' show Platform;

import 'package:flutter/material.dart';

import '../casa/archivio_delle_case.dart';
import '../casa/casa_conosciuta.dart';
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

  /// Il centralino a cui chiedere quando il quadretto non ne dice uno suo.
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
  /// strada: nessun centralino a cui chiedere, e nessun quadretto che lo dica.
  bool get _serveLIndirizzo => _centralino == null;

  @override
  void dispose() {
    _nome.dispose();
    _dentro.dispose();
    _codice.dispose();
    super.dispose();
  }

  String get _sistema {
    try {
      if (Platform.isIOS) return 'ios';
      if (Platform.isAndroid) return 'android';
    } catch (_) {
      /* Fuori da un telefono. */
    }
    return 'sconosciuto';
  }

  String get _comeSiChiama {
    try {
      return Platform.localHostname;
    } catch (_) {
      return 'Telefono';
    }
  }

  /* ─── Inquadrare ───────────────────────────────────────────────────────── */

  Future<void> _inquadra() async {
    setState(() => _male = null);
    final letto = await widget.inquadra(context);
    if (!mounted) return;

    final String riga;
    switch (letto) {
      case UnQuadretto(riga: final quella):
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
            'nella scheda «Il ponte», dentro Home Assistant.',
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
        nome: _comeSiChiama,
        sistema: _sistema,
        centralinoDiRipiego: _centralino,
      ),
    );
  }

  /* ─── Scriverlo a mano ─────────────────────────────────────────────────── */

  Future<void> _abbinaAMano() async {
    final scritto = _dentro.text.trim();
    final inCasa = IndirizzoDelPonte.leggi(scritto);

    if (scritto.isNotEmpty && inCasa == null) {
      setState(() => _male = 'L\'indirizzo di casa non si capisce.');
      return;
    }
    if (codicePulito(_codice.text).isEmpty) {
      setState(
        () => _male = 'Manca il codice: sono le lettere sotto al quadretto.',
      );
      return;
    }
    if (inCasa == null && _centralino == null) {
      setState(() {
        _male =
            'Serve l\'indirizzo di casa: questa versione dell\'app non ha '
            'un centralino a cui chiedere.';
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
              nome: _comeSiChiama,
              sistema: _sistema,
            )
          : await Abbinamento.colCodice(
              centralino: _centralino!,
              codice: _codice.text,
              nome: _comeSiChiama,
              sistema: _sistema,
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
    }
  }

  /// Il messaggio che si legge davvero, che non e' sempre quello dell'errore.
  String _spiegato(ErroreDelPonte errore, IndirizzoDelPonte? inCasa) {
    if (errore is! PonteIrraggiungibile) return errore.spiegazione;

    /* L'errore che fa perdere piu' tempo di tutti: quell'indirizzo *sembra*
     * giusto — e' quello che Home Assistant stessa da' per l'accesso remoto —
     * e chi lo mette va a cercare il guasto dove non c'e'. */
    if (inCasa?.eLAccessoRemotoDiHomeAssistant ?? false) {
      return 'L\'accesso remoto di Home Assistant non arriva agli add-on: il suo '
          'tunnel finisce dentro Home Assistant, e il ponte sta su una porta '
          'sua. Mettiti sul Wi-Fi di casa e scrivi l\'indirizzo che ha il tuo '
          'Home Assistant su quella rete.';
    }
    if (inCasa != null) {
      return 'Non trovo nessun ponte a quell\'indirizzo. Controlla che l\'add-on '
          'sia acceso e che il telefono sia sulla rete di casa.\n\n'
          '(${errore.spiegazione})';
    }
    return 'Non trovo la casa. Controlla che l\'add-on sia acceso, e che il '
        'codice non sia scaduto: dura cinque minuti.\n\n'
        '(${errore.spiegazione})';
  }

  /* ─── Quello che si vede ───────────────────────────────────────────────── */

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final primaCasa = widget.archivio.vuoto;

    return Scaffold(
      appBar: primaCasa ? null : AppBar(title: const Text('Aggiungi una casa')),
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
                      'Colleghiamo la casa',
                      textAlign: TextAlign.center,
                      style: testi.headlineMedium,
                    ),
                    const SizedBox(height: 10),
                  ],
                  Text(
                    'In Home Assistant apri «Il ponte» dalla barra laterale e '
                    'premi «Fabbrica un codice». Poi inquadra il quadretto.',
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
                    label: const Text('Inquadra il codice'),
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
                        const TextSpan(
                          text:
                              'Non ti verra\' mai chiesta la password di Home '
                              'Assistant.',
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
                    decoration: const InputDecoration(
                      labelText: 'Come si chiama',
                      hintText: 'Casa, Dai miei, Al mare',
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
      child: const Text('Non puoi inquadrarlo? Scrivilo a mano'),
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
            decoration: const InputDecoration(
              labelText: 'Le lettere sotto al quadretto',
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
                  ? 'Indirizzo di Home Assistant in casa'
                  : 'Indirizzo di casa (facoltativo)',
              hintText: '192.168.1.50',
              helperText:
                  'Stando sul Wi-Fi di casa. Il resto lo dice la casa da sola.',
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
                : const Text('Abbina'),
          ),
        ],
      ),
    ),
  ];
}
