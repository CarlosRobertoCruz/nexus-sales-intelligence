"""Prepare an offline, disabled 2026 batch from one report pair per month."""
import argparse
import calendar
import importlib.util
import json
import os
import re
from datetime import date
from pathlib import Path

spec = importlib.util.spec_from_file_location('report_reader', Path(__file__).with_name('prepare-hubsoft-reports.py'))
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


def prepare(config, base):
    entries = config.get('reports', [])
    months = [entry.get('month', '') for entry in entries]
    if not 1 <= len(months) <= 2 or any(not re.fullmatch(r'2026-0[1-9]', month) for month in months):
        raise ValueError('MESES_LOTE_INVALIDOS')
    if len(months) == 2 and int(months[1][-2:]) != int(months[0][-2:]) + 1:
        raise ValueError('MESES_LOTE_INVALIDOS')
    parent = config.get('approvedOctoberJob', '')
    if not re.fullmatch(r'[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}', parent, re.I):
        raise ValueError('PILOTO_OUTUBRO_OBRIGATORIO')
    snapshot = date.fromisoformat(config['snapshotDate'])
    followup = date.fromisoformat(config['followupCutoff'])
    cutoff = date(2026, int(months[-1][-2:]), calendar.monthrange(2026, int(months[-1][-2:]))[1])
    budget = config.get('maxCalls', 5000)
    if type(budget) is not int or not 1 <= budget <= 5000:
        raise ValueError('ORCAMENTO_LOTE_INVALIDO')
    if not cutoff <= followup < snapshot or followup.year != 2026:
        raise ValueError('CORTE_ACOMPANHAMENTO_INVALIDO')
    reports = {}
    for entry in entries:
        month = entry['month']
        last = calendar.monthrange(2026, int(month[-2:]))[1]
        start, end = f'{month}-01', f'{month}-{last:02}'
        refs = {}
        for kind, path_key, identity, field in [
            ('attendance', 'attendance', 'protocolo', 'data_cadastro'),
            ('serviceOrders', 'serviceOrders', 'numero_ordem_servico', 'data_termino_executado'),
        ]:
            path = Path(entry[path_key])
            if not path.is_absolute():
                path = base / path
            rows, source = reader.read_report(path, identity, field)
            if any(not row['day'] or not start <= row['day'] <= end for row in rows):
                raise ValueError('REGISTRO_FORA_DO_MES_DO_RELATORIO')
            refs[kind] = {**source, 'exportedAt': snapshot.isoformat(), 'exportedAtPrecision': 'day',
                'keyField': identity, 'keys': sorted(row['key'] for row in rows),
                'filters': {'dateField': field, 'otherFilters': 'none', 'addressType': 'instalacao'},
                'exportFilters': {'dateField': field, 'start': start, 'end': end, 'otherFilters': 'none', 'addressType': 'instalacao'}}
        refs['followup'] = {'pending': True, 'keyField': 'numero_ordem_servico',
            'filters': {'dateField': 'data_cadastro', 'otherFilters': 'none', 'relationship': 'id_atendimento', 'followupCutoff': followup.isoformat()}}
        reports[month] = refs
    manifest = {'year': 2026, 'phase': 'history', 'months': months, 'cutoff': cutoff.isoformat(),
        'followupCutoff': followup.isoformat(), 'osDateField': 'data_termino_executado', 'maxCalls': budget,
        'approvedOctoberJob': parent, 'autoPublish': False, 'monthReports': reports}
    outputs = {'manifest.json': manifest}
    for month, refs in reports.items():
        outputs[f'references-{month}.json'] = refs
        outputs[f'evidence-draft-{month}.json'] = {'month': month, 'reviewer': None, 'confirmFilters': False, 'confirmIncompleteRecords': False,
            **{kind: {'reportSha256': refs[kind]['fileSha256'], 'keys': refs[kind]['keys']} for kind in ['attendance', 'serviceOrders']}}
    return outputs


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    source = Path(args.config)
    outputs = prepare(json.loads(source.read_text(encoding='utf-8')), source.parent)
    target = Path(args.output)
    target.mkdir(parents=True, exist_ok=False)
    os.chmod(target, 0o700)
    for name, payload in outputs.items():
        with (target / name).open('x', encoding='utf-8') as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
        os.chmod(target / name, 0o600)
    manifest = outputs['manifest.json']
    print(json.dumps({'months': manifest['months'], 'maximumCalls': manifest['maxCalls'], 'enabled': False,
        'counts': {month: {kind: len(refs[kind]['keys']) for kind in ['attendance', 'serviceOrders']}
                   for month, refs in manifest['monthReports'].items()}}))
