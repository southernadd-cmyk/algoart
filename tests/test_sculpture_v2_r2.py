"""Safety regression tests for permanent Sculpture V2 object storage."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock
from botocore.exceptions import ClientError

path = Path(__file__).resolve().parents[1] / "automation/upload-sculpture-v2-r2.py"
spec = importlib.util.spec_from_file_location("v2_r2_archive", path)
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)

class V2ArchiveTests(unittest.TestCase):
    def test_bucket_and_namespace_do_not_collide_with_v1_or_canary(self):
        self.assertEqual(archive.BUCKET, "proportion-piece-media-test")
        self.assertTrue(archive.PREFIX.startswith("sculptures-v2/"))
        self.assertNotIn("editions/", archive.PREFIX)
        self.assertNotIn("sculptures.json.gz", archive.PREFIX)

    def test_immutable_hash_addressing_and_local_validation(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "mesh.gz"
            binary = b"X" * 1600
            source.write_bytes(binary)
            assets = []
            spec = archive.add_asset(assets, source, "floors/2026-11-10/desktop",
                                     ".json.gz", archive.sha(binary))
            self.assertIn(archive.sha(binary), spec["url"])
            self.assertEqual(assets[0]["bytes"], len(binary))
            self.assertEqual(spec["sha256"], archive.sha(binary))
            with self.assertRaisesRegex(ValueError, "source hash mismatch"):
                archive.add_asset(assets, source, "floors/2026-11-10/mobile",
                                  ".json.gz", "f" * 64)

    def test_existing_object_can_only_be_reused_if_hash_matches(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "mesh.gz"
            binary = b"X" * 1600
            source.write_bytes(binary)
            items = []
            archive.add_asset(items, source, "floors/2026-11-10/desktop",
                              ".json.gz", archive.sha(binary))
            fake = Mock()
            fake.put_object.side_effect = ClientError(
                {"ResponseMetadata": {"HTTPStatusCode": 412}}, "PutObject")
            fake.head_object.return_value = {
                "ContentLength": len(binary), "ContentType": "application/gzip",
                "Metadata": {"sha256": archive.sha(binary)}}
            fake.get_object.return_value = {"Body": Mock(
                iter_chunks=lambda chunk_size: [binary], close=lambda: None)}
            archive.persist(fake, items[0])
            self.assertEqual(fake.put_object.call_args.kwargs["IfNoneMatch"], "*")
            self.assertEqual(fake.put_object.call_args.kwargs["Bucket"], archive.BUCKET)
            fake.delete_object.assert_not_called()
            fake.head_object.return_value["Metadata"]["sha256"] = "wrong"
            with self.assertRaisesRegex(ValueError, "collision"):
                archive.persist(fake, items[0])

    def test_read_back_hash_is_required(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "mesh.gz"
            binary = b"X" * 1600
            source.write_bytes(binary)
            items = []
            archive.add_asset(items, source, "floors/2026-11-10/desktop",
                              ".json.gz", archive.sha(binary))
            fake = Mock()
            fake.head_object.return_value = {
                "ContentLength": len(binary), "ContentType": "application/gzip",
                "Metadata": {"sha256": archive.sha(binary)}}
            fake.get_object.return_value = {"Body": Mock(
                iter_chunks=lambda chunk_size: [b"Y" * len(binary)],
                close=lambda: None)}
            with self.assertRaisesRegex(ValueError, "Stored bytes"):
                archive.persist(fake, items[0])

if __name__ == "__main__":
    unittest.main()
