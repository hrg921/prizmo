// 클라이언트·서버 공용 상수

export const SITES = ["결장", "직장"] as const;
export const STAGES = ["1기", "2기", "3기", "모름"] as const;
export const CONCERNS = ["항문 보존", "로봇 수술", "항암 병행"] as const;
export const REGIONS = ["서울", "경기", "기타"] as const;
export const CRITERIA_KEYS = ["연구 경력", "자격·경력", "임상시험", "병원 평가", "조건"] as const;

/** 예전 기준 이름 → 지금 이름 (저장된 상황 정보 이전용) */
export const LEGACY_CRITERIA: Record<string, (typeof CRITERIA_KEYS)[number]> = { "최신 치료": "임상시험", 거리: "조건" };

/** 리포트·비교표에 표시하는 공개 기록 기준일 (예시 데이터 기준) */
export const RECORDS_AS_OF = "2026.10.30";

export type Axis = "research" | "credential" | "trials" | "hospital" | "condition";

export const AXES: { key: Axis; label: string }[] = [
  { key: "research", label: "연구" },
  { key: "credential", label: "자격" },
  { key: "trials", label: "임상시험" },
  { key: "hospital", label: "병원" },
  { key: "condition", label: "조건" },
];

/** 열람권 상품 (가격은 프로토타입용 예시) */
export const PACKAGES = {
  pack5: { label: "5회 열람권", credits: 5, amount: 4900 },
  pack10: { label: "10회 열람권", credits: 10, amount: 8900 },
} as const;
