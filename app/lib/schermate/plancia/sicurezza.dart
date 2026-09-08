/// La pagina Sicurezza: la centrale antifurto, le porte e le telecamere.
///
/// In cima la centrale, con un tasto per ogni inserimento che **quella**
/// centrale accetta davvero: `supported_features` lo dichiara, e un tasto che
/// non corrisponde a un bit e' un tasto che non fa niente. Il tastierino
/// compare solo se un codice esiste — chiederne uno che nessuno verifica non
/// e' sicurezza, e' un passaggio in piu' che non protegge niente.
///
/// Sotto le porte, con quello che si puo' fare a ognuna: una serratura si apre
/// e si chiude, un cancello si preme e basta.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/entita.dart';
import '../../plancia/comandi.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/numeri.dart';
import '../../plancia/tessere.dart';
import '../../plancia/viste.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
import 'comune.dart';

const _verde = Color(0xFF10B981);
const _rosso = Color(0xFFE11D48);

class PaginaDellaSicurezza extends StatelessWidget {
  const PaginaDellaSicurezza({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  Widget build(BuildContext context) {
    final casa = collegamento.stato;
    final centrale = configurazione.entita(riferimentoDellaCentrale);
    final porte = configurazione.porte;
    final telecamere = configurazione.telecamere;
    if (casa == null ||
        (centrale == null && porte.isEmpty && telecamere.isEmpty)) {
      return const StatoVuoto(
        icona: Icons.shield_rounded,
        titolo: 'Niente da sorvegliare',
        sotto:
            'Associa la centrale antifurto e le porte dall\'Editor Dashboard.',
      );
    }
    final comandi = Comandi(casa);
    final letta = centrale == null ? null : casa[centrale];
    final aperte = [
      for (final porta in porte)
        if (vistaDellaPorta(porta, casa[porta.entita]) case final v)
          if (v.aperta) v,
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        if (centrale != null)
          _LaCentrale(
            entita: centrale,
            stato: letta,
            comandi: comandi,
            comandabile: configurazione.siComanda(centrale),
          ),
        if (porte.isNotEmpty) ...[
          const SizedBox(height: 18),
          InsegnaConConto(
            testo: 'Porte e cancelli',
            conto: aperte.isEmpty ? 'tutto chiuso' : '${aperte.length} aperte',
          ),
          for (final porta in porte)
            SchedaDellaPorta(
              vista: vistaDellaPorta(porta, casa[porta.entita]),
              comandi: comandi,
              comandabile: configurazione.siComanda(porta.entita),
            ),
        ],
        if (telecamere.isNotEmpty) ...[
          const SizedBox(height: 18),
          InsegnaConConto(testo: 'Telecamere', conto: '${telecamere.length}'),
          for (final una in telecamere)
            _RigaDellaTelecamera(
              telecamera: una,
              stato: casa[una.entita],
              stanza: configurazione.stanza(una.stanzaId)?.nome ?? '',
            ),
        ],
      ],
    );
  }
}

/// La centrale: come sta, e i tasti che accetta.
class _LaCentrale extends StatefulWidget {
  const _LaCentrale({
    required this.entita,
    required this.stato,
    required this.comandi,
    required this.comandabile,
  });

  final String entita;
  final Entita? stato;
  final Comandi comandi;
  final bool comandabile;

  @override
  State<_LaCentrale> createState() => _LaCentraleState();
}

class _LaCentraleState extends State<_LaCentrale> {
  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final stato = pulito(widget.stato?.stato).toLowerCase();
    final modi = modiAccettati(widget.stato);
    final acceso = modoAcceso(stato, modi);
    final inAllarme = stato == 'triggered';
    final inserito = stato.startsWith('armed');
    final tono = inAllarme
        ? _rosso
        : inserito
        ? _verde
        : colori.onSurfaceVariant;

    return Scheda(
      colore: inAllarme
          ? _rosso.withValues(alpha: 0.09)
          : inserito
          ? _verde.withValues(alpha: 0.07)
          : null,
      bordo: inAllarme
          ? _rosso.withValues(alpha: 0.5)
          : inserito
          ? _verde.withValues(alpha: 0.3)
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Cerchietto(
                colore: tono,
                icona: inAllarme
                    ? Icons.warning_amber_rounded
                    : inserito
                    ? Icons.shield_rounded
                    : Icons.shield_outlined,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Antifurto',
                      style: testi.labelSmall?.copyWith(
                        letterSpacing: 1,
                        color: colori.onSurfaceVariant,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      parolaDellAllarme(stato),
                      style: testi.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: inAllarme ? _rosso : null,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (widget.comandabile) ...[
            const SizedBox(height: 14),
            DuePerRiga([
              for (final modo in modi)
                _TastoDelModo(
                  modo: modo,
                  acceso: modo.modo == acceso,
                  quando: () => _premi(modo),
                ),
            ]),
          ],
        ],
      ),
    );
  }

  Future<void> _premi(ModoDellAllarme modo) async {
    var codice = '';
    if (serveIlCodice(widget.stato, modo.servizio)) {
      final battuto = await _chiediIlCodice(modo);
      if (battuto == null || battuto.isEmpty) return;
      codice = battuto;
    }
    if (!mounted) return;
    await esegui(
      context,
      () => widget.comandi.allarme(
        widget.entita,
        modo.servizio,
        codice: codice.isEmpty ? null : codice,
      ),
    );
  }

  Future<String?> _chiediIlCodice(ModoDellAllarme modo) {
    final battuto = TextEditingController();
    final soloCifre = codiceDiSoleCifre(widget.stato);
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(modo.nome),
        content: TextField(
          controller: battuto,
          autofocus: true,
          obscureText: true,
          keyboardType: soloCifre ? TextInputType.number : TextInputType.text,
          decoration: const InputDecoration(
            labelText: 'Codice',
            border: OutlineInputBorder(),
          ),
          onSubmitted: (valore) => Navigator.of(context).pop(valore),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Annulla'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(battuto.text),
            child: Text(modo.nome),
          ),
        ],
      ),
    );
  }
}

class _TastoDelModo extends StatelessWidget {
  const _TastoDelModo({
    required this.modo,
    required this.acceso,
    required this.quando,
  });

  final ModoDellAllarme modo;
  final bool acceso;
  final VoidCallback quando;

  @override
  Widget build(BuildContext context) {
    final sblocco = modo.modo == disinserimento.modo;
    final icona = switch (modo.modo) {
      'home' => Icons.home_rounded,
      'away' => Icons.lock_rounded,
      'night' => Icons.bedtime_rounded,
      'vacation' => Icons.flight_takeoff_rounded,
      'custom' => Icons.tune_rounded,
      _ => Icons.lock_open_rounded,
    };
    if (acceso) {
      return FilledButton.icon(
        onPressed: quando,
        icon: Icon(icona, size: 18),
        label: Text(modo.nome),
        style: FilledButton.styleFrom(
          backgroundColor: sblocco ? Colori.male : _verde,
        ),
      );
    }
    return OutlinedButton.icon(
      onPressed: quando,
      icon: Icon(icona, size: 18),
      label: Text(modo.nome),
    );
  }
}

/// Una porta: come sta, e cosa si puo' farle.
class SchedaDellaPorta extends StatelessWidget {
  const SchedaDellaPorta({
    super.key,
    required this.vista,
    required this.comandi,
    this.comandabile = true,
  });

  final VistaDellaPorta vista;
  final Comandi comandi;
  final bool comandabile;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final tono = vista.aperta ? Colori.ambraScura : Colori.bene;

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Scheda(
        colore: vista.aperta ? Colori.ambra.withValues(alpha: 0.08) : null,
        bordo: vista.aperta ? Colori.ambra.withValues(alpha: 0.35) : null,
        child: Row(
          children: [
            disegnoDellaStanza(
              vista.icona.isEmpty ? 'mdi:door' : vista.icona,
              lato: 22,
              colore: vista.disponibile ? tono : colori.onSurfaceVariant,
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
                    vista.parola,
                    style: testi.bodySmall?.copyWith(
                      color: vista.aperta ? tono : colori.onSurfaceVariant,
                      fontWeight: vista.aperta
                          ? FontWeight.w600
                          : FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            if (comandabile && vista.disponibile) _tasti(context),
          ],
        ),
      ),
    );
  }

  Widget _tasti(BuildContext context) {
    /* Una serratura sa fare due cose diverse — aprire e chiudere — e vanno
     * tenute separate: un solo tasto che inverte, su una porta, e' il modo di
     * lasciarla aperta credendo di averla chiusa. */
    if (vista.dominio == 'lock') {
      return Row(
        children: [
          IconButton.filledTonal(
            tooltip: 'Apri',
            onPressed: () =>
                esegui(context, () => comandi.libera(vista.entita)),
            icon: const Icon(Icons.lock_open_rounded),
          ),
          const SizedBox(width: 6),
          IconButton.filledTonal(
            tooltip: 'Chiudi',
            onPressed: () => esegui(context, () => comandi.serra(vista.entita)),
            icon: const Icon(Icons.lock_rounded),
          ),
        ],
      );
    }
    if (vista.dominio == 'cover') {
      return Row(
        children: [
          IconButton.filledTonal(
            tooltip: 'Apri',
            onPressed: () => esegui(context, () => comandi.apri(vista.entita)),
            icon: const Icon(Icons.keyboard_arrow_up_rounded),
          ),
          const SizedBox(width: 6),
          IconButton.filledTonal(
            tooltip: 'Chiudi',
            onPressed: () =>
                esegui(context, () => comandi.chiudi(vista.entita)),
            icon: const Icon(Icons.keyboard_arrow_down_rounded),
          ),
        ],
      );
    }
    /* Un cancello a impulso: si preme e basta, e non c'e' un «chiuso» da
     * chiedergli. */
    return FilledButton.icon(
      onPressed: () => esegui(context, () => comandi.inverti(vista.entita)),
      icon: const Icon(Icons.touch_app_rounded, size: 18),
      label: const Text('Apri'),
    );
  }
}

class _RigaDellaTelecamera extends StatelessWidget {
  const _RigaDellaTelecamera({
    required this.telecamera,
    required this.stato,
    required this.stanza,
  });

  final Telecamera telecamera;
  final Entita? stato;
  final String stanza;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final viva = stato != null && !stato!.muta;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Scheda(
        child: Row(
          children: [
            Cerchietto(
              colore: viva ? const Color(0xFF0284C7) : colori.onSurfaceVariant,
              icona: Icons.videocam_rounded,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    telecamera.nome.isEmpty
                        ? telecamera.entita.split('.').last
                        : telecamera.nome,
                    style: testi.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    stanza.isEmpty
                        ? (viva ? 'In linea' : 'Non raggiungibile')
                        : '$stanza · ${viva ? 'in linea' : 'non raggiungibile'}',
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            Pallino(viva ? Colori.bene : colori.onSurfaceVariant),
          ],
        ),
      ),
    );
  }
}
