from email.message import Message
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock

from botocore.exceptions import ClientError

MODULE = Path(__file__).resolve().parents[1] / "automation/r2-daily-media.py"
SPEC = importlib.util.spec_from_file_location("r2_daily_media", MODULE)
MEDIA = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MEDIA)


class PublicResponse(io.BytesIO):
    status = 200

    def __init__(self, data, asset, origin):
        super().__init__(data)
        self.headers = Message()
        self.headers["Content-Length"] = str(asset["bytes"])
        self.headers["Content-Type"] = asset["contentType"]
        self.headers["Access-Control-Allow-Origin"] = origin


class MediaTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.data = b"a" * 1500
        sha256 = MEDIA.digest(self.data)
        key = f"editions/2026-11-10/2026-11-10-G01/original-{sha256}.jpg"
        self.asset = {"sourcePath": "photo.jpg", "bytes": len(self.data), "key": key,
                      "url": f"{MEDIA.WORKER}/{key}", "sha256": sha256, "contentType": "image/jpeg"}
        (self.root / "photo.jpg").write_bytes(self.data)

    def test_create_once_retry_checks_existing_object(self):
        client = Mock()
        client.put_object.side_effect = ClientError(
            {"ResponseMetadata": {"HTTPStatusCode": 412}}, "PutObject")
        client.head_object.return_value = {"ContentLength": self.asset["bytes"],
            "ContentType": "image/jpeg", "Metadata": {"sha256": self.asset["sha256"]}}
        MEDIA.upload_assets(client, [self.asset], self.root)
        self.assertEqual(client.put_object.call_args.kwargs["IfNoneMatch"], "*")
        client.head_object.return_value["Metadata"]["sha256"] = "wrong"
        with self.assertRaisesRegex(ValueError, "collision"):
            MEDIA.upload_assets(client, [self.asset], self.root)
        client.delete_object.assert_not_called()

    def test_public_hash_and_both_cors_headers_are_required(self):
        opener = Mock()
        def deliver(request, timeout):
            return PublicResponse(self.data if request.method == "GET" else b"", self.asset, MEDIA.PAGES)
        opener.open.side_effect = deliver
        MEDIA.verify_public([self.asset], opener)
        self.assertEqual([call.args[0].method for call in opener.open.call_args_list], ["GET", "HEAD"])
        opener.open.side_effect = lambda *_args, **_kw: PublicResponse(b"z" * 1500, self.asset, MEDIA.PAGES)
        with self.assertRaisesRegex(ValueError, "Public bytes differ"):
            MEDIA.verify_public([self.asset], opener)
        opener.open.side_effect = lambda *_args, **_kw: PublicResponse(self.data, self.asset, "*")
        with self.assertRaisesRegex(ValueError, "metadata mismatch"):
            MEDIA.verify_public([self.asset], opener)


if __name__ == "__main__":
    unittest.main()
