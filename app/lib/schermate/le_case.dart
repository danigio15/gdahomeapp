/// Le case: quali ce ne sono, su quale si e' aperti, come si passa fra loro.
library;

import 'package:flutter/material.dart';

import '../casa/casa_conosciuta.dart';
import '../casa/collegamento.dart';
import '../parole.dart';
import '../vestito/pezzi.dart';
import '../vestito/tema.dart';
import 'barra.dart' show nomeDelleCase;
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
      appBar: AppBar(title: Text(nomeDelleCase)),
      floatingActionButton: archivio.piena
          ? null
          : FloatingActionButton.extended(
              onPressed: aggiungiUnaCasa,
              icon: const Icon(Icons.add_rounded),
              label: Text(inLingua(it: 'Aggiungi', en: 'Add')),
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
            StatoVuoto(
              dentroUnaLista: true,
              icona: Icons.home_outlined,
              titolo: inLingua(it: 'Nessuna casa', en: 'No homes yet'),
              sotto: inLingua(
                it: 'Aggiungine una col bottone qui sotto.',
                en: 'Add one with the button below.',
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
        title: Text(
          inLingua(
            it: 'Dimenticare «${casa.nome}»?',
            en: 'Forget “${casa.nome}”?',
          ),
        ),
        content: Text(
          inLingua(
            it:
                'Il telefono resta abbinato dalla parte della casa: per '
                'staccarlo davvero, toglilo anche dalla pagina di gdahome in '
                'Home Assistant.',
            en:
                'The phone stays paired on your home\'s side: to unpair it '
                'for real, remove it from the gdahome page in Home Assistant '
                'as well.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(contesto).pop(false),
            child: Text(inLingua(it: 'No', en: 'No')),
          ),
          FilledButton(
            onPressed: () => Navigator.of(contesto).pop(true),
            style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
            child: Text(inLingua(it: 'Dimentica', en: 'Forget')),
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
            tooltip: inLingua(it: 'Dimentica', en: 'Forget'),
            onPressed: quandoTolta,
          ),
        ],
      ),
    );
  }

  /// Cosa sa fare questa casa, detto in una riga.
  String _comEFatta() {
    if (aperta && daDove != null) {
      return daDove == DaDove.daDentro
          ? inLingua(it: 'in casa adesso', en: 'at home now')
          : inLingua(it: 'da fuori adesso', en: 'away now');
    }
    if (casa.soloInCasa) {
      return inLingua(
        it: 'solo sotto il Wi-Fi di casa',
        en: 'only on your home Wi-Fi',
      );
    }
    if (casa.inCasa == null) {
      return inLingua(
        it: 'solo da fuori · ${casa.daFuoriCasa}',
        en: 'only from away · ${casa.daFuoriCasa}',
      );
    }
    return inLingua(it: 'in casa e da fuori', en: 'at home and away');
  }
}
