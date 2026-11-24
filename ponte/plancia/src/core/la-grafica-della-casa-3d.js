/* La Casa 3D su ogni dispositivo: col 3D dove il 3D regge, in pianta dove no.
 *
 * «Ci vogliono caratteristiche particolari del tablet per far girare l'app
 * del 3D?» Un tablet a muro apriva la Casa 3D e restava lo sfondo blu con
 * «La casa in 3D non si apre su questo dispositivo». Il motore del 3D (three,
 * dalla versione 163) disegna solo con WebGL 2: un tablet che ha soltanto
 * WebGL 1 — tanti, fra quelli economici, e anche quelli il cui processore
 * grafico il browser tiene in lista nera — non ha nessun modo di aprirla. E
 * un tablet che il WebGL 2 ce l'ha ma non la memoria per tenerlo, dopo
 * qualche caduta si fermava con lo stesso muro.
 *
 * Adesso la casa si apre sempre. Prima di accendere il 3D si chiede al
 * browser che grafica c'e' (`provaLaGrafica`); senza WebGL 2, o dopo che il 3D
 * e' caduto troppe volte, o se chi guarda l'ha scelta, la casa si mostra «in
 * pianta»: ogni piano visto dall'alto, con le stanze e i dispositivi col loro
 * stato, da toccare come nel 3D. E' disegnata con la tela 2D del browser, che
 * c'e' dappertutto e costa poco.
 *
 * La scelta e' di questo dispositivo, non della casa (`CHIAVE_DELLA_VISTA`):
 * il tablet debole resta in pianta, il telefono di chi abita resta in 3D.
 * Qui le decisioni, senza toccare la pagina, per poterle provare. */

/** Dove questo dispositivo ricorda come vuole la casa: «3d», «pianta», o niente (decide la grafica). */
export const CHIAVE_DELLA_VISTA = "dm_casa3d_vista_v1";

/** I modi di mostrare la casa. */
export const VISTE = Object.freeze(["3d", "pianta"]);

/**
 * Che grafica c'e' qui: WebGL 2, WebGL 1, e il nome del processore grafico
 * se il browser lo dice (per capire, dalla foto di chi segnala, su che cosa
 * non si apre). La tela di prova si restituisce subito: i contesti WebGL
 * sono pochi, e su un tablet ognuno e' memoria grafica.
 */
export function provaLaGrafica(documento) {
  const esito = { webgl2: false, webgl1: false, gpu: "" };
  let tela = null;
  try {
    tela = documento?.createElement?.("canvas");
  } catch (_errore) {
    return esito;
  }
  if (!tela?.getContext) return esito;
  const prova = (tipo) => {
    try {
      return tela.getContext(tipo, { failIfMajorPerformanceCaveat: false }) || null;
    } catch (_errore) {
      return null;
    }
  };
  /* Una tela da' un contesto solo: chi ha il 2 si prova sul 2, chi non ce
   * l'ha si prova sull'1 con una tela nuova (sulla prima il 2 fallito puo'
   * aver lasciato il segno). */
  let gl = prova("webgl2");
  if (gl) esito.webgl2 = true;
  else {
    try {
      tela = documento.createElement("canvas");
    } catch (_errore) {}
    gl = prova("webgl") || prova("experimental-webgl");
    if (gl) esito.webgl1 = true;
  }
  if (esito.webgl2) esito.webgl1 = true;
  if (gl) {
    try {
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      const nome = info
        ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER);
      esito.gpu = String(nome || "").slice(0, 80);
    } catch (_errore) {}
    try {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    } catch (_errore) {}
  }
  return esito;
}

/** La scelta ricordata su questo dispositivo: «3d», «pianta» o "". */
export function vistaRicordata(memoria) {
  try {
    const v = String(memoria?.getItem?.(CHIAVE_DELLA_VISTA) || "");
    return VISTE.includes(v) ? v : "";
  } catch (_errore) {
    return "";
  }
}

/** Ricorda la scelta (o la dimentica, con ""). Un browser senza memoria non e' un errore. */
export function ricordaLaVista(memoria, vista) {
  try {
    if (VISTE.includes(vista)) memoria?.setItem?.(CHIAVE_DELLA_VISTA, vista);
    else memoria?.removeItem?.(CHIAVE_DELLA_VISTA);
  } catch (_errore) {}
}

/**
 * Come mostrare la casa qui, e perche'.
 *
 *   · grafica: quello che dice `provaLaGrafica` (senza, si prova il 3D);
 *   · scelta: quella ricordata su questo dispositivo («3d», «pianta», "");
 *   · caduto: il 3D si e' gia' fermato troppe volte su questa pagina;
 *   · rotto: il 3D non e' nemmeno partito (l'errore, per dirlo).
 *
 * Torna `{ vista: "3d" | "pianta", motivo, si3d }`: `motivo` e' "" quando la
 * vista e' quella scelta o quella piena, e `si3d` dice se il 3D si puo'
 * almeno provare (il tasto «Prova il 3D» c'e' solo allora).
 */
export function comeMostrareLaCasa({
  grafica = null,
  scelta = "",
  caduto = false,
  rotto = "",
} = {}) {
  const si3d = !grafica || grafica.webgl2 === true;
  if (!si3d)
    return {
      vista: "pianta",
      motivo: grafica?.webgl1 ? "solo-webgl1" : "senza-webgl",
      si3d,
    };
  if (rotto) return { vista: "pianta", motivo: "non-parte", si3d };
  if (caduto) return { vista: "pianta", motivo: "memoria", si3d };
  if (scelta === "pianta") return { vista: "pianta", motivo: "", si3d };
  return { vista: "3d", motivo: "", si3d };
}

/** Il perche' della pianta, detto a chi guarda. */
export function perchéLaPianta(motivo, italiano = true) {
  const L = (it, en) => (italiano ? it : en);
  switch (motivo) {
    case "solo-webgl1":
      return L(
        "Questo dispositivo non ha la grafica per il 3D (solo WebGL 1): la casa è in pianta.",
        "This device lacks the graphics for 3D (WebGL 1 only): the home is shown as a floor plan.",
      );
    case "senza-webgl":
      return L(
        "Questo dispositivo non ha la grafica 3D (niente WebGL): la casa è in pianta.",
        "This device has no 3D graphics (no WebGL): the home is shown as a floor plan.",
      );
    case "non-parte":
      return L(
        "Il 3D non parte su questo dispositivo: la casa è in pianta.",
        "3D won't start on this device: the home is shown as a floor plan.",
      );
    case "memoria":
      return L(
        "Il 3D si è fermato più volte (poca memoria grafica): la casa è in pianta, più leggera.",
        "3D stopped several times (low graphics memory): the home is shown as a lighter floor plan.",
      );
    default:
      return "";
  }
}
