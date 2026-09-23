/* Chi si conta, quando si conta «per indirizzo». E' la stessa regola del
 * centralino sulla macchina, in `centralino/src/indirizzo.js`.
 *
 * In IPv4 un indirizzo e' un indirizzo. In IPv6 no: a una casa, a un telefono,
 * a una macchina a noleggio arriva di solito un /64 intero — diciotto
 * miliardi di miliardi di indirizzi — e chi ne cambia uno a ogni tentativo
 * non verrebbe mai contato due volte, e intanto riempirebbe i tetti di tutti.
 * Allora in IPv6 si conta la rete, i primi sessantaquattro bit. Un IPv4
 * scritto alla IPv6 (`::ffff:1.2.3.4`) e' un IPv4, e si conta come tale. */
export function reteDi(indirizzo) {
  let testo = String(indirizzo ?? "")
    .trim()
    .toLowerCase();
  if (!testo.includes(":")) return testo || "?";
  testo = testo.replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const mappato = /^[0:]*:ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(testo);
  if (mappato) return mappato[1];
  const [prima, dopo = ""] = testo.split("::");
  const davanti = prima ? prima.split(":") : [];
  const dietro = testo.includes("::") && dopo ? dopo.split(":") : [];
  const mancano = Math.max(0, 8 - davanti.length - dietro.length);
  const gruppi = testo.includes("::")
    ? [...davanti, ...Array(mancano).fill("0"), ...dietro]
    : davanti;
  const rete = gruppi
    .slice(0, 4)
    .map((uno) => (uno || "0").replace(/^0+(?=.)/, ""))
    .join(":");
  return `${rete}::/64`;
}
