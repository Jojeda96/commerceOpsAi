# Invariantes Globales Obligatorios (CommerceOps AI V4)

Estas reglas son obligatorias y deben ser respetadas por toda contribución, PR y componente del sistema.

## INV-01 — Momento de predicción

```text
prediction_moment = ORDER_PURCHASE
```

Una feature solo es válida si está disponible al crear el pedido. Está estrictamente prohibido usar:
- `order_delivered_carrier_date`.
- `order_delivered_customer_date`, salvo para construir labels o historiales cuyo resultado ya estaba disponible al momento de la compra.
- Cualquier outcome de un pedido con `delivered_date >= current.purchase_date`.

## INV-02 — Contrato único de features

La lista, nombre, tipo, nulabilidad y semántica de features debe vivir en un artefacto canónico:
```text
data/contracts/delivery_feature_contract.v3.json
```
Ningún servicio puede mantener una lista paralela manual sin validarla contra ese contrato.

## INV-03 — Sin defaults silenciosos

Si una feature requerida no puede calcularse:
- El escenario se excluye o queda `UNAVAILABLE`.
- La API responde `422 FEATURE_CONTRACT_VIOLATION` cuando el request es inválido.
- Nunca se completa con un número plausible inventado (ej: `500`, `4500`, `0.08`, `"SP"`, `"RJ"`, `"beleza_saude"`).

## INV-04 — Indisponibilidad no es predicción

```text
MODEL_NOT_APPROVED
MODEL_RUNTIME_UNAVAILABLE
FEATURES_UNAVAILABLE
```
no significan:
```text
probability = 0
threshold = 0.5
risk = LOW
```
Solo se crea `ModelPrediction` cuando existe una respuesta de inferencia válida.

## INV-05 — Test final intocable

El test final solo se evalúa una vez por versión candidata a release. No se usa para elegir modelo, hiperparámetros, calibrador ni threshold.

## INV-06 — Champion genérico

Todo el sistema debe usar `champion_model_name`; ninguna capa debe asumir XGBoost de manera hardcodeada.

## INV-07 — Documentación verificable

El README no puede incluir nombres, métricas o estados que no provengan de artefactos versionados o de una tabla de capacidades auditada.

## INV-08 — CI sin bypass

Quedan prohibidos:
```yaml
|| true
continue-on-error: true
```
para lint, tests, migraciones, builds, contratos, smoke tests y E2E.
