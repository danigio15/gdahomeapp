#!/usr/bin/env bash
# Lancia Gradle nel progetto Android dell'app (`app/android`), con l'orologio
# dentro: `strumenti/gradle-orologio.sh :orologio:assembleRelease`.
#
# Lo `gradlew` non sta nella repository — lo mette Flutter alla prima
# costruzione — e nemmeno il suo `.jar`. Se c'e' si usa quello; se no si
# scarica la stessa versione di Gradle scritta in gradle-wrapper.properties,
# cosi' non ce n'e' una seconda da tenere allineata.
set -euo pipefail
cd "$(dirname "$0")/../app/android"
export GDAHOME_OROLOGIO=si
[ -f local.properties ] || echo "flutter.sdk=${FLUTTER_ROOT:?serve FLUTTER_ROOT}" > local.properties
if [ -x ./gradlew ] && [ -f gradle/wrapper/gradle-wrapper.jar ]; then
  exec ./gradlew "$@"
fi
indirizzo=$(sed -n 's/^distributionUrl=//p' gradle/wrapper/gradle-wrapper.properties | sed 's/\\:/:/g; s/-all\.zip$/-bin.zip/')
nome=$(basename "$indirizzo" -bin.zip)
casa="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/$nome"
if [ ! -x "$casa/bin/gradle" ]; then
  curl -sSfL "$indirizzo" -o "$casa.zip"
  unzip -q -o "$casa.zip" -d "$(dirname "$casa")"
fi
exec "$casa/bin/gradle" "$@"
