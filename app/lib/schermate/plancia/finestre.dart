/// La pagina Finestre: ogni scheda e' una finestra guardata dalla stanza —
/// l'infisso, e dietro il vetro la tapparella che scende — con il cursore
/// della posizione, Apri, Ferma, Chiudi.
///
/// E' la sezione Finestre di DashboardModern, ridotta all'essenziale: il
/// disegno dice a colpo d'occhio quanto e' giu' la tapparella, il contatto
/// sull'anta dice se la finestra e' aperta, e una finestra senza motori —
/// solo il sensore — ha la sua scheda senza comandi.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../plancia/comandi.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/numeri.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
import 'comune.dart';

const _blu = Color(0xFF0284C7);

/// Come sta una copertura adesso: posizione (0 chiusa, 100 aperta), aperta,
/// in movimento, e se l'anta e' aperta.
class VistaDellaFinestra {
  const VistaDellaFinestra({
    required this.copertura,
    required this.posizione,
    required this.aperta,
    required this.inMovimento,
    required this.disponibile,
    required this.antaAperta,
    required this.regolabile,
  });

  final Copertura copertura;
  final int? posizione;
  final bool aperta;
  final bool inMovimento;
  final bool disponibile;

  /// `null` senza contatto; altrimenti quello che dice il contatto.
  final bool? antaAperta;

  /// Accetta una posizione (bit 4 di `supported_features`).
  final bool regolabile;

  String get nome =>
      copertura.nome.isNotEmpty ? copertura.nome : copertura.entita;
}

VistaDellaFinestra vistaDellaFinestra(Copertura copertura, Leggi leggi) {
  final letta = copertura.entita.isEmpty ? null : leggi(copertura.entita);
  final grezzo = pulito(letta?.stato).toLowerCase();
  var posizione = comeNumero(letta?.attributi['current_position']);
  if (posizione != null && copertura.invertita) posizione = 100 - posizione;
  bool? anta;
  if (copertura.contatto.isNotEmpty) {
    final contatto = pulito(leggi(copertura.contatto)?.stato).toLowerCase();
    if (contatto.isNotEmpty &&
        contatto != 'unavailable' &&
        contatto != 'unknown') {
      anta = contatto == 'on' || contatto == 'open';
    }
  }
  final soloSensore = copertura.soloFinestra;
  return VistaDellaFinestra(
    copertura: copertura,
    posizione: soloSensore ? null : posizione?.round(),
    aperta: soloSensore
        ? anta == true
        : grezzo == 'opening' ||
              (posizione != null ? posizione > 0 : grezzo == 'open'),
    inMovimento: grezzo == 'opening' || grezzo == 'closing',
    disponibile: soloSensore
        ? anta != null
        : letta != null && grezzo != 'unavailable' && grezzo != 'unknown',
    antaAperta: anta,
    regolabile:
        !soloSensore &&
        ((comeNumero(letta?.attributi['supported_features'])?.toInt() ?? 0) &
                4) !=
            0,
  );
}

typedef Leggi = dynamic Function(String entita);

class PaginaDelleFinestre extends StatelessWidget {
  const PaginaDelleFinestre({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  Widget build(BuildContext context) {
    final casa = collegamento.stato;
    final coperture = configurazione.coperture;
    if (casa == null || coperture.isEmpty) {
      return const StatoVuoto(
        icona: Icons.blinds_rounded,
        titolo: 'Nessuna finestra',
        sotto: 'Aggiungi tapparelle, tende e sensori dall\'Editor Dashboard.',
      );
    }
    final comandi = Comandi(casa);
    final viste = [
      for (final c in coperture) vistaDellaFinestra(c, (id) => casa[id]),
    ];
    final aperte = viste.where((v) => v.aperta).length;
    final chiuse = viste.length - aperte;
    final motorizzate = viste
        .where(
          (v) =>
              !v.copertura.soloFinestra &&
              configurazione.siComanda(v.copertura.entita),
        )
        .toList();
    Future<void> tutte(bool apri) => esegui(context, () async {
      for (final v in motorizzate) {
        await (apri
            ? comandi.apri(v.copertura.entita)
            : comandi.chiudi(v.copertura.entita));
      }
    });
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Row(
          children: [
            RiquadroDiStato(
              etichetta: 'Stato',
              valore:
                  '$aperte apert${aperte == 1 ? 'a' : 'e'} · $chiuse chius${chiuse == 1 ? 'a' : 'e'}',
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (motorizzate.isNotEmpty)
          DueBottoni(
            sinistra: 'Apri tutto',
            destra: 'Chiudi tutto',
            iconaSinistra: Icons.arrow_drop_up_rounded,
            iconaDestra: Icons.arrow_drop_down_rounded,
            quandoSinistra: () => tutte(true),
            quandoDestra: () => tutte(false),
          ),
        const SizedBox(height: 18),
        for (final v in viste) ...[
          SchedaDellaFinestra(
            vista: v,
            comandi: comandi,
            comandabile: configurazione.siComanda(v.copertura.entita),
            stanza: configurazione.stanza(v.copertura.stanzaId)?.nome ?? '',
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class SchedaDellaFinestra extends StatefulWidget {
  const SchedaDellaFinestra({
    super.key,
    required this.vista,
    required this.comandi,
    this.comandabile = true,
    this.stanza = '',
  });

  final VistaDellaFinestra vista;
  final Comandi comandi;
  final bool comandabile;
  final String stanza;

  @override
  State<SchedaDellaFinestra> createState() => _SchedaDellaFinestraState();
}

class _SchedaDellaFinestraState extends State<SchedaDellaFinestra> {
  double? _trascinata;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final v = widget.vista;
    final entita = v.copertura.entita;
    final soloSensore = v.copertura.soloFinestra;
    final posizione =
        (_trascinata ?? (v.posizione ?? (v.aperta ? 100 : 0)).toDouble()).clamp(
          0.0,
          100.0,
        );
    final puo = widget.comandabile && v.disponibile && !soloSensore;
    final ora = DateTime.now();

    return Scheda(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            v.nome,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: testi.titleMedium,
          ),
          if (widget.stanza.isNotEmpty)
            Text(
              widget.stanza,
              style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
            ),
          const SizedBox(height: 8),
          /* Com'e' messa, sotto il nome e non accanto: due pastiglie accanto a
           * un nome lungo lasciavano al nome tre lettere e i puntini. */
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (!soloSensore)
                Pillolina(
                  testo: !v.disponibile
                      ? 'Non disponibile'
                      : v.inMovimento
                      ? 'In movimento'
                      : v.aperta
                      ? 'Aperta'
                      : 'Chiusa',
                  colore: v.aperta ? Colori.bene : colori.onSurfaceVariant,
                  icona: Icons.circle,
                  maiuscolo: true,
                ),
              if (v.antaAperta != null)
                Pillolina(
                  testo: v.antaAperta! ? 'Finestra aperta' : 'Finestra chiusa',
                  colore: v.antaAperta!
                      ? Colori.ambraScura
                      : colori.onSurfaceVariant,
                  icona: Icons.circle,
                  maiuscolo: true,
                ),
            ],
          ),
          const SizedBox(height: 12),
          AspectRatio(
            aspectRatio: 2.4,
            child: CustomPaint(
              painter: _Finestrella(
                posizione: soloSensore ? 100 : posizione / 100,
                antaAperta: v.antaAperta == true,
                notte: ora.hour < 6 || ora.hour >= 20,
                telaio: colori.surfaceContainerHighest,
                sfondo: colori.surfaceContainer,
              ),
            ),
          ),
          if (!soloSensore) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      trackHeight: 8,
                      activeTrackColor: _blu.withValues(alpha: 0.55),
                      inactiveTrackColor: colori.surfaceContainerHigh,
                      thumbColor: colori.surfaceContainerLowest,
                      overlayColor: _blu.withValues(alpha: 0.12),
                    ),
                    child: Slider(
                      value: posizione,
                      max: 100,
                      onChanged: puo && v.regolabile
                          ? (x) => setState(() => _trascinata = x)
                          : null,
                      onChangeEnd: (x) {
                        setState(() => _trascinata = null);
                        esegui(
                          context,
                          () => widget.comandi.posizione(entita, x.round()),
                        );
                      },
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                Bollino(
                  v.posizione == null
                      ? (v.aperta ? 'aperta' : 'chiusa')
                      : '${numero(posizione, cifre: 0)}%',
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _Comando(
                  testo: 'Apri',
                  icona: Icons.arrow_drop_up_rounded,
                  tinta: _blu,
                  quando: puo
                      ? () => esegui(context, () => widget.comandi.apri(entita))
                      : null,
                ),
                const SizedBox(width: 8),
                _Comando(
                  testo: 'Stop',
                  icona: Icons.stop_rounded,
                  tinta: colori.onSurfaceVariant,
                  quando: puo
                      ? () =>
                            esegui(context, () => widget.comandi.ferma(entita))
                      : null,
                ),
                const SizedBox(width: 8),
                _Comando(
                  testo: 'Chiudi',
                  icona: Icons.arrow_drop_down_rounded,
                  tinta: _blu,
                  pieno: true,
                  quando: puo
                      ? () =>
                            esegui(context, () => widget.comandi.chiudi(entita))
                      : null,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Comando extends StatelessWidget {
  const _Comando({
    required this.testo,
    required this.icona,
    required this.tinta,
    this.quando,
    this.pieno = false,
  });
  final String testo;
  final IconData icona;
  final Color tinta;
  final VoidCallback? quando;
  final bool pieno;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Expanded(
      child: pieno
          ? FilledButton.icon(
              onPressed: quando,
              style: FilledButton.styleFrom(
                backgroundColor: tinta,
                minimumSize: const Size(0, 44),
              ),
              icon: Icon(icona, size: 22),
              label: Text(testo),
            )
          : OutlinedButton.icon(
              onPressed: quando,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 44),
                foregroundColor: tinta,
                side: BorderSide(
                  color: quando == null
                      ? colori.outlineVariant
                      : tinta.withValues(alpha: 0.4),
                ),
              ),
              icon: Icon(icona, size: 22),
              label: Text(testo),
            ),
    );
  }
}

/// L'infisso visto dalla stanza: il telaio, due ante col vetro, e dietro il
/// vetro la tapparella a stecche che scende quanto dice la posizione. Dietro
/// ancora il fuori: cielo di giorno, notte con la luna dopo le otto.
class _Finestrella extends CustomPainter {
  const _Finestrella({
    required this.posizione,
    required this.antaAperta,
    required this.notte,
    required this.telaio,
    required this.sfondo,
  });

  /// 1 tutta aperta (tapparella su), 0 tutta chiusa (tapparella giu').
  final double posizione;
  final bool antaAperta;
  final bool notte;
  final Color telaio;
  final Color sfondo;

  @override
  void paint(Canvas tela, Size misura) {
    final tutto = Offset.zero & misura;
    final raggio = const Radius.circular(12);
    tela.drawRRect(
      RRect.fromRectAndRadius(tutto, raggio),
      Paint()..color = sfondo,
    );
    final bordo = misura.height * 0.08;
    final dentro = tutto.deflate(bordo);
    tela.drawRRect(
      RRect.fromRectAndRadius(
        dentro.inflate(bordo * 0.5),
        const Radius.circular(9),
      ),
      Paint()..color = telaio,
    );

    /* Il fuori. */
    final cielo = notte
        ? const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF0B1B3A), Color(0xFF243B6B)],
          )
        : const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF5EC2F2), Color(0xFFBEE7FA)],
          );
    tela.save();
    tela.clipRRect(RRect.fromRectAndRadius(dentro, const Radius.circular(6)));
    tela.drawRect(dentro, Paint()..shader = cielo.createShader(dentro));
    final prato = Rect.fromLTRB(
      dentro.left,
      dentro.bottom - dentro.height * 0.28,
      dentro.right,
      dentro.bottom,
    );
    tela.drawRect(
      prato,
      Paint()
        ..color = notte ? const Color(0xFF1F4D3A) : const Color(0xFF8BD17C),
    );
    if (notte) {
      tela.drawCircle(
        Offset(
          dentro.right - dentro.width * 0.18,
          dentro.top + dentro.height * 0.28,
        ),
        dentro.height * 0.1,
        Paint()..color = const Color(0xFFF4F1D6),
      );
    } else {
      tela.drawCircle(
        Offset(
          dentro.right - dentro.width * 0.2,
          dentro.top + dentro.height * 0.3,
        ),
        dentro.height * 0.13,
        Paint()..color = const Color(0xFFFFE27A),
      );
    }

    /* La tapparella: scende dall'alto per (1 - posizione) dell'altezza. */
    final giu = (1 - posizione).clamp(0.0, 1.0) * dentro.height;
    if (giu > 0) {
      final coperto = Rect.fromLTWH(dentro.left, dentro.top, dentro.width, giu);
      tela.drawRect(coperto, Paint()..color = const Color(0xFFD5DBE5));
      final stecca = Paint()
        ..color = const Color(0xFFB8C1CE)
        ..strokeWidth = 1.2;
      for (var y = dentro.top + 6; y < dentro.top + giu; y += 7) {
        tela.drawLine(Offset(dentro.left, y), Offset(dentro.right, y), stecca);
      }
    }

    /* Le due ante: il montante in mezzo, e il riflesso del vetro. Aperte,
     * si scostano verso i cardini. */
    final montante = Paint()..color = telaio;
    final meta = dentro.center.dx;
    tela.drawRect(
      Rect.fromCenter(
        center: Offset(meta, dentro.center.dy),
        width: bordo * 0.9,
        height: dentro.height,
      ),
      montante,
    );
    final vetro = Paint()
      ..color = Colors.white.withValues(alpha: antaAperta ? 0.05 : 0.18);
    final riflesso = Paint()
      ..color = Colors.white.withValues(alpha: 0.28)
      ..strokeWidth = 3;
    for (final anta in [
      Rect.fromLTRB(
        dentro.left,
        dentro.top,
        meta - bordo * 0.45,
        dentro.bottom,
      ),
      Rect.fromLTRB(
        meta + bordo * 0.45,
        dentro.top,
        dentro.right,
        dentro.bottom,
      ),
    ]) {
      tela.drawRect(anta, vetro);
      if (!antaAperta) {
        tela.drawLine(
          Offset(anta.left + anta.width * 0.18, anta.bottom - 6),
          Offset(anta.left + anta.width * 0.42, anta.top + 6),
          riflesso,
        );
      }
    }
    if (antaAperta) {
      /* Le ante scostate: due lamelle chiare vicino ai cardini. */
      final lamella = Paint()..color = Colors.white.withValues(alpha: 0.85);
      tela.drawRect(
        Rect.fromLTWH(
          dentro.left,
          dentro.top,
          dentro.width * 0.13,
          dentro.height,
        ),
        lamella,
      );
      tela.drawRect(
        Rect.fromLTWH(
          dentro.right - dentro.width * 0.13,
          dentro.top,
          dentro.width * 0.13,
          dentro.height,
        ),
        lamella,
      );
    }
    tela.restore();
    /* La maniglia. */
    tela.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(meta + bordo * 0.9, dentro.center.dy),
          width: bordo * 0.5,
          height: bordo * 2.2,
        ),
        const Radius.circular(3),
      ),
      Paint()..color = const Color(0xFF9AA5B4),
    );
  }

  @override
  bool shouldRepaint(_Finestrella vecchia) =>
      vecchia.posizione != posizione ||
      vecchia.antaAperta != antaAperta ||
      vecchia.notte != notte ||
      vecchia.telaio != telaio ||
      vecchia.sfondo != sfondo;
}
