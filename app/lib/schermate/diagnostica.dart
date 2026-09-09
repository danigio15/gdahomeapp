/// Come va l'app, in numeri, e i due interruttori che pesano sulla plancia.
///
/// E' la schermata da fotografare quando l'app va a scatti: dice se e' il
/// disegno (UI), la scheda video (GPU) o il filo principale bloccato, quanto
/// passa sul filo con la casa, e cosa e' acceso.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../casa/impostazioni.dart';
import '../misure/lavori.dart';
import '../vestito/pezzi.dart';
import 'misure.dart';

class SchermataDellaDiagnostica extends StatefulWidget {
  const SchermataDellaDiagnostica({
    super.key,
    required this.collegamento,
    required this.impostazioni,
    this.misure,
    this.lavori,
  });

  final Collegamento collegamento;
  final Impostazioni impostazioni;

  /// Nelle prove si passano numeri finti; nell'app sono quelle vere.
  final UltimoMinuto Function()? misure;

  /// Idem per i lavori pesanti.
  final List<UnLavoro> Function()? lavori;

  @override
  State<SchermataDellaDiagnostica> createState() =>
      _SchermataDellaDiagnosticaState();
}

class _SchermataDellaDiagnosticaState extends State<SchermataDellaDiagnostica> {
  Timer? _orologio;
  StreamSubscription<void>? _ascolto;

  @override
  void initState() {
    super.initState();
    /* I numeri si rinfrescano da soli: chi guarda deve vedere l'ultimo
     * minuto, non quello di quando ha aperto la pagina. */
    _orologio = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
    _ascolto = widget.impostazioni.cambiamenti.listen((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _orologio?.cancel();
    _ascolto?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final minuto = (widget.misure ?? () => Misure.io.ultimoMinuto)();
    final fatti = (widget.lavori ?? () => Lavori.io.tutti)();
    final impostazioni = widget.impostazioni;
    final collegamento = widget.collegamento;

    Widget riga(String nome, String valore) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 150,
            child: Text(
              nome,
              style: testi.bodyMedium?.copyWith(color: colori.onSurfaceVariant),
            ),
          ),
          Expanded(child: Text(valore, style: testi.bodyMedium)),
        ],
      ),
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Come va l\'app')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Text(
            'L\'ultimo minuto. Se l\'app va a scatti, manda una segnalazione '
            'con la foto di questa pagina.',
            style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
          ),
          const SizedBox(height: 14),
          Scheda(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Fotogrammi', style: testi.titleMedium),
                const SizedBox(height: 6),
                riga('Disegnati', '${minuto.fotogrammi} in 60 s'),
                riga(
                  'Lenti',
                  '${minuto.lenti} (${minuto.percentoLenti}%), '
                      'oltre ${Misure.lentoOltreMs} ms',
                ),
                riga(
                  'UI (Flutter)',
                  '${minuto.uiMedioMs} ms medi, ${minuto.uiMaxMs} ms il peggiore',
                ),
                riga(
                  'GPU (disegno)',
                  '${minuto.gpuMedioMs} ms medi, ${minuto.gpuMaxMs} ms il peggiore',
                ),
                riga(
                  'Filo principale bloccato',
                  minuto.blocchi == 0
                      ? 'mai'
                      : '${minuto.blocchi} volte, '
                            'fino a ${minuto.bloccoMaxMs} ms',
                ),
                if (minuto.pause > 0)
                  riga(
                    'App messa da parte',
                    '${minuto.pause} volte: quel tempo non conta',
                  ),
                const SizedBox(height: 6),
                Text(
                  'UI alta: e\' l\'app che costruisce troppo. GPU alta: e\' '
                  'quello che c\'e\' da disegnare, di solito la plancia. '
                  'Blocchi: il filo principale stava facendo altro. Quando '
                  'l\'app sta da parte il telefono la congela, e quel tempo '
                  'non e\' un blocco: si conta a parte.',
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Scheda(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Il filo con la casa', style: testi.titleMedium),
                const SizedBox(height: 6),
                riga('Stato', collegamento.comeVa.name),
                riga('Da dove', collegamento.daDove?.name ?? '-'),
                riga('Traffico', collegamento.traffico ?? 'non collegato'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Scheda(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Cosa costa', style: testi.titleMedium),
                const SizedBox(height: 6),
                if (fatti.isEmpty)
                  Text(
                    'Ancora niente da segnare.',
                    style: testi.bodyMedium?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  )
                else
                  for (final uno in fatti.take(8))
                    riga(
                      uno.cosa,
                      '${uno.quante} volte, ${uno.totaleMs} ms in tutto, '
                      '${uno.maxMs} ms il peggiore',
                    ),
                const SizedBox(height: 6),
                Text(
                  'Se un lavoro da solo dura quanto un blocco, il colpevole '
                  'e\' quello. Se sono tutti piccoli e i blocchi restano, e\' '
                  'la roba da buttare che si accumula.',
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Scheda(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('La plancia', style: testi.titleMedium),
                const SizedBox(height: 6),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Plancia leggera'),
                  subtitle: const Text(
                    'Spenta di serie. Ferma le animazioni che non finiscono '
                    'mai e toglie le sfocature dietro le tessere: la plancia '
                    'cambia aspetto. Solo se il telefono proprio non ce la fa.',
                  ),
                  value: impostazioni.planciaLeggera,
                  onChanged: (valore) =>
                      impostazioni.metti(planciaLeggera: valore),
                ),
                if (impostazioni.android)
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Composizione ibrida'),
                    subtitle: const Text(
                      'Il riquadro della plancia lo disegna Android per conto '
                      'suo, invece di passare da Flutter a ogni fotogramma. '
                      'Prova a spegnerla solo se con lei va peggio.',
                    ),
                    value: impostazioni.composizioneIbrida,
                    onChanged: (valore) =>
                        impostazioni.metti(composizioneIbrida: valore),
                  ),
                const SizedBox(height: 4),
                Text(
                  'Cambiare un interruttore ricarica la plancia.',
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
