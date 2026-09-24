import type { TraitId } from '../types';

// Rough percentile norms for the IPIP-50 scale sums (10..50), index = sum - 10.
// Computed as mid-rank percentiles from the Open-Source Psychometrics Project
// "BIG5" dataset (N = 19,718 complete web respondents, same 50 items; their
// response anchors were Disagree–Agree rather than Inaccurate–Accurate).
// ipip.ori.org cautions that no norms are universal. These are a rough
// orientation only, from a self-selected online sample.
//
// Means (SD) per item: C 3.35 (0.73), A 3.85 (0.72), E 3.01 (0.92),
// O 3.91 (0.63), N 3.10 (0.86).
export const PERCENTILES: Record<TraitId, number[]> = {
  C: [0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 5, 6, 8, 10, 13, 16, 20, 24, 28, 32, 37, 42, 47, 52, 58, 63, 68, 72, 76, 80, 84, 87, 90, 92, 94, 96, 97, 98, 99, 100],
  A: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 9, 10, 12, 15, 17, 20, 24, 28, 32, 37, 42, 48, 54, 60, 65, 71, 76, 81, 86, 90, 94, 96, 99],
  E: [0, 1, 2, 3, 4, 6, 7, 9, 11, 13, 15, 18, 21, 24, 27, 31, 34, 38, 42, 45, 49, 53, 57, 61, 65, 68, 72, 75, 78, 81, 84, 86, 89, 91, 93, 95, 96, 97, 98, 99, 100],
  O: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 3, 4, 5, 7, 9, 11, 14, 17, 21, 25, 30, 35, 41, 47, 53, 59, 64, 70, 76, 81, 86, 90, 93, 96, 99],
  N: [0, 1, 1, 2, 2, 3, 4, 6, 7, 9, 11, 14, 16, 19, 23, 26, 29, 33, 37, 41, 45, 50, 54, 58, 62, 66, 70, 73, 77, 80, 84, 87, 89, 91, 93, 95, 96, 98, 98, 99, 100],
};
