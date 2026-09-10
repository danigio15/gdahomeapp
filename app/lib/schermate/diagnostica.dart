/// Come va l'app, in numeri, e i due interruttori che pesano sulla plancia.
///
/// E' la schermata da fotografare quando l'app va a scatti: dice se e' il
/// disegno (UI), la scheda video (GPU) o il filo principale bloccato, quanto
/// passa sul filo con la casa, e cosa e' acceso.
library;

import 'dart:async';
import 'dart:math' as math;

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
    this.nuda = false,
  });

  final Collegamento collegamento;
  final Impostazioni impostazioni;

  /// Senza la sua barra del titolo: dentro la home ce n'e' gia' una, e due
  /// una sopra l'altra sono due. Aperta da sola — dall'Assistenza, con
  /// «Come va l'app» — la sua barra ce l'ha, che le serve per tornare
  /// indietro.
  final bool nuda;

  /// Nelle prove si passano numeri finti; nell'app sono quelle vere.
  final UltimoMinuto Function()? misure;

  /// Idem per i lavori pesanti.
  final List<UnLavoro> Function()? lavori;

  @override
  State<SchermataDellaDiagnostica> createState() =>
      _SchermataDellaDiagnosticaState();
}

/// Quanto prende una barra del telefono, in punti: presa dalla finestra,
/// come la prende la plancia.
String _quanto(BuildContext context, {required bool sopra}) {
  final vista = View.of(context);
  final punti = vista.devicePixelRatio;
  final dallAlbero = MediaQuery.viewPaddingOf(context);
  final quanto = sopra
      ? math.max(dallAlbero.top, vista.viewPadding.top / punti)
      : math.max(dallAlbero.bottom, vista.viewPadding.bottom / punti);
  return '${quanto.round()}';
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

    final corpo = ListView(
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
              /* Perche' e' caduto, non solo quante volte.
                 *
                 * «Caduto otto volte» non dice se sia la rete del telefono,
                 * il centralino che chiude o la casa che non risponde: tre
                 * cose con tre rimedi diversi. Cinque righe qui rispondono
                 * alla domanda senza doverla indovinare. */
              if (collegamento.ultimeCadute.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  'Le ultime cadute',
                  style: testi.labelLarge?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 4),
                for (final (quale, perche) in collegamento.ultimeCadute.indexed)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 3),
                    child: Text(
                      '${quale + 1}. $perche',
                      style: testi.bodySmall?.copyWith(
                        color: colori.onSurfaceVariant,
                        height: 1.35,
                      ),
                    ),
                  ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        _IlRitardo(collegamento: collegamento, riga: riga),
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
              /* I numeri veri delle barre del telefono: sono quelli che
                 * l'app passa alla pagina, e quando la barra della plancia
                 * finisce sotto i tasti la risposta e' qui. */
              riga(
                'Barre del telefono',
                'in cima ${_quanto(context, sopra: true)}, '
                    'in fondo ${_quanto(context, sopra: false)}',
              ),
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
    );
    if (widget.nuda) return corpo;
    return Scaffold(
      appBar: AppBar(title: const Text('Come va l\'app')),
      body: corpo,
    );
  }
}

/// Quanto ci mette un cambiamento della casa ad arrivare qui.
///
/// Serve a rispondere a una domanda sola, e a rispondere **bene**: «i dati
/// arrivano con un minuto di ritardo» puo' voler dire due cose diverse, e una
/// sola delle due e' nostra.
///
/// Home Assistant scrive dentro ogni evento **quando** ha registrato quello
/// stato. Se quando arriva qui quell'ora e' di un minuto fa, il minuto se
/// l'e' preso la strada — telefono, centralino, ponte — e c'e' da lavorarci.
/// Se e' di adesso, la strada e' immediata e il minuto sta a monte: e'
/// l'integrazione che porta quel dato a interrogare il dispositivo una volta
/// al minuto, e li' non ci arriva nessuno da qui.
class _IlRitardo extends StatelessWidget {
  const _IlRitardo({required this.collegamento, required this.riga});

  final Collegamento collegamento;
  final Widget Function(String nome, String valore) riga;

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    final colori = Theme.of(context).colorScheme;
    final casa = collegamento.stato;
    final solito = casa?.ritardoSolito;
    final peggiore = casa?.ritardoPeggiore;
    final quanti = casa?.quantiRitardi ?? 0;
    return Scheda(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Quanto ci mettono i dati', style: testi.titleMedium),
          const SizedBox(height: 6),
          if (quanti == 0)
            Text(
              casa == null
                  ? 'La casa non e\' ancora collegata.'
                  : 'Nessun cambiamento misurato, ancora. Apri i dispositivi '
                        'e aspetta che qualcosa in casa cambi.',
              style: testi.bodySmall?.copyWith(
                color: colori.onSurfaceVariant,
                height: 1.4,
              ),
            )
          else ...[
            riga('Di solito', _quanto(solito)),
            riga('Il peggiore', _quanto(peggiore)),
            riga('Su quanti', '$quanti cambiamenti'),
            const SizedBox(height: 8),
            Text(
              _cosaVuolDire(solito),
              style: testi.bodySmall?.copyWith(
                color: colori.onSurfaceVariant,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }

  static String _quanto(Duration? quale) {
    if (quale == null) return '-';
    if (quale.inMilliseconds < 1000) return '${quale.inMilliseconds} ms';
    final secondi = quale.inMilliseconds / 1000;
    return secondi < 10
        ? '${secondi.toStringAsFixed(1)} s'
        : '${secondi.round()} s';
  }

  static String _cosaVuolDire(Duration? solito) {
    if (solito == null) return '';
    if (solito.inMilliseconds < 2000) {
      return 'La strada e\' immediata: quello che cambia in casa arriva qui '
          'in meno di due secondi. Se un valore a schermo sembra vecchio di '
          'un minuto, quel minuto non e\' della strada — e\' Home Assistant '
          'che scopre quel dato una volta al minuto, perche\' e\' cosi\' che '
          'l\'integrazione che lo porta interroga il dispositivo.';
    }
    if (solito.inSeconds < 15) {
      return 'Qualche secondo: e\' la strada, e di solito vuol dire che si '
          'sta passando dal centralino invece che dalla rete di casa.';
    }
    return 'Tanto. Questo e\' un ritardo della strada, non di Home Assistant: '
        'vale la pena mandarlo in una segnalazione, con questa schermata '
        'allegata.';
  }
}
