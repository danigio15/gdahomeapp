/// Le case: quali ce ne sono, su quale si e' aperti, come si passa fra loro.
library;

import 'package:flutter/material.dart';

import '../casa/casa_conosciuta.dart';
import '../casa/collegamento.dart';
import 'firma.dart';

class LeCase extends StatelessWidget {
  const LeCase({
    super.key,
    required this.collegamento,
    required this.aggiungiUnaCasa,
  });

  final Collegamento collegamento;
  final VoidCallback aggiungiUnaCasa;

  @override
  Widget build(BuildContext context) {
    final archivio = collegamento.archivio;
    final aperta = collegamento.casa;

    return Scaffold(
      appBar: AppBar(title: const Text('Le tue case')),
      floatingActionButton: archivio.piena
          ? null
          : FloatingActionButton.extended(
              onPressed: aggiungiUnaCasa,
              icon: const Icon(Icons.add),
              label: const Text('Aggiungi'),
            ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 96),
        children: [
          for (final casa in archivio.tutte)
            _Riga(
              casa: casa,
              aperta: casa.id == aperta?.id,
              daDove: casa.id == aperta?.id ? collegamento.daDove : null,
              quandoScelta: () async {
                await collegamento.cambiaCasa(casa.id);
                if (context.mounted) Navigator.of(context).pop();
              },
              quandoTolta: () => _chiediEDimentica(context, casa),
            ),
          if (archivio.vuoto)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Text(
                'Nessuna casa. Aggiungine una col bottone qui sotto.',
                textAlign: TextAlign.center,
              ),
            ),
          const Firma(),
        ],
      ),
    );
  }

  Future<void> _chiediEDimentica(
    BuildContext context,
    CasaConosciuta casa,
  ) async {
    final sicuro = await showDialog<bool>(
      context: context,
      builder: (contesto) => AlertDialog(
        title: Text('Dimenticare «${casa.nome}»?'),
        content: const Text(
          'Il telefono resta abbinato dalla parte del ponte: per staccarlo '
          'davvero, toglilo anche dalla console dell\'add-on.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(contesto).pop(false),
            child: const Text('No'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(contesto).pop(true),
            child: const Text('Dimentica'),
          ),
        ],
      ),
    );
    if (sicuro != true) return;
    await collegamento.dimentica(casa.id);
  }
}

class _Riga extends StatelessWidget {
  const _Riga({
    required this.casa,
    required this.aperta,
    required this.daDove,
    required this.quandoScelta,
    required this.quandoTolta,
  });

  final CasaConosciuta casa;
  final bool aperta;
  final DaDove? daDove;
  final VoidCallback quandoScelta;
  final VoidCallback quandoTolta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return ListTile(
      leading: Icon(
        aperta ? Icons.home : Icons.home_outlined,
        color: aperta ? colori.primary : null,
      ),
      title: Text(casa.nome),
      subtitle: Text(_comEFatta()),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (aperta && daDove != null)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Icon(
                daDove == DaDove.daDentro ? Icons.wifi : Icons.public,
                size: 16,
                color: colori.onSurfaceVariant,
              ),
            ),
          IconButton(
            icon: const Icon(Icons.delete_outline),
            tooltip: 'Dimentica',
            onPressed: quandoTolta,
          ),
        ],
      ),
      selected: aperta,
      onTap: aperta ? null : quandoScelta,
    );
  }

  /// Cosa sa fare questa casa, detto in una riga.
  String _comEFatta() {
    if (casa.soloInCasa) return 'solo sotto il Wi-Fi di casa';
    if (casa.inCasa == null) return 'solo da fuori · ${casa.daFuoriCasa}';
    return 'in casa e da fuori';
  }
}
