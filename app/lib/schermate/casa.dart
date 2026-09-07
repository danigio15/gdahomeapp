/// La casa: quello che si vede una volta dentro.
///
/// Per adesso e' un elenco vivo di tutto quello che c'e', diviso per dominio,
/// con gli interruttori che funzionano. Non e' la plancia — quella arriva
/// quando il ponte sapra' passare anche le pagine, non solo il filo — ma e' la
/// prova che la catena regge da un capo all'altro: telefono, ponte, Home
/// Assistant, e ritorno.
library;

import 'package:flutter/material.dart';

import '../casa/entita.dart';
import '../casa/stato_della_casa.dart';
import '../ponte/errori.dart';
import '../ponte/filo.dart';

/// I domini che si comandano con un interruttore, e come si chiama il servizio.
const _accendibili = {'light', 'switch', 'fan', 'input_boolean', 'siren'};

class SchermataDellaCasa extends StatefulWidget {
  const SchermataDellaCasa({
    super.key,
    required this.filo,
    required this.quandoEsce,
  });

  final Filo filo;
  final VoidCallback quandoEsce;

  @override
  State<SchermataDellaCasa> createState() => _SchermataDellaCasaState();
}

class _SchermataDellaCasaState extends State<SchermataDellaCasa> {
  late final StatoDellaCasa _casa = StatoDellaCasa(widget.filo);
  StatoDelFilo _comeVa = StatoDelFilo.chiamando;
  String? _male;

  @override
  void initState() {
    super.initState();
    widget.filo.stato.listen((stato) {
      if (mounted) setState(() => _comeVa = stato);
    });
    _casa.cambiamenti.listen((_) {
      if (mounted) setState(() {});
    });
    _attacca();
  }

  Future<void> _attacca() async {
    try {
      await _casa.attacca();
      if (mounted) setState(() => _male = null);
    } on SegnoRifiutato {
      /* Staccato dalla console: non c'e' niente da riprovare, si riabbina. */
      if (mounted) widget.quandoEsce();
    } on ErroreDelPonte catch (errore) {
      if (mounted) setState(() => _male = errore.spiegazione);
    }
  }

  @override
  void dispose() {
    _casa.stacca();
    super.dispose();
  }

  Future<void> _inverti(Entita quale) async {
    try {
      await _casa.comanda('toggle', quale.id);
    } on ErroreDelPonte catch (errore) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(errore.spiegazione)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Casa'),
        bottom: _comeVa == StatoDelFilo.dentro
            ? null
            : const PreferredSize(
                preferredSize: Size.fromHeight(4),
                child: LinearProgressIndicator(minHeight: 4),
              ),
        actions: [
          IconButton(
            icon: const Icon(Icons.link_off),
            tooltip: 'Stacca questo telefono',
            onPressed: widget.quandoEsce,
          ),
        ],
      ),
      body: _corpo(),
    );
  }

  Widget _corpo() {
    if (_male != null) {
      return _Avviso(
        icona: Icons.cloud_off,
        titolo: 'Non riesco a leggere la casa',
        sotto: _male!,
        bottone: 'Riprova',
        quandoPremuto: () {
          setState(() => _male = null);
          _attacca();
        },
      );
    }
    if (!_casa.pieno) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_casa.quante == 0) {
      return const _Avviso(
        icona: Icons.inbox_outlined,
        titolo: 'Casa vuota',
        sotto: 'Home Assistant non ha nessuna entita\' da mostrare.',
      );
    }

    final domini = _casa.domini().keys.toList()..sort();
    return ListView.builder(
      itemCount: domini.length,
      itemBuilder: (contesto, quale) {
        final dominio = domini[quale];
        final dentro = _casa.delDominio(dominio);
        return ExpansionTile(
          title: Text(dominio),
          subtitle: Text('${dentro.length}'),
          initiallyExpanded: _accendibili.contains(dominio),
          children: dentro.map(_riga).toList(),
        );
      },
    );
  }

  Widget _riga(Entita quale) {
    final comandabile = _accendibili.contains(quale.dominio) && !quale.muta;
    return ListTile(
      title: Text(quale.nome),
      subtitle: Text(quale.id, style: const TextStyle(fontSize: 11)),
      trailing: comandabile
          ? Switch(value: quale.accesa, onChanged: (_) => _inverti(quale))
          : Text(
              quale.muta ? '—' : '${quale.stato}${quale.unita ?? ''}',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
    );
  }
}

class _Avviso extends StatelessWidget {
  const _Avviso({
    required this.icona,
    required this.titolo,
    required this.sotto,
    this.bottone,
    this.quandoPremuto,
  });

  final IconData icona;
  final String titolo;
  final String sotto;
  final String? bottone;
  final VoidCallback? quandoPremuto;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icona, size: 48, color: colori.onSurfaceVariant),
            const SizedBox(height: 16),
            Text(titolo, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              sotto,
              textAlign: TextAlign.center,
              style: TextStyle(color: colori.onSurfaceVariant),
            ),
            if (bottone != null) ...[
              const SizedBox(height: 24),
              FilledButton.tonal(
                onPressed: quandoPremuto,
                child: Text(bottone!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
