# AWS Setup para Backstage

## 📋 Requisitos Previos

1. Cuenta de AWS con acceso administrativo
2. AWS CLI instalado (opcional, para testing)
3. Credenciales de AWS configuradas

## 🔐 Configuración de Credenciales

### Opción 1: Variables de Entorno (Desarrollo Local)

Crea o edita el archivo `.env` en la raíz del proyecto:

```bash
```

### Opción 2: IAM Role (Producción - EC2/ECS)

Si Backstage corre en AWS, asigna un IAM Role con los permisos necesarios.

### Opción 3: AWS Credentials File

```bash
# ~/.aws/credentials
[default]
aws_access_key_id = tu_access_key_aqui
aws_secret_access_key = tu_secret_key_aqui
region = us-east-1
```

## 🔑 IAM Policy Requerida

Crea una política IAM con los siguientes permisos:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EC2Management",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceStatus",
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:DescribeTags"
      ],
      "Resource": "*"
    },
    {
      "Sid": "RDSManagement",
      "Effect": "Allow",
      "Action": [
        "rds:DescribeDBInstances",
        "rds:StartDBInstance",
        "rds:StopDBInstance",
        "rds:ListTagsForResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CodePipelineManagement",
      "Effect": "Allow",
      "Action": [
        "codepipeline:ListPipelines",
        "codepipeline:GetPipeline",
        "codepipeline:GetPipelineState",
        "codepipeline:GetPipelineExecution",
        "codepipeline:ListPipelineExecutions",
        "codepipeline:StartPipelineExecution"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CodeBuildLogs",
      "Effect": "Allow",
      "Action": [
        "codebuild:BatchGetBuilds",
        "codebuild:ListBuilds"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:GetLogEvents",
        "logs:DescribeLogStreams",
        "logs:DescribeLogGroups"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CostExplorer",
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetCostForecast",
        "ce:GetDimensionValues",
        "ce:GetTags"
      ],
      "Resource": "*"
    }
  ]
}
```

## 🏷️ Tags Recomendados para Recursos

Para aprovechar el filtrado por tags, etiqueta tus recursos AWS:

### EC2 Instances
```
Name: nombre-descriptivo
Environment: development | staging | production
Team: nombre-del-equipo
ManagedBy: backstage
CostCenter: centro-de-costos
```

### RDS Instances
```
Name: nombre-descriptivo
Environment: development | staging | production
Team: nombre-del-equipo
ManagedBy: backstage
```

## 🚀 Endpoints Disponibles

Una vez configurado, tendrás acceso a estos endpoints:

### AWS Resources (EC2 & RDS)
- `GET /api/aws-resources/health` - Health check
- `GET /api/aws-resources/ec2/instances?tag=development` - Listar EC2
- `POST /api/aws-resources/ec2/instances/:id/start` - Iniciar EC2
- `POST /api/aws-resources/ec2/instances/:id/stop` - Detener EC2
- `GET /api/aws-resources/rds/instances?tag=development` - Listar RDS
- `POST /api/aws-resources/rds/instances/:id/start` - Iniciar RDS
- `POST /api/aws-resources/rds/instances/:id/stop` - Detener RDS

### AWS Pipelines
- `GET /api/aws-pipelines/health` - Health check
- `GET /api/aws-pipelines/pipelines` - Listar pipelines
- `GET /api/aws-pipelines/pipelines/:name` - Detalles de pipeline
- `POST /api/aws-pipelines/pipelines/:name/execute` - Ejecutar pipeline
- `GET /api/aws-pipelines/pipelines/:name/executions` - Historial
- `GET /api/aws-pipelines/builds/:buildId/logs` - Logs de build

### AWS Costs
- `GET /api/aws-costs/health` - Health check
- `GET /api/aws-costs/costs?startDate=2024-01-01&endDate=2024-01-31&tagKey=Environment&tagValue=development` - Costos totales
- `GET /api/aws-costs/costs/by-service?startDate=2024-01-01&endDate=2024-01-31` - Costos por servicio
- `GET /api/aws-costs/costs/forecast?startDate=2024-02-01&endDate=2024-02-28` - Forecast

## 🧪 Testing de Configuración

### 1. Verificar credenciales
```bash
# Si tienes AWS CLI instalado
aws sts get-caller-identity
```

### 2. Test de endpoints (después de iniciar Backstage)
```bash
# Health checks
curl http://localhost:7007/api/aws-resources/health
curl http://localhost:7007/api/aws-pipelines/health
curl http://localhost:7007/api/aws-costs/health

# Listar EC2 instances
curl http://localhost:7007/api/aws-resources/ec2/instances

# Listar pipelines
curl http://localhost:7007/api/aws-pipelines/pipelines

# Obtener costos del mes actual
curl "http://localhost:7007/api/aws-costs/costs?startDate=2024-01-01&endDate=2024-01-31"
```

## ⚠️ Consideraciones de Seguridad

1. **Nunca commitees credenciales** al repositorio
2. Usa **IAM roles** en producción, no access keys
3. Aplica el **principio de menor privilegio**
4. Habilita **MFA** para usuarios con permisos de start/stop
5. Implementa **logs de auditoría** para todas las acciones
6. Considera usar **AWS Organizations** para separar ambientes

## 🔄 Rotación de Credenciales

Si usas access keys, rótalas regularmente:

```bash
# 1. Crear nuevas credenciales en AWS Console
# 2. Actualizar .env o variables de entorno
# 3. Reiniciar Backstage
# 4. Eliminar credenciales antiguas
```

## 📊 Monitoreo

Configura CloudWatch Alarms para:
- Llamadas API excesivas
- Errores de autenticación
- Costos inesperados
- Instancias iniciadas fuera de horario

## 🆘 Troubleshooting

### Error: "Unable to locate credentials"
- Verifica que las credenciales estén configuradas
- Revisa las variables de entorno
- Confirma permisos del IAM user/role

### Error: "Access Denied"
- Verifica que la política IAM tenga todos los permisos
- Confirma que el usuario/role esté asociado a la política

### Error: "Region not found"
- Verifica que `AWS_REGION` esté configurado
- Confirma que la región en `app-config.yaml` sea válida

## 📚 Recursos Adicionales

- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS Cost Explorer API](https://docs.aws.amazon.com/cost-management/latest/APIReference/Welcome.html)
- [Backstage Backend System](https://backstage.io/docs/backend-system/)
