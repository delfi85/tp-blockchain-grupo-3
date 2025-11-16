# Modelado del Contrato Inteligente CertiVax

## Descripción General
Sistema de trazabilidad blockchain para animales de producción ganadera que gestiona eventos sanitarios, alimentarios y de control de calidad con verificación mediante roles y estados de ciclo de vida (DTE).

---

## 1. Operaciones / Transacciones con Parámetros

### 1.1 Gestión de Roles

#### `assignRole(address _account, Role _role)`
- **Descripción**: Asigna un rol a una cuenta específica
- **Parámetros**:
  - `_account`: Dirección Ethereum del usuario
  - `_role`: Enum Role (1-6: Owner, Vet, FeedOp, Auditor, Farmer, Buyer)
- **Restricción**: Solo Owner
- **Eventos**: `RoleAssigned(address indexed account, Role role)`

#### `revokeRole(address _account)`
- **Descripción**: Revoca el rol de una cuenta
- **Parámetros**:
  - `_account`: Dirección del usuario a revocar
- **Restricción**: Solo Owner
- **Eventos**: `RoleAssigned(address indexed account, Role.None)`

#### `getRole(address _account) → Role`
- **Descripción**: Consulta el rol de una cuenta
- **Parámetros**:
  - `_account`: Dirección a consultar
- **Retorna**: Enum Role
- **Visibilidad**: View (sin costo de gas)

---

### 1.2 Gestión de Animales

#### `createAnimal(string memory _animalId)`
- **Descripción**: Registra un nuevo animal en el sistema
- **Parámetros**:
  - `_animalId`: Identificador único del animal (ej: "VACA-001")
- **Restricción**: Solo Owner o Farmer
- **Estado inicial**: 
  - `qualityScore`: 100
  - `currentState`: Created
  - `isActive`: true
- **Eventos**: `AnimalCreated(string indexed animalId, uint256 timestamp)`

#### `closeAnimal(string memory _animalId)`
- **Descripción**: Cierra el ciclo de trazabilidad del animal (vendido/trasladado)
- **Parámetros**:
  - `_animalId`: ID del animal a cerrar
- **Restricción**: Solo Owner
- **Efectos**:
  - `isActive`: false
  - `currentState`: Closed
  - Score final congelado
- **Eventos**: `AnimalClosed(string indexed animalId, uint16 finalScore)`

#### `getAnimalInfo(string memory _animalId) → (uint16, uint256, DTEState, bool, uint256)`
- **Descripción**: Obtiene información completa del animal
- **Parámetros**:
  - `_animalId`: ID del animal
- **Retorna**:
  - `qualityScore`: Puntaje de calidad (0-100)
  - `lastUpdated`: Timestamp última actualización
  - `currentState`: Estado DTE actual
  - `isActive`: Si está activo
  - `totalRecords`: Cantidad de registros
- **Visibilidad**: View

#### `getAnimalRecords(string memory _animalId) → uint256[]`
- **Descripción**: Retorna IDs de todos los registros del animal
- **Parámetros**:
  - `_animalId`: ID del animal
- **Retorna**: Array de IDs de registros
- **Visibilidad**: View

---

### 1.3 Gestión de Registros (Eventos Sanitarios/Alimentarios)

#### `createRecord(string memory _animalId, EventType _eventType, bytes32 _certHash, string memory _metaJson) → uint256`
- **Descripción**: Crea un nuevo registro de evento (vacunación, control, alimentación)
- **Parámetros**:
  - `_animalId`: ID del animal
  - `_eventType`: 0=Vaccination, 1=HealthCheck, 2=Feeding
  - `_certHash`: Hash del documento certificado (integridad)
  - `_metaJson`: Metadatos en formato JSON
- **Restricción**: Solo Vet o FeedOp
- **Efectos**:
  - Incrementa `recordCounter`
  - Actualiza `currentState` del animal a PendingReview
  - Estado inicial del registro: Pending, Registered
- **Retorna**: ID del registro creado
- **Eventos**: `RecordCreated(uint256 indexed recordId, string indexed animalId, EventType eventType, address actor)`

#### `verifyRecord(uint256 _recordId)`
- **Descripción**: Auditor verifica y aprueba un registro
- **Parámetros**:
  - `_recordId`: ID del registro a verificar
- **Restricción**: Solo Auditor
- **Efectos**:
  - `state`: Verified
  - `dteState`: Verified
  - Animal `currentState`: InTracking
  - `qualityScore`: +5 puntos (máx 100)
- **Eventos**: 
  - `RecordVerified(uint256 indexed recordId, address indexed auditor)`
  - `QualityScoreUpdated(string indexed animalId, uint16 newScore)`

#### `revokeRecord(uint256 _recordId, string memory _reason)`
- **Descripción**: Auditor rechaza/revoca un registro por inconsistencias
- **Parámetros**:
  - `_recordId`: ID del registro
  - `_reason`: Motivo del rechazo
- **Restricción**: Solo Auditor
- **Efectos**:
  - `state`: Revoked
  - `dteState`: Rejected
  - Animal `currentState`: Rejected
  - `qualityScore`: -10 puntos (mín 0)
- **Eventos**: 
  - `RecordRevoked(uint256 indexed recordId, address indexed auditor, string reason)`
  - `QualityScoreUpdated(string indexed animalId, uint16 newScore)`

#### `updateRecordState(uint256 _recordId, DTEState _newState)`
- **Descripción**: Actualiza el estado DTE de un registro verificado
- **Parámetros**:
  - `_recordId`: ID del registro
  - `_newState`: Nuevo estado DTE (Updated, Closed, etc.)
- **Restricción**: Solo Auditor u Owner
- **Eventos**: `RecordUpdated(uint256 indexed recordId, DTEState newState)`

#### `getRecord(uint256 _recordId) → Record`
- **Descripción**: Obtiene información completa de un registro
- **Parámetros**:
  - `_recordId`: ID del registro
- **Retorna**: Struct Record completo
- **Visibilidad**: View

#### `verifyRecordHash(uint256 _recordId, bytes32 _hash) → bool`
- **Descripción**: Verifica integridad del documento mediante hash
- **Parámetros**:
  - `_recordId`: ID del registro
  - `_hash`: Hash a comparar
- **Retorna**: true si coincide
- **Visibilidad**: View

#### `getTotalRecords() → uint256`
- **Descripción**: Retorna cantidad total de registros en el sistema
- **Visibilidad**: View

---

## 2. Modelo de Datos / Estructuras

### 2.1 Enumeraciones (Enums)

#### `Role`
```solidity
enum Role {
    None,       // 0: Sin rol asignado
    Owner,      // 1: Dueño del contrato (cooperativa/tambo)
    Vet,        // 2: Veterinario
    FeedOp,     // 3: Operador de alimentación/nutricionista
    Auditor,    // 4: Auditor/autoridad sanitaria
    Farmer,     // 5: Productor/ganadero
    Buyer       // 6: Comprador
}