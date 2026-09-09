/// La Configurazione: la Config della plancia, uscita dalla plancia.
///
/// Nella dashboard la configurazione si apre da dentro la dashboard stessa: un
/// riquadro sopra la pagina, con diciannove schede in fila orizzontale. Su un
/// telefono quella fila non ci sta — se ne vedono tre per volta e per arrivare
/// a «Elettrodomestici» si scorre al buio — e soprattutto **non e' un posto da
/// app**: la configurazione della casa e' una cosa dell'app, non di una delle
/// sue schermate, e chi la cerca la cerca nel menu.
///
/// Quindi esce, e viene qui: stesse voci, stessi nomi, stesso ordine di senso,
/// raggruppate in famiglie che ci stanno in verticale (vedi
/// `configurazione/albero.dart`). Quello che scrive e' identico: le stesse
/// chiavi sul ponte, con gli stessi comandi (`dashboardmodern/config/get` e
/// `set`), e la plancia se le ritrova. Non c'e' un secondo formato da tenere
/// allineato.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../casa/impostazioni.dart';
import '../vestito/oggetti.dart';
import '../vestito/pezzi.dart';
import 'configurazione/albero.dart';
import 'configurazione/voci.dart';

class SchermataDellaConfigurazione extends StatefulWidget {
  const SchermataDellaConfigurazione({
    super.key,
    required this.collegamento,
    required this.impostazioni,
    this.apri,
  });

  final Collegamento collegamento;
  final Impostazioni impostazioni;

  /// Cosa fare quando si tocca una voce pronta. Di serie apre la sua
  /// schermata; nelle prove si guarda e basta.
  final void Function(Voce voce)? apri;

  @override
  State<SchermataDellaConfigurazione> createState() =>
      _SchermataDellaConfigurazioneState();
}

class _SchermataDellaConfigurazioneState
    extends State<SchermataDellaConfigurazione> {
  @override
  void initState() {
    super.initState();
    /* Le entita' della casa si chiedono qui, all'ingresso della
     * configurazione: e' un megabyte e mezzo che si legge una volta sola, e
     * da qui in poi ogni casella che si apre le trova gia' pronte. */
    unawaited(widget.collegamento.serveLaCasa());
  }

  void _apri(BuildContext contesto, Voce voce) {
    final suo = widget.apri;
    if (suo != null) {
      suo(voce);
      return;
    }
    final schermata = schermataDi(
      voce,
      widget.collegamento,
      widget.impostazioni,
    );
    if (schermata == null) return;
    Navigator.of(contesto)
        .push(MaterialPageRoute<void>(builder: (dentro) => schermata));
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return ListView(
      key: const PageStorageKey('configurazione'),
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
      children: [
        _Cappello(collegamento: widget.collegamento),
        const SizedBox(height: 18),
        for (final famiglia in albero) ...[
          Insegna(famiglia.titolo),
          Padding(
            padding: const EdgeInsets.only(left: 4, right: 4, bottom: 10),
            child: Text(
              famiglia.sotto,
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: colori.onSurfaceVariant),
            ),
          ),
          Scheda(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (final (indice, voce) in famiglia.voci.indexed) ...[
                  if (indice > 0)
                    Divider(
                      height: 1,
                      indent: 62,
                      color: colori.outlineVariant,
                    ),
                  _Riga(voce: voce, apri: (una) => _apri(context, una)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 22),
        ],
        _Coda(),
      ],
    );
  }
}

/// Due righe in cima che dicono di cosa si sta parlando: e' la stessa
/// configurazione della dashboard, non una seconda.
class _Cappello extends StatelessWidget {
  const _Cappello({required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final casa = collegamento.casa?.nome ?? 'questa casa';
    return Scheda(
      colore: colori.primaryContainer,
      bordo: colori.primaryContainer,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Oggetto('impostazioni', lato: 30),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'La configurazione di $casa',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: colori.onPrimaryContainer,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Sono le stesse $quanteDallaPlancia voci della Config '
                  'della dashboard, con gli stessi nomi, piu\' '
                  '${quanteVoci - quanteDallaPlancia} che nella dashboard '
                  'non ci sono. Quello che cambi qui la plancia se lo '
                  'ritrova subito.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colori.onPrimaryContainer.withValues(alpha: 0.85),
                    height: 1.4,
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

class _Riga extends StatelessWidget {
  const _Riga({required this.voce, this.apri});

  final Voce voce;
  final void Function(Voce voce)? apri;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final spenta = !voce.pronta;
    return InkWell(
      onTap: voce.pronta && apri != null ? () => apri!(voce) : null,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 13, 12, 13),
        child: Row(
          children: [
            Opacity(
              opacity: spenta ? 0.45 : 1,
              child: Oggetto(voce.disegno, lato: 26),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          voce.titolo,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(
                                fontWeight: FontWeight.w600,
                                color: spenta
                                    ? colori.onSurfaceVariant
                                    : colori.onSurface,
                              ),
                        ),
                      ),
                      if (voce.viene == Provenienza.dellApp) ...[
                        const SizedBox(width: 8),
                        const Bollino('nuova'),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    voce.sotto,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (spenta)
              const Bollino('presto')
            else
              Icon(Icons.chevron_right_rounded, color: colori.onSurfaceVariant),
          ],
        ),
      ),
    );
  }
}

/// Cosa succede a quello che si scrive qui: si dice, invece di lasciarlo
/// indovinare.
class _Coda extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Scheda(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Dove finisce quello che scrivi',
            style: Theme.of(context).textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            'Sul ponte, in casa tua, nello stesso file dove la dashboard la '
            'tiene gia\'. Non passa da un server nostro e non resta nel '
            'telefono: se cambi telefono la configurazione e\' ancora la '
            'tua, e se la cambi da un telefono gli altri se ne accorgono.',
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: colori.onSurfaceVariant, height: 1.45),
          ),
        ],
      ),
    );
  }
}
