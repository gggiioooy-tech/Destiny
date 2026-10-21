# 로컬 리플레이 분석

`analyze_local.py`는 이미 저장된 리플레이만 읽는다. 다운로드, 게임 실행, 수집기 시작, 사이트 업로드 기능은 없다.

```text
python analyze_local.py --schema game-schema.pb --vendor protobuf_directory --replay battle.replay --record normalized_record.json --history original_history_row.json --output output_directory
```

`record`는 PC 수집기의 정규화 전투 기록, `history`는 `{row, direction}` 형식의 원본 전투 기록이다. 리플레이 팀 식별자와 영웅 목록 및 승리팀을 대조한다. 원본 계정 식별자와 리플레이 주소는 생성한 보고서에 포함하지 않는다.

출력은 외부 라이브러리·네트워크 없이 열리는 `timeline.html`과 분석용 `timeline.json`이다. 스킬 결과뿐 아니라 평타·턴 시작 상태효과·턴 상태 갱신도 포함한다. 피해 표시값과 HP 감소를 구분하며, 필드가 없으면 미확인으로 유지한다. 상태효과 모듈의 이름과 실제 적용 순서는 아직 추가 검증 대상이다.

실제 기록을 탐색하는 도구이며 장비나 스탯 변경에 따른 승패 예측기는 아니다. 이번 테스트에는 사용자 허용으로 내려받은 전투 1개만 사용했다. 기록은 로컬 `tmp/replay-analysis-20261019-224354/`에 있으며 사이트에 배포하지 않았다.
