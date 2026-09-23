import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// La chiave vera, se c'e'.
//
// Sta in `android/chiave.properties`, che non entra nella repository (lo dice
// `android/.gitignore`), e la scrive chi costruisce: sulla macchina di GitHub
// la scrive il workflow dai segreti, su un computer la scrive chi ce l'ha. Le
// quattro righe sono quelle di sempre — `storeFile`, `storePassword`,
// `keyAlias`, `keyPassword`.
//
// **Se non c'e', un pacchetto «release» non si fa**, a meno che chi costruisce
// non chieda apposta la firma di prova (`GDAHOME_FIRMA_DI_PROVA=si`
// nell'ambiente). La chiave di prova sta nella repository, e la sua parola
// e' scritta qui sotto: un pacchetto firmato con lei lo puo' rifare chiunque.
// Per questo quello che esce firmato di prova non si chiama come l'app vera
// — ha `.prova` in fondo al nome — e non si installa mai sopra di lei ne'
// arriva ai suoi dati. Quale delle due ha firmato lo dice il riepilogo della
// corsa, che e' il posto dove si guarda.
val chiaveVera =
    Properties().apply {
        val dove = rootProject.file("chiave.properties")
        if (dove.exists()) dove.inputStream().use { load(it) }
    }
val cELaChiaveVera = chiaveVera.getProperty("storeFile") != null
val firmaDiProvaChiesta = System.getenv("GDAHOME_FIRMA_DI_PROVA") == "si"

android {
    // La chiave con cui si firmano i pacchetti di prova.
    //
    // Sta qui dentro, nel progetto, e **deve starci**: senza, ogni macchina
    // che compila se ne genera una nuova, Android vede due firme diverse e
    // rifiuta di installare il pacchetto nuovo sopra il vecchio. Chi lo prova
    // e' costretto a disinstallare — e disinstallando **perde l'abbinamento**,
    // perche' il segno della casa sta nel portachiavi del telefono e con l'app
    // se ne va.
    //
    // Il risultato era che ogni versione nuova costava all'utente un giro
    // completo: stacca, fabbrica un codice, riabbina. Con una chiave ferma il
    // pacchetto nuovo si installa sopra e non gli si chiede piu' niente.
    //
    // Non e' un segreto e non protegge niente: firma soltanto i pacchetti di
    // prova, quelli che si passano a mano, e che si chiamano
    // `com.gdahome.gdahome.prova` — un'app a parte da quella vera, che si
    // firma solo con la chiave tenuta fuori di qui.
    signingConfigs {
        getByName("debug") {
            storeFile = file("chiave-di-prova.jks")
            storePassword = "gdahome"
            keyAlias = "gdahome"
            keyPassword = "gdahome"
        }
        if (cELaChiaveVera) {
            create("vera") {
                storeFile = file(chiaveVera.getProperty("storeFile"))
                storePassword = chiaveVera.getProperty("storePassword")
                keyAlias = chiaveVera.getProperty("keyAlias") ?: "gdahome"
                keyPassword =
                    chiaveVera.getProperty("keyPassword")
                        ?: chiaveVera.getProperty("storePassword")
            }
        }
    }

    namespace = "com.gdahome.gdahome"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.gdahome.gdahome"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        // Quello che si costruisce per lavorarci (`flutter run`) e' firmato di
        // prova: si chiama come un pacchetto di prova.
        getByName("debug") {
            applicationIdSuffix = ".prova"
        }
        release {
            if (cELaChiaveVera) {
                signingConfig = signingConfigs.getByName("vera")
            } else {
                // Firmato di prova solo se chiesto, e mai col nome vero. Se non
                // e' chiesto, qui sotto il pacchetto si ferma prima di partire.
                signingConfig = signingConfigs.getByName("debug")
                applicationIdSuffix = ".prova"
                versionNameSuffix = "-prova"
            }
        }
    }
}

// Un «release» senza chiave vera e senza firma di prova chiesta si ferma
// **subito**, con un messaggio che dice cosa fare — non dopo sei minuti di
// costruzione, e soprattutto non con un pacchetto firmato di prova che
// qualcuno potrebbe scambiare per quello vero.
if (!cELaChiaveVera && !firmaDiProvaChiesta) {
    tasks.matching { it.name == "preReleaseBuild" }.configureEach {
        doFirst {
            throw GradleException(
                "Manca la chiave vera (android/chiave.properties). Un pacchetto " +
                    "release non si firma con la chiave di prova. Per un " +
                    "pacchetto da provare, che si chiama com.gdahome.gdahome.prova, " +
                    "costruisci con GDAHOME_FIRMA_DI_PROVA=si nell'ambiente.",
            )
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
