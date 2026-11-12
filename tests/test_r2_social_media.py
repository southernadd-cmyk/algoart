"""Offline R2 social JPEG publication contracts; no live network or cloud writes."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

modpath=Path(__file__).resolve().parents[1]/"automation/publish-social-r2.py"
spec=importlib.util.spec_from_file_location("social_r2",modpath)
social=importlib.util.module_from_spec(spec)
spec.loader.exec_module(social)

class SocialR2Tests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.day="2026-11-12"
        self.dir=self.root/"gallery"/self.day
        self.dir.mkdir(parents=True)
        self.jpg=self.root/"sample.jpg"
        self.jpg.write_bytes(b"\xff\xd8"+b"test-art-data"*180)
        self.receipt=self.dir/"media-publication.json"
        self.receipt.write_text(json.dumps({"date":self.day,"published":True,
            "stageOnly":False,"pagesFallback":False,"workerBase":social.media.WORKER}))
    def plan(self,role="confluence-portrait-bluesky"):
        return social.plan(self.day,role,self.jpg,archive=self.root/"gallery")
    def test_hash_identity_and_dry_run(self):
        item=self.plan()
        self.assertTrue(item["key"].startswith("editions/2026-11-12/social/"))
        self.assertTrue(item["url"].startswith(social.media.WORKER))
        self.assertTrue(item["key"].endswith(item["sha256"]+".jpg"))
        self.assertEqual(social.publish(item,dry_run=True),item["url"])
    def test_reject_invalid_role_and_non_jpeg(self):
        with self.assertRaises(ValueError):self.plan("../wrong")
        self.jpg.write_bytes(b"BAD"*1000)
        with self.assertRaises(ValueError):self.plan()
    def test_reject_unpublished_or_legacy_edition(self):
        m=json.loads(self.receipt.read_text())
        m["pagesFallback"]=True
        self.receipt.write_text(json.dumps(m))
        with self.assertRaises(ValueError):self.plan()
    def test_cloud_write_fails_closed_off_main(self):
        with patch.dict("os.environ",{"GITHUB_REPOSITORY":"bad/repo",
                                    "GITHUB_REF":"refs/heads/test",
                                    "R2_SOCIAL_ART_ONLY":"true"}):
            with self.assertRaises(ValueError):social.publish(self.plan(),client=object())
    def test_cloud_write_verifies_existing_immutable_bytes(self):
        class Client:
            def __init__(self):self.params=None
            def put_object(self,**kwargs):self.params=kwargs
            def head_object(self,**kwargs):
                return {"ContentLength":self.params["Body"].__len__(),
                        "ContentType":"image/jpeg",
                        "Metadata":{"sha256":self.params["Metadata"]["sha256"]}}
        client=Client()
        item=self.plan()
        with patch.dict("os.environ",{"GITHUB_REPOSITORY":"southernadd-cmyk/algoart",
                    "GITHUB_REF":"refs/heads/main","R2_SOCIAL_ART_ONLY":"true"}):
            with patch.object(social.media,"verify_public",return_value=None) as verified:
                self.assertEqual(social.publish(item,client=client),item["url"])
                verified.assert_called_once()
                self.assertEqual(client.params["IfNoneMatch"],"*")

if __name__=="__main__":unittest.main()
