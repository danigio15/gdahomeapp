/// La pagina di una notifica.
///
/// «Quando si clicca sulla notifica venga aperta l'app con la
/// visualizzazione della stessa notifica, strutturata nello stesso modo.»
/// Toccata, una notifica apre questa pagina (`campanello.dart`,
/// [apriLaNotifica]), fatta come la notifica: in cima l'app, la casa e
/// quando; il titolo com'era, il testo, la foto del momento o la scheda, i
/// tasti. Sotto, un tasto porta dove sta la cosa di cui parla: «Guarda dal
/// vivo», «Apri Sicurezza», «Apri la tua giornata».
///
/// L'immagine e' quella della notifica, tenuta sul telefono quando e'
/// arrivata (`notifiche/le_immagini.dart`): la foto del movimento e' quella
/// di quel momento, non una di adesso. Solo se non c'e' — una notifica di
/// prima, una semplice — si disegna la scheda, o si chiede alla casa sul filo
/// cifrato la foto di adesso, e la si dice tale («Adesso, dal vivo»).
library;

import 'dart:async';
import 'dart:io' show Directory;
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../notifiche/consegna.dart';
import '../notifiche/le_immagini.dart';
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
    this.etichettaDelPosto,
    this.vaiAlPosto,
    this.cartellaDelleImmagini,
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

  /// Il tasto che porta al posto della notifica («Guarda dal vivo», «Apri
  /// Sicurezza»), e cosa fa. Senza, il tasto non c'e'.
  final String? etichettaDelPosto;
  final Future<void> Function(BuildContext pagina)? vaiAlPosto;

  /// Dove stanno le immagini delle notifiche: per le prove.
  final Directory? cartellaDelleImmagini;

  @override
  State<SchermataDellaNotifica> createState() => _StatoDellaNotifica();
}

class _StatoDellaNotifica extends State<SchermataDellaNotifica> {
  Uint8List? _immagine;

  /// L'immagine e' una foto di adesso, non quella della notifica.
  bool _dalVivo = false;
  Timer? _ancora;
  String? _premuto;

  NotificaArrivata get _notifica => widget.tocco.notifica;

  @override
  void initState() {
    super.initState();
    _immagine = widget.immagineIniziale;
    if (_immagine == null) unawaited(_cercaLImmagine());
  }

  /* Prima quella della notifica; poi la scheda disegnata adesso; poi, per
   * una telecamera, la foto di adesso. */
  Future<void> _cercaLImmagine() async {
    final tenuta = await prendiLImmagine(
      _notifica.id,
      cartella: widget.cartellaDelleImmagini,
    );
    if (!mounted) return;
    if (tenuta != null) {
      setState(() => _immagine = tenuta);
      return;
    }
    if (_notifica.scheda != null) {
      final disegno = await disegnaLaNotifica(scheda: _notifica.scheda);
      if (!mounted) return;
      if (disegno.grande != null) {
        setState(() => _immagine = disegno.grande);
        return;
      }
    }
    final camera = _notifica.camera;
    final collegamento = widget.collegamento;
    if (camera == null || collegamento == null) return;
    /* L'app aperta dalla notifica ha il filo che si sta aprendo: si richiede
     * ogni due secondi, per mezzo minuto al piu'. */
    var volte = 0;
    Future<void> prova() async {
      volte += 1;
      final foto = await laFotoDi(collegamento, camera);
      if (!mounted) return;
      if (foto != null) {
        _ancora?.cancel();
        setState(() {
          _immagine = foto;
          _dalVivo = true;
        });
      } else if (volte >= 15) {
        _ancora?.cancel();
      }
    }

    unawaited(prova());
    _ancora = Timer.periodic(
      const Duration(seconds: 2),
      (_) => unawaited(prova()),
    );
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
    final etichetta = widget.etichettaDelPosto;
    final vai = widget.vaiAlPosto;
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
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
              children: [
                /* La notifica, come la si era vista. */
                Scheda(
                  key: const Key('notifica-testa'),
                  padding: EdgeInsets.zero,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                        child: Row(
                          children: [
                            Container(
                              width: 26,
                              height: 26,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: colori.surfaceContainerHigh,
                                borderRadius: BorderRadius.circular(7),
                              ),
                              child: Oggetto(
                                comeSiChiama(_notifica.tipo).disegno,
                                lato: 18,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'GdAHome',
                              style: testi.labelLarge?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                [
                                  quandoDetto(_notifica.quando, adesso),
                                  if (casa.isNotEmpty) casa,
                                ].join(' · '),
                                key: const Key('notifica-quando'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.right,
                                style: testi.bodySmall?.copyWith(
                                  color: colori.onSurfaceVariant,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                        child: Text(
                          /* Il disegno della voce sta gia' nell'intestazione,
                           * come l'icona dell'app nella notifica. */
                          titoloSenzaEmoji(_notifica.titolo),
                          key: const Key('notifica-titolo'),
                          style: testi.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            height: 1.25,
                          ),
                        ),
                      ),
                      if (testo.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                          child: Text(
                            testo,
                            style: testi.bodyMedium?.copyWith(height: 1.4),
                          ),
                        ),
                      if (_notifica.fonte case final String fonte)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                          child: Text(
                            fonte,
                            style: testi.bodySmall?.copyWith(
                              color: colori.onSurfaceVariant,
                            ),
                          ),
                        ),
                      if (immagine != null)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(14),
                            child: Stack(
                              children: [
                                Image.memory(
                                  immagine,
                                  key: const Key('notifica-immagine'),
                                  width: double.infinity,
                                  fit: BoxFit.cover,
                                  gaplessPlayback: true,
                                ),
                                if (_dalVivo)
                                  Positioned(
                                    left: 10,
                                    top: 10,
                                    child: _Bollino(
                                      inLingua(
                                        it: 'Adesso, dal vivo',
                                        en: 'Now, live',
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      if (tasti.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Divider(height: 1, color: colori.outlineVariant),
                        if (!vale)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
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
                        /* I tasti come sotto la notifica: in fila, uno
                         * accanto all'altro. */
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 4,
                            vertical: 2,
                          ),
                          child: Row(
                            children: [
                              for (final tasto in tasti)
                                Expanded(
                                  child: TextButton(
                                    key: Key('notifica-tasto-${tasto.id}'),
                                    onPressed: vale && _premuto == null
                                        ? () => _tasto(tasto)
                                        : null,
                                    child: Text(
                                      tasto.etichetta,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ] else
                        const SizedBox(height: 16),
                    ],
                  ),
                ),
                if (etichetta != null && vai != null) ...[
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    key: const Key('notifica-vai'),
                    onPressed: () => vai(context),
                    icon: const Icon(Icons.arrow_forward_rounded),
                    label: Text(etichetta),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Un'etichetta scura sopra la foto.
class _Bollino extends StatelessWidget {
  const _Bollino(this.testo);

  final String testo;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        testo,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
