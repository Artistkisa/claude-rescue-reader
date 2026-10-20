# Analytics query and drilldown benchmark

The workload contains 1,200 synthetic conversations with 100 short text messages each, two alternating models and 60 valid calendar dates. Three fresh browser pages run the same sequence. Ingestion is excluded from the timings; the first query includes building the Analytics Worker index. The model filter then selects 60,000 messages. The first drilldown changes back to all models, so it must rescan. The next page and UUID request reuse those conditions.

Baseline: main commit `e9b127f`. Candidate: time-budgeted Analytics Worker checkpoints and one reusable matching-summary result. Chromium `151.0.7922.34`, Node `v24.16.0`, same local environment. CDP requests 4× page CPU throttling; this does not guarantee throttling of all Worker threads. Timer clamping, scheduler load and browser versions affect these values; this short-text workload does not represent every export shape.

## Raw samples (milliseconds)

| Version / run | First query + index | Changed model filter | Cold drilldown | Next page | UUID list |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before 1 | 11052 | 6423 | 6350 | 6375 | 6392 |
| Before 2 | 15476 | 12470 | 7656 | 6299 | 6318 |
| Before 3 | 10967 | 6377 | 6353 | 6329 | 6341 |
| After 1 | 206.9 | 11.3 | 3.4 | 0.3 | 0.2 |
| After 2 | 207.3 | 12.6 | 3.5 | 0.4 | 0.2 |
| After 3 | 200.5 | 11.8 | 3.6 | 0.2 | 0.4 |
| Before median | 11052 | 6423 | 6353 | 6329 | 6341 |
| After median | 206.9 | 11.8 | 3.5 | 0.3 | 0.2 |

Baseline measurements used the identical sequence with millisecond integer rounding. Candidate measurements keep one decimal place. Counts were unchanged: first query 120,000 messages, filtered query 60,000 messages, each drilldown 1,200 matching conversations.

Most of the baseline latency came from waiting for a timer at every conversation/message checkpoint. The candidate checks cancellation at the same boundaries but only waits once its roughly 8 ms work budget expires. Pagination additionally avoids rebuilding and sorting the matching summaries. The improvement is primarily removal of scheduling and duplicate-work overhead, rather than faster JSON parsing.

## Reproduce

```sh
npm run benchmark:analytics -- --runs=3 --output=test-results/analytics-benchmark.json
```

The script prints raw samples, medians, browser/Node versions and counts. `CHROME_PATH` optionally chooses a local Chromium executable; otherwise Playwright's installed Chromium is used. No real exports or runtime network requests are needed. Run the same script against the baseline viewer to compare versions; the command does not overwrite this report.
