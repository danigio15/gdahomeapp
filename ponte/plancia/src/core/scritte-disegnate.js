/* Le scritte di un PDF che non ha testo: le lettere disegnate, lette.
 *
 * Un PDF passato da una stampante virtuale (o «salvato come PDF» da un altro
 * programma) spesso non ha piu' testo: ogni lettera e' diventata una piccola
 * figura piena, a volte spezzata in due o tre pezzi. Si vede uguale, ma
 * «CAMERA 1 14,72 mq» e «scala 1:50» non si leggono piu', e con loro i nomi
 * delle stanze, le aree e la scala.
 *
 * Qui le figure si rimettono insieme e si leggono, alla buona: le lettere di
 * un disegno tecnico sono quasi sempre un bastone senza grazie (Arial,
 * Helvetica e simili), e ogni lettera si confronta coi modelli di un
 * bastone senza grazie (Liberation Sans, SIL OFL 1.1: solo le figurine
 * ridotte a 10 x 14 qui sotto), con la sua forma, le sue proporzioni e dove
 * sta rispetto alla riga. Si tengono solo le parole lette con sicurezza.
 * Funzioni pure, senza browser: si provano in Node.
 */

const GW = 10,
  GH = 14;

/* carattere, larghezza/altezza, altezza (in maiuscole), cima (sotto la cima
 * delle maiuscole, in maiuscole), e la figura: 10 x 14 grigi da 0 a 9 */
const MODELLI =
  `0 0.678 1.029 -0.015 00479974000597447950297000079259300003957910000197880000008898000000899800000089880000008879100001975930000395197000079104974479400037997300
1 0.629 1.0 0.0 00059910000389991000496189100043008910000000891000000089100000008910000000891000000089100000008910000000891000000089100055559955559999999999
2 0.656 1.015 -0.015 01589985101897447981595000069557100003960000000396000000079200000069500000179500000289300000498200000497100000297000000089644444449999999999
3 0.671 1.029 -0.015 00489985100797447980495000069446100003950000000494000000388100048995100003668850000000059500000000986700000099694000039718974469920158998610
4 0.735 1.0 0.0 00000199100000079910000049791000019559100007805910003920591001850059100681005910393000591088555579657777778987000000591000000059100000005910
5 0.681 1.015 0.0 19999999912974444441295000000039400000003940000000495689851059964579812420000596000000019800000000993400000198793000069528964479700168997400
6 0.654 1.029 -0.015 00268985100398546981188100058349400000006910000000891589861098763369819950000496891000019879100000995930000198198100059504984469810037998510
7 0.665 1.0 0.0 99999999995555555598000000059200000039500000008800000005930000001970000000592000000198000000049500000006920000000890000000198000000029700000
8 0.668 1.029 -0.015 01589985101895335980495000059469200003954940000494188300388001799996101795335971693000039689000000989900000098693000039628953359810158998510
9 0.657 1.029 -0.015 01589973001897448950595000079289100003959900000197891000019869400005991895236889027999619800011001960000000494494000188018964589200168986200
A 0.967 1.0 0.0 00008900000002993000000576500000075480000019219200004800840000660057000093003910039655693006988889600840000480292000019258000000857600000058
B 0.778 1.0 0.0 99999974009855558960970000079197000005929700000691970001495099999995009844446971970000029697000000799700000089970000029798555569929999998610
C 0.898 1.029 -0.015 00269985000398557970187100039549200000647700000000850000000095000000009500000000860000000068000000104930000067188100039402996579600026898400
D 0.865 1.0 0.0 99999751009755579820950000288095000003949500000087950000006895000000599500000069950000007895000000969500000493950000397097555798109999985100
E 0.793 1.0 0.0 99999999969855555553970000000097000000009700000000970000000099888888819855555550970000000097000000009700000000970000000098555555559999999999
F 0.716 1.0 0.0 99999999999955555555980000000098000000009800000000980000000099222222229999999997993333333298000000009800000000980000000098000000009800000000
G 0.926 1.029 -0.015 00279985100398557970197000039449100000427700000000850000000094000000009400049999850002556977000000394920000039187100017803985569820026898510
H 0.818 1.0 0.0 96000000699600000069960000006996000000699600000069971111116999999999999844444489960000006996000000699600000069960000006996000000699600000069
I 0.142 1.0 0.0 79999999977999999997799999999779999999977999999997799999999779999999977999999997799999999779999999977999999997799999999779999999977999999997
J 0.591 1.015 0.0 00004999990000255699000000039900000003990000000399000000039900000003990000000399000000039900000003996730000398597100079518985589810158998510
K 0.84 1.0 0.0 96000018709600007810960006920096004930009603950000961860000096895000009976920000971088100096002960009600049400960000792096000019809600000395
L 0.647 1.0 0.0 99100000009910000000991000000099100000009910000000991000000099100000009910000000991000000099100000009910000000991000000099655555559999999999
M 0.978 1.0 0.0 99000000899920000299985000048996800007699491001949928400382992560055299238008329920921912992075470299204764029920198202992008800299200560029
N 0.818 1.0 0.0 99200000599970000059979300005994780000599529400059950681005995019500599500591059950019605995000592599500008749950000497995000008999500000399
O 0.968 1.029 -0.015 00279973000398558940196000069149100001947600000067850000004894000000499400000049850000004867000000674910000194187000068103985589300027997200
P 0.778 1.0 0.0 99999986209855556992970000039697000000889700000079970000008797000016949999999950985555420097000000009700000000970000000097000000009700000000
Q 0.772 1.291 -0.015 00479974000695224960392000029367000000678400000048940000004984000000497600000067392000019407831138700058998500000039100000000872100000027960
R 0.869 1.0 0.0 99999985109755557970950000049395000001949500000194950000049397333359709999999610962226810095000195009500006910950000196095000005929500000196
S 0.816 1.029 -0.015 00589986100796445981294000039449100000313940000000089630000001799974000002479981000000049600000000795500000069692000018718964458920158998610
T 0.829 1.0 0.0 99999999995555885555000077000000007700000000770000000077000000007700000000770000000077000000007700000000770000000077000000007700000000770000
U 0.821 1.015 0.0 96000000699600000069960000006996000000699600000069960000006996000000699600000069960000006987000000787800000096395000069306975589600047997400
V 0.96 1.0 0.0 76000000685800000085292000029208500005800570000760039100193000940039000066006700003900840000193291000007557000000477500000029920000000880000
W 1.367 1.0 0.0 81005500187200660027540077004545007700543601661063180355308109044440800715335170063611636005480084500357007530027600672001950059100084004800
X 0.909 1.0 0.0 49200002930770000770029300392000680086000019449100000598500000008910000002993000000766800000491194000185005810058100185019400004916800000086
Y 0.909 1.0 0.0 68000000872940000492068000086002940049200068008600001944910000058860000001991000000077000000007700000000770000000077000000007700000000770000
Z 0.8 1.0 0.0 39999999952555555794000000187000000069100000039400000019700000007810000004930000002960000000781000000593000000296000000089555555559999999999
a 0.941 0.796 0.218 01589850000798789600396000792037200039300000002940001344694006999999404973113940891000394097000049409700007940791005795049868819960599710487
b 0.616 1.069 -0.055 89000000008900000000890000000089013431008938889950898200189389400003968910000198891000019989100001998920000297895000059589763259817715899610
c 0.79 0.796 0.218 00279984000499879970199200189459500003977930000011892000000099100000009910000000892000000079300000335960000397199300189404998799700027998400
d 0.616 1.069 -0.055 00000000980000000098000000009800134310980499888398298100289869300003988910000198991000009889100001987920000298595000069818953367980269985177
e 0.858 0.796 0.218 00379973000499669940198100189159400004957910000197892222229899999999999944444444890000000079100000005940000152198200069404997689700037998400
f 0.37 1.051 -0.051 00015899980008997433001999200022399932228999999999002999100000199910000019991000001999100000199910000019991000001999100000199910000019991000
g 0.607 1.084 0.218 01689850771895236798595000069879200002988910000098991000009889100002986940000598298301579803899961980001210198254000039618953359810158998610
h 0.586 1.055 -0.055 99100000009910000000991000000099102332009927989981998400169699400002989910000199991000019999100001999910000199991000019999100001999910000199
i 0.124 1.055 -0.055 79999999994666666665000000000012222222227999999999799999999979999999997999999999799999999979999999997999999999799999999979999999997999999999
j 0.193 1.356 -0.055 00000899990000022222000000000000000899990000089999000008999900000899990000089999000008999900000899990000089999000008999910114999978999998640
k 0.603 1.055 -0.055 99100000009910000000991000000099100001219910003971991004971099105960009915950000996991000099859810009910497100991005970099100069609910000795
l 0.128 1.055 -0.055 79999999977999999997799999999779999999977999999997799999999779999999977999999997799999999779999999977999999997799999999779999999977999999997
m 1.307 0.782 0.218 62696039819588938795981088305895006800399400570029930056002993005600299300560029930056002993005600299300560029930056002993005600299300560029
n 0.795 0.782 0.218 67027997308929878992898400069689600002988930000199892000019989100001998910000199891000019989100001998910000199891000019989100001998910000199
o 0.868 0.796 0.218 00379974000499668950198100189259400004957920000197891000009899000000999900000099891000009879200002975940000495198100189104996699400037997300
p 0.607 1.084 0.218 77158996208976335991896000059589200002988910000199891000019989100001988940000496898300289289289998308900232000890000000089000000008900000000
q 0.607 1.084 0.218 01689851881895225798595000059879200002988910000098991000009889200001986940000498298300389804999982980002320098000000009800000000980000000098
r 0.47 0.782 0.218 67720379988994499999899697311179996000007999100000799700000079960000007996000000799600000079960000007996000000799600000079960000007996000000
s 0.799 0.796 0.218 00589985100798768981397000059549400001424970000000199842000002899985100003689981000000279600000001985600000099695000049618987789820158998510
t 0.395 0.949 0.062 00069700000019970000446998444388999988850069970000006997000000699700000069970000006997000000699700000069970000006998000000399975550004799987
u 0.795 0.782 0.233 99100001989910000198991000019899100001989910000198991000019899100001989910000198991000019889100003988930000698697000489829987892990379972066
v 0.938 0.767 0.233 89100001985930000395395000059209700007900791001960049300394002950069100088008800006911950000393492000019569000000778600000059940000002991000
w 1.379 0.767 0.233 82006600287400880037650088005646017710643702662073280455308209054451900826336280073722737005480184500468008640038700783002960069100095005900
x 0.91 0.767 0.233 59400005941881001980049400593000881197000039559200000789600000029920000004994000001888800000593395000197008910069300395029700007926920000396
y 0.677 1.069 0.233 79100001973940000493088000078005930029500196005910006910870000294293000008768000000499500000009910000001960000000592000013695000003985000000
z 0.782 0.767 0.233 59999999964777777996000000399200000189500000069700000039910000018940000007970000004981000001993000000796000000498100000099877777779999999999
. 0.907 0.156 0.844 89999999988999999998899999999889999999988999999998899999999889999999988999999998899999999889999999988999999998899999999889999999988999999998
, 0.426 0.342 0.844 79999999977999999997799999999779999999977999999997799999999734446999970000599995000079999400029999910007999960005999981004999993004999994000
: 0.185 0.767 0.233 89999999988999999998566666666500000000000000000000000000000000000000000000000000000000000000000000000000000000566666666589999999988999999998`
    .split("\n")
    .map((r) => {
      const [c, a, h, t, g] = r.split(" ");
      return { c, a: Number(a), h: Number(h), t: Number(t), g: Uint8Array.from(g, Number) };
    });

const CIFRE = new Set("0123456789");

/**
 * Per le prove: una lettera del modello come quadratini pieni, in un
 * quadrato 0..1 (x verso destra, y verso il basso), con le sue proporzioni:
 * `{ quadratini: [[x0, y0, x1, y1]], a, h, t }`. Disegnata cosi', la lettera
 * deve tornare indietro letta.
 */
export function letteraDelModello(c) {
  const m = MODELLI.find((q) => q.c === c);
  if (!m) return null;
  const quadratini = [];
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++)
      if (m.g[y * GW + x] >= 5) quadratini.push([x / GW, y / GH, (x + 1) / GW, (y + 1) / GH]);
  return { quadratini, a: m.a, h: m.h, t: m.t };
}

function riquadroDi(poligoni) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of poligoni)
    for (const [x, y] of p) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  return { x0, y0, x1, y1 };
}

/* I poligoni (pari e dispari, come li riempie il PDF) campionati su una
 * griglia di nx x ny punti dentro il riquadro r: 1 dentro, 0 fuori. Una
 * riga alla volta: si trovano dove la riga taglia i lati, e fra un taglio e
 * l'altro si e' dentro o fuori. */
function campiona(poligoni, r, nx, ny) {
  const out = new Uint8Array(nx * ny);
  const lati = [];
  for (const p of poligoni)
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      if (a[1] !== b[1]) lati.push(a[0], a[1], b[0], b[1]);
    }
  const w = r.x1 - r.x0,
    h = r.y1 - r.y0,
    tagli = [];
  for (let gy = 0; gy < ny; gy++) {
    const y = r.y0 + ((gy + 0.5) / ny) * h;
    tagli.length = 0;
    for (let k = 0; k < lati.length; k += 4) {
      const y0 = lati[k + 1],
        y1 = lati[k + 3];
      if (y0 > y !== y1 > y) tagli.push(lati[k] + ((y - y0) / (y1 - y0)) * (lati[k + 2] - lati[k]));
    }
    if (!tagli.length) continue;
    tagli.sort((p, q) => p - q);
    let t = 0;
    for (let gx = 0; gx < nx; gx++) {
      const x = r.x0 + ((gx + 0.5) / nx) * w;
      while (t < tagli.length && tagli[t] <= x) t++;
      if (t & 1) out[gy * nx + gx] = 1;
    }
  }
  return out;
}

/* La figura di una lettera: 10 x 14 caselle, otto per otto campioni l'una,
 * col grigio da 0 a 9. */
function figura(poligoni, r) {
  const S = 8,
    c = campiona(poligoni, r, GW * S, GH * S),
    out = new Uint8Array(GW * GH);
  for (let y = 0; y < GH * S; y++)
    for (let x = 0; x < GW * S; x++)
      if (c[y * GW * S + x]) out[((y / S) | 0) * GW + ((x / S) | 0)]++;
  for (let i = 0; i < out.length; i++) out[i] = Math.round((out[i] / (S * S)) * 9);
  return out;
}

/* La lettera che somiglia di piu', col suo scarto (0 = identica). */
function leggiLettera(g, a, h, t) {
  let meglio = null;
  for (const m of MODELLI) {
    let d = 0;
    for (let i = 0; i < GW * GH; i++) d += Math.abs(g[i] - m.g[i]);
    d /= GW * GH * 9;
    /* le proporzioni contano: una «l» e una «I» sono la stessa figura */
    d += 0.25 * Math.abs(Math.log((a + 0.05) / (m.a + 0.05)));
    d += 0.35 * Math.abs(h - m.h) + 0.35 * Math.abs(t - m.t);
    if (!meglio || d < meglio.d) meglio = { c: m.c, d };
  }
  return meglio;
}

/* Quanto inchiostro c'e' in ogni colonna di una lettera (n colonne). */
function colonne(poligoni, r, n) {
  const c = campiona(poligoni, r, n, 24),
    out = new Float64Array(n);
  for (let y = 0; y < 24; y++) for (let x = 0; x < n; x++) out[x] += c[y * n + x];
  return out;
}

/* Una lettera, o due che si toccano («RA» stretti stretti diventano una
 * «W»): se e' larga si prova a tagliarla dove c'e' meno inchiostro, e si
 * tiene il taglio se le due meta' si leggono meglio. */
function leggiForse(q, capH, cima) {
  const intera = (r) => {
    const w = r.x1 - r.x0,
      h = r.y1 - r.y0;
    return leggiLettera(
      figura(q.poligoni, r),
      w / Math.max(h, 1e-6),
      h / capH,
      (r.y0 - cima) / capH,
    );
  };
  const tutta = intera(q.r);
  const w = q.r.x1 - q.r.x0,
    h = q.r.y1 - q.r.y0;
  if (w < 0.95 * h || h < 0.6 * capH) return tutta;
  const n = 40,
    col = colonne(q.poligoni, q.r, n);
  let meglio = null;
  for (let k = Math.round(n * 0.3); k <= Math.round(n * 0.7); k++)
    if (!meglio || col[k] < col[meglio]) meglio = k;
  const xm = q.r.x0 + ((meglio + 0.5) / n) * w;
  const L = { ...q.r, x1: xm },
    R = { ...q.r, x0: xm };
  /* le meta' si stringono sul loro inchiostro */
  const stringi = (r) => {
    const c = colonne(q.poligoni, r, 20);
    let a = 0,
      b = 19;
    while (a < 19 && !c[a]) a++;
    while (b > 0 && !c[b]) b--;
    const dx = (r.x1 - r.x0) / 20;
    return { ...r, x0: r.x0 + a * dx, x1: r.x0 + (b + 1) * dx };
  };
  const a = intera(stringi(L)),
    b = intera(stringi(R));
  if ((a.d + b.d) / 2 + 0.04 < tutta.d) return { c: a.c + b.c, d: (a.d + b.d) / 2 };
  return tutta;
}

/**
 * Le scritte lette dalle lettere disegnate.
 *
 * `pezzi`: le figure piene che sono lettere, `[{ poligoni, percorso }]` in
 * punti della pagina (y verso il basso); i pezzi dello stesso percorso sono
 * la stessa figura. Torna `[{ t, x, y, h, sicurezza }]` come il testo di un
 * PDF: una voce per parola o per gruppo di parole sulla stessa riga, con `x`
 * a sinistra, `w` la larghezza, `y` sulla riga di base e `h` l'altezza delle
 * maiuscole; `sicurezza` (da 0 a 1) dice quanto le lettere somigliano ai
 * modelli.
 */
export function leggiLeScritte(pezzi) {
  /* 1. le figure: i pezzi dello stesso percorso insieme */
  const perPercorso = new Map();
  for (const p of pezzi || []) {
    const k = p.percorso ?? perPercorso.size;
    if (!perPercorso.has(k)) perPercorso.set(k, []);
    perPercorso.get(k).push(p.poligoni || [p.punti]);
  }
  let figure = [...perPercorso.values()].map((l) => {
    const poligoni = l.flat();
    return { poligoni, r: riquadroDi(poligoni) };
  });
  /* 2. le lettere: le figure che si toccano (una «N» spezzata in tre) e
   *    quelle una sopra l'altra (i due punti, il puntino della «i») */
  const padre = figure.map((_, i) => i);
  const radice = (i) => (padre[i] === i ? i : (padre[i] = radice(padre[i])));
  const ordine = figure.map((_, i) => i).sort((a, b) => figure[a].r.x0 - figure[b].r.x0);
  for (let q = 0; q < ordine.length; q++) {
    const A = figure[ordine[q]].r;
    for (let k = q + 1; k < ordine.length; k++) {
      const B = figure[ordine[k]].r;
      if (B.x0 > A.x1 + 0.3) break;
      const hA = A.y1 - A.y0,
        hB = B.y1 - B.y0;
      const toccano = B.x0 <= A.x1 + 0.15 && A.y0 <= B.y1 + 0.15 && B.y0 <= A.y1 + 0.15;
      const inColonna =
        Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) >= 0.5 * Math.min(A.x1 - A.x0, B.x1 - B.x0);
      const buco = Math.max(A.y0, B.y0) - Math.min(A.y1, B.y1);
      const sopra =
        inColonna && buco <= 0.6 * Math.max(hA, hB) && Math.min(hA, hB) <= 0.45 * Math.max(hA, hB);
      if (toccano || sopra) {
        const a = radice(ordine[q]),
          b = radice(ordine[k]);
        if (a !== b) padre[a] = b;
      }
    }
  }
  const gruppi = new Map();
  figure.forEach((f, i) => {
    const r = radice(i);
    if (!gruppi.has(r)) gruppi.set(r, []);
    gruppi.get(r).push(f);
  });
  const lettere = [...gruppi.values()].map((l) => {
    const poligoni = l.flatMap((f) => f.poligoni);
    return { poligoni, r: riquadroDi(poligoni) };
  });
  /* 3. le righe: lettere vicine sulla stessa riga di base */
  lettere.sort((a, b) => a.r.x0 - b.r.x0);
  const riga = lettere.map((_, i) => i);
  const capo = (i) => (riga[i] === i ? i : (riga[i] = capo(riga[i])));
  for (let q = 0; q < lettere.length; q++) {
    const A = lettere[q].r,
      hA = A.y1 - A.y0;
    for (let k = q + 1; k < lettere.length; k++) {
      const B = lettere[k].r,
        hB = B.y1 - B.y0,
        h = Math.max(hA, hB);
      if (B.x0 > A.x1 + h) break;
      const sovrapposte = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
      if (sovrapposte < 0.3 * Math.min(hA, hB) && Math.abs(A.y1 - B.y1) > 0.25 * h) continue;
      if (hA > hB * 3.5 || hB > hA * 3.5) {
        /* un punto, una virgola: sulla riga di base, accanto */
        if (
          Math.abs(A.y1 - B.y1) > 0.35 * h &&
          Math.abs(Math.min(A.y1, B.y1) - Math.max(A.y1, B.y1)) > 0.35 * h
        )
          continue;
      }
      const a = capo(q),
        b = capo(k);
      if (a !== b) riga[a] = b;
    }
  }
  const righe = new Map();
  lettere.forEach((l, i) => {
    const r = capo(i);
    if (!righe.has(r)) righe.set(r, []);
    righe.get(r).push(l);
  });
  const out = [];
  for (const tutte of righe.values()) {
    tutte.sort((a, b) => a.r.x0 - b.r.x0);
    /* l'altezza delle maiuscole e la riga di base: le lettere piu' alte */
    const alte = tutte.map((q) => q.r.y1 - q.r.y0).sort((a, b) => b - a);
    const capH = alte[Math.min(alte.length - 1, Math.floor(alte.length * 0.3))];
    if (!(capH > 0)) continue;
    /* i due punti: due puntini uno sopra l'altro, nella stessa riga */
    const l = [];
    for (const q of tutte) {
      const p = l[l.length - 1];
      const piccolo = (r) => r.y1 - r.y0 <= 0.3 * capH && r.x1 - r.x0 <= 0.4 * capH;
      if (
        p &&
        piccolo(p.r) &&
        piccolo(q.r) &&
        Math.min(p.r.x1, q.r.x1) - Math.max(p.r.x0, q.r.x0) >=
          0.5 * Math.min(p.r.x1 - p.r.x0, q.r.x1 - q.r.x0)
      ) {
        p.poligoni = [...p.poligoni, ...q.poligoni];
        p.r = riquadroDi(p.poligoni);
      } else l.push({ ...q });
    }
    const basi = l
      .filter((q) => q.r.y1 - q.r.y0 >= capH * 0.6)
      .map((q) => q.r.y1)
      .sort((a, b) => a - b);
    const base = basi.length ? basi[basi.length >> 1] : l[0].r.y1;
    const cima = base - capH;
    let testo = "",
      scarti = 0,
      dopo = null;
    for (const q of l) {
      const w = q.r.x1 - q.r.x0,
        h = q.r.y1 - q.r.y0;
      if (dopo !== null && q.r.x0 - dopo > capH * 0.32) testo += " ";
      dopo = q.r.x1;
      void w;
      void h;
      const letta = leggiForse(q, capH, cima);
      testo += letta.c;
      scarti += letta.d;
    }
    const n = l.length;
    out.push({
      t: aggiusta(testo),
      x: l[0].r.x0,
      w: l[l.length - 1].r.x1 - l[0].r.x0,
      y: base,
      h: capH,
      sicurezza: Math.max(0, 1 - (scarti / n) * 2.5),
    });
  }
  return out;
}

/* Le lettere che si confondono, rimesse a posto dalle vicine: in un numero
 * la «O» e' uno zero e la «l» un uno; in una parola, il contrario. */
function aggiusta(testo) {
  return (
    testo
      .split(" ")
      .map((p) => {
        const cifre = [...p].filter((c) => CIFRE.has(c)).length;
        const lettereN = [...p].filter((c) => /[a-z]/i.test(c)).length;
        if (cifre && cifre >= lettereN)
          return p
            .replace(/[OoDQ]/g, "0")
            .replace(/[IlLiJj|]/g, "1")
            .replace(/[Ss]/g, "5")
            .replace(/[Zz]/g, "2")
            .replace(/B/g, "8");
        if (lettereN > cifre)
          return p
            .replace(/(?<=[A-Za-z])0|0(?=[A-Za-z])/g, "O")
            .replace(/(?<=[A-Z])1|1(?=[A-Z]{2})/g, "I")
            .replace(/(?<=[a-z])I|I(?=[a-z])/g, "l");
        return p;
      })
      .join(" ")
      /* la cifra stretta (l'uno) lascia un buco prima del punto: «1 .55» */
      .replace(/(\d) (?=[.,:]\d)/g, "$1")
      .replace(/(?<=\d[.,:]) (?=\d)/g, "")
      /* un uno da solo dopo una parola: «CAMERA J»; prima di un numero:
       * «J 6,22» */
      .replace(/(?<=[A-Za-z]{3,} )[JIl](?= |$)/g, "1")
      .replace(/(^| )[JIl] (?=[\d,.])/g, "$11")
      .replace(/(?<=\d) (?=[,.]\d)/g, "")
  );
}
