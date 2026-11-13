/// I tocchi sulle notifiche aspettano il velo del lucchetto.
///
/// Col lucchetto acceso (`casa/il_lucchetto.dart`) l'app, tornando, si copre
/// e chiede il volto o l'impronta. Ma un tasto di una notifica — «Disinserisci»,
/// «Apri cancello» — arriva all'app come un tocco gia' fatto, e partiva subito
/// verso la casa: il velo era su, e il comando andava lo stesso. Chi trova il
/// telefono bloccato sul tavolo apriva il cancello dalla tendina.
///
/// Adesso un tocco che arriva col velo su resta qui, in fila, e parte quando
/// il velo si toglie — cioe' quando chi tiene il telefono ha mostrato il
/// volto. Se il velo non si toglie, non parte niente. Si prova senza un
/// telefono: e' un elenco e un interruttore.
library;

import 'package:flutter/foundation.dart';

/// Una fila di cose che aspettano che [velo] scenda.
class DietroIlVelo<T> {
  /// [velo] e' su (`true`) finche' l'app e' coperta dal lucchetto;
  /// [quandoTolto] riceve ogni cosa, subito se il velo e' giu', o appena
  /// scende.
  DietroIlVelo(this.velo, this.quandoTolto) {
    velo?.addListener(_cambiato);
  }

  /// Senza velo (`null`) non c'e' niente da aspettare: nel browser, nelle
  /// prove, dove nessuno lo mette.
  final ValueListenable<bool>? velo;
  final void Function(T) quandoTolto;
  final List<T> _inFila = [];

  /// Quante cose aspettano.
  int get inFila => _inFila.length;

  /// Un tocco arrivato: passa adesso, o aspetta il velo.
  void arriva(T cosa) {
    if (velo?.value ?? false) {
      _inFila.add(cosa);
      return;
    }
    quandoTolto(cosa);
  }

  void _cambiato() {
    if (velo?.value ?? false) return;
    final tutte = [..._inFila];
    _inFila.clear();
    tutte.forEach(quandoTolto);
  }

  /// Smette di ascoltare il velo; quello che aspettava non parte piu'.
  void chiudi() {
    velo?.removeListener(_cambiato);
    _inFila.clear();
  }
}
