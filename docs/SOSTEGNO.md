# Il sostegno

gdahome è gratis, e deve restare gratis. Questo documento è come si tiene in
piedi quella frase: cosa costa davvero il progetto, dove si può dare una mano,
e — la parte pratica — **come si attiva GitHub Sponsors**, passo per passo, coi
testi già scritti da incollare.

## Cosa costa, davvero

Poco, ed è il motivo per cui la promessa si può fare:

| cosa | quanto |
|---|---|
| Il centralino | **zero**: gira sul piano gratuito di Cloudflare, e una casa ferma di notte non consuma niente ([`nuvola/`](../nuvola/README.md)) |
| L'add-on e la plancia | **zero**: girano sulla macchina di chi li installa |
| **Google Play** | **25 $**, una volta sola |
| **L'account sviluppatore Apple** | **99 $ l'anno** — ed è l'unico pezzo che manca all'app per iPhone: l'app è scritta e compila, quello che manca è la firma ([`IPHONE.md`](IPHONE.md)) |
| Il tempo | quello che non si conta: scriverlo, provarlo, e rispondere a chi chiede aiuto |

Quindi un sostegno non serve a «finanziare un'azienda»: serve a pagare due
conti e a comprare il tempo di chi risponde.

## Dove si può dare, oggi

Le voci del tasto **Sponsor** sulla repository le decide
[`.github/FUNDING.yml`](../.github/FUNDING.yml), e l'ordine in cui stanno
scritte è l'ordine in cui compaiono:

| canale | quanto ne resta su 10 € | quando funziona |
|---|---|---|
| **GitHub Sponsors** | **~10 €** — GitHub non trattiene nulla e paga lui le commissioni d'incasso | dal giorno in cui l'account è iscritto |
| **PayPal** | ~9,3 € (circa 3,4% + 0,35 €) | da subito: è il conto che la plancia usa già |

Le percentuali sono ordini di grandezza e cambiano: quelle che valgono stanno
sulle pagine dei prezzi dei due servizi.

**Perché Sponsors sta per primo**: nel menu la gente preme la prima voce, o
quella che riconosce. Se trova PayPal usa PayPal — e lì si lascia per strada il
tre e mezzo per cento. Messo in fila così, chi vuole dare una mano trova per
prima la strada dove arriva tutto.

I tre video e le due copertine nominano **solo GitHub Sponsors**, ed è voluto:
in quarantasette secondi un invito solo si ricorda, tre si perdono.

## Attivare GitHub Sponsors

Si fa **a mano**, e non c'è modo di farlo altrimenti: non esiste nessuna
chiamata che iscriva un account: si firma, e la firma è di chi incassa. Mezz'ora
in tutto, la maggior parte della quale è aspettare.

Quello che segue è com'era l'ultima volta che si è guardato. Se la pagina chiede
qualcosa di diverso, **fa fede la pagina**.

1. **github.com/sponsors**, da loggato come `danigio15` → il tasto per iscriversi.
2. **Account individuale**, non organizzazione. Per gli individui GitHub non
   trattiene niente e paga lui le commissioni; per le organizzazioni no.
3. **Verifica dell'identità**: un documento.
4. **Dove arrivano i soldi.** Qui compare Stripe, e conviene sapere una cosa
   prima di spaventarsi: **non serve avere un conto Stripe**. La procedura ne
   crea uno per te (Stripe Connect), e non è un servizio che paghi né un
   pannello da gestire: è il tubo con cui GitHub ti manda i soldi sull'IBAN.
5. **L'IBAN**, quello dove vuoi i soldi.
6. **Il modulo fiscale.** Per chi non sta negli Stati Uniti è il **W-8BEN**, e
   si compila lì dentro: serve a dire che le tasse le paghi in Italia e non in
   America.
7. **I livelli e il profilo** — i testi stanno qui sotto, pronti.
8. **Invia**, e aspetta l'approvazione. Da lì in poi i pagamenti sono mensili.

Il pezzo che tocca alla repository **è già fatto**:
[`.github/FUNDING.yml`](../.github/FUNDING.yml) mette il tasto in cima alla
pagina. Fino all'approvazione quella voce porta a una pagina che dice che non si
accettano sponsorizzazioni; PayPal, sotto, funziona da subito.

## I testi, pronti da incollare

### La presentazione

> **gdahome — la tua casa in una plancia, sul telefono.**
>
> Un add-on per Home Assistant e un'app per Android e iPhone: si installa
> l'add-on, si inquadra un QR code, e la casa è sul telefono — dentro e fuori
> casa, senza aprire porte sul router e senza VPN.
>
> È tutto gratis e resta gratis: l'add-on, la plancia, l'app, l'accesso da
> fuori. Nessun abbonamento, nessun limite a pagamento, nessun account da fare.
>
> Sostenerlo non sblocca niente — e non deve. Paga i due conti che il progetto
> ha davvero (25 $ per Google Play, 99 $ l'anno per l'account Apple) e il tempo
> di chi lo scrive e risponde a chi chiede aiuto.

In inglese, per chi arriva da fuori:

> **gdahome — your home as one screen, on your phone.**
>
> A Home Assistant add-on and an Android/iPhone app: install the add-on, scan a
> QR code, and your home is on your phone — at home and away, with no ports
> opened on your router and no VPN.
>
> Everything is free and stays free: the add-on, the dashboard, the app, remote
> access. No subscription, no paywalled limits, no account to create.
>
> Sponsoring unlocks nothing — and it shouldn't. It pays the project's two real
> bills (25 $ for Google Play, 99 $/year for the Apple developer account) and
> the time of whoever writes it and answers for it.

### L'obiettivo

Un obiettivo vero si capisce e si raggiunge; «sostienimi» no.

> **99 $ l'anno: l'account sviluppatore Apple.**
> È l'ultimo pezzo che manca all'app per iPhone. L'app è scritta e compila a
> ogni giro: quello che manca è la firma di Apple.

### I livelli

Tre al mese e due una tantum bastano. I nomi dicono cosa pagano, non quanto
vali tu che dai.

| quanto | nome | cosa dire |
|---|---|---|
| **3 €/mese** | Una mano | «Il caffè del mese. Non sblocca niente, e non deve: tiene aperta la porta a chi scrive per chiedere aiuto.» |
| **8 €/mese** | L'iPhone | «Dodici mesi di questo livello pagano l'account sviluppatore Apple — l'unico pezzo che manca all'app per iPhone.» |
| **20 €/mese** | Chi la tiene in piedi | «Il tempo: scrivere il codice, tenere in piedi le prove, rispondere. È quello che fa la differenza fra un progetto vivo e uno fermo.» |
| **5 €** una volta | Un grazie | «Una volta sola, se ti è stata utile.» |
| **25 €** una volta | Google Play | «I 25 $ di Google Play, una volta sola: è il conto che porta l'app negli store.» |

### Il messaggio a chi si iscrive

> Grazie. Non ti ho sbloccato niente perché non c'è niente da sbloccare: gdahome
> è gratis per tutti e resta così — è proprio questo che stai tenendo in piedi.
> Se trovi un difetto o ti manca qualcosa, scrivilo dalle Segnalazioni dentro
> l'app: quelle le leggo tutte.

## Quello che un sostegno non compra

Niente, ed è una scelta scritta anche altrove ([`ACQUISTI.md`](ACQUISTI.md),
regola numero uno): **quello che serve a vedere e comandare la propria casa non
si paga**, mai, accesso da fuori compreso. Un livello che sbloccasse una
funzione trasformerebbe il sostegno in un prezzo, e a quel punto «tutto gratis»
nei video sarebbe una frase da togliere.

Quindi i livelli si distinguono per quanto, non per cosa danno. Chi vuole
metterci il nome può farlo: gli sponsor compaiono sul profilo di GitHub, e
quella è una cosa che GitHub fa da sé.

## Una cosa da chiedere a un commercialista

Incassare con continuità dal pubblico, in Italia, ha conseguenze fiscali: che
tipo di entrata è, quando serve una partita IVA, cosa si dichiara. Non è una
cosa da rimandare al primo bonifico, e non è una cosa che si legge in un
documento come questo: si chiede a chi lo fa di mestiere.
