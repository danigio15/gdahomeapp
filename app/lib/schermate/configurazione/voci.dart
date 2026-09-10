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
import '../../casa/plancia/scatto.dart';
import '../../vestito/pezzi.dart';
import 'pezzi.dart';
import 'apparecchi.dart';
import '../../casa/plancia/home.dart';
import 'cose_di_casa.dart';
import 'home.dart';
import 'il_resto.dart';
import 'ultime.dart';
import 'parole.dart';
import 'sicurezza.dart';
import 'caselle.dart';
import '../plancia_vera.dart' show FabbricaDellaPlancia;
import 'energia.dart';
import 'famiglia.dart';
import '../../casa/plancia/scelte.dart' as scelte;
import '../../casa/plancia/energia.dart' show eUnContatoreCumulativo;
import '../../casa/plancia/vmc.dart';
import '../../casa/plancia/correzioni.dart';
import 'animali.dart';
import 'correzioni.dart';
import 'scelte.dart';
import 'elenco.dart';
import 'persone.dart';
import 'speciali.dart';

/// La schermata di una voce, o `null` se quella voce non e' ancora scritta.
Widget? schermataDi(
  Voce voce,
  Collegamento collegamento,
  Impostazioni impostazioni, {
  /* Chi accende il servitore. Serve a una voce sola — le persone, che il
   * ritratto lo fanno disegnare alla plancia — e passa di qui invece che da un
   * posto globale perche' le prove ne facciano a meno. */
  FabbricaDellaPlancia? fabbrica,
}) => switch (voce.titolo) {
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
  /* Ed e' anche una fila di caselle, perche' nella plancia sono tutte e due
   * le cose insieme: il modello per i moduli nuovi, le caselle per il runtime
   * vecchio. Dodici delle trentasei nel modello non ci sono — i
   * condizionatori, il boiler, i carichi dei nodi, lo stato della rete — e
   * senza questa schermata restavano fuori dall'app. */
  'Le caselle dell\'Energia' => SchermataDelleCaselle(
    titolo: 'Le caselle dell\'Energia',
    sotto:
        'Tutte le entita\' della pagina Energia. Quelle dell\'impianto le '
        'riempie gia\' «Energia» qui sopra: qui ci sono anche le altre — i '
        'condizionatori, il boiler, i carichi dei nodi.',
    sezione: 'energy',
    collegamento: collegamento,
  ),
  /* L'auto non e' una fila di caselle: sono **le auto**, ognuna con la sua
   * marca, il suo modello, la sua mappatura e le sue due foto. Le caselle
   * stanno dentro il profilo, ed e' quello che fa cambiare tutta la pagina
   * quando si passa da un'auto all'altra. */
  'Auto elettrica' => SchermataDiFamiglia(
    tessera: 'ev',
    /* Come nella Config della dashboard: si sceglie l'integrazione, si
     * sceglie il dispositivo, e l'auto nasce con le caselle gia' piene. E
     * sotto, la colonnina con evcc, che e' della casa. */
    dallIntegrazione: true,
    laColonnina: true,
    titolo: 'Auto elettriche',
    sotto:
        'Le auto di casa. Ognuna si porta dentro le sue entita\' e le sue '
        'foto: quella con la pastiglia e\' quella che si vede nella plancia.',
    collegamento: collegamento,
    famiglia: piu.leAuto,
    sezioneDelleCaselle: 'ev',
    leFoto: true,
    campi: const [
      /* La marca si sceglie dai loghi, non si batte: e' cosi' nella Config
       * della dashboard, e la plancia disegna il marchio col colore della sua
       * casa **solo** se lo riconosce. Battuto a mano, «Skoda» e «Škoda» sono
       * due marche diverse e una delle due resta senza logo. */
      CampoDellaVoce('brand', 'Marca', come: ComeSiRiempie.laMarca),
      /* Il modello no: quello e' una parola sua, e nessun elenco puo'
       * contenerla. */
      CampoDellaVoce('model', 'Modello', spiega: 'Come si chiama il modello'),
      /* La sagoma: quale disegno la rappresenta quando non c'e' una foto. */
      CampoDellaVoce('icon', 'Che auto e\'', come: ComeSiRiempie.laSagoma),
    ],
  ),
  'Solare termico' => SchermataDiFamiglia(
    tessera: 'solare',
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
    tessera: 'sicurezza',
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
    /* `rigaInEvidenza` legge `name` e `icon`: scritti in italiano non li
     * guardava nessuno, e la tessera mostrava il nome di Home Assistant con
     * la stellina di serie. */
    inItaliano: false,
    collegamento: collegamento,
  ),
  'Lettori e casse' => SchermataDiVoci(
    tessera: 'media',
    titolo: 'Lettori e casse',
    sotto: 'Gli altoparlanti e i televisori che la plancia comanda.',
    chiave: chiaveDeiLettori,
    unaCosa: 'un lettore',
    prefisso: 'lettore',
    domini: const ['media_player'],
    /* `normalizzaLettore` legge `nome || name` e `icona || icon`: qui va bene
     * l'italiano. La stanza invece mancava, e nella pagina Media serve a
     * raggruppare le casse. */
    laStanza: true,
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
    /* `normalizzaCalendari` legge `name`, non `nome`: il nome dato qui non lo
     * vedeva nessuno, e la plancia continuava a mostrare quello che il
     * calendario ha in Home Assistant. */
    inItaliano: false,
    /* Di chi e' (1.4.17): un calendario puo' essere di una o piu' persone,
     * e la plancia lo mostra solo a loro. */
    lePersone: true,
    collegamento: collegamento,
  ),
  'Le liste di cose da fare' => SchermataDiVoci(
    titolo: 'Le liste di cose da fare',
    sotto: 'Quali liste si vedono in Agenda.',
    chiave: chiaveDelleListe,
    unaCosa: 'una lista',
    prefisso: 'todo',
    domini: const ['todo'],
    /* `normalizeTodoLists` legge `name`, come i calendari. */
    inItaliano: false,
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
  /* Le persone hanno una schermata loro, e non quella generica delle voci.
   *
   * Di una persona la plancia sa la foto, la batteria, otto sensori del suo
   * telefono, se nasconderla dalla Home, il colore delle iniziali — e la sua
   * **faccia**, che si compone. Nella schermata generica c'erano un nome,
   * un'entita' e un emoji: tutto il resto non si poteva nemmeno scrivere. */
  'Le persone' => SchermataDellePersone(
    collegamento: collegamento,
    fabbrica: fabbrica,
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

  'La raccolta' => SchermataDellaRaccolta(collegamento: collegamento),
  'Le sezioni mie' => SchermataDelleSezioniMie(collegamento: collegamento),
  'Le cose che scaldano' => SchermataDelCaldo(collegamento: collegamento),
  'Come si comporta la plancia' => SchermataDegliInterruttori(
    collegamento: collegamento,
  ),
  'I piani' => SchermataDeiPiani(collegamento: collegamento),

  'Il tasto rapido del clima' => SchermataDelClimaRapido(
    collegamento: collegamento,
  ),
  'I sensori girati' => SchermataDeiVersi(collegamento: collegamento),
  'Le entita\' della lavatrice' => SchermataDelleCaselle(
    titolo: 'Le entita\' della lavatrice',
    sotto:
        'La tessera della lavatrice in Home: la presa che la accende, la fase '
        'in cui sta, quanto le manca. Per lavatrici non smart basta la '
        'potenza della presa: sopra i cinque watt sta lavorando.',
    sezione: 'lavatrice',
    collegamento: collegamento,
  ),
  'I programmi della lavatrice' => SchermataDiRighe(
    titolo: 'I programmi della lavatrice',
    sotto:
        'I tasti che compaiono aprendo la lavatrice. Ognuno chiama uno script: '
        'quello del rapido da quattordici minuti, quello dei colorati.',
    chiave: chiaveDeiProgrammi,
    unaCosa: 'un programma',
    disegnoDiSerie: '🧺',
    domini: const ['script', 'scene', 'button'],
    collegamento: collegamento,
  ),
  'I gruppi di luci' => SchermataDiRighe(
    titolo: 'I gruppi di luci',
    sotto:
        'Gruppi tuoi, oltre a quelli che la plancia fa da sola guardando le '
        'stanze: «tutte quelle di sotto», «quelle che lascio accese la notte».',
    chiave: chiaveDeiGruppiDiLuci,
    unaCosa: 'un gruppo',
    disegnoDiSerie: '💡',
    domini: const ['light', 'group', 'switch'],
    collegamento: collegamento,
    sottoTutto: (scatto, quaderno) => [
      _GruppiTolti(scatto: scatto, quaderno: quaderno),
    ],
  ),

  /* Il ritratto di una lavatrice e di un'auto: quando c'e' una foto e non un
   * emoji, e la plancia deve sapere quale disegnare. Sono due mappe da
   * riferimento a immagine, ed e' cosi' che la plancia le tiene. */
  'I ritratti' => SchermataDiParole(
    titolo: 'I ritratti',
    sotto:
        'Quando una cosa ha una foto invece di un emoji, qui si dice quale. '
        'Vale per la lavatrice e per l\'auto: la plancia disegna quella.',
    chiave: chiaveDelRitrattoDellaLavatrice,
    cosaEChiave: 'Quale cosa',
    cosaEValore: 'La foto',
    esempio: 'lavatrice',
    collegamento: collegamento,
  ),
  'Il ritratto dell\'auto' => SchermataDiParole(
    titolo: 'Il ritratto dell\'auto',
    sotto:
        'La foto di un\'auto, per riferimento. Nella scheda dell\'auto la foto '
        'si sceglie dalla galleria; qui c\'e\' quella di ripiego, per chi non '
        'l\'ha scelta.',
    chiave: chiaveDelRitrattoDellAuto,
    cosaEChiave: 'Quale auto',
    cosaEValore: 'La foto',
    collegamento: collegamento,
  ),
  'I dati in piu\' dell\'auto' => SchermataDiParole(
    titolo: 'I dati in piu\' dell\'auto',
    sotto:
        'Quello che la plancia si annota su un\'auto e che non sta nel suo '
        'profilo: il segno progressivo, gli ultimi conti. Di solito non c\'e\' '
        'niente da toccare — sta qui per poterlo guardare.',
    chiave: chiaveDeiDatiDellAuto,
    cosaEChiave: 'Quale',
    cosaEValore: 'Cosa dice',
    collegamento: collegamento,
  ),
  'I dati in piu\' della continuita\'' => SchermataDiParole(
    titolo: 'I dati in piu\' della continuita\'',
    sotto:
        'Il segno progressivo dei gruppi di continuita\': e\' quello che '
        'impedisce a un identificativo di tornare buono una seconda volta, con '
        'addosso quello che apparteneva a chi non c\'e\' piu\'.',
    chiave: chiaveDeiDatiDellaContinuita,
    cosaEChiave: 'Quale',
    cosaEValore: 'Cosa dice',
    collegamento: collegamento,
  ),
  'I dispositivi di una volta' => SchermataDiParole(
    titolo: 'I dispositivi di una volta',
    sotto:
        'L\'elenco che la plancia teneva prima delle sezioni. Non lo scrive '
        'piu\' nessuno e non lo legge piu\' niente: sta qui perche\' una '
        'configurazione vecchia non deve avere angoli invisibili.',
    chiave: chiaveDeiDispositivi,
    cosaEChiave: 'Quale dispositivo',
    cosaEValore: 'Cosa diceva',
    collegamento: collegamento,
  ),

  /* Le voci del Report di una volta.
   *
   * `cd_report_devices` era la chiave dichiarata e mai usata: la costante
   * c'era in `casa/plancia/home.dart` e nessuna schermata la apriva. Il conto
   * delle chiavi la dava per coperta perche' il nome nei sorgenti compariva —
   * compariva nella riga che la dichiara, ed e' esattamente il modo in cui
   * quel conto comincia a mentire, scritto nel commento della sua prova.
   *
   * Sono `{name, icon, entity}`, come le aggiunge `edAddReportDevice`. */
  'Le voci del Report' => SchermataDiRighe(
    titolo: 'Le voci del Report',
    sotto:
        'Le righe che si possono scegliere nel Report Analisi dell\'Energia: '
        'un nome, un disegno e l\'entita\' da cui nasce lo storico.',
    chiave: chiaveDelReportDiUnaVolta,
    unaCosa: 'una voce',
    /* «Entita' totale per lo storico»: l'editor della plancia accetta solo
     * un contatore cumulativo (`isLifetimeMeter`), e lo dice sotto la riga. */
    controlla: (entita, stato) => eUnContatoreCumulativo(entita, stato)
        ? (
            true,
            'Il contatore totale abilita il mese selezionato, i mesi '
                'precedenti e il totale anno.',
          )
        : (
            false,
            'Questa entita\' non sembra cumulativa: scegli il contatore '
                'totale lifetime del dispositivo.',
          ),
    disegnoDiSerie: '⚡',
    domini: const ['sensor'],
    collegamento: collegamento,
  ),
  'MiniPC' => SchermataDelleCaselle(
    tessera: 'minipc',
    titolo: 'MiniPC',
    sotto: 'Il monitoraggio del server: processore, memoria, dischi.',
    sezione: 'server',
    collegamento: collegamento,
  ),
  'Temperatura' => SchermataDiElenco(
    tessera: 'temperatura',
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
      /* Che tipo di azione: sono gli otto della Config della dashboard.
       *
       * Nell'app c'erano solo nome, entita' ed emoji — cioe' i tre tipi che
       * accendono qualcosa. I quattro popup — le luci, il clima, l'antifurto,
       * la lavatrice — non si potevano fare per niente: un bottone che apre
       * una finestra non ha un'entita' da accendere, e senza il tipo la
       * plancia non sa che finestra aprire. */
      Campo(
        'type',
        'Che cosa fa',
        tipo: Tipo.scelta,
        scelte: [
          ('toggle', 'Accende e spegne un\'entita\''),
          ('script', 'Fa partire uno script'),
          ('scene', 'Chiama una scena'),
          ('luci_group', 'Apre un popup con le luci che scegli tu'),
          ('builtin_luci', 'Apre il popup di tutte le luci'),
          ('builtin_clima', 'Apre il popup del Clima'),
          ('builtin_antifurto', 'Apre il popup dell\'Antifurto'),
          ('builtin_lavatrice', 'Apre il popup della Lavatrice'),
        ],
      ),
      Campo(
        'entity',
        'Cosa fa',
        tipo: Tipo.entita,
        domini: ['script', 'scene', 'switch', 'input_boolean'],
        spiega: 'Serve ai primi tre tipi. I popup non ne hanno bisogno',
      ),
      /* Le luci del popup «scegli tu»: senza queste quel tipo apre una
       * finestra vuota. */
      Campo(
        'lights',
        'Quali luci ci sono dentro',
        tipo: Tipo.entitaTante,
        domini: ['light', 'switch'],
        spiega: 'Solo per «popup con le luci che scegli tu»',
      ),
      Campo('icon', 'Disegno', spiega: 'Un emoji'),
      /* «Sei sicuro?»: il messaggio che compare prima di eseguire. Su un
       * bottone che apre il cancello vale piu' di tutto il resto. */
      Campo(
        'confirm',
        'Chiedi conferma con',
        spiega: 'Il messaggio da mostrare prima. Vuoto: nessuna conferma',
      ),
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
      /* La modalita' del riscaldamento (#362), quanto resta accesa (#364) e
       * i mesi in cui si vede (#365): i tre dati dell'unita' che
       * `unified-editors-section.js` scrive accanto alla valvola. */
      CampoDellApparecchio(
        'modo',
        'L\'entita\' della modalita\' (In casa / Fuori / Vacanza)',
        entita: true,
        domini: ['select', 'input_select', 'sensor', 'climate'],
        spiega:
            'I termostati smart tengono la modalita\' su un\'entita\' a '
            'parte: TADO ha In casa e Fuori, altri aggiungono Vacanza o '
            'Boost. Se e\' un select si cambia dalla scheda',
      ),
      /* Le durate sono i fermi dello slider (`FERMI_DELLO_SLIDER`): la
       * plancia porta comunque un numero qualsiasi al fermo piu' vicino. */
      CampoDellApparecchio(
        'minuti',
        'Spegnimento automatico',
        numero: true,
        scelte: [
          ('0', 'Mai: resta accesa'),
          ('15', '15 min'),
          ('30', '30 min'),
          ('45', '45 min'),
          ('60', '1 h'),
          ('90', '1 h 30'),
          ('120', '2 h'),
          ('180', '3 h'),
          ('240', '4 h'),
          ('300', '5 h'),
          ('360', '6 h'),
          ('480', '8 h'),
          ('600', '10 h'),
          ('720', '12 h'),
        ],
        spiega:
            'Quanto resta accesa dal momento dell\'accensione. Il conto alla '
            'rovescia lo tiene Home Assistant: si puo\' chiudere l\'app e '
            'l\'unita\' si spegne lo stesso',
      ),
      CampoDellApparecchio(
        'mesi',
        'Mesi in cui mostrarla',
        mesi: true,
        spiega:
            'Un condizionatore da maggio a settembre, i termosifoni da '
            'ottobre ad aprile: fuori da quei mesi la scheda non compare. '
            'Nessun mese acceso vuol dire tutto l\'anno',
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
    /* La plancia tiene le luci come mappa `entita' -> nome`: in una riga
     * cosi' non c'e' posto per la stanza ne' per l'ordine, e infatti stanno
     * in due caselle accanto. */
    stanzeAParte: chiaveDelleStanzeDelleLuci,
    ordineAParte: chiaveDellOrdineDelleLuci,
    inFondo: (scatto, quaderno) => [
      _LOrdineDelleStanze(scatto: scatto, quaderno: quaderno),
    ],
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
    campi: const [
      /* «Si vede ma non si comanda»: il frigo, il modem, il congelatore.
       * La riga resta dov'e', il tasto smette di rispondere. */
      CampoDellApparecchio(
        'bloccata',
        'Si vede ma non si comanda',
        bandiera: true,
        spiega:
            'Per le prese che non vanno spente: il frigo, il modem, il '
            'congelatore',
      ),
    ],
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
      /* Gli altri comandi (#338): le regole sono quelle del robot (#306),
       * `elencoComandi` in robot-model.js — stessi domini, fino a dodici. */
      CampoDellApparecchio(
        'comandi',
        'Altri comandi, fino a dodici',
        tante: true,
        massimo: 12,
        domini: [
          'button',
          'input_button',
          'script',
          'scene',
          'automation',
          'switch',
          'input_boolean',
          'select',
          'input_select',
        ],
        spiega: 'script.asciugatrice_rapido_30, button.forno_preriscalda…',
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
    sotto:
        'Aspirapolvere, lavapavimenti e tagliaerba. Oltre al robot si possono '
        'dare la sua mappa, la sua batteria se sta in un sensore a parte, e i '
        'tasti che l\'integrazione gli mette accanto.',
    sezione: Sezione.robot,
    unaCosa: 'un robot',
    collegamento: collegamento,
    domini: const ['vacuum', 'lawn_mower'],
    laFoto: true,
    leAltreEntita: false,
    campi: const [
      CampoDellApparecchio(
        'mapEntity',
        'La sua mappa',
        entita: true,
        domini: ['camera', 'image'],
        spiega: 'La telecamera che disegna la piantina',
      ),
      /* La batteria puo' stare fuori dall'entita' del robot: molti tagliaerba
       * la pubblicano cosi', e senza questa casella la scheda non la mostra. */
      CampoDellApparecchio(
        'battery',
        'La sua batteria',
        entita: true,
        domini: ['sensor'],
        spiega: 'Solo se non e\' dentro l\'entita\' del robot',
      ),
      /* I comandi a parte (#306): «le varie entita' del robot continuano a
       * non essere visibili, da solo la modalita' aspirazione». Sono tasti,
       * interruttori e tendine che l'integrazione pubblica accanto a lui —
       * fino a dodici, che una scheda e' una scheda. */
      CampoDellApparecchio(
        'comandi',
        'I suoi tasti, fino a dodici',
        tante: true,
        massimo: 12,
        domini: [
          'button',
          'input_button',
          'script',
          'scene',
          'automation',
          'switch',
          'input_boolean',
          'select',
          'input_select',
        ],
        spiega: 'Aspirazione, ritorno alla base, pulizia programmata…',
      ),
    ],
  ),
  'Piscina' => SchermataDellaPiscina(collegamento: collegamento),
  'Irrigazione' => _Irrigazione(collegamento: collegamento),

  /* ── Piu' di uno ── */
  'Centrali d\'allarme' => SchermataDiFamiglia(
    tessera: 'sicurezza',
    titolo: 'Centrali d\'allarme',
    sotto:
        'Le centrali di casa. Quella con la pastiglia comanda la pagina '
        'Sicurezza.',
    collegamento: collegamento,
    famiglia: piu.leCentrali,
    /* L'entita' della centrale sta nella sua casella, dentro il profilo —
     * `dm.security_centrale_allarme` — come le diciassette dell'auto. Qui
     * c'era un campo `entity` sciolto che nella plancia non legge nessuno. */
    sezioneDelleCaselle: 'security',
    campi: const [CampoDellaVoce('id', 'Sigla', spiega: 'casa, garage…')],
  ),
  'Scaldabagni' => SchermataDiFamiglia(
    tessera: 'scaldabagno',
    titolo: 'Scaldabagni',
    sotto:
        'Uno per bagno, se serve. Un\'entita\' `water_heater` si porta dietro '
        'stato, temperatura e obiettivo tutti insieme; chi ha uno scaldabagno '
        'comandato a interruttore li mette uno per uno.',
    collegamento: collegamento,
    famiglia: piu.gliScaldabagni,
    campi: const [
      CampoDellaVoce(
        'entity',
        'Lo scaldabagno',
        entita: true,
        domini: ['water_heater'],
        spiega: 'Se ce l\'hai, basta questa',
      ),
      CampoDellaVoce(
        'interruttore',
        'Cosa lo accende',
        entita: true,
        domini: ['switch', 'input_boolean'],
      ),
      /* `temperatura`, non `temp`: `normalizeScaldabagni` legge
       * `item.temperatura || item.temperature`, e quello che finiva in `temp`
       * non lo guardava nessuno. */
      CampoDellaVoce(
        'temperatura',
        'Temperatura dell\'acqua',
        entita: true,
        domini: ['sensor'],
        venivaDa: 'temp',
      ),
      CampoDellaVoce(
        'obiettivo',
        'Temperatura da raggiungere',
        entita: true,
        domini: ['sensor', 'number', 'input_number'],
      ),
      CampoDellaVoce(
        'potenza',
        'Potenza adesso (W)',
        entita: true,
        domini: ['sensor'],
      ),
      CampoDellaVoce(
        'energia',
        'Energia consumata (kWh)',
        entita: true,
        domini: ['sensor'],
      ),
      CampoDellaVoce(
        'room',
        'In che bagno sta',
        spiega: 'Il nome della stanza',
      ),
    ],
  ),
  /* `cd_impianti_termici` non e' un elenco: e' la risposta a «cosa hai nel
   * locale caldaia», tre si'/no. Qui c'era una schermata a profili che ci
   * scriveva dentro un elenco di entita' — una forma che `normalizzaScelta`
   * scarta, e che salvando cancellava le tre spunte fatte dal browser. */
  'Impianti termici' => SchermataDegliImpiantiTermici(
    collegamento: collegamento,
  ),
  /* Le otto caselle di `CASELLE_UPS`, coi loro nomi veri.
   *
   * Erano tre, e tutte e tre col nome sbagliato: `battery`, `load`, `status`
   * dove la plancia legge `batteria`, `carico`, `stato`. Si riempivano, si
   * salvavano, e la scheda del gruppo restava vuota. */
  'UPS' => SchermataDiFamiglia(
    tessera: 'ups',
    titolo: 'UPS',
    sotto:
        'I gruppi di continuita\'. Bastano lo stato e la carica: il resto e\' '
        'per chi ha un UPS che lo dice.',
    collegamento: collegamento,
    famiglia: piu.laContinuita,
    campi: const [
      CampoDellaVoce(
        'stato',
        'Stato del gruppo',
        entita: true,
        domini: ['sensor', 'binary_sensor'],
        venivaDa: 'status',
        spiega: 'Online, a batteria, batteria scarica',
      ),
      CampoDellaVoce(
        'rete',
        'C\'e\' la corrente dalla rete',
        entita: true,
        domini: ['binary_sensor', 'sensor'],
      ),
      CampoDellaVoce(
        'batteria',
        'Carica della batteria (%)',
        entita: true,
        domini: ['sensor'],
        venivaDa: 'battery',
      ),
      CampoDellaVoce(
        'carico',
        'Carico (%)',
        entita: true,
        domini: ['sensor'],
        venivaDa: 'load',
      ),
      CampoDellaVoce(
        'autonomia',
        'Autonomia che resta (minuti)',
        entita: true,
        domini: ['sensor'],
      ),
      CampoDellaVoce(
        'tensione',
        'Tensione (V)',
        entita: true,
        domini: ['sensor'],
      ),
      CampoDellaVoce(
        'potenza',
        'Potenza (W)',
        entita: true,
        domini: ['sensor'],
      ),
      CampoDellaVoce(
        'temperatura',
        'Temperatura (°C)',
        entita: true,
        domini: ['sensor'],
      ),
      CampoDellaVoce(
        'invertita',
        'La lettura e\' al contrario',
        bandiera: true,
        spiega: 'Accendilo se il sensore dice «acceso» quando la rete manca',
      ),
    ],
  ),

  /* ── Gli avvisi ── */
  'I disegni degli avvisi' => SchermataDiParole(
    titolo: 'I disegni degli avvisi',
    sotto:
        'Il disegno di un avviso, cambiato. A sinistra il riferimento '
        'dell\'avviso, a destra l\'emoji.',
    chiave: chiaveDeiDisegniDegliAvvisi,
    cosaEChiave: 'Quale avviso',
    cosaEValore: 'Che disegno',
    esempio: 'finestre',
    collegamento: collegamento,
  ),
  'I nomi degli avvisi' => SchermataDiParole(
    titolo: 'I nomi degli avvisi',
    sotto: 'Come si chiama un avviso, se il nome che ha non ti torna.',
    chiave: chiaveDeiNomiDegliAvvisi,
    cosaEChiave: 'Quale avviso',
    cosaEValore: 'Come deve chiamarsi',
    esempio: 'allagamenti',
    collegamento: collegamento,
  ),
  'Quadro avvisi' => SchermataDiElenco(
    titolo: 'Quadro avvisi',
    sotto:
        'Cosa fa comparire un avviso in Home, e con che parole. Un avviso '
        'puo\' guardare piu\' entita\' insieme: compare quando almeno una di '
        'loro fa quello che gli hai detto.',
    collegamento: collegamento,
    forma: const Forma.elenco('cd_avvisi_custom'),
    unaCosa: 'un avviso',
    campi: const [
      Campo('name', 'Cosa dice', serve: true, spiega: 'Finestra cucina aperta'),
      /* `entities`, al plurale: e' cosi' che lo scrive la Config della
       * dashboard — «un avviso, tante finestre» — e con una sola l'app
       * scriveva `entity`, che la plancia accetta ma tiene una entita' sola.
       * Quella gia' scritta diventa un elenco di uno al primo salvataggio. */
      Campo(
        'entities',
        'Quali entita\'',
        tipo: Tipo.entitaTante,
        serve: true,
        venivaDa: 'entity',
      ),
      /* Quando conta come «e' successo». Erano sei nella dashboard e una
       * sola qui: chi voleva «temperatura sopra 30» o «termostato in heat»
       * dall'app non poteva farlo. */
      Campo(
        'cond',
        'Quando compare',
        tipo: Tipo.scelta,
        scelte: [
          ('on', 'Accesa, attiva o aperta'),
          ('off', 'Spenta o chiusa'),
          ('eq', 'Uguale a…'),
          ('neq', 'Diversa da…'),
          ('gt', 'Maggiore di…'),
          ('lt', 'Minore di…'),
        ],
      ),
      Campo(
        'value',
        'Uguale a cosa, o sopra quanto',
        spiega: 'Serve alle ultime quattro: heat, 23.5, open…',
      ),
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

  /* ── Le sezioni nuove della 1.4.17 ── */
  'Assist' => SchermataDiAssist(collegamento: collegamento),
  'La riga sotto il meteo' => SchermataDellaBarraDiCasa(
    collegamento: collegamento,
  ),
  'Il radar meteo' => SchermataDelRadar(collegamento: collegamento),
  'Il verso della batteria' => SchermataDelVersoDellaBatteria(
    collegamento: collegamento,
  ),
  'Il motore dell\'auto' => SchermataDelMotore(collegamento: collegamento),
  'Il grafico delle temperature' => SchermataDelGrafico(
    collegamento: collegamento,
  ),
  'Gli animali' => SchermataDegliAnimali(collegamento: collegamento),
  'Le batterie' => SchermataDelleBatterie(collegamento: collegamento),
  'Le macchine e la rete' => SchermataDelleMacchine(collegamento: collegamento),
  'I varchi' => SchermataDelleCorrezioni(
    tessera: 'varchi',
    titolo: 'I varchi',
    sotto:
        'I contatti di porte e finestre: quanti sono aperti adesso, e quali. '
        'Non c\'e\' niente da configurare per cominciare — un contatto lo '
        'dichiara Home Assistant — qui si corregge: si toglie il sensore del '
        'frigo etichettato «door», si aggiunge quello che nessuno ha '
        'etichettato, si da\' un nome piu\' chiaro di «Contact 4B».',
    chiave: chiaveDeiVarchi,
    collegamento: collegamento,
    rilevata: eUnVarco,
    disegno: disegnoDelVarco,
    unaCosa: 'un contatto',
    aggiungi: 'Aggiungi un contatto che non viene trovato',
    esempio: 'binary_sensor.porta_cantina',
    elenco: 'I contatti di casa',
    vuoto: 'Nessun contatto trovato',
    acceso: 'aperto',
    spento: 'chiuso',
  ),
  'La presenza' => SchermataDelleCorrezioni(
    tessera: 'presenza',
    titolo: 'La presenza',
    sotto:
        'I rilevatori di movimento e di presenza: dove c\'e\' qualcuno adesso, '
        'e da quanto una stanza e\' vuota. E\' la stessa scheda dei varchi, '
        'perche\' e\' lo stesso problema: si corregge quello che Home '
        'Assistant dichiara da solo.',
    chiave: chiaveDellaPresenza,
    collegamento: collegamento,
    rilevata: eUnRilevatore,
    disegno: disegnoDelRilevatore,
    unaCosa: 'un rilevatore',
    aggiungi: 'Aggiungi un rilevatore che non viene trovato',
    esempio: 'binary_sensor.movimento_salone',
    elenco: 'I rilevatori di casa',
    vuoto: 'Nessun rilevatore trovato',
    acceso: 'attivo',
    spento: 'libero',
  ),
  /* I tasti d'inserimento su misura (#413): chi si e' fatto l'antifurto con
   * ESPHome un `alarm_control_panel` non ce l'ha, e i tasti se li descrive.
   * Le righe si scrivono come stanno — e' la plancia, leggendole, a tenere
   * solo quelle con qualcosa da premere. */
  'I tasti su misura' => SchermataDiElenco(
    titolo: 'I tasti su misura',
    sotto:
        'Serve a chi una centrale non ce l\'ha: un antifurto fatto con '
        'ESPHome, con gli script o con un elenco di modalita\'. Ogni tasto '
        'compare nella sezione Sicurezza e nella tessera della Home, accanto '
        'a quelli della centrale — e se una centrale non c\'e\', al posto '
        'loro. Finche\' non scegli cosa premere, il tasto non compare.',
    collegamento: collegamento,
    forma: const Forma.elenco(scelte.chiaveDellAntifurtoSuMisura),
    unaCosa: 'un tasto',
    campi: [
      const Campo('nome', 'Nome del tasto', spiega: 'Fuori casa'),
      const Campo(
        'icona',
        'Icona',
        spiega: 'Un nome del catalogo, per esempio mdi:shield-home',
      ),
      Campo(
        'entita',
        'Cosa premere',
        tipo: Tipo.entita,
        domini: scelte.dominiSuMisura,
        spiega:
            'Lo script, la scena, il pulsante, l\'interruttore o l\'elenco '
            'che inserisce: il servizio giusto lo sceglie la plancia dal '
            'dominio dell\'entita\'.',
      ),
      const Campo(
        'opzione',
        'Quale voce dell\'elenco',
        spiega:
            'Solo per un select o un input_select: scritta come Home '
            'Assistant la elenca, lettera per lettera.',
      ),
      const Campo(
        'stato',
        'Dove si legge se e\' inserito',
        tipo: Tipo.entita,
        spiega: 'Vuoto: si guarda l\'entita\' stessa',
      ),
      const Campo(
        'valore',
        'Il valore che vuol dire «inserito»',
        spiega:
            'Vuoto vuol dire «on». Senza questo il tasto funziona lo stesso: '
            'semplicemente non resta acceso.',
      ),
    ],
  ),
  /* La ventilazione meccanica (#371): quattro macchine al massimo, ognuna con
   * le sue caselle. Si scrivono normalizzate come le legge `normalizzaVmc`:
   * `nome`, `stanza`, e le dodici caselle. */
  'La ventilazione' => SchermataDiElenco(
    tessera: 'vmc',
    titolo: 'La ventilazione',
    sotto:
        'Le macchine della VMC: le quattro temperature dello scambiatore — '
        'da fuori verso casa e da casa verso fuori — il bypass, i filtri, le '
        'ventole. Dalle quattro temperature la plancia calcola il recupero '
        'di calore, che e\' l\'unico numero che dice se la macchina vale '
        'quello che costa.',
    collegamento: collegamento,
    forma: const Forma.elenco(chiaveDellaVmc),
    unaCosa: 'una VMC',
    massimo: massimoVmc,
    campi: [
      const Campo('nome', 'Nome', spiega: 'Comfoair'),
      const Campo('stanza', 'Stanza', tipo: Tipo.stanza),
      Campo(
        macchinaDellaVmc.$1,
        '${macchinaDellaVmc.$2} ${macchinaDellaVmc.$3}',
        tipo: Tipo.entita,
        domini: const ['climate', 'fan'],
        spiega: macchinaDellaVmc.$4,
      ),
      for (final (chiave, glifo, parola, esempio) in temperatureDellaVmc)
        Campo(
          chiave,
          '$glifo $parola',
          tipo: Tipo.entita,
          domini: const ['sensor'],
          spiega: esempio,
        ),
      for (final (chiave, glifo, parola, esempio) in interruttoriDellaVmc)
        Campo(
          chiave,
          '$glifo $parola',
          tipo: Tipo.entita,
          domini: const ['binary_sensor'],
          spiega: esempio,
        ),
      for (final (chiave, glifo, parola, esempio) in numeriDellaVmc)
        Campo(
          chiave,
          '$glifo $parola',
          tipo: Tipo.entita,
          domini: const ['sensor'],
          spiega: esempio,
        ),
    ],
  ),
  'La tavolozza' => SchermataDellaTavolozza(impostazioni: impostazioni),

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
            /* `mins`, non `min`: la plancia legge `zone.mins`, e quello che
             * finiva in `min` non lo guardava nessuno — la zona restava ai
             * dieci minuti di serie senza dirlo. Il numero gia' battuto si
             * ritrova qui, e al primo salvataggio va nella casella giusta. */
            Campo(
              'mins',
              'Per quanti minuti',
              tipo: Tipo.numero,
              venivaDa: 'min',
            ),
            Campo(
              'room',
              'In che stanza',
              spiega: 'Il nome della stanza, come l\'hai chiamata',
            ),
          ],
        ),
      ),
    ),
  );
}

/// I gruppi che la plancia farebbe da sola e che si sono tolti.
///
/// La plancia raggruppa le luci per stanza da sola: chi non vuole il gruppo
/// «Bagno» lo toglie, e resta tolto — se lo si potesse solo aggiungere, ogni
/// stanza nuova rimetterebbe un gruppo che qualcuno aveva gia' detto di non
/// volere.
class _GruppiTolti extends StatelessWidget {
  const _GruppiTolti({required this.scatto, required this.quaderno});

  final dynamic scatto;
  final Quaderno quaderno;

  @override
  Widget build(BuildContext context) {
    final segnati = quaderno.cambiate[chiaveDeiGruppiDiLuciTolti];
    final dentro = segnati is Map
        ? Map<String, dynamic>.from(segnati)
        : scatto.mappa(chiaveDeiGruppiDiLuciTolti) as Map<String, dynamic>;
    final luci = [
      for (final uno in (dentro['luci'] as List? ?? const []))
        if ('$uno'.trim().isNotEmpty) '$uno'.trim(),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'I gruppi tolti',
          style: Theme.of(context).textTheme.titleSmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          'La plancia raggruppa le luci per stanza da sola. Quelli qui sotto '
          'sono i gruppi che hai detto di non volere, e restano tolti.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 8),
        if (luci.isEmpty)
          Text(
            'Non ne hai tolto nessuno.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          )
        else
          for (final (posto, quale) in luci.indexed)
            Card(
              margin: const EdgeInsets.symmetric(vertical: 3),
              child: ListTile(
                dense: true,
                title: Text(quale),
                trailing: TextButton(
                  onPressed: () => quaderno.segna(chiaveDeiGruppiDiLuciTolti, {
                    ...dentro,
                    'luci': [...luci]..removeAt(posto),
                  }),
                  child: const Text('Rimettilo'),
                ),
              ),
            ),
      ],
    );
  }
}

/// In che ordine stanno le stanze nella pagina Luci.
///
/// «Chi ordina le stanze in configurazione lo fa per una ragione: e' l'ordine
/// in cui gira per casa.» Quell'ordine pero' arrivava solo alla pagina Stanze:
/// le pagine che raggruppano per stanza se lo riscrivevano ognuna a modo suo,
/// e il bagnetto spostato in cima restava in fondo dappertutto.
class _LOrdineDelleStanze extends StatelessWidget {
  const _LOrdineDelleStanze({required this.scatto, required this.quaderno});

  final Scatto scatto;
  final Quaderno quaderno;

  @override
  Widget build(BuildContext context) {
    final segnate = quaderno.cambiate[chiaveDellOrdineDelleStanze];
    final fila = segnate is List
        ? [
            for (final uno in segnate)
              if ('$uno'.trim().isNotEmpty) '$uno'.trim(),
          ]
        : scatto.parole(chiaveDellOrdineDelleStanze);
    return Scheda(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'In che ordine stanno le stanze',
            style: Theme.of(context).textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            'Chi ordina le stanze lo fa per una ragione: e\' l\'ordine in cui '
            'gira per casa. Le stanze che non stanno qui vanno in fondo.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          if (fila.isEmpty)
            Text(
              'Nessun ordine scritto: le stanze vanno come vengono.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            )
          else
            for (final (posto, quale) in fila.indexed)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(radius: 13, child: Text('${posto + 1}')),
                title: Text(quale),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      onPressed: posto == 0
                          ? null
                          : () => quaderno.segna(
                              chiaveDellOrdineDelleStanze,
                              [...fila]
                                ..insert(posto - 1, fila.removeAt(posto)),
                            ),
                      icon: const Icon(Icons.keyboard_arrow_up_rounded),
                      tooltip: 'Su',
                    ),
                    IconButton(
                      onPressed: () => quaderno.segna(
                        chiaveDellOrdineDelleStanze,
                        [...fila]..removeAt(posto),
                      ),
                      icon: const Icon(Icons.delete_outline_rounded),
                      tooltip: 'Togli',
                    ),
                  ],
                ),
              ),
        ],
      ),
    );
  }
}
