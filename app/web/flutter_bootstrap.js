// Come si accende Flutter in questa pagina.
//
// Flutter ne genera uno suo quando questo file non c'e'. Ce n'e' uno nostro
// per una riga sola: dire dove sta CanvasKit — il pezzo che disegna — perche'
// di suo Flutter se lo va a prendere da `gstatic.com` a ogni avvio.
//
// Non e' una finezza da collaudo: e' l'app che non deve chiedere niente a
// internet per accendersi. Chi la apre e' in casa propria, magari senza linea,
// e la casa la deve vedere lo stesso.
{{flutter_js}}
{{flutter_build_config}}

_flutter.loader.load({
  config: {
    canvasKitBaseUrl: "canvaskit/",
    // Un motore solo, scelto qui.
    //
    // Di suo Flutter ne costruisce sei — canvaskit, la sua versione per
    // Chrome, skwasm, skwasm pesante, wimp, webparagraph — e sceglie a
    // seconda del browser. Sono trentasette megabyte di roba costruita, per
    // usarne uno.
    //
    // Non e' peso da niente: questa app la porta l'add-on dentro casa, e
    // quello che l'add-on si porta dietro sta nella repository. Un motore
    // solo, uguale su tutti i browser, vuol dire dodici megabyte in meno e
    // una cosa in meno che si comporta diversamente altrove.
    renderer: "canvaskit",
    canvasKitVariant: "full",
  },
});
