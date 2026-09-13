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
// **Se non c'e' si firma con la chiave di prova e si va avanti.** Un pacchetto
// firmato di prova si installa e funziona; un lavoro che si ferma perche'
// manca un segreto ferma anche chi vuole solo provare l'app. Quale delle due
// ha firmato lo dice il riepilogo della corsa, che e' il posto dove si guarda.
val chiaveVera =
    Properties().apply {
        val dove = rootProject.file("chiave.properties")
        if (dove.exists()) dove.inputStream().use { load(it) }
    }
val cELaChiaveVera = chiaveVera.getProperty("storeFile") != null

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
    // prova, quelli che si passano a mano. Il giorno che si va sui negozi
    // servira' una chiave vera, tenuta fuori di qui.
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
        release {
            // La vera quando c'e', quella di prova quando no.
            signingConfig = signingConfigs.getByName(if (cELaChiaveVera) "vera" else "debug")
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
