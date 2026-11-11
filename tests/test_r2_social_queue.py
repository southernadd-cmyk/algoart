"""Offline queue freeze/restore regression: no Cloudflare credentials required."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

script=Path(__file__).resolve().parents[1]/"automation/social-r2-queue.py"
spec=importlib.util.spec_from_file_location("social_queue",script)
queue_module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(queue_module)

class Response:
    def __init__(self,data):
        self.status=200
        self.headers={"Content-Type":"image/jpeg"}
        self.data=data
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def read(self,n):return self.data[:n]

class SocialQueueTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory=Path(self.temp.name)
        self.day="2026-11-12"
        self.a=b"\xff\xd8"+b"main-image"*180
        self.b=b"\xff\xd8"+b"meta-image"*180
        (self.directory/"main.jpg").write_bytes(self.a)
        (self.directory/"meta.jpg").write_bytes(self.b)
        (self.directory/"queue.json").write_text(json.dumps({
            "date":self.day,
            "entries":[{"imageFile":"main.jpg","instagramImageFile":"meta.jpg"}]
        }))
    def mapping(self):
        return {name:{"url":queue_module.social.media.WORKER+
                   "/editions/"+self.day+"/social/portrait-"+str(index)+"-"+
                   hashlib.sha256(data).hexdigest()+".jpg",
                   "bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()}
                for index,(name,data) in enumerate([("main.jpg",self.a),("meta.jpg",self.b)])}
    def test_freeze_dry_run_is_immutable_and_does_not_modify_queue(self):
        def mock_plan(day,role,source):
            data=source.read_bytes()
            sha=hashlib.sha256(data).hexdigest()
            return {"key":"editions/"+day+"/social/"+role+"-"+sha+".jpg",
                "url":queue_module.social.media.WORKER+"/editions/"+day+"/social/"+role+"-"+sha+".jpg",
                "data":data,"sha256":sha,"bytes":len(data)}
        with patch.object(queue_module.social,"plan",side_effect=mock_plan):
            result=queue_module.freeze(self.day,"portrait",self.directory,dry_run=True)
        self.assertEqual(set(result),{"main.jpg","meta.jpg"})
        self.assertNotIn("r2Media",json.loads((self.directory/"queue.json").read_text()))
    def test_restore_and_lookup_require_exact_hash(self):
        q=json.loads((self.directory/"queue.json").read_text())
        q["r2Media"]=self.mapping()
        (self.directory/"queue.json").write_text(json.dumps(q))
        (self.directory/"main.jpg").unlink()
        (self.directory/"meta.jpg").unlink()
        class Opener:
            def open(self,request,timeout):
                if request.full_url==q["r2Media"]["main.jpg"]["url"]:return Response(self_a)
                if request.full_url==q["r2Media"]["meta.jpg"]["url"]:return Response(self_b)
                raise AssertionError("Unexpected URL")
        self_a,self_b=self.a,self.b
        queue_module.restore(self.day,self.directory,opener=Opener())
        urls=queue_module.lookup(self.day,self.directory,"main.jpg","meta.jpg")
        self.assertEqual(urls,[q["r2Media"]["main.jpg"]["url"],q["r2Media"]["meta.jpg"]["url"]])
        (self.directory/"main.jpg").write_bytes(b"tampered")
        with self.assertRaises(ValueError):queue_module.lookup(self.day,self.directory,"main.jpg","meta.jpg")
    def test_reject_untrusted_frozen_url(self):
        q=json.loads((self.directory/"queue.json").read_text())
        q["r2Media"]=self.mapping()
        q["r2Media"]["main.jpg"]["url"]="https://evil.invalid/media.jpg"
        (self.directory/"queue.json").write_text(json.dumps(q))
        with self.assertRaises(ValueError):
            queue_module.restore(self.day,self.directory,opener=object())
    def test_reject_path_traversal(self):
        q={"date":self.day,"entries":[{"imageFile":"../escape.jpg"}]}
        with self.assertRaises(ValueError):queue_module.queue_files(q)

if __name__=="__main__":unittest.main()
