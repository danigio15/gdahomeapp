ARG BUILD_FROM
FROM ${BUILD_FROM}

# L'immagine di Ollama ha gia' tutto: qui c'e' solo l'avvio, che legge il
# modello scelto nelle opzioni dell'add-on e lo scarica la prima volta.
COPY run.sh /run.sh
RUN chmod a+x /run.sh

ENTRYPOINT ["/run.sh"]
