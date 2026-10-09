/// Le case: quali ce ne sono, su quale si e' aperti, come si passa fra loro.
library;

import 'package:flutter/material.dart';

import '../casa/casa_conosciuta.dart';
import '../casa/collegamento.dart';
import '../casa/il_lucchetto.dart';
import '../casa/impostazioni.dart';
import '../casa/la_guardia.dart';
import '../licenza/licenza.dart' show ComeStaLaLicenza;
import '../parole.dart';
import '../vestito/pezzi.dart';
import 'premium.dart';
import 'riconoscimento.dart';
import '../vestito/tema.dart';
import 'barra.dart' show nomeDelleCase;
import 'firma.dart';

class LeCase extends StatelessWidget {
  const LeCase({
    super.key,
    required this.collegamento,
    required this.aggiungiUnaCasa,
    required this.impostazioni,
    required this.guardia,
  });

  final Collegamento collegamento;
  final VoidCallback aggiungiUnaCasa;

  /// Dove sta scritto il lucchetto. Da qui si apre la sua scheda, ed e' qui
  /// che serve: togliere una casa e' una delle tre cose che il lucchetto puo'
  /// proteggere, e la si fa da questa schermata.
  final Impostazioni impostazioni;
  final LaGuardia guardia;

  /* Tolta una casa, la pagina si ridisegna subito: prima restava li' finche'
   * non si tornava indietro. */
  @override
  Widget build(BuildContext context) => StreamBuilder<void>(
    stream: collegamento.cambiamenti,
    builder: (context, _) => _pagina(context),
  );

  Widget _pagina(BuildContext context) {
    final archivio = collegamento.archivio;
    final aperta = collegamento.casa;
    final licenza = collegamento.licenza;
    /* La seconda casa si aggiunge solo se una di quelle che ci sono e'
     * Premium. Il tasto resta — con il lucchetto — e porta a dire perche'. */
    final siPuo = licenza.siPuoAggiungereUnaCasa;

    /* **Niente catenaccio in cima.**
     *
     * C'era, e apriva la scheda del lucchetto. «Mi fai un'altra voce nel menu
     * che sarebbe impostazioni app, e tutta la parte legata a sicurezza app,
     * codice, biometrico eccetera la sposti qui: ora e' presente nell'icona
     * catenaccio.» Adesso sta li' (`impostazioni_app.dart`), che e' dove uno
     * le impostazioni le va a cercare.
     *
     * Questa pagina il lucchetto lo usa ancora — togliere una casa e' una
     * delle tre cose che puo' proteggere, e lo chiede qui sotto — ma usarlo e
     * impostarlo sono due cose diverse, e stavano sulla stessa icona. */
    return Scaffold(
      appBar: AppBar(title: Text(nomeDelleCase)),
      floatingActionButton: archivio.piena
          ? null
          : FloatingActionButton.extended(
              onPressed: siPuo
                  ? aggiungiUnaCasa
                  : () => apriLaPaginaPremium(
                      context,
                      collegamento,
                      perche: PerchePremium.unAltraCasa,
                    ),
              icon: Icon(siPuo ? Icons.add_rounded : Icons.lock_rounded),
              label: Text(inLingua(it: 'Aggiungi', en: 'Add')),
            ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
        children: [
          for (final casa in archivio.tutte) ...[
            _Casa(
              casa: casa,
              aperta: casa.id == aperta?.id,
              daDove: casa.id == aperta?.id ? collegamento.daDove : null,
              /* Il bollino dice chi ha Premium davvero: non una casa senza
               * lucchetti perche' le licenze non le sa tenere. */
              premium: licenza.comeSta(casa) == ComeStaLaLicenza.premium,
              quandoScelta: () async {
                await collegamento.cambiaCasa(casa.id);
                if (context.mounted) Navigator.of(context).pop();
              },
              quandoTolta: () => _chiediEDimentica(context, casa),
            ),
            const SizedBox(height: 10),
          ],
          if (archivio.vuoto)
            StatoVuoto(
              dentroUnaLista: true,
              icona: Icons.home_outlined,
              titolo: inLingua(it: 'Nessuna casa', en: 'No homes yet'),
              sotto: inLingua(
                it: 'Aggiungine una col bottone qui sotto.',
                en: 'Add one with the button below.',
              ),
            ),
          const Firma(),
        ],
      ),
    );
  }

  Future<void> _chiediEDimentica(
    BuildContext context,
    CasaConosciuta casa,
  ) async {
    /* Il cestino dice «elimina», e la finestra dice la stessa cosa: cosa
     * sparisce, cosa resta, e come la si riprende. Prima si chiamava
     * «dimentica» e parlava solo di quello che restava. */
    final unica = collegamento.archivio.tutte.length == 1;
    final sicuro = await showDialog<bool>(
      context: context,
      builder: (contesto) => AlertDialog(
        title: Text(
          inLingua(
            it: 'Eliminare «${casa.nome}»?',
            en: 'Remove “${casa.nome}”?',
          ),
        ),
        content: Text(
          inLingua(
            it:
                'La casa sparisce da questo telefono. Per riaverla dovrai '
                'abbinarla di nuovo col QR di gdahome in Home Assistant.'
                '${unica ? '' : '\n\nSe era quella aperta, si apre un\'altra delle tue case.'}'
                '\n\nDalla parte della casa il telefono resta nell\'elenco: '
                'per toglierlo del tutto, eliminalo anche dalla pagina di '
                'gdahome in Home Assistant.',
            en:
                'The home disappears from this phone. To get it back you will '
                'have to pair it again with the gdahome QR code in Home '
                'Assistant.'
                '${unica ? '' : '\n\nIf it was the open one, another of your homes opens.'}'
                '\n\nOn the home\'s side the phone stays listed: to remove it '
                'completely, delete it from the gdahome page in Home Assistant '
                'as well.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(contesto).pop(false),
            child: Text(inLingua(it: 'Annulla', en: 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.of(contesto).pop(true),
            style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
            child: Text(inLingua(it: 'Elimina', en: 'Remove')),
          ),
        ],
      ),
    );
    if (sicuro != true) return;
    /* E il lucchetto, quando e' acceso su questo: togliere una casa cancella
     * l'abbinamento, e si rifa' solo col QR davanti a Home Assistant. E' una
     * delle tre cose che da un telefono trovato aperto non si disfano. */
    if (!context.mounted) return;
    if (!await _seIlLucchettoLoChiede(context)) return;
    await collegamento.dimentica(casa.id);
    /* Era l'ultima: qui non resta niente da scegliere, e dietro c'e' gia'
     * la pagina per aggiungerne una. */
    if (context.mounted && collegamento.archivio.vuoto) {
      Navigator.of(context).pop();
    }
  }

  /// Se il lucchetto protegge questo momento, lo chiede. `true` per passare.
  Future<bool> _seIlLucchettoLoChiede(BuildContext contesto) async {
    final sa = await guardia.cosaSaFare();
    if (!contesto.mounted) return false;
    if (!siDeveChiederePrimaDi(
      PrimaDi.togliereUnaCasa,
      impostazioni.lucchetto,
      sa,
    )) {
      return true;
    }
    return ilFoglietto(
      contesto,
      quale: PrimaDi.togliereUnaCasa,
      conCosa: conCosaSiChiede(impostazioni.lucchetto, sa),
      chiedi: () => guardia.chiedi(perche: perche(PrimaDi.togliereUnaCasa)),
    );
  }
}

class _Casa extends StatelessWidget {
  const _Casa({
    required this.casa,
    required this.aperta,
    required this.daDove,
    required this.quandoScelta,
    required this.quandoTolta,
    this.premium = false,
  });

  /// Se accanto al nome va scritto «Premium»: solo quando i lucchetti ci
  /// sono, se no lo sarebbero tutte e non vorrebbe dire niente.
  final bool premium;
  final CasaConosciuta casa;
  final bool aperta;
  final DaDove? daDove;
  final VoidCallback quandoScelta;
  final VoidCallback quandoTolta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    /* **Tinta, non filo.** La casa aperta aveva un contorno blu intorno alla
     * scheda bianca: con l'ombra a due strati diventavano due contorni, e in
     * gdanav «questa e' quella» si dice riempiendo la carta
     * (`Card(color: primaryContainer)`, `la_tua_auto.dart`), non bordandola.
     * Si vede da piu' lontano e non litiga con l'ombra. */
    return Scheda(
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
      colore: aperta ? colori.primaryContainer : null,
      quandoPremuta: aperta ? null : quandoScelta,
      child: Row(
        children: [
          Cerchietto(
            icona: aperta ? Icons.home_rounded : Icons.home_outlined,
            lato: 44,
            fondo: aperta ? colori.primary : null,
            colore: aperta ? colori.onPrimary : null,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        casa.nome,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: testi.titleMedium,
                      ),
                    ),
                    if (aperta) ...[
                      const SizedBox(width: 8),
                      Bollino(
                        'aperta',
                        fondo: colori.primaryContainer,
                        colore: colori.onPrimaryContainer,
                      ),
                    ],
                    if (premium) ...[
                      const SizedBox(width: 6),
                      Bollino(
                        'Premium',
                        fondo: colori.secondaryContainer,
                        colore: colori.onSecondaryContainer,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    if (aperta && daDove != null) ...[
                      Pallino(
                        daDove == DaDove.daDentro
                            ? Colori.bene
                            : Colori.ambraScura,
                        lato: 7,
                      ),
                      const SizedBox(width: 6),
                    ],
                    Flexible(
                      child: Text(
                        _comEFatta(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: testi.bodySmall?.copyWith(
                          color: colori.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded),
            tooltip: inLingua(it: 'Elimina', en: 'Remove'),
            onPressed: quandoTolta,
          ),
        ],
      ),
    );
  }

  /// Cosa sa fare questa casa, detto in una riga.
  String _comEFatta() {
    if (aperta && daDove != null) {
      return daDove == DaDove.daDentro
          ? inLingua(it: 'in casa adesso', en: 'at home now')
          : inLingua(it: 'da fuori adesso', en: 'away now');
    }
    if (casa.soloInCasa) {
      return inLingua(
        it: 'solo sotto il Wi-Fi di casa',
        en: 'only on your home Wi-Fi',
      );
    }
    if (casa.inCasa == null) {
      return inLingua(
        it: 'solo da fuori · ${casa.daFuoriCasa}',
        en: 'only from away · ${casa.daFuoriCasa}',
      );
    }
    return inLingua(it: 'in casa e da fuori', en: 'at home and away');
  }
}
