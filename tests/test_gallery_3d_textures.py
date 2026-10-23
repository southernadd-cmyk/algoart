"""Smoke tests for publication-time 3D textures; no network or WebGL needed."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

SCRIPT = Path(__file__).resolve().parent.parent / "automation" / "build-gallery-3d-textures.py"
SPEC = importlib.util.spec_from_file_location("gallery_3d_textures", SCRIPT)
textures = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(textures)


class GalleryTextureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "gallery"
        self.root.mkdir()
        self.old_root = textures.ROOT
        textures.ROOT = self.root
        self.addCleanup(setattr, textures, "ROOT", self.old_root)
        self.day = self.root / "2026-10-22"
        self.day.mkdir()

    def create_meta(self, filename):
        (self.day / "meta.json").write_text(
            json.dumps({"entries": [{"imageFile": filename}]}), encoding="utf-8"
        )

    def test_two_webp_sizes_keep_original(self):
        filename = "2026-10-22-01-test.jpg"
        source = self.day / filename
        Image.new("RGB", (1600, 1000), (245, 238, 223)).save(source, quality=91)
        original = source.read_bytes()
        self.create_meta(filename)
        textures.build_day(self.day)
        manifest = json.loads((self.day / "3d" / "manifest.json").read_text())
        self.assertEqual(manifest["version"], 1)
        self.assertEqual(set(manifest["images"]), {filename})
        for label, dimension in (("desktop", 1100), ("mobile", 640)):
            asset = self.day / manifest["images"][filename][label]
            with Image.open(asset) as image:
                self.assertEqual(image.format, "WEBP")
                self.assertEqual(max(image.size), dimension)
        self.assertEqual(source.read_bytes(), original)

    def test_older_release_mirror_can_be_optimised(self):
        filename = "v3-live-2026-10-05-c-01.jpg"
        mirror = self.root / "release-art"
        mirror.mkdir()
        Image.new("RGB", (1200, 900), (200, 190, 175)).save(mirror / filename)
        self.create_meta("https://github.com/southernadd-cmyk/algoart/releases/download/algoart-social-live/" + filename)
        textures.build_day(self.day)
        manifest = json.loads((self.day / "3d" / "manifest.json").read_text())
        self.assertIn(filename, manifest["images"])
        self.assertTrue((self.day / "3d" / "v3-live-2026-10-05-c-01-640.webp").is_file())

    def test_missing_archive_image_fails_before_publication(self):
        self.create_meta("missing.jpg")
        with self.assertRaises(FileNotFoundError):
            textures.build_day(self.day)

    def test_unsafe_file_path_is_rejected(self):
        with self.assertRaises(ValueError):
            textures.source_for(self.day, "../other.jpg")


if __name__ == "__main__":
    unittest.main()
