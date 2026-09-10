/// L'app su questo dispositivo: le poche cose che non sono della casa.
///
/// La configurazione della casa e' **quella della plancia**, e si apre dalla
/// voce «Configurazione» del menu: e' la Config della dashboard, com'e'. Qui
/// dentro non c'e' niente di lei — ci sono le tre o quattro scelte che
/// riguardano *questo* telefono e non la casa, e che quindi non viaggiano al
/// ponte: il tema del riquadro, la tavolozza, come sta la barra della plancia,
/// e le due cose che si spengono su un telefono lento.
///
/// Il tablet in cucina puo' stare sullo scuro e il telefono in tasca no: e'
/// la ragione per cui queste stanno sul dispositivo e non nella casa.
library;

import 'package:flutter/material.dart';

import '../casa/impostazioni.dart';
import '../vestito/pezzi.dart';

/// Le tavolozze della plancia (`cd_tavolozza`), con la famiglia a cui
/// appartengono: da `sections/tavolozze-section.js`. Sceglierne una scrive
/// anche `cd_theme` — scure le prime tre, chiare le altre — e toglierla
/// cancella la chiave. Lo fa `plancia/premesse.dart`.
const _tavolozze = <(String, String, String)>[
  ('notte', '🌌', 'Notte blu'),
  ('grafite', '🪨', 'Grafite'),
  ('bosco', '🌲', 'Bosco'),
  ('sabbia', '🏜️', 'Sabbia'),
  ('menta', '🌿', 'Menta'),
  ('ardesia', '🩶', 'Ardesia'),
];

class SchermataDiQuestoTelefono extends StatefulWidget {
  const SchermataDiQuestoTelefono({super.key, required this.impostazioni});

  final Impostazioni impostazioni;

  @override
  State<SchermataDiQuestoTelefono> createState() =>
      _SchermataDiQuestoTelefonoState();
}

class _SchermataDiQuestoTelefonoState extends State<SchermataDiQuestoTelefono> {
  Future<void> _metti({
    String? tema,
    String? barra,
    String? tavolozza,
    bool? leggera,
    bool? ibrida,
  }) async {
    await widget.impostazioni.metti(
      temaDellaPlancia: tema,
      barraDellaPlancia: barra,
      tavolozzaDellaPlancia: tavolozza,
      planciaLeggera: leggera,
      composizioneIbrida: ibrida,
    );
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final impostazioni = widget.impostazioni;
    final colori = Theme.of(context).colorScheme;
    final piccolo = Theme.of(context).textTheme.bodySmall
        ?.copyWith(color: colori.onSurfaceVariant, height: 1.4);
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 14),
          child: Text(
            'Quello che vale solo qui, su questo dispositivo: non viaggia al '
            'ponte e non lo vede nessun altro telefono. La casa si configura '
            'dalla voce «Configurazione», che apre la Config della plancia.',
            style: piccolo,
          ),
        ),
        Scheda(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Insegna('Il tema della plancia'),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'auto', label: Text('Come il telefono')),
                  ButtonSegment(value: 'chiaro', label: Text('Chiaro')),
                  ButtonSegment(value: 'scuro', label: Text('Scuro')),
                ],
                selected: {impostazioni.temaDellaPlancia},
                showSelectedIcon: false,
                onSelectionChanged: (scelta) => _metti(tema: scelta.first),
              ),
              const SizedBox(height: 16),
              const Insegna('La tavolozza'),
              Text(
                'I colori della plancia oltre a chiaro e scuro. Senza '
                'tavolozza vale il tema qui sopra.',
                style: piccolo,
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ChoiceChip(
                    label: const Text('Nessuna'),
                    selected: impostazioni.tavolozzaDellaPlancia.isEmpty,
                    onSelected: (_) => _metti(tavolozza: ''),
                  ),
                  for (final (quale, glifo, nome) in _tavolozze)
                    ChoiceChip(
                      avatar: Text(glifo, style: const TextStyle(fontSize: 14)),
                      label: Text(nome),
                      selected: impostazioni.tavolozzaDellaPlancia == quale,
                      onSelected: (_) => _metti(tavolozza: quale),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              const Insegna('La barra in fondo alla plancia'),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'scomparsa', label: Text('A scomparsa')),
                  ButtonSegment(value: 'fissa', label: Text('Sempre visibile')),
                ],
                selected: {impostazioni.barraDellaPlancia},
                showSelectedIcon: false,
                onSelectionChanged: (scelta) => _metti(barra: scelta.first),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Card(
          margin: EdgeInsets.zero,
          child: Column(
            children: [
              SwitchListTile(
                value: impostazioni.planciaLeggera,
                onChanged: (acceso) => _metti(leggera: acceso),
                title: const Text('Plancia leggera'),
                subtitle: const Text(
                  'Spegne le sfocature sui telefoni lenti. Di serie e\' '
                  'spenta: le animazioni restano.',
                ),
                isThreeLine: true,
              ),
              if (impostazioni.android)
                SwitchListTile(
                  value: impostazioni.composizioneIbrida,
                  onChanged: (acceso) => _metti(ibrida: acceso),
                  title: const Text('Composizione ibrida'),
                  subtitle: const Text(
                    'Su Android: la plancia la compone il sistema invece di '
                    'Flutter. Piu\' fluida, e su qualche telefono peggio.',
                  ),
                  isThreeLine: true,
                ),
            ],
          ),
        ),
      ],
    );
  }
}
