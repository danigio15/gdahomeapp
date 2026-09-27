/* I watt e i wattora detti con l'unita' giusta.
 *
 * «Quando sono 1000 W devi poi esporli in kW; quando si arriva a 1000 kWh devi
 * mettere 1 MWh. Usa le unita' di misura corrette.»
 *
 * Nella pagina Energia le bolle dicevano «6011 W», «5251 W», «5095 W». Non e'
 * sbagliato — sono watt veri — ma non e' come si scrive: sopra il migliaio si
 * passa al multiplo, e un numero di quattro cifre lo si legge una cifra alla
 * volta mentre «6,01 kW» lo si legge in un colpo. E' la stessa ragione per cui
 * nessuno scrive 1500 metri quando puo' scrivere 1,5 km.
 *
 * Il salto e' a mille, sempre, in tutte e due le scale:
 *
 *     999 W → 999 W          999 kWh → 999 kWh
 *    1000 W → 1,00 kW       1000 kWh → 1,00 MWh
 *  1000 kW → 1,00 MW       1000 MWh → 1,00 GWh
 *
 * ── Quante cifre dopo la virgola ────────────────────────────────────────
 *
 * Tre cifre che contano, e basta: e' quello che l'occhio prende senza
 * rileggere, ed e' anche quello che non butta via niente di utile. Un impianto
 * da 6011 W scritto «6 kW» avrebbe perso undici watt per niente; scritto «6,011
 * kW» sarebbe un numero da contabile.
 *
 *    sotto 10   →  due decimali    6,01 kW
 *    sotto 100  →  un decimale    12,3 kW
 *    da 100 in su → intero       123 kW
 *
 * Sotto il migliaio ognuno tiene le sue: la bolla istantanea scrive i watt
 * interi, il consumo di un giorno scrive un decimale. Non e' una svista, sono
 * due grandezze diverse — «114 W» adesso e «12,3 kWh» oggi — e chi chiama sa
 * quale delle due sta scrivendo.
 *
 * ── Perche' qui e non in ogni schermata ─────────────────────────────────
 *
 * Perche' la regola e' una. Era scritta in quattro posti, ognuno con la sua
 * idea (due decimali di la', uno di qua, il taglio degli zeri in fondo in un
 * terzo), e le bolle — il posto piu' guardato di tutti — non ce l'avevano
 * affatto. Quattro copie di una regola divergono al primo ritocco.
 *
 * E' puro: nessun DOM, nessuno stato, nessun orologio. La lingua arriva da
 * fuori, perche' una finestra tedesca scrive «6.01 kW» e una italiana «6,01
 * kW», e indovinarla qui vorrebbe dire indovinarla male.
 */

/** La scala della potenza, dal watt in su. */
export const SCALA_POTENZA = Object.freeze(["W", "kW", "MW", "GW"]);

/** La scala dell'energia, dal wattora in su. */
export const SCALA_ENERGIA = Object.freeze(["Wh", "kWh", "MWh", "GWh"]);

/** Il salto: mille di questi fanno uno di quelli dopo. */
export const IL_SALTO = 1000;

/* `Number(null)` fa zero, e uno zero non e' un'assenza: la bolla di un
 * sensore che non c'e' scriverebbe «0 W», cioe' «non passa corrente», che e'
 * una notizia diversa da «non lo so». */
const numeroFinito = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/**
 * Il valore e l'unita' con cui si scrive, salendo la scala finche' serve.
 *
 * `da` e' l'unita' in cui arriva il numero: i watt di un sensore di potenza,
 * i kWh di un contatore. Un'unita' che la scala non conosce resta dov'e' — non
 * si inventa un multiplo di qualcosa che non si e' capito.
 *
 * Lo zero non sale mai: «0,00 kW» sarebbe un modo pomposo di dire che non
 * passa niente.
 */
export function inScala(valore, scala = SCALA_POTENZA, da = scala[0]) {
  const n = numeroFinito(valore);
  if (n === null) return null;
  const partenza = scala.indexOf(da);
  if (partenza < 0) return { valore: n, unita: da, passo: 0, saliti: 0 };
  let passo = partenza;
  let corrente = n;
  while (Math.abs(corrente) >= IL_SALTO && passo < scala.length - 1) {
    corrente /= IL_SALTO;
    passo += 1;
  }
  /* `saliti` e non `passo`: quanti gradini si sono fatti, non a che altezza
   * si e' arrivati. L'energia parte gia' dal secondo gradino — i contatori
   * parlano in kWh — e guardare l'altezza avrebbe detto «e' salita» a un
   * numero che non si e' mosso: 999,9 kWh usciva «1000 kWh», arrotondato coi
   * decimali di chi ha cambiato unita'. */
  return { valore: corrente, unita: scala[passo], passo, saliti: passo - partenza };
}

/**
 * Quanti decimali per un numero salito di scala: tre cifre che contano.
 *
 * Vale solo sopra il primo gradino. Sotto, i decimali li decide chi chiama —
 * sono due grandezze diverse e le scrive diverse.
 */
export function iDecimaliDellaScala(valore) {
  const assoluto = Math.abs(numeroFinito(valore) ?? 0);
  if (assoluto < 10) return 2;
  if (assoluto < 100) return 1;
  return 0;
}

/* Il numero scritto nella lingua di chi guarda. */
function scritto(valore, decimali, lingua) {
  return new Intl.NumberFormat(lingua, {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  }).format(valore);
}

/* Il numero come lo arrotonda CHI LO SCRIVE.
 *
 * `toFixed` e `Intl` non arrotondano uguale sui mezzi: 5095 W sono 5,095 kW,
 * che in binario sono un filo sotto, e `toFixed(2)` dice «5.09» mentre `Intl`
 * dice «5,10». Se il controllo del gradino usasse l'uno e la scritta l'altro,
 * i due potrebbero non essere d'accordo proprio sul migliaio — che e' l'unico
 * punto in cui conta. Si arrotonda con lo stesso attrezzo che poi scrive. */
function arrotondato(valore, decimali) {
  return Number(
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimali,
      maximumFractionDigits: decimali,
      useGrouping: false,
    }).format(valore),
  );
}

/**
 * Il numero con la sua unita', salito di scala quando serve.
 *
 * `decimaliBase` sono i decimali del primo gradino — quello in cui il numero
 * e' arrivato. Sopra, comandano le tre cifre che contano.
 */
/**
 * Il numero e l'unita', separati.
 *
 * Certe schermate il numero e l'unita' non li scrivono attaccati: la targhetta
 * dell'UPS e quella degli impianti termici mettono la cifra in grande e
 * l'unita' in piccolo accanto, in due nodi diversi. Chiedere loro di
 * ritagliare una stringa sarebbe chiedergli di sapere dove finisce un numero
 * scritto in una lingua che non e' la loro — «1.234,5 kWh» ha dentro un punto,
 * una virgola e uno spazio.
 */
export function laMisuraGiusta(
  valore,
  { scala = SCALA_POTENZA, da, lingua = "it-IT", decimaliBase = 0, vuoto = "—" } = {},
) {
  const n = numeroFinito(valore);
  if (n === null) return vuoto;
  const partenza = scala.indexOf(da ?? scala[0]);
  /* Un'unita' che la scala non conosce resta dov'e': non si inventa un
   * multiplo di qualcosa che non si e' capito. */
  if (partenza < 0) return { numero: scritto(n, decimaliBase, lingua), unita: da };
  let passo = partenza;
  let corrente = n;
  let decimali = decimaliBase;
  /* Si sale guardando il numero COME SI VEDRA', non come arriva.
   *
   * «Quando sono 1000 W devi poi esporli in kW»: 999,6 W scritti coi watt
   * interi diventano «1000 W», ed e' proprio la scritta che non si vuole
   * vedere. Si arrotonda prima, e se l'arrotondamento tocca il migliaio si
   * sale — e si riguarda, perche' la stessa cosa succede un gradino sopra
   * (999,6 kW arrotondati a intero sono 1000 kW, che sono 1,00 MW). */
  for (let giro = 0; giro < scala.length; giro += 1) {
    decimali = passo > partenza ? iDecimaliDellaScala(corrente) : decimaliBase;
    const tondo = arrotondato(corrente, decimali);
    if (Math.abs(tondo) < IL_SALTO || passo >= scala.length - 1) {
      corrente = tondo;
      break;
    }
    corrente /= IL_SALTO;
    passo += 1;
  }
  return { numero: scritto(corrente, decimali, lingua), unita: scala[passo] };
}

/** Il numero con la sua unita', attaccati: «6,01 kW». */
export function conLUnitaGiusta(valore, opzioni = {}) {
  const misura = laMisuraGiusta(valore, opzioni);
  if (typeof misura === "string") return misura;
  return `${misura.numero} ${misura.unita}`;
}

/**
 * I watt come si scrivono: «114 W», «6,01 kW», «1,23 MW».
 *
 * `decimali` sono quelli dei watt interi — di serie nessuno, che e' come si
 * legge una potenza istantanea: il watt e mezzo di una lampadina LED non
 * cambia niente a nessuno.
 */
export function laPotenzaInParole(watt, { lingua = "it-IT", decimali = 0, vuoto = "—" } = {}) {
  return conLUnitaGiusta(watt, {
    scala: SCALA_POTENZA,
    da: "W",
    lingua,
    decimaliBase: decimali,
    vuoto,
  });
}

/**
 * I chilowattora come si scrivono: «12,3 kWh», «1,23 MWh».
 *
 * Arrivano gia' in kWh — e' l'unita' in cui parlano i contatori e in cui la
 * plancia fa i conti — quindi si parte dal secondo gradino della scala, e da
 * li' si sale. Il wattora non si scende mai: nessuno vuole leggere «450 Wh» di
 * un consumo giornaliero, e «0,45 kWh» dice la stessa cosa nell'unita' in cui
 * e' scritta la bolletta.
 */
export function lEnergiaInParole(kWh, { lingua = "it-IT", decimali = 1, vuoto = "—" } = {}) {
  return conLUnitaGiusta(kWh, {
    scala: SCALA_ENERGIA,
    da: "kWh",
    lingua,
    decimaliBase: decimali,
    vuoto,
  });
}

/**
 * La misura per chi ha in mano solo un'unita' scritta, non una scala.
 *
 * Le targhette — l'UPS, gli impianti termici, le tessere che mettono una
 * misura sotto l'altra — ricevono l'unita' come testo, « W» o « kWh», perche'
 * gliela passa chi le compila. Qui si riconosce a quale delle due scale
 * appartiene e si sale; per tutto il resto — gradi, per cento, litri, bar —
 * torna `null`, e chi chiama continua a scrivere quello che scriveva.
 */
export function laMisuraDallUnita(valore, unita, { lingua = "it-IT", decimali = 0 } = {}) {
  const nome = String(unita ?? "").trim();
  const scala = SCALA_POTENZA.some((u) => u.toLowerCase() === nome.toLowerCase())
    ? SCALA_POTENZA
    : SCALA_ENERGIA.some((u) => u.toLowerCase() === nome.toLowerCase())
      ? SCALA_ENERGIA
      : null;
  if (!scala) return null;
  const da = scala.find((u) => u.toLowerCase() === nome.toLowerCase());
  const misura = laMisuraGiusta(valore, { scala, da, lingua, decimaliBase: decimali, vuoto: null });
  return typeof misura === "string" || !misura ? null : misura;
}
