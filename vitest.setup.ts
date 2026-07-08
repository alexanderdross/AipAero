// Registers @testing-library/jest-dom matchers (toHaveAttribute, toBeVisible,
// …) on Vitest's expect, and auto-cleans the DOM between tests. Safe to load
// in the default node environment — component specs opt into jsdom with a
// `// @vitest-environment jsdom` docblock.
import "@testing-library/jest-dom/vitest";
