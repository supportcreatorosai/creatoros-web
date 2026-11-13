# Local talking-head renderer

A free, self-hosted replacement for D-ID. It runs [SadTalker](https://github.com/OpenTalker/SadTalker) (Apache-2.0) on this PC's NVIDIA GPU. The Video Generator uses it whenever `TALKING_HEAD_URL` and `TALKING_HEAD_TOKEN` are set in `.env.local`. Gemini creates the narration; SadTalker animates the presenter photo to match it.

It only works while this PC is on and `start.ps1` is running. Public deployments need a GPU server (point `TALKING_HEAD_URL` at it over HTTPS) or D-ID (`VIDEO_PROVIDER=d-id`).

## Start

```powershell
powershell -ExecutionPolicy Bypass -File services/talking-head/start.ps1
```

The server listens on `127.0.0.1:7861` and renders one video at a time. `GET /health` reports whether the models are loaded.

## Install (once)

Installed outside OneDrive in `%USERPROFILE%\creatoros-sadtalker` (about 7 GB). Requires an NVIDIA GPU with 4 GB+ of memory and `ffmpeg` on `PATH`.

1. `git clone --depth 1 https://github.com/OpenTalker/SadTalker.git`
2. In `SadTalker/src/facerender/animate.py`, move the `src.utils.face_enhancer` import inside `if enhancer:` (GFPGAN is optional and does not work with current torchvision).
3. Create a Python 3.10 environment: `python -m uv venv --python 3.10 .venv`
4. Install PyTorch with CUDA: `torch==2.5.1+cu121` and `torchvision==0.20.1+cu121` from `https://download.pytorch.org/whl/cu121`.
5. Install: `numpy==1.23.5 imageio==2.19.3 imageio-ffmpeg==0.4.7 librosa==0.9.2 numba==0.58.1 resampy==0.3.1 pydub==0.25.1 scipy==1.10.1 tqdm yacs==0.1.8 pyyaml joblib==1.1.0 scikit-image==0.19.3 av safetensors opencv-python==4.8.1.78 pillow filterpy kornia==0.6.8 face_alignment==1.3.5 facexlib==0.3.0`
6. Download into `SadTalker/checkpoints`: `SadTalker_V0.0.2_256.safetensors`, `mapping_00109-model.pth.tar` and `mapping_00229-model.pth.tar` from the SadTalker `v0.0.2-rc` release. Download `alignment_WFLW_4HG.pth` and `detection_Resnet50_Final.pth` from the facexlib `v0.1.0` release into `SadTalker/gfpgan/weights`.

## Settings

| Variable | Default | |
| --- | --- | --- |
| `TALKING_HEAD_PREPROCESS` | `full` | `full` animates the face inside the whole photo; `crop` returns a face close-up (faster). |
| `TALKING_HEAD_BATCH_SIZE` | `2` | Lower to `1` if the GPU runs out of memory. |
| `TALKING_HEAD_MAX_IMAGE_SIDE` | `1024` | Larger photos are scaled down before rendering. |
| `TALKING_HEAD_PORT` | `7861` | Must match `TALKING_HEAD_URL`. |
