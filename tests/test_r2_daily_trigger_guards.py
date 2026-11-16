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
    def check_trigger(self, event, *, ref='refs/heads/main', day=None, enabled='true', allowed=True,
                      recovery_date=None, auto_from='2026-11-15'):
        today = datetime.now(ZoneInfo('Europe/London')).date().isoformat()
        day = day or today
        env = dict(GITHUB_EVENT_NAME=event, GITHUB_REF=ref,
                   GITHUB_REPOSITORY='southernadd-cmyk/algoart', R2_ART_ONLY=enabled,
                   PP_R2_ART_ONLY_AUTO_FROM=auto_from, PP_R2_ART_ONLY_SOCIAL_READY='true',
                   V2_PUBLISH_DATE=day, R2_ACCOUNT_ID='a'*32,
                   R2_MEDIA_ACCESS_KEY_ID='test', R2_MEDIA_SECRET_ACCESS_KEY='test')
        if recovery_date is not None:
            env['R2_RECOVERY_DATE'] = recovery_date
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

    def test_dispatched_recent_missed_day_is_allowed(self):
        today = datetime.now(ZoneInfo('Europe/London')).date()
        for back in (1, 7):
            day = (today - timedelta(days=back)).isoformat()
            self.check_trigger('workflow_dispatch', day=day, recovery_date=day, auto_from='2026-01-01')

    def test_missed_day_recovery_is_narrow(self):
        today = datetime.now(ZoneInfo('Europe/London')).date()
        yesterday = (today - timedelta(days=1)).isoformat()
        old = (today - timedelta(days=8)).isoformat()
        # Old dates, scheduled events, a mismatched recovery date and dates
        # before the R2-only start all stay rejected.
        self.check_trigger('workflow_dispatch', day=old, recovery_date=old, auto_from='2026-01-01', allowed=False)
        self.check_trigger('schedule', day=yesterday, recovery_date=yesterday, auto_from='2026-01-01', allowed=False)
        self.check_trigger('workflow_dispatch', day=yesterday, recovery_date=old, auto_from='2026-01-01', allowed=False)
        self.check_trigger('workflow_dispatch', day=yesterday, recovery_date=yesterday, auto_from=today.isoformat(), allowed=False)

    def test_unrelated_events_are_rejected(self):
        self.check_trigger('pull_request', allowed=False)


if __name__ == '__main__':
    unittest.main()
