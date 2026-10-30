#!/usr/bin/env python3
"""Propose (not automatically certify) score-to-EXACT-recording piano alignments.

Input: immutable-ish published DCMLab score note TSVs and the gallery's own OGG files.
Output: candidate bar->seconds mapping with fit metrics. A human must audit
musical landmarks and the handling of repeats before publishing as verified.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import csv
from fractions import Fraction
import hashlib
import io
import json
import math
from pathlib import Path
import urllib.request

import numpy as np
import librosa

DATASETS = {
    "debussy": {
        "notes": "https://raw.githubusercontent.com/DCMLab/debussy_images/main/notes/l110-01_images_reflets.tsv",
        "measures": "https://raw.githubusercontent.com/DCMLab/debussy_images/main/measures/l110-01_images_reflets.tsv",
        "audio": "gallery/visit/audio/debussy-reflets-dans-leau.ogg",
        "score": "DCMLab/debussy_images l110-01_images_reflets (CC BY-NC-SA 4.0)",
        "source": "https://github.com/DCMLab/debussy_images",
        "barCount": 95
    },
    "mozart": {
        "notes": "https://raw.githubusercontent.com/DCMLab/mozart_piano_sonatas/main/notes/K545-1.notes.tsv",
        "measures": "https://raw.githubusercontent.com/DCMLab/mozart_piano_sonatas/main/measures/K545-1.measures.tsv",
        "audio": "gallery/visit/audio/mozart-k545-allegro.ogg",
        "score": "DCMLab/mozart_piano_sonatas K545-1 (CC BY-NC-SA 4.0)",
        "source": "https://github.com/DCMLab/mozart_piano_sonatas",
        "barCount": 73
    }
}
FRACTIONS = [1 / ((1 + math.sqrt(5)) / 2) ** 3,
             1 / ((1 + math.sqrt(5)) / 2) ** 2,
             1 / ((1 + math.sqrt(5)) / 2),
             1 - 1 / ((1 + math.sqrt(5)) / 2) ** 3]
HOP = 1024
SR = 11025
QB_STEP = .5


def fetch_tsv(url):
    request = urllib.request.Request(url, headers={"User-Agent": "ProportionPieceScoreAlignment/1.0"})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read()
    return list(csv.DictReader(io.StringIO(data.decode("utf-8-sig")), delimiter="\t")), hashlib.sha256(data).hexdigest()


def q(value):
    return float(Fraction(value)) if value else 0.


def parse_notes(note_rows, measure_rows):
    bars = []
    for row in measure_rows:
        bars.append({
            "bar": int(row["mn"]),
            "mc": int(row["mc"]),
            "start": q(row["quarterbeats"]),
            "length": q(row["duration_qb"]),
            "repeat": row.get("repeats", ""),
            "next": row.get("next", "")
        })
    assert len(bars) == len(set(x["bar"] for x in bars)), "Duplicate bar numbering"
    starts = {row["mc"]: row["start"] for row in bars}
    events = defaultdict(list)
    for row in note_rows:
        mc = int(row["mc"])
        try:
            pitch = int(row["midi"])
        except (KeyError, ValueError):
            continue
        if not (26 <= pitch <= 100):
            continue
        onset = q(row["quarterbeats"]) - starts[mc]
        duration = q(row["duration_qb"])
        # Pitches at ties still contribute to the harmonic template.
        if duration <= 0:
            continue
        events[mc].append((onset, duration, pitch))
    return bars, events


def order_scenarios(kind):
    if kind == "debussy":
        return {"unrepeated": list(range(1, 96))}
    # Mozart's first repeat finishes at bar 28; the second ends at bar 73.
    # Examine interpretations with neither, one, or both written repeats.
    return {
        "no_repeats": list(range(1, 74)),
        "exposition_repeat": list(range(1, 29)) * 2 + list(range(29, 74)),
        "second_repeat": list(range(1, 29)) + list(range(29, 74)) * 2,
        "both_repeats": list(range(1, 29)) * 2 + list(range(29, 74)) * 2
    }


def build_score_chroma(order, bars, notes):
    measures = {b["bar"]: b for b in bars}
    total = sum(measures[bar]["length"] for bar in order)
    n = math.ceil(total / QB_STEP) + 1
    chroma = np.zeros((12, n), dtype=np.float32)
    starts = []
    t = 0.
    for occurrence, bar in enumerate(order):
        entry = measures[bar]
        starts.append((occurrence, bar, t))
        for onset, duration, pitch in notes[entry["mc"]]:
            # Sound retains a strong attack and a lighter tail; don't hold piano
            # notes at full strength through entire pedal-indicated duration.
            first = int(max(0, math.floor((t + onset) / QB_STEP)))
            last = int(min(n, math.ceil((t + onset + max(.25, min(duration, 2))) / QB_STEP)))
            if first >= n: continue
            weight = .7 if pitch < 44 else 1.0
            chroma[pitch % 12, first:min(n, first + 2)] += weight
            if last > first + 2:
                chroma[pitch % 12, first + 2:last] += .35 * weight
        t += entry["length"]
    # Gentle score-domain smoothing reduces sensitivity to onset jitter.
    from scipy.ndimage import gaussian_filter1d
    chroma = gaussian_filter1d(chroma, .8, axis=1)
    # Normalized chroma columns; avoid division by zero.
    norms = np.linalg.norm(chroma, axis=0)
    chroma /= np.maximum(norms, .00001)
    return chroma, starts, t


def extract_chroma(path):
    # Load same OGG bytes the gallery visitors hear.
    audio, sr = librosa.load(path, sr=SR, mono=True)
    duration = len(audio) / SR
    # CQT is pitch-aware and considerably more informative for piano than raw RMS.
    feature = librosa.feature.chroma_cqt(y=audio, sr=SR, hop_length=HOP,
                                        n_chroma=12, fmin=librosa.note_to_hz("C1"))
    feature = np.maximum(feature, 0)
    feature = np.power(feature, 1.4)
    norms = np.linalg.norm(feature, axis=0)
    feature /= np.maximum(norms, .00001)
    return feature.astype(np.float32), duration, hashlib.sha256(path.read_bytes()).hexdigest()


def align(score, audio):
    # Audio and score may progress at different rates; DTW allows rubato.
    # Distances are cosine distance, with 0 being a perfect chroma match.
    accum, path = librosa.sequence.dtw(
        X=score, Y=audio, metric="cosine", backtrack=True)
    path = path[::-1]
    # Map every score frame to a median audio time.
    matched = defaultdict(list)
    for si, ai in path:
        matched[int(si)].append(int(ai))
    x = np.array(sorted(matched), dtype=float)
    times = np.array([np.median(matched[int(v)]) * HOP / SR for v in x], dtype=float)
    whole = np.interp(np.arange(score.shape[1]), x, times)
    whole = np.maximum.accumulate(whole)
    cosines = np.sum(score[:, path[:, 0]] * audio[:, path[:, 1]], axis=0)
    return {
        "time": whole,
        "cost": float(accum[-1, -1]) / len(path),
        "similarity": float(np.mean(cosines)),
        "medianSimilarity": float(np.median(cosines)),
        "pathLength": int(len(path)),
        "scoreFrames": int(score.shape[1]),
        "audioFrames": int(audio.shape[1])
    }


def run(kind):
    dataset = DATASETS[kind]
    base = Path(__file__).resolve().parent.parent
    audio_path = base / dataset["audio"]
    assert audio_path.exists(), f"Recording unavailable: {audio_path}"
    note_rows, note_hash = fetch_tsv(dataset["notes"])
    measure_rows, measure_hash = fetch_tsv(dataset["measures"])
    bars, notes = parse_notes(note_rows, measure_rows)
    assert len(bars) == dataset["barCount"], f"Score size mismatch: {len(bars)}"
    audio, duration, digest = extract_chroma(audio_path)
    print(f"{kind}: {len(bars)} written bars, {len(note_rows)} score notes, audio {duration:.2f}s sha256={digest[:16]}", flush=True)
    candidates = []
    for scenario, order in order_scenarios(kind).items():
        score, starts, beats = build_score_chroma(order, bars, notes)
        result = align(score, audio)
        locations = []
        for occurrence, bar, qb in starts:
            ix = min(score.shape[1]-1, round(qb/QB_STEP))
            locations.append({
                "bar":bar, "occurrence":sum(1 for prev in starts[:occurrence] if prev[1]==bar)+1,
                "time":round(float(result["time"][ix]), 2)
            })
        # The framewise time vector is used to extract bar anchors, but must not
        # be serialized in the compact candidate report.
        result.pop('time', None)
        # Relative performance rate: detect clearly implausible repeat hypotheses
        # by how much musical score has to be compressed into the actual audio.
        seconds_per_qb = duration / beats
        result.update({
            "scenario":scenario,
            "barsPlayed":len(order),
            "writtenBars":len(bars),
            "quarterbeatsPlayed":beats,
            "secondsPerQuarterbeat":round(seconds_per_qb, 3),
            "barStarts":locations
        })
        print(f"  {scenario}: score {beats:.1f} qb, {seconds_per_qb:.3f} sec/qb, match {result['similarity']:.3f}, cost {result['cost']:.3f}",flush=True)
        candidates.append(result)
    # Prefer match quality on full scored-to-played sequences, but save every
    # scenario so repeat ambiguities are auditable and NOT automatically certified.
    chosen = max(candidates, key=lambda s:s["similarity"])
    print(f"  best provisional scenario: {chosen['scenario']}",flush=True)
    examples = []
    for fraction in FRACTIONS:
        bar = 1 + (len(bars)-1)*fraction
        nearest = round(bar)
        times = [row["time"] for row in chosen["barStarts"] if row["bar"]==nearest]
        examples.append({
            "fraction":round(fraction,8),
            "scoreBarApprox":round(bar,2),
            "nearestWrittenBar":nearest,
            "candidateRecordingTimes":times
        })
        print(f"    {fraction*100:.1f}% score near bar {nearest}: times {times}",flush=True)
    return {
        "status":"candidate_REQUIRES_musical_verification",
        "track":kind,
        "sourceScore":dataset["score"],
        "scoreURL":dataset["source"],
        "audioFile":dataset["audio"],
        "audioSha256":digest,
        "notesSha256":note_hash,
        "measuresSha256":measure_hash,
        "audioDuration":round(duration,3),
        "algorithm":"librosa chroma_cqt 12-bin + global cosine DTW; no hand-audited anchors",
        "candidateScenarios":candidates,
        "selectedForReview":chosen["scenario"],
        "examples":examples,
        "caveats":[
            "DTW does not itself certify the correspondence at individual bars.",
            "Different performances and Mozart repeat choices change all timestamps.",
            "Piano rubato and sustain can shift apparent chord onsets.",
            "Written-score fraction is not elapsed-time fraction.",
            "Bar counts follow the DCMLab transcription, not the previous UI guess."
        ]
    }


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--track",choices=["debussy","mozart","both"],default="both")
    parser.add_argument("--out",default="gramophone-alignment-candidates.json")
    args=parser.parse_args()
    tracks=list(DATASETS) if args.track=="both" else [args.track]
    data={track:run(track) for track in tracks}
    Path(args.out).write_text(json.dumps(data,indent=2,ensure_ascii=False))
    print(f"Saved alignment candidates to {args.out}",flush=True)
