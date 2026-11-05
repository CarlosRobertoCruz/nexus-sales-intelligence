import importlib.util
from copy import deepcopy
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('review_scope', Path(__file__).with_name('review-hubsoft-os-scope.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ScopeTests(unittest.TestCase):
    def setUp(self):
        self.source = {'fileSha256': 'a' * 64}
        self.refs = {'attendance': {'keys': ['123']}, 'followup': {'pending': True},
                     'serviceOrders': {**self.source, 'keyField': 'numero_ordem_servico',
                       'keys': ['1', '2', '3', '4', '5', '6'],
                       'filters': {'dateField': 'data_termino_executado'},
                       'exportFilters': {'dateField': 'data_termino_executado',
                                         'start': '2026-10-01', 'end': '2026-10-31'}}}
        self.rows = [{'key': str(i), 'day': '2026-10-01', 'tipo_ordem_servico': kind}
                     for i, kind in enumerate(['CHECKLIST MOBI', '(SFN) SUPORTE', 'MANUTENÇÃO',
                                              'ABERTURA DE CTO', 'INSTALAÇÃO', 'SUPORTE INSTALAÇÃO'], 1)]

    def test_source_preserved_and_only_exact_types_marked(self):
        original = deepcopy(self.refs)
        result, summary = module.review(self.refs, self.rows, self.source)
        self.assertEqual(self.refs, original)
        self.assertEqual(result['attendance'], self.refs['attendance'])
        self.assertEqual(result['followup'], self.refs['followup'])
        self.assertEqual(result['serviceOrders']['keys'], self.refs['serviceOrders']['keys'])
        self.assertEqual(result['serviceOrders']['commercialExclusions']['keys'], ['1'])
        self.assertEqual([item['key'] for item in result['serviceOrders']['reportTypeExclusions']['orders']], ['2', '3', '4'])
        self.assertEqual(summary['remainingReferenceRecords'], 2)
        self.assertFalse(summary['approvalCreated'])

    def test_hash_keys_and_date_basis_must_match(self):
        for ref in [
            {**self.refs['serviceOrders'], 'fileSha256': 'b' * 64},
            {**self.refs['serviceOrders'], 'keys': ['1']},
            {**self.refs['serviceOrders'], 'exportFilters': {'dateField': 'data_cadastro'}},
        ]:
            with self.assertRaises(ValueError):
                module.review({**self.refs, 'serviceOrders': ref}, self.rows, self.source)
        rows = deepcopy(self.rows)
        rows[0]['day'] = '2026-11-01'
        with self.assertRaisesRegex(ValueError, 'FORA_DO_PERIODO'):
            module.review(self.refs, rows, self.source)

    def test_previous_review_cannot_be_overwritten(self):
        refs = deepcopy(self.refs)
        refs['serviceOrders']['scopeReview'] = {'reviewedOrders': [{'key': '2'}]}
        with self.assertRaisesRegex(ValueError, 'JA_REVISADA'):
            module.review(refs, self.rows, self.source)


if __name__ == '__main__':
    unittest.main()
