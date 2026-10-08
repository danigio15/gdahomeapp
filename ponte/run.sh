#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

# Le opzioni le legge il ponte da solo, da `/data/options.json`. Qui si passa
# soltanto quello che nel file non c'e': dove sta Home Assistant e con che
# segno bussarci.
export PONTE_ARCHIVIO="/data"
export PONTE_CONSOLE="/app/console"

# Qui c'era una domanda al Supervisor: «c'e' un broker MQTT in casa?». Serviva a
# Zigbee2MQTT, quando ancora non c'era.
#
# Il guaio e' che quella domanda il Supervisor la lascia fare solo a chi
# dichiara il servizio nel manifesto — `services: [mqtt:want]` — e il ponte non
# lo dichiara. `hassio_api: true` invece il manifesto ce l'ha (serve alle
# domande in sola lettura, `/network/info` e le altre `…/info`), ma per i
# servizi non basta: il Supervisor risponde di no e bashio stampa «ERROR:
# Unable to access the API, forbidden» a ogni avvio. Un add-on che al primo
# accendersi scrive ERROR e' un add-on che sembra rotto, e chi lo installa non
# ha modo di sapere che quell'errore non conta niente.
#
# Quindi via, e non e' tornata: Zigbee2MQTT adesso il ponte lo comanda
# passando da Home Assistant, col servizio `mqtt.publish` (`src/zigbee.js`),
# e un broker suo non gli serve. Se un giorno servisse, il permesso si dichiara
# come si deve nel manifesto, invece di chiederlo di nascosto e sentirsi dire
# di no.

bashio::log.info "Il ponte si alza."
exec node /app/src/index.js
