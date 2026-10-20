# 15월 Android 앱

눈송이 아이콘을 사용하며 서리 앱과 별도 패키지(com.fifteenmonth.guild)로 설치됩니다. HTTPS 운영 사이트를 표시하므로 사이트 수정은 앱에도 바로 반영됩니다.

빌드 환경: Node.js, JDK 21, Android SDK 36. JAVA_HOME과 ANDROID_HOME을 설정하세요.
ANDROID_SIGNING_PROPERTIES에는 비공개 서명 속성 파일 경로를 지정합니다. 파일에는 storeFile, storePassword, keyAlias, keyPassword가 필요합니다. 키와 속성 파일은 저장소에 넣지 마세요. 업데이트도 같은 키를 사용합니다.

```powershell
npm ci
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleRelease
```

생성 파일 app/build/outputs/apk/release/app-release.apk를 public/downloads/15month.apk에 복사해 배포합니다. 버전 업데이트 시 app/build.gradle의 versionCode를 올립니다.
