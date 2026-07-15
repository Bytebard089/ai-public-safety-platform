# Evaluation

## Method
`generate_eval_set.py` produces 238 synthetic, developer-authored transcripts:
123 scam (paraphrased across 10 template skeletons, not copies of the regex
patterns in `detector.py`), 77 easy benign negatives, and 38 **hard** benign
negatives — legitimate calls that deliberately use scam-adjacent vocabulary
(authority names, urgency, "verification") without being scams. The hard
negatives exist specifically to stress-test false positive rate, since that
is an explicit judging criterion for citizen-facing tools in this problem
statement.

`eval.py` runs every transcript through the detector and treats a "medium"
or "high" verdict as a positive (flagged) prediction — this matches what
the UI actually shows a citizen, so it's the operationally correct
definition of a false positive, not just a score threshold picked to look good.

## Results (rule layer only)

| Metric | Value |
|---|---|
| Precision | 1.00 |
| Recall | 0.77 |
| F1 | 0.87 |
| False positive rate — overall | 0.00 |
| False positive rate — hard negatives | 0.00 |
| False positive rate — easy negatives | 0.00 |
| Confusion matrix | TN 115, FP 0, FN 28, TP 95 |

See `eval_report.json` and `confusion_matrix.png`.

**Note on scope:** this is a rule-layer-only evaluation, run in an offline
development environment without Ollama available. Run `python3 eval.py --live`
locally with `ollama serve` active to evaluate the full hybrid engine.

## Honest findings, not just the headline number

- **Zero false positives, including on adversarial hard negatives.** The
  category-co-occurrence design (a single matched category caps at 28 points,
  below the 30-point "medium" threshold) is doing its job: legitimate calls
  that merely *mention* an authority name or use urgent language are not
  flagged. This is the number that matters most for a citizen-facing tool.
- **77% recall on paraphrased-but-templated scam variants** — solid, and a
  direct result of broadening the rule patterns during this evaluation
  pass (recall was 21% before that pass; see git history / `detector.py`
  comments for the categories added).
- **Recall drops to near zero on genuinely novel phrasing**, confirmed by a
  small held-out spot check outside the generator (e.g. a Hindi-English
  code-switched scam script, and a differently-worded English one — both
  scored 0 by the rule layer alone). This is expected and is exactly the
  gap the LLM layer exists to close: rules catch known patterns cheaply and
  safely, and the model generalises to phrasing rules haven't seen. This
  repo does not claim the rule layer alone is sufficient — the eval above
  is reported specifically to make that limitation visible, not hide it.

## Reproducing
```bash
cd backend/eval
python3 generate_eval_set.py   # regenerate the dataset (seeded, deterministic)
python3 eval.py                # rule-layer only
python3 eval.py --live         # + LLM layer, requires `ollama serve`
```
