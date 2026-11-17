/* Il velo d'avvio della plancia che si accende, come l'attesa dell'app.
 *
 * «Bellissimo cosi', lo devi mettere anche su HA quando carica la plancia.»
 * L'app ha la sua attesa (`app/lib/schermate/caricamento.dart`): le iniziali
 * G·d·A del marchio che si srotolano, si incastrano nel logo, il lampo, le
 * finestrelle, il Wi-Fi, l'anello di luce, i granelli d'oro, il nome della
 * casa e l'uscita a cerchio. Questo file e' la stessa cosa per la plancia
 * aperta senza l'app: nel pannello di Home Assistant, nel browser, nell'app
 * Companion, sul tablet a muro. Colori, tempi e curve sono quelli del Dart —
 * le curve di Flutter sono curve di Bezier, e qui sono le stesse.
 *
 * ## Come sta in piedi
 *
 *  - **Il velo c'e' gia' prima di questo file.** Il `<div id="cd-boot-overlay">`
 *    e il suo stile critico stanno dentro `dashboard.html`: il fondo pieno al
 *    primo dipinto, e se questo file non arrivasse il marchio fermo compare
 *    da solo dopo un attimo (`cdBootSu`). Questo file arriva subito dopo, lo
 *    veste e lo accende. Il suo tempo parte da quando il velo si e' dipinto:
 *    se arriva tardi, lo spettacolo e' gia' avanti e non riparte da capo.
 *  - **Leggero.** Quasi tutto e' animazione CSS su `transform` e `opacity`,
 *    che il browser fa girare fuori dal filo principale — proprio mentre il
 *    filo principale e' occupato a leggere i moduli della plancia. Di
 *    programma ce n'e' solo dove serve: le iniziali che si srotolano (una tela,
 *    per 1,2 secondi, come il pittore del Dart) e l'uscita.
 *  - **Dentro l'app non fa niente.** Li' sopra c'e' l'attesa nativa, che copre
 *    questo velo finche' se ne va (`premesse.dart`, `laPrimaSchermata`): due
 *    spettacoli uno sotto l'altro sarebbero lavoro per niente. Il velo resta
 *    quello fermo, e se ne va come prima, sfumando: e' quello che l'app ascolta.
 *  - **«Riduci animazioni».** Fermo e pieno: il marchio, il nome, tre punti, e
 *    la riga sotto che cambia lo stesso.
 *  - **Il marchio di chi installa.** Le iniziali, le finestrelle e il Wi-Fi
 *    sono disegnati sul nostro logo: con il logo di un altro nel velo non si
 *    accendono, e resta il resto.
 *
 * Per le fotografie e le prove: `window.__gdahomeVelo` disegna le iniziali a
 * un tempo dato e l'uscita a un punto dato. */
(function () {
  "use strict";
  var D = document;
  var W = window;
  var M = Math;
  var o = D.getElementById("cd-boot-overlay");
  if (!o || o.getAttribute("data-state") === "error" || W.__gdahomeVelo) return;
  /* Nell'app (il canale `gdahomeDice` c'e' dal primo istante della pagina). */
  if (W.gdahomeDice) return;
  var img = o.querySelector("img");
  var nome = o.querySelector("b");
  var riga = o.querySelector("small");
  if (!img || !nome || !riga) return;

  var qui = (D.currentScript && D.currentScript.src) || "";
  function accanto(file) {
    try {
      return new URL(file, qui || D.baseURI).href;
    } catch (_e) {
      return "./caricamento/" + file;
    }
  }

  var fermo = false;
  try {
    fermo = W.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (_e) {}
  /* Il nostro logo, quello che porta le iniziali: lo stesso di
   * `ponte/marchio/gdahome-velo.webp` e dell'app. */
  var nostro = String(img.getAttribute("src") || "").indexOf("aVBOW71WJXpEaTbMIi4ze6QRHZJQ3sGs") > 0;

  /* Il tempo zero: quando il velo si e' dipinto (la sua comparsa di riserva
   * e' partita allora). Se non si e' ancora dipinto, adesso. */
  function adesso() {
    var t = D.timeline && D.timeline.currentTime;
    return typeof t === "number" ? t : W.performance.now();
  }
  var t0 = null;
  try {
    var prima = img.getAnimations ? img.getAnimations() : [];
    if (prima.length && typeof prima[0].startTime === "number") t0 = prima[0].startTime;
  } catch (_e) {}
  if (t0 === null) t0 = adesso();

  /* ── Le curve di Flutter ────────────────────────────────────────────── */
  function curva(x1, y1, x2, y2) {
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var a = 0;
      var b = 1;
      var t = 0.5;
      for (var i = 0; i < 22; i += 1) {
        t = (a + b) / 2;
        var cx = 3 * t * (1 - t) * (1 - t) * x1 + 3 * t * t * (1 - t) * x2 + t * t * t;
        if (cx < x) a = t;
        else b = t;
      }
      return 3 * t * (1 - t) * (1 - t) * y1 + 3 * t * t * (1 - t) * y2 + t * t * t;
    };
  }
  var morbido = curva(0.215, 0.61, 0.355, 1); /* easeOutCubic */
  var seno = curva(0.445, 0.05, 0.55, 0.95); /* easeInOutSine */
  var entraCubica = curva(0.55, 0.055, 0.675, 0.19); /* easeInCubic */
  var entra = curva(0.42, 0, 1, 1); /* easeIn */
  function tra(t, da, durata) {
    var x = (t - da) / durata;
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }

  /* ── Lo stile ───────────────────────────────────────────────────────── */
  var EOC = "cubic-bezier(.215,.61,.355,1)";
  var EIOC = "cubic-bezier(.645,.045,.355,1)";
  var EIOS = "cubic-bezier(.445,.05,.55,.95)";
  var EO = "cubic-bezier(0,0,.58,1)";
  var EOS = "cubic-bezier(.61,1,.88,1)";
  var EIS = "cubic-bezier(.12,0,.39,0)";
  var u = "var(--u)";
  var BUIO =
    "--gv-p0:rgba(6,10,22,.55);--gv-p1:rgba(4,7,15,.85);--gv-a0:rgba(37,99,235,.42);" +
    "--gv-a1:rgba(22,48,122,.3);--gv-rg:rgba(59,130,246,.16);--gv-z0:rgba(59,130,246,.55);" +
    "--gv-z1:rgba(59,130,246,.12);--gv-l0:rgba(255,221,166,.55);--gv-l1:rgba(246,184,92,.22);" +
    "--gv-tr:rgba(255,255,255,.08);--gv-ga:rgba(246,184,92,.12);--gv-gc:rgba(255,221,166,.9);" +
    "--gv-gk:1;--gv-ro:.5";
  /* I sette raggi: lame di luce larghe e strette, come nel Dart (angoli dal
   * mezzogiorno, in gradi). */
  var lame = [
    [0, 2],
    [30, 47.2],
    [81.4, 98.6],
    [147.2, 156.3],
    [184.3, 201.5],
    [250, 259.2],
    [287.1, 304.3],
    [352.9, 360],
  ];
  var raggi = [];
  for (var l = 0; l < lame.length; l += 1) {
    var da = lame[l][0];
    var a = lame[l][1];
    raggi.push(
      (da > 0 ? "transparent " + (da - 0.4) + "deg," : "") +
        "var(--gv-rg) " +
        da +
        "deg,var(--gv-rg) " +
        a +
        "deg" +
        (a < 360 ? ",transparent " + (a + 0.4) + "deg" : ""),
    );
  }
  var maschera = function (cosa) {
    return "-webkit-mask:" + cosa + ";mask:" + cosa;
  };
  var css = [
    "§{--l:calc(112*" + u + ");--R:max(62vmin,260px);--k:.3167;overflow:hidden;",
    "--gv-p0:rgba(255,255,255,.55);--gv-p1:rgba(200,211,227,.6);--gv-a0:rgba(255,255,255,.95);",
    "--gv-a1:rgba(248,251,255,.55);--gv-rg:rgba(255,255,255,.85);--gv-z0:rgba(11,26,58,.2);",
    "--gv-z1:rgba(11,26,58,.05);--gv-l0:rgba(255,221,166,.5);--gv-l1:rgba(246,184,92,.18);",
    "--gv-tr:rgba(11,26,58,.08);--gv-ga:rgba(246,184,92,.07);--gv-gc:rgba(224,154,53,.9);",
    "--gv-gk:1.15;--gv-ro:.28}",
    'html[data-theme="dark"] §{' + BUIO + "}",
    "@media (prefers-color-scheme:dark){html:not([data-tema-letto]) §{" + BUIO + "}}",
    "§ i{position:absolute;display:block;font-style:normal}",
    "§ .gv-prof{inset:0;background:linear-gradient(var(--gv-p0),transparent 45%,var(--gv-p1));animation:gvSu .7s " +
      EOC +
      " both}",
    "§ .gv-c{left:50%;top:calc(50% - 70.4*" + u + ");width:0;height:0;animation:none}",
    "§ .gv-c>i{left:calc(var(--d)/-2);top:calc(var(--d)/-2);width:var(--d);height:var(--d);border-radius:50%}",
    "§ .gv-alone{--d:calc(2.04*var(--R));animation:gvSu .7s " + EOC + " both}",
    "§ .gv-alone>i{inset:0;border-radius:50%;background:radial-gradient(closest-side,var(--gv-a0),var(--gv-a1) 45%,transparent);animation:gvRespira 2.4s " +
      EIOS +
      " infinite alternate}",
    "§ .gv-raggi{--d:calc(2.5*var(--R));animation:gvSu .9s 1.2s " + EOC + " both}",
    "§ .gv-raggi>i{inset:0;background:conic-gradient(" +
      raggi.join(",") +
      ");" +
      maschera("radial-gradient(closest-side,#000 12%,rgba(0,0,0,.33) 50%,transparent)") +
      ";animation:gvGira 89.76s linear infinite}",
    "§ .gv-c>.gv-pozza{--d:calc(2.3*var(--l));top:calc(.346*var(--l));height:calc(.368*var(--l));background:radial-gradient(closest-side,var(--gv-z0),var(--gv-z1) 50%,transparent);animation:gvSu .7s 1.1s " +
      EOC +
      " both}",
    "§ .gv-lampo{--d:calc(3.8*var(--l));opacity:0;background:radial-gradient(closest-side,var(--gv-l0),var(--gv-l1) 40%,transparent);animation:gvLampo .78s 1.2s both,gvLampoS .6s 1.2s " +
      EOC +
      " both}",
    "§ .gv-onda{--d:calc(6.44*var(--l));opacity:0;box-sizing:border-box;border:calc(.028*var(--l)) solid rgba(255,221,166,.85);" +
      "box-shadow:0 0 0 calc(.025*var(--l)) rgba(246,184,92,.18),inset 0 0 0 calc(.025*var(--l)) rgba(246,184,92,.18);" +
      "animation:gvOndaS 1s 1.2s " +
      EOC +
      " both,gvOndaO 1s 1.2s linear forwards}",
    "§ .gv-anello{--d:calc(1.6*var(--l) + 2.2*" + u + ");z-index:1;animation:gvAnello .6s 1.4s " + EOC + " both}",
    '§ .gv-anello::before{content:"";position:absolute;inset:0;border-radius:50%;border:calc(2.2*' +
      u +
      ") solid var(--gv-tr)}",
    "§ .gv-arco{inset:0;animation:gvGira 1.5s linear infinite}",
    "§ .gv-arco>i:first-child{inset:0;border-radius:50%;background:conic-gradient(rgba(59,130,246,0),#3b82f6 97.2deg,#f6b85c 162deg,transparent 162.4deg);" +
      maschera(
        "radial-gradient(closest-side,transparent calc(100% - 2.2*" +
          u +
          " - .6px),#000 calc(100% - 2.2*" +
          u +
          "),#000 calc(100% - .6px),transparent)",
      ) +
      "}",
    "§ .gv-arco>i+i{width:calc(14*" +
      u +
      ");height:calc(14*" +
      u +
      ");left:calc(50% + .2472*var(--l) - 7*" +
      u +
      ");top:calc(50% + .7608*var(--l) - 7*" +
      u +
      ");border-radius:50%;background:radial-gradient(closest-side,rgba(255,221,166,.95),rgba(246,184,92,.3) 50%,transparent)}",
    "§ .gv-g{--d:0px;transform:rotate(-12.605deg);z-index:1;animation:gvGz var(--T) var(--dy) step-end infinite,gvSu .15s 1.2s linear both,gvGesce .9s 1.2s " +
      EOC +
      " both}",
    "§ .gv-g>i{left:0;top:var(--s);animation:gvGx var(--T) var(--dx) " + EIOS + " infinite}",
    "§ .gv-g>i>i{left:0;top:0;animation:gvGy var(--T) var(--dy) " + EIOS + " infinite}",
    "§ .gv-g>i>i>i{--e:calc(var(--gr)*4.6*" +
      u +
      "*var(--gv-gk));width:var(--e);height:var(--e);left:calc(var(--e)/-2);top:calc(var(--e)/-2);border-radius:50%;" +
      "background:radial-gradient(closest-side,var(--gv-gc) 40%,var(--gv-ga) 46%,var(--gv-ga) 94%,transparent);animation:gvBrilla 2.4166s var(--db) " +
      EIOS +
      " infinite}",
    "§ .gv-c>.gv-ini{--d:calc(min(82vw,2.4*var(--l))*1.2104);border-radius:0;z-index:4;animation:gvIni .32s .88s " +
      EIOC +
      " both,gvSpegni 1ms 1.2s both}",
    "§ .gv-ini canvas{position:absolute;left:0;top:0;width:100%;height:100%}",
    "§.gv-vivo>img{z-index:2;animation:gvMarchio 2.1s linear both,gvSu .16s 1.04s " + EOC + " both}",
    "§ .gv-m{display:none;z-index:2;left:calc(50% - 56*" +
      u +
      ");top:calc(50% - 126.4*" +
      u +
      ");width:var(--l);height:var(--l);mix-blend-mode:plus-lighter;animation:gvMarchio 2.1s linear both}",
    "§.gv-nostro .gv-m{display:block}",
    "§ .gv-bag{inset:0;border-radius:22%;opacity:0;background:radial-gradient(closest-side,rgba(255,221,166,.55),rgba(59,130,246,.18) 150%);animation:gvBagliore .61s 1.2s both}",
    "§ .gv-f{width:10.417%;height:10.417%;opacity:0;background:linear-gradient(rgba(255,221,166,.7),rgba(255,221,166,.7)) 50%/31.25% 31.25% no-repeat," +
      "radial-gradient(closest-side,rgba(246,184,92,.5),rgba(246,184,92,0));animation:gvFin .67s both}",
    "§ .gv-f.gv-fr{animation:gvFinR 4.8s infinite both}",
    "§ .gv-onde{inset:0;animation:gvSu .4s 1.75s " + EOC + " both}",
    "§ .gv-onde svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;opacity:0;animation:1.6s 1.75s infinite both;transform-origin:68.75% 35.94%}",
    "§ .gv-onde svg:nth-child(1){animation-name:gvPunto}",
    "§ .gv-onde svg:nth-child(2){animation-name:gvArco1}",
    "§ .gv-onde svg:nth-child(3){animation-name:gvArco2}",
    "§ .gv-onde svg:nth-child(4){animation-name:gvArco3}",
    "§ .gv-luc{inset:0;border-radius:22%;overflow:hidden}",
    "§ .gv-luc>i{inset:0;transform:translate(-120%,-120%);background:linear-gradient(to bottom right,transparent 36%,rgba(255,255,255,.32) 50%,transparent 64%);animation:gvLucido 4.8s 1.55s infinite both}",
    "§ .gv-rifl{z-index:2;left:calc(50% - 56*" +
      u +
      ");top:calc(50% - 7.68*" +
      u +
      ");width:var(--l);height:calc(38.08*" +
      u +
      ");overflow:hidden;opacity:var(--gv-ro);" +
      maschera("linear-gradient(rgba(0,0,0,.8),transparent)") +
      ";animation:gvSu .6s 1.1s " +
      EOC +
      " both}",
    "§ .gv-rifl>i{left:0;top:0;width:var(--l);height:var(--l);transform:scaleY(-1)}",
    "§ .gv-rifl>i>i{inset:0;border-radius:22%;background:50%/cover no-repeat;animation:gvMarchio 2.1s linear both}",
    "§.gv-vivo>b{z-index:2;animation:none}",
    "§ b>span{display:inline-block}",
    "§ b>span>span{display:inline-block;white-space:pre;animation:gvLettera .42s " + EOC + " both}",
    "§ .gv-filo{z-index:2;left:calc(50% - 28*" +
      u +
      ");top:calc(50% + 66.4*" +
      u +
      ");width:calc(56*" +
      u +
      ");height:calc(2*" +
      u +
      ");border-radius:calc(2*" +
      u +
      ");background:linear-gradient(90deg,rgba(246,184,92,0),#f6b85c,rgba(246,184,92,0));animation:gvFilo .7s 1.6s " +
      EOC +
      " both}",
    "§.gv-vivo>.s{display:none}",
    "§.gv-vivo>small{z-index:2;height:calc(18*" + u + ");animation:gvSu .5s 1.5s " + EOC + " both}",
    "§ small>span{position:absolute;left:0;right:0;top:0}",
    "§ small i{position:static;display:inline-block}",
    /* Fermo: «riduci animazioni». */
    "§.gv-fermo *:not(.gv-r){animation:none!important}",
    "§.gv-fermo .gv-r{animation-duration:1ms!important}",
    "§.gv-fermo .gv-ini,§.gv-fermo .gv-m,§.gv-fermo .gv-anello,§.gv-fermo .gv-g,§.gv-fermo .gv-lampo,§.gv-fermo .gv-onda{display:none!important}",
    "§.gv-fermo .gv-raggi{opacity:.6}",
    "§.gv-fermo .gv-alone>i{transform:scale(.951);opacity:.875}",
    "§.gv-fermo>.s{display:block}",
    "§.gv-fermo{transition:none}",
    /* I tempi. */
    "@keyframes gvSu{from{opacity:0}}",
    "@keyframes gvRespira{from{transform:scale(.902);opacity:.75}}",
    "@keyframes gvGira{to{transform:rotate(360deg)}}",
    "@keyframes gvLampo{0%{opacity:0;animation-timing-function:" +
      EO +
      "}10.26%{opacity:1;animation-timing-function:" +
      EOC +
      "}to{opacity:0}}",
    "@keyframes gvLampoS{from{transform:scale(.5263)}}",
    "@keyframes gvOndaS{from{transform:scale(.1925)}}",
    "@keyframes gvOndaO{from{opacity:1}to{opacity:0}}",
    /* La scala del marchio: piccolo mentre le iniziali gli cadono dentro,
     * poi il rimbalzo elastico dell'accensione (ElasticOutCurve(0.42)). */
    "@keyframes gvMarchio{0%{transform:scale(.72)}41.9%{transform:scale(.72);animation-timing-function:" +
      EOC +
      "}57.14%{transform:scale(.92)}59.52%{transform:scale(.9633)}61.9%{transform:scale(1.0034)}" +
      "64.29%{transform:scale(1.0201)}66.67%{transform:scale(1.0169)}69.05%{transform:scale(1.0062)}" +
      "71.43%{transform:scale(.9979)}73.81%{transform:scale(.9952)}76.19%{transform:scale(.9966)}" +
      "78.57%{transform:scale(.9991)}80.95%{transform:scale(1.0008)}83.33%{transform:scale(1.0011)}to{transform:scale(1)}}",
    "@keyframes gvAnello{from{opacity:0;transform:scale(1.075)}}",
    "@keyframes gvGx{0%,to{transform:translateX(var(--r))}50%{transform:translateX(calc(-1*var(--r)))}}",
    "@keyframes gvGy{0%,to{transform:translateY(var(--y)) scale(1.1);opacity:1}50%{transform:translateY(calc(-1*var(--y))) scale(.89);opacity:.67}}",
    "@keyframes gvGz{0%{z-index:3}25%{z-index:1}75%{z-index:3}}",
    "@keyframes gvGesce{from{transform:rotate(-12.605deg) scale(.25)}}",
    "@keyframes gvBrilla{0%,to{opacity:1}50%{opacity:.1}}",
    "@keyframes gvIni{to{transform:scale(var(--k))}}",
    "@keyframes gvSpegni{to{opacity:0;visibility:hidden}}",
    "@keyframes gvLettera{from{opacity:0;transform:translateY(calc(9*" + u + "))}}",
    "@keyframes gvFilo{from{transform:scaleX(0)}}",
    "@keyframes gvEntra{from{opacity:0;transform:translateY(calc(6*" + u + "))}}",
    "@keyframes gvEsce{to{opacity:0;transform:translateY(calc(-6*" + u + "))}}",
    "@keyframes gvBagliore{0%{opacity:0;animation-timing-function:" +
      EO +
      "}9.84%{opacity:1;animation-timing-function:" +
      EOC +
      "}to{opacity:0}}",
    "@keyframes gvFin{0%{opacity:0;animation-timing-function:" +
      EO +
      "}10.45%{opacity:1;animation-timing-function:" +
      EOC +
      "}to{opacity:0}}",
    "@keyframes gvFinR{0%,50%{opacity:0;animation-timing-function:" +
      EOS +
      "}57.29%{opacity:.55;animation-timing-function:" +
      EIS +
      "}64.58%,to{opacity:0}}",
    "@keyframes gvPunto{0%{opacity:0;animation-timing-function:" +
      EOS +
      "}15%{opacity:1;animation-timing-function:" +
      EIS +
      "}30%,to{opacity:0}}",
    "@keyframes gvArco1{0%,14%{opacity:0;animation-timing-function:" +
      EOS +
      "}31%{opacity:1;animation-timing-function:" +
      EIS +
      "}48%,to{opacity:0}}",
    "@keyframes gvArco2{0%,28%{opacity:0;animation-timing-function:" +
      EOS +
      "}45%{opacity:1;animation-timing-function:" +
      EIS +
      "}62%,to{opacity:0}}",
    "@keyframes gvArco3{0%,42%{opacity:0;transform:scale(1);animation-timing-function:" +
      EOS +
      "}51.17%{opacity:.833;transform:scale(1.0858);animation-timing-function:" +
      EIS +
      "}60.33%,to{opacity:0;transform:scale(1.1717)}}",
    "@keyframes gvLucido{0%{transform:translate(-120%,-120%);animation-timing-function:" +
      EIOS +
      "}17.71%,to{transform:translate(120%,120%)}}",
  ]
    .join("\n")
    .replace(/§/g, "#cd-boot-overlay");
  var stile = D.createElement("style");
  stile.id = "gv-velo";
  stile.textContent = css;
  (D.head || D.documentElement).appendChild(stile);

  /* ── I pezzi ────────────────────────────────────────────────────────── */
  function pezzo(classe, dentro) {
    var e = D.createElement("i");
    if (classe) e.className = classe;
    if (dentro) for (var i = 0; i < dentro.length; i += 1) e.appendChild(dentro[i]);
    return e;
  }
  function svg(dentro) {
    var s = D.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 384 384");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = dentro;
    return s;
  }
  /* Un arco del Wi-Fi: il quarto di cerchio da mezzogiorno alle tre, attorno
   * a (264, 138) nel disegno a 384, con la sua luce attorno. */
  function arco(r, sottile) {
    var d = "M264 " + (138 - r) + "A" + r + " " + r + " 0 0 1 " + (264 + r) + " 138";
    return svg(
      '<g fill="none" stroke-linecap="round"><path d="' +
        d +
        '" stroke="#f6b85c" stroke-opacity=".2" stroke-width="' +
        18.2 * sottile +
        '"/><path d="' +
        d +
        '" stroke="#ffdda6" stroke-opacity=".85" stroke-width="' +
        7 * sottile +
        '"/></g>',
    );
  }

  var centro = pezzo("gv-c", [
    pezzo("gv-alone", [pezzo()]),
    pezzo("gv-raggi", [pezzo()]),
    pezzo("gv-pozza"),
    pezzo("gv-lampo"),
    pezzo("gv-onda"),
    pezzo("gv-anello", [pezzo("gv-arco", [pezzo(), pezzo()])]),
  ]);

  /* I granelli d'oro: gli stessi ventidue del Dart (`Random(7)`): raggio,
   * velocita', fase, brillio, grandezza, altezza. Girano su un'ellisse
   * inclinata; la meta' di sopra passa dietro al marchio, quella di sotto
   * davanti. */
  var granelli = [
    [0.846, 0.536, 3.095, 3.042, 2.466, 0.081],
    [0.827, 0.576, 4.321, 0.033, 1.607, 0.106],
    [1.209, 0.567, 1.414, 4.459, 2.592, -0.097],
    [1.126, 0.433, 2.075, 2.537, 1.705, 0.086],
    [0.992, 0.507, 4.303, 2.235, 2.067, 0.124],
    [0.909, 0.312, 0.865, 4.353, 2.75, -0.116],
    [1.19, 0.416, 4.534, 4.842, 2.702, 0.086],
    [1.242, 0.456, 2.912, 0.602, 1.239, 0.043],
    [1.15, 0.455, 5.057, 2.405, 2.559, 0.038],
    [1.085, 0.576, 5.769, 5.547, 1.549, -0.062],
    [0.844, 0.552, 1.112, 5.008, 1.649, 0.072],
    [1.3, 0.353, 3.486, 1.41, 1.42, -0.046],
    [0.901, 0.574, 4.154, 6.243, 1.786, 0.037],
    [0.892, 0.622, 0.868, 0.498, 2.075, -0.037],
    [1.21, 0.478, 2.583, 1.876, 2.795, -0.041],
    [0.846, 0.566, 2.207, 3.113, 1.658, 0.114],
    [1.037, 0.455, 5.453, 2.259, 2.031, -0.009],
    [0.867, 0.522, 1.143, 2.802, 1.612, 0.011],
    [1.036, 0.415, 4.25, 3.146, 2.439, -0.041],
    [0.874, 0.36, 1.346, 0.57, 2.097, 0.056],
    [1.181, 0.501, 1.35, 6.267, 1.456, -0.016],
    [0.915, 0.6, 1.638, 0.519, 2.297, -0.083],
  ];
  var GIRO = 2 * M.PI;
  function quota(angolo) {
    return (((angolo % GIRO) + GIRO) % GIRO) / GIRO;
  }
  for (var g = 0; g < granelli.length; g += 1) {
    var q = granelli[g];
    var periodo = GIRO / q[1];
    var uno = pezzo("gv-g", [pezzo("", [pezzo("", [pezzo()])])]);
    uno.style.cssText =
      "--T:" +
      periodo.toFixed(3) +
      "s;--dx:" +
      (-quota(q[2]) * periodo).toFixed(3) +
      "s;--dy:" +
      (-quota(q[2] - M.PI / 2) * periodo).toFixed(3) +
      "s;--db:" +
      (-quota(q[3] - M.PI / 2) * 2.4166).toFixed(3) +
      "s;--r:calc(" +
      q[0] +
      "*var(--l));--y:calc(" +
      (0.36 * q[0]).toFixed(4) +
      "*var(--l));--s:calc(" +
      q[5] +
      "*var(--l));--gr:" +
      q[4];
    centro.appendChild(uno);
  }

  /* Le iniziali: una tela grande al centro, che si rimpicciolisce fino al
   * marchio. */
  var tela = D.createElement("canvas");
  tela.setAttribute("aria-hidden", "true");
  var iniziali = pezzo("gv-ini", [tela]);
  centro.appendChild(iniziali);

  /* Le luci sopra il marchio: il bagliore, le finestrelle, il Wi-Fi, il
   * riflesso che lo attraversa. Coordinate del disegno a 384. */
  var luci = pezzo("gv-m", [pezzo("gv-bag")]);
  var finestre = [
    [189, 172],
    [206, 172],
    [206, 190],
    [189, 190],
  ];
  for (var f = 0; f < finestre.length; f += 1) {
    for (var volta = 0; volta < 2; volta += 1) {
      var fin = pezzo(volta ? "gv-f gv-fr" : "gv-f");
      fin.style.left = (((finestre[f][0] - 20) / 384) * 100).toFixed(3) + "%";
      fin.style.top = (((finestre[f][1] - 20) / 384) * 100).toFixed(3) + "%";
      fin.style.animationDelay = (1.4 + f * 0.11).toFixed(2) + "s";
      luci.appendChild(fin);
    }
  }
  var onde = pezzo("gv-onde");
  onde.appendChild(
    svg(
      '<circle cx="267" cy="129" r="16" fill="#f6b85c" fill-opacity=".25"/>' +
        '<circle cx="267" cy="129" r="7.5" fill="#ffdda6" fill-opacity=".8"/>',
    ),
  );
  onde.appendChild(arco(30, 1));
  onde.appendChild(arco(48, 1));
  onde.appendChild(arco(66, 0.85));
  luci.appendChild(onde);
  luci.appendChild(pezzo("gv-luc", [pezzo()]));

  var specchio = pezzo();
  var riflesso = pezzo("gv-rifl", [pezzo("", [specchio])]);
  specchio.style.backgroundImage = 'url("' + img.src + '")';

  /* Il nome, lettera per lettera, col filo d'oro sotto. */
  var parola = String(nome.textContent || "").trim();
  var filo = pezzo("gv-filo");
  if (parola) {
    var lettere = Array.from ? Array.from(parola) : parola.split("");
    var passo = M.min(0.045, 0.6 / M.max(1, lettere.length));
    var scritta = D.createElement("span");
    for (var n = 0; n < lettere.length; n += 1) {
      var lettera = D.createElement("span");
      lettera.textContent = lettere[n];
      lettera.style.animationDelay = (1.35 + n * passo).toFixed(3) + "s";
      scritta.appendChild(lettera);
    }
    nome.textContent = "";
    nome.setAttribute("aria-label", parola);
    nome.appendChild(scritta);
  } else {
    filo.style.display = "none";
  }

  /* La riga sotto: «Caricamento…», poi le altre, quando l'attesa dura. */
  var righe = [String(riga.textContent || "")].concat(
    String(riga.getAttribute("data-poi") || "")
      .split("|")
      .filter(Boolean),
  );
  var QUANDO = [0, 2.5, 6, 12];
  riga.textContent = "";
  for (var r = 0; r < righe.length && r < QUANDO.length; r += 1) {
    var fuori = D.createElement("span");
    var dentro = D.createElement("i");
    fuori.className = "gv-r";
    dentro.className = "gv-r";
    dentro.textContent = righe[r];
    if (r + 1 < righe.length && r + 1 < QUANDO.length)
      fuori.style.animation = "gvEsce .45s " + QUANDO[r + 1] + "s " + EOC + " both";
    if (r > 0) dentro.style.animation = "gvEntra .45s " + QUANDO[r] + "s " + EOC + " both";
    fuori.appendChild(dentro);
    riga.appendChild(fuori);
  }

  o.insertBefore(pezzo("gv-prof"), img);
  o.insertBefore(centro, img);
  img.parentNode.insertBefore(luci, img.nextSibling);
  o.insertBefore(riflesso, nome);
  o.insertBefore(filo, riga);
  o.className += " gv-vivo" + (nostro ? " gv-nostro" : "") + (fermo ? " gv-fermo" : "");

  /* Un nome lungo non esce dallo schermo: si stringe, come nel Dart. */
  try {
    var largo = o.clientWidth * 0.92;
    var scritto = nome.firstChild ? nome.firstChild.offsetWidth : 0;
    if (scritto > largo) nome.style.transform = "scale(" + (largo / scritto).toFixed(3) + ")";
  } catch (_e) {}

  /* Tutti gli orologi allo stesso zero. */
  try {
    var tutte = o.getAnimations
      ? o.getAnimations({ subtree: true })
      : D.getAnimations
        ? D.getAnimations()
        : [];
    for (var k = 0; k < tutte.length; k += 1) tutte[k].startTime = t0;
  } catch (_e) {}

  /* Il logo in alta risoluzione: quello dentro la pagina e' piccolo, per
   * arrivare col primo byte; su uno schermo fitto si vede. Quando c'e', si
   * cambia senza che si veda. */
  if (nostro && !fermo) {
    var alto = new Image();
    alto.src = accanto("marchio.webp");
    var cambia = function () {
      if (!o.isConnected) return;
      img.src = alto.src;
      specchio.style.backgroundImage = 'url("' + alto.src + '")';
    };
    if (alto.decode) alto.decode().then(cambia, function () {});
    else alto.onload = cambia;
  }

  /* ── Le iniziali che si srotolano (il pittore `_Iniziali` del Dart) ── */
  /* I pezzi del marchio, nelle coordinate dell'icona a 1024: dove stanno, da
   * quando si srotolano, e i nastri da seguire. */
  var PEZZI = [
    {
      file: "iniziale_g.webp",
      dove: [92, 170, 297, 593],
      da: 0.08,
      luce: "59,130,246",
      nastri: [
        [380, 205, 260, 285, 155, 395, 115, 500, 150, 620, 240, 690, 370, 720],
        [140, 425, 370, 420],
        [380, 557, 245, 557],
      ],
    },
    {
      file: "iniziale_d.webp",
      dove: [371, 165, 332, 597],
      da: 0.26,
      luce: "59,130,246",
      nastri: [
        [415, 315, 415, 752],
        [380, 195, 500, 205, 620, 300, 690, 375],
        [410, 270, 530, 340, 615, 420, 625, 470],
        [485, 455, 570, 525],
        [410, 560, 470, 600, 530, 660, 600, 705],
      ],
    },
    {
      file: "iniziale_a.webp",
      dove: [448, 215, 498, 547],
      da: 0.44,
      luce: "246,184,92",
      nastri: [
        [530, 660, 625, 510, 715, 375],
        [712, 345, 712, 330],
        [705, 285, 770, 305, 792, 365],
        [705, 235, 800, 260, 835, 365],
        [730, 380, 840, 550, 940, 725],
        [560, 680, 670, 620, 780, 590, 880, 660],
      ],
    },
  ];
  var SROTOLA = 0.42;
  var ACCENSIONE = 1.2;
  for (var p = 0; p < PEZZI.length; p += 1) {
    var pz = PEZZI[p];
    pz.lungo = 0;
    pz.lunghi = [];
    for (var s = 0; s < pz.nastri.length; s += 1) {
      var tratto = pz.nastri[s];
      var quanto = 0;
      for (var v = 2; v < tratto.length; v += 2)
        quanto += M.sqrt(
          M.pow(tratto[v] - tratto[v - 2], 2) + M.pow(tratto[v + 1] - tratto[v - 1], 2),
        );
      pz.lunghi.push(quanto);
      pz.lungo += quanto;
    }
    pz.immagine = new Image();
    pz.pronta = false;
    (function (questo) {
      var fatto = function () {
        questo.pronta = true;
      };
      questo.immagine.src = accanto(questo.file);
      if (questo.immagine.decode) questo.immagine.decode().then(fatto, function () {});
      else questo.immagine.onload = fatto;
    })(pz);
    pz.tela = D.createElement("canvas");
  }

  function buio() {
    var h = D.documentElement;
    if (h.getAttribute("data-theme") === "dark") return true;
    if (h.hasAttribute("data-tema-letto")) return false;
    try {
      return W.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (_e) {
      return false;
    }
  }

  var penna = tela.getContext ? tela.getContext("2d") : null;
  var fitto = 1;
  var lato = 0;
  function misura() {
    var largo = iniziali.offsetWidth;
    if (!largo) return;
    fitto = M.min(W.devicePixelRatio || 1, 2);
    lato = M.round(largo * fitto);
    if (tela.width !== lato) {
      tela.width = lato;
      tela.height = lato;
    }
    /* Alla fine le iniziali sono grandi quanto il marchio a 0,92. */
    o.style.setProperty("--k", ((0.92 * img.offsetWidth) / largo).toFixed(4));
  }

  function rettangoloTondo(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* Di giorno, sotto le iniziali, il quadrato blu notte del marchio. */
  function piastra(c, t) {
    var vede = morbido(tra(t, 0, 0.3)) * (1 - tra(t, ACCENSIONE - 0.04, 0.04));
    if (vede <= 0) return;
    var s = 0.94 + 0.06 * morbido(tra(t, 0, 0.4));
    c.save();
    c.translate(512, 512);
    c.scale(s, s);
    c.translate(-512, -512);
    var fondo = c.createLinearGradient(0, 0, 1024, 0);
    fondo.addColorStop(0, "rgba(0,6,38," + vede + ")");
    fondo.addColorStop(0.5, "rgba(6,10,26," + vede + ")");
    fondo.addColorStop(1, "rgba(20,10,12," + vede + ")");
    rettangoloTondo(c, 0, 0, 1024, 1024, 225);
    c.fillStyle = fondo;
    c.fill();
    c.clip();
    var orlo = c.createLinearGradient(0, 0, 1024, 0);
    orlo.addColorStop(0, "rgb(1,110,240)");
    orlo.addColorStop(0.5, "rgb(60,90,170)");
    orlo.addColorStop(1, "rgb(225,125,40)");
    c.strokeStyle = orlo;
    var passate = [
      [80, 0.06],
      [52, 0.08],
      [34, 0.14],
      [22, 1],
    ];
    for (var i = 0; i < passate.length; i += 1) {
      c.lineWidth = passate[i][0];
      c.globalAlpha = passate[i][1] * vede;
      c.stroke();
    }
    c.restore();
  }

  /* Il nastro srotolato fino a `quanto`: torna dove sta la testa. */
  function srotola(c, pz, quanto) {
    var resta = quanto * pz.lungo;
    var testa = null;
    c.beginPath();
    for (var s = 0; s < pz.nastri.length && resta > 0; s += 1) {
      var tratto = pz.nastri[s];
      var qui = M.min(resta, pz.lunghi[s]);
      var fatto = 0;
      c.moveTo(tratto[0], tratto[1]);
      for (var v = 2; v < tratto.length; v += 2) {
        var x0 = tratto[v - 2];
        var y0 = tratto[v - 1];
        var dx = tratto[v] - x0;
        var dy = tratto[v + 1] - y0;
        var lungo = M.sqrt(dx * dx + dy * dy);
        if (fatto + lungo >= qui) {
          var f = lungo ? (qui - fatto) / lungo : 0;
          c.lineTo(x0 + dx * f, y0 + dy * f);
          if (qui < pz.lunghi[s]) testa = [x0 + dx * f, y0 + dy * f];
          break;
        }
        c.lineTo(tratto[v], tratto[v + 1]);
        fatto += lungo;
      }
      resta -= qui;
    }
    c.lineWidth = 150;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = "#fff";
    c.stroke();
    return testa;
  }

  function disegna(t) {
    if (!penna) return;
    if (!lato) misura();
    penna.setTransform(1, 0, 0, 1, 0, 0);
    penna.clearRect(0, 0, tela.width, tela.height);
    if (t >= ACCENSIONE || !lato) return;
    var sc = lato / 1024;
    var scuro = buio();
    penna.setTransform(sc, 0, 0, sc, 0, 0);
    if (!scuro) piastra(penna, t);
    for (var i = 0; i < PEZZI.length; i += 1) {
      var pz = PEZZI[i];
      if (!pz.pronta) continue;
      var quanto = seno(tra(t, pz.da, SROTOLA));
      if (quanto <= 0) continue;
      var resto = morbido(tra(t, pz.da + SROTOLA - 0.05, 0.15));
      var x = pz.dove[0];
      var y = pz.dove[1];
      var w = pz.dove[2];
      var h = pz.dove[3];
      if (resto >= 1) {
        penna.drawImage(pz.immagine, x, y, w, h);
        continue;
      }
      /* La maschera: un nastro largo che corre lungo il tracciato, e quello
       * che non ha preso che compare piano. Poi l'immagine, solo li'. */
      var foglio = pz.tela;
      var fw = M.ceil(w * sc);
      var fh = M.ceil(h * sc);
      if (foglio.width !== fw || foglio.height !== fh) {
        foglio.width = fw;
        foglio.height = fh;
      }
      var c = foglio.getContext("2d");
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1;
      c.clearRect(0, 0, fw, fh);
      c.setTransform(sc, 0, 0, sc, -x * sc, -y * sc);
      /* Niente ritaglio, a differenza del Dart: qui `source-in` copre tutta la
       * tela, e fuori dall'immagine la maschera se ne va da se'. Un ritaglio
       * lascerebbe un filo chiaro lungo il suo orlo. */
      c.save();
      var testa = srotola(c, pz, quanto);
      if (resto > 0) {
        c.globalAlpha = resto;
        c.fillStyle = "#fff";
        c.fillRect(x, y, w, h);
        c.globalAlpha = 1;
      }
      c.globalCompositeOperation = "source-in";
      c.drawImage(pz.immagine, x, y, w, h);
      c.restore();
      penna.drawImage(foglio, x, y, w, h);
      /* Il punto di luce dove il nastro si sta srotolando. */
      if (testa) {
        var luce = penna.createRadialGradient(testa[0], testa[1], 0, testa[0], testa[1], 70);
        luce.addColorStop(0, "rgba(255,255,255,.95)");
        luce.addColorStop(0.3, "rgba(" + pz.luce + ",.45)");
        luce.addColorStop(1, "rgba(" + pz.luce + ",0)");
        penna.globalCompositeOperation = scuro ? "lighter" : "source-over";
        penna.fillStyle = luce;
        penna.beginPath();
        penna.arc(testa[0], testa[1], 70, 0, 2 * M.PI);
        penna.fill();
        penna.globalCompositeOperation = "source-over";
      }
    }
  }

  var fermato = false;
  function giro(quando) {
    if (fermato || !o.isConnected || o.getAttribute("data-state") === "error") return;
    var t = (quando - t0) / 1000;
    disegna(t);
    if (t < ACCENSIONE + 0.05) W.requestAnimationFrame(giro);
  }
  if (!fermo) {
    misura();
    W.addEventListener("resize", misura);
    W.requestAnimationFrame(giro);
  }

  /* ── L'uscita: un cerchio bordato d'oro che si apre dal marchio ────── */
  var DURA = 560;
  var esce = null;
  function prepara() {
    var fuori = o.getBoundingClientRect();
    var c = centro.getBoundingClientRect();
    var cx = c.left - fuori.left;
    var cy = c.top - fuori.top;
    var lontano = 0;
    var angoli = [
      [0, 0],
      [fuori.width, 0],
      [0, fuori.height],
      [fuori.width, fuori.height],
    ];
    for (var i = 0; i < angoli.length; i += 1)
      lontano = M.max(lontano, M.sqrt(M.pow(angoli[i][0] - cx, 2) + M.pow(angoli[i][1] - cy, 2)));
    var bordo = D.createElement("div");
    bordo.setAttribute("aria-hidden", "true");
    bordo.style.cssText =
      "position:fixed;z-index:2147483647;pointer-events:none;border-radius:50%;box-sizing:border-box;display:none";
    (o.parentNode || D.body).appendChild(bordo);
    return {
      cx: cx,
      cy: cy,
      x: fuori.left + cx,
      y: fuori.top + cy,
      raggio: lontano + 8,
      u: (img.offsetWidth || 112) / 112,
      bordo: bordo,
    };
  }
  function uscita(p) {
    if (!esce) esce = prepara();
    var e = esce;
    var r = entraCubica(p) * e.raggio;
    var buco =
      "radial-gradient(circle at " +
      e.cx +
      "px " +
      e.cy +
      "px,transparent " +
      r.toFixed(1) +
      "px,#000 " +
      (r + 1).toFixed(1) +
      "px)";
    o.style.webkitMaskImage = buco;
    o.style.maskImage = buco;
    /* Alla fine l'ultimo pezzo sfuma: il bordo d'oro non resta tagliato. */
    var quanto = p < 0.7 ? 1 : M.max(0.001, (1 - p) / 0.3);
    o.style.opacity = String(quanto);
    var piu = String(1 + 0.35 * entra(p));
    img.style.scale = piu;
    luci.style.scale = piu;
    specchio.style.scale = piu;
    var forza = (1 - entra(p)) * quanto;
    var b = e.bordo.style;
    if (p <= 0 || p >= 1 || r <= 0) {
      b.display = "none";
      return;
    }
    var spesso = 2.5 * e.u;
    var largo = 2 * r + spesso;
    b.display = "block";
    b.width = largo + "px";
    b.height = largo + "px";
    b.left = e.x - largo / 2 + "px";
    b.top = e.y - largo / 2 + "px";
    b.border = spesso + "px solid rgba(255,221,166," + (0.95 * forza).toFixed(3) + ")";
    var alone = "0 0 0 " + (5.75 * e.u).toFixed(2) + "px rgba(246,184,92," + (0.18 * forza).toFixed(3) + ")";
    b.boxShadow = alone + ",inset " + alone;
  }
  function fine() {
    fermato = true;
    if (esce && esce.bordo.parentNode) esce.bordo.parentNode.removeChild(esce.bordo);
    if (o.parentNode) o.parentNode.removeChild(o);
  }

  /* Chiamata dalla plancia quando e' pronta (`_cdTogliIlVelo`). Torna falso
   * quando l'uscita la fa lei, come prima. */
  function via() {
    if (esce && esce.via) return true;
    if (fermo || !o.isConnected || o.getAttribute("data-state") === "error") return false;
    if (!W.requestAnimationFrame) return false;
    uscita(0);
    esce.via = true;
    /* Da subito i tocchi vanno alla plancia, che sotto c'e' gia'. */
    o.style.pointerEvents = "none";
    var inizio = null;
    var passo = function (quando) {
      if (inizio === null) inizio = quando;
      var p = M.min(1, (quando - inizio) / DURA);
      uscita(p);
      if (p < 1) W.requestAnimationFrame(passo);
      else fine();
    };
    W.requestAnimationFrame(passo);
    /* In una scheda nascosta i fotogrammi non arrivano: il velo se ne va
     * lo stesso. */
    W.setTimeout(fine, DURA + 900);
    return true;
  }

  W.__gdahomeVelo = {
    via: via,
    disegna: disegna,
    uscita: uscita,
    ferma: function () {
      fermato = true;
    },
  };
})();
