#!/usr/bin/env bash
# Scarica Gradle prima della costruzione Android, con pazienza, e lo mette
# dove il wrapper lo cerca.
#
#     strumenti/gradle-in-anticipo.sh
#
# Il wrapper di Gradle prova a scaricare la sua distribuzione una volta sola,
# e se GitHub (dove `services.gradle.org` rimanda) risponde 504 la
# costruzione muore li', due minuti dopo, prima di aver compilato una riga.
# L'8 novembre e' successo per ore, a ondate: una corsa passava e la
# successiva no. Qui si scarica la stessa distribuzione scritta in
# `gradle-wrapper.properties`, con dieci tentativi distanziati, e la si posa
# nella cartella del wrapper (`~/.gradle/wrapper/dists/<nome>/<impronta>/`):
# trovandola, il wrapper non scarica piu' niente.
#
# Se non ce la fa nemmeno cosi', non ferma niente: il wrapper ci riprova da
# solo, come prima.
set -uo pipefail
cd "$(dirname "$0")/../app/android"

indirizzo=$(sed -n 's/^distributionUrl=//p' gradle/wrapper/gradle-wrapper.properties | sed 's/\\:/:/g')
[ -n "$indirizzo" ] || { echo "nessun distributionUrl"; exit 0; }
zip=$(basename "$indirizzo")
nome=${zip%.zip}

# L'impronta della cartella e' quella del wrapper (`PathAssembler`): l'MD5
# dell'indirizzo, scritto in base 36.
impronta=$(python3 -c '
import hashlib, sys
n = int(hashlib.md5(sys.argv[1].encode()).hexdigest(), 16)
cifre = "0123456789abcdefghijklmnopqrstuvwxyz"
s = ""
while n:
    n, r = divmod(n, 36)
    s = cifre[r] + s
print(s or "0")
' "$indirizzo")
cartella="${GRADLE_USER_HOME:-$HOME/.gradle}/wrapper/dists/$nome/$impronta"
mkdir -p "$cartella"

if [ -f "$cartella/$zip.ok" ] || [ -s "$cartella/$zip" ]; then
  echo "Gradle c'e' gia': $cartella"
  exit 0
fi

for tentativo in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsSL --connect-timeout 20 --max-time 300 "$indirizzo" -o "$cartella/$zip.part"; then
    if unzip -tq "$cartella/$zip.part" >/dev/null 2>&1; then
      mv "$cartella/$zip.part" "$cartella/$zip"
      echo "Gradle scaricato al tentativo $tentativo: $cartella/$zip"
      exit 0
    fi
  fi
  rm -f "$cartella/$zip.part"
  echo "Gradle non scaricato (tentativo $tentativo): riprovo fra $((tentativo * 15)) secondi"
  sleep $((tentativo * 15))
done
echo "::warning::Gradle non si e' scaricato in anticipo: ci prova il wrapper da solo."
exit 0
