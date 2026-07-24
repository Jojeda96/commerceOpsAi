# Arquitectura de Sistema — CommerceOps AI

## Visión General

**CommerceOps AI** es una plataforma multiagente de inteligencia operacional diseñada para resolver preguntas complejas de comercio electrónico a partir de datos relacionales de marketplaces (dataset Olist con ~100.000 pedidos).

## Diagrama de Arquitectura

```mermaid
flowchart TD
    User["Usuario / Dashboard Next.js"] -->|REST / SSE| API["NestJS API Gateway (Puerto 3001)"]
    API --> Supervisor["Operations Supervisor Agent"]

    Supervisor -->|Plan & Fan-out| Sales["Sales Intelligence Agent"]
    Supervisor -->|Plan & Fan-out| Logistics["Logistics Agent"]
    Supervisor -->|Plan & Fan-out| CX["Customer Experience Agent"]
    Supervisor -->|Plan & Fan-out| Seller["Seller Performance Agent"]
    Supervisor -->|Plan & Fan-out| Anomaly["Anomaly Detection Agent"]
    Supervisor -->|Plan & Fan-out| DS["Data Science Agent"]

    Sales -->|Hallazgos + Evidencias| EvidenceStore["State / Database"]
    Logistics -->|Hallazgos + Evidencias| EvidenceStore
    CX -->|Hallazgos + Evidencias| EvidenceStore
    Seller -->|Hallazgos + Evidencias| EvidenceStore
    Anomaly -->|Hallazgos + Evidencias| EvidenceStore
    DS -->|Hallazgos + Evidencias| EvidenceStore

    EvidenceStore --> Critic["Evidence Critic"]
    Critic -->|REQUIRES_MORE_ANALYSIS| Supervisor
    Critic -->|APPROVED| Strategy["Business Strategy Agent"]

    Strategy --> Report["Informe Ejecutivo Final"]
    Report --> API
    API -->|SSE Events| User

    API --> PostgreSQL["PostgreSQL 16 (Puerto 5434)"]
    DS & Anomaly & CX --> MLService["FastAPI ML Service (Puerto 8000)"]
```

## Principio Central

> **Los agentes razonan, las herramientas calculan.**

Los LLMs no realizan cálculos numéricos mentalmente. Todas las cifras provienen de ejecuciones deterministas de SQL, agregaciones o modelos de Machine Learning versionados.
