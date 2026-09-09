/// Dove porta ogni voce dell'alberatura.
///
/// L'alberatura (`albero.dart`) dice **cosa** c'e'; questo dice **cosa si
/// apre**. Stanno separati perche' la prima e' la copia di quella della
/// plancia — si legge accanto all'originale e si verifica — e questo e' il
/// cablaggio, che cambia ogni volta che una voce viene riempita.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import 'albero.dart';
import 'caselle.dart';
import 'elenco.dart';
import 'speciali.dart';

/// La schermata di una voce, o `null` se quella voce non e' ancora scritta.
Widget? schermataDi(
  Voce voce,
  Collegamento collegamento,
) => switch (voce.titolo) {
  /* ── La casa ── */
  'Generali' => SchermataDeiGenerali(collegamento: collegamento),
  'Le sezioni' => SchermataDelleSezioni(collegamento: collegamento),
  'L\'ordine della barra' => SchermataDellOrdine(collegamento: collegamento),
  'Le stanze' => SchermataDiElenco(
    titolo: 'Le stanze',
    sotto:
        'Le stanze della casa. Quelle con un sensore di temperatura '
        'compaiono anche nella pagina Temperatura.',
    collegamento: collegamento,
    forma: const Forma.elenco('cd_stanze'),
    unaCosa: 'una stanza',
    campi: const [
      Campo('name', 'Nome della stanza', serve: true),
      Campo(
        'temp',
        'Sensore di temperatura',
        tipo: Tipo.entita,
        domini: ['sensor'],
      ),
      Campo(
        'hum',
        'Sensore di umidita\'',
        tipo: Tipo.entita,
        domini: ['sensor'],
      ),
      Campo('icon', 'Disegno', spiega: 'Un emoji, per esempio 🛋️'),
      Campo('floor', 'Piano', spiega: 'Piano terra, Primo piano…'),
    ],
  ),

  /* ── Le pagine ── */
  'Home' => SchermataDelleCaselle(
    titolo: 'Home',
    sotto:
        'Le entita'
        '\''
        ' della prima pagina: il meteo, la stazione '
        'meteo di casa, l\'allarme.',
    sezione: 'home',
    collegamento: collegamento,
  ),
  'Energia' => SchermataDelleCaselle(
    titolo: 'Energia',
    sotto:
        'Fotovoltaico, batteria, rete e carichi. Sono tante: riempi '
        'quelle che hai e lascia vuote le altre — la plancia mostra solo '
        'quello che trova.',
    sezione: 'energy',
    collegamento: collegamento,
  ),
  'Auto elettrica' => SchermataDelleCaselle(
    titolo: 'Auto elettrica',
    sotto: 'L\'auto e la wallbox: batteria, autonomia, ricarica.',
    sezione: 'ev',
    collegamento: collegamento,
  ),
  'Solare termico' => SchermataDelleCaselle(
    titolo: 'Solare termico',
    sotto: 'Il boiler e il solare termico.',
    sezione: 'boiler',
    collegamento: collegamento,
  ),
  'Sicurezza' => SchermataDelleCaselle(
    titolo: 'Sicurezza',
    sotto:
        'La centrale dell\'allarme. Le telecamere si aggiungono dalla '
        'voce Telecamere.',
    sezione: 'security',
    collegamento: collegamento,
  ),
  'MiniPC' => SchermataDelleCaselle(
    titolo: 'MiniPC',
    sotto: 'Il monitoraggio del server: processore, memoria, dischi.',
    sezione: 'server',
    collegamento: collegamento,
  ),
  'Temperatura' => SchermataDiElenco(
    titolo: 'Temperatura',
    sotto:
        'La pagina Temperatura mostra le stanze che hanno un sensore. '
        'Sono le stesse stanze della voce «Le stanze»: cambiarle qui le '
        'cambia anche li\'.',
    collegamento: collegamento,
    forma: const Forma.elenco('cd_stanze'),
    unaCosa: 'una stanza',
    campi: const [
      Campo('name', 'Nome della stanza', serve: true),
      Campo(
        'temp',
        'Sensore di temperatura',
        tipo: Tipo.entita,
        domini: ['sensor'],
        serve: true,
      ),
      Campo(
        'hum',
        'Sensore di umidita\'',
        tipo: Tipo.entita,
        domini: ['sensor'],
      ),
      Campo('icon', 'Disegno', spiega: 'Un emoji, per esempio 🌡️'),
      Campo('floor', 'Piano'),
    ],
  ),
  'Azioni rapide' => SchermataDiElenco(
    titolo: 'Azioni rapide',
    sotto:
        'I bottoni in cima alla Home. L\'ordine qui e\' l\'ordine in cui '
        'si vedono.',
    collegamento: collegamento,
    forma: const Forma.elenco('cd_quick_actions'),
    unaCosa: 'un\'azione',
    campi: const [
      Campo('name', 'Come si chiama', serve: true),
      Campo(
        'entity',
        'Cosa fa',
        tipo: Tipo.entita,
        domini: ['script', 'scene', 'switch', 'input_boolean'],
        serve: true,
      ),
      Campo('icon', 'Disegno', spiega: 'Un emoji'),
    ],
  ),
  'Clima' => SchermataDiElenco(
    titolo: 'Clima',
    sotto: 'Condizionatori, pompe di calore, termostati.',
    collegamento: collegamento,
    forma: const Forma.elenco('cd_clima_units'),
    unaCosa: 'un\'unita\'',
    campi: const [
      Campo('name', 'Come si chiama', serve: true),
      Campo(
        'entity',
        'Entita\' clima',
        tipo: Tipo.entita,
        domini: ['climate'],
        serve: true,
      ),
      Campo('room', 'In che stanza'),
      Campo(
        'type',
        'Che cosa e\'',
        spiega: 'split, canalizzato, pompa di calore…',
      ),
    ],
  ),

  /* ── Le cose di casa ── */
  'Luci' => SchermataDiElenco(
    titolo: 'Luci',
    sotto:
        'Le luci che la plancia comanda. Il nome si scrive «Stanza - '
        'Nome» e la plancia le raggruppa da sola per stanza.',
    collegamento: collegamento,
    forma: const Forma.mappa(
      'cd_luci',
      campoDellaChiave: 'entity',
      campoDelValore: 'name',
    ),
    unaCosa: 'una luce',
    campi: const [
      Campo('name', 'Nome', serve: true, spiega: 'Cucina - Faretti'),
      Campo(
        'entity',
        'Entita\'',
        tipo: Tipo.entita,
        domini: ['light', 'switch', 'group', 'input_boolean', 'fan'],
        serve: true,
      ),
    ],
  ),
  'Prese' => SchermataDiElenco(
    titolo: 'Prese',
    sotto:
        'Le prese comandate. Sono uscite dalle Luci, e si configurano '
        'allo stesso modo.',
    collegamento: collegamento,
    forma: const Forma.mappa(
      'cd_prese',
      campoDellaChiave: 'entity',
      campoDelValore: 'name',
    ),
    unaCosa: 'una presa',
    campi: const [
      Campo('name', 'Nome', serve: true, spiega: 'Salotto - Televisione'),
      Campo(
        'entity',
        'Entita\'',
        tipo: Tipo.entita,
        domini: ['switch', 'input_boolean'],
        serve: true,
      ),
    ],
  ),
  'Finestre' => SchermataDiElenco(
    titolo: 'Finestre',
    sotto: 'Tapparelle, tende e finestre motorizzate.',
    collegamento: collegamento,
    forma: const Forma.elenco('cd_tapparelle'),
    unaCosa: 'una finestra',
    campi: const [
      Campo('name', 'Come si chiama', serve: true),
      Campo(
        'entity',
        'Entita\'',
        tipo: Tipo.entita,
        domini: ['cover'],
        serve: true,
      ),
      Campo('room', 'In che stanza'),
      Campo(
        'invertita',
        'Percentuali al contrario',
        tipo: Tipo.bandiera,
        spiega: 'Accendilo se 100 vuol dire chiusa invece che aperta',
      ),
    ],
  ),
  'Elettrodomestici' => SchermataDiElenco(
    titolo: 'Elettrodomestici',
    sotto:
        'Lavastoviglie, lavatrice, forno, stufa: la plancia capisce da '
        'sola se stanno lavorando guardando quello che consumano.',
    collegamento: collegamento,
    forma: const Forma.elenco('cd_appliances'),
    unaCosa: 'un elettrodomestico',
    campi: const [
      Campo('name', 'Come si chiama', serve: true),
      Campo(
        'entity',
        'Entita\' principale',
        tipo: Tipo.entita,
        serve: true,
        spiega: 'La presa o il sensore di potenza',
      ),
      Campo('icon', 'Disegno', spiega: 'Un emoji, per esempio 🧺'),
      Campo('room', 'In che stanza'),
    ],
  ),
  'Piscina' => SchermataDellaPiscina(collegamento: collegamento),
  'Irrigazione' => _Irrigazione(collegamento: collegamento),

  /* ── Gli avvisi ── */
  'Quadro avvisi' => SchermataDiElenco(
    titolo: 'Quadro avvisi',
    sotto:
        'Cosa fa comparire un avviso in Home, e con che parole. '
        'L\'avviso compare quando l\'entita\' e\' accesa o aperta.',
    collegamento: collegamento,
    forma: const Forma.elenco('cd_avvisi_custom'),
    unaCosa: 'un avviso',
    campi: const [
      Campo('name', 'Cosa dice', serve: true, spiega: 'Finestra cucina aperta'),
      Campo('entity', 'Quale entita\'', tipo: Tipo.entita, serve: true),
      Campo('icon', 'Disegno', spiega: 'Un emoji, per esempio 🔔'),
    ],
  ),

  /* ── Manutenzione ── */
  'Sostituzioni' => SchermataDelleSostituzioni(collegamento: collegamento),
  'Runtime' => SchermataDelRuntime(collegamento: collegamento),
  'Riporta tutto com\'era' => SchermataDelRipristino(
    collegamento: collegamento,
  ),

  _ => null,
};

/// L'irrigazione e le sue zone: due schermate, e la prima porta alla seconda.
class _Irrigazione extends StatelessWidget {
  const _Irrigazione({required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => SchermataDellIrrigazione(
    collegamento: collegamento,
    apriLeZone: () => Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (dentro) => SchermataDiElenco(
          titolo: 'Le zone',
          sotto:
              'Ogni zona e\' una valvola e i suoi minuti. Partono una dopo '
              'l\'altra, nell\'ordine in cui stanno qui.',
          collegamento: collegamento,
          forma: const Forma.elencoDentro('cd_irrigazione', 'zones'),
          unaCosa: 'una zona',
          campi: const [
            Campo('name', 'Come si chiama', serve: true),
            Campo(
              'entity',
              'Valvola o interruttore',
              tipo: Tipo.entita,
              domini: ['valve', 'switch'],
              serve: true,
            ),
            Campo('min', 'Per quanti minuti', tipo: Tipo.numero),
          ],
        ),
      ),
    ),
  );
}
