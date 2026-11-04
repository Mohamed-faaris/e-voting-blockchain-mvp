from __future__ import annotations

import sys

import cv2
import numpy as np

from oak_camera import OakCamera, OakCameraError


def main() -> int:
    camera = OakCamera(width=640, height=480, fps=10)
    try:
        camera.start()
        print("DepthAI device:", camera.status(probe=False))
        sequence = 0
        for index in range(10):
            rgb, depth, sequence = camera.get_frame_pair(timeout=5.0, after_sequence=sequence)
            valid_depth = depth[depth > 0]
            depth_range = (
                f"{np.percentile(valid_depth, 5):.0f}–{np.percentile(valid_depth, 95):.0f} mm"
                if valid_depth.size
                else "no valid depth pixels"
            )
            print(
                f"Frame {index + 1:02d}: RGB={rgb.shape}, depth={depth.shape}, "
                f"depth dtype={depth.dtype}, range={depth_range}"
            )
            if index == 9:
                cv2.imwrite("oak_rgb_test.jpg", rgb)
                depth_preview = cv2.normalize(depth, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
                cv2.imwrite("oak_depth_test.png", depth_preview)
        print("PASS: 10 synchronized RGB/depth frames received directly through DepthAI.")
        print("Saved oak_rgb_test.jpg and oak_depth_test.png in the current directory.")
        return 0
    except (OakCameraError, Exception) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    finally:
        camera.stop()


if __name__ == "__main__":
    raise SystemExit(main())
