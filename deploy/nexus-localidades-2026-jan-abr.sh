#!/usr/bin/env bash
set -euo pipefail

cd "${NEXUS_SALES_DIR:-/home/lab/projetos/nexus-sales-intelligence}"

dc() {
  docker compose --env-file .env.vps -f compose.vps.yml "$@"
}

field_is_zero() {
  local pattern="\"$1\"[[:space:]]*:[[:space:]]*0[[:space:]]*[,}]"
  [[ "$2" =~ $pattern ]]
}

if [[ -n "$(docker ps -q --filter 'name=lab-nexus-sales-history-run-')" ]]; then
  printf 'Existe outra execucao history ativa. Aguarde antes de iniciar este lote.\n' >&2
  exit 1
fi

# Confirm the previous publication locally; its separately reviewed customer conflict may remain pending.
previous="$(dc run --rm --no-deps -T --entrypoint node history \
  server/jobs/repair-service-locations.mjs plan 2025-11,2025-12 --all-events)"
printf '%s\n' "$previous"
for field in readyForReview invalidEvidenceOrSource uncaptured; do
  if ! field_is_zero "$field" "$previous"; then
    printf 'Conclua a publicacao de novembro/dezembro de 2025 antes deste lote.\n' >&2
    exit 1
  fi
done

trap 'dc --profile automation up -d --no-deps --no-build automatic' EXIT
dc --profile automation stop automatic

for lote in 2026-01,2026-02 2026-03,2026-04; do
  for rodada in {1..15}; do
    printf 'Lote %s, rodada %s\n' "$lote" "$rodada"
    if ! output="$(dc run --rm --no-deps -T --entrypoint node history \
      server/jobs/repair-service-locations.mjs capture "$lote" 100 \
      --all-events --defer-client-conflicts)"; then
      printf '%s\n' "$output"
      printf 'Captura interrompida; checkpoints e orcamento foram preservados.\n' >&2
      exit 1
    fi
    printf '%s\n' "$output"
    if field_is_zero callsThisRun "$output"; then break; fi
  done

  dc run --rm --no-deps -T --entrypoint node history \
    server/jobs/repair-service-locations.mjs plan "$lote" --all-events
done

printf 'Capturas encerradas. Revise os dois planos antes de aplicar as localidades.\n'
