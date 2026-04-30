# Plan de Implementación Backstage - Gestión AWS

## Objetivo
Portal de desarrolladores para gestionar infraestructura AWS, pipelines, logs y costos.

## Funcionalidades Requeridas

### 1. Gestión de Instancias AWS
- **EC2**: Start/Stop/Estado (stopped, starting, running, stopping)
- **RDS**: Start/Stop/Estado (available, starting, stopped, stopping)
- **Vista**: Dashboard con lista de instancias y acciones rápidas

### 2. Gestión de Pipelines
- **CodePipeline**: Trigger manual de pipelines
- **Logs**: Visualización de logs de ejecución
- **Estado**: Ver estado actual de cada stage

### 3. Observabilidad
- **Logs**: Integración con Loki
- **Métricas**: Integración con Prometheus/Grafana
- **Vista**: Dashboards embebidos por aplicación

### 4. Gestión de Costos
- **AWS Cost Explorer**: Filtrado por tags de desarrollo
- **Vista**: Dashboard con costos por servicio/instancia
- **Alertas**: Notificaciones de gastos excesivos

## Arquitectura Propuesta

### Plugins a Implementar

#### Plugin 1: AWS Resources Manager
```
plugins/aws-resources/
├── src/
│   ├── components/
│   │   ├── EC2Dashboard/
│   │   ├── RDSManager/
│   │   └── InstanceCard/
│   ├── api/
│   │   └── AwsResourcesClient.ts
│   └── plugin.ts
└── package.json
```

**Funcionalidades:**
- Listar instancias EC2 y RDS
- Botones Start/Stop con confirmación
- Indicadores de estado en tiempo real
- Filtrado por tags (ej: Environment=development)

#### Plugin 2: AWS Pipeline Manager
```
plugins/aws-pipelines/
├── src/
│   ├── components/
│   │   ├── PipelineList/
│   │   ├── PipelineDetails/
│   │   └── LogViewer/
│   ├── api/
│   │   └── CodePipelineClient.ts
│   └── plugin.ts
└── package.json
```

**Funcionalidades:**
- Listar pipelines de CodePipeline
- Botón "Run Pipeline" con parámetros opcionales
- Visualización de stages y estados
- Logs de CodeBuild integrados

#### Plugin 3: Observability Dashboard
```
plugins/observability/
├── src/
│   ├── components/
│   │   ├── GrafanaDashboard/
│   │   ├── LogsViewer/
│   │   └── MetricsPanel/
│   ├── api/
│   │   ├── LokiClient.ts
│   │   └── PrometheusClient.ts
│   └── plugin.ts
└── package.json
```

**Funcionalidades:**
- Iframe de Grafana embebido
- Query builder para Loki
- Gráficas de Prometheus
- Filtrado por aplicación/servicio

#### Plugin 4: AWS Cost Dashboard
```
plugins/aws-costs/
├── src/
│   ├── components/
│   │   ├── CostOverview/
│   │   ├── CostByService/
│   │   └── CostTrends/
│   ├── api/
│   │   └── CostExplorerClient.ts
│   └── plugin.ts
└── package.json
```

**Funcionalidades:**
- Costos totales del mes actual
- Desglose por servicio (EC2, RDS, etc.)
- Filtrado por tag: Environment=development
- Gráficas de tendencias
- Exportar reportes

### Backend APIs

```
packages/backend/src/plugins/
├── aws-resources.ts
├── aws-pipelines.ts
├── observability.ts
└── aws-costs.ts
```

**Configuración necesaria:**
- AWS SDK con credenciales IAM
- Permisos: EC2, RDS, CodePipeline, Cost Explorer
- Rate limiting y caché
- Logs de auditoría

## Configuración AWS

### IAM Policy Requerida
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:StartInstances",
        "ec2:StopInstances",
        "rds:DescribeDBInstances",
        "rds:StartDBInstance",
        "rds:StopDBInstance",
        "codepipeline:ListPipelines",
        "codepipeline:GetPipelineState",
        "codepipeline:StartPipelineExecution",
        "codepipeline:GetPipelineExecution",
        "codebuild:BatchGetBuilds",
        "logs:GetLogEvents",
        "ce:GetCostAndUsage",
        "ce:GetCostForecast"
      ],
      "Resource": "*"
    }
  ]
}
```

### Tags Recomendados
```
Environment: development | staging | production
ManagedBy: backstage
Team: team-name
CostCenter: cost-center-id
```

## Integración con Loki y Prometheus

### Opción 1: Plugin Grafana (Recomendado)
- Usar el plugin oficial `@k-phoen/backstage-plugin-grafana`
- Embedder dashboards existentes
- Configurar datasources (Loki + Prometheus)

### Opción 2: Plugin Personalizado
- Cliente directo a Loki API (LogQL)
- Cliente directo a Prometheus API (PromQL)
- UI personalizada para queries

### Configuración en app-config.yaml
```yaml
grafana:
  domain: https://grafana.tu-dominio.com
  unifiedAlerting: true

loki:
  baseUrl: https://loki.tu-dominio.com

prometheus:
  baseUrl: https://prometheus.tu-dominio.com
```

## Fases de Implementación

### Fase 1: Setup Base (Semana 1)
- [ ] Configurar AWS SDK en backend
- [ ] Crear IAM role con permisos necesarios
- [ ] Configurar credenciales en app-config
- [ ] Crear estructura de plugins

### Fase 2: AWS Resources (Semana 2)
- [ ] Plugin EC2 Manager
- [ ] Plugin RDS Manager
- [ ] UI para Start/Stop
- [ ] Indicadores de estado

### Fase 3: Pipelines (Semana 3)
- [ ] Plugin CodePipeline
- [ ] Trigger de pipelines
- [ ] Visualización de logs
- [ ] Historial de ejecuciones

### Fase 4: Observabilidad (Semana 4)
- [ ] Integración con Grafana
- [ ] Cliente Loki para logs
- [ ] Cliente Prometheus para métricas
- [ ] Dashboards por aplicación

### Fase 5: Costos (Semana 5)
- [ ] Plugin AWS Cost Explorer
- [ ] Dashboard de costos
- [ ] Filtrado por tags
- [ ] Reportes y alertas

### Fase 6: Refinamiento (Semana 6)
- [ ] Permisos y roles en Backstage
- [ ] Logs de auditoría
- [ ] Documentación
- [ ] Testing

## Tecnologías

### Frontend
- React + TypeScript
- Material-UI (incluido en Backstage)
- Recharts para gráficas
- React Query para caché

### Backend
- Node.js + Express
- AWS SDK v3
- Winston para logs
- Node-cache para caché

### Integraciones
- AWS SDK JavaScript v3
- Grafana API
- Loki HTTP API
- Prometheus HTTP API

## Seguridad

### Autenticación
- Integrar con AWS SSO o Okta
- Roles basados en grupos
- MFA obligatorio para acciones destructivas

### Autorización
- RBAC en Backstage
- Permisos por equipo
- Logs de auditoría de todas las acciones

### Secrets Management
- AWS Secrets Manager para credenciales
- Variables de entorno para configuración
- Rotación automática de credenciales

## Monitoreo del Portal

- Logs de Backstage en CloudWatch
- Métricas de uso en Prometheus
- Alertas de errores en Slack/PagerDuty
- Dashboard de salud del portal

## Costos Estimados

### AWS
- API calls: ~$10-50/mes
- Cost Explorer API: $0.01 por request
- CloudWatch Logs: ~$5-20/mes

### Infraestructura
- EC2 para Backstage: t3.medium (~$30/mes)
- RDS para catálogo (opcional): ~$15/mes
- Load Balancer: ~$20/mes

**Total estimado: $80-135/mes**

## Próximos Pasos

1. ¿Aprobamos este plan?
2. ¿Empezamos con la Fase 1?
3. ¿Necesitas ajustar alguna funcionalidad?
