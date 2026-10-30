"""Update only the OS reference from a conclusion report, without API/DB access.
Preserves all source keys, including checklists; never creates approval evidence.
"""
import argparse
import importlib.util
import json
import re
import unicodedata
from datetime import date
from pathlib import Path

spec = importlib.util.spec_from_file_location('prepare_reports', Path(__file__).with_name('prepare-hubsoft-reports.py'))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


def build_reference(records, source, *, day, exported_at, start, end):
    for value in (day, exported_at, start, end):
        date.fromisoformat(value)
    if not start <= day <= end or day > exported_at or day[:4] != '2026':
        raise ValueError('PERIODO_RELATORIO_INVALIDO')
    if any(not row['day'] or not start <= row['day'] <= end for row in records):
        raise ValueError('LINHA_FORA_DO_PERIODO_DECLARADO')
    selected = [row for row in records if row['day'] == day]
    def checklist(row):
        text = ''.join(c for c in unicodedata.normalize('NFD', str(row.get('tipo_ordem_servico') or '')) if not unicodedata.combining(c)).lower()
        return bool(re.search(r'\bcheck[\s-]*list\b', text))
    exclusions = sorted(row['key'] for row in selected if checklist(row))
    review = sorted(row['key'] for row in selected if not checklist(row) and row.get('codigo_cliente') in (None, '', '-'))
    reference = {**source, 'exportedAt': exported_at, 'exportedAtPrecision': 'day',
        'keyField': 'numero_ordem_servico', 'keys': sorted(row['key'] for row in selected),
        'filters': {'dateField': 'data_termino_executado', 'otherFilters': 'none', 'addressType': 'instalacao'},
        'exportFilters': {'dateField': 'data_termino_executado', 'start': start, 'end': end,
                          'otherFilters': 'none', 'addressType': 'instalacao'},
        'collectionScope': {'destination': 'cliente_servico'},
        'exportScope': {'destination': 'all'},
        'scopeReview': {'unassignedCustomerKeys': review, 'resolved': not review},
        'commercialExclusions': {'reason': 'checklist', 'keys': exclusions}}
    return reference


def update(args):
    references = json.loads(Path(args.references).read_text(encoding='utf-8-sig'))
    if not all(kind in references for kind in ('attendance', 'serviceOrders', 'followup')):
        raise ValueError('REFERENCIAS_INCOMPLETAS')
    records, source = prepare.read_report(Path(args.orders), 'numero_ordem_servico', 'data_termino_executado', ('tipo_ordem_servico', 'codigo_cliente'))
    references['serviceOrders'] = build_reference(records, source, day=args.day, exported_at=args.exported_at, start=args.start, end=args.end)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as target:
        json.dump(references, target, ensure_ascii=False, indent=2)
        target.write('\n')
    report = references['serviceOrders']
    print(json.dumps({'sourceRecords': source['sourceRecords'], 'referenceCount': len(report['keys']),
        'checklists': len(report['commercialExclusions']['keys']),
        'unassignedCustomerOrdersToReview': len(report['scopeReview']['unassignedCustomerKeys']),
        'sourceReconciliationStillRequired': True, 'approvalCreated': False}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('references', 'orders', 'day', 'exported-at', 'start', 'end', 'output'):
        parser.add_argument('--' + name, required=True)
    update(parser.parse_args())
