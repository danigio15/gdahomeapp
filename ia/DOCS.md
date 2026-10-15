# gdahome AI

L'intelligenza dell'assistente di gdahome, dentro casa: Ollama con un modello
linguistico piccolo, sulla stessa macchina di Home Assistant.

## Cosa fa

L'assistente di gdahome riconosce già da solo molte cose: dal nome (la luce
dell'acquario, la notturna, quelle del giardino), dalle sezioni della plancia
e dalle abitudini delle ultime due settimane. Con questo add-on acceso, una
volta al giorno chiede al modello le cose che non ha riconosciuto — «Mensola
blu» è l'acquario? «Presa 3» è il frigo del garage? — e da lì in poi non
propone più di spegnerle.

Al modello si mandano **solo nomi di luci, prese e porte, e le loro stanze**.
Mai persone, posizioni, telecamere o codici. E non esce niente di casa: il
modello gira qui.

## Cosa serve

- Home Assistant a 64 bit (aarch64 o amd64);
- almeno 4 GB di RAM, meglio 8;
- circa 3 GB di spazio, fra Ollama e il modello.

La prima volta l'add-on scarica il modello: qualche minuto. Il registro dice
«gdahome AI pronto» quando ha finito.

## L'assistente vocale di Home Assistant

Lo stesso Ollama si può usare anche per l'assistente vocale di Home Assistant:
Impostazioni → Dispositivi e servizi → Aggiungi → **Ollama**, con l'indirizzo
`http://<nome di questo add-on>:11434` (il nome si legge nella pagina
dell'add-on, alla voce «Hostname»). La plancia di gdahome lo riconosce da sola.
