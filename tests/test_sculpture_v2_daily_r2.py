"""Synthetic postpublication V2 exercise; no cloud credentials required."""
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from datetime import date
from unittest.mock import Mock
from botocore.exceptions import ClientError

script = Path(__file__).resolve().parents[1]/"automation/publish-sculpture-v2-daily-r2.py"
spec=importlib.util.spec_from_file_location("daily_v2_r2",script)
v2=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)

def write_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data))

class V2DailyR2Tests(unittest.TestCase):
    def fixture(self,path):
        day=max(date.today().isoformat(),"2026-11-11")
        gallery=path/"gallery"
        folder=gallery/day
        folder.mkdir(parents=True)
        source=b"the exact archived JPEG or WebP painting"
        (folder/"portrait.webp").write_bytes(source)
        write_json(folder/"meta.json",{
            "date":day,"entries":[
                {"imageFile":"portrait.jpg","sourceFile":"portrait.webp",
                 "orientation":"portrait","material":"marker"},
                {"imageFile":"collab.jpg","orientation":"portrait",
                 "material":"confluence"}]})
        v1=folder/"3d"/"sculptures.json.gz"
        v1.parent.mkdir(parents=True)
        v1.write_bytes(gzip.compress(json.dumps({
            "version":1,"date":day,"studies":{"portrait.jpg":{}}
        }).encode()))
        root=path/"output"
        report={"schema":"pp-sculpture-v2-bake-report",
                "mode":"single-day","failed":0,"sourceDateCount":1,
                "qualityVariants":["desktop","mobile"],"attempted":2,
                "days":[{"date":day,"eligible":1,"baked":1}]}
        write_json(root/"bake-report.json",report)
        dst=root/day/"3d"/"v2"
        dst.mkdir(parents=True)
        qualities={}
        for quality in ("desktop","mobile"):
            pack={"schema":"pp-sculpture-v2-floor","version":2,
                  "date":day,"quality":quality,"method":"assembly",
                  "geometryRevision":v2.REVISION,"complete":True,
                  "expectedPortraits":1,"bakedPortraits":1,
                  "studies":{"portrait.jpg":{
                      "quality":quality,"geometryRevision":v2.REVISION,
                      "coverage":1,"omittedCells":0,
                      "sourceFile":"portrait.webp",
                      "sourceSha256":v2.digest(source)}}}
            zipped=gzip.compress(json.dumps(pack).encode())
            file="sculptures."+quality+".json.gz"
            (dst/file).write_bytes(zipped)
            qualities[quality]={"file":file,"sha256":v2.digest(zipped),
                                "byteLength":len(zipped),"complete":True,
                                "bakedPortraits":1}
        write_json(dst/"manifest.json",{
            "schema":"pp-sculpture-v2-floor-manifest",
            "revision":v2.REVISION,"date":day,
            "expectedPortraits":1,"samplesOnly":False,
            "qualities":qualities})
        return day,root,gallery

    def test_single_day_is_source_audited_and_confluence_excluded(self):
        with tempfile.TemporaryDirectory() as t:
            day,root,gallery=self.fixture(Path(t))
            manifest,objects=v2.prepare(day,root,gallery)
            self.assertEqual(manifest["date"],day)
            self.assertEqual(manifest["portraits"],1)
            self.assertTrue(manifest["confluenceExcluded"])
            self.assertEqual(len(objects),3)
            self.assertEqual([x["identity"] for x in objects],
                             ["desktop","mobile","manifest"])
            self.assertEqual(objects[-1]["key"],
                f"{v2.PREFIX}/{day}/manifest.json")
            for obj in objects:
                self.assertTrue(obj["key"].startswith(v2.PREFIX+"/"))
                self.assertEqual(v2.digest(obj["data"]),obj["sha256"])
            self.assertEqual(manifest["qualities"]["mobile"]["bytes"],
                objects[1]["bytes"])
            self.assertTrue((gallery/day/"3d"/"sculptures.json.gz").is_file())

    def test_source_mutation_fails_closed_before_upload(self):
        with tempfile.TemporaryDirectory() as t:
            day,root,gallery=self.fixture(Path(t))
            (gallery/day/"portrait.webp").write_bytes(b"changed source")
            with self.assertRaisesRegex(ValueError,"originating painting"):
                v2.prepare(day,root,gallery)

    def test_v1_missing_and_failed_quality_never_upload(self):
        with tempfile.TemporaryDirectory() as t:
            day,root,gallery=self.fixture(Path(t))
            v1=gallery/day/"3d"/"sculptures.json.gz"
            original=v1.read_bytes()
            v1.unlink()
            with self.assertRaisesRegex(ValueError,"V1 gallery"):
                v2.prepare(day,root,gallery)
            v1.write_bytes(original)
            packed=root/day/"3d"/"v2"/"sculptures.mobile.json.gz"
            packed.write_bytes(b"corrupt")
            with self.assertRaisesRegex(ValueError,"quality bytes"):
                v2.prepare(day,root,gallery)

    def test_existing_stable_manifest_never_overwritten(self):
        with tempfile.TemporaryDirectory() as t:
            day,root,gallery=self.fixture(Path(t))
            _,objects=v2.prepare(day,root,gallery)
            item=objects[-1]
            fake=Mock()
            fake.put_object.side_effect=ClientError(
                {"ResponseMetadata":{"HTTPStatusCode":412}},"PutObject")
            fake.head_object.return_value={
                "ContentLength":item["bytes"],
                "Metadata":{"sha256":item["sha256"]}}
            fake.get_object.return_value={"Body":Mock(
                read=lambda:item["data"],close=lambda:None)}
            v2.put_verified(fake,item)
            self.assertEqual(fake.put_object.call_args.kwargs["IfNoneMatch"],"*")
            fake.delete_object.assert_not_called()
            fake.head_object.return_value["Metadata"]["sha256"]="incorrect"
            with self.assertRaisesRegex(ValueError,"collision"):
                v2.put_verified(fake,item)

    def test_source_validation_requires_postarchive_day(self):
        with tempfile.TemporaryDirectory() as t:
            day,root,gallery=self.fixture(Path(t))
            with self.assertRaisesRegex(ValueError,"post-archive"):
                v2.prepare("2026-11-10",root,gallery)

if __name__=="__main__":
    unittest.main()
