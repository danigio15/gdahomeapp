/* GdAHome al polso, per gli Amazfit con Zepp OS.
 *
 * Tre pezzi, come vuole Zepp OS:
 *
 *  - le pagine (`page/`), sull'orologio: disegnano la fotografia della casa e
 *    chiedono i comandi. Dall'orologio non esce niente verso la rete: parla
 *    solo col telefono, per Bluetooth;
 *  - il servizio di fianco (`app-side/`), che gira dentro l'app Zepp sul
 *    telefono: e' lui che parla con la casa, ed e' l'unico che ne ha le
 *    chiavi;
 *  - le impostazioni (`setting/`), la pagina dell'app Zepp dove si scrive il
 *    codice di abbinamento.
 *
 * La fotografia che si e' vista per ultima resta qui, in `globalData`, cosi'
 * una pagina che si apre la disegna subito e poi chiede quella fresca.
 */

import { BaseApp } from "@zeppos/zml/base-app";

App(
  BaseApp({
    globalData: {
      foto: null,
    },
    onCreate() {},
    onDestroy() {},
  }),
);
