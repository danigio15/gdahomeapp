/// Le case: quali ce ne sono, su quale si e' aperti, come si passa fra loro.
library;

import 'package:flutter/material.dart';

import '../casa/casa_conosciuta.dart';
import '../casa/collegamento.dart';
import '../vestito/pezzi.dart';
import '../vestito/tema.dart';
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
              icon: const Icon(Icons.add_rounded),
              label: const Text('Aggiungi'),
            ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
        children: [
          for (final casa in archivio.tutte) ...[
            _Casa(
              casa: casa,
              aperta: casa.id == aperta?.id,
              daDove: casa.id == aperta?.id ? collegamento.daDove : null,
              quandoScelta: () async {
                await collegamento.cambiaCasa(casa.id);
                if (context.mounted) Navigator.of(context).pop();
              },
              quandoTolta: () => _chiediEDimentica(context, casa),
            ),
            const SizedBox(height: 10),
          ],
          if (archivio.vuoto)
            const StatoVuoto(
              dentroUnaLista: true,
              icona: Icons.home_outlined,
              titolo: 'Nessuna casa',
              sotto: 'Aggiungine una col bottone qui sotto.',
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
            style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
            child: const Text('Dimentica'),
          ),
        ],
      ),
    );
    if (sicuro != true) return;
    await collegamento.dimentica(casa.id);
  }
}

class _Casa extends StatelessWidget {
  const _Casa({
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
    final testi = Theme.of(context).textTheme;
    return Scheda(
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
      bordo: aperta ? colori.primary : null,
      quandoPremuta: aperta ? null : quandoScelta,
      child: Row(
        children: [
          Cerchietto(
            icona: aperta ? Icons.home_rounded : Icons.home_outlined,
            lato: 44,
            fondo: aperta ? colori.primary : null,
            colore: aperta ? colori.onPrimary : null,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        casa.nome,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: testi.titleMedium,
                      ),
                    ),
                    if (aperta) ...[
                      const SizedBox(width: 8),
                      Bollino(
                        'aperta',
                        fondo: colori.primaryContainer,
                        colore: colori.onPrimaryContainer,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    if (aperta && daDove != null) ...[
                      Pallino(
                        daDove == DaDove.daDentro
                            ? Colori.bene
                            : Colori.ambraScura,
                        lato: 7,
                      ),
                      const SizedBox(width: 6),
                    ],
                    Flexible(
                      child: Text(
                        _comEFatta(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: testi.bodySmall?.copyWith(
                          color: colori.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded),
            tooltip: 'Dimentica',
            onPressed: quandoTolta,
          ),
        ],
      ),
    );
  }

  /// Cosa sa fare questa casa, detto in una riga.
  String _comEFatta() {
    if (aperta && daDove != null) {
      return daDove == DaDove.daDentro ? 'in casa adesso' : 'da fuori adesso';
    }
    if (casa.soloInCasa) return 'solo sotto il Wi-Fi di casa';
    if (casa.inCasa == null) return 'solo da fuori · ${casa.daFuoriCasa}';
    return 'in casa e da fuori';
  }
}
