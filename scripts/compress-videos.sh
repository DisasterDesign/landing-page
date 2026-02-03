#!/bin/bash
# Compress videos for web using ffmpeg
# Target: ~2-5MB per video, 720p, optimized for web

INPUT_DIR="public/c-video"
OUTPUT_DIR="public/c-video/compressed"

mkdir -p "$OUTPUT_DIR"

for video in "$INPUT_DIR"/*.mp4; do
  filename=$(basename "$video")
  echo "Compressing: $filename"

  ffmpeg -i "$video" \
    -vcodec libx264 \
    -crf 28 \
    -preset slow \
    -vf "scale=1280:-2" \
    -an \
    -movflags +faststart \
    "$OUTPUT_DIR/$filename" -y
done

echo "Done! Check $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"
