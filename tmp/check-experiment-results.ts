import { loadExperimentResults } from "../app/services/experiment-results.server";

const results = await loadExperimentResults(
  "honey-babe-cro-test.myshopify.com",
  "test-experiment-1",
);

console.dir(results, {
  depth: null,
});

process.exit(0);
