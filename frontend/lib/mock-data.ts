import type { Plan } from "./types";

// Landing-page illustration only. Real boards are always loaded from the API.
export const samplePlan: Plan = {
  id: "A",
  label: "지금의 나를 더 깊게",
  title: "좋아하는 일을, 나만의 속도로",
  description: "익숙한 일을 발판 삼아, 작은 도전과 충분한 쉼이 함께하는 5년.",
  pieces: [
    {
      id: "sample-1",
      title: "나만의 전문성 쌓기",
      description: "",
      category: "work",
      startMonth: 0,
      durationMonths: 15,
      lane: 0,
    },
    {
      id: "sample-2",
      title: "드로잉 기록",
      description: "",
      category: "creative",
      startMonth: 8,
      durationMonths: 12,
      lane: 2,
    },
    {
      id: "sample-3",
      title: "함께하는 프로젝트",
      description: "",
      category: "relationship",
      startMonth: 25,
      durationMonths: 15,
      lane: 0,
    },
    {
      id: "sample-4",
      title: "한 달 살아보기",
      description: "",
      category: "rest",
      startMonth: 40,
      durationMonths: 6,
      lane: 2,
    },
  ],
  scores: { resources: 7, liking: 9, confidence: 8, coherence: 9 },
};
