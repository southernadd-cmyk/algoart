import base64
import gzip
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from botocore.exceptions import ClientError

spec = importlib.util.spec_from_file_location("publisher", Path(__file__).resolve().parents[1] / "automation/publish-sculpture-splats-r2.py")
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)

class Store:
    def __init__(self):
        self.data = {}
        self.calls = []
    def head_object(self, Bucket, Key):
        if Key not in self.data:
            raise ClientError({"ResponseMetadata": {"HTTPStatusCode": 404}, "Error": {"Code": "NoSuchKey"}}, "HeadObject")
        return {"Metadata": {"sha256": publisher.digest(self.data[Key])}}
    def get_object(self, Bucket, Key):
        return {"Body": io.BytesIO(self.data[Key])}
    def persist(self, client, item):
        self.calls.append(("persist", item["label"]))
        self.data[item["key"]] = Path(item["path"]).read_bytes()
    def verify(self, item):
        self.calls.append(("verify", item["label"]))
        assert publisher.digest(self.data[item["key"]]) == item["sha256"]

def stage(folder, day="reception", mismatch=False):
    for quality, count in publisher.BUDGETS.items():
        points = bytes(count * 44)
        pack = {"schema": "pp-sculpture-splats", "version": 1,
            "algorithm": publisher.ALGORITHM, "geometryRevision": publisher.REVISION,
            "date": day, "quality": quality, "stride": 11, "encoding": "f32le-base64",
            "sourceSha256": "a" * 64, "expectedPortraits": 1,
            "studies": {"source.jpg": {"seed": "different" if mismatch and quality == "desktop" else "seed",
            "imageFile": "source.jpg", "sourceGeometrySha256": "b" * 64,
            "pointCount": count, "points": base64.b64encode(points).decode(),
            "pointsSha256": publisher.digest(points)}}}
        data = gzip.compress(json.dumps(pack).encode(), mtime=0)
        (folder / f"{day}-{quality}-{publisher.digest(data)}.json.gz").write_bytes(data)

class PublicationTest(unittest.TestCase):
    def test_manifest_last_and_verified_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            stage(folder)
            manifest, items = publisher.prepare("reception", folder)
            self.assertEqual(manifest["portraits"], 1)
            self.assertEqual(len(items), 3)
            store = Store()
            publisher.publish(store, items, store.persist, store.verify)
            self.assertEqual(store.calls, [
                ("persist", "mobile"), ("verify", "mobile"),
                ("persist", "desktop"), ("verify", "desktop"),
                ("persist", "manifest"), ("verify", "manifest")])
            store.calls.clear()
            publisher.publish(store, items, store.persist, store.verify)
            self.assertEqual(store.calls, [("verify", "mobile"), ("verify", "desktop"), ("verify", "manifest")])
            store.data[items[-1]["key"]] = b"conflict"
            store.calls.clear()
            with self.assertRaisesRegex(ValueError, "differs"):
                publisher.publish(store, items, store.persist, store.verify)
            self.assertEqual(store.calls, [])
    def test_failure_cannot_announce_ready(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            stage(folder)
            _, items = publisher.prepare("reception", folder)
            store = Store()
            def unavailable(item):
                raise RuntimeError("gateway unavailable")
            with self.assertRaisesRegex(RuntimeError, "gateway unavailable"):
                publisher.publish(store, items, store.persist, unavailable)
            self.assertNotIn(items[-1]["key"], store.data)
    def test_quality_roster_mismatch_and_missing_pack(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            stage(folder, mismatch=True)
            with self.assertRaisesRegex(ValueError, "disagree"):
                publisher.prepare("reception", folder)
            next(folder.glob("*desktop*.json.gz")).unlink()
            with self.assertRaisesRegex(ValueError, "Exactly one"):
                publisher.prepare("reception", folder)

if __name__ == "__main__":
    unittest.main()
