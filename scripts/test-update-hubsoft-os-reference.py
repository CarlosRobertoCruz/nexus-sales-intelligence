import importlib.util
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('update_reference',Path(__file__).with_name('update-hubsoft-os-reference.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ReferenceTests(unittest.TestCase):
    def test_full_population_is_preserved_and_only_checklists_are_marked(self):
        rows=[{'key':'1','day':'2026-10-01','tipo_ordem_servico':'CHECKLIST MOBI','codigo_cliente':None},
              {'key':'2','day':'2026-10-01','tipo_ordem_servico':'(SFN) SUPORTE','codigo_cliente':None},
              {'key':'3','day':'2026-10-01','tipo_ordem_servico':'Instalação','codigo_cliente':'12'}]
        ref=module.build_reference(rows,{'fileSha256':'a'*64},day='2026-10-01',exported_at='2026-10-30',start='2026-10-01',end='2026-10-01')
        self.assertEqual(ref['keys'],['1','2','3'])
        self.assertEqual(ref['commercialExclusions']['keys'],['1'])
        self.assertEqual(ref['scopeReview']['unassignedCustomerKeys'],['2'])
        self.assertFalse(ref['scopeReview']['resolved'])
        self.assertEqual(ref['exportFilters']['dateField'],'data_termino_executado')
        self.assertNotEqual(ref['collectionScope'],ref['exportScope'])
        self.assertNotIn('reviewer',ref)

    def test_date_declarations_cannot_hide_out_of_period_rows(self):
        with self.assertRaisesRegex(ValueError,'LINHA_FORA_DO_PERIODO'):
            module.build_reference([{'key':'1','day':'2026-10-02'}],{},day='2026-10-01',exported_at='2026-10-30',start='2026-10-01',end='2026-10-01')

if __name__=='__main__':
    unittest.main()
