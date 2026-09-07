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
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
