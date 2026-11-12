from email.message import Message
import hashlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
import zipfile
from unittest.mock import patch

from botocore.exceptions import ClientError

MODULE = Path(__file__).resolve().parents[1] / "automation/r2-edition-backup.py"
SPEC = importlib.util.spec_from_file_location("r2_edition_backup", MODULE)
BACKUP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BACKUP)


class FakeStore:
    def __init__(self):
        self.objects = {}
        self.writes = []

    def get_object(self, Bucket, Key):
        if Key not in self.objects:
            raise ClientError({"Error": {"Code": "NoSuchKey"},
                               "ResponseMetadata": {"HTTPStatusCode": 404}}, "GetObject")
        return {"Body": io.BytesIO(self.objects[Key])}

    def put_object(self, **kwargs):
        assert kwargs["IfNoneMatch"] == "*"
        if kwargs["Key"] in self.objects:
            raise AssertionError("Existing object overwritten")
        self.writes.append(kwargs)
        self.objects[kwargs["Key"]] = kwargs["Body"]


class BackupTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.home = Path(temp.name)
        self.root = self.home / "checkout"
        self.root.mkdir()
        self.date = "2026-11-13"
        self.data = {}
        self.assets = []
        for role, suffix in (("original", "jpg"), ("desktop", "webp"),
                             ("mobile", "webp"), ("cover", "jpg")):
            path = "gallery/" + self.date + "/" + (
                "archive-preview.jpg" if role == "cover" else "3d/asset-" + role + "." + suffix)
            value = (role.encode("ascii") + b"x" * 1500)
            sha = hashlib.sha256(value).hexdigest()
            key = "editions/" + self.date + "/" + (
                "cover-" + sha + ".jpg" if role == "cover" else
                self.date + "-G01/" + role + "-" + sha + "." + suffix)
            self.assets.append({"role": role, "artworkId": None if role == "cover" else self.date+"-G01",
                                "sourcePath": path, "key": key,
                                "sha256": sha, "bytes": len(value),
                                "contentType": "image/jpeg" if suffix == "jpg" else "image/webp",
                                "url": BACKUP.media.WORKER + "/" + key})
            self.data[path] = value
            location = self.root / path
            location.parent.mkdir(parents=True, exist_ok=True)
            location.write_bytes(value)
        # The bundle code accepts a manifest only after media.inspect_manifest
        # verifies the full real edition; here that check is mocked for isolated
        # ZIP integrity and S3 conditional-write tests.
        self.stage = {"date": self.date, "bucket": BACKUP.media.BUCKET,
                      "workerBase": BACKUP.media.WORKER, "count": 1,
                      "preservedShareUrls": [{"id": self.date+"-G01"}],
                      "pagesFallback": False, "published": False, "stageOnly": True,
                      "mediaAssets": self.assets}
        self.published = dict(self.stage, published=True, stageOnly=False)
        self.manifest_path = self.home / "manifest.json"
        self.manifest_path.write_text(__import__("json").dumps(self.stage))
        self.archive_path = self.home / "backup.zip"

    def bundle(self):
        with patch.object(BACKUP.media, "inspect_manifest", return_value=(self.stage, "hash")):
            result = BACKUP.make_bundle(self.manifest_path, self.root, self.archive_path)
        self.assertEqual(result["assets"], 4)
        return result

    def test_exact_bytes_restore_without_worker(self):
        self.bundle()
        contents = BACKUP.load_bundle(self.archive_path, self.published)
        self.assertEqual(contents, self.data)
        restored = BACKUP.restore_local(self.archive_path, self.published, self.home)
        for path, value in self.data.items():
            self.assertEqual((restored / path).read_bytes(), value)

    def test_reject_corrupt_or_foreign_backup_before_restore(self):
        self.bundle()
        with zipfile.ZipFile(self.archive_path, "r") as source:
            entries = {name: source.read(name) for name in source.namelist()}
        first = next(iter(self.data))
        entries[first] = b"z" * len(entries[first])
        with zipfile.ZipFile(self.archive_path, "w") as output:
            for name, value in entries.items():
                output.writestr(name, value)
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            BACKUP.load_bundle(self.archive_path, self.published)
        self.bundle()
        foreign = dict(self.published, preservedShareUrls=[{"id": "not-this-edition"}])
        with self.assertRaisesRegex(ValueError, "published edition"):
            BACKUP.load_bundle(self.archive_path, foreign)

    def test_repairs_only_missing_keys_with_original_bytes(self):
        self.bundle()
        data = BACKUP.load_bundle(self.archive_path, self.published)
        client = FakeStore()
        original_key = self.assets[0]["key"]
        client.objects[original_key] = self.data[self.assets[0]["sourcePath"]]
        with patch.object(BACKUP.media, "verify_public") as public:
            outcome = BACKUP.repair_missing(client, self.published, data)
        self.assertEqual(outcome["restoredMissing"], 3)
        self.assertEqual(outcome["existingVerified"], 1)
        self.assertEqual(len(client.writes), 3)
        self.assertEqual(public.call_count, 3)
        for item in self.assets:
            self.assertEqual(client.objects[item["key"]], self.data[item["sourcePath"]])

    def test_corrupt_existing_key_aborts_all_writes(self):
        self.bundle()
        client = FakeStore()
        client.objects[self.assets[0]["key"]] = b"corrupt"
        data = BACKUP.load_bundle(self.archive_path, self.published)
        with self.assertRaisesRegex(ValueError, "corrupt"):
            BACKUP.repair_missing(client, self.published, data)
        self.assertEqual(client.writes, [])

    def test_repair_is_manual_main_only(self):
        with patch.dict(__import__("os").environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, "manual main-branch"):
                BACKUP.connect_for_repair(self.date, "123")


if __name__ == "__main__":
    unittest.main()
