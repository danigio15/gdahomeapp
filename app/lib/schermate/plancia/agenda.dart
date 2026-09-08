/// La pagina Agenda: gli impegni giorno per giorno, e le cose da fare.
///
/// In cima quello che e' scaduto — una cosa da fare di martedi' scorso non
/// appartiene a martedi' scorso, nessuno scorre indietro per trovarla:
/// appartiene ad adesso, ed e' proprio la riga per cui si apre l'agenda. Poi
/// i giorni, ognuno coi suoi appuntamenti e le sue scadenze mescolati, perche'
/// una cosa da fare con una data **e'** un impegno di quel giorno.
///
/// Le cose senza data stanno in fondo, nella loro lista, e li' si spuntano.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../plancia/agenda.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/libro.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
import 'comune.dart';

const _viola = Color(0xFF6366F1);
const _verde = Color(0xFF059669);

class PaginaDellAgenda extends StatefulWidget {
  const PaginaDellAgenda({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  State<PaginaDellAgenda> createState() => _PaginaDellAgendaState();
}

class _PaginaDellAgendaState extends State<PaginaDellAgenda> {
  /// Le voci che si stanno spuntando adesso: il segno di spunta si muove
  /// subito, e la casa lo conferma un momento dopo.
  final _inCorso = <String>{};

  @override
  Widget build(BuildContext context) {
    final libro = widget.collegamento.libro;
    final config = widget.configurazione;
    final calendari = config.calendari;
    final liste = config.liste;
    if (calendari.isEmpty && liste.isEmpty) {
      return const StatoVuoto(
        icona: Icons.event_rounded,
        titolo: 'Niente in agenda',
        sotto:
            'Scegli i calendari e le liste da guardare dall\'Editor Dashboard.',
      );
    }
    return StreamBuilder<void>(
      stream: libro?.cambiamenti,
      builder: (context, _) => _corpo(context, libro),
    );
  }

  Widget _corpo(BuildContext context, LibroDegliImpegni? libro) {
    final adesso = DateTime.now();
    final impegni = libro?.impegni ?? const <Impegno>[];
    final cose = libro?.cose ?? const <Cosa>[];
    final agenda = agendaPerGiorno(impegni, cose, adesso);
    final aperte = daFare(cose);
    final senzaData = aperte.where((una) => una.scadenza == null).toList();

    if (libro?.inArrivo == true && impegni.isEmpty && cose.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(
      onRefresh: widget.collegamento.rileggiLaPlancia,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          _Riepilogo(
            impegni: impegni,
            cose: cose,
            adesso: adesso,
            conCalendari: widget.configurazione.calendari.isNotEmpty,
          ),
          if (agenda.inRitardo.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Insegna('In ritardo'),
            for (final riga in agenda.inRitardo)
              _RigaDiAgenda(
                riga: riga,
                adesso: adesso,
                inRitardo: true,
                quandoSpunta: () => _spunta(libro, riga.cosa!),
                mentre: _inCorso.contains(riga.cosa?.uid),
              ),
          ],
          if (agenda.giorni.isEmpty && agenda.inRitardo.isEmpty) ...[
            const SizedBox(height: 20),
            const StatoVuoto(
              icona: Icons.event_available_rounded,
              titolo: 'Niente in programma',
              sotto: 'I prossimi trenta giorni sono liberi.',
            ),
          ],
          for (final giorno in agenda.giorni) ...[
            const SizedBox(height: 20),
            InsegnaConConto(
              testo: etichettaDelGiorno(giorno.giorno, adesso),
              conto: '${giorno.righe.length}',
            ),
            for (final riga in giorno.righe)
              _RigaDiAgenda(
                riga: riga,
                adesso: adesso,
                quandoSpunta: riga.eUnaCosa
                    ? () => _spunta(libro, riga.cosa!)
                    : null,
                mentre: _inCorso.contains(riga.cosa?.uid),
              ),
          ],
          for (final lista in widget.configurazione.liste) ...[
            () {
              final voci = senzaData
                  .where((una) => una.lista == lista.entita)
                  .toList();
              if (voci.isEmpty) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.only(top: 20),
                child: InsegnaConConto(
                  testo: lista.nome.isEmpty ? 'Da fare' : lista.nome,
                  conto: '${voci.length}',
                  icona: const Icon(Icons.checklist_rounded, size: 16),
                ),
              );
            }(),
            for (final una in senzaData.where((v) => v.lista == lista.entita))
              _CosaDaFare(
                cosa: una,
                mentre: _inCorso.contains(una.uid),
                quando: () => _spunta(libro, una),
              ),
          ],
        ],
      ),
    );
  }

  Future<void> _spunta(LibroDegliImpegni? libro, Cosa cosa) async {
    if (libro == null) return;
    setState(() => _inCorso.add(cosa.uid));
    try {
      await libro.spunta(cosa.lista, cosa, fatta: !cosa.fatta);
    } finally {
      if (mounted) setState(() => _inCorso.remove(cosa.uid));
    }
  }
}

/// Quanti impegni e quante cose: la riga che risponde prima di leggere.
class _Riepilogo extends StatelessWidget {
  const _Riepilogo({
    required this.impegni,
    required this.cose,
    required this.adesso,
    required this.conCalendari,
  });

  final List<Impegno> impegni;
  final List<Cosa> cose;
  final DateTime adesso;
  final bool conCalendari;

  @override
  Widget build(BuildContext context) {
    final conto = contoDellAgenda(impegni, cose, adesso);
    final aperte = daFare(cose).length;
    return Row(
      children: [
        if (conCalendari)
          RiquadroDiStato(
            etichetta: switch (conto.quando) {
              QuandoConta.oggi => 'Oggi',
              QuandoConta.domani => 'Domani',
              QuandoConta.avanti => 'In arrivo',
              QuandoConta.mai => 'Impegni',
            },
            valore: '${conto.quante}',
            sotto: conto.quante == 1 ? 'impegno' : 'impegni',
            colore: _viola,
          ),
        if (conCalendari) const SizedBox(width: 10),
        RiquadroDiStato(
          etichetta: 'Da fare',
          valore: '$aperte',
          sotto: aperte == 0 ? 'tutto fatto' : 'cose aperte',
          colore: _verde,
        ),
      ],
    );
  }
}

/// Una riga dell'agenda: un appuntamento, o una scadenza da spuntare.
class _RigaDiAgenda extends StatelessWidget {
  const _RigaDiAgenda({
    required this.riga,
    required this.adesso,
    this.inRitardo = false,
    this.quandoSpunta,
    this.mentre = false,
  });

  final RigaDellAgenda riga;
  final DateTime adesso;
  final bool inRitardo;
  final VoidCallback? quandoSpunta;
  final bool mentre;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final impegno = riga.impegno;
    final adessoInCorso = impegno?.inCorso(adesso) ?? false;
    final tono = inRitardo
        ? Colori.male
        : riga.eUnaCosa
        ? _verde
        : _viola;

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Scheda(
        colore: adessoInCorso || inRitardo
            ? tono.withValues(alpha: 0.06)
            : null,
        bordo: adessoInCorso || inRitardo ? tono.withValues(alpha: 0.35) : null,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (riga.eUnaCosa)
              _Spunta(mentre: mentre, quando: quandoSpunta, tono: tono)
            else
              Container(
                width: 4,
                height: 38,
                margin: const EdgeInsets.only(right: 12, top: 2),
                decoration: BoxDecoration(
                  color: tono.withValues(alpha: adessoInCorso ? 1 : 0.45),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    riga.nome,
                    style: testi.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(
                        adessoInCorso ? 'Adesso' : riga.quando,
                        style: testi.bodySmall?.copyWith(
                          color: adessoInCorso ? tono : colori.onSurfaceVariant,
                          fontWeight: adessoInCorso
                              ? FontWeight.w700
                              : FontWeight.w500,
                        ),
                      ),
                      if (impegno?.luogo.isNotEmpty ?? false) ...[
                        const SizedBox(width: 8),
                        Icon(
                          Icons.place_outlined,
                          size: 13,
                          color: colori.onSurfaceVariant,
                        ),
                        const SizedBox(width: 2),
                        Flexible(
                          child: Text(
                            impegno!.luogo,
                            overflow: TextOverflow.ellipsis,
                            style: testi.bodySmall?.copyWith(
                              color: colori.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            if (inRitardo)
              const Pillolina(testo: 'In ritardo', colore: Colori.male),
          ],
        ),
      ),
    );
  }
}

/// Una cosa da fare senza data: solo il segno di spunta e il nome.
class _CosaDaFare extends StatelessWidget {
  const _CosaDaFare({
    required this.cosa,
    required this.quando,
    this.mentre = false,
  });

  final Cosa cosa;
  final VoidCallback quando;
  final bool mentre;

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Scheda(
        child: Row(
          children: [
            _Spunta(mentre: mentre, quando: quando, tono: _verde),
            Expanded(
              child: Text(
                cosa.nome,
                style: testi.titleSmall?.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Il quadratino che si spunta. Mentre la casa risponde gira, invece di
/// restare fermo come se il tocco fosse andato perso.
class _Spunta extends StatelessWidget {
  const _Spunta({
    required this.mentre,
    required this.quando,
    required this.tono,
  });

  final bool mentre;
  final VoidCallback? quando;
  final Color tono;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: SizedBox(
        width: 26,
        height: 26,
        child: mentre
            ? const Padding(
                padding: EdgeInsets.all(4),
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : IconButton(
                padding: EdgeInsets.zero,
                iconSize: 22,
                tooltip: 'Fatto',
                onPressed: quando,
                icon: Icon(
                  Icons.check_circle_outline_rounded,
                  color: quando == null ? colori.onSurfaceVariant : tono,
                ),
              ),
      ),
    );
  }
}
