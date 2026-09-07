/// Aggiungere una casa.
///
/// **Una casella.** Otto lettere, prese dalla scheda del ponte dentro Home
/// Assistant. Non un indirizzo, non una porta, non un gettone, e soprattutto
/// non le credenziali di Home Assistant: chi installa un'app di terzi e si
/// sente chiedere le chiavi di casa fa benissimo a chiuderla.
///
/// L'indirizzo compare solo quando serve davvero — quando l'app non ha un
/// centralino a cui chiedere — e sta chiuso in fondo, dove non spaventa
/// nessuno. Anche in quel caso e' una riga sola, battuta una volta, stando sul
/// divano: dalla risposta la casa dice tutto il resto, compreso a quale
/// centralino chiama lei, e da quel momento l'app la ritrova anche da fuori.
library;

import 'dart:io' show Platform;

import 'package:flutter/material.dart';

import '../casa/archivio_delle_case.dart';
import '../casa/casa_conosciuta.dart';
import '../ponte/abbinamento.dart';
import '../ponte/centralino.dart';
import '../ponte/errori.dart';
import '../ponte/indirizzo.dart';

class AggiungiCasa extends StatefulWidget {
  const AggiungiCasa({
    super.key,
    required this.archivio,
    required this.quandoFatto,
    this.centralino,
  });

  final ArchivioDelleCase archivio;
  final void Function(CasaConosciuta casa) quandoFatto;

  /// Il centralino a cui chiedere. Nelle prove se ne mette uno finto.
  final IndirizzoDelCentralino? centralino;

  @override
  State<AggiungiCasa> createState() => _AggiungiCasaState();
}

class _AggiungiCasaState extends State<AggiungiCasa> {
  final _nome = TextEditingController(text: 'Casa');
  final _dentro = TextEditingController();
  final _codice = TextEditingController();
  bool _sto = false;
  bool _mostraLIndirizzo = false;
  String? _male;

  IndirizzoDelCentralino? get _centralino =>
      widget.centralino ?? centralinoDiDifetto;

  /// `true` quando l'indirizzo non e' un di piu' ma l'unica strada.
  bool get _serveLIndirizzo => _centralino == null;

  @override
  void initState() {
    super.initState();
    _mostraLIndirizzo = _serveLIndirizzo;
  }

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

  Future<void> _abbina() async {
    final scritto = _dentro.text.trim();
    final inCasa = IndirizzoDelPonte.leggi(scritto);

    if (scritto.isNotEmpty && inCasa == null) {
      setState(() => _male = 'L\'indirizzo di casa non si capisce.');
      return;
    }
    if (codicePulito(_codice.text).isEmpty) {
      setState(() => _male = 'Manca il codice: sono otto lettere.');
      return;
    }
    if (inCasa == null && _centralino == null) {
      setState(() {
        _mostraLIndirizzo = true;
        _male =
            'Serve l\'indirizzo di casa: questa versione dell\'app non ha '
            'un centralino a cui chiedere.';
      });
      return;
    }

    setState(() {
      _sto = true;
      _male = null;
    });

    try {
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
        inCasa: inCasa ?? scoperto,
        approdoIniziale: inCasa != null
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
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (primaCasa) ...[
                    Icon(Icons.home_outlined, size: 56, color: colori.primary),
                    const SizedBox(height: 16),
                    Text(
                      'Colleghiamo la casa',
                      textAlign: TextAlign.center,
                      style: testi.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                  ],
                  Text(
                    'In Home Assistant apri «Il ponte» dalla barra laterale e '
                    'premi «Fabbrica un codice». Poi scrivilo qui.',
                    textAlign: TextAlign.center,
                    style: testi.bodyMedium?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 28),
                  TextField(
                    controller: _codice,
                    enabled: !_sto,
                    autofocus: true,
                    autocorrect: false,
                    textAlign: TextAlign.center,
                    textCapitalization: TextCapitalization.characters,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _sto ? null : _abbina(),
                    style: testi.headlineSmall?.copyWith(
                      letterSpacing: 8,
                      fontFamily: 'monospace',
                    ),
                    decoration: const InputDecoration(
                      hintText: 'ABCD2345',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(vertical: 20),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Non ti verra\' mai chiesta la password di Home Assistant.',
                    textAlign: TextAlign.center,
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _nome,
                    enabled: !_sto,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Come si chiama',
                      hintText: 'Casa, Dai miei, Al mare',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  if (_mostraLIndirizzo) ...[
                    const SizedBox(height: 20),
                    TextField(
                      controller: _dentro,
                      enabled: !_sto,
                      autocorrect: false,
                      keyboardType: TextInputType.url,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _sto ? null : _abbina(),
                      decoration: InputDecoration(
                        labelText: _serveLIndirizzo
                            ? 'Indirizzo di Home Assistant in casa'
                            : 'Indirizzo di casa (facoltativo)',
                        hintText: '192.168.1.50',
                        helperText:
                            'Stando sul Wi-Fi di casa. Il resto lo dice '
                            'la casa da sola.',
                        helperMaxLines: 2,
                        border: const OutlineInputBorder(),
                      ),
                    ),
                  ] else ...[
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: _sto
                          ? null
                          : () => setState(() => _mostraLIndirizzo = true),
                      child: const Text(
                        'Il codice non funziona? Scrivi l\'indirizzo',
                      ),
                    ),
                  ],
                  if (_male != null) ...[
                    const SizedBox(height: 16),
                    Text(_male!, style: TextStyle(color: colori.error)),
                  ],
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _sto ? null : _abbina,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                    ),
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
          ),
        ),
      ),
    );
  }
}
