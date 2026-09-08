/// La pagina Stanze: una stanza per volta, con dentro tutto quello che
/// possiede, diviso per tipo.
///
/// Ogni altra pagina legge la casa per tipo — tutte le luci, tutte le
/// tapparelle. Questa gira il verso: le pillole delle stanze in alto, e sotto
/// i sensori, il clima, le luci, le prese, le finestre, gli elettrodomestici,
/// i robot, le telecamere di quella stanza. Le schede sono le stesse delle
/// altre pagine: una luce e' la stessa luce ovunque la si guardi.
///
/// Chi non ha una stanza finisce sotto «Senza stanza»: non e' un errore da
/// nascondere, e' la sola occasione di accorgersene.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../plancia/comandi.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/luci.dart';
import '../../plancia/numeri.dart';
import '../../plancia/tessere.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
import 'clima.dart';
import 'comune.dart';
import 'finestre.dart';
import 'luci.dart';

class PaginaDelleStanze extends StatefulWidget {
  const PaginaDelleStanze({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  State<PaginaDelleStanze> createState() => _PaginaDelleStanzeState();
}

class _PaginaDelleStanzeState extends State<PaginaDelleStanze> {
  String? _scelta;

  @override
  Widget build(BuildContext context) {
    final casa = widget.collegamento.stato;
    final config = widget.configurazione;
    final stanze = config.stanze;
    if (casa == null || stanze.isEmpty) {
      return const StatoVuoto(
        icona: Icons.meeting_room_outlined,
        titolo: 'Nessuna stanza',
        sotto: 'Crea le stanze dall\'Editor Dashboard: sono il riferimento di tutto il resto.',
      );
    }
    final comandi = Comandi(casa);
    final pagine = [
      for (final s in stanze) _pagina(config, s.id, s.nome, s),
      _pagina(config, '', 'Senza stanza', null),
    ].where((p) => p.stanza != null || p.quante > 0).toList();
    final scelta =
        pagine.where((p) => p.id == _scelta).firstOrNull ?? pagine.first;
    final luci = [
      for (final (id, nome) in scelta.luci)
        vistaDellaLuce(
          id,
          casa[id],
          nome: nome,
          stanza: scelta.nome,
          comandabile: config.siComanda(id),
        ),
    ];
    final accese = luci.where((l) => l.accesa).length;
    Future<void> luciA(bool acceso) => esegui(context, () async {
      for (final l in luci) {
        if (!l.comandabile || !l.disponibile) continue;
        await (acceso ? comandi.accendi(l.entita) : comandi.spegni(l.entita));
      }
    });

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              for (final p in pagine)
                _PillolaDellaStanza(
                  testo: p.nome,
                  icona: disegnoDellaStanza(p.stanza?.icona ?? '', lato: 18),
                  conto: '${p.quante}',
                  scelta: p.id == scelta.id,
                  quando: () => setState(() => _scelta = p.id),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (luci.isNotEmpty) ...[
          Row(
            children: [
              RiquadroDiStato(
                etichetta: 'Scene',
                valore: '$accese/${luci.length}',
                sotto: '${luci.length} luc${luci.length == 1 ? 'e' : 'i'}',
              ),
            ],
          ),
          const SizedBox(height: 10),
          DueBottoni(
            sinistra: 'Accendi tutto',
            destra: 'Spegni tutto',
            iconaSinistra: Icons.lightbulb_rounded,
            iconaDestra: Icons.nightlight_round,
            quandoSinistra: () => luciA(true),
            quandoDestra: () => luciA(false),
          ),
          const SizedBox(height: 14),
        ],
        if (scelta.stanza case final stanza?
            when stanza.temperatura.isNotEmpty ||
                stanza.umidita.isNotEmpty) ...[
          _Sensori(
            stanza: stanza,
            temperatura: comeNumero(casa[stanza.temperatura]?.stato),
            umidita: comeNumero(casa[stanza.umidita]?.stato),
          ),
          const SizedBox(height: 18),
        ],
        if (scelta.clima.isNotEmpty) ...[
          InsegnaConConto(testo: 'Clima', conto: '${scelta.clima.length}'),
          for (final unita in scelta.clima)
            if (rigaDelClima(unita, (id) => casa[id]) case final riga?) ...[
              SchedaDelClima(
                riga: riga,
                stanza: '',
                famiglia: famiglieDellUnita(unita.tipo).first,
                comandi: comandi,
                comandabile: config.siComanda(riga.entita),
              ),
              const SizedBox(height: 10),
            ],
          const SizedBox(height: 8),
        ],
        if (luci.isNotEmpty) ...[
          InsegnaConConto(testo: 'Luci', conto: '${luci.length}'),
          for (final l in luci) ...[
            SchedaDellaLuce(luce: l, comandi: comandi),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 8),
        ],
        if (scelta.prese.isNotEmpty) ...[
          InsegnaConConto(testo: 'Prese', conto: '${scelta.prese.length}'),
          for (final presa in scelta.prese) ...[
            _RigaConInterruttore(
              nome: presa.etichetta,
              icona: Icons.power_rounded,
              accesa: pulito(casa[presa.entita]?.stato).toLowerCase() == 'on',
              etichetta: presa.icona.startsWith('mdi:') ? '' : presa.icona,
              quando: config.siComanda(presa.entita)
                  ? () => esegui(context, () => comandi.inverti(presa.entita))
                  : null,
            ),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 8),
        ],
        if (scelta.coperture.isNotEmpty) ...[
          InsegnaConConto(
            testo: 'Finestre',
            conto: '${scelta.coperture.length}',
          ),
          for (final c in scelta.coperture) ...[
            SchedaDellaFinestra(
              vista: vistaDellaFinestra(c, (id) => casa[id]),
              comandi: comandi,
              comandabile: config.siComanda(c.entita),
            ),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 8),
        ],
        if (scelta.elettrodomestici.isNotEmpty) ...[
          InsegnaConConto(
            testo: 'Elettrodomestici',
            conto: '${scelta.elettrodomestici.length}',
          ),
          for (final e in scelta.elettrodomestici) ...[
            _RigaConInterruttore(
              nome: e.nome.isNotEmpty ? e.nome : e.prima,
              icona: Icons.local_laundry_service_rounded,
              accesa:
                  modoDellElettrodomestico(e, (id) => casa[id]).modo ==
                  'running',
              sotto: switch (modoDellElettrodomestico(
                e,
                (id) => casa[id],
              ).modo) {
                'running' => 'In funzione',
                'standby' => 'Standby',
                'unavailable' => 'Non disponibile',
                _ => 'Spento',
              },
              quando: e.controllo.isNotEmpty && config.siComanda(e.controllo)
                  ? () => esegui(context, () => comandi.inverti(e.controllo))
                  : null,
              interruttoreAcceso: e.controllo.isEmpty
                  ? null
                  : pulito(casa[e.controllo]?.stato).toLowerCase() == 'on',
            ),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 8),
        ],
        if (scelta.robot.isNotEmpty) ...[
          InsegnaConConto(
            testo: 'Aspirapolvere',
            conto: '${scelta.robot.length}',
          ),
          for (final r in scelta.robot) ...[
            _RigaConInterruttore(
              nome: r.nome.isNotEmpty ? r.nome : r.entita,
              icona: Icons.smart_toy_rounded,
              accesa: const [
                'cleaning',
                'mowing',
              ].contains(pulito(casa[r.entita]?.stato).toLowerCase()),
              sotto:
                  statiDelRobot[pulito(casa[r.entita]?.stato).toLowerCase()] ??
                  pulito(casa[r.entita]?.stato),
            ),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 8),
        ],
        if (scelta.telecamere.isNotEmpty) ...[
          InsegnaConConto(
            testo: 'Telecamere',
            conto: '${scelta.telecamere.length}',
          ),
          for (final t in scelta.telecamere) ...[
            _RigaConInterruttore(
              nome: t.nome.isNotEmpty ? t.nome : t.entita,
              icona: Icons.videocam_rounded,
              accesa: false,
              sotto: pulito(casa[t.entita]?.stato),
            ),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 8),
        ],
        if (scelta.altre.isNotEmpty) ...[
          InsegnaConConto(testo: 'Altro', conto: '${scelta.altre.length}'),
          for (final id in scelta.altre) ...[
            _RigaConInterruttore(
              nome: casa[id]?.nome ?? id,
              icona: Icons.sensors_rounded,
              accesa: casa[id]?.accesa ?? false,
              sotto: casa[id] == null
                  ? '—'
                  : '${casa[id]!.stato}${casa[id]!.unita ?? ''}',
            ),
            const SizedBox(height: 10),
          ],
        ],
        if (scelta.quante == 0)
          const StatoVuoto(
            dentroUnaLista: true,
            icona: Icons.inbox_rounded,
            titolo: 'Stanza vuota',
            sotto:
                'Assegna le entita\' a questa stanza dall\'Editor Dashboard.',
          ),
      ],
    );
  }
}

/// Quello che una stanza possiede, raccolto da tutte le sezioni.
class _PaginaDiStanza {
  _PaginaDiStanza({required this.id, required this.nome, required this.stanza});
  final String id;
  final String nome;
  final Stanza? stanza;
  final luci = <(String, String)>[];
  final clima = <UnitaClima>[];
  final prese = <Presa>[];
  final coperture = <Copertura>[];
  final elettrodomestici = <Elettrodomestico>[];
  final robot = <Robot>[];
  final telecamere = <Telecamera>[];
  final altre = <String>[];

  int get quante =>
      luci.length +
      clima.length +
      prese.length +
      coperture.length +
      elettrodomestici.length +
      robot.length +
      telecamere.length +
      altre.length;
}

_PaginaDiStanza _pagina(
  ConfigurazioneDellaPlancia config,
  String id,
  String nome,
  Stanza? stanza,
) {
  final pagina = _PaginaDiStanza(id: id, nome: nome, stanza: stanza);
  /* Una cosa sta in questa stanza se il suo riferimento e' l'id o il nome
   * della stanza; senza riferimento, o con uno che non e' di nessuna stanza,
   * sta fra quelle senza stanza. */
  bool qui(String riferimento) {
    final trovata = config.stanza(riferimento);
    return stanza == null ? trovata == null : trovata?.id == stanza.id;
  }

  for (final gruppo in config.gruppiDiLuci()) {
    final diQui = stanza == null
        ? gruppo.stanzaId.isEmpty
        : gruppo.stanzaId == stanza.id;
    if (diQui) {
      pagina.luci.addAll([for (final e in gruppo.entita) (e, gruppo.nome(e))]);
    }
  }
  pagina.clima.addAll(config.unitaClima.where((u) => qui(u.stanzaId)));
  pagina.prese.addAll(
    config.prese.where((p) => p.entita.isNotEmpty && qui(p.stanzaId)),
  );
  pagina.coperture.addAll(config.coperture.where((c) => qui(c.stanzaId)));
  pagina.elettrodomestici.addAll(
    config.elettrodomestici.where((e) => e.abilitato && qui(e.stanzaId)),
  );
  pagina.robot.addAll(
    config.robot.where((r) => r.entita.isNotEmpty && qui(r.stanzaId)),
  );
  pagina.telecamere.addAll(config.telecamere.where((t) => qui(t.stanzaId)));
  /* Le entita' a cui la stanza e' stata detta a mano, in qualunque scheda. */
  final assegnate = config.grezzo('cd_stanze_entita');
  if (assegnate is Map && stanza != null) {
    final gia = {
      ...pagina.luci.map((l) => l.$1),
      ...pagina.clima.map((u) => u.entita),
      ...pagina.prese.map((p) => p.entita),
      ...pagina.coperture.map((c) => c.entita),
      ...pagina.coperture.map((c) => c.contatto),
      ...pagina.robot.map((r) => r.entita),
      ...pagina.telecamere.map((t) => t.entita),
    };
    for (final voce in assegnate.entries) {
      final entita = pulito(voce.key);
      if (entita.contains('.') &&
          config.stanza(pulito(voce.value))?.id == stanza.id &&
          !gia.contains(entita)) {
        pagina.altre.add(entita);
      }
    }
  }
  return pagina;
}

class _PillolaDellaStanza extends StatelessWidget {
  const _PillolaDellaStanza({
    required this.testo,
    required this.icona,
    required this.scelta,
    required this.quando,
    this.conto,
  });
  final String testo;
  final Widget icona;
  final bool scelta;
  final VoidCallback quando;
  final String? conto;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: scelta ? colori.primaryContainer : colori.surfaceContainerLowest,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: scelta
                ? colori.primary.withValues(alpha: 0.4)
                : Colors.transparent,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: quando,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              children: [
                icona,
                const SizedBox(width: 8),
                Text(
                  testo.toUpperCase(),
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                    color: scelta
                        ? colori.onPrimaryContainer
                        : colori.onSurface,
                  ),
                ),
                if (conto != null) ...[
                  const SizedBox(width: 8),
                  Bollino(conto!),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Sensori extends StatelessWidget {
  const _Sensori({
    required this.stanza,
    required this.temperatura,
    required this.umidita,
  });
  final Stanza stanza;
  final num? temperatura;
  final num? umidita;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    Widget misura(String etichetta, String valore) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          etichetta.toUpperCase(),
          style: testi.labelSmall?.copyWith(
            color: colori.onSurfaceVariant,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          valore,
          style: testi.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
          ),
        ),
      ],
    );
    return Scheda(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Cerchietto(
                icona: Icons.thermostat_rounded,
                lato: 40,
                fondo: const Color(0xFFEF4444).withValues(alpha: 0.14),
                colore: const Color(0xFFEF4444),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(stanza.nome, style: testi.titleMedium),
                  Text(
                    'SENSORI DELLA STANZA',
                    style: testi.labelSmall?.copyWith(
                      color: colori.onSurfaceVariant,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              if (stanza.temperatura.isNotEmpty)
                Expanded(
                  child: misura(
                    'Temperatura',
                    temperatura == null
                        ? '—'
                        : '${numero(temperatura, cifre: 1)}°',
                  ),
                ),
              if (stanza.umidita.isNotEmpty)
                Expanded(
                  child: misura(
                    'Umidità',
                    umidita == null ? '—' : '${numero(umidita, cifre: 0)}%',
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Una riga con un disegno, un nome, com'e' messa, e — se si comanda —
/// l'interruttore.
class _RigaConInterruttore extends StatelessWidget {
  const _RigaConInterruttore({
    required this.nome,
    required this.icona,
    required this.accesa,
    this.sotto,
    this.etichetta = '',
    this.quando,
    this.interruttoreAcceso,
  });

  final String nome;
  final IconData icona;
  final bool accesa;
  final String? sotto;
  final String etichetta;
  final VoidCallback? quando;
  final bool? interruttoreAcceso;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Scheda(
      padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
      colore: accesa
          ? Color.alphaBlend(
              Colori.ambra.withValues(alpha: 0.10),
              colori.surfaceContainerLowest,
            )
          : null,
      bordo: accesa ? Colori.ambra.withValues(alpha: 0.45) : null,
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: accesa
                  ? Colori.ambra.withValues(alpha: 0.28)
                  : colori.surfaceContainer,
              borderRadius: BorderRadius.circular(14),
            ),
            child: etichetta.isNotEmpty
                ? Text(etichetta, style: const TextStyle(fontSize: 20))
                : Icon(
                    icona,
                    size: 22,
                    color: accesa ? Colori.ambraScura : colori.onSurfaceVariant,
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  nome,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: testi.titleMedium,
                ),
                Text(
                  (sotto ?? (accesa ? 'Accesa' : 'Spenta')).toUpperCase(),
                  style: testi.labelSmall?.copyWith(
                    color: accesa ? Colori.ambraScura : colori.onSurfaceVariant,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                  ),
                ),
              ],
            ),
          ),
          if (quando != null)
            Switch(
              value: interruttoreAcceso ?? accesa,
              onChanged: (_) => quando!(),
            ),
        ],
      ),
    );
  }
}
