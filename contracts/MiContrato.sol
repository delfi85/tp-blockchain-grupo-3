// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title CertiVax
 * @notice Sistema de trazabilidad para animales con gestión de eventos sanitarios y alimentarios
 */
contract CertiVax {
    // ============ ENUMS ============

    enum Role {
        None,       // Sin rol asignado
        Owner,      // Dueño del contrato (cooperativa/tambo)
        Vet,        // Veterinario
        FeedOp,     // Operador de alimentación/nutricionista
        Auditor,    // Auditor/autoridad sanitaria
        Farmer,     // Productor/ganadero
        Buyer       // Comprador
    }

    enum EventType {
        Vaccination,  // Vacunación
        HealthCheck,  // Control sanitario
        Feeding       // Alimentación
    }

    enum VerifState {
        Pending,   // Pendiente de verificación
        Verified,  // Verificado por auditor
        Revoked    // Revocado/Rechazado
    }

    enum DTEState {
        Created,          // Creado (inicial)
        Registered,       // Registrado por profesional
        PendingReview,    // Pendiente de revisión
        Verified,         // Verificado
        InTracking,       // En seguimiento
        Updated,          // Actualizado
        Closed,           // Cerrado
        Rejected          // Rechazado
    }

    // ============ STRUCTS ============

    struct Record {
        uint256 id;
        EventType eventType;
        string animalId;
        uint256 date;
        address actor;
        bytes32 certHash;
        VerifState state;
        DTEState dteState;
        string metaJson;
    }

    struct AnimalSummary {
        string animalId;
        uint256[] recordIds;
        uint16 qualityScore;
        uint256 lastUpdated;
        DTEState currentState;
        bool isActive;
    }

    // ============ STATE VARIABLES ============

    address public owner;
    bytes32 public contractHash;
    uint256 private recordCounter;

    mapping(address => Role) public roles;
    mapping(string => AnimalSummary) public animals;
    mapping(uint256 => Record) public records;

    // ============ EVENTS ============

    event RoleAssigned(address indexed account, Role role);
    event AnimalCreated(string indexed animalId, uint256 timestamp);
    event RecordCreated(uint256 indexed recordId, string indexed animalId, EventType eventType, address actor);
    event RecordVerified(uint256 indexed recordId, address indexed auditor);
    event RecordRevoked(uint256 indexed recordId, address indexed auditor, string reason);
    event RecordUpdated(uint256 indexed recordId, DTEState newState);
    event AnimalClosed(string indexed animalId, uint16 finalScore);
    event QualityScoreUpdated(string indexed animalId, uint16 newScore);

    // ============ MODIFIERS ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Solo el owner puede ejecutar esta funcion");
        _;
    }

    modifier onlyRole(Role _role) {
        require(roles[msg.sender] == _role, "No tienes el rol requerido");
        _;
    }

    modifier hasAnyRole(Role _role1, Role _role2) {
        require(
            roles[msg.sender] == _role1 || roles[msg.sender] == _role2,
            "No tienes ninguno de los roles requeridos"
        );
        _;
    }

    modifier animalExists(string memory _animalId) {
        require(bytes(animals[_animalId].animalId).length > 0, "Animal no existe");
        _;
    }

    modifier animalActive(string memory _animalId) {
        require(animals[_animalId].isActive, "Animal no esta activo");
        _;
    }

    // ============ CONSTRUCTOR ============

    constructor(bytes32 _contractHash) {
        owner = msg.sender;
        contractHash = _contractHash;
        roles[msg.sender] = Role.Owner;
        recordCounter = 0;

        emit RoleAssigned(msg.sender, Role.Owner);
    }

    // ============ ROLE MANAGEMENT ============

    function assignRole(address _account, Role _role) external onlyOwner {
        require(_account != address(0), "Direccion invalida");
        require(_role != Role.Owner, "No se puede asignar rol Owner");

        roles[_account] = _role;
        emit RoleAssigned(_account, _role);
    }

    function revokeRole(address _account) external onlyOwner {
        require(_account != owner, "No se puede revocar rol del owner");

        roles[_account] = Role.None;
        emit RoleAssigned(_account, Role.None);
    }

    function getRole(address _account) external view returns (Role) {
        return roles[_account];
    }

    // ============ ANIMAL MANAGEMENT ============

    function createAnimal(string memory _animalId) external hasAnyRole(Role.Owner, Role.Farmer) {
        require(bytes(_animalId).length > 0, "ID de animal invalido");
        require(bytes(animals[_animalId].animalId).length == 0, "Animal ya existe");

        animals[_animalId] = AnimalSummary({
            animalId: _animalId,
            recordIds: new uint256[](0),
            qualityScore: 100,
            lastUpdated: block.timestamp,
            currentState: DTEState.Created,
            isActive: true
        });

        emit AnimalCreated(_animalId, block.timestamp);
    }

    function closeAnimal(string memory _animalId)
        external
        onlyOwner
        animalExists(_animalId)
    {
        AnimalSummary storage animal = animals[_animalId];
        animal.isActive = false;
        animal.currentState = DTEState.Closed;
        animal.lastUpdated = block.timestamp;

        emit AnimalClosed(_animalId, animal.qualityScore);
    }

    // ============ RECORD MANAGEMENT ============

    function createRecord(
        string memory _animalId,
        EventType _eventType,
        bytes32 _certHash,
        string memory _metaJson
    )
        external
        hasAnyRole(Role.Vet, Role.FeedOp)
        animalExists(_animalId)
        animalActive(_animalId)
        returns (uint256)
    {
        require(_certHash != bytes32(0), "Hash del certificado requerido");

        recordCounter++;

        records[recordCounter] = Record({
            id: recordCounter,
            eventType: _eventType,
            animalId: _animalId,
            date: block.timestamp,
            actor: msg.sender,
            certHash: _certHash,
            state: VerifState.Pending,
            dteState: DTEState.Registered,
            metaJson: _metaJson
        });

        animals[_animalId].recordIds.push(recordCounter);
        animals[_animalId].lastUpdated = block.timestamp;
        animals[_animalId].currentState = DTEState.PendingReview;

        emit RecordCreated(recordCounter, _animalId, _eventType, msg.sender);

        return recordCounter;
    }

    function verifyRecord(uint256 _recordId)
        external
        onlyRole(Role.Auditor)
    {
        Record storage record = records[_recordId];
        require(record.id != 0, "Registro no existe");
        require(record.state == VerifState.Pending, "Registro ya fue procesado");

        record.state = VerifState.Verified;
        record.dteState = DTEState.Verified;

        AnimalSummary storage animal = animals[record.animalId];
        animal.currentState = DTEState.InTracking;
        animal.lastUpdated = block.timestamp;

        // Aumentar score de calidad por verificación exitosa
        if (animal.qualityScore < 100) {
            animal.qualityScore += 5;
            if (animal.qualityScore > 100) {
                animal.qualityScore = 100;
            }
        }

        emit RecordVerified(_recordId, msg.sender);
        emit QualityScoreUpdated(record.animalId, animal.qualityScore);
    }

    function revokeRecord(uint256 _recordId, string memory _reason)
        external
        onlyRole(Role.Auditor)
    {
        Record storage record = records[_recordId];
        require(record.id != 0, "Registro no existe");
        require(record.state != VerifState.Revoked, "Registro ya fue revocado");

        record.state = VerifState.Revoked;
        record.dteState = DTEState.Rejected;

        AnimalSummary storage animal = animals[record.animalId];
        animal.currentState = DTEState.Rejected;
        animal.lastUpdated = block.timestamp;

        // Reducir score de calidad por registro revocado
        if (animal.qualityScore >= 10) {
            animal.qualityScore -= 10;
        } else {
            animal.qualityScore = 0;
        }

        emit RecordRevoked(_recordId, msg.sender, _reason);
        emit QualityScoreUpdated(record.animalId, animal.qualityScore);
    }

    function updateRecordState(uint256 _recordId, DTEState _newState)
        external
        hasAnyRole(Role.Auditor, Role.Owner)
    {
        Record storage record = records[_recordId];
        require(record.id != 0, "Registro no existe");
        require(record.state == VerifState.Verified, "Solo registros verificados pueden actualizarse");

        record.dteState = _newState;
        animals[record.animalId].currentState = _newState;
        animals[record.animalId].lastUpdated = block.timestamp;

        emit RecordUpdated(_recordId, _newState);
    }

    // ============ QUERY FUNCTIONS ============

    function getAnimalRecords(string memory _animalId)
        external
        view
        animalExists(_animalId)
        returns (uint256[] memory)
    {
        return animals[_animalId].recordIds;
    }

    function getAnimalInfo(string memory _animalId)
        external
        view
        animalExists(_animalId)
        returns (
            uint16 qualityScore,
            uint256 lastUpdated,
            DTEState currentState,
            bool isActive,
            uint256 totalRecords
        )
    {
        AnimalSummary storage animal = animals[_animalId];
        return (
            animal.qualityScore,
            animal.lastUpdated,
            animal.currentState,
            animal.isActive,
            animal.recordIds.length
        );
    }

    function getRecord(uint256 _recordId)
        external
        view
        returns (Record memory)
    {
        require(records[_recordId].id != 0, "Registro no existe");
        return records[_recordId];
    }

    function getTotalRecords() external view returns (uint256) {
        return recordCounter;
    }

    function verifyRecordHash(uint256 _recordId, bytes32 _hash)
        external
        view
        returns (bool)
    {
        require(records[_recordId].id != 0, "Registro no existe");
        return records[_recordId].certHash == _hash;
    }
}