"""Comprehensive evaluation metrics for point-wise and streaming anomaly detection."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional
import numpy as np
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


@dataclass
class PointMetrics:
    """Standard point-wise evaluation metrics."""
    precision: float
    recall: float
    f1: float
    pr_auc: Optional[float]
    roc_auc: Optional[float]
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int
    false_positive_rate: float
    false_alarm_rate_per_1000: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EventMetrics:
    """Streaming event-based metrics tracking detection delays and event-level recovery."""
    total_events: int
    detected_events: int
    event_recall: float
    mean_detection_delay_steps: float
    spurious_alarm_events: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def compute_point_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    scores: Optional[np.ndarray] = None,
) -> PointMetrics:
    """Calculate point-wise classification performance metrics."""
    y_t = np.asarray(y_true, dtype=int)
    y_p = np.asarray(y_pred, dtype=int)

    # Basic counts
    tn, fp, fn, tp = confusion_matrix(y_t, y_p, labels=[0, 1]).ravel()

    prec = float(precision_score(y_t, y_p, zero_division=0.0))
    rec = float(recall_score(y_t, y_p, zero_division=0.0))
    f1 = float(f1_score(y_t, y_p, zero_division=0.0))
    fpr = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
    fa_per_1k = float((fp / len(y_t)) * 1000.0) if len(y_t) > 0 else 0.0

    pr_auc = None
    roc_auc = None
    if scores is not None and len(np.unique(y_t)) > 1:
        try:
            pr_auc = float(average_precision_score(y_t, scores))
            roc_auc = float(roc_auc_score(y_t, scores))
        except Exception:
            pass

    return PointMetrics(
        precision=prec,
        recall=rec,
        f1=f1,
        pr_auc=pr_auc,
        roc_auc=roc_auc,
        true_positives=int(tp),
        false_positives=int(fp),
        true_negatives=int(tn),
        false_negatives=int(fn),
        false_positive_rate=fpr,
        false_alarm_rate_per_1000=fa_per_1k,
    )


def compute_event_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    event_ids: Optional[List[Optional[str]]] = None,
) -> EventMetrics:
    """Calculate streaming event metrics (event recall, delay from event start).
    
    If event_ids is not provided, extracts contiguous runs of 1s in y_true as distinct events.
    """
    y_t = np.asarray(y_true, dtype=int)
    y_p = np.asarray(y_pred, dtype=int)
    n = len(y_t)

    events: List[Tuple[int, int]] = []
    # Identify contiguous anomalous segments in ground truth
    in_event = False
    start_idx = 0
    for i in range(n):
        if y_t[i] == 1 and not in_event:
            in_event = True
            start_idx = i
        elif y_t[i] == 0 and in_event:
            in_event = False
            events.append((start_idx, i - 1))
    if in_event:
        events.append((start_idx, n - 1))

    total_events = len(events)
    if total_events == 0:
        return EventMetrics(
            total_events=0,
            detected_events=0,
            event_recall=1.0,
            mean_detection_delay_steps=0.0,
            spurious_alarm_events=int(np.sum(y_p == 1)),
        )

    detected_count = 0
    delays: List[int] = []

    for st, en in events:
        # Check if model flagged any observation in [st, en]
        segment_pred = y_p[st : en + 1]
        flag_indices = np.where(segment_pred == 1)[0]
        if len(flag_indices) > 0:
            detected_count += 1
            # Delay is distance from event onset to first flag
            delays.append(int(flag_indices[0]))

    event_rec = float(detected_count / total_events) if total_events > 0 else 0.0
    mean_delay = float(np.mean(delays)) if delays else 0.0

    return EventMetrics(
        total_events=total_events,
        detected_events=detected_count,
        event_recall=event_rec,
        mean_detection_delay_steps=mean_delay,
        spurious_alarm_events=int(np.sum((y_p == 1) & (y_t == 0))),
    )
