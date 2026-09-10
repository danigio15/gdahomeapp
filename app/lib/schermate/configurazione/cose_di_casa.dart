/// Le cose di casa che, oltre al loro elenco, hanno una regola di casa.
///
/// Le finestre hanno la soglia di chiusura, le stanze i piani e la soglia
/// dell'umidita': numeri che non appartengono a una riga ma all'abitudine di
/// chi ci abita. Sono schermate di apparecchi con qualcosa sotto.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/apparecchio.dart';
import '../../casa/plancia/home.dart';
import '../../casa/plancia/scatto.dart';
import '../../casa/plancia/soglie.dart';
import '../../vestito/pezzi.dart';
import 'apparecchi.dart';
import 'pezzi.dart';

/// Le finestre: tapparelle, tende, finestre motorizzate.
class SchermataDelleFinestre extends StatelessWidget {
  const SchermataDelleFinestre({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => SchermataDegliApparecchi(
    titolo: 'Finestre',
    sotto:
        'Tapparelle, tende e finestre motorizzate. Su una finestra sola ci '
        'stanno insieme la tapparella, la tenda e la tenda da sole: qui si '
        'mettono tutte e tre, ognuna col suo comando.',
    sezione: Sezione.finestre,
    unaCosa: 'una finestra',
    collegamento: collegamento,
    domini: const ['cover'],
    leAltreEntita: false,
    campi: const [
      /* Il tipo: la plancia disegna una tapparella che scende, una tenda che
       * si scosta dal centro e una tenda da sole che esce in fuori. Senza
       * dichiararlo lo indovina dalla `device_class`, e quando non c'e'
       * disegna una tapparella. I tre valori sono quelli di `COVER_KINDS`:
       * un quarto battuto a mano `declaredCoverKind` lo scarta. */
      CampoDellApparecchio(
        'kind',
        'Che copertura e\'',
        scelte: [
          ('', 'Lo decide Home Assistant'),
          ('tapparella', 'Tapparella'),
          ('tenda', 'Tenda'),
          ('tenda_sole', 'Tenda da sole'),
        ],
      ),
      CampoDellApparecchio(
        'contact',
        'Contatto dell\'infisso',
        entita: true,
        domini: ['binary_sensor'],
        spiega: 'Il sensore che dice se la finestra e\' aperta davvero',
      ),
      /* L'inferriata: il secondo contatto, quello di fuori.
       *
       * Si chiamava «zanzariera» e finiva in `contact_out`, che nella plancia
       * non legge nessuno: `INFERRIATA_KEYS` sono `inferriata`,
       * `inferriata_entity`, `grate_entity`, `outer_contact`. Si salvava senza
       * un errore e non contava niente. */
      CampoDellApparecchio(
        'inferriata',
        'Contatto dell\'inferriata',
        entita: true,
        domini: ['binary_sensor'],
        spiega: 'Quella che sta davanti al vetro e si apre di lato',
      ),
      /* Il rele' di discesa (#194).
       *
       * Uno Shelly 2PM lasciato in modalita' interruttore non espone una
       * copertura: espone due prese, una che manda su e una che manda giu'.
       * Chiudere non e' spegnere la salita — e' accendere la discesa. */
      CampoDellApparecchio(
        'down',
        'Il rele\' che la fa scendere',
        entita: true,
        domini: ['switch'],
        spiega: 'Solo se il comando qui sopra e\' un rele\' e non una cover',
      ),
      /* Le altre due coperture dello stesso infisso, ognuna col suo rele'. */
      CampoDellApparecchio(
        'tenda',
        'La tenda della stessa finestra',
        entita: true,
        domini: ['cover', 'switch'],
      ),
      CampoDellApparecchio(
        'tendaDown',
        'Il rele\' che fa scendere la tenda',
        entita: true,
        domini: ['switch'],
      ),
      CampoDellApparecchio(
        'tendaSole',
        'La tenda da sole della stessa finestra',
        entita: true,
        domini: ['cover', 'switch'],
      ),
      CampoDellApparecchio(
        'tendaSoleDown',
        'Il rele\' che fa rientrare la tenda da sole',
        entita: true,
        domini: ['switch'],
      ),
      CampoDellApparecchio(
        'invertita',
        'Percentuali al contrario',
        bandiera: true,
        spiega: 'Accendilo se 100 vuol dire chiusa invece che aperta',
      ),
      /* La posizione preferita (#200): dove va quando si preme «la solita». */
      CampoDellApparecchio(
        'preset',
        'La sua posizione preferita (%)',
        numero: true,
        spiega: 'Quella a cui la rimetti sempre. Vuoto: nessuna',
      ),
      CampoDellApparecchio(
        'soglia',
        'La sua soglia di «chiusa» (%)',
        numero: true,
        spiega: 'Lascia vuoto per usare quella di casa, qui sotto',
      ),
      /* E la soglia dell'umidita' di QUESTA finestra: il bagno si apre a
       * un'umidita' diversa dalla camera. Nella plancia e' una casella per
       * riga (`ed-tp-umidita`), e vuota vuol dire quella di casa. */
      CampoDellApparecchio(
        'umidita',
        'La sua soglia di umidita\' (%)',
        numero: true,
        spiega: 'Sopra questa te la fa aprire. Vuoto: quella di casa',
      ),
    ],
    inFondo: (scatto, quaderno) => [
      _LaSoglia(
        titolo: 'Quando una tapparella conta come chiusa',
        spiega:
            'Chi lascia dieci centimetri per l\'aria non ha una tapparella '
            'aperta, ha uno spiraglio — e sentirsi dire «3 aperte» la sera '
            'con tutte le tapparelle giu\' fa smettere di guardare il numero. '
            'Oltre la meta\' non si va: a mezz\'asta «chiusa» direbbe una '
            'cosa che non si vede. Zero e\' il comportamento di sempre.',
        etichetta: 'Fino a questa percentuale e\' chiusa',
        chiave: chiaveDellaSogliaChiusa,
        adesso: sogliaDellaChiusura(
          quaderno.cambiate[chiaveDellaSogliaChiusa] ??
              scatto.aperto(chiaveDellaSogliaChiusa),
        ),
        minimo: 0,
        massimo: sogliaChiusaMassima,
        quaderno: quaderno,
      ),
    ],
  );
}

/// Le stanze: quelle vere di casa, con dentro la loro temperatura.
class SchermataDelleStanze extends StatelessWidget {
  const SchermataDelleStanze({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => SchermataDegliApparecchi(
    titolo: 'Le stanze',
    sotto:
        'Le stanze della casa. Quelle con un sensore di temperatura compaiono '
        'anche nella pagina Temperatura, e ogni cosa di casa — una luce, una '
        'finestra — si mette in una di queste.',
    sezione: Sezione.stanze,
    unaCosa: 'una stanza',
    collegamento: collegamento,
    /* Una stanza non sta in una stanza. */
    leStanze: false,
    leAltreEntita: false,
    /* E non arriva da un'integrazione: le stanze le decide chi ci abita. */
    dallIntegrazione: false,
    laFoto: true,
    campi: const [
      CampoDellApparecchio(
        'temp',
        'Sensore di temperatura',
        entita: true,
        domini: ['sensor'],
      ),
      /* Come si chiama quel sensore, sulla tessera.
       *
       * Nella plancia sono due caselle accanto alle entita': chi ha la sonda
       * fuori dalla finestra la chiama «Esterno», e la tessera della stanza
       * scrive «Esterno» invece di «Temperatura». Senza, dice «Temperatura»
       * per tutte, che e' quello che diceva l'app. */
      CampoDellApparecchio(
        'temp_name',
        'Come si chiama la temperatura',
        spiega: 'Vuoto: «Temperatura»',
      ),
      CampoDellApparecchio(
        'hum',
        'Sensore di umidita\'',
        entita: true,
        domini: ['sensor'],
      ),
      CampoDellApparecchio(
        'hum_name',
        'Come si chiama l\'umidita\'',
        spiega: 'Vuoto: «Umidita\'»',
      ),
      CampoDellApparecchio(
        'floor',
        'Piano',
        spiega: 'Piano terra, Primo piano…',
      ),
    ],
    inFondo: (scatto, quaderno) => [
      _LeEntitaDelleStanze(scatto: scatto, quaderno: quaderno),
      const SizedBox(height: 16),
      _LaSoglia(
        titolo: 'Quando conviene aprire la finestra',
        spiega:
            'Sopra questa umidita\' l\'aria di casa comincia a posarsi sui '
            'muri freddi, e la plancia lo dice. Sessanta e\' la quota che le '
            'norme sulla ventilazione usano come confine del comfort.',
        etichetta: 'Umidita\' oltre la quale avvisare (%)',
        chiave: chiaveDellaSogliaUmidita,
        adesso: sogliaDellUmidita(
          quaderno.cambiate[chiaveDellaSogliaUmidita] ??
              scatto.aperto(chiaveDellaSogliaUmidita),
        ),
        minimo: sogliaUmiditaMinima,
        massimo: sogliaUmiditaMassima,
        quaderno: quaderno,
      ),
    ],
  );
}

/// Una soglia di casa: un cursore e una spiegazione del perche' esiste.
class _LaSoglia extends StatelessWidget {
  const _LaSoglia({
    required this.titolo,
    required this.spiega,
    required this.etichetta,
    required this.chiave,
    required this.adesso,
    required this.minimo,
    required this.massimo,
    required this.quaderno,
  });

  final String titolo;
  final String spiega;
  final String etichetta;
  final String chiave;
  final int adesso;
  final int minimo;
  final int massimo;
  final Quaderno quaderno;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Scheda(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            titolo,
            style: Theme.of(context).textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            spiega,
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: colori.onSurfaceVariant, height: 1.45),
          ),
          const SizedBox(height: 12),
          Text('$etichetta: $adesso%'),
          Slider(
            value: adesso.clamp(minimo, massimo).toDouble(),
            min: minimo.toDouble(),
            max: massimo.toDouble(),
            divisions: massimo - minimo,
            label: '$adesso%',
            onChanged: (quanto) =>
                quaderno.segna(chiave, quanto.round().toString()),
          ),
        ],
      ),
    );
  }
}

/// Le entita' assegnate a una stanza quando la loro scheda non lo chiede.
///
/// Una casella sola, `entita' -> stanza`, e dentro ci va **l'id**: cambiare il
/// nome di una stanza non rompe niente. Serve a tutto quello che una stanza
/// non se la porta dietro — un sensore qualunque che si vuole veder comparire
/// nella pagina di quella stanza.
class _LeEntitaDelleStanze extends StatelessWidget {
  const _LeEntitaDelleStanze({required this.scatto, required this.quaderno});

  final Scatto scatto;
  final Quaderno quaderno;

  @override
  Widget build(BuildContext context) {
    final segnate = quaderno.cambiate[chiaveDelleEntitaDelleStanze];
    final dentro = segnate is Map
        ? Map<String, dynamic>.from(segnate)
        : scatto.mappa(chiaveDelleEntitaDelleStanze);
    final stanze = leggiGliApparecchi(
      scatto.aperto(Sezione.stanze.chiave),
      sezione: Sezione.stanze,
    );
    String comeSiChiama(String id) {
      for (final una in stanze) {
        if (una.id == id) return una.nome.isNotEmpty ? una.nome : id;
      }
      return id;
    }

    return Scheda(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Le entita\' messe in una stanza',
            style: Theme.of(context).textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            'Un sensore qualunque che vuoi veder comparire nella pagina di una '
            'stanza, anche se la sua scheda la stanza non la chiede.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          if (dentro.isEmpty)
            Text(
              'Non ce n\'e\' nessuna.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            )
          else
            for (final voce in dentro.entries)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(
                  voce.key,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                ),
                subtitle: Text('in ${comeSiChiama('${voce.value}')}'),
                trailing: TextButton(
                  onPressed: () => quaderno.segna(
                    chiaveDelleEntitaDelleStanze,
                    Map<String, dynamic>.from(dentro)..remove(voce.key),
                  ),
                  child: const Text('Togli'),
                ),
              ),
        ],
      ),
    );
  }
}
