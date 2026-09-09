/// Le soglie di casa: due numeri che cambiano quello che la plancia dice.
///
/// Non sono proprieta' di un apparecchio, sono abitudini di chi ci abita. Per
/// questo stanno per conto loro e non dentro ogni riga — con l'eccezione della
/// tapparella, che dal campo ha chiesto di poterne avere una sua.
library;

/// Quanto puo' essere aperta una tapparella e contare ancora come «chiusa».
///
/// «Sentirsi dire "3 aperte" la sera con tutte le tapparelle giu'» e' il
/// genere di cosa che fa smettere di guardare il numero: chi lascia dieci
/// centimetri per l'aria non ha una tapparella aperta, ha uno spiraglio.
///
/// Oltre la meta' non si va: al cinquanta per cento non e' piu' uno spiraglio,
/// e dire «chiusa» a una tapparella a mezz'asta direbbe una cosa che non si
/// vede. Zero e' il comportamento di sempre.
const chiaveDellaSogliaChiusa = 'cd_tapparelle_soglia';
const sogliaChiusaMassima = 50;

int sogliaDellaChiusura(dynamic letto) {
  final scritto = '${letto ?? ''}'.trim();
  if (scritto.isEmpty) return 0;
  final quanto = double.tryParse(scritto.replaceAll(',', '.'));
  if (quanto == null || !quanto.isFinite) return 0;
  return quanto.clamp(0, sogliaChiusaMassima).round();
}

/// La soglia di UNA tapparella, o quella di casa.
///
/// «La percentuale di chiusura la devi spostare nella configurazione di quella
/// finestra: ognuno puo' avere una percentuale differente.» Ha ragione: quella
/// della camera si lascia al dieci per l'aria, quella del salone si chiude del
/// tutto. Zero scritto apposta vale zero.
int sogliaDellaTapparella(Map<String, dynamic> quale, [int diCasa = 0]) {
  final sua = '${quale['soglia'] ?? ''}'.trim();
  if (sua.isEmpty) return sogliaDellaChiusura(diCasa);
  return sogliaDellaChiusura(sua);
}

/// Sopra quanta umidita' la plancia consiglia di aprire la finestra.
///
/// Sessanta: sopra questa quota l'aria di casa comincia a posarsi sui muri
/// freddi, ed e' la quota che le norme sulla ventilazione usano come confine
/// del comfort. Sotto il trenta il consiglio non avrebbe senso — nessuna casa
/// vive li' — e sopra il novantacinque non scatterebbe mai: fuori
/// dall'intervallo la soglia si considera non scritta.
const chiaveDellaSogliaUmidita = 'cd_umidita_soglia';
const sogliaUmiditaDiSerie = 60;
const sogliaUmiditaMinima = 30;
const sogliaUmiditaMassima = 95;

int sogliaDellUmidita(dynamic letto) {
  final scritto = '${letto ?? ''}'.trim();
  if (scritto.isEmpty) return sogliaUmiditaDiSerie;
  final quanto = double.tryParse(scritto.replaceAll(',', '.'));
  if (quanto == null || !quanto.isFinite) return sogliaUmiditaDiSerie;
  if (quanto < sogliaUmiditaMinima || quanto > sogliaUmiditaMassima) {
    return sogliaUmiditaDiSerie;
  }
  return quanto.round();
}
