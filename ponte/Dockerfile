ARG BUILD_FROM
FROM ${BUILD_FROM}

# Node e basta. Il ponte non ha dipendenze npm — la presa WebSocket e' scritta
# qui dentro — quindi non c'e' nessun `npm install` da fare, e niente che possa
# cambiare sotto ai piedi fra una versione e l'altra.
RUN apk add --no-cache nodejs

WORKDIR /app
COPY src/ /app/src/
COPY package.json /app/
# Il manifesto viene dentro anche lui: e' l'unico posto dove sta scritta la
# versione del ponte, e il ponte la deve sapere — per metterla in fondo a una
# segnalazione, e per capire se quella pubblicata e' piu' nuova di quella che
# sta girando. Senza questa riga `versioneDelPonte()` dentro l'add-on torna
# vuoto, e il confronto non si puo' nemmeno fare.
COPY config.yaml /app/
COPY console/ /app/console/
# La cartina: il file che il ponte copia nella `www` di Home Assistant perche'
# la voce nella barra laterale sappia aprire la plancia.
#
# Questa riga mancava, e il difetto che ne veniva fuori e' il piu' cattivo di
# tutti: l'add-on parte, dice tutto a posto, la voce nella barra laterale c'e',
# e aprendola esce «Errore di configurazione» e niente altro — perche' il file
# che la Plancia chiede non e' mai stato scritto, e il motivo Home Assistant lo
# mostra solo dentro l'editor delle tessere. Tre giri di ipotesi, e la risposta
# stava nel registro dell'add-on: `ENOENT: copyfile '/app/carta/plancia.js'`.
COPY carta/ /app/carta/
# Il marchio: il logo e il velo d'avvio di gdahome, che si mettono alla plancia
# al momento di servirla (`src/marchio.js`).
#
# Anche questa mancava, e non lo diceva nessuno: senza quei due file il
# vestito non si mette e la plancia si vede col nome e col logo di prima. Un
# marchio che manca non solleva niente — e' scritto apposta cosi', perche' una
# plancia vestita male vale infinitamente piu' di una plancia che non si apre —
# e quindi passava intero.
COPY marchio/ /app/marchio/
# La plancia di DashboardModern, com'e': la serve il ponte al telefono, e
# in Home Assistant non serve nessuna integrazione. La porta dentro
# `strumenti/porta-la-plancia.mjs`.
COPY plancia/ /app/plancia/
# gdahome da aprire in un browser: la stessa app del telefono, costruita da
# `flutter build web` e portata dentro da `strumenti/porta-l-app.mjs`. Il ponte
# la serve sotto `/app/`, dietro l'ingress — cioe' solo a chi e' gia' entrato
# in Home Assistant.
COPY app/ /app/app/
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
