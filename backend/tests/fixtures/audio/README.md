# Deterministic audio fixtures

These short synthetic 440 Hz tones contain no third-party recording. Generate them with the backend test image:

```sh
ffmpeg -f lavfi -i 'sine=frequency=440:duration=0.1' -c:a libopus -b:a 12k valid-webm-opus.webm
ffmpeg -f lavfi -i 'sine=frequency=440:duration=0.1' -c:a libvorbis -q:a 2 webm-vorbis.webm
ffmpeg -f lavfi -i 'sine=frequency=440:duration=0.1' not-webm.wav
```

Expected properties are respectively WebM/Opus (accepted), WebM/Vorbis (rejected), and WAV/PCM (rejected). Each fixture must remain below 20 KB.
