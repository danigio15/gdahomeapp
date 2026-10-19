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
import '../notifiche/dove_apre.dart';
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
    final (chiaro, scuro) = coloriDellaNotifica(_notifica);
    final larga = MediaQuery.sizeOf(context).width;
    final sopra = MediaQuery.paddingOf(context).top;
    return Scaffold(
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          /* La testata: una fascia nel colore della notifica, bassa. A
           * sinistra la freccia; sotto, il disegno in un riquadro di vetro,
           * di che cosa parla, il titolo e quando. La foto e la scheda
           * stanno sotto, nelle loro carte. */
          Container(
            key: const Key('notifica-testa'),
            decoration: BoxDecoration(
              borderRadius: const BorderRadius.vertical(
                bottom: Radius.circular(26),
              ),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [chiaro, scuro],
              ),
              boxShadow: [
                BoxShadow(
                  color: scuro.withValues(alpha: 0.28),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            padding: EdgeInsets.only(top: sopra + 4, bottom: 18),
            child: Center(
              child: SizedBox(
                width: larga < 620 ? larga : 620,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(left: 6),
                      child: BackButton(color: Colors.white),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 2, 20, 0),
                      child: Row(
                        children: [
                          Container(
                            width: 52,
                            height: 52,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              color: Colors.white.withValues(alpha: 0.18),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Oggetto(
                              comeSiChiama(_notifica.tipo).disegno,
                              lato: 32,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  cheCosaE(_notifica).toUpperCase(),
                                  style: testi.labelSmall?.copyWith(
                                    color: Colors.white.withValues(alpha: 0.8),
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 1.1,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  titoloSenzaEmoji(_notifica.titolo),
                                  key: const Key('notifica-titolo'),
                                  style: testi.titleLarge?.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                    height: 1.15,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  [
                                    quandoDetto(_notifica.quando, adesso),
                                    if (casa.isNotEmpty) casa,
                                  ].join(' · '),
                                  key: const Key('notifica-quando'),
                                  style: testi.bodySmall?.copyWith(
                                    color: Colors.white.withValues(alpha: 0.85),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 620),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 20, 18, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (testo.isNotEmpty)
                      Scheda(
                        padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
                        child: Text(
                          testo,
                          style: testi.titleMedium?.copyWith(
                            height: 1.4,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    if (immagine != null) ...[
                      if (testo.isNotEmpty) const SizedBox(height: 14),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(22),
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
                    ],
                    if (tasti.isNotEmpty) ...[
                      const SizedBox(height: 20),
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
                      /* Il primo tasto e' quello che fa la cosa: tutto largo,
                       * pieno, col colore della notifica. Gli altri sotto,
                       * divisi a meta': tre in fila si tagliavano a «Speg…». */
                      _tastoDellaNotifica(
                        tasti.first,
                        primo: true,
                        scuro: scuro,
                        attivo: vale && _premuto == null,
                      ),
                      if (tasti.length > 1) ...[
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            for (final (i, tasto) in tasti.skip(1).indexed) ...[
                              if (i > 0) const SizedBox(width: 10),
                              Expanded(
                                child: _tastoDellaNotifica(
                                  tasto,
                                  primo: false,
                                  scuro: scuro,
                                  attivo: vale && _premuto == null,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ],
                    if (etichetta != null && vai != null) ...[
                      const SizedBox(height: 16),
                      Scheda(
                        key: const Key('notifica-vai'),
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        quandoPremuta: () => vai(context),
                        child: Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: LinearGradient(
                                  colors: [chiaro, scuro],
                                ),
                              ),
                              child: Icon(
                                _notifica.camera != null &&
                                        doveApre(_notifica).posto ==
                                            PostoDellaNotifica.telecamera
                                    ? Icons.videocam_rounded
                                    : Icons.open_in_new_rounded,
                                color: Colors.white,
                                size: 22,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Text(
                                etichetta,
                                style: testi.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            Icon(
                              Icons.chevron_right_rounded,
                              color: colori.onSurfaceVariant,
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (_notifica.fonte case final String fonte) ...[
                      const SizedBox(height: 16),
                      Text(
                        fonte,
                        textAlign: TextAlign.center,
                        style: testi.bodySmall?.copyWith(
                          color: colori.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tastoDellaNotifica(
    TastoDellaNotifica tasto, {
    required bool primo,
    required Color scuro,
    required bool attivo,
  }) {
    final forma = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
    );
    return SizedBox(
      height: 54,
      width: double.infinity,
      child: FilledButton(
        key: Key('notifica-tasto-${tasto.id}'),
        style: FilledButton.styleFrom(
          backgroundColor: primo ? scuro : scuro.withValues(alpha: 0.12),
          foregroundColor: primo ? Colors.white : scuro,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          shape: forma,
        ),
        onPressed: attivo ? () => _tasto(tasto) : null,
        child: _ParolaDelTasto(tasto),
      ),
    );
  }
}

/// Di che cosa parla una notifica, in una parola, per l'etichetta sopra il
/// titolo: «Sicurezza», «Telecamere», «Casa».
String cheCosaE(NotificaArrivata notifica) {
  final (it, en) = switch (sezioneDelTipo[notifica.tipo]) {
    'sicurezza' => ('Sicurezza', 'Security'),
    'varchi' => ('Porte e finestre', 'Doors and windows'),
    'telecamera' => ('Telecamere', 'Cameras'),
    'elettrodomestici' => ('Elettrodomestici', 'Appliances'),
    'sensore' => ('Sensori', 'Sensors'),
    'energia' => ('Energia', 'Energy'),
    'meteo' => ('Meteo', 'Weather'),
    'persone' => ('Persone', 'People'),
    'giornata' => ('La tua giornata', 'Your day'),
    'assistente' => ('Assistente', 'Assistant'),
    'animali' => ('Animali', 'Pets'),
    'viaggi' => ('Viaggi', 'Trips'),
    'plancia' => ('Home Assistant', 'Home Assistant'),
    _ => ('GdAHome', 'GdAHome'),
  };
  return inLingua(it: it, en: en);
}

/// I due colori della copertina, dal tipo della notifica: verde la
/// sicurezza, blu le telecamere, ambra la casa, viola l'energia; rosso
/// quello che e' urgente.
(Color, Color) coloriDellaNotifica(NotificaArrivata notifica) {
  if (notifica.urgente) {
    return (const Color(0xFFEF4444), const Color(0xFF991B1B));
  }
  return switch (sezioneDelTipo[notifica.tipo]) {
    'sicurezza' ||
    'varchi' => (const Color(0xFF14B8A6), const Color(0xFF0F5F58)),
    'telecamera' => (const Color(0xFF3B82F6), const Color(0xFF1E3A8A)),
    'elettrodomestici' ||
    'sensore' => (const Color(0xFFF59E0B), const Color(0xFFB45309)),
    'energia' => (const Color(0xFF8B5CF6), const Color(0xFF4C1D95)),
    'meteo' => (const Color(0xFF38BDF8), const Color(0xFF0369A1)),
    'persone' => (const Color(0xFFEC4899), const Color(0xFF9D174D)),
    'animali' => (const Color(0xFFF97316), const Color(0xFF9A3412)),
    'giornata' ||
    'assistente' => (const Color(0xFF6366F1), const Color(0xFF312E81)),
    _ => (const Color(0xFF64748B), const Color(0xFF1E293B)),
  };
}

class _ParolaDelTasto extends StatelessWidget {
  const _ParolaDelTasto(this.tasto);

  final TastoDellaNotifica tasto;

  @override
  Widget build(BuildContext context) => Text(
    tasto.etichetta,
    maxLines: 1,
    overflow: TextOverflow.ellipsis,
    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
  );
}

/// Un'etichetta di vetro scuro, sopra la foto.
class _Bollino extends StatelessWidget {
  const _Bollino(this.testo);

  final String testo;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        testo,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12.5,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
