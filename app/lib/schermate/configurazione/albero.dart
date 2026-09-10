/// L'alberatura della configurazione: la stessa della plancia, in Dart.
///
/// Non e' un'alberatura inventata. E' quella che la plancia ha gia': dalla
/// 1.4.17 la Config di DashboardModern non e' piu' una fila di linguette ma
/// **sette famiglie**, scritte in `core/alberatura-del-config.js` (`FAMIGLIE`
/// e `SCHEDE`): la plancia, l'energia, il clima e l'acqua, la casa, la
/// sicurezza, gli avvisi, le macchine e la rete. Qui sono le stesse sette,
/// con gli stessi nomi e nello stesso ordine, e ogni scheda della plancia
/// sta nella famiglia in cui la mette `SCHEDE`. Chi ha configurato la
/// dashboard nel browser deve ritrovare le sue cose dove le ha lasciate, con
/// lo stesso nome.
///
/// Dentro una famiglia una scheda della plancia puo' diventare piu' voci —
/// «Sicurezza» nel browser e' un accordion con dentro la centrale, i tasti
/// dell'allarme e le telecamere; su un telefono un elenco dentro un elenco
/// non si guarda, e sono tre voci — ma nessuna si perde e nessuna si
/// inventa: la scheda da cui viene e' scritta in `da`, e la prova
/// `configurazione_test.dart` controlla che tutte le schede di `SCHEDE`
/// ci siano.
///
/// Le due famiglie in fondo — chi puo' entrare, e l'app — nella plancia non
/// ci sono: la prima perche' una pagina web non sa chi la guarda, la seconda
/// perche' riguarda il telefono e non la casa.
library;

/// Da dove viene una voce.
enum Provenienza {
  /// Sta gia' nella Config della plancia: stessa scheda, stessi campi, e
  /// scrive le stesse chiavi sul ponte. Quello che cambia e' dove si apre.
  dallaPlancia,

  /// Non c'e' nella plancia: e' roba dell'app.
  dellApp,
}

/// Una voce dell'alberatura: una foglia, quella che si apre.
class Voce {
  const Voce(
    this.titolo,
    this.sotto, {
    required this.disegno,
    this.da,
    this.viene = Provenienza.dallaPlancia,
    this.pronta = false,
  });

  /// Come si chiama, e la riga sotto che dice cosa ci si trova.
  final String titolo;
  final String sotto;

  /// Il disegno, lo stesso della plancia. Vedi `vestito/oggetti.dart`.
  final String disegno;

  /// La scheda della Config da cui viene, col nome che ha nel codice della
  /// plancia (`visib`, `sez0`, `tapp`…). Serve a chi legge il codice per
  /// ritrovare l'originale, e alle prove per verificare che non manchi nulla.
  final String? da;

  final Provenienza viene;

  /// `false` finche' quella schermata non e' scritta: la voce si vede lo
  /// stesso, spenta, cosi' si sa dove sta andando l'app.
  final bool pronta;
}

/// Un gruppo di voci: il titolo che le tiene insieme.
class Famiglia {
  const Famiglia(this.titolo, this.sotto, this.voci);

  final String titolo;
  final String sotto;
  final List<Voce> voci;
}

/// L'alberatura intera: le sette famiglie di `FAMIGLIE`, nel loro ordine, e
/// poi le due dell'app.
const albero = <Famiglia>[
  /* ── ⚙️ Plancia: tutto cio' che riguarda la plancia, non la casa ──────
   * SCHEDE: visib, sez0, todo, entita, mie, backup, runtime. */
  Famiglia('Plancia', 'Come si chiama, cosa si vede, come si comporta', [
    Voce(
      'Generali',
      'Nome della dashboard, sottotitolo, la lingua, chi puo\' comandare',
      disegno: 'impostazioni',
      da: 'visib',
      pronta: true,
    ),
    Voce(
      'Le sezioni',
      'Quali pagine si vedono: Home, Energia, Auto, Clima, Sicurezza, '
          'Animali, Varchi, Batterie e le altre',
      disegno: 'evidenza',
      da: 'visib',
      pronta: true,
    ),
    Voce(
      'L\'ordine della barra',
      'In che fila stanno le pagine, in fondo alla plancia',
      disegno: 'mie',
      da: 'visib',
      pronta: true,
    ),
    Voce(
      'Come si comporta la plancia',
      'La barra, l\'orologio, chi comanda, il meteo di casa: le scelte che '
          'valgono per tutta la plancia',
      disegno: 'impostazioni',
      da: 'visib',
      pronta: true,
    ),
    /* Assist (#360): quale assistente, se legge la risposta ad alta voce, se
     * il tasto si vede. Nella plancia sta nelle Impostazioni, sotto la
     * lingua. */
    Voce(
      'Assist',
      'Chiedere le cose a casa scrivendo o parlando: quale assistente, e se '
          'risponde a voce',
      disegno: 'impostazioni',
      da: 'visib',
      pronta: true,
    ),
    Voce(
      'I nomi delle pagine',
      'Come si chiamano le pagine, se non ti vanno bene i nomi che hanno',
      disegno: 'custom',
      da: 'visib',
      pronta: true,
    ),
    Voce(
      'Cosa e\' sparito',
      'I pezzi della plancia che si sono fatti sparire: qui si rimettono',
      disegno: 'impostazioni',
      da: 'visib',
      pronta: true,
    ),
    Voce(
      'Autorilevamento',
      'Guarda tutte le entita\' di Home Assistant e compila da solo luci, '
          'clima, stanze e telecamere',
      disegno: 'backup',
      da: 'visib',
    ),
    Voce(
      'Riporta tutto com\'era',
      'Rimette la configurazione dell\'ultimo salvataggio, o la azzera',
      disegno: 'allerte',
      da: 'visib',
      pronta: true,
    ),
    Voce(
      'Home',
      'Le tessere della prima pagina: meteo, evidenza, azioni rapide, avvisi',
      disegno: 'home',
      da: 'sez0',
      pronta: true,
    ),
    Voce(
      'Le tessere della Home',
      'Quali si vedono, in che ordine, e cosa mostra quella che riassume',
      disegno: 'home',
      da: 'sez0',
      pronta: true,
    ),
    Voce(
      'L\'ordine della Home',
      'In che ordine stanno i blocchi della prima pagina, e se si vede il '
          'flusso dell\'energia',
      disegno: 'mie',
      da: 'sez0',
      pronta: true,
    ),
    /* La riga sotto il meteo (#356, #357): quali pastiglie si vedono — le
     * luci accese, le finestre aperte, il ritiro di stasera — e da quale
     * contatto arriva la posta. */
    Voce(
      'La riga sotto il meteo',
      'Le pastiglie di cosa e\' acceso in casa, e la cassetta della posta',
      disegno: 'home',
      da: 'sez0',
      pronta: true,
    ),
    /* Il radar della pioggia dentro le previsioni (#266): da dove arrivano
     * i quadratini, e dove si guarda. */
    Voce(
      'Il radar meteo',
      'La pioggia sulla mappa, dentro le previsioni: il posto, il raggio, il '
          'servizio',
      disegno: 'home',
      da: 'sez0',
      pronta: true,
    ),
    Voce(
      'In evidenza',
      'Sensori sparsi da tenere d\'occhio dalla Home, senza dar loro una '
          'sezione intera',
      disegno: 'evidenza',
      da: 'sez0',
      pronta: true,
    ),
    Voce(
      'Le liste di cose da fare',
      'Quali liste si vedono in Agenda',
      disegno: 'agenda',
      da: 'todo',
    ),
    Voce(
      'Le entita\' mie',
      'Entita\' qualunque, messe in Home con un nome e un disegno',
      disegno: 'mie',
      da: 'entita',
    ),
    Voce(
      'Le sezioni mie',
      'Pagine intere fatte da te, accanto a quelle della plancia',
      disegno: 'custom',
      da: 'mie',
    ),
    Voce(
      'Le copie della configurazione',
      'Salvarla da parte, e rimetterla se qualcosa va storto',
      disegno: 'backup',
      da: 'backup',
    ),
    Voce(
      'Runtime',
      'La diagnosi della plancia: versione, sincronizzazione, sezioni',
      disegno: 'runtime',
      da: 'runtime',
      pronta: true,
    ),
    Voce(
      'I dispositivi di una volta',
      'L\'elenco che la plancia teneva prima delle sezioni',
      disegno: 'runtime',
      da: 'runtime',
      pronta: true,
    ),
    /* `cd_report_devices`: la chiave dichiarata e mai usata. La costante
     * c'era, la schermata no, e il conto delle chiavi la dava per coperta
     * perche' il nome nei sorgenti compariva — nella riga che lo dichiara. */
    Voce(
      'Le voci del Report',
      'Le righe che si scelgono nel Report Analisi dell\'Energia',
      disegno: 'energia',
      da: 'runtime',
      pronta: true,
    ),
    /* Le tre di `sost`: non e' una linguetta della fila — si arriva da
     * dentro — ma esiste, ed e' l'unica ammessa oltre l'elenco. */
    Voce(
      'Le parole della plancia',
      'Una scritta che non ti torna, riscritta ovunque compaia',
      disegno: 'custom',
      da: 'sost',
      pronta: true,
    ),
    Voce(
      'I nomi delle caselle',
      'Come si chiamano le caselle della configurazione',
      disegno: 'custom',
      da: 'sost',
      pronta: true,
    ),
    Voce(
      'Sostituzioni',
      'Hai cambiato una presa o un sensore: qui si sostituisce ovunque compaia',
      disegno: 'custom',
      da: 'sost',
      pronta: true,
    ),
  ]),

  /* ── ⚡ Energia: tutto cio' che misura o muove kWh ─────────────────────
   * SCHEDE: sez1, sez2, ups. */
  Famiglia('Energia', 'Fotovoltaico, consumi, la batteria, l\'auto, l\'UPS', [
    Voce(
      'Energia',
      'Fotovoltaico, consumi, carichi e il Report Analisi',
      disegno: 'energia',
      da: 'sez1',
      pronta: true,
    ),
    /* Le trentasei caselle dell'Energia, per intero.
     *
     * Il modello — la voce qui sopra — ne copre ventiquattro: quelle che
     * `ENERGY_SLOT_MAP` sa mettere in tutti e due i posti. Le altre dodici —
     * i condizionatori, il boiler, i carichi dei nodi, lo stato della rete —
     * nel modello non ci sono, e senza questa voce nell'app non si potevano
     * riempire per niente, mentre nel browser bastava aprire l'accordion
     * «⚡ Energia». */
    Voce(
      'Le caselle dell\'Energia',
      'Tutte le entita\' della pagina Energia, una per una, come nell\'accordion della dashboard',
      disegno: 'energia',
      da: 'sez1',
      pronta: true,
    ),
    /* Da che parte scrive la batteria (#434): meta' dei sensori scrive
     * positivo quando si carica, e da un valore solo non si indovina. */
    Voce(
      'Il verso della batteria',
      'Se il sensore della batteria scrive positivo quando si carica',
      disegno: 'energia',
      da: 'sez1',
      pronta: true,
    ),
    Voce(
      'Auto elettrica',
      'Entita\' dell\'auto e della wallbox, e i profili se le auto sono piu\' di una',
      disegno: 'ev',
      da: 'sez2',
      pronta: true,
    ),
    /* Il motore dichiarato da chi non ha nessun profilo auto (#326). */
    Voce(
      'Il motore dell\'auto',
      'Elettrica, termica o ibrida, per chi compila le caselle senza un profilo',
      disegno: 'ev',
      da: 'sez2',
      pronta: true,
    ),
    Voce(
      'Il ritratto dell\'auto',
      'La foto di ripiego di un\'auto',
      disegno: 'ev',
      da: 'sez2',
      pronta: true,
    ),
    Voce(
      'I dati in piu\' dell\'auto',
      'Quello che la plancia si annota e che non sta nel profilo',
      disegno: 'ev',
      da: 'sez2',
      pronta: true,
    ),
    /* «Continuita'» nella 1.4.11, «UPS» dalla 1.4.17: la linguetta, la
     * pagina e i nomi di serie sono cambiati tutti insieme. */
    Voce(
      'UPS',
      'I gruppi di continuita\', con le loro entita\'',
      disegno: 'minipc',
      da: 'ups',
      pronta: true,
    ),
    Voce(
      'I dati in piu\' della continuita\'',
      'Il segno progressivo dei gruppi di continuita\'',
      disegno: 'ups',
      da: 'ups',
      pronta: true,
    ),
  ]),

  /* ── 🌡️ Clima e acqua: l'aria che si respira e l'acqua che scorre ─────
   * SCHEDE: sez9, sez7, sez3, pool, irr. */
  Famiglia(
    'Clima e acqua',
    'Condizionatori, temperature, l\'acqua calda, la piscina, l\'irrigazione',
    [
      Voce(
        'Clima',
        'Condizionatori e riscaldamento',
        disegno: 'clima',
        da: 'sez9',
        pronta: true,
      ),
      Voce(
        'Le cose che scaldano',
        'Il termocamino, l\'aspiratore della canna fumaria, quello che scalda '
            'oltre ai termosifoni',
        disegno: 'caldaia',
        da: 'sez9',
        pronta: true,
      ),
      /* La ventilazione meccanica (#371): le quattro temperature dello
     * scambiatore, il bypass, i filtri, le ventole. */
      Voce(
        'La ventilazione',
        'Le macchine della VMC: le quattro temperature, il bypass, i filtri',
        disegno: 'clima',
        da: 'sez9',
        pronta: true,
      ),
      Voce(
        'Temperatura',
        'Temperature e umidita\', stanza per stanza',
        disegno: 'temperatura',
        da: 'sez7',
        pronta: true,
      ),
      Voce(
        'Il tasto rapido del clima',
        'Cosa fa il tasto che accende il clima',
        disegno: 'clima',
        da: 'sez7',
        pronta: true,
      ),
      /* Chi resta fuori dal grafico delle Temperature (#433): il vano tecnico
     * fuori scala schiaccia tutte le altre stanze. */
      Voce(
        'Il grafico delle temperature',
        'Quali stanze restano fuori dal grafico, perche\' una fuori scala '
            'schiaccia le altre',
        disegno: 'temperatura',
        da: 'sez7',
        pronta: true,
      ),
      /* La scheda che il guscio chiama «Solare» e che il suo modulo rinomina
     * «Gestione termica»: solare, scaldabagno, caldaia. */
      Voce(
        'Solare termico',
        'Il boiler solare',
        disegno: 'solare',
        da: 'sez3',
        pronta: true,
      ),
      Voce(
        'Scaldabagni',
        'Gli scaldabagni, uno per bagno se serve',
        disegno: 'scaldabagno',
        da: 'sez3',
        pronta: true,
      ),
      Voce(
        'La caldaia',
        'Mandata, ritorno, pressione, e cosa c\'e\' all\'altro capo del tubo',
        disegno: 'caldaia',
        da: 'sez3',
        pronta: true,
      ),
      Voce(
        'Impianti termici',
        'Cosa c\'e\' nel locale caldaia: solare, scaldabagno, caldaia',
        disegno: 'caldaia',
        da: 'sez3',
        pronta: true,
      ),
      Voce(
        'Piscina',
        'Sensori, pompa e filtrazione automatica',
        disegno: 'piscina',
        da: 'pool',
        pronta: true,
      ),
      Voce(
        'Irrigazione',
        'Le zone e i loro tempi',
        disegno: 'irrigazione',
        da: 'irr',
        pronta: true,
      ),
    ],
  ),

  /* ── 🛋️ Casa: le stanze e quello che ci sta dentro ───────────────────
   * SCHEDE: stanze, luci, tapp, appliances, media, robot, animali, people,
   * sez8, batterie. */
  Famiglia('Casa', 'Le stanze e quello che ci sta dentro', [
    Voce(
      'Le stanze',
      'Le stanze della casa, con la loro temperatura e la loro umidita\'',
      disegno: 'stanze',
      da: 'stanze',
      pronta: true,
    ),
    Voce(
      'I piani',
      'Come si raggruppano le stanze quando ce ne sono tante',
      disegno: 'stanze',
      da: 'stanze',
      pronta: true,
    ),
    Voce(
      'Luci',
      'Le luci, coi loro nomi e le loro stanze',
      disegno: 'luci',
      da: 'luci',
      pronta: true,
    ),
    Voce(
      'I gruppi di luci',
      'Gruppi tuoi, oltre a quelli che la plancia fa da sola',
      disegno: 'luci',
      da: 'luci',
      pronta: true,
    ),
    /* Le prese: nella plancia si aggiungono dalla scheda Luci, che accetta
     * anche `switch.`, e hanno un elenco loro (`cd_prese`). */
    Voce(
      'Prese',
      'Le prese comandate',
      disegno: 'prese',
      da: 'luci',
      pronta: true,
    ),
    Voce(
      'Finestre',
      'Tapparelle, tende e finestre',
      disegno: 'tapparelle',
      da: 'tapp',
      pronta: true,
    ),
    Voce(
      'I sensori girati',
      'Le aperture il cui sensore dice il contrario',
      disegno: 'aperture',
      da: 'tapp',
      pronta: true,
    ),
    Voce(
      'Elettrodomestici',
      'Lavastoviglie, lavatrice, forno, stufa: quali ci sono e cosa dicono',
      disegno: 'elettrodomestici',
      da: 'appliances',
      pronta: true,
    ),
    Voce(
      'I programmi della lavatrice',
      'I tasti che compaiono aprendo la lavatrice',
      disegno: 'elettrodomestici',
      da: 'appliances',
      pronta: true,
    ),
    /* La lavatrice della Home: nella plancia e' un gruppo di caselle suo
     * (`CD_SLOTS.lavatrice`), agganciato alla sezione Home. Non e' la stessa
     * cosa della lavatrice fra gli elettrodomestici: quella e' una scheda che
     * si aggiunge, questa e' la tessera che la Home ha di serie. */
    Voce(
      'Le entita\' della lavatrice',
      'Presa, fase, tempo rimanente, programma: le caselle della tessera in Home',
      disegno: 'elettrodomestici',
      da: 'appliances',
      pronta: true,
    ),
    Voce(
      'I ritratti',
      'Quando una cosa ha una foto invece di un emoji',
      disegno: 'elettrodomestici',
      da: 'appliances',
      pronta: true,
    ),
    Voce(
      'Lettori e casse',
      'Gli altoparlanti e i televisori che la plancia comanda',
      disegno: 'media',
      da: 'media',
    ),
    Voce(
      'Robot',
      'Aspirapolvere e lavapavimenti',
      disegno: 'robot',
      da: 'robot',
      pronta: true,
    ),
    /* Gli animali di casa (#358): nome, foto, e le entita' della ciotola,
     * della lettiera, dell'acqua, della porta col microchip e del collare. */
    Voce(
      'Gli animali',
      'Il gatto e il cane: la ciotola, la lettiera, la fontanella, il collare',
      disegno: 'animali',
      da: 'animali',
      pronta: true,
    ),
    Voce(
      'Le persone',
      'Chi usa questa casa: nome, foto e presenza',
      disegno: 'persone',
      da: 'people',
      pronta: true,
    ),
    Voce(
      'Azioni rapide',
      'I bottoni della Home: cosa fanno e in che ordine stanno',
      disegno: 'azioni',
      da: 'sez8',
      pronta: true,
    ),
    /* Le batterie (#398): sotto quanto una e' da cambiare, quali si
     * aggiungono a mano, quali si tolgono, come si chiamano. */
    Voce(
      'Le batterie',
      'Le pile di casa: sotto quanto avvisare, quali contare, come si chiamano',
      disegno: 'batterie',
      da: 'batterie',
      pronta: true,
    ),
  ]),

  /* ── 🛡️ Sicurezza: chi entra, chi esce, cosa sorveglia ───────────────
   * SCHEDE: sez4, varchi, presenza, doors. */
  Famiglia('Sicurezza', 'Chi entra, chi esce, cosa sorveglia', [
    Voce(
      'Sicurezza',
      'Telecamere e allarme',
      disegno: 'sicurezza',
      da: 'sez4',
      pronta: true,
    ),
    Voce(
      'I tasti dell\'allarme',
      'Quali inserimenti si vedono: Casa, Fuori, Notte, Vacanza, Parziale',
      disegno: 'sicurezza',
      da: 'sez4',
      pronta: true,
    ),
    /* I tasti d'inserimento scritti a mano (#413): per chi si e' fatto
     * l'antifurto con ESPHome e una centrale non ce l'ha. */
    Voce(
      'I tasti su misura',
      'L\'antifurto senza centrale: un nome, un disegno, l\'entita\' da chiamare',
      disegno: 'sicurezza',
      da: 'sez4',
      pronta: true,
    ),
    Voce(
      'Centrali d\'allarme',
      'Le centrali di casa, e quale comanda la pagina Sicurezza',
      disegno: 'sicurezza',
      da: 'sez4',
      pronta: true,
    ),
    Voce(
      'Telecamere',
      'Le telecamere di casa, col loro flusso video',
      disegno: 'telecamere',
      /* Nella plancia le telecamere si configurano dentro Sicurezza, insieme
       * alla centrale: qui sono una voce loro, che su un telefono un elenco
       * dentro un elenco non si guarda. */
      da: 'sez4',
      pronta: true,
    ),
    /* I varchi (#367, #377): i contatti porta-finestra, quanti sono aperti
     * adesso. Niente da configurare per cominciare: qui si corregge. */
    Voce(
      'I varchi',
      'I contatti di porte e finestre: quali non contano, quali aggiungere, '
          'come si chiamano',
      disegno: 'aperture',
      da: 'varchi',
      pronta: true,
    ),
    /* La presenza (#432): i rilevatori di movimento, stessa forma dei
     * varchi. */
    Voce(
      'La presenza',
      'I rilevatori di movimento e presenza: quali non contano, quali '
          'aggiungere, come si chiamano',
      disegno: 'persone',
      da: 'presenza',
      pronta: true,
    ),
    Voce(
      'Porte da sorvegliare',
      'Quali porte contano come «casa aperta», e quali chiedono conferma',
      disegno: 'sicurezza',
      da: 'doors',
      pronta: true,
    ),
  ]),

  /* ── 🔔 Avvisi: quello che la casa ti viene a dire ────────────────────
   * SCHEDE: avvisi, allerte, agenda, rifiuti. */
  Famiglia('Avvisi', 'Quando la casa deve farsi sentire', [
    Voce(
      'Quadro avvisi',
      'Cosa fa comparire un avviso, e con che parole',
      disegno: 'avvisi',
      da: 'avvisi',
      pronta: true,
    ),
    Voce(
      'I disegni degli avvisi',
      'Il disegno di un avviso, cambiato',
      disegno: 'avvisi',
      da: 'avvisi',
      pronta: true,
    ),
    Voce(
      'I nomi degli avvisi',
      'Come si chiama un avviso, se il nome che ha non ti torna',
      disegno: 'avvisi',
      da: 'avvisi',
      pronta: true,
    ),
    Voce(
      'Allerte meteo',
      'Le allerte della protezione civile, e quali far comparire',
      disegno: 'avvisi',
      da: 'allerte',
      pronta: true,
    ),
    Voce(
      'I calendari',
      'Quali calendari si vedono in Agenda',
      disegno: 'agenda',
      da: 'agenda',
    ),
    Voce(
      'La raccolta',
      'Quando passa il camion, e cosa si mette fuori',
      disegno: 'rifiuti',
      da: 'rifiuti',
    ),
  ]),

  /* ── 🖥️ Macchine e rete: il homelab, l'unica famiglia che non parla
   * della casa. SCHEDE: sez6. */
  Famiglia(
    'Macchine e rete',
    'Il server, i container, il router e i ripetitori',
    [
      Voce(
        'MiniPC',
        'Il monitoraggio del server',
        disegno: 'minipc',
        da: 'sez6',
        pronta: true,
      ),
      /* Le macchine del server e la rete (#382): quali integrazioni contano,
     * quali sensori togliere o aggiungere, come si chiamano. */
      Voce(
        'Le macchine e la rete',
        'I container di Proxmox e i ripetitori del router: da quali '
            'integrazioni, e come si chiamano',
        disegno: 'minipc',
        da: 'sez6',
        pronta: true,
      ),
    ],
  ),

  /* ── Le due dell'app ─────────────────────────────────────────────────── */
  Famiglia('Chi puo\' entrare', 'Le persone e i telefoni di casa', [
    /* Le persone stanno con la casa, nella famiglia della plancia. Quello
     * che nella plancia non c'e' sono i telefoni — una pagina web non sa chi
     * la guarda — e infatti le due voci qui sotto sono dell'app. */
    Voce(
      'I telefoni abbinati',
      'Quali telefoni sono entrati, quando, e da dove passano',
      disegno: 'mie',
      viene: Provenienza.dellApp,
    ),
    Voce(
      'Chi comanda la configurazione',
      'Di serie chi ha abbinato per primo. Gli altri guardano e comandano, '
          'ma non riscrivono la plancia agli altri',
      disegno: 'sicurezza',
      viene: Provenienza.dellApp,
    ),
  ]),
  Famiglia('L\'app', 'Il telefono, non la casa', [
    Voce(
      'Tema della plancia',
      'Chiaro, scuro, o come il telefono. Vale solo su questo dispositivo: '
          'il tablet in cucina puo\' stare sullo scuro e il telefono no',
      disegno: 'evidenza',
      viene: Provenienza.dellApp,
      pronta: true,
    ),
    /* Le tavolozze della plancia (`cd_tavolozza`): notte, grafite, bosco,
     * sabbia, menta, ardesia. Nella plancia stanno nelle Impostazioni, ma
     * non viaggiano: sono del dispositivo, come il tema. */
    Voce(
      'La tavolozza',
      'I colori della plancia oltre a chiaro e scuro: notte, grafite, bosco, '
          'sabbia, menta, ardesia. Di questo dispositivo, come il tema',
      disegno: 'evidenza',
      viene: Provenienza.dellApp,
      pronta: true,
    ),
    Voce(
      'Barra della plancia',
      'La fila in fondo alla plancia: sempre visibile, o a scomparsa. Anche '
          'questa e\' di questo dispositivo',
      disegno: 'mie',
      viene: Provenienza.dellApp,
      pronta: true,
    ),
    Voce(
      'Plancia leggera',
      'Spegne le sfocature della plancia sui telefoni lenti. Di serie e\' spenta: '
          'le animazioni restano',
      disegno: 'runtime',
      viene: Provenienza.dellApp,
      pronta: true,
    ),
    Voce(
      'Come va l\'app',
      'Quanto ci mette a disegnare, quanto passa sul filo, dove sta perdendo tempo',
      disegno: 'minipc',
      viene: Provenienza.dellApp,
      pronta: true,
    ),
    Voce(
      'Acquisti',
      'Cosa e\' acceso su questa casa, e cosa si puo\' sbloccare',
      disegno: 'evidenza',
      viene: Provenienza.dellApp,
    ),
  ]),
];

/// Quante voci ci sono in tutto.
int get quanteVoci => albero.fold(0, (somma, f) => somma + f.voci.length);

/// Quante vengono dalla Config della plancia.
///
/// E' il numero che si scrive a chi legge — «le stesse diciannove voci» — e
/// non `quanteVoci`, che conta anche quelle che l'app aggiunge di suo: dire
/// «trenta» a chi ne ha viste diciannove nel browser lo manda a cercare le
/// undici che non trova.
int get quanteDallaPlancia => albero.fold(
  0,
  (somma, f) =>
      somma + f.voci.where((v) => v.viene == Provenienza.dallaPlancia).length,
);

/// Le schede della Config della plancia che quest'albero replica.
///
/// Sono le chiavi di `SCHEDE` in `core/alberatura-del-config.js` della
/// 1.4.17: le diciotto della fila del guscio (`.ed-tabs`) e le sedici che i
/// moduli si aggiungono da soli, ognuno col suo `*_EDITOR_TAB`. La prova
/// `configurazione_test.dart` le confronta con quel file: se un giorno la
/// plancia ne aggiunge una, la prova se ne accorge prima di noi.
const schedeDellaPlancia = <String>{
  /* ⚙️ Plancia */
  'visib',
  'sez0',
  'todo',
  'entita',
  'mie',
  'backup',
  'runtime',
  /* ⚡ Energia */
  'sez1',
  'sez2',
  'ups',
  /* 🌡️ Clima e acqua */
  'sez9',
  'sez7',
  'sez3',
  'pool',
  'irr',
  /* 🛋️ Casa */
  'stanze',
  'luci',
  'tapp',
  'appliances',
  'media',
  'robot',
  'animali',
  'people',
  'sez8',
  'batterie',
  /* 🛡️ Sicurezza */
  'sez4',
  'varchi',
  'presenza',
  'doors',
  /* 🔔 Avvisi */
  'avvisi',
  'allerte',
  'agenda',
  'rifiuti',
  /* 🖥️ Macchine e rete */
  'sez6',
};

/// Le sette famiglie della plancia, nell'ordine di `FAMIGLIE`, col nome che
/// hanno li'. Le prove confrontano questo elenco col file della plancia.
const famiglieDellaPlancia = <String>[
  'Plancia',
  'Energia',
  'Clima e acqua',
  'Casa',
  'Sicurezza',
  'Avvisi',
  'Macchine e rete',
];
