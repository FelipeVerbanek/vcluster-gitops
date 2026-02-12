# Crossplane + LocalStack + ArgoCD Multi-Cluster GitOps

Projeto de demonstração de infraestrutura como código usando Crossplane, LocalStack e ArgoCD em ambiente multi-cluster com Kind.

## 📋 Visão Geral

Este projeto implementa uma arquitetura GitOps completa com:

- **ArgoCD Hub Cluster**: Cluster central que gerencia deployments em múltiplos clusters
- **Cluster-1 e Cluster-2**: Clusters de aplicação gerenciados pelo ArgoCD
- **Crossplane**: Provisionamento de recursos AWS via Kubernetes
- **LocalStack**: Emulação de serviços AWS localmente
- **Custom XRD**: Composite Resource Definition para criar SQS com DLQ, IAM Role e Policy

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    ArgoCD Hub Cluster                        │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐   │
│  │ ArgoCD   │  │ Crossplane │  │ LocalStack           │   │
│  │          │  │ v2.1.4     │  │ (AWS Emulator)       │   │
│  └──────────┘  └────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
           │                           │
           ├───────────────┬───────────┘
           │               │
    ┌──────▼──────┐ ┌─────▼──────┐
    │  Cluster-1  │ │ Cluster-2  │
    │   (Dev)     │ │  (Prod)    │
    └─────────────┘ └────────────┘
```

## 🚀 Componentes Principais

### 1. Crossplane XRD - SQS Queue
Composite Resource que provisiona automaticamente:
- **Fila SQS Principal**
- **Dead Letter Queue (DLQ)**
- **IAM Role** com AssumeRole policy
- **IAM Policy** com permissões SQS

**Localização**: `crossplane-providers/`
- `sqs-xrd.yaml` - Definição do XRD
- `sqs-composition.yaml` - Composition com pipeline mode (Crossplane v2)
- `function-patch-and-transform.yaml` - Function necessária para pipeline

### 2. Aplicação de Exemplo
Aplicação Node.js que envia mensagens para a fila SQS.

**Localização**: `app-exemple/`
- `index.js` - Aplicação que envia 2 mensagens ao iniciar
- `Dockerfile` - Container da aplicação
- **Imagem Docker**: `felipeverbanek/sendmsgsqs-api:v1.0.0`

### 3. Estrutura GitOps

```
├── bootstrap/              # ArgoCD ApplicationSets
│   ├── addons.yaml        # Crossplane, LocalStack
│   ├── app-of-apps.yaml   # App of Apps pattern
│   └── env-*.yaml         # Environments
├── environments/
│   ├── dev/
│   │   ├── apps/          # Aplicações dev
│   │   └── infra/         # Infraestrutura dev
│   └── prod/
│       ├── apps/          # Aplicações prod
│       │   └── webapp/    # Job que envia mensagens
│       └── infra/         # Infraestrutura prod
│           └── webapp/    # SQS Claim
└── crossplane-providers/  # Providers e XRDs
```

## 📦 Dependências

### Ferramentas Necessárias
- **Docker** - Container runtime
- **Kind** - Kubernetes in Docker
- **kubectl** - CLI do Kubernetes
- **Helm** - Package manager do Kubernetes

### Versões dos Componentes
- **Crossplane**: v2.1.4
- **ArgoCD**: Latest (via Helm)
- **LocalStack**: v0.6.27
- **Crossplane Provider AWS**: v0.46.0 (crossplane-contrib)
- **Node.js**: 20-alpine (aplicação)

## 🛠️ Setup

### 1. Criar Clusters

```bash
./setup-clusters.sh
```

Este script:
- Cria rede Docker compartilhada (`kind-network`)
- Provisiona 3 clusters Kind:
  - `argocd-hub` (172.21.0.2)
  - `cluster-1` (10.89.0.3)
  - `cluster-2` (10.89.0.4)
- Instala ArgoCD no hub cluster
- Registra clusters no ArgoCD

### 2. Obter Senha do ArgoCD

```bash
kubectl get secret argocd-initial-admin-secret -n argocd \
  -o jsonpath='{.data.password}' | base64 -d
```

### 3. Aplicar Bootstrap

```bash
kubectl apply -f bootstrap/
```

Isso irá:
- Instalar Crossplane e LocalStack
- Configurar providers AWS
- Criar XRDs e Compositions
- Deployar aplicações nos clusters

## 📝 Uso do XRD

### Criar uma Fila SQS

```yaml
apiVersion: messaging.example.io/v1alpha1
kind: SQSQueue
metadata:
  name: minha-fila
  namespace: default
spec:
  queueName: minha-fila
  maxReceiveCount: 3              # Tentativas antes de ir para DLQ
  visibilityTimeout: 30           # Segundos
  messageRetentionPeriod: 345600  # 4 dias
  iamRoleName: minha-fila-role
```

### Verificar Status

```bash
# Ver recursos criados
kubectl get sqsqueue

# Ver detalhes
kubectl describe sqsqueue minha-fila

# Ver URLs e ARNs no status
kubectl get sqsqueue minha-fila -o yaml
```

### Verificar no LocalStack

```bash
# Listar mensagens na fila
kubectl exec -n localstack-system <pod-name> -- \
  awslocal sqs get-queue-attributes \
  --queue-url <queue-url> \
  --attribute-names ApproximateNumberOfMessages

# Ver IAM Role
kubectl exec -n localstack-system <pod-name> -- \
  awslocal iam get-role --role-name <role-name>

# Ver Policy anexada
kubectl exec -n localstack-system <pod-name> -- \
  awslocal iam get-role-policy \
  --role-name <role-name> \
  --policy-name <policy-name>
```

## 🔧 Configuração

### LocalStack Endpoint
Para aplicações em outros clusters acessarem o LocalStack:
- **Interno (mesmo cluster)**: `http://addon-localstack.localstack-system.svc.cluster.local:4566`
- **Cross-cluster**: `http://172.21.0.2:31566` (NodePort)

### Credenciais LocalStack
```yaml
AWS_ACCESS_KEY_ID: test
AWS_SECRET_ACCESS_KEY: test
AWS_REGION: us-east-1
```

## 🧹 Limpeza

```bash
./cleanup-clusters.sh
```

Remove todos os clusters Kind e a rede Docker.

## 📚 Recursos Criados pelo XRD

Quando você cria um `SQSQueue`, o Crossplane provisiona:

1. **Queue Principal** (`my-app-queue-prod`)
   - Retention: 4 dias
   - Visibility timeout: 30s

2. **Dead Letter Queue** (`my-app-queue-prod-dlq`)
   - Retention: 14 dias
   - Recebe mensagens após 3 tentativas

3. **IAM Role** (`webapp-role`)
   - AssumeRole policy permitindo qualquer principal
   - ARN disponível no status

4. **IAM Policy** (`webapp-role-policy`)
   - Permissões: SendMessage, ReceiveMessage, DeleteMessage, GetQueueAttributes
   - Anexada automaticamente à role

## 🎯 Exemplo de Aplicação

A aplicação de exemplo (`app-exemple/`) demonstra:
- Conexão com LocalStack via SDK AWS
- Envio de mensagens para SQS
- Uso de variáveis de ambiente para configuração
- Deploy via ArgoCD como Kubernetes Job

## 🔍 Troubleshooting

### ArgoCD não sincroniza
```bash
# Ver logs do application controller
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller
```

### Crossplane não cria recursos
```bash
# Ver status do XRD
kubectl describe xsqsqueue <name>

# Ver logs do Crossplane
kubectl logs -n crossplane-system -l app=crossplane
```

### LocalStack não acessível
```bash
# Verificar serviço
kubectl get svc -n localstack-system

# Testar conectividade
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://addon-localstack.localstack-system.svc.cluster.local:4566/_localstack/health
```

## 📄 Licença

Este é um projeto de demonstração para fins educacionais.

## 🤝 Contribuindo

Sinta-se livre para abrir issues ou pull requests com melhorias!
