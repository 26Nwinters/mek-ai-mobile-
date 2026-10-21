plugins { id("com.android.application") }

android {
    namespace = "com.mekai.mobile"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.mekai.mobile"
        minSdk = 31
        targetSdk = 36
        versionCode = 13
        versionName = "0.6.1"
    }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
