

install cluster
kind create cluster --config kind-custer.yaml

install argocd
helm upgrade --install -f argocd_values.yaml argo-cd argo/argo-cd -n argo-cd --create-namespace