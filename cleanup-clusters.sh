#!/bin/bash
set -e

echo "==> Deletando clusters..."
kind delete cluster --name argocd-hub 2>/dev/null || true
kind delete cluster --name cluster-1 2>/dev/null || true
kind delete cluster --name cluster-2 2>/dev/null || true

echo "==> Removendo rede Docker..."
docker network rm kind-network 2>/dev/null || true

echo "==> Limpeza completa!"
