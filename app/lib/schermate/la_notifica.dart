/// La pagina di una notifica.
///
/// «Queste cose che escono in basso non mi piacciono proprio, rivedile.» Una
/// notifica toccata va dove sta la cosa di cui parla (`notifiche/dove_apre.dart`).
/// Quando un posto suo non c'e' — il sensore del frigo, un suggerimento
/// dell'assistente — o la casa adesso non risponde, si apre questa pagina:
/// a schermo intero, con la freccia per tornare, come le altre pagine
/// dell'app.
///
/// Dentro: il disegno della voce, il titolo e il testo; quando e' arrivata e
/// da quale casa, scritti per bene («Oggi alle 21:59 · Casa di prova»); la
/// scheda delle elaborate o la foto della telecamera; i tasti, tasti veri.
///
/// La foto della telecamera, come altrove, la si chiede alla casa sul filo
/// cifrato (`laFotoDi`): dal nostro server non passa.
library;

import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../notifiche/consegna.dart';
import '../notifiche/modello.dart';
import '../notifiche/postino.dart';
import '../notifiche/scheda.dart';
import '../parole.dart';
import '../vestito/oggetti.dart';
import '../vestito/pezzi.dart';
import 'campanello.dart' show laFotoDi, premiIlTasto;
import 'notifiche.dart' show comeSiChiama;

/// Il titolo senza l'emoji davanti («🌙 Antifurto · Inserito notte»): in
/// questa pagina il disegno della voce c'e' gia', grande, accanto.
String titoloSenzaEmoji(String titolo) {
  final senza = titolo.replaceFirst(
    RegExp(r'^[^\p{L}\p{N}]+', unicode: true),
    '',
  );
  return senza.isEmpty ? titolo : senza;
}

const _mesi = [
  ('gen', 'Jan'),
  ('feb', 'Feb'),
  ('mar', 'Mar'),
  ('apr', 'Apr'),
  ('mag', 'May'),
  ('giu', 'Jun'),
  ('lug', 'Jul'),
  ('ago', 'Aug'),
  ('set', 'Sep'),
  ('ott', 'Oct'),
  ('nov', 'Nov'),
  ('dic', 'Dec'),
];

/// Quando, detto come lo si dice: «Oggi alle 21:59», «Ieri alle 7:05»,
/// «14 ott alle 18:30».
String quandoDetto(DateTime quando, DateTime adesso) {
  String due(int n) => n.toString().padLeft(2, '0');
  final ora = '${quando.hour}:${due(quando.minute)}';
  final giorno = DateTime(quando.year, quando.month, quando.day);
  final oggi = DateTime(adesso.year, adesso.month, adesso.day);
  final quanti = oggi.difference(giorno).inDays;
  if (quanti == 0) return inLingua(it: 'Oggi alle $ora', en: 'Today at $ora');
  if (quanti == 1) {
    return inLingua(it: 'Ieri alle $ora', en: 'Yesterday at $ora');
  }
  final (it, en) = _mesi[quando.month - 1];
  return inLingua(
    it: '${quando.day} $it alle $ora',
    en: '$en ${quando.day} at $ora',
  );
}

/// Se il testo dice solo il nome della casa (l'antifurto inserito dice il
/// nome della centrale, che spesso e' quello della casa): sotto il titolo
/// c'e' gia', e due volte non serve.
bool diceSoloLaCasa(String testo, String casa) {
  String piano(String s) =>
      s.toLowerCase().replaceAll(RegExp(r"[^a-z0-9]+"), '');
  return testo.isNotEmpty && casa.isNotEmpty && piano(testo) == piano(casa);
}

class SchermataDellaNotifica extends StatefulWidget {
  const SchermataDellaNotifica({
    super.key,
    required this.tocco,
    required this.nomeDellaCasa,
    this.collegamento,
    this.postino,
    this.immagineIniziale,
    this.adesso,
  });

  final ToccoDellaNotifica tocco;

  /// Il nome della casa come l'ha scritto chi tiene il telefono.
  final String nomeDellaCasa;
  final Collegamento? collegamento;
  final Postino? postino;

  /// La scheda o la foto da mostrare senza disegnarla: per le prove e le
  /// fotografie.
  final Uint8List? immagineIniziale;

  /// L'ora di adesso: per le prove.
  final DateTime? adesso;

  @override
  State<SchermataDellaNotifica> createState() => _StatoDellaNotifica();
}

class _StatoDellaNotifica extends State<SchermataDellaNotifica> {
  Uint8List? _immagine;
  Timer? _ancora;
  String? _premuto;

  NotificaArrivata get _notifica => widget.tocco.notifica;

  @override
  void initState() {
    super.initState();
    _immagine = widget.immagineIniziale;
    if (_immagine != null) return;
    final camera = _notifica.camera;
    final collegamento = widget.collegamento;
    if (camera != null && collegamento != null) {
      /* L'app aperta dalla notifica ha il filo che si sta aprendo: si
       * richiede ogni due secondi, per mezzo minuto al piu'. */
      var volte = 0;
      Future<void> prova() async {
        volte += 1;
        final foto = await laFotoDi(collegamento, camera);
        if (!mounted) return;
        if (foto != null) {
          _ancora?.cancel();
          setState(() => _immagine = foto);
        } else if (volte >= 15) {
          _ancora?.cancel();
        }
      }

      unawaited(prova());
      _ancora = Timer.periodic(
        const Duration(seconds: 2),
        (_) => unawaited(prova()),
      );
    } else if (_notifica.scheda != null) {
      unawaited(
        disegnaLaNotifica(scheda: _notifica.scheda).then((disegno) {
          if (mounted && disegno.grande != null) {
            setState(() => _immagine = disegno.grande);
          }
        }),
      );
    }
  }

  @override
  void dispose() {
    _ancora?.cancel();
    super.dispose();
  }

  Future<void> _tasto(TastoDellaNotifica tasto) async {
    if (_premuto != null) return;
    setState(() => _premuto = tasto.id);
    final fatto = await premiIlTasto(
      context,
      widget.tocco,
      tasto,
      widget.postino,
    );
    if (!mounted) return;
    setState(() => _premuto = null);
    if (fatto) Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final adesso = widget.adesso ?? DateTime.now();
    final vale = _notifica.valeAncora(adesso);
    final tasti = [
      for (final tasto in _notifica.tasti)
        if (!tasto.apre && !tasto.chiude) tasto,
    ];
    final casa = widget.nomeDellaCasa;
    final testo = diceSoloLaCasa(_notifica.testo, casa) ? '' : _notifica.testo;
    final immagine = _immagine;
    return Scaffold(
      appBar: AppBar(
        title: Text(inLingua(it: 'Notifica', en: 'Notification')),
      ),
      body: SafeArea(
        top: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 620),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
              children: [
                Scheda(
                  key: const Key('notifica-testa'),
                  padding: const EdgeInsets.all(18),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 58,
                        height: 58,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: colori.surfaceContainerHigh,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Oggetto(
                          comeSiChiama(_notifica.tipo).disegno,
                          lato: 36,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              titoloSenzaEmoji(_notifica.titolo),
                              style: testi.titleLarge?.copyWith(
                                fontWeight: FontWeight.w800,
                                height: 1.2,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              [
                                quandoDetto(_notifica.quando, adesso),
                                if (casa.isNotEmpty) casa,
                              ].join(' · '),
                              key: const Key('notifica-quando'),
                              style: testi.bodyMedium?.copyWith(
                                color: colori.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                if (testo.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  Text(testo, style: testi.bodyLarge?.copyWith(height: 1.45)),
                ],
                if (_notifica.fonte case final String fonte) ...[
                  const SizedBox(height: 8),
                  Text(
                    fonte,
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ],
                if (immagine != null) ...[
                  const SizedBox(height: 18),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: Image.memory(
                      immagine,
                      key: const Key('notifica-immagine'),
                      fit: BoxFit.cover,
                      gaplessPlayback: true,
                    ),
                  ),
                ],
                if (tasti.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  if (!vale)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Text(
                        inLingua(
                          it:
                              'È passato troppo tempo: i tasti di questa '
                              'notifica non valgono più.',
                          en:
                              'Too much time has passed: this '
                              'notification\'s buttons no longer work.',
                        ),
                        style: testi.bodySmall?.copyWith(
                          color: colori.onSurfaceVariant,
                        ),
                      ),
                    ),
                  for (final (i, tasto) in tasti.indexed) ...[
                    if (i > 0) const SizedBox(height: 10),
                    if (i == 0)
                      FilledButton(
                        key: Key('notifica-tasto-${tasto.id}'),
                        onPressed: vale && _premuto == null
                            ? () => _tasto(tasto)
                            : null,
                        child: Text(tasto.etichetta),
                      )
                    else
                      OutlinedButton(
                        key: Key('notifica-tasto-${tasto.id}'),
                        onPressed: vale && _premuto == null
                            ? () => _tasto(tasto)
                            : null,
                        child: Text(tasto.etichetta),
                      ),
                  ],
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
