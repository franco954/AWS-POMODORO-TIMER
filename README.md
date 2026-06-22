# 🍅 Pomodoro Timer — AWS Serverless

Aplicación web de Pomodoro Timer 100% serverless en AWS, **costo $0** usando el Free Tier.  
Cada usuario se registra, inicia sesión y su historial de sesiones queda registrado en DynamoDB.

---

## 🏗️ Arquitectura

```
[Usuario] → CloudFront → S3 (React/Vite)
               │
               ▼
         API Gateway (HTTP API + JWT Cognito)
               │
       ┌───────┼───────────────┐
       ▼       ▼               ▼
  Lambda    Lambda          Lambda
  CRUD     Settings         Stats
       │
       ▼
  DynamoDB (Single-Table)
       │
  [completeSession] → SQS → NotificationProcessor → Web Push
  [EventBridge cron] → DailySummaryJob
```

## 🛠️ Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite |
| Auth | AWS Cognito User Pool |
| API | API Gateway HTTP API |
| Backend | Node.js 20 Lambda (x8) |
| DB | DynamoDB (Single-Table Design) |
| Queue | SQS (FIFO + DLQ) |
| Notifications | Web Push (Service Worker + VAPID) |
| Observabilidad | CloudWatch Logs + X-Ray |
| CI/CD | GitHub Actions |
| IaC | Terraform 1.8 |

---

## 📁 Estructura

```
├── frontend/               # React + Vite app
│   ├── src/
│   │   ├── components/     # TimerPage, AuthPage, SettingsPanel, etc.
│   │   ├── services/api.js # Fetch wrapper autenticado
│   │   └── config/aws.js   # Configuración Amplify
│   └── public/
│       ├── sw.js           # Service Worker (Web Push)
│       └── manifest.json   # PWA manifest
├── backend/
│   └── lambdas/
│       ├── shared/utils.mjs          # Utilidades compartidas
│       ├── create_session/           # POST /sessions
│       ├── complete_session/         # PUT  /sessions/{id}
│       ├── get_sessions/             # GET  /sessions
│       ├── get_stats/                # GET  /stats
│       ├── update_settings/          # GET/PUT /settings
│       ├── notification_processor/   # SQS → Web Push
│       ├── daily_summary/            # EventBridge cron
│       └── cognito_post_confirmation/ # Cognito trigger
└── terraform/
    ├── modules/            # cognito, dynamodb, lambda, api_gateway, sqs, sns, s3_frontend, cloudfront, eventbridge
    └── environments/
        ├── dev/
        └── prod/
```

---

## 🚀 Deploy — Paso a paso

### Pre-requisitos

- AWS CLI configurado (`aws configure`)
- Terraform >= 1.8
- Node.js >= 20
- Una cuenta de GitHub

---

### 1. Crear recursos de Terraform state (una sola vez)

```bash
# Reemplazá <ACCOUNT_ID> con tu ID de cuenta AWS
aws s3 mb s3://pomodoro-tfstate-<ACCOUNT_ID> --region us-east-1

aws dynamodb create-table \
  --table-name pomodoro-tfstate-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### 2. Generar claves VAPID para Web Push

```bash
cd backend
npm install
npx web-push generate-vapid-keys
# Guardá las claves generadas — las necesitás en el paso 4
```

### 3. Guardar claves VAPID en SSM Parameter Store

```bash
aws ssm put-parameter --name "/pomodoro/vapid/public_key"  --value "TU_PUBLIC_KEY"  --type String
aws ssm put-parameter --name "/pomodoro/vapid/private_key" --value "TU_PRIVATE_KEY" --type SecureString
aws ssm put-parameter --name "/pomodoro/vapid/email"       --value "tu@email.com"   --type String
```

### 4. Actualizar el backend S3 en `terraform/backend.tf`

```hcl
bucket = "pomodoro-tfstate-<TU_ACCOUNT_ID>"
```

### 5. Deploy inicial a dev (manual)

```bash
cd terraform/environments/dev

# Editar backend.tf con tu bucket
terraform init \
  -backend-config="bucket=pomodoro-tfstate-<ACCOUNT_ID>" \
  -backend-config="key=environments/dev/terraform.tfstate" \
  -backend-config="region=us-east-1" \
  -backend-config="dynamodb_table=pomodoro-tfstate-lock"

terraform plan
terraform apply
```

### 6. Configurar frontend

1. Navegá a la carpeta `frontend/` y creá tu archivo de configuración local:
```bash
cd frontend
cp .env.example .env.local
```
2. Completá el archivo `.env.local` con los valores correspondientes de AWS. Podés consultarlos ejecutando este comando (estando en la raíz del proyecto):
```bash
terraform -chdir=terraform/environments/dev output
```

### 7. Deploy frontend a S3

Desde la carpeta `frontend/`, ejecutá:

```bash
# Compilar la aplicación React
npm run build

# Sincronizar archivos con S3 usando el output de Terraform
aws s3 sync dist/ s3://$(terraform -chdir=../terraform/environments/dev output -raw s3_bucket) --delete

# Crear la invalidación en CloudFront
aws cloudfront create-invalidation \
  --distribution-id $(terraform -chdir=../terraform/environments/dev output -raw cloudfront_id) \
  --paths "/*"
```

---

## 🔄 CI/CD (GitHub Actions)

### Secrets requeridos en GitHub (Settings → Secrets → Actions)

| Secret | Descripción |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user con permisos de deploy |
| `AWS_SECRET_ACCESS_KEY` | Secret del IAM user |
| `TF_STATE_BUCKET` | Nombre del bucket S3 para tfstate |
| `VAPID_PUBLIC_KEY` | Clave pública VAPID |

### Flujo

```
feature/* → PR → CI (lint + validate)
develop   → push → CD deploy a DEV automáticamente
main      → push → CD deploy a PROD (requiere aprobación manual en GitHub Environments)
```

Para habilitar aprobación manual en prod:  
`GitHub repo → Settings → Environments → prod → Required reviewers`

---

## 💰 Costos esperados: $0

Todos los servicios usados están dentro del **Free Tier** de AWS:

| Servicio | Tier |
|---|---|
| Lambda | ✅ Always Free (1M req/mes) |
| DynamoDB | ✅ Always Free (25GB, 25 WCU/RCU) |
| SQS | ✅ Always Free (1M req/mes) |
| SNS | ✅ Always Free (1M req/mes) |
| CloudFront | ✅ Always Free (1TB transfer) |
| Cognito | ✅ Always Free (50K MAU) |
| API Gateway | ⚠️ 12 meses gratis |
| S3 | ⚠️ 12 meses gratis |
| SSM Parameter Store | ✅ Always Free |

> 💡 **Tip:** Configurá un **AWS Budget** de $1 con alerta por email para detectar cualquier costo inesperado.

---

## 📐 Modelo de Datos DynamoDB (Single-Table)

| PK | SK | Datos |
|---|---|---|
| `USER#<id>` | `SETTINGS` | workDuration, shortBreak, longBreak, dailyGoal |
| `USER#<id>` | `SESSION#<ISO>#<uuid>` | type, status, duration, startTime, endTime |
| `USER#<id>` | `PUSH_SUBSCRIPTION` | endpoint, p256dh, auth |

---

## 🧩 API Endpoints

| Método | Path | Descripción |
|---|---|---|
| POST | `/sessions` | Crear sesión Pomodoro |
| PUT | `/sessions/{id}?startTime=ISO` | Completar / cancelar sesión |
| GET | `/sessions` | Listar historial |
| GET | `/stats` | Estadísticas del usuario |
| GET | `/settings` | Obtener configuración |
| PUT | `/settings` | Guardar configuración |

Todos los endpoints requieren JWT Bearer token de Cognito.

---

## 📄 Licencia

MIT
