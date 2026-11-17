import copy
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('preset_release', Path(__file__).resolve().parents[1] / 'automation/publish-sculpture-preset.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class PresetReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name)
        self.gallery, self.history, self.reception = [base / name for name in ('gallery', 'history', 'reception')]
        self.day = '2026-11-17'
        self.image = 'test.jpg'
        self.seed = 'TEST-PRESET'
        self.gallery.mkdir()
        (self.gallery / self.day).mkdir()
        self.reception.mkdir()
        self.write(self.gallery / 'archive.json', {'days': [{'date': self.day}]})
        self.write(self.gallery / self.day / 'meta.json', {'date': self.day, 'entries': [
            {'imageFile': self.image, 'seed': self.seed, 'orientation': 'portrait', 'material': 'oil'},
            {'imageFile': 'excluded.jpg', 'seed': 'CONFLUENCE', 'orientation': 'portrait', 'material': 'confluence'}]})
        (self.gallery / self.day / self.image).write_bytes(b'original painting')
        self.folder = self.history / self.day / '3d/v2'
        self.folder.mkdir(parents=True)
        qualities = {}
        for quality in ('desktop', 'mobile'):
            data = self.pack(self.day, quality, self.image, self.seed, b'original painting')
            file = self.folder / f'sculptures.{quality}.json.gz'
            file.write_bytes(data)
            qualities[quality] = {'sha256': release.sha(data)}
        self.write(self.folder / 'manifest.json', {'date': self.day, 'presetId': release.PRESET_ID,
            'parameters': release.PRESET['parameters'], 'expectedPortraits': 1, 'samplesOnly': False, 'qualities': qualities})
        self.write(self.history / 'bake-report.json', {'schema': 'pp-sculpture-v2-bake-report', 'mode': 'historical',
            'failed': 0, 'presetId': release.PRESET_ID, 'parameters': release.PRESET['parameters'],
            'qualityVariants': ['desktop', 'mobile'], 'sourceDateCount': 1, 'days': [{'date': self.day}],
            'attempted': 2, 'builderCommit': 'a' * 40})
        image = 'recursive-divisions-portrait.png'
        seed = 'PP-RECEPTION-RECTS-P-20261110'
        raw = b'original reception painting'
        (self.reception / image).write_bytes(raw)
        self.write(self.reception / 'source.json', {'seed': seed, 'orientation': 'portrait', 'sourceSha256': release.sha(raw)})
        self.write(self.reception / 'manifest.json', {'presetId': release.PRESET_ID})
        for quality in ('desktop', 'mobile'):
            (self.reception / f'sculptures.{quality}.json.gz').write_bytes(self.pack('reception', quality, image, seed, raw))

    def write(self, path, value):
        path.write_text(json.dumps(value))

    def pack(self, date, quality, image, seed, source):
        study = {'imageFile': image, 'sourceFile': image, 'seed': seed, 'method': 'assembly',
            'presetId': release.PRESET_ID, 'parameters': copy.deepcopy(release.PRESET['parameters']),
            'geometryRevision': release.REVISION, 'quality': quality, 'coverage': 1, 'omittedCells': 0,
            'regionCount': 1, 'triangleCount': 2, 'sourceSha256': release.sha(source)}
        data = {'schema': 'pp-sculpture-v2-floor', 'version': 2, 'date': date, 'quality': quality,
            'geometryRevision': release.REVISION, 'method': 'assembly', 'presetId': release.PRESET_ID,
            'parameters': release.PRESET['parameters'], 'complete': True, 'expectedPortraits': 1,
            'bakedPortraits': 1, 'studies': {image: study},
            'padding': ''.join(hashlib.sha256(str(i).encode()).hexdigest() for i in range(100))}
        return gzip.compress(json.dumps(data).encode())

    def test_complete_inventory_uses_only_new_immutable_namespace(self):
        entries, receipt = release.inventory(self.history, self.reception, self.gallery)
        self.assertEqual(receipt['portraits'], 1)
        self.assertEqual(receipt['days'], 1)
        self.assertEqual(len(entries), 8)
        self.assertTrue(all(e['key'].startswith('sculptures-v2/assembly-20261117/') for e in entries))
        self.assertEqual(entries[-1]['label'], 'catalog')
        for entry in entries:
            self.assertEqual(entry['sha256'], release.sha(Path(entry['path']).read_bytes()))

    def test_changed_original_is_rejected(self):
        (self.gallery / self.day / self.image).write_bytes(b'changed painting')
        with self.assertRaisesRegex(ValueError, 'Painting hash differs'):
            release.inventory(self.history, self.reception, self.gallery)

    def test_missing_archive_date_is_rejected(self):
        self.write(self.gallery / 'archive.json', {'days': [{'date': self.day}, {'date': '2026-11-16'}]})
        with self.assertRaisesRegex(ValueError, 'complete published archive'):
            release.inventory(self.history, self.reception, self.gallery)

    def test_wrong_slider_parameters_are_rejected(self):
        file = self.folder / 'sculptures.desktop.json.gz'
        pack = json.loads(gzip.decompress(file.read_bytes()))
        pack['studies'][self.image]['parameters']['depth'] = .85
        file.write_bytes(gzip.compress(json.dumps(pack).encode()))
        with self.assertRaisesRegex(ValueError, 'Unapproved preset study'):
            release.inventory(self.history, self.reception, self.gallery)

    def test_incomplete_pigment_is_rejected(self):
        file = self.folder / 'sculptures.mobile.json.gz'
        pack = json.loads(gzip.decompress(file.read_bytes()))
        pack['studies'][self.image]['omittedCells'] = 1
        file.write_bytes(gzip.compress(json.dumps(pack).encode()))
        with self.assertRaisesRegex(ValueError, 'Unapproved preset study'):
            release.inventory(self.history, self.reception, self.gallery)


if __name__ == '__main__':
    unittest.main()
