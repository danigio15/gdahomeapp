/// Le cose di casa che, oltre al loro elenco, hanno una regola di casa.
///
/// Le finestre hanno la soglia di chiusura, le stanze i piani e la soglia
/// dell'umidita': numeri che non appartengono a una riga ma all'abitudine di
/// chi ci abita. Sono schermate di apparecchi con qualcosa sotto.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/apparecchio.dart';
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
        'Tapparelle, tende e finestre motorizzate. I due contatti servono a '
        'chi ha un sensore che dice se e\' aperta davvero, oltre alla '
        'percentuale del motore.',
    sezione: Sezione.finestre,
    unaCosa: 'una finestra',
    collegamento: collegamento,
    domini: const ['cover'],
    leAltreEntita: false,
    campi: const [
      CampoDellApparecchio(
        'contact',
        'Contatto di apertura',
        entita: true,
        domini: ['binary_sensor'],
        spiega: 'Il sensore che dice se e\' aperta',
      ),
      CampoDellApparecchio(
        'contact_out',
        'Contatto della zanzariera',
        entita: true,
        domini: ['binary_sensor'],
      ),
      CampoDellApparecchio(
        'invertita',
        'Percentuali al contrario',
        bandiera: true,
        spiega: 'Accendilo se 100 vuol dire chiusa invece che aperta',
      ),
      CampoDellApparecchio(
        'soglia',
        'La sua soglia di «chiusa» (%)',
        numero: true,
        spiega: 'Lascia vuoto per usare quella di casa, qui sotto',
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
    laFoto: true,
    campi: const [
      CampoDellApparecchio(
        'temp',
        'Sensore di temperatura',
        entita: true,
        domini: ['sensor'],
      ),
      CampoDellApparecchio(
        'hum',
        'Sensore di umidita\'',
        entita: true,
        domini: ['sensor'],
      ),
      CampoDellApparecchio(
        'floor',
        'Piano',
        spiega: 'Piano terra, Primo piano…',
      ),
    ],
    inFondo: (scatto, quaderno) => [
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
