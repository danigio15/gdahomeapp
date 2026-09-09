/// Dove porta ogni voce dell'alberatura.
///
/// L'alberatura (`albero.dart`) dice **cosa** c'e'; questo dice **cosa si
/// apre**. Stanno separati perche' la prima e' la copia di quella della
/// plancia — si legge accanto all'originale e si verifica — e questo e' il
/// cablaggio, che cambia ogni volta che una voce viene riempita.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/impostazioni.dart';
import '../../casa/plancia/piu_di_uno.dart' as piu;
import '../../casa/plancia/apparecchio.dart';
import 'albero.dart';
import 'apparecchi.dart';
import '../../casa/plancia/home.dart';
import 'cose_di_casa.dart';
import 'home.dart';
import 'parole.dart';
import 'sicurezza.dart';
import 'caselle.dart';
import 'energia.dart';
import 'famiglia.dart';
import 'elenco.dart';
import 'speciali.dart';

/// La schermata di una voce, o `null` se quella voce non e' ancora scritta.
Widget? schermataDi(
  Voce voce,
  Collegamento collegamento,
  Impostazioni impostazioni,
) => switch (voce.titolo) {
  /* ── La casa ── */
  'Generali' => SchermataDeiGenerali(collegamento: collegamento),
  'Le sezioni' => SchermataDelleSezioni(collegamento: collegamento),
  'L\'ordine della barra' => SchermataDellOrdine(collegamento: collegamento),
  'Le stanze' => SchermataDelleStanze(collegamento: collegamento),

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
  /* L'Energia non e' una fila di caselle: e' un modello con cinque gruppi,
   * i costi, i carichi e — la cosa che mancava — **piu' di un impianto**. */
  'Energia' => SchermataDellEnergia(collegamento: collegamento),
  /* L'auto non e' una fila di caselle: sono **le auto**, ognuna con la sua
   * marca, il suo modello, la sua mappatura e le sue due foto. Le caselle
   * stanno dentro il profilo, ed e' quello che fa cambiare tutta la pagina
   * quando si passa da un'auto all'altra. */
  'Auto elettrica' => SchermataDiFamiglia(
    titolo: 'Auto elettriche',
    sotto:
        'Le auto di casa. Ognuna si porta dentro le sue entita\' e le sue '
        'foto: quella con la pastiglia e\' quella che si vede nella plancia.',
    collegamento: collegamento,
    famiglia: piu.leAuto,
    sezioneDelleCaselle: 'ev',
    leFoto: true,
    campi: const [
      CampoDellaVoce('brand', 'Marca', spiega: 'Leapmotor'),
      CampoDellaVoce('model', 'Modello', spiega: 'B10'),
    ],
  ),
  'Solare termico' => SchermataDiFamiglia(
    titolo: 'Impianti solari',
    sotto:
        'Gli impianti solari termici. Anche di questi ce ne puo\' essere piu\' '
        'di uno, ognuno con le sue entita\'.',
    collegamento: collegamento,
    famiglia: piu.gliImpiantiSolari,
    sezioneDelleCaselle: 'boiler',
    campi: const [CampoDellaVoce('id', 'Sigla', spiega: 'tetto, garage…')],
  ),
  'Sicurezza' => SchermataDelleCaselle(
    titolo: 'Sicurezza',
    sotto:
        'La centrale dell\'allarme. Le telecamere si aggiungono dalla '
        'voce Telecamere.',
    sezione: 'security',
    collegamento: collegamento,
  ),
  'I tasti dell\'allarme' => SchermataDeiModi(collegamento: collegamento),
  'La caldaia' => SchermataDellaCaldaia(collegamento: collegamento),
  'Porte da sorvegliare' => SchermataDellePorte(collegamento: collegamento),
  'Allerte meteo' => SchermataDelleAllerte(collegamento: collegamento),
  /* ── La Home ── */
  'L\'ordine della Home' => SchermataDeiBlocchi(collegamento: collegamento),
  'Le tessere della Home' => SchermataDelleTessere(collegamento: collegamento),
  'In evidenza' => SchermataDiVoci(
    titolo: 'In evidenza',
    sotto:
        'Sensori sparsi che vuoi tenere d\'occhio dalla Home, senza dar loro '
        'una sezione intera.',
    chiave: chiaveDellEvidenza,
    unaCosa: 'un\'entita\'',
    prefisso: 'evidenza',
    collegamento: collegamento,
  ),
  'Lettori e casse' => SchermataDiVoci(
    titolo: 'Lettori e casse',
    sotto: 'Gli altoparlanti e i televisori che la plancia comanda.',
    chiave: chiaveDeiLettori,
    unaCosa: 'un lettore',
    prefisso: 'lettore',
    domini: const ['media_player'],
    collegamento: collegamento,
  ),
  'I calendari' => SchermataDiVoci(
    titolo: 'I calendari',
    sotto:
        'Quali calendari si vedono in Agenda. Il colore serve a distinguerli '
        'quando ce n\'e\' piu\' d\'uno: «lavoro» e «famiglia» nello stesso '
        'giorno, senza dover leggere il nome.',
    chiave: chiaveDeiCalendari,
    unaCosa: 'un calendario',
    prefisso: 'cal',
    domini: const ['calendar'],
    ilColore: true,
    collegamento: collegamento,
  ),
  'Le liste di cose da fare' => SchermataDiVoci(
    titolo: 'Le liste di cose da fare',
    sotto: 'Quali liste si vedono in Agenda.',
    chiave: chiaveDelleListe,
    unaCosa: 'una lista',
    prefisso: 'todo',
    domini: const ['todo'],
    collegamento: collegamento,
  ),
  'Le entita\' mie' => SchermataDiVoci(
    titolo: 'Le entita\' mie',
    sotto:
        'Entita\' qualunque, messe in una pagina con un nome e un disegno. '
        'Dodici per pagina: oltre non e\' piu\' «qualche entita\' mia», e '
        'per quello c\'e\' una sezione tua.',
    chiave: chiaveDelleEntitaMie,
    unaCosa: 'un\'entita\'',
    prefisso: 'mia',
    laSezione: true,
    collegamento: collegamento,
  ),
  'Le persone' => SchermataDiVoci(
    titolo: 'Le persone',
    sotto: 'Chi usa questa casa: il nome, la foto e la presenza.',
    chiave: chiaveDellePersone,
    unaCosa: 'una persona',
    prefisso: 'person',
    domini: const ['person', 'device_tracker'],
    collegamento: collegamento,
  ),

  /* ── Le parole ── */
  'I nomi delle pagine' => SchermataDiParole(
    titolo: 'I nomi delle pagine',
    sotto:
        'Come si chiamano le pagine della plancia, se non ti vanno bene i nomi '
        'che hanno.',
    chiave: chiaveDeiNomiDelleSezioni,
    cosaEChiave: 'La pagina',
    cosaEValore: 'Come deve chiamarsi',
    esempio: 'energia',
    collegamento: collegamento,
  ),
  'Le parole della plancia' => SchermataDiParole(
    titolo: 'Le parole della plancia',
    sotto:
        'Una scritta che non ti torna, riscritta. Vale ovunque quella scritta '
        'compaia.',
    chiave: chiaveDeiTesti,
    cosaEChiave: 'Quello che c\'e\' scritto adesso',
    cosaEValore: 'Cosa deve dire',
    collegamento: collegamento,
  ),
  'I nomi delle caselle' => SchermataDiParole(
    titolo: 'I nomi delle caselle',
    sotto:
        'Come si chiamano le caselle della configurazione. Serve a chi ha dato '
        'un uso diverso a una casella e vuole che lo dica.',
    chiave: chiaveDelleEtichette,
    cosaEChiave: 'Il riferimento della casella',
    cosaEValore: 'Come deve chiamarsi',
    esempio: 'dm.core_043',
    collegamento: collegamento,
  ),
  'Cosa e\' sparito' => SchermataDeiNascosti(collegamento: collegamento),

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
  'Clima' => SchermataDegliApparecchi(
    titolo: 'Clima',
    sotto: 'Condizionatori, pompe di calore, termostati.',
    sezione: Sezione.clima,
    unaCosa: 'un\'unita\'',
    collegamento: collegamento,
    domini: const ['climate'],
    leAltreEntita: false,
    campi: const [
      CampoDellApparecchio(
        'type',
        'Che cosa e\'',
        spiega: 'split, canalizzato, pompa di calore…',
      ),
      CampoDellApparecchio(
        'valvola',
        'La valvola, se ce l\'ha',
        entita: true,
        domini: ['climate', 'valve', 'switch', 'number'],
      ),
    ],
  ),

  /* ── Le cose di casa ── */
  'Luci' => SchermataDegliApparecchi(
    titolo: 'Luci',
    sotto:
        'Le luci che la plancia comanda. La stanza si sceglie da quelle che '
        'hai: la plancia le raggruppa da sola.',
    sezione: Sezione.luci,
    unaCosa: 'una luce',
    collegamento: collegamento,
    domini: const ['light', 'switch', 'group', 'input_boolean', 'fan'],
    /* Una luce non ha un contatore mensile: le sette caselle in piu' qui
     * sarebbero sette domande a cui nessuno risponde. */
    leAltreEntita: false,
  ),
  'Prese' => SchermataDegliApparecchi(
    titolo: 'Prese',
    sotto:
        'Le prese comandate. Sono uscite dalle Luci, e si configurano allo '
        'stesso modo — ma una presa spesso misura anche quello che consuma.',
    sezione: Sezione.prese,
    unaCosa: 'una presa',
    collegamento: collegamento,
    domini: const ['switch', 'input_boolean'],
  ),
  'Finestre' => SchermataDelleFinestre(collegamento: collegamento),
  'Elettrodomestici' => SchermataDegliApparecchi(
    titolo: 'Elettrodomestici',
    sotto:
        'Lavastoviglie, lavatrice, forno, stufa: la plancia capisce da sola '
        'se stanno lavorando guardando quello che consumano. Per questo le '
        'entita\' sono piu\' d\'una.',
    sezione: Sezione.elettrodomestici,
    unaCosa: 'un elettrodomestico',
    collegamento: collegamento,
    laFoto: true,
    campi: const [
      CampoDellApparecchio(
        'visual_key',
        'Che cosa e\'',
        spiega: 'lavatrice, lavastoviglie, forno, frigo…',
      ),
    ],
  ),
  /* Le telecamere hanno tre entita' oltre alla loro: lo stream, l'RTSP e il
   * «vivo». Sono i campi che `normalizeDevice` dichiara per questa sezione, e
   * uno che il modello non dichiara sparirebbe alla prima normalizzazione. */
  'Telecamere' => SchermataDegliApparecchi(
    titolo: 'Telecamere',
    sotto:
        'Le telecamere di casa. La plancia mostra l\'immagine e, se glielo '
        'dici, apre il flusso video.',
    sezione: Sezione.telecamere,
    unaCosa: 'una telecamera',
    collegamento: collegamento,
    domini: const ['camera'],
    leAltreEntita: false,
    campi: const [
      CampoDellApparecchio(
        'stream',
        'Il flusso video',
        spiega: 'L\'indirizzo dello stream, se non basta l\'entita\'',
      ),
      CampoDellApparecchio('rtsp', 'Indirizzo RTSP', spiega: 'rtsp://…'),
      CampoDellApparecchio(
        'vivo',
        'Guarda dal vivo',
        bandiera: true,
        spiega: 'Apre il video invece dell\'ultima immagine',
      ),
    ],
  ),
  'Robot' => SchermataDegliApparecchi(
    titolo: 'Robot',
    sotto: 'Aspirapolvere e lavapavimenti.',
    sezione: Sezione.robot,
    unaCosa: 'un robot',
    collegamento: collegamento,
    domini: const ['vacuum'],
    laFoto: true,
    leAltreEntita: false,
  ),
  'Piscina' => SchermataDellaPiscina(collegamento: collegamento),
  'Irrigazione' => _Irrigazione(collegamento: collegamento),

  /* ── Piu' di uno ── */
  'Centrali d\'allarme' => SchermataDiFamiglia(
    titolo: 'Centrali d\'allarme',
    sotto:
        'Le centrali di casa. Quella con la pastiglia comanda la pagina '
        'Sicurezza.',
    collegamento: collegamento,
    famiglia: piu.leCentrali,
    campi: const [
      CampoDellaVoce('id', 'Sigla', spiega: 'casa, garage…'),
      CampoDellaVoce(
        'entity',
        'La centrale',
        entita: true,
        domini: ['alarm_control_panel'],
      ),
    ],
  ),
  'Scaldabagni' => SchermataDiFamiglia(
    titolo: 'Scaldabagni',
    sotto: 'Uno per bagno, se serve.',
    collegamento: collegamento,
    famiglia: piu.gliScaldabagni,
    campi: const [
      CampoDellaVoce(
        'entity',
        'Lo scaldabagno',
        entita: true,
        domini: ['water_heater', 'switch'],
      ),
      CampoDellaVoce(
        'temp',
        'Temperatura dell\'acqua',
        entita: true,
        domini: ['sensor'],
      ),
    ],
  ),
  'Impianti termici' => SchermataDiFamiglia(
    titolo: 'Impianti termici',
    sotto: 'Caldaie e pompe di calore.',
    collegamento: collegamento,
    famiglia: piu.gliImpiantiTermici,
    campi: const [
      CampoDellaVoce(
        'entity',
        'L\'impianto',
        entita: true,
        domini: ['climate', 'water_heater', 'switch'],
      ),
      CampoDellaVoce(
        'temp',
        'Temperatura di mandata',
        entita: true,
        domini: ['sensor'],
      ),
    ],
  ),
  'Continuita\'' => SchermataDiFamiglia(
    titolo: 'Continuita\'',
    sotto: 'I gruppi di continuita\', con la loro carica e il loro carico.',
    collegamento: collegamento,
    famiglia: piu.laContinuita,
    campi: const [
      CampoDellaVoce(
        'battery',
        'Carica della batteria (%)',
        entita: true,
        domini: ['sensor'],
      ),
      CampoDellaVoce('load', 'Carico (%)', entita: true, domini: ['sensor']),
      CampoDellaVoce(
        'status',
        'Stato',
        entita: true,
        domini: ['sensor', 'binary_sensor'],
      ),
    ],
  ),

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
  /* ── Il telefono, non la casa ── */
  'Tema della plancia' => SchermataDelDispositivo(
    titolo: 'Tema della plancia',
    sotto:
        'Chiaro, scuro, o come il telefono. Nella dashboard stava nella sua '
        'Config: e\' uscita di la\' insieme al resto.',
    impostazioni: impostazioni,
    ilTema: true,
  ),
  'Barra della plancia' => SchermataDelDispositivo(
    titolo: 'Barra della plancia',
    sotto:
        'La fila in fondo alla plancia: sempre visibile, o a scomparsa con la '
        'maniglia.',
    impostazioni: impostazioni,
    ilTema: false,
  ),

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
