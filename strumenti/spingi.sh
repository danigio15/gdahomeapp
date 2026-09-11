#!/usr/bin/env bash
#
# Spinge il commit appena fatto sul ramo, anche se nel frattempo il ramo si e'
# mosso.
#
# Le corse che salvano nella repository — l'app dentro l'add-on, la plancia
# nuova — impiegano qualche minuto a costruire, e in quei minuti sul ramo puo'
# arrivare un altro commit. Quando succede, `git push` si rifiuta: «Note about
# fast-forwards», e la corsa muore all'ultimo passo con la roba gia' costruita
# in mano. E' un lavoro buttato per una cosa che non e' rotta, e a chi guarda
# sembra che la costruzione sia andata male.
#
# Allora al rifiuto si riprende il ramo, ci si rimette sopra il proprio commit
# e si riprova. Il proprio commit vince sui file che tocca: sono file
# **costruiti**, e quello appena costruito e' l'ultimo — se due corse rifanno
# lo stesso pacchetto, la buona e' la piu' recente, non la piu' fortunata.
# (Nel rebase il proprio commit e' «theirs»: «ours» e' il ramo su cui ci si
# rimette. Va letto al contrario, ed e' la ragione di questo commento.)
#
# Uso:  strumenti/spingi.sh [ramo]
# Senza ramo, prende $GITHUB_REF_NAME, che e' quello su cui gira la corsa.
set -eu

ramo=${1:-${GITHUB_REF_NAME:-main}}
prove=4

for ((giro = 1; giro <= prove; giro++)); do
  if git push origin "HEAD:$ramo"; then
    echo "spinto su $ramo al giro $giro"
    exit 0
  fi

  if [ "$giro" -eq "$prove" ]; then
    break
  fi

  echo "il ramo $ramo si e' mosso: me lo riprendo e mi rimetto sopra"
  git fetch origin "$ramo"
  git rebase -X theirs FETCH_HEAD
done

echo "::error::non sono riuscito a spingere su $ramo dopo $prove giri"
exit 1
