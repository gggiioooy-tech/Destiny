# 시뮬레이터 효과 점검 · 2026-10-22

입력 편의/반지와 별개로 전체 영웅 특수 효과 완성을 의미하지 않는다. 현재 도감 176종의 기존 스킬 자료를 조건부 문구 기준으로 점검했다. 신규 서버 리플레이 다운로드는 하지 않았다.

## 이번 변경
- 자리 안에서 영웅 선택 후 이동/교환. 팝업 배경 클릭 닫기 제거(드래그 오동작 방지).
- 팀별 스킬 예약 0~3개 및 모두 해제. 빈 예약은 자동 스킬 선택이며 스킬 사용 중지가 아니다.
- 반지 none/daebul/daegwon/gwonbul을 원본 입력과 조합 저장에 보관. 사용자 지정 모델: 대불은 100% 부활 1회 다음 불사3턴 부활1회, 대권은 권능과 100% 부활1회, 권불은 권능과 불사3턴 부활1회. 권능 보호막은 현재 공격력×150%, 재생으로 추가 배율을 붙이지 않는다. 고유 권능과 반지 권능은 단일 생존 트리거로 처리한다. 절멸은 부활을 막는다.
- 델론즈: 변신 후 세 공격, 각성 중첩/무효화, 아군 사망 중첩/게이지, 권능 무효화/게이지, 변신 평타 쿨타임 감소, 처형 및 처치 후 최대1회 연속 공격. 공격력 자체를 임의 증가시키지 않으며 치명타 피해 중첩만 반영한다. 영구 행동제어 면역을 일반 버프해제로 지우지 않는다. 반복 공격 시간은 기본 스킬 시간 재사용 추정이다.
- 실베스타 축복40% 및 스킬 회복/제어 해제 후 공격 중첩, 젠이츠 제어 해제/게이지/보호막/쿨감, 하연 아군 절반HP 1회 구조, 스쿨드 2회 회복/운명의 실, 라드 개인 피격3회 회복/보호막을 보완했다.

## 근거
- 반지: 사용자 제공 규칙. 고유 부활과 반지 부활의 동시 우선순위는 실전 검증 필요(현재 반지를 먼저 사용).
- 델론즈: https://www.namu.moe/w/델론즈(세븐나이츠%20리버스)/각성 (CC BY-NC-SA 2.0 KR, 2026-10-22 확인); https://forum.netmarble.com/sena_rebirth/view/10/1203
- 기타 패시브: 기존 simulationRoster의 영웅별 공개 출처와 사용자 제공 스킬 자료. 하연 오류 수정 확인: https://forum.netmarble.com/sena_rebirth/view/10/2080

## 남은 한계
권능/부활/반지 동시 우선순위, 즉사/처형과 일부 보호 효과, 스쿨드 해제 순서, 연속 공격 대상 선택, 하연 생명력 교환·버프 차단, 선란 추가 귀면과 무영비검, 루디 링크·방호 분배, 사망 시 상시 오라 재계산, 다수 고유 패시브는 미완성이다. 반격·협공·DOT 모든 경로에서 동일한 반응 패시브를 호출하는 작업도 남아 있다. 실행되는 조건부 처리 시점은 일부 행동 종료 기준 근사이다. 따라서 전체 효과 구현/승패 정확도 개선으로 표현하지 않는다.

2026-10-22.4 엔진으로 기존 로컬 12개 중 비교 가능10개, 32시드씩 재검사해 4/10 일치. 독립 홀드아웃 검증 아님, 90% 목표 미달. 원본 전투/계정/스탯은 이 문서에 포함하지 않는다.

## 도감별 조건부 문구 점검 목록
문구 수는 구현 여부가 아닌 연구 우선순위 참고치다.

| 영웅 | 스킬 수 | 조건부 문구 수 | 자료 |
|---|---:|---:|---|
| 강재 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=101675) |
| 겔리두스 | 4 | 4 | [출처](https://namu.wiki/w/%EA%B2%94%EB%A6%AC%EB%91%90%EC%8A%A4(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 관우 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=101616) |
| 구피 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100414) |
| 기유 | 5 | 3 | [출처](https://namu.wiki/w/%ED%86%A0%EB%AF%B8%EC%98%A4%EC%B9%B4%20%EA%B8%B0%EC%9C%A0(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 나미 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100104) |
| 나타 | 4 | 2 | [출처](https://namu.wiki/w/%EB%82%98%ED%83%80(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 노호 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100986) |
| 녹스 | 5 | 2 | [출처](https://namu.wiki/w/%EB%85%B9%EC%8A%A4(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 누리 | 3 | 1 | [출처](https://7knightshub.com/character.html?tid=101955) |
| 니아 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100856) |
| 데릭 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100255) |
| 데이곤 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=101845) |
| 데이지 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=101176) |
| 델론즈 | 5 | 13 | [출처](https://namu.wiki/w/%EB%8D%B8%EB%A1%A0%EC%A6%88(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 동영 | 5 | 11 | [출처](https://namu.wiki/w/%EB%8F%99%EC%98%81(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 돼오 | 4 | 4 | [출처](https://7knightshub.com/character.html?tid=101866) |
| 라니아 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100426) |
| 라드그리드 | 4 | 1 | [출처](https://namu.wiki/w/%EB%9D%BC%EB%93%9C%EA%B7%B8%EB%A6%AC%EB%93%9C(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 라울 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100174) |
| 라이언 | 4 | 1 | [출처](https://namu.wiki/w/%EB%9D%BC%EC%9D%B4%EC%96%B8(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 라쿤 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100146) |
| 란드그리드 | 4 | 4 | [출처](https://namu.wiki/w/%EB%9E%80%EB%93%9C%EA%B7%B8%EB%A6%AC%EB%93%9C(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 레긴레이프 | 4 | 14 | [출처](https://namu.wiki/w/%EB%A0%88%EA%B8%B4%EB%A0%88%EC%9D%B4%ED%94%84(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 레오 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100216) |
| 레이 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=101186) |
| 레이첼 | 4 | 0 | [출처](https://namu.wiki/w/%EB%A0%88%EC%9D%B4%EC%B2%BC(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 로울 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100164) |
| 로지 | 4 | 1 | [출처](https://namu.wiki/w/%EB%A1%9C%EC%A7%80(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 로토 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100314) |
| 루디 | 5 | 6 | [출처](https://namu.wiki/w/%EB%A3%A8%EB%94%94(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 루리 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100846) |
| 루시 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100806) |
| 룩 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100896) |
| 리 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100646) |
| 리나 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100726) |
| 리키 | 2 | 0 | [출처](https://7knightshub.com/character.html?tid=100153) |
| 리퍼 | 2 | 0 | [출처](https://7knightshub.com/character.html?tid=100203) |
| 린 | 4 | 4 | [출처](https://namu.wiki/w/%EB%A6%B0(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 링링 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=101496) |
| 메이 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100946) |
| 멜키르 | 4 | 7 | [출처](https://namu.wiki/w/%EB%A9%9C%ED%82%A4%EB%A5%B4(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 미스트 | 4 | 5 | [출처](https://namu.wiki/w/%EB%AF%B8%EC%8A%A4%ED%8A%B8(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 미호 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=101396) |
| 밀리아 | 4 | 2 | [출처](https://namu.wiki/w/%EB%B0%80%EB%A6%AC%EC%95%84(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 바네사 | 4 | 1 | [출처](https://namu.wiki/w/%EB%B0%94%EB%84%A4%EC%82%AC(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 바론 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100444) |
| 바벨 | 2 | 0 | [출처](https://7knightshub.com/character.html?tid=100133) |
| 발리스타 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100916) |
| 백각 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=101556) |
| 백룡 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=101546) |
| 베스킨 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100064) |
| 베인 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100286) |
| 벨라 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100325) |
| 벨리카 | 5 | 2 | [출처](https://namu.wiki/w/%EB%B2%A8%EB%A6%AC%EC%B9%B4(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 봉황 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=101655) |
| 브란즈&브란셀 | 4 | 7 | [출처](https://namu.wiki/w/%EB%B8%8C%EB%9E%80%EC%A6%88&%EB%B8%8C%EB%9E%80%EC%85%80(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 블랙로즈 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=101116) |
| 비담 | 4 | 2 | [출처](https://7knightshub.com/character.html?tid=100706) |
| 비스킷 | 4 | 0 | [출처](https://namu.wiki/w/%EB%B9%84%EC%8A%A4%ED%82%B7(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 빅토리아 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100796) |
| 사라 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100486) |
| 샤오 | 4 | 3 | [출처](https://7knightshub.com/character.html?tid=101856) |
| 석지니 | 3 | 1 | [출처](https://7knightshub.com/character.html?tid=101975) |
| 선란 | 5 | 10 | [출처](https://namu.wiki/w/%EC%84%A0%EB%9E%80/%EA%B0%81%EC%84%B1) |
| 성진우 | 4 | 6 | [출처](https://namu.wiki/w/%EC%84%B1%EC%A7%84%EC%9A%B0(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 세라 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100936) |
| 세인 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100876) |
| 셀롭 | 2 | 0 | [출처](https://7knightshub.com/character.html?tid=100083) |
| 소교 | 4 | 2 | [출처](https://7knightshub.com/character.html?tid=101526) |
| 소이 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100716) |
| 손오공 | 4 | 3 | [출처](https://namu.wiki/w/%EC%86%90%EC%98%A4%EA%B3%B5(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 스니퍼 | 4 | 3 | [출처](https://7knightshub.com/character.html?tid=100736) |
| 스모키 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100124) |
| 스커드 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100244) |
| 스컬 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100234) |
| 스쿨드 | 5 | 6 | [출처](https://namu.wiki/w/%EC%8A%A4%EC%BF%A8%EB%93%9C(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 스파이크 | 4 | 2 | [출처](https://namu.wiki/w/%EC%8A%A4%ED%8C%8C%EC%9D%B4%ED%81%AC(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 시노부 | 5 | 18 | [출처](https://namu.wiki/w/%EC%BD%94%EC%B5%B8%EC%9A%B0%20%EC%8B%9C%EB%85%B8%EB%B6%80(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 시로 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=101345) |
| 실롭 | 2 | 0 | [출처](https://7knightshub.com/character.html?tid=100093) |
| 실베스타 | 5 | 3 | [출처](https://namu.wiki/w/%EC%8B%A4%EB%B2%A0%EC%8A%A4%ED%83%80(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 실비아 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100826) |
| 아라곤 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100966) |
| 아론 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100454) |
| 아리 | 2 | 0 | [출처](https://7knightshub.com/character.html?tid=100023) |
| 아리스 | 5 | 6 | [출처](https://namu.wiki/w/%EC%95%84%EB%A6%AC%EC%8A%A4(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 아리엘 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100656) |
| 아멜리아 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=101406) |
| 아수라 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100996) |
| 아일린 | 5 | 5 | [출처](https://namu.wiki/w/%EC%95%84%EC%9D%BC%EB%A6%B0(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 아칸 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100405) |
| 아킬라 | 4 | 1 | [출처](https://namu.wiki/w/%EC%95%84%ED%82%AC%EB%9D%BC(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 알리 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100465) |
| 에반 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100756) |
| 에스파다 | 4 | 3 | [출처](https://7knightshub.com/character.html?tid=100866) |
| 에이스 | 4 | 1 | [출처](https://namu.wiki/w/%EC%97%90%EC%9D%B4%EC%8A%A4(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 엘렌 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100275) |
| 엘리스 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100956) |
| 엘리시아 | 4 | 3 | [출처](https://namu.wiki/w/%EC%97%98%EB%A6%AC%EC%8B%9C%EC%95%84(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 엘린 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100265) |
| 여포 | 4 | 7 | [출처](https://namu.wiki/w/%EC%97%AC%ED%8F%AC(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 연희 | 4 | 4 | [출처](https://namu.wiki/w/%EC%97%B0%ED%9D%AC(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 오르카 | 5 | 3 | [출처](https://namu.wiki/w/%EC%98%A4%EB%A5%B4%EC%B9%B4(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 오를리 | 4 | 1 | [출처](https://namu.wiki/w/%EC%98%A4%EB%A5%BC%EB%A6%AC(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 오목 | 4 | 2 | [출처](https://namu.wiki/w/%EC%98%A4%EB%AA%A9(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 용 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=101645) |
| 웬디 | 3 | 1 | [출처](https://7knightshub.com/character.html?tid=100384) |
| 유리 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100186) |
| 유미 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=101335) |
| 유신 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100696) |
| 유이 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100836) |
| 유진호 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=101756) |
| 윤건 | 5 | 5 | [출처](https://namu.wiki/w/%EC%9C%A4%EA%B1%B4(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 이주희 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=101766) |
| 이치 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=101355) |
| 자스 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100344) |
| 자크 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100294) |
| 제이브 | 4 | 0 | [출처](https://namu.wiki/w/%EC%A0%9C%EC%9D%B4%EB%B8%8C(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 제인 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100926) |
| 젠이츠 | 5 | 1 | [출처](https://namu.wiki/w/%EC%95%84%EA%B0%80%EC%B8%A0%EB%A7%88%20%EC%A0%A0%EC%9D%B4%EC%B8%A0(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 조운 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=101596) |
| 조커 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100776) |
| 쥬리 | 4 | 4 | [출처](https://namu.wiki/w/%EC%A5%AC%EB%A6%AC(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 쥬몬 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=101365) |
| 쥬피 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100746) |
| 지크 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100886) |
| 진 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=101166) |
| 진아 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=101945) |
| 차해인 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=101746) |
| 찰스 | 2 | 0 | [출처](https://7knightshub.com/character.html?tid=100223) |
| 챈슬러 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100906) |
| 초선 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=101606) |
| 카구라 | 4 | 5 | [출처](https://namu.wiki/w/%EC%B9%B4%EA%B5%AC%EB%9D%BC(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 카론 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100786) |
| 카르마 | 4 | 3 | [출처](https://namu.wiki/w/%EC%B9%B4%EB%A5%B4%EB%A7%88(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 카린 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100766) |
| 카이 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100395) |
| 카일 | 4 | 5 | [출처](https://namu.wiki/w/%EC%B9%B4%EC%9D%BC(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 칼 헤론 | 4 | 8 | [출처](https://namu.wiki/w/%EC%B9%BC%20%ED%97%A4%EB%A1%A0(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 캐티 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=101156) |
| 코코 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=101325) |
| 코쿤 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100115) |
| 콜트 | 4 | 1 | [출처](https://namu.wiki/w/%EC%BD%9C%ED%8A%B8(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 쿠퍼 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100194) |
| 크리스 | 4 | 1 | [출처](https://namu.wiki/w/%ED%81%AC%EB%A6%AC%EC%8A%A4(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 클라한 | 4 | 9 | [출처](https://namu.wiki/w/%ED%81%B4%EB%9D%BC%ED%95%9C(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 클레미스 | 5 | 5 | [출처](https://namu.wiki/w/%ED%81%B4%EB%A0%88%EB%AF%B8%EC%8A%A4(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 클레오 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100356) |
| 클로에 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100976) |
| 클로프 | 3 | 1 | [출처](https://7knightshub.com/character.html?tid=100474) |
| 키리엘 | 4 | 3 | [출처](https://namu.wiki/w/%ED%82%A4%EB%A6%AC%EC%97%98(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 타카 | 4 | 5 | [출처](https://7knightshub.com/character.html?tid=101146) |
| 탄지로 | 5 | 5 | [출처](https://namu.wiki/w/%EC%B9%B4%EB%A7%88%EB%8F%84%20%ED%83%84%EC%A7%80%EB%A1%9C(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 태오 | 4 | 4 | [출처](https://namu.wiki/w/%ED%83%9C%EC%98%A4(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 토토 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100304) |
| 트루드 | 4 | 1 | [출처](https://namu.wiki/w/%ED%8A%B8%EB%A3%A8%EB%93%9C(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 파스칼 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=101006) |
| 파이 | 4 | 2 | [출처](https://namu.wiki/w/%ED%8C%8C%EC%9D%B4(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 팔라누스 | 4 | 30 | [출처](https://namu.wiki/w/%ED%8C%94%EB%9D%BC%EB%88%84%EC%8A%A4(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 페페 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100045) |
| 포포 | 2 | 0 | [출처](https://7knightshub.com/character.html?tid=100033) |
| 폰 | 3 | 0 | [출처](https://7knightshub.com/character.html?tid=100054) |
| 푸키 | 2 | 0 | [출처](https://7knightshub.com/character.html?tid=100013) |
| 풍연 | 4 | 0 | [출처](https://7knightshub.com/character.html?tid=100686) |
| 프레이야 | 4 | 9 | [출처](https://namu.wiki/w/%ED%94%84%EB%A0%88%EC%9D%B4%EC%95%BC(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 프로스 | 2 | 0 | [출처](https://7knightshub.com/character.html?tid=100373) |
| 프루나 | 2 | 0 | [출처](https://7knightshub.com/character.html?tid=100363) |
| 플라튼 | 4 | 1 | [출처](https://namu.wiki/w/%ED%94%8C%EB%9D%BC%ED%8A%BC(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)) |
| 하연 | 5 | 8 | [출처](https://namu.wiki/w/%ED%95%98%EC%97%B0(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 하울 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100335) |
| 해피 | 2 | 0 | [출처](https://7knightshub.com/character.html?tid=100433) |
| 헤브니아 | 5 | 1 | [출처](https://namu.wiki/w/%ED%97%A4%EB%B8%8C%EB%8B%88%EC%95%84(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 헬레니아 | 5 | 1 | [출처](https://namu.wiki/w/%ED%97%AC%EB%A0%88%EB%8B%88%EC%95%84(%EC%84%B8%EB%B8%90%EB%82%98%EC%9D%B4%EC%B8%A0%20%EB%A6%AC%EB%B2%84%EC%8A%A4)/%EA%B0%81%EC%84%B1) |
| 현호 | 3 | 1 | [출처](https://7knightshub.com/character.html?tid=101965) |
| 호킨 | 4 | 1 | [출처](https://7knightshub.com/character.html?tid=100076) |
