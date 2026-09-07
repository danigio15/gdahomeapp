/// I dispositivi: tutto quello che c'e' in casa, diviso per dominio.
///
/// E' la schermata grezza — l'elenco completo, con gli interruttori che
/// funzionano — e resta utile anche dopo che sara' arrivata la plancia: e' dove
/// si cerca *quella* entita' li' quando non ci si ricorda dove sta.
library;

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../casa/entita.dart';
import '../casa/stato_della_casa.dart';
import '../ponte/errori.dart';

/// I domini che si comandano con un interruttore.
const _accendibili = {'light', 'switch', 'fan', 'input_boolean', 'siren'};

class SchermataDeiDispositivi extends StatefulWidget {
  const SchermataDeiDispositivi({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDeiDispositivi> createState() =>
      _SchermataDeiDispositiviState();
}

class _SchermataDeiDispositiviState extends State<SchermataDeiDispositivi> {
  StatoDellaCasa? get _casa => widget.collegamento.stato;

  @override
  void initState() {
    super.initState();
    /* Lo stato della casa lo tiene il collegamento: qui ci si limita a
     * ridisegnare quando cambia. Cosi' passando da una schermata all'altra la
     * casa non si rilegge da capo ogni volta. */
    widget.collegamento.cambiamenti.listen((_) {
      if (mounted) setState(() {});
    });
  }

  Future<void> _inverti(Entita quale) async {
    try {
      await _casa?.comanda('toggle', quale.id);
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
        title: const Text('Dispositivi'),
        bottom: widget.collegamento.dentro
            ? null
            : const PreferredSize(
                preferredSize: Size.fromHeight(4),
                child: LinearProgressIndicator(minHeight: 4),
              ),
      ),
      body: _corpo(),
    );
  }

  Widget _corpo() {
    final casa = _casa;
    if (casa == null || !casa.pieno) {
      return const Center(child: CircularProgressIndicator());
    }
    if (casa.quante == 0) {
      return const _Avviso(
        icona: Icons.inbox_outlined,
        titolo: 'Casa vuota',
        sotto: 'Home Assistant non ha nessuna entita\' da mostrare.',
      );
    }

    final domini = casa.domini().keys.toList()..sort();
    return ListView.builder(
      itemCount: domini.length,
      itemBuilder: (contesto, quale) {
        final dominio = domini[quale];
        final dentro = casa.delDominio(dominio);
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
  });

  final IconData icona;
  final String titolo;
  final String sotto;

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
          ],
        ),
      ),
    );
  }
}
