/* Il centralino si alza. */

import { Case } from "./case.js";
import { Centralino } from "./centralino.js";
import { apriIlRegistro } from "./registro.js";
import { costruisciIlServer } from "./server.js";
import { Sportello } from "./sportello.js";

const POTATURA = 12 * 60 * 60 * 1000;

export async function alzaIlCentralino({
  porta = Number(process.env.CENTRALINO_PORTA || 8099),
  cartella = process.env.CENTRALINO_DATI || "./dati",
  giorniDiSilenzio = Number(process.env.CENTRALINO_SILENZIO || 180),
  livello = process.env.CENTRALINO_REGISTRO || "info",
  /* Il gettone delle segnalazioni e la repository dove finiscono. Sono del
   * manutentore e restano **qui**: non stanno in nessun ponte e su nessun
   * telefono, e da qui vanno solo verso api.github.com. Senza, lo sportello
   * risponde lo stesso e dice che non e' configurato. */
  gettoneDiGitHub = process.env.GITHUB_SEGNALAZIONI || "",
  repoDiGitHub = process.env.GITHUB_REPO || "",
} = {}) {
  const registro = apriIlRegistro(livello);
  const case_ = new Case({ cartella, giorniDiSilenzio });
  const centralino = new Centralino({ case: case_, registro });
  const sportello = new Sportello({
    case: case_,
    cartella,
    gettone: gettoneDiGitHub,
    repo: repoDiGitHub,
  });
  const server = costruisciIlServer({ centralino, sportello });

  await new Promise((riuscito, fallito) => {
    server.once("error", fallito);
    server.listen(porta, "0.0.0.0", () => {
      server.removeListener("error", fallito);
      riuscito();
    });
  });

  registro.info(`il centralino ascolta sulla ${server.address().port}`);
  registro.info(`${case_.quante()} case conosciute`);
  registro.info(
    sportello.pronto
      ? `le segnalazioni finiscono su ${repoDiGitHub}`
      : "le segnalazioni sono spente: manca il gettone di GitHub o la repository",
  );

  const giro = setInterval(() => {
    const andate = case_.potatura();
    if (andate) registro.info(`${andate} case tolte perche' sparite da troppo tempo`);
  }, POTATURA);
  giro.unref?.();

  const abbassa = async () => {
    registro.info("il centralino si spegne");
    clearInterval(giro);
    centralino.chiudiTutto();
    await new Promise((ok) => server.close(ok));
  };

  return { centralino, case: case_, sportello, server, registro, abbassa };
}

if (
  process.argv[1] &&
  import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href
) {
  const acceso = await alzaIlCentralino();
  for (const segnale of ["SIGTERM", "SIGINT"]) {
    process.on(segnale, () => {
      acceso.abbassa().finally(() => process.exit(0));
    });
  }
}
