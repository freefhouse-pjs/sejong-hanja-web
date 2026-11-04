/* =========================================================
 * 세종 한자 공부 (아이패드용) 설정 파일
 * 필요할 때 이 파일만 고치면 됩니다.
 * ========================================================= */
var CONFIG = {
  // 학생 기록이 저장되는 Firebase 프로젝트 (안드로이드 앱과 같은 곳)
  // 다른 프로젝트(예: sejong-hanja-a04c4)로 바꾸려면 아래 두 줄을 바꾸세요.
  projectId: 'sejong-hanja-8874a',
  apiKey: 'AIzaSyCbzYc8z8UV40wjMrFQGkxUU80qzih3VoM',

  // 사용 기한 (안드로이드 앱과 같음: 2027년 2월 1일부터 열리지 않음)
  // 기한을 없애려면 useExpiry 를 false 로 바꾸세요.
  useExpiry: true,
  expiryYear: 2027,
  expiryMonth: 2,

  // 로그인 화면의 반 이름
  classes: ['믿음', '사랑']
};
