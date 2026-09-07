#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

# Le opzioni le legge il ponte da solo, da `/data/options.json`. Qui si passa
# soltanto quello che nel file non c'e': dove sta Home Assistant e con che
# segno bussarci.
export PONTE_ARCHIVIO="/data"
export PONTE_CONSOLE="/app/console"

# Qui c'era una domanda al Supervisor: «c'e' un broker MQTT in casa?». Serviva a
# Zigbee2MQTT, che pero' non e' ancora arrivato.
#
# Il guaio e' che quella domanda vuole `hassio_api: true`, che il ponte non ha
# e non gli serve: senza, il Supervisor risponde di no e bashio stampa
# «ERROR: Unable to access the API, forbidden» a ogni avvio. Un add-on che al
# primo accendersi scrive ERROR e' un add-on che sembra rotto, e chi lo installa
# non ha modo di sapere che quell'errore non conta niente.
#
# Quindi via. Tornera' insieme a Zigbee2MQTT, e con il permesso dichiarato come
# si deve — `services: [mqtt:want]` nel manifesto — invece che chiesto di
# nascosto e negato.

bashio::log.info "Il ponte si alza."
exec node /app/src/index.js
