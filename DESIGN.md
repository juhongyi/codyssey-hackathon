# DESIGN.md — ODYSSEY (오딧세이) 라이프 디자인 저널

> **프로젝트명:** ODYSSEY  
> **Stitch 프로젝트 ID:** `9865131118826321736`  
> **작성 기준일:** 2026-10-31  
> **디바이스 타겟:** Mobile-first (390px), Desktop 반응형 지원

---

## 1. 디자인 컨셉

### 1.1 비전
"저널/다이어리 스타일의 따뜻한 손글씨 감성 UI"로, 사용자가 5년 인생 계획을 세 가지 시나리오(Plan 1~3)로 탐색하고, 마음에 드는 조각(piece)을 모아 자신만의 라이프 보드를 만드는 앱.

### 1.2 무드 키워드
- 📓 종이 노트 / 저널 / 콜라주
- ✏️ 잉크 스케치 / 손그림 느낌
- 🎨 따뜻한 머스타드 + 코랄 악센트
- 📐 도트 그리드 배경
- 📌 마스킹 테이프 장식

---

## 2. 컬러 시스템

### 2.1 코어 팔레트

| 역할 | 토큰명 | HEX | 용도 |
|------|--------|-----|------|
| **배경 (종이)** | `bg-paper` | `#FAF7F2` | 앱 전체 배경, 도트 그리드 베이스 |
| **카드 배경** | `card-bg` | `#FFFDF9` | 카드, 버튼 기본 배경 |
| **잉크 (텍스트)** | `ink` | `#1C1917` | 주요 텍스트, 보더, 그림자 |
| **보조 텍스트** | `text-secondary` | `#625B52` | 설명문, 메타 정보 |
| **프라이머리 (머스타드)** | `primary-mustard` | `#D8B54A` | CTA 버튼, 활성 상태, '일' 카테고리 칩 |
| **서포트 코랄** | `support-coral` | `#F2AAA0` / `#F8B0A6` | '창작' 카테고리, 선택된 노트 카드 배경 |
| **서포트 그린** | `support-green` | `#DDE7D3` | '휴식' 카테고리, 뱃지 |
| **서포트 블루** | `support-blue` | `#DBE3EF` | '관계' 카테고리 |

### 2.2 확장 Material 시맨틱 컬러

| 토큰명 | HEX | 용도 |
|--------|-----|------|
| `primary` | `#745B00` | 텍스트 강조 |
| `primary-container` | `#D8B54A` | Plan 1 탭, 주요 컨테이너 |
| `secondary` | `#884F47` | Plan 2 연관 |
| `secondary-container` | `#FEB4AA` | Plan 2 배지 |
| `tertiary` | `#586152` | Plan 3 연관 |
| `tertiary-container` | `#B2BCA9` | Plan 3 뱃지 |
| `error` | `#BA1A1A` | 에러 |
| `on-surface` | `#1E1B19` | 표면 위 텍스트 |
| `surface` | `#FFF8F5` | 표면 |
| `outline` | `#7E7664` | 아웃라인 |
| `outline-variant` | `#D0C5B0` | 약한 아웃라인 |
| `inverse-surface` | `#33302D` | 다크 표면 |

### 2.3 카테고리별 컬러 매핑

| 카테고리 | 칩 배경 | 카드 배경 (타임라인) | 설명 |
|----------|---------|---------------------|------|
| **일 (Work)** | `#D8B54A` | `#FEF3C7` | 업무, 커리어 관련 |
| **창작 (Creation)** | `#F2AAA0` | `#FEE2E2` | 예술, 취미, 사이드프로젝트 |
| **관계 (Relation)** | `#DBE3EF` | `#DBEAFE` | 가족, 친구, 커뮤니티 |
| **휴식 (Rest)** | `#DDE7D3` | `#DCFCE7` | 쉼, 여행, 리프레시 |

---

## 3. 타이포그래피

### 3.1 폰트 패밀리

| 역할 | 폰트 | 용도 |
|------|------|------|
| **제목 (Title)** | `Jua` | 앱바 타이틀, 카드 제목, 버튼 라벨, Plan 헤드라인 |
| **손글씨 (Hand)** | `LeeSeoyun` | 카테고리 칩, 뱃지, 라벨, 주석 |
| **본문 (Body)** | `Gowun Dodum` | 설명문, 메타 텍스트, 날짜 |

### 3.2 타입 스케일

| 토큰명 | 크기 | 행간 | 굵기 | 폰트 |
|--------|------|------|------|------|
| `headline-xl` | 36px | 44px | 300 | Jua |
| `headline-xl-mobile` | 28px | 36px |300 | Jua |
| `headline-lg` | 26px | 34px | 300 | Jua |
| `headline-md` | 20px | 28px | 300 | Jua |
| `headline-sm` | 18px | 24px | 300 | Jua |
| `body-lg` | 16px | 26px | 400 | Gowun Dodum |
| `body-md` | 14px | 22px | 400 | Gowun Dodum |
| `body-sm` | 12px | 18px | 400 | Gowun Dodum |
| `label-hand-lg` | 20px | 24px | 700 | Gaegu |
| `label-hand-md` | 16px | 20px | 700 | Gaegu |
| `label-hand-sm` | 14px | 18px | 400 | Gaegu |

---

## 4. 간격 & 레이아웃

### 4.1 스페이싱 토큰

| 토큰명 | 값 | 용도 |
|--------|-----|------|
| `space-xs` | 4px (0.25rem) | 인라인 갭, 아이콘 간격 |
| `space-sm` | 8px (0.5rem) | 작은 패딩 |
| `space-md` | 12px (0.75rem) | 컴포넌트 내부 패딩 |
| `space-lg` | 16px (1rem) | 카드 내부 패딩 |
| `space-xl` | 24px (1.5rem) | 섹션 간격 |
| `space-2xl` | 32px (2rem) | 대형 간격 |
| `gutter` | 16px (1rem) | 기본 거터 |
| `gutter-lg` | 24px (1.5rem) | 넓은 거터 |
| `margin` | 16px (1rem) | 기본 마진 |
| `margin-md` | 24px (1.5rem) | 중간 마진 |
| `margin-lg` | 40px (2.5rem) | 큰 마진 |

### 4.2 레이아웃 프레임

- **모바일 프레임:** 390px 고정 너비
- **모바일 높이:** 844px (에디터 뷰 기준)
- **앱바 높이:** 56px
- **툴바 높이:** 48px
- **미니맵 바:** 42px
- **캔버스 뷰포트:** 나머지 영역 (flex: 1)

---

## 5. 보더 & 그림자

### 5.1 보더 스타일

| 토큰명 | 스타일 | 용도 |
|--------|--------|------|
| `border-sketch` | `2px solid #1C1917` | 카드, 버튼, 프레임의 기본 보더 |
| `border-sketch-thin` | `1.5px solid #1C1917` | 칩, 핸들, 미니맵 등 |
| `border-dashed` | `2px dashed #1C1917` | 선택 바운딩 박스, 라쏘 |
| `border-dashed-light` | `2px dashed rgba(28,25,23,0.15)` | 구분선, 장식선 |

### 5.2 잉크 그림자 (Ink Shadow)

| 토큰명 | 값 | 용도 |
|--------|-----|------|
| `ink-shadow` | `3px 3px 0 #1C1917` | 주요 카드, 모바일 프레임 |
| `ink-shadow-sm` | `2px 2px 0 #1C1917` | 버튼, 칩, 뱃지 |
| `ink-shadow-xs` | `1px 1px 0 #1C1917` | 소형 버튼, 도구바 버튼 |
| `ink-shadow-lg` | `6px 6px 0 #1C1917` | 모바일 프레임 외곽 |

### 5.3 보더 래디우스

| 토큰명 | 값 | 용도 |
|--------|-----|------|
| `radius-default` | 4px | 기본, 칩 |
| `radius-lg` | 8px | 버튼, 컨텍스트 메뉴 |
| `radius-xl` | 12px | 카드, 저널 프레임 |
| `radius-full` | 9999px | 뱃지, 원형 요소 |
| `radius-note` | 10px | 노트 카드 |

---

## 6. 배경 패턴

### 6.1 도트 그리드

```css
/* 메인 배경 도트 그리드 */
background-color: #FAF7F2;
background-image: radial-gradient(rgba(28, 25, 23, 0.12) 1.2px, transparent 1.2px);
background-size: 18px 18px;

/* 캔버스 영역 도트 그리드 */
background-image: radial-gradient(#1C1917 1px, transparent 1px);
background-size: 14px 14px;

/* 타임라인 보드 도트 그리드 */
background-image: radial-gradient(#e5dcce 1px, transparent 1px);
background-size: 14px 14px;
```

---

## 7. 핵심 컴포넌트

### 7.1 탑 앱바 (Top App Bar)

- **높이:** 56px
- **배경:** `#FAF7F2` (paper)
- **하단 보더:** `2px solid #1C1917`
- **구성:** 뒤로가기 버튼 (좌), 타이틀 (중앙), 완료/저장 버튼 (우)
- **뒤로가기 버튼:** `#FFFDF9` 배경, `8px` radius, `ink-shadow-sm`
- **완료 버튼:** `#D8B54A` 배경 (머스타드), `ink-shadow-sm`

### 7.2 노트 카드 (Note Card)

- **배경:** `#FFFDF9` (기본), 카테고리 컬러 (선택 시)
- **보더:** `2px solid #1C1917`, `border-radius: 10px`
- **그림자:** `3px 3px 0 #1C1917`
- **패딩:** `8px 10px`
- **구성:**
  - 카테고리 칩 (상단)
  - 제목 (Jua, 14px)
  - 부제목 (Gowun Dodum, 11px, `#625B52`)
- **선택 상태:** 카테고리 컬러 배경 + dashed 바운딩 박스 + 4개 리사이즈 핸들

### 7.3 카테고리 칩 (Category Chip)

- **보더:** `1.5px solid #1C1917`, `border-radius: 4px`
- **패딩:** `1px 6px`
- **폰트:** Gaegu, 13px, Bold
- **배경:** 카테고리별 컬러 (일=머스타드, 창작=코랄, 관계=블루, 휴식=그린)

### 7.4 툴바 (Tool Bar)

- **높이:** 48px
- **배경:** `#FAF7F2`
- **도구 버튼:** `34px` 높이, `8px` radius, `#FFFDF9` 배경
- **활성 상태:** `#D8B54A` 배경, `ink-shadow-sm`
- **구분선:** `2px × 22px` 검정 막대
- **실행 취소/다시 실행:** `34px × 34px` 정사각형 버튼

### 7.5 컨텍스트 메뉴 (Context Menu)

- **배경:** `#FAF7F2`
- **보더:** `2px solid #1C1917`, `border-radius: 8px`
- **그림자:** `2.5px 2.5px 0 #1C1917`
- **패딩:** `4px`
- **버튼:** `32px` 높이, `#FFFDF9` 배경, `5px` radius
- **단일 선택:** 수정 / 복제 / 삭제
- **다중 선택:** 복제 / 삭제만
- **삭제 버튼:** 텍스트 컬러 `#D32F2F` (빨강)

### 7.6 미니맵 바 (Minimap Bar)

- **높이:** 42px
- **구성:** 제목 ("전체 5개년 미니맵") + 스케일 바
- **스케일 바:** `236px × 20px`, `#FFFDF9` 배경, 6칸 셀
- **뷰포트 표시:** `rgba(216,181,74,0.45)` 반투명 머스타드
- **상태 도트:** `7px` 원형, `#D8B54A` 배경

### 7.7 선택 바운딩 박스 (Selection Bounds)

- **보더:** `2px dashed #D8B54A` (단일) / `2px dashed #1C1917` (다중)
- **리사이즈 핸들:** `9px × 9px`, `#FFFDF9` 배경, `2px solid #1C1917`
- **선택 정보 필:** 검정 배경, 흰 텍스트, `4px` radius
- **다중 선택 뱃지:** `#D8B54A` 배경, `6px` radius, `ink-shadow-sm`

### 7.8 타임라인 캔버스 (Timeline Canvas)

- **배경:** 도트 그리드 패턴
- **연도 가이드 라인:** `2px dashed #D6CCB8`
- **연도 태그:** `20px` 원형, 검정 배경, 흰 텍스트
- **기준선 (Baseline):** `2px solid #1C1917` 수평선
- **날짜 라벨:** `#FFFDF9` 배경, `1.5px solid #1C1917`, `4px` radius

### 7.9 Plan 카드 (Plan Card — 전체 보기)

- **배경:** `#FFFDF9`
- **보더:** `2px solid #1C1917`, `border-radius: 12px`
- **그림자:** `ink-shadow` (3px 3px 0 #1C1917)
- **구성:**
  - Plan 넘버 뱃지 (Plan 1=머스타드, Plan 2=코랄, Plan 3=블루)
  - 제목 + 설명
  - 5년 타임라인 보드 (인라인 미니 캔버스)
  - 4가지 평가 지표 (자원/호감/자신감/일관성, 2×2 그리드)
  - 액션 버튼 3개 (+ 조각 추가 / ✎ 직접 쓰기 / ☰ 조각 목록)

### 7.10 평가 지표 바 (Rating Bar)

- **배경:** `#FAF7F2`
- **보더:** `2px solid #1C1917`, `border-radius: 8px`
- **프로그레스 바:** `12px` 높이, `rounded-full`
- **채움 색상:** 자원=`#D8B54A`, 호감=`#F2AAA0`, 자신감=`#DDE7D3`, 일관성=`#DBE3EF`

### 7.11 네비게이터 (Quick Navigator)

- **위치:** 스티키, top 14 (앱바 아래)
- **배경:** `#FFFDF9`, `border-radius: 12px`, `ink-shadow-sm`
- **활성 탭:** `primary-container` 배경, `2px solid` 보더
- **비활성 탭:** `surface` 배경, 투명 보더

### 7.12 다이어리 랜딩 페이지 컴포넌트

#### 히어로 섹션
- **아이브로우 뱃지:** `#DDE7D3` 배경, `20px` 원형 radius, Gaegu 18px Bold, `-1.5deg` 회전
- **히어로 타이틀:** Jua, 32px
- **CTA 버튼:** `#D8B54A`, 54px min-height, Jua 20px, `ink-shadow`

#### 스크랩 카드 (Scrap Card)
- **좌측 보더:** 6px solid (카테고리 컬러)
- **각도:** 카드마다 살짝 회전 (`rotate(-0.8deg)` ~ `rotate(0.8deg)`)
- **카테고리별 배경:** 일=`#FFFDF8`, 창작=`#F8FAF5`, 관계=`#FBF6F5`, 휴식=`#F4F7FC`

#### 스텝 카드 (Step Card)
- **넘버링:** `42px × 42px` 정사각형, `10px` radius
- **스텝 컬러:** 01=머스타드, 02=그린, 03=블루

#### 마스킹 테이프 장식
- **와시 테이프:** `rgba(235,222,185,0.75)`, dashed 좌우 보더
- **미니 테이프:** `44px × 12px`, 카드 상단에 비스듬히

---

## 8. 인터랙션 패턴

### 8.1 버튼 눌림 효과
```css
.button:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 #1C1917; /* 그림자 축소 */
}
```

### 8.2 호버 효과
```css
.context-btn:hover {
  background-color: #F2ECE0;
}
```

### 8.3 선택 인터랙션
- **단일 선택 (선택 도구):** 노트 카드 탭 → dashed 바운딩 박스 + 4코너 핸들 + 컨텍스트 메뉴 (수정/복제/삭제)
- **다중 선택 (올가미 도구):** 올가미로 영역 드로잉 → 반투명 영역 + dashed 바운딩 박스 + N개 선택 뱃지 + 컨텍스트 메뉴 (복제/삭제만)
- **드래그:** 선택 후 끌어서 이동
- **핀치:** 두 손가락으로 확대/이동

---

## 9. 아이콘

### 9.1 아이콘 소스
- **인라인 SVG:** 대부분의 UI 아이콘 (화살표, 편집, 삭제, 되돌리기 등)
- **Lucide Icons:** 다이어리 랜딩 페이지 (sparkles, mic, layout-grid, palette, compass, info, shield-check 등)
- **Material Symbols Outlined:** 전체 보기 페이지 (arrow_back, check, edit, timeline, map, bookmark_star, add, edit_note, menu, cloud_done 등)

### 9.2 아이콘 스타일
- **선 두께:** 2 ~ 2.5px
- **크기:** 12px (컨텍스트 메뉴) ~ 22px (CTA)
- **색상:** `#1C1917` (기본), `#D32F2F` (삭제)

---

## 10. 화면 목록 (스크린 인벤토리)

| # | 화면 이름 | 해상도 | 디바이스 | 설명 |
|---|-----------|--------|----------|------|
| 1 | 오딧세이 / 편집 UI 통일 · 단일 선택 | 2560×2048 | Desktop | 타임라인 캔버스에서 단일 노트 카드 선택 상태 |
| 2 | 오딧세이 / 편집 UI 통일 · 다중 선택 | 2560×2048 | Desktop | 올가미 도구로 다중 노트 카드 선택 상태 |
| 3 | 오딧세이 / 세 플랜 전체 보기 | 780×5382 | Mobile | 3개 Plan 카드 + 타임라인 + 평가 지표 전체 뷰 |
| 4 | 다이어리 / 랜딩 | 2560×3826 | Desktop | 서비스 랜딩 페이지 (히어로 + 보드 미리보기 + 스텝 안내) |

---

## 11. 접근성 가이드라인

- **최소 터치 타겟:** `44px × 44px` (모든 인터랙티브 요소)
- **언어:** `lang="ko"` 설정
- **ARIA 라벨:** 주요 영역과 버튼에 `aria-label` 명시
- **역할:** 컨텍스트 메뉴에 `role="toolbar"`, 캔버스에 `aria-label="타임라인 캔버스"`
- **시맨틱 태그:** `<header>`, `<main>`, `<footer>`, `<nav>`, `<article>`, `<section>` 활용
- **색상 대비:** 잉크(#1C1917) vs 종이(#FAF7F2) = 충분한 대비

---

## 12. 기술 스택 참조

| 항목 | 사용 기술 |
|------|-----------|
| CSS 프레임워크 | Tailwind CSS (CDN, plugins: forms, container-queries) |
| 폰트 로딩 | Google Fonts (preconnect + stylesheet) |
| 아이콘 | 인라인 SVG + Lucide + Material Symbols Outlined |
| 레이아웃 | Flexbox + CSS Grid (2×2 평가 지표) |
| 반응형 | 390px 모바일 프레임 고정, `sm:` 브레이크포인트로 데스크톱 대응 |
