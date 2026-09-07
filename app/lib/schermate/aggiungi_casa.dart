/// Aggiungere una casa.
///
/// Quattro caselle, e solo due sono obbligatorie. Le altre due sono la stessa
/// istanza vista da fuori, ed e' scritto a schermo perche' non e' ovvio: chi
/// non le riempie si trova un'app che funziona solo sotto il proprio Wi-Fi, e
/// se ne accorge in stazione.
library;

import 'dart:io' show Platform;

import 'package:flutter/material.dart';

import '../casa/archivio_delle_case.dart';
import '../casa/casa_conosciuta.dart';
import '../ponte/abbinamento.dart';
import '../ponte/errori.dart';
import '../ponte/indirizzo.dart';

class AggiungiCasa extends StatefulWidget {
  const AggiungiCasa({
    super.key,
    required this.archivio,
    required this.quandoFatto,
  });

  final ArchivioDelleCase archivio;
  final void Function(CasaConosciuta casa) quandoFatto;

  @override
  State<AggiungiCasa> createState() => _AggiungiCasaState();
}

class _AggiungiCasaState extends State<AggiungiCasa> {
  final _nome = TextEditingController(text: 'Casa');
  final _dentro = TextEditingController();
  final _fuori = TextEditingController();
  final _codice = TextEditingController();
  bool _sto = false;
  String? _male;

  @override
  void dispose() {
    _nome.dispose();
    _dentro.dispose();
    _fuori.dispose();
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
    final inCasa = IndirizzoDelPonte.leggi(_dentro.text);
    final daFuori = IndirizzoDelPonte.leggi(_fuori.text);

    if (_dentro.text.trim().isNotEmpty && inCasa == null) {
      setState(() => _male = 'L\'indirizzo di casa non si capisce.');
      return;
    }
    if (_fuori.text.trim().isNotEmpty && daFuori == null) {
      setState(() => _male = 'L\'indirizzo da fuori non si capisce.');
      return;
    }
    if (inCasa == null && daFuori == null) {
      setState(() => _male = 'Serve almeno un indirizzo.');
      return;
    }
    if (_codice.text.trim().isEmpty) {
      setState(() => _male = 'Manca il codice di abbinamento.');
      return;
    }

    setState(() {
      _sto = true;
      _male = null;
    });

    /* L'abbinamento si fa **su un indirizzo solo**, ma il segno che ne esce
     * vale per la casa intera: il ponte e' lo stesso, visto da due parti. Si
     * prova quello di casa per primo perche' e' quello che di solito e' vivo
     * mentre si abbina — si abbina stando in casa. */
    final daProvare = [
      if (inCasa != null) (DaDove.daDentro, inCasa),
      if (daFuori != null) (DaDove.daFuori, daFuori),
    ];

    for (final (da, dove) in daProvare) {
      if (!await Abbinamento.cePonte(dove)) continue;
      try {
        final segno = await Abbinamento.chiedi(
          dove: dove,
          codice: _codice.text,
          nome: _comeSiChiama,
          sistema: _sistema,
        );
        final casa = await widget.archivio.aggiungi(
          nome: _nome.text,
          segno: segno,
          inCasa: inCasa,
          daFuoriCasa: daFuori,
          approdoIniziale: da,
        );
        if (!mounted) return;
        widget.quandoFatto(casa);
        return;
      } on ErroreDelPonte catch (errore) {
        /* Un codice sbagliato e' sbagliato su tutti e due gli indirizzi: non
         * ha senso bruciare il secondo tentativo. */
        if (!mounted) return;
        setState(() {
          _sto = false;
          _male = errore.spiegazione;
        });
        return;
      } on TroppeCase catch (errore) {
        if (!mounted) return;
        setState(() {
          _sto = false;
          _male = errore.spiegazione;
        });
        return;
      }
    }

    if (!mounted) return;
    setState(() {
      _sto = false;
      _male =
          'Non trovo nessun ponte a questi indirizzi. '
          'Controlla che l\'add-on sia acceso e che il telefono sia sulla rete giusta.';
    });
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
                    Text(
                      'In Home Assistant apri «Il ponte» dalla barra laterale '
                      'e premi «Fabbrica un codice».',
                      textAlign: TextAlign.center,
                      style: testi.bodyMedium?.copyWith(
                        color: colori.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 28),
                  ],
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
                  const SizedBox(height: 20),
                  _Insegna('Da dentro casa', colori),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _dentro,
                    enabled: !_sto,
                    autocorrect: false,
                    keyboardType: TextInputType.url,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Indirizzo sulla rete di casa',
                      hintText: '192.168.1.50',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 20),
                  _Insegna('Da fuori casa', colori),
                  const SizedBox(height: 4),
                  Text(
                    'La stessa casa, raggiunta da fuori: il tuo dominio, o l\'accesso '
                    'remoto di Home Assistant. Senza questo l\'app funziona solo sotto '
                    'il Wi-Fi di casa.',
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _fuori,
                    enabled: !_sto,
                    autocorrect: false,
                    keyboardType: TextInputType.url,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Indirizzo pubblico (facoltativo)',
                      hintText: 'https://casa.esempio.it',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _codice,
                    enabled: !_sto,
                    autocorrect: false,
                    textCapitalization: TextCapitalization.characters,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _sto ? null : _abbina(),
                    style: const TextStyle(
                      letterSpacing: 6,
                      fontFamily: 'monospace',
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Codice di abbinamento',
                      hintText: 'ABCD2345',
                      border: OutlineInputBorder(),
                    ),
                  ),
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

class _Insegna extends StatelessWidget {
  const _Insegna(this.testo, this.colori);
  final String testo;
  final ColorScheme colori;

  @override
  Widget build(BuildContext context) => Text(
    testo.toUpperCase(),
    style: Theme.of(context).textTheme.labelSmall?.copyWith(
      color: colori.primary,
      letterSpacing: 1.2,
      fontWeight: FontWeight.w700,
    ),
  );
}
