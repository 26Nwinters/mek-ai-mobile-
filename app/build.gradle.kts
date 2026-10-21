plugins { id("com.android.application") }

android {
    namespace = "com.mekai.mobile"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.mekai.mobile"
        minSdk = 31
        targetSdk = 32
        versionCode = 3
        versionName = "0.2.0"
    }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
