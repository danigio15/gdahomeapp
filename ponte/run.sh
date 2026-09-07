#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

# Le opzioni le legge il ponte da solo, da `/data/options.json`. Qui si passa
# soltanto quello che nel file non c'e': dove sta Home Assistant e con che
# segno bussarci.
export PONTE_ARCHIVIO="/data"
export PONTE_CONSOLE="/app/console"

if bashio::services.available "mqtt"; then
  # Se in casa c'e' gia' un broker MQTT configurato, il ponte lo sapra' — serve
  # a Zigbee2MQTT, quando arrivera' il suo turno.
  PONTE_MQTT_HOST="$(bashio::services mqtt "host")"
  PONTE_MQTT_PORTA="$(bashio::services mqtt "port")"
  PONTE_MQTT_UTENTE="$(bashio::services mqtt "username")"
  PONTE_MQTT_PAROLA="$(bashio::services mqtt "password")"
  export PONTE_MQTT_HOST PONTE_MQTT_PORTA PONTE_MQTT_UTENTE PONTE_MQTT_PAROLA
fi

bashio::log.info "Il ponte si alza."
exec node /app/src/index.js
