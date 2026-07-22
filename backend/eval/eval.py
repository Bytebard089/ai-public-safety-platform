"""
Evaluation harness for the scam detection engine.

Flags a transcript as "positive" (scam-flagged) if verdict is "medium" or
"high"; "low" counts as negative. This threshold matches what the UI
actually surfaces to a citizen (a "low" verdict does not trigger any
warning), so it's the operationally correct definition of a false positive.

Run: python3 eval.py [--live]
  --live   also score through the LLM layer (requires `ollama serve` with
           the model in OLLAMA_MODEL running locally). Without this flag,
           only the rule layer is evaluated, since it runs standalone with
           zero setup — this is what's reported by default in this repo's
           submitted numbers, generated in an offline environment.
"""

import argparse
import json
import sys

sys.path.insert(0, "..")
from detector import analyze  # noqa: E402

from sklearn.metrics import confusion_matrix, precision_recall_fscore_support
import matplotlib.pyplot as plt


def load_dataset():
    with open("eval_dataset.json") as f:
        return json.load(f)["examples"]


def run(live: bool):
    dataset = load_dataset()
    y_true, y_pred, subtypes, llm_used = [], [], [], []

    for ex in dataset:
        result = analyze(ex["text"], use_llm=live)
        flagged = 1 if result.verdict in ("medium", "high") else 0
        y_true.append(ex["label"])
        y_pred.append(flagged)
        subtypes.append(ex["subtype"])
        llm_used.append(result.llm_available)

    precision, recall, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="binary", zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    fpr = fp / (fp + tn) if (fp + tn) else 0.0

    # Break FPR down by hard vs. easy negatives — this is the number that
    # actually matters, since a low aggregate FPR can hide a bad hard-negative
    # rate if easy negatives dominate the denominator.
    hard_neg_idx = [i for i, s in enumerate(subtypes) if s == "benign_hard"]
    easy_neg_idx = [i for i, s in enumerate(subtypes) if s == "benign_easy"]
    hard_fp = sum(y_pred[i] for i in hard_neg_idx)
    easy_fp = sum(y_pred[i] for i in easy_neg_idx)
    hard_fpr = hard_fp / len(hard_neg_idx) if hard_neg_idx else 0.0
    easy_fpr = easy_fp / len(easy_neg_idx) if easy_neg_idx else 0.0

    n_llm_scored = sum(llm_used)
    if not live:
        mode = "rule_layer_only (offline eval environment)"
    elif n_llm_scored == len(dataset):
        mode = "rule+LLM hybrid"
    elif n_llm_scored == 0:
        mode = "rule_layer_only (--live requested but Ollama unreachable — fell back automatically)"
    else:
        mode = f"mixed ({n_llm_scored}/{len(dataset)} examples scored with LLM, rest fell back to rules)"

    report = {
        "mode": mode,
        "n_examples": len(dataset),
        "n_scam": sum(y_true),
        "n_benign": len(y_true) - sum(y_true),
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "f1": round(f1, 3),
        "false_positive_rate_overall": round(fpr, 3),
        "false_positive_rate_hard_negatives": round(hard_fpr, 3),
        "false_positive_rate_easy_negatives": round(easy_fpr, 3),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }

    with open("eval_report.json", "w") as f:
        json.dump(report, f, indent=2)

    _plot_confusion_matrix(cm)
    _print_report(report)
    return report


def _plot_confusion_matrix(cm):
    fig, ax = plt.subplots(figsize=(4.2, 4))
    ax.imshow(cm, cmap="Blues")
    labels = ["Benign", "Scam"]
    ax.set_xticks([0, 1]); ax.set_xticklabels(labels)
    ax.set_yticks([0, 1]); ax.set_yticklabels(labels)
    ax.set_xlabel("Predicted"); ax.set_ylabel("Actual")
    ax.set_title("Rule-layer confusion matrix")
    for i in range(2):
        for j in range(2):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                     color="white" if cm[i, j] > cm.max() / 2 else "black", fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig("confusion_matrix.png", dpi=200, facecolor="white")


def _print_report(report):
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args()
    run(live=args.live)
