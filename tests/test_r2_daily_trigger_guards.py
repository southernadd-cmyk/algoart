"""Exercise morning recovery authorization without making cloud requests."""
import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parents[1] / 'automation' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


media = load('trigger_media', 'r2-daily-media.py')
sculptures = load('trigger_sculptures', 'publish-sculpture-v2-daily-r2.py')


class DailyTriggerGuards(unittest.TestCase):
    def check_trigger(self, event, *, ref='refs/heads/main', day=None, enabled='true', allowed=True):
        today = datetime.now(ZoneInfo('Europe/London')).date().isoformat()
        day = day or today
        env = dict(GITHUB_EVENT_NAME=event, GITHUB_REF=ref,
                   GITHUB_REPOSITORY='southernadd-cmyk/algoart', R2_ART_ONLY=enabled,
                   PP_R2_ART_ONLY_AUTO_FROM='2026-11-15', PP_R2_ART_ONLY_SOCIAL_READY='true',
                   V2_PUBLISH_DATE=day, R2_ACCOUNT_ID='a'*32,
                   R2_MEDIA_ACCESS_KEY_ID='test', R2_MEDIA_SECRET_ACCESS_KEY='test')
        with patch.dict(os.environ, env, clear=True), patch('boto3.client') as client:
            for call in (lambda: media.media_client(day), sculptures.connect):
                with self.subTest(event=event, call=call, allowed=allowed):
                    client.reset_mock()
                    if allowed:
                        call()
                        client.assert_called_once()
                    else:
                        with self.assertRaises(ValueError):
                            call()
                        client.assert_not_called()

    def test_current_main_daily_events(self):
        for event in ('schedule', 'push', 'workflow_dispatch'):
            self.check_trigger(event)

    def test_manual_recovery_rejects_other_refs_and_inactive_rollout(self):
        self.check_trigger('workflow_dispatch', ref='refs/heads/test', allowed=False)
        self.check_trigger('workflow_dispatch', enabled='false', allowed=False)

    def test_unarmed_historical_manual_publication_is_rejected(self):
        yesterday = (datetime.now(ZoneInfo('Europe/London')).date() - timedelta(days=1)).isoformat()
        self.check_trigger('workflow_dispatch', day=yesterday, allowed=False)

    def test_unrelated_events_are_rejected(self):
        self.check_trigger('pull_request', allowed=False)


if __name__ == '__main__':
    unittest.main()
