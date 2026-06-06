# Training the "Hey Paytm" wake word (openWakeWord)

This trains a **custom openWakeWord model** for the phrase **"hey paytm"**. The output `hey_paytm.onnx`
is the small per-word classifier head that the browser app loads (the heavy melspectrogram + embedding
preprocessing is shared and ships with openWakeWord — see `../frontend` integration).

> ⏱ **This is the long pole (~45–70 min on a free Colab T4).** Start it NOW so it bakes while the rest
> of the app gets built. Training runs on Google's servers — you just kick it off and walk away.

## Start it (one-click path)

1. Go to **https://colab.research.google.com** → `File ▸ Upload notebook` → pick
   **`hey_paytm_training.ipynb`** (in this folder). It's the official openWakeWord auto-training notebook
   with one cell pre-set to "hey paytm".
2. **`Runtime ▸ Change runtime type ▸ T4 GPU`** (free tier is fine), Save.
3. **`Runtime ▸ Run all`**. Approve any prompts. Then leave it.
   - It installs deps, downloads negative/background data + RIRs, generates ~20k synthetic "hey paytm"
     clips with Piper TTS, augments, and trains. The "Hey Paytm" config is already filled in — no editing.
4. When it finishes, the model is at **`my_custom_model/hey_paytm.onnx`** (and `.tflite`).
   Download `hey_paytm.onnx` (left panel ▸ Files) and drop it to me — that's what the frontend fork loads.

## What the config is set to (`hey_paytm.yml` / notebook cell)

| key | value | why |
|-----|-------|-----|
| `target_phrase` | `["hey paytm"]` | the wake phrase |
| `model_name` | `hey_paytm` | → `hey_paytm.onnx` |
| `n_samples` | `20000` | docs' recommended floor; demo-reliable |
| `steps` | `20000` | ~1hr on T4 |
| `target_accuracy / recall` | `0.7 / 0.5` | checkpoint selection, modest for a small run |

**Knobs if needed:** model false-fires → raise `n_samples` (50k+) and add look-alike words to
`custom_negative_phrases`. Model misses your voice → also raise `steps`. Short on time → drop
`n_samples` to 10000 / `steps` to 10000 (weaker, but the manual button is our floor anyway).

## Test the model before wiring the browser

Once you have `hey_paytm.onnx`, sanity-check it locally with the repo's venv:

```bash
# from repo root, with the local install we already made (.venv)
.venv/bin/python -c "from openwakeword.model import Model; \
  m = Model(wakeword_models=['training/my_custom_model/hey_paytm.onnx']); print('loaded:', m.models.keys())"
```

…or run openWakeWord's `examples/detect_from_microphone.py` pointed at the model to confirm it fires on
your mic before we spend time on the browser fork.

## Note

`piper-sample-generator` is Linux-only, so generation/training runs on **Colab**, not this Mac.
This Mac's `.venv` has openWakeWord installed only for **loading/testing** the finished model.
