"""Prepare report-backed OS exclusions offline; never approve or modify the DB.

Preserves the full reference population and verifies the original XLSX hash.
Only checklists and the three explicitly reviewed technical types are marked.
"""
import argparse
from collections import Counter
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import re
import unicodedata

spec = importlib.util.spec_from_file_location('prepare_reports', Path(__file__).with_name('prepare-hubsoft-reports.py'))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)

ALLOWED_TYPES = {'(SFN) SUPORTE', 'MANUTENCAO', 'ABERTURA DE CTO'}


def normalized(value):
    return ''.join(c for c in unicodedata.normalize('NFD', str(value or ''))
                   if not unicodedata.combining(c)).strip().upper()


def review(references, records, source):
    result = deepcopy(references)
    ref = result['serviceOrders']
    export = ref.get('exportFilters', {})
    if (source['fileSha256'] != ref.get('fileSha256')
            or ref.get('keyField') != 'numero_ordem_servico'
            or ref.get('filters', {}).get('dateField') != 'data_termino_executado'
            or export.get('dateField') != 'data_termino_executado'):
        raise ValueError('RELATORIO_ORIGINAL_DIVERGENTE')
    start, end = export.get('start'), export.get('end')
    if (not start or not end or not re.fullmatch(r'2026-\d{2}-\d{2}', start)
            or not re.fullmatch(r'2026-\d{2}-\d{2}', end)
            or prepare.report_day(start) > prepare.report_day(end)):
        raise ValueError('PERIODO_RELATORIO_INVALIDO')
    keys = [row['key'] for row in records]
    fixed = ref.get('keys', [])
    if (len(keys) != len(set(keys)) or len(fixed) != len(set(fixed))
            or set(keys) != set(fixed)):
        raise ValueError('CHAVES_RELATORIO_DIVERGENTES')
    # Do not silently replace earlier, individually reviewed exclusions.
    if ref.get('scopeReview', {}).get('reviewedOrders') or ref.get('reportTypeExclusions'):
        raise ValueError('REFERENCIA_JA_REVISADA')
    checklists, decisions = [], []
    for row in records:
        if not row['day'] or not start <= row['day'] <= end:
            raise ValueError('LINHA_FORA_DO_PERIODO_DECLARADO')
        kind = normalized(row.get('tipo_ordem_servico'))
        if re.search(r'\bCHECK[\s-]*LIST\b', kind):
            checklists.append(row['key'])
        elif kind in ALLOWED_TYPES:
            decisions.append({'key': row['key'], 'orderType': row['tipo_ordem_servico'],
                              'completedOn': row['day']})
    existing = ref.get('commercialExclusions')
    if existing and (existing.get('reason') != 'checklist'
                     or not set(existing.get('keys', [])).issubset(checklists)):
        raise ValueError('EXCLUSOES_ANTERIORES_DIVERGENTES')
    ref['commercialExclusions'] = {'reason': 'checklist', 'keys': sorted(checklists)}
    if decisions:
        ref['reportTypeExclusions'] = {
            'reason': 'non_commercial_order_type', 'reportSha256': source['fileSha256'],
            'orders': sorted(decisions, key=lambda item: item['key'])}
    summary = {'sourceRecords': len(records), 'checklists': len(checklists),
               'technicalOrderTypes': dict(Counter(item['orderType'] for item in decisions)),
               'remainingReferenceRecords': len(records) - len(checklists) - len(decisions),
               'approvalCreated': False, 'apiCalled': False}
    return result, summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('references', 'orders', 'output'):
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    references = json.loads(Path(args.references).read_text(encoding='utf-8-sig'))
    records, source = prepare.read_report(Path(args.orders), 'numero_ordem_servico',
                                          'data_termino_executado', ('tipo_ordem_servico',))
    result, summary = review(references, records, source)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as target:
        json.dump(result, target, ensure_ascii=False, indent=2)
        target.write('\n')
    print(json.dumps(summary, ensure_ascii=False))
