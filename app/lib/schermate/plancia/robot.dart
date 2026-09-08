/// La pagina Robot: aspirapolvere e rasaerba, con i loro tasti.
///
/// Di un robot si guardano tre cose: cosa sta facendo, quanta batteria gli
/// resta, e se e' finito in errore. I tasti — parti, pausa, alla base, fatti
/// trovare — ci sono solo se l'apparecchio li dichiara.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../plancia/comandi.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/numeri.dart';
import '../../plancia/viste.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
import 'comune.dart';

const _viola = Color(0xFF7C3AED);

class PaginaDeiRobot extends StatelessWidget {
  const PaginaDeiRobot({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  Widget build(BuildContext context) {
    final casa = collegamento.stato;
    final robot = configurazione.robot.where((r) => r.entita.isNotEmpty);
    if (casa == null || robot.isEmpty) {
      return const StatoVuoto(
        icona: Icons.smart_toy_rounded,
        titolo: 'Nessun robot',
        sotto: 'Aggiungi aspirapolvere e rasaerba dall\'Editor Dashboard.',
      );
    }
    final comandi = Comandi(casa);
    final viste = [
      for (final uno in robot)
        vistaDelRobot(
          uno,
          casa[uno.entita],
          uno.batteria.isEmpty ? null : casa[uno.batteria],
        ),
    ];
    final alLavoro = viste.where((v) => v.alLavoro).length;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Row(
          children: [
            RiquadroDiStato(
              etichetta: 'Al lavoro',
              valore: '$alLavoro/${viste.length}',
              sotto: alLavoro == 0 ? 'tutti fermi' : 'in funzione',
              colore: _viola,
            ),
          ],
        ),
        const SizedBox(height: 16),
        for (final vista in viste)
          SchedaDelRobot(
            vista: vista,
            comandi: comandi,
            stanza: configurazione.stanza(vista.stanzaId)?.nome ?? '',
            comandabile: configurazione.siComanda(vista.entita),
          ),
      ],
    );
  }
}

class SchedaDelRobot extends StatelessWidget {
  const SchedaDelRobot({
    super.key,
    required this.vista,
    required this.comandi,
    this.stanza = '',
    this.comandabile = true,
  });

  final VistaDelRobot vista;
  final Comandi comandi;
  final String stanza;
  final bool comandabile;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final tono = vista.inErrore
        ? Colori.male
        : vista.alLavoro
        ? _viola
        : colori.onSurfaceVariant;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Scheda(
        colore: vista.alLavoro ? _viola.withValues(alpha: 0.07) : null,
        bordo: vista.inErrore
            ? Colori.male.withValues(alpha: 0.4)
            : vista.alLavoro
            ? _viola.withValues(alpha: 0.35)
            : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Cerchietto(
                  colore: tono,
                  icona: vista.alLavoro
                      ? Icons.cleaning_services_rounded
                      : Icons.smart_toy_rounded,
                ),
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
                      Text(
                        stanza.isEmpty
                            ? vista.parola
                            : '$stanza · ${vista.parola}',
                        style: testi.bodySmall?.copyWith(
                          color: vista.inErrore
                              ? Colori.male
                              : colori.onSurfaceVariant,
                          fontWeight: vista.inErrore
                              ? FontWeight.w700
                              : FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                if (vista.batteria != null)
                  Pillolina(
                    testo: '${numero(vista.batteria, cifre: 0)}%',
                    colore: vista.batteria! <= 20 ? Colori.male : Colori.bene,
                    icona: vista.inCarica
                        ? Icons.battery_charging_full_rounded
                        : Icons.battery_full_rounded,
                  ),
              ],
            ),
            if (vista.errore.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                vista.errore,
                style: testi.bodySmall?.copyWith(color: Colori.male),
              ),
            ],
            if (comandabile) ...[
              const SizedBox(height: 12),
              DuePerRiga([
                if (vista.puoPartire && !vista.alLavoro)
                  _Tasto(
                    testo: 'Parti',
                    icona: Icons.play_arrow_rounded,
                    pieno: true,
                    quando: () =>
                        esegui(context, () => comandi.parti(vista.entita)),
                  ),
                if (vista.puoPausa && vista.alLavoro)
                  _Tasto(
                    testo: 'Pausa',
                    icona: Icons.pause_rounded,
                    quando: () =>
                        esegui(context, () => comandi.pausa(vista.entita)),
                  ),
                if (vista.puoFermarsi && vista.alLavoro)
                  _Tasto(
                    testo: 'Ferma',
                    icona: Icons.stop_rounded,
                    quando: () =>
                        esegui(context, () => comandi.fermati(vista.entita)),
                  ),
                if (vista.puoTornare && !vista.allaBase)
                  _Tasto(
                    testo: 'Alla base',
                    icona: Icons.home_rounded,
                    quando: () =>
                        esegui(context, () => comandi.allaBase(vista.entita)),
                  ),
                if (vista.puoFarsiTrovare)
                  _Tasto(
                    testo: 'Dove sei',
                    icona: Icons.volume_up_rounded,
                    quando: () => esegui(
                      context,
                      () => comandi.fattiTrovare(vista.entita),
                    ),
                  ),
              ]),
            ],
            if (comandabile &&
                vista.puoPotenza &&
                vista.potenze.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'POTENZA',
                style: testi.labelSmall?.copyWith(
                  letterSpacing: 1,
                  color: colori.onSurfaceVariant,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                children: [
                  for (final quale in vista.potenze)
                    ChoiceChip(
                      label: Text(quale),
                      selected: quale == vista.potenza,
                      onSelected: (_) => esegui(
                        context,
                        () => comandi.potenza(vista.entita, quale),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Tasto extends StatelessWidget {
  const _Tasto({
    required this.testo,
    required this.icona,
    required this.quando,
    this.pieno = false,
  });

  final String testo;
  final IconData icona;
  final VoidCallback quando;
  final bool pieno;

  @override
  Widget build(BuildContext context) => pieno
      ? FilledButton.icon(
          onPressed: quando,
          icon: Icon(icona, size: 18),
          label: Text(testo),
          style: FilledButton.styleFrom(backgroundColor: _viola),
        )
      : OutlinedButton.icon(
          onPressed: quando,
          icon: Icon(icona, size: 18),
          label: Text(testo),
        );
}
