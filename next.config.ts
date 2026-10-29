import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 모든 화면이 로그인 사용자(쿠키)와 DB 상태에 따라 달라지는 인터랙티브 프로토타입이라
  // Cache Components(정적 셸 프리렌더)는 끄고 요청 시 렌더링하는 기존 모델을 사용합니다.
  cacheComponents: false,
  // 로컬 DB 폴더(PGlite)는 배포 번들에 넣지 않습니다.
  outputFileTracingExcludes: {
    "/**": ["./data/**/*"],
  },
};

export default nextConfig;
