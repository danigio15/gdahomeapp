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
import '../parole.dart';
import '../vestito/pezzi.dart';
import 'menu.dart' show Sezione;
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
          inLingua(
            it:
                'L\'ultimo minuto. Se l\'app va a scatti, manda una '
                'segnalazione con la foto di questa pagina.',
            en:
                'The last minute. If the app stutters, send a report with a '
                'screenshot of this page.',
          ),
          style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
        ),
        const SizedBox(height: 14),
        Scheda(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                inLingua(it: 'Fotogrammi', en: 'Frames'),
                style: testi.titleMedium,
              ),
              const SizedBox(height: 6),
              riga(
                inLingua(it: 'Disegnati', en: 'Drawn'),
                '${minuto.fotogrammi} in 60 s',
              ),
              riga(
                inLingua(it: 'Lenti', en: 'Slow'),
                inLingua(
                  it:
                      '${minuto.lenti} (${minuto.percentoLenti}%), oltre '
                      '${Misure.lentoOltreMs} ms',
                  en:
                      '${minuto.lenti} (${minuto.percentoLenti}%), over '
                      '${Misure.lentoOltreMs} ms',
                ),
              ),
              riga(
                'UI (Flutter)',
                inLingua(
                  it:
                      '${minuto.uiMedioMs} ms medi, ${minuto.uiMaxMs} ms il '
                      'peggiore',
                  en:
                      '${minuto.uiMedioMs} ms average, ${minuto.uiMaxMs} ms '
                      'worst',
                ),
              ),
              riga(
                inLingua(it: 'GPU (disegno)', en: 'GPU (drawing)'),
                inLingua(
                  it:
                      '${minuto.gpuMedioMs} ms medi, ${minuto.gpuMaxMs} ms il '
                      'peggiore',
                  en:
                      '${minuto.gpuMedioMs} ms average, ${minuto.gpuMaxMs} ms '
                      'worst',
                ),
              ),
              riga(
                inLingua(
                  it: 'Filo principale bloccato',
                  en: 'Main thread stalled',
                ),
                minuto.blocchi == 0
                    ? inLingua(it: 'mai', en: 'never')
                    : inLingua(
                        it:
                            '${volte(minuto.blocchi)}, fino a '
                            '${minuto.bloccoMaxMs} ms',
                        en:
                            '${volte(minuto.blocchi)}, up to '
                            '${minuto.bloccoMaxMs} ms',
                      ),
              ),
              if (minuto.pause > 0)
                riga(
                  inLingua(it: 'App messa da parte', en: 'App put aside'),
                  inLingua(
                    it: '${volte(minuto.pause)}: quel tempo non conta',
                    en: '${volte(minuto.pause)}: that time doesn\'t count',
                  ),
                ),
              const SizedBox(height: 6),
              Text(
                inLingua(
                  it:
                      'UI alta: è l\'app che costruisce troppo. GPU alta: è '
                      'quello che c\'è da disegnare, di solito la plancia. '
                      'Blocchi: il filo principale stava facendo altro. '
                      'Quando l\'app sta da parte il telefono la congela, e '
                      'quel tempo non è un blocco: si conta a parte.',
                  en:
                      'High UI: the app is building too much. High GPU: it\'s '
                      'what there is to draw, usually the dashboard. Stalls: '
                      'the main thread was doing something else. When the app '
                      'is put aside the phone freezes it, and that time is '
                      'not a stall: it\'s counted separately.',
                ),
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
              Text(
                inLingua(
                  it: 'Il filo con la casa',
                  en: 'The connection with your home',
                ),
                style: testi.titleMedium,
              ),
              const SizedBox(height: 6),
              riga(
                inLingua(it: 'Stato', en: 'State'),
                collegamento.comeVa.nome,
              ),
              riga(
                inLingua(it: 'Da dove', en: 'From where'),
                collegamento.daDove?.nome ?? '-',
              ),
              riga(
                inLingua(it: 'Traffico', en: 'Traffic'),
                collegamento.traffico ??
                    inLingua(it: 'non collegato', en: 'not connected'),
              ),
              /* Perche' e' caduto, non solo quante volte.
                 *
                 * «Caduto otto volte» non dice se sia la rete del telefono,
                 * il centralino che chiude o la casa che non risponde: tre
                 * cose con tre rimedi diversi. Cinque righe qui rispondono
                 * alla domanda senza doverla indovinare. */
              if (collegamento.ultimeCadute.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  inLingua(it: 'Le ultime cadute', en: 'The last drops'),
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
              Text(
                inLingua(it: 'Cosa costa', en: 'What it costs'),
                style: testi.titleMedium,
              ),
              const SizedBox(height: 6),
              if (fatti.isEmpty)
                Text(
                  inLingua(
                    it: 'Ancora niente da segnare.',
                    en: 'Nothing to note yet.',
                  ),
                  style: testi.bodyMedium?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                )
              else
                for (final uno in fatti.take(8))
                  riga(
                    uno.cosa,
                    inLingua(
                      it:
                          '${volte(uno.quante)}, ${uno.totaleMs} ms in tutto, '
                          '${uno.maxMs} ms il peggiore',
                      en:
                          '${volte(uno.quante)}, ${uno.totaleMs} ms in total, '
                          '${uno.maxMs} ms worst',
                    ),
                  ),
              const SizedBox(height: 6),
              Text(
                inLingua(
                  it:
                      'Se un lavoro da solo dura quanto un blocco, il '
                      'colpevole è quello. Se sono tutti piccoli e i blocchi '
                      'restano, è la roba da buttare che si accumula.',
                  en:
                      'If one job alone lasts as long as a stall, that\'s the '
                      'culprit. If they are all small and the stalls remain, '
                      'it\'s garbage piling up.',
                ),
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
              Text(
                inLingua(it: 'La plancia', en: 'The dashboard'),
                style: testi.titleMedium,
              ),
              const SizedBox(height: 6),
              /* I numeri veri delle barre del telefono: sono quelli che
                 * l'app passa alla pagina, e quando la barra della plancia
                 * finisce sotto i tasti la risposta e' qui. */
              riga(
                inLingua(it: 'Barre del telefono', en: 'Phone bars'),
                inLingua(
                  it:
                      'in cima ${_quanto(context, sopra: true)}, in fondo '
                      '${_quanto(context, sopra: false)}',
                  en:
                      'top ${_quanto(context, sopra: true)}, bottom '
                      '${_quanto(context, sopra: false)}',
                ),
              ),
              const SizedBox(height: 6),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  inLingua(it: 'Plancia leggera', en: 'Light dashboard'),
                ),
                subtitle: Text(
                  inLingua(
                    it:
                        'Spenta di serie. Ferma le animazioni che non '
                        'finiscono mai e toglie le sfocature dietro le '
                        'tessere: la plancia cambia aspetto. Solo se il '
                        'telefono proprio non ce la fa.',
                    en:
                        'Off by default. It stops the never-ending animations '
                        'and removes the blur behind the cards: the dashboard '
                        'looks different. Only if the phone really can\'t '
                        'keep up.',
                  ),
                ),
                value: impostazioni.planciaLeggera,
                onChanged: (valore) =>
                    impostazioni.metti(planciaLeggera: valore),
              ),
              if (impostazioni.android)
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    inLingua(
                      it: 'Composizione ibrida',
                      en: 'Hybrid composition',
                    ),
                  ),
                  subtitle: Text(
                    inLingua(
                      it:
                          'Il riquadro della plancia lo disegna Android per '
                          'conto suo, invece di passare da Flutter a ogni '
                          'fotogramma. Prova a spegnerla solo se con lei va '
                          'peggio.',
                      en:
                          'Android draws the dashboard frame on its own, '
                          'instead of going through Flutter on every frame. '
                          'Only try turning it off if things are worse with '
                          'it on.',
                    ),
                  ),
                  value: impostazioni.composizioneIbrida,
                  onChanged: (valore) =>
                      impostazioni.metti(composizioneIbrida: valore),
                ),
              const SizedBox(height: 4),
              Text(
                inLingua(
                  it: 'Cambiare un interruttore ricarica la plancia.',
                  en: 'Flipping either switch reloads the dashboard.',
                ),
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
      appBar: AppBar(title: Text(Sezione.comeVaLApp.titolo)),
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
          Text(
            inLingua(
              it: 'Quanto ci mettono i dati',
              en: 'How long the data takes',
            ),
            style: testi.titleMedium,
          ),
          const SizedBox(height: 6),
          if (quanti == 0)
            Text(
              casa == null
                  ? inLingua(
                      it: 'La casa non è ancora collegata.',
                      en: 'Your home isn\'t connected yet.',
                    )
                  : inLingua(
                      it:
                          'Nessun cambiamento misurato, ancora. Apri i '
                          'dispositivi e aspetta che qualcosa in casa cambi.',
                      en:
                          'No change measured yet. Open the devices and wait '
                          'for something at home to change.',
                    ),
              style: testi.bodySmall?.copyWith(
                color: colori.onSurfaceVariant,
                height: 1.4,
              ),
            )
          else ...[
            riga(inLingua(it: 'Di solito', en: 'Usually'), _quanto(solito)),
            riga(inLingua(it: 'Il peggiore', en: 'Worst'), _quanto(peggiore)),
            riga(
              inLingua(it: 'Su quanti', en: 'Out of'),
              inLingua(it: '$quanti cambiamenti', en: '$quanti changes'),
            ),
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
      return inLingua(
        it:
            'La strada è immediata: quello che cambia in casa arriva qui in '
            'meno di due secondi. Se un valore a schermo sembra vecchio di un '
            'minuto, quel minuto non è della strada — è Home Assistant che '
            'scopre quel dato una volta al minuto, perché è così che '
            'l\'integrazione che lo porta interroga il dispositivo.',
        en:
            'The route is immediate: what changes at home gets here in less '
            'than two seconds. If a value on screen looks a minute old, that '
            'minute isn\'t the route\'s — it\'s Home Assistant finding out '
            'once a minute, because that\'s how the integration behind it '
            'polls the device.',
      );
    }
    if (solito.inSeconds < 15) {
      return inLingua(
        it:
            'Qualche secondo: è la strada, e di solito vuol dire che si sta '
            'passando dal centralino invece che dalla rete di casa.',
        en:
            'A few seconds: that\'s the route, and it usually means you\'re '
            'going through the relay instead of your home network.',
      );
    }
    return inLingua(
      it:
          'Tanto. Questo è un ritardo della strada, non di Home Assistant: '
          'vale la pena mandarlo in una segnalazione, con questa schermata '
          'allegata.',
      en:
          'A lot. This delay is the route\'s, not Home Assistant\'s: worth '
          'sending in a report, with this screen attached.',
    );
  }
}
