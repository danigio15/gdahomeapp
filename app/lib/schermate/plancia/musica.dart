/// La pagina Musica: chi suona, cosa, e i tasti per comandarlo.
///
/// Una scheda per lettore, con la copertina quando Home Assistant ne pubblica
/// una. I tasti ci sono solo se l'apparecchio li accetta davvero — lo dice
/// `supported_features` — perche' un tasto che non fa niente e' peggio di un
/// tasto che non c'e'.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../plancia/comandi.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/viste.dart';
import '../../vestito/pezzi.dart';
import 'comune.dart';

const _viola = Color(0xFF8B5CF6);

class PaginaDellaMusica extends StatelessWidget {
  const PaginaDellaMusica({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  Widget build(BuildContext context) {
    final casa = collegamento.stato;
    final lettori = configurazione.lettori;
    if (casa == null || lettori.isEmpty) {
      return const StatoVuoto(
        icona: Icons.speaker_rounded,
        titolo: 'Nessun lettore',
        sotto: 'Scegli i lettori da mostrare dall\'Editor Dashboard.',
      );
    }
    final comandi = Comandi(casa);
    final viste = [
      for (final lettore in lettori)
        vistaDelLettore(lettore, casa[lettore.entita]),
    ];
    final suonano = viste.where((v) => v.suona).length;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Row(
          children: [
            RiquadroDiStato(
              etichetta: 'Stato',
              valore: '$suonano/${viste.length}',
              sotto: suonano == 1 ? 'in riproduzione' : 'in riproduzione',
              colore: _viola,
            ),
          ],
        ),
        const SizedBox(height: 16),
        for (final vista in viste)
          SchedaDelLettore(
            vista: vista,
            comandi: comandi,
            stanza: configurazione.stanza(vista.stanzaId)?.nome ?? '',
            comandabile: configurazione.siComanda(vista.entita),
          ),
      ],
    );
  }
}

/// Un lettore: la copertina, cosa suona, i tasti e il volume.
class SchedaDelLettore extends StatefulWidget {
  const SchedaDelLettore({
    super.key,
    required this.vista,
    required this.comandi,
    this.stanza = '',
    this.comandabile = true,
  });

  final VistaDelLettore vista;
  final Comandi comandi;
  final String stanza;
  final bool comandabile;

  @override
  State<SchedaDelLettore> createState() => _SchedaDelLettoreState();
}

class _SchedaDelLettoreState extends State<SchedaDelLettore> {
  /// Mentre si trascina comanda il dito, non la casa: se no la manopola
  /// tornerebbe indietro a ogni notizia che arriva.
  int? _trascinato;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final vista = widget.vista;
    final acceso = vista.suona;
    final tasti = widget.comandabile && vista.disponibile;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Scheda(
        colore: acceso ? _viola.withValues(alpha: 0.07) : null,
        bordo: acceso ? _viola.withValues(alpha: 0.35) : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Copertina(vista: vista),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        vista.nome,
                        style: testi.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (widget.stanza.isNotEmpty)
                        Text(
                          widget.stanza,
                          style: testi.bodySmall?.copyWith(
                            color: colori.onSurfaceVariant,
                          ),
                        ),
                      const SizedBox(height: 6),
                      Text(
                        vista.cosaSuona.isEmpty
                            ? vista.parola
                            : vista.cosaSuona,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: testi.bodyMedium?.copyWith(
                          color: acceso ? _viola : colori.onSurfaceVariant,
                          fontWeight: acceso
                              ? FontWeight.w600
                              : FontWeight.w500,
                        ),
                      ),
                      if (vista.sorgente.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Pillolina(testo: vista.sorgente, colore: _viola),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            if (tasti) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  if (vista.puoIndietro)
                    _Tondo(
                      icona: Icons.skip_previous_rounded,
                      quando: () => esegui(
                        context,
                        () => widget.comandi.brano(vista.entita, avanti: false),
                      ),
                    ),
                  if (vista.puoPausa)
                    _Tondo(
                      icona: vista.suona
                          ? Icons.pause_rounded
                          : Icons.play_arrow_rounded,
                      pieno: true,
                      quando: () => esegui(
                        context,
                        () => widget.comandi.suonaOFermati(vista.entita),
                      ),
                    ),
                  if (vista.puoAvanti)
                    _Tondo(
                      icona: Icons.skip_next_rounded,
                      quando: () => esegui(
                        context,
                        () => widget.comandi.brano(vista.entita, avanti: true),
                      ),
                    ),
                  const Spacer(),
                  if (vista.puoMuto)
                    _Tondo(
                      icona: vista.muto
                          ? Icons.volume_off_rounded
                          : Icons.volume_up_rounded,
                      quando: () => esegui(
                        context,
                        () => widget.comandi.muto(
                          vista.entita,
                          zitto: !vista.muto,
                        ),
                      ),
                    ),
                  if (vista.puoAccendere)
                    _Tondo(
                      icona: Icons.power_settings_new_rounded,
                      quando: () => esegui(
                        context,
                        () => widget.comandi.inverti(vista.entita),
                      ),
                    ),
                ],
              ),
            ],
            if (tasti && vista.puoVolume) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Text(
                    'VOLUME',
                    style: testi.labelSmall?.copyWith(
                      letterSpacing: 1,
                      color: colori.onSurfaceVariant,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${_trascinato ?? vista.volume ?? 0}%',
                    style: testi.labelMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: _viola,
                    ),
                  ),
                ],
              ),
              Slider(
                value: ((_trascinato ?? vista.volume ?? 0).toDouble()).clamp(
                  0,
                  100,
                ),
                max: 100,
                activeColor: _viola,
                onChanged: (quanto) =>
                    setState(() => _trascinato = quanto.round()),
                onChangeEnd: (quanto) {
                  setState(() => _trascinato = null);
                  esegui(
                    context,
                    () => widget.comandi.volume(vista.entita, quanto.round()),
                  );
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// La copertina del brano, o il disegno di un altoparlante quando non c'e'.
class _Copertina extends StatelessWidget {
  const _Copertina({required this.vista});

  final VistaDelLettore vista;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final forma = BorderRadius.circular(14);
    return Container(
      width: 62,
      height: 62,
      decoration: BoxDecoration(
        color: vista.suona
            ? _viola.withValues(alpha: 0.16)
            : colori.surfaceContainer,
        borderRadius: forma,
      ),
      clipBehavior: Clip.antiAlias,
      child: vista.copertina.isEmpty
          ? Icon(
              Icons.speaker_rounded,
              color: vista.suona ? _viola : colori.onSurfaceVariant,
            )
          : Image.network(
              vista.copertina,
              fit: BoxFit.cover,
              /* Una copertina che non arriva non deve lasciare un buco: al suo
               * posto torna il disegno, come se non ci fosse mai stata. */
              errorBuilder: (context, _, _) => Icon(
                Icons.speaker_rounded,
                color: vista.suona ? _viola : colori.onSurfaceVariant,
              ),
            ),
    );
  }
}

class _Tondo extends StatelessWidget {
  const _Tondo({required this.icona, required this.quando, this.pieno = false});

  final IconData icona;
  final VoidCallback quando;
  final bool pieno;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: pieno ? _viola : colori.surfaceContainer,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: quando,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(
              icona,
              size: pieno ? 26 : 22,
              color: pieno ? Colors.white : colori.onSurface,
            ),
          ),
        ),
      ),
    );
  }
}
