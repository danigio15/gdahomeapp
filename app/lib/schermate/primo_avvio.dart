/// Il primo avvio: due caselle, e si e' dentro.
///
/// L'indirizzo del ponte e il codice di otto lettere che la console ha
/// fabbricato. Niente altro: nessun segno da incollare, nessun file da
/// scaricare, nessuna spiegazione di cosa sia un token.
///
/// La cosa che questa schermata fa e che sembra un dettaglio: **controlla il
/// ponte prima di chiedere il codice**. Un codice vale cinque minuti, e farlo
/// scadere mentre si scopre che l'indirizzo era sbagliato vuol dire tornare al
/// computer a fabbricarne un altro.
library;

import 'dart:io' show Platform;

import 'package:flutter/material.dart';

import '../ponte/abbinamento.dart';
import '../ponte/custodia.dart';
import '../ponte/errori.dart';
import '../ponte/indirizzo.dart';

class PrimoAvvio extends StatefulWidget {
  const PrimoAvvio({
    super.key,
    required this.custodia,
    required this.quandoEntra,
  });

  final Custodia custodia;
  final void Function(IndirizzoDelPonte dove, String segno) quandoEntra;

  @override
  State<PrimoAvvio> createState() => _PrimoAvvioState();
}

class _PrimoAvvioState extends State<PrimoAvvio> {
  final _dove = TextEditingController();
  final _codice = TextEditingController();
  bool _sto = false;
  String? _male;

  @override
  void dispose() {
    _dove.dispose();
    _codice.dispose();
    super.dispose();
  }

  String get _comeSiChiama {
    try {
      return Platform.localHostname;
    } catch (_) {
      return 'Telefono';
    }
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

  Future<void> _entra() async {
    final dove = IndirizzoDelPonte.leggi(_dove.text);
    if (dove == null) {
      setState(() => _male = 'Questo indirizzo non si capisce.');
      return;
    }
    if (_codice.text.trim().isEmpty) {
      setState(() => _male = 'Manca il codice.');
      return;
    }

    setState(() {
      _sto = true;
      _male = null;
    });

    try {
      /* Prima il ponte, poi il codice: un codice bruciato per un indirizzo
       * sbagliato costa un viaggio al computer. */
      if (!await Abbinamento.cePonte(dove)) {
        if (!mounted) return;
        setState(() {
          _sto = false;
          _male =
              'Non trovo nessun ponte a questo indirizzo. '
              'Controlla che l\'add-on sia acceso.';
        });
        return;
      }

      final segno = await Abbinamento.chiedi(
        dove: dove,
        codice: _codice.text,
        nome: _comeSiChiama,
        sistema: _sistema,
      );
      await widget.custodia.scriviLIndirizzo(dove);
      await widget.custodia.scriviIlSegno(segno);
      if (!mounted) return;
      widget.quandoEntra(dove, segno);
    } on ErroreDelPonte catch (errore) {
      if (!mounted) return;
      setState(() {
        _sto = false;
        _male = errore.spiegazione;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(Icons.home_outlined, size: 56, color: colori.primary),
                  const SizedBox(height: 16),
                  Text(
                    'Colleghiamo la casa',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'In Home Assistant apri «Il ponte» dalla barra laterale '
                    'e premi «Fabbrica un codice».',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium
                        ?.copyWith(color: colori.onSurfaceVariant),
                  ),
                  const SizedBox(height: 28),
                  TextField(
                    controller: _dove,
                    enabled: !_sto,
                    autocorrect: false,
                    keyboardType: TextInputType.url,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Indirizzo di casa',
                      hintText: '192.168.1.50',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _codice,
                    enabled: !_sto,
                    autocorrect: false,
                    textCapitalization: TextCapitalization.characters,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _sto ? null : _entra(),
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
                    onPressed: _sto ? null : _entra,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                    ),
                    child: _sto
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Entra'),
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
