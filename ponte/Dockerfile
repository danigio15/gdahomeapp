ARG BUILD_FROM
FROM ${BUILD_FROM}

# Node e basta. Il ponte non ha dipendenze npm — la presa WebSocket e' scritta
# qui dentro — quindi non c'e' nessun `npm install` da fare, e niente che possa
# cambiare sotto ai piedi fra una versione e l'altra.
RUN apk add --no-cache nodejs

WORKDIR /app
COPY src/ /app/src/
COPY package.json /app/
COPY console/ /app/console/
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
