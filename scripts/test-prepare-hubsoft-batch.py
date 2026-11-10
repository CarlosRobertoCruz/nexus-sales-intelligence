import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('batch_prepare', Path(__file__).with_name('prepare-hubsoft-batch.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BatchPreparationTests(unittest.TestCase):
    def config(self):
        return {'approvedOctoberJob': '11111111-1111-4111-8111-111111111111',
            'snapshotDate': '2026-11-09', 'followupCutoff': '2026-10-31',
            'reports': [{'month': month, 'attendance': f'a-{month}.zip', 'serviceOrders': f'o-{month}.zip'}
                        for month in ['2026-01', '2026-02']]}

    @staticmethod
    def read_report(path, identity, field):
        month = path.stem[-7:]
        return [{'key': ('1' if identity == 'protocolo' else '2') + month[-2:], 'day': month + '-02'}], {
            'filename': path.name, 'fileSha256': 'a' * 64, 'sourceRecords': 1, 'excludedFooters': 0}

    def test_prepares_two_distinct_months_without_approval_or_source_contents(self):
        with patch.object(module.reader, 'read_report', self.read_report):
            files = module.prepare(self.config(), Path('.'))
        manifest = files['manifest.json']
        self.assertEqual(manifest['months'], ['2026-01', '2026-02'])
        self.assertEqual(manifest['cutoff'], '2026-02-28')
        self.assertFalse(manifest['autoPublish'])
        self.assertEqual(manifest['maxCalls'], 5000)
        for month in manifest['months']:
            refs = files[f'references-{month}.json']
            self.assertEqual(refs['attendance']['exportFilters']['start'], month + '-01')
            self.assertEqual(refs['serviceOrders']['filters']['dateField'], 'data_termino_executado')
            self.assertTrue(refs['followup']['pending'])
            self.assertFalse(files[f'evidence-draft-{month}.json']['confirmFilters'])
            self.assertIsNone(files[f'evidence-draft-{month}.json']['reviewer'])
        self.assertEqual(len(files), 5)
        self.assertNotIn('enrichmentStrategy', manifest)

    def test_rejects_wrong_month_instead_of_truncating_the_source(self):
        with patch.object(module.reader, 'read_report', return_value=([{'key': '1', 'day': '2026-03-01'}], {})):
            with self.assertRaisesRegex(ValueError, 'REGISTRO_FORA_DO_MES'):
                module.prepare(self.config(), Path('.'))

    def test_rejects_implicit_or_unbounded_scope(self):
        for months in [[], ['2026-01', '2026-02', '2026-03'], ['2026-02', '2026-01'], ['2026-01', '2026-03'], ['2026-10']]:
            config = self.config()
            config['reports'] = [{'month': month} for month in months]
            with self.assertRaisesRegex(ValueError, 'MESES_LOTE_INVALIDOS'):
                module.prepare(config, Path('.'))

    def test_generated_manifest_plans_offline_in_the_actual_cli(self):
        with patch.object(module.reader, 'read_report', self.read_report):
            manifest = module.prepare(self.config(), Path('.'))['manifest.json']
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as handle:
            json.dump(manifest, handle)
            path = Path(handle.name)
        try:
            result = subprocess.run(['node', 'server/jobs/import-year.mjs', 'plan', str(path)],
                cwd=Path(__file__).resolve().parent.parent, capture_output=True, text=True, check=True)
            plan = json.loads(result.stdout)
            self.assertEqual(plan['months'], ['2026-01', '2026-02'])
            self.assertEqual(plan['days'], 59)
            self.assertEqual(plan['maximumCalls'], 5000)
            self.assertFalse(plan['enabled'])
        finally:
            path.unlink()


if __name__ == '__main__':
    unittest.main()
