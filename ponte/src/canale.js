/* Un telefono che arriva dal centralino, vestito da presa.
 *
 * Il ponte sa accogliere una presa: gli si da' una cosa che sappia `manda`,
 * `ping` e `chiudi`, e che chiami `onMessaggio` e `onChiusa`. Non gli importa
 * se sotto c'e' un socket vero o un canale multiplato dentro il filo del
 * centralino.
 *
 * Questa e' la seconda cosa. Percio' `ponte.js` non cambia di una riga: il
 * telefono che entra dalla porta di casa e quello che arriva dal centralino
 * sono, per lui, la stessa cosa.
 */

export class Canale {
  constructor(numero, chiamata) {
    this.numero = numero;
    this.chiamata = chiamata;
    this.viva = true;
    this.onMessaggio = () => {};
    this.onChiusa = () => {};
    this.onPong = () => {};
  }

  manda(testo) {
    if (!this.viva) return false;
    return this.chiamata.mandaSulCanale(this.numero, testo);
  }

  /* Un canale non ha un battito suo: chi tiene in vita il filo col centralino
   * e' il filo stesso, e se quello cade cadono tutti i canali insieme. Quindi
   * un colpetto qui vuol dire soltanto «sono ancora qui», e si risponde subito
   * di si'. Senza questo, il ponte conterebbe il silenzio di un telefono che
   * non ha nessun modo di farsi sentire, e lo butterebbe fuori. */
  ping() {
    if (!this.viva) return;
    try {
      this.onPong();
    } catch (_errore) {
      /* Chi ascolta ha sbagliato: non e' un motivo per chiudere un canale. */
    }
  }

  chiudi(_codice, _motivo) {
    if (!this.viva) return;
    this.viva = false;
    this.chiamata.chiudiIlCanale(this.numero);
    this._avvisa();
  }

  /* Chiamata dalla chiamata quando e' il centralino a dire che il telefono se
   * n'e' andato, o quando cade il filo. */
  finita() {
    if (!this.viva) return;
    this.viva = false;
    this._avvisa();
  }

  _avvisa() {
    try {
      this.onChiusa();
    } catch (_errore) {
      /* Idem. */
    }
  }
}
